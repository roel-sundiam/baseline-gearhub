# CourtGo — Render → Netlify Functions Switch: Investigation Notes

> **STATUS: fix identified 2026-07-21, netlify.toml corrected same day.** This is a record of
> the investigation, not a how-to guide — see `BACKEND_DEPLOYMENT.md` for the general
> architecture and day-to-day "how do I switch backends" instructions.

## What was wrong

The Netlify Functions backend already existed and was fully deployed and working — but the
live web app (courtgo.club) was never actually calling it. `netlify.toml`'s build command
forced the Angular `render` configuration:

```
command = "npm install && npm run build -- --configuration=render"
```

That configuration (`frontend/angular.json`) file-replaces `environment.ts` with
`environment.render.ts`, which hardcodes an **absolute** API URL:

```ts
apiUrl: 'https://baseline-gearhub.onrender.com/api'
```

So every deployed build of the web app baked in a direct call to Render, completely bypassing
the Netlify Function. The function itself (`frontend/netlify/functions/api.js`, a
`serverless-http` wrapper around `backend/app.js`) worked fine — it just had no traffic
reaching it from the web app.

## Why it was non-obvious

Two near-identical function wrapper files exist:

- `netlify/functions/api.js` (repo root)
- `frontend/netlify/functions/api.js` (inside `frontend/`)

Both have correct-looking relative `require('../../backend/app')` / `require('../../../backend/app')`
paths for their own location, so neither looks obviously wrong on inspection. Only one is
actually used: `netlify.toml` sets `base = "frontend"`, and Netlify resolves the `functions`
config path *relative to that base*, not the repo root — so `functions = "netlify/functions"`
actually means `frontend/netlify/functions/`. This was confirmed by reading Netlify CLI's
locally cached resolved config at `frontend/.netlify/netlify.toml`
(`functionsDirectory = ".../frontend/netlify/functions"`), which also revealed Netlify had
auto-attached an `@netlify/angular-runtime` build plugin not present in the repo's own
`netlify.toml` at all.

The root-level `netlify/functions/api.js` is believed to be an unused stale duplicate.

## The fix

Drop `--configuration=render` from the build command so Angular falls back to its
`defaultConfiguration: "production"` (`frontend/angular.json`), which uses
`environment.prod.ts` (`apiUrl: '/api'`, relative). Relative `/api/*` calls then hit the
redirect already present in `netlify.toml`:

```
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200
```

## Explicitly out of scope: the mobile app

`environment.mobile.ts` (Capacitor Android/iOS build) hardcodes
`apiUrl: 'https://api.courtgo.club'` — a separate build configuration entirely, unaffected by
this fix. That subdomain is presumed CNAME'd directly to the Render service. **Render must
keep running** to serve the mobile app; this fix only concerns the web app's default deploy
target. Retiring Render entirely would require a mobile app release repointing that URL first
— treated as a separate, future decision, not part of this fix.

## Why the backend was already serverless-ready

No architectural changes were needed on the backend to make this switch viable:

- **Auth**: stateless JWT (`backend/middleware/auth.js`), no `express-session` / server-side
  session store.
- **Real-time features**: Hosted Play's live queue/board (`hosted-play.service.ts`,
  `live-board.component.ts`, `hosted-play-queue-display.component.ts`) use HTTP polling via
  RxJS `interval()`, not WebSockets/Socket.IO — no persistent-connection dependency that
  Netlify Functions couldn't support.
- **Background work**: no cron jobs or `setInterval`-based loops in `backend/`.
  `backend/services/queue-engine.js` is pure functions over an in-memory snapshot passed in
  per-request — nothing running independently of a request.
- **File uploads**: none — profile images are stored as string fields (URL/base64) directly in
  MongoDB, no local disk writes.
- **DB connections**: `backend/app.js` already caches the Mongoose connection across
  invocations (`isConnected` / `connectingPromise` guard around `mongoose.connect()`), the
  standard pattern for reuse across warm Lambda containers.

## Verification used

- `netlify dev` locally → `GET /api/health` should return `"runtime": "netlify"` and
  `"db": "atlas"`.
- After deploy, `https://courtgo.club/api/health` → same check in production.
- Superadmin hero badge at `/admin/clubs` (documented in `BACKEND_DEPLOYMENT.md`) shows which
  backend is actually serving requests, detected from the `RENDER`/`NETLIFY` env vars Render
  and Netlify auto-set.

## Known watch items (not yet exercised)

- **Payload/timeout limits**: Netlify Functions have a response payload ceiling (~6MB, sync
  invocation) and a default execution timeout. Static analysis of all ~242 backend endpoints
  didn't turn up anything obviously long-running, but export/report-style endpoints
  (`analytics.routes.js`, `club-ledger.routes.js`, `ledger.routes.js`) weren't specifically
  load-tested against these limits.
- **Connection pooling under concurrency**: `mongoose.connect()` in `backend/app.js` doesn't
  set an explicit `maxPoolSize`. Under many concurrent Lambda invocations (each a separate
  container with its own pool), this could add up against the MongoDB Atlas tier's connection
  limit. Worth monitoring if traffic grows; not addressed by this fix.
