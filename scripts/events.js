(function () {
  const events = Array.isArray(window.KCW_EVENTS) ? window.KCW_EVENTS : [];
  let homepageEvent = null;

  function parseLocalDate(date, time) {
    return new Date(`${date}T${time || "00:00"}:00`);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(parseLocalDate(date));
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(parseLocalDate(date));
  }

  function formatDay(date) {
    return new Intl.DateTimeFormat("en-CA", { day: "2-digit" }).format(parseLocalDate(date));
  }

  function formatMonth(date) {
    return new Intl.DateTimeFormat("en-CA", { month: "short" }).format(parseLocalDate(date)).toUpperCase();
  }

  function formatTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    return new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function typeClass(type) {
    return type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function isPublished(event) { return event.status === "Published"; }

  function isFeatured(event, today) {
    if (!event.featured || !isPublished(event)) return false;
    if (event.featureStart && today < event.featureStart) return false;
    if (event.featureEnd && today > event.featureEnd) return false;
    return true;
  }

  function upcomingEvents(today) {
    return events.filter((event) => isPublished(event) && event.date >= today).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""));
  }

  function calendarToday() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: window.KCW_CALENDAR?.timezone || "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
  }

  async function nextCalendarEvent() {
    const config = window.KCW_CALENDAR;
    if (!config) return null;
    if (location.protocol === "file:") {
      const error = new Error("Calendar requires an approved website address");
      error.code = "LOCAL_PREVIEW";
      throw error;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.id)}/events`);
      url.search = new URLSearchParams({
        key: config.apiKey, timeMin: new Date().toISOString(), timeZone: config.timezone,
        singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "1"
      }).toString();
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.items)) {
        const error = new Error("Calendar unavailable");
        error.code = data.error?.details?.find((detail) => detail.reason)?.reason || "CALENDAR_UNAVAILABLE";
        console.error("Homepage calendar request failed:", response.status, error.code);
        throw error;
      }
      return data.items.find((item) => item.status !== "cancelled") || null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function renderCalendarEvent(target, event) {
    const allDay = Boolean(event.start.date);
    const start = new Date(event.start.dateTime || event.start.date);
    const end = new Date(event.end.dateTime || event.end.date);
    const timezone = allDay ? "UTC" : window.KCW_CALENDAR.timezone;
    const label = (date, options) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, ...options }).format(date);
    target.innerHTML = `<div class="featured-event-date" aria-hidden="true"><span></span><strong></strong><small></small></div>
      <div class="featured-event-content"><p class="eyebrow">What's next</p><h2 id="featured-heading"></h2>
      <p class="featured-event-description"></p><div class="event-meta"><div data-next-date></div><div data-next-time></div><div data-next-location></div></div>
      <div class="event-actions"><a class="button button-primary" href="schedule.html">View Schedule &amp; Events</a></div></div>`;
    target.querySelector(".featured-event-date span").textContent = label(start, { month: "short" }).toUpperCase();
    target.querySelector(".featured-event-date strong").textContent = label(start, { day: "2-digit" });
    target.querySelector(".featured-event-date small").textContent = label(start, { year: "numeric" });
    target.querySelector("h2").textContent = event.summary || "Upcoming event";
    const description = document.createElement("template");
    description.innerHTML = event.description || "";
    description.content.querySelectorAll("script, style").forEach((node) => node.remove());
    description.content.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    target.querySelector(".featured-event-description").textContent = description.content.textContent.trim();
    const dateOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
    const startDay = label(start, dateOptions);
    const endDay = label(allDay ? new Date(end.getTime() - 86400000) : end, dateOptions);
    target.querySelector("[data-next-date]").textContent = startDay === endDay ? startDay : `${startDay} – ${endDay}`;
    target.querySelector("[data-next-time]").textContent = allDay ? "All day" : `${label(start, { hour: "numeric", minute: "2-digit" })}–${label(end, { hour: "numeric", minute: "2-digit" })}`;
    target.querySelector("[data-next-location]").textContent = event.location || "Location to be confirmed";
  }

  function selectedHomepageEvent(today) {
    const upcoming = upcomingEvents(today);
    return upcoming.find((event) => isFeatured(event, today)) || upcoming[0] || null;
  }

  function speakerMarkup(event, className) {
    if (!event.speaker) return "";
    const name = event.speakerUrl
      ? `<a href="${event.speakerUrl}" target="_blank" rel="noopener">${event.speaker}</a>`
      : event.speaker;
    return `<p class="${className}"><strong>${name}</strong>${event.speakerRole ? ` <span>· ${event.speakerRole}</span>` : ""}</p>`;
  }

  function renderEventMeta(event) {
    return `<div class="event-meta">
      <div><strong>Date</strong>${formatDate(event.date)}</div>
      <div><strong>Time</strong>${formatTime(event.startTime)}–${formatTime(event.endTime)}</div>
      <div><strong>Where</strong>${event.location}<br>${event.address}</div>
    </div>`;
  }

  function calendarUrl(event) {
    const start = event.date.replace(/-/g, "") + "T" + event.startTime.replace(":", "") + "00";
    const end = event.date.replace(/-/g, "") + "T" + event.endTime.replace(":", "") + "00";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: `${start}/${end}`,
      location: `${event.location}, ${event.address}`,
      details: event.description,
      ctz: event.timezone || "America/Toronto"
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function eventCard(event) {
    return `<article class="event-card">
      <div class="event-card-date" aria-label="${formatDate(event.date)}">
        <span>${formatMonth(event.date)}</span><strong>${formatDay(event.date)}</strong><small>${event.date.slice(0, 4)}</small>
      </div>
      <div class="event-card-body">
        <span class="event-type event-type-${typeClass(event.type)}">${event.type}</span>
        <h3>${event.eventTitle || event.title}</h3>
        ${speakerMarkup(event, "event-speaker")}
        <p>${event.description}</p>
        <div class="event-card-meta">${formatTime(event.startTime)}–${formatTime(event.endTime)} · ${event.location}</div>
        <a class="home-link" href="schedule.html#${event.id}">Event details →</a>
      </div>
    </article>`;
  }

  async function renderFeatured() {
    const target = document.querySelector("[data-featured-event]");
    if (!target) return;
    const today = calendarToday();
    const event = selectedHomepageEvent(today);

    if (!event || !isFeatured(event, today)) {
      try {
        const scheduled = await nextCalendarEvent();
        const scheduledStart = scheduled && Date.parse(scheduled.start?.dateTime || scheduled.start?.date);
        const scheduledEnd = scheduled && Date.parse(scheduled.end?.dateTime || scheduled.end?.date);
        if (scheduled && Number.isFinite(scheduledStart) && Number.isFinite(scheduledEnd) &&
            (!event || scheduledStart < parseLocalDate(event.date, event.startTime).getTime())) {
          renderCalendarEvent(target, scheduled);
          return;
        }
      } catch (error) {
        console.error("Homepage calendar loading failed:", error.name, error.code || "LOAD_FAILED");
        if (!event) {
          target.innerHTML = `<div class="empty-event"><p class="eyebrow">What's next</p><h2 id="featured-heading">Check the schedule for our next event.</h2><p>We couldn’t load the calendar right now. Please try again shortly.</p><a class="button button-primary" href="schedule.html">View Schedule &amp; Events</a></div>`;
          if (error.code === "LOCAL_PREVIEW" || error.code === "API_KEY_HTTP_REFERRER_BLOCKED") {
            target.querySelector(".empty-event > p:not(.eyebrow)").textContent = "The calendar isn’t available at this preview address. View the published website for the next scheduled event.";
            const link = target.querySelector(".empty-event > a");
            link.href = "https://www.kemptvillecreativewriters.com/schedule.html";
            link.textContent = "View Published Schedule";
          }
          return;
        }
      }
    }

    if (!event) {
      target.innerHTML = `<div class="empty-event"><p class="eyebrow">What's next</p><h2 id="featured-heading">Our next event is being planned.</h2><p>Please check back soon or join the newsletter for updates.</p><a class="button button-primary" href="#newsletter">Join the newsletter</a></div>`;
      return;
    }

    target.dataset.eventId = event.id;
    homepageEvent = event;
    target.innerHTML = `<div class="featured-event-date" aria-hidden="true">
        <span>${formatMonth(event.date)}</span><strong>${formatDay(event.date)}</strong><small>${event.date.slice(0, 4)}</small>
      </div>
      <div class="featured-event-content">
        <div class="featured-event-intro${event.image ? " featured-event-intro--with-image" : ""}">
          ${event.image ? `<img class="featured-event-photo" src="${event.image}" alt="${event.imageAlt || ""}" loading="lazy" decoding="async">` : ""}
          <div>
        <span class="event-type event-type-${typeClass(event.type)}">${isFeatured(event, today) ? "Featured Event · " + event.type : event.type}</span>
        ${speakerMarkup(event, "featured-speaker")}
        <h2 id="featured-heading">${event.eventTitle || event.title}</h2>
        <p class="featured-event-description">${event.description}</p>
          </div>
        </div>
        ${renderEventMeta(event)}
        <div class="event-actions">
          <a class="button button-primary" href="${calendarUrl(event)}" target="_blank" rel="noopener">Add to Calendar</a>
          <a class="button" href="${event.directions}" target="_blank" rel="noopener">Directions</a>
          <a class="button" href="schedule.html#${event.id}">Event Details</a>
        </div>
      </div>`;

    const photo = target.querySelector(".featured-event-photo");
    if (photo) {
      const usesSpeakerName = event.type === "Guest Speaker" || event.type === "Author" || event.speakerRole === "Author";
      const hoverText = usesSpeakerName ? event.speaker : event.hoverText;
      if (hoverText) photo.title = hoverText;
    }
  }

  function renderLearningOutcomes() {
    const target = document.querySelector("[data-event-outcomes]");
    if (!target) return;
    const event = homepageEvent;
    if (!event || (!event.learningTopic && !event.learningOutcome && !event.format)) {
      target.hidden = true;
      return;
    }
    const title = target.querySelector("[data-outcomes-title]");
    if (title) title.textContent = `What to expect: ${event.eventTitle || event.title}`;
    const explore = target.querySelector("[data-outcome-explore]");
    const leave = target.querySelector("[data-outcome-leave]");
    const format = target.querySelector("[data-outcome-format]");
    if (explore) explore.textContent = event.learningTopic || "Details will be added soon.";
    if (leave) leave.textContent = event.learningOutcome || "Details will be added soon.";
    if (format) format.textContent = event.format || "Details will be added soon.";
  }

  function renderUpcoming() {
    const target = document.querySelector("[data-upcoming-events]");
    if (!target) return;
    const today = calendarToday();
    const selected = homepageEvent;
    const upcoming = upcomingEvents(today).filter((event) => !selected || event.id !== selected.id);
    const section = target.closest(".upcoming-section");
    if (!upcoming.length) {
      if (section) section.hidden = true;
      return;
    }
    target.innerHTML = upcoming.slice(0, 3).map(eventCard).join("");
  }

  function renderSchedule() {
    const target = document.querySelector("[data-schedule-events]");
    if (!target) return;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = upcomingEvents(today);
    target.innerHTML = upcoming.length ? upcoming.map((event) => `<article class="schedule-event" id="${event.id}">
      <div class="schedule-event-date"><span>${formatMonth(event.date)}</span><strong>${formatDay(event.date)}</strong><small>${event.date.slice(0, 4)}</small></div>
      <div class="schedule-event-main">
        <span class="event-type event-type-${typeClass(event.type)}">${event.type}</span>
        <h2>${event.eventTitle || event.title}</h2>
        ${speakerMarkup(event, "event-speaker")}
        <p>${event.description}</p>
        <div class="schedule-details">
          <div><strong>When</strong>${formatDate(event.date)}<br>${formatTime(event.startTime)}–${formatTime(event.endTime)}</div>
          <div><strong>Where</strong>${event.location}<br>${event.address}</div>
          <div><strong>Learning focus</strong>${event.learningTopic || "Details to come"}</div>
        </div>
        <div class="event-actions"><a class="button button-primary" href="${calendarUrl(event)}" target="_blank" rel="noopener">Add to Calendar</a><a class="button" href="${event.directions}" target="_blank" rel="noopener">Directions</a></div>
      </div>
    </article>`).join("") : `<p class="empty-state panel">No upcoming events are currently published. Please check back soon.</p>`;
  }

  function renderArchive() {
    const target = document.querySelector("[data-event-archive]");
    if (!target) return;
    const today = new Date().toISOString().slice(0, 10);
    const past = events.filter((event) => isPublished(event) && event.date < today).sort((a, b) => b.date.localeCompare(a.date));
    target.innerHTML = past.length ? past.map(eventCard).join("") : `<div class="empty-state panel"><h2>The archive is ready to grow.</h2><p>Past workshops, guest speakers, craft talks, and special events will appear here automatically after their event dates.</p></div>`;
  }

  function renderAnnouncements() {
    const announcements = Array.isArray(window.KCW_ANNOUNCEMENTS) ? window.KCW_ANNOUNCEMENTS : [];
    const today = new Date().toISOString().slice(0, 10);
    const active = announcements.filter((item) => item.startDate <= today && item.endDate >= today);
    document.querySelectorAll("[data-announcements]").forEach((target) => {
      const location = target.dataset.announcements;
      const items = active.filter((item) => item.displayLocation === location || item.displayLocation === "both");
      target.innerHTML = items.map((item) => `<div class="announcement"><strong>Announcement</strong><span>${item.message}</span></div>`).join("");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderFeatured().then(() => {
      renderLearningOutcomes();
      renderUpcoming();
    });
    renderSchedule();
    renderArchive();
    renderAnnouncements();
  });
})();
