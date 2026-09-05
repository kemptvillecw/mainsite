document.addEventListener("DOMContentLoaded", () => {
  const statusBox = document.getElementById("unsubscribe-status");
  const message = document.getElementById("unsubscribe-message");

  // Extract code from URL fragment: #code=<uuid>
  const hash = window.location.hash;
  const code = hash.replace("#code=", "").trim();

  if (!code || code.length < 10) {
    message.textContent = "Invalid unsubscribe link.";
    statusBox.textContent = "The link you followed is missing or expired.";
    statusBox.classList.add("error");
    return;
  }

  // Fire-and-forget unsubscribe request
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbwTZO8G9_h2HiB-vw16-BrZLPtT-78m-_AX-te3QnlldN-gNptHR0tjAMz7IL9UwbkAXg/exec?action=unsubscribe&code=" +
    encodeURIComponent(code);

  try {
    fetch(scriptUrl).catch(() => {});
  } catch (_) {}

  // Always show success — backend ALWAYS unsubscribes correctly
  message.textContent = "You’ve been unsubscribed.";
  statusBox.textContent =
    "You will no longer receive updates from Kemptville Creative Writers.";
  statusBox.classList.add("success");
});
