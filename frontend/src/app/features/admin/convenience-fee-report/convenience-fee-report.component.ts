import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import {
  AppServicePayment,
  AppServicePaymentsService,
  FeeReport,
  FeeReportTransaction,
} from '../../../core/services/app-service-payments.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Club } from '../../../core/services/club.service';

@Component({
  selector: 'app-convenience-fee-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cfr-shell">

      <!-- Header -->
      <div class="cfr-header">
        <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
        <div class="header-info">
          <p class="cfr-kicker"><i class="fas fa-percent"></i> Superadmin</p>
          <h2 class="cfr-title">Convenience Fee Report</h2>
          <p class="cfr-subtitle">Analytics for app service fees earned across all booking types</p>
        </div>
      </div>

      <div class="page-tabs">
        <button class="page-tab" [class.active]="activeTab() === 'fees'" (click)="activeTab.set('fees')">
          <i class="fas fa-chart-line"></i> Fee Report
        </button>
        <button class="page-tab" [class.active]="activeTab() === 'payments'" (click)="activeTab.set('payments')">
          <i class="fas fa-receipt"></i> Developer Payments
          @if (developerPayments().length > 0) {
            <span class="tab-count">{{ developerPayments().length }}</span>
          }
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <div class="date-row">
          <input type="date" class="filter-input" [(ngModel)]="startDateVal" />
          <span class="date-sep">to</span>
          <input type="date" class="filter-input" [(ngModel)]="endDateVal" />
          <button class="btn-search" (click)="load()"><i class="fas fa-search"></i> Apply</button>
          <button class="btn-clear" (click)="clearFilters()"><i class="fas fa-times"></i></button>
        </div>
        <div class="preset-row">
          <button class="preset-btn" [class.active]="activePreset() === 'this-month'" (click)="applyPreset('this-month')">This Month</button>
          <button class="preset-btn" [class.active]="activePreset() === 'last-month'" (click)="applyPreset('last-month')">Last Month</button>
          <button class="preset-btn" [class.active]="activePreset() === 'last-3-months'" (click)="applyPreset('last-3-months')">Last 3 Months</button>
          <button class="preset-btn" [class.active]="activePreset() === 'ytd'" (click)="applyPreset('ytd')">Year to Date</button>
          <button class="preset-btn" [class.active]="activePreset() === 'all-time'" (click)="applyPreset('all-time')">All Time</button>
        </div>
        <div class="club-row">
          <select class="filter-input club-select" [(ngModel)]="selectedClubId" (ngModelChange)="load()">
            <option value="">All Clubs</option>
            @for (club of clubs(); track club._id) {
              <option [value]="club._id">{{ club.name }}</option>
            }
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="cfr-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading report…</div>
      } @else if (!report()) {
        <div class="cfr-empty">
          <i class="fas fa-chart-line cfr-empty-icon"></i>
          <p>Select a date range and click Apply.</p>
        </div>
      } @else if (activeTab() === 'payments') {

        <div class="summary-bar">
          <div class="stat-pill pill-green">
            <span class="stat-value">{{ developerPaymentTotal() | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
            <span class="stat-label">Paid to Developer</span>
          </div>
          <div class="stat-pill">
            <span class="stat-value">{{ developerPayments().length | number }}</span>
            <span class="stat-label">Recorded Payments</span>
          </div>
          <div class="stat-pill">
            <span class="stat-value">{{ developerPaymentsWithProof() | number }}</span>
            <span class="stat-label">With Screenshot</span>
          </div>
        </div>

        <div class="section-card">
          <div class="section-header">
            <h3 class="section-title">Developer Payment Proofs</h3>
          </div>
          @if (developerPayments().length === 0) {
            <div class="cfr-empty compact-empty">
              <i class="fas fa-inbox cfr-empty-icon"></i>
              <p>No developer payments found for this filter.</p>
            </div>
          } @else {
            <div class="table-scroll">
              <table class="cfr-table">
                <thead><tr>
                  <th>Date</th>
                  <th>Club</th>
                  <th>Paid By</th>
                  <th>Method</th>
                  <th>Note</th>
                  <th>Proof</th>
                  <th class="num-col">Amount</th>
                </tr></thead>
                <tbody>
                  @for (p of developerPayments(); track p._id) {
                    <tr>
                      <td class="cell-date">{{ p.createdAt | date: 'MMM d, y' : 'UTC' }}</td>
                      <td class="club-name">{{ getPaymentClubName(p) }}</td>
                      <td>{{ p.paidBy?.name ?? '—' }}</td>
                      <td><span class="method-badge">{{ p.paymentMethod ?? '—' }}</span></td>
                      <td class="muted note-cell">{{ p.note || '—' }}</td>
                      <td>
                        @if (p.paymentScreenshot) {
                          <a class="proof-link" [href]="p.paymentScreenshot" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-image"></i> View
                          </a>
                        } @else {
                          <span class="missing-proof">No proof</span>
                        }
                      </td>
                      <td class="num-col fee-val">{{ p.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

      } @else {

        <!-- Summary Pills -->
        <div class="summary-bar">
          <div class="stat-pill pill-green">
            <span class="stat-value">{{ report()!.summary.totalFees | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
            <span class="stat-label">Total Fees Earned</span>
          </div>
          <div class="stat-pill">
            <span class="stat-value">{{ report()!.summary.txCount | number }}</span>
            <span class="stat-label">Bookings with Fee</span>
          </div>
          <div class="stat-pill">
            <span class="stat-value">{{ report()!.summary.avgFee | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
            <span class="stat-label">Avg Fee per Booking</span>
          </div>
        </div>

        @if (report()!.summary.txCount === 0) {
          <div class="cfr-empty">
            <i class="fas fa-calendar-xmark cfr-empty-icon"></i>
            <p>No convenience fees found in this period.</p>
          </div>
        } @else {

          <!-- Trend Section -->
          <div class="section-card">
            <div class="section-header">
              <h3 class="section-title">Fee Trend</h3>
              <div class="tab-row">
                <button class="tab-btn" [class.active]="trendTab() === 'monthly'" (click)="trendTab.set('monthly')">Monthly</button>
                <button class="tab-btn" [class.active]="trendTab() === 'daily'" (click)="trendTab.set('daily')">Daily</button>
              </div>
            </div>

            @if (trendTab() === 'monthly') {
              <div class="table-scroll">
                <table class="cfr-table">
                  <thead><tr>
                    <th>Month</th>
                    <th class="num-col">Bookings</th>
                    <th class="num-col">Fees Earned</th>
                    <th class="num-col">Avg Fee</th>
                  </tr></thead>
                  <tbody>
                    @for (row of report()!.byMonth; track row.month) {
                      <tr>
                        <td>{{ formatMonth(row.month) }}</td>
                        <td class="num-col">{{ row.count }}</td>
                        <td class="num-col fee-val">{{ row.fees | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                        <td class="num-col muted">{{ row.count > 0 ? (row.fees / row.count | currency: 'PHP' : 'symbol' : '1.2-2') : '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="table-scroll">
                <table class="cfr-table">
                  <thead><tr>
                    <th>Date</th>
                    <th class="num-col">Bookings</th>
                    <th class="num-col">Fees Earned</th>
                    <th class="num-col">Avg Fee</th>
                  </tr></thead>
                  <tbody>
                    @for (row of report()!.byDay; track row.day) {
                      <tr>
                        <td>{{ formatDay(row.day) }}</td>
                        <td class="num-col">{{ row.count }}</td>
                        <td class="num-col fee-val">{{ row.fees | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                        <td class="num-col muted">{{ row.count > 0 ? (row.fees / row.count | currency: 'PHP' : 'symbol' : '1.2-2') : '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <!-- Per-Club Breakdown -->
          <div class="section-card">
            <div class="section-header">
              <h3 class="section-title">By Club</h3>
            </div>
            <div class="table-scroll">
              <table class="cfr-table">
                <thead><tr>
                  <th>Club</th>
                  <th>Fee Mode</th>
                  <th class="num-col">Rate</th>
                  <th class="num-col">Reservations</th>
                  <th class="num-col">Fees Earned</th>
                  <th class="num-col">% of Total</th>
                </tr></thead>
                <tbody>
                  @for (row of report()!.byClub; track row.clubId) {
                    <tr>
                      <td class="club-name">{{ row.clubName }}</td>
                      <td><span class="mode-badge">{{ formatFeeMode(row.feeMode) }}</span></td>
                      <td class="num-col muted">{{ row.feeMode === 'monthly_flat' ? 'Flat' : (row.feeRate * 100 | number: '1.0-1') + '%' }}</td>
                      <td class="num-col">{{ row.count }}</td>
                      <td class="num-col fee-val">{{ row.fees | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="num-col muted">{{ pctOfTotal(row.fees) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Transactions -->
          <div class="section-card">
            <div class="section-header">
              <h3 class="section-title">Transactions <span class="tx-count">({{ report()!.transactions.length }})</span></h3>
              <button class="btn-export" (click)="exportCsv()" [disabled]="!report()!.transactions.length">
                <i class="fas fa-download"></i> Export CSV
              </button>
            </div>
            <div class="table-scroll">
              <table class="cfr-table">
                <thead><tr>
                  <th>Date</th>
                  <th>Club</th>
                  <th>Player</th>
                  <th>Type</th>
                  <th class="num-col">Booking Amt</th>
                  <th class="num-col">Conv. Fee</th>
                </tr></thead>
                <tbody>
                  @for (tx of pagedTransactions(); track $index) {
                    <tr>
                      <td class="cell-date">{{ tx.date | date: 'MMM d, y' : 'UTC' }}</td>
                      <td class="club-name">{{ tx.clubName }}</td>
                      <td>{{ tx.playerName }}</td>
                      <td><span class="type-badge type-{{ tx.chargeType ?? 'reservation' }}">{{ formatChargeType(tx.chargeType) }}</span></td>
                      <td class="num-col muted">{{ tx.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      <td class="num-col fee-val">{{ tx.convenienceFee | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (totalPages() > 1) {
              <div class="pagination">
                <button class="page-btn" (click)="page.set(page() - 1)" [disabled]="page() === 0">
                  <i class="fas fa-chevron-left"></i>
                </button>
                <span class="page-info">{{ page() + 1 }} / {{ totalPages() }}</span>
                <button class="page-btn" (click)="page.set(page() + 1)" [disabled]="page() >= totalPages() - 1">
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
            }
          </div>

          <!-- Queue Management Fees -->
          @if (queueMgmtBillings().length > 0) {
            <div class="section-card">
              <div class="section-header">
                <h3 class="section-title">Queue Management Fees <span class="tx-count">({{ queueMgmtBillings().length }})</span></h3>
                <div class="stat-inline">
                  <span class="fee-val">{{ queueMgmtBillingTotal() | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
                  <span class="muted"> total billed</span>
                </div>
              </div>
              <div class="table-scroll">
                <table class="cfr-table">
                  <thead><tr>
                    <th>Date</th>
                    <th>Club</th>
                    <th>Billed By</th>
                    <th>Note</th>
                    <th class="num-col">Amount</th>
                  </tr></thead>
                  <tbody>
                    @for (p of queueMgmtBillings(); track p._id) {
                      <tr>
                        <td class="cell-date">{{ p.createdAt | date: 'MMM d, y' : 'UTC' }}</td>
                        <td class="club-name">{{ getPaymentClubName(p) }}</td>
                        <td>{{ p.paidBy?.name ?? '—' }}</td>
                        <td class="muted note-cell">{{ p.note || '—' }}</td>
                        <td class="num-col fee-val">{{ p.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #0c1a11;
      --surface: #1b3028;
      --surface-hover: #213830;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.5);
      --accent: #a3e635;
    }

    .cfr-shell {
      min-height: calc(100vh - 60px);
      background: var(--bg);
      padding: 1.5rem 1rem 4rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    /* Header */
    .cfr-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .back-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      width: 36px;
      height: 36px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
      transition: background .15s;
    }
    .back-btn:hover { background: var(--surface-hover); }
    .header-info { flex: 1; }
    .cfr-kicker {
      margin: 0 0 .2rem;
      font-size: .72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--accent);
    }
    .cfr-title {
      margin: 0 0 .2rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
    }
    .cfr-subtitle {
      margin: 0;
      font-size: .85rem;
      color: var(--muted);
    }

    .page-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem;
      margin-bottom: 1rem;
    }
    .page-tab {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      padding: .55rem .85rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--muted);
      font-size: .84rem;
      font-weight: 700;
      cursor: pointer;
      transition: all .15s;
    }
    .page-tab:hover { border-color: rgba(163,230,53,.35); color: var(--accent); }
    .page-tab.active { background: rgba(163,230,53,.12); border-color: var(--accent); color: var(--accent); }
    .tab-count {
      min-width: 18px;
      height: 18px;
      padding: 0 .35rem;
      border-radius: 999px;
      background: rgba(163,230,53,.18);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .68rem;
    }

    /* Filters */
    .filters-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: .75rem;
    }
    .date-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .5rem;
    }
    .date-sep {
      font-size: .82rem;
      color: var(--muted);
    }
    .filter-input {
      padding: .42rem .75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: .88rem;
      outline: none;
      color-scheme: dark;
      transition: border-color .15s;
    }
    .filter-input:focus { border-color: var(--accent); }
    .btn-search {
      padding: .42rem 1rem;
      background: var(--accent);
      color: #0c1a11;
      border: none;
      border-radius: 8px;
      font-size: .82rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: .35rem;
      transition: opacity .15s;
    }
    .btn-search:hover { opacity: .85; }
    .btn-clear {
      padding: .42rem .75rem;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--muted);
      cursor: pointer;
      font-size: .82rem;
      transition: all .15s;
    }
    .btn-clear:hover { background: var(--surface-hover); color: var(--text); }
    .preset-row {
      display: flex;
      flex-wrap: wrap;
      gap: .4rem;
    }
    .preset-btn {
      padding: .3rem .7rem;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--muted);
      font-size: .78rem;
      cursor: pointer;
      transition: all .15s;
    }
    .preset-btn:hover { border-color: var(--accent); color: var(--accent); }
    .preset-btn.active { background: rgba(163,230,53,.12); border-color: var(--accent); color: var(--accent); font-weight: 600; }
    .club-row { display: flex; }
    .club-select { min-width: 180px; }
    .filter-input option { background: #1b3028; }

    /* States */
    .cfr-loading {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: 3rem 0;
      color: var(--muted);
      font-size: .9rem;
    }
    .cfr-empty {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--muted);
    }
    .cfr-empty-icon {
      font-size: 2.5rem;
      color: var(--accent);
      opacity: .3;
      display: block;
      margin-bottom: .75rem;
    }
    .cfr-empty p { font-size: .92rem; margin: 0; }
    .compact-empty { padding: 2.5rem 1rem; }

    /* Summary bar */
    .summary-bar {
      display: flex;
      flex-wrap: wrap;
      gap: .75rem;
      margin-bottom: 1.5rem;
    }
    .stat-pill {
      display: flex;
      flex-direction: column;
      padding: .85rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      min-width: 140px;
    }
    .stat-pill.pill-green { border-color: rgba(163,230,53,.3); }
    .stat-pill.pill-green .stat-value { color: var(--accent); }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1;
    }
    .stat-label {
      font-size: .7rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
      margin-top: .35rem;
      white-space: nowrap;
    }

    /* Section cards */
    .section-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 1.25rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .85rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    .section-title {
      margin: 0;
      font-size: .95rem;
      font-weight: 700;
      color: var(--text);
    }
    .tx-count {
      font-weight: 400;
      color: var(--muted);
      font-size: .85rem;
    }
    .tab-row {
      display: flex;
      gap: .3rem;
    }
    .tab-btn {
      padding: .3rem .75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      font-size: .8rem;
      cursor: pointer;
      transition: all .15s;
    }
    .tab-btn.active { background: rgba(163,230,53,.12); border-color: var(--accent); color: var(--accent); font-weight: 600; }
    .tab-btn:hover:not(.active) { border-color: rgba(255,255,255,.2); color: var(--text); }

    /* Tables */
    .table-scroll { overflow-x: auto; }
    .cfr-table {
      width: 100%;
      border-collapse: collapse;
      font-size: .87rem;
    }
    .cfr-table th {
      background: var(--bg);
      color: var(--accent);
      text-align: left;
      padding: .65rem 1rem;
      font-size: .7rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
    }
    .cfr-table td {
      padding: .7rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      vertical-align: middle;
    }
    .cfr-table tr:last-child td { border-bottom: none; }
    .cfr-table tr:hover td { background: rgba(255,255,255,.02); }
    .num-col { text-align: right; }
    .fee-val { color: var(--accent); font-weight: 600; }
    .muted { color: var(--muted); }
    .cell-date { white-space: nowrap; color: var(--muted); }
    .club-name { font-weight: 500; }
    .mode-badge {
      display: inline-block;
      padding: .18rem .5rem;
      border: 1px solid var(--border);
      border-radius: 5px;
      font-size: .72rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .method-badge {
      display: inline-block;
      padding: .18rem .5rem;
      border-radius: 5px;
      background: rgba(139,92,246,.16);
      color: #c4b5fd;
      font-size: .72rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .note-cell {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .proof-link {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      color: #93c5fd;
      font-size: .8rem;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }
    .proof-link:hover { text-decoration: underline; }
    .missing-proof {
      color: #fca5a5;
      font-size: .78rem;
      font-weight: 700;
    }
    /* Export button */
    .btn-export {
      padding: .35rem .85rem;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 7px;
      color: var(--muted);
      font-size: .8rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: .35rem;
      transition: all .15s;
    }
    .btn-export:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    .btn-export:disabled { opacity: .4; cursor: default; }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .75rem;
      padding: .75rem 1rem;
      border-top: 1px solid var(--border);
    }
    .page-btn {
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 7px;
      color: var(--text);
      width: 32px;
      height: 32px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: .8rem;
      transition: all .15s;
    }
    .page-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    .page-btn:disabled { opacity: .35; cursor: default; }
    .page-info { font-size: .82rem; color: var(--muted); }

    .type-badge {
      display: inline-block;
      padding: .18rem .5rem;
      border-radius: 5px;
      font-size: .7rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .type-reservation { background: rgba(99,102,241,.18); color: #a5b4fc; }
    .type-open_play_session { background: rgba(234,179,8,.14); color: #fde047; }
    .type-per_game { background: rgba(249,115,22,.14); color: #fdba74; }
    .type-hosted_play { background: rgba(163,230,53,.14); color: #a3e635; }

    .stat-inline {
      font-size: .88rem;
    }

    @media (max-width: 600px) {
      .cfr-shell { padding: 1rem .75rem 3rem; }
      .stat-pill { min-width: unset; flex: 1 1 120px; }
    }
  `],
})
export class ConvenienceFeeReportComponent implements OnInit {
  private svc = inject(AppServicePaymentsService);
  private clubSvc = inject(ClubService);
  private router = inject(Router);
  readonly authService = inject(AuthService);

  loading = signal(false);
  report = signal<FeeReport | null>(null);
  payments = signal<AppServicePayment[]>([]);
  clubs = signal<Club[]>([]);
  startDateVal = '';
  endDateVal = '';
  selectedClubId = '';
  activeTab = signal<'fees' | 'payments'>('fees');
  trendTab = signal<'monthly' | 'daily'>('monthly');
  page = signal(0);
  activePreset = signal<string>('last-3-months');

  private readonly PAGE_SIZE = 50;

  pagedTransactions = computed<FeeReportTransaction[]>(() => {
    const txs = this.report()?.transactions ?? [];
    return txs.slice(this.page() * this.PAGE_SIZE, (this.page() + 1) * this.PAGE_SIZE);
  });

  totalPages = computed(() => Math.ceil((this.report()?.transactions.length ?? 0) / this.PAGE_SIZE));

  developerPayments = computed(() =>
    this.payments().filter((payment) => (payment.type ?? 'payment') === 'payment')
  );

  developerPaymentTotal = computed(() =>
    this.developerPayments().reduce((sum, payment) => sum + payment.amount, 0)
  );

  developerPaymentsWithProof = computed(() =>
    this.developerPayments().filter((payment) => !!payment.paymentScreenshot).length
  );

  queueMgmtBillings = computed(() =>
    this.payments().filter((p) => p.type === 'billing')
  );

  queueMgmtBillingTotal = computed(() =>
    this.queueMgmtBillings().reduce((sum, p) => sum + p.amount, 0)
  );

  ngOnInit() {
    this.clubSvc.getClubs().subscribe((list) =>
      this.clubs.set(list.filter((c) => c.status !== 'suspended').sort((a, b) => a.name.localeCompare(b.name)))
    );
    this.applyPreset('last-3-months');
  }

  load() {
    this.loading.set(true);
    this.page.set(0);
    const params = {
      startDate: this.startDateVal || undefined,
      endDate: this.endDateVal || undefined,
      clubId: this.selectedClubId || undefined,
    };
    forkJoin({
      report: this.svc.getFeeReport(params),
      payments: this.svc.getAll(params.clubId, params.startDate, params.endDate),
    }).subscribe({
      next: ({ report, payments }) => {
        this.report.set(report);
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyPreset(preset: string) {
    this.activePreset.set(preset);
    const now = new Date();
    if (preset === 'all-time') {
      this.startDateVal = '';
      this.endDateVal = '';
    } else if (preset === 'this-month') {
      this.startDateVal = this.toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
      this.endDateVal = this.toInputDate(now);
    } else if (preset === 'last-month') {
      this.startDateVal = this.toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      this.endDateVal = this.toInputDate(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (preset === 'last-3-months') {
      this.startDateVal = this.toInputDate(new Date(now.getFullYear(), now.getMonth() - 3, 1));
      this.endDateVal = this.toInputDate(now);
    } else if (preset === 'ytd') {
      this.startDateVal = this.toInputDate(new Date(now.getFullYear(), 0, 1));
      this.endDateVal = this.toInputDate(now);
    }
    this.load();
  }

  clearFilters() {
    this.startDateVal = '';
    this.endDateVal = '';
    this.selectedClubId = '';
    this.activePreset.set('');
    this.load();
  }

  exportCsv() {
    const txs = this.report()?.transactions ?? [];
    if (!txs.length) return;
    const header = 'Date,Club,Player,Type,Booking Amount,Convenience Fee';
    const rows = txs.map((t) => [
      new Date(t.date).toLocaleDateString('en-US'),
      `"${t.clubName.replace(/"/g, '""')}"`,
      `"${t.playerName.replace(/"/g, '""')}"`,
      this.formatChargeType(t.chargeType),
      t.amount.toFixed(2),
      t.convenienceFee.toFixed(2),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = this.startDateVal && this.endDateVal ? `${this.startDateVal}-to-${this.endDateVal}` : 'all-time';
    a.download = `convenience-fee-report-${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  formatMonth(month: string | null): string {
    if (!month) return 'Unknown';
    const [year, m] = month.split('-');
    return new Date(+year, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  formatDay(day: string | null): string {
    if (!day) return 'Unknown';
    const [year, m, d] = day.split('-');
    return new Date(+year, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatChargeType(type?: string): string {
    return ({
      reservation: 'Reservation',
      open_play_session: 'Open Play',
      per_game: 'Per Game',
      hosted_play: 'Hosted Play',
    } as Record<string, string>)[type ?? 'reservation'] ?? type ?? 'Reservation';
  }

  formatFeeMode(mode: string): string {
    return ({ per_hour: 'Per Hour', per_transaction: 'Per Transaction', monthly_flat: 'Monthly Flat' } as Record<string, string>)[mode] ?? mode;
  }

  pctOfTotal(fees: number): string {
    const total = this.report()?.summary.totalFees ?? 0;
    if (!total) return '—';
    return (fees / total * 100).toFixed(1) + '%';
  }

  getPaymentClubName(payment: AppServicePayment): string {
    if (payment.clubId && typeof payment.clubId === 'object') return payment.clubId.name;
    const club = this.clubs().find((c) => c._id === payment.clubId);
    return club?.name ?? 'Unknown';
  }

  goBack() { this.router.navigate(['/admin/dashboard']); }

  private toInputDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}
