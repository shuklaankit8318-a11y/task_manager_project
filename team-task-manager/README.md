# Team Task Manager — Deployment Bundle

Two folders, two deployments:

| Folder | Deploy to | Stack |
|--------|-----------|-------|
| `backend/` | Railway | Node.js + Express + PostgreSQL + JWT |
| `frontend/` | Vercel | Plain HTML + CSS + JS (no build step) |

---

## Step 1 — Deploy backend to Railway

1. Push **`backend/`** to a new GitHub repo (or use the whole bundle and set
   Root Directory = `backend` in Railway).

2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.

3. Pick your repo. Railway will detect `package.json` and run `npm start` automatically.

4. Click **+ New** → **Database → Add PostgreSQL**.
   Railway will inject `DATABASE_URL` into your service automatically.

5. In your service → **Variables**, add:

   | Variable | Value |
   |----------|-------|
   | `JWT_SECRET` | Long random string (run: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `CORS_ORIGIN` | Your Vercel URL (e.g. `https://your-app.vercel.app`) — add this after Step 2 |

6. Railway will build and start the server. Open the generated URL and check:
   ```
   https://your-service.up.railway.app/api/healthz
   ```
   You should see `{"ok":true}`.

---

## Step 2 — Deploy frontend to Vercel

1. Edit **`frontend/config.js`** and replace the placeholder with your Railway URL:
   ```js
   window.API_BASE = "https://your-service.up.railway.app/api";
   ```

2. Push **`frontend/`** to a new GitHub repo (or the whole bundle with Root Directory = `frontend`).

3. Go to [vercel.com](https://vercel.com) → **New Project → Import Git Repository**.
   - **Framework Preset:** Other
   - **Build Command:** *(leave empty)*
   - **Output Directory:** *(leave empty)*

4. Click **Deploy**. You'll get a URL like `https://your-app.vercel.app`.

5. Go back to **Railway** → your service → **Variables** and set:
   ```
   CORS_ORIGIN = https://your-app.vercel.app
   ```
   Then redeploy (Railway redeploys automatically when variables change).

---

## Step 3 — Open the app

Visit your Vercel URL. The first person to sign up automatically becomes **admin**.

---

## API Reference

All routes are under `/api`:

```
POST   /api/auth/signup              { email, password, name, role? }
POST   /api/auth/login               { email, password }
GET    /api/auth/me
GET    /api/users
GET    /api/projects
POST   /api/projects                 admin only
GET    /api/projects/:id
DELETE /api/projects/:id             admin + owner only
POST   /api/projects/:id/members     { userId }  admin only
DELETE /api/projects/:id/members/:userId          admin only
GET    /api/projects/:id/tasks
POST   /api/projects/:id/tasks       admin only
GET    /api/tasks?status=&projectId=&assignee=me
PATCH  /api/tasks/:id                members can only set status on their own tasks
DELETE /api/tasks/:id                admin only
```
