import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { forkJoin, timeout, of, catchError } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="dashboard-shell">
      <header class="hero-panel">
        <div>
          <p class="hero-kicker">Baseline Gearhub</p>
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
            <a routerLink="/admin/rates" class="action-card">
              <span class="action-icon"><i class="fas fa-money-bill-wave"></i></span>
              <span class="action-title">Update Rates</span>
              <span class="action-sub">Adjust pricing and billing baselines</span>
            </a>
            <a routerLink="/admin/tournaments" class="action-card">
              <span class="action-icon"><i class="fas fa-trophy"></i></span>
              <span class="action-title">Tournaments</span>
              <span class="action-sub">Schedule and manage upcoming events</span>
            </a>
            <a routerLink="/admin/coins" class="action-card">
              <span class="action-icon"><i class="fas fa-coins"></i></span>
              <span class="action-title">Coins</span>
              <span class="action-sub">Request and manage club coin balance</span>
            </a>
          </div>
        </section>
      }
    </section>
  `,
  styles: [
    `
      :host {
        --ink: #11242a;
        --teal-700: #11616b;
        --teal-600: #1b7682;
        --teal-100: #dcf3f6;
        --sand: #f8f2e7;
        --line: rgba(17, 36, 42, 0.13);
        --danger: #b73131;
        --card-bg: rgba(255, 255, 255, 0.95);
        display: block;
        font-family: 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif;
      }

      .dashboard-shell {
        display: grid;
        gap: 1rem;
      }

      .hero-panel {
        background:
          radial-gradient(circle at top right, rgba(242, 183, 75, 0.3), transparent 45%),
          linear-gradient(145deg, var(--sand), #ffffff);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 1rem 1.2rem;
        box-shadow: 0 10px 28px rgba(7, 25, 29, 0.12);
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
        color: var(--teal-700);
      }

      .hero-panel h2 {
        margin: 0;
        font-size: 1.42rem;
        color: var(--ink);
        letter-spacing: -0.02em;
      }

      .hero-subtitle {
        margin: 0.38rem 0 0;
        color: rgba(17, 36, 42, 0.72);
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
      }

      .btn-primary {
        background: linear-gradient(145deg, var(--teal-600), #165a63);
        color: #ffffff;
        box-shadow: 0 8px 16px rgba(22, 90, 99, 0.25);
      }

      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 18px rgba(22, 90, 99, 0.32);
      }

      .btn-secondary {
        background: #ffffff;
        border-color: rgba(17, 36, 42, 0.18);
        color: var(--ink);
      }

      .btn-secondary:hover {
        background: #f3f8f9;
        transform: translateY(-1px);
      }

      .state-shell {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 1rem;
        box-shadow: 0 8px 24px rgba(12, 23, 27, 0.1);
      }

      .state-error {
        color: var(--danger);
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
        background: linear-gradient(110deg, #eaf1f3 8%, #f8fbfc 18%, #eaf1f3 33%);
        background-size: 200% 100%;
        animation: shimmer 1.1s linear infinite;
        border: 1px solid rgba(17, 36, 42, 0.07);
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
        box-shadow: 0 8px 20px rgba(10, 20, 23, 0.1);
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
        color: rgba(17, 36, 42, 0.78);
        font-weight: 700;
      }

      .stat-value {
        margin: 0;
        color: var(--ink);
        font-size: 1.45rem;
        font-weight: 800;
        line-height: 1.15;
        word-break: break-word;
      }

      .stat-link {
        color: var(--teal-700);
        font-size: 0.83rem;
        font-weight: 700;
        text-decoration: none;
      }

      .stat-link:hover {
        text-decoration: underline;
      }

      .stat-pending .stat-icon,
      .stat-approvals .stat-icon {
        background: #fff4da;
        border-color: rgba(245, 158, 11, 0.32);
        color: #9f5f06;
      }

      .stat-sessions .stat-icon {
        background: #def3f6;
        border-color: rgba(27, 118, 130, 0.33);
        color: #15646e;
      }

      .stat-unpaid .stat-icon {
        background: #ffecec;
        border-color: rgba(183, 49, 49, 0.34);
        color: #ab2828;
      }

      .approvals-section,
      .quick-actions {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 0.95rem;
        box-shadow: 0 8px 22px rgba(10, 20, 23, 0.1);
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
        color: var(--teal-700);
        font-weight: 800;
      }

      .section-header h3 {
        margin: 0.1rem 0 0;
        font-size: 1rem;
        color: var(--ink);
      }

      .section-link {
        color: var(--teal-700);
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
        background: #fffbef;
        border: 1px solid #f7d995;
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
        color: var(--ink);
        font-weight: 800;
      }

      .approval-detail {
        margin: 0.2rem 0 0;
        font-size: 0.78rem;
        color: rgba(17, 36, 42, 0.7);
      }

      .approval-actions {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .approval-amt {
        color: var(--teal-700);
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
        border: 1px solid rgba(20, 117, 52, 0.35);
        background: #1d8f44;
        color: #ffffff;
        cursor: pointer;
      }

      .btn-approve-sm:hover:not(:disabled) {
        background: #18793a;
      }

      .btn-approve-sm:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .btn-review-sm {
        background: #ffffff;
        color: var(--ink);
        border: 1px solid rgba(17, 36, 42, 0.22);
        text-decoration: none;
      }

      .btn-review-sm:hover {
        background: #eff6f8;
      }

      .approvals-empty {
        background: #f3f7f8;
        border: 1px dashed rgba(17, 36, 42, 0.2);
        border-radius: 10px;
        padding: 0.8rem;
        color: rgba(17, 36, 42, 0.74);
        font-size: 0.88rem;
      }

      .approvals-overflow {
        margin-top: 0.45rem;
        text-align: center;
        font-size: 0.8rem;
        color: rgba(17, 36, 42, 0.74);
      }

      .approvals-overflow a {
        color: var(--teal-700);
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
        background: #ffffff;
        border: 1px solid rgba(17, 36, 42, 0.13);
        border-radius: 12px;
        padding: 0.8rem;
        text-decoration: none;
        color: var(--ink);
        display: grid;
        gap: 0.34rem;
        box-shadow: 0 6px 16px rgba(12, 20, 24, 0.09);
        transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
      }

      .action-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 22px rgba(12, 20, 24, 0.15);
        border-color: rgba(27, 118, 130, 0.4);
      }

      .action-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #e6f4f7;
        color: #125e68;
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
        color: rgba(17, 36, 42, 0.72);
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
  ) {}

  ngOnInit() {
    console.log('Dashboard ngOnInit — starting API calls');

    forkJoin({
      pending: this.usersService.getPendingUsers(),
      sessions: this.sessionsService.getSessions(),
      approvals: this.chargesService.getPendingApprovals().pipe(catchError(() => of([]))),
    })
      .pipe(timeout(8000))
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
              'Request timed out. Is the backend running? Start it with: cd c:\\Projects2\\BaselineGearhubReservation\\backend && npm start';
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
    return 'Unknown';
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

