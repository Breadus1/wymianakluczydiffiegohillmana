const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const crypto = require('crypto');
const fs = require('fs');
const app = express();
const port = 3000;

const serverDH = crypto.createDiffieHellman(2048);
const serverPublicKey = serverDH.generateKeys('hex');

let sharedSecret = fs.existsSync('secret.txt') ? Buffer.from(fs.readFileSync('secret.txt', 'utf8'), 'hex') : null;


console.log("Publiczny klucz serwera:", serverPublicKey);

const db = new sqlite3.Database('./chat_database.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Połączono z bazą danych.");
});

app.use(bodyParser.json());
app.use(express.static("public"));

app.get('/public-key', (req, res) => {
  res.status(200).send({ publicKey: serverPublicKey });
});

app.post('/exchange-keys', (req, res) => {
  const clientPublicKeyHex = req.body.publicKey;
  const clientPublicKeyBuffer = Buffer.from(clientPublicKeyHex, 'hex');
  sharedSecret = serverDH.computeSecret(clientPublicKeyBuffer, 'hex', 'hex');
  
  fs.writeFileSync('secret.txt', sharedSecret.toString('hex'));

  console.log("Wspólny sekret (serwer):", sharedSecret.toString('hex'));
  res.status(200).send({ secret: sharedSecret.toString('hex') });
});

app.post("/send", (req, res) => {
  if (!sharedSecret) {
    return res.status(500).send({ error: "Sekret nie jest jeszcze dostępny." });
  }
  const message = encrypt(req.body.message, sharedSecret);
  const query = "INSERT INTO messages (message) VALUES (?)";
  db.run(query, [message], function (err) {
    if (err) {
      res.status(500).send({ error: "Coś nie wyszło przy zapisie wiadomości." });
      return console.error(err.message);
    }
    res.status(200).send({ message: "Wiadomość wysłana", id: this.lastID });
  });
});

app.get("/messages", (req, res) => {
  const query = "SELECT * FROM messages ORDER BY timestamp DESC";
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).send({ error: "Coś nie wyszło przy odczycie wiadomości." });
      return console.error(err.message);
    }
    const decryptedMessages = rows.map(row => ({
      ...row,
      message: sharedSecret ? decrypt(row.message, sharedSecret) : "Sekret nie jest dostępny, nie można deszyfrować wiadomości"
    }));
    res.status(200).json(decryptedMessages);
  });
});

app.listen(port, () => {
  console.log(`Serwer działa na porcie ${port}`);
});

process.on("SIGINT", () => {
  db.close(() => {
    console.log("Baza danych wyłączona");
    process.exit(0);
  });
});

function encrypt(text, secret) {
  if (!secret || !text) {
    console.error('Brak sekretu lub tekstu do szyfrowania.');
    return null;  
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;  
}

function decrypt(text, secret) {
  if (!text || !secret) {
    console.error('Brak tekstu lub sekretu, nie można deszyfrować');
    return "Sekret nie jest dostępny, nie można deszyfrować wiadomości";
  }
  let textParts = text.split(':');
  if (textParts.length !== 2) {
    return "Nieprawidłowy format szyfrowania";
  }
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = Buffer.from(textParts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret, 'hex'), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}


