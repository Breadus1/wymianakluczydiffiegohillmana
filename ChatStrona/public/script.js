document.addEventListener("DOMContentLoaded", function () {
  const sendMessageButton = document.getElementById("sendMessage");
  const inputMessage = document.getElementById("inputMessage");
  const messagesDiv = document.getElementById("messages");
  let secret; // Zmienna do przechowywania wspólnego sekretu

  window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-384"
    },
    true,
    ["deriveKey"]
  ).then((keyPair) => {
    window.crypto.subtle.exportKey("raw", keyPair.publicKey)
    .then((exportedPublicKey) => {
      const publicKeyHex = [...new Uint8Array(exportedPublicKey)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.log("Publiczny klucz klienta (hex):", publicKeyHex);
  
      fetch('/exchange-keys', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: publicKeyHex })
      }).then(response => response.json()).then(data => {
        secret = data.secret;
        console.log('Wspólny sekret (klient):', secret);
      });
    });
  });
  


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
      body: JSON.stringify({ message: message })
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
