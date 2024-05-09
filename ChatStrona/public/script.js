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

  sendMessageButton.addEventListener("click", async function () {
    let message = inputMessage.value;
    if (!secret) {
      console.error('Sekret nie jest zdefiniowany.');
      alert('Sekret nie jest jeszcze dostępny. Poczekaj chwilę i spróbuj ponownie.');
      return;  
    }
    let encryptedMessage = await encryptMessage(message, secret);
    sendMessage(encryptedMessage);
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
      .then(async (data) => {
        messagesDiv.innerHTML = "";
        for (let msg of data) {
          let decryptedMessage = await decryptMessage(msg.message, secret);
          displayMessage(decryptedMessage);
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  getMessages();
});

async function encryptMessage(message, secret) {
  if (!secret) {
    console.error('Sekret nie jest zdefiniowany.');
    return message;
  }
  const secretKeyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await window.crypto.subtle.importKey("raw", secretKeyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, data);
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
  return ivHex + ':' + encryptedHex;
}


async function decryptMessage(encryptedMessage, secret) {
  if (!secret) {
    console.error('Sekret nie jest zdefiniowany.');
    return encryptedMessage;
  }
  const secretKeyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const [ivHex, encryptedHex] = encryptedMessage.split(':');
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const key = await window.crypto.subtle.importKey("raw", secretKeyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, encrypted);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

