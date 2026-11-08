const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8766');
    await page.waitForFunction(() => window.jsflowDemo?.state === 'paused');
    assert(await page.locator('#lesson').isVisible());
    assert.match(await page.locator('#policy-note').innerText(), /synthetic secret/);
    assert(await page.locator('#policy-note').isVisible());
    assert(await page.locator('#teaching-details').isVisible());

    await page.locator('#examples').selectOption('implicit');
    assert.match(await page.locator('#lesson').innerText(), /decision to send/);
    await page.locator('summary', { hasText: 'Ordinary JavaScript comparison' }).click();
    await page.locator('#compare').click();
    await page.waitForFunction(() => document.querySelector('#native-output').textContent === 'MEMBER');

    await page.locator('#examples').selectOption('safe');
    await page.locator('#run').click();
    await page.waitForFunction(() => window.jsflowDemo.state === 'completed');
    assert.equal(await page.locator('#public-output').innerText(), 'Page view recorded');
    if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    assert(await page.locator('#policy-note').isVisible());
    if (process.env.MOBILE_SCREENSHOT) await page.screenshot({ path: process.env.MOBILE_SCREENSHOT, fullPage: true });
    console.log('PASS: visible explanations, native comparison control, useful private computation, mobile layout.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
