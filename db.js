/* =====================================================================
   DB.JS — single SQLite file on disk (data/sikhjagat.db). Replaces every
   localStorage key the old frontend used. better-sqlite3 is synchronous,
   so no async/await noise for simple reads/writes.
   ===================================================================== */

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "sikhjagat.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash    TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One table for every admin-editable content type (programs, services,
  -- videos, photos, vlogs, podcasts, articles, library, live classes,
  -- playlists, resources). "data" holds the type-specific fields as JSON
  -- so we don't need a separate table per content type.
  CREATE TABLE IF NOT EXISTS content_items (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    data       TEXT NOT NULL,           -- JSON blob of the item's fields
    live       INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(type);

  -- Views/likes/shares per media item. likes stored as JSON array of
  -- visitor ids ("user:email" or "guest:deviceId") so one person = one like.
  CREATE TABLE IF NOT EXISTS engagement (
    type   TEXT NOT NULL,
    item_id TEXT NOT NULL,
    views  INTEGER NOT NULL DEFAULT 0,
    likes  TEXT NOT NULL DEFAULT '[]',
    shares INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (type, item_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    item_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    text       TEXT NOT NULL,
    visitor_id TEXT,
    time       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(type, item_id);

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    message    TEXT NOT NULL,
    reply      TEXT,
    reply_time TEXT,
    time       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id         TEXT PRIMARY KEY,
    name       TEXT,
    email      TEXT,
    category   TEXT,
    message    TEXT NOT NULL,
    rating     INTEGER,
    time       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id         TEXT PRIMARY KEY,
    image      TEXT,
    caption    TEXT,
    author     TEXT,
    time       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    time       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_alerts (
    id         TEXT PRIMARY KEY,
    icon       TEXT,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    time       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cms (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    user_email TEXT NOT NULL,
    item_id    TEXT NOT NULL,
    type       TEXT,
    title      TEXT,
    PRIMARY KEY (user_email, item_id)
  );
`);

/* ---- Seed the admin account on first run (hashed, never plaintext) ---- */
function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@sikhjagat.org").toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return;
  const password = process.env.SEED_ADMIN_PASSWORD || "change-me-immediately";
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, NULL, ?, 'admin')"
  ).run(cryptoRandomId(), "Admin", email, hash);
  console.log(`Seeded admin account: ${email} — sign in and change the password right away.`);
}

function cryptoRandomId() {
  return require("crypto").randomBytes(12).toString("hex");
}

seedAdmin();

module.exports = { db, cryptoRandomId };
