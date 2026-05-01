const { Router } = require("express");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const { signToken, requireAuth } = require("../middleware/auth");

const router = Router();


// ================= SIGNUP =================
router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};

    // validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "email, password, and name are required",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // check duplicate email
    const existing = await query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "Account already exists with this email",
      });
    }

    // First user = admin
    // All others = member
    const {
      rows: [{ c }],
    } = await query(
      "SELECT COUNT(*)::int AS c FROM users"
    );

    let finalRole = "member";

    if (c === 0) {
      finalRole = "admin";
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();

    const {
      rows: [user],
    } = await query(
      `INSERT INTO users (id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role`,
      [
        id,
        normalizedEmail,
        String(name).trim(),
        hashedPassword,
        finalRole,
      ]
    );

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      token,
      user,
    });

  } catch (err) {
    console.error("Signup error:", err.message);

    return res.status(500).json({
      error: "Failed to create account",
    });
  }
});


// ================= LOGIN =================
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "email and password are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const {
      rows: [user],
    } = await query(
      `SELECT id, email, name, role, password_hash
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const isValidPassword = await bcrypt.compare(
      String(password),
      user.password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

  } catch (err) {
    console.error("Login error:", err.message);

    return res.status(500).json({
      error: "Login failed",
    });
  }
});


// ================= CURRENT USER =================
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const {
      rows: [user],
    } = await query(
      `SELECT id, email, name, role
       FROM users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json(user);

  } catch (err) {
    console.error("Me API error:", err.message);

    return res.status(500).json({
      error: "Failed to fetch user",
    });
  }
});


// ================= GET ALL USERS =================
router.get("/users", requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, email, name, role
       FROM users
       ORDER BY name`
    );

    return res.json(rows);

  } catch (err) {
    console.error("Users API error:", err.message);

    return res.status(500).json({
      error: "Failed to fetch users",
    });
  }
});


module.exports = router;