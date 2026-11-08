const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(process.argv[2] || 'http://127.0.0.1:8766');
    await page.waitForFunction(() => window.jsflowDemo?.state === 'paused');
    await page.locator('#run').click();
    await page.waitForFunction(() => window.jsflowDemo.state === 'blocked');
    await page.locator('#examples').selectOption('declassified');
    assert(await page.locator('#declassification-note').isVisible());
    await page.locator('#run').click();
    await page.waitForFunction(() => window.jsflowDemo.state === 'completed');
    assert.equal(await page.locator('#public-output').innerText(), 'polar/otter?key=42');
    const labels = await page.locator('#variables tr').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.cells[0]?.textContent, row.cells[2]?.textContent])));
    assert.equal(labels.token, '<T>');
    assert.equal(labels.released, '<>');
    await page.evaluate(() => document.querySelector('#compare').click());
    await page.waitForFunction(() => document.querySelector('#native-output').textContent === 'polar/otter?key=42');
    // Declassification removes the value label, not the enclosing control label.
    await page.evaluate(() => window.jsflowDemo.editor.setValue('var secret = lbl(true);\nif (secret) { publicOutput(declassify(lbl("private"))); }'));
    await page.locator('#run').click();
    await page.waitForFunction(() => window.jsflowDemo.state === 'blocked');
    assert.match(await page.locator('#error').innerText(), /value <>, context <T>/);
    assert.equal(await page.locator('#public-output').innerText(), 'No output.');
    await page.locator('#examples').selectOption('safe');
    assert.equal(await page.locator('#declassification-note').isVisible(), false);
    console.log('PASS: direct disclosure blocked, explicit declassification accepted, secret control retained, native comparison.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
