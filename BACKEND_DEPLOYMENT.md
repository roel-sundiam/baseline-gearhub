# Backend Deployment Guide

## Architecture Overview

```
Angular Frontend (Netlify → courtgo.club)
        │
        ├── /api/*  → Netlify Functions (default)
        │            └── backend/app.js (serverless-http)
        │
        └── https://api.courtgo.club → Render (opt-in)
                                       └── backend/app.js (node server.js)

Both backends use the same Express app (backend/app.js) and MongoDB Atlas.
```

---

## Backend Options

| Backend | URL | When to Use |
|---|---|---|
| Netlify Functions | `/api` (relative) | Default — no extra setup |
| Render | `https://baseline-gearhub.onrender.com` | When you need always-on, independent scaling |
| Local Server | `http://localhost:3000` | Local development |

---

## Switching Backends

### Option 1 — Local Development (`proxy.conf.js`)

Controls where `http://localhost:4200` sends API calls. Edit `frontend/proxy.conf.js`:

**Connect to local backend (default):**
```js
target: 'http://localhost:3000',
secure: false,
// target: 'https://baseline-gearhub.onrender.com',  // commented out
// secure: true,
```

**Connect to Render:**
```js
// target: 'http://localhost:3000',  // commented out
// secure: false,
target: 'https://baseline-gearhub.onrender.com',
secure: true,
```

Restart `ng serve` after changing `proxy.conf.js` for the change to take effect.

---

### Option 2 — Netlify Production Deploy

**Netlify Functions (default):**
```bash
cd frontend
netlify deploy --prod
```
Netlify runs `npm run build` automatically from `netlify.toml`.

**Render:**
```bash
cd frontend
npm run build -- --configuration=render
netlify deploy --prod --dir=dist/frontend/browser
```
Build locally first with the render config, then deploy the pre-built files using `--dir` to skip the netlify.toml build step.

| Deploy target | Commands | API URL |
|---|---|---|
| Netlify Functions | `netlify deploy --prod` | `/api` → Netlify Functions |
| Render | `npm run build -- --configuration=render` → `netlify deploy --prod --dir=dist/frontend/browser` | `https://api.courtgo.club` |

---

## Local Development Setup

### Running with Local Backend (Netlify Functions mode)

**Terminal 1 — Start local Express server:**
```bash
node local-server.js
```

**Terminal 2 — Start Angular dev server:**
```bash
cd frontend
ng serve
```

Make sure `proxy.conf.js` target is `http://localhost:3000`.

---

### Running with Render Backend

**Terminal 1 — Start Angular dev server only (no local backend needed):**
```bash
cd frontend
ng serve
```

Make sure `proxy.conf.js` target is `https://baseline-gearhub.onrender.com`.

---

## Deploying to Render

**Service URL:** `https://baseline-gearhub.onrender.com`

**Render Settings:**
| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Health Check | `/api/health` |
| Auto-Deploy | On (triggers on git push to main) |

**Environment Variables (set in Render dashboard):**
| Key | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | JWT signing secret |
| `VAPID_PUBLIC_KEY` | Web push public key |
| `VAPID_PRIVATE_KEY` | Web push private key |
| `VAPID_EMAIL` | Web push contact email |

**Test the backend:**
```
https://baseline-gearhub.onrender.com/api/health
```
Expected: `{ "status": "ok", "db": "atlas", "dbHost": "MongoDB Atlas", "runtime": "render" }`

> **Note:** The free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Upgrade to Starter ($7/mo) for always-on.

---

## Deploying to Netlify Functions

Netlify Functions are always deployed automatically — no extra setup needed.

**Manual deploy:**
```bash
cd frontend && npm run build && cd .. && netlify deploy --prod
```

**Auto-deploy:** Push to `main` and Netlify builds and deploys automatically.

**Test the function:**
```
https://courtgo.club/api/health
```
Expected: `{ "status": "ok", "db": "atlas", "dbHost": "MongoDB Atlas", "runtime": "netlify" }`

---

## Superadmin Hero Badge

The `/admin/clubs` hero section shows two badges:

- **DB badge** — `Local DB · localhost:27017` or `Production DB · MongoDB Atlas`
- **Backend badge** — `Local Server`, `Netlify Functions`, or `Render`

These are detected automatically from the `/api/health` endpoint:
- `RENDER` env var (auto-set by Render) → shows **Render**
- `NETLIFY` env var (auto-set by Netlify) → shows **Netlify Functions**
- Neither → shows **Local Server**

---

## Environment Files Summary

| File | Used When | `apiUrl` |
|---|---|---|
| `environment.ts` | Local dev (`ng serve`) | `/api` → proxied via `proxy.conf.js` |
| `environment.prod.ts` | Netlify Functions deploy | `/api` → Netlify redirect |
| `environment.render.ts` | Render deploy (`BACKEND=render`) | `https://api.courtgo.club` |
| `environment.mobile.ts` | Mobile build | `https://api.courtgo.club` |
