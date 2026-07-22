# Hosted Play — Feature Summary

## Session setup & lifecycle
- Admin creates a session: sport (tennis, pickleball, badminton, squash, table tennis, padel), date/time, venue/court/address, description, max players.
- Session status flow: `open → full → closed/cancelled/completed`.
- Optional skill-band gating: restrict joining to a min/max self-declared skill level (beginner → professional).
- Optional pickleball scoring config: point target (11/15/21) and win-by-two toggle, used by umpire live scoring.
- Club-level master toggle (`hostedPlayEnabled`) turns the whole feature on/off per club.

## Joining & payment
- Members join open sessions; duplicate joins are blocked (active / waitlisted / offered / pending-payment states are all checked).
- Two club-wide fee-split modes:
  - **Per player** — each joiner is charged `feePerPlayer` (or a separate guest fee) at join time.
  - **Split total** — no charge at join; the session's `sessionFee` is divided among however many members are still joined and billed once the session completes.
- Convenience fee modes (club-configurable): charged per join, charged once per session, or absorbed by the club; rate or flat amount configurable.
- Wallet credit can be applied at join time to reduce the amount owed (`useCredit`), with remainder covered by payment proof (GCash / Bank Transfer / GoTyme) or left pending admin approval.
- Guest-specific pricing and a guest cap (`maxGuests`) independent of the general `maxPlayers` cap.
- Members can cancel their join before the event starts.

## Waitlist
- When a session is full, joining places a member on a FIFO waitlist (if the club allows waitlisting).
- A freed spot can be **offered** to the next waitlisted member, who has a claim window (paid claim or admin approval) before the offer expires and moves to the next person.
- Optional auto-release: an unchecked-in confirmed player can be bumped after `checkInCutoffMinutes` past start time to free the spot for a waitlister.

## Check-in
- Manual admin check-in per participant.
- **QR self-check-in**: admin generates a session QR token; players scan it (via an in-app QR scanner modal) to check themselves in without staff involvement.
- **Walk-ins**: admin can add a guest walk-in (name-only, charged cash if the session has a fee) or a **member walk-in** (linked to an existing club member's account, charged like a normal join) directly at the desk — bypasses the online join flow and skill/guest checks.

## Queue management (court rotation)
Gated by a per-club toggle (`hostedPlayQueueEnabled`) and enabled per session; configurable number of courts and players-per-court.
- **Queue modes** (pluggable strategy engine):
  - `fcfs` — everyone rotates off after each game; fairness by games played, then queue order.
  - `winner_stays` — winning side stays on court, losers go to the back of the line.
  - `king_of_court` — winners defend the court but must abdicate after a capped streak of consecutive holds.
  - (`skill_rotation` reserved in the schema, not yet implemented — falls back to FCFS.)
- Start/end the queue for a session; auto-seeds checked-in players into the waiting line and fills free courts.
- Pause / resume a player (auto-backfills their court slot from the front of the queue while paused-from-playing).
- Skip a player to the back of the waiting line.
- Remove a player from the queue entirely (marks them done for the session).
- Reorder the waiting line manually (drag/move up-down).
- Manual court assignment: hand-pick specific players from waiting/paused/done onto an empty or partially-open court.
- Tap-to-swap board rearrange: swap two players' exact positions (court↔court, court↔waiting) without touching game counters or auto-fill.
- Move a player directly to any open court/slot.
- Live queue/session board polling for both admin and player views; a public **TV Display** board for on-site screens.

## Match recording & scoring
- One `HostedPlayMatch` record per finished game: teams (derived from court slot — low half = Team A, high half = Team B), optional scores, winner (tapped by admin or derived from scores), timestamps, who recorded it.
- Finishing a court either records a winner-only result (FCFS) or requires a winner for strategies where it matters (`winner_stays`, `king_of_court`).
- Scores can be entered/edited after the fact via a dedicated endpoint; a previously tapped winner is authoritative and later score edits must agree with it.
- **Umpire live scoring**: anonymous, per-court token link (no login) lets an on-court umpire run live side-out/point scoring — start serve, set server, record rally winner, undo last action (single-level undo), finish court. Server/side tracking is derived from serve state so the umpire only ever taps who won the rally.
- Match history: per-session list, per-club paginated history (admin and player-facing views), plus club standings/leaderboard (wins, losses, games played).

## Notifications
- Push notifications to club admins on: waitlist joins, new joins, pending-payment submissions.

## Multi-club / member context
- Skill level and DUPR profile lookups per user, used for skill-band gating and (optionally) DUPR-aware matchmaking context.
- Player-facing session list/detail scoped to the member's current club context (supports the multi-club membership model).

## Related but separate
- **DUPR integration** is designed but on hold pending Partner API credentials (see `docs/DUPR_INTEGRATION_PLAN.md`) — not yet wired into Hosted Play matchmaking.
