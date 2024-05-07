const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const port = 3000;

const db = new sqlite3.Database("./chat_database.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Połączono z baza");
});

app.use(bodyParser.json());
app.use(express.static("public"));

app.post("/send", (req, res) => {
  const message = req.body.message;
  const query = "INSERT INTO messages (message) VALUES (?)";
  db.run(query, [message], function (err) {
    if (err) {
      res.status(500).send({ error: "Cos nie wyszlo" });
      return console.error(err.message);
    }
    res.status(200).send({ message: "Wiadomość wyslana", id: this.lastID });
  });
});

app.get("/messages", (req, res) => {
  const query = "SELECT * FROM messages ORDER BY timestamp DESC";
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).send({ error: "Coś nie wyszło" });
      return console.error(err.message);
    }
    res.status(200).json(rows);
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
