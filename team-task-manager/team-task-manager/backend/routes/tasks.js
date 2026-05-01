const { Router } = require("express");
const { randomUUID } = require("node:crypto");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { visibleProjectIds } = require("./projects");

const router = Router();

const VALID_STATUSES = new Set(["pending", "in_progress", "completed"]);

async function userCanSeeProject(userId, projectId) {
  const ids = await visibleProjectIds(userId);
  return ids.includes(projectId);
}

// ── GET /api/tasks ────────────────────────────────────────────────────────────
// ?status=  ?projectId=  ?assignee=me
router.get("/tasks", requireAuth, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const projectIdFilter = req.query.projectId
      ? String(req.query.projectId)
      : null;
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const mineOnly = req.query.assignee === "me";

    let projectIds = await visibleProjectIds(userId);
    if (projectIdFilter) {
      if (!projectIds.includes(projectIdFilter)) return res.json([]);
      projectIds = [projectIdFilter];
    }
    if (projectIds.length === 0) return res.json([]);

    const conds = ["t.project_id = ANY($1::text[])"];
    const params = [projectIds];

    if (statusFilter && VALID_STATUSES.has(statusFilter)) {
      params.push(statusFilter);
      conds.push(`t.status = $${params.length}`);
    }
    // Members only ever see tasks assigned to them; admins see everything.
    if (mineOnly || role !== "admin") {
      params.push(userId);
      conds.push(`t.assignee_id = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT t.id,
              t.project_id  AS "projectId",
              t.title,
              t.description,
              t.assignee_id AS "assigneeId",
              t.status,
              t.due_date    AS "dueDate",
              t.created_at  AS "createdAt",
              t.updated_at  AS "updatedAt",
              p.name        AS "projectName",
              u.name        AS "assigneeName"
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE ${conds.join(" AND ")}
       ORDER BY t.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /tasks error:", err.message);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// ── GET /api/projects/:id/tasks ───────────────────────────────────────────────
router.get("/projects/:id/tasks", requireAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!(await userCanSeeProject(req.user.userId, projectId))) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { rows } = await query(
      `SELECT t.id,
              t.project_id  AS "projectId",
              t.title,
              t.description,
              t.assignee_id AS "assigneeId",
              t.status,
              t.due_date    AS "dueDate",
              t.created_at  AS "createdAt",
              t.updated_at  AS "updatedAt",
              u.name        AS "assigneeName"
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [projectId],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /projects/:id/tasks error:", err.message);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// ── POST /api/projects/:id/tasks ──────────────────────────────────────────────
router.post("/projects/:id/tasks", requireAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can create tasks" });
    }
    if (!(await userCanSeeProject(req.user.userId, projectId))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const { title, description, assigneeId, dueDate, status } = req.body || {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }

    let dueDateValue = null;
    if (dueDate) {
      const d = new Date(String(dueDate));
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid dueDate" });
      }
      dueDateValue = d;
    }

    const finalStatus =
      status && VALID_STATUSES.has(String(status)) ? String(status) : "pending";

    if (assigneeId) {
      const { rows } = await query(
        "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
        [projectId, String(assigneeId)],
      );
      if (rows.length === 0) {
        return res
          .status(400)
          .json({ error: "Assignee is not a member of this project" });
      }
    }

    const { rows: [row] } = await query(
      `INSERT INTO tasks
         (id, project_id, title, description, assignee_id, status, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id,
                 project_id  AS "projectId",
                 title, description,
                 assignee_id AS "assigneeId",
                 status,
                 due_date    AS "dueDate",
                 created_at  AS "createdAt",
                 updated_at  AS "updatedAt"`,
      [
        randomUUID(),
        projectId,
        title.trim(),
        description ? String(description) : null,
        assigneeId ? String(assigneeId) : null,
        finalStatus,
        dueDateValue,
      ],
    );
    res.status(201).json(row);
  } catch (err) {
    console.error("POST /projects/:id/tasks error:", err.message);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// ── PATCH /api/tasks/:id ──────────────────────────────────────────────────────
// Admins can update everything. Members can only update status of their own tasks.
router.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { userId, role } = req.user;

    const { rows: [task] } = await query(
      "SELECT * FROM tasks WHERE id = $1",
      [id],
    );
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!(await userCanSeeProject(userId, task.project_id))) {
      return res.status(404).json({ error: "Task not found" });
    }

    const body = req.body || {};
    const setClauses = ["updated_at = NOW()"];
    const params = [];

    function addField(col, value) {
      params.push(value);
      setClauses.push(`${col} = $${params.length}`);
    }

    if (role === "admin") {
      if (typeof body.title === "string") addField("title", body.title.trim());
      if (body.description !== undefined) {
        addField("description", body.description ? String(body.description) : null);
      }
      if (body.assigneeId !== undefined) {
        const newAssignee = body.assigneeId ? String(body.assigneeId) : null;
        if (newAssignee) {
          const { rows } = await query(
            "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
            [task.project_id, newAssignee],
          );
          if (rows.length === 0) {
            return res
              .status(400)
              .json({ error: "Assignee is not a member of this project" });
          }
        }
        addField("assignee_id", newAssignee);
      }
      if (body.dueDate !== undefined) {
        if (!body.dueDate) {
          addField("due_date", null);
        } else {
          const d = new Date(String(body.dueDate));
          if (Number.isNaN(d.getTime())) {
            return res.status(400).json({ error: "Invalid dueDate" });
          }
          addField("due_date", d);
        }
      }
      if (typeof body.status === "string") {
        if (!VALID_STATUSES.has(body.status)) {
          return res.status(400).json({ error: "Invalid status" });
        }
        addField("status", body.status);
      }
    } else {
      // Member: may only update status on tasks assigned to them
      if (task.assignee_id !== userId) {
        return res
          .status(403)
          .json({ error: "You can only update tasks assigned to you" });
      }
      if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
        return res.status(400).json({
          error:
            "Members may only update status (pending, in_progress, completed)",
        });
      }
      addField("status", body.status);
    }

    params.push(id);
    const { rows: [updated] } = await query(
      `UPDATE tasks SET ${setClauses.join(", ")}
       WHERE id = $${params.length}
       RETURNING id,
                 project_id  AS "projectId",
                 title, description,
                 assignee_id AS "assigneeId",
                 status,
                 due_date    AS "dueDate",
                 created_at  AS "createdAt",
                 updated_at  AS "updatedAt"`,
      params,
    );
    res.json(updated);
  } catch (err) {
    console.error("PATCH /tasks/:id error:", err.message);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────
router.delete("/tasks/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete tasks" });
    }
    const id = req.params.id;
    const { rows: [task] } = await query(
      "SELECT project_id FROM tasks WHERE id = $1",
      [id],
    );
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!(await userCanSeeProject(req.user.userId, task.project_id))) {
      return res.status(404).json({ error: "Task not found" });
    }
    await query("DELETE FROM tasks WHERE id = $1", [id]);
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /tasks/:id error:", err.message);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

module.exports = router;
