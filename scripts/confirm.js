// /scripts/confirm.js
document.addEventListener("DOMContentLoaded", () => {
  const statusBox = document.getElementById("confirm-status");
  const message = document.getElementById("confirm-message");

  const hash = window.location.hash;
  const code = hash.replace("#code=", "").trim();



  // const pathParts = window.location.pathname.split("/");
  // const code = pathParts[pathParts.length - 1];

  // const params = new URLSearchParams(window.location.search);
  // const code = params.get("code");

  if (!code) {
    message.textContent = "Invalid confirmation link.";
    statusBox.textContent = "The link you followed is missing or expired.";
    statusBox.classList.add("error");
    return;
  }

  // Your Apps Script deployment URL
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbygvr9HpSIDeW4t2zqal9Y2cd32omIgaccC5NDvapotfEzZFzvoaZoLzA6VxNt27XMwNQ/exec?code=" +
    encodeURIComponent(code);

  fetch(scriptUrl)
    .then(response => {
      if (!response.ok) throw new Error("Non-200 response");
      return response.text();
    })
    .then(() => {
      message.textContent = "Subscription Confirmed!";
      statusBox.textContent =
        "Thanks for joining Kemptville Creative Writers. You’ll start receiving updates soon.";
      statusBox.classList.add("success");
    })
    .catch(err => {
      console.error("Confirmation error:", err);
      message.textContent = "Something went wrong.";
      statusBox.textContent =
        "We couldn’t verify your subscription. Please try again later.";
      statusBox.classList.add("error");
    });
});
