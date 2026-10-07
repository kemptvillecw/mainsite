import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const port = 4191; const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dev-tools/serve.mjs', '--demo'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: ['ignore','pipe','pipe'], windowsHide: true });
let browser;
try {
  await Promise.race([once(server.stdout, 'data'), once(server, 'exit').then(() => { throw new Error('Preview failed to start'); }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Preview timeout')), 10000); timer.unref(); })]);
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/browse.html'); await page.waitForFunction(() => document.querySelector('[data-content-count]').textContent === '27 items');
  assert.equal(await page.locator('.content-card').count(), 12);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForFunction(() => location.search.includes('page=2') && document.querySelector('[data-content-pages]').textContent.includes('Page 2'));
  await page.locator('summary').filter({ hasText: 'Content type' }).click();
  await page.locator('#filter-type-STORY').check();
  await page.waitForFunction(() => document.querySelector('[data-content-count]').textContent === '9 items');
  assert.ok(!new URL(page.url()).searchParams.has('page'));
  await page.locator('summary').filter({ hasText: 'Author' }).click();
  await page.locator('#filter-author-author_sample').check();
  await page.waitForFunction(() => document.querySelector('[data-content-count]').textContent === '4 items');
  await page.goBack(); await page.waitForFunction(() => document.querySelector('[data-content-count]').textContent === '9 items');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-content-count]').textContent === '27 items');
  console.log('PASS browse pagination, filters, chips, and browser history');

  let fail = true;
  await page.route('**/api/content?**', async route => { if (fail) await route.fulfill({ status: 503, body: 'Unavailable' }); else await route.continue(); });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => document.querySelector('[data-content-status]').textContent.includes('temporarily unavailable'));
  assert.equal(await page.locator('.content-card').count(), 12);
  fail = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-content-status]').textContent === '');
  await page.unroute('**/api/content?**');
  console.log('PASS refresh failure retains items and retry recovers');

  await page.goto(base + '/content.html?id=sample-1'); await page.locator('.content-body').waitFor();
  assert.equal(await page.locator('.content-body strong').textContent(), 'writing');
  assert.equal(await page.locator('.content-verse').textContent(), '  Along the river\n    the light lingers.');
  const original = await page.locator('.content-body').textContent();
  let removed = false;
  await page.route('**/api/content?**', async route => {
    const response = await route.fetch(); const value = await response.json();
    if (removed) value.item = null;
    else { value.item.revision = 'revision-new'; value.item.content.blocks = [{ type: 'paragraph', spans: [{ text: '<img src=x onerror=alert(1)> Revised text', marks: [], href: null }] }]; }
    await route.fulfill({ json: value });
  });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByRole('button', { name: 'Reload updated version' }).waitFor();
  assert.equal(await page.locator('.content-body').textContent(), original);
  await page.getByRole('button', { name: 'Reload updated version' }).click();
  await page.waitForFunction(() => document.querySelector('.content-body').textContent.includes('Revised text'));
  assert.equal(await page.locator('.content-body img').count(), 0);
  removed = true; await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByRole('heading', { name: 'Content unavailable' }).waitFor();
  assert.equal(await page.locator('.content-body').count(), 0);
  await page.unroute('**/api/content?**');
  console.log('PASS semantic reader, deferred edits, safe text rendering, and withdrawal');

  await page.goto(base + '/browse.html?type=LINK'); await page.waitForFunction(() => document.querySelector('[data-content-count]').textContent === '9 items');
  const external = page.getByRole('link', { name: 'View website' }).first();
  assert.equal(await external.getAttribute('rel'), 'noopener noreferrer'); assert.equal(await external.getAttribute('target'), '_blank');
  await page.goto(base + '/browse.html'); await page.locator('.content-card').first().waitFor();
  await fs.mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL('../artifacts/content-desktop.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: new URL('../artifacts/content-mobile.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS external link attributes, mobile overflow, and no browser errors');
} finally { await browser?.close(); server.kill(); }
