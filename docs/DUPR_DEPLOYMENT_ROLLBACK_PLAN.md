# DUPR Integration — Deployment & Rollback Plan

> Written 2026-07-27, before first production deploy of the DUPR integration
> (Phases A-D, commits `e6f781c`..`fb5273e` on `main`, plus the bundled multi-sport
> club registration feature). See `docs/DUPR_INTEGRATION_PLAN.md` for the feature
> design itself — this doc is only about the deploy/rollback mechanics.

## Rollback anchor

Last known-good production deploy, confirmed via `netlify api listSiteDeploys` immediately
before this push:

- **Deploy ID:** `6a62cf2f14599452ffcdd705`
- **Published:** 2026-07-24, `state: ready`, serving `courtgo.club`
- **Branch/commit:** `main` at `903b10b` ("Bound MongoDB connection pool size to fix Atlas
  connection-limit alert") — the tip of `origin/main` before any DUPR/multi-sport commits.
- **Site:** `baseline-gearhub` (site_id `5cb7218f-ec0a-471e-91a7-738a77f9f947`)

To restore it if something goes wrong:
- **Dashboard:** Netlify → Deploys tab → find this deploy → "Publish deploy".
- **CLI:** `netlify api restoreSiteDeploy --data '{"site_id":"5cb7218f-ec0a-471e-91a7-738a77f9f947","deploy_id":"6a62cf2f14599452ffcdd705"}'`

This is git-based continuous deployment (Netlify's GitHub integration) — pushing to `main`
triggers an automatic build + deploy of both the Angular frontend and the `backend/app.js`
Express app wrapped as a Netlify Function (`frontend/netlify/functions/api.js`).

## Why this deploy is lower-risk than it looks

- **Database is not a rollback concern.** Every DUPR-related schema change is additive:
  `Club.duprEnabled` (default `false`), `User.duprLink` (absent by default), and the new
  `DuprMatchSubmission` collection. Existing production documents simply won't have these
  fields. Rolling back the code doesn't require rolling back data — old code ignores fields
  it doesn't know about, and rolled-back code would simply stop reading the new ones.
- **DUPR is dormant by default even after deploy.** All DUPR code paths require
  `isDuprConfigured()` (needs `DUPR_CLIENT_KEY`/`DUPR_CLIENT_SECRET`/`DUPR_BASE_URL` set in
  Netlify's environment — **not yet added there**, only present in local `.env`) *and* a
  club's `duprEnabled` toggle. **Do not add the `DUPR_*` env vars to Netlify yet** — leaving
  them unset is itself a kill switch: the entire feature stays inert in production
  regardless of what ships in this deploy.
- **The 4 Hosted Play finish/correction hooks fail fast.** `duprSync.checkEligibility()`
  bails out on its first check (`!isDuprConfigured() || !club.duprEnabled`) before touching
  anything else, and the whole call is wrapped so it can never throw into the response. For
  every production club (all of them, until you deliberately configure one), this adds one
  boolean check to each finish-game call and nothing else.
- **Local test data never touched production.** All verification this session (real UAT
  match creation/deletion, linking/unlinking test users, toggling test clubs) ran against
  the local dev database (`mongodb://localhost:27017/...`), which is entirely separate from
  the production Atlas cluster (`mydb.zxr9i5k.mongodb.net`, per `.env.production.local`).

## What is *not* covered by a DUPR kill switch

The multi-sport club registration change (commit `e6f781c`) — a pre-existing feature from
before this session, not built or deeply audited here — is **not gated behind any flag**.
It changes the `/register-club` flow (adds a sport-picker step, requires `sport` on the
club-registration API) unconditionally the moment this deploys. If something's wrong there,
only a full rollback (see above) or a `git revert` fixes it — there's no toggle to flip off.
**This is the part of the deploy to watch most closely.**

## Rollback options, fastest to slowest

1. **Netlify instant rollback (primary — ~30 seconds, no rebuild, no data risk).**
   Re-publish deploy `6a62cf2f14599452ffcdd705` (see command above). Reverts frontend +
   functions atomically.
2. **Targeted kill switch (no rollback needed, DUPR-specific issues only).** Don't add
   `DUPR_*` env vars to Netlify, or flip a misbehaving club's `duprEnabled` back off via the
   superadmin UI. Everything else keeps running.
3. **Git-level revert (permanent — ~2-5 min rebuild).** `git revert` the offending commits
   on `main` and push again, so a future push can't reintroduce the same code. Use this if
   Netlify's instant rollback isn't enough (e.g. you want the bad code out of the pipeline
   entirely, not just off the live site).

## Suggested sequence

1. Push `main` → confirm the Netlify build succeeds and the new deploy goes `ready`.
2. Smoke-test on the live site: a real reservation, a Hosted Play finish-game, and the new
   `/register-club` flow (the ungated change).
3. Watch Netlify function logs for a few minutes for unexpected errors.
4. Leave `DUPR_*` env vars unset in Netlify until you're specifically ready to start testing
   DUPR live — that's a separate, deliberate step, not part of this deploy.
