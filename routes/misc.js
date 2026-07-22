const express = require("express");
const { pool, get, all, run, cryptoRandomId } = require("../db");
const { authenticate, optionalAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/* ---------------------------- CONTACT MESSAGES ---------------------------- */
// Admin sees every message; a signed-in visitor sees only their own (matched
// by email) under "Your messages" on the Contact page.
router.get("/messages", authenticate, async (req, res, next) => {
  try {
    const rows = req.user.role === "admin"
      ? await all("SELECT * FROM messages ORDER BY created_at DESC")
      : await all("SELECT * FROM messages WHERE email = ? ORDER BY created_at DESC", [req.user.email]);
    res.json({ messages: rows });
  } catch (e) { next(e); }
});

router.post("/messages", async (req, res, next) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: "Name, email and message are required" });
    const id = cryptoRandomId();
    await run(
      "INSERT INTO messages (id, name, email, message, time) VALUES (?, ?, ?, ?, ?)",
      [id, name.trim(), email.trim(), message.trim(), new Date().toLocaleString()]
    );
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

router.post("/messages/:id/reply", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { reply } = req.body || {};
    if (!reply || !reply.trim()) return res.status(400).json({ error: "Reply can't be empty" });
    const result = await run(
      "UPDATE messages SET reply = ?, reply_time = ? WHERE id = ?",
      [reply.trim(), new Date().toLocaleString(), req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: "Message not found" });
    const msg = await get("SELECT * FROM messages WHERE id = ?", [req.params.id]);
    res.json({ message: msg });
  } catch (e) { next(e); }
});

/* Admin can delete any message; a signed-in visitor can delete only their
   own (matched by account email) — enforced here, not just in the UI. */
router.delete("/messages/:id", authenticate, async (req, res, next) => {
  try {
    const msg = await get("SELECT * FROM messages WHERE id = ?", [req.params.id]);
    if (!msg) return res.status(404).json({ error: "Message not found" });
    const isOwner = msg.email.toLowerCase() === req.user.email.toLowerCase();
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({ error: "You can't delete this message" });
    }
    await run("DELETE FROM messages WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------------------------- FEEDBACK ---------------------------- */
router.get("/feedback", authenticate, requireAdmin, async (req, res, next) => {
  try {
    res.json({ feedback: await all("SELECT * FROM feedback ORDER BY created_at DESC") });
  } catch (e) { next(e); }
});

router.post("/feedback", optionalAuth, async (req, res, next) => {
  try {
    const { name, email, message, rating, category } = req.body || {};
    if (!rating) return res.status(400).json({ error: "Please choose a star rating" });
    const id = cryptoRandomId();
    await run(
      "INSERT INTO feedback (id, name, email, category, message, rating, time) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, name || (req.user ? req.user.name : null), email || (req.user ? req.user.email : null), category || null, (message || "").trim(), rating, new Date().toLocaleString()]
    );
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/* ---------------------------- COMMUNITY POSTS ---------------------------- */
router.get("/posts", async (req, res, next) => {
  try {
    res.json({ posts: await all("SELECT * FROM posts ORDER BY created_at DESC") });
  } catch (e) { next(e); }
});

router.post("/posts", authenticate, async (req, res, next) => {
  try {
    const { image, caption } = req.body || {};
    const id = cryptoRandomId();
    await run(
      "INSERT INTO posts (id, image, caption, author, time) VALUES (?, ?, ?, ?, ?)",
      [id, image || null, caption || "", req.user.name, new Date().toLocaleString()]
    );
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

router.delete("/posts/:id", authenticate, async (req, res, next) => {
  try {
    const post = await get("SELECT * FROM posts WHERE id = ?", [req.params.id]);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (req.user.role !== "admin" && post.author !== req.user.name) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }
    await run("DELETE FROM posts WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------------------------- NOTIFICATIONS (site-wide) ---------------------------- */
router.get("/notifications", async (req, res, next) => {
  try {
    res.json({ notifications: await all("SELECT * FROM notifications ORDER BY created_at DESC") });
  } catch (e) { next(e); }
});

router.post("/notifications", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: "Title and body are required" });
    const id = cryptoRandomId();
    await run(
      "INSERT INTO notifications (id, title, body, time) VALUES (?, ?, ?, ?)",
      [id, title, body, "Just now"]
    );
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/* ---------------------------- ADMIN ALERTS (admin-only activity feed) ---------------------------- */
router.get("/admin-alerts", authenticate, requireAdmin, async (req, res, next) => {
  try {
    res.json({ alerts: await all("SELECT * FROM admin_alerts ORDER BY created_at DESC LIMIT 50") });
  } catch (e) { next(e); }
});

/* ---------------------------- CMS (site text: hero copy, about, contact info) ---------------------------- */
router.get("/cms", async (req, res, next) => {
  try {
    const rows = await all("SELECT * FROM cms");
    const cms = {};
    rows.forEach((r) => { cms[r.key] = r.value; });
    res.json({ cms });
  } catch (e) { next(e); }
});

// Postgres upsert: ON CONFLICT (key) DO UPDATE ... — same idea as SQLite's
// "ON CONFLICT(key) DO UPDATE", just run inside a transaction so a batch of
// text-field updates either all succeed or all fail together.
router.put("/cms", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const updates = req.body || {};
    await client.query("BEGIN");
    for (const [k, v] of Object.entries(updates)) {
      await client.query(
        "INSERT INTO cms (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [k, String(v)]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

/* ---------------------------- BOOKMARKS (per signed-in user) ---------------------------- */
router.get("/bookmarks", authenticate, async (req, res, next) => {
  try {
    res.json({ bookmarks: await all("SELECT * FROM bookmarks WHERE user_email = ?", [req.user.email]) });
  } catch (e) { next(e); }
});

// Postgres has no "INSERT OR IGNORE" — the equivalent is
// "ON CONFLICT (...) DO NOTHING", targeting the same primary key columns.
router.post("/bookmarks", authenticate, async (req, res, next) => {
  try {
    const { itemId, type, title } = req.body || {};
    if (!itemId) return res.status(400).json({ error: "itemId is required" });
    await run(
      "INSERT INTO bookmarks (user_email, item_id, type, title) VALUES (?, ?, ?, ?) ON CONFLICT (user_email, item_id) DO NOTHING",
      [req.user.email, itemId, type || null, title || null]
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/bookmarks/:itemId", authenticate, async (req, res, next) => {
  try {
    await run("DELETE FROM bookmarks WHERE user_email = ? AND item_id = ?", [req.user.email, req.params.itemId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
