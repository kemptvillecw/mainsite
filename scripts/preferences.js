document.addEventListener("DOMContentLoaded", async () => {
  const message = document.getElementById("pref-message");
  const statusBox = document.getElementById("pref-status");
  const form = document.getElementById("preferences-form");

  const emailDisplay = document.getElementById("pref-email-display");
  const nameField = document.getElementById("pref-name");
  const weeklyField = document.getElementById("pref-weekly");

  // Extract code from URL fragment: #code=<uuid>
  const hash = window.location.hash;
  const code = hash.replace("#code=", "").trim();

  if (!code || code.length < 10) {
    message.textContent = "Invalid preferences link.";
    statusBox.textContent = "The link you followed is missing or expired.";
    statusBox.classList.add("error");
    form.style.display = "none";
    return;
  }

  // Backend endpoint
  const baseUrl =
    "https://script.google.com/macros/s/AKfycbwTZO8G9_h2HiB-vw16-BrZLPtT-78m-_AX-te3QnlldN-gNptHR0tjAMz7IL9UwbkAXg/exec";

  const fetchUrl = `${baseUrl}?action=update_preferences&code=${encodeURIComponent(code)}`;

  let result = null;

  try {
    const response = await fetch(fetchUrl);
    result = await response.json();
  } catch (err) {
    console.error("Error loading preferences:", err);
    message.textContent = "Unable to load preferences.";
    statusBox.textContent = "Network error. Please try again later.";
    statusBox.classList.add("error");
    form.style.display = "none";
    return;
  }

  if (result.status !== "ok") {
    message.textContent = "Invalid preferences link.";
    statusBox.textContent = "The preferences code appears to be invalid or expired.";
    statusBox.classList.add("error");
    form.style.display = "none";
    return;
  }

  // Populate fields
  message.textContent = "Update your newsletter preferences below.";
  emailDisplay.textContent = `Email: ${result.email || ""}`;
  nameField.value = result.name || "";
  weeklyField.checked = result.weekly_calendar === "Yes";

  // === Save handler ===
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    statusBox.textContent = "";
    statusBox.className = "form-message";

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Saving…";

    // FIXED: Use URLSearchParams + correct Content-Type
    const saveData = new URLSearchParams({
      action: "save_preferences",
      code: code,
      name: nameField.value.trim(),
      weekly_calendar: weeklyField.checked ? "Yes" : "No",
    });

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        body: saveData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const saveResult = await response.json();

      if (saveResult.status === "updated") {
        statusBox.textContent = "Your preferences have been updated.";
        statusBox.classList.add("success");
      } else {
        statusBox.textContent = "Unable to update preferences.";
        statusBox.classList.add("error");
      }
    } catch (err) {
      console.error("Error saving preferences:", err);
      statusBox.textContent = "Network error. Please try again later.";
      statusBox.classList.add("error");
    }

    submitButton.disabled = false;
    submitButton.textContent = "Save Preferences";
  });
});
