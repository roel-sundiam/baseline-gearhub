import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../../core/services/public-booking.service';

type Club = { _id: string; name: string; slug?: string; location?: string; logo?: string };

@Component({
  selector: 'app-club-picker',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
        <a routerLink="/" class="nav-back">&#8592; Back to home</a>
      </header>

      <!-- Content -->
      <div class="content">

        <div class="page-header">
          <span class="page-badge">Guest Booking</span>
          <h1 class="page-title">Choose your club</h1>
          <p class="page-sub">Book a court without creating an account.</p>
        </div>

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
        } @else {

          <!-- Search -->
          @if (clubs().length > 0) {
            <div class="search-wrap">
              <span class="search-icon">&#128269;</span>
              <input
                class="search-input"
                type="search"
                placeholder="Search clubs by name or location…"
                [value]="searchTerm()"
                (input)="searchTerm.set($any($event.target).value)"
                autocomplete="off"
              />
              @if (searchTerm()) {
                <button class="search-clear" (click)="searchTerm.set('')" aria-label="Clear search">&#10005;</button>
              }
            </div>
          }

          <!-- Club list -->
          @if (filteredClubs().length === 0 && clubs().length === 0) {
            <div class="state-centered">
              <div class="state-icon">&#127916;</div>
              <p>No clubs are currently accepting guest bookings.</p>
            </div>
          } @else if (filteredClubs().length === 0) {
            <div class="state-centered">
              <div class="state-icon">&#128269;</div>
              <p>No clubs match "<strong>{{ searchTerm() }}</strong>".</p>
              <button class="retry-btn" (click)="searchTerm.set('')">Clear search</button>
            </div>
          } @else {
            <div class="club-list">
              @for (club of filteredClubs(); track club._id) {
                <button class="club-card" (click)="pick(club)">
                  <div class="club-logo-wrap">
                    @if (club.logo) {
                      <img [src]="club.logo" [alt]="club.name" class="club-logo-img" />
                    } @else {
                      <div class="club-logo-placeholder"></div>
                    }
                  </div>
                  <div class="club-info">
                    <div class="club-name">{{ club.name }}</div>
                    @if (club.location) {
                      <div class="club-location">&#128205; {{ club.location }}</div>
                    }
                  </div>
                  <div class="club-arrow">Book &rarr;</div>
                </button>
              }
            </div>
          }

        }

      </div>

      <footer class="footer">
        <span>Already a member?</span>
        <a routerLink="/login" class="footer-link">Sign in here &rarr;</a>
      </footer>

    </div>
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
    .orb-1 { width: 400px; height: 400px; top: -120px; right: -80px;  opacity: 0.18; animation-duration: 11s; }
    .orb-2 { width: 260px; height: 260px; bottom: 20%; left: -60px;   opacity: 0.13; animation-duration: 9s;  animation-delay: -4s; }
    .orb-3 { width: 180px; height: 180px; bottom: 5%;  right: 15%;    opacity: 0.11; animation-duration: 14s; animation-delay: -7s; }
    @keyframes float {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-32px) scale(1.07); }
    }
    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image:
        repeating-linear-gradient(0deg,   rgba(163,230,53,0.04) 0, rgba(163,230,53,0.04) 1px, transparent 1px, transparent 80px),
        repeating-linear-gradient(90deg,  rgba(163,230,53,0.04) 0, rgba(163,230,53,0.04) 1px, transparent 1px, transparent 80px);
    }

    /* ── Navbar ── */
    .navbar {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 3rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .nav-logo { height: 32px; width: auto; }
    .nav-back {
      font-size: 0.85rem;
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      text-decoration: none;
      transition: color 0.15s;
    }
    .nav-back:hover { color: #a3e635; }

    /* ── Content ── */
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      width: 100%;
      max-width: 620px;
      margin: 0 auto;
      padding: 4rem 1.5rem 3rem;
    }

    /* ── Page header ── */
    .page-header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
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
      margin-bottom: 1.1rem;
    }
    .page-title {
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
      margin: 0 0 0.65rem;
    }
    .page-sub {
      font-size: 1rem;
      color: rgba(255,255,255,0.4);
      margin: 0;
    }

    /* ── Search ── */
    .search-wrap {
      position: relative;
      margin-bottom: 1.25rem;
    }
    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.95rem;
      pointer-events: none;
      color: rgba(255,255,255,0.3);
    }
    .search-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 0.85rem 2.75rem 0.85rem 2.75rem;
      color: #fff;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }
    .search-input:focus {
      border-color: rgba(163,230,53,0.4);
      background: rgba(163,230,53,0.04);
    }
    .search-input::placeholder { color: rgba(255,255,255,0.25); }
    /* hide browser's built-in clear button */
    .search-input::-webkit-search-cancel-button { display: none; }

    .search-clear {
      position: absolute;
      right: 0.85rem;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.3);
      font-size: 0.8rem;
      cursor: pointer;
      padding: 0.25rem 0.4rem;
      border-radius: 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .search-clear:hover { color: rgba(255,255,255,0.7); }

    /* ── State views ── */
    .state-centered {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 3rem 0;
      color: rgba(255,255,255,0.4);
      font-size: 0.9rem;
      text-align: center;
    }
    .state-centered strong { color: rgba(255,255,255,0.7); }
    .state-icon { font-size: 2rem; }

    .spinner {
      width: 24px; height: 24px;
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

    /* ── Club list ── */
    .club-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .club-card {
      display: flex;
      align-items: center;
      gap: 1.1rem;
      width: 100%;
      padding: 1.1rem 1.25rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s, transform 0.15s;
      text-align: left;
      font-family: inherit;
    }
    .club-card:hover {
      border-color: rgba(163,230,53,0.3);
      background: rgba(163,230,53,0.04);
      transform: translateY(-1px);
    }

    .club-logo-wrap { flex-shrink: 0; }
    .club-logo-img {
      width: 52px; height: 52px;
      border-radius: 12px;
      object-fit: cover;
    }
    .club-logo-placeholder {
      width: 52px; height: 52px;
      border-radius: 12px;
      background: linear-gradient(135deg, #a3e635 0%, #4d7c0f 100%);
    }

    .club-info { flex: 1; min-width: 0; }
    .club-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.2rem;
    }
    .club-location {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.35);
    }

    .club-arrow {
      font-size: 0.82rem;
      font-weight: 700;
      color: rgba(163,230,53,0.6);
      flex-shrink: 0;
      letter-spacing: 0.02em;
      transition: color 0.15s;
    }
    .club-card:hover .club-arrow { color: #a3e635; }

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
    }
    .footer-link {
      color: #a3e635;
      text-decoration: none;
      font-weight: 600;
      transition: opacity 0.15s;
    }
    .footer-link:hover { opacity: 0.8; }

    /* ── Mobile ── */
    @media (max-width: 640px) {
      .navbar { padding: 1rem 1.25rem; }
      .content { padding: 2.5rem 1.1rem 2rem; }
      .club-card { padding: 0.9rem 1rem; }
      .club-logo-img, .club-logo-placeholder { width: 44px; height: 44px; border-radius: 10px; }
    }
  `],
})
export class ClubPickerComponent implements OnInit {
  clubs = signal<Club[]>([]);
  loading = signal(true);
  error = signal('');
  searchTerm = signal('');

  filteredClubs = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.clubs();
    return this.clubs().filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.location?.toLowerCase().includes(term) ?? false)
    );
  });

  constructor(
    private publicBookingService: PublicBookingService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.publicBookingService.getClubs().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load clubs. Please try again.');
        this.loading.set(false);
      },
    });
  }

  pick(club: Club) {
    this.router.navigate(['/book', club.slug ?? club._id]);
  }
}
