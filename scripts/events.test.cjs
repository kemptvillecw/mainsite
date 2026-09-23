const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

// Run with Playwright available on NODE_PATH: node scripts/events.test.cjs
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || 'msedge' });
  try {
    const event = (id, day, metadata = {}) => ({
      id, summary: id, status: 'confirmed', location: 'Library',
      start: { dateTime: `2026-10-${day}T18:00:00-04:00` },
      end: { dateTime: `2026-10-${day}T19:00:00-04:00` },
      description: `Public description<div>[KCW_METADATA]${JSON.stringify(metadata).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}[/KCW_METADATA]</div>`
    });
    async function render(pages, local = []) {
      const page = await browser.newPage();
      await page.clock.install({ time: new Date('2026-09-23T16:00:00Z') });
      await page.setContent(`<base href="https://example.com/"><div data-featured-event></div>
        <section data-event-outcomes><h2 data-outcomes-title></h2><p data-outcome-explore></p>
        <p data-outcome-leave></p><p data-outcome-format></p></section>`);
      await page.evaluate(({ pages, local }) => {
        window.KCW_EVENTS = local;
        window.KCW_CALENDAR = { id: 'test', timezone: 'America/Toronto', apiKey: 'test' };
        window.requests = [];
        window.fetch = async (url) => {
          window.requests.push(String(url));
          const data = pages[window.requests.length - 1];
          if (!data) throw new Error('Unexpected page requested');
          return { ok: true, json: async () => data };
        };
      }, { pages, local });
      await page.addScriptTag({ path: path.join(__dirname, 'event-description.js') });
      await page.addScriptTag({ path: path.join(__dirname, 'events.js') });
      await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
      await page.waitForFunction(() => document.querySelector('#featured-heading'));
      return page;
    }
    const featured = event('featured', '20', { featured: true, featureStart: '2026-09-23',
      featureEnd: '2026-09-23', type: 'Guest Speaker', eventTitle: '<b>Writing workshop</b>',
      speaker: 'A Writer', speakerRole: 'Author', image: 'data:text/html,unsafe',
      speakerUrl: 'javascript:alert(1)', directions: 'https://example.com/map',
      learningTopic: 'Dialogue', learningOutcome: 'Write a scene', format: 'Workshop' });
    let page = await render([{ items: [event('next', '01')], nextPageToken: 'second' }, { items: [featured] }]);
    assert.equal(await page.locator('h2#featured-heading').textContent(), '<b>Writing workshop</b>');
    assert.equal(await page.locator('#featured-heading b').count(), 0);
    assert.match(await page.locator('.event-type').textContent(), /Featured Event/);
    assert.equal(await page.locator('.featured-event-description').textContent(), 'Public description');
    assert.equal(await page.locator('.featured-speaker').textContent(), 'A Writer · Author');
    assert.equal(await page.locator('.featured-speaker a, .featured-event-photo').count(), 0);
    assert.equal(await page.locator('[data-outcome-explore]').textContent(), 'Dialogue');
    assert.equal(await page.locator('[data-event-outcomes]').isVisible(), true);
    assert.match((await page.evaluate(() => window.requests))[1], /pageToken=second/);
    await page.close();
    const draft = event('draft', '01', { status: 'Draft', featured: true });
    const published = event('published', '20', { status: 'Published', featured: true });
    page = await render([{ items: [draft], nextPageToken: 'published-page' }, { items: [published] }]);
    assert.equal(await page.locator('#featured-heading').textContent(), 'published');
    assert.equal(await page.evaluate(() => window.KCWEventDescription.isFeatured(
      { status: 'Draft', featured: true }, '2026-09-23')), false);
    await page.close();
    page = await render([{ items: [draft, event('ordinary', '20')] }]);
    assert.equal(await page.locator('#featured-heading').textContent(), 'ordinary');
    await page.close();

    // Verify the separate schedule loader applies the same publication rule.
    page = await browser.newPage();
    await page.setContent(`<section data-public-calendar><p data-calendar-status></p>
      <button data-calendar-retry></button><table data-calendar-table-wrap><tbody data-calendar-rows></tbody></table></section>`);
    await page.evaluate((items) => {
      window.KCW_CALENDAR = { id: 'test', timezone: 'America/Toronto', apiKey: 'test', daysAhead: 21 };
      window.fetch = async () => ({ ok: true, json: async () => ({ items }) });
    }, [draft, published, event('ordinary', '21')]);
    await page.addScriptTag({ path: path.join(__dirname, 'event-description.js') });
    await page.addScriptTag({ path: path.join(__dirname, 'calendar.js') });
    await page.waitForFunction(() => document.querySelector('[data-public-calendar]').getAttribute('aria-busy') === 'false');
    assert.deepEqual(await page.locator('[data-calendar-rows] strong').allTextContents(), ['published', 'ordinary']);
    await page.close();

    for (const metadata of [{ featured: false }, { featured: true, featureStart: '2026-09-24' },
      { featured: true, featureEnd: '2026-09-22' }]) {
      page = await render([{ items: [event('next', '01'), event('inactive', '20', metadata)] }]);
      assert.equal(await page.locator('#featured-heading').textContent(), 'next');
      assert.equal(await page.locator('[data-event-outcomes]').isVisible(), false);
      await page.close();
    }
    const malformed = event('malformed', '01');
    malformed.description = 'Readable [KCW_METADATA]{broken}[/KCW_METADATA]';
    page = await render([{ items: [malformed] }]);
    assert.equal(await page.locator('.featured-event-description').textContent(), 'Readable');
    await page.close();

    const allDay = event('all day', '20', { featured: true, image: '/photo.png',
      imageAlt: 'Portrait', hoverText: 'Meet our guest', speaker: 'Guest', speakerUrl: 'https://example.com/guest' });
    allDay.start = { date: '2026-10-20' };
    allDay.end = { date: '2026-10-21' };
    allDay.description = allDay.description.replace('Public description', '');
    page = await render([{ items: [allDay] }]);
    assert.equal(await page.locator('[data-next-time]').textContent(), 'All day');
    assert.equal(await page.locator('[data-next-date]').textContent(), 'Tuesday, October 20, 2026');
    assert.equal(await page.locator('.featured-event-description').isVisible(), false);
    assert.equal(await page.locator('.featured-event-photo').getAttribute('alt'), 'Portrait');
    assert.equal(await page.locator('.featured-event-photo').getAttribute('title'), 'Meet our guest');
    assert.equal(await page.locator('.featured-speaker a').getAttribute('href'), 'https://example.com/guest');
    await page.close();
    console.log('Passed browser checks: paginated featured selection, inclusive dates, inactive fallback, metadata cleanup, safe rendering, learning outcomes, image/speaker details, and all-day dates.');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
