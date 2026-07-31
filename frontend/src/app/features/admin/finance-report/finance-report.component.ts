import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppServicePaymentsService, FeeInfo } from '../../../core/services/app-service-payments.service';
import { ClubService } from '../../../core/services/club.service';
import { ClubLedgerService, ClubLedgerEntry, ClubFinanceReport, BookingDetailRow } from '../../../core/services/club-ledger.service';
import { Workbook } from 'exceljs';
import { styleSectionRow, styleColumnHeaderRow, styleTotalsRow, styleGridRow, currencyCell, CURRENCY_FMT } from '../../../core/utils/excel-report.util';

const CHARGE_CATEGORY_LABELS: Record<string, string> = {
  courtFee: 'Court fees',
  lightFee: 'Lighting',
  ballBoyFee: 'Ball boy',
  guestFee: 'Guest fees',
  rentalFee: 'Equipment rental',
  coachingFee: 'Coaching',
  gameFee: 'Game fees',
  hostedPlayFee: 'Hosted Play',
  extraFeeTotal: 'Additional fees',
};

const EXPENSE_SUGGESTIONS = ['Utilities', 'Maintenance', 'Staff', 'Equipment', 'Rent', 'Other'];
const INCOME_SUGGESTIONS = ['Sponsorship', 'Merchandise', 'Donations', 'Other'];

type Preset = 'thisMonth' | 'lastMonth' | 'quarter' | 'year' | 'custom';

@Component({
  selector: 'app-finance-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="fr-shell">
      <header class="fr-hero fr-no-print">
        <div>
          <p class="hero-kicker">Club Admin <span class="premium-pill"><i class="fas fa-crown"></i> Premium</span></p>
          <h2>Finance Report</h2>
          <p class="hero-sub">Your club's income & expenses — bookings, manual entries, and reports.</p>
        </div>
      </header>

      @if (loadingFeeInfo()) {
        <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else if (!feeInfo()?.financeReportEnabled) {

        <!-- ── PAYWALL ── -->
        <div class="paywall-card">
          <div class="paywall-icon"><i class="fas fa-chart-line"></i></div>
          <h3>Unlock your club's financial picture</h3>
          <ul class="paywall-features">
            <li><i class="fas fa-check"></i> Income tracked automatically from paid bookings, hosted play, and game fees</li>
            <li><i class="fas fa-check"></i> Record expenses & extra income with categories and notes</li>
            <li><i class="fas fa-check"></i> Category breakdowns, monthly trends, and net profit at a glance</li>
            <li><i class="fas fa-check"></i> Export to CSV or print a clean report</li>
          </ul>
          <p class="paywall-price">
            <span class="price-amount">{{ feeInfo()?.financeReportMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}</span>
            <span class="price-per">/ month</span>
          </p>
          <p class="paywall-terms">
            Billed to your CourtGo service balance — the full month is charged when you subscribe and on each
            calendar month while active. Cancel anytime; your data is kept.
          </p>
          <button class="btn-primary btn-lg" [disabled]="subscribing()" (click)="openSubscribeModal()">
            <i class="fas {{ subscribing() ? 'fa-circle-notch fa-spin' : 'fa-crown' }}"></i>
            {{ subscribing() ? 'Subscribing…' : 'Subscribe' }}
          </button>
        </div>

      } @else {

        <!-- ── SUBSCRIBED ── -->
        <div class="sub-strip fr-no-print">
          <span class="sub-info">
            <i class="fas fa-crown"></i>
            Subscribed{{ feeInfo()?.financeReportSubscribedAt ? ' since ' + (feeInfo()?.financeReportSubscribedAt | date: 'MMM d, y') : '' }}
            · {{ feeInfo()?.financeReportMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}/mo
          </span>
          <button class="btn-ghost btn-sm" [disabled]="subscribing()" (click)="openCancelModal()">
            {{ subscribing() ? 'Cancelling…' : 'Cancel add-on' }}
          </button>
        </div>

        <div class="tab-bar fr-no-print">
          <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'report'" (click)="selectTab('report')">
            <i class="fas fa-chart-pie"></i> Report
          </button>
          <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'entries'" (click)="selectTab('entries')">
            <i class="fas fa-list"></i> Income & Expense Entries
          </button>
        </div>

        <!-- ── REPORT TAB ── -->
        @if (activeTab() === 'report') {
          <div class="panel">
            <div class="report-filters fr-no-print">
              <div class="preset-chips">
                <button class="chip" [class.chip--active]="preset() === 'thisMonth'" (click)="setPreset('thisMonth')">This Month</button>
                <button class="chip" [class.chip--active]="preset() === 'lastMonth'" (click)="setPreset('lastMonth')">Last Month</button>
                <button class="chip" [class.chip--active]="preset() === 'quarter'" (click)="setPreset('quarter')">This Quarter</button>
                <button class="chip" [class.chip--active]="preset() === 'year'" (click)="setPreset('year')">This Year</button>
                <button class="chip" [class.chip--active]="preset() === 'custom'" (click)="preset.set('custom')">Custom</button>
              </div>
              @if (preset() === 'custom') {
                <div class="custom-range">
                  <label class="filter-field">
                    <span class="field-label">From</span>
                    <input type="date" class="field-input" [(ngModel)]="reportFrom" />
                  </label>
                  <label class="filter-field">
                    <span class="field-label">To</span>
                    <input type="date" class="field-input" [(ngModel)]="reportTo" />
                  </label>
                  <button class="btn-primary" [disabled]="loadingReport()" (click)="loadReport()">
                    <i class="fas {{ loadingReport() ? 'fa-circle-notch fa-spin' : 'fa-search' }}"></i> Apply
                  </button>
                </div>
              }
              <div class="export-actions">
                <button class="btn-ghost btn-sm" [disabled]="!report()" (click)="exportExcel()">
                  <i class="fas fa-file-excel"></i> Export Excel
                </button>
                <button class="btn-ghost btn-sm" [disabled]="!report()" (click)="printReport()">
                  <i class="fas fa-print"></i> Print
                </button>
              </div>
            </div>

            <div class="print-header fr-print-only">
              <h2>Finance Report — {{ rangeLabel() }}</h2>
            </div>

            @if (loadingReport()) {
              <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading report…</div>
            } @else if (report(); as r) {
              <!-- Summary cards -->
              <div class="summary-grid">
                <div class="summary-card summary-card--income">
                  <p class="summary-label">Total Income</p>
                  <p class="summary-value">{{ r.totalIncome | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
                </div>
                <div class="summary-card summary-card--expense">
                  <p class="summary-label">Total Expenses</p>
                  <p class="summary-value">{{ r.totalExpenses | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
                </div>
                <div class="summary-card" [class.summary-card--positive]="r.net >= 0" [class.summary-card--negative]="r.net < 0">
                  <p class="summary-label">Net</p>
                  <p class="summary-value">{{ r.net | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
                </div>
              </div>

              <!-- Hours & fees detail -->
              <div class="breakdown-section">
                <h3 class="breakdown-title">Hours &amp; Fees Detail</h3>
                <table class="entries-table">
                  <thead><tr><th>Metric</th><th class="col-amount">Total</th></tr></thead>
                  <tbody>
                    <tr><td>Total hours booked</td><td class="col-amount">{{ r.hoursAndFees.totalHours }}</td></tr>
                    <tr><td>Excess-person fees</td><td class="col-amount amt--income">{{ r.hoursAndFees.excessPersonFee | currency: 'PHP' : 'symbol' : '1.2-2' }}</td></tr>
                    <tr><td>Coaching fees</td><td class="col-amount amt--income">{{ r.hoursAndFees.coachingFee | currency: 'PHP' : 'symbol' : '1.2-2' }}</td></tr>
                    @for (fee of r.hoursAndFees.additionalFees; track fee.name) {
                      <tr><td>{{ fee.name }}</td><td class="col-amount amt--income">{{ fee.total | currency: 'PHP' : 'symbol' : '1.2-2' }}</td></tr>
                    }
                    @if (r.hoursAndFees.otherFee > 0) {
                      <tr><td>Other fees</td><td class="col-amount amt--income">{{ r.hoursAndFees.otherFee | currency: 'PHP' : 'symbol' : '1.2-2' }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Income by source -->
              <div class="breakdown-section">
                <h3 class="breakdown-title">Income by Source</h3>
                @if (r.chargeIncome.byCategory.length === 0 && r.manualIncome.byCategory.length === 0) {
                  <div class="state-empty">No income in this period.</div>
                } @else {
                  <table class="entries-table">
                    <thead>
                      <tr><th>Source</th><th class="col-amount">Total</th></tr>
                    </thead>
                    <tbody>
                      @for (row of r.chargeIncome.byCategory; track row.category) {
                        <tr>
                          <td>{{ chargeCategoryLabel(row.category) }}</td>
                          <td class="col-amount amt--income">{{ row.total | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                        </tr>
                      }
                      @for (row of r.manualIncome.byCategory; track row.category) {
                        <tr>
                          <td>{{ row.category }} <span class="manual-badge">manual</span></td>
                          <td class="col-amount amt--income">{{ row.total | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                        </tr>
                      }
                      <tr class="total-row">
                        <td>Total income</td>
                        <td class="col-amount amt--income">{{ r.totalIncome | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      </tr>
                    </tbody>
                  </table>
                }
              </div>

              <!-- Expenses by category -->
              <div class="breakdown-section">
                <h3 class="breakdown-title">Expenses by Category</h3>
                @if (r.expenses.byCategory.length === 0) {
                  <div class="state-empty">No expenses recorded in this period.</div>
                } @else {
                  <table class="entries-table">
                    <thead>
                      <tr><th>Category</th><th class="col-amount">Total</th></tr>
                    </thead>
                    <tbody>
                      @for (row of r.expenses.byCategory; track row.category) {
                        <tr>
                          <td>{{ row.category }}</td>
                          <td class="col-amount amt--expense">{{ row.total | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                        </tr>
                      }
                      <tr class="total-row">
                        <td>Total expenses</td>
                        <td class="col-amount amt--expense">{{ r.totalExpenses | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      </tr>
                    </tbody>
                  </table>
                }
              </div>

              <!-- Monthly trend -->
              @if (r.byMonth.length > 0) {
                <div class="breakdown-section">
                  <h3 class="breakdown-title">Monthly Trend</h3>
                  <div class="entries-table-wrap">
                    <table class="entries-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th class="col-amount">Income</th>
                          <th class="col-amount">Expenses</th>
                          <th class="col-amount">Net</th>
                          <th class="trend-col fr-no-print"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (m of r.byMonth; track m.month) {
                          <tr>
                            <td>{{ formatMonth(m.month) }}</td>
                            <td class="col-amount amt--income">{{ m.income | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                            <td class="col-amount amt--expense">{{ m.expenses | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                            <td class="col-amount" [class.amt--income]="m.net >= 0" [class.amt--expense]="m.net < 0">
                              {{ m.net | currency: 'PHP' : 'symbol' : '1.2-2' }}
                            </td>
                            <td class="trend-col fr-no-print">
                              <div class="bar bar--income" [style.width.%]="barWidth(m.income)"></div>
                              <div class="bar bar--expense" [style.width.%]="barWidth(m.expenses)"></div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            } @else {
              <div class="state-empty">No report data for the selected range.</div>
            }
          </div>
        }

        <!-- ── ENTRIES TAB ── -->
        @if (activeTab() === 'entries') {
          <div class="panel">
            <div class="form-card">
              <h3 class="form-title">{{ editingId() ? 'Edit Entry' : 'Add Entry' }}</h3>

              <div class="type-toggle">
                <button class="type-btn" [class.type-btn--income]="form.type === 'income'"
                        [class.type-btn--active]="form.type === 'income'"
                        (click)="form.type = 'income'">
                  <i class="fas fa-arrow-down"></i> Income
                </button>
                <button class="type-btn" [class.type-btn--expense]="form.type === 'expense'"
                        [class.type-btn--active]="form.type === 'expense'"
                        (click)="form.type = 'expense'">
                  <i class="fas fa-arrow-up"></i> Expense
                </button>
              </div>

              <div class="form-grid">
                <label class="field">
                  <span class="field-label">Category *</span>
                  <input list="fr-category-list" class="field-input" [(ngModel)]="form.category"
                         placeholder="e.g. Utilities" />
                  <datalist id="fr-category-list">
                    @for (s of categorySuggestions(); track s) {
                      <option [value]="s"></option>
                    }
                  </datalist>
                </label>

                <label class="field">
                  <span class="field-label">Amount (PHP) *</span>
                  <input type="number" class="field-input" [(ngModel)]="form.amount"
                         placeholder="0.00" min="0" step="0.01" />
                </label>

                <label class="field field--full">
                  <span class="field-label">Description</span>
                  <input type="text" class="field-input" [(ngModel)]="form.description"
                         placeholder="Brief description" />
                </label>

                <label class="field">
                  <span class="field-label">Date *</span>
                  <input type="date" class="field-input" [(ngModel)]="form.date" />
                </label>

                <label class="field">
                  <span class="field-label">Notes</span>
                  <input type="text" class="field-input" [(ngModel)]="form.notes"
                         placeholder="Optional notes" />
                </label>
              </div>

              @if (formError()) {
                <p class="form-error">{{ formError() }}</p>
              }

              <div class="form-actions">
                <button class="btn-primary" [disabled]="saving()" (click)="saveEntry()">
                  <i class="fas {{ saving() ? 'fa-circle-notch fa-spin' : (editingId() ? 'fa-save' : 'fa-plus') }}"></i>
                  {{ saving() ? 'Saving…' : (editingId() ? 'Save Changes' : 'Add Entry') }}
                </button>
                @if (editingId()) {
                  <button class="btn-ghost" (click)="cancelEdit()">Cancel</button>
                }
              </div>
            </div>

            @if (loadingEntries()) {
              <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
            } @else if (entries().length === 0) {
              <div class="state-empty">No entries yet. Add your first income or expense above.</div>
            } @else {
              <div class="entries-table-wrap">
                <table class="entries-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th class="col-amount">Amount</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (e of entries(); track e._id) {
                      <tr>
                        <td>{{ e.date | date: 'MMM d, y' : 'UTC' }}</td>
                        <td>
                          <span class="type-badge" [class.badge--income]="e.type === 'income'" [class.badge--expense]="e.type === 'expense'">
                            {{ e.type }}
                          </span>
                        </td>
                        <td>{{ e.category }}</td>
                        <td>{{ e.description || '—' }}</td>
                        <td class="col-amount" [class.amt--income]="e.type === 'income'" [class.amt--expense]="e.type === 'expense'">
                          {{ e.type === 'income' ? '+' : '-' }}{{ e.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}
                        </td>
                        <td class="col-notes">{{ e.notes || '—' }}</td>
                        <td class="col-actions">
                          <button class="icon-btn" title="Edit" (click)="startEdit(e)"><i class="fas fa-pencil"></i></button>
                          <button class="icon-btn icon-btn--danger" title="Delete" [disabled]="deletingId() === e._id" (click)="deleteEntry(e._id)">
                            <i class="fas {{ deletingId() === e._id ? 'fa-circle-notch fa-spin' : 'fa-trash' }}"></i>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      }
    </section>

    <!-- ── SUBSCRIBE / CANCEL CONFIRMATION MODAL ── -->
    @if (confirmModal(); as cm) {
      <div class="modal-backdrop" (click)="closeConfirmModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">
              <i class="fas {{ cm.type === 'subscribe' ? 'fa-crown' : 'fa-triangle-exclamation' }}"></i>
              {{ cm.type === 'subscribe' ? 'Subscribe to Finance Report' : 'Cancel Finance Report Add-on' }}
            </div>
            <button class="modal-close" (click)="closeConfirmModal()" [disabled]="cm.submitting"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            @if (cm.type === 'subscribe') {
              <p class="modal-price">
                <span class="modal-price-amount">{{ feeInfo()?.financeReportMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}</span>
                <span class="modal-price-per">/ month</span>
              </p>
              <p class="modal-copy">
                The full current month will be billed to your CourtGo service balance now, and each
                calendar month while the add-on stays active.
              </p>
            } @else {
              <p class="modal-copy">
                The report locks immediately. This month's fee remains due. All your entries and data
                are preserved and will reappear if you resubscribe.
              </p>
            }
            @if (cm.error) {
              <p class="modal-error">{{ cm.error }}</p>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeConfirmModal()" [disabled]="cm.submitting">Never mind</button>
            <button class="btn-confirm" [class.btn-confirm--danger]="cm.type === 'cancel'" [disabled]="cm.submitting" (click)="confirmModalAction()">
              <i class="fas {{ cm.submitting ? 'fa-circle-notch fa-spin' : (cm.type === 'subscribe' ? 'fa-crown' : 'fa-ban') }}"></i>
              {{ cm.submitting
                ? (cm.type === 'subscribe' ? 'Subscribing…' : 'Cancelling…')
                : (cm.type === 'subscribe' ? 'Subscribe' : 'Cancel add-on') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      --gold: var(--dm-accent, #a3e635);
      --gold-dim: rgba(163,230,53,0.12);
      --gold-border: rgba(163,230,53,0.22);
      --card-bg: var(--dm-surface, #1a1f2e);
      --ink: #ffffff;
      --ink-dim: rgba(255,255,255,0.65);
      --income: #4ade80;
      --income-dim: rgba(74,222,128,0.12);
      --expense: #f87171;
      --expense-dim: rgba(248,113,113,0.12);
      display: block;
      background: var(--dm-bg, #111827);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .fr-shell {
      display: grid;
      gap: 1rem;
      padding: 1.5rem;
      min-height: calc(100vh - 60px);
    }

    .fr-hero {
      background: var(--dm-header, #1e2535);
      border: 1px solid var(--gold-border);
      border-radius: 18px;
      padding: 1rem 1.2rem;
      box-shadow: 0 4px 16px rgba(0,0,0,0.32);
    }

    .hero-kicker {
      margin: 0 0 0.2rem;
      font-size: 0.74rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 800;
      color: var(--gold);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .premium-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: rgba(250,204,21,0.14);
      border: 1px solid rgba(250,204,21,0.4);
      color: #facc15;
      padding: 0.12rem 0.5rem;
      border-radius: 999px;
      font-size: 0.66rem;
      letter-spacing: 0.06em;
    }

    .fr-hero h2 { margin: 0; font-size: 1.42rem; color: var(--ink); letter-spacing: -0.02em; }
    .hero-sub { margin: 0.3rem 0 0; color: var(--ink-dim); font-size: 0.9rem; }

    /* Paywall */
    .paywall-card {
      background: var(--card-bg);
      border: 1px solid rgba(250,204,21,0.32);
      border-radius: 18px;
      padding: 2rem 1.5rem;
      text-align: center;
      max-width: 560px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      display: grid;
      gap: 0.9rem;
      justify-items: center;
    }

    .paywall-icon {
      width: 58px;
      height: 58px;
      border-radius: 16px;
      background: rgba(250,204,21,0.12);
      color: #facc15;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }

    .paywall-card h3 { margin: 0; color: var(--ink); font-size: 1.2rem; }

    .paywall-features {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
      text-align: left;
      color: var(--ink-dim);
      font-size: 0.9rem;
    }

    .paywall-features i { color: var(--income); margin-right: 0.5rem; }

    .paywall-price { margin: 0.3rem 0 0; color: var(--ink); }
    .price-amount { font-size: 2rem; font-weight: 800; color: #facc15; }
    .price-per { color: var(--ink-dim); font-size: 0.95rem; }
    .paywall-terms { margin: 0; color: var(--ink-dim); font-size: 0.78rem; max-width: 420px; }

    .sub-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.7rem;
      flex-wrap: wrap;
      background: var(--card-bg);
      border: 1px solid rgba(250,204,21,0.28);
      border-radius: 12px;
      padding: 0.6rem 0.9rem;
      font-size: 0.86rem;
      color: var(--ink-dim);
    }

    .sub-info { display: inline-flex; align-items: center; gap: 0.45rem; }
    .sub-info i { color: #facc15; }

    .tab-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .tab-btn {
      padding: 0.5rem 1rem;
      border-radius: 10px;
      border: 1px solid var(--gold-border);
      background: transparent;
      color: var(--ink-dim);
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s;
      font-family: inherit;
    }

    .tab-btn--active { background: var(--gold-dim); color: var(--gold); border-color: var(--gold); }

    .panel { display: grid; gap: 1rem; }

    /* Report filters */
    .report-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
      align-items: center;
      background: var(--card-bg);
      border: 1px solid var(--gold-border);
      border-radius: 14px;
      padding: 0.9rem;
    }

    .preset-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }

    .chip {
      padding: 0.38rem 0.8rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: transparent;
      color: var(--ink-dim);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .chip--active { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }

    .custom-range { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; }
    .filter-field { display: flex; flex-direction: column; gap: 0.3rem; }
    .export-actions { margin-left: auto; display: flex; gap: 0.45rem; flex-wrap: wrap; }

    .print-header { display: none; }

    .form-card {
      background: var(--card-bg);
      border: 1px solid var(--gold-border);
      border-radius: 16px;
      padding: 1.1rem;
      box-shadow: 0 4px 14px rgba(0,0,0,0.24);
    }

    .form-title { margin: 0 0 0.8rem; font-size: 1rem; color: var(--ink); }

    .type-toggle { display: flex; gap: 0.5rem; margin-bottom: 0.9rem; flex-wrap: wrap; }

    .type-btn {
      padding: 0.45rem 0.9rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.12);
      background: transparent;
      color: var(--ink-dim);
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s;
      font-family: inherit;
    }

    .type-btn--active.type-btn--income { background: var(--income-dim); border-color: rgba(74,222,128,0.4); color: var(--income); }
    .type-btn--active.type-btn--expense { background: var(--expense-dim); border-color: rgba(248,113,113,0.4); color: var(--expense); }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.65rem;
    }

    .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field--full { grid-column: 1 / -1; }

    .field-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--ink-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .field-input {
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--gold-border);
      border-radius: 8px;
      color: var(--ink);
      padding: 0.5rem 0.7rem;
      font-size: 0.88rem;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.15s;
    }

    .field-input:focus { border-color: var(--gold); }

    .form-error { margin: 0.6rem 0 0; color: var(--expense); font-size: 0.83rem; }
    .form-actions { display: flex; gap: 0.5rem; margin-top: 0.85rem; flex-wrap: wrap; }

    .btn-primary {
      background: var(--gold);
      color: #111827;
      border: none;
      border-radius: 9px;
      padding: 0.52rem 0.95rem;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: opacity 0.15s;
      font-family: inherit;
    }

    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-lg { padding: 0.7rem 1.6rem; font-size: 0.95rem; }

    .btn-ghost {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 9px;
      color: var(--ink-dim);
      padding: 0.52rem 0.95rem;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }

    .state-msg, .state-empty {
      background: var(--card-bg);
      border: 1px dashed rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 1.2rem;
      text-align: center;
      color: var(--ink-dim);
      font-size: 0.88rem;
    }

    .state-msg { border-style: solid; }

    .entries-table-wrap { overflow-x: auto; }

    .entries-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      background: var(--card-bg);
      border-radius: 12px;
      overflow: hidden;
    }

    .entries-table th {
      background: rgba(163,230,53,0.07);
      color: var(--gold);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 0.6rem 0.8rem;
      text-align: left;
      white-space: nowrap;
    }

    .entries-table td {
      padding: 0.6rem 0.8rem;
      border-top: 1px solid rgba(255,255,255,0.05);
      color: var(--ink);
      vertical-align: middle;
    }

    .entries-table tr:hover td { background: rgba(255,255,255,0.03); }

    .col-amount { text-align: right; white-space: nowrap; }
    .col-notes { color: var(--ink-dim); font-size: 0.8rem; max-width: 180px; }
    .col-actions { white-space: nowrap; text-align: right; }

    .amt--income { color: var(--income); font-weight: 700; }
    .amt--expense { color: var(--expense); font-weight: 700; }

    .total-row td { border-top: 2px solid rgba(255,255,255,0.14); font-weight: 800; }

    .manual-badge {
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: rgba(96,165,250,0.14);
      color: #60a5fa;
      border-radius: 999px;
      padding: 0.1rem 0.45rem;
      margin-left: 0.35rem;
    }

    .type-badge {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
      text-transform: capitalize;
    }

    .badge--income { background: var(--income-dim); color: var(--income); }
    .badge--expense { background: var(--expense-dim); color: var(--expense); }

    .icon-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 7px;
      color: var(--ink-dim);
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.78rem;
      transition: all 0.14s;
      margin-left: 4px;
    }

    .icon-btn:hover { background: rgba(255,255,255,0.08); color: var(--ink); }
    .icon-btn--danger:hover { background: var(--expense-dim); color: var(--expense); border-color: rgba(248,113,113,0.3); }
    .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
    }

    .summary-card {
      background: var(--card-bg);
      border: 1px solid var(--gold-border);
      border-radius: 14px;
      padding: 1rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.22);
    }

    .summary-card--income { border-color: rgba(74,222,128,0.3); }
    .summary-card--expense { border-color: rgba(248,113,113,0.3); }
    .summary-card--positive { border-color: rgba(74,222,128,0.4); background: rgba(74,222,128,0.06); }
    .summary-card--negative { border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.06); }

    .summary-label {
      margin: 0 0 0.3rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      color: var(--ink-dim);
    }

    .summary-value { margin: 0; font-size: 1.35rem; font-weight: 800; color: var(--ink); }
    .summary-card--income .summary-value { color: var(--income); }
    .summary-card--expense .summary-value { color: var(--expense); }
    .summary-card--positive .summary-value { color: var(--income); }
    .summary-card--negative .summary-value { color: var(--expense); }

    .breakdown-section {
      background: var(--card-bg);
      border: 1px solid var(--gold-border);
      border-radius: 14px;
      padding: 0.9rem;
    }

    .breakdown-title { margin: 0 0 0.7rem; font-size: 0.92rem; color: var(--ink); }

    .footnote {
      margin: 0.6rem 0 0;
      font-size: 0.78rem;
      color: var(--ink-dim);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .trend-col { width: 30%; min-width: 140px; }
    .bar { height: 7px; border-radius: 4px; margin: 2px 0; min-width: 2px; }
    .bar--income { background: var(--income); }
    .bar--expense { background: var(--expense); }

    @media (max-width: 640px) {
      .fr-shell { padding: 0.85rem; gap: 0.75rem; }
      .form-grid { grid-template-columns: 1fr; }
      .field--full { grid-column: 1; }
      .summary-grid { grid-template-columns: 1fr; }
      .export-actions { margin-left: 0; }
    }

    /* Confirmation modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fr-fade-in 0.15s ease;
    }

    @keyframes fr-fade-in { from { opacity: 0; } to { opacity: 1; } }

    .modal {
      background: var(--card-bg);
      border-radius: 16px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      animation: fr-slide-up 0.2s ease;
      border: 1px solid var(--gold-border);
      overflow: hidden;
    }

    @keyframes fr-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--gold-dim);
    }

    .modal-title {
      font-size: 1rem;
      font-weight: 800;
      color: var(--ink);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-title i { color: var(--gold); }

    .modal-close {
      background: none;
      border: none;
      font-size: 1rem;
      color: var(--ink-dim);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: inherit;
    }

    .modal-close:hover { background: rgba(255,255,255,0.08); color: var(--ink); }
    .modal-close:disabled { opacity: 0.5; cursor: not-allowed; }

    .modal-body { padding: 20px; display: grid; gap: 12px; }

    .modal-price { margin: 0; text-align: center; }
    .modal-price-amount { font-size: 1.8rem; font-weight: 800; color: var(--gold); }
    .modal-price-per { color: var(--ink-dim); font-size: 0.9rem; }

    .modal-copy { margin: 0; color: var(--ink-dim); font-size: 0.86rem; line-height: 1.5; }

    .modal-error {
      margin: 0;
      color: var(--expense);
      font-size: 0.82rem;
      padding: 8px 10px;
      background: var(--expense-dim);
      border-radius: 6px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
    }

    .btn-cancel {
      padding: 8px 16px;
      background: rgba(255,255,255,0.04);
      color: var(--ink-dim);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      font-size: 0.875rem;
      cursor: pointer;
      font-family: inherit;
    }

    .btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
    .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-confirm {
      padding: 8px 18px;
      background: var(--gold);
      color: #111827;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
      transition: opacity 0.15s;
    }

    .btn-confirm:hover:not(:disabled) { opacity: 0.9; }
    .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-confirm--danger { background: var(--expense); color: #ffffff; }

    /* Print */
    .fr-print-only { display: none; }

    @media print {
      :host { background: #fff; }
      .fr-shell { padding: 0; min-height: 0; }
      .fr-no-print { display: none !important; }
      .fr-print-only { display: block; }
      .print-header h2 { color: #111; margin: 0 0 0.8rem; }
      .summary-card, .breakdown-section, .entries-table {
        background: #fff;
        border-color: #ccc;
        box-shadow: none;
      }
      .summary-value, .breakdown-title, .entries-table td { color: #111; }
      .entries-table th { background: #f3f4f6; color: #374151; }
      .summary-label, .footnote, .col-notes { color: #4b5563; }
      .amt--income, .summary-card--income .summary-value, .summary-card--positive .summary-value { color: #15803d; }
      .amt--expense, .summary-card--expense .summary-value, .summary-card--negative .summary-value { color: #b91c1c; }
      .state-empty { background: #fff; color: #4b5563; }
    }
  `],
})
export class FinanceReportComponent implements OnInit {
  private appServicePayments = inject(AppServicePaymentsService);
  private clubService = inject(ClubService);
  private ledger = inject(ClubLedgerService);

  feeInfo = signal<FeeInfo | null>(null);
  loadingFeeInfo = signal(true);
  subscribing = signal(false);
  confirmModal = signal<{ type: 'subscribe' | 'cancel'; submitting: boolean; error: string } | null>(null);

  activeTab = signal<'report' | 'entries'>('report');
  // Set whenever an entry is added/edited/deleted; forces a refetch next time the Report tab is opened.
  private reportStale = signal(false);

  // Report state
  report = signal<ClubFinanceReport | null>(null);
  loadingReport = signal(false);
  preset = signal<Preset>('thisMonth');
  reportFrom = '';
  reportTo = '';

  // Entries state
  entries = signal<ClubLedgerEntry[]>([]);
  loadingEntries = signal(false);
  saving = signal(false);
  deletingId = signal<string | null>(null);
  editingId = signal<string | null>(null);
  formError = signal('');
  form: {
    type: 'income' | 'expense';
    category: string;
    amount: number | null;
    description: string;
    date: string;
    notes: string;
  } = this.emptyForm();

  categorySuggestions = computed(() => {
    const base = this.form.type === 'expense' ? EXPENSE_SUGGESTIONS : INCOME_SUGGESTIONS;
    const used = this.entries()
      .filter((e) => e.type === this.form.type)
      .map((e) => e.category)
      .filter(Boolean);
    return Array.from(new Set([...base, ...used])).sort((a, b) => a.localeCompare(b));
  });

  private maxTrendValue = computed(() => {
    const months = this.report()?.byMonth ?? [];
    return Math.max(1, ...months.map((m) => Math.max(m.income, m.expenses)));
  });

  ngOnInit() {
    this.loadFeeInfo();
  }

  private emptyForm() {
    return {
      type: 'income' as 'income' | 'expense',
      category: '',
      amount: null as number | null,
      description: '',
      date: this.toDateString(new Date()),
      notes: '',
    };
  }

  private toDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  loadFeeInfo() {
    this.loadingFeeInfo.set(true);
    this.appServicePayments.getFeeInfo().subscribe({
      next: (info) => {
        this.feeInfo.set(info);
        this.loadingFeeInfo.set(false);
        if (info.financeReportEnabled) {
          this.setPreset('thisMonth');
          this.loadEntries();
        }
      },
      error: () => this.loadingFeeInfo.set(false),
    });
  }

  openSubscribeModal() {
    this.confirmModal.set({ type: 'subscribe', submitting: false, error: '' });
  }

  openCancelModal() {
    this.confirmModal.set({ type: 'cancel', submitting: false, error: '' });
  }

  closeConfirmModal() {
    if (this.confirmModal()?.submitting) return;
    this.confirmModal.set(null);
  }

  confirmModalAction() {
    const cm = this.confirmModal();
    if (!cm || cm.submitting) return;
    const enable = cm.type === 'subscribe';
    this.confirmModal.set({ ...cm, submitting: true, error: '' });
    this.subscribing.set(true);
    this.clubService.patchMyFinanceReportAddon(enable).subscribe({
      next: () => {
        this.subscribing.set(false);
        this.confirmModal.set(null);
        this.loadFeeInfo();
      },
      error: (err) => {
        this.subscribing.set(false);
        this.confirmModal.set({
          ...cm,
          submitting: false,
          error: err.error?.error || `Failed to ${enable ? 'subscribe' : 'cancel'}.`,
        });
      },
    });
  }

  setPreset(p: Preset) {
    this.preset.set(p);
    const now = new Date();
    if (p === 'thisMonth') {
      this.reportFrom = this.toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
      this.reportTo = this.toDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (p === 'lastMonth') {
      this.reportFrom = this.toDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      this.reportTo = this.toDateString(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (p === 'quarter') {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      this.reportFrom = this.toDateString(new Date(now.getFullYear(), qStart, 1));
      this.reportTo = this.toDateString(new Date(now.getFullYear(), qStart + 3, 0));
    } else if (p === 'year') {
      this.reportFrom = this.toDateString(new Date(now.getFullYear(), 0, 1));
      this.reportTo = this.toDateString(new Date(now.getFullYear(), 11, 31));
    }
    if (p !== 'custom') this.loadReport();
  }

  loadReport() {
    this.loadingReport.set(true);
    this.ledger.getReport(this.reportFrom || undefined, this.reportTo || undefined).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loadingReport.set(false);
        this.reportStale.set(false);
      },
      error: () => this.loadingReport.set(false),
    });
  }

  selectTab(tab: 'report' | 'entries') {
    this.activeTab.set(tab);
    if (tab === 'report' && this.reportStale()) {
      this.loadReport();
    }
  }

  loadEntries() {
    this.loadingEntries.set(true);
    this.ledger.list().subscribe({
      next: (list) => {
        this.entries.set(list);
        this.loadingEntries.set(false);
      },
      error: () => this.loadingEntries.set(false),
    });
  }

  chargeCategoryLabel(key: string): string {
    return CHARGE_CATEGORY_LABELS[key] ?? key;
  }

  formatMonth(month: string): string {
    const [year, m] = month.split('-');
    return new Date(+year, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  rangeLabel(): string {
    if (this.reportFrom && this.reportTo) return `${this.reportFrom} to ${this.reportTo}`;
    return 'All time';
  }

  barWidth(value: number): number {
    return Math.min(100, (value / this.maxTrendValue()) * 100);
  }

  saveEntry() {
    if (!this.form.category.trim() || !this.form.amount || !this.form.date) {
      this.formError.set('Category, amount, and date are required.');
      return;
    }
    this.formError.set('');
    this.saving.set(true);

    const body = {
      type: this.form.type,
      category: this.form.category.trim(),
      amount: this.form.amount,
      description: this.form.description.trim(),
      date: this.form.date,
      notes: this.form.notes.trim() || undefined,
    };

    const id = this.editingId();
    const req = id ? this.ledger.update(id, body) : this.ledger.create(body);

    req.subscribe({
      next: (saved) => {
        if (id) {
          this.entries.update((list) => list.map((e) => (e._id === id ? saved : e)));
        } else {
          this.entries.update((list) => [saved, ...list]);
        }
        this.saving.set(false);
        this.reportStale.set(true);
        this.cancelEdit();
      },
      error: (err) => {
        this.formError.set(err.error?.error || 'Failed to save entry.');
        this.saving.set(false);
      },
    });
  }

  startEdit(entry: ClubLedgerEntry) {
    this.editingId.set(entry._id);
    this.form = {
      type: entry.type,
      category: entry.category,
      amount: entry.amount,
      description: entry.description || '',
      date: entry.date.substring(0, 10),
      notes: entry.notes || '',
    };
    this.formError.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.formError.set('');
  }

  deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;
    this.deletingId.set(id);
    this.ledger.remove(id).subscribe({
      next: () => {
        this.entries.update((list) => list.filter((e) => e._id !== id));
        this.deletingId.set(null);
        this.reportStale.set(true);
      },
      error: () => this.deletingId.set(null),
    });
  }

  async exportExcel() {
    const r = this.report();
    if (!r) return;

    const wb = new Workbook();
    wb.creator = 'CourtGo';
    wb.created = new Date();

    const summary = wb.addWorksheet('Summary');
    summary.columns = [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }];
    summary.addRow(['Finance Report', this.rangeLabel()]).font = { bold: true, size: 13 };
    summary.addRow([]);
    styleSectionRow(summary.addRow(['TOTALS']));
    currencyCell(summary.addRow(['Total Income', r.totalIncome]), 2);
    currencyCell(summary.addRow(['Total Expenses', r.totalExpenses]), 2);
    currencyCell(summary.addRow(['Net', r.net]), 2);
    summary.addRow([]);
    styleSectionRow(summary.addRow(['HOURS & FEES DETAIL']));
    styleColumnHeaderRow(summary.addRow(['Metric', 'Total']));
    summary.addRow(['Total hours booked', r.hoursAndFees.totalHours]);
    currencyCell(summary.addRow(['Excess-person fees', r.hoursAndFees.excessPersonFee]), 2);
    currencyCell(summary.addRow(['Coaching fees', r.hoursAndFees.coachingFee]), 2);
    for (const fee of r.hoursAndFees.additionalFees) currencyCell(summary.addRow([fee.name, fee.total]), 2);
    if (r.hoursAndFees.otherFee > 0) currencyCell(summary.addRow(['Other fees', r.hoursAndFees.otherFee]), 2);
    summary.addRow([]);
    styleSectionRow(summary.addRow(['INCOME BY SOURCE']));
    styleColumnHeaderRow(summary.addRow(['Source', 'Total']));
    for (const row of r.chargeIncome.byCategory) currencyCell(summary.addRow([this.chargeCategoryLabel(row.category), row.total]), 2);
    for (const row of r.manualIncome.byCategory) currencyCell(summary.addRow([`${row.category} (manual)`, row.total]), 2);
    summary.addRow([]);
    styleSectionRow(summary.addRow(['EXPENSES BY CATEGORY']));
    styleColumnHeaderRow(summary.addRow(['Category', 'Total']));
    for (const row of r.expenses.byCategory) currencyCell(summary.addRow([row.category, row.total]), 2);
    summary.addRow([]);
    styleSectionRow(summary.addRow(['MONTHLY TREND']));
    styleColumnHeaderRow(summary.addRow(['Month', 'Income', 'Expenses', 'Net']));
    for (const m of r.byMonth) {
      const row = summary.addRow([m.month, m.income, m.expenses, m.net]);
      currencyCell(row, 2);
      currencyCell(row, 3);
      currencyCell(row, 4);
    }

    const bookings = wb.addWorksheet('Bookings Detail');
    // One column per Additional Booking Fee actually configured on this club (e.g. "Food and
    // Drinks", "Speaker"), plus a catch-all "Other" column only if there's anything to show there.
    const feeNames = r.hoursAndFees.additionalFees.map((f) => f.name);
    const showOtherCol = r.hoursAndFees.otherFee > 0;
    const feeColumnKey = (i: number) => `fee${i}`;
    bookings.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Time', key: 'time', width: 10 },
      { header: 'Duration (hrs)', key: 'duration', width: 14 },
      { header: 'Court Fee', key: 'courtFee', width: 12 },
      { header: 'Lighting', key: 'lightFee', width: 12 },
      { header: 'Ball Boy', key: 'ballBoyFee', width: 12 },
      { header: 'Guest Fee', key: 'guestFee', width: 12 },
      { header: 'Rental', key: 'rentalFee', width: 12 },
      { header: 'Coaching', key: 'coachingFee', width: 12 },
      ...feeNames.map((name, i) => ({ header: name, key: feeColumnKey(i), width: 12 })),
      ...(showOtherCol ? [{ header: 'Other', key: 'otherFee', width: 12 }] : []),
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    ];
    styleColumnHeaderRow(bookings.getRow(1));
    bookings.views = [{ state: 'frozen', ySplit: 1 }];
    const currencyKeys = new Set([
      'courtFee', 'lightFee', 'ballBoyFee', 'guestFee', 'rentalFee', 'coachingFee', 'amount',
      ...feeNames.map((_, i) => feeColumnKey(i)),
      ...(showOtherCol ? ['otherFee'] : []),
    ]);
    const applyCurrencyCols = (row: import('exceljs').Row) => {
      bookings.columns.forEach((col, idx) => {
        if (col.key && currencyKeys.has(col.key)) row.getCell(idx + 1).numFmt = CURRENCY_FMT;
      });
    };

    const feeTotalFor = (b: BookingDetailRow, name: string) => b.additionalFees.find((f) => f.name === name)?.total ?? 0;
    r.bookings.forEach((b, i) => {
      const rowData: Record<string, string | number> = {
        date: new Date(b.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }),
        time: b.timeSlot,
        duration: b.durationHours,
        courtFee: b.courtFee,
        lightFee: b.lightFee,
        ballBoyFee: b.ballBoyFee,
        guestFee: b.guestFee,
        rentalFee: b.rentalFee,
        coachingFee: b.coachingFee,
        amount: b.amount,
        status: b.chargeStatus === 'paid' ? 'Paid' : 'Unpaid',
        paymentMethod: b.paymentMethod ?? '—',
      };
      feeNames.forEach((name, fi) => (rowData[feeColumnKey(fi)] = feeTotalFor(b, name)));
      if (showOtherCol) rowData['otherFee'] = b.otherFee;
      const row = bookings.addRow(rowData);
      styleGridRow(row, i % 2 === 1);
      applyCurrencyCols(row);
    });
    if (r.bookings.length) {
      const sum = (key: keyof BookingDetailRow) => r.bookings.reduce((s, b) => s + (b[key] as number), 0);
      const totalsRow: Record<string, string | number> = {
        date: `Total (${r.bookings.length} bookings)`,
        duration: sum('durationHours'),
        courtFee: sum('courtFee'),
        lightFee: sum('lightFee'),
        ballBoyFee: sum('ballBoyFee'),
        guestFee: sum('guestFee'),
        rentalFee: sum('rentalFee'),
        coachingFee: sum('coachingFee'),
        amount: sum('amount'),
      };
      feeNames.forEach((name, i) => {
        totalsRow[feeColumnKey(i)] = r.bookings.reduce((s, b) => s + feeTotalFor(b, name), 0);
      });
      if (showOtherCol) totalsRow['otherFee'] = sum('otherFee');
      const row = bookings.addRow(totalsRow);
      styleTotalsRow(row);
      applyCurrencyCols(row);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = this.reportFrom && this.reportTo ? `${this.reportFrom}-to-${this.reportTo}` : 'all-time';
    a.download = `finance-report-${label}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printReport() {
    window.print();
  }
}
