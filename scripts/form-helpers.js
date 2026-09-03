document.getElementById("newsletter-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const messageBox = document.getElementById("newsletter-message");

  // Clear previous message
  messageBox.textContent = "";
  messageBox.className = "form-message";

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      messageBox.textContent = "Thanks for subscribing!";
      messageBox.classList.add("success");
      form.reset();
    } else {
      messageBox.textContent = "Something went wrong. Please try again later.";
      messageBox.classList.add("error");
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    messageBox.textContent = "Network error. Please try again later.";
    messageBox.classList.add("error");
  }
});
