import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AppServicePaymentsService, AppServicePayment } from '../../../core/services/app-service-payments.service';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="page-card">
        <div class="card-header">
          <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
          <h2>Finance</h2>
        </div>

        <!-- Tabs -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab === 'payments'" (click)="activeTab = 'payments'">
            Approved Payments
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'app-service'" (click)="activeTab = 'app-service'">
            App Service
          </button>
        </div>

        <div class="card-body">
          @if (loading) {
            <div class="loading">Loading...</div>
          } @else if (activeTab === 'payments') {

            <!-- Summary Bar -->
            <div class="summary-bar">
              <div class="summary-item">
                <div class="summary-value">{{ charges.length }}</div>
                <div class="summary-label">Approved Payments</div>
              </div>
              <div class="summary-item highlight">
                <div class="summary-value">{{ total | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Total Collected</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ gcashTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">GCash</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ cashTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Cash</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ bankTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Bank Transfer</div>
              </div>
            </div>

            <!-- Filters -->
            <div class="filter-bar">
              <div class="filter-group">
                <label>Type</label>
                <select [(ngModel)]="filterType" (ngModelChange)="applyFilter()">
                  <option value="all">All</option>
                  <option value="reservation">Reservation</option>
                  <option value="session">Session</option>
                </select>
              </div>
              <div class="filter-group">
                <label>Method</label>
                <select [(ngModel)]="filterMethod" (ngModelChange)="applyFilter()">
                  <option value="all">All</option>
                  <option value="GCash">GCash</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div class="filter-group">
                <label>Search player</label>
                <input type="text" placeholder="Name..." [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()" />
              </div>
            </div>

            @if (filtered.length === 0) {
              <div class="empty-state">
                <span>💰</span>
                <p>No approved payments found.</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="finance-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Approved</th>
                      <th class="col-amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (charge of filtered; track charge._id) {
                      <tr>
                        <td class="col-player">{{ getPlayerName(charge) }}</td>
                        <td>
                          <span class="type-badge" [class.type-reservation]="charge.chargeType === 'reservation'">
                            {{ charge.chargeType === 'reservation' ? 'Reservation' : 'Session' }}
                          </span>
                        </td>
                        <td class="col-date">
                          @if (charge.chargeType === 'reservation' && charge.reservationId) {
                            {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}
                            <span class="court-label">· Court {{ charge.reservationId.court }}</span>
                          } @else if (charge.chargeType === 'session' && charge.sessionId) {
                            {{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }}
                            <span class="court-label">· {{ charge.sessionId.startTime }}</span>
                          }
                        </td>
                        <td>
                          <span class="method-badge" [ngClass]="methodClass(charge.paymentMethod)">
                            {{ charge.paymentMethod }}
                          </span>
                        </td>
                        <td class="col-date">{{ charge.updatedAt | date: 'MMM d, yyyy' : 'UTC' }}</td>
                        <td class="col-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="5" class="foot-label">Subtotal ({{ filtered.length }} records)</td>
                      <td class="col-amount foot-total">{{ filteredTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }

          } @else {

            <!-- App Service Tab -->
            <div class="summary-bar app-service-bar">
              <div class="summary-item">
                <div class="summary-value">{{ reservationCharges.length }}</div>
                <div class="summary-label">Court Reservations</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ allOpenPlayCharges.length }}</div>
                <div class="summary-label">Open Play Sessions</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ reservationTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Total Court Fees</div>
              </div>
              <div class="summary-item highlight-blue">
                <div class="summary-value">{{ appServiceTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Conv. Fees Owed</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ totalPaid | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Paid to Dev</div>
              </div>
              @if (totalWaived > 0) {
                <div class="summary-item highlight-purple">
                  <div class="summary-value">{{ totalWaived | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                  <div class="summary-label">Waived</div>
                </div>
              }
              <div class="summary-item" [class.highlight-red]="balance > 0" [class.highlight-green]="balance <= 0">
                <div class="summary-value">{{ balance | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Outstanding</div>
              </div>
            </div>

            <!-- Pay Action -->
            <div class="pay-action-row">
              <p class="rate-note">App Service Fee = convenience fee collected from clients per booking, remitted to the Developer.</p>
              <button class="btn-pay" (click)="openPayForm()" [disabled]="balance <= 0">
                <i class="fas fa-paper-plane"></i> Record Payment to Developer
              </button>
            </div>

            <!-- Reservation Charges Table -->
            <h4 class="section-heading">Court Reservation Charges</h4>
            @if (reservationCharges.length === 0) {
              <div class="empty-state">
                <span>🎾</span>
                <p>No reservation charges found.</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="finance-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Court</th>
                      <th>Method</th>
                      <th class="col-amount">Court Fee</th>
                      <th class="col-amount">Conv. Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (charge of reservationCharges; track charge._id) {
                      <tr>
                        <td class="col-player">{{ getPlayerName(charge) }}</td>
                        <td class="col-date">
                          @if (charge.reservationId) {
                            {{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}
                          }
                        </td>
                        <td class="col-date">
                          {{ formatTimeSlot(charge.reservationId?.timeSlot, charge.reservationId?.durationHours ?? 1) }}
                        </td>
                        <td>
                          @if (charge.reservationId) {
                            <span class="court-chip">Court {{ charge.reservationId.court }}</span>
                          }
                        </td>
                        <td>
                          <span class="method-badge" [ngClass]="methodClass(charge.paymentMethod)">
                            {{ charge.paymentMethod }}
                          </span>
                        </td>
                        <td class="col-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</td>
                        <td class="col-amount col-service">{{ (charge.breakdown?.convenienceFee ?? 0) | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="5" class="foot-label">Total ({{ reservationCharges.length }} reservations)</td>
                      <td class="col-amount foot-total">{{ reservationTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="col-amount foot-total col-service">{{ reservationServiceFee | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }

            <!-- Open Play Session Charges -->
            <h4 class="section-heading" style="margin-top:24px">Open Play Session Charges</h4>
            @if (allOpenPlayCharges.length === 0) {
              <div class="empty-state">
                <span>🎾</span>
                <p>No open play session charges found.</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="finance-table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Sport</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th class="col-amount">Conv. Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (charge of allOpenPlayCharges; track charge._id) {
                      <tr>
                        <td class="col-player">{{ charge.openPlaySessionId?.title ?? '—' }}</td>
                        <td>{{ charge.openPlaySessionId?.sport ?? '—' }}</td>
                        <td class="col-date">
                          {{ charge.openPlaySessionId?.sessionDate | date: 'MMM d, yyyy' : 'UTC' }}
                        </td>
                        <td class="col-date">
                          {{ charge.openPlaySessionId?.startTime ?? '' }}
                          @if (charge.openPlaySessionId?.endTime) { – {{ charge.openPlaySessionId!.endTime }} }
                        </td>
                        <td class="col-amount col-service">{{ (charge.breakdown?.convenienceFee ?? 0) | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" class="foot-label">Total ({{ allOpenPlayCharges.length }} sessions)</td>
                      <td class="col-amount foot-total col-service">{{ openPlayServiceFee | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }

            <!-- Paid App Service Fees -->
            <div class="paid-fees-section">
              <div class="paid-fees-header">
                <div class="paid-fees-title-row">
                  <i class="fas fa-receipt paid-fees-icon"></i>
                  <h4 class="paid-fees-title">App Service History</h4>
                  @if (appServicePayments.length > 0) {
                    <span class="paid-fees-count">{{ appServicePayments.length }}</span>
                  }
                </div>
                <div class="paid-fees-total">
                  Paid: <strong>{{ totalPaid | currency: 'PHP' : 'symbol' : '1.2-2' }}</strong>
                  @if (totalWaived > 0) {
                    &nbsp;· Waived: <strong class="waived-total">{{ totalWaived | currency: 'PHP' : 'symbol' : '1.2-2' }}</strong>
                  }
                </div>
              </div>

              @if (appServicePayments.length === 0) {
                <div class="paid-fees-empty">
                  <i class="fas fa-inbox"></i>
                  <p>No payments recorded yet.</p>
                </div>
              } @else {
                <div class="paid-fees-list">
                  @for (p of appServicePayments; track p._id) {
                    <div class="paid-fee-card" [class.paid-fee-card-waived]="p.type === 'waiver'">
                      <div class="paid-fee-left">
                        <div class="paid-fee-icon-wrap" [class.paid-fee-icon-waived]="p.type === 'waiver'">
                          <i class="fas" [class.fa-check-circle]="p.type !== 'waiver'" [class.fa-hand-holding-usd]="p.type === 'waiver'"></i>
                        </div>
                        <div class="paid-fee-info">
                          <div class="paid-fee-date">{{ p.createdAt | date: 'MMM d, yyyy' : 'UTC' }}</div>
                          <div class="paid-fee-by">
                            {{ p.type === 'waiver' ? 'Waived by' : 'Paid by' }} {{ p.paidBy?.name }}
                          </div>
                          @if (p.note) {
                            <div class="paid-fee-note">📝 {{ p.note }}</div>
                          }
                        </div>
                      </div>
                      <div class="paid-fee-right">
                        @if (p.type === 'waiver') {
                          <span class="method-badge method-waived">
                            <i class="fas fa-hand-holding-usd"></i> Waived
                          </span>
                        } @else {
                          <span class="method-badge" [ngClass]="methodClass(p.paymentMethod)">
                            {{ p.paymentMethod }}
                          </span>
                        }
                        <div class="paid-fee-amount" [class.paid-fee-amount-waived]="p.type === 'waiver'">
                          {{ p.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

          }
        </div>
      </div>
    </div>

    <!-- Pay Modal -->
    @if (showPayForm) {
      <div class="modal-backdrop" (click)="cancelPayForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Record Payment to Developer</h3>
            <button class="modal-close" (click)="cancelPayForm()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="modal-field">
              <label>Amount (PHP)</label>
              <input type="number" min="0.01" step="0.01" [(ngModel)]="payAmount" placeholder="0.00" />
            </div>
            <div class="modal-field">
              <label>Payment Method</label>
              <div class="method-selector">
                <button type="button" class="method-opt" [class.method-opt-gcash]="payMethod === 'GCash'" (click)="payMethod = 'GCash'">
                  <i class="fas fa-mobile-alt"></i> GCash
                </button>
                <button type="button" class="method-opt" [class.method-opt-qrph]="payMethod === 'QRPh'" (click)="payMethod = 'QRPh'">
                  <i class="fas fa-qrcode"></i> QRPh
                </button>
              </div>
            </div>
            @if (payMethod === 'GCash') {
              <div class="qr-block qr-block-gcash">
                <p class="qr-label"><i class="fas fa-mobile-alt"></i> Scan to pay via GCash</p>
                <img [src]="gcashQrCode" alt="Developer GCash QR Code" class="qr-img" />
              </div>
            }
            @if (payMethod === 'QRPh') {
              <div class="qr-block qr-block-qrph">
                <p class="qr-label"><i class="fas fa-qrcode"></i> Scan to pay via QRPh</p>
                <img [src]="qrphQrCode" alt="Developer QRPh QR Code" class="qr-img" />
              </div>
            }
            <div class="modal-field">
              <label>Note <span class="optional">(optional)</span></label>
              <input type="text" [(ngModel)]="payNote" placeholder="e.g. April 2025 app service" />
            </div>
            @if (payError) {
              <div class="pay-error">{{ payError }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel-pay" (click)="cancelPayForm()" [disabled]="saving">Cancel</button>
            <button class="btn-confirm-pay" (click)="submitPayment()" [disabled]="saving || !payAmount">
              @if (saving) { <i class="fas fa-circle-notch fa-spin"></i> Saving... }
              @else { <i class="fas fa-check"></i> Confirm Payment }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .page-wrap {
      display: block;
      min-height: calc(100vh - 60px);
      padding: 1.5rem;
      background: var(--dm-bg);
    }
    .page-card {
      background: var(--dm-surface); border-radius: 16px; border: 1px solid rgba(163,230,53,0.12);
      box-shadow: 0 4px 24px rgba(0,0,0,0.32); max-width: 1080px; margin: 0 auto; overflow: hidden;
    }
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--dm-header);
    }
    .card-header h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #ffffff; flex: 1; }
    .back-btn {
      background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.24);
      color: var(--dm-accent); font-size: 0.9rem; cursor: pointer; padding: 7px 12px;
      border-radius: 8px; transition: background 0.15s; font-family: inherit;
    }
    .back-btn:hover { background: rgba(163,230,53,0.2); }

    .tab-bar { display: flex; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 24px; background: rgba(255,255,255,0.02); }
    .tab-btn {
      background: none; border: none; padding: 14px 20px;
      font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.58); cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s; font-family: inherit;
    }
    .tab-btn:hover { color: var(--dm-accent); }
    .tab-btn.active { color: var(--dm-accent); border-bottom-color: var(--dm-accent); }

    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 40px; color: rgba(255,255,255,0.6); }

    .summary-bar {
      display: flex; flex-wrap: wrap; gap: 12px;
      padding: 16px 20px; background: rgba(255,255,255,0.04); border-radius: 10px;
      border: 1px solid rgba(163,230,53,0.12); margin-bottom: 20px;
    }
    .app-service-bar { background: rgba(163,230,53,0.08); border-color: rgba(163,230,53,0.16); }
    .summary-item {
      flex: 1; min-width: 100px; text-align: center; padding: 8px 12px; border-radius: 8px;
    }
    .summary-item.highlight { background: rgba(163,230,53,0.14); }
    .summary-item.highlight .summary-value { color: var(--dm-accent); font-size: 1.3rem; }
    .summary-item.highlight .summary-label { color: rgba(255,255,255,0.7); }
    .summary-item.highlight-blue { background: rgba(59,130,246,0.14); border-radius: 8px; }
    .summary-item.highlight-blue .summary-value { color: #93c5fd; font-size: 1.3rem; }
    .summary-item.highlight-blue .summary-label { color: rgba(147,197,253,0.8); }
    .summary-item.highlight-red { background: rgba(239,68,68,0.14); border-radius: 8px; }
    .summary-item.highlight-red .summary-value { color: #fca5a5; font-size: 1.1rem; }
    .summary-item.highlight-red .summary-label { color: rgba(252,165,165,0.8); }
    .summary-item.highlight-green { background: rgba(163,230,53,0.14); border-radius: 8px; }
    .summary-item.highlight-green .summary-value { color: var(--dm-accent); font-size: 1.1rem; }
    .summary-item.highlight-green .summary-label { color: rgba(255,255,255,0.7); }
    .summary-item.highlight-purple { background: rgba(139,92,246,0.14); border-radius: 8px; }
    .summary-item.highlight-purple .summary-value { color: #c4b5fd; font-size: 1.1rem; }
    .summary-item.highlight-purple .summary-label { color: rgba(196,181,253,0.8); }
    .summary-value { font-size: 1.1rem; font-weight: 700; color: #ffffff; }
    .summary-label { font-size: 0.72rem; color: rgba(255,255,255,0.62); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }

    .pay-action-row {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
    }
    .rate-note {
      font-size: 0.82rem; color: rgba(255,255,255,0.62); margin: 0;
      padding: 8px 12px; background: rgba(163,230,53,0.08); border-radius: 6px; border-left: 3px solid var(--dm-accent);
      flex: 1;
    }
    .btn-pay {
      padding: 9px 18px; background: rgba(163,230,53,0.16); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28); border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; white-space: nowrap;
      display: flex; align-items: center; gap: 7px;
    }
    .btn-pay:hover:not(:disabled) { background: rgba(163,230,53,0.24); }
    .btn-pay:disabled { opacity: 0.45; cursor: not-allowed; }

    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 100; display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--dm-surface); border-radius: 14px; width: 100%; max-width: 460px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4); animation: slideUp 0.2s ease;
      overflow: hidden;
      border: 1px solid rgba(163,230,53,0.12);
    }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--dm-header);
    }
    .modal-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #ffffff; }
    .modal-close {
      background: none; border: none; font-size: 1rem; color: rgba(255,255,255,0.6);
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .modal-close:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field label { font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.4px; }
    .modal-field .optional { font-weight: 400; color: rgba(255,255,255,0.5); text-transform: none; letter-spacing: 0; }
    .modal-field input, .modal-field select {
      padding: 9px 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
      font-size: 0.9rem; background: rgba(255,255,255,0.04); width: 100%; box-sizing: border-box; color: #ffffff;
    }
    .modal-field input::placeholder { color: rgba(255,255,255,0.4); }
    .modal-field input:focus, .modal-field select:focus { outline: none; border-color: rgba(163,230,53,0.28); box-shadow: 0 0 0 3px rgba(163,230,53,0.12); }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);
    }
    .btn-confirm-pay {
      padding: 9px 20px; background: rgba(163,230,53,0.16); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28); border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px;
    }
    .btn-confirm-pay:hover:not(:disabled) { background: rgba(163,230,53,0.24); }
    .btn-confirm-pay:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-cancel-pay {
      padding: 9px 16px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.72);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 0.875rem; cursor: pointer;
    }
    .btn-cancel-pay:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
    .pay-error { color: #fca5a5; font-size: 0.82rem; }
    .method-selector { display: flex; gap: 8px; }
    .method-opt {
      flex: 1; padding: 10px 6px; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.55);
      cursor: pointer; font-size: 0.8rem; font-weight: 600; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: all 0.15s;
    }
    .method-opt:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.85); }
    .method-opt-gcash { background: rgba(139,92,246,0.18) !important; border-color: rgba(139,92,246,0.48) !important; color: #c4b5fd !important; }
    .method-opt-qrph  { background: rgba(20,184,166,0.18) !important; border-color: rgba(20,184,166,0.46) !important; color: #5eead4 !important; }
    .qr-block {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 14px 12px; border-radius: 10px;
    }
    .qr-block-gcash { background: rgba(139,92,246,0.10); border: 1px solid rgba(139,92,246,0.28); }
    .qr-block-gcash .qr-label { color: #c4b5fd; }
    .qr-block-qrph  { background: rgba(20,184,166,0.10); border: 1px solid rgba(20,184,166,0.28); }
    .qr-block-qrph .qr-label  { color: #5eead4; }
    .qr-label { margin: 0; font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
    .qr-img { width: 180px; height: 180px; object-fit: contain; border-radius: 8px; background: #ffffff; padding: 6px; display: block; }

    .section-heading {
      font-size: 0.85rem; font-weight: 700; color: rgba(255,255,255,0.72); text-transform: uppercase;
      letter-spacing: 0.5px; margin: 0 0 12px 0;
    }
    .paid-fees-section {
      margin-top: 2rem; border: 1px solid rgba(163,230,53,0.12); border-radius: 12px; overflow: hidden;
      background: rgba(255,255,255,0.02);
    }
    .paid-fees-header {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
      padding: 14px 18px; background: rgba(163,230,53,0.08); border-bottom: 1px solid rgba(163,230,53,0.12);
    }
    .paid-fees-title-row { display: flex; align-items: center; gap: 8px; }
    .paid-fees-icon { color: var(--dm-accent); font-size: 1rem; }
    .paid-fees-title { margin: 0; font-size: 0.9rem; font-weight: 700; color: #ffffff; }
    .paid-fees-count {
      background: rgba(163,230,53,0.16); color: var(--dm-accent); font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }
    .paid-fees-total { font-size: 0.85rem; color: var(--dm-accent); }
    .paid-fees-total strong { font-size: 1rem; }
    .paid-fees-empty {
      padding: 32px 20px; text-align: center; color: rgba(163,230,53,0.5);
    }
    .paid-fees-empty i { font-size: 2rem; display: block; margin-bottom: 8px; }
    .paid-fees-empty p { margin: 0; font-size: 0.875rem; color: rgba(255,255,255,0.5); }
    .paid-fees-list { display: flex; flex-direction: column; }
    .paid-fee-card {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02);
      transition: background 0.15s;
    }
    .paid-fee-card:last-child { border-bottom: none; }
    .paid-fee-card:hover { background: rgba(255,255,255,0.04); }
    .paid-fee-left { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
    .paid-fee-icon-wrap {
      width: 36px; height: 36px; border-radius: 50%; background: rgba(163,230,53,0.14);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      color: var(--dm-accent); font-size: 1rem;
    }
    .paid-fee-info { min-width: 0; }
    .paid-fee-date { font-size: 0.875rem; font-weight: 700; color: #ffffff; }
    .paid-fee-by { font-size: 0.78rem; color: rgba(255,255,255,0.62); margin-top: 2px; }
    .paid-fee-note { font-size: 0.78rem; color: var(--dm-accent); margin-top: 3px; font-style: italic; }
    .paid-fee-right {
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;
    }
    .paid-fee-amount { font-size: 1rem; font-weight: 700; color: var(--dm-accent); }
    .paid-fee-amount-waived { color: #c4b5fd !important; }
    .paid-fee-card-waived { background: rgba(139,92,246,0.04); border-color: rgba(139,92,246,0.14) !important; }
    .paid-fee-icon-waived { background: rgba(139,92,246,0.16) !important; color: #c4b5fd !important; }
    .method-waived { background: rgba(139,92,246,0.16); color: #c4b5fd; display: inline-flex; align-items: center; gap: 4px; }
    .waived-total { color: #c4b5fd; }

    .filter-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group label { font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.72); text-transform: uppercase; letter-spacing: 0.4px; }
    .filter-group select, .filter-group input {
      padding: 7px 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
      font-size: 0.85rem; background: rgba(255,255,255,0.04); min-width: 130px; color: #ffffff;
    }
    .filter-group select::placeholder, .filter-group input::placeholder { color: rgba(255,255,255,0.4); }
    .filter-group select:focus, .filter-group input:focus { outline: none; border-color: rgba(163,230,53,0.28); }

    .empty-state { text-align: center; padding: 48px 20px; color: rgba(255,255,255,0.6); }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }

    .table-wrap { overflow-x: auto; }
    .finance-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .finance-table th {
      background: rgba(255,255,255,0.04); padding: 10px 12px; text-align: left;
      font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.62);
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .finance-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #ffffff; }
    .finance-table tbody tr:hover { background: rgba(255,255,255,0.02); }
    .col-amount { text-align: right; font-weight: 700; color: var(--dm-accent); }
    .col-service { color: #93c5fd !important; }
    .col-date { color: rgba(255,255,255,0.72); font-size: 0.82rem; white-space: nowrap; }
    .col-player { font-weight: 600; color: #ffffff; }
    .col-note { color: #666; font-size: 0.82rem; font-style: italic; }
    .court-label { color: #999; font-size: 0.78rem; }

    .type-badge {
      padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;
      background: rgba(245,158,11,0.16); color: #fcd34d;
    }
    .type-badge.type-reservation { background: rgba(59,130,246,0.16); color: #93c5fd; }
    .method-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
    .method-badge.method-gcash { background: rgba(139,92,246,0.16); color: #c4b5fd; }
    .method-badge.method-cash { background: rgba(163,230,53,0.14); color: var(--dm-accent); }
    .method-badge.method-bank-transfer { background: rgba(59,130,246,0.16); color: #93c5fd; }
    .court-chip {
      padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;
      background: rgba(59,130,246,0.16); color: #93c5fd;
    }

    tfoot td { padding: 12px; background: rgba(255,255,255,0.04); font-weight: 700; border-top: 1px solid rgba(255,255,255,0.06); }
    .foot-label { color: rgba(255,255,255,0.72); font-size: 0.82rem; }
    .foot-total { font-size: 1rem; color: var(--dm-accent); }

    @media (max-width: 640px) {
      .summary-bar { gap: 8px; }
      .summary-item { min-width: 80px; }
      .filter-bar { flex-direction: column; }
      .pay-action-row { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class FinanceComponent implements OnInit {
  charges: Charge[] = [];
  allReservationCharges: Charge[] = [];
  allOpenPlayCharges: Charge[] = [];
  filtered: Charge[] = [];
  appServicePayments: AppServicePayment[] = [];
  loading = true;
  activeTab: 'payments' | 'app-service' = 'payments';

  filterType: 'all' | 'reservation' | 'session' = 'all';
  filterMethod: 'all' | 'GCash' | 'Cash' | 'Bank Transfer' = 'all';
  searchQuery = '';

  showPayForm = false;
  payAmount: number | null = null;
  payMethod: 'GCash' | 'QRPh' = 'GCash';
  payNote = '';
  saving = false;
  payError = '';
  readonly gcashQrCode = 'dev-gcash-qr.png';
  readonly qrphQrCode = 'dev-qrph-qr.png';

  get total() { return this.charges.reduce((s, c) => s + c.amount, 0); }
  get filteredTotal() { return this.filtered.reduce((s, c) => s + c.amount, 0); }
  get gcashTotal() { return this.charges.filter(c => c.paymentMethod === 'GCash').reduce((s, c) => s + c.amount, 0); }
  get cashTotal() { return this.charges.filter(c => c.paymentMethod === 'Cash').reduce((s, c) => s + c.amount, 0); }
  get bankTotal() { return this.charges.filter(c => c.paymentMethod === 'Bank Transfer').reduce((s, c) => s + c.amount, 0); }

  get reservationCharges() { return this.allReservationCharges; }
  get reservationTotal() { return this.reservationCharges.reduce((s, c) => s + c.amount, 0); }
  get reservationServiceFee() { return this.reservationCharges.reduce((s, c) => s + (c.breakdown?.convenienceFee ?? 0), 0); }
  get openPlayServiceFee() { return this.allOpenPlayCharges.reduce((s, c) => s + (c.breakdown?.convenienceFee ?? 0), 0); }
  get appServiceTotal() { return this.reservationServiceFee + this.openPlayServiceFee; }
  get totalPaid() { return this.appServicePayments.filter(p => p.type !== 'waiver').reduce((s, p) => s + p.amount, 0); }
  get totalWaived() { return this.appServicePayments.filter(p => p.type === 'waiver').reduce((s, p) => s + p.amount, 0); }
  get balance() { return this.appServiceTotal - this.totalPaid - this.totalWaived; }

  constructor(
    private chargesService: ChargesService,
    private appServicePaymentsService: AppServicePaymentsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    forkJoin({
      charges: this.chargesService.getApprovedCharges(),
      allCharges: this.chargesService.getAllCharges(),
      payments: this.appServicePaymentsService.getAll(),
    }).subscribe({
      next: ({ charges, allCharges, payments }) => {
        this.charges = charges.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        this.allReservationCharges = allCharges
          .filter(c => c.chargeType === 'reservation' && c.reservationId?.status === 'confirmed')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.allOpenPlayCharges = allCharges
          .filter(c => c.chargeType === 'open_play_session')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.appServicePayments = payments;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applyFilter() {
    this.filtered = this.charges.filter((c) => {
      if (this.filterType !== 'all' && c.chargeType !== this.filterType) return false;
      if (this.filterMethod !== 'all' && c.paymentMethod !== this.filterMethod) return false;
      if (this.searchQuery.trim()) {
        const name = this.getPlayerName(c).toLowerCase();
        if (!name.includes(this.searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }

  openPayForm() {
    this.payAmount = parseFloat(this.balance.toFixed(2));
    this.payMethod = 'GCash';
    this.payNote = '';
    this.payError = '';
    this.showPayForm = true;
  }

  cancelPayForm() {
    this.showPayForm = false;
    this.payError = '';
  }

  submitPayment() {
    if (!this.payAmount || this.payAmount <= 0) {
      this.payError = 'Enter a valid amount.';
      return;
    }
    this.saving = true;
    this.payError = '';
    this.appServicePaymentsService.record(this.payAmount, this.payMethod, this.payNote || undefined).subscribe({
      next: ({ payment }) => {
        this.appServicePayments = [payment, ...this.appServicePayments];
        this.showPayForm = false;
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.payError = err.error?.error || 'Failed to record payment.';
        this.saving = false;
        this.cdr.detectChanges();
      },
    });
  }

  methodClass(method?: string) {
    return {
      'method-gcash': method === 'GCash',
      'method-cash': method === 'Cash',
      'method-bank-transfer': method === 'Bank Transfer',
    };
  }

  getPlayerName(charge: Charge): string {
    if (charge.playerId && typeof charge.playerId === 'object') {
      return (charge.playerId as any).name || charge.guestName || 'Unknown';
    }
    return charge.guestName || 'Unknown';
  }

  formatTimeSlot(slot?: string, durationHours = 1): string {
    if (!slot) return '';
    const match = slot.match(/^(\d+)(am|pm)$/i);
    if (!match) return slot;
    const h = parseInt(match[1]);
    const period = match[2].toLowerCase();
    const start24 = period === 'am' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    const end24 = start24 + durationHours;
    const fmt = (h: number) => {
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:00 ${h < 12 ? 'AM' : 'PM'}`;
    };
    return `${fmt(start24)} - ${fmt(end24)}`;
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }
}


