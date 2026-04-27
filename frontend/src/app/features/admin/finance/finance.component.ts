import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AppServicePaymentsService, AppServicePayment } from '../../../core/services/app-service-payments.service';

const APP_SERVICE_RATE = 0.10;

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
      <div class="page-card">
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
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
                <div class="summary-value">{{ reservationTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Total Court Fees</div>
              </div>
              <div class="summary-item highlight-blue">
                <div class="summary-value">{{ appServiceTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Total Due (10%)</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ totalPaid | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Paid to Dev</div>
              </div>
              <div class="summary-item" [class.highlight-red]="balance > 0" [class.highlight-green]="balance <= 0">
                <div class="summary-value">{{ balance | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                <div class="summary-label">Outstanding</div>
              </div>
            </div>

            <!-- Pay Action -->
            <div class="pay-action-row">
              <p class="rate-note">App Service Fee = 10% of approved court reservation charges, paid to the Developer.</p>
              <button class="btn-pay" (click)="openPayForm()" [disabled]="balance <= 0">
                <i class="fas fa-paper-plane"></i> Record Payment to Developer
              </button>
            </div>

            <!-- Reservation Charges Table -->
            <h4 class="section-heading">Court Reservation Charges</h4>
            @if (reservationCharges.length === 0) {
              <div class="empty-state">
                <span>🎾</span>
                <p>No approved reservation charges found.</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="finance-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Date</th>
                      <th>Court</th>
                      <th>Method</th>
                      <th class="col-amount">Court Fee</th>
                      <th class="col-amount">App Service (10%)</th>
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
                        <td class="col-amount col-service">{{ charge.amount * 0.10 | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" class="foot-label">Total ({{ reservationCharges.length }} reservations)</td>
                      <td class="col-amount foot-total">{{ reservationTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="col-amount foot-total col-service">{{ appServiceTotal | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
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
                  <h4 class="paid-fees-title">Paid App Service Fees</h4>
                  @if (appServicePayments.length > 0) {
                    <span class="paid-fees-count">{{ appServicePayments.length }}</span>
                  }
                </div>
                <div class="paid-fees-total">
                  Total Paid: <strong>{{ totalPaid | currency: 'PHP' : 'symbol' : '1.2-2' }}</strong>
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
                    <div class="paid-fee-card">
                      <div class="paid-fee-left">
                        <div class="paid-fee-icon-wrap">
                          <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="paid-fee-info">
                          <div class="paid-fee-date">{{ p.createdAt | date: 'MMM d, yyyy' : 'UTC' }}</div>
                          <div class="paid-fee-by">Paid by {{ p.paidBy?.name }}</div>
                          @if (p.note) {
                            <div class="paid-fee-note">📝 {{ p.note }}</div>
                          }
                        </div>
                      </div>
                      <div class="paid-fee-right">
                        <span class="method-badge" [ngClass]="methodClass(p.paymentMethod)">
                          {{ p.paymentMethod }}
                        </span>
                        <div class="paid-fee-amount">{{ p.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
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
              <select [(ngModel)]="payMethod">
                <option value="GCash">GCash</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
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
      box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 1000px; margin: 0 auto; overflow: hidden;
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

    .tab-bar { display: flex; border-bottom: 2px solid #e9ecef; padding: 0 24px; }
    .tab-btn {
      background: none; border: none; padding: 14px 20px;
      font-size: 0.9rem; font-weight: 600; color: #888; cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s;
    }
    .tab-btn:hover { color: #9f7338; }
    .tab-btn.active { color: #9f7338; border-bottom-color: #9f7338; }

    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 40px; color: #999; }

    .summary-bar {
      display: flex; flex-wrap: wrap; gap: 12px;
      padding: 16px 20px; background: #f8f1e4; border-radius: 10px;
      border: 1px solid #e6d2ad; margin-bottom: 20px;
    }
    .app-service-bar { background: #eff6ff; border-color: #bfdbfe; }
    .summary-item {
      flex: 1; min-width: 100px; text-align: center; padding: 8px 12px; border-radius: 8px;
    }
    .summary-item.highlight { background: #9f7338; }
    .summary-item.highlight .summary-value { color: #fff; font-size: 1.3rem; }
    .summary-item.highlight .summary-label { color: rgba(255,255,255,0.8); }
    .summary-item.highlight-blue { background: #1d4ed8; border-radius: 8px; }
    .summary-item.highlight-blue .summary-value { color: #fff; font-size: 1.3rem; }
    .summary-item.highlight-blue .summary-label { color: rgba(255,255,255,0.8); }
    .summary-item.highlight-red { background: #dc2626; border-radius: 8px; }
    .summary-item.highlight-red .summary-value { color: #fff; font-size: 1.1rem; }
    .summary-item.highlight-red .summary-label { color: rgba(255,255,255,0.8); }
    .summary-item.highlight-green { background: #b88942; border-radius: 8px; }
    .summary-item.highlight-green .summary-value { color: #fff; font-size: 1.1rem; }
    .summary-item.highlight-green .summary-label { color: rgba(255,255,255,0.8); }
    .summary-value { font-size: 1.1rem; font-weight: 700; color: #1a1a1a; }
    .summary-label { font-size: 0.72rem; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }

    .pay-action-row {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
    }
    .rate-note {
      font-size: 0.82rem; color: #6b7280; margin: 0;
      padding: 8px 12px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #1d4ed8;
      flex: 1;
    }
    .btn-pay {
      padding: 9px 18px; background: #1d4ed8; color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; white-space: nowrap;
      display: flex; align-items: center; gap: 7px;
    }
    .btn-pay:hover:not(:disabled) { background: #1e40af; }
    .btn-pay:disabled { opacity: 0.45; cursor: not-allowed; }

    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 100; display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: white; border-radius: 14px; width: 100%; max-width: 460px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: slideUp 0.2s ease;
      overflow: hidden;
    }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #eee;
    }
    .modal-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #1a1a1a; }
    .modal-close {
      background: none; border: none; font-size: 1rem; color: #888;
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .modal-close:hover { background: #f0f0f0; color: #333; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field label { font-size: 0.8rem; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 0.4px; }
    .modal-field .optional { font-weight: 400; color: #999; text-transform: none; letter-spacing: 0; }
    .modal-field input, .modal-field select {
      padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px;
      font-size: 0.9rem; background: white; width: 100%; box-sizing: border-box;
    }
    .modal-field input:focus, .modal-field select:focus { outline: none; border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.1); }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 20px; border-top: 1px solid #eee; background: #f9fafb;
    }
    .btn-confirm-pay {
      padding: 9px 20px; background: #1d4ed8; color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px;
    }
    .btn-confirm-pay:hover:not(:disabled) { background: #1e40af; }
    .btn-confirm-pay:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-cancel-pay {
      padding: 9px 16px; background: white; color: #555;
      border: 1px solid #ddd; border-radius: 8px; font-size: 0.875rem; cursor: pointer;
    }
    .btn-cancel-pay:hover:not(:disabled) { background: #f0f0f0; }
    .pay-error { color: #dc2626; font-size: 0.82rem; }

    .section-heading {
      font-size: 0.85rem; font-weight: 700; color: #555; text-transform: uppercase;
      letter-spacing: 0.5px; margin: 0 0 12px 0;
    }
    .paid-fees-section {
      margin-top: 2rem; border: 1px solid #bfdbfe; border-radius: 12px; overflow: hidden;
    }
    .paid-fees-header {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
      padding: 14px 18px; background: #eff6ff; border-bottom: 1px solid #bfdbfe;
    }
    .paid-fees-title-row { display: flex; align-items: center; gap: 8px; }
    .paid-fees-icon { color: #1d4ed8; font-size: 1rem; }
    .paid-fees-title { margin: 0; font-size: 0.9rem; font-weight: 700; color: #1e3a8a; }
    .paid-fees-count {
      background: #1d4ed8; color: #fff; font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }
    .paid-fees-total { font-size: 0.85rem; color: #1e40af; }
    .paid-fees-total strong { font-size: 1rem; }
    .paid-fees-empty {
      padding: 32px 20px; text-align: center; color: #93c5fd;
    }
    .paid-fees-empty i { font-size: 2rem; display: block; margin-bottom: 8px; }
    .paid-fees-empty p { margin: 0; font-size: 0.875rem; color: #64748b; }
    .paid-fees-list { display: flex; flex-direction: column; }
    .paid-fee-card {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 18px; border-bottom: 1px solid #e0f2fe; background: white;
      transition: background 0.15s;
    }
    .paid-fee-card:last-child { border-bottom: none; }
    .paid-fee-card:hover { background: #f0f9ff; }
    .paid-fee-left { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
    .paid-fee-icon-wrap {
      width: 36px; height: 36px; border-radius: 50%; background: #dbeafe;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      color: #1d4ed8; font-size: 1rem;
    }
    .paid-fee-info { min-width: 0; }
    .paid-fee-date { font-size: 0.875rem; font-weight: 700; color: #1a1a1a; }
    .paid-fee-by { font-size: 0.78rem; color: #64748b; margin-top: 2px; }
    .paid-fee-note { font-size: 0.78rem; color: #1d4ed8; margin-top: 3px; font-style: italic; }
    .paid-fee-right {
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;
    }
    .paid-fee-amount { font-size: 1rem; font-weight: 700; color: #1d4ed8; }

    .filter-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group label { font-size: 0.75rem; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.4px; }
    .filter-group select, .filter-group input {
      padding: 7px 10px; border: 1px solid #ddd; border-radius: 6px;
      font-size: 0.85rem; background: white; min-width: 130px;
    }
    .filter-group select:focus, .filter-group input:focus { outline: none; border-color: #9f7338; }

    .empty-state { text-align: center; padding: 48px 20px; color: #999; }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }

    .table-wrap { overflow-x: auto; }
    .finance-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .finance-table th {
      background: #f8f9fa; padding: 10px 12px; text-align: left;
      font-size: 0.75rem; font-weight: 700; color: #555;
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e9ecef;
    }
    .finance-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #333; }
    .finance-table tbody tr:hover { background: #fafff9; }
    .col-amount { text-align: right; font-weight: 700; color: #9f7338; }
    .col-service { color: #1d4ed8 !important; }
    .col-date { color: #555; font-size: 0.82rem; white-space: nowrap; }
    .col-player { font-weight: 600; color: #1a1a1a; }
    .col-note { color: #666; font-size: 0.82rem; font-style: italic; }
    .court-label { color: #999; font-size: 0.78rem; }

    .type-badge {
      padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;
      background: #fef3c7; color: #92400e;
    }
    .type-badge.type-reservation { background: #dbeafe; color: #1e40af; }
    .method-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
    .method-badge.method-gcash { background: #ede9fe; color: #5b21b6; }
    .method-badge.method-cash { background: #f2e4c9; color: #7a5626; }
    .method-badge.method-bank-transfer { background: #e0f2fe; color: #0369a1; }
    .court-chip {
      padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;
      background: #dbeafe; color: #1e40af;
    }

    tfoot td { padding: 12px; background: #f8f9fa; font-weight: 700; border-top: 2px solid #e9ecef; }
    .foot-label { color: #555; font-size: 0.82rem; }
    .foot-total { font-size: 1rem; color: #9f7338; }

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
  filtered: Charge[] = [];
  appServicePayments: AppServicePayment[] = [];
  loading = true;
  activeTab: 'payments' | 'app-service' = 'payments';

  filterType: 'all' | 'reservation' | 'session' = 'all';
  filterMethod: 'all' | 'GCash' | 'Cash' | 'Bank Transfer' = 'all';
  searchQuery = '';

  showPayForm = false;
  payAmount: number | null = null;
  payMethod: 'GCash' | 'Cash' | 'Bank Transfer' = 'GCash';
  payNote = '';
  saving = false;
  payError = '';

  get total() { return this.charges.reduce((s, c) => s + c.amount, 0); }
  get filteredTotal() { return this.filtered.reduce((s, c) => s + c.amount, 0); }
  get gcashTotal() { return this.charges.filter(c => c.paymentMethod === 'GCash').reduce((s, c) => s + c.amount, 0); }
  get cashTotal() { return this.charges.filter(c => c.paymentMethod === 'Cash').reduce((s, c) => s + c.amount, 0); }
  get bankTotal() { return this.charges.filter(c => c.paymentMethod === 'Bank Transfer').reduce((s, c) => s + c.amount, 0); }

  get reservationCharges() { return this.charges.filter(c => c.chargeType === 'reservation'); }
  get reservationTotal() { return this.reservationCharges.reduce((s, c) => s + c.amount, 0); }
  get appServiceTotal() { return this.reservationTotal * APP_SERVICE_RATE; }
  get totalPaid() { return this.appServicePayments.reduce((s, p) => s + p.amount, 0); }
  get balance() { return this.appServiceTotal - this.totalPaid; }

  constructor(
    private chargesService: ChargesService,
    private appServicePaymentsService: AppServicePaymentsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    forkJoin({
      charges: this.chargesService.getApprovedCharges(),
      payments: this.appServicePaymentsService.getAll(),
    }).subscribe({
      next: ({ charges, payments }) => {
        this.charges = charges.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
      return (charge.playerId as any).name || 'Unknown';
    }
    return 'Unknown';
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }
}


