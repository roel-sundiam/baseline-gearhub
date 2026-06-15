# Feature: Per-Player-Per-Game Court Fee Mode

## Overview

Add an alternative court fee billing mode where clubs can charge a flat fee per player per game, instead of the current per-hour model. The full booking flow (date, time, duration, add-ons) stays unchanged — only the base court fee calculation changes.

## Business Rules

- One flat `reservationPerPlayerRate` (no weekday/weekend/holiday split)
- Total players = 1 (booking member) + added club members (`players` array) + guest count
- Lights, ball boy, and rental fees remain per-hour even in this mode
- Controlled by a per-club setting `courtFeeMode`: `'per_hour'` (default) or `'per_player_per_game'`

## Existing Features to Reuse

- `convenienceFeeMode` pattern in Club model — mirror this exactly for `courtFeeMode`
- `players` field on Reservation (added club members) — already captured in booking flow via "Playing With" section
- `guestCount` — already captured in booking flow

---

## Changes Required

### 1. Backend — Rates Model
**File:** `backend/models/Rates.js`

Add:
```js
reservationPerPlayerRate: { type: Number, default: 0 }
```

### 2. Backend — Club Model
**File:** `backend/models/Club.js`

Add:
```js
courtFeeMode: { type: String, enum: ['per_hour', 'per_player_per_game'], default: 'per_hour' }
```

### 3. Backend — Club Routes (validation)
**File:** `backend/routes/clubs.routes.js` (around lines 92–97)

Validate `courtFeeMode` alongside `convenienceFeeMode`.

### 4. Backend — Reservations Pricing Logic
**File:** `backend/routes/reservations.routes.js` (lines ~264–325 for POST, ~475–504 for PATCH)

```js
const courtFeeMode = club.courtFeeMode || 'per_hour';
let baseCourtFee;
if (courtFeeMode === 'per_player_per_game') {
  const totalPlayers = 1 + additionalPlayers.length + sanitizedGuestCount;
  baseCourtFee = ratesUsed.reservationPerPlayerRate * totalPlayers;
} else {
  baseCourtFee = hourlyRate * durationHours; // existing behavior
}
```

- Lights, ball boy, rental fees continue to multiply by `durationHours` unchanged
- Store `courtFeeMode` in the `ratesUsed` snapshot on the Reservation for historical accuracy
- Apply the same switch in the PATCH handler

### 5. Frontend — Admin Club Form
**File:** `frontend/src/app/features/admin/clubs/clubs.component.ts`

Add a `courtFeeMode` dropdown:
- `per_hour` — Per Hour (default)
- `per_player_per_game` — Per Player Per Game

### 6. Frontend — Admin Rates Form
**File:** `frontend/src/app/features/admin/rates/rates.component.ts`

Add a `reservationPerPlayerRate` input in the Reservation Rates section.

### 7. Frontend — Reserve Court Fee Preview
**File:** `frontend/src/app/features/player/reserve-court/reserve-court.component.ts` (lines ~1064–1108)

Update the `baseCourtFee` getter:
```ts
get baseCourtFee() {
  if (this.club()?.courtFeeMode === 'per_player_per_game') {
    const totalPlayers = 1 + this.addedPlayers.length + this.guestCount;
    return (this.rates()?.reservationPerPlayerRate ?? 0) * totalPlayers;
  }
  return this.baseHourlyRate * this.selectedDuration;
}
```

Fee preview updates reactively as members/guests are added or removed.

### 8. Frontend — Services
**File:** `frontend/src/app/core/services/club.service.ts`

Add `courtFeeMode` to the Club interface/DTO.

---

## Verification Checklist

- [ ] In admin, set `courtFeeMode` to `per_player_per_game` and set `reservationPerPlayerRate` (e.g. ₱100)
- [ ] As a player, book with 2 added members + 1 guest → fee preview shows ₱100 × 4 = ₱400
- [ ] Complete booking → Charge record shows `baseCourtFee = 400`
- [ ] Lights/ball boy fees still multiply by duration in per-player mode
- [ ] Switch back to `per_hour` → old per-hour calculation resumes
