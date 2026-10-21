(function () {
  const link = document.querySelector('[data-next-meeting-link]');
  const config = window.KCW_CALENDAR;
  const eventDescription = window.KCWEventDescription;
  if (!link || !config || !eventDescription) return;

  function dateKeyFromDate(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function eventDateKey(item) {
    if (item.start?.date) return item.start.date;
    const start = new Date(item.start?.dateTime || '');
    return Number.isFinite(start.getTime()) ? dateKeyFromDate(start, config.timezone) : '';
  }

  function isLibraryClosure(item, metadata) {
    const text = [item.summary, metadata.eventTitle, metadata.type]
      .filter(Boolean).join(' ').toLowerCase();
    return /\blibrary\b.{0,40}\bclos(?:ed|ure|ing)\b/.test(text) ||
      /\bngpl\b.{0,30}\bclos(?:ed|ure|ing)\b/.test(text);
  }

  function addClosureDates(set, item) {
    if (item.start?.date && item.end?.date) {
      const cursor = new Date(`${item.start.date}T00:00:00Z`);
      const end = new Date(`${item.end.date}T00:00:00Z`);
      while (cursor < end) {
        set.add(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return;
    }
    const key = eventDateKey(item);
    if (key) set.add(key);
  }

  function validCalendarItem(item) {
    return item.status !== 'cancelled' &&
      Number.isFinite(Date.parse(item.start?.dateTime || item.start?.date)) &&
      Number.isFinite(Date.parse(item.end?.dateTime || item.end?.date));
  }

  async function fetchUpcomingItems() {
    if (location.protocol === 'file:') throw new Error('Local preview cannot load calendar');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const now = new Date();
      const until = new Date(now);
      until.setUTCDate(until.getUTCDate() + 90);
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.id)}/events`);
      url.search = new URLSearchParams({
        key: config.apiKey,
        timeMin: now.toISOString(),
        timeMax: until.toISOString(),
        timeZone: config.timezone,
        singleEvents: 'true',
        orderBy: 'startTime',
        showDeleted: 'false',
        maxResults: '250'
      }).toString();

      const items = [];
      let pageToken;
      do {
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.items)) throw new Error('Calendar unavailable');
        items.push(...data.items);
        pageToken = data.nextPageToken;
      } while (pageToken);
      return items;
    } finally {
      clearTimeout(timeout);
    }
  }

  function shortDate(item) {
    const allDay = Boolean(item.start?.date);
    const start = new Date(item.start?.dateTime || item.start?.date);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: allDay ? 'UTC' : config.timezone,
      month: 'short', day: 'numeric'
    }).format(start);
  }

  function todayKey() {
    return dateKeyFromDate(new Date(), config.timezone);
  }

  async function updateNextMeetingLink() {
    try {
      const items = (await fetchUpcomingItems()).filter(validCalendarItem);
      const prepared = items.map((item) => ({
        item,
        metadata: eventDescription.metadata(item.description)
      }));

      const closedDates = new Set();
      prepared.forEach(({ item, metadata }) => {
        if (isLibraryClosure(item, metadata)) addClosureDates(closedDates, item);
      });

      const meetings = prepared
        .filter(({ item, metadata }) => eventDescription.isPublic(metadata) &&
          !isLibraryClosure(item, metadata) && !closedDates.has(eventDateKey(item)))
        .sort((a, b) => Date.parse(a.item.start.dateTime || a.item.start.date) -
          Date.parse(b.item.start.dateTime || b.item.start.date));

      const next = meetings[0];
      if (!next) return;

      link.textContent = `Next meeting: ${shortDate(next.item)} →`;
      link.href = eventDescription.isFeatured(next.metadata, todayKey()) ? '#featured-event' : 'schedule.html';
    } catch (error) {
      console.error('Next meeting lookup failed:', error.name, error.message);
    }
  }

  updateNextMeetingLink();
})();
