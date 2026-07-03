# Queue Management — CourtPilot Feature Parity Reference

> Last updated: 2026-07-02
> Purpose: Track which CourtPilot features are built, partial, or missing in our Hosted Play Queue system.

---

## 1. Manages the Player Queue

| CourtPilot Feature | Status | Notes |
|--------------------|--------|-------|
| Add players individually | ✅ Built | Walk-in add + per-player check-in |
| Import / bulk player list | ❌ Missing | No CSV or bulk import |
| Save regular players for faster check-in | ⚠️ Partial | Club members are pre-registered; walk-ins must be typed each session |
| Track **waiting** players | ✅ Built | `queueStatus: 'waiting'` |
| Track **holding** players | ✅ Built | `queueStatus: 'paused'` (labelled "Paused" in UI) |
| Track **returned** players | ✅ Built | Requeued automatically via `finishGame()` |
| Track **active** players | ✅ Built | `queueStatus: 'playing'` |

---

## 2. Automatically Creates Games

| CourtPilot Feature | Status | Notes |
|--------------------|--------|-------|
| Forms doubles (2v2) | ✅ Built | `playersPerCourt = 4` default |
| Forms singles (1v1) | ✅ Built | Configurable `playersPerCourt` |
| Skill-Based queue mode | ❌ Missing | Schema field `skill_rotation` exists; engine stub present — UI not exposed |
| Casual queue mode | ❌ Missing | No distinction exposed in UI |
| Competitive queue mode | ❌ Missing | Schema field `king_of_court` exists; engine stub present — UI not exposed |
| Win-Win / Lose-Lose rotation | ❌ Missing | `winner_stays` placeholder exists; not implemented |
| Staff manual group adjustment | ✅ Built | `manualAssign` endpoint + Admin Queue Board UI |

---

## 3. Runs Court Sessions

| CourtPilot Feature | Status | Notes |
|--------------------|--------|-------|
| Start games | ✅ Built | `POST /queue/start` → seeds queue + auto-fills courts |
| Finish games | ✅ Built | `POST /courts/:n/finish` → requeues players + fills empty courts |
| Track occupied courts | ✅ Built | `courtNumber` field on participant; `buildBoard()` projection |
| Return players to queue after match | ✅ Built | `finishGame()` in `queue-engine.js` |
| Game timers / countdowns | ❌ Missing | Timestamps stored (`lastGameEndedAt`) but no countdown or auto-rotation |

---

## 4. Live Player Board

| CourtPilot Feature | Status | Notes |
|--------------------|--------|-------|
| Show active courts | ✅ Built | Admin queue board + player live-board |
| Show current games (players per court) | ✅ Built | Player chips per court card |
| Show upcoming groups ("up next") | ⚠️ Partial | `nextGroup` is in `buildBoard()` output but **not rendered** in `live-board.component.ts` |
| Show queue status counts | ✅ Built | Stats strip: playing / waiting / active games |
| TV / projector / kiosk display mode | ❌ Missing | No fullscreen or broadcast view |
| Shareable public link (no login required) | ❌ Missing | Live board requires member login; no public token-based URL |

---

## 5. Analytics and Reports

| CourtPilot Feature | Status | Notes |
|--------------------|--------|-------|
| Average wait times | ❌ Missing | `enteredQueueAt` + `lastGameEndedAt` timestamps exist — calculation not built |
| Court utilization | ❌ Missing | Not tracked or displayed |
| Number of games played | ✅ Built | Per-player `gamesPlayed`; session `totalGamesPlayed` in summary |
| Session summaries | ⚠️ Partial | `summary` object written on `endQueue()` but never displayed in UI |
| Competitive leaderboards | ❌ Missing | Not implemented |

---

## 6. Works Offline

| CourtPilot Feature | Status | Notes |
|--------------------|--------|-------|
| Run without internet after activation | ❌ Missing | No service worker; all state is server-side |
| Data stored locally | ❌ Missing | No IndexedDB or local cache |
| Export data for reporting | ❌ Missing | No CSV / PDF export endpoints |

---

## Summary

### What We Have — Core Engine is Solid
- Full player lifecycle: `check-in → waiting → playing → requeued → done`
- Manual assignment, skip, pause/resume, remove
- Walk-in support with automatic cash fee recording
- Admin queue control board: court cards, waiting list, paused list, check-in panel
- Player live board: my status, courts view, waiting queue, paused list
- Fee and billing integration (base fee + convenience fee)

---

## Missing Features — Prioritized

### High Impact
| # | Feature | Effort | Why It Matters |
|---|---------|--------|----------------|
| 1 | **Game timers** — countdown per court visible to staff and players | Medium | Core parity; admins can't track game length |
| 2 | **TV / public display board** — unauthenticated shareable URL, kiosk/fullscreen | Medium | Players can self-serve without asking front desk |
| 3 | **Queue rotation modes** — expose skill-based / competitive / win-win in UI | Medium | Backend stubs already exist; just needs UI wiring |
| 4 | **Session analytics display** — show summary + wait-time + court utilization | Low–Medium | Data is already collected; mostly a UI task |

### Medium Impact
| # | Feature | Effort | Why It Matters |
|---|---------|--------|----------------|
| 5 | **Estimated wait time** | Low | Easy win from avg game duration × position |
| 6 | **"Up next" group preview** on live board | Low | `nextGroup` already in `buildBoard()` — just render it |
| 7 | **Export / reports** — CSV download of attendance, revenue, games played | Medium | Venue management need |
| 8 | **Leaderboard** — rank players by games played per session / across sessions | Medium | Engagement feature for competitive players |

### Low / Deferred
| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| 9 | **Offline mode** | High | Service worker + IndexedDB; niche for stable venues |
| 10 | **Bulk / CSV player import** | Low–Medium | Nice to have for large clubs |
| 11 | **Push/sound notifications** ("you're up next") | Medium | Web Push API already wired; needs player-side prompt |

---

## Key Files Reference

| Layer | File |
|-------|------|
| Queue engine | `backend/services/queue-engine.js` |
| Session model | `backend/models/HostedPlay.js` |
| Participant model | `backend/models/HostedPlayParticipant.js` |
| API routes | `backend/routes/hosted-play.routes.js` |
| Reset script (dev) | `backend/scripts/reset-queue.js` |
| Admin queue board | `frontend/src/app/features/admin/hosted-play/queue/hosted-play-queue.component.ts` |
| Player live board | `frontend/src/app/features/player/hosted-play/live-board.component.ts` |
| Data service | `frontend/src/app/core/services/hosted-play.service.ts` |
