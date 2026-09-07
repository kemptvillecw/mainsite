document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("newsletter-form");
  const formStartedField = document.getElementById("form_started");

  // Record when the form became available (for honeypot timing)
  if (formStartedField) {
    formStartedField.value = Date.now().toString();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const messageBox = document.getElementById("newsletter-message");
    const submitButton = form.querySelector("button[type='submit']");

    // Reset message area
    messageBox.textContent = "";
    messageBox.className = "form-message";

    // Disable button + visual feedback
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
      });

      let result;
      try {
        result = await response.json();
      } catch {
        // If backend returns non-JSON, treat as generic success
        result = { status: "success" };
      }

      if (result.status === "success") {
        messageBox.textContent =
          "Thanks for subscribing! You will be sent a confirmation e‑mail. If it does not appear, check your Junk/Spam folder.";
        messageBox.classList.add("success");
        form.reset();
      }

      else if (result.status === "already_pending") {
        messageBox.textContent =
          "You’ve already started the subscription process. If you haven’t received your confirmation e‑mail, please check your Junk/Spam folder. If it still hasn’t arrived, you can try subscribing again in about 10 minutes and a new confirmation e‑mail will be sent.";
        messageBox.classList.add("success");
      }

      else if (result.status === "already_confirmed") {
        messageBox.textContent =
          "You're already confirmed and on our list. You'll continue to receive newsletters.";
        messageBox.classList.add("success");
      }

      else if (result.status === "error") {
        messageBox.textContent = result.message || "Something went wrong.";
        messageBox.classList.add("error");
      }

      else {
        // Honeypot or silent rejection — treat as normal success
        messageBox.textContent =
          "Thanks for subscribing! You will be sent a confirmation e‑mail. If it does not appear, check your Junk/Spam folder.";
        messageBox.classList.add("success");
      }

    } catch (error) {
      console.error("Error submitting form:", error);
      messageBox.textContent = "Network error. Please try again later.";
      messageBox.classList.add("error");
    }

    // Re-enable button after response
    submitButton.disabled = false;
    submitButton.textContent = "Join Newsletter";
  });
});
