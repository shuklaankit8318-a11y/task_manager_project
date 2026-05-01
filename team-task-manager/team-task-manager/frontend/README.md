# Team Task Manager — Frontend

Plain HTML + CSS + JavaScript. Zero build tools, zero dependencies.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The app shell |
| `styles.css` | All styles |
| `main.js` | All client logic (routing, API calls, rendering) |
| `config.js` | Sets `window.API_BASE` — **edit this before deploying** |
| `vercel.json` | Vercel configuration |

## Run locally

No build step. Just open `index.html` in a browser or serve the folder:

```bash
npx serve .
# or
npx http-server . -p 5173
```

Make sure `config.js` points at your local backend:
```js
window.API_BASE = "http://localhost:8080/api";
```

## Deploy to Vercel

1. Edit `config.js` — set your Railway backend URL:
   ```js
   window.API_BASE = "https://your-service.up.railway.app/api";
   ```

2. Push this folder to GitHub.

3. In Vercel: **New Project → Import Git Repository**.
   - Framework Preset: **Other**
   - Build Command: *(leave empty)*
   - Output Directory: *(leave empty)*

4. Click **Deploy**.

5. Copy the Vercel URL and add it to your Railway service's `CORS_ORIGIN` variable.

See [`../README.md`](../README.md) for the full step-by-step guide.
