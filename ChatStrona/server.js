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
        console.error(err.message);
        return;
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
    const message = encrypt(req.body.message, sharedSecret);
    const query = "INSERT INTO messages (message) VALUES (?)";
    db.run(query, [message], function (err) {
        if (err) {
            res.status(500).send({ error: "Failed to save message." });
            console.error(err.message);
            return;
        }
        res.status(200).send({ message: "Message sent", id: this.lastID });
    });
});

app.get("/messages", (req, res) => {
    const query = "SELECT * FROM messages ORDER BY timestamp DESC";
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Failed to fetch messages:', err);
            return res.status(500).send({ error: "Failed to fetch messages." });
        }
        const decryptedMessages = rows.map(row => {
            const decrypted = decrypt(row.message, sharedSecret);
            if (decrypted === null) {
                console.error('Failed to decrypt message:', row.message);
                return { ...row, message: 'Decryption error' };
            }
            return { ...row, message: decrypted };
        });
        res.status(200).json(decryptedMessages);
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

process.on("SIGINT", () => {
    db.close(() => {
        console.log("Database closed");
        process.exit(0);
    });
});

function encrypt(text, secret) {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(secret).digest('hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    console.log(`Encrypting: Key=${key}, IV=${iv.toString('hex')}, Encrypted=${encrypted}`);
    return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text, secret) {
    if (!text) {
        console.error('No text provided for decryption');
        return null;
    }
    const parts = text.split(':');
    if (parts.length !== 2) {
        console.error('Invalid encrypted data format', text);
        return null;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const key = crypto.createHash('sha256').update(secret).digest('hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    try {
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        console.log(`Decrypting: Key=${key}, IV=${parts[0]}, Decrypted=${decrypted}`);
        return decrypted;
    } catch (error) {
        console.error(`Decryption failed:`, error);
        return null;
    }
}

