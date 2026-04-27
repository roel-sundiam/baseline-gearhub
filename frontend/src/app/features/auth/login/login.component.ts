import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService } from '../../../core/services/club.service';
import { AnalyticsTrackService } from '../../../core/services/analytics-track.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="court-bg">
        <div class="court-overlay"></div>
      </div>
      <div class="auth-card">
        <div class="auth-header">
          <div class="header-banner">
            <h1>Baseline Gearhub</h1>
          </div>
          <p class="header-sub">Member Login Access</p>
        </div>

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

          @if (errorMsg) {
            <div class="alert alert-error">{{ errorMsg }}</div>
          }

          <button type="submit" class="btn-primary btn-full" [disabled]="loading">
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <p class="auth-footer">Don't have an account? <a routerLink="/register">Register</a></p>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-container {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        margin: 0;
        overflow: hidden;
      }
      .court-bg {
        position: absolute;
        inset: 0;
        background: url('/tennis-court-surface.png') center center / cover no-repeat;
      }
      .court-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 18, 0, 0.35);
      }
      .auth-card {
        position: relative;
        z-index: 1;
        background: #ffffff;
        border-radius: 20px;
        padding: 0;
        width: 100%;
        max-width: 480px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.55),
          0 0 1px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }
      .auth-header {
        text-align: center;
        margin-bottom: 0;
      }
      .header-banner {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        padding: 2rem 2rem 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      .header-banner h1 {
        color: #ffffff;
        font-size: 1.75rem;
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.5px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      .header-sub {
        color: #b88942;
        font-size: 0.9rem;
        font-weight: 600;
        font-style: italic;
        margin: 0.85rem 0 0 0;
        padding: 0.4rem 1.25rem;
        background: #f8f1e4;
        border-top: 3px solid #c9a15d;
        width: 100%;
        box-sizing: border-box;
      }
      form {
        padding: 1.5rem 2rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        margin-bottom: 1.5rem;
      }
      .form-group label {
        font-size: 0.875rem;
        color: #111827;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      input:focus {
        outline: none;
        border-color: #c9a15d !important;
        box-shadow: 0 0 0 3px rgba(201, 161, 93, 0.15) !important;
      }
      .btn-primary {
        margin-top: 0.75rem;
        border-radius: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: #b88942;
        border-color: #b88942;
        box-shadow: 0 4px 12px rgba(184, 137, 66, 0.35);
      }
      .btn-primary:hover:not(:disabled) {
        background: #9f7338;
        border-color: #9f7338;
        box-shadow: 0 6px 16px rgba(184, 137, 66, 0.45);
      }
      .auth-footer {
        text-align: center;
        padding: 0 2rem 1.5rem;
        font-size: 0.9rem;
        color: #6b7280;
      }
      .auth-footer a {
        color: #b88942;
        font-weight: 600;
        text-decoration: none;
        transition: color 0.2s;
      }
      .auth-footer a:hover {
        color: #9f7338;
      }
      @media (max-width: 600px) {
        .header-banner {
          padding: 1.5rem 1.5rem 1.25rem;
        }
        .header-banner h1 {
          font-size: 1.5rem;
        }
        form {
          padding: 1.25rem 1.5rem;
        }
        .auth-footer {
          padding: 0 1.5rem 1.25rem;
        }
        .auth-container {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private clubService = inject(ClubService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private analyticsTrack = inject(AnalyticsTrackService);

  username = '';
  password = '';
  loading = false;
  errorMsg = '';

  onSubmit() {
    if (!this.username || !this.password) return;
    this.loading = true;
    this.errorMsg = '';

    this.auth.login(this.username, this.password).subscribe({
      next: (res) => {
        this.analyticsTrack.trackLogin(this.username);
        this.loading = false;
        this.cdr.detectChanges();
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
        this.loading = false;
        this.errorMsg = err.error?.error || 'Login failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }
}

