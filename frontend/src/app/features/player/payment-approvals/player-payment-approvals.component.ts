import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-player-payment-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dm-shell">

      <header class="dm-header">
        <button class="dm-back-btn" (click)="goBack()"><i class="fas fa-chevron-left"></i></button>
        <span class="dm-header-title">Payment Approvals</span>
      </header>

      <div class="dm-body">
        @if (loading) {
          <div class="dm-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>
        } @else if (pendingCharges.length === 0 && rejectedCharges.length === 0) {
          <div class="dm-empty">
            <div class="dm-empty-icon"><i class="fas fa-check-circle"></i></div>
            <p class="dm-empty-text">No payments pending approval</p>
          </div>
        } @else {

          @if (pendingCharges.length > 0) {
            <div class="dm-section">
              <h4 class="dm-section-label">Awaiting Approval</h4>
              <div class="dm-charge-list">
                @for (charge of pendingCharges; track charge._id) {
                  <div class="dm-charge-card dm-charge-pending">
                    <div class="dm-charge-accent dm-accent-amber"></div>
                    <div class="dm-charge-main">
                      <div class="dm-charge-top">
                        <span class="dm-charge-title">{{ charge.chargeType === 'reservation' ? 'Court Reservation Fee' : 'Session Charge' }}</span>
                        <span class="dm-status dm-status-pending"><i class="fas fa-hourglass-half"></i> Pending</span>
                        @if (isPartialCredit(charge)) {
                          <span class="dm-status dm-status-credit"><i class="fas fa-coins"></i> Partial Credit</span>
                        }
                      </div>
                      <div class="dm-charge-player">
                        <i class="far fa-user"></i>
                        {{ isAdmin ? getPlayerName(charge) : (auth.user()?.name ?? '') }}
                      </div>
                      <div class="dm-charge-meta">
                        @if (charge.chargeType === 'reservation' && charge.reservationId) {
                          <span><i class="far fa-calendar"></i> {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                          <span>· Court {{ charge.reservationId.court }}</span>
                        } @else if (charge.chargeType === 'session' && charge.sessionId) {
                          <span><i class="far fa-calendar"></i> {{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                        }
                        @if (charge.paymentMethod) { <span>· <i class="far fa-credit-card"></i> {{ charge.paymentMethod }}</span> }
                        @if (charge.paidAt) { <span>· Submitted {{ charge.paidAt | date: 'MMM d' : 'UTC' }}</span> }
                      </div>
                      @if ((charge.creditApplied ?? 0) > 0) {
                        <div class="dm-charge-credit-note">
                          <i class="fas fa-coins"></i> {{ charge.creditApplied | currency: 'PHP' : 'symbol' }} paid via credit
                          @if (charge.paymentMethod && charge.paymentMethod !== 'Credit') {
                            &middot; {{ (charge.amount - charge.creditApplied!) | currency: 'PHP' : 'symbol' }} via {{ charge.paymentMethod }}
                          }
                        </div>
                      }
                      @if (rejectingId === charge._id) {
                        <div class="dm-reject-form">
                          <input class="dm-reject-input" type="text" placeholder="Reason (optional)"
                            [(ngModel)]="rejectNote"
                            (keyup.enter)="confirmReject(charge._id)"
                            (keyup.escape)="cancelReject()" />
                          <div class="dm-reject-actions">
                            <button class="dm-btn-confirm-reject" (click)="confirmReject(charge._id)" [disabled]="processingId === charge._id">
                              <i class="fas fa-check"></i> Confirm
                            </button>
                            <button class="dm-btn-cancel-reject" (click)="cancelReject()">
                              <i class="fas fa-times"></i> Cancel
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                    <div class="dm-charge-right">
                      <span class="dm-charge-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                      @if (isAdmin) {
                        <div class="dm-action-btns">
                          <button class="dm-icon-btn dm-btn-approve" [disabled]="processingId === charge._id"
                            (click)="approve(charge._id)" title="Approve">
                            @if (processingId === charge._id && lastAction === 'approve') {
                              <i class="fas fa-circle-notch fa-spin"></i>
                            } @else {
                              <i class="fas fa-check-circle"></i>
                            }
                          </button>
                          <button class="dm-icon-btn dm-btn-reject" [disabled]="processingId === charge._id"
                            (click)="startReject(charge._id)" title="Reject">
                            <i class="fas fa-times-circle"></i>
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @if (rejectedCharges.length > 0) {
            <div class="dm-section">
              <h4 class="dm-section-label">Rejected</h4>
              <div class="dm-charge-list">
                @for (charge of rejectedCharges; track charge._id) {
                  <div class="dm-charge-card dm-charge-rejected">
                    <div class="dm-charge-accent dm-accent-red"></div>
                    <div class="dm-charge-main">
                      <div class="dm-charge-top">
                        <span class="dm-charge-title">{{ charge.chargeType === 'reservation' ? 'Court Reservation Fee' : 'Session Charge' }}</span>
                        <span class="dm-status dm-status-rejected">Rejected</span>
                      </div>
                      @if (isAdmin) {
                        <div class="dm-charge-player"><i class="far fa-user"></i> {{ getPlayerName(charge) }}</div>
                      }
                      <div class="dm-charge-meta">
                        @if (charge.chargeType === 'reservation' && charge.reservationId) {
                          <span><i class="far fa-calendar"></i> {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                          <span>· Court {{ charge.reservationId.court }}</span>
                        } @else if (charge.chargeType === 'session' && charge.sessionId) {
                          <span><i class="far fa-calendar"></i> {{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                        }
                      </div>
                      @if (charge.adminNote) {
                        <div class="dm-admin-note"><i class="fas fa-comment-alt"></i> "{{ charge.adminNote }}"</div>
                      }
                    </div>
                    <div class="dm-charge-right">
                      <span class="dm-charge-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                      @if (!isAdmin) {
                        <button class="dm-resubmit-btn" (click)="goToPayments()">Re-submit →</button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }
        <div class="dm-bottom-spacer"></div>
      </div>

      <nav class="dm-bottom-nav">
        <button class="dm-nav-item dm-nav-active" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-home"></i><span>Home</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i><span>Courts</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reservations')">
          <i class="far fa-calendar-check"></i><span>Bookings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/tournaments?tab=rankings')">
          <i class="fas fa-trophy"></i><span>Rankings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/profile/edit')">
          <i class="far fa-user"></i><span>Profile</span>
        </button>
      </nav>
    </div>
  `,
  styles: [`
    :host { display: block; margin: -1.5rem; width: calc(100% + 3rem); }
    @media (min-width: 769px) { :host { margin: 0; width: 100%; } }

    .dm-shell { display: flex; flex-direction: column; height: calc(100vh - 60px); max-width: 480px; margin: 0 auto; background: #0c1a11; font-family: inherit; }

    .dm-header { background: #0c1a11; padding: 1rem 1.1rem 0.85rem; display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .dm-back-btn { background: rgba(255,255,255,0.08); border: none; color: #a3e635; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.85rem; transition: background 0.2s; }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }
    .dm-header-title { color: #ffffff; font-size: 1.05rem; font-weight: 800; flex: 1; }

    .dm-body { flex: 1; overflow-y: auto; padding: 1rem; background: #0c1a11; -webkit-overflow-scrolling: touch; }
    .dm-bottom-spacer { height: 80px; }
    .dm-section { margin-bottom: 1.25rem; }
    .dm-section-label { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.40); text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 0.5rem 0; }

    .dm-loading { text-align: center; color: rgba(255,255,255,0.35); padding: 3rem 1rem; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .dm-empty { text-align: center; padding: 3rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .dm-empty-icon { width: 56px; height: 56px; border-radius: 50%; background: rgba(163,230,53,0.1); color: #a3e635; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
    .dm-empty-text { color: rgba(255,255,255,0.4); font-size: 0.88rem; margin: 0; }

    .dm-charge-list { display: flex; flex-direction: column; gap: 0.65rem; }
    .dm-charge-card { background: #1b3028; border-radius: 12px; display: flex; align-items: stretch; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
    .dm-charge-accent { width: 4px; flex-shrink: 0; }
    .dm-accent-amber { background: #f59e0b; }
    .dm-accent-red { background: #ef4444; }
    .dm-charge-pending { opacity: 1; }
    .dm-charge-rejected { opacity: 0.85; }

    .dm-charge-main { flex: 1; padding: 0.85rem 0.9rem; display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .dm-charge-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.1rem; flex-wrap: wrap; }
    .dm-charge-title { font-size: 0.85rem; font-weight: 700; color: #ffffff; }
    .dm-charge-player { font-size: 0.75rem; color: #a3e635; font-weight: 600; display: flex; align-items: center; gap: 0.3rem; }
    .dm-charge-meta { font-size: 0.72rem; color: rgba(255,255,255,0.38); display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; margin-top: 0.1rem; }
    .dm-charge-meta i { font-size: 0.65rem; }
    .dm-admin-note { font-size: 0.72rem; color: rgba(239,68,68,0.8); font-style: italic; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.3rem; }

    .dm-status { font-size: 0.65rem; font-weight: 700; border-radius: 8px; padding: 0.18rem 0.5rem; display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; }
    .dm-status-pending { background: rgba(245,158,11,0.14); color: #f59e0b; }
    .dm-status-rejected { background: rgba(239,68,68,0.14); color: #ef4444; }
    .dm-status-credit { background: rgba(163,230,53,0.14); color: #a3e635; }
    .dm-charge-credit-note { font-size: 0.72rem; color: #a3e635; display: flex; align-items: center; gap: 0.3rem; margin-top: 0.25rem; flex-wrap: wrap; }

    .dm-charge-right { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; padding: 0.85rem 0.9rem; gap: 0.5rem; flex-shrink: 0; }
    .dm-charge-amount { font-size: 1rem; font-weight: 800; color: #a3e635; white-space: nowrap; }
    .dm-action-btns { display: flex; gap: 0.35rem; }
    .dm-icon-btn { width: 34px; height: 34px; border-radius: 50%; border: none; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.2rem; transition: all 0.15s; padding: 0; }
    .dm-icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .dm-btn-approve { color: #4ade80; }
    .dm-btn-approve:not(:disabled):hover { background: rgba(74,222,128,0.15); transform: scale(1.1); }
    .dm-btn-reject { color: #ef4444; }
    .dm-btn-reject:not(:disabled):hover { background: rgba(239,68,68,0.15); transform: scale(1.1); }

    .dm-reject-form { margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .dm-reject-input { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; padding: 0.5rem 0.75rem; font-size: 0.82rem; font-family: inherit; width: 100%; box-sizing: border-box; }
    .dm-reject-input:focus { outline: none; border-color: #ef4444; }
    .dm-reject-input::placeholder { color: rgba(255,255,255,0.3); }
    .dm-reject-actions { display: flex; gap: 0.5rem; }
    .dm-btn-confirm-reject { padding: 0.35rem 0.75rem; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; font-family: inherit; }
    .dm-btn-confirm-reject:disabled { opacity: 0.55; cursor: not-allowed; }
    .dm-btn-cancel-reject { padding: 0.35rem 0.75rem; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border: none; border-radius: 6px; font-size: 0.78rem; cursor: pointer; font-family: inherit; }
    .dm-resubmit-btn { padding: 0.35rem 0.75rem; background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; font-family: inherit; transition: background 0.2s; }
    .dm-resubmit-btn:hover { background: rgba(239,68,68,0.25); }

    .dm-bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: #111f16; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: stretch; height: 62px; z-index: 200; box-shadow: 0 -4px 20px rgba(0,0,0,0.4); }
    .dm-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.18rem; background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.35); font-size: 0.6rem; font-weight: 600; transition: color 0.2s; padding: 0; font-family: inherit; }
    .dm-nav-item i { font-size: 1.1rem; }
    .dm-nav-item.dm-nav-active { color: #a3e635; }

    @media (min-width: 769px) {
      .dm-shell { max-width: 720px; height: auto; min-height: calc(100vh - 60px); }
      .dm-body { overflow-y: visible; padding: 1.5rem 2rem 2rem; }
      .dm-bottom-nav { display: none; }
      .dm-bottom-spacer { display: none; }
    }
  `],
})
export class PlayerPaymentApprovalsComponent implements OnInit, OnDestroy {
  charges: Charge[] = [];
  loading = true;
  isAdmin = false;

  processingId: string | null = null;
  lastAction: 'approve' | 'reject' | null = null;
  rejectingId: string | null = null;
  rejectNote = '';

  get pendingCharges() {
    return this.charges.filter((c) => c.approvalStatus === 'pending');
  }
  get rejectedCharges() {
    return this.charges.filter((c) => c.approvalStatus === 'rejected');
  }

  constructor(
    private chargesService: ChargesService,
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.isAdmin = this.auth.isAdmin();

    const source$ = this.isAdmin
      ? this.chargesService.getAllApprovalCharges()
      : this.chargesService.getMyCharges();

    source$.subscribe({
      next: (charges) => {
        this.charges = this.isAdmin
          ? charges
          : charges.filter((c) => c.approvalStatus === 'pending' || c.approvalStatus === 'rejected');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  getPlayerName(charge: Charge): string {
    if (charge.playerId && typeof charge.playerId === 'object') {
      return (charge.playerId as any).name || 'Unknown';
    }
    return 'Unknown';
  }

  // True when a charge was paid using a mix of account credit and an external method
  // (as opposed to fully paid by credit alone, which already shows paymentMethod "Credit").
  isPartialCredit(charge: Charge): boolean {
    return (charge.creditApplied ?? 0) > 0 && !!charge.paymentMethod && charge.paymentMethod !== 'Credit';
  }

  approve(id: string) {
    this.processingId = id;
    this.lastAction = 'approve';
    this.chargesService.approvePayment(id).subscribe({
      next: (res) => {
        const idx = this.charges.findIndex((c) => c._id === id);
        if (idx >= 0) this.charges[idx] = res.charge;
        this.processingId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to approve.');
        this.processingId = null;
        this.cdr.detectChanges();
      },
    });
  }

  startReject(id: string) { this.rejectingId = id; this.rejectNote = ''; }
  cancelReject() { this.rejectingId = null; this.rejectNote = ''; }

  confirmReject(id: string) {
    this.processingId = id;
    this.lastAction = 'reject';
    this.chargesService.rejectPayment(id, this.rejectNote || undefined).subscribe({
      next: (res) => {
        const idx = this.charges.findIndex((c) => c._id === id);
        if (idx >= 0) this.charges[idx] = res.charge;
        this.rejectingId = null;
        this.rejectNote = '';
        this.processingId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to reject.');
        this.processingId = null;
        this.cdr.detectChanges();
      },
    });
  }

  navigateTo(route: string) {
    const [path, query] = route.split('?');
    if (query) {
      const queryParams = Object.fromEntries(new URLSearchParams(query));
      this.router.navigate([path], { queryParams });
    } else {
      this.router.navigate([path]);
    }
  }

  goBack() { this.router.navigate([this.isAdmin ? '/admin/dashboard' : '/player/dashboard']); }
  goToPayments() { this.router.navigate(['/payments']); }
}
