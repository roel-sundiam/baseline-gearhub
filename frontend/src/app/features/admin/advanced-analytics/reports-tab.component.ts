import { Component, Input, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Workbook } from 'exceljs';
import {
  ClubAnalyticsService,
  ReportFilters,
  BookingReportRow,
  RevenueReportRow,
  CourtUtilizationReportRow,
  CustomerReportRow,
} from '../../../core/services/club-analytics.service';
import { styleColumnHeaderRow, styleTotalsRow, styleGridRow, currencyCell, CURRENCY_FMT } from '../../../core/utils/excel-report.util';
import { rowsToCsv, downloadCsv } from '../../../core/utils/csv-report.util';

type ReportType = 'bookings' | 'revenue' | 'court-utilization' | 'customers';

const PAYMENT_METHODS = ['GCash', 'Cash', 'Bank Transfer', 'GoTyme', 'Credit'];

@Component({
  selector: 'app-reports-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rt-shell">
      <div class="report-type-bar">
        <button class="type-chip" [class.type-chip--active]="reportType() === 'bookings'" (click)="selectType('bookings')">
          <i class="fas fa-calendar-check"></i> Booking Report
        </button>
        <button class="type-chip" [class.type-chip--active]="reportType() === 'revenue'" (click)="selectType('revenue')">
          <i class="fas fa-peso-sign"></i> Revenue Report
        </button>
        <button class="type-chip" [class.type-chip--active]="reportType() === 'court-utilization'" (click)="selectType('court-utilization')">
          <i class="fas fa-chart-pie"></i> Court Utilization
        </button>
        <button class="type-chip" [class.type-chip--active]="reportType() === 'customers'" (click)="selectType('customers')">
          <i class="fas fa-users"></i> Customer Activity
        </button>
      </div>

      <div class="filter-bar">
        <label class="filter-field">
          <span class="field-label">From</span>
          <input type="date" class="field-input" [(ngModel)]="from" />
        </label>
        <label class="filter-field">
          <span class="field-label">To</span>
          <input type="date" class="field-input" [(ngModel)]="to" />
        </label>
        <label class="filter-field">
          <span class="field-label">Court</span>
          <input type="number" min="1" class="field-input field-input--sm" placeholder="All" [(ngModel)]="court" />
        </label>
        @if (reportType() === 'bookings' || reportType() === 'revenue') {
          <label class="filter-field">
            <span class="field-label">Booking Type</span>
            <select class="field-input" [(ngModel)]="bookingType">
              <option [ngValue]="null">All</option>
              <option value="reservation">Reservation</option>
              <option value="per_game">Per Game</option>
              <option value="hosted_play">Hosted Play</option>
            </select>
          </label>
        }
        @if (reportType() === 'bookings') {
          <label class="filter-field">
            <span class="field-label">Booking Status</span>
            <select class="field-input" [(ngModel)]="status">
              <option [ngValue]="null">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        }
        @if (reportType() === 'bookings' || reportType() === 'revenue') {
          <label class="filter-field">
            <span class="field-label">Payment Status</span>
            <select class="field-input" [(ngModel)]="paymentStatus">
              <option [ngValue]="null">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label class="filter-field">
            <span class="field-label">Payment Method</span>
            <select class="field-input" [(ngModel)]="paymentMethod">
              <option [ngValue]="null">All</option>
              @for (m of paymentMethods; track m) {
                <option [value]="m">{{ m }}</option>
              }
            </select>
          </label>
        }
        <button class="btn-primary" [disabled]="loading()" (click)="runReport()">
          <i class="fas {{ loading() ? 'fa-circle-notch fa-spin' : 'fa-search' }}"></i> Generate
        </button>
        <div class="export-actions">
          <button class="btn-ghost btn-sm" [disabled]="!hasResults()" (click)="exportExcel()">
            <i class="fas fa-file-excel"></i> Export Excel
          </button>
          <button class="btn-ghost btn-sm" [disabled]="!hasResults()" (click)="exportCsv()">
            <i class="fas fa-file-csv"></i> Export CSV
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Generating report…</div>
      } @else if (!hasResults()) {
        <div class="state-empty">Choose a report type and date range, then click Generate.</div>
      } @else {
        <div class="results-card">
          <div class="results-table-wrap">
            @if (reportType() === 'bookings') {
              <table class="results-table">
                <thead>
                  <tr>
                    <th>Booking Date</th><th>Customer</th><th>Court</th><th>Booking Type</th>
                    <th>Start</th><th>End</th><th class="col-num">Duration</th><th class="col-num">Amount</th>
                    <th>Payment Status</th><th>Booking Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of bookingRows(); track $index) {
                    <tr>
                      <td>{{ r.bookingDate | date: 'MMM d, y' : 'UTC' }}</td>
                      <td>{{ r.customer }}</td>
                      <td>{{ r.court ?? '—' }}</td>
                      <td>{{ r.bookingType }}</td>
                      <td>{{ r.startTime ?? '—' }}</td>
                      <td>{{ r.endTime ?? '—' }}</td>
                      <td class="col-num">{{ r.durationHours ?? '—' }}</td>
                      <td class="col-num">{{ r.amount | currency: 'PHP' : 'symbol' : '1.0-2' }}</td>
                      <td>{{ r.paymentStatus ?? '—' }}</td>
                      <td>{{ r.bookingStatus ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @if (reportType() === 'revenue') {
              <table class="results-table">
                <thead>
                  <tr><th>Date</th><th>Booking Type</th><th>Customer</th><th>Court</th><th class="col-num">Amount</th><th>Payment Method</th><th>Payment Status</th></tr>
                </thead>
                <tbody>
                  @for (r of revenueRows(); track $index) {
                    <tr>
                      <td>{{ r.date | date: 'MMM d, y' : 'UTC' }}</td>
                      <td>{{ r.bookingType }}</td>
                      <td>{{ r.customer }}</td>
                      <td>{{ r.court ?? '—' }}</td>
                      <td class="col-num">{{ r.amount | currency: 'PHP' : 'symbol' : '1.0-2' }}</td>
                      <td>{{ r.paymentMethod ?? '—' }}</td>
                      <td>{{ r.paymentStatus }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @if (reportType() === 'court-utilization') {
              <table class="results-table">
                <thead>
                  <tr><th>Court</th><th class="col-num">Available Hours</th><th class="col-num">Booked Hours</th><th class="col-num">Utilization %</th></tr>
                </thead>
                <tbody>
                  @for (r of courtUtilizationRows(); track $index) {
                    <tr>
                      <td>{{ r.court }}</td>
                      <td class="col-num">{{ r.availableHours | number: '1.0-1' }}</td>
                      <td class="col-num">{{ r.bookedHours | number: '1.0-1' }}</td>
                      <td class="col-num">{{ r.utilizationPct === null ? '—' : (r.utilizationPct + '%') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @if (reportType() === 'customers') {
              <table class="results-table">
                <thead>
                  <tr><th>Customer</th><th class="col-num">Number of Bookings</th><th class="col-num">Total Revenue</th><th>Last Booking</th></tr>
                </thead>
                <tbody>
                  @for (r of customerRows(); track $index) {
                    <tr>
                      <td>{{ r.customer }}</td>
                      <td class="col-num">{{ r.bookings | number }}</td>
                      <td class="col-num">{{ r.revenue | currency: 'PHP' : 'symbol' : '1.0-2' }}</td>
                      <td>{{ r.lastBooking | date: 'MMM d, y' : 'UTC' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .rt-shell { display: grid; gap: 1rem; }
    .report-type-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .type-chip {
      padding: 0.5rem 0.9rem; border-radius: 10px; border: 1px solid rgba(250,204,21,0.22);
      background: transparent; color: rgba(255,255,255,0.65); font-size: 0.82rem; font-weight: 700;
      cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; font-family: inherit;
    }
    .type-chip--active { background: rgba(250,204,21,0.14); color: #facc15; border-color: #facc15; }

    .filter-bar {
      display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: flex-end;
      background: var(--dm-surface, #1a1f2e); border: 1px solid rgba(250,204,21,0.22); border-radius: 14px; padding: 0.9rem;
    }
    .filter-field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-label { font-size: 0.72rem; color: rgba(255,255,255,0.55); }
    .field-input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px;
      padding: 0.4rem 0.6rem; color: #fff; font-size: 0.85rem; font-family: inherit;
    }
    .field-input--sm { width: 80px; }
    .export-actions { margin-left: auto; display: flex; gap: 0.45rem; flex-wrap: wrap; }

    .btn-primary, .btn-ghost { border-radius: 10px; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.4rem; }
    .btn-primary { background: #facc15; color: #1a1f2e; border: none; padding: 0.55rem 1.1rem; font-size: 0.86rem; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.75); padding: 0.4rem 0.8rem; font-size: 0.8rem; }
    .btn-ghost:disabled { opacity: 0.4; cursor: default; }
    .btn-sm { padding: 0.35rem 0.7rem; font-size: 0.78rem; }

    .state-msg, .state-empty {
      color: rgba(255,255,255,0.6); font-size: 0.9rem; padding: 2rem; text-align: center;
      background: var(--dm-surface, #1a1f2e); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px;
    }

    .results-card { background: var(--dm-surface, #1a1f2e); border: 1px solid rgba(250,204,21,0.22); border-radius: 16px; padding: 1rem 1.1rem; box-shadow: 0 4px 14px rgba(0,0,0,0.24); }
    .results-table-wrap { overflow-x: auto; }
    .results-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; white-space: nowrap; }
    .results-table th { text-align: left; padding: 0.5rem 0.6rem; color: rgba(255,255,255,0.55); font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .results-table td { padding: 0.5rem 0.6rem; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .col-num { text-align: right; }

    /* Light admin theme */
    .report-type-bar { width: fit-content; padding: 4px; gap: 2px; border: 1px solid #e7dac7; border-radius: 12px; background: #f5ede2; }
    .type-chip { border: 0; color: #7d7162; border-radius: 9px; }
    .type-chip:hover { color: #3f372f; }
    .type-chip--active { background: #fff; color: #8f672f; border-color: transparent; box-shadow: 0 2px 8px rgba(82,57,27,0.12); }
    .filter-bar { background: #fff; border-color: #e7dac7; border-radius: 16px; padding: 1rem; box-shadow: 0 7px 22px rgba(83,61,34,0.06); }
    .field-label { color: #766b5e; font-weight: 700; }
    .field-input { background: #fff; border-color: #d8cbbc; color: #352f28; }
    .field-input:focus { outline: 3px solid rgba(184,137,66,0.13); border-color: #b88942; }
    .btn-primary { background: #b88942; color: #fff; box-shadow: 0 4px 12px rgba(184,137,66,0.2); }
    .btn-primary:hover:not(:disabled) { background: #9f7338; }
    .btn-ghost { background: #fff; border-color: #d8cbbc; color: #73685b; }
    .btn-ghost:hover:not(:disabled) { background: #f3eadf; color: #413931; }
    .state-msg, .state-empty { color: #817565; background: #fff; border-color: #e9dece; box-shadow: 0 6px 20px rgba(83,61,34,0.05); }
    .results-card { background: #fff; border-color: #eadfce; border-radius: 18px; box-shadow: 0 8px 24px rgba(83,61,34,0.07); }
    .results-table th { color: #8f8273; border-bottom-color: #e8ddce; }
    .results-table td { color: #51483e; border-bottom-color: #f0e8dc; }
    .results-table tbody tr:hover { background: #fcf9f4; }
    @media (max-width: 620px) {
      .report-type-bar { width: 100%; overflow-x: auto; flex-wrap: nowrap; box-sizing: border-box; }
      .type-chip { white-space: nowrap; }
      .export-actions { margin-left: 0; flex-basis: 100%; }
    }

    /* Dark-green reports palette */
    .report-type-bar { background: #14271e; border-color: rgba(255,255,255,0.08); }
    .type-chip { color: rgba(255,255,255,0.5); }
    .type-chip:hover { color: #fff; }
    .type-chip--active { color: #a3e635; background: #213b2f; box-shadow: 0 2px 9px rgba(0,0,0,0.24); }
    .filter-bar { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 7px 22px rgba(0,0,0,0.2); }
    .field-label { color: rgba(255,255,255,0.5); }
    .field-input { color: #fff; background: #14271e; border-color: rgba(255,255,255,0.14); color-scheme: dark; }
    .field-input:focus { outline-color: rgba(163,230,53,0.14); border-color: #a3e635; }
    .btn-primary { color: #102015; background: #a3e635; box-shadow: 0 4px 12px rgba(163,230,53,0.17); }
    .btn-primary:hover:not(:disabled) { background: #b8f040; }
    .btn-ghost { color: rgba(255,255,255,0.64); background: transparent; border-color: rgba(255,255,255,0.14); }
    .btn-ghost:hover:not(:disabled) { color: #fff; background: rgba(255,255,255,0.05); }
    .state-msg, .state-empty { color: rgba(255,255,255,0.5); background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
    .results-card { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }
    .results-table th { color: rgba(255,255,255,0.42); border-color: rgba(255,255,255,0.09); }
    .results-table td { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.06); }
    .results-table tbody tr:hover { background: rgba(255,255,255,0.025); }
  `],
})
export class ReportsTabComponent implements OnChanges {
  // Set by the superadmin "view any club" page to pull another club's reports; left undefined
  // for the normal club-admin usage, where the backend resolves the caller's own club.
  @Input() clubId?: string;

  reportType = signal<ReportType>('bookings');
  loading = signal(false);

  from = '';
  to = '';
  court: number | null = null;
  bookingType: 'reservation' | 'per_game' | 'hosted_play' | null = null;
  status: 'confirmed' | 'pending_payment' | 'cancelled' | null = null;
  paymentStatus: 'paid' | 'unpaid' | null = null;
  paymentMethod: string | null = null;
  paymentMethods = PAYMENT_METHODS;

  bookingRows = signal<BookingReportRow[]>([]);
  revenueRows = signal<RevenueReportRow[]>([]);
  courtUtilizationRows = signal<CourtUtilizationReportRow[]>([]);
  customerRows = signal<CustomerReportRow[]>([]);

  hasResults = computed(() => {
    switch (this.reportType()) {
      case 'bookings': return this.bookingRows().length > 0;
      case 'revenue': return this.revenueRows().length > 0;
      case 'court-utilization': return this.courtUtilizationRows().length > 0;
      case 'customers': return this.customerRows().length > 0;
    }
  });

  constructor(private analytics: ClubAnalyticsService) {
    const now = new Date();
    const toDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.from = toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    this.to = toDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

  selectType(t: ReportType) {
    this.reportType.set(t);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['clubId'] && !changes['clubId'].isFirstChange()) {
      // Clear any previously-generated report so a club switch never leaves the last club's
      // rows on screen under the new club's filters.
      this.bookingRows.set([]);
      this.revenueRows.set([]);
      this.courtUtilizationRows.set([]);
      this.customerRows.set([]);
    }
  }

  private filters(): ReportFilters {
    return {
      from: this.from,
      to: this.to,
      court: this.court || null,
      bookingType: this.bookingType,
      status: this.status,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      clubId: this.clubId,
    };
  }

  runReport() {
    if (!this.from || !this.to) return;
    this.loading.set(true);
    const f = this.filters();
    const done = () => this.loading.set(false);
    switch (this.reportType()) {
      case 'bookings':
        this.analytics.getBookingReport(f).subscribe({ next: (r) => { this.bookingRows.set(r.rows); done(); }, error: done });
        break;
      case 'revenue':
        this.analytics.getRevenueReport(f).subscribe({ next: (r) => { this.revenueRows.set(r.rows); done(); }, error: done });
        break;
      case 'court-utilization':
        this.analytics.getCourtUtilizationReport(f).subscribe({ next: (r) => { this.courtUtilizationRows.set(r.rows); done(); }, error: done });
        break;
      case 'customers':
        this.analytics.getCustomerReport(f).subscribe({ next: (r) => { this.customerRows.set(r.rows); done(); }, error: done });
        break;
    }
  }

  private reportLabel(): string {
    switch (this.reportType()) {
      case 'bookings': return 'Booking Report';
      case 'revenue': return 'Revenue Report';
      case 'court-utilization': return 'Court Utilization Report';
      case 'customers': return 'Customer Activity Report';
    }
  }

  private tableData(): { headers: string[]; rows: (string | number | null)[][] } {
    switch (this.reportType()) {
      case 'bookings':
        return {
          headers: ['Booking Date', 'Customer', 'Court', 'Booking Type', 'Start Time', 'End Time', 'Duration', 'Amount', 'Payment Status', 'Booking Status'],
          rows: this.bookingRows().map((r) => [
            new Date(r.bookingDate).toISOString().slice(0, 10), r.customer, r.court, r.bookingType,
            r.startTime, r.endTime, r.durationHours, r.amount, r.paymentStatus, r.bookingStatus,
          ]),
        };
      case 'revenue':
        return {
          headers: ['Date', 'Booking Type', 'Customer', 'Court', 'Amount', 'Payment Method', 'Payment Status'],
          rows: this.revenueRows().map((r) => [
            new Date(r.date).toISOString().slice(0, 10), r.bookingType, r.customer, r.court, r.amount, r.paymentMethod, r.paymentStatus,
          ]),
        };
      case 'court-utilization':
        return {
          headers: ['Court', 'Available Hours', 'Booked Hours', 'Utilization %'],
          rows: this.courtUtilizationRows().map((r) => [r.court, r.availableHours, r.bookedHours, r.utilizationPct]),
        };
      case 'customers':
        return {
          headers: ['Customer', 'Number of Bookings', 'Total Revenue', 'Last Booking Date'],
          rows: this.customerRows().map((r) => [r.customer, r.bookings, r.revenue, new Date(r.lastBooking).toISOString().slice(0, 10)]),
        };
    }
  }

  exportCsv() {
    const { headers, rows } = this.tableData();
    const csv = rowsToCsv(headers, rows);
    downloadCsv(`${this.slug()}-${this.from}-to-${this.to}.csv`, csv);
  }

  async exportExcel() {
    const { headers, rows } = this.tableData();
    const currencyCols = new Set(
      this.reportType() === 'bookings' ? [7] :
      this.reportType() === 'revenue' ? [4] :
      this.reportType() === 'customers' ? [2] : [],
    );

    const wb = new Workbook();
    wb.creator = 'CourtGo';
    wb.created = new Date();
    const ws = wb.addWorksheet(this.reportLabel());
    ws.columns = headers.map((h) => ({ header: h, width: Math.max(14, h.length + 4) }));
    styleColumnHeaderRow(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    rows.forEach((rowData, i) => {
      const row = ws.addRow(rowData);
      styleGridRow(row, i % 2 === 1);
      currencyCols.forEach((col) => currencyCell(row, col + 1));
    });

    if (rows.length && currencyCols.size) {
      const totalsRow = headers.map((_, i) => {
        if (i === 0) return `Total (${rows.length})`;
        if (currencyCols.has(i)) return rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);
        return '';
      });
      const row = ws.addRow(totalsRow);
      styleTotalsRow(row);
      currencyCols.forEach((col) => currencyCell(row, col + 1));
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.slug()}-${this.from}-to-${this.to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private slug(): string {
    return this.reportType();
  }
}
