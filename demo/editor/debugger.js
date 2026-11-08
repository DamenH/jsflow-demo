// Browser embedding of the unchanged upstream interpreter. No Node APIs/modules.
import { MonitorBase } from '/opt/jsflow/out/MonitorBase';
import { Instances } from '/opt/jsflow/out/Instances';
import { GlobalObject } from '/opt/jsflow/out/Objects/GlobalObject';
import { NewObjectEnvironment } from '/opt/jsflow/out/ObjectEnvironmentRecord';
import { BuiltinFunctionObject } from '/opt/jsflow/out/Objects/BuiltinFunctionObject';
import { DefineFFF } from '/opt/jsflow/out/Define';
import { Value } from '/opt/jsflow/out/Value';
import { bot, le, lub } from '/opt/jsflow/out/Label';
import { ToString } from '/opt/jsflow/out/Conversion/ToString';
import { ToNumber } from '/opt/jsflow/out/Conversion/ToNumber';
import { Task } from '/opt/jsflow/out/Engine/Task';
import { Result } from '/opt/jsflow/out/Result';
import { teachingOptions } from '../teaching-options.js';

const send = message => self.postMessage(message);
const boundaryTypes = new Set(['VariableDeclaration','ExpressionStatement','IfStatement','WhileStatement','DoWhileStatement','ForStatement','ForInStatement','ReturnStatement','ThrowStatement','TryStatement','SwitchStatement','WithStatement','BreakStatement','ContinueStatement','DebuggerStatement']);
let engine, breakpoints = new Set(), current = null, state = 'idle', steps = 0, busy = false, baseline, output = [], diagnostics = [], runnable = [], timer;
let callbacks = [], registrations = 0, phase = 'main script', callbackCount = 0;
function timerDelay(value) { return Math.min(2000,Math.max(0,Number.isFinite(value)?Math.trunc(value):0)); }
function preview(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value.slice(0,1000));
  if (typeof value === 'object') return '[' + (value.Class || 'Object') + ']';
  return String(value);
}
function append(list, value) { if (list.length >= 100) throw new Error('Output limit reached (100 messages).'); list.push(String(value).slice(0,2000)); }
class BrowserMonitor extends MonitorBase {
  constructor() {
    const quiet = () => {};
    super(self, value => append(diagnostics, value), quiet, quiet, quiet, quiet);
    this.instances = new Instances(self); this.instances.Setup();
    this.GlobalObject = new GlobalObject(self);
    this.GlobalEnvironment = NewObjectEnvironment(new Value(this.GlobalObject,bot),new Value(null,bot));
    this.context.thisValue = new Value(this.GlobalObject,bot);
    this.context.variableEnv = new Value(this.GlobalEnvironment,bot);
    this.context.lexicalEnv = new Value(this.GlobalEnvironment,bot);
  }
  ExecuteModule() { throw new Error('Modules are unavailable in this browser demo.'); }
}
function builtin(name, count, fn) { DefineFFF(engine.GlobalObject,new Value(name,bot),new BuiltinFunctionObject(fn,count,undefined)); }
function locals() {
  const result = [], seen = new Set();
  let environment = engine.context.lexicalEnv.value, depth = 0;
  while (environment && depth++ < 12) {
    const record = environment.EnvironmentRecord;
    const object = record.bindingObject ? record.bindingObject.value : record;
    for (const name of Object.keys(object.properties)) {
      if (seen.has(name) || object === engine.GlobalObject && baseline.has(name)) continue;
      seen.add(name);
      const desc = Object.getOwnPropertyDescriptor(object.properties,name);
      // Read internal data descriptors only. Do not call interpreted getters.
      result.push({name, value:desc && 'value' in desc ? preview(desc.value) : '[accessor]',label:String(object.labels[name]?.value || bot)});
      if (result.length >= 100) return result;
    }
    environment = environment.OuterLexicalEnvironment?.value;
  }
  return result;
}
function snapshot(reason, error, waitMs) {
  send({type:'state',state,reason,line:current?.loc?.start.line || null,column:current?.loc?.start.column || 0,pc:engine ? String(engine.context.effectivePC) : '<>',variables:engine ? locals() : [],output:[...output],diagnostics:[...diagnostics],steps,lines:runnable,phase,pendingCallbacks:callbacks.length,waitMs,error});
}
function boundary() {
  if (!engine.running() || engine.context.result.type !== 'normal') return null;
  const item = engine.context.workList.peek();
  return item && item.loc && boundaryTypes.has(item.type) ? item : null;
}
function single() {
  if (++steps > 200000) throw new Error('Execution limit reached (200,000 interpreter steps).');
  engine.debug.active = true; engine.step();
}
function fail(error) {
  busy = false; clearTimeout(timer);
  state = error.type === 'SecurityError' ? 'blocked' : 'error';
  const message = error.message || error.value?.message || (error.value !== undefined ? preview(error.value) : String(error));
  snapshot(state,{type:error.type || (error.value ? 'JavaScriptError' : error.name || 'Error'), message});
}
function finish() {
  busy = false; state = 'completed';
  const result = engine.context.result;
  if (result.type === 'throw') return fail(result.value);
  current = null; snapshot('completed');
}
// Timer host adapter. Callback bodies still execute in the unchanged interpreter.
class DeferredEnd extends Task {
  constructor(root) { super(Task.runfor_all); this.root = root; }
  Execute() {
    const completion = this.root.valueStack.pop();
    this.root.popPC();
    this.root.result = new Result();
    if (completion.type === 'throw') throw completion.value;
  }
}
function dispatchCallback() {
  const job = callbacks.shift(), root = engine.context;
  root.result = new Result();
  root.pushPC(job.context);
  root.workList.push(new DeferredEnd(root));
  phase = 'callback #' + (++callbackCount);
  job.callback.value.AsyncCall(new Value(undefined,bot),job.args);
}
function advance(mode, skipCurrent) {
  busy = true; state = 'running';
  const started = performance.now();
  let skip = skipCurrent;
  function chunk() {
    try {
      for (let i=0;i<1000;i++) {
        if (performance.now()-started > 5000) throw new Error('Execution timed out (5 seconds).');
        if (!engine.running()) {
          if (engine.context.result.type === 'throw' || !callbacks.length) return finish();
          callbacks.sort((a,b)=>a.due-b.due || a.id-b.id);
          const remaining=callbacks[0].due-performance.now();
          if (remaining>0) {
            state='waiting';current=null;snapshot('timer',undefined,Math.ceil(remaining));
            timer=setTimeout(()=>{state='running';chunk();},remaining);return;
          }
          dispatchCallback();
          // Timer callbacks run only after the current interpreted task has drained.
          skip = false; timer = setTimeout(chunk,0); return;
        }
        const next = boundary();
        if (next && !skip && (mode === 'step' || breakpoints.has(next.loc.start.line) || next.type === 'DebuggerStatement')) {
          current = next; state = 'paused'; busy = false; snapshot(mode === 'step' ? 'step' : 'breakpoint'); return;
        }
        if (next) current = next;
        single(); skip = false;
      }
      timer = setTimeout(chunk,0);
    } catch (error) { fail(error); }
  }
  chunk();
}
function collectLines(ast) {
  const lines = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.loc && boundaryTypes.has(node.type)) lines.add(node.loc.start.line);
    for (const [key,value] of Object.entries(node)) {
      if (key === 'loc' || key === 'range') continue;
      if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast); return [...lines].sort((a,b)=>a-b);
}
self.onmessage = ({data}) => {
  try {
    if (data.type === 'breakpoints') { breakpoints = new Set(data.lines); return; }
    if (data.type === 'native') {
      const result = [], log = [], queue = [];
      let scheduled = 0;
      const complete = error => send({type:'native',output:result,diagnostics:log,error:error ? String(error) : undefined});
      const schedule = (callback,delay,...args) => {
        if (typeof callback !== 'function') throw new TypeError('setTimeout expects a callback function');
        if (++scheduled > 100) throw new Error('Timer limit reached (100 registrations).');
        queue.push({callback:()=>callback(...args),due:performance.now()+timerDelay(Number(delay)),id:scheduled});
        return scheduled;
      };
      function drain() {
        try {
          if (!queue.length) return complete();
          queue.sort((a,b)=>a.due-b.due || a.id-b.id);
          const remaining=queue[0].due-performance.now();
          if (remaining>0) return setTimeout(drain,remaining);
          queue.shift().callback(); setTimeout(drain,0);
        } catch (error) { complete(error); }
      }
      try {
        new Function('lbl','publicOutput','checkpoint','print','setTimeout','declassify',data.code)(value=>value,value=>append(result,value),()=>{},value=>append(log,value),schedule,teachingOptions.declassification ? value=>value : undefined);
        setTimeout(drain,0);
      } catch (error) { complete(error); }
      return;
    }
    if (data.type === 'start') {
      clearTimeout(timer); busy=false; steps=0; current=null; output=[]; diagnostics=[];callbacks=[];registrations=0;phase='main script';callbackCount=0;
      breakpoints = new Set(data.breakpoints || []);
      engine = new BrowserMonitor();
      builtin('publicOutput',1,(_,args)=>{
        const value = ToString(args[0] || new Value(undefined,bot));
        const pc = engine.context.effectivePC;
        engine.assert(le(lub(value.label,pc),bot),'publicOutput: value '+value.label+', context '+pc+' cannot flow to public <>');
        append(output,value.value); return new Value(undefined,bot);
      });
      builtin('checkpoint',2,()=>new Value(undefined,bot));
      builtin('setTimeout',2,(_,args)=>{
        const callback = args[0];
        if (!callback || !callback.value || typeof callback.value.AsyncCall !== 'function') {
          engine.Throw('TypeError','setTimeout expects an interpreted callback function',bot);
        }
        const delay=ToNumber(args[1] || new Value(0,bot));
        if (++registrations > 100) engine.fatal('Timer limit reached (100 registrations).');
        const context=lub(engine.context.effectivePC,callback.label,delay.label);
        callbacks.push({callback:callback.clone(),args:args.slice(2).map(value=>value.clone()),context,due:performance.now()+timerDelay(delay.value),id:registrations});
        return new Value(registrations,context);
      });
      baseline = new Set(Object.getOwnPropertyNames(engine.GlobalObject.properties));
      engine.debug.active = true;
      engine.Execute(data.code,'editor.js');
      runnable = collectLines(engine.ast);
      advance(data.pauseOnEntry ? 'step' : 'continue',false);
    } else if (!busy && state === 'paused' && ['step','continue'].includes(data.type)) advance(data.type,true);
  } catch (error) { fail(error); }
};
