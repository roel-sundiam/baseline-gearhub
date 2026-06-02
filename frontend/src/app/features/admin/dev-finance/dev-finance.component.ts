import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService } from '../../../core/services/club.service';
import {
  AppServicePaymentsService,
  AppServicePayment,
  ClubServiceSummary,
  ServiceSummaryTotals,
} from '../../../core/services/app-service-payments.service';

@Component({
  selector: 'app-dev-finance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="page-card">
        <div class="card-header">
          <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
          <div class="header-info">
            <h2>Developer Finance</h2>
            <span class="superadmin-badge"><i class="fas fa-shield-alt"></i> Superadmin</span>
          </div>
        </div>

        @if (loading) {
          <div class="loading"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>
        } @else {

          <!-- Global Summary -->
          <div class="summary-bar">
            <div class="summary-item">
              <div class="summary-value">{{ totals.feesOwed | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
              <div class="summary-label">Total Fees Owed</div>
            </div>
            <div class="summary-item highlight-green">
              <div class="summary-value">{{ totals.totalPaid | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
              <div class="summary-label">Total Paid</div>
            </div>
            <div class="summary-item highlight-purple">
              <div class="summary-value">{{ totals.totalWaived | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
              <div class="summary-label">Total Waived</div>
            </div>
            <div class="summary-item" [class.highlight-red]="totals.outstanding > 0" [class.highlight-green]="totals.outstanding <= 0">
              <div class="summary-value">{{ totals.outstanding | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
              <div class="summary-label">Outstanding</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">{{ clubs.length }}</div>
              <div class="summary-label">Total Clubs</div>
            </div>
            <div class="summary-item" [class.highlight-red]="outstandingClubCount > 0">
              <div class="summary-value">{{ outstandingClubCount }}</div>
              <div class="summary-label">Clubs with Balance</div>
            </div>
          </div>

          <!-- Per-Club Breakdown -->
          <div class="section-header">
            <i class="fas fa-building section-icon"></i>
            <h3 class="section-title">App Service Fee by Club</h3>
            <span class="section-note">Convenience fee collected from clients, remitted to developer</span>
          </div>

          @if (clubs.length === 0) {
            <div class="empty-state">
              <i class="fas fa-store-slash"></i>
              <p>No clubs found.</p>
            </div>
          } @else {
            <div class="clubs-table-wrap">
              <table class="clubs-table">
                <thead>
                  <tr>
                    <th>Club</th>
                    <th class="col-center">Fee Rate</th>
                    <th class="col-right">Court Fees Collected</th>
                    <th class="col-right">Conv. Fee Owed</th>
                    <th class="col-right">Paid to Dev</th>
                    <th class="col-right">Waived</th>
                    <th class="col-right">Outstanding</th>
                    <th class="col-center">Status</th>
                    <th class="col-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (club of clubs; track club.clubId) {
                    <tr [class.row-outstanding]="club.balance > 0">
                      <td class="col-club">{{ club.clubName }}</td>
                      <td class="col-center">
                        <div class="fee-rate-cell">
                          @if (editingFeeRateClubId === club.clubId) {
                            <input
                              type="number"
                              class="fee-rate-input"
                              [(ngModel)]="editingFeeRateValue"
                              min="0" max="100" step="0.1"
                              style="width:60px"
                            />
                            <span class="fee-rate-pct">%</span>
                            <button class="btn-fee-save" (click)="saveFeeRate(club)" [disabled]="savingFeeRate">
                              @if (savingFeeRate) { <i class="fas fa-circle-notch fa-spin"></i> }
                              @else { <i class="fas fa-check"></i> }
                            </button>
                            <button class="btn-fee-cancel" (click)="cancelFeeRate()"><i class="fas fa-times"></i></button>
                          } @else {
                            <span class="fee-rate-badge">{{ (club.convenienceFeeRate * 100) | number: '1.0-2' }}%</span>
                            <button class="btn-fee-edit" (click)="startEditFeeRate(club)" title="Edit fee rate">
                              <i class="fas fa-pen"></i>
                            </button>
                          }
                        </div>
                      </td>
                      <td class="col-right col-muted">{{ club.totalCourtFees | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="col-right col-blue">{{ club.feesOwed | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="col-right col-green">{{ club.totalPaid | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="col-right col-purple">{{ club.totalWaived | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="col-right" [class.col-red]="club.balance > 0" [class.col-green]="club.balance <= 0">
                        {{ (club.balance > 0 ? club.balance : 0) | currency: 'PHP' : 'symbol' : '1.2-2' }}
                      </td>
                      <td class="col-center">
                        @if (club.balance <= 0) {
                          <span class="status-chip status-paid"><i class="fas fa-check-circle"></i> Paid</span>
                        } @else {
                          <span class="status-chip status-outstanding"><i class="fas fa-exclamation-circle"></i> Outstanding</span>
                        }
                      </td>
                      <td class="col-center">
                        @if (club.balance > 0) {
                          <button class="btn-waive" (click)="openWaiveModal(club)">
                            <i class="fas fa-hand-holding-usd"></i> Waive
                          </button>
                        } @else {
                          <span class="col-muted">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td class="foot-label">Total ({{ clubs.length }} clubs)</td>
                    <td></td>
                    <td class="col-right foot-muted">—</td>
                    <td class="col-right foot-blue">{{ totals.feesOwed | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    <td class="col-right foot-green">{{ totals.totalPaid | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    <td class="col-right foot-purple">{{ totals.totalWaived | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    <td class="col-right foot-red">{{ totals.outstanding | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }

          <!-- All App Service Payments -->
          <div class="section-header payments-section-header">
            <i class="fas fa-receipt section-icon"></i>
            <h3 class="section-title">All App Service Payments</h3>
            @if (payments.length > 0) {
              <span class="count-badge">{{ payments.length }}</span>
            }
          </div>

          @if (payments.length === 0) {
            <div class="empty-state">
              <i class="fas fa-inbox"></i>
              <p>No payments recorded yet.</p>
            </div>
          } @else {
            <div class="table-wrap">
              <table class="payments-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Club</th>
                    <th>By</th>
                    <th>Method / Type</th>
                    <th>Note</th>
                    <th class="col-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of payments; track p._id) {
                    <tr [class.row-waiver]="p.type === 'waiver'">
                      <td class="col-date">{{ p.createdAt | date: 'MMM d, yyyy' : 'UTC' }}</td>
                      <td class="col-club-name">{{ getClubName(p) }}</td>
                      <td class="col-by">{{ p.paidBy?.name }}</td>
                      <td>
                        @if (p.type === 'waiver') {
                          <span class="method-badge method-waived"><i class="fas fa-hand-holding-usd"></i> Waived</span>
                        } @else {
                          <span class="method-badge" [ngClass]="methodClass(p.paymentMethod)">
                            {{ p.paymentMethod }}
                          </span>
                        }
                      </td>
                      <td class="col-note">{{ p.note || '—' }}</td>
                      <td class="col-right col-amount" [class.col-waived]="p.type === 'waiver'">
                        {{ p.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="5" class="foot-label">Total ({{ payments.length }} entries)</td>
                    <td class="col-right foot-green">{{ totalPaymentsSum | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }

        }
      </div>
    </div>

    <!-- Waive Modal -->
    @if (waiveModal.show) {
      <div class="modal-backdrop" (click)="closeWaiveModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">
              <i class="fas fa-hand-holding-usd"></i>
              Waive Outstanding Balance
            </div>
            <button class="modal-close" (click)="closeWaiveModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="waive-club-label">{{ waiveModal.club?.clubName }}</div>
            <div class="waive-balance-row">
              <span class="waive-balance-lbl">Current outstanding:</span>
              <span class="waive-balance-val">{{ waiveModal.club?.balance | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
            </div>

            <div class="modal-field">
              <label>Amount to Waive (PHP)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                [max]="waiveModal.club?.balance ?? null"
                [(ngModel)]="waiveModal.amount"
                placeholder="0.00"
              />
              <span class="field-hint">Pre-filled with full outstanding. Edit for partial waiver.</span>
            </div>

            <div class="modal-field">
              <label>Reason <span class="optional">(optional)</span></label>
              <input type="text" [(ngModel)]="waiveModal.note" placeholder="e.g. Promotional period, Q1 waiver" />
            </div>

            @if (waiveModal.error) {
              <div class="modal-error">{{ waiveModal.error }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeWaiveModal()" [disabled]="waiveModal.submitting">Cancel</button>
            <button class="btn-confirm-waive" (click)="confirmWaive()" [disabled]="waiveModal.submitting || !waiveModal.amount || waiveModal.amount <= 0">
              @if (waiveModal.submitting) { <i class="fas fa-circle-notch fa-spin"></i> Waiving... }
              @else { <i class="fas fa-check"></i> Confirm Waiver }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    .page-wrap {
      display: block; min-height: calc(100vh - 60px); padding: 1.5rem; background: var(--dm-bg);
    }
    .page-card {
      background: var(--dm-surface); border-radius: 16px; border: 1px solid rgba(163,230,53,0.12);
      box-shadow: 0 4px 24px rgba(0,0,0,0.32); max-width: 1100px; margin: 0 auto; overflow: hidden;
    }
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--dm-header);
    }
    .header-info { display: flex; align-items: center; gap: 12px; flex: 1; }
    .card-header h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #ffffff; }
    .superadmin-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;
      background: rgba(139,92,246,0.18); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.32);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .back-btn {
      background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.24);
      color: var(--dm-accent); font-size: 0.9rem; cursor: pointer; padding: 7px 12px;
      border-radius: 8px; transition: background 0.15s; font-family: inherit;
    }
    .back-btn:hover { background: rgba(163,230,53,0.2); }

    .loading {
      text-align: center; padding: 60px; color: rgba(255,255,255,0.6); font-size: 0.95rem;
      display: flex; align-items: center; justify-content: center; gap: 10px;
    }

    /* Summary Bar */
    .summary-bar {
      display: flex; flex-wrap: wrap; gap: 12px;
      padding: 20px 24px; background: rgba(163,230,53,0.06);
      border-bottom: 1px solid rgba(163,230,53,0.1);
    }
    .summary-item {
      flex: 1; min-width: 110px; text-align: center; padding: 10px 14px; border-radius: 10px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
    }
    .summary-item.highlight-green { background: rgba(163,230,53,0.12); border-color: rgba(163,230,53,0.2); }
    .summary-item.highlight-green .summary-value { color: var(--dm-accent); }
    .summary-item.highlight-red { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.2); }
    .summary-item.highlight-red .summary-value { color: #fca5a5; }
    .summary-item.highlight-purple { background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.2); }
    .summary-item.highlight-purple .summary-value { color: #c4b5fd; }
    .summary-value { font-size: 1.05rem; font-weight: 700; color: #ffffff; }
    .summary-label {
      font-size: 0.68rem; color: rgba(255,255,255,0.55); margin-top: 3px;
      text-transform: uppercase; letter-spacing: 0.4px;
    }

    /* Section Headers */
    .section-header {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 24px 12px;
    }
    .payments-section-header { padding-top: 28px; }
    .section-icon { color: var(--dm-accent); font-size: 1rem; }
    .section-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: #ffffff; }
    .section-note {
      font-size: 0.75rem; color: rgba(255,255,255,0.45);
      padding: 3px 8px; background: rgba(255,255,255,0.04); border-radius: 4px;
    }
    .count-badge {
      background: rgba(163,230,53,0.16); color: var(--dm-accent); font-size: 0.7rem; font-weight: 700;
      padding: 2px 8px; border-radius: 10px;
    }

    /* Clubs Table */
    .clubs-table-wrap { padding: 0 24px 24px; overflow-x: auto; }
    .clubs-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .clubs-table th {
      background: rgba(255,255,255,0.04); padding: 10px 14px; text-align: left;
      font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.55);
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .clubs-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #ffffff; }
    .clubs-table tbody tr:hover { background: rgba(255,255,255,0.02); }
    .clubs-table tbody tr.row-outstanding { background: rgba(239,68,68,0.04); }
    .clubs-table tbody tr.row-outstanding:hover { background: rgba(239,68,68,0.08); }
    .col-club { font-weight: 700; }
    .col-right { text-align: right; }
    .col-center { text-align: center; }
    .col-muted { color: rgba(255,255,255,0.6); }
    .col-blue { color: #93c5fd; font-weight: 600; }
    .col-green { color: var(--dm-accent); font-weight: 600; }
    .col-purple { color: #c4b5fd; font-weight: 600; }
    .col-red { color: #fca5a5; font-weight: 700; }

    tfoot td { padding: 12px 14px; background: rgba(255,255,255,0.04); border-top: 1px solid rgba(255,255,255,0.08); }
    .foot-label { color: rgba(255,255,255,0.65); font-size: 0.8rem; font-weight: 600; }
    .foot-muted { color: rgba(255,255,255,0.4); text-align: right; }
    .foot-blue { color: #93c5fd; font-weight: 700; text-align: right; }
    .foot-green { color: var(--dm-accent); font-weight: 700; text-align: right; }
    .foot-purple { color: #c4b5fd; font-weight: 700; text-align: right; }
    .foot-red { color: #fca5a5; font-weight: 700; text-align: right; }

    /* Status chips */
    .status-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;
    }
    .status-paid { background: rgba(163,230,53,0.14); color: var(--dm-accent); }
    .status-outstanding { background: rgba(239,68,68,0.14); color: #fca5a5; }

    /* Waive button */
    .btn-waive {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 12px; border-radius: 7px; font-size: 0.75rem; font-weight: 700;
      background: rgba(139,92,246,0.14); color: #c4b5fd;
      border: 1px solid rgba(139,92,246,0.32); cursor: pointer; font-family: inherit;
      transition: background 0.15s;
    }
    .btn-waive:hover { background: rgba(139,92,246,0.26); }

    /* Payments Table */
    .table-wrap { padding: 0 24px 32px; overflow-x: auto; }
    .payments-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .payments-table th {
      background: rgba(255,255,255,0.04); padding: 10px 14px; text-align: left;
      font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.55);
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .payments-table td { padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #ffffff; }
    .payments-table tbody tr:hover { background: rgba(255,255,255,0.02); }
    .payments-table tbody tr.row-waiver { background: rgba(139,92,246,0.04); }
    .col-date { color: rgba(255,255,255,0.7); font-size: 0.82rem; white-space: nowrap; }
    .col-club-name { font-weight: 600; }
    .col-by { color: rgba(255,255,255,0.75); font-size: 0.85rem; }
    .col-note { color: rgba(255,255,255,0.5); font-size: 0.8rem; font-style: italic; }
    .col-amount { color: var(--dm-accent); font-weight: 700; }
    .col-waived { color: #c4b5fd !important; }

    .method-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
    .method-gcash { background: rgba(139,92,246,0.16); color: #c4b5fd; }
    .method-qrph  { background: rgba(20,184,166,0.16); color: #5eead4; }
    .method-waived { background: rgba(139,92,246,0.18); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.34); display: inline-flex; align-items: center; gap: 4px; }

    .empty-state {
      text-align: center; padding: 40px 20px; color: rgba(255,255,255,0.45);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .empty-state i { font-size: 2rem; }
    .empty-state p { margin: 0; font-size: 0.875rem; }

    /* Waive Modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.55);
      z-index: 100; display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--dm-surface); border-radius: 14px; width: 100%; max-width: 440px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45); animation: slideUp 0.2s ease;
      border: 1px solid rgba(139,92,246,0.2); overflow: hidden;
    }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
      background: rgba(139,92,246,0.1);
    }
    .modal-title {
      font-size: 1rem; font-weight: 700; color: #c4b5fd;
      display: flex; align-items: center; gap: 8px;
    }
    .modal-close {
      background: none; border: none; font-size: 1rem; color: rgba(255,255,255,0.5);
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .modal-close:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }

    .waive-club-label {
      font-size: 1rem; font-weight: 800; color: #ffffff;
      padding: 8px 12px; background: rgba(255,255,255,0.04);
      border-radius: 8px; border-left: 3px solid #c4b5fd;
    }
    .waive-balance-row {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 0.85rem;
    }
    .waive-balance-lbl { color: rgba(255,255,255,0.6); }
    .waive-balance-val { font-weight: 700; color: #fca5a5; font-size: 1rem; }

    .modal-field { display: flex; flex-direction: column; gap: 5px; }
    .modal-field label { font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.4px; }
    .modal-field .optional { font-weight: 400; color: rgba(255,255,255,0.45); text-transform: none; letter-spacing: 0; }
    .modal-field input {
      padding: 9px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      font-size: 0.9rem; background: rgba(255,255,255,0.05); color: #ffffff;
      width: 100%; box-sizing: border-box; font-family: inherit;
    }
    .modal-field input::placeholder { color: rgba(255,255,255,0.35); }
    .modal-field input:focus { outline: none; border-color: rgba(139,92,246,0.5); box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
    .field-hint { font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-top: 2px; }

    .modal-error { color: #fca5a5; font-size: 0.82rem; padding: 8px 10px; background: rgba(239,68,68,0.1); border-radius: 6px; }

    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
    }
    .btn-cancel {
      padding: 8px 16px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-family: inherit;
    }
    .btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
    .btn-confirm-waive {
      padding: 8px 18px; background: rgba(139,92,246,0.2); color: #c4b5fd;
      border: 1px solid rgba(139,92,246,0.4); border-radius: 8px; font-size: 0.875rem; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit;
      transition: background 0.15s;
    }
    .btn-confirm-waive:hover:not(:disabled) { background: rgba(139,92,246,0.32); }
    .btn-confirm-waive:disabled, .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Fee Rate Editor */
    .fee-rate-cell { display: flex; align-items: center; gap: 5px; justify-content: center; }
    .fee-rate-badge {
      font-size: 0.78rem; font-weight: 700; color: #93c5fd;
      background: rgba(147,197,253,0.12); padding: 2px 8px; border-radius: 10px;
    }
    .fee-rate-input {
      background: rgba(255,255,255,0.07); border: 1px solid rgba(147,197,253,0.4);
      color: #ffffff; border-radius: 6px; padding: 3px 6px; font-size: 0.82rem;
      font-family: inherit; text-align: center;
    }
    .fee-rate-input:focus { outline: none; border-color: rgba(147,197,253,0.7); }
    .fee-rate-pct { color: rgba(255,255,255,0.5); font-size: 0.8rem; }
    .btn-fee-edit {
      background: none; border: none; color: rgba(147,197,253,0.5); cursor: pointer;
      font-size: 0.72rem; padding: 2px 5px; border-radius: 4px; transition: color 0.15s;
    }
    .btn-fee-edit:hover { color: #93c5fd; }
    .btn-fee-save {
      background: rgba(163,230,53,0.16); border: 1px solid rgba(163,230,53,0.32);
      color: var(--dm-accent); cursor: pointer; font-size: 0.72rem; padding: 3px 7px;
      border-radius: 5px; transition: background 0.15s; font-family: inherit;
    }
    .btn-fee-save:hover:not(:disabled) { background: rgba(163,230,53,0.28); }
    .btn-fee-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-fee-cancel {
      background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.28);
      color: #fca5a5; cursor: pointer; font-size: 0.72rem; padding: 3px 7px;
      border-radius: 5px; transition: background 0.15s; font-family: inherit;
    }
    .btn-fee-cancel:hover { background: rgba(239,68,68,0.22); }

    @media (max-width: 700px) {
      .clubs-table-wrap, .table-wrap { padding: 0 12px 20px; }
      .summary-bar { padding: 16px 12px; }
      .section-header { padding: 16px 12px 10px; }
    }
  `],
})
export class DevFinanceComponent implements OnInit {
  clubs: ClubServiceSummary[] = [];
  totals: ServiceSummaryTotals = { feesOwed: 0, totalPaid: 0, totalWaived: 0, outstanding: 0 };
  payments: AppServicePayment[] = [];
  loading = true;

  waiveModal: {
    show: boolean;
    club: ClubServiceSummary | null;
    amount: number;
    note: string;
    submitting: boolean;
    error: string;
  } = { show: false, club: null, amount: 0, note: '', submitting: false, error: '' };

  editingFeeRateClubId: string | null = null;
  editingFeeRateValue = 10;
  savingFeeRate = false;

  get outstandingClubCount() { return this.clubs.filter(c => c.balance > 0).length; }
  get totalPaymentsSum() { return this.payments.reduce((s, p) => s + p.amount, 0); }

  constructor(
    private auth: AuthService,
    private appServicePaymentsService: AppServicePaymentsService,
    private clubService: ClubService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (!this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.loadData();
  }

  private loadData() {
    this.loading = true;
    forkJoin({
      summary: this.appServicePaymentsService.getSummary(),
      payments: this.appServicePaymentsService.getAll(),
    }).subscribe({
      next: ({ summary, payments }) => {
        this.clubs = summary.clubs;
        this.totals = summary.totals;
        this.payments = payments;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openWaiveModal(club: ClubServiceSummary) {
    this.waiveModal = {
      show: true,
      club,
      amount: parseFloat(club.balance.toFixed(2)),
      note: '',
      submitting: false,
      error: '',
    };
  }

  closeWaiveModal() {
    if (this.waiveModal.submitting) return;
    this.waiveModal = { show: false, club: null, amount: 0, note: '', submitting: false, error: '' };
  }

  confirmWaive() {
    const { club, amount, note } = this.waiveModal;
    if (!club || amount <= 0) return;
    this.waiveModal = { ...this.waiveModal, submitting: true, error: '' };
    this.appServicePaymentsService.waive(club.clubId, amount, note || undefined).subscribe({
      next: () => {
        this.waiveModal = { show: false, club: null, amount: 0, note: '', submitting: false, error: '' };
        this.loadData();
      },
      error: (err) => {
        this.waiveModal = { ...this.waiveModal, submitting: false, error: err?.error?.error || 'Failed to record waiver.' };
        this.cdr.detectChanges();
      },
    });
  }

  getClubName(payment: AppServicePayment): string {
    if (payment.clubId && typeof payment.clubId === 'object') {
      return (payment.clubId as any).name || '—';
    }
    const club = this.clubs.find(c => c.clubId === payment.clubId);
    return club?.clubName || '—';
  }

  methodClass(method?: string) {
    return { 'method-gcash': method === 'GCash', 'method-qrph': method === 'QRPh' };
  }

  startEditFeeRate(club: ClubServiceSummary) {
    this.editingFeeRateClubId = club.clubId;
    this.editingFeeRateValue = parseFloat(((club.convenienceFeeRate ?? 0.10) * 100).toFixed(2));
  }

  cancelFeeRate() {
    this.editingFeeRateClubId = null;
    this.savingFeeRate = false;
  }

  saveFeeRate(club: ClubServiceSummary) {
    const rate = this.editingFeeRateValue / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) return;
    this.savingFeeRate = true;
    this.clubService.patchConvenienceFee(club.clubId, rate).subscribe({
      next: () => {
        club.convenienceFeeRate = rate;
        this.editingFeeRateClubId = null;
        this.savingFeeRate = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingFeeRate = false;
        this.cdr.detectChanges();
      },
    });
  }

  goBack() { this.router.navigate(['/admin/dashboard']); }
}
