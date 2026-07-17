import { Component, OnInit, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PublicBookingService } from '../../../core/services/public-booking.service';

type Club = {
  _id: string; name: string; slug?: string; location?: string; logo?: string;
  photos?: string[]; rating?: number; reviewCount?: number;
  courtCount?: number; openingHour?: number; closingHour?: number;
};

type RawOpenPlaySession = {
  _id: string; title: string; sport: string;
  sessionDate: string; startTime: string; endTime: string;
  matchType: string; maxPlayers: number; joinedPlayers: number;
  club: { _id: string; name: string; slug?: string; location?: string; logo?: string };
};

type RawHostedSession = {
  _id: string; title: string; sport: string;
  date: string; startTime: string; endTime: string;
  venue: string; court?: string; feePerPlayer: number;
  guestFeePerPlayer?: number;
  maxPlayers: number; currentPlayers: number; status: 'open' | 'full';
  venueLogo?: string | null;
  club: { _id: string; name: string; slug?: string; location?: string; logo?: string };
};

type UnifiedSession = {
  _id: string;
  type: 'open_play' | 'hosted_play';
  title: string;
  sport: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  matchType?: string;
  feePerPlayer?: number;
  maxPlayers: number;
  currentPlayers: number;
  isFull: boolean;
  club: { _id: string; name: string; slug?: string; location?: string; logo?: string };
  logoUrl?: string | null;
};

@Component({
  selector: 'app-club-picker',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, NgTemplateOutlet],
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
        <div class="nav-left">
          <a routerLink="/"><img src="/CourtGo.png" alt="CourtGo" class="nav-logo" /></a>
          <div class="tab-toggle">
            <button
              class="tab-btn"
              [class.tab-active]="activeTab() === 'book'"
              (click)="switchTab('book')"
            >Book a Court</button>
            <button
              class="tab-btn"
              [class.tab-active]="activeTab() === 'play'"
              (click)="switchTab('play')"
            >Join Open Play</button>
          </div>
        </div>
        <div class="nav-right">
          <a routerLink="/register-club" class="nav-onboard-btn">Onboard Your Court</a>
          <a routerLink="/player-login" class="nav-signin-btn">Sign In</a>
        </div>
      </header>

      <!-- Hero -->
      <div class="hero">
        <div class="hero-text">
          <span class="page-badge">Guest Booking</span>
          <h1 class="page-title">Choose your club</h1>
          <p class="page-sub">Book a court without creating an account.</p>
        </div>
        <button class="detect-btn" (click)="detectLocation()" [disabled]="detectingLocation()">
          <span class="detect-icon">&#128205;</span>
          <span class="detect-label">
            {{ detectingLocation() ? 'Detecting…' : 'Detect near me' }}
          </span>
          <span class="detect-sub">Find courts near your location</span>
        </button>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-search">
          <span class="fi-icon">&#128269;</span>
          <input
            class="fi-input"
            type="search"
            placeholder="Search clubs by name or location…"
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            autocomplete="off"
          />
          @if (searchTerm()) {
            <button class="fi-clear" (click)="searchTerm.set('')" aria-label="Clear">&#10005;</button>
          }
        </div>

        <div class="fi-sep"></div>

        <div class="filter-city">
          <span class="fi-icon">&#128205;</span>
          <select class="fi-input fi-select" [value]="selectedCity()" (change)="selectedCity.set($any($event.target).value)">
            <option value="">All Cities / Municipalities</option>
            @for (city of cityOptions(); track city) {
              <option [value]="city">{{ city }}</option>
            }
          </select>
        </div>

        <button class="apply-btn" (click)="applyFilters()">
          <span>&#9874;</span> Apply Filters
        </button>
      </div>

      <!-- Main content -->
      <div class="content">

        <!-- ── Book a Court tab ── -->
        @if (activeTab() === 'book') {

          @if (loading()) {
            <div class="state-centered">
              <div class="spinner"></div>
              <span>Loading clubs…</span>
            </div>
          } @else if (error()) {
            <div class="state-centered">
              <div class="state-icon">&#9888;</div>
              <p>{{ error() }}</p>
              <button class="retry-btn" (click)="load()">Try again</button>
            </div>
          } @else if (filteredClubs().length === 0 && clubs().length === 0) {
            <div class="state-centered">
              <div class="state-icon">&#127916;</div>
              <p>No clubs are currently accepting guest bookings.</p>
            </div>
          } @else if (filteredClubs().length === 0) {
            <div class="state-centered">
              <div class="state-icon">&#128269;</div>
              <p>No clubs match your current filters.</p>
              <button class="retry-btn" (click)="clearFilters()">Clear filters</button>
            </div>
          } @else {

            <!-- Saved clubs (favorites) -->
            @if (savedClubs().length > 0) {
              <section class="clubs-section saved-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-accent saved-accent"></span>
                    <h2 class="section-title">&#9829; Your saved clubs</h2>
                  </div>
                  <button class="clear-saved-btn" (click)="clearAllFavorites()">Clear all</button>
                </div>
                <div class="clubs-grid saved-grid">
                  @for (club of savedClubs(); track club._id) {
                    <div class="club-card" (click)="pick(club)" role="button" tabindex="0" (keydown.enter)="pick(club)">
                      <ng-container *ngTemplateOutlet="cardTpl; context: { club: club }"></ng-container>
                    </div>
                  }
                </div>
              </section>
            }

            @if (popularClubs().length > 0) {
              <section class="clubs-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-accent"></span>
                    <h2 class="section-title">Popular clubs near you</h2>
                  </div>
                  <div class="carousel-nav">
                    <button class="nav-btn" (click)="scrollCarousel(-1)" aria-label="Previous">&#8249;</button>
                    <button class="nav-btn" (click)="scrollCarousel(1)" aria-label="Next">&#8250;</button>
                  </div>
                </div>
                <div class="carousel" #carousel>
                  @for (club of popularClubs(); track club._id) {
                    <div class="club-card" (click)="pick(club)" role="button" tabindex="0" (keydown.enter)="pick(club)">
                      <ng-container *ngTemplateOutlet="cardTpl; context: { club: club }"></ng-container>
                    </div>
                  }
                </div>
              </section>
            }
            @if (moreClubs().length > 0) {
              <section class="clubs-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-accent"></span>
                    <h2 class="section-title">{{ popularClubs().length > 0 ? 'More clubs to explore' : 'Available clubs' }}</h2>
                  </div>
                </div>
                <div class="clubs-grid">
                  @for (club of moreClubs(); track club._id) {
                    <div class="club-card" (click)="pick(club)" role="button" tabindex="0" (keydown.enter)="pick(club)">
                      <ng-container *ngTemplateOutlet="cardTpl; context: { club: club }"></ng-container>
                    </div>
                  }
                </div>
              </section>
            }
          }

        }

        <!-- ── Join Open Play tab ── -->
        @if (activeTab() === 'play') {

          @if (openPlayLoading()) {
            <div class="state-centered">
              <div class="spinner"></div>
              <span>Loading sessions…</span>
            </div>
          } @else if (openPlayError()) {
            <div class="state-centered">
              <div class="state-icon">&#9888;</div>
              <p>{{ openPlayError() }}</p>
              <button class="retry-btn" (click)="loadOpenPlay()">Try again</button>
            </div>
          } @else if (filteredSessions().length === 0 && openPlaySessions().length === 0 && hostedSessions().length === 0) {
            <div class="state-centered">
              <div class="state-icon">&#127934;</div>
              <p>No open play sessions are currently available.</p>
            </div>
          } @else if (filteredSessions().length === 0) {
            <div class="state-centered">
              <div class="state-icon">&#128269;</div>
              <p>No sessions match your current filters.</p>
              <button class="retry-btn" (click)="clearFilters()">Clear filters</button>
            </div>
          } @else {
            <section class="clubs-section">
              <div class="section-header">
                <div class="section-title-wrap">
                  <span class="section-accent"></span>
                  <h2 class="section-title">Upcoming open play sessions</h2>
                </div>
                <span class="session-count">{{ filteredSessions().length }} session{{ filteredSessions().length === 1 ? '' : 's' }}</span>
              </div>
              <div class="clubs-grid">
                @for (session of filteredSessions(); track session._id) {
                  <div class="session-card">
                    <div class="session-card-top">
                      <span class="sport-badge" [class.sport-tennis]="session.sport === 'tennis'" [class.sport-pickle]="session.sport === 'pickleball'">
                        {{ session.sport === 'tennis' ? '&#127934; Tennis' : '&#127947; Pickleball' }}
                      </span>
                      @if (session.type === 'hosted_play') {
                        <span class="match-chip hosted-chip">Hosted</span>
                        @if ((session.feePerPlayer ?? 0) > 0) {
                          <span class="match-chip fee-chip">&#8369;{{ session.feePerPlayer | number }} fee</span>
                        }
                      } @else {
                        <span class="match-chip">{{ session.matchType }}</span>
                      }
                    </div>

                    <div class="session-title">{{ session.title }}</div>

                    <div class="session-club-row">
                      @if (session.logoUrl) {
                        <img [src]="session.logoUrl" class="session-club-logo" [alt]="session.club.name" />
                      } @else {
                        <div class="session-club-logo-placeholder"></div>
                      }
                      <div class="session-club-info">
                        <div class="session-club-name">{{ session.club.name }}</div>
                        @if (session.club.location) {
                          <div class="session-club-loc">&#128205; {{ session.club.location }}</div>
                        }
                      </div>
                    </div>

                    <div class="session-meta">
                      <div class="session-meta-item">
                        <span class="meta-icon">&#128197;</span>
                        <span>{{ session.sessionDate | date:'EEE, MMM d, y' }}</span>
                      </div>
                      <div class="session-meta-item">
                        <span class="meta-icon">&#9200;</span>
                        <span>{{ formatTime(session.startTime) }} – {{ formatTime(session.endTime) }}</span>
                      </div>
                    </div>

                    <div class="session-spots">
                      <div class="spots-label">
                        <span>{{ session.currentPlayers }} / {{ session.maxPlayers }} players</span>
                        @if (session.isFull) {
                          <span class="spots-full">Full</span>
                        } @else {
                          <span class="spots-open">{{ session.maxPlayers - session.currentPlayers }} spots left</span>
                        }
                      </div>
                      <div class="spots-bar">
                        <div class="spots-fill" [style.width.%]="(session.currentPlayers / session.maxPlayers) * 100"></div>
                      </div>
                    </div>

                    <button
                      class="register-btn"
                      [disabled]="session.isFull"
                      (click)="session.type === 'hosted_play' ? router.navigate(['/book', session.club.slug ?? session.club._id]) : router.navigate(['/register'])"
                    >
                      {{ session.isFull ? 'Session Full' : (session.type === 'hosted_play' ? 'View & Join' : 'Register as Player') }}
                    </button>
                  </div>
                }
              </div>
            </section>
          }

        }

      </div>

      <!-- Footer -->
      <footer class="footer">
        <span>Already a member?</span>
        <a routerLink="/player-login" class="footer-link">Sign in here &rarr;</a>
      </footer>

    </div>

    <!-- Club card template -->
    <ng-template #cardTpl let-club="club">
      <div class="card-image">
        @if (club.photos && club.photos.length > 0) {
          <img [src]="club.photos[0]" [alt]="club.name" class="card-img" loading="lazy" />
        } @else {
          <div class="card-img-placeholder"></div>
        }
        <button
          class="heart-btn"
          [class.favorited]="isFav(club._id)"
          (click)="toggleFav($event, club._id)"
          aria-label="Toggle favorite"
        >{{ isFav(club._id) ? '♥' : '♡' }}</button>
        @if ((club.rating ?? 0) >= 4.5) {
          <span class="card-badge">&#9733; Guest Favorite</span>
        }
        @if (club.logo) {
          <div class="card-logo-wrap">
            <img [src]="club.logo" [alt]="club.name" class="card-logo" />
          </div>
        }
      </div>

      <div class="card-body">
        <div class="card-name">{{ club.name }}</div>
        @if (club.location) {
          <div class="card-location">&#128205; {{ club.location }}</div>
        }

        <div class="card-chips">
          @if (club.courtCount) {
            <span class="chip">{{ club.courtCount }} {{ club.courtCount === 1 ? 'Court' : 'Courts' }}</span>
          }
          @if (club.openingHour !== undefined && club.closingHour !== undefined) {
            <span class="chip">{{ formatHour(club.openingHour) }}–{{ formatHour(club.closingHour ?? 22) }}</span>
          }
        </div>

        <div class="card-footer">
          <div class="card-rating">
            @if ((club.rating ?? 0) > 0) {
              <span class="star">&#9733;</span>
              <span class="rating-val">{{ club.rating | number:'1.1-1' }}</span>
              @if ((club.reviewCount ?? 0) > 0) {
                <span class="review-count">({{ club.reviewCount }})</span>
              }
            } @else {
              <span class="no-rating">New</span>
            }
          </div>
        </div>
        <div class="card-actions">
          <button class="register-player-btn" (click)="$event.stopPropagation(); registerPlayer(club)">
            Register Player
          </button>
          <button class="book-btn" (click)="$event.stopPropagation(); pick(club)">
            {{ activeTab() === 'play' ? 'View Sessions' : 'Book Now' }}
          </button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }

    /* ── Page shell ── */
    .page {
      min-height: 100vh;
      background: #0c1a11;
      color: #fff;
      position: relative;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Animated background ── */
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
    .orb-1 { width: 500px; height: 500px; top: -150px; right: -100px;  opacity: 0.15; animation-duration: 11s; }
    .orb-2 { width: 300px; height: 300px; bottom: 20%;  left: -80px;   opacity: 0.10; animation-duration: 9s;  animation-delay: -4s; }
    .orb-3 { width: 220px; height: 220px; bottom: 5%;   right: 15%;    opacity: 0.09; animation-duration: 14s; animation-delay: -7s; }
    @keyframes float {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-32px) scale(1.07); }
    }
    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image:
        repeating-linear-gradient(0deg,   rgba(163,230,53,0.03) 0, rgba(163,230,53,0.03) 1px, transparent 1px, transparent 80px),
        repeating-linear-gradient(90deg,  rgba(163,230,53,0.03) 0, rgba(163,230,53,0.03) 1px, transparent 1px, transparent 80px);
    }

    /* ── Navbar ── */
    .navbar {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .nav-logo { height: 30px; width: auto; flex-shrink: 0; }
    .nav-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .nav-onboard-btn {
      padding: 0.5rem 1.1rem;
      background: #a3e635;
      color: #0c1a11;
      border-radius: 100px;
      font-size: 0.85rem;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .nav-onboard-btn:hover { background: #b6f241; }
    .nav-signin-btn {
      padding: 0.5rem 1.1rem;
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.75);
      border-radius: 100px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.1);
      transition: background 0.15s, color 0.15s;
    }
    .nav-signin-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }

    /* ── Hero ── */
    .hero {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 2rem;
      max-width: 1280px;
      margin: 0 auto;
      width: 100%;
      padding: 3rem 2rem 1.5rem;
      box-sizing: border-box;
    }
    .hero-text { flex: 1; }
    .page-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #a3e635;
      background: rgba(163,230,53,0.1);
      border: 1px solid rgba(163,230,53,0.22);
      padding: 0.3rem 0.9rem;
      border-radius: 100px;
      margin-bottom: 1rem;
    }
    .page-title {
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #fff;
      margin: 0 0 0.5rem;
    }
    .page-sub {
      font-size: 1rem;
      color: rgba(255,255,255,0.4);
      margin: 0;
    }

    /* ── Tab toggle ── */
    .tab-toggle {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 100px;
      padding: 4px;
    }
    .tab-btn {
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: 100px;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      color: rgba(255,255,255,0.45);
      background: transparent;
      transition: background 0.2s, color 0.2s;
      white-space: nowrap;
    }
    .tab-btn:hover:not(.tab-active) {
      color: rgba(255,255,255,0.75);
    }
    .tab-btn.tab-active {
      background: #a3e635;
      color: #0c1a11;
      font-weight: 800;
    }

    .detect-btn {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      padding: 1rem 1.5rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      color: #fff;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.2s, background 0.2s;
      min-width: 220px;
      text-align: left;
    }
    .detect-btn:hover:not(:disabled) {
      border-color: rgba(163,230,53,0.35);
      background: rgba(163,230,53,0.05);
    }
    .detect-btn:disabled { opacity: 0.6; cursor: default; }
    .detect-icon { font-size: 1.2rem; color: #a3e635; }
    .detect-label { font-size: 0.95rem; font-weight: 700; }
    .detect-sub { font-size: 0.75rem; color: rgba(255,255,255,0.4); }

    /* ── Filter bar ── */
    .filter-bar {
      position: relative;
      z-index: 5;
      display: flex;
      align-items: center;
      gap: 0;
      max-width: 1280px;
      margin: 0 auto 0;
      width: 100%;
      padding: 0 2rem 1.5rem;
      box-sizing: border-box;
    }
    .filter-bar > * { flex-shrink: 0; }

    .filter-search,
    .filter-date,
    .filter-city {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      min-width: 0;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 0.75rem 1rem;
      transition: border-color 0.2s, background 0.2s;
    }
    .filter-search {
      border-radius: 14px 0 0 14px;
      border-right: none;
      position: relative;
    }
.filter-city {
      border-left: none;
      border-right: none;
      flex: 0 0 auto;
      width: 220px;
    }
    .filter-search:focus-within,
    .filter-date:focus-within,
    .filter-city:focus-within {
      border-color: rgba(163,230,53,0.3);
      background: rgba(163,230,53,0.03);
      z-index: 1;
    }

    .fi-icon { font-size: 0.9rem; color: rgba(255,255,255,0.35); flex-shrink: 0; }
    .fi-input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-size: 0.88rem;
      font-family: inherit;
    }
    .fi-input::placeholder { color: rgba(255,255,255,0.25); }
    .fi-input::-webkit-search-cancel-button { display: none; }
.fi-select {
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
    }
    .fi-select option { background: #1b3028; color: #fff; }

    .fi-clear {
      background: transparent; border: none;
      color: rgba(255,255,255,0.3); font-size: 0.8rem;
      cursor: pointer; padding: 0.2rem 0.3rem; border-radius: 4px;
      font-family: inherit; flex-shrink: 0; transition: color 0.15s;
    }
    .fi-clear:hover { color: rgba(255,255,255,0.7); }

    .fi-sep {
      width: 1px; height: 36px;
      background: rgba(255,255,255,0.08);
      flex-shrink: 0;
    }

    .apply-btn {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.85rem 1.5rem;
      background: #a3e635;
      color: #0c1a11;
      border: none;
      border-radius: 0 14px 14px 0;
      font-weight: 800;
      font-size: 0.88rem;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, transform 0.1s;
      flex-shrink: 0;
    }
    .apply-btn:hover { background: #b6f241; }
    .apply-btn:active { transform: scale(0.98); }

    /* ── Content ── */
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      padding: 0.5rem 2rem 3rem;
      box-sizing: border-box;
    }

    /* ── Section ── */
    .clubs-section { margin-bottom: 3rem; }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .section-title-wrap { display: flex; align-items: center; gap: 0.75rem; }
    .section-accent {
      display: block;
      width: 4px; height: 22px;
      background: #a3e635;
      border-radius: 2px;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
      margin: 0;
    }

    /* ── Carousel ── */
    .carousel {
      display: flex;
      gap: 1.25rem;
      overflow-x: auto;
      scroll-behavior: smooth;
      scrollbar-width: none;
      padding-bottom: 0.5rem;
    }
    .carousel::-webkit-scrollbar { display: none; }
    .carousel .club-card { min-width: 290px; max-width: 290px; flex-shrink: 0; }

    .carousel-nav { display: flex; gap: 0.5rem; }
    .nav-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      color: rgba(255,255,255,0.6);
      font-size: 1.2rem;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      font-family: inherit;
    }
    .nav-btn:hover {
      border-color: rgba(163,230,53,0.4);
      color: #a3e635;
      background: rgba(163,230,53,0.06);
    }

    /* ── Grid ── */
    .clubs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    /* ── Club card ── */
    .club-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    .club-card:hover {
      transform: translateY(-5px);
      border-color: rgba(163,230,53,0.3);
      box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(163,230,53,0.15);
    }
    .club-card:focus-visible {
      outline: 2px solid #a3e635;
      outline-offset: 2px;
    }

    /* ── Card image ── */
    .card-image {
      position: relative;
      width: 100%;
      aspect-ratio: 16/10;
      overflow: hidden;
      background: #111f16;
    }
    .card-img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.35s ease;
    }
    .club-card:hover .card-img { transform: scale(1.04); }
    .card-img-placeholder {
      width: 100%; height: 100%;
      background: linear-gradient(135deg, #1b3028 0%, #0c1a11 60%, rgba(163,230,53,0.08) 100%);
    }

    .heart-btn {
      position: absolute;
      top: 0.75rem; right: 0.75rem;
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.45);
      border: none;
      border-radius: 50%;
      color: rgba(255,255,255,0.85);
      font-size: 1.1rem;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, transform 0.15s;
      backdrop-filter: blur(4px);
      font-family: inherit;
      z-index: 2;
    }
    .heart-btn:hover { background: rgba(0,0,0,0.6); transform: scale(1.1); }
    .heart-btn.favorited { color: #a3e635; }

    .card-badge {
      position: absolute;
      top: 0.75rem; left: 0.75rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      background: rgba(0,0,0,0.55);
      color: #ffd700;
      border: 1px solid rgba(255,215,0,0.3);
      padding: 0.25rem 0.65rem;
      border-radius: 100px;
      backdrop-filter: blur(4px);
      z-index: 2;
    }

    .card-logo-wrap {
      position: absolute;
      bottom: 0.75rem; left: 0.75rem;
      width: 44px; height: 44px;
      background: rgba(0,0,0,0.5);
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.12);
      backdrop-filter: blur(4px);
      z-index: 2;
    }
    .card-logo {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }

    /* ── Card body ── */
    .card-body {
      padding: 1rem 1.1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
    }
    .card-name {
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-location {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.4);
    }

    .card-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.15rem;
    }
    .chip {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      background: rgba(163,230,53,0.08);
      border: 1px solid rgba(163,230,53,0.15);
      color: rgba(163,230,53,0.8);
      border-radius: 100px;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: auto;
      padding-top: 0.5rem;
    }
    .card-rating {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.82rem;
      color: rgba(255,255,255,0.6);
    }
    .star { color: #ffd700; font-size: 0.85rem; }
    .rating-val { font-weight: 700; color: #fff; }
    .review-count { color: rgba(255,255,255,0.35); }
    .no-rating { color: rgba(255,255,255,0.35); font-style: italic; font-size: 0.78rem; }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.6rem;
    }
    .card-actions button {
      flex: 1;
      text-align: center;
    }
    .book-btn {
      padding: 0.5rem 0.6rem;
      background: #a3e635;
      color: #0c1a11;
      border: none;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      white-space: nowrap;
    }
    .book-btn:hover { background: #b6f241; }
    .book-btn:active { transform: scale(0.97); }
    .register-player-btn {
      padding: 0.5rem 0.6rem;
      background: transparent;
      color: #a3e635;
      border: 1px solid rgba(163,230,53,0.5);
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      white-space: nowrap;
    }
    .register-player-btn:hover { background: rgba(163,230,53,0.12); }
    .register-player-btn:active { transform: scale(0.97); }

    /* ── State views ── */
    .state-centered {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 5rem 0;
      color: rgba(255,255,255,0.4);
      font-size: 0.9rem;
      text-align: center;
    }
    .state-icon { font-size: 2.5rem; }
    .spinner {
      width: 28px; height: 28px;
      border: 2px solid rgba(163,230,53,0.18);
      border-top-color: #a3e635;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .retry-btn {
      margin-top: 0.25rem;
      padding: 0.5rem 1.25rem;
      background: transparent;
      border: 1px solid rgba(163,230,53,0.35);
      border-radius: 8px;
      color: #a3e635;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .retry-btn:hover { background: rgba(163,230,53,0.08); }

    /* ── Saved section ── */
    .saved-section {
      background: rgba(163,230,53,0.03);
      border: 1px solid rgba(163,230,53,0.1);
      border-radius: 20px;
      padding: 1.25rem 1.25rem 1.5rem;
    }
    .saved-accent { background: #a3e635; }
    .saved-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .clear-saved-btn {
      font-size: 0.78rem;
      font-weight: 600;
      color: rgba(255,255,255,0.3);
      background: transparent;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 0.3rem 0.75rem;
      cursor: pointer;
      font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
    }
    .clear-saved-btn:hover { color: #f87171; border-color: rgba(248,113,113,0.3); }

    /* ── Session count label ── */
    .session-count {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.35);
      font-weight: 500;
    }

    /* ── Session card ── */
    .session-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    }
    .session-card:hover {
      border-color: rgba(163,230,53,0.25);
      box-shadow: 0 6px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(163,230,53,0.1);
      transform: translateY(-3px);
    }

    .session-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .sport-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.25rem 0.7rem;
      border-radius: 100px;
      letter-spacing: 0.03em;
    }
    .sport-tennis  { background: rgba(163,230,53,0.12); color: #a3e635; border: 1px solid rgba(163,230,53,0.2); }
    .sport-pickle  { background: rgba(56,189,248,0.12); color: #38bdf8; border: 1px solid rgba(56,189,248,0.2); }
    .match-chip {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: capitalize;
      color: rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 0.2rem 0.6rem;
      border-radius: 100px;
    }
    .hosted-chip { background: rgba(168,85,247,0.15); color: #c084fc; border-color: rgba(168,85,247,0.3); }
    .fee-chip    { background: rgba(34,197,94,0.12); color: #86efac; border-color: rgba(34,197,94,0.25); font-size: 0.65rem; }

    .session-title {
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
    }

    .session-club-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .session-club-logo {
      width: 36px; height: 36px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .session-club-logo-placeholder {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, #a3e635, #4d7c0f);
      flex-shrink: 0;
    }
    .session-club-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: rgba(255,255,255,0.75);
    }
    .session-club-loc {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.35);
    }

    .session-meta {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .session-meta-item {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.8rem;
      color: rgba(255,255,255,0.5);
    }
    .meta-icon { font-size: 0.85rem; }

    .session-spots { display: flex; flex-direction: column; gap: 0.4rem; }
    .spots-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.78rem;
      color: rgba(255,255,255,0.45);
    }
    .spots-open { color: #a3e635; font-weight: 600; }
    .spots-full  { color: rgba(255,100,100,0.8); font-weight: 600; }
    .spots-bar {
      height: 4px;
      background: rgba(255,255,255,0.08);
      border-radius: 2px;
      overflow: hidden;
    }
    .spots-fill {
      height: 100%;
      background: #a3e635;
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .register-btn {
      width: 100%;
      padding: 0.65rem 1rem;
      background: #a3e635;
      color: #0c1a11;
      border: none;
      border-radius: 12px;
      font-size: 0.88rem;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      margin-top: auto;
    }
    .register-btn:hover:not(:disabled) { background: #b6f241; }
    .register-btn:active:not(:disabled) { transform: scale(0.98); }
    .register-btn:disabled {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.25);
      cursor: default;
    }

    /* ── Footer ── */
    .footer {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.5rem 2rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 0.82rem;
      color: rgba(255,255,255,0.3);
      margin-top: auto;
    }
    .footer-link {
      color: #a3e635;
      text-decoration: none;
      font-weight: 600;
      transition: opacity 0.15s;
    }
    .footer-link:hover { opacity: 0.8; }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .filter-bar {
        flex-wrap: wrap;
        gap: 0;
        row-gap: 0;
      }
      .filter-search {
        flex: 1 1 100%;
        border-radius: 14px 14px 0 0;
        border-right: 1px solid rgba(255,255,255,0.08);
        border-bottom: none;
      }
      .fi-sep { display: none; }
      .filter-city {
        flex: 1 1 100%;
        border-left: 1px solid rgba(255,255,255,0.08);
        border-right: 1px solid rgba(255,255,255,0.08);
        border-bottom: none;
        width: auto;
      }
      .apply-btn {
        flex: 1 1 100%;
        border-radius: 0 0 14px 14px;
        justify-content: center;
      }
    }

    @media (max-width: 768px) {
      .navbar { padding: 0.75rem 1.25rem; flex-wrap: wrap; }
      .nav-left { gap: 0.75rem; }
      .nav-onboard-btn { display: none; }
      .hero { flex-direction: column; padding: 2rem 1.25rem 1rem; gap: 1.25rem; }
      .detect-btn { width: 100%; }
      .filter-bar { padding: 0 1.25rem 1.25rem; }
      .content { padding: 0.5rem 1.25rem 2rem; }
      .clubs-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
      .carousel .club-card { min-width: 260px; max-width: 260px; }
    }

    @media (max-width: 480px) {
      .nav-left { flex-wrap: wrap; row-gap: 0.6rem; }
      .tab-toggle { width: 100%; }
      .tab-btn { flex: 1; text-align: center; }
      .hero { padding: 1.5rem 1rem 0.75rem; }
      .filter-bar { padding: 0 1rem 1rem; }
      .content { padding: 0.5rem 1rem 2rem; }
      .clubs-grid { grid-template-columns: 1fr; }
      .carousel .club-card { min-width: 80vw; max-width: 80vw; }
    }
  `],
})
export class ClubPickerComponent implements OnInit {
  @ViewChild('carousel') carouselRef!: ElementRef<HTMLDivElement>;

  // ── Club / book tab ──
  clubs = signal<Club[]>([]);
  loading = signal(true);
  error = signal('');

  // ── Open play tab ──
  openPlaySessions = signal<RawOpenPlaySession[]>([]);
  hostedSessions = signal<RawHostedSession[]>([]);
  openPlayLoading = signal(false);
  openPlayError = signal('');
  openPlayLoaded = signal(false);

  // ── Shared filter state ──
  searchTerm = signal('');
  selectedCity = signal('');
  activeTab = signal<'book' | 'play'>('book');
  favoriteIds = signal<Set<string>>(new Set());
  detectingLocation = signal(false);

  filteredClubs = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const city = this.selectedCity().toLowerCase().trim();
    return this.clubs().filter(c => {
      const matchesTerm = !term || c.name.toLowerCase().includes(term) || (c.location?.toLowerCase().includes(term) ?? false);
      const matchesCity = !city || (c.location?.toLowerCase().includes(city) ?? false);
      return matchesTerm && matchesCity;
    });
  });

  filteredSessions = computed((): UnifiedSession[] => {
    const term = this.searchTerm().toLowerCase().trim();
    const city = this.selectedCity().toLowerCase().trim();
    const merged = [
      ...this.openPlaySessions().map(s => this.normalizeOpenPlay(s)),
      ...this.hostedSessions().map(s => this.normalizeHosted(s)),
    ];
    return merged
      .filter(s => {
        const matchesTerm = !term
          || s.title.toLowerCase().includes(term)
          || s.club.name.toLowerCase().includes(term)
          || (s.club.location?.toLowerCase().includes(term) ?? false);
        const matchesCity = !city || (s.club.location?.toLowerCase().includes(city) ?? false);
        return matchesTerm && matchesCity;
      })
      .sort((a, b) => {
        const d = a.sessionDate.localeCompare(b.sessionDate);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      });
  });

  savedClubs = computed(() =>
    this.clubs().filter(c => this.favoriteIds().has(c._id))
  );

  popularClubs = computed(() => {
    const all = this.filteredClubs();
    return [...all]
      .filter(c => (c.rating ?? 0) > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 4);
  });

  moreClubs = computed(() => {
    const popularIds = new Set(this.popularClubs().map(c => c._id));
    return this.filteredClubs().filter(c => !popularIds.has(c._id));
  });

  cityOptions = computed(() => {
    const seen = new Set<string>();
    const cities: string[] = [];
    let sources: (string | undefined)[];
    if (this.activeTab() === 'play') {
      sources = [
        ...this.openPlaySessions().map(s => s.club.location),
        ...this.hostedSessions().map(s => s.club.location),
      ];
    } else {
      sources = this.clubs().map(c => c.location);
    }
    for (const loc of sources) {
      if (!loc) continue;
      const city = loc.trim();
      if (!seen.has(city)) { seen.add(city); cities.push(city); }
    }
    return cities.sort();
  });

  constructor(
    private publicBookingService: PublicBookingService,
    readonly router: Router,
  ) {}

  ngOnInit() {
    this.loadFavorites();
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.publicBookingService.getClubs().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs as Club[]);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load clubs. Please try again.');
        this.loading.set(false);
      },
    });
  }

  loadOpenPlay() {
    this.openPlayLoading.set(true);
    this.openPlayError.set('');
    forkJoin({
      open: this.publicBookingService.getAllOpenPlaySessions(),
      hosted: this.publicBookingService.getAllHostedPlaySessions(),
    }).subscribe({
      next: ({ open, hosted }) => {
        this.openPlaySessions.set(open);
        this.hostedSessions.set(hosted);
        this.openPlayLoading.set(false);
        this.openPlayLoaded.set(true);
      },
      error: () => {
        this.openPlayError.set('Could not load sessions. Please try again.');
        this.openPlayLoading.set(false);
      },
    });
  }

  switchTab(tab: 'book' | 'play') {
    this.activeTab.set(tab);
    if (tab === 'play' && !this.openPlayLoaded()) {
      this.loadOpenPlay();
    }
  }

  pick(club: Club) {
    this.router.navigate(['/book', club.slug ?? club._id]);
  }

  registerPlayer(club: Club) {
    this.router.navigate(['/register'], { queryParams: { clubId: club._id } });
  }

  applyFilters() {
    // Filters are applied reactively via signals.
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCity.set('');
  }

  isFav(id: string): boolean {
    return this.favoriteIds().has(id);
  }

  toggleFav(event: Event, id: string) {
    event.stopPropagation();
    const set = new Set(this.favoriteIds());
    if (set.has(id)) { set.delete(id); } else { set.add(id); }
    this.favoriteIds.set(set);
    try { localStorage.setItem('cg_favorites', JSON.stringify([...set])); } catch {}
  }

  clearAllFavorites() {
    this.favoriteIds.set(new Set());
    try { localStorage.removeItem('cg_favorites'); } catch {}
  }


  scrollCarousel(direction: -1 | 1) {
    const el = this.carouselRef?.nativeElement;
    if (el) { el.scrollBy({ left: direction * 320, behavior: 'smooth' }); }
  }

  detectLocation() {
    if (!navigator.geolocation) return;
    this.detectingLocation.set(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city =
            data?.address?.city ||
            data?.address?.town ||
            data?.address?.municipality ||
            data?.address?.county ||
            '';
          if (city) {
            this.selectedCity.set(city);
          }
        } catch { /* silently ignore reverse-geocode failures */ }
        this.detectingLocation.set(false);
      },
      () => { this.detectingLocation.set(false); }
    );
  }

  private normalizeOpenPlay(s: RawOpenPlaySession): UnifiedSession {
    return {
      _id: s._id.toString(), type: 'open_play',
      title: s.title, sport: s.sport,
      sessionDate: s.sessionDate, startTime: s.startTime, endTime: s.endTime,
      matchType: s.matchType, maxPlayers: s.maxPlayers,
      currentPlayers: s.joinedPlayers,
      isFull: s.joinedPlayers >= s.maxPlayers,
      club: s.club, logoUrl: s.club.logo ?? null,
    };
  }

  private normalizeHosted(s: RawHostedSession): UnifiedSession {
    return {
      _id: s._id.toString(), type: 'hosted_play',
      title: s.title, sport: s.sport,
      sessionDate: s.date, startTime: s.startTime, endTime: s.endTime,
      // Public viewers join as guests, so quote the (resolved) guest fee.
      feePerPlayer: s.guestFeePerPlayer ?? s.feePerPlayer, maxPlayers: s.maxPlayers,
      currentPlayers: s.currentPlayers,
      isFull: s.status === 'full' || s.currentPlayers >= s.maxPlayers,
      club: s.club, logoUrl: s.venueLogo ?? s.club.logo ?? null,
    };
  }

  formatTime(t: string): string {
    // "14:00" → "2:00 PM"
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr ?? '00';
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m} ${period}`;
  }

  formatHour(h: number): string {
    if (h === 0) return '12am';
    if (h === 12) return '12pm';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  }

  private loadFavorites() {
    try {
      const raw = localStorage.getItem('cg_favorites');
      if (raw) { this.favoriteIds.set(new Set(JSON.parse(raw))); }
    } catch {}
  }
}
