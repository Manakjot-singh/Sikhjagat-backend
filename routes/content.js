const express = require("express");
const { db, cryptoRandomId } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Every content type the old data.js/localStorage version had. Keeping this
// list here means a bad :type in the URL is rejected instead of silently
// creating a new table-less category.
const ALLOWED_TYPES = new Set([
  "live", "videos", "photos", "vlogs", "podcasts", "articles",
  "playlists", "library", "programs", "services", "resources",
]);

function checkType(req, res, next) {
  if (!ALLOWED_TYPES.has(req.params.type)) {
    return res.status(404).json({ error: `Unknown content type "${req.params.type}"` });
  }
  next();
}

function rowToItem(row) {
  return { id: row.id, ...JSON.parse(row.data), live: !!row.live };
}

/* GET /api/content/:type — public, anyone can browse the site's content */
router.get("/:type", checkType, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM content_items WHERE type = ? ORDER BY sort_order ASC, created_at ASC"
  ).all(req.params.type);
  res.json({ items: rows.map(rowToItem) });
});

/* POST /api/content/:type — admin only, adds one item */
router.post("/:type", checkType, authenticate, requireAdmin, (req, res) => {
  const { live, ...fields } = req.body || {};
  const id = req.params.type.slice(0, 2) + cryptoRandomId().slice(0, 8);
  const maxOrder = db.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) AS m FROM content_items WHERE type = ?"
  ).get(req.params.type).m;
  db.prepare(
    "INSERT INTO content_items (id, type, data, live, sort_order) VALUES (?, ?, ?, ?, ?)"
  ).run(id, req.params.type, JSON.stringify(fields), live ? 1 : 0, maxOrder + 1);
  const row = db.prepare("SELECT * FROM content_items WHERE id = ?").get(id);
  res.status(201).json({ item: rowToItem(row) });
});

/* PUT /api/content/:type/:id — admin only, partial update (e.g. toggling
   "live now" on a class, or editing fields) */
router.put("/:type/:id", checkType, authenticate, requireAdmin, (req, res) => {
  const row = db.prepare(
    "SELECT * FROM content_items WHERE type = ? AND id = ?"
  ).get(req.params.type, req.params.id);
  if (!row) return res.status(404).json({ error: "Item not found" });

  const current = JSON.parse(row.data);
  const { live, ...fields } = req.body || {};
  const merged = { ...current, ...fields };
  const nextLive = live === undefined ? row.live : (live ? 1 : 0);
  db.prepare("UPDATE content_items SET data = ?, live = ? WHERE id = ?")
    .run(JSON.stringify(merged), nextLive, req.params.id);
  const updated = db.prepare("SELECT * FROM content_items WHERE id = ?").get(req.params.id);
  res.json({ item: rowToItem(updated) });
});

/* DELETE /api/content/:type/:id — admin only */
router.delete("/:type/:id", checkType, authenticate, requireAdmin, (req, res) => {
  const result = db.prepare(
    "DELETE FROM content_items WHERE type = ? AND id = ?"
  ).run(req.params.type, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Item not found" });
  res.json({ ok: true });
});

module.exports = router;
