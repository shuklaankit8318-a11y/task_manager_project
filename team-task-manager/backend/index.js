require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initSchema, query } = require("./db");
const authRoutes = require("./routes/auth");
const projectsRoutes = require("./routes/projects");
const tasksRoutes = require("./routes/tasks");

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Set CORS_ORIGIN in your environment to your Vercel frontend URL.
// Use "*" to allow every origin (fine for development, less strict in prod).
const corsOrigin = process.env.CORS_ORIGIN || "*";
const allowedOrigins =
  corsOrigin === "*"
    ? "*"
    : corsOrigin.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: false,
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (_req, res) =>
  res.json({ ok: true, service: "team-task-manager-api" }),
);
app.get("/api/healthz", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    console.error("Healthcheck DB query failed:", err.message);
    res.status(503).json({ ok: false, db: "unavailable", error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
// All API routes are mounted under /api so the frontend calls /api/*.
app.use("/api", authRoutes);
app.use("/api", projectsRoutes);
app.use("/api", tasksRoutes);

// 404 for unknown /api paths
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Not found" }),
);

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 8080;

initSchema()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`✓ Team Task Manager API listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("✗ Failed to initialize database schema:", err.message);
    process.exit(1);
  });
