import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { APP_VERSION } from '../../version';
import { environment } from '../../../environments/environment';

interface AppReview {
  _id: string;
  clubName: string;
  rating: number;
  text: string;
  clubSlug: string | null;
  clubLogo: string | null;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">

      <!-- Background -->
      <div class="bg-layer">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <div class="grid-overlay"></div>
      </div>

      <!-- Navbar -->
      <header class="navbar">
        <img src="/CourtGo.png" alt="CourtGo" class="nav-logo" />

        <div class="nav-center">
          <a routerLink="/book" class="nav-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span class="nav-search-full">Find Clubs</span>
            <span class="nav-search-short">Find Clubs</span>
          </a>
          <nav class="nav-links">
            <a href="#" class="nav-link">Pricing</a>
            <a href="#" class="nav-link">How It Works</a>
            <a href="#" class="nav-link nav-link-drop">Resources
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </a>
          </nav>
        </div>

        <div class="nav-right">
          <a routerLink="/player-login" class="nav-signin">Login as Player</a>
          <a routerLink="/register-club" class="btn-primary nav-register">Register your Club</a>
        </div>
      </header>

      <!-- Mobile quick-links (hidden on desktop) -->
      <div class="mobile-quicklinks">
        <a routerLink="/book" class="mql-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Find Clubs
        </a>
        <a routerLink="/player-login" class="mql-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Login as Player
        </a>
      </div>

      <!-- Hero -->
      <section class="hero">
        <div class="hero-left">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            Racket Sports Club Platform
          </div>
          <h1 class="hero-headline">
            The modern way to<br>
            <span class="accent">MANAGE &amp; BOOK</span><br>
            COURTS.
          </h1>
          <p class="hero-sub">
            Real-time reservations, club management, tournaments,
            and live support — all in one place. For tennis, pickleball,
            squash, and more.
          </p>
          <div class="hero-ctas">
            <a routerLink="/register-club" class="btn-primary btn-hero">
              Register your Club
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4M8 12h8"/></svg>
            </a>
            <a routerLink="/book" class="btn-ghost">Book as Guest</a>
          </div>
          <div class="hero-proof">
            <div class="avatars">
              <div class="av av-1"></div>
              <div class="av av-2"></div>
              <div class="av av-3"></div>
            </div>
            <p class="proof-text">Join <strong>1,000+</strong> clubs &amp; players already using CourtGo</p>
          </div>
        </div>

        <div class="hero-right">
          <div class="phone-glow"></div>
          <div class="rings">
            <div class="ring r1"></div>
            <div class="ring r2"></div>
            <div class="ring r3"></div>
            <div class="ring r4"></div>
          </div>
          <div class="deco-arrows">
            <svg width="48" height="28" viewBox="0 0 48 28" fill="none" stroke="rgba(124,255,78,0.65)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 25L24 3L45 25"/></svg>
            <svg width="48" height="28" viewBox="0 0 48 28" fill="none" stroke="rgba(124,255,78,0.4)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 25L24 3L45 25"/></svg>
            <svg width="48" height="28" viewBox="0 0 48 28" fill="none" stroke="rgba(124,255,78,0.2)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 25L24 3L45 25"/></svg>
          </div>
          <div class="hero-phones">
            <div class="phone phone-1">
              <img src="/mockup-home.png" alt="CourtGo home screen" />
            </div>
            <div class="phone phone-2">
              <img src="/mockup-courts.png" alt="CourtGo find courts" />
            </div>
          </div>
        </div>
      </section>

      <!-- Booking Types -->
      <section class="booking-types" id="booking-types">
        <div class="bt-head">
          <div class="bt-tag">
            <span class="badge-dot"></span>
            Booking Options
          </div>
          <h2 class="bt-title">Three Ways to Book</h2>
          <p class="bt-sub">Every club is different. CourtGo supports multiple booking models so you always play your way.</p>
        </div>

        <div class="bt-grid">

          <!-- Reservation -->
          <div class="bt-card bt-reservation">
            <div class="bt-icon bt-icon-lime">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
            </div>
            <h3 class="bt-card-title">Reservation</h3>
            <p class="bt-desc">Reserve a specific court for a set time slot. Pick your court, pick your time — confirmed in seconds.</p>
            <ul class="bt-bullets">
              <li>Real-time availability</li>
              <li>Instant confirmation</li>
              <li>Flexible cancellations</li>
            </ul>
            <a routerLink="/book" class="bt-book-link bt-book-lime">
              Book Now
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
            </a>
          </div>

          <!-- Per Game -->
          <div class="bt-card bt-per-game">
            <div class="bt-icon bt-icon-sky">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <h3 class="bt-card-title">Per Game</h3>
            <p class="bt-desc">Show up and play. Join a session and pay only for the games you play — no hourly commitment needed.</p>
            <ul class="bt-bullets">
              <li>Drop-in friendly</li>
              <li>Pay per game played</li>
              <li>Join existing sessions</li>
            </ul>
            <a routerLink="/book" class="bt-book-link bt-book-sky">
              Book Now
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
            </a>
          </div>

          <!-- Hosted Play -->
          <div class="bt-card bt-hosted">
            <div class="bt-icon bt-icon-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 class="bt-card-title">Hosted Play</h3>
            <p class="bt-desc">Club-run group sessions with managed court rotation. Great for social play and meeting other members.</p>
            <ul class="bt-bullets">
              <li>Club-managed queue</li>
              <li>Automatic court rotation</li>
              <li>Open to all skill levels</li>
            </ul>
            <a routerLink="/book" class="bt-book-link bt-book-amber">
              Book Now
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
            </a>
          </div>

        </div>
      </section>

      <!-- Features -->
      <section class="features" id="features">
        <div class="features-grid">

          <div class="feature-card">
            <div class="fi">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <h3>Instant Reservations</h3>
            <p>Book any court in seconds with real-time availability.</p>
          </div>

          <div class="feature-card">
            <div class="fi">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3>Club Management</h3>
            <p>Powerful tools for members, courts, payments, and analytics.</p>
          </div>

          <div class="feature-card">
            <div class="fi">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </div>
            <h3>Tournaments</h3>
            <p>Organize and manage tournaments with ease.</p>
          </div>

          <div class="feature-card">
            <div class="fi">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="11" x="2" y="3" rx="1"/><rect width="5" height="7" x="17" y="3" rx="1"/><path d="M9 3h6M9 21h6M2 14h5M17 10h5M7 21v-1a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1"/></svg>
            </div>
            <h3>Works Everywhere</h3>
            <p>Native iOS &amp; Android apps with a seamless web experience.</p>
          </div>

        </div>
      </section>

      <!-- Reviews -->
      @if (reviews().length > 0) {
        <section class="reviews" id="reviews">
          <div class="reviews-head">
            <span class="reviews-stars-deco">★★★★★</span>
            <h2 class="reviews-title">What Our Clubs Say</h2>
            <p class="reviews-sub">Trusted by club managers across the country.</p>
          </div>

          <div class="reviews-grid">
            @for (review of reviews(); track review._id) {
              <div class="review-card">
                <div class="review-card-top">
                  <div class="review-stars">
                    @for (i of starsArray; track i) {
                      <span class="star" [class.star-filled]="i <= review.rating">★</span>
                    }
                  </div>
                  @if (review.clubLogo) {
                    <img [src]="review.clubLogo" [alt]="review.clubName" class="review-club-logo" />
                  }
                </div>
                <p class="review-text">"{{ review.text }}"</p>
                <div class="review-author">
                  <span class="review-name">{{ review.clubName }}</span>
                  @if (review.clubSlug) {
                    <a [routerLink]="['/book', review.clubSlug]" class="review-book-link">
                      Book a Court
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                    </a>
                  }
                </div>
              </div>
            }
          </div>

        </section>
      }

      <!-- CTA strip -->
      <section class="cta-strip">
        <h2>Ready to get started?</h2>
        <p>Join your club today — free for players, any sport.</p>
        <a routerLink="/register-club" class="btn-primary btn-large">Register your Club</a>
      </section>

      <!-- Footer -->
      <footer class="footer">
        <span>&copy; 2025 CourtGo</span>
        <span class="version">v{{ version }}</span>
      </footer>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .page {
      min-height: 100vh;
      background: #0a1610;
      color: #fff;
      position: relative;
      overflow-x: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* ── Background ─────────────────────────── */
    .bg-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; }

    .orb {
      position: absolute; border-radius: 50%; filter: blur(32px);
      animation: floatOrb ease-in-out infinite alternate;
    }
    .orb-1 {
      width: 560px; height: 560px; top: -180px; left: -180px;
      background: radial-gradient(circle, rgba(124,255,78,0.18) 0%, transparent 70%);
      animation-duration: 13s;
    }
    .orb-2 {
      width: 320px; height: 320px; top: 38%; right: -90px;
      background: radial-gradient(circle, rgba(124,255,78,0.12) 0%, transparent 70%);
      animation-duration: 10s; animation-delay: -4s;
    }
    .orb-3 {
      width: 220px; height: 220px; bottom: 12%; left: 22%;
      background: radial-gradient(circle, rgba(124,255,78,0.09) 0%, transparent 70%);
      animation-duration: 15s; animation-delay: -7s;
    }
    @keyframes floatOrb {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-44px) scale(1.07); }
    }

    .grid-overlay {
      position: absolute; inset: 0;
      background-image:
        repeating-linear-gradient(0deg,  rgba(124,255,78,0.032) 0, rgba(124,255,78,0.032) 1px, transparent 1px, transparent 80px),
        repeating-linear-gradient(90deg, rgba(124,255,78,0.032) 0, rgba(124,255,78,0.032) 1px, transparent 1px, transparent 80px);
    }

    /* ── Navbar ─────────────────────────────── */
    .navbar {
      position: relative; z-index: 10;
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 2.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 1rem;
    }

    .nav-logo { height: 34px; width: auto; flex-shrink: 0; }

    .nav-center {
      display: flex; align-items: center; gap: 0.75rem;
      flex: 1; justify-content: center;
    }

    .nav-search {
      display: flex; align-items: center; gap: 0.45rem;
      font-size: 0.8rem; font-weight: 600; color: #7cff4e;
      text-decoration: none;
      padding: 0.44rem 1rem;
      border: 1px solid rgba(124,255,78,0.3);
      border-radius: 100px; white-space: nowrap;
      transition: background 0.15s, border-color 0.15s;
    }
    .nav-search:hover { background: rgba(124,255,78,0.08); border-color: rgba(124,255,78,0.5); }
    .nav-search-short { display: none; }

    .nav-links { display: flex; align-items: center; gap: 0.1rem; }
    .nav-link {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 0.85rem; font-weight: 500; color: rgba(255,255,255,0.62);
      text-decoration: none; padding: 0.4rem 0.7rem; border-radius: 6px;
      white-space: nowrap; transition: color 0.15s, background 0.15s;
    }
    .nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }

    .nav-right { display: flex; align-items: center; gap: 0.65rem; flex-shrink: 0; }

    .nav-signin {
      font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.72);
      text-decoration: none; padding: 0.44rem 1rem;
      border: 1px solid rgba(255,255,255,0.14); border-radius: 8px;
      white-space: nowrap; transition: color 0.15s, border-color 0.15s;
    }
    .nav-signin:hover { color: #7cff4e; border-color: rgba(124,255,78,0.35); }

    .nav-register { font-size: 0.83rem; padding: 0.44rem 1.05rem; }

    /* ── Buttons ─────────────────────────────── */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.78rem 1.7rem;
      background: #7cff4e; color: #081209;
      font-weight: 700; font-size: 0.9rem;
      border-radius: 10px; text-decoration: none;
      letter-spacing: 0.01em;
      transition: background 0.15s, box-shadow 0.15s, transform 0.12s;
      box-shadow: 0 0 22px rgba(124,255,78,0.38), 0 4px 14px rgba(0,0,0,0.3);
    }
    .btn-primary:hover {
      background: #8fff5e;
      box-shadow: 0 0 36px rgba(124,255,78,0.58), 0 4px 18px rgba(0,0,0,0.3);
      transform: translateY(-1px);
    }

    .btn-ghost {
      display: inline-flex; align-items: center;
      padding: 0.78rem 1.7rem;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.82);
      font-weight: 600; font-size: 0.9rem;
      border-radius: 10px; text-decoration: none;
      border: 1px solid rgba(255,255,255,0.13);
      transition: background 0.15s, border-color 0.15s;
    }
    .btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.22); }

    .btn-hero { padding: 0.9rem 2rem; font-size: 0.95rem; }
    .btn-large { padding: 1rem 2.5rem; font-size: 1rem; }

    /* ── Mobile quick-links ─────────────────────── */
    .mobile-quicklinks {
      display: none;
    }

    @media (max-width: 768px) {
      .mobile-quicklinks {
        display: flex;
        position: relative; z-index: 10;
        padding: 0.55rem 1.25rem 0.7rem;
        gap: 0.6rem;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(10,22,16,0.6);
      }

      .mql-link {
        flex: 1;
        display: flex; align-items: center; justify-content: center; gap: 0.4rem;
        font-size: 0.82rem; font-weight: 600;
        color: rgba(255,255,255,0.7);
        text-decoration: none;
        padding: 0.5rem 0.75rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
      }
      .mql-link:hover {
        color: #7cff4e;
        border-color: rgba(124,255,78,0.3);
        background: rgba(124,255,78,0.05);
      }
    }

    /* ── Hero ─────────────────────────────────── */
    .hero {
      position: relative; z-index: 1;
      display: flex; align-items: center;
      padding: 4rem 3.5rem 4rem 3.5rem;
      gap: 2.5rem;
      min-height: calc(100vh - 65px);
      max-width: 1280px;
      margin: 0 auto;
    }

    .hero-left { flex: 1; min-width: 0; }

    .hero-badge {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.11em;
      text-transform: uppercase; color: rgba(255,255,255,0.7);
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.11);
      padding: 0.32rem 0.85rem; border-radius: 100px;
      margin-bottom: 1.75rem;
    }
    .badge-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #7cff4e;
      box-shadow: 0 0 7px rgba(124,255,78,0.9);
      flex-shrink: 0;
    }

    .hero-headline {
      font-size: clamp(2.4rem, 3.8vw, 4.2rem);
      font-weight: 800; line-height: 1.08;
      letter-spacing: -0.03em; color: #fff;
      margin: 0 0 1.5rem;
    }
    .accent { color: #7cff4e; display: block; }

    .hero-sub {
      font-size: 1.05rem; color: rgba(255,255,255,0.48);
      line-height: 1.72; margin: 0 0 2.5rem;
      max-width: 490px;
    }

    .hero-ctas {
      display: flex; align-items: center; gap: 1rem;
      flex-wrap: wrap; margin-bottom: 2.25rem;
    }

    .hero-proof { display: flex; align-items: center; gap: 0.85rem; }

    .avatars { display: flex; }
    .av {
      width: 34px; height: 34px; border-radius: 50%;
      border: 2px solid #0a1610;
      margin-right: -10px;
    }
    .av-1 { background: linear-gradient(135deg, #1e4a28, #3d8a48); z-index: 3; }
    .av-2 { background: linear-gradient(135deg, #2a3a22, #4a6838); z-index: 2; }
    .av-3 { background: linear-gradient(135deg, #182e1c, #2e5a34); z-index: 1; }

    .proof-text {
      font-size: 0.82rem; color: rgba(255,255,255,0.42);
      margin: 0; padding-left: 10px;
    }
    .proof-text strong { color: rgba(255,255,255,0.72); font-weight: 600; }

    /* ── Hero phones ─────────────────────────── */
    .hero-right {
      flex: 0 0 500px;
      position: relative;
      display: flex; align-items: center; justify-content: center;
      height: 560px;
      overflow: visible;
    }

    .phone-glow {
      position: absolute; width: 360px; height: 360px;
      border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(124,255,78,0.42) 0%, rgba(124,255,78,0.18) 30%, rgba(124,255,78,0.05) 60%, transparent 75%);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none; z-index: 0;
      filter: blur(8px);
    }

    .rings {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 0; pointer-events: none;
    }

    .ring {
      position: absolute; border-radius: 50%;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      border: 1px solid rgba(124,255,78,0.14);
    }
    .r1 { width: 380px; height: 380px; border-color: rgba(124,255,78,0.18); }
    .r2 { width: 480px; height: 480px; border-color: rgba(124,255,78,0.11); }
    .r3 { width: 580px; height: 580px; border-color: rgba(124,255,78,0.07); }
    .r4 { width: 680px; height: 680px; border-color: rgba(124,255,78,0.04); }

    .deco-arrows {
      position: absolute;
      right: -30px; top: 50%;
      transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 6px;
      z-index: 2;
    }

    .hero-phones {
      position: relative;
      width: 460px; height: 540px;
      z-index: 1;
    }

    .phone {
      position: absolute;
      border-radius: 36px; overflow: hidden;
      border: 1.5px solid rgba(255,255,255,0.13);
      box-shadow: 0 28px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,255,78,0.07), inset 0 1px 0 rgba(255,255,255,0.08);
    }

    .phone img {
      width: 100%; height: 100%;
      object-fit: cover; object-position: top center;
      display: block;
    }

    .phone-1 {
      width: 228px; height: 494px;
      top: 16px; left: 24px; z-index: 2;
      animation: float1 5s ease-in-out infinite alternate;
    }

    .phone-2 {
      width: 202px; height: 438px;
      top: 66px; right: 6px; z-index: 3;
      animation: float2 5s ease-in-out 2.5s infinite alternate;
    }

    @keyframes float1 {
      from { transform: rotate(-9deg) translateY(0px); }
      to   { transform: rotate(-9deg) translateY(-22px); }
    }

    @keyframes float2 {
      from { transform: rotate(6deg) translateY(0px); }
      to   { transform: rotate(6deg) translateY(-22px); }
    }

    /* ── Features ────────────────────────────── */
    .features {
      position: relative; z-index: 1;
      padding: 1.5rem 3.5rem 5rem;
      max-width: 1280px;
      margin: 0 auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .feature-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px; padding: 1.75rem 1.5rem;
      transition: border-color 0.2s, background 0.2s, transform 0.2s;
    }
    .feature-card:hover {
      border-color: rgba(124,255,78,0.22);
      background: rgba(124,255,78,0.04);
      transform: translateY(-4px);
    }

    .fi {
      width: 46px; height: 46px; border-radius: 12px;
      background: rgba(124,255,78,0.1); border: 1px solid rgba(124,255,78,0.18);
      display: flex; align-items: center; justify-content: center;
      color: #7cff4e; margin-bottom: 1.1rem; flex-shrink: 0;
    }

    .feature-card h3 {
      font-size: 1rem; font-weight: 700; color: #fff;
      margin: 0 0 0.55rem;
    }

    .feature-card p {
      font-size: 0.855rem; color: rgba(255,255,255,0.4);
      line-height: 1.65; margin: 0;
    }

    /* ── CTA strip ────────────────────────────── */
    .cta-strip {
      position: relative; z-index: 1;
      text-align: center; padding: 5rem 2rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .cta-strip h2 {
      font-size: clamp(1.75rem, 3vw, 2.5rem);
      font-weight: 800; margin: 0 0 0.75rem; color: #fff;
    }
    .cta-strip p { font-size: 1rem; color: rgba(255,255,255,0.42); margin: 0 0 2rem; }

    /* ── Footer ────────────────────────────────── */
    .footer {
      position: relative; z-index: 1;
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.25rem 3rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 0.78rem; color: rgba(255,255,255,0.24);
    }
    .version { letter-spacing: 0.06em; }

    /* ── Responsive ──────────────────────────── */
    @media (max-width: 1100px) {
      .hero { padding: 3.5rem 2rem; gap: 2rem; }
      .hero-right { flex: 0 0 430px; height: 500px; }
      .hero-phones { width: 400px; height: 480px; }
      .phone-1 { width: 200px; height: 433px; }
      .phone-2 { width: 178px; height: 385px; top: 55px; }
      .phone-glow { width: 380px; height: 380px; }
      .features { padding: 1.5rem 2rem 4.5rem; }
      .nav-link:nth-child(n+3) { display: none; }
    }

    @media (max-width: 900px) {
      .hero {
        flex-direction: column-reverse; text-align: center;
        padding: 3rem 1.5rem 2rem; min-height: auto; gap: 2rem;
      }
      .hero-sub { max-width: 100%; }
      .hero-ctas { justify-content: center; }
      .hero-proof { justify-content: center; }
      .hero-left { order: 2; }
      .hero-right { flex: none; width: 100%; height: 380px; order: 1; }
      .hero-phones { width: 360px; height: 380px; }
      .phone-1 { width: 178px; height: 385px; top: 0; left: 16px; }
      .phone-2 { width: 158px; height: 342px; top: 36px; right: 16px; }
      .phone-glow { width: 320px; height: 320px; }
      .deco-arrows { display: none; }
      .features-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .navbar { padding: 0.9rem 1.25rem; }
      .nav-center { display: none; }
      .nav-signin { display: none; }
      .footer { padding: 1rem 1.25rem; }
    }

    @media (max-width: 480px) {
      .hero { padding: 2.5rem 1rem 1.5rem; }
      .hero-right { height: 330px; }
      .hero-phones { width: 300px; height: 330px; }
      .phone-1 { width: 152px; height: 329px; left: 8px; }
      .phone-2 { width: 135px; height: 292px; right: 8px; top: 30px; }
      .phone-glow { width: 270px; height: 270px; }
      .features-grid { grid-template-columns: 1fr; }
      .features { padding: 1rem 1rem 3.5rem; }
      .cta-strip { padding: 3.5rem 1.25rem; }
    }

    /* ── Booking Types ──────────────────────────── */
    .booking-types {
      position: relative; z-index: 1;
      padding: 5rem 3.5rem;
      max-width: 1280px; margin: 0 auto;
    }

    .bt-head {
      text-align: center; margin-bottom: 3.5rem;
    }
    .bt-tag {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.11em;
      text-transform: uppercase; color: rgba(255,255,255,0.7);
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.11);
      padding: 0.32rem 0.85rem; border-radius: 100px;
      margin-bottom: 1.25rem;
    }
    .bt-title {
      font-size: clamp(1.8rem, 2.5vw, 2.6rem);
      font-weight: 800; letter-spacing: -0.025em;
      color: #fff; margin: 0 0 1rem;
    }
    .bt-sub {
      font-size: 1rem; color: rgba(255,255,255,0.48);
      line-height: 1.7; max-width: 520px; margin: 0 auto;
    }

    .bt-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
    }

    .bt-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 2rem 1.75rem;
      display: flex; flex-direction: column; gap: 1rem;
      transition: border-color 0.2s, background 0.2s, transform 0.2s;
    }
    .bt-card:hover { transform: translateY(-4px); }

    .bt-reservation { border-top: 3px solid #7cff4e; }
    .bt-reservation:hover { border-color: rgba(124,255,78,0.3); background: rgba(124,255,78,0.03); }
    .bt-per-game    { border-top: 3px solid #38bdf8; }
    .bt-per-game:hover { border-color: rgba(56,189,248,0.3); background: rgba(56,189,248,0.03); }
    .bt-hosted      { border-top: 3px solid #f59e0b; }
    .bt-hosted:hover { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.03); }

    .bt-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bt-icon-lime  { background: rgba(124,255,78,0.12); color: #7cff4e; }
    .bt-icon-sky   { background: rgba(56,189,248,0.12); color: #38bdf8; }
    .bt-icon-amber { background: rgba(245,158,11,0.12); color: #f59e0b; }

    .bt-card-title { font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0; }
    .bt-desc {
      font-size: 0.9rem; color: rgba(255,255,255,0.52);
      line-height: 1.65; margin: 0;
    }

    .bt-bullets {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 0.45rem;
    }
    .bt-bullets li {
      font-size: 0.82rem; color: rgba(255,255,255,0.42);
      padding-left: 1.1rem; position: relative;
    }
    .bt-bullets li::before { content: '·'; position: absolute; left: 0; font-size: 1rem; }

    .bt-book-link {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.82rem; font-weight: 700;
      text-decoration: none; margin-top: auto;
      padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid;
      transition: background 0.15s, box-shadow 0.15s;
      align-self: flex-start;
    }
    .bt-book-lime  { color: #7cff4e; border-color: rgba(124,255,78,0.3); }
    .bt-book-lime:hover  { background: rgba(124,255,78,0.1); }
    .bt-book-sky   { color: #38bdf8; border-color: rgba(56,189,248,0.3); }
    .bt-book-sky:hover   { background: rgba(56,189,248,0.1); }
    .bt-book-amber { color: #f59e0b; border-color: rgba(245,158,11,0.3); }
    .bt-book-amber:hover { background: rgba(245,158,11,0.1); }

    @media (max-width: 900px) {
      .bt-grid { grid-template-columns: 1fr 1fr; }
      .booking-types { padding: 3.5rem 2rem; }
    }
    @media (max-width: 600px) {
      .bt-grid { grid-template-columns: 1fr; }
      .booking-types { padding: 2.5rem 1.25rem; }
    }

    /* ── Reviews ──────────────────────────────── */
    .reviews {
      position: relative; z-index: 1;
      padding: 4rem 3.5rem 5rem;
      max-width: 1280px;
      margin: 0 auto;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .reviews-head {
      text-align: center;
      margin-bottom: 3rem;
    }

    .reviews-stars-deco {
      display: block;
      font-size: 1.4rem;
      letter-spacing: 4px;
      color: #7cff4e;
      margin-bottom: 1rem;
      filter: drop-shadow(0 0 6px rgba(124,255,78,0.5));
    }

    .reviews-title {
      font-size: clamp(1.6rem, 2.8vw, 2.2rem);
      font-weight: 800;
      color: #fff;
      margin: 0 0 0.6rem;
      letter-spacing: -0.02em;
    }

    .reviews-sub {
      font-size: 0.95rem;
      color: rgba(255,255,255,0.4);
      margin: 0;
    }

    .reviews-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .review-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 1.75rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: border-color 0.2s, background 0.2s, transform 0.2s;
    }
    .review-card:hover {
      border-color: rgba(124,255,78,0.22);
      background: rgba(124,255,78,0.04);
      transform: translateY(-3px);
    }

    .review-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.15rem;
    }
    .review-club-logo {
      height: 36px;
      width: 36px;
      object-fit: cover;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      flex-shrink: 0;
    }

    .review-stars { display: flex; gap: 2px; }
    .star { font-size: 1.1rem; color: rgba(255,255,255,0.15); }
    .star-filled { color: #7cff4e; filter: drop-shadow(0 0 4px rgba(124,255,78,0.6)); }

    .review-text {
      font-size: 0.9rem;
      color: rgba(255,255,255,0.65);
      line-height: 1.7;
      margin: 0;
      flex: 1;
    }

    .review-author {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      flex-wrap: wrap;
    }

    .review-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: #fff;
    }

    .review-book-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #7cff4e;
      text-decoration: none;
      padding: 0.25rem 0.65rem;
      border: 1px solid rgba(124,255,78,0.3);
      border-radius: 100px;
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .review-book-link:hover {
      background: rgba(124,255,78,0.08);
      border-color: rgba(124,255,78,0.55);
    }

    @media (max-width: 900px) {
      .reviews { padding: 3rem 1.5rem 4rem; }
      .reviews-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 600px) {
      .reviews { padding: 2.5rem 1rem 3rem; }
      .reviews-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class LandingComponent {
  readonly version = APP_VERSION;
  readonly starsArray = [1, 2, 3, 4, 5];

  reviews = signal<AppReview[]>([]);

  private http = inject(HttpClient);

  constructor() {
    this.http.get<AppReview[]>(`${environment.apiUrl}/public/app-reviews`)
      .subscribe({ next: r => this.reviews.set(r), error: () => {} });
  }
}
