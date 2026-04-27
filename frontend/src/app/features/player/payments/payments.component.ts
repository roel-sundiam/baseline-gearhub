import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';

type FilterTab = 'all' | 'unpaid' | 'paid';

@Component({
  selector: 'app-player-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
      <div class="page-card">
        <!-- Header -->
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <h2>Payment Card</h2>
          <div class="balance-summary" [class.all-clear]="totals.totalOutstanding === 0">
            <span class="balance-icon">{{ totals.totalOutstanding > 0 ? '⚠️' : '✅' }}</span>
            <div>
              <div class="balance-amount">
                {{ totals.totalOutstanding > 0 ? (totals.totalOutstanding | currency: 'PHP' : 'symbol') : 'All Paid' }}
              </div>
              <div class="balance-label">{{ totals.totalOutstanding > 0 ? 'Outstanding' : 'Balance' }}</div>
            </div>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="tabs">
          <button class="tab-btn" [class.active]="filterTab === 'unpaid'" (click)="setFilterTab('unpaid')">
            Unpaid
            <span class="tab-badge">{{ totals.unpaidCount }}</span>
          </button>
<button class="tab-btn" [class.active]="filterTab === 'paid'" (click)="setFilterTab('paid')">
            Paid
            <span class="tab-badge">{{ totals.paidCount }}</span>
          </button>
          <button class="tab-btn" [class.active]="filterTab === 'all'" (click)="setFilterTab('all')">
            All
            <span class="tab-badge">{{ totals.totalCharges }}</span>
          </button>
        </div>

        <!-- Main Content -->
        <div class="card-body">
          @if (loading) {
            <div class="loading">Loading your charges...</div>
          } @else if (errorMessage) {
            <div class="error-state">
              <span>❌</span>
              <p>{{ errorMessage }}</p>
              <button class="retry-btn" (click)="loadCharges()">Retry</button>
            </div>
          } @else if (filteredCharges.length === 0) {
            <div class="empty-state">
              <span>{{ filterTab === 'paid' ? '✅' : '💳' }}</span>
              <p>
                @if (filterTab === 'all') {
                  No charges yet. Book a court to create one!
                } @else if (filterTab === 'unpaid') {
                  All charges are paid! Great job.
                } @else {
                  No paid charges yet.
                }
              </p>
            </div>
          } @else {
            <div class="charges-list">
              @for (charge of filteredCharges; track charge._id) {
                <div class="charge-card" [class.paid]="charge.status === 'paid'">
                  <!-- Left Section: Info -->
                  <div class="charge-left">
                    <div class="charge-header">
                      <h4 class="charge-title">
                        @if (charge.chargeType === 'reservation') {
                          Court Reservation Fee
                        } @else {
                          Session Charge
                        }
                      </h4>
                      @if (charge.approvalStatus === 'pending') {
                        <span class="status-badge status-pending">AWAITING APPROVAL</span>
                      } @else if (charge.approvalStatus === 'approved') {
                        <span class="status-badge paid">APPROVED</span>
                      } @else if (charge.approvalStatus === 'rejected') {
                        <span class="status-badge status-rejected">REJECTED</span>
                      } @else {
                        <span class="status-badge" [class.unpaid]="charge.status === 'unpaid'" [class.paid]="charge.status === 'paid'">
                          {{ charge.status | uppercase }}
                        </span>
                      }
                    </div>

                    <!-- Date/Reference Info -->
                    <div class="charge-details">
                      @if (charge.chargeType === 'reservation' && charge.reservationId) {
                        <div class="detail-row">
                          <span class="detail-label">📅 Date:</span>
                          <span class="detail-value">{{ charge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                        </div>
                        @if (charge.reservationId.timeSlot) {
                          <div class="detail-row">
                            <span class="detail-label">⏰ Time:</span>
                            <span class="detail-value">{{ formatTimeSlot(charge.reservationId.timeSlot) }}</span>
                          </div>
                        }
                        <div class="detail-row">
                          <span class="detail-label">🏟️ Court:</span>
                          <span class="detail-value">Court {{ charge.reservationId.court }}</span>
                        </div>
                      } @else if (charge.chargeType === 'session' && charge.sessionId) {
                        <div class="detail-row">
                          <span class="detail-label">📅 Date:</span>
                          <span class="detail-value">{{ charge.sessionId.date | date: 'MMM d, yyyy' : 'UTC' }}</span>
                        </div>
                        <div class="detail-row">
                          <span class="detail-label">⏰ Time:</span>
                          <span class="detail-value">{{ charge.sessionId.startTime }}</span>
                        </div>
                      }

                      @if (charge.paidAt && charge.approvalStatus !== 'rejected') {
                        <div class="detail-row">
                          <span class="detail-label">{{ charge.approvalStatus === 'approved' ? '✅ Paid On:' : '📤 Submitted:' }}</span>
                          <span class="detail-value">{{ charge.paidAt | date: 'MMM d, yyyy' : 'UTC' }}</span>
                        </div>
                      }
                      @if (charge.paymentMethod && charge.approvalStatus !== 'rejected') {
                        <div class="detail-row">
                          <span class="detail-label">💳 Method:</span>
                          <span class="detail-value">{{ charge.paymentMethod }}</span>
                        </div>
                      }
                      @if (charge.approvalStatus === 'rejected' && charge.adminNote) {
                        <div class="detail-row rejection-note">
                          <span class="detail-label">📝 Note:</span>
                          <span class="detail-value">{{ charge.adminNote }}</span>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Right Section: Amount & Action -->
                  <div class="charge-right">
                    <div class="charge-amount">
                      <span class="amount-label">Amount</span>
                      <span class="amount-value">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                    </div>

                    @if (charge.approvalStatus === 'pending') {
                      <div class="pending-badge">
                        <i class="fas fa-hourglass-half"></i>
                        Pending
                      </div>
                    } @else if (charge.approvalStatus === 'approved') {
                      <div class="paid-badge">
                        <i class="fas fa-check-circle"></i>
                        Approved
                      </div>
                    } @else if (charge.approvalStatus === 'rejected') {
                      <button
                        class="pay-btn pay-btn-retry"
                        [disabled]="payingChargeId === charge._id"
                        (click)="openPaymentModal(charge)"
                      >
                        Re-submit
                      </button>
                    } @else if (charge.status === 'unpaid') {
                      <button
                        class="pay-btn"
                        [disabled]="payingChargeId === charge._id"
                        (click)="openPaymentModal(charge)"
                      >
                        @if (payingChargeId === charge._id) {
                          <i class="fas fa-circle-notch fa-spin"></i>
                        } @else {
                          Log Payment
                        }
                      </button>
                    } @else {
                      <div class="paid-badge">
                        <i class="fas fa-check-circle"></i>
                        Paid
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Payment Modal -->
      @if (showPaymentModal && selectedCharge) {
        <div class="modal-overlay" (click)="closePaymentModal()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>💳 Log Payment</h3>
              <button class="close-btn" (click)="closePaymentModal()">✕</button>
            </div>

            <div class="modal-body">
              <!-- Success Status -->
              @if (paymentSuccessful) {
                <div class="success-status">
                  <div class="success-icon">⏳</div>
                  <div class="success-message">
                    <h4>Payment Submitted!</h4>
                    <p>Your payment of {{ selectedCharge.amount | currency: 'PHP' : 'symbol' }} via {{ selectedPaymentMethod }} has been submitted and is awaiting admin approval.</p>
                  </div>
                </div>
              } @else {
              <!-- Charge Details -->
              <div class="charge-details-box">
                <div class="charge-detail-item">
                  <span class="detail-icon">🏟️</span>
                  <div>
                    <div class="detail-label">Type</div>
                    <div class="detail-value">
                      @if (selectedCharge.chargeType === 'reservation') {
                        Court Reservation
                      } @else {
                        Session Charge
                      }
                    </div>
                  </div>
                </div>
                
                @if (selectedCharge.chargeType === 'reservation' && selectedCharge.reservationId) {
                  <div class="charge-detail-item">
                    <span class="detail-icon">📅</span>
                    <div>
                      <div class="detail-label">Date</div>
                      <div class="detail-value">{{ selectedCharge.reservationId.date | date: 'MMM d, yyyy' : 'UTC' }}</div>
                    </div>
                  </div>
                  @if (selectedCharge.reservationId.timeSlot) {
                    <div class="charge-detail-item">
                      <span class="detail-icon">⏰</span>
                      <div>
                        <div class="detail-label">Time</div>
                        <div class="detail-value">{{ formatTimeSlot(selectedCharge.reservationId.timeSlot) }}</div>
                      </div>
                    </div>
                  }
                }
              </div>

              <!-- Amount Display -->
              <div class="amount-box">
                <div class="amount-label">Amount Due</div>
                <div class="amount-display">{{ selectedCharge.amount | currency: 'PHP' : 'symbol' }}</div>
              </div>

              <!-- Payment Method Selection -->
              <div class="form-group">
                <label class="form-label">
                  <span class="label-icon">💰</span>
                  Select Payment Method
                </label>
                <div class="radio-group">
                  @for (method of paymentMethods; track method) {
                    <label class="radio-label" [class.selected]="selectedPaymentMethod === method">
                      <input
                        type="radio"
                        [value]="method"
                        [(ngModel)]="selectedPaymentMethod"
                      />
                      <div class="method-content">
                        <span class="method-icon">
                          @switch (method) {
                            @case ('GCash') { 📱 }
                            @case ('Cash') { 💵 }
                            @case ('Bank Transfer') { 🏦 }
                          }
                        </span>
                        <div class="method-info">
                          <span class="method-name">{{ method }}</span>
                          <span class="method-desc">
                            @switch (method) {
                              @case ('GCash') { Mobile payment }
                              @case ('Cash') { Physical payment }
                              @case ('Bank Transfer') { Bank deposit }
                            }
                          </span>
                        </div>
                      </div>
                    </label>
                  }
                </div>
              </div>
              }

              <!-- Footer -->
              @if (!paymentSuccessful) {
                <div class="modal-footer">
                  <button class="btn-cancel" (click)="closePaymentModal()">Cancel</button>
                  <button
                    class="btn-submit"
                    [disabled]="!selectedPaymentMethod || submittingPayment"
                    (click)="submitPayment()"
                  >
                    @if (submittingPayment) {
                      <i class="fas fa-circle-notch fa-spin"></i>
                      Processing...
                    } @else {
                      ✓ Confirm & Log Payment
                    }
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-wrap {
      position: relative;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
    }

    .court-bg {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect fill="%23f0f0f0" width="1200" height="800"/></svg>');
      z-index: 0;
    }

    .court-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
    }

    .page-card {
      position: relative;
      z-index: 1;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      max-width: 800px;
      margin: 0 auto;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px;
      border-bottom: 1px solid #eee;
      gap: 20px;
    }

    .back-btn {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 8px 12px;
      border-radius: 4px;
      transition: background 0.2s;
      white-space: nowrap;
    }

    .back-btn:hover {
      background: #f0f0f0;
    }

    .card-header h2 {
      margin: 0;
      flex: 1;
      font-size: 24px;
      color: #333;
    }

    .balance-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: #fff3cd;
      border-radius: 8px;
      min-width: 160px;
    }

    .balance-summary.all-clear {
      background: #d4edda;
    }

    .balance-icon {
      font-size: 20px;
    }

    .balance-amount {
      font-size: 16px;
      font-weight: bold;
      color: #333;
    }

    .balance-label {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid #eee;
      padding: 0 24px;
    }

    .tab-btn {
      flex: 1;
      padding: 16px 0;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #999;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .tab-btn.active {
      color: #b88942;
      border-bottom-color: #b88942;
    }

    .tab-btn:hover {
      color: #b88942;
    }

    .tab-badge {
      background: #b88942;
      color: white;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
    }


    .card-body {
      padding: 24px;
    }

    .loading, .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }

    .empty-state span {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
    }

    .empty-state p {
      margin: 0;
      color: #666;
    }

    .error-state {
      text-align: center;
      padding: 40px 20px;
      color: #dc3545;
    }

    .error-state span {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
    }

    .error-state p {
      margin: 0 0 16px 0;
      color: #dc3545;
    }

    .retry-btn {
      background: #dc3545;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
    }

    .retry-btn:hover {
      background: #c82333;
    }

    .charges-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .charge-card {
      display: flex;
      gap: 20px;
      padding: 16px;
      border: 1px solid #eee;
      border-radius: 8px;
      background: #fafafa;
      transition: all 0.2s;
    }

    .charge-card:hover {
      border-color: #b88942;
      box-shadow: 0 2px 8px rgba(184, 137, 66, 0.1);
    }

    .charge-card.paid {
      background: #f0f9ff;
      border-color: #d4edda;
    }

    .charge-left {
      flex: 1;
    }

    .charge-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .charge-title {
      margin: 0;
      font-size: 16px;
      color: #333;
      font-weight: 600;
    }

    .status-badge {
      font-size: 11px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 4px;
      background: #fff3cd;
      color: #856404;
    }

    .status-badge.paid {
      background: #d4edda;
      color: #155724;
    }

    .status-pending {
      background: #fff3cd;
      color: #856404;
    }

    .status-rejected {
      background: #f8d7da;
      color: #721c24;
    }

    .rejection-note .detail-value {
      color: #dc3545;
      font-style: italic;
    }

    .charge-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
    }

    .detail-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .detail-label {
      color: #999;
      min-width: 80px;
    }

    .detail-value {
      color: #333;
      font-weight: 500;
    }

    .charge-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: space-between;
      min-width: 120px;
    }

    .charge-amount {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .amount-label {
      font-size: 12px;
      color: #999;
    }

    .amount-value {
      font-size: 20px;
      font-weight: bold;
      color: #b88942;
    }

    .pay-btn {
      background: #b88942;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .pay-btn:hover:not(:disabled) {
      background: #9f7338;
    }

    .pay-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .paid-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #28a745;
      font-weight: 600;
      font-size: 13px;
    }

    .pending-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #d97706;
      font-weight: 600;
      font-size: 13px;
    }

    .pay-btn-retry {
      background: #f59e0b;
    }

    .pay-btn-retry:hover:not(:disabled) {
      background: #d97706;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      max-width: 450px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
      background: linear-gradient(135deg, rgba(184, 137, 66, 0.05), rgba(159, 115, 56, 0.05));
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: #f0f0f0;
      color: #333;
    }

    .modal-body {
      padding: 24px;
    }

    .success-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 30px 20px;
      text-align: center;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .success-icon {
      font-size: 48px;
      animation: bounce 0.6s ease-out;
    }

    @keyframes bounce {
      0% {
        transform: scale(0.8);
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
      }
    }

    .success-message h4 {
      margin: 0 0 8px 0;
      color: #9f7338;
      font-size: 18px;
      font-weight: 700;
    }

    .success-message p {
      margin: 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .charge-details-box {
      background: linear-gradient(135deg, rgba(184, 137, 66, 0.08), rgba(159, 115, 56, 0.08));
      border-left: 4px solid #b88942;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .charge-detail-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .detail-icon {
      font-size: 20px;
      margin-top: 2px;
    }

    .detail-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .detail-value {
      font-size: 14px;
      color: #333;
      font-weight: 600;
      margin-top: 2px;
    }

    .amount-box {
      background: linear-gradient(135deg, rgba(184, 137, 66, 0.1), rgba(159, 115, 56, 0.1));
      border: 2px dashed #b88942;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      text-align: center;
    }

    .amount-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }

    .amount-display {
      font-size: 36px;
      font-weight: 700;
      color: #9f7338;
      letter-spacing: -1px;
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 14px;
      color: #333;
      letter-spacing: 0.2px;
    }

    .label-icon {
      font-size: 16px;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      padding: 14px;
      border: 2px solid #e8e8e8;
      border-radius: 8px;
      transition: all 0.2s ease;
      background: white;
    }

    .radio-label:hover {
      border-color: #b88942;
      background: #f9fef8;
    }

    .radio-label.selected {
      border-color: #b88942;
      background: linear-gradient(135deg, rgba(184, 137, 66, 0.06), rgba(159, 115, 56, 0.06));
      box-shadow: inset 0 0 0 1px rgba(184, 137, 66, 0.1);
    }

    .radio-label input[type="radio"] {
      cursor: pointer;
      accent-color: #b88942;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .method-content {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
    }

    .method-icon {
      font-size: 24px;
    }

    .method-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .method-name {
      font-size: 14px;
      font-weight: 700;
      color: #333;
    }

    .method-desc {
      font-size: 12px;
      color: #999;
    }

    .modal-footer {
      display: flex;
      gap: 12px;
      padding: 20px;
      border-top: 1px solid #e8e8e8;
      background: #fafafa;
    }

    .btn-cancel, .btn-submit {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-cancel {
      background: #f0f0f0;
      color: #333;
    }

    .btn-cancel:hover {
      background: #e0e0e0;
      transform: translateY(-1px);
    }

    .btn-submit {
      background: linear-gradient(135deg, #b88942 0%, #9f7338 100%);
      color: white;
    }

    .btn-submit:hover:not(:disabled) {
      background: linear-gradient(135deg, #9f7338 0%, #1f6939 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(184, 137, 66, 0.3);
    }

    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 600px) {
      .card-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .charge-card {
        flex-direction: column;
      }

      .charge-right {
        align-items: flex-start;
      }

      .modal-content {
        width: 95%;
      }
    }
  `,
  ],
})
export class PlayerPaymentsComponent implements OnInit {
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

  // Payment modal
  showPaymentModal = false;
  selectedCharge: Charge | null = null;
  selectedPaymentMethod: 'GCash' | 'Cash' | 'Bank Transfer' | '' = '';
  paymentMethods: Array<'GCash' | 'Cash' | 'Bank Transfer'> = ['GCash', 'Cash', 'Bank Transfer'];
  payingChargeId: string | null = null;
  submittingPayment = false;
  paymentSuccessful = false;

  constructor(
    private chargesService: ChargesService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadCharges();
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

  formatTimeSlot(timeSlot: string | undefined): string {
    // Guard against undefined/null timeSlot
    if (!timeSlot) return 'N/A';

    // Parse timeSlot like "6am" or "6pm"
    const match = timeSlot.match(/^(\d{1,2})([ap]m)$/i);
    if (!match) return timeSlot;

    const hour = parseInt(match[1], 10);
    const period = match[2].toLowerCase();
    
    // Format start time
    const startTime = hour === 12 || hour < 10 ? `${hour}:00` : `${hour}:00`;
    const startPeriod = period === 'am' ? 'AM' : 'PM';
    
    // Calculate end hour
    let endHour = hour + 1;
    let endPeriod = period;
    
    if (hour === 12) {
      endHour = 1;
      endPeriod = period === 'am' ? 'am' : 'pm';
    } else if (endHour === 12 || endHour === 24) {
      endPeriod = period === 'am' ? 'pm' : 'am';
    }
    if (endHour > 12) {
      endHour = endHour - 12;
    }
    
    const endTime = `${endHour}:00`;
    const endPeriodFormatted = endPeriod === 'am' ? 'AM' : 'PM';
    
    return `${startTime} ${startPeriod} - ${endTime} ${endPeriodFormatted}`;
  }

  openPaymentModal(charge: Charge) {
    this.selectedCharge = charge;
    this.selectedPaymentMethod = '';
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedCharge = null;
    this.selectedPaymentMethod = '';
    this.paymentSuccessful = false;
  }

  submitPayment() {
    if (!this.selectedCharge || !this.selectedPaymentMethod) return;

    this.submittingPayment = true;
    this.payingChargeId = this.selectedCharge._id;

    console.log('Submitting payment for charge:', this.selectedCharge._id, 'Method:', this.selectedPaymentMethod);

    this.chargesService.markAsPaid(this.selectedCharge._id, this.selectedPaymentMethod).subscribe({
      next: (res) => {
        console.log('Payment successful:', res);
        // Update the charge in the list
        if (res.charge) {
          const idx = this.charges.findIndex((c) => c._id === this.selectedCharge!._id);
          if (idx >= 0) {
            this.charges[idx] = res.charge;
          }
          this.totals = this.chargesService.calculateTotals(this.charges);
          this.applyFilter();
        }
        this.submittingPayment = false;
        this.payingChargeId = null;
        this.paymentSuccessful = true;
        this.cdr.markForCheck();

        // Auto-close modal after 2 seconds
        setTimeout(() => {
          this.closePaymentModal();
        }, 2000);
      },
      error: (err) => {
        console.error('Payment failed:', err);
        console.error('Error response:', err.error);
        console.error('Error status:', err.status);
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

