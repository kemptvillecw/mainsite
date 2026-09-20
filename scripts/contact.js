(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const endpoint = form.getAttribute("action");
  const sitekey = document.getElementById("contact-turnstile")?.dataset.sitekey;
  const status = form.querySelector(".form-message");
  const fields = form.querySelectorAll('input[name="name"], input[name="email"], textarea, button');
  const started = form.querySelector('[name="form_started"]');
  let widgetId;

  function show(message, kind) {
    status.textContent = message;
    status.className = "form-message " + kind;
  }

  window.onContactTurnstileReady = () => {
    if (!endpoint || !sitekey || !window.turnstile) return;
    widgetId = turnstile.render("#contact-turnstile", {
      sitekey,
      action: "contact"
    });
    fields.forEach(field => { field.disabled = false; });
    started.value = String(Date.now());
  };

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!endpoint || widgetId === undefined) return;
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    show("Sending your message…", "");
    try {
      const response = await fetch(endpoint, {
        method: "POST", body: new URLSearchParams(new FormData(form)), redirect: "follow"
      });
      if (!response.ok) throw new Error("request_failed");
      const result = await response.json();
      if (result.status !== "ok") throw new Error("submission_failed");
      show("Thanks. Your message has been sent.", "success");
      form.reset();
      started.value = String(Date.now());
    } catch (_) {
      show("We couldn't send your message. Please try again.", "error");
    } finally {
      turnstile.reset(widgetId);
      button.disabled = false;
    }
  });
})();
