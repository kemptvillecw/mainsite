window.KCW_ANNOUNCEMENTS = [];

(function () {
  function dateKeyInTimeZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function addDays(dateKey, days) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function followingMonday(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = date.getUTCDay();
    let daysUntilMonday = (8 - dayOfWeek) % 7;
    if (daysUntilMonday === 0) daysUntilMonday = 7;
    return addDays(dateKey, daysUntilMonday);
  }

  function eventDateKey(event, timeZone) {
    if (event.start?.date) return event.start.date;
    if (!event.start?.dateTime) return null;
    const start = new Date(event.start.dateTime);
    if (!Number.isFinite(start.getTime())) return null;
    return dateKeyInTimeZone(start, timeZone);
  }

  function isLibraryClosureTitle(summary) {
    const title = String(summary || "").trim();
    if (!title) return false;
    const mentionsLibrary = /\blibrary\b/i.test(title);
    const mentionsClosure = /\bclosed\b/i.test(title) || /\bclosure\b/i.test(title);
    return (mentionsLibrary && mentionsClosure) || /^closed\b/i.test(title);
  }

  async function upcomingMondayClosure(targetDate) {
    const config = window.KCW_CALENDAR;
    if (!config || location.protocol === "file:") return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.id)}/events`);
      const queryStart = new Date(`${addDays(targetDate, -1)}T00:00:00Z`);
      const queryEnd = new Date(`${addDays(targetDate, 2)}T00:00:00Z`);
      url.search = new URLSearchParams({
        key: config.apiKey,
        timeMin: queryStart.toISOString(),
        timeMax: queryEnd.toISOString(),
        timeZone: config.timezone || "America/Toronto",
        singleEvents: "true",
        orderBy: "startTime",
        showDeleted: "false",
        maxResults: "100"
      }).toString();

      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.items)) throw new Error("Calendar unavailable");

      const timeZone = config.timezone || "America/Toronto";
      return data.items.find((event) =>
        event.status !== "cancelled" &&
        eventDateKey(event, timeZone) === targetDate &&
        isLibraryClosureTitle(event.summary)
      ) || null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function renderLibraryClosure(targetDate) {
    const target = document.querySelector('[data-announcements="homepage"]');
    if (!target || target.querySelector("[data-library-closure]")) return;

    const date = new Date(`${targetDate}T12:00:00Z`);
    const label = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(date);

    const announcement = document.createElement("div");
    announcement.className = "announcement";
    announcement.dataset.libraryClosure = "true";

    const heading = document.createElement("strong");
    heading.textContent = "Upcoming Library Closure";
    const detail = document.createElement("span");
    detail.textContent = label;

    announcement.append(heading, detail);
    target.append(announcement);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const config = window.KCW_CALENDAR;
    const target = document.querySelector('[data-announcements="homepage"]');
    if (!config || !target) return;

    const timeZone = config.timezone || "America/Toronto";
    const today = dateKeyInTimeZone(new Date(), timeZone);
    const targetDate = followingMonday(today);

    try {
      const closure = await upcomingMondayClosure(targetDate);
      if (closure) renderLibraryClosure(targetDate);
    } catch (error) {
      console.error("Library closure check failed:", error.name || "Error");
    }
  });
})();
