import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RatesService, Rates } from '../../../core/services/rates.service';
import { ClubService, Club } from '../../../core/services/club.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-player-rules',
  imports: [CurrencyPipe, DatePipe],
  template: `
    <div class="rules-shell">
      <header class="topbar">
        <button class="icon-btn" (click)="goBack()" aria-label="Back to dashboard">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="topbar-copy">
          <span class="kicker">Player Guide</span>
          <h1>Club Rules & Pricing</h1>
        </div>
      </header>

      @if (loading()) {
        <div class="state-card">
          <span class="spinner"></span>
          <span>Loading rates...</span>
        </div>
      } @else if (rates()) {
        <main class="rules-content">
          <section class="hero">
            <div class="club-mark">
              @if (club()?.logo) {
                <img [src]="club()!.logo!" [alt]="clubName" />
              } @else {
                <span>{{ clubInitials }}</span>
              }
            </div>
            <div class="hero-copy">
              <div class="eyebrow-row">
                <span class="eyebrow"><i class="fas fa-shield-halved"></i> Current club rates</span>
                <span class="booking-badge">
                  @if (isReservation) {
                    <i class="fas fa-calendar-days"></i> Court Reservations
                  } @else if (isPerGame) {
                    <i class="fas fa-gamepad"></i> Per Game Play
                  } @else {
                    <i class="fas fa-users"></i> Hosted Play
                  }
                </span>
              </div>
              <h2>{{ clubName }}</h2>
              @if (isReservation) {
                <p>Review court reservation rates, guest fees, and platform charges before booking.</p>
              } @else if (isPerGame) {
                <p>Review per-game session rates, guest fees, and platform charges before joining.</p>
              } @else {
                <p>Review session rates, queue management fees, and platform charges before joining.</p>
              }
            </div>
          </section>

          @if (!isHostedPlay) {
          <section class="quick-grid" aria-label="Pricing highlights">
            @if (isReservation) {
              <div class="quick-card">
                <span class="quick-label">Weekday court</span>
                <strong>{{ rates()!.reservationWeekdayRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">per hour</span>
              </div>
              <div class="quick-card">
                <span class="quick-label">Weekend court</span>
                <strong>{{ rates()!.reservationWeekendRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">per hour</span>
              </div>
              <div class="quick-card">
                <span class="quick-label">Guest fee</span>
                <strong>{{ rates()!.reservationGuestFee | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">per guest</span>
              </div>
            } @else if (isPerGame) {
              <div class="quick-card">
                <span class="quick-label">Per game fee</span>
                <strong>{{ rates()!.perGameFee | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">per player</span>
              </div>
              <div class="quick-card">
                <span class="quick-label">With lights</span>
                <strong>{{ rates()!.lightRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">session add-on</span>
              </div>
              <div class="quick-card">
                <span class="quick-label">Guest fee</span>
                <strong>{{ rates()!.perGameGuestFee | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">per guest</span>
              </div>
            } @else {
              <div class="quick-card">
                <span class="quick-label">With lights</span>
                <strong>{{ rates()!.lightRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">per player / game</span>
              </div>
              <div class="quick-card">
                <span class="quick-label">Without lights</span>
                <strong>{{ rates()!.withoutLightRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                <span class="quick-note">per player / game</span>
              </div>
              <div class="quick-card">
                @if (club()!.hostedPlayQueueEnabled && club()!.queueManagementFeePerPlayer! > 0) {
                  <span class="quick-label">Queue fee</span>
                  <strong>{{ club()!.queueManagementFeePerPlayer | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  <span class="quick-note">per session</span>
                } @else {
                  <span class="quick-label">App fee</span>
                  <strong>{{ convenienceFeeSummary }}</strong>
                  <span class="quick-note">platform charge</span>
                }
              </div>
            }
          </section>
          } <!-- end @if (!isHostedPlay) quick-grid -->

          <section class="section-grid">
            @if (isPerGame) {
              <article class="rate-card">
                <div class="card-head">
                  <span class="card-icon lime"><i class="fas fa-gamepad"></i></span>
                  <div>
                    <h3>Per Game Rates</h3>
                    <p>Per player</p>
                  </div>
                </div>
                <div class="rate-list">
                  <div class="rate-row">
                    <span><i class="fas fa-play-circle"></i> Game fee</span>
                    <strong>{{ rates()!.perGameFee | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-user"></i> Guest entry fee</span>
                    <strong>{{ rates()!.perGameGuestFee | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                </div>
              </article>
            }

            @if (!isHostedPlay) {
            <article class="rate-card">
              <div class="card-head">
                <span class="card-icon lime"><i class="fas fa-table-tennis-paddle-ball"></i></span>
                <div>
                  <h3>Session Rates</h3>
                  @if (isReservation) {
                    <p>Open play / training add-ons</p>
                  } @else {
                    <p>Per player / per game</p>
                  }
                </div>
              </div>
              <div class="rate-list">
                <div class="rate-row">
                  <span><i class="fas fa-sun"></i> Without Lights</span>
                  <strong>{{ rates()!.withoutLightRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                </div>
                <div class="rate-row">
                  <span><i class="fas fa-lightbulb"></i> With Lights</span>
                  <strong>{{ rates()!.lightRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                </div>
                @if (!isHostedPlay) {
                  <div class="rate-row">
                    <span><i class="fas fa-dumbbell"></i> Training without lights</span>
                    <strong>{{ rates()!.training2WithoutLightRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-dumbbell"></i> Training with lights</span>
                    <strong>{{ rates()!.training2LightRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-hand-sparkles"></i> Ball Boy</span>
                    <strong>{{ rates()!.ballBoyRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                }
              </div>
            </article>
            } <!-- end @if (!isHostedPlay) for Session Rates -->

            @if (isReservation) {
              <article class="rate-card">
                <div class="card-head">
                  <span class="card-icon teal"><i class="fas fa-calendar-days"></i></span>
                  <div>
                    <h3>Court Reservations</h3>
                    <p>Per hour</p>
                  </div>
                </div>
                <div class="rate-list">
                  <div class="rate-row">
                    <span><i class="fas fa-briefcase"></i> Weekday <small>Mon - Thu</small></span>
                    <strong>{{ rates()!.reservationWeekdayRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-umbrella-beach"></i> Weekend <small>Fri - Sun</small></span>
                    <strong>{{ rates()!.reservationWeekendRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-star"></i> Holiday</span>
                    <strong>{{ rates()!.reservationHolidayRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                </div>
              </article>

              <article class="rate-card compact">
                <div class="card-head">
                  <span class="card-icon blue"><i class="fas fa-user-plus"></i></span>
                  <div>
                    <h3>Guests</h3>
                    <p>Per guest</p>
                  </div>
                </div>
                <div class="rate-list">
                  <div class="rate-row">
                    <span><i class="fas fa-user"></i> Guest entry fee</span>
                    <strong>{{ rates()!.reservationGuestFee | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                </div>
              </article>
            }

            @if (!isHostedPlay) {
              <article class="rate-card">
                <div class="card-head">
                  <span class="card-icon amber"><i class="fas fa-bag-shopping"></i></span>
                  <div>
                    <h3>Rentals</h3>
                    <p>Per hour</p>
                  </div>
                </div>
                <div class="rate-list">
                  <div class="rate-row">
                    <span><i class="fas fa-circle"></i> Balls - 50 pcs</span>
                    <strong>{{ rates()!.rentalBalls50Rate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-circle"></i> Balls - 100 pcs</span>
                    <strong>{{ rates()!.rentalBalls100Rate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-robot"></i> Ball Machine</span>
                    <strong>{{ rates()!.rentalBallMachineRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                  <div class="rate-row">
                    <span><i class="fas fa-baseball-ball"></i> Racket</span>
                    <strong>{{ rates()!.rentalRacketRate | currency:'PHP':'symbol':'1.0-0' }}</strong>
                  </div>
                </div>
              </article>
            }

            @if (club()) {
              <article class="rate-card service-card">
                <div class="card-head">
                  <span class="card-icon violet"><i class="fas fa-receipt"></i></span>
                  <div>
                    <h3>App Service Fees</h3>
                    <p>Platform charges</p>
                  </div>
                </div>
                <div class="rate-list">
                  <div class="rate-row">
                    <span><i class="fas fa-percent"></i> Convenience Fee</span>
                    <strong>{{ convenienceFeeSummary }}</strong>
                  </div>
                  @if (club()!.bookingProcess === 'hosted_play' && club()!.hostedPlayQueueEnabled && club()!.queueManagementFeePerPlayer! > 0) {
                    <div class="rate-row">
                      <span><i class="fas fa-list-ol"></i> Queue Management</span>
                      <strong>{{ club()!.queueManagementFeePerPlayer | currency:'PHP':'symbol':'1.0-0' }} / session</strong>
                    </div>
                  }
                </div>
              </article>
            }
          </section>

          @if (rates()!.updatedAt) {
            <p class="updated-note"><i class="fas fa-clock"></i> Last updated {{ rates()!.updatedAt | date:'mediumDate' }}</p>
          }
        </main>
      } @else {
        <div class="state-card empty">
          <i class="fas fa-circle-info"></i>
          <span>Rates have not been configured yet. Contact your club admin.</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #07130d;
      --panel: rgba(18,37,29,.94);
      --panel-2: rgba(25,53,42,.88);
      --border: rgba(255,255,255,.1);
      --text: #fff;
      --muted: rgba(255,255,255,.62);
      --soft: rgba(255,255,255,.42);
      --accent: #a3e635;
      --teal: #14b8a6;
      --blue: #38bdf8;
      --amber: #f59e0b;
    }

    .rules-shell {
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.12), transparent 26rem),
        linear-gradient(180deg, #0b1b12 0%, var(--bg) 34rem);
      padding: 0 1rem 2.5rem;
    }

    .topbar {
      max-width: 1040px;
      min-height: 74px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: .85rem;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
      background: linear-gradient(180deg, rgba(7,19,13,.98), rgba(7,19,13,.82));
      backdrop-filter: blur(10px);
    }

    .icon-btn {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.08);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .95rem;
    }
    .icon-btn:hover { background: rgba(255,255,255,.13); }

    .topbar-copy { min-width: 0; }
    .kicker, .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      color: var(--accent);
      font-size: .72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .topbar h1 { margin: .12rem 0 0; font-size: 1.1rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .eyebrow-row {
      display: flex;
      align-items: center;
      gap: .65rem;
      flex-wrap: wrap;
    }
    .booking-badge {
      display: inline-flex;
      align-items: center;
      gap: .38rem;
      background: rgba(163,230,53,.13);
      border: 1px solid rgba(163,230,53,.28);
      color: var(--accent);
      font-size: .68rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .07em;
      padding: .2rem .55rem;
      border-radius: 99px;
    }

    .rules-content {
      max-width: 1040px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .hero {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 1rem;
      align-items: center;
      padding: 1.15rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgba(25,53,42,.95), rgba(9,27,17,.96)),
        url('/tennis-court-surface.png') center / cover;
      box-shadow: 0 18px 50px rgba(0,0,0,.3);
      overflow: hidden;
      position: relative;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7,19,13,.14), rgba(7,19,13,.72));
      pointer-events: none;
    }
    .hero > * { position: relative; z-index: 1; }

    .club-mark {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      background: rgba(163,230,53,.13);
      border: 1px solid rgba(163,230,53,.22);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-size: 1rem;
      font-weight: 950;
      flex: 0 0 72px;
    }
    .club-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .hero-copy { min-width: 0; }
    .hero h2 { margin: .35rem 0 .35rem; font-size: clamp(1.75rem, 4vw, 3rem); line-height: 1; letter-spacing: 0; overflow-wrap: anywhere; }
    .hero p { margin: 0; max-width: 620px; color: rgba(255,255,255,.72); line-height: 1.5; }

    .quick-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: .85rem;
    }
    .quick-card {
      min-height: 104px;
      padding: .95rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: .22rem;
    }
    .quick-label, .quick-note { color: var(--muted); font-size: .76rem; font-weight: 800; }
    .quick-note { color: var(--soft); }
    .quick-card strong { color: var(--accent); font-size: 1.55rem; line-height: 1; font-weight: 950; }

    .section-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .rate-card {
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0,0,0,.2);
    }
    .service-card { grid-column: 1 / -1; }

    .card-head {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: .75rem;
      align-items: center;
      padding: .9rem;
      background: rgba(255,255,255,.035);
      border-bottom: 1px solid rgba(255,255,255,.075);
    }
    .card-icon {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .card-icon.lime { color: var(--accent); background: rgba(163,230,53,.14); }
    .card-icon.teal { color: var(--teal); background: rgba(20,184,166,.14); }
    .card-icon.blue { color: var(--blue); background: rgba(56,189,248,.14); }
    .card-icon.amber { color: var(--amber); background: rgba(245,158,11,.14); }
    .card-icon.violet { color: #c4b5fd; background: rgba(196,181,253,.13); }
    .card-head h3 { margin: 0; font-size: 1rem; line-height: 1.2; }
    .card-head p { margin: .16rem 0 0; color: var(--muted); font-size: .76rem; font-weight: 800; }

    .rate-list { padding: .35rem 0; }
    .rate-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: .72rem .95rem;
      border-bottom: 1px solid rgba(255,255,255,.055);
    }
    .rate-row:last-child { border-bottom: 0; }
    .rate-row span {
      min-width: 0;
      color: rgba(255,255,255,.8);
      display: inline-flex;
      align-items: center;
      gap: .52rem;
      font-size: .88rem;
      line-height: 1.35;
    }
    .rate-row i { width: 16px; color: rgba(163,230,53,.68); text-align: center; flex: 0 0 16px; font-size: .82rem; }
    .rate-row small { color: var(--soft); font-size: .72rem; }
    .rate-row strong {
      flex: 0 0 auto;
      color: var(--accent);
      font-size: .94rem;
      font-weight: 950;
      text-align: right;
      white-space: nowrap;
    }

    .updated-note {
      margin: .2rem 0 0;
      color: var(--soft);
      text-align: center;
      font-size: .76rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .4rem;
    }
    .updated-note i { color: var(--accent); }

    .state-card {
      max-width: 520px;
      min-height: 180px;
      margin: 3rem auto;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .75rem;
      font-weight: 800;
      text-align: center;
      padding: 1.25rem;
    }
    .state-card.empty { flex-direction: column; }
    .state-card.empty i { color: var(--accent); font-size: 1.8rem; }
    .spinner {
      width: 32px;
      height: 32px;
      border: 2px solid rgba(163,230,53,.2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin .9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 820px) {
      .section-grid { grid-template-columns: 1fr; }
      .quick-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .65rem; }
      .quick-card { min-height: 92px; padding: .8rem; }
      .quick-card strong { font-size: 1.35rem; }
    }

    @media (max-width: 560px) {
      .rules-shell { padding-inline: .75rem; }
      .topbar { min-height: 68px; grid-template-columns: 42px minmax(0, 1fr); }
      .icon-btn { width: 42px; height: 42px; }
      .hero { grid-template-columns: 1fr; padding: 1rem; }
      .club-mark { width: 60px; height: 60px; flex-basis: 60px; }
      .hero h2 { font-size: 1.85rem; }
      .hero p { font-size: .9rem; }
      .quick-grid { grid-template-columns: 1fr; }
      .quick-card { min-height: 78px; }
      .card-head { grid-template-columns: 40px minmax(0, 1fr); padding: .82rem; }
      .card-icon { width: 40px; height: 40px; }
      .rate-row { align-items: flex-start; padding: .72rem .82rem; gap: .7rem; }
      .rate-row span { font-size: .84rem; }
      .rate-row strong { font-size: .9rem; }
    }

    @media (max-width: 380px) {
      .rate-row { flex-direction: column; }
      .rate-row strong { text-align: left; }
    }
  `],
})
export class PlayerRulesComponent implements OnInit {
  private ratesService = inject(RatesService);
  private clubService = inject(ClubService);
  private auth = inject(AuthService);
  private router = inject(Router);

  rates = signal<Rates | null>(null);
  loading = signal(true);
  club = signal<Club | null>(null);

  get clubName(): string {
    return this.club()?.name || 'Your Club';
  }

  get clubInitials(): string {
    return this.clubName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'C';
  }

  get bookingProcess() { return this.club()?.bookingProcess ?? 'reservation'; }
  get isReservation() { return this.bookingProcess === 'reservation'; }
  get isPerGame()     { return this.bookingProcess === 'per_game'; }
  get isHostedPlay()  { return this.bookingProcess === 'hosted_play'; }

  get convenienceFeeSummary(): string {
    const c = this.club();
    if (!c) return '-';
    if (c.convenienceFeeMode === 'monthly_flat') {
      return `PHP ${(c.convenienceFeeMonthlyAmount ?? 0).toLocaleString()} / month`;
    }
    const pct = ((c.convenienceFeeRate ?? 0) * 100).toFixed(0);
    if (c.bookingProcess === 'hosted_play') return `${pct}% / player`;
    return c.convenienceFeeMode === 'per_transaction'
      ? `${pct}% / transaction`
      : `${pct}% / hour`;
  }

  ngOnInit() {
    this.ratesService.getRates().subscribe({
      next: r => {
        this.rates.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: c => this.club.set(c),
        error: () => {},
      });
    }
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
