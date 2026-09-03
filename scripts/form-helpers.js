document.getElementById("newsletter-form").addEventListener("submit", async (event) => {
  event.preventDefault(); // stop the browser from navigating away

  const form = event.target;
  const formData = new FormData(form);

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: formData,
    });

    // Optional: handle success or failure quietly
    if (response.ok) {
      console.log("Form submitted successfully.");
      alert("Thanks for subscribing!");
      form.reset();
    } else {
      console.error("Submission failed.");
      alert("Something went wrong. Please try again later.");
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    alert("Network error. Please try again later.");
  }
});
