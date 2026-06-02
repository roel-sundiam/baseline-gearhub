import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_VERSION } from '../../version';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">

      <!-- Animated background -->
      <div class="bg-layer">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <div class="grid-overlay"></div>
      </div>

      <!-- Navbar -->
      <header class="navbar">
        <img src="/CourtGo.png" alt="CourtGo" class="nav-logo" />
        <a routerLink="/book" class="nav-find">Search Courts / Clubs</a>
        <a routerLink="/login" class="nav-signin">Sign In</a>
      </header>

      <!-- Hero -->
      <section class="hero">
        <div class="hero-inner">
          <span class="hero-badge">Racket Sports Club Platform</span>
          <h1 class="hero-headline">
            The modern way to<br>
            <span class="accent">manage &amp; book courts.</span>
          </h1>
          <p class="hero-sub">
            Real-time reservations, club management, tournaments, and live support —
            all in one place. For tennis, pickleball, squash, and more.
          </p>
          <div class="hero-ctas">
            <a routerLink="/register-club" class="btn-primary">Register for Free</a>
            <a routerLink="/login" class="btn-ghost">Sign In &rarr;</a>
            <a routerLink="/book" class="btn-guest">Book as Guest</a>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features">
        <div class="features-grid">

          <div class="feature-card">
            <div class="feature-icon">&#127922;</div>
            <h3>Instant Reservations</h3>
            <p>Book any court in seconds — tennis, pickleball, squash, or padel — with real-time availability.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">&#127970;</div>
            <h3>Club Management</h3>
            <p>Full admin tools for members, courts, rates, sessions, payments, and analytics.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">&#128241;</div>
            <h3>Works on Any Device</h3>
            <p>Native iOS and Android apps alongside a full-featured web experience.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">&#128172;</div>
            <h3>Live Support Chat</h3>
            <p>Built-in inquiry and live chat so members can reach club staff instantly.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">&#127941;</div>
            <h3>Tournaments</h3>
            <p>Organize and manage tournaments with brackets, results, and member sign-ups — any sport.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">&#128200;</div>
            <h3>Finance &amp; Analytics</h3>
            <p>Track payments, revenue, and court utilization across all your sports with a clear dashboard.</p>
          </div>

        </div>
      </section>

      <!-- CTA strip -->
      <section class="cta-strip">
        <h2>Ready to get started?</h2>
        <p>Join your club today — free for players, any sport.</p>
        <a routerLink="/register-club" class="btn-primary btn-large">Register for Free</a>
      </section>

      <!-- Footer -->
      <footer class="footer">
        <span>&copy; 2025 CourtGo</span>
        <span class="version">v{{ version }}</span>
      </footer>

    </div>
  `,
  styles: [`
    /* ── Reset & page ───────────────────────────────────── */
    :host { display: block; }

    .page {
      min-height: 100vh;
      background: var(--dm-bg, #0c1a11);
      color: #fff;
      position: relative;
      overflow-x: hidden;
    }

    /* ── Animated background ─────────────────────────────── */
    .bg-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    .orb {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, rgba(163,230,53,0.5), rgba(163,230,53,0.04));
      filter: blur(22px);
      animation: float ease-in-out infinite alternate;
    }
    .orb-1 { width: 360px; height: 360px; top: -80px; left: -100px; opacity: 0.22; animation-duration: 11s; }
    .orb-2 { width: 240px; height: 240px; top: 35%; right: -60px; opacity: 0.16; animation-duration: 8s; animation-delay: -3s; }
    .orb-3 { width: 160px; height: 160px; bottom: 10%; left: 20%; opacity: 0.14; animation-duration: 13s; animation-delay: -6s; }

    @keyframes float {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-36px) scale(1.08); }
    }

    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image:
        repeating-linear-gradient(0deg,   rgba(163,230,53,0.045) 0, rgba(163,230,53,0.045) 1px, transparent 1px, transparent 80px),
        repeating-linear-gradient(90deg,  rgba(163,230,53,0.045) 0, rgba(163,230,53,0.045) 1px, transparent 1px, transparent 80px);
    }

    /* ── Navbar ──────────────────────────────────────────── */
    .navbar {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 3rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .nav-logo {
      height: 36px;
      width: auto;
    }

    .nav-find {
      font-size: 0.875rem;
      font-weight: 600;
      color: #a3e635;
      text-decoration: none;
      padding: 0.5rem 1.1rem;
      border: 1px solid rgba(163,230,53,0.28);
      border-radius: 8px;
      margin-right: 0.5rem;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .nav-find:hover {
      background: rgba(163,230,53,0.08);
      border-color: rgba(163,230,53,0.5);
    }

    .nav-signin {
      font-size: 0.875rem;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      text-decoration: none;
      padding: 0.5rem 1.1rem;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .nav-signin:hover {
      color: #a3e635;
      border-color: rgba(163,230,53,0.35);
      background: rgba(163,230,53,0.06);
    }

    /* ── Hero ────────────────────────────────────────────── */
    .hero {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: center;
      padding: 6rem 2rem 5rem;
      text-align: center;
    }

    .hero-inner {
      max-width: 720px;
    }

    .hero-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #a3e635;
      background: rgba(163,230,53,0.1);
      border: 1px solid rgba(163,230,53,0.22);
      padding: 0.35rem 1rem;
      border-radius: 100px;
      margin-bottom: 1.75rem;
    }

    .hero-headline {
      font-size: clamp(2.4rem, 5vw, 3.8rem);
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: -0.025em;
      color: #fff;
      margin: 0 0 1.5rem;
    }
    .hero-headline .accent { color: #a3e635; }

    .hero-sub {
      font-size: 1.1rem;
      color: rgba(255,255,255,0.5);
      line-height: 1.7;
      margin: 0 auto 2.5rem;
      max-width: 560px;
    }

    .hero-ctas {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* ── Buttons ─────────────────────────────────────────── */
    .btn-primary {
      display: inline-block;
      padding: 0.85rem 2rem;
      background: #a3e635;
      color: #0c1a11;
      font-weight: 700;
      font-size: 0.95rem;
      border-radius: 10px;
      text-decoration: none;
      letter-spacing: 0.02em;
      transition: background 0.15s, box-shadow 0.15s, transform 0.12s;
      box-shadow: 0 4px 20px rgba(163,230,53,0.3);
    }
    .btn-primary:hover {
      background: #b5f040;
      box-shadow: 0 6px 28px rgba(163,230,53,0.45);
      transform: translateY(-1px);
    }
    .btn-large {
      padding: 1rem 2.5rem;
      font-size: 1rem;
    }

    .btn-ghost {
      display: inline-block;
      padding: 0.85rem 1.75rem;
      color: rgba(255,255,255,0.75);
      font-weight: 600;
      font-size: 0.95rem;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      text-decoration: none;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .btn-ghost:hover {
      color: #a3e635;
      border-color: rgba(163,230,53,0.35);
      background: rgba(163,230,53,0.06);
    }

    .btn-guest {
      display: inline-block;
      padding: 0.85rem 1.75rem;
      color: rgba(255,255,255,0.5);
      font-weight: 600;
      font-size: 0.95rem;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      text-decoration: none;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-guest:hover {
      color: #a3e635;
      border-color: rgba(163,230,53,0.3);
    }

    /* ── Features ────────────────────────────────────────── */
    .features {
      position: relative;
      z-index: 1;
      padding: 2rem 2rem 5rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
    }

    .feature-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 1.75rem 1.5rem;
      transition: border-color 0.2s, background 0.2s;
    }
    .feature-card:hover {
      border-color: rgba(163,230,53,0.2);
      background: rgba(163,230,53,0.04);
    }

    .feature-icon {
      font-size: 1.75rem;
      margin-bottom: 1rem;
    }

    .feature-card h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.6rem;
    }

    .feature-card p {
      font-size: 0.875rem;
      color: rgba(255,255,255,0.45);
      line-height: 1.65;
      margin: 0;
    }

    /* ── CTA strip ───────────────────────────────────────── */
    .cta-strip {
      position: relative;
      z-index: 1;
      text-align: center;
      padding: 5rem 2rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .cta-strip h2 {
      font-size: clamp(1.75rem, 3vw, 2.5rem);
      font-weight: 800;
      margin: 0 0 0.75rem;
      color: #fff;
    }

    .cta-strip p {
      font-size: 1rem;
      color: rgba(255,255,255,0.45);
      margin: 0 0 2rem;
    }

    /* ── Footer ──────────────────────────────────────────── */
    .footer {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 3rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 0.78rem;
      color: rgba(255,255,255,0.25);
    }

    .version { letter-spacing: 0.06em; }

    /* ── Mobile ──────────────────────────────────────────── */
    @media (max-width: 768px) {
      .navbar { padding: 1rem 1.25rem; }

      .hero { padding: 4rem 1.25rem 3.5rem; }

      .features { padding: 1.5rem 1.25rem 4rem; }
      .features-grid { grid-template-columns: 1fr; gap: 1rem; }

      .cta-strip { padding: 3.5rem 1.25rem; }

      .footer { padding: 1rem 1.25rem; }
    }

    @media (min-width: 769px) and (max-width: 1024px) {
      .features-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class LandingComponent {
  readonly version = APP_VERSION;
}
