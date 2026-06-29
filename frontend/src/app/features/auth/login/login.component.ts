import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { APP_VERSION } from '../../../version';
import { ClubService } from '../../../core/services/club.service';
import { AnalyticsTrackService } from '../../../core/services/analytics-track.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>

      <div class="card">
        <a class="back-link" (click)="goBack()" style="cursor:pointer">&larr; Back</a>

        <a routerLink="/book"><img src="/CourtGo.png" alt="CourtGo" class="card-logo" /></a>
        <h1>Welcome back</h1>
        <p class="card-sub">Sign in to your account</p>

        <form (ngSubmit)="onSubmit()" #f="ngForm">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              type="text"
              [(ngModel)]="username"
              name="username"
              required
              autocomplete="username"
              placeholder="Your username"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </div>

          @if (errorMsg()) {
            <div class="alert-error">{{ errorMsg() }}</div>
          }

          <button type="submit" class="btn-signin" [disabled]="loading()">
            {{ loading() ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <div class="card-footer">
          <p class="footer-link">No account? <a routerLink="/register">Register for free</a></p>
          <p class="footer-link footer-link--muted">New club? <a routerLink="/register-club">Register your club</a></p>
        </div>
      </div>

      <span class="app-version">{{ version }}</span>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--dm-bg, #0c1a11);
      padding: 2rem 1rem;
      position: relative;
      overflow: hidden;
    }

    .bg-orb {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, rgba(163,230,53,0.45), rgba(163,230,53,0.03));
      filter: blur(28px);
      pointer-events: none;
      animation: float ease-in-out infinite alternate;
    }
    .bg-orb-1 { width: 340px; height: 340px; top: -100px; left: -100px; opacity: 0.2; animation-duration: 10s; }
    .bg-orb-2 { width: 200px; height: 200px; bottom: -60px; right: -60px; opacity: 0.14; animation-duration: 8s; animation-delay: -4s; }

    @keyframes float {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-24px) scale(1.06); }
    }

    .card {
      position: relative;
      z-index: 1;
      background: var(--dm-surface, #1b3028);
      border: 1px solid rgba(163,230,53,0.1);
      border-radius: 20px;
      padding: 2.5rem 2.25rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }

    .back-link {
      display: inline-block;
      font-size: 0.8rem;
      color: rgba(255,255,255,0.35);
      text-decoration: none;
      margin-bottom: 1.75rem;
      transition: color 0.15s;
    }
    .back-link:hover { color: #a3e635; }

    .card-logo {
      height: 32px;
      width: auto;
      display: block;
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 1.65rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.35rem;
      letter-spacing: -0.01em;
    }

    .card-sub {
      font-size: 0.875rem;
      color: rgba(255,255,255,0.4);
      margin: 0 0 2rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      margin-bottom: 1.1rem;
    }
    .form-group label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: rgba(255,255,255,0.55);
    }
    input {
      padding: 0.85rem 1rem;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      font-size: 0.95rem;
      background: rgba(255,255,255,0.04);
      color: #fff;
      font-family: inherit;
      transition: border-color 0.18s, box-shadow 0.18s;
    }
    input::placeholder { color: rgba(255,255,255,0.28); }
    input:focus {
      outline: none;
      border-color: rgba(163,230,53,0.35);
      box-shadow: 0 0 0 3px rgba(163,230,53,0.1);
    }

    .alert-error {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 0.75rem;
      font-size: 0.875rem;
      background: rgba(239,68,68,0.1);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.2);
    }

    .btn-signin {
      width: 100%;
      margin-top: 0.5rem;
      padding: 0.9rem;
      border-radius: 10px;
      border: none;
      background: #a3e635;
      color: #0c1a11;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
      box-shadow: 0 4px 18px rgba(163,230,53,0.28);
    }
    .btn-signin:hover:not(:disabled) {
      background: #b5f040;
      box-shadow: 0 6px 24px rgba(163,230,53,0.4);
      transform: translateY(-1px);
    }
    .btn-signin:disabled { opacity: 0.55; cursor: not-allowed; }

    .card-footer {
      margin-top: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .footer-link {
      text-align: center;
      font-size: 0.875rem;
      color: rgba(255,255,255,0.45);
      margin: 0;
    }
    .footer-link a {
      color: #a3e635;
      font-weight: 600;
      text-decoration: none;
    }
    .footer-link a:hover { color: #b5f040; }
    .footer-link--muted { font-size: 0.8rem; color: rgba(255,255,255,0.25); }
    .footer-link--muted a { color: rgba(163,230,53,0.65); }

    .app-version {
      position: fixed;
      bottom: 0.75rem;
      right: 1rem;
      font-size: 0.68rem;
      color: rgba(255,255,255,0.15);
      letter-spacing: 0.07em;
      pointer-events: none;
    }
  `],
})
export class LoginComponent {
  readonly version = APP_VERSION;

  private auth = inject(AuthService);
  private clubService = inject(ClubService);
  private router = inject(Router);
  private location = inject(Location);
  private analyticsTrack = inject(AnalyticsTrackService);

  username = '';
  password = '';
  loading = signal(false);
  errorMsg = signal('');

  goBack() {
    if ((history.state?.navigationId ?? 1) > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/book']);
    }
  }

  onSubmit() {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: (res) => {
        this.analyticsTrack.trackLogin(this.username);
        this.loading.set(false);
        const role = res.user.role;
        const clubId = res.user.clubId;
        if (clubId) {
          this.clubService.setSelectedClubId(clubId);
        }
        if (role === 'superadmin') {
          this.router.navigate(['/admin/clubs']);
          return;
        }
        if (role === 'admin') {
          this.router.navigate(['/player/dashboard']);
          return;
        }
        this.router.navigate(['/player/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.error || 'Login failed. Please try again.');
      },
    });
  }
}

