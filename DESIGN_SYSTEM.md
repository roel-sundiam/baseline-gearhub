# Baseline Gearhub — Design System

Reference document for all UI redesigns. Follow this spec when building or redesigning any page.

---

## 1. Theme

### Player-facing pages (dark theme)
Applied by adding `dark-player-page` class to `<html>` and `<body>` via Angular `Renderer2` in `ngOnInit` / removed in `ngOnDestroy`.

The class is defined in `frontend/src/styles.scss` and overrides the global light theme for the duration of the player route.

### Admin-facing pages
Use the global light theme (beige/warm background). Do **not** apply `dark-player-page`.

---

## 2. Color Palette

### Dark theme (player pages)

| Token | Value | Usage |
|---|---|---|
| Page background | `#0c1a11` | `html`, `body`, `.dm-shell`, `.dm-body` |
| Card background | `#1b3028` | All cards, action cards, news card |
| Card hover | `#213830` | Hover state on interactive cards |
| Header background | `#111f16` | Mobile header, bottom nav |
| Lime accent | `#a3e635` | Primary CTA, active nav, highlights, icon colors |
| Lime hover | `#b8f040` | Hover on lime buttons |
| Text primary | `#ffffff` | Headings, card titles |
| Text muted | `rgba(255,255,255,0.42–0.55)` | Subtitles, meta, sub-labels |
| Text very muted | `rgba(255,255,255,0.35–0.40)` | Section labels, empty states |
| Border subtle | `rgba(255,255,255,0.07–0.08)` | Dividers, card borders |
| Danger | `#ef4444` | Badge alerts, error states |

### Light theme (admin / global)

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#b88942` | Gold — primary buttons, navbar |
| `--primary-dark` | `#9f7338` | Hover on primary |
| `--primary-light` | `#c9a15d` | Accent |
| Page background | `#f6efe4` | Body, warm beige |
| `--warm-bg` | `#efe2cf` | Section backgrounds |
| `--panel` | `#e8d7bf` | Panel backgrounds |
| `--surface` | `#ffffff` | Card surfaces |
| `--border` | `#374151` | Form borders |
| `--danger` | `#ef4444` | Errors |
| `--warning` | `#f59e0b` | Warnings, gold |

---

## 3. Typography

### Font family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```
No custom font loaded — system font stack throughout.

### Scale (dark theme)

| Element | Size | Weight | Color |
|---|---|---|---|
| Club name (desktop) | `1.5rem` | `800` | lime + white (two-tone) |
| Club name (mobile header) | `1.15rem` | `800` | lime + white (two-tone) |
| Page greeting | `1.6rem` | `800` | `#ffffff` |
| Hero card title | `1.15rem` (mobile) / `1.4rem` (desktop) | `800` | `#ffffff` |
| Section label | `0.75rem` (mobile) / `0.82rem` (desktop) | `700` | `rgba(255,255,255,0.40)` uppercase, `letter-spacing: 0.8px` |
| Card title | `0.82rem` | `700` | `#ffffff` |
| Card subtitle | `0.67rem` | `400` | `rgba(255,255,255,0.42)` |
| Body / booking date | `0.88rem` | `700` | `#ffffff` |
| Body / booking time | `0.82rem` | `500` | `rgba(255,255,255,0.65)` |
| Booking court | `0.78rem` | `600` | `#a3e635` |
| Nav label | `0.6rem` | `600` | inactive `rgba(255,255,255,0.35)`, active `#a3e635` |

### Two-tone club name pattern
Split the club name string at the last space. First part → lime `#a3e635`, last word → white `#ffffff`. Single-word names → all lime.

```html
<span class="dm-club-accent">{{ clubNameFirst }}</span>
@if (clubNameLast) { <span class="dm-club-word"> {{ clubNameLast }}</span> }
```

---

## 4. Layout & Spacing

### Mobile shell (< 769px)
```css
.dm-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px); /* 60px = navbar height */
  max-width: 480px;
  margin: 0 auto;
  background: #0c1a11;
}
.dm-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem 1rem 0;
  -webkit-overflow-scrolling: touch;
}
```

### Desktop shell (≥ 769px)
```css
.dm-shell {
  max-width: 900px;
  height: auto;
  min-height: calc(100vh - 60px);
}
.dm-body {
  overflow-y: visible;
  padding: 2rem 2.5rem 2rem;
  display: block;
}
```

### Escaping main-content padding (host trick)
The global `main-content` has `padding: 1.5rem`. On mobile, the shell must bleed to the edges:
```css
:host {
  display: block;
  margin: -1.5rem;
  width: calc(100% + 3rem);
}
@media (min-width: 769px) {
  :host { margin: 0; width: 100%; }
}
```

### Section spacing
- Between sections: `margin-bottom: 1.1rem` (mobile), `1.5rem` (desktop)
- Section label bottom margin: `0.5rem`

### Bottom nav spacer
Add an `80px` spacer div at the end of `.dm-body` on mobile so content isn't hidden behind the fixed bottom nav:
```html
<div class="dm-bottom-spacer"></div>  <!-- height: 80px, hidden desktop -->
```

---

## 5. Components

### Hero Card
Full-width card with text on the left and a court photo on the right.

```css
.dm-hero-card {
  background: #1b3028;
  border-radius: 16px;
  display: flex;
  overflow: hidden;
  min-height: 158px; /* 200px desktop */
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.dm-hero-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
.dm-hero-image { width: 40%; overflow: hidden; } /* image fills height */
```

CTA button style:
```css
background: #a3e635; color: #0a1f00; border-radius: 20px;
padding: 0.4rem 1.05rem; font-size: 0.8rem; font-weight: 800;
```

Court photo asset: `/racketball.png`

---

### Action Card Grid
2 columns on mobile, 4 columns on desktop.

```css
.dm-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;       /* mobile */
  gap: 0.7rem;
}
@media (min-width: 769px) {
  .dm-card-grid { grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
}

.dm-action-card {
  background: #1b3028;
  border-radius: 14px;
  padding: 0.95rem 0.9rem;
  min-height: 100px; /* 110px desktop */
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.22rem;
  position: relative;      /* for badge */
  transition: background 0.2s, transform 0.15s;
}
.dm-action-card:hover { background: #213830; transform: translateY(-1px); }
```

Icon container (38×38, rounded 10px):
```css
.dm-ac-icon { width: 38px; height: 38px; border-radius: 10px; font-size: 1rem; }
```

#### Icon color variants
| Class | Background | Icon color |
|---|---|---|
| `.dm-ac-lime` | `rgba(163,230,53,0.14)` | `#a3e635` |
| `.dm-ac-teal` | `rgba(20,184,166,0.14)` | `#14b8a6` |
| `.dm-ac-amber` | `rgba(245,158,11,0.14)` | `#f59e0b` |
| `.dm-ac-blue` | `rgba(59,130,246,0.14)` | `#60a5fa` |
| `.dm-ac-yellow` | `rgba(234,179,8,0.14)` | `#eab308` |
| `.dm-ac-purple` | `rgba(139,92,246,0.14)` | `#a78bfa` |
| `.dm-ac-rose` | `rgba(244,63,94,0.14)` | `#fb7185` |
| `.dm-ac-orange` | `rgba(249,115,22,0.14)` | `#fb923c` |
| `.dm-ac-sky` | `rgba(14,165,233,0.14)` | `#38bdf8` |
| `.dm-ac-green` | `rgba(34,197,94,0.14)` | `#4ade80` |

Alert badge (top-right absolute):
```css
.dm-ac-badge {
  position: absolute; top: 0.55rem; right: 0.55rem;
  background: #ef4444; color: #fff;
  border-radius: 50%; width: 18px; height: 18px;
  font-size: 0.62rem; font-weight: 800;
}
```

---

### Dark Card (generic)
```css
.dm-card {
  background: #1b3028;
  border-radius: 12px;
  padding: 0.95rem 1rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}
```

---

### Club News Card
```css
.dm-news-card {
  background: #1b3028; border-radius: 12px;
  padding: 0.9rem 1rem;
  display: flex; align-items: center; gap: 0.75rem;
  cursor: pointer; transition: background 0.2s;
}
.dm-news-card:hover { background: #203828; }
/* Thumbnail: 56×56, border-radius 10px */
/* Tournament icon bg: rgba(163,230,53,0.12), color: #a3e635 */
/* Placeholder icon bg: rgba(255,255,255,0.06), color: rgba(255,255,255,0.4) */
```

---

### Bottom Navigation (mobile only, fixed)
5-tab bar fixed to bottom of viewport, centered, max-width 480px.

```css
.dm-bottom-nav {
  position: fixed; bottom: 0;
  left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  background: #111f16;
  border-top: 1px solid rgba(255,255,255,0.08);
  height: 62px; z-index: 200;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
}
.dm-nav-item { color: rgba(255,255,255,0.35); font-size: 0.6rem; font-weight: 600; }
.dm-nav-item i { font-size: 1.1rem; }
.dm-nav-item.dm-nav-active { color: #a3e635; }
```

Hidden on desktop: `@media (min-width: 769px) { .dm-bottom-nav { display: none; } }`

---

### Section Label
```css
.dm-section-label {
  font-size: 0.75rem; font-weight: 700;
  color: rgba(255,255,255,0.40);
  text-transform: uppercase; letter-spacing: 0.8px;
  margin: 0 0 0.5rem 0;
}
```

---

### Admin Pill (desktop greeting)
```css
.dm-admin-pill {
  background: rgba(163,230,53,0.15); color: #a3e635;
  border: 1px solid rgba(163,230,53,0.3);
  border-radius: 20px; padding: 0.3rem 0.85rem;
  font-size: 0.78rem; font-weight: 700;
}
.dm-admin-pill:hover { background: rgba(163,230,53,0.25); }
```

---

## 6. Icons

Font Awesome 6 (Free). CDN loaded globally.

| Usage | Icon class |
|---|---|
| Reserve / Book | `fas fa-calendar-alt` |
| My Reservations | `fas fa-calendar-check` |
| Payments | `far fa-credit-card` |
| Members (player) | `fas fa-user-friends` |
| Tournaments | `fas fa-trophy` |
| Rankings | `fas fa-medal` |
| Approvals | `fas fa-clipboard-check` |
| Rules | `fas fa-gavel` |
| Members (admin) | `fas fa-users-cog` |
| Finance | `fas fa-coins` |
| Dashboard | `fas fa-cogs` |
| Analytics | `fas fa-chart-bar` |
| Clubs | `fas fa-shield-alt` |
| Bell (notifications) | `far fa-bell` |
| Home | `fas fa-home` |
| Courts (nav) | `fas fa-table-tennis` |
| Bookings (nav) | `far fa-calendar-check` |
| Profile (nav) | `far fa-user` |
| Logout | `fas fa-sign-out-alt` |
| Lock (club badge) | `fas fa-lock` |

---

## 7. Navbar (global, light theme)

```css
.navbar {
  background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
  height: 60px; position: sticky; top: 0; z-index: 100;
  box-shadow: 0 2px 12px rgba(0,0,0,0.35);
}
```

When `dark-player-page` is active, overridden globally in `styles.scss`:
```css
body.dark-player-page .navbar {
  background: #111f16;
  box-shadow: 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5);
}
```

Breakpoints:
- `≥ 769px` — desktop nav (profile + logout visible, icon label shown)
- `≤ 768px` — mobile nav (avatar + logout icon only)
- Brand name always visible (no `display: none` on mobile)

---

## 8. Global Dark Theme Override

Defined in `frontend/src/styles.scss`. Applied when `html.dark-player-page` / `body.dark-player-page` classes are present.

```scss
html.dark-player-page,
body.dark-player-page {
  background: #0c1a11;
  .court-bg { display: none; }           // hides global tennis court bg image
  .main-content { background: #0c1a11; }
  .navbar { background: #111f16; ... }
  .club-locked-badge { ... }
  .coin-badge { ... }
  .btn-logout, .btn-logout-mobile-icon { ... }
  .profile-section:hover, .profile-section-mobile:hover { ... }
}
```

Apply/remove via `Renderer2` in the component:
```typescript
constructor(private renderer: Renderer2) {}

ngOnInit() {
  this.renderer.addClass(document.documentElement, 'dark-player-page');
  this.renderer.addClass(document.body, 'dark-player-page');
}
ngOnDestroy() {
  this.renderer.removeClass(document.documentElement, 'dark-player-page');
  this.renderer.removeClass(document.body, 'dark-player-page');
}
```

---

## 9. Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| `< 480px` | Single-column shell (480px max), tight padding |
| `≤ 600px` | Navbar: club badge truncated, profile username hidden |
| `≤ 768px` | Navbar: mobile nav shown, desktop nav hidden |
| `≥ 769px` | Dashboard: shell full-width (900px max), bottom nav hidden, 4-col card grid, no overflow-y on body |

---

## 10. Angular Patterns

- **Zoneless app** — use `signal()` and `cdr.detectChanges()` (not `markForCheck()`) for reactive state updates
- **Standalone components** — all components are `standalone: true`, import only what they use
- **Inline template + styles** — keep template and styles inside the `@Component` decorator for dashboard-style pages
- **No `SessionsService`** on player dashboard — use `ReservationService.getMy()` for personal reservations
- **ClubService.getClub(clubId)** to resolve club name from `auth.user()?.clubId`
- **TournamentService.getAll()** for club news; filter by `published && status !== 'completed'`
