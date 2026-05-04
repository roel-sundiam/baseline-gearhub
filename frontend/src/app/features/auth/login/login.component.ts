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
        background: var(--dm-bg);
      }
      .court-bg {
        position: absolute;
        inset: 0;
        background: none;
      }
      .court-overlay {
        position: absolute;
        inset: 0;
        background: none;
      }
      .auth-card {
        position: relative;
        z-index: 1;
        background: var(--dm-surface);
        border-radius: 20px;
        padding: 0;
        width: 100%;
        max-width: 480px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.55),
          0 0 1px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(163,230,53,0.12);
        overflow: hidden;
      }
      .auth-header {
        text-align: center;
        margin-bottom: 0;
      }
      .header-banner {
        background: var(--dm-header);
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
        color: var(--dm-accent);
        font-size: 0.9rem;
        font-weight: 600;
        font-style: italic;
        margin: 0.85rem 0 0 0;
        padding: 0.4rem 1.25rem;
        background: rgba(163,230,53,0.08);
        border-top: 3px solid var(--dm-accent);
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
        color: rgba(255,255,255,0.8);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      input {
        padding: 0.75rem 1rem;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        font-size: 0.95rem;
        background: rgba(255,255,255,0.04);
        color: #ffffff;
        font-family: inherit;
      }
      input::placeholder {
        color: rgba(255,255,255,0.4);
      }
      input:focus {
        outline: none;
        border-color: rgba(163,230,53,0.28) !important;
        box-shadow: 0 0 0 3px rgba(163,230,53,0.12) !important;
      }
      .alert {
        padding: 0.875rem 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
      }
      .alert-error {
        background: rgba(239,68,68,0.12);
        color: #fca5a5;
        border: 1px solid rgba(239,68,68,0.2);
      }
      .btn-primary {
        margin-top: 0.75rem;
        border-radius: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: rgba(163,230,53,0.16);
        color: var(--dm-accent);
        border: 1px solid rgba(163,230,53,0.28);
        box-shadow: 0 4px 12px rgba(163,230,53,0.12);
        cursor: pointer;
        padding: 0.75rem 1.5rem;
        font-size: 0.95rem;
      }
      .btn-primary:hover:not(:disabled) {
        background: rgba(163,230,53,0.24);
        border-color: rgba(163,230,53,0.4);
        box-shadow: 0 6px 16px rgba(163,230,53,0.2);
      }
      .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-full {
        width: 100%;
      }
      .auth-footer {
        text-align: center;
        padding: 0 2rem 1.5rem;
        font-size: 0.9rem;
        color: rgba(255,255,255,0.6);
      }
      .auth-footer a {
        color: var(--dm-accent);
        font-weight: 600;
        text-decoration: none;
        transition: color 0.2s;
      }
      .auth-footer a:hover {
        color: rgba(163,230,53,0.9);
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

