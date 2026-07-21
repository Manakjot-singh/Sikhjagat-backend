const express = require("express");
const { db, cryptoRandomId } = require("../db");
const { authenticate, optionalAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/* ---------------------------- CONTACT MESSAGES ---------------------------- */
// Admin sees every message; a signed-in visitor sees only their own (matched
// by email) under "Your messages" on the Contact page.
router.get("/messages", authenticate, (req, res) => {
  const rows = req.user.role === "admin"
    ? db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all()
    : db.prepare("SELECT * FROM messages WHERE email = ? ORDER BY created_at DESC").all(req.user.email);
  res.json({ messages: rows });
});

router.post("/messages", (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: "Name, email and message are required" });
  const id = cryptoRandomId();
  db.prepare(
    "INSERT INTO messages (id, name, email, message, time) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name.trim(), email.trim(), message.trim(), new Date().toLocaleString());
  res.status(201).json({ id });
});

router.post("/messages/:id/reply", authenticate, requireAdmin, (req, res) => {
  const { reply } = req.body || {};
  if (!reply || !reply.trim()) return res.status(400).json({ error: "Reply can't be empty" });
  const result = db.prepare("UPDATE messages SET reply = ?, reply_time = ? WHERE id = ?")
    .run(reply.trim(), new Date().toLocaleString(), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Message not found" });
  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id);
  res.json({ message: msg });
});

/* Admin can delete any message; a signed-in visitor can delete only their
   own (matched by account email) — enforced here, not just in the UI. */
router.delete("/messages/:id", authenticate, (req, res) => {
  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id);
  if (!msg) return res.status(404).json({ error: "Message not found" });
  const isOwner = msg.email.toLowerCase() === req.user.email.toLowerCase();
  if (req.user.role !== "admin" && !isOwner) {
    return res.status(403).json({ error: "You can't delete this message" });
  }
  db.prepare("DELETE FROM messages WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------------------- FEEDBACK ---------------------------- */
router.get("/feedback", authenticate, requireAdmin, (req, res) => {
  res.json({ feedback: db.prepare("SELECT * FROM feedback ORDER BY created_at DESC").all() });
});

router.post("/feedback", optionalAuth, (req, res) => {
  const { name, email, message, rating, category } = req.body || {};
  if (!rating) return res.status(400).json({ error: "Please choose a star rating" });
  const id = cryptoRandomId();
  db.prepare(
    "INSERT INTO feedback (id, name, email, category, message, rating, time) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, name || (req.user ? req.user.name : null), email || (req.user ? req.user.email : null), category || null, (message || "").trim(), rating, new Date().toLocaleString());
  res.status(201).json({ id });
});

/* ---------------------------- COMMUNITY POSTS ---------------------------- */
router.get("/posts", (req, res) => {
  res.json({ posts: db.prepare("SELECT * FROM posts ORDER BY created_at DESC").all() });
});

router.post("/posts", authenticate, (req, res) => {
  const { image, caption } = req.body || {};
  const id = cryptoRandomId();
  db.prepare(
    "INSERT INTO posts (id, image, caption, author, time) VALUES (?, ?, ?, ?, ?)"
  ).run(id, image || null, caption || "", req.user.name, new Date().toLocaleString());
  res.status(201).json({ id });
});

router.delete("/posts/:id", authenticate, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (req.user.role !== "admin" && post.author !== req.user.name) {
    return res.status(403).json({ error: "You can only delete your own posts" });
  }
  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------------------- NOTIFICATIONS (site-wide) ---------------------------- */
router.get("/notifications", (req, res) => {
  res.json({ notifications: db.prepare("SELECT * FROM notifications ORDER BY created_at DESC").all() });
});

router.post("/notifications", authenticate, requireAdmin, (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "Title and body are required" });
  const id = cryptoRandomId();
  db.prepare(
    "INSERT INTO notifications (id, title, body, time) VALUES (?, ?, ?, ?)"
  ).run(id, title, body, "Just now");
  res.status(201).json({ id });
});

/* ---------------------------- ADMIN ALERTS (admin-only activity feed) ---------------------------- */
router.get("/admin-alerts", authenticate, requireAdmin, (req, res) => {
  res.json({ alerts: db.prepare("SELECT * FROM admin_alerts ORDER BY created_at DESC LIMIT 50").all() });
});

/* ---------------------------- CMS (site text: hero copy, about, contact info) ---------------------------- */
router.get("/cms", (req, res) => {
  const rows = db.prepare("SELECT * FROM cms").all();
  const cms = {};
  rows.forEach((r) => { cms[r.key] = r.value; });
  res.json({ cms });
});

router.put("/cms", authenticate, requireAdmin, (req, res) => {
  const updates = req.body || {};
  const stmt = db.prepare("INSERT INTO cms (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const tx = db.transaction((entries) => { entries.forEach(([k, v]) => stmt.run(k, String(v))); });
  tx(Object.entries(updates));
  res.json({ ok: true });
});

/* ---------------------------- BOOKMARKS (per signed-in user) ---------------------------- */
router.get("/bookmarks", authenticate, (req, res) => {
  res.json({ bookmarks: db.prepare("SELECT * FROM bookmarks WHERE user_email = ?").all(req.user.email) });
});

router.post("/bookmarks", authenticate, (req, res) => {
  const { itemId, type, title } = req.body || {};
  if (!itemId) return res.status(400).json({ error: "itemId is required" });
  db.prepare(
    "INSERT OR IGNORE INTO bookmarks (user_email, item_id, type, title) VALUES (?, ?, ?, ?)"
  ).run(req.user.email, itemId, type || null, title || null);
  res.status(201).json({ ok: true });
});

router.delete("/bookmarks/:itemId", authenticate, (req, res) => {
  db.prepare("DELETE FROM bookmarks WHERE user_email = ? AND item_id = ?").run(req.user.email, req.params.itemId);
  res.json({ ok: true });
});

module.exports = router;
