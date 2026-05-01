const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "FATAL: JWT_SECRET env var is not set in production. Set it in Railway Variables.",
      );
      process.exit(1);
    }
    console.warn(
      "WARN: Using default dev JWT_SECRET. Set JWT_SECRET in your .env file.",
    );
    return "dev-only-task-manager-secret-change-me";
  })();

/**
 * Sign a JWT token valid for 7 days.
 * @param {{ userId: string, email: string, role: string }} payload
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verify a JWT token. Returns the decoded payload or null if invalid/expired.
 * @param {string} token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** Express middleware — requires a valid Bearer token. */
function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }
  const payload = verifyToken(match[1]);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = payload;
  next();
}

/** Express middleware — requires role === 'admin'. Must follow requireAuth. */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin };
