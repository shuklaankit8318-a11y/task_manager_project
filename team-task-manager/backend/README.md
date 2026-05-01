# Team Task Manager — Backend

Node.js + Express + PostgreSQL + JWT auth.

## Run locally

```bash
cp .env.example .env
# Edit .env — fill in DATABASE_URL and set JWT_SECRET
npm install
npm run dev       # uses node --watch (Node 18+)
```

The server starts on port `8080` by default (override with `PORT=`).  
On first start it auto-creates all tables — no separate migration needed.

## Test locally

```bash
# Health check
curl http://localhost:8080/api/healthz

# Create first user (auto-admin)
curl -X POST http://localhost:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret123","name":"Alice"}'
```

## Deploy to Railway

See [`../README.md`](../README.md) for full step-by-step instructions.

### Quick summary
1. Push this folder to GitHub.
2. Railway: **New Project → Deploy from GitHub repo**.
3. Add **PostgreSQL plugin** (auto-injects `DATABASE_URL`).
4. Set environment variables: `JWT_SECRET`, `CORS_ORIGIN`.
5. Railway runs `npm start` automatically — server is live.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (Railway injects this) |
| `JWT_SECRET` | Yes | Secret for signing JWTs — use a long random string |
| `CORS_ORIGIN` | Yes (prod) | Comma-separated allowed origins e.g. `https://your-app.vercel.app` |
| `PORT` | No | Defaults to `8080`; Railway sets this automatically |
