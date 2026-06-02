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
    <div class="pa-shell">

      <!-- Header -->
      <div class="pa-header">
        <p class="pa-kicker"><i class="fas fa-shield-alt"></i> Admin</p>
        <h2 class="pa-title">Payment Approvals</h2>
        <p class="pa-subtitle">Review and verify player-submitted payments</p>
      </div>

      <!-- Summary Stats -->
      <div class="pa-stats">
        <div class="pa-stat pa-stat-pending">
          <span class="pa-stat-value">{{ pendingCharges.length }}</span>
          <span class="pa-stat-label">Pending</span>
        </div>
        <div class="pa-stat pa-stat-approved">
          <span class="pa-stat-value">{{ approvedCount }}</span>
          <span class="pa-stat-label">Approved</span>
        </div>
        <div class="pa-stat pa-stat-rejected">
          <span class="pa-stat-value">{{ rejectedCount }}</span>
          <span class="pa-stat-label">Rejected</span>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="pa-tabs">
        <button class="pa-tab" [class.active]="activeFilter === 'pending'" (click)="setFilter('pending')">
          Pending
          @if (pendingCharges.length > 0) {
            <span class="pa-tab-badge">{{ pendingCharges.length }}</span>
          }
        </button>
        <button class="pa-tab" [class.active]="activeFilter === 'approved'" (click)="setFilter('approved')">Approved</button>
        <button class="pa-tab" [class.active]="activeFilter === 'rejected'" (click)="setFilter('rejected')">Rejected</button>
        <button class="pa-tab" [class.active]="activeFilter === 'all'" (click)="setFilter('all')">All</button>
      </div>

      <!-- States -->
      @if (loading) {
        <div class="pa-loading">
          <i class="fas fa-circle-notch fa-spin"></i> Loading payments…
        </div>
      } @else if (errorMsg) {
        <div class="pa-alert-error">
          <i class="fas fa-exclamation-triangle"></i> {{ errorMsg }}
        </div>
      } @else if (filteredCharges.length === 0) {
        <div class="pa-empty">
          <i class="fas {{ activeFilter === 'pending' ? 'fa-check-circle' : 'fa-inbox' }} pa-empty-icon"></i>
          <p>{{ activeFilter === 'pending' ? 'No payments pending approval.' : 'No payments in this category.' }}</p>
        </div>
      } @else {
        <div class="pa-list">
          @for (charge of filteredCharges; track charge._id) {
            <div class="pa-card"
                 [class.pa-card-pending]="charge.approvalStatus === 'pending'"
                 [class.pa-card-approved]="charge.approvalStatus === 'approved'"
                 [class.pa-card-rejected]="charge.approvalStatus === 'rejected'">

              <div class="pa-card-body">

                <!-- Top row: name + badges -->
                <div class="pa-card-top">
                  <div class="pa-card-left">
                    <div class="pa-player-row">
                      <span class="pa-player-name">{{ getPlayerName(charge) }}</span>
                      @if (!charge.playerId && charge.guestName) {
                        <span class="pa-badge pa-badge-guest">Guest</span>
                      }
                      <span class="pa-badge"
                            [class.pa-badge-pending]="charge.approvalStatus === 'pending'"
                            [class.pa-badge-approved]="charge.approvalStatus === 'approved'"
                            [class.pa-badge-rejected]="charge.approvalStatus === 'rejected'">
                        {{ charge.approvalStatus | uppercase }}
                      </span>
                    </div>

                    <div class="pa-meta">
                      <span class="pa-meta-item">
                        <i class="fas {{ charge.chargeType === 'reservation' ? 'fa-calendar-check' : 'fa-users' }}"></i>
                        {{ charge.chargeType === 'reservation' ? 'Reservation' : 'Session' }}
                      </span>
                      @if (charge.chargeType === 'reservation' && charge.reservationId) {
                        <span class="pa-meta-item">
                          <i class="fas fa-calendar"></i>
                          {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}
                        </span>
                        <span class="pa-meta-item">
                          <i class="fas fa-table-tennis"></i>
                          Court {{ charge.reservationId.court }}
                        </span>
                        @if (charge.reservationId.timeSlot) {
                          <span class="pa-meta-item">
                            <i class="fas fa-clock"></i>
                            {{ formatTimeSlot(charge.reservationId.timeSlot, charge.reservationId.durationHours ?? 1) }}
                          </span>
                        }
                      } @else if (charge.chargeType === 'session' && charge.sessionId) {
                        <span class="pa-meta-item">
                          <i class="fas fa-calendar"></i>
                          {{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }}
                        </span>
                        <span class="pa-meta-item">
                          <i class="fas fa-clock"></i>
                          {{ charge.sessionId.startTime }}
                        </span>
                      }
                      @if (charge.paymentMethod) {
                        <span class="pa-meta-item pa-meta-method">
                          <i class="fas fa-wallet"></i>
                          {{ charge.paymentMethod }}
                        </span>
                      }
                      @if (charge.paidAt) {
                        <span class="pa-meta-item">
                          <i class="fas fa-paper-plane"></i>
                          {{ charge.paidAt | date: 'MMM d, h:mm a' : 'UTC' }}
                        </span>
                      }
                    </div>

                    @if (charge.approvalStatus === 'rejected' && charge.adminNote) {
                      <div class="pa-admin-note">
                        <i class="fas fa-comment-alt"></i> {{ charge.adminNote }}
                      </div>
                    }

                    @if (rejectingId === charge._id) {
                      <div class="pa-reject-form">
                        <input
                          class="pa-reject-input"
                          type="text"
                          placeholder="Reason for rejection (optional)"
                          [(ngModel)]="rejectNote"
                          (keyup.enter)="confirmReject(charge._id)"
                          (keyup.escape)="cancelReject()"
                        />
                        <div class="pa-reject-actions">
                          <button class="pa-btn-confirm-reject" (click)="confirmReject(charge._id)" [disabled]="processingId === charge._id">
                            <i class="fas fa-times-circle"></i> Confirm Reject
                          </button>
                          <button class="pa-btn-cancel" (click)="cancelReject()">Cancel</button>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Amount + Actions -->
                  <div class="pa-card-right">
                    <div class="pa-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</div>
                    @if (charge.approvalStatus === 'pending') {
                      <div class="pa-action-btns">
                        <button class="pa-btn-approve"
                                [disabled]="processingId === charge._id"
                                (click)="approve(charge._id)">
                          @if (processingId === charge._id && lastAction === 'approve') {
                            <i class="fas fa-circle-notch fa-spin"></i>
                          } @else {
                            <i class="fas fa-check"></i> Approve
                          }
                        </button>
                        <button class="pa-btn-reject"
                                [disabled]="processingId === charge._id"
                                (click)="startReject(charge._id)">
                          <i class="fas fa-times"></i> Reject
                        </button>
                      </div>
                    }
                  </div>
                </div>

              </div>
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #0c1a11;
      --surface: #1b3028;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.5);
      --accent: #a3e635;
    }

    .pa-shell {
      min-height: calc(100vh - 60px);
      background: var(--bg);
      padding: 1.5rem 1rem 3rem;
      max-width: 820px;
      margin: 0 auto;
    }

    /* Header */
    .pa-kicker {
      margin: 0 0 0.2rem;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }
    .pa-title {
      margin: 0 0 0.25rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
    }
    .pa-subtitle {
      margin: 0 0 1.5rem;
      font-size: 0.88rem;
      color: var(--muted);
    }

    /* Stats */
    .pa-stats {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .pa-stat {
      flex: 1;
      min-width: 90px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem 1.25rem;
      border-top: 3px solid transparent;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .pa-stat-pending  { border-top-color: #f59e0b; }
    .pa-stat-approved { border-top-color: var(--accent); }
    .pa-stat-rejected { border-top-color: #ef4444; }
    .pa-stat-value {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1;
    }
    .pa-stat-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Tabs */
    .pa-tabs {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.25rem;
    }
    .pa-tab {
      padding: 0.6rem 1rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--muted);
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: color 0.15s, border-color 0.15s;
    }
    .pa-tab:hover { color: var(--text); }
    .pa-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .pa-tab-badge {
      background: #f59e0b;
      color: #000;
      font-size: 0.68rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    /* States */
    .pa-loading {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 3rem 0;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .pa-alert-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.25);
      color: #fca5a5;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-size: 0.88rem;
    }
    .pa-empty {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--muted);
    }
    .pa-empty-icon {
      font-size: 2.5rem;
      color: var(--accent);
      opacity: 0.4;
      display: block;
      margin-bottom: 0.75rem;
    }
    .pa-empty p { font-size: 0.92rem; margin: 0; }

    /* Cards */
    .pa-list { display: flex; flex-direction: column; gap: 0.75rem; }

    .pa-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 4px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .pa-card-pending  { border-left-color: #f59e0b; }
    .pa-card-approved { border-left-color: var(--accent); }
    .pa-card-rejected { border-left-color: #ef4444; }

    .pa-card-body { padding: 1.1rem 1.25rem; }

    .pa-card-top {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }
    .pa-card-left { flex: 1; min-width: 0; }

    /* Player row */
    .pa-player-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin-bottom: 0.6rem;
    }
    .pa-player-name {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--text);
    }

    /* Badges */
    .pa-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pa-badge-guest    { background: rgba(139,92,246,0.2); color: #c4b5fd; }
    .pa-badge-pending  { background: rgba(245,158,11,0.15); color: #fcd34d; }
    .pa-badge-approved { background: rgba(163,230,53,0.15); color: var(--accent); }
    .pa-badge-rejected { background: rgba(239,68,68,0.15); color: #fca5a5; }

    /* Meta */
    .pa-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
    }
    .pa-meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.78rem;
      color: var(--muted);
      background: rgba(255,255,255,0.05);
      padding: 3px 8px;
      border-radius: 6px;
    }
    .pa-meta-item i { font-size: 0.7rem; opacity: 0.7; }
    .pa-meta-method { color: #a3e635; background: rgba(163,230,53,0.1); }

    /* Admin note */
    .pa-admin-note {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: #fca5a5;
      font-style: italic;
    }

    /* Reject form */
    .pa-reject-form {
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .pa-reject-input {
      width: 100%;
      padding: 0.55rem 0.85rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(239,68,68,0.35);
      border-radius: 8px;
      color: var(--text);
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .pa-reject-input::placeholder { color: rgba(255,255,255,0.28); }
    .pa-reject-input:focus {
      border-color: rgba(239,68,68,0.6);
      box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
    }
    .pa-reject-actions { display: flex; gap: 0.5rem; }
    .pa-btn-confirm-reject {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.42rem 0.9rem;
      background: rgba(239,68,68,0.15);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.35);
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .pa-btn-confirm-reject:hover:not(:disabled) { background: rgba(239,68,68,0.25); }
    .pa-btn-confirm-reject:disabled { opacity: 0.5; cursor: not-allowed; }
    .pa-btn-cancel {
      padding: 0.42rem 0.9rem;
      background: rgba(255,255,255,0.06);
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.82rem;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, color 0.15s;
    }
    .pa-btn-cancel:hover { background: rgba(255,255,255,0.1); color: var(--text); }

    /* Right side */
    .pa-card-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.6rem;
      min-width: 110px;
      flex-shrink: 0;
    }
    .pa-amount {
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--accent);
      white-space: nowrap;
    }
    .pa-action-btns {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      width: 100%;
    }
    .pa-btn-approve {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.48rem 0.9rem;
      background: rgba(163,230,53,0.15);
      color: var(--accent);
      border: 1px solid rgba(163,230,53,0.35);
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
      width: 100%;
    }
    .pa-btn-approve:hover:not(:disabled) {
      background: rgba(163,230,53,0.25);
      border-color: rgba(163,230,53,0.55);
    }
    .pa-btn-approve:disabled { opacity: 0.5; cursor: not-allowed; }
    .pa-btn-reject {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.48rem 0.9rem;
      background: rgba(239,68,68,0.08);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
      width: 100%;
    }
    .pa-btn-reject:hover:not(:disabled) {
      background: rgba(239,68,68,0.18);
      border-color: rgba(239,68,68,0.45);
    }
    .pa-btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

    @media (max-width: 480px) {
      .pa-card-top { flex-direction: column; }
      .pa-card-right { align-items: flex-start; width: 100%; flex-direction: row; align-items: center; justify-content: space-between; }
      .pa-action-btns { flex-direction: row; width: auto; }
      .pa-btn-approve, .pa-btn-reject { width: auto; }
    }
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
    return charge.guestName || 'Unknown Player';
  }

  formatTimeSlot(slot?: string, durationHours = 1): string {
    if (!slot) return '';
    const match = slot.match(/^(\d+)(am|pm)$/i);
    if (!match) return slot;
    const h = parseInt(match[1]);
    const period = match[2].toLowerCase();
    const start24 = period === 'am' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    const end24 = start24 + durationHours;
    const fmt = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
    return `${fmt(start24)} - ${fmt(end24)}`;
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
