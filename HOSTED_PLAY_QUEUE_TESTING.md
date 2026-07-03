# Hosted Play Queue Management — Testing Guide

## Prerequisites

- MongoDB running locally (or connection string set in `.env`)
- A superadmin account
- A club admin account for a club with `bookingProcess: "hosted_play"`
- 8+ player test accounts

---

## 1. Start the servers

**Terminal 1 — Backend**
```bash
cd backend
npm start
```

**Terminal 2 — Frontend**
```bash
cd frontend
ng serve
```

Wait until `ng serve` reports `Application bundle generation complete` before opening the browser.

---

## 2. Confirm default state (queue OFF)

1. Log in as **superadmin** → Admin → Clubs → select the hosted-play club
2. In the Booking Process card, confirm booking process is `Hosted Play`
3. There should be no "Queue Management" toggle yet if the DB flag is still `false`
4. Log in as **club admin** → Admin → Hosted Play
5. Confirm there is **no "Check-In & Queue" button** on any session card
6. Verify the endpoint returns 403:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/hosted-play/sessions/<any-id>/queue
# Expected: 403 Forbidden
```

---

## 3. Enable Queue Management (superadmin)

1. Log in as **superadmin** → Admin → Clubs → select the hosted-play club
2. In the Booking Process card, find the **"Queue Management"** toggle (only visible when booking process = `Hosted Play`)
3. Toggle **ON** → click **Save**
4. Confirm the success message appears

**Verify in DB (Compass or mongo shell):**
```js
db.clubs.findOne({ _id: ObjectId("<club-id>") }, { hostedPlayQueueEnabled: 1 })
// Expected: { hostedPlayQueueEnabled: true }
```

---

## 4. Create a test session

1. Log in as **club admin** → Admin → Hosted Play → **New Session**
2. Fill in:
   - Title: `Test Queue Session`
   - Sport: Pickleball (or Tennis)
   - Date: today or tomorrow
   - Start / End Time
   - Venue / Court
   - Fee per Player: `0` (or any amount)
   - Max Players: `10`
   - **Number of Courts: `2`** ← new field, only visible when queue is enabled
3. Click **Save**
4. Confirm the session card now shows a **"Check-In & Queue"** button

---

## 5. Join as members (8+ players)

Log in as 8 different player accounts and each joins the session via:

**Player UI:** Player → Hosted Play → Join Session

**Or via REST (repeat for each player token):**
```bash
curl -X POST -H "Authorization: Bearer <player-token>" \
  http://localhost:3000/api/hosted-play/player/sessions/<id>/join
```

**Verify each participant is created with:**
- `checkedIn: false`
- `queueStatus: "not_checked_in"`

---

## 6. Open the Queue Manager

As **club admin**, click **"Check-In & Queue"** on the session card.

You land on `/admin/hosted-play/<id>/queue`.

**Expected initial state:**
- Stat strip: Checked In: 0 / Waiting: 0 / Playing: 0 / Paused: 0
- **Start Queue** button visible (but should only be clickable once players are checked in)
- Check-In Roster lists all 8 joined players

---

## 7. Check in players

In the Check-In Roster:

1. Toggle the check-in switch for each of the 8 players
2. After each toggle, the **Checked In** count in the stat strip increments
3. After all 8: Checked In: 8

> Waiting remains 0 — players enter the waiting queue only after **Start Queue** is clicked.

---

## 8. Start the queue

Click **Start Queue**.

**Expected:**
| Field | Value |
|---|---|
| Session `queueStatus` | `running` |
| Court 1 | Players 1–4 (first 4 checked-in, FCFS order) |
| Court 2 | Players 5–8 |
| Waiting Queue | Empty |
| Stats | Playing: 8, Active Games: 2 |

---

## 9. Finish a game

Click **Finish Game** on **Court 1**.

**Expected:**
- Court 1 players → moved to end of Waiting Queue with `gamesPlayed: 1`
- If ≥ 4 players are waiting → Court 1 refills immediately
- If < 4 players are waiting → Court 1 shows "Waiting for players"

> With only 8 players across 2 courts: after finishing Court 1, those 4 wait while Court 2 is still active. Finish Court 2 → 8 waiting → both courts refill.

---

## 10. Test admin controls

### Walk-in
1. In the Check-In Roster, find the walk-in input field
2. Type a name → click **Add Walk-In**
3. Player appears in Waiting Queue immediately (no payment)

**Verify in DB:**
```js
db.hostedplayparticipants.findOne({ memberName: "Walk In Name" })
// Expected: { isWalkIn: true, memberId: null, checkedIn: true, queueStatus: "waiting" }
```

### Pause a waiting player
1. In the Waiting Queue, click **Pause** on any player
2. Player moves to Paused list; queue order of remaining players preserved

### Resume
1. In the Paused list, click **Resume**
2. Player returns to end of the Waiting Queue

### Skip
1. In the Waiting Queue, click **Skip** on the first player
2. Player moves to the end of the Waiting Queue

### Remove
1. In the Waiting Queue, click **Remove** on a player
2. Player disappears from the queue (stays in DB as `done`)

### Reorder
1. Click **Move Up** / **Move Down** on Waiting Queue entries
2. Order updates and board refreshes

### Manual court assign
1. On a court with no active players, click **Assign**
2. Checkboxes appear on Waiting Queue entries
3. Select 1–4 players → click **Confirm**
4. Those players are assigned to the court even if fewer than 4 are selected

---

## 11. Verify auto-refresh

1. Keep the queue page open in **Tab A**
2. In **Tab B** (same admin), perform any action (finish a court, add a walk-in, etc.)
3. Return to **Tab A** — within ~5 seconds the board should update automatically without a manual reload

---

## 12. End the session

Click **End Session**.

**Expected:**
- Session `status` → `completed`
- Session `queueStatus` → `ended`
- All queue controls disabled
- Board still shows final state

**Verify in DB:**
```js
db.hostedplays.findOne({ _id: ObjectId("<id>") }, { status: 1, queueStatus: 1, summary: 1 })
// Expected:
// {
//   status: "completed",
//   queueStatus: "ended",
//   summary: { totalParticipants: 9, totalCheckedIn: 9, totalGamesPlayed: <n> }
// }

db.hostedplayparticipants.find({ hostedPlayId: ObjectId("<id>") }, { memberName: 1, gamesPlayed: 1, queueStatus: 1 })
// All participants: queueStatus: "done", gamesPlayed >= 0
```

---

## 13. Regression tests

Confirm these are **unaffected** by the new feature:

| Scenario | What to verify |
|---|---|
| Reservation club | No queue UI anywhere; player reserve/pay flow unchanged |
| Per-Game club | Admin Per-Game page unchanged; player Per-Game join unchanged |
| Hosted Play club (queue OFF) | No "Check-In & Queue" button; queue endpoints return 403 |
| Hosted Play join/cancel | Player can still join and cancel a session (before queue starts) |
| Cancel after queue starts | Player cancel attempt returns an error |

---

## Quick REST reference

```bash
BASE="http://localhost:3000/api/hosted-play"
TOKEN="Bearer <admin-token>"
ID="<session-id>"

# Get live board
curl -H "Authorization: $TOKEN" $BASE/sessions/$ID/queue

# Start queue
curl -X POST -H "Authorization: $TOKEN" $BASE/sessions/$ID/queue/start

# Check in a participant
curl -X PATCH -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"checkedIn":true}' $BASE/sessions/$ID/participants/<pid>/check-in

# Add walk-in
curl -X POST -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Walk In Joe"}' $BASE/sessions/$ID/walkins

# Finish court 1
curl -X POST -H "Authorization: $TOKEN" $BASE/sessions/$ID/courts/1/finish

# Pause a player
curl -X POST -H "Authorization: $TOKEN" $BASE/sessions/$ID/participants/<pid>/pause

# Resume a player
curl -X POST -H "Authorization: $TOKEN" $BASE/sessions/$ID/participants/<pid>/resume

# Skip a player
curl -X POST -H "Authorization: $TOKEN" $BASE/sessions/$ID/participants/<pid>/skip

# Remove from queue
curl -X DELETE -H "Authorization: $TOKEN" $BASE/sessions/$ID/participants/<pid>/queue

# Reorder waiting queue
curl -X PUT -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"orderedParticipantIds":["<pid1>","<pid2>","<pid3>"]}' $BASE/sessions/$ID/queue/order

# End session
curl -X POST -H "Authorization: $TOKEN" $BASE/sessions/$ID/queue/end

# Enable queue for a club (superadmin only)
curl -X PATCH -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"enabled":true}' http://localhost:3000/api/clubs/<club-id>/hosted-play-queue
```

---

## Notes

- The **"Check-In & Queue"** button and **Number of Courts** field only appear in the admin UI when `club.hostedPlayQueueEnabled === true`.
- Walk-ins have no payment record — they are queue-only participants.
- Auto-assign is all-or-nothing: a court fills only when it has **zero** active players **and** ≥ `playersPerCourt` are waiting. Use manual assign for partial fills.
- The live board polls every **5 seconds** — there is a brief lag between server mutations made outside the current tab and board refresh.
- Poll is paused during any active admin action (e.g., while the manual-assign overlay is open) to prevent stale data overwriting in-progress selections.
