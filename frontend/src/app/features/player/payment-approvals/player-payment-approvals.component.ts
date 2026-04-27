import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
      <div class="page-card">
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <h2>Payment Approvals</h2>
        </div>

        <div class="card-body">
          @if (loading) {
            <div class="loading">Loading...</div>
          } @else if (pendingCharges.length === 0 && rejectedCharges.length === 0) {
            <div class="empty-state">
              <span>✅</span>
              <p>No payments pending approval.</p>
            </div>
          } @else {
            @if (pendingCharges.length > 0) {
              <div class="section">
                <h3 class="section-title">Awaiting Approval</h3>
                <div class="charges-list">
                  @for (charge of pendingCharges; track charge._id) {
                    <div class="charge-card pending">
                      <div class="charge-icon">⏳</div>
                      <div class="charge-info">
                        <div class="charge-title">
                          {{ charge.chargeType === 'reservation' ? 'Court Reservation Fee' : 'Session Charge' }}
                        </div>
                        <div class="reserver-name">
                          <i class="fas fa-user"></i>
                          {{ isAdmin ? getPlayerName(charge) : (auth.user()?.name ?? '') }}
                        </div>
                        <div class="charge-meta">
                          @if (charge.chargeType === 'reservation' && charge.reservationId) {
                            📅 {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }} · Court {{ charge.reservationId.court }}
                          } @else if (charge.chargeType === 'session' && charge.sessionId) {
                            📅 {{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }} · {{ charge.sessionId.startTime }}
                          }
                          @if (charge.paymentMethod) { · 💳 {{ charge.paymentMethod }} }
                          @if (charge.paidAt) { · Submitted {{ charge.paidAt | date: 'MMM d' : 'UTC' }} }
                        </div>
                        @if (rejectingId === charge._id) {
                          <div class="reject-form">
                            <input class="reject-input" type="text" placeholder="Reason (optional)"
                              [(ngModel)]="rejectNote"
                              (keyup.enter)="confirmReject(charge._id)"
                              (keyup.escape)="cancelReject()" />
                            <div class="reject-actions">
                              <button class="btn-confirm-reject" (click)="confirmReject(charge._id)" [disabled]="processingId === charge._id">
                                <i class="fas fa-check"></i> Confirm
                              </button>
                              <button class="btn-cancel-reject" (click)="cancelReject()">
                                <i class="fas fa-times"></i> Cancel
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                      <div class="charge-right">
                        <span class="charge-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                        @if (isAdmin) {
                          <div class="action-btns">
                            <button class="icon-btn btn-icon-approve" [disabled]="processingId === charge._id"
                              (click)="approve(charge._id)" title="Approve payment">
                              @if (processingId === charge._id && lastAction === 'approve') {
                                <i class="fas fa-circle-notch fa-spin"></i>
                              } @else {
                                <i class="fas fa-check-circle"></i>
                              }
                            </button>
                            <button class="icon-btn btn-icon-reject" [disabled]="processingId === charge._id"
                              (click)="startReject(charge._id)" title="Reject payment">
                              <i class="fas fa-times-circle"></i>
                            </button>
                          </div>
                        } @else {
                          <span class="status-badge badge-pending">Awaiting Approval</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            @if (rejectedCharges.length > 0) {
              <div class="section">
                <h3 class="section-title">Rejected</h3>
                <div class="charges-list">
                  @for (charge of rejectedCharges; track charge._id) {
                    <div class="charge-card rejected">
                      <div class="charge-icon">❌</div>
                      <div class="charge-info">
                        <div class="charge-title">
                          {{ charge.chargeType === 'reservation' ? 'Court Reservation Fee' : 'Session Charge' }}
                        </div>
                        @if (isAdmin) {
                          <div class="player-name">{{ getPlayerName(charge) }}</div>
                        }
                        <div class="charge-meta">
                          @if (charge.chargeType === 'reservation' && charge.reservationId) {
                            📅 {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }} · Court {{ charge.reservationId.court }}
                          } @else if (charge.chargeType === 'session' && charge.sessionId) {
                            📅 {{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }} · {{ charge.sessionId.startTime }}
                          }
                        </div>
                        @if (charge.adminNote) {
                          <div class="admin-note">📝 "{{ charge.adminNote }}"</div>
                        }
                      </div>
                      <div class="charge-right">
                        <span class="charge-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                        <span class="status-badge badge-rejected">Rejected</span>
                        @if (!isAdmin) {
                          <button class="resubmit-btn" (click)="goToPayments()">Re-submit →</button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-wrap {
      position: relative; min-height: 100vh; padding: 20px;
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
    }
    .court-bg {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: url('/tennis-court-surface.png') center/cover no-repeat; z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); }
    .page-card {
      position: relative; z-index: 1; background: white; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; overflow: hidden;
    }
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; border-bottom: 1px solid #eee;
    }
    .card-header h2 { margin: 0; font-size: 22px; color: #333; }
    .back-btn {
      background: none; border: none; font-size: 15px;
      cursor: pointer; padding: 8px 12px; border-radius: 4px;
    }
    .back-btn:hover { background: #f0f0f0; }
    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 40px; color: #999; }
    .empty-state { text-align: center; padding: 48px 20px; color: #999; }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }
    .section { margin-bottom: 2rem; }
    .section-title {
      font-size: 0.85rem; font-weight: 700; color: #666;
      text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 0.75rem 0;
    }
    .charges-list { display: flex; flex-direction: column; gap: 10px; }
    .charge-card {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 14px 16px; border-radius: 10px;
      border-left: 4px solid transparent; background: #fafafa;
    }
    .charge-card.pending { border-left-color: #f59e0b; background: #fffbeb; }
    .charge-card.rejected { border-left-color: #ef4444; background: #fff5f5; }
    .charge-icon { font-size: 1.5rem; flex-shrink: 0; padding-top: 2px; }
    .charge-info { flex: 1; min-width: 0; }
    .charge-title { font-weight: 700; font-size: 0.95rem; color: #1a1a1a; }
    .player-name { font-size: 0.82rem; color: #9f7338; font-weight: 600; margin-top: 2px; }
    .reserver-name { font-size: 0.82rem; color: #9f7338; font-weight: 600; margin-top: 2px; }
    .charge-meta { font-size: 0.8rem; color: #666; margin-top: 3px; }
    .admin-note { font-size: 0.8rem; color: #dc3545; font-style: italic; margin-top: 4px; }
    .charge-right {
      display: flex; flex-direction: column; align-items: flex-end;
      gap: 6px; flex-shrink: 0; padding-top: 2px;
    }
    .charge-amount { font-size: 1.1rem; font-weight: 700; color: #9f7338; }
    .status-badge {
      font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 4px;
    }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .action-btns { display: flex; flex-direction: row; gap: 4px; align-items: center; }
    .icon-btn {
      width: 34px; height: 34px; border-radius: 50%; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 1.25rem; transition: transform 0.15s, opacity 0.15s;
      background: none; padding: 0;
    }
    .icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .icon-btn:not(:disabled):hover { transform: scale(1.15); }
    .btn-icon-approve { color: #28a745; }
    .btn-icon-approve:not(:disabled):hover { color: #218838; }
    .btn-icon-reject { color: #dc3545; }
    .btn-icon-reject:not(:disabled):hover { color: #b91c1c; }
    .reject-form { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
    .reject-input {
      width: 100%; padding: 6px 10px; border: 1px solid #f59e0b;
      border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;
    }
    .reject-input:focus { outline: none; border-color: #dc3545; }
    .reject-actions { display: flex; gap: 6px; }
    .btn-confirm-reject {
      padding: 4px 10px; background: #dc3545; color: white;
      border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
    }
    .btn-confirm-reject:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-cancel-reject {
      padding: 4px 10px; background: #f0f0f0; color: #333;
      border: none; border-radius: 6px; font-size: 0.8rem; cursor: pointer;
    }
    .resubmit-btn {
      padding: 5px 12px; background: #ef4444; color: white;
      border: none; border-radius: 6px; font-size: 0.78rem;
      font-weight: 600; cursor: pointer; transition: background 0.15s;
    }
    .resubmit-btn:hover { background: #dc2626; }
  `],
})
export class PlayerPaymentApprovalsComponent implements OnInit {
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
  ) {}

  ngOnInit() {
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

  getPlayerName(charge: Charge): string {
    if (charge.playerId && typeof charge.playerId === 'object') {
      return (charge.playerId as any).name || 'Unknown';
    }
    return 'Unknown';
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

  startReject(id: string) {
    this.rejectingId = id;
    this.rejectNote = '';
  }

  cancelReject() {
    this.rejectingId = null;
    this.rejectNote = '';
  }

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

  goBack() {
    this.router.navigate([this.isAdmin ? '/admin/dashboard' : '/player/dashboard']);
  }

  goToPayments() {
    this.router.navigate(['/payments']);
  }
}

