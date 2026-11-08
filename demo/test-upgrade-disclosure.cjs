const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(process.argv[2] || 'http://127.0.0.1:8766');
    await page.waitForFunction(() => window.jsflowDemo?.state === 'paused');
    const outcomes = [
      ['nsu', 'blocked', 'No output.'],
      ['repaired', 'completed', 'Page view recorded'],
      ['repaired-disclosure', 'blocked', 'Page view recorded'],
    ];
    for (const [id, state, output] of outcomes) {
      await page.locator('#examples').selectOption(id);
      await page.locator('#run').click();
      await page.waitForFunction(() => ['completed', 'blocked', 'error'].includes(window.jsflowDemo.state));
      assert.equal(await page.evaluate(() => window.jsflowDemo.state), state);
      assert.equal(await page.locator('#public-output').innerText(), output);
    }
    assert.match(await page.locator('#error').innerText(), /publicOutput: value <T>, context <>/);
    const result = await page.locator('#variables tr').evaluateAll(rows => {
      const row = rows.find(row => row.cells[0]?.textContent === 'result');
      return { value: row.cells[1].textContent, label: row.cells[2].textContent };
    });
    assert.deepEqual(result, { value: '1', label: '<T>' });
    await page.evaluate(() => document.querySelector('#compare').click());
    await page.waitForFunction(() => document.querySelector('#native-output').textContent === 'Page view recorded\n1');
    console.log('PASS: conservative rejection, permitted upgraded computation, retained confidentiality at public sink, native control.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
