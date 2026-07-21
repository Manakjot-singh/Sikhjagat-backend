const express = require("express");
const { db, cryptoRandomId } = require("../db");
const { optionalAuth, authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const MEDIA_TYPES = new Set(["video", "photo", "vlog", "podcast", "article", "playlist"]);

function checkType(req, res, next) {
  if (!MEDIA_TYPES.has(req.params.type)) {
    return res.status(404).json({ error: `Unknown media type "${req.params.type}"` });
  }
  next();
}

function getOrCreateRow(type, itemId) {
  let row = db.prepare("SELECT * FROM engagement WHERE type = ? AND item_id = ?").get(type, itemId);
  if (!row) {
    db.prepare("INSERT INTO engagement (type, item_id, views, likes, shares) VALUES (?, ?, 0, '[]', 0)").run(type, itemId);
    row = db.prepare("SELECT * FROM engagement WHERE type = ? AND item_id = ?").get(type, itemId);
  }
  return row;
}

// Signed-in visitors are identified by their account email; guests by a
// per-browser id the frontend generates and sends in the X-Device-Id header.
// This is how one person (logged in or not) is limited to one like.
function visitorId(req) {
  if (req.user) return `user:${req.user.email.toLowerCase()}`;
  const deviceId = req.header("X-Device-Id");
  return deviceId ? `guest:${deviceId}` : null;
}

function serialize(row) {
  const comments = db.prepare(
    "SELECT * FROM comments WHERE type = ? AND item_id = ? ORDER BY created_at ASC"
  ).all(row.type, row.item_id);
  return {
    views: row.views,
    likeCount: JSON.parse(row.likes).length,
    shares: row.shares,
    comments: comments.map((c) => ({ id: c.id, name: c.name, text: c.text, time: c.time })),
  };
}

/* GET /api/engagement/:type/:id — public read, plus "did I like this" if
   the caller sends a token or device id. */
router.get("/:type/:id", checkType, optionalAuth, (req, res) => {
  const row = getOrCreateRow(req.params.type, req.params.id);
  const me = visitorId(req);
  const likes = JSON.parse(row.likes);
  res.json({ ...serialize(row), likedByMe: me ? likes.includes(me) : false });
});

/* POST /api/engagement/:type/:id/view — increments the view counter */
router.post("/:type/:id/view", checkType, (req, res) => {
  getOrCreateRow(req.params.type, req.params.id); // ensure the row exists on first-ever view
  db.prepare(
    "UPDATE engagement SET views = views + 1 WHERE type = ? AND item_id = ?"
  ).run(req.params.type, req.params.id);
  const row = getOrCreateRow(req.params.type, req.params.id);
  res.json(serialize(row));
});

/* POST /api/engagement/:type/:id/like — toggles like for this visitor */
router.post("/:type/:id/like", checkType, optionalAuth, (req, res) => {
  const me = visitorId(req);
  if (!me) return res.status(400).json({ error: "Missing device id for guest like" });
  const row = getOrCreateRow(req.params.type, req.params.id);
  const likes = JSON.parse(row.likes);
  const idx = likes.indexOf(me);
  if (idx === -1) likes.push(me); else likes.splice(idx, 1);
  db.prepare("UPDATE engagement SET likes = ? WHERE type = ? AND item_id = ?")
    .run(JSON.stringify(likes), req.params.type, req.params.id);
  const updated = getOrCreateRow(req.params.type, req.params.id);
  res.json({ ...serialize(updated), likedByMe: likes.includes(me) });
});

/* POST /api/engagement/:type/:id/share — increments the share counter */
router.post("/:type/:id/share", checkType, (req, res) => {
  getOrCreateRow(req.params.type, req.params.id);
  db.prepare(
    "UPDATE engagement SET shares = shares + 1 WHERE type = ? AND item_id = ?"
  ).run(req.params.type, req.params.id);
  const row = getOrCreateRow(req.params.type, req.params.id);
  res.json(serialize(row));
});

/* POST /api/engagement/:type/:id/comments — anyone (guest or signed in) */
router.post("/:type/:id/comments", checkType, optionalAuth, (req, res) => {
  const { name, text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Comment can't be empty" });
  getOrCreateRow(req.params.type, req.params.id);
  const id = cryptoRandomId();
  const displayName = req.user ? req.user.name : (name || "Guest").slice(0, 60);
  db.prepare(
    "INSERT INTO comments (id, type, item_id, name, text, visitor_id, time) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, req.params.type, req.params.id, displayName, text.trim().slice(0, 2000), visitorId(req), new Date().toLocaleString());
  const row = getOrCreateRow(req.params.type, req.params.id);
  res.status(201).json(serialize(row));
});

/* DELETE /api/engagement/:type/:id/comments/:commentId — admin moderation */
router.delete("/:type/:id/comments/:commentId", checkType, authenticate, requireAdmin, (req, res) => {
  db.prepare("DELETE FROM comments WHERE id = ? AND type = ? AND item_id = ?")
    .run(req.params.commentId, req.params.type, req.params.id);
  const row = getOrCreateRow(req.params.type, req.params.id);
  res.json(serialize(row));
});

module.exports = router;
