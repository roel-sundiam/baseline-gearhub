import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';
import { forkJoin, timeout, of, catchError } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="dashboard-shell">
      <header class="hero-panel">
        <div>
          <p class="hero-kicker"><span style="color:#a3e635">Court</span><span style="color:#ffffff">Go</span></p>
          <h2>Admin Command Center</h2>
          <p class="hero-subtitle">Monitor operations, handle approvals, and keep your club finances moving.</p>
        </div>
        <div class="hero-actions">
          <a routerLink="/admin/payment-approvals" class="btn-secondary">
            <i class="fas fa-receipt"></i>
            Review Payments
          </a>
        </div>
      </header>

      @if (loading) {
        <section class="state-shell">
          <div class="loading-skeleton">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="skeleton-card"></div>
            }
          </div>
        </section>
      } @else if (errorMsg) {
        <section class="state-shell state-error">
          <i class="fas fa-triangle-exclamation"></i>
          <p>{{ errorMsg }}</p>
        </section>
      } @else {
        <section class="stats-grid">
          <article class="stat-card stat-pending">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-user-clock"></i></span>
              <span class="stat-label">Pending Approvals</span>
            </div>
            <p class="stat-value">{{ pendingCount }}</p>
            <a routerLink="/admin/users" class="stat-link">Review users</a>
          </article>

          <article class="stat-card stat-sessions">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-calendar-days"></i></span>
              <span class="stat-label">Total Sessions</span>
            </div>
            <p class="stat-value">{{ sessionCount }}</p>
            <a routerLink="/admin/sessions" class="stat-link">View sessions</a>
          </article>

          <article class="stat-card stat-unpaid">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-wallet"></i></span>
              <span class="stat-label">Total Outstanding</span>
            </div>
            <p class="stat-value">{{ unpaidAmount | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
            <a routerLink="/admin/sessions" class="stat-link">View charges</a>
          </article>

          <article class="stat-card stat-approvals">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-hourglass-half"></i></span>
              <span class="stat-label">Payment Approvals</span>
            </div>
            <p class="stat-value">{{ pendingApprovalsCount }}</p>
            <a routerLink="/admin/payment-approvals" class="stat-link">Review payments</a>
          </article>
        </section>

        <section class="approvals-section">
          <div class="section-header">
            <div>
              <p class="section-kicker">Queue</p>
              <h3>Payment Approvals</h3>
            </div>
            <a routerLink="/admin/payment-approvals" class="section-link">View all</a>
          </div>

          @if (pendingApprovals.length === 0) {
            <div class="approvals-empty">No payments pending approval.</div>
          } @else {
            <div class="approvals-list">
              @for (charge of pendingApprovals.slice(0, 5); track charge._id) {
                <article class="approval-row">
                  <div class="approval-info">
                    <p class="approval-player">{{ getPlayerName(charge) }}</p>
                    <p class="approval-detail">
                      {{ charge.chargeType === 'reservation' ? 'Reservation' : 'Session' }}
                      @if (charge.chargeType === 'reservation' && charge.reservationId) {
                        · {{ charge.reservationId.date | date: 'MMM d' : 'UTC' }}
                      } @else if (charge.chargeType === 'session' && charge.sessionId) {
                        · {{ charge.sessionId.date | date: 'MMM d' : 'UTC' }}
                      }
                      · {{ charge.paymentMethod }}
                    </p>
                  </div>

                  <div class="approval-actions">
                    <span class="approval-amt">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                    <button class="btn-approve-sm" [disabled]="processingId === charge._id" (click)="quickApprove(charge._id)">
                      {{ processingId === charge._id ? 'Approving...' : 'Approve' }}
                    </button>
                    <a [routerLink]="['/admin/payment-approvals']" class="btn-review-sm">Review</a>
                  </div>
                </article>
              }
            </div>
            @if (pendingApprovals.length > 5) {
              <div class="approvals-overflow">
                +{{ pendingApprovals.length - 5 }} more pending ·
                <a routerLink="/admin/payment-approvals">See all</a>
              </div>
            }
          }
        </section>

        <section class="quick-actions">
          <div class="section-header">
            <div>
              <p class="section-kicker">Workflow</p>
              <h3>Quick Actions</h3>
            </div>
          </div>

          <div class="action-grid">
            <a routerLink="/admin/users" class="action-card">
              <span class="action-icon"><i class="fas fa-users"></i></span>
              <span class="action-title">Manage Users</span>
              <span class="action-sub">Approve and maintain member accounts</span>
            </a>
            <a routerLink="/admin/reservations" class="action-card">
              <span class="action-icon"><i class="fas fa-calendar-check"></i></span>
              <span class="action-title">Court Reservations</span>
              <span class="action-sub">View, edit, and manage court bookings</span>
            </a>
            @if (authService.isSuperAdmin()) {
              <a routerLink="/admin/reservations-report" class="action-card">
                <span class="action-icon"><i class="fas fa-chart-bar"></i></span>
                <span class="action-title">Reservations Report</span>
                <span class="action-sub">All reservations with status — superadmin view</span>
              </a>
            }
            <a routerLink="/admin/rates" class="action-card">
              <span class="action-icon"><i class="fas fa-money-bill-wave"></i></span>
              <span class="action-title">Update Rates</span>
              <span class="action-sub">Adjust pricing and billing baselines</span>
            </a>
            <!-- Tournaments hidden until feature is ready
            <a routerLink="/admin/tournaments" class="action-card">
              <span class="action-icon"><i class="fas fa-trophy"></i></span>
              <span class="action-title">Tournaments</span>
              <span class="action-sub">Schedule and manage upcoming events</span>
            </a>
            -->
            <a routerLink="/admin/news" class="action-card">
              <span class="action-icon"><i class="fas fa-newspaper"></i></span>
              <span class="action-title">Club News</span>
              <span class="action-sub">Post updates and announcements</span>
            </a>
            <a routerLink="/admin/inquiries" class="action-card">
              <span class="action-icon"><i class="fas fa-envelope"></i></span>
              <span class="action-title">Inquiries</span>
              <span class="action-sub">View and reply to guest messages</span>
            </a>
            <a routerLink="/admin/open-play" class="action-card">
              <span class="action-icon"><i class="fas fa-table-tennis-paddle-ball"></i></span>
              <span class="action-title">Open Play</span>
              <span class="action-sub">Run skill-balanced sessions and track CRI ratings</span>
            </a>
            <a routerLink="/features" target="_blank" class="action-card action-card--features">
              <span class="action-icon"><i class="fas fa-star"></i></span>
              <span class="action-title" style="display:flex;align-items:center;gap:4px;">
                Features Page
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="opacity:0.55"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </span>
              <span class="action-sub">Public showcase — share with new clubs &amp; players</span>
            </a>
            <a href="/video/courtgo-features.mp4" target="_blank" class="action-card">
              <span class="action-icon"><i class="fas fa-film"></i></span>
              <span class="action-title" style="display:flex;align-items:center;gap:4px;">
                Feature Video
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="opacity:0.55"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </span>
              <span class="action-sub">Animated walkthrough video — share or download</span>
            </a>
          </div>
        </section>
      }
    </section>
  `,
  styles: [
    `
      :host {
        --ink: #ffffff;
        --gold: var(--dm-accent);
        --gold-dark: rgba(163,230,53,0.9);
        --gold-light: rgba(163,230,53,0.08);
        --warm-bg: var(--dm-surface);
        --line: rgba(163,230,53,0.12);
        --danger: #fca5a5;
        --card-bg: var(--dm-surface);
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--dm-bg);
      }

      .dashboard-shell {
        display: grid;
        gap: 1rem;
        padding: 1.5rem;
        min-height: calc(100vh - 60px);
      }

      .hero-panel {
        background: var(--dm-header);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 18px;
        padding: 1rem 1.2rem;
        box-shadow: 0 4px 16px rgba(0,0,0,0.32);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .hero-kicker {
        margin: 0 0 0.2rem;
        font-size: 0.74rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 800;
        color: var(--gold);
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .hero-panel h2 {
        margin: 0;
        font-size: 1.42rem;
        color: #ffffff;
        letter-spacing: -0.02em;
      }

      .hero-subtitle {
        margin: 0.38rem 0 0;
        color: rgba(255,255,255,0.7);
        font-size: 0.91rem;
      }

      .hero-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .btn-primary,
      .btn-secondary {
        border-radius: 10px;
        padding: 0.56rem 0.88rem;
        font-size: 0.86rem;
        font-weight: 700;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border: 1px solid transparent;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        white-space: nowrap;
        cursor: pointer;
        font-family: inherit;
      }

      .btn-primary {
        background: var(--gold);
        color: #111827;
        border-color: var(--gold);
        box-shadow: 0 2px 8px rgba(163,230,53,0.24);
      }

      .btn-primary:hover {
        background: var(--gold-dark);
        border-color: var(--gold-dark);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(163,230,53,0.32);
      }

      .btn-secondary {
        background: rgba(255,255,255,0.08);
        border-color: rgba(163,230,53,0.24);
        color: var(--gold);
      }

      .btn-secondary:hover {
        background: rgba(255,255,255,0.12);
        border-color: rgba(163,230,53,0.4);
        transform: translateY(-1px);
      }

      .state-shell {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 1rem;
        box-shadow: 0 2px 12px rgba(0,0,0,0.24);
      }

      .state-error {
        color: #fca5a5;
        display: grid;
        justify-items: center;
        gap: 0.55rem;
        text-align: center;
      }

      .state-error i {
        font-size: 1.4rem;
      }

      .state-error p {
        margin: 0;
      }

      .loading-skeleton {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.7rem;
      }

      .skeleton-card {
        height: 135px;
        border-radius: 14px;
        background: linear-gradient(110deg, rgba(255,255,255,0.06) 8%, rgba(255,255,255,0.1) 18%, rgba(255,255,255,0.06) 33%);
        background-size: 200% 100%;
        animation: shimmer 1.1s linear infinite;
        border: 1px solid rgba(163,230,53,0.08);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.75rem;
      }

      .stat-card {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 0.95rem;
        box-shadow: 0 2px 12px rgba(0,0,0,0.24);
        display: grid;
        gap: 0.55rem;
      }

      .stat-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .stat-icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
      }

      .stat-label {
        font-size: 0.84rem;
        color: rgba(255,255,255,0.72);
        font-weight: 700;
      }

      .stat-value {
        margin: 0;
        color: #ffffff;
        font-size: 1.45rem;
        font-weight: 800;
        line-height: 1.15;
        word-break: break-word;
      }

      .stat-link {
        color: var(--gold);
        font-size: 0.83rem;
        font-weight: 700;
        text-decoration: none;
      }

      .stat-link:hover {
        text-decoration: underline;
      }

      .stat-pending .stat-icon,
      .stat-approvals .stat-icon {
        background: rgba(245,158,11,0.12);
        border-color: rgba(245,158,11,0.2);
        color: #fcd34d;
      }

      .stat-sessions .stat-icon {
        background: rgba(163,230,53,0.12);
        border-color: rgba(163,230,53,0.2);
        color: var(--gold);
      }

      .stat-unpaid .stat-icon {
        background: rgba(239,68,68,0.12);
        border-color: rgba(239,68,68,0.2);
        color: #fca5a5;
      }

      .approvals-section,
      .quick-actions {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 0.95rem;
        box-shadow: 0 8px 22px rgba(0,0,0,0.32);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        margin-bottom: 0.7rem;
      }

      .section-kicker {
        margin: 0;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--gold);
        font-weight: 800;
      }

      .section-header h3 {
        margin: 0.1rem 0 0;
        font-size: 1rem;
        color: #ffffff;
      }

      .section-link {
        color: var(--gold);
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
      }

      .section-link:hover {
        text-decoration: underline;
      }

      .approvals-list {
        display: grid;
        gap: 0.55rem;
      }

      .approval-row {
        background: rgba(163,230,53,0.06);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 10px;
        padding: 0.62rem 0.7rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        flex-wrap: wrap;
      }

      .approval-info {
        flex: 1;
        min-width: 220px;
      }

      .approval-player {
        margin: 0;
        font-size: 0.9rem;
        color: #ffffff;
        font-weight: 800;
      }

      .approval-detail {
        margin: 0.2rem 0 0;
        font-size: 0.78rem;
        color: rgba(255,255,255,0.7);
      }

      .approval-actions {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .approval-amt {
        color: var(--gold);
        font-size: 0.93rem;
        font-weight: 800;
      }

      .btn-approve-sm,
      .btn-review-sm {
        border-radius: 8px;
        padding: 0.35rem 0.72rem;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .btn-approve-sm {
        border: 1px solid rgba(163,230,53,0.28);
        background: rgba(163,230,53,0.16);
        color: var(--gold);
        cursor: pointer;
      }

      .btn-approve-sm:hover:not(:disabled) {
        background: rgba(163,230,53,0.24);
      }

      .btn-approve-sm:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .btn-review-sm {
        background: rgba(255,255,255,0.06);
        color: var(--gold);
        border: 1px solid rgba(163,230,53,0.24);
        text-decoration: none;
      }

      .btn-review-sm:hover {
        background: rgba(255,255,255,0.1);
      }

      .approvals-empty {
        background: rgba(255,255,255,0.03);
        border: 1px dashed rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 0.8rem;
        color: rgba(255,255,255,0.6);
        font-size: 0.88rem;
      }

      .approvals-overflow {
        margin-top: 0.45rem;
        text-align: center;
        font-size: 0.8rem;
        color: rgba(255,255,255,0.6);
      }

      .approvals-overflow a {
        color: var(--gold);
        text-decoration: none;
        font-weight: 700;
      }

      .approvals-overflow a:hover {
        text-decoration: underline;
      }

      .action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.6rem;
      }

      .action-card {
        background: var(--dm-surface);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 12px;
        padding: 0.8rem;
        text-decoration: none;
        color: #ffffff;
        display: grid;
        gap: 0.34rem;
        box-shadow: 0 6px 16px rgba(0,0,0,0.24);
        transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
      }

      .action-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 22px rgba(163,230,53,0.12);
        border-color: rgba(163,230,53,0.28);
      }

      .action-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(163,230,53,0.12);
        color: var(--gold);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
      }

      .action-title {
        font-weight: 800;
        font-size: 0.9rem;
      }

      .action-sub {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.72);
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      @media (max-width: 860px) {
        .hero-panel {
          flex-direction: column;
          align-items: stretch;
        }

        .hero-actions {
          justify-content: flex-start;
        }
      }

      @media (max-width: 640px) {
        .dashboard-shell {
          gap: 0.85rem;
        }

        .hero-panel {
          padding: 0.85rem;
        }

        .hero-panel h2 {
          font-size: 1.2rem;
        }

        .hero-subtitle {
          font-size: 0.84rem;
        }

        .hero-actions {
          width: 100%;
        }

        .btn-primary,
        .btn-secondary {
          width: 100%;
        }

        .stats-grid {
          grid-template-columns: 1fr;
        }

        .approval-info {
          min-width: 0;
        }

        .approval-actions {
          width: 100%;
          justify-content: flex-start;
        }

        .action-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminDashboardComponent implements OnInit {
  loading = true;
  errorMsg = '';
  pendingCount = 0;
  sessionCount = 0;
  unpaidAmount = 0;
  pendingApprovalsCount = 0;
  pendingApprovals: Charge[] = [];
  processingId: string | null = null;

  constructor(
    private usersService: UsersService,
    private sessionsService: SessionsService,
    private chargesService: ChargesService,
    private cdr: ChangeDetectorRef,
    protected authService: AuthService,
  ) {}

  ngOnInit() {
    console.log('Dashboard ngOnInit — starting API calls');

    forkJoin({
      pending: this.usersService.getPendingUsers(),
      sessions: this.sessionsService.getSessions(),
      approvals: this.chargesService.getPendingApprovals().pipe(catchError(() => of([]))),
    })
      .pipe(timeout(20000))
      .subscribe({
        next: ({ pending, sessions, approvals }) => {
          console.log('Dashboard API success', { pending, sessions, approvals });
          this.pendingCount = pending.length;
          this.sessionCount = sessions.length;
          this.unpaidAmount = sessions.reduce((total, s) => {
            const unpaid = s.players
              .filter((p) => p.status === 'unpaid')
              .reduce((sum, p) => sum + p.charges.total, 0);
            return total + unpaid;
          }, 0);
          this.pendingApprovalsCount = approvals.length;
          this.pendingApprovals = approvals;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Dashboard API error', err);
          this.loading = false;
          if (err.name === 'TimeoutError') {
            this.errorMsg =
              'Request timed out. The server may be waking up — please wait a moment and refresh.';
          } else if (err.status === 401) {
            this.errorMsg = 'Session expired — please log out and log in again.';
          } else {
            this.errorMsg = `Error ${err.status || err.message || 'unknown'}. Check browser console (F12) for details.`;
          }
          this.cdr.detectChanges();
        },
      });
  }

  getPlayerName(charge: Charge): string {
    if (charge.playerId && typeof charge.playerId === 'object') {
      return (charge.playerId as any).name || 'Unknown';
    }
    return charge.guestName || 'Unknown';
  }

  quickApprove(id: string) {
    this.processingId = id;
    this.chargesService.approvePayment(id).subscribe({
      next: (res) => {
        this.pendingApprovals = this.pendingApprovals.filter((c) => c._id !== id);
        this.pendingApprovalsCount = this.pendingApprovals.length;
        this.processingId = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.processingId = null;
        this.cdr.detectChanges();
      },
    });
  }
}

