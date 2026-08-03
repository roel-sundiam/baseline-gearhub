# DUPR Meeting Talking Points

Context: DUPR replied positively to the production-key request email (sent 2026-07-27) and asked to schedule a meeting to review the platform and integration. This is their human verification step on top of the written compliance summary, likely covering the same 5 production-review checklist items. Demo uses SheServes Tennis Club (real production club, `duprEnabled: true`, `duprClubId` mapped to DUPR's UAT sandbox club) with the `she-serves` admin account and `player1–4@courtgo.com` test accounts already linked.

## Agenda (~30 min)

1. Context (2 min) — what CourtGo is, and where DUPR fits (Hosted Play match results feed DUPR ratings)
2. Live walkthrough of all 5 checklist items (18–20 min)
3. Open questions (5 min)
4. Next steps / timeline (3 min)

## 1. SSO Login

**Click through:** `she-serves` admin → Profile Edit → "Linked Accounts" card → "Link DUPR Account" → real DUPR login iframe loads → postMessage returns DUPR ID/stats → card shows linked state.

**Say:** This is the only account-linking path in the app — no email-lookup fallback — matching DUPR's mandatory SSO requirement.

she-serves (BaselineGearhub): player1@courtgo.com Password: 8X3OWLK8wYSsl7KB

trisha-aquino-dela-cruz (SheServes): player2@courtgo.com Password: 7UfJuezWH1eYrdiP

ysabelle-evangelista (SheServes): player3@courtgo.com Password: 1KzCjnFsFE7ckK98

verin-raelle-barro (SheServes): player4@courtgo.com Password: nnS8XwXNDFEweSHm

https://uat.dupr.gg/dashboard/browse/clubs/5534061691

## 2. Rating visibility via webhooks

**Click through:** A linked player's profile showing their live `duprRating`.

**Say:** This number updates automatically via a registered webhook, not a manual refresh. The webhook is registered on courtgo.club and confirmed working end-to-end with a real inbound rating-update event, not just coded.

## 3. User gating

**Click through:** Try finishing a Hosted Play match with an unlinked walk-in on one team — no DUPR chip appears. Then finish a match with all 4 players linked and `BASIC_L1`-entitled — chip appears.

**Say:** The entitlement check comes straight from the SSO payload's `subscriptions[].entitlements`, gating on `BASIC_L1` per DUPR's own Match Upload requirement.

## 4. Match management

**Click through:** Run a real Hosted Play session end-to-end — check in players, finish a match with a score, chip shows "DUPR: Submitted." Then demo the flag (dispute) → resolve with corrected score → chip updates.

**Say:** Covers create/update; deletion also exists in code (demo only if asked).

## 5. Club integration

**Click through:** Show SheServes' `duprClubId` mapped to DUPR's own UAT sandbox club, and mention the admin's submission is gated on their own DUPR DIRECTOR/ORGANIZER role on that club (checked via partner token), not just app-level admin status.

**Say:** Submissions are scoped per-club, not global.

## Open questions to raise

- The webhook envelope has an unexplained `message.token` field — what's it for?
- Do `PREMIUM_L1`/`VERIFIED_L1` entitlements need any gating beyond `BASIC_L1`, or is nothing else required since CourtGo has no DUPR+ tournaments/merch today?
