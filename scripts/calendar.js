(function () {
  const section = document.querySelector('[data-public-calendar]');
  if (!section) return;
  const config = window.KCW_CALENDAR;
  const status = section.querySelector('[data-calendar-status]');
  const retry = section.querySelector('[data-calendar-retry]');
  const wrapper = section.querySelector('[data-calendar-table-wrap]');
  const rows = section.querySelector('[data-calendar-rows]');
  const PAGE_SIZE = 5;
  let calendarEvents = [];
  let currentPage = 0;
  let pagination = null;

  const copyLinkStyle = document.createElement('style');
  copyLinkStyle.textContent = `
    .schedule-calendar .calendar-copy-action { margin-top: 8px; }
    .schedule-calendar .calendar-copy-link {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--forest);
      padding: 0;
      font: inherit;
      cursor: pointer;
    }
    .schedule-calendar .calendar-copy-link::before {
      content: '▸';
      margin-right: .45em;
    }
    .schedule-calendar .calendar-copy-link:hover { text-decoration: underline; }
    .schedule-calendar .calendar-copy-link:focus-visible {
      outline: 2px solid var(--forest);
      outline-offset: 3px;
    }
    .schedule-calendar .calendar-copy-link:disabled {
      opacity: .65;
      cursor: default;
    }
  `;
  document.head.appendChild(copyLinkStyle);

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
  function eventDateKey(event) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: event.allDay ? 'UTC' : config.timezone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(event.start));
    const value = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  }
  function isNormalMeetup(event) {
    const title = String(event.title || '')
      .toLowerCase()
      .trim()
      .replace(/[\u2010-\u2015-]+/g, ' ')
      .replace(/\s+/g, ' ');
    return title === 'kcw meet up';
  }
  function preferredEvents(events) {
    const datesWithOtherEvents = new Set(
      events.filter((event) => !isNormalMeetup(event)).map(eventDateKey)
    );
    return events.filter((event) =>
      !isNormalMeetup(event) || !datesWithOtherEvents.has(eventDateKey(event))
    );
  }
  function hashEventId() {
    if (!location.hash || location.hash.length < 2) return '';
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch {
      return location.hash.slice(1);
    }
  }
  function cell(row, text, label) {
    const td = document.createElement('td');
    td.dataset.label = label;
    td.textContent = text;
    row.appendChild(td);
    return td;
  }
  function safeUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value, document.baseURI);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }
  function eventPreviewUrl(eventId) {
    return new URL(`share/events/${encodeURIComponent(eventId)}.html?v=4`, document.baseURI).href;
  }
  function eventScheduleUrl(eventId) {
    const url = new URL('schedule.html', document.baseURI);
    url.hash = encodeURIComponent(eventId);
    return url.href;
  }
  async function eventCopyUrl(eventId) {
    const previewUrl = eventPreviewUrl(eventId);
    try {
      const response = await fetch(previewUrl, { method: 'HEAD', cache: 'no-store' });
      if (response.ok) return previewUrl;
    } catch (error) {
      console.warn('Could not verify event share page; using schedule link instead.', error);
    }
    return eventScheduleUrl(eventId);
  }
  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy command failed');
  }
  function addCopyLinkButton(event, target) {
    if (!event.id) return;
    const actions = document.createElement('div');
    actions.className = 'calendar-copy-action';
    const button = document.createElement('button');
    button.className = 'calendar-copy-link';
    button.type = 'button';
    button.textContent = 'Copy link';
    button.setAttribute('aria-label', `Copy link to ${event.title || 'this event'}`);
    button.addEventListener('click', async () => {
      const originalText = 'Copy link';
      button.disabled = true;
      try {
        await copyText(await eventCopyUrl(event.id));
        button.textContent = 'Copied!';
      } catch (error) {
        console.error('Could not copy event link:', error);
        button.textContent = 'Copy failed';
      }
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1500);
    });
    actions.appendChild(button);
    target.appendChild(actions);
  }
  function ensurePagination() {
    if (pagination) return pagination;
    const nav = document.createElement('nav');
    nav.className = 'event-actions calendar-pagination';
    nav.setAttribute('aria-label', 'Calendar pages');
    nav.hidden = true;

    const previous = document.createElement('button');
    previous.className = 'button';
    previous.type = 'button';
    previous.textContent = 'Previous';

    const label = document.createElement('strong');
    label.setAttribute('aria-live', 'polite');
    label.style.alignSelf = 'center';
    label.style.fontFamily = 'Arial, sans-serif';
    label.style.fontSize = '.82rem';

    const next = document.createElement('button');
    next.className = 'button';
    next.type = 'button';
    next.textContent = 'Next';

    previous.addEventListener('click', () => showPage(currentPage - 1, { scroll: true }));
    next.addEventListener('click', () => showPage(currentPage + 1, { scroll: true }));
    nav.append(previous, label, next);
    wrapper.insertAdjacentElement('afterend', nav);
    pagination = { nav, previous, label, next };
    return pagination;
  }
  function renderRows(events) {
    const fragment = document.createDocumentFragment();
    events.forEach((event) => {
      const row = document.createElement('tr');
      row.id = event.id || '';
      const startDay = dateLabel(event.start, event.allDay);
      const endDay = dateLabel(event.allDay ? event.end - 86400000 : event.end, event.allDay);
      cell(row, startDay === endDay ? startDay : `${startDay} – ${endDay}`, 'Date');
      cell(row, event.allDay ? 'All day' : `${timeLabel(event.start)} – ${timeLabel(event.end)}`, 'Time (EST)');
      const title = cell(row, '', 'Event');

      const imageUrl = safeUrl(event.image);
      if (imageUrl) {
        const image = document.createElement('img');
        image.className = 'event-card-photo';
        image.src = imageUrl;
        image.alt = event.imageAlt || event.speaker || '';
        image.loading = 'lazy';
        image.decoding = 'async';
        title.appendChild(image);
      }

      const strong = document.createElement('strong');
      strong.textContent = event.title || 'Untitled event';
      title.appendChild(strong);

      if (event.speaker) {
        const speaker = document.createElement('p');
        speaker.className = 'event-speaker';
        const speakerUrl = safeUrl(event.speakerUrl);
        if (speakerUrl) {
          const link = document.createElement('a');
          link.href = speakerUrl;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = event.speaker;
          speaker.appendChild(link);
        } else {
          speaker.textContent = event.speaker;
        }
        if (event.speakerRole) speaker.append(` · ${event.speakerRole}`);
        title.appendChild(speaker);
      }

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
      addCopyLinkButton(event, title);
      fragment.appendChild(row);
    });
    rows.replaceChildren(fragment);
  }
  function showPage(pageIndex, { scroll = false, targetId = '' } = {}) {
    const totalPages = Math.max(1, Math.ceil(calendarEvents.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(pageIndex, 0), totalPages - 1);
    const start = currentPage * PAGE_SIZE;
    renderRows(calendarEvents.slice(start, start + PAGE_SIZE));

    const controls = ensurePagination();
    controls.nav.hidden = calendarEvents.length <= PAGE_SIZE;
    controls.label.textContent = `Page ${currentPage + 1} of ${totalPages}`;
    controls.previous.disabled = currentPage === 0;
    controls.next.disabled = currentPage >= totalPages - 1;

    wrapper.hidden = !calendarEvents.length;
    status.hidden = calendarEvents.length > 0;
    status.textContent = calendarEvents.length
      ? ''
      : 'No upcoming events are listed in the KCW Calendar. Please check the featured events above or visit again soon.';

    if (scroll) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (targetId) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ block: 'center' });
      });
    }
  }
  function render(events) {
    calendarEvents = preferredEvents(events);
    const targetId = hashEventId();
    const targetIndex = targetId ? calendarEvents.findIndex((event) => event.id === targetId) : -1;
    const initialPage = targetIndex >= 0 ? Math.floor(targetIndex / PAGE_SIZE) : 0;
    showPage(initialPage, { targetId: targetIndex >= 0 ? targetId : '' });
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
          const eventId = typeof item.id === 'string' ? item.id.trim() : '';
          if (!eventId) return;
          const start = Date.parse(item.start?.dateTime || item.start?.date);
          const end = Date.parse(item.end?.dateTime || item.end?.date);
          if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Invalid event date');
          events.push({
            id: eventId,
            title: metadata.eventTitle || item.summary || '',
            description: item.description || '',
            start,
            end,
            allDay: Boolean(item.start.date),
            featured: metadata.featured === true,
            image: metadata.image || '',
            imageAlt: metadata.imageAlt || '',
            speaker: metadata.speaker || '',
            speakerRole: metadata.speakerRole || '',
            speakerUrl: metadata.speakerUrl || ''
          });
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
  window.addEventListener('hashchange', () => {
    if (!calendarEvents.length) return;
    const targetId = hashEventId();
    const targetIndex = targetId ? calendarEvents.findIndex((event) => event.id === targetId) : -1;
    if (targetIndex >= 0) showPage(Math.floor(targetIndex / PAGE_SIZE), { targetId });
  });
  load();
})();
