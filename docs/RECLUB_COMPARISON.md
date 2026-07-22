# CourtGo vs. Reclub — What's Different

> **Sourcing note:** Web search was unavailable while writing this (repeated outages), so
> the Reclub side of this comparison is grounded in the facts already verified in-repo —
> see `docs/DUPR_INTEGRATION_PLAN.md`, researched and confirmed 2026-07-19 — plus general
> public knowledge of Reclub's positioning as a pickleball community app. Anything not
> traceable to the DUPR doc should be spot-checked against Reclub's current site/app
> before being used externally (e.g. in sales/marketing material).

## One-line framing

**CourtGo** is a club-*operations* platform: the software a tennis/pickleball club's
owner or admin runs the business on (bookings, billing, queues, memberships, reporting).
**Reclub** is a player-*community* app: the software individual pickleball players use to
find open play, track their DUPR rating, and connect with other players. They sit at
different layers of the same ecosystem more than they compete head-on — which is exactly
why CourtGo's own DUPR integration plan treats DUPR as the neutral hub between the two
rather than trying to integrate with Reclub directly (Reclub has no public API for
anyone to integrate against).

## Side-by-side

| | **CourtGo** | **Reclub** |
|---|---|---|
| Who it's for | Club owners/admins running the facility, plus their members | Individual pickleball players |
| Platform | Web app (Angular), admin + player portals | Mobile-only app |
| Sports | Tennis-first, with pickleball support (fee fields like `lightFee`/`ballBoyFee` are tennis-specific; Hosted Play and DUPR groundwork are pickleball-oriented) | Pickleball-only |
| Multi-tenant | Yes — true multi-club SaaS with a superadmin layer managing many clubs, plus per-user multi-club membership | Not applicable — it's a single consumer app, not club-operated software |
| Court reservations | Yes — three configurable booking modes per club: standard time-slot reservations, lightweight per-game booking, and Hosted Play (queue-based rotation) | Court/session discovery for open play, not a club-configurable reservation backend |
| Open play / queue management | **Hosted Play**: check-in, automatic court rotation queue, live scoring with a dedicated umpire role, self check-in via QR, and (just added) club-wide match history + individual/doubles win-loss standings | Its core use case — players use it to find and join open play sessions |
| Billing & finance | Full ledger: per-transaction charges with itemized fees, member credit balances, payment approval workflow, club-to-platform billing, configurable pricing rules, multiple finance dashboards | Not a billing platform for club operations |
| Ratings / DUPR | No first-party DUPR integration yet (design is complete and on hold pending DUPR Partner API credentials — see `docs/DUPR_INTEGRATION_PLAN.md`); currently only self-reported `duprRating`/`duprId` fields | Already pulls ratings *from* DUPR; club-to-club DUPR linking is a manual form process with Reclub staff (no public API) |
| Tournaments | Basic tournament listing/management (model + routes + UI exist; no bracket-generation engine found) | Not its focus |
| Member/admin tooling | Member directory, admin messaging, push notifications, club news/announcements, analytics dashboards, terms-of-service flow, award generator, guest booking for non-members | Consumer-facing; no club-admin back office |
| Public-facing site | Yes — marketing landing page + self-serve club registration/signup | N/A (app-only) |
| API for third parties | Not published today | None — explicitly no public/developer API (confirmed in `docs/DUPR_INTEGRATION_PLAN.md`) |

## Where they'd naturally connect

Both products already sync through DUPR rather than through each other:

- Reclub pulls ratings **from** DUPR into the player's Reclub profile.
- CourtGo's (currently on-hold) plan is to **submit** match results **to** DUPR from
  Hosted Play games.
- Net effect once CourtGo's integration ships: a match played and scored in CourtGo
  updates the player's official DUPR rating, which then shows up in Reclub automatically
  — with zero direct CourtGo↔Reclub integration work, since Reclub has no API to build
  against anyway.
- CourtGo already has a cosmetic placeholder for this relationship: clubs can add a
  Reclub profile link in their social links (`Club.socialLinks.reclub`), shown on the
  guest-facing club page alongside Facebook/Instagram.

## Bottom line

If someone is asking "should we use CourtGo or Reclub," the honest answer is they're
usually not substitutes: a club needs CourtGo (or something like it) to actually run
bookings, billing, and rosters, while its members might *separately* use Reclub to find
pickup games and carry a portable DUPR-linked rating across clubs. The overlap to watch
is Hosted Play — CourtGo's queue/open-play feature covers some of the same "find people
to play with right now" need that Reclub is built around, just scoped to one club's
in-house sessions rather than a cross-club player network.
