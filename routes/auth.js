const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { db, cryptoRandomId } = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

/* Slow down brute-force guessing on the endpoints that check a password
   or a one-time code. Generous enough not to bother real users. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts — please wait a few minutes and try again" },
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  return { name: user.name, email: user.email, role: user.role, phone: user.phone || null };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---------------------------- REGISTER ---------------------------- */
router.post("/register", authLimiter, (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const hash = bcrypt.hashSync(password, 10);
  const id = cryptoRandomId();
  // Role is always "member" here — admin accounts are seeded server-side
  // only (see db.js), never granted by whatever a client sends.
  db.prepare(
    "INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, 'member')"
  ).run(id, name.trim(), normalizedEmail, phone ? phone.trim() : null, hash);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

/* ---------------------------- LOGIN ---------------------------- */
router.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  // Same error for "no such user" and "wrong password" — don't reveal
  // which one it was, so accounts can't be enumerated.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

/* ---------------------------- CURRENT SESSION ---------------------------- */
router.get("/me", authenticate, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Account no longer exists" });
  res.json({ user: publicUser(user) });
});

/* ---------------------------- FORGOT PASSWORD (OTP) ----------------------------
   Real flow: request a code -> we email/text it -> user enters it -> user picks
   a new password. This demo has no email/SMS provider wired up, so the OTP is
   returned in the response for the frontend to show in a toast, exactly like
   the original localStorage-only version did. Wire up an email/SMS provider
   (e.g. SendGrid, Twilio) in production and stop returning `otp` in the JSON. */
router.post("/forgot", authLimiter, (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) return res.status(400).json({ error: "Enter your email or mobile number" });

  const raw = identifier.trim();
  const lower = raw.toLowerCase();
  const digitsOnly = raw.replace(/\D/g, "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(lower) ||
    (digitsOnly ? db.prepare("SELECT * FROM users WHERE phone IS NOT NULL AND replace(replace(replace(phone,' ',''),'-',''),'+','') LIKE ?").get(`%${digitsOnly.slice(-7)}%`) : null);

  // Always respond the same way whether or not an account exists, so this
  // endpoint can't be used to check which emails/numbers are registered.
  if (!user) return res.json({ ok: true, note: "If that account exists, a code has been sent." });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = bcrypt.hashSync(otp, 8);
  const id = cryptoRandomId();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  db.prepare(
    "INSERT INTO password_resets (id, user_id, otp_hash, expires_at, used) VALUES (?, ?, ?, ?, 0)"
  ).run(id, user.id, otpHash, expiresAt);

  res.json({
    ok: true,
    resetId: id,
    demoOtp: otp, // remove this field once a real email/SMS provider is wired up
  });
});

router.post("/verify-otp", authLimiter, (req, res) => {
  const { resetId, code } = req.body || {};
  if (!resetId || !code) return res.status(400).json({ error: "Enter the code we sent you" });

  const reset = db.prepare("SELECT * FROM password_resets WHERE id = ?").get(resetId);
  if (!reset || reset.used) return res.status(400).json({ error: "That code is no longer valid — request a new one" });
  if (Date.now() > reset.expires_at) return res.status(400).json({ error: "That code expired — request a new one" });
  if (!bcrypt.compareSync(String(code), reset.otp_hash)) {
    return res.status(400).json({ error: "Incorrect code" });
  }

  // Issue a short-lived token proving the code was verified, instead of
  // trusting the client to remember "verified: true" itself.
  const verifyToken = jwt.sign({ resetId, userId: reset.user_id, purpose: "password-reset" }, process.env.JWT_SECRET, { expiresIn: "10m" });
  res.json({ ok: true, verifyToken });
});

router.post("/reset-password", authLimiter, (req, res) => {
  const { verifyToken, newPassword } = req.body || {};
  if (!verifyToken || !newPassword) return res.status(400).json({ error: "Missing verification or new password" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Password should be at least 6 characters" });

  let payload;
  try {
    payload = jwt.verify(verifyToken, process.env.JWT_SECRET);
    if (payload.purpose !== "password-reset") throw new Error("wrong purpose");
  } catch (e) {
    return res.status(400).json({ error: "Please verify your code again" });
  }

  const reset = db.prepare("SELECT * FROM password_resets WHERE id = ?").get(payload.resetId);
  if (!reset || reset.used) return res.status(400).json({ error: "This reset link was already used" });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, payload.userId);
  db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(payload.resetId);

  res.json({ ok: true });
});

module.exports = router;
