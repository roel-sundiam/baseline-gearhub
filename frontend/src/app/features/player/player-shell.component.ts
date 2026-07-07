import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ClubService } from '../../core/services/club.service';

@Component({
  selector: 'app-player-shell',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="player-shell-content">
      <router-outlet />
    </div>

    <nav class="ps-bottom-nav">
      <button class="ps-nav-item" [class.ps-nav-active]="activeTab === 'home'"
              (click)="navigateTo('/player/dashboard')">
        <i class="fas fa-home"></i>
        <span>Home</span>
      </button>
      @if (!isPerGame && !isHostedPlay) {
        <button class="ps-nav-item" [class.ps-nav-active]="activeTab === 'courts'"
                (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i>
          <span>Courts</span>
        </button>
        <button class="ps-nav-item" [class.ps-nav-active]="activeTab === 'bookings'"
                (click)="navigateTo('/player/reservations')">
          <i class="far fa-calendar-check"></i>
          <span>Bookings</span>
        </button>
      }
      @if (isPerGame) {
        <button class="ps-nav-item" [class.ps-nav-active]="activeTab === 'pergame'"
                (click)="navigateTo('/player/per-game')">
          <i class="fas fa-table-tennis"></i>
          <span>Per Game</span>
        </button>
      }
      @if (isHostedPlay) {
        <button class="ps-nav-item" [class.ps-nav-active]="activeTab === 'sessions'"
                (click)="navigateTo('/player/hosted-play')">
          <i class="far fa-calendar-check"></i>
          <span>Sessions</span>
        </button>
      }
      <button class="ps-nav-item" [class.ps-nav-active]="activeTab === 'profile'"
              (click)="navigateTo('/player/profile/edit')">
        <i class="far fa-user"></i>
        <span>Profile</span>
      </button>
    </nav>
  `,
  styles: [`
    .player-shell-content {
      padding-bottom: 72px;
    }
    .ps-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: #111f16;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: stretch;
      height: 62px;
      z-index: 200;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }
    .ps-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.18rem;
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(255,255,255,0.35);
      font-size: 0.6rem;
      font-weight: 600;
      transition: color 0.2s;
      padding: 0;
    }
    .ps-nav-item i { font-size: 1.1rem; }
    .ps-nav-item.ps-nav-active { color: #a3e635; }

    @media (min-width: 769px) {
      .player-shell-content { padding-bottom: 0; }
      .ps-bottom-nav { display: none; }
    }
  `],
})
export class PlayerShellComponent implements OnInit {
  bookingProcess: 'reservation' | 'per_game' | 'hosted_play' = 'reservation';

  get isPerGame() { return this.bookingProcess === 'per_game'; }
  get isHostedPlay() { return this.bookingProcess === 'hosted_play'; }

  get activeTab(): string {
    const url = this.router.url;
    if (url.includes('/player/reservations')) return 'bookings';
    if (url.includes('/player/reserve')) return 'courts';
    if (url.includes('/player/per-game')) return 'pergame';
    if (url.includes('/player/hosted-play')) return 'sessions';
    if (url.includes('/player/profile')) return 'profile';
    return 'home';
  }

  constructor(
    private auth: AuthService,
    private clubService: ClubService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (club) => {
          this.bookingProcess = club.bookingProcess ?? 'reservation';
          this.cdr.detectChanges();
        },
        error: () => {},
      });
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
