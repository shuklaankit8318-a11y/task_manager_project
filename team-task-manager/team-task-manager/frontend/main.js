// Team Task Manager — vanilla JS single-page app

const API_BASE = (window.API_BASE || "/api").replace(//$/, "");
const TOKEN_KEY = "ttm_token";
const USER_KEY = "ttm_user";

// ---------- Auth state ----------
const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  login(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isAdmin() {
    return this.user?.role === "admin";
  },
};

// ---------- API client ----------
async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (auth.token) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    auth.logout();
    location.hash = "#/login";
    throw new Error("Session expired. Please log in again.");
  }
  let data = null;
  if (res.status !== 204) {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

// ---------- Utilities ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "value") {
      node.value = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }
  return node;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeForInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "completed") return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

function statusBadge(status, overdue = false) {
  if (overdue) {
    return `<span class="status-badge overdue">Overdue</span>`;
  }
  return `<span class="status-badge ${status}">${STATUS_LABELS[status] || status}</span>`;
}

// ---------- Toast ----------
let toastTimer = null;
function toast(message, kind = "info") {
  const t = document.getElementById("toast");
  t.textContent = message;
  t.className = `toast ${kind === "error" ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add("hidden");
  }, 2800);
}

// ---------- Modal ----------
function showModal(title, contentNode, { onClose } = {}) {
  closeModal();
  const backdrop = el(
    "div",
    { class: "modal-backdrop", id: "modal-backdrop" },
    el(
      "div",
      {
        class: "modal",
        onclick: (e) => e.stopPropagation(),
      },
      el("h2", {}, title),
      contentNode,
    ),
  );
  backdrop.addEventListener("click", () => {
    closeModal();
    if (onClose) onClose();
  });
  document.body.appendChild(backdrop);
}

function closeModal() {
  const existing = document.getElementById("modal-backdrop");
  if (existing) existing.remove();
}

// ---------- Header ----------
function renderHeader() {
  const header = document.getElementById("appHeader");
  const user = auth.user;
  if (!user) {
    header.classList.add("hidden");
    return;
  }
  header.classList.remove("hidden");
  const badge = document.getElementById("userBadge");
  badge.innerHTML = `<strong>${escapeHtml(user.name)}</strong><span class="role-pill ${user.role === "admin" ? "" : "member"}">${escapeHtml(user.role)}</span>`;

  // Mark active nav
  const path = (location.hash || "#/dashboard").replace("#/", "").split("/")[0];
  document.querySelectorAll("header nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === path);
  });
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.logout();
  location.hash = "#/login";
});

// ---------- Pages ----------
const app = document.getElementById("app");

function showLoading() {
  app.innerHTML = "";
  app.appendChild(el("div", { class: "loading" }, "Loading..."));
}

function showError(message) {
  app.innerHTML = "";
  app.appendChild(el("div", { class: "form-error" }, message));
}

// --- LOGIN ---
function renderLogin() {
  document.getElementById("appHeader").classList.add("hidden");
  app.innerHTML = "";
  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const email = form.querySelector("[name=email]").value;
        const password = form.querySelector("[name=password]").value;
        const submitBtn = form.querySelector("button[type=submit]");
        const errBox = form.querySelector(".form-error");
        errBox.classList.add("hidden");
        submitBtn.disabled = true;
        try {
          const result = await api("/auth/login", {
            method: "POST",
            body: { email, password },
          });
          auth.login(result.token, result.user);
          toast(`Welcome back, ${result.user.name}`);
          location.hash = "#/dashboard";
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove("hidden");
        } finally {
          submitBtn.disabled = false;
        }
      },
    },
    el("div", { class: "form-error hidden" }),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Email"),
      el("input", {
        type: "email",
        name: "email",
        required: "true",
        autocomplete: "email",
      }),
    ),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Password"),
      el("input", {
        type: "password",
        name: "password",
        required: "true",
        autocomplete: "current-password",
      }),
    ),
    el(
      "button",
      { type: "submit", class: "btn btn-primary btn-block" },
      "Sign in",
    ),
  );

  app.appendChild(
    el(
      "div",
      { class: "auth-shell" },
      el("h1", {}, "Sign in"),
      el("p", { class: "subtitle" }, "Welcome back to Team Task Manager."),
      form,
      el(
        "p",
        { class: "auth-switch" },
        "Don't have an account? ",
        el("a", { href: "#/signup" }, "Create one"),
      ),
    ),
  );
}

// --- SIGNUP ---
function renderSignup() {
  document.getElementById("appHeader").classList.add("hidden");
  app.innerHTML = "";
  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const name = form.querySelector("[name=name]").value;
        const email = form.querySelector("[name=email]").value;
        const password = form.querySelector("[name=password]").value;
        const role = form.querySelector("[name=role]").value;
        const submitBtn = form.querySelector("button[type=submit]");
        const errBox = form.querySelector(".form-error");
        errBox.classList.add("hidden");
        submitBtn.disabled = true;
        try {
          const result = await api("/auth/signup", {
            method: "POST",
            body: { name, email, password, role },
          });
          auth.login(result.token, result.user);
          toast(`Account created. Welcome, ${result.user.name}`);
          location.hash = "#/dashboard";
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove("hidden");
        } finally {
          submitBtn.disabled = false;
        }
      },
    },
    el("div", { class: "form-error hidden" }),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Full name"),
      el("input", { type: "text", name: "name", required: "true" }),
    ),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Email"),
      el("input", {
        type: "email",
        name: "email",
        required: "true",
        autocomplete: "email",
      }),
    ),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Password"),
      el("input", {
        type: "password",
        name: "password",
        required: "true",
        minlength: "6",
        autocomplete: "new-password",
      }),
    ),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Role"),
      el(
        "select",
        { name: "role" },
        el("option", { value: "member" }, "Member — view assigned tasks"),
        el("option", { value: "admin" }, "Admin — create projects, assign tasks"),
      ),
    ),
    el(
      "p",
      { class: "form-help" },
      "Tip: the very first user always becomes admin automatically.",
    ),
    el(
      "button",
      { type: "submit", class: "btn btn-primary btn-block" },
      "Create account",
    ),
  );

  app.appendChild(
    el(
      "div",
      { class: "auth-shell" },
      el("h1", {}, "Create account"),
      el("p", { class: "subtitle" }, "Start managing your team's work."),
      form,
      el(
        "p",
        { class: "auth-switch" },
        "Already have an account? ",
        el("a", { href: "#/login" }, "Sign in"),
      ),
    ),
  );
}

// --- DASHBOARD ---
async function renderDashboard() {
  showLoading();
  renderHeader();
  let tasks = [];
  try {
    tasks = await api("/tasks");
  } catch (err) {
    showError(err.message);
    return;
  }

  const counts = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter(isOverdue).length,
  };

  app.innerHTML = "";
  app.appendChild(
    el(
      "div",
      { class: "page-header" },
      el(
        "div",
        {},
        el("h1", {}, auth.isAdmin() ? "Team dashboard" : "My tasks"),
        el(
          "p",
          {},
          auth.isAdmin()
            ? "All tasks across every project."
            : "Tasks assigned to you across all projects.",
        ),
      ),
    ),
  );

  app.appendChild(
    el(
      "div",
      { class: "stats-row" },
      statCard("Total", counts.total),
      statCard("Pending", counts.pending),
      statCard("In progress", counts.in_progress),
      statCard("Completed", counts.completed),
      statCard("Overdue", counts.overdue, counts.overdue > 0),
    ),
  );

  // Filter bar
  const filterState = { status: "all" };
  const listContainer = el("div");
  const filterBar = el(
    "div",
    { class: "filter-bar" },
    ...["all", "pending", "in_progress", "completed", "overdue"].map((key) =>
      el(
        "button",
        {
          class: filterState.status === key ? "active" : "",
          onclick: (e) => {
            filterState.status = key;
            filterBar
              .querySelectorAll("button")
              .forEach((b) => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            redraw();
          },
        },
        key === "all"
          ? "All"
          : key === "overdue"
            ? "Overdue"
            : STATUS_LABELS[key],
      ),
    ),
  );
  app.appendChild(filterBar);
  app.appendChild(listContainer);

  function redraw() {
    let visible = tasks;
    if (filterState.status === "overdue") {
      visible = tasks.filter(isOverdue);
    } else if (filterState.status !== "all") {
      visible = tasks.filter((t) => t.status === filterState.status);
    }

    listContainer.innerHTML = "";
    if (visible.length === 0) {
      listContainer.appendChild(
        el(
          "div",
          { class: "empty-state" },
          el("h3", {}, "No tasks here"),
          el(
            "p",
            {},
            tasks.length === 0
              ? auth.isAdmin()
                ? "Create a project and add some tasks to get started."
                : "Tasks assigned to you will show up here."
              : "Try a different filter.",
          ),
        ),
      );
      return;
    }
    listContainer.appendChild(taskListView(visible, { showProject: true }));
  }
  redraw();
}

function statCard(label, value, danger = false) {
  return el(
    "div",
    { class: `stat-card ${danger ? "danger" : ""}` },
    el("div", { class: "label" }, label),
    el("div", { class: "value" }, String(value)),
  );
}

// Renders a list of tasks. The current user can update status of their own
// tasks via the inline select. Admins can update any task.
function taskListView(tasks, { showProject = false } = {}) {
  const container = el("div", { class: "task-list" });
  tasks.forEach((task) => {
    const overdue = isOverdue(task);
    const canEditStatus =
      auth.isAdmin() || task.assigneeId === auth.user.id;

    const statusCell = canEditStatus
      ? el(
          "select",
          {
            class: "status-select",
            "data-task-id": task.id,
            value: task.status,
            onchange: async (e) => {
              const newStatus = e.target.value;
              try {
                await api(`/tasks/${task.id}`, {
                  method: "PATCH",
                  body: { status: newStatus },
                });
                toast("Task updated");
                // Re-render current page
                router();
              } catch (err) {
                toast(err.message, "error");
                e.target.value = task.status;
              }
            },
          },
          el(
            "option",
            { value: "pending", selected: task.status === "pending" },
            "Pending",
          ),
          el(
            "option",
            {
              value: "in_progress",
              selected: task.status === "in_progress",
            },
            "In Progress",
          ),
          el(
            "option",
            { value: "completed", selected: task.status === "completed" },
            "Completed",
          ),
        )
      : el("span", { html: statusBadge(task.status) });

    const titleNode = el(
      "div",
      { class: "task-title" },
      task.title,
      showProject && task.projectName
        ? el(
            "a",
            {
              class: "project-link",
              href: `#/projects/${task.projectId}`,
            },
            task.projectName,
          )
        : null,
    );

    const dueCell = el(
      "div",
      { class: `task-meta ${overdue ? "overdue-text" : ""}` },
      task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date",
    );

    const assigneeCell = el(
      "div",
      { class: "task-meta" },
      task.assigneeName ? task.assigneeName : "Unassigned",
    );

    const overdueBadge = overdue
      ? el("span", { html: statusBadge(task.status, true) })
      : el("span", {});

    const adminActions = auth.isAdmin()
      ? el(
          "button",
          {
            class: "btn btn-ghost btn-sm",
            onclick: async () => {
              if (!confirm(`Delete task "${task.title}"?`)) return;
              try {
                await api(`/tasks/${task.id}`, { method: "DELETE" });
                toast("Task deleted");
                router();
              } catch (err) {
                toast(err.message, "error");
              }
            },
          },
          "Delete",
        )
      : el("span", {});

    container.appendChild(
      el(
        "div",
        { class: `task-row ${overdue ? "overdue" : ""}` },
        titleNode,
        assigneeCell,
        dueCell,
        overdue ? overdueBadge : statusCell,
        adminActions,
      ),
    );
  });
  return container;
}

// --- PROJECTS LIST ---
async function renderProjects() {
  showLoading();
  renderHeader();
  let projects = [];
  try {
    projects = await api("/projects");
  } catch (err) {
    showError(err.message);
    return;
  }
  app.innerHTML = "";
  app.appendChild(
    el(
      "div",
      { class: "page-header" },
      el(
        "div",
        {},
        el("h1", {}, "Projects"),
        el(
          "p",
          {},
          auth.isAdmin()
            ? "Create projects and assign team members."
            : "Projects you're a member of.",
        ),
      ),
      auth.isAdmin()
        ? el(
            "button",
            {
              class: "btn btn-primary",
              onclick: () => openCreateProjectModal(),
            },
            "+ New project",
          )
        : null,
    ),
  );

  if (projects.length === 0) {
    app.appendChild(
      el(
        "div",
        { class: "empty-state" },
        el("h3", {}, "No projects yet"),
        el(
          "p",
          {},
          auth.isAdmin()
            ? "Create your first project to start adding tasks."
            : "An admin will need to add you to a project.",
        ),
        auth.isAdmin()
          ? el(
              "button",
              {
                class: "btn btn-primary",
                onclick: () => openCreateProjectModal(),
              },
              "+ New project",
            )
          : null,
      ),
    );
    return;
  }

  const grid = el("div", { class: "card-grid" });
  projects.forEach((p) => {
    grid.appendChild(
      el(
        "div",
        {
          class: "card project-card",
          style: "cursor:pointer",
          onclick: () => {
            location.hash = `#/projects/${p.id}`;
          },
        },
        el("h3", {}, p.name),
        el("p", {}, p.description || "No description"),
        el(
          "div",
          { class: "meta" },
          el("span", {}, `Created ${formatDate(p.createdAt)}`),
          el("span", {}, "View →"),
        ),
      ),
    );
  });
  app.appendChild(grid);
}

function openCreateProjectModal() {
  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const name = form.querySelector("[name=name]").value.trim();
        const description = form
          .querySelector("[name=description]")
          .value.trim();
        const errBox = form.querySelector(".form-error");
        const submitBtn = form.querySelector("button[type=submit]");
        errBox.classList.add("hidden");
        submitBtn.disabled = true;
        try {
          const created = await api("/projects", {
            method: "POST",
            body: { name, description: description || null },
          });
          closeModal();
          toast("Project created");
          location.hash = `#/projects/${created.id}`;
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove("hidden");
          submitBtn.disabled = false;
        }
      },
    },
    el("div", { class: "form-error hidden" }),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Project name"),
      el("input", { type: "text", name: "name", required: "true" }),
    ),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Description (optional)"),
      el("textarea", { name: "description" }),
    ),
    el(
      "div",
      { class: "modal-actions" },
      el(
        "button",
        { type: "button", class: "btn btn-ghost", onclick: closeModal },
        "Cancel",
      ),
      el("button", { type: "submit", class: "btn btn-primary" }, "Create"),
    ),
  );
  showModal("New project", form);
}

// --- PROJECT DETAIL ---
async function renderProject(projectId) {
  showLoading();
  renderHeader();
  let project, tasks, allUsers;
  try {
    [project, tasks] = await Promise.all([
      api(`/projects/${projectId}`),
      api(`/projects/${projectId}/tasks`),
    ]);
    if (auth.isAdmin()) {
      allUsers = await api("/users");
    } else {
      allUsers = [];
    }
  } catch (err) {
    showError(err.message);
    return;
  }

  app.innerHTML = "";
  app.appendChild(
    el(
      "div",
      { class: "page-header" },
      el(
        "div",
        {},
        el(
          "p",
          { class: "" },
          el("a", { href: "#/projects" }, "← Back to projects"),
        ),
        el("h1", {}, project.name),
        el("p", {}, project.description || "No description"),
      ),
      auth.isAdmin()
        ? el(
            "div",
            { style: "display:flex; gap:8px;" },
            el(
              "button",
              {
                class: "btn btn-primary",
                onclick: () => openCreateTaskModal(project),
              },
              "+ New task",
            ),
            project.ownerId === auth.user.id
              ? el(
                  "button",
                  {
                    class: "btn btn-danger",
                    onclick: async () => {
                      if (
                        !confirm(
                          `Delete project "${project.name}" and all its tasks?`,
                        )
                      )
                        return;
                      try {
                        await api(`/projects/${projectId}`, {
                          method: "DELETE",
                        });
                        toast("Project deleted");
                        location.hash = "#/projects";
                      } catch (err) {
                        toast(err.message, "error");
                      }
                    },
                  },
                  "Delete project",
                )
              : null,
          )
        : null,
    ),
  );

  // Two-column grid: tasks on the left, members on the right
  const left = el("div");
  const right = el("div");

  // --- Tasks section ---
  left.appendChild(
    el(
      "div",
      { class: "section" },
      el("h2", {}, "Tasks"),
      tasks.length > 0
        ? taskListView(tasks)
        : el(
            "div",
            { class: "empty-state" },
            el("h3", {}, "No tasks yet"),
            el(
              "p",
              {},
              auth.isAdmin()
                ? "Add the first task for this project."
                : "Tasks will appear here once an admin creates them.",
            ),
          ),
    ),
  );

  // --- Members section ---
  const membersList = el("ul", { class: "member-list" });
  project.members.forEach((m) => {
    const isOwner = m.userId === project.ownerId;
    const removeBtn =
      auth.isAdmin() && !isOwner
        ? el(
            "button",
            {
              class: "remove-btn",
              onclick: async () => {
                if (!confirm(`Remove ${m.name} from this project?`)) return;
                try {
                  await api(`/projects/${projectId}/members/${m.userId}`, {
                    method: "DELETE",
                  });
                  toast("Member removed");
                  renderProject(projectId);
                } catch (err) {
                  toast(err.message, "error");
                }
              },
            },
            "Remove",
          )
        : null;

    membersList.appendChild(
      el(
        "li",
        {},
        el(
          "div",
          {},
          el("div", { style: "font-weight: 500;" }, m.name),
          el(
            "div",
            { style: "color: var(--muted); font-size: 12px;" },
            m.email,
            isOwner ? " · Owner" : "",
          ),
        ),
        removeBtn,
      ),
    );
  });

  right.appendChild(
    el(
      "div",
      { class: "section" },
      el("h2", {}, `Members (${project.members.length})`),
      membersList,
      auth.isAdmin()
        ? renderAddMemberControls(project, allUsers, projectId)
        : null,
    ),
  );

  app.appendChild(el("div", { class: "project-grid" }, left, right));
}

function renderAddMemberControls(project, allUsers, projectId) {
  const memberIds = new Set(project.members.map((m) => m.userId));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));
  if (candidates.length === 0) {
    return el(
      "p",
      {
        style: "color: var(--muted); font-size: 12px; margin-top: 8px;",
      },
      "Everyone is already a member.",
    );
  }
  const select = el(
    "select",
    { id: "addMemberSelect" },
    el("option", { value: "" }, "Choose a user..."),
    ...candidates.map((u) =>
      el(
        "option",
        { value: u.id },
        `${u.name} (${u.email})${u.role === "admin" ? " — admin" : ""}`,
      ),
    ),
  );
  return el(
    "div",
    { class: "field", style: "margin-top: 12px;" },
    el("label", {}, "Add member"),
    select,
    el(
      "button",
      {
        class: "btn btn-sm",
        style: "margin-top: 8px;",
        onclick: async () => {
          const userId = select.value;
          if (!userId) return;
          try {
            await api(`/projects/${projectId}/members`, {
              method: "POST",
              body: { userId },
            });
            toast("Member added");
            renderProject(projectId);
          } catch (err) {
            toast(err.message, "error");
          }
        },
      },
      "Add to project",
    ),
  );
}

function openCreateTaskModal(project) {
  const memberOptions = [
    el("option", { value: "" }, "Unassigned"),
    ...project.members.map((m) =>
      el("option", { value: m.userId }, `${m.name} (${m.email})`),
    ),
  ];

  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const title = form.querySelector("[name=title]").value.trim();
        const description = form
          .querySelector("[name=description]")
          .value.trim();
        const assigneeId = form.querySelector("[name=assigneeId]").value;
        const dueDate = form.querySelector("[name=dueDate]").value;
        const errBox = form.querySelector(".form-error");
        const submitBtn = form.querySelector("button[type=submit]");
        errBox.classList.add("hidden");
        submitBtn.disabled = true;
        try {
          await api(`/projects/${project.id}/tasks`, {
            method: "POST",
            body: {
              title,
              description: description || null,
              assigneeId: assigneeId || null,
              dueDate: dueDate || null,
            },
          });
          closeModal();
          toast("Task created");
          renderProject(project.id);
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove("hidden");
          submitBtn.disabled = false;
        }
      },
    },
    el("div", { class: "form-error hidden" }),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Title"),
      el("input", { type: "text", name: "title", required: "true" }),
    ),
    el(
      "div",
      { class: "field" },
      el("label", {}, "Description (optional)"),
      el("textarea", { name: "description" }),
    ),
    el(
      "div",
      { class: "field-row" },
      el(
        "div",
        { class: "field" },
        el("label", {}, "Assign to"),
        el("select", { name: "assigneeId" }, ...memberOptions),
      ),
      el(
        "div",
        { class: "field" },
        el("label", {}, "Due date"),
        el("input", { type: "date", name: "dueDate" }),
      ),
    ),
    el(
      "div",
      { class: "modal-actions" },
      el(
        "button",
        { type: "button", class: "btn btn-ghost", onclick: closeModal },
        "Cancel",
      ),
      el("button", { type: "submit", class: "btn btn-primary" }, "Create task"),
    ),
  );
  showModal("New task", form);
}

// ---------- Router ----------
function router() {
  closeModal();
  const hash = location.hash || "#/dashboard";
  const parts = hash.replace(/^#\//, "").split("/");
  const route = parts[0] || "dashboard";

  if (!auth.token) {
    if (route === "signup") {
      renderSignup();
    } else {
      renderLogin();
    }
    return;
  }

  switch (route) {
    case "login":
    case "signup":
      // Already logged in
      location.hash = "#/dashboard";
      return;
    case "dashboard":
      renderDashboard();
      break;
    case "projects":
      if (parts[1]) {
        renderProject(parts[1]);
      } else {
        renderProjects();
      }
      break;
    default:
      renderDashboard();
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

// Run immediately too (Vite may have already fired DOMContentLoaded)
router();
