const { Router } = require("express");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const { signToken, requireAuth } = require("../middleware/auth");

const router = Router();

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, name, role } = req.body || {};

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "email, password, and name are required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check for duplicate email
    const existing = await query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "An account with that email already exists" });
    }

    // First user ever → admin. Otherwise honour requested role or default to member.
    const { rows: [{ c }] } = await query(
      "SELECT COUNT(*)::int AS c FROM users",
    );
    let finalRole = "member";
    if (c === 0) {
      finalRole = "admin";
    } else if (role === "admin" || role === "member") {
      finalRole = role;
    }

    const hash = await bcrypt.hash(password, 10);
    const id = randomUUID();

    const { rows: [row] } = await query(
      `INSERT INTO users (id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role`,
      [id, normalizedEmail, String(name).trim(), hash, finalRole],
    );

    const token = signToken({
      userId: row.id,
      email: row.email,
      role: row.role,
    });
    res.status(201).json({ token, user: row });
  } catch (err) {
    console.error("signup error:", err.message);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows: [row] } = await query(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = $1",
      [normalizedEmail],
    );

    if (!row) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(String(password), row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({
      userId: row.id,
      email: row.email,
      role: row.role,
    });
    res.json({
      token,
      user: { id: row.id, email: row.email, name: row.name, role: row.role },
    });
  } catch (err) {
    console.error("login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const { rows: [row] } = await query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [req.user.userId],
    );
    if (!row) return res.status(404).json({ error: "User not found" });
    res.json(row);
  } catch (err) {
    console.error("me error:", err.message);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get("/users", requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, email, name, role FROM users ORDER BY name",
    );
    res.json(rows);
  } catch (err) {
    console.error("users error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

module.exports = router;
