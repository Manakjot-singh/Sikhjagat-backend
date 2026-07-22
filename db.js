/* =====================================================================
   DB.JS — Postgres version (was SQLite/better-sqlite3).

   Postgres is async, so every call is now a Promise. To keep the route
   files as close as possible to the original, this file exposes three
   small helpers — get(), all(), run() — that behave like the old
   better-sqlite3 .get()/.all()/.run(), just awaited instead of sync.

   You still write SQL with "?" placeholders exactly like before; this
   file converts them to Postgres's "$1, $2, ..." style automatically.
   ===================================================================== */

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

if (!process.env.DATABASE_URL) {
  console.warn(
    "\n⚠️  DATABASE_URL is not set. Add your Render Postgres connection " +
    "string to .env (or Render's environment variables) before starting the server.\n"
  );
}

// Render's internal Postgres URLs don't need SSL; external ones usually do.
// This flag covers both without you having to think about it.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false,
});

function toPgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Returns the first row, or null — like better-sqlite3's .get() */
async function get(sql, params = []) {
  const result = await pool.query(toPgQuery(sql), params);
  return result.rows[0] || null;
}

/** Returns all rows — like better-sqlite3's .all() */
async function all(sql, params = []) {
  const result = await pool.query(toPgQuery(sql), params);
  return result.rows;
}

/** For INSERT/UPDATE/DELETE — like better-sqlite3's .run().
    result.changes = number of rows affected (same field name as before,
    so route files that check `result.changes === 0` keep working). */
async function run(sql, params = []) {
  const result = await pool.query(toPgQuery(sql), params);
  return { changes: result.rowCount, rows: result.rows };
}

function cryptoRandomId() {
  return crypto.randomBytes(12).toString("hex");
}

async function createSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      phone         TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'member',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      otp_hash    TEXT NOT NULL,
      expires_at  BIGINT NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_items (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      data       TEXT NOT NULL,
      live       INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(type);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS engagement (
      type    TEXT NOT NULL,
      item_id TEXT NOT NULL,
      views   INTEGER NOT NULL DEFAULT 0,
      likes   TEXT NOT NULL DEFAULT '[]',
      shares  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (type, item_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      item_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      text       TEXT NOT NULL,
      visitor_id TEXT,
      time       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(type, item_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      reply      TEXT,
      reply_time TEXT,
      time       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id         TEXT PRIMARY KEY,
      name       TEXT,
      email      TEXT,
      category   TEXT,
      message    TEXT NOT NULL,
      rating     INTEGER,
      time       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id         TEXT PRIMARY KEY,
      image      TEXT,
      caption    TEXT,
      author     TEXT,
      time       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      time       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_alerts (
      id         TEXT PRIMARY KEY,
      icon       TEXT,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      time       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cms (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      user_email TEXT NOT NULL,
      item_id    TEXT NOT NULL,
      type       TEXT,
      title      TEXT,
      PRIMARY KEY (user_email, item_id)
    );
  `);
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@sikhjagat.org").toLowerCase();
  const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return;
  const password = process.env.SEED_ADMIN_PASSWORD || "change-me-immediately";
  const hash = bcrypt.hashSync(password, 10);
  await run(
    "INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, NULL, ?, 'admin')",
    [cryptoRandomId(), "Admin", email, hash]
  );
  console.log(`Seeded admin account: ${email} — sign in and change the password right away.`);
}

// Runs schema creation + admin seeding once, before the server starts
// accepting requests. server.js awaits this.
async function initDb() {
  await createSchema();
  await seedAdmin();
}

module.exports = { pool, get, all, run, cryptoRandomId, initDb };
