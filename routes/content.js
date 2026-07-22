const express = require("express");
const { get, all, run, cryptoRandomId } = require("../db");
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
router.get("/:type", checkType, async (req, res, next) => {
  try {
    const rows = await all(
      "SELECT * FROM content_items WHERE type = ? ORDER BY sort_order ASC, created_at ASC",
      [req.params.type]
    );
    res.json({ items: rows.map(rowToItem) });
  } catch (e) { next(e); }
});

/* POST /api/content/:type — admin only, adds one item */
router.post("/:type", checkType, authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { live, ...fields } = req.body || {};
    const id = req.params.type.slice(0, 2) + cryptoRandomId().slice(0, 8);
    const maxRow = await get(
      "SELECT COALESCE(MAX(sort_order), 0) AS m FROM content_items WHERE type = ?",
      [req.params.type]
    );
    const maxOrder = maxRow.m;
    await run(
      "INSERT INTO content_items (id, type, data, live, sort_order) VALUES (?, ?, ?, ?, ?)",
      [id, req.params.type, JSON.stringify(fields), live ? 1 : 0, maxOrder + 1]
    );
    const row = await get("SELECT * FROM content_items WHERE id = ?", [id]);
    res.status(201).json({ item: rowToItem(row) });
  } catch (e) { next(e); }
});

/* PUT /api/content/:type/:id — admin only, partial update (e.g. toggling
   "live now" on a class, or editing fields) */
router.put("/:type/:id", checkType, authenticate, requireAdmin, async (req, res, next) => {
  try {
    const row = await get(
      "SELECT * FROM content_items WHERE type = ? AND id = ?",
      [req.params.type, req.params.id]
    );
    if (!row) return res.status(404).json({ error: "Item not found" });

    const current = JSON.parse(row.data);
    const { live, ...fields } = req.body || {};
    const merged = { ...current, ...fields };
    const nextLive = live === undefined ? row.live : (live ? 1 : 0);
    await run("UPDATE content_items SET data = ?, live = ? WHERE id = ?", [
      JSON.stringify(merged), nextLive, req.params.id,
    ]);
    const updated = await get("SELECT * FROM content_items WHERE id = ?", [req.params.id]);
    res.json({ item: rowToItem(updated) });
  } catch (e) { next(e); }
});

/* DELETE /api/content/:type/:id — admin only */
router.delete("/:type/:id", checkType, authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await run(
      "DELETE FROM content_items WHERE type = ? AND id = ?",
      [req.params.type, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
