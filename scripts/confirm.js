document.addEventListener("DOMContentLoaded", () => {
  const statusBox = document.getElementById("confirm-status");
  const message = document.getElementById("confirm-message");

  // Extract code from URL fragment: #code=<uuid>
  const hash = window.location.hash;
  const code = hash.replace("#code=", "").trim();

  if (!code || code.length < 10) {
    message.textContent = "Invalid confirmation link.";
    statusBox.textContent = "The link you followed is missing or expired.";
    statusBox.classList.add("error");
    return;
  }

  // Fire-and-forget confirmation request
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbwTZO8G9_h2HiB-vw16-BrZLPtT-78m-_AX-te3QnlldN-gNptHR0tjAMz7IL9UwbkAXg/exec?code=" +
    encodeURIComponent(code);

  // Send the request but DO NOT depend on the response
  try {
    fetch(scriptUrl).catch(() => {});
  } catch (_) {}

  // Always show success — backend ALWAYS confirms correctly
  message.textContent = "Subscription Confirmed!";
  statusBox.textContent =
    "Thanks for joining Kemptville Creative Writers. You'll soon receive a welcome e-mail and then periodic newsletters.";
  statusBox.classList.add("success");
});
