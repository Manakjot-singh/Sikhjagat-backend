const express = require("express");
const { get, all, run, cryptoRandomId } = require("../db");
const { optionalAuth, authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const MEDIA_TYPES = new Set(["video", "photo", "vlog", "podcast", "article", "playlist"]);

function checkType(req, res, next) {
  if (!MEDIA_TYPES.has(req.params.type)) {
    return res.status(404).json({ error: `Unknown media type "${req.params.type}"` });
  }
  next();
}

async function getOrCreateRow(type, itemId) {
  let row = await get("SELECT * FROM engagement WHERE type = ? AND item_id = ?", [type, itemId]);
  if (!row) {
    await run(
      "INSERT INTO engagement (type, item_id, views, likes, shares) VALUES (?, ?, 0, '[]', 0)",
      [type, itemId]
    );
    row = await get("SELECT * FROM engagement WHERE type = ? AND item_id = ?", [type, itemId]);
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

async function serialize(row) {
  const comments = await all(
    "SELECT * FROM comments WHERE type = ? AND item_id = ? ORDER BY created_at ASC",
    [row.type, row.item_id]
  );
  return {
    views: row.views,
    likeCount: JSON.parse(row.likes).length,
    shares: row.shares,
    comments: comments.map((c) => ({ id: c.id, name: c.name, text: c.text, time: c.time })),
  };
}

/* GET /api/engagement/:type/:id — public read, plus "did I like this" if
   the caller sends a token or device id. */
router.get("/:type/:id", checkType, optionalAuth, async (req, res, next) => {
  try {
    const row = await getOrCreateRow(req.params.type, req.params.id);
    const me = visitorId(req);
    const likes = JSON.parse(row.likes);
    const serialized = await serialize(row);
    res.json({ ...serialized, likedByMe: me ? likes.includes(me) : false });
  } catch (e) { next(e); }
});

/* POST /api/engagement/:type/:id/view — increments the view counter */
router.post("/:type/:id/view", checkType, async (req, res, next) => {
  try {
    await getOrCreateRow(req.params.type, req.params.id); // ensure the row exists on first-ever view
    await run(
      "UPDATE engagement SET views = views + 1 WHERE type = ? AND item_id = ?",
      [req.params.type, req.params.id]
    );
    const row = await getOrCreateRow(req.params.type, req.params.id);
    res.json(await serialize(row));
  } catch (e) { next(e); }
});

/* POST /api/engagement/:type/:id/like — toggles like for this visitor */
router.post("/:type/:id/like", checkType, optionalAuth, async (req, res, next) => {
  try {
    const me = visitorId(req);
    if (!me) return res.status(400).json({ error: "Missing device id for guest like" });
    const row = await getOrCreateRow(req.params.type, req.params.id);
    const likes = JSON.parse(row.likes);
    const idx = likes.indexOf(me);
    if (idx === -1) likes.push(me); else likes.splice(idx, 1);
    await run("UPDATE engagement SET likes = ? WHERE type = ? AND item_id = ?", [
      JSON.stringify(likes), req.params.type, req.params.id,
    ]);
    const updated = await getOrCreateRow(req.params.type, req.params.id);
    const serialized = await serialize(updated);
    res.json({ ...serialized, likedByMe: likes.includes(me) });
  } catch (e) { next(e); }
});

/* POST /api/engagement/:type/:id/share — increments the share counter */
router.post("/:type/:id/share", checkType, async (req, res, next) => {
  try {
    await getOrCreateRow(req.params.type, req.params.id);
    await run(
      "UPDATE engagement SET shares = shares + 1 WHERE type = ? AND item_id = ?",
      [req.params.type, req.params.id]
    );
    const row = await getOrCreateRow(req.params.type, req.params.id);
    res.json(await serialize(row));
  } catch (e) { next(e); }
});

/* POST /api/engagement/:type/:id/comments — anyone (guest or signed in) */
router.post("/:type/:id/comments", checkType, optionalAuth, async (req, res, next) => {
  try {
    const { name, text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: "Comment can't be empty" });
    await getOrCreateRow(req.params.type, req.params.id);
    const id = cryptoRandomId();
    const displayName = req.user ? req.user.name : (name || "Guest").slice(0, 60);
    await run(
      "INSERT INTO comments (id, type, item_id, name, text, visitor_id, time) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, req.params.type, req.params.id, displayName, text.trim().slice(0, 2000), visitorId(req), new Date().toLocaleString()]
    );
    const row = await getOrCreateRow(req.params.type, req.params.id);
    res.status(201).json(await serialize(row));
  } catch (e) { next(e); }
});

/* DELETE /api/engagement/:type/:id/comments/:commentId — admin moderation */
router.delete("/:type/:id/comments/:commentId", checkType, authenticate, requireAdmin, async (req, res, next) => {
  try {
    await run(
      "DELETE FROM comments WHERE id = ? AND type = ? AND item_id = ?",
      [req.params.commentId, req.params.type, req.params.id]
    );
    const row = await getOrCreateRow(req.params.type, req.params.id);
    res.json(await serialize(row));
  } catch (e) { next(e); }
});

module.exports = router;
