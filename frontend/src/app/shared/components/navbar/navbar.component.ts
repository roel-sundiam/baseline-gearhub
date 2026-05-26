import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Club } from '../../../core/services/club.service';
import { SoundService } from '../../../core/services/sound.service';
import { InquiriesService } from '../../../core/services/inquiries.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <nav class="navbar">
      <button type="button" class="nav-brand" (click)="goToDashboard()" title="Go to dashboard">
        <img src="/CourtGo.png" alt="CourtGo" class="brand-logo" />
      </button>

      @if (auth.isLoggedIn()) {

        <!-- Inquiries chat icon (admin only) -->
        @if (auth.isAdmin() && !auth.isSuperAdmin()) {
          <button type="button" class="btn-inquiries" (click)="navigate('/admin/inquiries')" title="Inquiries">
            <i class="fas fa-comment-dots"></i>
            @if (unreadCount() > 0) {
              <span class="inq-dot">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
            }
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

          <button class="btn-mute" (click)="sound.toggleMute()" [title]="sound.muted() ? 'Unmute sounds' : 'Mute sounds'">
            <i class="fas" [class.fa-bell]="!sound.muted()" [class.fa-bell-slash]="sound.muted()"></i>
          </button>

          <button class="btn-logout" (click)="auth.logout()" title="Logout">
            <i class="fas fa-sign-out-alt"></i>
            <span class="icon-label">Logout</span>
          </button>
        </div>

        <!-- Mobile Navigation -->
        <div class="mobile-nav">
          <button class="btn-mute-mobile" (click)="sound.toggleMute()" [title]="sound.muted() ? 'Unmute sounds' : 'Mute sounds'">
            <i class="fas" [class.fa-bell]="!sound.muted()" [class.fa-bell-slash]="sound.muted()"></i>
          </button>

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
        height: 32px;
        width: auto;
        object-fit: contain;
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
      .btn-mute {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4rem 0.6rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
        display: flex; align-items: center;
      }
      .btn-mute:hover { background: rgba(255, 255, 255, 0.2); color: #ffffff; }
      .btn-mute-mobile {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4rem 0.6rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
        display: flex; align-items: center;
      }
      .btn-mute-mobile:hover { background: rgba(255, 255, 255, 0.2); color: #ffffff; }
      .btn-inquiries {
        position: relative;
        background: rgba(255,255,255,0.1);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        width: 38px; height: 38px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 1.05rem;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .btn-inquiries:hover { background: rgba(255,255,255,0.22); }
      .inq-dot {
        position: absolute;
        top: -5px; right: -5px;
        background: #ef4444;
        color: #fff;
        border-radius: 10px;
        min-width: 18px; height: 18px;
        font-size: 0.65rem;
        font-weight: 800;
        display: flex; align-items: center; justify-content: center;
        padding: 0 3px;
        border: 2px solid #9f7338;
        line-height: 1;
      }
    `,
  ],
})
export class NavbarComponent implements OnInit, OnDestroy {
  mobileMenuOpen = false;
  protected clubs = signal<Club[]>([]);
  unreadCount = signal(0);
  private routerSub: any;
  private unreadPollTimer: any = null;

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
    private router: Router,
    public sound: SoundService,
    private inquiriesService: InquiriesService,
  ) {}

  ngOnInit() {
    this.clubService.getClubs().subscribe({
      next: (clubs) => { this.clubs.set(clubs); },
      error: () => {},
    });
    if (this.auth.isAdmin() && !this.auth.isSuperAdmin()) {
      this.loadUnreadCount();
      this.unreadPollTimer = setInterval(() => this.loadUnreadCount(), 15000);
    }

    // Use window.location.pathname because router.url is '/' until first NavigationEnd
    this.updateThemeClass(window.location.pathname);
    this.routerSub = this.router.events.subscribe((ev: any) => {
      if (ev instanceof NavigationEnd) {
        this.updateThemeClass(ev.urlAfterRedirects || ev.url || '');
        if (this.auth.isAdmin() && !this.auth.isSuperAdmin()) {
          this.loadUnreadCount();
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.routerSub && typeof this.routerSub.unsubscribe === 'function') {
      this.routerSub.unsubscribe();
    }
    if (this.unreadPollTimer) { clearInterval(this.unreadPollTimer); }
    document.documentElement.classList.remove('dark-player-page');
    document.body.classList.remove('dark-player-page');
  }

  private updateThemeClass(url: string) {
    const isDark = typeof url === 'string' && (url.startsWith('/admin') || url.startsWith('/player'));
    const cls = 'dark-player-page';
    if (isDark) {
      document.documentElement.classList.add(cls);
      document.body.classList.add(cls);
    } else {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
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

  private loadUnreadCount() {
    this.inquiriesService.getInquiries().subscribe({
      next: (list) => this.unreadCount.set(list.filter(i => i.status === 'unread').length),
      error: () => {},
    });
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
}
