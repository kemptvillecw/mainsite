document.getElementById("newsletter-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.target;
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

    const result = await response.json();

    if (result.status === "success") {
      messageBox.textContent =
        "Thanks for subscribing! You will be sent a confirmation e‑mail. If it does not appear, check your Junk/Spam folder.";
      messageBox.classList.add("success");
      form.reset();
    }

    else if (result.status === "duplicate") {
      messageBox.textContent =
        "You're already subscribed — welcome back!";
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
