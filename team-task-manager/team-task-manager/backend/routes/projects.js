const { Router } = require("express");
const { randomUUID } = require("node:crypto");
const { query } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = Router();

// ── Helper ────────────────────────────────────────────────────────────────────
/** Returns all project IDs the user can see (owned or member of). */
async function visibleProjectIds(userId) {
  const { rows } = await query(
    `SELECT id FROM projects WHERE owner_id = $1
     UNION
     SELECT project_id AS id FROM project_members WHERE user_id = $1`,
    [userId],
  );
  return rows.map((r) => r.id);
}

// ── GET /api/projects ─────────────────────────────────────────────────────────
router.get("/projects", requireAuth, async (req, res) => {
  try {
    const ids = await visibleProjectIds(req.user.userId);
    if (ids.length === 0) return res.json([]);
    const { rows } = await query(
      `SELECT id, name, description,
              owner_id AS "ownerId",
              created_at AS "createdAt"
       FROM projects
       WHERE id = ANY($1::text[])
       ORDER BY created_at DESC`,
      [ids],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /projects error:", err.message);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// ── POST /api/projects ────────────────────────────────────────────────────────
router.post("/projects", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    const id = randomUUID();
    const { rows: [row] } = await query(
      `INSERT INTO projects (id, name, description, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description,
                 owner_id AS "ownerId",
                 created_at AS "createdAt"`,
      [id, name.trim(), description ? String(description) : null, req.user.userId],
    );
    // Owner is implicitly a project member
    await query(
      `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, req.user.userId],
    );
    res.status(201).json(row);
  } catch (err) {
    console.error("POST /projects error:", err.message);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────────
router.get("/projects/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const ids = await visibleProjectIds(req.user.userId);
    if (!ids.includes(id)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { rows: [project] } = await query(
      `SELECT id, name, description,
              owner_id AS "ownerId",
              created_at AS "createdAt"
       FROM projects WHERE id = $1`,
      [id],
    );
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { rows: members } = await query(
      `SELECT u.id AS "userId", u.name, u.email, u.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.name`,
      [id],
    );
    res.json({ ...project, members });
  } catch (err) {
    console.error("GET /projects/:id error:", err.message);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────
router.delete("/projects/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { rows: [project] } = await query(
      "SELECT owner_id FROM projects WHERE id = $1",
      [id],
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.owner_id !== req.user.userId) {
      return res
        .status(403)
        .json({ error: "Only the project owner can delete it" });
    }
    // ON DELETE CASCADE in schema handles tasks + project_members
    await query("DELETE FROM projects WHERE id = $1", [id]);
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /projects/:id error:", err.message);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ── POST /api/projects/:id/members ────────────────────────────────────────────
router.post(
  "/projects/:id/members",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const { rows: [proj] } = await query(
        "SELECT id FROM projects WHERE id = $1",
        [id],
      );
      if (!proj) return res.status(404).json({ error: "Project not found" });

      const { rows: [user] } = await query(
        "SELECT id FROM users WHERE id = $1",
        [String(userId)],
      );
      if (!user) return res.status(404).json({ error: "User not found" });

      await query(
        `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, String(userId)],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /projects/:id/members error:", err.message);
      res.status(500).json({ error: "Failed to add member" });
    }
  },
);

// ── DELETE /api/projects/:id/members/:userId ──────────────────────────────────
router.delete(
  "/projects/:id/members/:userId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id, userId } = req.params;
      const { rows: [proj] } = await query(
        "SELECT owner_id FROM projects WHERE id = $1",
        [id],
      );
      if (!proj) return res.status(404).json({ error: "Project not found" });
      if (proj.owner_id === userId) {
        return res
          .status(400)
          .json({ error: "Cannot remove the project owner" });
      }
      await query(
        "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2",
        [id, userId],
      );
      // Unassign their tasks within this project
      await query(
        `UPDATE tasks SET assignee_id = NULL, updated_at = NOW()
         WHERE project_id = $1 AND assignee_id = $2`,
        [id, userId],
      );
      res.status(204).send();
    } catch (err) {
      console.error("DELETE /projects/:id/members/:userId error:", err.message);
      res.status(500).json({ error: "Failed to remove member" });
    }
  },
);

module.exports = router;
module.exports.visibleProjectIds = visibleProjectIds;
