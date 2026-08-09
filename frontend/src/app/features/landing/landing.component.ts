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

interface PublicSponsor {
  _id: string;
  businessName: string;
  logoUrl: string;
  description: string;
  promoText?: string;
  link: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="ambient" aria-hidden="true">
        <span class="glow glow-one"></span>
        <span class="glow glow-two"></span>
        <span class="court-lines"></span>
      </div>

      <header class="site-header">
        <div class="nav-shell">
          <a routerLink="/" class="brand" aria-label="CourtGo home">
            <img src="/CourtGo.png" alt="CourtGo" />
          </a>

          <nav class="desktop-nav" aria-label="Main navigation">
            <a href="#play-options">Ways to play</a>
            <a href="#platform">Platform</a>
            <a routerLink="/features">All features</a>
          </nav>

          <div class="nav-actions">
            <a routerLink="/book" class="nav-discover">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              <span>Find a club</span>
            </a>
            <a routerLink="/player-login" class="nav-login">Player login</a>
            <a routerLink="/register-club" class="button button-primary nav-club">
              <span class="nav-club-long">Register your club</span>
              <span class="nav-club-short">For clubs</span>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section class="hero section-shell">
          <div class="hero-copy">
            <div class="eyebrow">
              <span class="eyebrow-mark"></span>
              The complete racket-sports platform
            </div>

            <h1>More court time.<br><span>Less admin.</span></h1>
            <p class="hero-lead">
              CourtGo brings reservations, player communities, payments, club operations,
              and official DUPR workflows into one polished experience.
            </p>

            <div class="hero-actions">
              <a routerLink="/book" class="button button-primary button-large">
                Find a court
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </a>
              <a routerLink="/register-club" class="button button-secondary button-large">Grow your club</a>
            </div>

            <div class="hero-trust" aria-label="CourtGo highlights">
              <div class="trust-item">
                <strong>3</strong>
                <span>flexible play modes</span>
              </div>
              <div class="trust-divider"></div>
              <div class="trust-item">
                <strong>Live</strong>
                <span>court availability</span>
              </div>
              <div class="trust-divider"></div>
              <div class="trust-item">
                <strong>DUPR</strong>
                <span>official integration</span>
              </div>
            </div>
          </div>

          <div class="hero-visual" aria-label="CourtGo mobile application preview">
            <div class="visual-grid" aria-hidden="true"></div>
            <div class="visual-halo" aria-hidden="true"></div>

            <div class="floating-card floating-card-top">
              <span class="floating-icon floating-icon-lime">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
              </span>
              <span><small>Booking status</small><strong>Court confirmed</strong></span>
            </div>

            <div class="phone-stack">
              <div class="phone phone-back">
                <span class="phone-speaker"></span>
                <img src="/mockup-courts.png" alt="CourtGo find courts screen" />
              </div>
              <div class="phone phone-front">
                <span class="phone-speaker"></span>
                <img src="/mockup-home.png" alt="CourtGo player home screen" />
              </div>
            </div>

            <div class="floating-card floating-card-bottom">
              <span class="floating-icon floating-icon-sky">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M17 8H9.5a3.5 3.5 0 1 0 0 7H15a3 3 0 1 1 0 6H6"/></svg>
              </span>
              <span><small>Club operations</small><strong>Payments organized</strong></span>
            </div>
          </div>
        </section>

        <section class="confidence-bar" aria-label="Supported sports and access">
          <div class="section-shell confidence-inner">
            <p>One platform for the whole club</p>
            <div class="confidence-items">
              <span><i></i>Tennis</span>
              <span><i></i>Pickleball</span>
              <span><i></i>Badminton</span>
              <span><i></i>Padel</span>
              <span><i></i>Squash</span>
            </div>
          </div>
        </section>

        <section class="play-options section-shell" id="play-options">
          <div class="section-heading">
            <div>
              <span class="section-kicker">Built around how people play</span>
              <h2>Choose the experience that fits.</h2>
            </div>
            <p>Whether players plan ahead, drop in, or join a club-led session, CourtGo keeps every step simple.</p>
          </div>

          <div class="experience-grid">
            <article class="experience-card card-reservation">
              <div class="experience-media">
                <img src="/images/landing/reservation-experience.jpg" alt="Players confirming a pickleball court reservation" loading="lazy" decoding="async" />
                <span class="experience-number">01</span>
                <span class="experience-label">Plan ahead</span>
              </div>
              <div class="experience-body">
                <div class="experience-title-row">
                  <span class="experience-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18m-12 5 2 2 4-4"/></svg>
                  </span>
                  <div><small>Book by court and time</small><h3>Reservation</h3></div>
                </div>
                <p>See live availability, select the exact court and time, and get confirmation in seconds.</p>
                <ul>
                  <li>Real-time schedule</li>
                  <li>Instant confirmation</li>
                  <li>Easy booking management</li>
                </ul>
                <a routerLink="/book" class="text-link">Reserve a court <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
              </div>
            </article>

            <article class="experience-card card-per-game">
              <div class="experience-media">
                <img src="/images/landing/per-game-experience.jpg" alt="A social pickleball doubles game" loading="lazy" decoding="async" />
                <span class="experience-number">02</span>
                <span class="experience-label">Drop in and play</span>
              </div>
              <div class="experience-body">
                <div class="experience-title-row">
                  <span class="experience-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"/></svg>
                  </span>
                  <div><small>Pay for what you play</small><h3>Per Game</h3></div>
                </div>
                <p>Join a session when it suits you and pay only for the games you actually play.</p>
                <ul>
                  <li>Flexible drop-in access</li>
                  <li>Simple game tracking</li>
                  <li>No hourly commitment</li>
                </ul>
                <a routerLink="/book" class="text-link">Find a game <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
              </div>
            </article>

            <article class="experience-card card-hosted">
              <div class="experience-media">
                <img src="/images/landing/hosted-play-experience.jpg" alt="A host welcoming players to a group pickleball session" loading="lazy" decoding="async" />
                <span class="experience-number">03</span>
                <span class="experience-label">Play together</span>
              </div>
              <div class="experience-body">
                <div class="experience-title-row">
                  <span class="experience-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                  <div><small>Club-led social sessions</small><h3>Hosted Play</h3></div>
                </div>
                <p>Bring your community together with check-in, queues, and court rotation managed in one flow.</p>
                <ul>
                  <li>Smart player queue</li>
                  <li>Managed court rotation</li>
                  <li>Skill-friendly sessions</li>
                </ul>
                <a routerLink="/book" class="text-link">Join hosted play <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
              </div>
            </article>
          </div>
        </section>

        <section class="platform section-shell" id="platform">
          <div class="platform-intro">
            <span class="section-kicker">More than booking software</span>
            <h2>Run the club.<br><span>Build the community.</span></h2>
            <p>Every tool shares one source of truth, so staff spend less time reconciling details and more time improving the player experience.</p>
            <a routerLink="/features" class="button button-secondary">Explore all features</a>
          </div>

          <div class="platform-grid">
            <article class="platform-card platform-card-wide">
              <span class="platform-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></svg>
              </span>
              <div><h3>Clear club operations</h3><p>Payments, reports, member activity, and court performance stay organized and visible.</p></div>
              <span class="mini-chart" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
            </article>

            <article class="platform-card">
              <span class="platform-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87"/></svg>
              </span>
              <h3>Member management</h3>
              <p>Welcome, approve, communicate with, and support your entire roster.</p>
            </article>

            <article class="platform-card platform-card-dupr">
              <span class="official-chip">Official integration</span>
              <span class="platform-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="m15.5 13 1.5 9-5-3-5 3 1.5-9"/></svg>
              </span>
              <h3>DUPR-ready play</h3>
              <p>Connect competitive sessions and official player ratings without fragmented workflows.</p>
            </article>

            <article class="platform-card">
              <span class="platform-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="m9 15 2 2 4-4"/></svg>
              </span>
              <h3>Tournaments and events</h3>
              <p>Turn interest into participation with structured, easy-to-manage events.</p>
            </article>

            <article class="platform-card platform-card-wide platform-card-access">
              <div>
                <span class="platform-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M9 6h6M11 18h2"/></svg>
                </span>
                <h3>One experience on every screen</h3>
                <p>Players and staff get a fast, focused workflow on desktop, tablet, or mobile.</p>
              </div>
              <div class="device-pills" aria-label="Supported devices"><span>Web</span><span>Tablet</span><span>Mobile</span></div>
            </article>
          </div>
        </section>

        <section class="how-it-works section-shell">
          <div class="section-heading compact-heading">
            <div><span class="section-kicker">Simple from the first tap</span><h2>Get on court in three steps.</h2></div>
          </div>
          <div class="steps">
            <article><span>1</span><div><h3>Find your club</h3><p>Browse nearby clubs and see the ways you can play.</p></div></article>
            <i class="step-line" aria-hidden="true"></i>
            <article><span>2</span><div><h3>Choose your session</h3><p>Reserve a court, join per game, or enter hosted play.</p></div></article>
            <i class="step-line" aria-hidden="true"></i>
            <article><span>3</span><div><h3>Show up and play</h3><p>Everything you need is confirmed and ready in CourtGo.</p></div></article>
          </div>
        </section>

        @if (reviews().length > 0) {
          <section class="reviews-wrap">
            <div class="section-shell reviews">
              <div class="reviews-heading">
                <span class="section-kicker">From the community</span>
                <h2>Trusted where it matters—at the club.</h2>
              </div>
              <div class="reviews-grid">
                @for (review of reviews(); track review._id) {
                  <article class="review-card">
                    <div class="review-top">
                      <div class="review-stars" [attr.aria-label]="review.rating + ' out of 5 stars'">
                        @for (i of starsArray; track i) { <span [class.muted]="i > review.rating">★</span> }
                      </div>
                      <svg class="quote-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 11H6.5A3.5 3.5 0 0 0 3 14.5V18h7v-7Zm11 0h-3.5a3.5 3.5 0 0 0-3.5 3.5V18h7v-7Z"/></svg>
                    </div>
                    <p>“{{ review.text }}”</p>
                    <div class="review-author">
                      @if (review.clubLogo) { <img [src]="review.clubLogo" [alt]="review.clubName + ' logo'" /> }
                      <div><strong>{{ review.clubName }}</strong><span>Verified CourtGo club</span></div>
                      @if (review.clubSlug) { <a [routerLink]="['/book', review.clubSlug]" aria-label="Book at this club">Visit <span>↗</span></a> }
                    </div>
                  </article>
                }
              </div>
            </div>
          </section>
        }

        @if (sponsors().length > 0) {
          <section class="partners section-shell" id="partners">
            <div class="partners-heading">
              <span>Community partners</span>
              <p>Local businesses supporting more play.</p>
            </div>
            <div class="partner-list">
              @for (sponsor of sponsors(); track sponsor._id) {
                <a [href]="sponsor.link" target="_blank" rel="noopener" class="partner-item">
                  <img [src]="sponsor.logoUrl" [alt]="sponsor.businessName" />
                  <span><strong>{{ sponsor.businessName }}</strong><small>{{ sponsor.promoText || sponsor.description }}</small></span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
                </a>
              }
            </div>
            <a routerLink="/partner-with-us" class="partner-cta">Partner with CourtGo</a>
          </section>
        }

        <section class="final-cta section-shell">
          <div class="cta-content">
            <span class="section-kicker">Your next game starts here</span>
            <h2>Ready to spend more time on court?</h2>
            <p>Find a club to play at today, or bring your entire club onto one modern platform.</p>
            <div class="cta-actions">
              <a routerLink="/book" class="button button-primary button-large">Find a court</a>
              <a routerLink="/register-club" class="button button-light button-large">Register your club</a>
            </div>
          </div>
          <div class="cta-ball" aria-hidden="true"><span></span></div>
        </section>
      </main>

      <footer class="footer">
        <div class="section-shell footer-inner">
          <div class="footer-brand"><img src="/CourtGo.png" alt="CourtGo" /><p>More court time. Less admin.</p></div>
          <nav aria-label="Footer navigation"><a routerLink="/book">Find clubs</a><a routerLink="/features">Features</a><a routerLink="/player-login">Player login</a><a routerLink="/partner-with-us">Partners</a></nav>
          <div class="footer-meta"><span>© 2026 CourtGo</span><span>v{{ version }}</span></div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; }
    *, *::before, *::after { box-sizing: border-box; }

    .page {
      --green-950: #06160d;
      --green-900: #0a2114;
      --green-850: #0e2a1a;
      --green-800: #123521;
      --green-700: #1c4a2c;
      --lime: #8ce61a;
      --lime-bright: #a4f52d;
      --mint: #bdf7c9;
      --sky: #66d6dd;
      --amber: #ffc66b;
      --paper: #f4f8f2;
      --muted: #9cb1a3;
      min-height: 100vh;
      overflow: hidden;
      position: relative;
      color: var(--paper);
      background: var(--green-950);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    a { color: inherit; }
    svg { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .section-shell { width: min(1240px, calc(100% - 64px)); margin-inline: auto; position: relative; z-index: 1; }

    .ambient { position: absolute; inset: 0 0 auto; height: 980px; pointer-events: none; overflow: hidden; }
    .glow { position: absolute; border-radius: 999px; filter: blur(4px); }
    .glow-one { width: 700px; height: 700px; top: -330px; right: -160px; background: radial-gradient(circle, rgba(83, 169, 65, .22), transparent 68%); }
    .glow-two { width: 520px; height: 520px; top: 350px; left: -280px; background: radial-gradient(circle, rgba(140, 230, 26, .1), transparent 70%); }
    .court-lines { position: absolute; width: 670px; height: 670px; right: -170px; top: 80px; opacity: .11; transform: rotate(-14deg); border: 1px solid var(--lime); border-radius: 30px; }
    .court-lines::before, .court-lines::after { content: ''; position: absolute; background: var(--lime); }
    .court-lines::before { width: 1px; height: 100%; left: 50%; }
    .court-lines::after { height: 1px; width: 100%; top: 50%; }

    .site-header { position: sticky; top: 0; z-index: 50; background: rgba(6, 22, 13, .86); border-bottom: 1px solid rgba(190, 244, 183, .1); backdrop-filter: blur(18px); }
    .nav-shell { width: min(1320px, calc(100% - 48px)); height: 76px; margin: auto; display: flex; align-items: center; gap: 36px; }
    .brand { display: inline-flex; flex: 0 0 auto; }
    .brand img { display: block; height: 36px; width: auto; }
    .desktop-nav { display: flex; gap: 6px; margin-left: auto; }
    .desktop-nav a, .nav-login { padding: 10px 12px; color: #b7c8bc; font-size: .84rem; font-weight: 650; text-decoration: none; transition: color .2s, background .2s; border-radius: 10px; }
    .desktop-nav a:hover, .nav-login:hover { color: #fff; background: rgba(255, 255, 255, .05); }
    .nav-actions { display: flex; align-items: center; gap: 8px; }
    .nav-discover { display: inline-flex; align-items: center; gap: 8px; padding: 10px 13px; border: 1px solid rgba(164, 245, 45, .22); border-radius: 10px; text-decoration: none; color: var(--lime-bright); font-size: .82rem; font-weight: 750; }
    .nav-discover svg { width: 16px; height: 16px; }
    .nav-club-short { display: none; }

    .button { min-height: 44px; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; border: 1px solid transparent; border-radius: 11px; font-size: .86rem; font-weight: 800; text-decoration: none; transition: transform .2s, box-shadow .2s, background .2s, border-color .2s; }
    .button:hover { transform: translateY(-2px); }
    .button svg { width: 18px; height: 18px; }
    .button-primary { background: linear-gradient(135deg, var(--lime-bright), #79da0d); color: #10200d; box-shadow: 0 10px 28px rgba(122, 218, 13, .18); }
    .button-primary:hover { box-shadow: 0 14px 34px rgba(122, 218, 13, .28); }
    .button-secondary { color: #eff7ed; border-color: rgba(226, 246, 220, .2); background: rgba(255, 255, 255, .045); }
    .button-secondary:hover { border-color: rgba(164, 245, 45, .45); background: rgba(164, 245, 45, .07); }
    .button-light { color: var(--green-900); background: #eef6eb; }
    .button-large { min-height: 52px; padding-inline: 23px; border-radius: 13px; font-size: .93rem; }

    .hero { min-height: 720px; padding-block: 82px 72px; display: grid; grid-template-columns: minmax(0, .95fr) minmax(500px, 1.05fr); align-items: center; gap: 46px; }
    .hero-copy { max-width: 640px; }
    .eyebrow, .section-kicker { color: var(--lime-bright); font-size: .73rem; font-weight: 850; text-transform: uppercase; letter-spacing: .14em; }
    .eyebrow { display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid rgba(164, 245, 45, .18); background: rgba(164, 245, 45, .06); border-radius: 999px; }
    .eyebrow-mark { width: 7px; height: 7px; border-radius: 50%; background: var(--lime-bright); box-shadow: 0 0 0 5px rgba(164, 245, 45, .1); }
    .hero h1 { margin: 24px 0 22px; color: #f8fbf6; font-size: clamp(3.35rem, 5.6vw, 5.65rem); line-height: .94; letter-spacing: -.065em; font-weight: 880; }
    .hero h1 span { color: var(--lime-bright); }
    .hero-lead { max-width: 590px; margin: 0; color: #adbfaf; font-size: clamp(1rem, 1.45vw, 1.14rem); line-height: 1.7; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 30px; }
    .hero-trust { display: flex; align-items: center; gap: 19px; margin-top: 38px; }
    .trust-item { display: grid; gap: 2px; }
    .trust-item strong { color: #f4f9f1; font-size: .9rem; }
    .trust-item span { color: #78907f; font-size: .68rem; }
    .trust-divider { width: 1px; height: 28px; background: rgba(255, 255, 255, .12); }

    .hero-visual { height: 570px; position: relative; display: grid; place-items: center; }
    .visual-grid { position: absolute; inset: 7% 2% 3% 5%; border-radius: 46% 46% 30px 30px; background-image: linear-gradient(rgba(164,245,45,.075) 1px, transparent 1px), linear-gradient(90deg, rgba(164,245,45,.075) 1px, transparent 1px); background-size: 44px 44px; mask-image: linear-gradient(to bottom, #000 45%, transparent 95%); }
    .visual-halo { position: absolute; width: 440px; height: 440px; border-radius: 50%; background: radial-gradient(circle, rgba(140, 230, 26, .22), rgba(23, 84, 45, .1) 52%, transparent 70%); }
    .phone-stack { position: relative; width: 420px; height: 540px; }
    .phone { position: absolute; width: 226px; height: 490px; padding: 7px; overflow: hidden; border: 1px solid rgba(230, 250, 226, .28); border-radius: 36px; background: #12301d; box-shadow: 0 28px 70px rgba(1, 16, 8, .45), inset 0 0 0 1px rgba(255, 255, 255, .08); }
    .phone img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: top; border-radius: 29px; }
    .phone-speaker { position: absolute; top: 14px; left: 50%; z-index: 2; width: 76px; height: 20px; transform: translateX(-50%); border-radius: 999px; background: var(--green-950); }
    .phone-back { top: 26px; left: 23px; transform: rotate(-8deg); opacity: .82; }
    .phone-front { right: 16px; top: 8px; transform: rotate(5deg); }
    .floating-card { position: absolute; z-index: 4; min-width: 190px; padding: 11px 14px; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(222, 246, 216, .18); border-radius: 14px; background: rgba(14, 42, 26, .88); box-shadow: 0 20px 45px rgba(3, 20, 10, .3); backdrop-filter: blur(14px); }
    .floating-card-top { top: 62px; right: -5px; }
    .floating-card-bottom { bottom: 55px; left: -15px; }
    .floating-card > span:last-child { display: grid; gap: 2px; }
    .floating-card small { color: #829a88; font-size: .62rem; }
    .floating-card strong { color: #eff8ed; font-size: .76rem; }
    .floating-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; }
    .floating-icon svg { width: 17px; height: 17px; stroke-width: 2.2; }
    .floating-icon-lime { color: var(--lime-bright); background: rgba(164, 245, 45, .12); }
    .floating-icon-sky { color: var(--sky); background: rgba(102, 214, 221, .12); }

    .confidence-bar { position: relative; z-index: 2; border-block: 1px solid rgba(194, 238, 187, .09); background: #0b2014; }
    .confidence-inner { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 32px; }
    .confidence-inner p { margin: 0; color: #708778; font-size: .73rem; font-weight: 800; text-transform: uppercase; letter-spacing: .13em; }
    .confidence-items { display: flex; align-items: center; gap: clamp(20px, 4vw, 50px); }
    .confidence-items span { display: inline-flex; align-items: center; gap: 8px; color: #bccbbe; font-size: .82rem; font-weight: 700; }
    .confidence-items i { width: 6px; height: 6px; border-radius: 50%; background: #5d7e67; }

    .play-options { padding-block: 110px 120px; }
    .section-heading { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(300px, .65fr); align-items: end; gap: 70px; margin-bottom: 42px; }
    .section-heading h2, .platform-intro h2, .reviews-heading h2 { margin: 10px 0 0; color: #f4f9f2; font-size: clamp(2.25rem, 4vw, 3.65rem); line-height: 1.04; letter-spacing: -.05em; }
    .section-heading > p { margin: 0; color: #8da293; font-size: .95rem; line-height: 1.7; }
    .experience-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
    .experience-card { min-width: 0; overflow: hidden; border: 1px solid rgba(198, 239, 190, .11); border-radius: 22px; background: #0d2819; box-shadow: 0 22px 48px rgba(2, 18, 9, .14); transition: transform .25s, border-color .25s; }
    .experience-card:hover { transform: translateY(-5px); border-color: rgba(164, 245, 45, .27); }
    .experience-media { height: 238px; position: relative; overflow: hidden; background: #153721; }
    .experience-media::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 48%, rgba(6, 22, 13, .7)); }
    .experience-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s; }
    .experience-card:hover .experience-media img { transform: scale(1.035); }
    .experience-number, .experience-label { position: absolute; z-index: 2; top: 15px; border-radius: 999px; backdrop-filter: blur(12px); }
    .experience-number { left: 15px; padding: 7px 9px; color: #eaf4e6; background: rgba(7, 26, 15, .76); font-size: .7rem; font-weight: 850; }
    .experience-label { right: 15px; padding: 7px 10px; color: #eff8eb; background: rgba(7, 26, 15, .76); font-size: .66rem; font-weight: 750; }
    .experience-body { padding: 25px 24px 27px; }
    .experience-title-row { display: flex; align-items: center; gap: 13px; }
    .experience-title-row small { display: block; margin-bottom: 2px; color: #718978; font-size: .65rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .experience-title-row h3 { margin: 0; font-size: 1.38rem; letter-spacing: -.025em; }
    .experience-icon { flex: 0 0 auto; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 13px; color: var(--lime-bright); background: rgba(164, 245, 45, .1); }
    .experience-icon svg { width: 21px; height: 21px; }
    .card-per-game .experience-icon, .card-per-game .text-link { color: var(--sky); }
    .card-per-game .experience-icon { background: rgba(102, 214, 221, .1); }
    .card-hosted .experience-icon, .card-hosted .text-link { color: var(--amber); }
    .card-hosted .experience-icon { background: rgba(255, 198, 107, .1); }
    .experience-body > p { min-height: 67px; margin: 19px 0; color: #91a596; font-size: .86rem; line-height: 1.65; }
    .experience-body ul { display: grid; gap: 9px; margin: 0 0 23px; padding: 0; list-style: none; }
    .experience-body li { display: flex; align-items: center; gap: 9px; color: #c6d3c8; font-size: .78rem; font-weight: 650; }
    .experience-body li::before { content: '✓'; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; color: var(--lime-bright); background: rgba(164,245,45,.09); font-size: .65rem; }
    .card-per-game li::before { color: var(--sky); background: rgba(102,214,221,.09); }
    .card-hosted li::before { color: var(--amber); background: rgba(255,198,107,.09); }
    .text-link { display: inline-flex; align-items: center; gap: 7px; color: var(--lime-bright); text-decoration: none; font-size: .79rem; font-weight: 850; }
    .text-link svg { width: 15px; height: 15px; transition: transform .2s; }
    .text-link:hover svg { transform: translateX(3px); }

    .platform { padding-block: 112px; display: grid; grid-template-columns: minmax(280px, .72fr) minmax(0, 1.28fr); gap: 70px; align-items: start; }
    .platform::before { content: ''; position: absolute; inset: 0 -100vw; z-index: -1; background: #0b2115; border-block: 1px solid rgba(201, 241, 194, .08); }
    .platform-intro { position: sticky; top: 116px; }
    .platform-intro h2 span { color: var(--lime-bright); }
    .platform-intro p { margin: 24px 0 28px; max-width: 420px; color: #8fa394; line-height: 1.75; font-size: .93rem; }
    .platform-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .platform-card { min-height: 240px; padding: 25px; position: relative; overflow: hidden; border: 1px solid rgba(205, 240, 198, .1); border-radius: 20px; background: linear-gradient(145deg, #12321f, #0d291a); }
    .platform-card-wide { grid-column: 1 / -1; min-height: 220px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 20px; }
    .platform-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 13px; color: var(--lime-bright); background: rgba(164,245,45,.1); border: 1px solid rgba(164,245,45,.11); }
    .platform-icon svg { width: 22px; height: 22px; }
    .platform-card h3 { margin: 28px 0 10px; font-size: 1.13rem; letter-spacing: -.02em; }
    .platform-card p { max-width: 450px; margin: 0; color: #8ca191; font-size: .82rem; line-height: 1.65; }
    .platform-card-wide h3 { margin-top: 0; }
    .mini-chart { height: 78px; display: flex; align-items: end; gap: 7px; padding: 8px; border-bottom: 1px solid rgba(164,245,45,.22); }
    .mini-chart i { width: 11px; border-radius: 5px 5px 1px 1px; background: linear-gradient(to top, #4b8f26, var(--lime-bright)); }
    .mini-chart i:nth-child(1) { height: 25%; } .mini-chart i:nth-child(2) { height: 42%; } .mini-chart i:nth-child(3) { height: 35%; } .mini-chart i:nth-child(4) { height: 66%; } .mini-chart i:nth-child(5) { height: 92%; }
    .official-chip { position: absolute; top: 20px; right: 20px; padding: 6px 8px; border-radius: 999px; color: var(--mint); background: rgba(189,247,201,.08); border: 1px solid rgba(189,247,201,.12); font-size: .58rem; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; }
    .platform-card-access { grid-template-columns: minmax(0, 1fr) auto; }
    .platform-card-access .platform-icon { margin-bottom: 20px; }
    .device-pills { display: flex; flex-direction: column; gap: 8px; }
    .device-pills span { padding: 8px 12px; color: #a9bdaa; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 9px; font-size: .68rem; font-weight: 750; text-align: center; }

    .how-it-works { padding-block: 110px; }
    .compact-heading { grid-template-columns: 1fr; margin-bottom: 50px; }
    .steps { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 25px; }
    .steps article { display: flex; align-items: flex-start; gap: 16px; }
    .steps article > span { flex: 0 0 auto; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; color: var(--green-900); background: var(--lime-bright); font-weight: 900; }
    .steps h3 { margin: 1px 0 7px; font-size: .98rem; }
    .steps p { margin: 0; color: #7f9585; font-size: .78rem; line-height: 1.55; }
    .step-line { width: 54px; height: 1px; background: linear-gradient(to right, rgba(164,245,45,.1), rgba(164,245,45,.55), rgba(164,245,45,.1)); }

    .reviews-wrap { padding-block: 100px; background: #0a2014; border-block: 1px solid rgba(199, 238, 192, .08); }
    .reviews-heading { max-width: 650px; margin-bottom: 38px; }
    .reviews-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .review-card { min-height: 255px; padding: 25px; display: flex; flex-direction: column; border: 1px solid rgba(204, 239, 198, .1); border-radius: 18px; background: #102c1c; }
    .review-top { display: flex; align-items: center; justify-content: space-between; }
    .review-stars { display: flex; gap: 2px; color: var(--lime-bright); font-size: .8rem; }
    .review-stars .muted { color: #35503e; }
    .quote-mark { width: 29px; height: 29px; color: #2c5235; fill: currentColor; stroke: none; }
    .review-card > p { flex: 1; margin: 25px 0; color: #d3ded4; font-size: .88rem; line-height: 1.7; }
    .review-author { display: flex; align-items: center; gap: 11px; }
    .review-author img { width: 38px; height: 38px; object-fit: cover; border-radius: 10px; background: #173824; }
    .review-author div { display: grid; gap: 3px; min-width: 0; }
    .review-author strong { overflow: hidden; color: #f1f7ef; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
    .review-author small, .review-author span { color: #718777; font-size: .63rem; }
    .review-author a { margin-left: auto; color: var(--lime-bright); font-size: .68rem; font-weight: 800; text-decoration: none; }

    .partners { padding-block: 80px; display: grid; grid-template-columns: 220px minmax(0, 1fr) auto; gap: 32px; align-items: center; }
    .partners-heading span { color: #dce7dc; font-size: .87rem; font-weight: 850; }
    .partners-heading p { margin: 6px 0 0; color: #718777; font-size: .72rem; }
    .partner-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .partner-item { min-width: 0; padding: 11px; display: flex; align-items: center; gap: 11px; border: 1px solid rgba(202,239,195,.09); border-radius: 13px; background: #0e291a; text-decoration: none; }
    .partner-item img { width: 40px; height: 40px; flex: 0 0 auto; object-fit: cover; border-radius: 9px; background: #173623; }
    .partner-item > span { min-width: 0; display: grid; gap: 3px; }
    .partner-item strong, .partner-item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .partner-item strong { color: #e3ece1; font-size: .72rem; }
    .partner-item small { color: #718777; font-size: .62rem; }
    .partner-item svg { width: 16px; margin-left: auto; color: #6d8873; }
    .partner-cta { color: var(--lime-bright); font-size: .72rem; font-weight: 800; text-decoration: none; white-space: nowrap; }

    .final-cta { min-height: 385px; margin-bottom: 80px; padding: 64px 70px; display: flex; align-items: center; overflow: hidden; border: 1px solid rgba(178, 235, 128, .22); border-radius: 30px; background: linear-gradient(125deg, #173e24 0%, #22552c 63%, #437816 100%); box-shadow: 0 30px 70px rgba(1, 15, 7, .23); }
    .final-cta::before { content: ''; position: absolute; inset: 0; opacity: .12; background-image: linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px); background-size: 46px 46px; mask-image: linear-gradient(to right, #000, transparent 75%); }
    .cta-content { max-width: 720px; position: relative; z-index: 2; }
    .final-cta .section-kicker { color: #c8ff7c; }
    .final-cta h2 { margin: 12px 0 14px; font-size: clamp(2.25rem, 4.4vw, 4rem); line-height: 1; letter-spacing: -.055em; }
    .final-cta p { max-width: 590px; margin: 0; color: #c2d6c3; font-size: .94rem; line-height: 1.65; }
    .cta-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 27px; }
    .cta-ball { position: absolute; right: -75px; top: -70px; width: 350px; height: 350px; border-radius: 50%; background: #9ff024; box-shadow: inset -35px -35px 70px rgba(45,102,4,.28), 0 30px 60px rgba(8,35,10,.2); }
    .cta-ball::before, .cta-ball::after { content: ''; position: absolute; border: 5px solid rgba(80, 135, 10, .38); border-radius: 50%; }
    .cta-ball::before { width: 250px; height: 470px; left: -135px; top: -60px; }
    .cta-ball::after { width: 250px; height: 470px; right: -135px; top: -60px; }

    .footer { border-top: 1px solid rgba(200, 239, 192, .09); background: #081b11; }
    .footer-inner { min-height: 170px; display: grid; grid-template-columns: 1fr auto; gap: 25px 60px; align-items: center; }
    .footer-brand img { height: 34px; }
    .footer-brand p { margin: 8px 0 0; color: #6c8272; font-size: .72rem; }
    .footer nav { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px 24px; }
    .footer nav a { color: #8ca08f; font-size: .72rem; font-weight: 650; text-decoration: none; }
    .footer nav a:hover { color: var(--lime-bright); }
    .footer-meta { grid-column: 1 / -1; padding-top: 18px; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,.06); color: #52685a; font-size: .65rem; }

    @media (max-width: 1100px) {
      .desktop-nav { display: none; }
      .nav-actions { margin-left: auto; }
      .hero { min-height: auto; padding-top: 70px; grid-template-columns: 1fr; text-align: center; }
      .hero-copy { max-width: 760px; margin: auto; }
      .hero-lead { margin-inline: auto; }
      .hero-actions, .hero-trust { justify-content: center; }
      .hero-visual { width: min(620px, 100%); margin: -10px auto 0; }
      .experience-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .experience-card:first-child { grid-column: 1 / -1; display: grid; grid-template-columns: 1.05fr .95fr; }
      .experience-card:first-child .experience-media { height: 100%; min-height: 430px; }
      .platform { gap: 40px; }
      .platform-card-wide { grid-template-columns: auto 1fr; }
      .mini-chart { display: none; }
      .partners { grid-template-columns: 1fr; }
      .partner-cta { justify-self: start; }
    }

    @media (max-width: 820px) {
      .section-shell { width: min(100% - 36px, 720px); }
      .nav-shell { width: calc(100% - 28px); height: 68px; gap: 14px; }
      .brand img { height: 31px; }
      .nav-login { display: none; }
      .nav-discover span { display: none; }
      .nav-discover { width: 42px; height: 42px; justify-content: center; padding: 0; }
      .hero { padding-block: 58px 55px; }
      .hero h1 { font-size: clamp(3.05rem, 11vw, 5rem); }
      .confidence-inner { padding-block: 22px; flex-direction: column; justify-content: center; gap: 16px; }
      .confidence-items { width: 100%; justify-content: center; flex-wrap: wrap; gap: 12px 25px; }
      .play-options { padding-block: 82px; }
      .section-heading { grid-template-columns: 1fr; gap: 18px; }
      .section-heading > p { max-width: 560px; }
      .platform { padding-block: 82px; grid-template-columns: 1fr; }
      .platform-intro { position: static; }
      .platform-intro p { max-width: 590px; }
      .steps { grid-template-columns: 1fr; gap: 24px; }
      .step-line { width: 1px; height: 25px; margin-left: 21px; background: linear-gradient(to bottom, rgba(164,245,45,.1), rgba(164,245,45,.55)); }
      .reviews-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .partner-list { grid-template-columns: 1fr; }
      .final-cta { padding: 55px 45px; }
      .cta-content { max-width: 580px; }
      .cta-ball { right: -190px; opacity: .55; }
    }

    @media (max-width: 620px) {
      .section-shell { width: calc(100% - 28px); }
      .site-header { backdrop-filter: blur(14px); }
      .nav-club-long { display: none; }
      .nav-club-short { display: inline; }
      .nav-club { min-height: 42px; padding-inline: 13px; }
      .hero { padding-top: 44px; }
      .eyebrow { font-size: .62rem; letter-spacing: .1em; }
      .hero h1 { margin-top: 20px; font-size: clamp(2.8rem, 15vw, 4.25rem); }
      .hero-lead { font-size: .93rem; line-height: 1.62; }
      .hero-actions { display: grid; grid-template-columns: 1fr; }
      .hero-actions .button { width: 100%; }
      .hero-trust { gap: 11px; margin-top: 29px; }
      .trust-item span { max-width: 78px; }
      .hero-visual { height: 410px; margin-top: 8px; }
      .visual-grid { inset-inline: 0; }
      .visual-halo { width: 330px; height: 330px; }
      .phone-stack { width: 300px; height: 400px; }
      .phone { width: 164px; height: 355px; padding: 5px; border-radius: 27px; }
      .phone img { border-radius: 22px; }
      .phone-speaker { top: 10px; width: 55px; height: 14px; }
      .phone-back { left: 7px; top: 25px; }
      .phone-front { right: 4px; }
      .floating-card { min-width: 160px; padding: 9px 10px; }
      .floating-card-top { top: 44px; right: -5px; }
      .floating-card-bottom { bottom: 23px; left: -5px; }
      .floating-card small { font-size: .55rem; }
      .floating-card strong { font-size: .65rem; }
      .floating-icon { width: 29px; height: 29px; }
      .confidence-items span { font-size: .72rem; }
      .section-heading h2, .platform-intro h2, .reviews-heading h2 { font-size: clamp(2rem, 10vw, 2.8rem); }
      .experience-grid { grid-template-columns: 1fr; }
      .experience-card:first-child { grid-column: auto; display: block; }
      .experience-card:first-child .experience-media, .experience-media { height: 220px; min-height: 0; }
      .experience-body > p { min-height: 0; }
      .platform-grid { grid-template-columns: 1fr; }
      .platform-card-wide { grid-column: auto; min-height: 240px; display: block; }
      .platform-card-wide .platform-icon { margin-bottom: 20px; }
      .platform-card-wide h3 { margin-top: 0; }
      .device-pills { margin-top: 25px; flex-direction: row; flex-wrap: wrap; }
      .how-it-works { padding-block: 80px; }
      .reviews-wrap { padding-block: 78px; }
      .reviews-grid { grid-template-columns: 1fr; }
      .partners { padding-block: 60px; }
      .final-cta { width: calc(100% - 28px); min-height: 480px; margin-bottom: 60px; padding: 45px 25px 180px; align-items: flex-start; border-radius: 24px; text-align: center; }
      .cta-actions { display: grid; grid-template-columns: 1fr; }
      .cta-ball { width: 260px; height: 260px; right: 50%; top: auto; bottom: -135px; transform: translateX(50%); opacity: .8; }
      .footer-inner { padding-block: 40px 25px; grid-template-columns: 1fr; text-align: center; }
      .footer nav { justify-content: center; }
      .footer-meta { text-align: left; }
    }

    @media (max-width: 380px) {
      .brand img { height: 27px; }
      .nav-discover { display: none; }
      .hero-trust { align-items: flex-start; }
      .trust-divider { height: 37px; }
      .floating-card-top { right: -10px; }
      .floating-card-bottom { left: -10px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
    }
  `],
})
export class LandingComponent {
  readonly version = APP_VERSION;
  readonly starsArray = [1, 2, 3, 4, 5];

  reviews = signal<AppReview[]>([]);
  sponsors = signal<PublicSponsor[]>([]);

  private http = inject(HttpClient);

  constructor() {
    this.http.get<AppReview[]>(`${environment.apiUrl}/public/app-reviews`)
      .subscribe({ next: reviews => this.reviews.set(reviews), error: () => {} });
    this.http.get<PublicSponsor[]>(`${environment.apiUrl}/public/sponsors`)
      .subscribe({ next: sponsors => this.sponsors.set(sponsors), error: () => {} });
  }
}
