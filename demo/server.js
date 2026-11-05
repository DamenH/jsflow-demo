// Static hosting only. Edited source executes in browser Web Workers.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname,'web');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.txt':'text/plain'};
http.createServer((request,response)=>{
  response.setHeader('Cache-Control',request.url.startsWith('/assets/') && request.url.includes('?v=') ? 'private, max-age=31536000, immutable' : 'no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  const worker = request.url.startsWith('/assets/') && request.url.includes('.worker.js');
  response.setHeader('Content-Security-Policy',worker
    ? "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; worker-src 'none'"
    : "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'none'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'");
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch(_){response.writeHead(400);return response.end('Bad request');}
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(request.method!=='GET'||!filename.startsWith(root+path.sep)||!types[path.extname(filename)]){response.writeHead(404);return response.end('Not found');}
  fs.readFile(filename,(error,bytes)=>{
    if(error){response.writeHead(404);return response.end('Not found');}
    response.writeHead(200,{'Content-Type':types[path.extname(filename)]+'; charset=utf-8'});response.end(bytes);
  });
}).listen(8080,'0.0.0.0',()=>console.log('JSFlow debugger static server on port 8080'));
