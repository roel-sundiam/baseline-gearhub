import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Club } from '../../../core/services/club.service';
import { CoinsService } from '../../../core/services/coins.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <nav class="navbar">
      <button type="button" class="nav-brand" (click)="goToDashboard()" title="Go to dashboard">
        <img src="/baselinegh.jpg" alt="Baseline Gearhub" class="brand-logo" />
        <span class="brand-name">Baseline Gearhub</span>
      </button>

      @if (auth.isLoggedIn()) {
        @if (!auth.isSuperAdmin()) {
          <div class="club-selector-wrap">
            <div class="club-locked-badge" title="Your assigned club">
              <span class="club-badge-icon" aria-hidden="true"><i class="fas fa-lock"></i></span>
              <span class="club-value">{{ activeClubName() || 'No club assigned' }}</span>
            </div>
          </div>
        }

        <!-- Coin Balance -->
        @if (!auth.isSuperAdmin()) {
          <button type="button" class="coin-badge" title="Manage coins" (click)="navigate('/admin/coins')">
            <i class="fas fa-coins"></i>
            <span>{{ coinsService.coinBalance() }}</span>
          </button>
        }

        <!-- Desktop Navigation -->
        <div class="nav-links desktop-nav">

          <!-- Profile Avatar with Image -->
          @if (auth.user()) {
            <button
              type="button"
              class="profile-section"
              (click)="goToProfile()"
              title="Edit profile"
            >
              <div class="profile-avatar">
                @if (auth.user()!.profileImage) {
                  <img [src]="auth.user()!.profileImage" alt="Profile" class="avatar-image" />
                } @else {
                  <span class="avatar-initials">{{ getInitials() }}</span>
                }
              </div>
              <span class="profile-username">{{ auth.user()!.name }}</span>
            </button>
          }

          <button class="btn-logout" (click)="auth.logout()" title="Logout">
            <i class="fas fa-sign-out-alt"></i>
            <span class="icon-label">Logout</span>
          </button>
        </div>

        <!-- Mobile Navigation -->
        <div class="mobile-nav">
          @if (auth.user()) {
            <button
              type="button"
              class="profile-section-mobile"
              (click)="goToProfile()"
              title="Edit profile"
            >
              <div class="profile-avatar">
                @if (auth.user()!.profileImage) {
                  <img [src]="auth.user()!.profileImage" alt="Profile" class="avatar-image" />
                } @else {
                  <span class="avatar-initials">{{ getInitials() }}</span>
                }
              </div>
            </button>
          }

          <button class="btn-logout-mobile-icon" (click)="auth.logout()" title="Logout">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      }
    </nav>
  `,
  styles: [
    `
      .navbar {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        color: white;
        padding: 0 1.5rem;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .nav-brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #ffffff;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.4rem 0.5rem;
        border-radius: 4px;
        transition: all 0.2s;
        font-family: inherit;
        flex-shrink: 0;
      }
      .nav-brand:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .brand-logo {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.35);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }
      .club-selector-wrap {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0 auto;
      }
      .club-locked-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.38);
        border-radius: 999px;
        padding: 0.25rem 0.7rem 0.25rem 0.3rem;
        font-size: 0.8rem;
        font-weight: 600;
        max-width: 260px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);
        backdrop-filter: blur(4px);
      }
      .club-badge-icon {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.22);
        border: 1px solid rgba(255, 255, 255, 0.34);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .club-badge-icon i {
        font-size: 0.62rem;
        opacity: 0.95;
      }
      .club-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 170px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }
      .club-icon {
        color: rgba(255,255,255,0.8);
        font-size: 0.9rem;
      }
      .club-select {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 6px;
        padding: 0.3rem 0.6rem;
        font-size: 0.85rem;
        cursor: pointer;
        outline: none;
        max-width: 180px;
      }
      .club-select option {
        background: #9f7338;
        color: #ffffff;
      }
      .club-select:focus {
        border-color: rgba(255, 255, 255, 0.6);
      }
      .nav-links {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .nav-btn {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4rem 0.75rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-family: inherit;
      }
      .nav-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
      }
      .btn-logout {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4rem 0.75rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .btn-logout:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
      }
      .icon-label { display: none; }
      .profile-section {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin: 0 0.5rem;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.4rem 0.5rem;
        border-radius: 8px;
        transition: all 0.2s;
        color: inherit;
        font-family: inherit;
      }
      .profile-section:hover { background: rgba(255, 255, 255, 0.15); }
      .profile-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        border: 2px solid rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
      }
      .avatar-image { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
      .avatar-initials { font-size: 0.85rem; font-weight: 700; color: #ffffff; text-transform: uppercase; }
      .profile-username {
        font-size: 0.9rem;
        color: #ffffff;
        font-weight: 500;
        max-width: 120px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @media (min-width: 769px) {
        .icon-label { display: inline; }
        .desktop-nav { display: flex !important; }
        .mobile-nav { display: none !important; }
      }
      @media (max-width: 768px) {
        .desktop-nav { display: none !important; }
        .mobile-nav { display: flex !important; align-items: center; gap: 0.5rem; }
        .club-select { max-width: 120px; font-size: 0.78rem; }
        .club-locked-badge { max-width: 190px; font-size: 0.74rem; }
        .club-value { max-width: 110px; }
      }
      @media (max-width: 600px) {
        .brand-name { display: none; }
        .club-select { max-width: 90px; font-size: 0.72rem; padding: 0.25rem 0.4rem; }
        .club-locked-badge { max-width: 130px; padding: 0.2rem 0.45rem 0.2rem 0.24rem; }
        .club-value { max-width: 84px; font-size: 0.73rem; }
        .profile-username { display: none; }
        .profile-section { margin: 0 0.25rem; }
      }

      .mobile-nav { position: relative; }
      .profile-section-mobile {
        background: none; border: none; cursor: pointer;
        padding: 0.4rem 0.5rem; border-radius: 8px;
        transition: all 0.2s; color: inherit; font-family: inherit;
      }
      .profile-section-mobile:hover { background: rgba(255, 255, 255, 0.15); }
      .btn-hamburger {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4rem 0.75rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1.2rem;
        transition: all 0.2s;
        display: flex; align-items: center; justify-content: center;
      }
      .btn-hamburger:hover { background: rgba(255, 255, 255, 0.2); border-color: rgba(255, 255, 255, 0.4); }
      .mobile-menu-dropdown {
        position: absolute;
        top: 60px; right: 0;
        background: #9f7338;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        min-width: 220px;
        z-index: 1000;
        overflow: hidden;
      }
      .mobile-menu-item {
        display: flex; align-items: center; gap: 0.75rem;
        width: 100%; padding: 0.75rem 1rem;
        color: #ffffff; background: none; border: none;
        text-decoration: none; cursor: pointer;
        font-size: 0.95rem; transition: all 0.2s;
        text-align: left; font-family: inherit;
      }
      .mobile-menu-item:hover, .mobile-menu-item.active { background: rgba(255, 255, 255, 0.15); }
      .mobile-menu-item i { width: 1.2rem; text-align: center; }
      .btn-logout-mobile { color: #ffffff; }
      .btn-logout-mobile:hover { background: rgba(255, 0, 0, 0.1); }
      .mobile-menu-divider { height: 1px; background: rgba(255, 255, 255, 0.1); }
      .btn-logout-mobile-icon {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4rem 0.75rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s;
        display: flex; align-items: center; justify-content: center;
      }
      .btn-logout-mobile-icon:hover { background: rgba(255, 0, 0, 0.1); border-color: rgba(255, 0, 0, 0.3); }
      .coin-badge {
        display: inline-flex; align-items: center; gap: 5px;
        background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
        border-radius: 20px; padding: 4px 12px; font-size: 0.85rem; font-weight: 700;
        color: #fff; white-space: nowrap; cursor: pointer; font-family: inherit;
        transition: background 0.15s;
      }
      .coin-badge:hover { background: rgba(255,255,255,0.25); }
      .coin-badge i { color: #fcd34d; font-size: 0.9rem; }
      .nav-btn-coins i { color: #fcd34d; }
    `,
  ],
})
export class NavbarComponent implements OnInit {
  mobileMenuOpen = false;
  protected clubs = signal<Club[]>([]);

  readonly activeClubName = computed(() => {
    const clubs = this.clubs();
    const selectedId = this.clubService.selectedClubId();
    if (selectedId) {
      const club = clubs.find((c) => c._id === selectedId);
      if (club) return club.name;
    }
    const userClubId = this.auth.user()?.clubId;
    if (userClubId) {
      const club = clubs.find((c) => c._id === userClubId);
      if (club) return club.name;
    }
    if (clubs.length === 1) return clubs[0].name;
    return '';
  });

  constructor(
    public auth: AuthService,
    public clubService: ClubService,
    public coinsService: CoinsService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.clubService.getClubs().subscribe({
      next: (clubs) => { this.clubs.set(clubs); },
      error: () => {},
    });
    if (this.auth.isLoggedIn() && !this.auth.isSuperAdmin()) {
      this.coinsService.loadBalance().subscribe({ error: () => {} });
    }
  }

  onClubChange(clubId: string) {
    this.clubService.setSelectedClubId(clubId);
  }

  getInitials(): string {
    const user = this.auth.user();
    if (!user) return '';
    return user.name
      .split(' ')
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }

  goToDashboard() {
    if (this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/clubs']);
      return;
    }
    if (this.auth.isAdmin()) {
      this.router.navigate(['/player/dashboard']);
      return;
    }
    this.router.navigate(['/player/dashboard']);
  }

  goToProfile() {
    this.router.navigate(['/player/profile/edit']);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
}
