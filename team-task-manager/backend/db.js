const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "ERROR: DATABASE_URL is not set.\n" +
      "  • Railway: add a Postgres plugin — it injects DATABASE_URL automatically.\n" +
      "  • Local:   copy .env.example → .env and fill in your connection string.",
  );
  process.exit(1);
}

// Railway Postgres requires SSL; local installs usually do not.
// Auto-detect by checking for localhost/127.0.0.1 in the URL.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err.message);
});

/** Run a parameterised query. */
async function query(sql, params) {
  return pool.query(sql, params);
}

/**
 * Create all tables if they do not already exist.
 * Called once at server startup — idempotent and safe to re-run.
 */
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT        PRIMARY KEY,
      email         TEXT        NOT NULL UNIQUE,
      name          TEXT        NOT NULL,
      password_hash TEXT        NOT NULL,
      role          TEXT        NOT NULL DEFAULT 'member'
                                CHECK (role IN ('admin','member')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT        PRIMARY KEY,
      name        TEXT        NOT NULL,
      description TEXT,
      owner_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id  TEXT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id     TEXT        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
      added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT        PRIMARY KEY,
      project_id  TEXT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL,
      description TEXT,
      assignee_id TEXT        REFERENCES users(id) ON DELETE SET NULL,
      status      TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','in_progress','completed')),
      due_date    TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ Database schema ready");
}

module.exports = { pool, query, initSchema };
