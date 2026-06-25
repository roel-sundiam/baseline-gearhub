import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService } from '../../../core/services/club.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';

type FilterTab = 'all' | 'unpaid' | 'paid';

@Component({
  selector: 'app-player-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dm-shell">
      <!-- Mobile header -->
      <header class="dm-header">
        <button class="dm-back-btn" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">Payments</span>
        <div class="dm-header-balance" [class.all-clear]="totals.totalOutstanding === 0">
          @if (totals.totalOutstanding > 0) {
            <span class="dm-balance-amount">{{ totals.totalOutstanding | currency: 'PHP' : 'symbol' }}</span>
            <span class="dm-balance-label">outstanding</span>
          } @else {
            <i class="fas fa-check-circle" style="color:#a3e635"></i>
            <span class="dm-balance-label">all paid</span>
          }
        </div>
      </header>

      <!-- Filter tabs -->
      <div class="dm-tabs">
        <button class="dm-tab" [class.active]="filterTab === 'unpaid'" (click)="setFilterTab('unpaid')">
          Unpaid
          @if (totals.unpaidCount > 0) { <span class="dm-tab-badge">{{ totals.unpaidCount }}</span> }
        </button>
        <button class="dm-tab" [class.active]="filterTab === 'paid'" (click)="setFilterTab('paid')">
          Paid
          @if (totals.paidCount > 0) { <span class="dm-tab-badge dm-tab-badge-green">{{ totals.paidCount }}</span> }
        </button>
        <button class="dm-tab" [class.active]="filterTab === 'all'" (click)="setFilterTab('all')">
          All
          @if (totals.totalCharges > 0) { <span class="dm-tab-badge dm-tab-badge-muted">{{ totals.totalCharges }}</span> }
        </button>
      </div>

      <div class="dm-body">
        @if (loading) {
          <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading charges…</div>
        } @else if (errorMessage) {
          <div class="dm-error-card">
            <i class="fas fa-exclamation-triangle"></i>
            <p>{{ errorMessage }}</p>
            <button class="dm-retry-btn" (click)="loadCharges()">Retry</button>
          </div>
        } @else if (filteredCharges.length === 0) {
          <div class="dm-empty">
            <i class="far fa-credit-card"></i>
            <p>
              @if (filterTab === 'all') { No charges yet. }
              @else if (filterTab === 'unpaid') { All charges are paid! }
              @else { No paid charges yet. }
            </p>
          </div>
        } @else {
          <div class="dm-charges-list">
            @for (charge of filteredCharges; track charge._id) {
              <div class="dm-charge-card" [class.dm-charge-paid]="charge.status === 'paid'" [class.dm-charge-rejected]="charge.approvalStatus === 'rejected'">
                <div class="dm-charge-accent" [class.accent-amber]="charge.approvalStatus === 'pending'" [class.accent-green]="charge.approvalStatus === 'approved' || charge.status === 'paid'" [class.accent-red]="charge.approvalStatus === 'rejected'" [class.accent-white]="!charge.approvalStatus || charge.approvalStatus === 'none'"></div>

                <div class="dm-charge-main">
                  <div class="dm-charge-top">
                    <div class="dm-charge-title">
                      @if (charge.chargeType === 'reservation') { Court Reservation }
                      @else { Session Charge }
                    </div>
                    @if (charge.approvalStatus === 'pending') {
                      <span class="dm-status-chip chip-amber">Awaiting</span>
                    } @else if (charge.approvalStatus === 'approved') {
                      <span class="dm-status-chip chip-green">Approved</span>
                    } @else if (charge.approvalStatus === 'rejected') {
                      <span class="dm-status-chip chip-red">Rejected</span>
                    } @else {
                      <span class="dm-status-chip" [class.chip-green]="charge.status === 'paid'" [class.chip-amber]="charge.status === 'unpaid'">
                        {{ charge.status | uppercase }}
                      </span>
                    }
                  </div>

                  <div class="dm-charge-details">
                    <div class="dm-detail-row">
                      <span class="dm-detail-icon"><i class="fas fa-user"></i></span>
                      <span>{{ getReserverName(charge) }}</span>
                    </div>
                    @if (charge.chargeType === 'reservation' && charge.reservationId) {
                      <div class="dm-detail-row">
                        <span class="dm-detail-icon"><i class="fas fa-calendar-alt"></i></span>
                        <span>{{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                        @if (charge.reservationId.timeSlot) {
                          <span class="dm-detail-sep">·</span>
                          <span>{{ formatTimeSlot(charge.reservationId.timeSlot, charge.reservationId.durationHours ?? 1) }}</span>
                        }
                      </div>
                      <div class="dm-detail-row">
                        <span class="dm-detail-icon"><i class="fas fa-table-tennis"></i></span>
                        <span class="dm-court-label">Court {{ charge.reservationId.court }}</span>
                      </div>
                    } @else if (charge.chargeType === 'session' && charge.sessionId) {
                      <div class="dm-detail-row">
                        <span class="dm-detail-icon"><i class="fas fa-calendar-alt"></i></span>
                        <span>{{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }} · {{ charge.sessionId.startTime }}</span>
                      </div>
                    }
                    @if (charge.paidAt && charge.approvalStatus !== 'rejected') {
                      <div class="dm-detail-row">
                        <span class="dm-detail-icon"><i class="fas fa-check"></i></span>
                        <span>{{ charge.approvalStatus === 'approved' ? 'Paid' : 'Submitted' }} {{ charge.paidAt | date: 'MMM d, yyyy' : 'UTC' }}</span>
                        @if (charge.paymentMethod) { <span class="dm-detail-sep">·</span><span>{{ charge.paymentMethod }}</span> }
                      </div>
                    }
                    @if (charge.approvalStatus === 'rejected' && charge.adminNote) {
                      <div class="dm-detail-row dm-rejection-note">
                        <span class="dm-detail-icon"><i class="fas fa-info-circle"></i></span>
                        <span>{{ charge.adminNote }}</span>
                      </div>
                    }
                  </div>

                  <!-- Fee breakdown -->
                  @if (charge.breakdown) {
                    <div class="dm-breakdown">
                      @if ((charge.breakdown.withoutLightFee ?? 0) > 0) {
                        <div class="dm-bk-row">
                          <span>Court fee</span>
                          <span>{{ charge.breakdown.withoutLightFee | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      @if ((charge.breakdown.lightFee ?? 0) > 0) {
                        <div class="dm-bk-row">
                          <span>Lights</span>
                          <span>{{ charge.breakdown.lightFee | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      @if ((charge.breakdown.ballBoyFee ?? 0) > 0) {
                        <div class="dm-bk-row">
                          <span>Ball boy</span>
                          <span>{{ charge.breakdown.ballBoyFee | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      @if ((charge.breakdown.guestFee ?? 0) > 0) {
                        <div class="dm-bk-row">
                          <span>Guest fee</span>
                          <span>{{ charge.breakdown.guestFee | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      @if ((charge.breakdown.rentalFee ?? 0) > 0) {
                        <div class="dm-bk-row">
                          <span>Rentals</span>
                          <span>{{ charge.breakdown.rentalFee | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      @if ((charge.breakdown.convenienceFee ?? 0) > 0) {
                        <div class="dm-bk-row">
                          <span>Convenience fee</span>
                          <span>{{ charge.breakdown.convenienceFee | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      @for (ef of (charge.breakdown.extraFees ?? []); track ef.name) {
                        <div class="dm-bk-row">
                          <span>{{ ef.name }}</span>
                          <span>{{ ef.amount | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      @if ((charge.breakdown.coachingFee ?? 0) > 0) {
                        <div class="dm-bk-row">
                          <span>Coaching</span>
                          <span>{{ charge.breakdown.coachingFee | currency:'PHP':'symbol' }}</span>
                        </div>
                      }
                      <div class="dm-bk-total">
                        <span>Total</span>
                        <span>{{ charge.amount | currency:'PHP':'symbol' }}</span>
                      </div>
                    </div>
                  }

                  <div class="dm-charge-bottom">
                    <span class="dm-amount">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                    @if (charge.approvalStatus === 'pending') {
                      <div class="dm-pending-badge"><i class="fas fa-hourglass-half"></i> Pending</div>
                    } @else if (charge.approvalStatus === 'approved') {
                      <div class="dm-paid-badge"><i class="fas fa-check-circle"></i> Approved</div>
                    } @else if (charge.approvalStatus === 'rejected') {
                      <button class="dm-pay-btn dm-retry-btn-pay" [disabled]="payingChargeId === charge._id" (click)="openPaymentModal(charge)">Re-submit</button>
                    } @else if (charge.status === 'unpaid') {
                      <button class="dm-pay-btn" [disabled]="payingChargeId === charge._id" (click)="openPaymentModal(charge)">
                        @if (payingChargeId === charge._id) { <i class="fas fa-circle-notch fa-spin"></i> }
                        @else { Log Payment }
                      </button>
                    } @else {
                      <div class="dm-paid-badge"><i class="fas fa-check-circle"></i> Paid</div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
        <div class="dm-bottom-spacer"></div>
      </div>

      <!-- Payment Modal -->
      @if (showPaymentModal && selectedCharge) {
        <div class="dm-modal-overlay" (click)="closePaymentModal()">
          <div class="dm-modal" (click)="$event.stopPropagation()">
            <div class="dm-modal-header">
              <span class="dm-modal-title"><i class="far fa-credit-card"></i> Log Payment</span>
              <button class="dm-modal-close" (click)="closePaymentModal()"><i class="fas fa-times"></i></button>
            </div>

            <div class="dm-modal-body">
              @if (paymentSuccessful) {
                <div class="dm-success-state">
                  <div class="dm-success-icon"><i class="fas fa-hourglass-half"></i></div>
                  <h4>Payment Submitted!</h4>
                  <p>{{ selectedCharge.amount | currency: 'PHP' : 'symbol' }} via {{ selectedPaymentMethod }} is awaiting admin approval.</p>
                </div>
              } @else {
                <div class="dm-modal-charge-box">
                  @if (selectedCharge.chargeType === 'reservation' && selectedCharge.reservationId) {
                    <div class="dm-modal-detail">
                      <span class="dm-modal-detail-label">Court</span>
                      <span class="dm-modal-detail-value dm-court-label">Court {{ selectedCharge.reservationId.court }}</span>
                    </div>
                    <div class="dm-modal-detail">
                      <span class="dm-modal-detail-label">Date</span>
                      <span class="dm-modal-detail-value">{{ selectedCharge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                    </div>
                    @if (selectedCharge.reservationId.timeSlot) {
                      <div class="dm-modal-detail">
                        <span class="dm-modal-detail-label">Time</span>
                        <span class="dm-modal-detail-value">{{ formatTimeSlot(selectedCharge.reservationId.timeSlot, selectedCharge.reservationId.durationHours ?? 1) }}</span>
                      </div>
                    }
                  }
                </div>

                <div class="dm-amount-box">
                  <span class="dm-amount-label">Amount Due</span>
                  <span class="dm-amount-display">{{ selectedCharge.amount | currency: 'PHP' : 'symbol' }}</span>
                  @if ((selectedCharge.breakdown?.convenienceFee ?? 0) > 0) {
                    <span class="dm-amount-fee-note">includes {{ selectedCharge.breakdown?.convenienceFee | currency: 'PHP' : 'symbol' }} convenience fee</span>
                  }
                </div>

                <div class="dm-payment-methods">
                  <div class="dm-methods-label">Select Payment Method</div>
                  @for (method of paymentMethods; track method) {
                    <label class="dm-method-row" [class.selected]="selectedPaymentMethod === method">
                      <input type="radio" [value]="method" [(ngModel)]="selectedPaymentMethod" />
                      <span class="dm-method-icon">
                        @switch (method) {
                          @case ('GCash') { 📱 }
                          @case ('Cash') { 💵 }
                          @case ('Bank Transfer') { 🏦 }
                          @case ('GoTyme') { <img src="/goTyme.jpg" alt="GoTyme" class="dm-method-logo" /> }
                          @default { 💰 }
                        }
                      </span>
                      <span class="dm-method-name">{{ method }}</span>
                    </label>
                    @if (selectedPaymentMethod === method && paymentQrCodes[method]) {
                      <div class="dm-qr-block">
                        <div class="dm-qr-label">Scan to pay via {{ method }}</div>
                        <img [src]="paymentQrCodes[method]" alt="Payment QR Code" class="dm-qr-code" />
                      </div>
                    } @else if (selectedPaymentMethod === method && paymentAccounts[method]) {
                      <div class="dm-account-info">
                        @if (method === 'GoTyme') {
                          <img src="/goTyme.jpg" alt="GoTyme" class="dm-account-logo" />
                        }
                        <div>
                          <div class="dm-account-label">Send payment to</div>
                          <div class="dm-account-value">{{ paymentAccounts[method] }}</div>
                        </div>
                      </div>
                    }
                  }
                </div>

                <!-- Screenshot upload -->
                <div class="dm-screenshot-section">
                  <div class="dm-screenshot-label">
                    Payment Screenshot
                    @if (requirePaymentScreenshot) { <span class="dm-req">Required</span> }
                    @else { <span class="dm-opt">Optional</span> }
                  </div>
                  @if (paymentScreenshot) {
                    <div class="dm-screenshot-preview">
                      <img [src]="screenshotPreviewUrl" alt="Payment screenshot" class="dm-screenshot-img" />
                      <button type="button" class="dm-screenshot-remove" (click)="removeScreenshot()">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  } @else {
                    <label class="dm-screenshot-upload">
                      <input type="file" accept="image/*" (change)="onScreenshotChange($event)" />
                      <i class="fas fa-camera"></i>
                      <span>Tap to attach screenshot</span>
                    </label>
                  }
                </div>

                <div class="dm-modal-footer">
                  <button class="dm-modal-cancel" (click)="closePaymentModal()">Cancel</button>
                  <button class="dm-modal-submit" [disabled]="!selectedPaymentMethod || submittingPayment || (requirePaymentScreenshot && !paymentScreenshot)" (click)="submitPayment()">
                    @if (submittingPayment) { <i class="fas fa-circle-notch fa-spin"></i> Processing… }
                    @else { Confirm Payment }
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Bottom Nav -->
      <nav class="dm-bottom-nav">
        <button class="dm-nav-item" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-home"></i><span>Home</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i><span>Courts</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reservations')">
          <i class="far fa-calendar-check"></i><span>Bookings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/tournaments')">
          <i class="fas fa-medal"></i><span>Rankings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/profile/edit')">
          <i class="far fa-user"></i><span>Profile</span>
        </button>
      </nav>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin: -1.5rem;
      width: calc(100% + 3rem);
    }
    @media (min-width: 769px) {
      :host { margin: 0; width: 100%; }
    }

    .dm-shell {
      background: #0c1a11;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      max-width: 480px;
      margin: 0 auto;
      position: relative;
    }
    @media (min-width: 769px) {
      .dm-shell {
        max-width: 720px;
        height: auto;
        min-height: calc(100vh - 60px);
      }
    }

    /* Header */
    .dm-header {
      background: #111f16;
      padding: 1rem 1rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    @media (min-width: 769px) { .dm-header { display: none; } }

    .dm-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.7);
      width: 34px; height: 34px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
      transition: background 0.2s;
    }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }

    .dm-header-title {
      flex: 1;
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }

    .dm-header-balance {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .dm-balance-amount {
      font-size: 0.88rem;
      font-weight: 800;
      color: #f59e0b;
    }

    .dm-balance-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
    }

    /* Tabs */
    .dm-tabs {
      display: flex;
      background: #111f16;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .dm-tab {
      flex: 1;
      padding: 0.75rem 0.5rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: rgba(255,255,255,0.40);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }

    .dm-tab.active {
      color: #a3e635;
      border-bottom-color: #a3e635;
    }

    .dm-tab-badge {
      background: rgba(245,158,11,0.2);
      color: #f59e0b;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 10px;
    }

    .dm-tab-badge-green {
      background: rgba(163,230,53,0.15);
      color: #a3e635;
    }

    .dm-tab-badge-muted {
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.45);
    }

    /* Body */
    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 769px) {
      .dm-body {
        overflow-y: visible;
        padding: 1.5rem 2rem 2rem;
      }
    }

    .dm-state-msg {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.40);
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .dm-error-card {
      background: #1b3028;
      border-radius: 12px;
      padding: 2rem 1.5rem;
      text-align: center;
      color: #ef4444;
    }

    .dm-error-card i { font-size: 1.5rem; display: block; margin-bottom: 0.75rem; }
    .dm-error-card p { margin: 0 0 1rem; font-size: 0.88rem; }

    .dm-retry-btn {
      background: rgba(239,68,68,0.15);
      color: #ef4444;
      border: 1px solid rgba(239,68,68,0.3);
      padding: 0.5rem 1.25rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .dm-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.35);
    }

    .dm-empty i { font-size: 2rem; display: block; margin-bottom: 0.75rem; opacity: 0.4; }
    .dm-empty p { margin: 0; font-size: 0.88rem; }

    /* Charge cards */
    .dm-charges-list {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }

    .dm-charge-card {
      background: #1b3028;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      transition: background 0.2s;
    }

    .dm-charge-card:hover { background: #213830; }

    .dm-charge-accent {
      width: 4px;
      flex-shrink: 0;
    }

    .accent-amber { background: #f59e0b; }
    .accent-green { background: #a3e635; }
    .accent-red { background: #ef4444; }
    .accent-white { background: rgba(255,255,255,0.2); }

    .dm-charge-main {
      flex: 1;
      padding: 0.85rem 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }

    .dm-charge-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .dm-charge-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #ffffff;
    }

    .dm-status-chip {
      font-size: 0.62rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .chip-amber { background: rgba(245,158,11,0.18); color: #f59e0b; }
    .chip-green { background: rgba(163,230,53,0.15); color: #a3e635; }
    .chip-red { background: rgba(239,68,68,0.18); color: #ef4444; }

    .dm-charge-details {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .dm-detail-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      color: rgba(255,255,255,0.55);
    }

    .dm-detail-icon { color: rgba(255,255,255,0.35); font-size: 0.7rem; }
    .dm-detail-sep { color: rgba(255,255,255,0.25); }
    .dm-court-label { color: #a3e635; font-weight: 600; }

    .dm-rejection-note { color: #ef4444; }

    .dm-charge-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.25rem;
    }

    .dm-amount {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
    }

    .dm-paid-badge {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.78rem;
      font-weight: 700;
      color: #a3e635;
    }

    .dm-pending-badge {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.78rem;
      font-weight: 700;
      color: #f59e0b;
    }

    .dm-pay-btn {
      background: #a3e635;
      color: #0a1f00;
      border: none;
      border-radius: 20px;
      padding: 0.35rem 1rem;
      font-size: 0.78rem;
      font-weight: 800;
      cursor: pointer;
      transition: background 0.2s;
    }

    .dm-pay-btn:hover:not(:disabled) { background: #b8f040; }
    .dm-pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .dm-retry-btn-pay {
      background: rgba(245,158,11,0.2);
      color: #f59e0b;
      border: 1px solid rgba(245,158,11,0.3);
    }

    .dm-retry-btn-pay:hover:not(:disabled) {
      background: rgba(245,158,11,0.3);
    }

    /* Fee breakdown */
    .dm-breakdown {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      padding: 0.5rem 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.22rem;
    }
    .dm-bk-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: rgba(255,255,255,0.45);
    }
    .dm-bk-total {
      display: flex;
      justify-content: space-between;
      font-size: 0.82rem;
      font-weight: 800;
      color: #ffffff;
      border-top: 1px solid rgba(255,255,255,0.08);
      margin-top: 0.2rem;
      padding-top: 0.28rem;
    }

    /* Bottom spacer */
    .dm-bottom-spacer { height: 80px; }
    @media (min-width: 769px) { .dm-bottom-spacer { display: none; } }

    /* Modal */
    .dm-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 500;
    }
    @media (min-width: 769px) {
      .dm-modal-overlay { align-items: center; }
    }

    .dm-modal {
      background: #1b3028;
      border-radius: 20px 20px 0 0;
      width: 100%;
      max-width: 480px;
      max-height: 85vh;
      overflow-y: auto;
      animation: slideUp 0.25s ease-out;
    }
    @media (min-width: 769px) {
      .dm-modal {
        border-radius: 16px;
        max-height: 80vh;
      }
    }

    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .dm-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.1rem 1.25rem 0.9rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }

    .dm-modal-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dm-modal-close {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.5);
      width: 30px; height: 30px;
      border-radius: 8px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }

    .dm-modal-body { padding: 1.25rem; }

    .dm-success-state {
      text-align: center;
      padding: 2rem 1rem;
    }

    .dm-success-icon {
      font-size: 2.5rem;
      color: #a3e635;
      margin-bottom: 1rem;
    }

    .dm-success-state h4 {
      margin: 0 0 0.5rem;
      color: #ffffff;
      font-size: 1rem;
    }

    .dm-success-state p {
      margin: 0;
      color: rgba(255,255,255,0.55);
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .dm-modal-charge-box {
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dm-modal-detail {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.82rem;
    }

    .dm-modal-detail-label { color: rgba(255,255,255,0.45); }
    .dm-modal-detail-value { color: #ffffff; font-weight: 600; }

    .dm-amount-box {
      border: 1px solid rgba(163,230,53,0.25);
      border-radius: 12px;
      padding: 1.25rem;
      text-align: center;
      margin-bottom: 1.25rem;
    }

    .dm-amount-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      color: rgba(255,255,255,0.45);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.4rem;
    }

    .dm-amount-display {
      font-size: 2rem;
      font-weight: 800;
      color: #a3e635;
      letter-spacing: -0.5px;
    }

    .dm-amount-fee-note {
      display: block;
      font-size: 0.7rem;
      color: rgba(163,230,53,0.6);
      margin-top: 0.3rem;
    }

    .dm-payment-methods { margin-bottom: 1rem; }

    .dm-account-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(163,230,53,0.08);
      border: 1px solid rgba(163,230,53,0.25);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
    }
    .dm-account-logo { width: 36px; height: 36px; object-fit: contain; border-radius: 6px; flex-shrink: 0; }
    .dm-account-label { font-size: 0.72rem; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .dm-account-value { font-size: 1rem; font-weight: 700; color: #ffffff; }
    .dm-account-info-qr { justify-content: center; text-align: center; }
    .dm-qr-block {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(163,230,53,0.2);
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
      margin-bottom: 1rem;
    }
    .dm-qr-label { font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
    .dm-qr-code { display: block; width: 180px; height: 180px; object-fit: contain; border-radius: 10px; background: #fff; padding: 8px; margin: 0 auto; }

    .dm-methods-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: rgba(255,255,255,0.40);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.75rem;
    }

    .dm-method-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .dm-method-row input { display: none; }

    .dm-method-row.selected {
      border-color: rgba(163,230,53,0.4);
      background: rgba(163,230,53,0.08);
    }

    .dm-method-icon { font-size: 1.2rem; display: flex; align-items: center; }
    .dm-method-logo { width: 24px; height: 24px; object-fit: contain; border-radius: 4px; }

    .dm-method-name {
      font-size: 0.88rem;
      font-weight: 600;
      color: #ffffff;
    }

    .dm-modal-footer {
      display: flex;
      gap: 0.75rem;
      padding-top: 0.25rem;
    }

    .dm-modal-cancel {
      flex: 1;
      padding: 0.75rem;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7);
      border: none;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }

    .dm-modal-submit {
      flex: 2;
      padding: 0.75rem;
      background: #a3e635;
      color: #0a1f00;
      border: none;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }

    .dm-modal-submit:hover:not(:disabled) { background: #b8f040; }
    .dm-modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Screenshot upload */
    .dm-screenshot-section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    .dm-screenshot-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dm-req {
      font-size: 0.68rem;
      background: #f59e0b22;
      color: #f59e0b;
      border: 1px solid #f59e0b55;
      border-radius: 4px;
      padding: 1px 6px;
      font-weight: 700;
    }

    .dm-opt {
      font-size: 0.68rem;
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.35);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 4px;
      padding: 1px 6px;
      font-weight: 600;
    }

    .dm-screenshot-upload {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 1.2rem;
      background: rgba(255,255,255,0.04);
      border: 1.5px dashed rgba(255,255,255,0.15);
      border-radius: 10px;
      cursor: pointer;
      color: rgba(255,255,255,0.4);
      font-size: 0.82rem;
      transition: border-color 0.2s, background 0.2s;
    }
    .dm-screenshot-upload:hover { border-color: #a3e635; background: rgba(163,230,53,0.05); color: #a3e635; }
    .dm-screenshot-upload input { display: none; }
    .dm-screenshot-upload i { font-size: 1.4rem; }

    .dm-screenshot-preview {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
    }

    .dm-screenshot-img {
      width: 100%;
      max-height: 160px;
      object-fit: cover;
      display: block;
      border-radius: 10px;
    }

    .dm-screenshot-remove {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(0,0,0,0.6);
      border: none;
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.75rem;
    }

    /* Bottom nav */
    .dm-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: #111f16;
      border-top: 1px solid rgba(255,255,255,0.08);
      height: 62px;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: space-around;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }
    @media (min-width: 769px) { .dm-bottom-nav { display: none; } }

    .dm-nav-item {
      background: none;
      border: none;
      color: rgba(255,255,255,0.35);
      font-size: 0.6rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.4rem 0.75rem;
      transition: color 0.2s;
      font-family: inherit;
    }

    .dm-nav-item i { font-size: 1.1rem; }
    .dm-nav-item.dm-nav-active { color: #a3e635; }
  `],
})
export class PlayerPaymentsComponent implements OnInit, OnDestroy {
  charges: Charge[] = [];
  filteredCharges: Charge[] = [];
  filterTab: FilterTab = 'unpaid';
  loading = true;
  errorMessage: string | null = null;

  totals = {
    totalCharges: 0,
    totalUnsettled: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    unpaidCount: 0,
    paidCount: 0,
    pendingCount: 0,
  };

  showPaymentModal = false;
  selectedCharge: Charge | null = null;
  selectedPaymentMethod: string = '';
  paymentMethods: string[] = ['GCash', 'Cash', 'Bank Transfer'];
  paymentAccounts: Record<string, string> = {};
  paymentQrCodes: Record<string, string> = {};
  payingChargeId: string | null = null;
  submittingPayment = false;
  paymentSuccessful = false;
  requirePaymentScreenshot = false;
  paymentScreenshot: File | null = null;
  screenshotPreviewUrl: string | null = null;

  constructor(
    private chargesService: ChargesService,
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private clubService: ClubService,
    private cloudinaryService: CloudinaryService,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.loadCharges();
    this.loadClubPaymentMethods();
  }

  private loadClubPaymentMethods() {
    const clubId = this.clubService.getSelectedClubId() || this.auth.user()?.clubId;
    if (!clubId) return;
    this.clubService.getClub(clubId).subscribe({
      next: (club) => {
        if (club.paymentMethods && club.paymentMethods.length > 0) {
          this.paymentMethods = club.paymentMethods;
        }
        this.paymentAccounts = club.paymentAccounts ?? {};
        this.paymentQrCodes = club.paymentQrCodes ?? {};
        this.requirePaymentScreenshot = club.requirePaymentScreenshot ?? false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  loadCharges() {
    this.loading = true;
    this.errorMessage = null;
    console.log('PaymentsComponent: Starting loadCharges()');
    this.chargesService.getMyCharges().subscribe({
      next: (charges) => {
        console.log('PaymentsComponent: next() called with charges:', charges);
        this.charges = charges;
        this.totals = this.chargesService.calculateTotals(charges);
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
        console.log('PaymentsComponent: loading set to false');
      },
      error: (err) => {
        console.error('PaymentsComponent: error() called:', err);
        this.errorMessage = err.error?.error || err.message || 'Failed to load charges. Please check your connection.';
        this.loading = false;
        this.cdr.markForCheck();
      },
      complete: () => {
        console.log('PaymentsComponent: Observable complete()');
      }
    });
  }

  setFilterTab(tab: FilterTab) {
    this.filterTab = tab;
    this.applyFilter();
  }

  applyFilter() {
    switch (this.filterTab) {
      case 'unpaid':
        this.filteredCharges = this.charges.filter((c) => c.status === 'unpaid');
        break;
      case 'paid':
        this.filteredCharges = this.charges.filter((c) => c.status === 'paid');
        break;
      case 'all':
      default:
        this.filteredCharges = this.charges;
        break;
    }
  }

  getReserverName(charge: Charge): string {
    if (charge.guestName) return charge.guestName;
    if (charge.playerId && typeof charge.playerId === 'object') return (charge.playerId as any).name || '—';
    return '—';
  }

  formatTimeSlot(timeSlot: string | undefined, durationHours = 1): string {
    if (!timeSlot) return 'N/A';
    const match = timeSlot.match(/^(\d{1,2})([ap]m)$/i);
    if (!match) return timeSlot;
    const hour = parseInt(match[1], 10);
    const period = match[2].toLowerCase();
    let startH = period === 'am' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
    const endH = startH + durationHours;
    const fmt = (h: number) => {
      const p = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:00 ${p}`;
    };
    return `${fmt(startH)} - ${fmt(endH)}`;
  }

  openPaymentModal(charge: Charge) {
    this.selectedCharge = charge;
    this.selectedPaymentMethod = this.paymentMethods.length === 1 ? this.paymentMethods[0] : '';
    this.paymentScreenshot = null;
    this.screenshotPreviewUrl = null;
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedCharge = null;
    this.selectedPaymentMethod = '';
    this.paymentSuccessful = false;
    this.paymentScreenshot = null;
    this.screenshotPreviewUrl = null;
  }

  onScreenshotChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.paymentScreenshot = file;
    this.screenshotPreviewUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  removeScreenshot() {
    this.paymentScreenshot = null;
    this.screenshotPreviewUrl = null;
    this.cdr.markForCheck();
  }

  async submitPayment() {
    if (!this.selectedCharge || !this.selectedPaymentMethod) return;
    if (this.requirePaymentScreenshot && !this.paymentScreenshot) return;

    this.submittingPayment = true;
    this.payingChargeId = this.selectedCharge._id;

    let screenshotUrl: string | undefined;
    if (this.paymentScreenshot) {
      try {
        screenshotUrl = await this.cloudinaryService.uploadImage(this.paymentScreenshot, 'payment-screenshots');
      } catch {
        alert('Failed to upload payment screenshot. Please try again.');
        this.submittingPayment = false;
        this.payingChargeId = null;
        this.cdr.markForCheck();
        return;
      }
    }

    this.chargesService.markAsPaid(this.selectedCharge._id, this.selectedPaymentMethod as 'GCash' | 'Cash' | 'Bank Transfer' | 'GoTyme', screenshotUrl).subscribe({
      next: (res) => {
        if (res.charge) {
          const idx = this.charges.findIndex((c) => c._id === this.selectedCharge!._id);
          if (idx >= 0) this.charges[idx] = res.charge;
          this.totals = this.chargesService.calculateTotals(this.charges);
          this.applyFilter();
        }
        this.submittingPayment = false;
        this.payingChargeId = null;
        this.paymentSuccessful = true;
        this.cdr.markForCheck();
        setTimeout(() => { this.closePaymentModal(); }, 2000);
      },
      error: (err) => {
        console.error('Payment failed:', err);
        alert(`Failed to log payment: ${err.error?.error || err.error?.message || 'Please try again.'}`);
        this.submittingPayment = false;
        this.payingChargeId = null;
        this.cdr.markForCheck();
      },
    });
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
