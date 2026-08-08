import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService } from '../../../core/services/club.service';
import { ClubLedgerService } from '../../../core/services/club-ledger.service';
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
                    <th class="col-right">Hosted Play Fees</th>
                    <th class="col-right" title="Convenience fees only — Finance Report add-on billing is shown separately below">Conv. Fee Owed</th>
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
                      <td class="col-right col-orange">{{ club.totalHostedPlaySessionFees | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="col-right col-blue">{{ club.convenienceFeesOwed | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
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
                    <td class="col-right foot-orange">{{ totalHostedPlaySessionFees | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    <td class="col-right foot-blue">{{ totals.convenienceFeesOwed | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
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

          <!-- Finance Report Add-on -->
          <div class="section-header payments-section-header">
            <i class="fas fa-chart-line section-icon"></i>
            <h3 class="section-title">Finance Report Add-on</h3>
            <span class="section-note">Premium income &amp; expense reports — billed monthly per club</span>
            <button class="btn-view-reports" (click)="viewAllReports()">
              <i class="fas fa-magnifying-glass-chart"></i> View All Reports
            </button>
          </div>

          <div class="addon-default-bar">
            <span class="addon-default-label">Default price</span>
            <input
              type="number"
              class="fee-rate-input"
              [(ngModel)]="globalFeeValue"
              min="0" step="1"
              style="width:90px"
            />
            <span class="fee-rate-pct">₱ / month</span>
            <button class="btn-fee-save" (click)="saveGlobalFee()" [disabled]="savingGlobalFee">
              @if (savingGlobalFee) { <i class="fas fa-circle-notch fa-spin"></i> }
              @else { <i class="fas fa-check"></i> Save }
            </button>
            @if (globalFeeSaved) {
              <span class="addon-saved-note"><i class="fas fa-check-circle"></i> Saved</span>
            }
          </div>

          <div class="clubs-table-wrap">
            <table class="clubs-table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th class="col-center">Status</th>
                  <th class="col-center">Monthly Fee</th>
                  <th class="col-right" title="Total Finance Report add-on billing to date — kept separate from Conv. Fee Owed above">Fees Billed</th>
                  <th class="col-center">Report</th>
                </tr>
              </thead>
              <tbody>
                @for (club of clubs; track club.clubId) {
                  <tr>
                    <td class="col-club">{{ club.clubName }}</td>
                    <td class="col-center">
                      @if (club.financeReportEnabled) {
                        <span class="status-chip status-paid">
                          <i class="fas fa-crown"></i>
                          Subscribed{{ club.financeReportSubscribedAt ? ' · ' + (club.financeReportSubscribedAt | date: 'MMM d, y') : '' }}
                        </span>
                      } @else {
                        <span class="col-muted">—</span>
                      }
                    </td>
                    <td class="col-center">
                      <div class="fee-rate-cell">
                        @if (editingAddonFeeClubId === club.clubId) {
                          <input
                            type="number"
                            class="fee-rate-input"
                            [(ngModel)]="editingAddonFeeValue"
                            min="0" step="1"
                            style="width:80px"
                          />
                          <button class="btn-fee-save" (click)="saveAddonFee(club)" [disabled]="savingAddonFee">
                            @if (savingAddonFee) { <i class="fas fa-circle-notch fa-spin"></i> }
                            @else { <i class="fas fa-check"></i> }
                          </button>
                          @if (club.financeReportFeeOverride != null) {
                            <button class="btn-fee-cancel" title="Reset to default" (click)="resetAddonFee(club)" [disabled]="savingAddonFee">
                              <i class="fas fa-rotate-left"></i>
                            </button>
                          }
                          <button class="btn-fee-cancel" (click)="cancelAddonFee()"><i class="fas fa-times"></i></button>
                        } @else {
                          <span class="fee-rate-badge">
                            {{ club.financeReportMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}/mo
                            @if (club.financeReportFeeOverride != null) {
                              <span class="override-tag">override</span>
                            }
                          </span>
                          <button class="btn-fee-edit" (click)="startEditAddonFee(club)" title="Edit add-on fee">
                            <i class="fas fa-pen"></i>
                          </button>
                        }
                      </div>
                    </td>
                    <td class="col-right col-blue">{{ club.financeReportFeesBilled | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    <td class="col-center">
                      <button class="btn-waive" (click)="viewReport(club)">
                        <i class="fas fa-chart-pie"></i> View
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td class="foot-label">Total</td>
                  <td></td>
                  <td></td>
                  <td class="col-right foot-blue">{{ totals.financeReportFeesBilled | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Email Confirmations Add-on -->
          <div class="section-header payments-section-header">
            <i class="fas fa-envelope-circle-check section-icon"></i>
            <h3 class="section-title">Email Confirmations Add-on</h3>
            <span class="section-note">Booking confirmation emails — billed monthly per club</span>
          </div>

          <div class="addon-default-bar">
            <span class="addon-default-label">Default price</span>
            <input
              type="number"
              class="fee-rate-input"
              [(ngModel)]="emailGlobalFeeValue"
              min="0" step="1"
              style="width:90px"
            />
            <span class="fee-rate-pct">₱ / month</span>
            <button class="btn-fee-save" (click)="saveEmailGlobalFee()" [disabled]="savingEmailGlobalFee">
              @if (savingEmailGlobalFee) { <i class="fas fa-circle-notch fa-spin"></i> }
              @else { <i class="fas fa-check"></i> Save }
            </button>
            @if (emailGlobalFeeSaved) {
              <span class="addon-saved-note"><i class="fas fa-check-circle"></i> Saved</span>
            }
          </div>

          <div class="clubs-table-wrap">
            <table class="clubs-table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th class="col-center">Status</th>
                  <th class="col-center">Monthly Fee</th>
                  <th class="col-right" title="Total Email Confirmations add-on billing to date — kept separate from Conv. Fee Owed above">Fees Billed</th>
                </tr>
              </thead>
              <tbody>
                @for (club of clubs; track club.clubId) {
                  <tr>
                    <td class="col-club">{{ club.clubName }}</td>
                    <td class="col-center">
                      @if (club.emailConfirmationsEnabled) {
                        <span class="status-chip status-paid">
                          <i class="fas fa-crown"></i>
                          Subscribed{{ club.emailConfirmationsSubscribedAt ? ' · ' + (club.emailConfirmationsSubscribedAt | date: 'MMM d, y') : '' }}
                        </span>
                      } @else {
                        <span class="col-muted">—</span>
                      }
                    </td>
                    <td class="col-center">
                      <div class="fee-rate-cell">
                        @if (editingEmailAddonFeeClubId === club.clubId) {
                          <input
                            type="number"
                            class="fee-rate-input"
                            [(ngModel)]="editingEmailAddonFeeValue"
                            min="0" step="1"
                            style="width:80px"
                          />
                          <button class="btn-fee-save" (click)="saveEmailAddonFee(club)" [disabled]="savingEmailAddonFee">
                            @if (savingEmailAddonFee) { <i class="fas fa-circle-notch fa-spin"></i> }
                            @else { <i class="fas fa-check"></i> }
                          </button>
                          @if (club.emailConfirmationsFeeOverride != null) {
                            <button class="btn-fee-cancel" title="Reset to default" (click)="resetEmailAddonFee(club)" [disabled]="savingEmailAddonFee">
                              <i class="fas fa-rotate-left"></i>
                            </button>
                          }
                          <button class="btn-fee-cancel" (click)="cancelEmailAddonFee()"><i class="fas fa-times"></i></button>
                        } @else {
                          <span class="fee-rate-badge">
                            {{ club.emailConfirmationsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}/mo
                            @if (club.emailConfirmationsFeeOverride != null) {
                              <span class="override-tag">override</span>
                            }
                          </span>
                          <button class="btn-fee-edit" (click)="startEditEmailAddonFee(club)" title="Edit add-on fee">
                            <i class="fas fa-pen"></i>
                          </button>
                        }
                      </div>
                    </td>
                    <td class="col-right col-blue">{{ club.emailConfirmationsFeesBilled | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td class="foot-label">Total</td>
                  <td></td>
                  <td></td>
                  <td class="col-right foot-blue">{{ totals.emailConfirmationsFeesBilled | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Advanced Analytics Add-on -->
          <div class="section-header payments-section-header">
            <i class="fas fa-chart-pie section-icon"></i>
            <h3 class="section-title">Advanced Analytics &amp; Reports Add-on</h3>
            <span class="section-note">Booking/revenue analytics &amp; reports — billed monthly per club</span>
            <button class="btn-view-reports" (click)="viewAllAnalytics()">
              <i class="fas fa-magnifying-glass-chart"></i> View All Analytics
            </button>
          </div>

          <div class="addon-default-bar">
            <span class="addon-default-label">Default price</span>
            <input
              type="number"
              class="fee-rate-input"
              [(ngModel)]="advancedAnalyticsGlobalFeeValue"
              min="0" step="1"
              style="width:90px"
            />
            <span class="fee-rate-pct">₱ / month</span>
            <button class="btn-fee-save" (click)="saveAdvancedAnalyticsGlobalFee()" [disabled]="savingAdvancedAnalyticsGlobalFee">
              @if (savingAdvancedAnalyticsGlobalFee) { <i class="fas fa-circle-notch fa-spin"></i> }
              @else { <i class="fas fa-check"></i> Save }
            </button>
            @if (advancedAnalyticsGlobalFeeSaved) {
              <span class="addon-saved-note"><i class="fas fa-check-circle"></i> Saved</span>
            }
          </div>

          <div class="clubs-table-wrap">
            <table class="clubs-table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th class="col-center">Status</th>
                  <th class="col-center">Monthly Fee</th>
                  <th class="col-right" title="Total Advanced Analytics add-on billing to date — kept separate from Conv. Fee Owed above">Fees Billed</th>
                  <th class="col-center">Analytics</th>
                </tr>
              </thead>
              <tbody>
                @for (club of clubs; track club.clubId) {
                  <tr>
                    <td class="col-club">{{ club.clubName }}</td>
                    <td class="col-center">
                      @if (club.advancedAnalyticsEnabled) {
                        <span class="status-chip status-paid">
                          <i class="fas fa-crown"></i>
                          Subscribed{{ club.advancedAnalyticsSubscribedAt ? ' · ' + (club.advancedAnalyticsSubscribedAt | date: 'MMM d, y') : '' }}
                        </span>
                      } @else {
                        <span class="col-muted">—</span>
                      }
                    </td>
                    <td class="col-center">
                      <div class="fee-rate-cell">
                        @if (editingAdvancedAnalyticsFeeClubId === club.clubId) {
                          <input
                            type="number"
                            class="fee-rate-input"
                            [(ngModel)]="editingAdvancedAnalyticsFeeValue"
                            min="0" step="1"
                            style="width:80px"
                          />
                          <button class="btn-fee-save" (click)="saveAdvancedAnalyticsFee(club)" [disabled]="savingAdvancedAnalyticsFee">
                            @if (savingAdvancedAnalyticsFee) { <i class="fas fa-circle-notch fa-spin"></i> }
                            @else { <i class="fas fa-check"></i> }
                          </button>
                          @if (club.advancedAnalyticsFeeOverride != null) {
                            <button class="btn-fee-cancel" title="Reset to default" (click)="resetAdvancedAnalyticsFee(club)" [disabled]="savingAdvancedAnalyticsFee">
                              <i class="fas fa-rotate-left"></i>
                            </button>
                          }
                          <button class="btn-fee-cancel" (click)="cancelAdvancedAnalyticsFee()"><i class="fas fa-times"></i></button>
                        } @else {
                          <span class="fee-rate-badge">
                            {{ club.advancedAnalyticsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}/mo
                            @if (club.advancedAnalyticsFeeOverride != null) {
                              <span class="override-tag">override</span>
                            }
                          </span>
                          <button class="btn-fee-edit" (click)="startEditAdvancedAnalyticsFee(club)" title="Edit add-on fee">
                            <i class="fas fa-pen"></i>
                          </button>
                        }
                      </div>
                    </td>
                    <td class="col-right col-blue">{{ club.advancedAnalyticsFeesBilled | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    <td class="col-center">
                      <button class="btn-waive" (click)="viewAnalytics(club)">
                        <i class="fas fa-chart-pie"></i> View
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td class="foot-label">Total</td>
                  <td></td>
                  <td></td>
                  <td class="col-right foot-blue">{{ totals.advancedAnalyticsFeesBilled | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Member Activation Fee -->
          <div class="section-header payments-section-header">
            <i class="fas fa-user-plus section-icon"></i>
            <h3 class="section-title">Member Activation Fee</h3>
            <span class="section-note">One-time fee per club for each approved member beyond the free tier</span>
          </div>

          <div class="addon-default-bar">
            <span class="addon-default-label">Free members</span>
            <input
              type="number"
              class="fee-rate-input"
              [(ngModel)]="memberFreeTierCountValue"
              min="0" step="1"
              style="width:70px"
            />
            <span class="addon-default-label">Fee after that</span>
            <input
              type="number"
              class="fee-rate-input"
              [(ngModel)]="memberActivationFeeValue"
              min="0" step="1"
              style="width:90px"
            />
            <span class="fee-rate-pct">₱ / member</span>
            <button class="btn-fee-save" (click)="saveMemberActivationFee()" [disabled]="savingMemberActivationFee">
              @if (savingMemberActivationFee) { <i class="fas fa-circle-notch fa-spin"></i> }
              @else { <i class="fas fa-check"></i> Save }
            </button>
            @if (memberActivationFeeSaved) {
              <span class="addon-saved-note"><i class="fas fa-check-circle"></i> Saved</span>
            }
          </div>

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
                    <th>Proof</th>
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
                      <td>
                        @if (p.paymentScreenshot) {
                          <a class="proof-link" [href]="p.paymentScreenshot" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-image"></i> View
                          </a>
                        } @else {
                          <span class="muted-dash">—</span>
                        }
                      </td>
                      <td class="col-right col-amount" [class.col-waived]="p.type === 'waiver'">
                        {{ p.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="6" class="foot-label">Total ({{ payments.length }} entries)</td>
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
    .btn-view-reports {
      margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 700;
      background: rgba(250,204,21,0.14); color: #facc15; border: 1px solid rgba(250,204,21,0.32);
      cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    .btn-view-reports:hover { background: rgba(250,204,21,0.26); }

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
    .col-orange { color: #fdba74; font-weight: 600; }
    .col-purple { color: #c4b5fd; font-weight: 600; }
    .col-red { color: #fca5a5; font-weight: 700; }

    tfoot td { padding: 12px 14px; background: rgba(255,255,255,0.04); border-top: 1px solid rgba(255,255,255,0.08); }
    .foot-label { color: rgba(255,255,255,0.65); font-size: 0.8rem; font-weight: 600; }
    .foot-muted { color: rgba(255,255,255,0.4); text-align: right; }
    .foot-blue { color: #93c5fd; font-weight: 700; text-align: right; }
    .foot-green { color: var(--dm-accent); font-weight: 700; text-align: right; }
    .foot-orange { color: #fdba74; font-weight: 700; text-align: right; }
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
    .proof-link {
      display: inline-flex; align-items: center; gap: 5px;
      color: #93c5fd; font-size: 0.78rem; font-weight: 700; text-decoration: none;
    }
    .proof-link:hover { text-decoration: underline; }
    .muted-dash { color: rgba(255,255,255,0.32); }
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

    /* Finance Report Add-on */
    .addon-default-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin: 0 24px 14px; padding: 10px 14px; border-radius: 10px;
      background: rgba(250,204,21,0.06); border: 1px solid rgba(250,204,21,0.18);
    }
    .addon-default-label {
      font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .addon-saved-note { color: var(--dm-accent); font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; }
    .override-tag {
      font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px;
      background: rgba(250,204,21,0.16); color: #fde047;
      border-radius: 8px; padding: 1px 6px; margin-left: 5px;
    }

    @media (max-width: 700px) {
      .clubs-table-wrap, .table-wrap { padding: 0 12px 20px; }
      .summary-bar { padding: 16px 12px; }
      .section-header { padding: 16px 12px 10px; }
      .addon-default-bar { margin: 0 12px 14px; }
    }
  `],
})
export class DevFinanceComponent implements OnInit {
  clubs: ClubServiceSummary[] = [];
  totals: ServiceSummaryTotals = { feesOwed: 0, totalPaid: 0, totalWaived: 0, outstanding: 0, convenienceFeesOwed: 0, financeReportFeesBilled: 0, emailConfirmationsFeesBilled: 0, advancedAnalyticsFeesBilled: 0 };
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

  globalFeeValue = 0;
  savingGlobalFee = false;
  globalFeeSaved = false;
  editingAddonFeeClubId: string | null = null;
  editingAddonFeeValue = 0;
  savingAddonFee = false;

  emailGlobalFeeValue = 0;
  savingEmailGlobalFee = false;
  emailGlobalFeeSaved = false;
  editingEmailAddonFeeClubId: string | null = null;
  editingEmailAddonFeeValue = 0;
  savingEmailAddonFee = false;

  advancedAnalyticsGlobalFeeValue = 0;
  savingAdvancedAnalyticsGlobalFee = false;
  advancedAnalyticsGlobalFeeSaved = false;
  editingAdvancedAnalyticsFeeClubId: string | null = null;
  editingAdvancedAnalyticsFeeValue = 0;
  savingAdvancedAnalyticsFee = false;

  memberActivationFeeValue = 0;
  memberFreeTierCountValue = 0;
  savingMemberActivationFee = false;
  memberActivationFeeSaved = false;

  get outstandingClubCount() { return this.clubs.filter(c => c.balance > 0).length; }
  get totalPaymentsSum() { return this.payments.reduce((s, p) => s + p.amount, 0); }
  get totalHostedPlaySessionFees() { return this.clubs.reduce((s, c) => s + (c.totalHostedPlaySessionFees ?? 0), 0); }

  constructor(
    private auth: AuthService,
    private appServicePaymentsService: AppServicePaymentsService,
    private clubService: ClubService,
    private clubLedgerService: ClubLedgerService,
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
      globalFee: this.clubLedgerService.getGlobalFee(),
      emailGlobalFee: this.clubLedgerService.getGlobalEmailConfirmationsFee(),
      advancedAnalyticsGlobalFee: this.clubLedgerService.getGlobalAdvancedAnalyticsFee(),
      memberActivationFee: this.clubLedgerService.getMemberActivationFee(),
    }).subscribe({
      next: ({ summary, payments, globalFee, emailGlobalFee, advancedAnalyticsGlobalFee, memberActivationFee }) => {
        this.clubs = summary.clubs;
        this.totals = summary.totals;
        this.payments = payments;
        this.globalFeeValue = globalFee.financeReportMonthlyFee;
        this.emailGlobalFeeValue = emailGlobalFee.emailConfirmationsMonthlyFee;
        this.advancedAnalyticsGlobalFeeValue = advancedAnalyticsGlobalFee.advancedAnalyticsMonthlyFee;
        this.memberActivationFeeValue = memberActivationFee.memberActivationFee;
        this.memberFreeTierCountValue = memberActivationFee.memberFreeTierCount;
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

  saveGlobalFee() {
    const amount = Number(this.globalFeeValue);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingGlobalFee = true;
    this.globalFeeSaved = false;
    this.clubLedgerService.setGlobalFee(amount).subscribe({
      next: (res) => {
        this.globalFeeValue = res.financeReportMonthlyFee;
        // Refresh effective fees for clubs without an override
        this.clubs = this.clubs.map((c) =>
          c.financeReportFeeOverride == null ? { ...c, financeReportMonthlyFee: res.financeReportMonthlyFee } : c,
        );
        this.savingGlobalFee = false;
        this.globalFeeSaved = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingGlobalFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveEmailGlobalFee() {
    const amount = Number(this.emailGlobalFeeValue);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingEmailGlobalFee = true;
    this.emailGlobalFeeSaved = false;
    this.clubLedgerService.setGlobalEmailConfirmationsFee(amount).subscribe({
      next: (res) => {
        this.emailGlobalFeeValue = res.emailConfirmationsMonthlyFee;
        // Refresh effective fees for clubs without an override
        this.clubs = this.clubs.map((c) =>
          c.emailConfirmationsFeeOverride == null ? { ...c, emailConfirmationsMonthlyFee: res.emailConfirmationsMonthlyFee } : c,
        );
        this.savingEmailGlobalFee = false;
        this.emailGlobalFeeSaved = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingEmailGlobalFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  startEditEmailAddonFee(club: ClubServiceSummary) {
    this.editingEmailAddonFeeClubId = club.clubId;
    this.editingEmailAddonFeeValue = club.emailConfirmationsMonthlyFee ?? this.emailGlobalFeeValue;
  }

  cancelEmailAddonFee() {
    this.editingEmailAddonFeeClubId = null;
    this.savingEmailAddonFee = false;
  }

  saveEmailAddonFee(club: ClubServiceSummary) {
    const amount = Number(this.editingEmailAddonFeeValue);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingEmailAddonFee = true;
    this.clubService.patchEmailConfirmationsFee(club.clubId, amount).subscribe({
      next: () => {
        club.emailConfirmationsFeeOverride = amount;
        club.emailConfirmationsMonthlyFee = amount;
        this.editingEmailAddonFeeClubId = null;
        this.savingEmailAddonFee = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingEmailAddonFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  resetEmailAddonFee(club: ClubServiceSummary) {
    this.savingEmailAddonFee = true;
    this.clubService.patchEmailConfirmationsFee(club.clubId, null).subscribe({
      next: () => {
        club.emailConfirmationsFeeOverride = null;
        club.emailConfirmationsMonthlyFee = this.emailGlobalFeeValue;
        this.editingEmailAddonFeeClubId = null;
        this.savingEmailAddonFee = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingEmailAddonFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveAdvancedAnalyticsGlobalFee() {
    const amount = Number(this.advancedAnalyticsGlobalFeeValue);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingAdvancedAnalyticsGlobalFee = true;
    this.advancedAnalyticsGlobalFeeSaved = false;
    this.clubLedgerService.setGlobalAdvancedAnalyticsFee(amount).subscribe({
      next: (res) => {
        this.advancedAnalyticsGlobalFeeValue = res.advancedAnalyticsMonthlyFee;
        // Refresh effective fees for clubs without an override
        this.clubs = this.clubs.map((c) =>
          c.advancedAnalyticsFeeOverride == null ? { ...c, advancedAnalyticsMonthlyFee: res.advancedAnalyticsMonthlyFee } : c,
        );
        this.savingAdvancedAnalyticsGlobalFee = false;
        this.advancedAnalyticsGlobalFeeSaved = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingAdvancedAnalyticsGlobalFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  startEditAdvancedAnalyticsFee(club: ClubServiceSummary) {
    this.editingAdvancedAnalyticsFeeClubId = club.clubId;
    this.editingAdvancedAnalyticsFeeValue = club.advancedAnalyticsMonthlyFee ?? this.advancedAnalyticsGlobalFeeValue;
  }

  cancelAdvancedAnalyticsFee() {
    this.editingAdvancedAnalyticsFeeClubId = null;
    this.savingAdvancedAnalyticsFee = false;
  }

  saveAdvancedAnalyticsFee(club: ClubServiceSummary) {
    const amount = Number(this.editingAdvancedAnalyticsFeeValue);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingAdvancedAnalyticsFee = true;
    this.clubService.patchAdvancedAnalyticsFee(club.clubId, amount).subscribe({
      next: () => {
        club.advancedAnalyticsFeeOverride = amount;
        club.advancedAnalyticsMonthlyFee = amount;
        this.editingAdvancedAnalyticsFeeClubId = null;
        this.savingAdvancedAnalyticsFee = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingAdvancedAnalyticsFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  resetAdvancedAnalyticsFee(club: ClubServiceSummary) {
    this.savingAdvancedAnalyticsFee = true;
    this.clubService.patchAdvancedAnalyticsFee(club.clubId, null).subscribe({
      next: () => {
        club.advancedAnalyticsFeeOverride = null;
        club.advancedAnalyticsMonthlyFee = this.advancedAnalyticsGlobalFeeValue;
        this.editingAdvancedAnalyticsFeeClubId = null;
        this.savingAdvancedAnalyticsFee = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingAdvancedAnalyticsFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveMemberActivationFee() {
    const amount = Number(this.memberActivationFeeValue);
    const freeTierCount = Number(this.memberFreeTierCountValue);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(freeTierCount) || freeTierCount < 0) return;
    this.savingMemberActivationFee = true;
    this.memberActivationFeeSaved = false;
    this.clubLedgerService.setMemberActivationFee(amount, freeTierCount).subscribe({
      next: (res) => {
        this.memberActivationFeeValue = res.memberActivationFee;
        this.memberFreeTierCountValue = res.memberFreeTierCount;
        this.savingMemberActivationFee = false;
        this.memberActivationFeeSaved = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingMemberActivationFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  startEditAddonFee(club: ClubServiceSummary) {
    this.editingAddonFeeClubId = club.clubId;
    this.editingAddonFeeValue = club.financeReportMonthlyFee ?? this.globalFeeValue;
  }

  cancelAddonFee() {
    this.editingAddonFeeClubId = null;
    this.savingAddonFee = false;
  }

  saveAddonFee(club: ClubServiceSummary) {
    const amount = Number(this.editingAddonFeeValue);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingAddonFee = true;
    this.clubService.patchFinanceReportFee(club.clubId, amount).subscribe({
      next: () => {
        club.financeReportFeeOverride = amount;
        club.financeReportMonthlyFee = amount;
        this.editingAddonFeeClubId = null;
        this.savingAddonFee = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingAddonFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  resetAddonFee(club: ClubServiceSummary) {
    this.savingAddonFee = true;
    this.clubService.patchFinanceReportFee(club.clubId, null).subscribe({
      next: () => {
        club.financeReportFeeOverride = null;
        club.financeReportMonthlyFee = this.globalFeeValue;
        this.editingAddonFeeClubId = null;
        this.savingAddonFee = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingAddonFee = false;
        this.cdr.detectChanges();
      },
    });
  }

  viewReport(club: ClubServiceSummary) {
    this.router.navigate(['/admin/finance-reports'], { queryParams: { clubId: club.clubId } });
  }

  viewAllReports() {
    this.router.navigate(['/admin/finance-reports']);
  }

  viewAnalytics(club: ClubServiceSummary) {
    this.router.navigate(['/admin/advanced-analytics-all'], { queryParams: { clubId: club.clubId } });
  }

  viewAllAnalytics() {
    this.router.navigate(['/admin/advanced-analytics-all']);
  }

  goBack() { this.router.navigate(['/admin/dashboard']); }
}
