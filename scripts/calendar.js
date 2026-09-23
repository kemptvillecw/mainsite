(function () {
  const section = document.querySelector('[data-public-calendar]');
  if (!section) return;
  const config = window.KCW_CALENDAR;
  const status = section.querySelector('[data-calendar-status]');
  const retry = section.querySelector('[data-calendar-retry]');
  const wrapper = section.querySelector('[data-calendar-table-wrap]');
  const rows = section.querySelector('[data-calendar-rows]');

  function dateLabel(value, allDay) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: allDay ? 'UTC' : config.timezone,
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    }).format(new Date(value));
  }
  function timeLabel(value) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone, hour: 'numeric', minute: '2-digit'
    }).format(new Date(value));
  }
  function cell(row, text, label) {
    const td = document.createElement('td');
    td.dataset.label = label;
    td.textContent = text;
    row.appendChild(td);
    return td;
  }
  function render(events) {
    const fragment = document.createDocumentFragment();
    events.forEach((event) => {
      const row = document.createElement('tr');
      const startDay = dateLabel(event.start, event.allDay);
      // All-day DTEND is exclusive.
      const endDay = dateLabel(event.allDay ? event.end - 86400000 : event.end, event.allDay);
      cell(row, startDay === endDay ? startDay : `${startDay} – ${endDay}`, 'Date');
      cell(row, event.allDay ? 'All day' : `${timeLabel(event.start)} – ${timeLabel(event.end)}`, 'Time (EST)');
      const title = cell(row, '', 'Event');
      const strong = document.createElement('strong');
      strong.textContent = event.title || 'Untitled event';
      title.appendChild(strong);
      const publicDescription = window.KCWEventDescription.plainText(event.description);
      if (publicDescription) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Event details';
        const description = document.createElement('p');
        description.textContent = publicDescription;
        details.append(summary, description);
        title.appendChild(details);
      }
      fragment.appendChild(row);
    });
    rows.replaceChildren(fragment);
    wrapper.hidden = !events.length;
    status.hidden = events.length > 0;
    status.textContent = events.length
      ? ''
      : 'No upcoming events are listed in the KCW Calendar. Please check the featured events above or visit again soon.';
  }
  async function load() {
    retry.hidden = true;
    wrapper.hidden = true;
    status.hidden = false;
    section.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading upcoming events…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      if (location.protocol === 'file:') throw new Error('Local server required');
      const now = new Date();
      const until = new Date(now);
      until.setUTCDate(until.getUTCDate() + config.daysAhead);
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
      const events = [];
      let pageToken;
      do {
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) {
          const reason = data.error?.errors?.[0]?.reason || data.error?.status || 'unknown';
          console.error(`Calendar API request failed (${response.status}, ${reason}).`);
          console.error(String(data.error?.message || 'Request denied').replace(/AIza[\w-]+/g, '[redacted]'));
          throw new Error('Calendar unavailable');
        }
        if (!Array.isArray(data.items)) throw new Error('Invalid calendar response');
        data.items.filter((item) => item.status !== 'cancelled').forEach((item) => {
          const metadata = window.KCWEventDescription.metadata(item.description);
          if (!window.KCWEventDescription.isPublic(metadata)) return;
          const start = Date.parse(item.start?.dateTime || item.start?.date);
          const end = Date.parse(item.end?.dateTime || item.end?.date);
          if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Invalid event date');
          events.push({ title: item.summary || '', description: item.description || '',
            start, end, allDay: Boolean(item.start.date) });
        });
        pageToken = data.nextPageToken;
      } while (pageToken);
      render(events.sort((a, b) => a.start - b.start));
    } catch (error) {
      console.error('Calendar loading failed:', error.name, error.message.replace(/AIza[\w-]+/g, '[redacted]'));
      status.textContent = location.protocol === 'file:'
        ? 'To load calendar events in this local preview, open this page through the local preview server.'
        : 'We couldn’t load the KCW Calendar. Please try again shortly.';
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      section.setAttribute('aria-busy', 'false');
    }
  }
  retry.addEventListener('click', load);
  load();
})();
