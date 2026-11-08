// Run with PLAYWRIGHT_MODULE set to an installed Playwright module if necessary.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const base=process.argv[2] || 'http://127.0.0.1:8766';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  await page.goto(base);
  const paused=async line=>{await page.waitForFunction(line=>window.jsflowDemo?.state==='paused'&&document.querySelector('#status').textContent.includes('line '+line+' ·'),line);};
  const clickStep=async line=>{await page.locator('#step').click();await paused(line);};
  const variable=async name=>page.locator('#variables tr').evaluateAll((rows,name)=>{const row=rows.find(row=>row.cells[0]?.textContent===name);return row?{value:row.cells[1].textContent,label:row.cells[2].textContent}:null;},name);
  const code=async text=>{await page.evaluate(text=>window.jsflowDemo.editor.setValue(text),text);await page.locator('#debug').click();await paused(1);};
  const untilDone=async()=>{await page.waitForFunction(()=>['completed','blocked','error'].includes(window.jsflowDemo.state));};
  await paused(1);
  assert.equal((await variable('token')).value,'undefined');
  await clickStep(2);
  assert.deepEqual(await variable('token'),{value:'"polar/otter?key=42"',label:'<T>'});
  const hover=await page.evaluate(()=>window.jsflowDemo.hoverInfo({lineNumber:1,column:5}));
  assert(hover.contents.some(c=>c.value.includes('secret')));
  // Exercise actual Monaco hover rendering, not just our data provider.
  await page.evaluate(()=>{window.jsflowDemo.editor.focus();window.jsflowDemo.editor.setPosition({lineNumber:1,column:5});window.jsflowDemo.editor.trigger('test','editor.action.showHover',{});});
  await page.waitForSelector('.monaco-hover:visible');
  assert.match(await page.locator('.monaco-hover:visible').innerText(),/JSFlow label: <T>/);
  await page.keyboard.press('Escape');
  const gutter=await page.evaluate(()=>{const e=window.jsflowDemo.editor;const box=document.querySelector('#editor').getBoundingClientRect();const line=e.getScrolledVisiblePosition({lineNumber:4,column:1});return {x:box.x+e.getLayoutInfo().glyphMarginLeft+10,y:box.y+line.top+line.height/2};});
  await page.mouse.click(gutter.x,gutter.y);
  assert.equal(await page.locator('#breakpoint-list').textContent(),'4');
  await page.locator('#continue').click();await paused(4);
  assert.equal(await page.locator('#public-output').innerText(),'No output.');
  assert.equal((await variable('message')).label,'<T>');
  await page.locator('#step').click();await untilDone();
  assert.equal(await page.evaluate(()=>window.jsflowDemo.state),'blocked');
  assert.match(await page.locator('#error').innerText(),/publicOutput: value <T>, context <>/);
  await page.locator('#examples').selectOption('implicit');await paused(1);
  await clickStep(2);await clickStep(3);await clickStep(4);
  assert.equal(await page.locator('#pc').innerText(),'<T>');
  assert.equal(await page.locator('#public-output').innerText(),'No output.');
  await page.evaluate(()=>{window.jsflowDemo.editor.focus();window.jsflowDemo.editor.setPosition({lineNumber:3,column:7});window.jsflowDemo.editor.trigger('test','editor.action.showHover',{});});
  await page.waitForSelector('.monaco-hover:visible');
  assert.match(await page.locator('.monaco-hover:visible').innerText(),/Current execution context: <T>/);
  await page.screenshot({path:process.env.SCREENSHOT || '/tmp/jsflow-debugger.png',fullPage:true});
  await page.keyboard.press('Escape');
  await code('var i = 0;\nwhile (i < 3) {\n    i = i + 1;\n}\npublicOutput("done");');
  await page.evaluate(()=>window.jsflowDemo.setBreakpoints([3]));
  for(const i of [0,1,2]){await page.locator('#continue').click();await paused(3);assert.equal((await variable('i')).value,String(i));}
  await page.locator('#continue').click();await untilDone();
  assert.equal(await page.locator('#public-output').innerText(),'done');
  // Step into a real interpreted function and inspect its local argument.
  await code('var secret = lbl(2);\nfunction twice(x) { return x + x; }\nvar result = twice(secret);\npublicOutput(result);');
  await page.evaluate(()=>window.jsflowDemo.setBreakpoints([]));await clickStep(3);await clickStep(2);
  assert.equal((await variable('x')).label,'<T>');
  await page.locator('#continue').click();await untilDone();assert.equal(await page.evaluate(()=>window.jsflowDemo.state),'blocked');
  await code('var x = lbl(7);\nvar y = x + 1;\npublicOutput("hello");');
  await page.locator('#run').click();await untilDone();assert.equal(await page.locator('#public-output').innerText(),'hello');
  assert.equal((await variable('y')).label,'<T>');
  await page.evaluate(()=>document.querySelector('#compare').click());
  await page.waitForFunction(()=>document.querySelector('#native-output').textContent==='hello');
  // Custom syntax errors come from the interpreter; unfinished loops stay stoppable.
  await page.evaluate(()=>window.jsflowDemo.editor.setValue('var = ;'));await page.locator('#debug').click();await untilDone();
  assert.match(await page.locator('#error').innerText(),/Unexpected token/);
  await code('var n = 0;\nwhile (true) { n = n + 1; }');await page.locator('#continue').click();await page.locator('#stop').click();
  assert.equal(await page.locator('#status').innerText(),'Stopped');
  // All six bundled examples run in the browser; server execution endpoint is gone.
  for(const id of ['direct','encoded','implicit','safe','nsu','repaired']){
   await page.locator('#examples').selectOption(id);await page.locator('#reset').click();await paused(1);
   await page.locator('#run').click();await untilDone();
   assert.equal(await page.evaluate(()=>window.jsflowDemo.state),['safe','repaired'].includes(id)?'completed':'blocked',id);
  }
  assert([404,405,501].includes((await page.request.post(base+'/api/run',{data:{code:'publicOutput("remote");'}})).status()));
  // No execution requests leave the browser, and it works after going offline.
  assert(!requests.some(request=>request.method==='POST'));
  await page.context().setOffline(true);await page.locator('#reset').click();await paused(1);
  await page.locator('#run').click();await untilDone();assert.equal(await page.evaluate(()=>window.jsflowDemo.state),'completed');
  await page.context().setOffline(false);
  assert(await page.locator('body').evaluate(el=>el.classList.contains('present')));
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
  assert.deepEqual(errors,[]);
  console.log('PASS: initial pause, actual hover, statement steps, repeated breakpoints, function scope, edited source, six examples, errors, stop, offline execution, no server code submission, mobile layout.');
 } finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
