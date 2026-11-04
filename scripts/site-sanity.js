// Read-only diagnostics bridge for the KCW Content Handler Calendar Manager.
// Only the KCW Content Handler origin can request public, rendered page data.
(function () {
  'use strict';

  const ALLOWED_ORIGIN = 'https://content.kemptvillecreativewriters.com';
  const PAGE = /\/schedule(?:\.html)?\/?$/.test(location.pathname) ? 'schedule' : 'homepage';

  function selectedFeatured() {
    const host = document.querySelector('[data-featured-event]');
    if (!host) return null;
    const image = host.querySelector('.featured-event-photo');
    return {
      id: host.dataset.eventId || '',
      title: host.querySelector('#featured-heading')?.textContent?.trim() || '',
      date: host.dataset.sanityDate || '',
      start: host.dataset.sanityStart || '',
      end: host.dataset.sanityEnd || '',
      featured: /Featured Event/.test(host.querySelector('.event-type')?.textContent || ''),
      image: image?.getAttribute('src') || '',
      imageAlt: image?.alt || '',
      imageStatus: !image ? 'none' : image.complete
        ? (image.naturalWidth > 0 ? 'ok' : 'broken')
        : 'pending',
      location: host.querySelector('[data-next-location]')?.textContent?.trim() || '',
      description: host.querySelector('.featured-event-description')?.textContent?.trim() || ''
    };
  }

  function staticSchedule() {
    const source = Array.isArray(window.KCW_EVENTS) ? window.KCW_EVENTS : [];
    return Array.from(document.querySelectorAll('[data-schedule-events] .schedule-event'))
      .map(element => {
        const match = source.find(event => event.id === element.id) || {};
        return {
          id: element.id || '',
          title: element.querySelector('h2, h3')?.textContent?.trim() || '',
          date: match.date || '',
          startTime: match.startTime || '',
          endTime: match.endTime || '',
          image: match.image || ''
        };
      });
  }

  function isReady() {
    if (PAGE === 'schedule') {
      return window.KCW_SANITY_SCHEDULE?.state === 'loaded' ||
        window.KCW_SANITY_SCHEDULE?.state === 'error';
    }
    return ['loaded', 'empty', 'error'].includes(window.KCW_SANITY_FEATURED_STATE);
  }

  async function collect() {
    // The pages load calendar data asynchronously. Never treat loading as an empty calendar.
    for (let i = 0; i < 115 && !isReady(); i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return {
      page: PAGE,
      url: location.origin + location.pathname,
      checkedAt: new Date().toISOString(),
      state: PAGE === 'schedule'
        ? (window.KCW_SANITY_SCHEDULE?.state || 'unavailable')
        : (window.KCW_SANITY_FEATURED_STATE || 'unavailable'),
      calendar: PAGE === 'schedule' ? (window.KCW_SANITY_SCHEDULE?.events || []) : [],
      staticSchedule: PAGE === 'schedule' ? staticSchedule() : [],
      featured: PAGE === 'homepage' ? selectedFeatured() : null
    };
  }

  window.addEventListener('message', async event => {
    if (event.origin !== ALLOWED_ORIGIN || event.source !== window.parent) return;
    if (event.data?.type !== 'KCW_SITE_SANITY_REQUEST') return;
    const requestId = event.data.requestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(requestId)) return;
    try {
      event.source.postMessage({
        type: 'KCW_SITE_SANITY_RESPONSE',
        requestId,
        snapshot: await collect()
      }, event.origin);
    } catch {
      event.source.postMessage({
        type: 'KCW_SITE_SANITY_RESPONSE',
        requestId,
        snapshot: { page: PAGE, state: 'error', calendar: [], staticSchedule: [] }
      }, event.origin);
    }
  });
})();
