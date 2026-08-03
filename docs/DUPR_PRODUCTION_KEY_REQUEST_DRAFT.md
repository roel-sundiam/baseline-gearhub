# Draft email to tech@mydupr.com — Production Key Request

> **Sent 2026-07-27** to `tech@mydupr.com` from Roel Sundiam's AOL account, using this
> file's plain-text version (no Markdown asterisks/backticks/headers - stripped for a
> non-Markdown-aware compose box) with the User Gating verification step included. This
> is what actually went out. Kept here as an accurate reference for any follow-up.

---

**To:** tech@mydupr.com
**Subject:** CourtGo — Production Key Request (Client ID 6459106109)

Hi DUPR team,

CourtGo has completed integration testing against the UAT environment and confirmed all five production-review requirements end to end. We're requesting production API keys and have included a live demo environment below so your team can verify the integration directly, along with a compliance summary mapped to each requirement.

LIVE DEMO

Platform URL: https://courtgo.club
Test admin login: username she-serves, password BaselineGearhub

This account is our "SheServes Tennis Club" demo club, fully configured for review: DUPR is enabled, the admin is linked with the DIRECTOR role, several players are linked, and a real Hosted Play match has already been submitted to and accepted by DUPR through this account.

COMPLIANCE SUMMARY

1. SSO Login
Players and club admins link their DUPR account from Profile > Linked Accounts > DUPR, which embeds the login-external-app iframe and listens for the postMessage credential payload it returns. To verify: log in as she-serves and open Profile > Edit Profile - the account already shows as "Linked." To exercise a fresh login, unlink and relink using any DUPR account.

2. Rating Visibility (Webhooks)
Our webhook endpoint is registered at https://courtgo.club/api/dupr/webhook and handles both RATING and RATING_SEED events, updating the linked player's stored rating immediately on receipt. To verify: the she-serves account's linked profile already shows a synced doubles rating, populated by a RATING_SEED event delivered at link time.

3. User Gating
Match submission requires every participating player to hold the BASIC_L1 entitlement, read from the subscriptions field returned in the SSO login payload and checked prior to submission. Players without BASIC_L1 - or without a DUPR link at all - are simply excluded from submission, with no effect on our internal scoring or queue rotation. CourtGo does not currently offer DUPR+-gated tournaments or merchandise, so PREMIUM_L1 and VERIFIED_L1 have no corresponding resource to gate at this time. To verify: any Hosted Play match involving a player without BASIC_L1 (or without a DUPR link) is silently excluded from submission - only matches where every player is BASIC_L1-linked produce a "DUPR: Submitted" status chip.

4. Match Management
Our Hosted Play feature - drop-in, queue-managed pickleball sessions - captures per-game scores and submits eligible matches to DUPR via POST /match/{version}/create, with score corrections handled through update and disputes resolved via delete/resubmit. To verify: as she-serves, open Hosted Play, start a session, check in two DUPR-linked players onto a court, and finish the game with a score - a "DUPR: Submitted" status chip appears on the recorded match once DUPR accepts it.

5. Club Integration
Club-sourced submissions additionally require the submitting admin to hold a DIRECTOR or ORGANIZER role on the associated DUPR club, verified via GET /user/{version}/{id}/clubs using our partner token, independent of that user's CourtGo-side permissions. The she-serves admin holds DIRECTOR on our linked test club, and this check runs on every submission.

CourtGo is production-ready today, and we're happy to walk through any part of the integration live or provide additional detail on request. Please let us know if there's anything further you need from us to move forward.

Best regards,
Roel Sundiam
CourtGo
