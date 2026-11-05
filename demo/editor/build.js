const esbuild = require('esbuild');
const fs = require('fs');
const crypto = require('crypto');
const buildID = crypto.createHash('sha256').update(['ui.js','debugger.js','build.js','package-lock.json','../scenarios.js','../web/index.html','/opt/jsflow/package-lock.json'].map(file=>fs.readFileSync(file)).join('')).digest('hex').slice(0,16);
const common = {bundle:true, minify:true, target:'es2020', outdir:'dist', nodePaths:['/opt/jsflow/node_modules'], loader:{'.ttf':'file'}, assetNames:'[name]-[hash]', legalComments:'eof', define:{__BUILD_ID__:JSON.stringify(buildID)}};
const shims = {name:'browser-only',setup(build){
  build.onResolve({filter:/^js-beautify$/},()=>({path:'beautify',namespace:'shim'}));
  build.onLoad({filter:/.*/,namespace:'shim'},()=>({contents:'export const js = code => code;'}));
}};
Promise.all([
 esbuild.build({...common,entryPoints:{app:'ui.js'},format:'esm'}),
 esbuild.build({...common,entryPoints:{'editor.worker':'node_modules/monaco-editor/esm/vs/editor/editor.worker.js','ts.worker':'node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js'},format:'iife'}),
 esbuild.build({...common,entryPoints:{'jsflow.worker':'debugger.js'},format:'iife',plugins:[shims]})
]).then(()=>{
 fs.writeFileSync('dist/index.html',fs.readFileSync('../web/index.html','utf8').replaceAll('__BUILD_ID__',buildID));
 fs.copyFileSync('/opt/jsflow/LICENSE','dist/jsflow-license.txt');
 fs.copyFileSync('node_modules/monaco-editor/LICENSE','dist/monaco-license.txt');
}).catch(error=>{console.error(error);process.exit(1)});
