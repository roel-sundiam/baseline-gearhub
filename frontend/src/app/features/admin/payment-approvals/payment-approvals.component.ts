import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChargesService, Charge } from '../../../core/services/charges.service';

type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all';

@Component({
  selector: 'app-payment-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h2>Payment Approvals</h2>
      <p class="page-subtitle">Review and verify player-submitted payments</p>
    </div>

    <!-- Summary Stats -->
    <div class="summary-bar">
      <div class="summary-stat">
        <span class="summary-value">{{ pendingCharges.length }}</span>
        <span class="summary-label">Pending</span>
      </div>
      <div class="summary-stat approved">
        <span class="summary-value">{{ approvedCount }}</span>
        <span class="summary-label">Approved</span>
      </div>
      <div class="summary-stat rejected">
        <span class="summary-value">{{ rejectedCount }}</span>
        <span class="summary-label">Rejected</span>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="tabs">
      <button class="tab-btn" [class.active]="activeFilter === 'pending'" (click)="setFilter('pending')">
        Pending
        @if (pendingCharges.length > 0) {
          <span class="tab-badge">{{ pendingCharges.length }}</span>
        }
      </button>
      <button class="tab-btn" [class.active]="activeFilter === 'approved'" (click)="setFilter('approved')">Approved</button>
      <button class="tab-btn" [class.active]="activeFilter === 'rejected'" (click)="setFilter('rejected')">Rejected</button>
      <button class="tab-btn" [class.active]="activeFilter === 'all'" (click)="setFilter('all')">All</button>
    </div>

    @if (loading) {
      <div class="loading">Loading payments...</div>
    } @else if (errorMsg) {
      <div class="alert alert-error">{{ errorMsg }}</div>
    } @else if (filteredCharges.length === 0) {
      <div class="empty-state">
        @if (activeFilter === 'pending') {
          <span class="empty-icon">✅</span>
          <p>No payments pending approval.</p>
        } @else {
          <span class="empty-icon">📋</span>
          <p>No payments in this category.</p>
        }
      </div>
    } @else {
      <div class="charges-list">
        @for (charge of filteredCharges; track charge._id) {
          <div class="charge-card" [class.card-pending]="charge.approvalStatus === 'pending'"
               [class.card-approved]="charge.approvalStatus === 'approved'"
               [class.card-rejected]="charge.approvalStatus === 'rejected'">

            <!-- Player + Charge Info -->
            <div class="charge-info">
              <div class="player-row">
                <span class="player-name">{{ getPlayerName(charge) }}</span>
                <span class="approval-badge"
                      [class.badge-pending]="charge.approvalStatus === 'pending'"
                      [class.badge-approved]="charge.approvalStatus === 'approved'"
                      [class.badge-rejected]="charge.approvalStatus === 'rejected'">
                  {{ charge.approvalStatus | uppercase }}
                </span>
              </div>

              <div class="charge-meta">
                <span class="meta-item">
                  {{ charge.chargeType === 'reservation' ? '🏟️ Reservation' : '🎾 Session' }}
                </span>
                @if (charge.chargeType === 'reservation' && charge.reservationId) {
                  <span class="meta-item">📅 {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                  <span class="meta-item">Court {{ charge.reservationId.court }}</span>
                } @else if (charge.chargeType === 'session' && charge.sessionId) {
                  <span class="meta-item">📅 {{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                  <span class="meta-item">⏰ {{ charge.sessionId.startTime }}</span>
                }
                @if (charge.paymentMethod) {
                  <span class="meta-item">💳 {{ charge.paymentMethod }}</span>
                }
                @if (charge.paidAt) {
                  <span class="meta-item">📤 Submitted {{ charge.paidAt | date: 'MMM d, h:mm a' : 'UTC' }}</span>
                }
              </div>

              @if (charge.approvalStatus === 'rejected' && charge.adminNote) {
                <div class="admin-note">📝 {{ charge.adminNote }}</div>
              }

              <!-- Rejection note input -->
              @if (rejectingId === charge._id) {
                <div class="reject-form">
                  <input
                    class="reject-input"
                    type="text"
                    placeholder="Reason for rejection (optional)"
                    [(ngModel)]="rejectNote"
                    (keyup.enter)="confirmReject(charge._id)"
                    (keyup.escape)="cancelReject()"
                  />
                  <div class="reject-actions">
                    <button class="btn-confirm-reject" (click)="confirmReject(charge._id)" [disabled]="processingId === charge._id">
                      Confirm Reject
                    </button>
                    <button class="btn-cancel-reject" (click)="cancelReject()">Cancel</button>
                  </div>
                </div>
              }
            </div>

            <!-- Amount + Actions -->
            <div class="charge-right">
              <div class="charge-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</div>

              @if (charge.approvalStatus === 'pending') {
                <div class="action-btns">
                  <button class="btn-approve"
                          [disabled]="processingId === charge._id"
                          (click)="approve(charge._id)">
                    @if (processingId === charge._id && lastAction === 'approve') {
                      ...
                    } @else {
                      ✓ Approve
                    }
                  </button>
                  <button class="btn-reject"
                          [disabled]="processingId === charge._id"
                          (click)="startReject(charge._id)">
                    ✕ Reject
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .page-header {
      margin-bottom: 1.25rem;
    }
    .page-header h2 {
      color: var(--primary);
      font-size: 1.4rem;
      margin-bottom: 0.25rem;
    }
    .page-subtitle {
      color: #666;
      font-size: 0.9rem;
      margin: 0;
    }

    .summary-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .summary-stat {
      background: white;
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border-left: 4px solid #f59e0b;
      display: flex;
      flex-direction: column;
    }
    .summary-stat.approved { border-left-color: #28a745; }
    .summary-stat.rejected { border-left-color: #dc3545; }
    .summary-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a1a;
    }
    .summary-label {
      font-size: 0.8rem;
      color: #666;
    }

    .tabs {
      display: flex;
      border-bottom: 2px solid #eee;
      margin-bottom: 1.25rem;
      gap: 0.25rem;
    }
    .tab-btn {
      padding: 0.6rem 1rem;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #999;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .tab-badge {
      background: #f59e0b;
      color: white;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    .loading {
      color: #666;
      padding: 2rem 0;
    }
    .alert-error {
      background: #f8d7da;
      color: #721c24;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #999;
    }
    .empty-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 1rem;
    }

    .charges-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .charge-card {
      background: white;
      border-radius: 10px;
      padding: 1.25rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      border-left: 4px solid #ddd;
    }
    .card-pending { border-left-color: #f59e0b; }
    .card-approved { border-left-color: #28a745; }
    .card-rejected { border-left-color: #dc3545; }

    .charge-info { flex: 1; }

    .player-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .player-name {
      font-weight: 700;
      font-size: 1rem;
      color: #1a1a1a;
    }
    .approval-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .badge-pending { background: #fff3cd; color: #856404; }
    .badge-approved { background: #d4edda; color: #155724; }
    .badge-rejected { background: #f8d7da; color: #721c24; }

    .charge-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.82rem;
      color: #555;
    }
    .meta-item {
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .admin-note {
      margin-top: 0.5rem;
      font-size: 0.82rem;
      color: #dc3545;
      font-style: italic;
    }

    .reject-form {
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .reject-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      font-size: 0.9rem;
      outline: none;
      box-sizing: border-box;
    }
    .reject-input:focus { border-color: #dc3545; }
    .reject-actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn-confirm-reject {
      padding: 0.4rem 0.9rem;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-confirm-reject:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-cancel-reject {
      padding: 0.4rem 0.9rem;
      background: #f0f0f0;
      color: #333;
      border: none;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .charge-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.75rem;
      min-width: 120px;
    }
    .charge-amount {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--primary);
    }
    .action-btns {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      width: 100%;
    }
    .btn-approve {
      padding: 0.45rem 0.9rem;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      width: 100%;
    }
    .btn-approve:hover:not(:disabled) { background: #218838; }
    .btn-approve:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-reject {
      padding: 0.45rem 0.9rem;
      background: white;
      color: #dc3545;
      border: 1px solid #dc3545;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      width: 100%;
    }
    .btn-reject:hover:not(:disabled) {
      background: #dc3545;
      color: white;
    }
    .btn-reject:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class PaymentApprovalsComponent implements OnInit {
  allCharges: Charge[] = [];
  filteredCharges: Charge[] = [];
  activeFilter: ApprovalFilter = 'pending';
  loading = true;
  errorMsg = '';

  processingId: string | null = null;
  lastAction: 'approve' | 'reject' | null = null;
  rejectingId: string | null = null;
  rejectNote = '';

  get pendingCharges() {
    return this.allCharges.filter((c) => c.approvalStatus === 'pending');
  }
  get approvedCount() {
    return this.allCharges.filter((c) => c.approvalStatus === 'approved').length;
  }
  get rejectedCount() {
    return this.allCharges.filter((c) => c.approvalStatus === 'rejected').length;
  }

  constructor(
    private chargesService: ChargesService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.chargesService.getAllApprovalCharges().subscribe({
      next: (charges) => {
        this.allCharges = charges;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Failed to load payments.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  setFilter(filter: ApprovalFilter) {
    this.activeFilter = filter;
    this.applyFilter();
  }

  applyFilter() {
    switch (this.activeFilter) {
      case 'pending':
        this.filteredCharges = this.allCharges.filter((c) => c.approvalStatus === 'pending');
        break;
      case 'approved':
        this.filteredCharges = this.allCharges.filter((c) => c.approvalStatus === 'approved');
        break;
      case 'rejected':
        this.filteredCharges = this.allCharges.filter((c) => c.approvalStatus === 'rejected');
        break;
      default:
        this.filteredCharges = this.allCharges;
    }
  }

  getPlayerName(charge: Charge): string {
    if (charge.playerId && typeof charge.playerId === 'object') {
      return (charge.playerId as any).name || 'Unknown Player';
    }
    return 'Unknown Player';
  }

  approve(id: string) {
    this.processingId = id;
    this.lastAction = 'approve';
    this.chargesService.approvePayment(id).subscribe({
      next: (res) => {
        const idx = this.allCharges.findIndex((c) => c._id === id);
        if (idx >= 0) this.allCharges[idx] = res.charge;
        this.applyFilter();
        this.processingId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to approve payment.');
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
        const idx = this.allCharges.findIndex((c) => c._id === id);
        if (idx >= 0) this.allCharges[idx] = res.charge;
        this.applyFilter();
        this.processingId = null;
        this.rejectingId = null;
        this.rejectNote = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to reject payment.');
        this.processingId = null;
        this.cdr.detectChanges();
      },
    });
  }
}
