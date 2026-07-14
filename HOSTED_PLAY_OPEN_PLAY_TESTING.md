# Hosted Play — Open-Play Parity Testing Guide (Phases 1–5)

> Covers the features added on top of the V1 queue engine documented in
> `HOSTED_PLAY_QUEUE_TESTING.md`: real-time push, waitlist, winner-based rotation
> modes, skill-level gating, and the session-end leaderboard.
>
> Status tracker: several rows in `QUEUE_COURTPILOT_PARITY.md` are now stale
> (rotation modes, TV display, leaderboard, "up next", push notifications are
> now ✅ built) — update that doc separately if needed.

---

## Prerequisites

- Backend running: `cd backend && node server.js` → `http://localhost:3000`
- Frontend running: `cd frontend && npm start` → `http://localhost:4200`
- Local MongoDB (`MONGODB_URI` in root `.env` — confirm it points to a local/dev DB before creating test data)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` set in `.env` (required for push notifications)
- Test club: **SheServes Tennis Club** — `bookingProcess: hosted_play`, `hostedPlayQueueEnabled: true`, 94 player accounts
- Credentials: see `SHESERVES-CREDENTIALS.md` (admin `she-serves` + player logins) — not duplicated here
- **Two browser sessions** open side by side: one as the club admin, one as a player (use a second browser profile or an incognito window)
- Web push requires a secure context — use `http://localhost:4200`, not a LAN IP, or the service worker won't register

---

## ⚠️ One-time setup: enable the waitlist flag

Every existing club (including SheServes) predates the waitlist feature, so
`Club.hostedPlayWaitlistEnabled` is `undefined` (reads as **off**) even though new
clubs default to `true`. To test Phase 2, flip it on for SheServes first:

```js
// mongo shell / Compass
db.clubs.updateOne(
  { name: "SheServes Tennis Club" },
  { $set: { hostedPlayWaitlistEnabled: true } }
)
```

This is also a real production note: existing clubs need this same one-time
migration (or an admin-facing toggle) before ship.

---

## Phase 1 — Real-time board + "you're up" push

1. **Admin:** Admin → Hosted Play → New Session. Enable Queue Management fields
   (Number of Courts, Rotation Format = *First come, first served* for this
   phase), Max Players = 4, Fee = 0. Save.
2. **Player:** Hosted Play → open the session → **Join**.
3. **Player:** open the session's **live board**. When prompted, **allow browser
   notifications** (required once per browser/site).
4. **Admin:** open the **Check-In & Queue** board → check the player in (and 3
   more test players/walk-ins to fill a court) → **Start Queue**.
5. **Admin:** click **Finish** on the active court → confirm.

**Expected:**
- Player's live board updates **within ~6 seconds with no manual refresh**.
- When the player is moved onto a court, a browser notification **"You're up! 🎾
  Head to Court N"** arrives.
- A player entering the front of the waiting line (next group) gets an
  **"You're on deck ⏳"** notification once, not repeatedly on every poll.
- Walk-ins (no linked account) never receive a push.
- Admin console also auto-refreshes, but **pauses polling** while a modal, the
  assign panel, or a finish-confirm is open (so it never clobbers an in-progress action).

**DB spot-check:**
```js
db.hostedplayparticipants.find({ hostedPlayId: ObjectId("<id>") }, { queueStatus: 1, courtNumber: 1 })
```

---

## Phase 2 — Waitlist + auto-promotion

> Requires the one-time `hostedPlayWaitlistEnabled` flag above.

1. **Admin:** create (or reuse) a session with **Max Players = 1** (easiest way
   to force "full" quickly), Fee = 0.
2. **Player A:** Join → confirmed immediately (session now shows `full`).
3. **Player B:** Join the same session.

**Expected (free session):**
- Player B's card shows **"Join waitlist"** → after joining, a **"Waitlisted —
  position 1"** badge (not rejected outright).
4. **Player A:** Cancel their spot.

**Expected:**
- Player B is **auto-confirmed** (no action needed) and receives a **"You're
  in! 🎾"** push.
- `currentPlayers` back at cap; session flips back to `full`.

**Now repeat with a paid session** (Fee > 0):
5. Player A joins (with payment proof) and is approved by the admin. Player B
   joins the waitlist. Player A cancels.

**Expected (paid session):**
- Player B is **not** auto-charged. They get a **"A spot opened! 🎾"** push and
  their card shows **"Claim my spot"**.
- Tapping **Claim my spot** opens the payment modal ("Claim Your Spot" header)
  → submit payment proof → status becomes **pending approval**, same as a
  normal paid join.
- Admin **approves** the payment (Finance → Payments, or Charges) → participant
  activates; **reject** instead → the held spot is released and re-offered to
  the next waitlister.
- An unclaimed offer expires after **30 minutes** and passes to the next person
  in line (or check `offerExpiresAt` in the DB and fast-forward it for testing).

**DB spot-check:**
```js
db.hostedplayparticipants.find({ hostedPlayId: ObjectId("<id>") }, { waitStatus: 1, waitlistOrder: 1, offerExpiresAt: 1 })
```

---

## Phase 3 — Winner-tap scoring + Winner Stays / King of the Court

1. **Admin:** create a session with **Rotation Format = Winner stays** (or
   *King of the court*), 1 court, 4 players/court. Check in 6+ players, Start Queue.
2. **Admin:** on the active court, click **Finish**.

**Expected:**
- Instead of the old one-tap confirm, the court shows **"Tap the winning side,
  then Finish"** — each player becomes a tappable chip.
- Tap 2 players (trophy icon highlights) → **Finish (2 won)** button enables →
  confirm.
- Winning players **stay on the court**, split up to partner with the next 2 in
  line; losing players return to the back of the waiting queue.
- Player chips now show a running record, e.g. **`2W–1L`**.

**King of the court specific:** repeat the same win for the same pair 2–3 times
in a row — after the streak cap (default 3 consecutive holds), the winners are
**forced to rotate off** even though they won, freeing the court for others.

**Regression check:** a *First come, first served* session's Finish button
should still be the simple one-tap confirm (no winner selection required).

**DB spot-check:**
```js
db.hostedplayparticipants.find({ hostedPlayId: ObjectId("<id>") }, { wins: 1, losses: 1, courtStreak: 1 })
```

---

## Phase 4 — Skill levels + level-gated sessions

1. **Player:** go to Hosted Play → use the **skill level chips** (Novice /
   Intermediate / Advanced / Not set) near the top → pick **Novice**.
2. **Admin:** create a session with **Min Skill Level = Advanced**.
3. **Player (Novice):** try to **Join**.

**Expected:**
- Join is **blocked** with an error like *"This session is for advanced level
  and up."*
- A **level-band badge** (e.g. "Advanced+ level") shows on the session card.
4. **Player:** switch their chip to **Advanced** → retry Join.

**Expected:** join succeeds.

**Also test:** a session with no band set (Min/Max = "Any") should allow anyone
regardless of level, and a player with **no level set** should be blocked from
*any* banded session with a "set your level in your profile first" message.

**DB spot-check:**
```js
db.users.findOne({ username: "<player-username>" }, { skillLevel: 1 })
db.hostedplays.findOne({ _id: ObjectId("<id>") }, { minSkillLevel: 1, maxSkillLevel: 1 })
```

---

## Phase 5 — Session-end leaderboard

1. Using a Winner Stays/King of the Court session from Phase 3, play several
   more rounds (tap different winners each time) so multiple players
   accumulate wins/losses.
2. **Admin:** click **End Session**.

**Expected:**
- **Player live board:** a new **Standings** section appears, ranked by wins →
  fewest losses → games played, with a **"You finished #N of M — XW–YL"** note
  for the current player.
- **TV Display** (Admin → session → **TV Display** button): shows a dedicated
  **Final Standings** screen with medal styling for the top 3, replacing the
  live court/queue view once `queueStatus === 'ended'`.
- Players with 0 games played are excluded from the leaderboard.

---

## Quick REST reference (new/changed endpoints)

```bash
BASE="http://localhost:3000/api/hosted-play"
TOKEN="Bearer <token>"
ID="<session-id>"

# Finish a court with winners (winner_stays / king_of_court)
curl -X POST -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"winnerIds":["<pid1>","<pid2>"]}' $BASE/sessions/$ID/courts/1/finish

# Claim an offered waitlist spot (paid session)
curl -X POST -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"paymentMethod":"GCash","paymentScreenshot":"https://..."}' \
  $BASE/player/sessions/$ID/claim

# Set my skill level
curl -X PUT -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"skillLevel":"advanced"}' http://localhost:3000/api/users/<my-user-id>/profile

# Read board (now includes leaderboard + queueMode)
curl -H "Authorization: $TOKEN" $BASE/sessions/$ID/queue
```

---

## Known gaps (not built — safe to ignore in this pass)

- Computed/earned ratings (ELO) for Hosted Play — currently self-declared tiers only
- Matching modes (skill-separated / auto-balanced / mixed doubles / locked partners)
- Guest (non-member) waitlisting — members only for now
- Check-in cutoff auto-release of no-show confirmed spots (`checkInCutoffMinutes`
  field exists on the model but isn't enforced yet — ties into refund/billing)
- Multi-court "climbing" King of the Court (current implementation is
  per-court streak-cap, not cross-court promotion)

---

## Key files reference

| Layer | File |
|-------|------|
| Queue engine (modes, scoring, leaderboard) | `backend/services/queue-engine.js` |
| Waitlist promotion | `backend/utils/waitlist.js` |
| Push notifications | `backend/utils/push.js` |
| Session/participant models | `backend/models/HostedPlay.js`, `backend/models/HostedPlayParticipant.js` |
| User skill level | `backend/models/User.js` |
| API routes | `backend/routes/hosted-play.routes.js`, `backend/routes/charges.routes.js` (approve/reject), `backend/routes/users.routes.js` (profile) |
| Admin queue board | `frontend/src/app/features/admin/hosted-play/queue/hosted-play-queue.component.ts` |
| TV display | `frontend/src/app/features/admin/hosted-play/queue/hosted-play-queue-display.component.ts` |
| Player live board | `frontend/src/app/features/player/hosted-play/live-board.component.ts` |
| Player discovery + skill chips | `frontend/src/app/features/player/hosted-play/hosted-play.component.ts` |
| Data service | `frontend/src/app/core/services/hosted-play.service.ts` |
