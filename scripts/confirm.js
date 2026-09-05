document.addEventListener("DOMContentLoaded", async () => {
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

  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbwTZO8G9_h2HiB-vw16-BrZLPtT-78m-_AX-te3QnlldN-gNptHR0tjAMz7IL9UwbkAXg/exec?code=" +
    encodeURIComponent(code);

  let result = null;

  try {
    // Fetch and read JSON — but do NOT block UX
    const response = await fetch(scriptUrl);
    result = await response.json();
  } catch (_) {
    // If fetch fails, fall back to normal success message
    result = { status: "confirmed" };
  }

  // === Only special-case we care about ===
  if (result.status === "already_confirmed") {
    message.textContent = "Already Confirmed";
    statusBox.textContent =
      "Your subscription was already confirmed earlier. You're all set!";
    statusBox.classList.add("success");
    return;
  }

  // === Default behavior (unchanged) ===
  message.textContent = "Subscription Confirmed!";
  statusBox.textContent =
    "Thanks for joining Kemptville Creative Writers. You'll soon receive a welcome e-mail and then periodic newsletters.";
  statusBox.classList.add("success");
});
