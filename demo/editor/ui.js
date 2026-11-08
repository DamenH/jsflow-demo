import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/languages/definitions/javascript/register.js';
import * as typescript from 'monaco-editor/language/typescript/monaco.contribution.js';
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import { scenarios, program } from '../scenarios.js';
import { teachingOptions } from '../teaching-options.js';

// Blob workers inherit the static page's CSP; Pages cannot set worker headers.
function createWorker(name) {
 const source=new URL('./assets/'+name+'.worker.js?v='+__BUILD_ID__,document.baseURI).href;
 const url=URL.createObjectURL(new Blob(['importScripts('+JSON.stringify(source)+');'],{type:'text/javascript'}));
 const instance=new Worker(url);
 const release=()=>URL.revokeObjectURL(url);
 instance.addEventListener('message',release,{once:true});instance.addEventListener('error',release,{once:true});
 const terminate=instance.terminate.bind(instance);instance.terminate=()=>{release();terminate();};
 return instance;
}
self.MonacoEnvironment = {getWorker:(_,label)=>createWorker(['typescript','javascript'].includes(label)?'ts':'editor')};
const $ = id=>document.getElementById(id);
for (const id of ['lesson','policy-note','teaching-details']) $(id).hidden=!teachingOptions.explanations;
$('declass-comparison').hidden=!teachingOptions.declassification;
typescript.javascriptDefaults.setCompilerOptions({target:typescript.ScriptTarget.ES5,allowJs:true,checkJs:true,noEmit:true});
typescript.javascriptDefaults.addExtraLib('declare function lbl<T>(value: T, ...labels: string[]): T;\ndeclare function declassify<T>(value: T): T;\ndeclare function publicOutput(value: any): void;\ndeclare function checkpoint(name: string, value: any): void;\ndeclare function print(value: any): void;\ndeclare function setTimeout(callback: (...args: any[]) => void, delay?: number, ...args: any[]): number;','ts:jsflow.d.ts');
monaco.editor.defineTheme('plain',{base:'vs',inherit:true,rules:[],colors:{'editor.background':'#fafafa','editor.lineHighlightBackground':'#f0f2f4','editorLineNumber.foreground':'#8a8f97','editorGutter.background':'#fafafa'}});
typescript.javascriptDefaults.setEagerModelSync(true);
const model=monaco.editor.createModel('','javascript',monaco.Uri.parse('file:///editor.js'));
const editor = monaco.editor.create($('editor'),{model,theme:'plain',automaticLayout:true,fontSize:17,lineHeight:27,fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',minimap:{enabled:false},glyphMargin:true,scrollBeyondLastLine:false,renderLineHighlight:'line',padding:{top:12,bottom:12},tabSize:4,insertSpaces:true,wordWrap:'on',overviewRulerLanes:0,hideCursorInOverviewRuler:true,ariaLabel:'Editable JavaScript source',fixedOverflowWidgets:true,hover:{above:false,delay:250}});
let worker, nativeWorker, watchdog, nativeTimeout, state='idle', breakpoints=new Set(), breakpointDecorations=[], executionDecorations=[], updating=false, selected='direct', dirty=false, currentLine=null;
const drafts=new Map();
let trackedVariables=new Map(), trackedPC='<>', hoverAvailable=false;
const escapeMarkdown=text=>String(text).replace(/[\\`*_{}\[\]()<>#+.!|~-]/g,'\\$&');
function hoverInfo(model,position){
 if(!hoverAvailable)return null;
 const word=model.getWordAtPosition(position);if(!word)return null;
 const variable=trackedVariables.get(word.word);if(!variable)return null;
 return {range:new monaco.Range(position.lineNumber,word.startColumn,position.lineNumber,word.endColumn),contents:[
  {value:'**'+escapeMarkdown(variable.name)+'**'},
  {value:'Value: '+escapeMarkdown(variable.value)},
  {value:'JSFlow label: '+escapeMarkdown(variable.label)+' ('+(variable.label==='<T>'?'secret':variable.label==='<>'?'public':'labeled')+')'},
  {value:'Current execution context: '+escapeMarkdown(trackedPC)}
 ]};
}
monaco.languages.registerHoverProvider('javascript',{provideHover:hoverInfo});
function template(id){return program(scenarios.find(item=>item.id===id),'polar/otter?key=42',true).split('\n').filter(line=>!line.includes('checkpoint(')).join('\n');}
for(const scenario of scenarios){const option=document.createElement('option');option.value=scenario.id;option.textContent=scenario.tag+' — '+scenario.title;$('examples').append(option);}
function setText(id,text){$(id).textContent=text;}
function buttons(){const paused=state==='paused',running=state==='running'||state==='waiting';$('continue').disabled=!paused;$('stop').disabled=!worker;$('step').disabled=running;$('run').disabled=running;$('debug').disabled=running;}
function message(text,tone=''){setText('status',text);$('status').className=tone;}
function decorations(){
 breakpointDecorations=editor.deltaDecorations(breakpointDecorations,[...breakpoints].map(line=>({range:new monaco.Range(line,1,line,1),options:{glyphMarginClassName:'breakpoint-glyph',glyphMarginHoverMessage:{value:'Breakpoint: line '+line}}})));
 executionDecorations=editor.deltaDecorations(executionDecorations,currentLine?[{range:new monaco.Range(currentLine,1,currentLine,1),options:{isWholeLine:true,className:'execution-line',linesDecorationsClassName:'execution-marker'}}]:[]);
}
function terminate(){if(worker)worker.terminate();worker=null;clearTimeout(watchdog);buttons();}
function clearInspection(){trackedVariables.clear();hoverAvailable=false;setText('pc','—');$('variables').replaceChildren();setText('public-output','No output.');setText('diagnostics','No diagnostic output.');setText('error','');currentLine=null;decorations();}
function stop(){terminate();state='stopped';message('Stopped');currentLine=null;decorations();buttons();}
function invalidate(){terminate();if(nativeWorker)nativeWorker.terminate();clearTimeout(nativeTimeout);state='idle';clearInspection();setText('native-output','Not run.');message('Edited — run to execute your changes');buttons();}
function loadExample(reset=false){
 if(!reset)drafts.set(selected,{code:editor.getValue(),breakpoints:[...breakpoints],dirty});
 selected=$('examples').value;const draft=reset?null:drafts.get(selected);
 $('declassification-note').hidden=selected!=='declassified'||!teachingOptions.declassification;
 $('timer-note').hidden=!teachingOptions.fixedTimers||!['deferred','deferred-control'].includes(selected);
 terminate();updating=true;editor.setValue(draft?draft.code:template(selected));updating=false;
 breakpoints=new Set(draft?draft.breakpoints:[]);dirty=draft?.dirty||false;invalidate();setText('lesson',scenarios.find(item=>item.id===selected).lesson);setText('file-state',dirty?'Modified':'Example');start(true);
}
editor.onDidChangeModelContent(()=>{if(updating)return;dirty=true;setText('file-state','Modified');invalidate();});
editor.onMouseDown(event=>{
 if(event.target.type!==monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN)return;
 const line=event.target.position?.lineNumber;if(!line)return;
 if(breakpoints.has(line))breakpoints.delete(line);else breakpoints.add(line);
 decorations();worker?.postMessage({type:'breakpoints',lines:[...breakpoints]});renderBreakpoints();
});
function renderBreakpoints(){setText('breakpoint-list',breakpoints.size?[...breakpoints].sort((a,b)=>a-b).join(', '):'None. Click the gutter beside a line number.');}
function inspect(data){
 state=data.state;currentLine=data.line;clearTimeout(watchdog);trackedVariables=new Map(data.variables.map(variable=>[variable.name,variable]));trackedPC=data.pc;hoverAvailable=true;
 const title=state==='paused'?'Paused before line '+data.line+' · '+(data.reason==='breakpoint'?'breakpoint':'step'):state==='blocked'?'Blocked by JSFlow':state==='completed'?'Completed':state==='error'?'Execution error':state==='waiting'?'Waiting for callback (~'+data.waitMs+' ms)':state;
 message(title,['blocked','error'].includes(state)?'error':state==='paused'?'paused':'');
 setText('scope-info',data.phase+' · '+data.pendingCallbacks+' callback'+(data.pendingCallbacks===1?'':'s')+' queued');
 setText('pc',data.pc);$('pc').className=data.pc==='<T>'?'secret':'';
 const rows=[];
 for(const variable of data.variables){const row=document.createElement('tr');for(const [key,value]of Object.entries(variable)){const cell=document.createElement('td');cell.textContent=value;if(key==='label'&&value==='<T>')cell.className='secret';row.append(cell);}rows.push(row);}
 $('variables').replaceChildren(...rows);
 if(!rows.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=3;cell.textContent='No user variables in this scope.';row.append(cell);$('variables').append(row);}
 setText('public-output',data.output.length?data.output.join('\n'):'No output.');setText('diagnostics',data.diagnostics.length?data.diagnostics.join('\n'):'No diagnostic output.');
 setText('error',data.error?data.error.type+': '+data.error.message:'');setText('steps',data.steps+' internal steps');
 decorations();if(currentLine)editor.revealLineInCenterIfOutsideViewport(currentLine);
 if(['blocked','completed','error'].includes(state))terminate();else if(state==='waiting')watch();buttons();
}
function watch(){clearTimeout(watchdog);watchdog=setTimeout(()=>{stop();message('Execution timed out','error');setText('error','The worker was stopped after 6 seconds.');},6000);}
function start(pauseOnEntry=false){
 terminate();state='running';clearInspection();message('Running JSFlow…');setText('native-output','Not run.');
 worker=createWorker('jsflow');worker.onmessage=({data})=>{if(data.type==='state')inspect(data);};worker.onerror=event=>{stop();message('Worker error','error');setText('error',event.message);};
 worker.postMessage({type:'start',code:editor.getValue(),pauseOnEntry,breakpoints:[...breakpoints]});watch();buttons();renderBreakpoints();
}
function advance(type){if(state!=='paused'){if(type==='step')start(true);return;}state='running';message('Running JSFlow…');worker.postMessage({type});watch();buttons();}
function compare(){
 if(nativeWorker)nativeWorker.terminate();clearTimeout(nativeTimeout);
 setText('native-output','Running ordinary JavaScript…');
 nativeWorker=createWorker('jsflow');nativeWorker.onmessage=({data})=>{if(data.type!=='native')return;clearTimeout(nativeTimeout);setText('native-output',(data.output.length?data.output.join('\n'):'No public output.')+(data.error?'\n'+data.error:''));nativeWorker.terminate();nativeWorker=null;};
 nativeWorker.onerror=event=>{clearTimeout(nativeTimeout);setText('native-output',event.message);nativeWorker?.terminate();nativeWorker=null;};
 nativeWorker.postMessage({type:'native',code:editor.getValue()});nativeTimeout=setTimeout(()=>{nativeWorker?.terminate();nativeWorker=null;setText('native-output','Execution timed out. Worker stopped.');},6000);
}
$('run').onclick=()=>start();$('debug').onclick=()=>start(true);$('continue').onclick=()=>advance('continue');$('step').onclick=()=>advance('step');$('stop').onclick=stop;
$('reset').onclick=()=>{loadExample(true);renderBreakpoints();};$('examples').onchange=()=>{loadExample();renderBreakpoints();};$('compare').onclick=compare;
editor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.Enter,()=>start());
editor.addCommand(monaco.KeyCode.F5,()=>state==='paused'?advance('continue'):start());editor.addCommand(monaco.KeyCode.F10,()=>advance('step'));
$('clear-breakpoints').onclick=()=>{breakpoints.clear();decorations();renderBreakpoints();worker?.postMessage({type:'breakpoints',lines:[]});};
// A small documented interface for browser integration tests and diagnostics.
window.jsflowDemo={editor,start,step:()=>advance('step'),continue:()=>advance('continue'),get state(){return state;},hoverInfo:position=>hoverInfo(editor.getModel(),position),setBreakpoints(lines){breakpoints=new Set(lines);decorations();renderBreakpoints();worker?.postMessage({type:'breakpoints',lines});}};
updating=true;editor.setValue(template(selected));updating=false;renderBreakpoints();buttons();setText('lesson',scenarios[0].lesson);start(true);
