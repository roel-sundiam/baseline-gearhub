import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AppServicePaymentsService, AppServicePayment } from '../../../core/services/app-service-payments.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationService, Reservation } from '../../../core/services/reservation.service';

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
          <button class="tab-btn" [class.active]="activeTab === 'bookings'" (click)="activeTab = 'bookings'; onBookingsTabOpen()">
            Bookings
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'app-service'" (click)="activeTab = 'app-service'">
            App Service
          </button>
        </div>

        <div class="card-body">
          @if (loading) {
            <div class="loading">Loading...</div>
          } @else if (activeTab === 'payments') {

            <!-- Summary -->
            <div class="pm-top-row">
              <div class="bk-stat-card">
                <i class="fas fa-receipt bk-stat-icon"></i>
                <div class="bk-stat-value">{{ charges.length }}</div>
                <div class="bk-stat-label">Approved Payments</div>
              </div>
              <div class="bk-stat-card bk-stat-earnings">
                <i class="fas fa-coins bk-stat-icon"></i>
                <div class="bk-stat-value">{{ total | currency: 'PHP' : 'symbol' : '1.0-0' }}</div>
                <div class="bk-stat-label">Total Collected</div>
              </div>
            </div>
            <div class="pm-method-row">
              <div class="pm-method-card">
                <i class="fas fa-mobile-alt pm-method-icon gcash-icon"></i>
                <div class="pm-method-value">{{ gcashTotal | currency: 'PHP' : 'symbol' : '1.0-0' }}</div>
                <div class="bk-stat-label">GCash</div>
              </div>
              <div class="pm-method-card">
                <i class="fas fa-money-bill-wave pm-method-icon cash-icon"></i>
                <div class="pm-method-value">{{ cashTotal | currency: 'PHP' : 'symbol' : '1.0-0' }}</div>
                <div class="bk-stat-label">Cash</div>
              </div>
              <div class="pm-method-card">
                <i class="fas fa-university pm-method-icon bank-icon"></i>
                <div class="pm-method-value">{{ bankTotal | currency: 'PHP' : 'symbol' : '1.0-0' }}</div>
                <div class="bk-stat-label">Bank Transfer</div>
              </div>
            </div>

            <!-- Filters -->
            <div class="bk-filter-row">
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
              <div class="filter-group" style="grid-column: 1 / -1">
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

          } @else if (activeTab === 'bookings') {

            <!-- Bookings Tab -->
            <div class="bk-stats-grid">
              <div class="bk-stat-card">
                <i class="fas fa-calendar-check bk-stat-icon"></i>
                <div class="bk-stat-value">{{ totalBookings }}</div>
                <div class="bk-stat-label">Total Bookings</div>
              </div>
              <div class="bk-stat-card">
                <i class="fas fa-clock bk-stat-icon"></i>
                <div class="bk-stat-value">{{ totalHours }}h</div>
                <div class="bk-stat-label">Total Hours</div>
              </div>
              <div class="bk-stat-card bk-stat-earnings">
                <i class="fas fa-coins bk-stat-icon"></i>
                <div class="bk-stat-value">{{ reservationTotal | currency: 'PHP' : 'symbol' : '1.0-0' }}</div>
                <div class="bk-stat-label">Approved Earnings</div>
              </div>
            </div>

            <div class="bk-status-row">
              <div class="bk-pill bk-pill-confirmed">
                <i class="fas fa-check-circle"></i> {{ confirmedCount }} Confirmed
              </div>
              <div class="bk-pill bk-pill-pending">
                <i class="fas fa-hourglass-half"></i> {{ pendingCount }} Pending
              </div>
              <div class="bk-pill bk-pill-cancelled">
                <i class="fas fa-times-circle"></i> {{ cancelledCount }} Cancelled
              </div>
            </div>

            <!-- Filters -->
            <div class="bk-filter-row">
              <div class="filter-group">
                <label>From</label>
                <input type="date" [(ngModel)]="bookingStartDate" />
              </div>
              <div class="filter-group">
                <label>To</label>
                <input type="date" [(ngModel)]="bookingEndDate" />
              </div>
              <div class="filter-group">
                <label>Status</label>
                <select [(ngModel)]="bookingStatusFilter">
                  <option value="all">All</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending_payment">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div class="filter-group bk-filter-actions">
                <label>&nbsp;</label>
                <div class="bk-action-btns">
                  <button class="btn-pay" (click)="refreshBookings()" [disabled]="reservationsLoading">
                    <i class="fas fa-search"></i> Search
                  </button>
                  <button class="btn-print" (click)="printBookings()" [disabled]="filteredReservations.length === 0">
                    <i class="fas fa-print"></i> Print
                  </button>
                </div>
              </div>
            </div>

            @if (reservationsLoading) {
              <div class="loading">Loading bookings...</div>
            } @else if (filteredReservations.length === 0) {
              <div class="empty-state">
                <span>📅</span>
                <p>No bookings found for the selected period.</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="finance-table">
                  <thead>
                    <tr>
                      <th>Player / Guest</th>
                      <th>Court</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of filteredReservations; track r._id) {
                      <tr>
                        <td class="col-player">{{ getBookingPlayerName(r) }}</td>
                        <td><span class="court-chip">Court {{ r.court }}</span></td>
                        <td class="col-date">{{ r.date | date: 'MMM d, yyyy' : 'UTC' }}</td>
                        <td class="col-date">{{ formatTimeSlot(r.timeSlot, r.durationHours ?? 1) }}</td>
                        <td class="col-date">{{ r.durationHours ?? 1 }}h</td>
                        <td>
                          <span class="status-badge" [ngClass]="bookingStatusClass(r.status)">
                            {{ bookingStatusLabel(r.status) }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" class="foot-label">Total ({{ filteredReservations.length }} bookings)</td>
                      <td class="foot-total">{{ totalHours }}h</td>
                      <td></td>
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
              @if (balance < 0) {
                <div class="summary-item highlight-green">
                  <div class="summary-value">{{ (balance * -1) | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                  <div class="summary-label">Credit</div>
                </div>
              } @else {
                <div class="summary-item" [class.highlight-red]="balance > 0" [class.highlight-green]="balance === 0">
                  <div class="summary-value">{{ balance | currency: 'PHP' : 'symbol' : '1.2-2' }}</div>
                  <div class="summary-label">Outstanding</div>
                </div>
              }
            </div>

            <!-- Monthly Flat Notice -->
            @if (isMonthlyFlat) {
              <div class="monthly-flat-banner">
                <div class="monthly-flat-left">
                  <i class="fas fa-calendar-alt"></i>
                  <div>
                    <div class="monthly-flat-title">Monthly Flat Plan</div>
                    <div class="monthly-flat-detail">₱{{ convenienceFeeMonthlyAmount | number:'1.0-2' }}/month — outstanding balance due by <strong>{{ endOfMonthLabel }}</strong></div>
                  </div>
                </div>
              </div>
            }

            <!-- Pay Action -->
            <div class="pay-action-row">
              <p class="rate-note">
                @if (isMonthlyFlat) {
                  App Service Fee = fixed monthly fee remitted to the Developer.
                } @else {
                  App Service Fee = convenience fee collected from clients per booking, remitted to the Developer.
                }
              </p>
              <button class="btn-pay" (click)="openPayForm()">
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
                    <div class="paid-fee-card" [class.paid-fee-card-waived]="p.type === 'waiver'" [class.paid-fee-card-billing]="p.type === 'billing'">
                      <div class="paid-fee-left">
                        <div class="paid-fee-icon-wrap" [class.paid-fee-icon-waived]="p.type === 'waiver'" [class.paid-fee-icon-billing]="p.type === 'billing'">
                          <i class="fas" [class.fa-check-circle]="p.type === 'payment'" [class.fa-hand-holding-usd]="p.type === 'waiver'" [class.fa-calendar-alt]="p.type === 'billing'"></i>
                        </div>
                        <div class="paid-fee-info">
                          <div class="paid-fee-date">{{ p.createdAt | date: 'MMM d, yyyy' : 'UTC' }}</div>
                          <div class="paid-fee-by">
                            {{ p.type === 'waiver' ? 'Waived by' : p.type === 'billing' ? 'Billed by' : 'Paid by' }} {{ p.paidBy?.name }}
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
                        } @else if (p.type === 'billing') {
                          <span class="method-badge method-billing">
                            <i class="fas fa-calendar-alt"></i> Monthly Billing
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
              </div>
            </div>
            @if (payMethod === 'GCash') {
              <div class="qr-block qr-block-gcash">
                <p class="qr-label"><i class="fas fa-mobile-alt"></i> Scan to pay via GCash</p>
                <img [src]="gcashQrCode" alt="Developer GCash QR Code" class="qr-img" />
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

    .monthly-flat-banner {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin-bottom: 16px;
      padding: 14px 16px; border-radius: 8px;
      background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.25);
    }
    .monthly-flat-left {
      display: flex; align-items: center; gap: 12px; color: #93c5fd;
    }
    .monthly-flat-left i { font-size: 1.2rem; flex-shrink: 0; }
    .monthly-flat-title { font-weight: 700; font-size: 0.9rem; color: #93c5fd; }
    .monthly-flat-detail { font-size: 0.82rem; color: rgba(255,255,255,0.72); margin-top: 2px; }

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
    .qr-block {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 14px 12px; border-radius: 10px;
    }
    .qr-block-gcash { background: rgba(139,92,246,0.10); border: 1px solid rgba(139,92,246,0.28); }
    .qr-block-gcash .qr-label { color: #c4b5fd; }
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
    .method-billing { background: rgba(96,165,250,0.16); color: #93c5fd; display: inline-flex; align-items: center; gap: 4px; }
    .paid-fee-card-billing { border-left: 3px solid rgba(96,165,250,0.4); }
    .paid-fee-icon-billing { background: rgba(96,165,250,0.16) !important; color: #93c5fd !important; }
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

    .status-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
    .status-confirmed { background: rgba(134,239,172,0.16); color: #86efac; }
    .status-pending { background: rgba(252,211,77,0.16); color: #fcd34d; }
    .status-cancelled { background: rgba(252,165,165,0.16); color: #fca5a5; }

    /* Approved Payments summary redesign */
    .pm-top-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;
    }
    .pm-method-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;
    }
    .pm-method-card {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: 12px 8px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.03);
      gap: 4px;
    }
    .pm-method-icon { font-size: 1rem; margin-bottom: 2px; }
    .gcash-icon { color: #c4b5fd; }
    .cash-icon { color: var(--dm-accent); }
    .bank-icon { color: #93c5fd; }
    .pm-method-value { font-size: 1rem; font-weight: 700; color: #ffffff; }

    /* Bookings tab redesign */
    .bk-stats-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;
    }
    .bk-stat-card {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: 20px 12px 16px; border-radius: 14px;
      border: 1px solid rgba(163,230,53,0.15); background: rgba(163,230,53,0.07);
      gap: 6px; transition: background 0.15s;
    }
    .bk-stat-card:hover { background: rgba(163,230,53,0.11); }
    .bk-stat-card.bk-stat-earnings {
      background: rgba(163,230,53,0.12); border-color: rgba(163,230,53,0.28);
    }
    .bk-stat-icon { font-size: 1.1rem; color: var(--dm-accent); opacity: 0.75; }
    .bk-stat-value { font-size: 1.6rem; font-weight: 800; color: var(--dm-accent); line-height: 1.1; }
    .bk-stat-label { font-size: 0.67rem; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.5); margin-top: 2px; }

    .bk-status-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px;
    }
    .bk-pill {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 7px 10px; border-radius: 20px;
      font-size: 0.78rem; font-weight: 700; white-space: nowrap;
    }
    .bk-pill-confirmed { background: rgba(134,239,172,0.1); color: #86efac; border: 1px solid rgba(134,239,172,0.22); }
    .bk-pill-pending   { background: rgba(252,211,77,0.1);  color: #fcd34d; border: 1px solid rgba(252,211,77,0.22);  }
    .bk-pill-cancelled { background: rgba(252,165,165,0.1); color: #fca5a5; border: 1px solid rgba(252,165,165,0.22); }

    .bk-filter-row {
      display: grid; grid-template-columns: 1fr 1fr 1fr auto;
      gap: 10px; align-items: flex-end; margin-bottom: 20px;
      padding: 14px 16px; background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;
    }
    .bk-filter-actions { display: flex; flex-direction: column; }
    .bk-action-btns { display: flex; gap: 8px; }
    .btn-print {
      padding: 9px 14px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.75);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; white-space: nowrap;
      display: flex; align-items: center; gap: 6px; font-family: inherit;
    }
    .btn-print:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
    .btn-print:disabled { opacity: 0.35; cursor: not-allowed; }

    @media (max-width: 640px) {
      .summary-bar { gap: 8px; }
      .summary-item { min-width: 80px; }
      .filter-bar { flex-direction: column; }
      .pay-action-row { flex-direction: column; align-items: flex-start; }
      .bk-stats-grid { grid-template-columns: repeat(2, 1fr); }
      .bk-stat-card.bk-stat-earnings { grid-column: 1 / -1; }
      .bk-filter-row { grid-template-columns: 1fr 1fr; }
      .pm-top-row { grid-template-columns: 1fr 1fr; }
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
  activeTab: 'payments' | 'bookings' | 'app-service' = 'payments';

  filterType: 'all' | 'reservation' | 'session' = 'all';
  filterMethod: 'all' | 'GCash' | 'Cash' | 'Bank Transfer' = 'all';
  searchQuery = '';

  showPayForm = false;
  payAmount: number | null = null;
  payMethod: 'GCash' = 'GCash';
  payNote = '';
  saving = false;
  payError = '';
  readonly gcashQrCode = 'dev-gcash-qr.png';

  private clubId?: string;
  reservations: Reservation[] = [];
  filteredReservations: Reservation[] = [];
  reservationsLoading = false;
  reservationsLoaded = false;
  bookingStartDate = '';
  bookingEndDate = '';
  bookingStatusFilter: 'all' | 'confirmed' | 'pending_payment' | 'cancelled' = 'all';

  convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat' = 'per_hour';
  convenienceFeeMonthlyAmount = 0;

  get isMonthlyFlat() { return this.convenienceFeeMode === 'monthly_flat'; }

  get endOfMonthLabel(): string {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return end.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  get total() { return this.charges.reduce((s, c) => s + c.amount, 0); }
  get filteredTotal() { return this.filtered.reduce((s, c) => s + c.amount, 0); }
  get gcashTotal() { return this.charges.filter(c => c.paymentMethod === 'GCash').reduce((s, c) => s + c.amount, 0); }
  get cashTotal() { return this.charges.filter(c => c.paymentMethod === 'Cash').reduce((s, c) => s + c.amount, 0); }
  get bankTotal() { return this.charges.filter(c => c.paymentMethod === 'Bank Transfer').reduce((s, c) => s + c.amount, 0); }

  get reservationCharges() { return this.allReservationCharges; }
  get reservationTotal() { return this.reservationCharges.reduce((s, c) => s + c.amount, 0); }
  get reservationServiceFee() { return this.reservationCharges.reduce((s, c) => s + (c.breakdown?.convenienceFee ?? 0), 0); }
  get openPlayServiceFee() { return this.allOpenPlayCharges.reduce((s, c) => s + (c.breakdown?.convenienceFee ?? 0), 0); }
  get billingTotal() { return this.appServicePayments.filter(p => p.type === 'billing').reduce((s, p) => s + p.amount, 0); }
  get appServiceTotal() {
    return this.isMonthlyFlat
      ? this.convenienceFeeMonthlyAmount
      : this.reservationServiceFee + this.openPlayServiceFee + this.billingTotal;
  }
  get totalPaid() { return this.appServicePayments.filter(p => p.type === 'payment').reduce((s, p) => s + p.amount, 0); }
  get totalWaived() { return this.appServicePayments.filter(p => p.type === 'waiver').reduce((s, p) => s + p.amount, 0); }
  get balance() {
    return this.isMonthlyFlat
      ? Math.max(0, this.appServiceTotal - this.totalPaid)
      : this.appServiceTotal - this.totalPaid - this.totalWaived;
  }

  constructor(
    private chargesService: ChargesService,
    private appServicePaymentsService: AppServicePaymentsService,
    private reservationService: ReservationService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.clubId = this.auth.isSuperAdmin() ? undefined : (this.auth.user()?.clubId ?? undefined);
    const today = new Date();
    this.bookingEndDate = today.toISOString().slice(0, 10);
    this.bookingStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

    forkJoin({
      charges: this.chargesService.getApprovedCharges(this.clubId),
      allCharges: this.chargesService.getAllCharges(this.clubId),
      payments: this.appServicePaymentsService.getAll(),
      feeInfo: this.appServicePaymentsService.getFeeInfo(),
    }).subscribe({
      next: ({ charges, allCharges, payments, feeInfo }) => {
        this.charges = charges.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        this.allReservationCharges = allCharges
          .filter(c => c.chargeType === 'reservation' &&
            (c.reservationId?.status === 'confirmed' || (c.approvalStatus === 'approved' && !c.reservationId)))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.allOpenPlayCharges = allCharges
          .filter(c => c.chargeType === 'open_play_session')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.appServicePayments = payments;
        this.convenienceFeeMode = feeInfo.convenienceFeeMode;
        this.convenienceFeeMonthlyAmount = feeInfo.convenienceFeeMonthlyAmount;
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
    this.payAmount = Math.max(0, parseFloat(this.balance.toFixed(2)));
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

  loadBookings() {
    if (this.reservationsLoading) return;
    this.reservationsLoading = true;
    this.reservationService.getAll({
      clubId: this.clubId,
      startDate: this.bookingStartDate,
      endDate: this.bookingEndDate,
      status: this.bookingStatusFilter !== 'all' ? this.bookingStatusFilter : undefined,
    }).subscribe({
      next: (res) => {
        this.reservations = res.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.applyBookingFilter();
        this.reservationsLoaded = true;
        this.reservationsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.reservationsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applyBookingFilter() {
    this.filteredReservations = this.reservations.filter(r => {
      if (this.bookingStatusFilter !== 'all' && r.status !== this.bookingStatusFilter) return false;
      return true;
    });
  }

  onBookingsTabOpen() {
    if (!this.reservationsLoaded) {
      this.loadBookings();
    }
  }

  refreshBookings() {
    this.reservationsLoaded = false;
    this.loadBookings();
  }

  get totalBookings() { return this.filteredReservations.length; }
  get totalHours() { return this.filteredReservations.reduce((s, r) => s + (r.durationHours ?? 1), 0); }
  get confirmedCount() { return this.filteredReservations.filter(r => r.status === 'confirmed').length; }
  get pendingCount() { return this.filteredReservations.filter(r => r.status === 'pending_payment').length; }
  get cancelledCount() { return this.filteredReservations.filter(r => r.status === 'cancelled').length; }

  getBookingPlayerName(r: Reservation): string {
    if (r.guestInfo?.name) return r.guestInfo.name + ' (Guest)';
    if (r.player && typeof r.player === 'object') return r.player.name;
    if (r.players?.length) return r.players[0].name;
    return 'Unknown';
  }

  bookingStatusClass(status: string) {
    return {
      'status-confirmed': status === 'confirmed',
      'status-pending': status === 'pending_payment',
      'status-cancelled': status === 'cancelled',
    };
  }

  bookingStatusLabel(status: string) {
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'pending_payment') return 'Pending';
    if (status === 'cancelled') return 'Cancelled';
    return status;
  }

  printBookings() {
    const rows = this.filteredReservations.map(r => `
      <tr>
        <td>${this.getBookingPlayerName(r)}</td>
        <td>Court ${r.court}</td>
        <td>${new Date(r.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</td>
        <td>${this.formatTimeSlot(r.timeSlot, r.durationHours ?? 1)}</td>
        <td>${r.durationHours ?? 1}h</td>
        <td>${this.bookingStatusLabel(r.status)}</td>
      </tr>`).join('');

    const earnings = this.reservationTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bookings Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 28px; color: #111; font-size: 13px; }
    h2 { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
    .summary { display: flex; gap: 0; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; margin-bottom: 20px; }
    .summary-item { flex: 1; padding: 12px 16px; text-align: center; border-right: 1px solid #ccc; }
    .summary-item:last-child { border-right: none; }
    .summary-value { font-size: 20px; font-weight: 700; color: #111; }
    .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #666; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f0f0; font-weight: 700; text-align: left; padding: 8px 10px; border: 1px solid #ccc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 7px 10px; border: 1px solid #ddd; }
    tr:nth-child(even) td { background: #fafafa; }
    tfoot td { font-weight: 700; background: #f0f0f0; border-top: 2px solid #bbb; }
  </style>
</head>
<body>
  <h2>Bookings Report</h2>
  <p class="meta">Period: ${this.bookingStartDate} to ${this.bookingEndDate}</p>
  <div class="summary">
    <div class="summary-item">
      <div class="summary-value">${this.totalBookings}</div>
      <div class="summary-label">Total Bookings</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${this.totalHours}h</div>
      <div class="summary-label">Total Hours</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${earnings}</div>
      <div class="summary-label">Approved Earnings</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Player / Guest</th><th>Court</th><th>Date</th><th>Time</th><th>Duration</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total — ${this.filteredReservations.length} bookings</td>
        <td colspan="2">${this.totalHours}h</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
        URL.revokeObjectURL(url);
      });
    }
  }
}


