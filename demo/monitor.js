// Trusted demo adapter. The upstream interpreter and its enforcement are unchanged.
const fs = require('fs');
const { NodeJSMonitor } = require('/opt/jsflow/out/Toplevel/nodejs/NodeJSMonitor');
const { BuiltinFunctionObject } = require('/opt/jsflow/out/Objects/BuiltinFunctionObject');
const { DefineFFF } = require('/opt/jsflow/out/Define');
const { Value } = require('/opt/jsflow/out/Value');
const { bot, lub, le } = require('/opt/jsflow/out/Label');
const { ToString } = require('/opt/jsflow/out/Conversion/ToString');

function runProgram(code, origin, onEvent = () => {}, diagnostic = console.log) {
  const quiet = () => {};
  const monitor = new NodeJSMonitor(global, diagnostic, quiet, quiet, console.warn, console.error);
  monitor.options.set('monitor.babel', false);
  function builtin(name, count, fn) {
    DefineFFF(monitor.GlobalObject, new Value(name, bot), new BuiltinFunctionObject(fn, count, undefined));
  }
  builtin('publicOutput', 1, function (thisArg, args) {
    if (args.length !== 1) throw new Error('publicOutput expects one argument');
    const text = ToString(args[0]);
    const pc = monitor.context.effectivePC;
    onEvent({ kind: 'sink-check', name: 'Check public output', value: text.value, label: String(text.label), pc: String(pc) });
    monitor.assert(le(lub(pc, text.label), bot),
      'publicOutput: value ' + text.label + ', context ' + pc + ' cannot flow to public <>');
    onEvent({ kind: 'output', name: 'Public inbox received a message', value: text.value, label: String(text.label), pc: String(pc) });
    diagnostic('PUBLIC: ' + text.value);
    return new Value(undefined, bot);
  });
  // Trusted observation checkpoints, not a statement-by-statement debugger.
  builtin('checkpoint', 2, function (thisArg, args) {
    const name = ToString(args[0]);
    const value = ToString(args[1]);
    onEvent({ kind: 'checkpoint', name: name.value, value: value.value, label: String(value.label), pc: String(monitor.context.effectivePC) });
    return new Value(undefined, bot);
  });
  monitor.Execute(code, origin, true);
}
module.exports = { runProgram };
if (require.main === module) {
  try {
    const filename = process.argv[2];
    if (!filename) throw new Error('Expected an example filename');
    runProgram(fs.readFileSync(filename, 'utf8'), filename);
  } catch (error) {
    console.error(error.type ? error.type + ': ' + error.message : String(error));
    process.exitCode = 1;
  }
}
