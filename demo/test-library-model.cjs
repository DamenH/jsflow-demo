const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(process.argv[2] || 'http://127.0.0.1:8766');
    await page.waitForFunction(() => window.jsflowDemo?.state === 'paused');
    await page.locator('#examples').selectOption('library-model');
    await page.waitForFunction(() => window.jsflowDemo.state === 'paused');
    const source = await page.evaluate(() => window.jsflowDemo.editor.getValue());
    // Library calls run synchronously; pause before every, then step over it.
    const line = source.split('\n').findIndex(text => text.includes('values.every(')) + 1;
    await page.evaluate(line => window.jsflowDemo.setBreakpoints([line]), line);
    await page.locator('#continue').click();
    await page.waitForFunction(line => window.jsflowDemo.state === 'paused' && document.querySelector('#status').textContent.includes('line ' + line + ' ·'), line);
    assert.equal(await page.locator('#pc').innerText(), '<>');
    const visited = await page.locator('#variables tr').evaluateAll(rows => {
      const row = rows.find(row => row.cells[0]?.textContent === 'visited');
      return { value: row.cells[1].textContent, label: row.cells[2].textContent };
    });
    assert.deepEqual(visited, { value: 'false', label: '<>' });
    await page.locator('#step').click();
    await page.waitForFunction(() => window.jsflowDemo.state === 'blocked');
    assert.equal(await page.locator('#pc').innerText(), '<T>');
    assert.match(await page.locator('#error').innerText(), /security context <T>.*existing value label <>/);
    assert.equal(await page.locator('#public-output').innerText(), 'No output.');

    // Without IFC, every invokes the getter and its side effect reaches output.
    await page.evaluate(() => document.querySelector('#compare').click());
    await page.waitForFunction(() => document.querySelector('#native-output').textContent === 'true');
    // A public predicate exercises the same getter without secret control.
    await page.evaluate(code => window.jsflowDemo.editor.setValue(code), source.replace('lbl(true)', 'true'));
    await page.evaluate(() => window.jsflowDemo.setBreakpoints([]));
    await page.locator('#run').click();
    await page.waitForFunction(() => window.jsflowDemo.state === 'completed');
    assert.equal(await page.locator('#public-output').innerText(), 'true');
    // A false first result never invokes the getter.
    await page.evaluate(code => window.jsflowDemo.editor.setValue(code), source.replace('lbl(true)', 'lbl(false)'));
    await page.locator('#run').click();
    await page.waitForFunction(() => window.jsflowDemo.state === 'completed');
    assert.equal(await page.locator('#public-output').innerText(), 'false');
    console.log('PASS: library callback controls getter context, public write blocked, native/public/short-circuit controls.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
