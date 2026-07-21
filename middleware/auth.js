const jwt = require("jsonwebtoken");

/* Reads "Authorization: Bearer <token>", verifies it, attaches req.user.
   Rejects the request if the token is missing/invalid/expired. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired — please sign in again" });
  }
}

/* Same as authenticate(), but doesn't fail the request when there's no
   token — just leaves req.user as null. Used for guest-friendly routes
   like liking/commenting/viewing content. */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) { req.user = null; return next(); }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    req.user = null;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { authenticate, optionalAuth, requireAdmin };
