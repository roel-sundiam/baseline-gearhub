import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Feature {
  tag: string;
  title: string;
  description: string;
  bullets: string[];
  image: string;
  alt: string;
}

@Component({
  selector: 'app-features-showcase',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">

      <div class="bg-layer">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="grid-overlay"></div>
      </div>

      <!-- Header -->
      <header class="header">
        <a routerLink="/" class="header-logo">
          <img src="/CourtGo.png" alt="CourtGo" />
        </a>
        <nav class="header-nav">
          <a routerLink="/" class="nav-link">Home</a>
          <a routerLink="/book" class="nav-link">Find Courts</a>
        </nav>
        <div class="header-ctas">
          <a href="https://app.courtgo.club/player-login" class="btn-outline">Sign In</a>
          <a routerLink="/register-club" class="btn-primary">Register for Free</a>
        </div>
      </header>

      <!-- Hero -->
      <section class="hero">
        <div class="hero-badge">
          <span class="badge-dot"></span> Full Feature Overview
        </div>
        <h1>Everything your club needs,<br><span class="accent">all in one app.</span></h1>
        <p>From court reservations to tournaments — CourtGo gives members and clubs a seamless experience on any device.</p>
        <a routerLink="/register-club" class="btn-primary btn-hero">Get Started Free</a>
      </section>

      <!-- Features -->
      <div class="features-wrapper">
        @for (feature of features; track feature.title; let i = $index) {
          <section class="feature-section" [class.reverse]="i % 2 !== 0">
            <div class="feature-phone">
              <div class="phone-wrap">
                <div class="notch"></div>
                <img [src]="feature.image" [alt]="feature.alt" />
              </div>
            </div>
            <div class="feature-content">
              <span class="feature-tag">{{ feature.tag }}</span>
              <h2>{{ feature.title }}</h2>
              <p>{{ feature.description }}</p>
              <ul>
                @for (b of feature.bullets; track b) {
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    {{ b }}
                  </li>
                }
              </ul>
            </div>
          </section>
        }
      </div>

      <!-- CTA -->
      <section class="cta">
        <h2>Ready to bring your club online?</h2>
        <p>Join CourtGo today — free for players, affordable for clubs.</p>
        <div class="cta-btns">
          <a routerLink="/register-club" class="btn-primary btn-large">Register Your Club</a>
          <a routerLink="/book" class="btn-outline btn-large">Book as Guest</a>
        </div>
      </section>

      <footer class="footer">
        <span>&copy; 2025 CourtGo</span>
        <a routerLink="/" class="footer-link">Back to Home</a>
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

    /* ── Background ─── */
    .bg-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
    .orb { position: absolute; border-radius: 50%; filter: blur(40px); animation: floatOrb ease-in-out infinite alternate; }
    .orb-1 { width: 600px; height: 600px; top: -200px; left: -200px; background: radial-gradient(circle, rgba(124,255,78,0.14) 0%, transparent 70%); animation-duration: 14s; }
    .orb-2 { width: 400px; height: 400px; bottom: 10%; right: -150px; background: radial-gradient(circle, rgba(124,255,78,0.1) 0%, transparent 70%); animation-duration: 11s; animation-delay: -5s; }
    @keyframes floatOrb { from { transform: translateY(0); } to { transform: translateY(-50px); } }
    .grid-overlay {
      position: absolute; inset: 0;
      background-image:
        repeating-linear-gradient(0deg, rgba(124,255,78,0.028) 0, rgba(124,255,78,0.028) 1px, transparent 1px, transparent 80px),
        repeating-linear-gradient(90deg, rgba(124,255,78,0.028) 0, rgba(124,255,78,0.028) 1px, transparent 1px, transparent 80px);
    }

    /* ── Header ─── */
    .header {
      position: sticky; top: 0; z-index: 50;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.9rem 3rem;
      background: rgba(10,22,16,0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255,255,255,0.07);
      gap: 1rem;
    }

    .header-logo img { height: 32px; display: block; }

    .header-nav { display: flex; gap: 0.25rem; flex: 1; justify-content: center; }
    .nav-link {
      font-size: 0.85rem; font-weight: 500; color: rgba(255,255,255,0.6);
      text-decoration: none; padding: 0.4rem 0.75rem; border-radius: 6px;
      transition: color 0.15s, background 0.15s;
    }
    .nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }

    .header-ctas { display: flex; gap: 0.65rem; flex-shrink: 0; }

    /* ── Buttons ─── */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 1.2rem; background: #7cff4e; color: #081209;
      font-weight: 700; font-size: 0.85rem; border-radius: 8px;
      text-decoration: none; transition: background 0.15s, box-shadow 0.15s, transform 0.12s;
      box-shadow: 0 0 18px rgba(124,255,78,0.35);
    }
    .btn-primary:hover { background: #8fff5e; box-shadow: 0 0 28px rgba(124,255,78,0.5); transform: translateY(-1px); }

    .btn-outline {
      display: inline-flex; align-items: center;
      padding: 0.55rem 1.2rem; color: rgba(255,255,255,0.78);
      font-weight: 600; font-size: 0.85rem; border-radius: 8px;
      text-decoration: none; border: 1px solid rgba(255,255,255,0.15);
      transition: all 0.15s;
    }
    .btn-outline:hover { color: #7cff4e; border-color: rgba(124,255,78,0.4); }

    .btn-hero { padding: 0.8rem 2rem; font-size: 0.95rem; }
    .btn-large { padding: 0.8rem 2rem; font-size: 0.95rem; }

    /* ── Hero ─── */
    .hero {
      position: relative; z-index: 1;
      text-align: center;
      padding: 6rem 2rem 4rem;
      max-width: 760px; margin: 0 auto;
    }

    .hero-badge {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: rgba(255,255,255,0.65);
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      padding: 0.3rem 0.85rem; border-radius: 100px; margin-bottom: 1.75rem;
    }
    .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #7cff4e; box-shadow: 0 0 7px rgba(124,255,78,0.9); flex-shrink: 0; }

    .hero h1 {
      font-size: clamp(2rem, 4vw, 3.4rem); font-weight: 800;
      line-height: 1.12; letter-spacing: -0.03em; color: #fff;
      margin: 0 0 1.25rem;
    }
    .accent { color: #7cff4e; }

    .hero p { font-size: 1.05rem; color: rgba(255,255,255,0.48); line-height: 1.7; margin: 0 0 2.25rem; }

    /* ── Features wrapper ─── */
    .features-wrapper {
      position: relative; z-index: 1;
      max-width: 1200px; margin: 0 auto;
      padding: 0 2rem 4rem;
    }

    .feature-section {
      display: flex; align-items: center; gap: 5rem;
      padding: 5rem 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .feature-section:last-child { border-bottom: none; }
    .feature-section.reverse { flex-direction: row-reverse; }

    /* ── Phone mockup ─── */
    .feature-phone { flex: 0 0 auto; }

    .phone-wrap {
      width: 240px; height: 520px;
      background: #0f1e14;
      border-radius: 38px;
      border: 1.5px solid rgba(255,255,255,0.12);
      overflow: hidden;
      position: relative;
      box-shadow: 0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(124,255,78,0.06), inset 0 1px 0 rgba(255,255,255,0.07);
    }

    .notch {
      position: absolute; top: 10px; left: 50%;
      transform: translateX(-50%);
      width: 80px; height: 24px;
      background: #0a1610;
      border-radius: 100px;
      z-index: 10;
    }

    .phone-wrap img {
      width: 100%; height: 100%;
      object-fit: cover; object-position: top center;
      display: block;
    }

    /* ── Feature content ─── */
    .feature-content { flex: 1; min-width: 0; }

    .feature-tag {
      display: inline-block;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #7cff4e;
      background: rgba(124,255,78,0.08); border: 1px solid rgba(124,255,78,0.18);
      padding: 0.28rem 0.7rem; border-radius: 100px;
      margin-bottom: 1.1rem;
    }

    .feature-content h2 {
      font-size: clamp(1.6rem, 2.5vw, 2.4rem);
      font-weight: 800; line-height: 1.15;
      letter-spacing: -0.025em; color: #fff;
      margin: 0 0 1rem;
    }

    .feature-content p {
      font-size: 1rem; color: rgba(255,255,255,0.5);
      line-height: 1.72; margin: 0 0 1.75rem; max-width: 480px;
    }

    .feature-content ul {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 0.65rem;
    }

    .feature-content li {
      display: flex; align-items: center; gap: 0.65rem;
      font-size: 0.9rem; color: rgba(255,255,255,0.7); font-weight: 500;
    }

    .feature-content li svg { color: #7cff4e; flex-shrink: 0; }

    /* ── CTA ─── */
    .cta {
      position: relative; z-index: 1;
      text-align: center; padding: 6rem 2rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(to bottom, transparent, rgba(124,255,78,0.04));
    }
    .cta h2 { font-size: clamp(1.75rem, 3vw, 2.5rem); font-weight: 800; margin: 0 0 0.75rem; color: #fff; }
    .cta p { font-size: 1rem; color: rgba(255,255,255,0.45); margin: 0 0 2rem; }
    .cta-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

    /* ── Footer ─── */
    .footer {
      position: relative; z-index: 1;
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.25rem 3rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 0.78rem; color: rgba(255,255,255,0.24);
    }
    .footer-link { color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.15s; }
    .footer-link:hover { color: #7cff4e; }

    /* ── Responsive ─── */
    @media (max-width: 900px) {
      .feature-section, .feature-section.reverse { flex-direction: column; gap: 2.5rem; padding: 3.5rem 1rem; }
      .header { padding: 0.9rem 1.25rem; }
      .header-nav { display: none; }
      .features-wrapper { padding: 0 0.5rem 2rem; }
    }

    @media (max-width: 600px) {
      .hero { padding: 4rem 1.25rem 3rem; }
      .phone-wrap { width: 200px; height: 433px; }
      .footer { padding: 1rem 1.25rem; }
      .cta { padding: 4rem 1.25rem; }
    }
  `],
})
export class FeaturesShowcaseComponent {
  readonly features: Feature[] = [
    {
      tag: 'Home Base',
      title: 'Your personal dashboard',
      description: 'See everything that matters the moment you open the app — upcoming bookings, quick shortcuts, open sessions, and club updates — all beautifully organized.',
      bullets: [
        'Upcoming booking with one-tap access',
        'Quick action shortcuts for common tasks',
        'Club hours and court availability at a glance',
        'Notifications and club announcements',
      ],
      image: '/features/dashboard.png',
      alt: 'CourtGo player dashboard',
    },
    {
      tag: 'Court Booking',
      title: 'Reserve courts in seconds',
      description: 'Pick a date, select your court, and you\'re done. Add a playing partner, toggle court lights, and include non-member guests — all from one clean form.',
      bullets: [
        'Date picker with real-time availability',
        'Select court by name',
        'Invite members from a searchable list',
        'Light rental & guest add-on options',
      ],
      image: '/features/reserve.png',
      alt: 'CourtGo reserve a court',
    },
    {
      tag: 'Reservations',
      title: 'All bookings in one place',
      description: 'Club admins see every confirmed booking across all courts — with date, time, player name, and status. Members can view and manage their own upcoming and past reservations.',
      bullets: [
        'Table and calendar view toggle',
        'Filter by court or date',
        'Confirmed, cancelled, and past bookings',
        'Edit or cancel any reservation instantly',
      ],
      image: '/features/reservations.png',
      alt: 'CourtGo court reservations',
    },
    {
      tag: 'Open Play',
      title: 'Join community sessions',
      description: 'Open play sessions let members drop in, play with fellow members, and build their competitive rating. Separate sessions for pickleball, tennis, and more.',
      bullets: [
        'Browse available sessions by sport',
        'View your own session history',
        'CRI leaderboard and rankings',
        'Admin-created skill-balanced sessions',
      ],
      image: '/features/open-play.png',
      alt: 'CourtGo open play',
    },
    {
      tag: 'Payment Process',
      title: 'Seamless payment approvals',
      description: 'Players submit GCash or cash payments directly in the app. Admins review, approve, or reject submissions with a full audit trail — 104 payments processed and counting.',
      bullets: [
        '0 pending · 104 approved · 2 rejected',
        'GCash and cash payment support',
        'Per-booking charge breakdown',
        'Instant approval notifications',
      ],
      image: '/features/payment-approvals.png',
      alt: 'CourtGo payment approvals',
    },
    {
      tag: 'Member Management',
      title: 'Grow and manage your roster',
      description: 'Admins get a full member control panel — approve new registrations, manage 39+ active members, and review pending applications with one tap.',
      bullets: [
        '41 total · 39 active · 2 pending approval',
        'Approve or reject new registrations',
        'View member profiles and contact info',
        'Search and filter the full roster',
      ],
      image: '/features/admin-users.png',
      alt: 'CourtGo member management',
    },
    {
      tag: 'Guest Access',
      title: 'Book without an account',
      description: 'Not a member yet? Guests can browse all clubs and book courts instantly — no registration required. The perfect way to try a club before joining.',
      bullets: [
        'Search any club by name or location',
        'No login required to browse and book',
        'Supports multiple clubs and sports',
        'Seamless upgrade path to membership',
      ],
      image: '/features/book.png',
      alt: 'CourtGo guest booking',
    },
  ];
}
