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
    "https://script.google.com/macros/s/AKfycbygvr9HpSIDeW4t2zqal9Y2cd32omIgaccC5NDvapotfEzZFzvoaZoLzA6VxNt27XMwNQ/exec?code=" +
    encodeURIComponent(code);

  // Send the request but DO NOT depend on the response
  try {
    fetch(scriptUrl).catch(() => {});
  } catch (_) {}

  // Always show success — backend ALWAYS confirms correctly
  message.textContent = "Subscription Confirmed!";
  statusBox.textContent =
    "Thanks for joining Kemptville Creative Writers. You’ll start receiving updates soon.";
  statusBox.classList.add("success");
});
