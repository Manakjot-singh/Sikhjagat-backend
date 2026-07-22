const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get, all, run } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function publicUser(user) {
  return { name: user.name, email: user.email, role: user.role, phone: user.phone || null };
}

/* GET /api/users — admin only. Never includes password_hash. */
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const rows = await all("SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at ASC");
    res.json({ users: rows });
  } catch (e) { next(e); }
});

/* PUT /api/users/me — update your own name/email/phone */
router.put("/me", authenticate, async (req, res, next) => {
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: "Name and email can't be empty" });

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== req.user.email) {
      const clash = await get("SELECT id FROM users WHERE email = ? AND id != ?", [normalizedEmail, req.user.id]);
      if (clash) return res.status(409).json({ error: "Another account already uses that email" });
    }

    await run(
      "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?",
      [name.trim(), normalizedEmail, phone ? phone.trim() : null, req.user.id]
    );

    const updated = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);

    // Issue a fresh token since the email (part of the token payload) may
    // have changed.
    const token = jwt.sign(
      { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({ user: publicUser(updated), token });
  } catch (e) { next(e); }
});

/* PUT /api/users/me/password — change your own password, current password required */
router.put("/me/password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Fill in both password fields" });
    if (newPassword.length < 6) return res.status(400).json({ error: "New password should be at least 6 characters" });

    const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
