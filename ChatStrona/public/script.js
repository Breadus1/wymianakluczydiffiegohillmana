document.addEventListener("DOMContentLoaded", function () {
  const sendMessageButton = document.getElementById("sendMessage");
  const inputMessage = document.getElementById("inputMessage");
  const messagesDiv = document.getElementById("messages");

  function displayMessage(message) {
    let messageElement = document.createElement("div");
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
  }

  sendMessageButton.addEventListener("click", function () {
    let message = inputMessage.value;
    sendMessage(message);
    displayMessage(message);
    inputMessage.value = "";
  });

  function sendMessage(message) {
    return fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message }),
    })
      .then((response) => response.json())
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  function getMessages() {
    fetch("/messages")
      .then((response) => response.json())
      .then((data) => {
        messagesDiv.innerHTML = "";
        data.forEach((msg) => {
          displayMessage(msg.message);
        });
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  getMessages();
});
