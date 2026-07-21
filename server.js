require("dotenv").config();
const express = require("express");
const cors = require("cors");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-this-to-a-long-random-string") {
  console.warn(
    "\n⚠️  JWT_SECRET is missing or still the placeholder value.\n" +
    "   Set a real random secret in .env before deploying — see .env.example.\n"
  );
}

const app = express();

app.use(express.json({ limit: "8mb" })); // 8mb ceiling covers base64 photo uploads from the admin dashboard

const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: false,
}));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/content", require("./routes/content"));
app.use("/api/engagement", require("./routes/engagement"));
app.use("/api", require("./routes/misc"));

// Keep error bodies generic — never leak stack traces or SQL to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end" });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Sikh Jagat API listening on http://localhost:${PORT}`);
});
