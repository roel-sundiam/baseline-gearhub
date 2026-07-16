import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AppServicePaymentsService, ClubServiceSummary } from '../../../core/services/app-service-payments.service';
import { ClubLedgerService, ClubLedgerEntry, ClubFinanceReport } from '../../../core/services/club-ledger.service';

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

type Preset = 'thisMonth' | 'lastMonth' | 'quarter' | 'year' | 'custom';

@Component({
  selector: 'app-finance-reports-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="fra-shell">
      <header class="fra-hero fra-no-print">
        <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
        <div>
          <p class="hero-kicker"><span class="superadmin-badge"><i class="fas fa-shield-alt"></i> Superadmin</span></p>
          <h2>Finance Reports — All Clubs</h2>
          <p class="hero-sub">View any club's income &amp; expenses report, regardless of Finance Report add-on subscription.</p>
        </div>
      </header>

      <div class="club-select-bar fra-no-print">
        <label class="field">
          <span class="field-label">Club</span>
          <select class="field-input" [ngModel]="selectedClubId()" (ngModelChange)="onClubChange($event)">
            <option value="" disabled>Select a club…</option>
            @for (c of clubs(); track c.clubId) {
              <option [value]="c.clubId">{{ c.clubName }}{{ c.financeReportEnabled ? ' — Subscribed' : '' }}</option>
            }
          </select>
        </label>
        @if (selectedClub(); as sc) {
          <span class="sub-badge" [class.sub-badge--on]="sc.financeReportEnabled">
            <i class="fas {{ sc.financeReportEnabled ? 'fa-crown' : 'fa-circle-xmark' }}"></i>
            {{ sc.financeReportEnabled ? ('Subscribed · ' + (sc.financeReportMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2') + '/mo') : 'Not subscribed' }}
          </span>
        }
      </div>

      @if (loadingClubs()) {
        <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading clubs…</div>
      } @else if (!selectedClubId()) {
        <div class="state-empty">Select a club above to view its Finance Report.</div>
      } @else {

        <div class="report-filters fra-no-print">
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
            <button class="btn-ghost btn-sm" [disabled]="!report()" (click)="exportCsv()">
              <i class="fas fa-download"></i> Export CSV
            </button>
            <button class="btn-ghost btn-sm" [disabled]="!report()" (click)="printReport()">
              <i class="fas fa-print"></i> Print
            </button>
          </div>
        </div>

        <div class="print-header fra-print-only">
          <h2>Finance Report — {{ selectedClub()?.clubName }}</h2>
          <p>{{ rangeLabel() }}</p>
        </div>

        @if (loadingReport()) {
          <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading report…</div>
        } @else if (report(); as r) {
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

          <div class="breakdown-section">
            <h3 class="breakdown-title">Income by Source</h3>
            @if (r.chargeIncome.byCategory.length === 0 && r.manualIncome.byCategory.length === 0) {
              <div class="state-empty">No income in this period.</div>
            } @else {
              <table class="entries-table">
                <thead><tr><th>Source</th><th class="col-amount">Total</th></tr></thead>
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
              @if (r.chargeIncome.convenienceFeesExcluded > 0) {
                <p class="footnote">
                  <i class="fas fa-info-circle"></i>
                  {{ r.chargeIncome.convenienceFeesExcluded | currency: 'PHP' : 'symbol' : '1.2-2' }} in convenience fees excluded (remitted to CourtGo).
                </p>
              }
            }
          </div>

          <div class="breakdown-section">
            <h3 class="breakdown-title">Expenses by Category</h3>
            @if (r.expenses.byCategory.length === 0) {
              <div class="state-empty">No expenses recorded in this period.</div>
            } @else {
              <table class="entries-table">
                <thead><tr><th>Category</th><th class="col-amount">Total</th></tr></thead>
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
                      <th class="trend-col fra-no-print"></th>
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
                        <td class="trend-col fra-no-print">
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

          <div class="breakdown-section fra-no-print">
            <h3 class="breakdown-title">Manual Entries <span class="readonly-tag">read-only</span></h3>
            @if (loadingEntries()) {
              <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
            } @else if (entries().length === 0) {
              <div class="state-empty">No manual entries in this period.</div>
            } @else {
              <div class="entries-table-wrap">
                <table class="entries-table">
                  <thead>
                    <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th class="col-amount">Amount</th><th>Notes</th></tr>
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
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        } @else {
          <div class="state-empty">No report data for the selected range.</div>
        }
      }
    </section>
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

    .fra-shell { display: grid; gap: 1rem; padding: 1.5rem; min-height: calc(100vh - 60px); }

    .fra-hero {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--dm-header, #1e2535);
      border: 1px solid var(--gold-border);
      border-radius: 18px;
      padding: 1rem 1.2rem;
      box-shadow: 0 4px 16px rgba(0,0,0,0.32);
    }

    .back-btn {
      background: var(--gold-dim);
      border: 1px solid var(--gold-border);
      color: var(--gold);
      font-size: 0.9rem;
      cursor: pointer;
      padding: 7px 12px;
      border-radius: 8px;
      font-family: inherit;
    }

    .back-btn:hover { background: rgba(163,230,53,0.2); }

    .hero-kicker { margin: 0 0 0.3rem; }
    .superadmin-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;
      background: rgba(139,92,246,0.18); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.32);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .fra-hero h2 { margin: 0; font-size: 1.3rem; color: var(--ink); letter-spacing: -0.02em; }
    .hero-sub { margin: 0.3rem 0 0; color: var(--ink-dim); font-size: 0.86rem; }

    .club-select-bar {
      display: flex;
      align-items: flex-end;
      gap: 0.9rem;
      flex-wrap: wrap;
      background: var(--card-bg);
      border: 1px solid var(--gold-border);
      border-radius: 14px;
      padding: 0.9rem;
    }

    .field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 240px; }
    .field-label {
      font-size: 0.72rem; font-weight: 700; color: var(--ink-dim);
      text-transform: uppercase; letter-spacing: 0.05em;
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
      color-scheme: dark;
    }

    .field-input:focus { border-color: var(--gold); }

    select.field-input option {
      background: var(--card-bg);
      color: var(--ink);
    }

    .sub-badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.82rem; font-weight: 700; color: var(--ink-dim);
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 999px; padding: 0.35rem 0.8rem;
    }
    .sub-badge--on { color: #facc15; border-color: rgba(250,204,21,0.35); background: rgba(250,204,21,0.08); }

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

    .report-filters {
      display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: center;
      background: var(--card-bg); border: 1px solid var(--gold-border);
      border-radius: 14px; padding: 0.9rem;
    }

    .preset-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }

    .chip {
      padding: 0.38rem 0.8rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14);
      background: transparent; color: var(--ink-dim); font-size: 0.8rem; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .chip--active { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }

    .custom-range { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; }
    .filter-field { display: flex; flex-direction: column; gap: 0.3rem; }
    .export-actions { margin-left: auto; display: flex; gap: 0.45rem; flex-wrap: wrap; }

    .print-header { display: none; }

    .btn-primary {
      background: var(--gold); color: #111827; border: none; border-radius: 9px;
      padding: 0.52rem 0.95rem; font-size: 0.86rem; font-weight: 700; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.4rem; font-family: inherit;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-ghost {
      background: transparent; border: 1px solid rgba(255,255,255,0.18); border-radius: 9px;
      color: var(--ink-dim); padding: 0.52rem 0.95rem; font-size: 0.86rem; font-weight: 700;
      cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.4rem;
    }
    .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }

    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
    .summary-card {
      background: var(--card-bg); border: 1px solid var(--gold-border); border-radius: 14px;
      padding: 1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.22);
    }
    .summary-card--income { border-color: rgba(74,222,128,0.3); }
    .summary-card--expense { border-color: rgba(248,113,113,0.3); }
    .summary-card--positive { border-color: rgba(74,222,128,0.4); background: rgba(74,222,128,0.06); }
    .summary-card--negative { border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.06); }
    .summary-label {
      margin: 0 0 0.3rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em;
      font-weight: 700; color: var(--ink-dim);
    }
    .summary-value { margin: 0; font-size: 1.35rem; font-weight: 800; color: var(--ink); }
    .summary-card--income .summary-value { color: var(--income); }
    .summary-card--expense .summary-value { color: var(--expense); }
    .summary-card--positive .summary-value { color: var(--income); }
    .summary-card--negative .summary-value { color: var(--expense); }

    .breakdown-section {
      background: var(--card-bg); border: 1px solid var(--gold-border); border-radius: 14px; padding: 0.9rem;
    }
    .breakdown-title { margin: 0 0 0.7rem; font-size: 0.92rem; color: var(--ink); display: flex; align-items: center; gap: 0.5rem; }
    .readonly-tag {
      font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px;
      background: rgba(255,255,255,0.08); color: var(--ink-dim); border-radius: 8px; padding: 1px 7px;
    }

    .footnote { margin: 0.6rem 0 0; font-size: 0.78rem; color: var(--ink-dim); display: flex; align-items: center; gap: 0.4rem; }

    .entries-table-wrap { overflow-x: auto; }
    .entries-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--card-bg); border-radius: 12px; overflow: hidden; }
    .entries-table th {
      background: rgba(163,230,53,0.07); color: var(--gold); font-size: 0.72rem; text-transform: uppercase;
      letter-spacing: 0.06em; padding: 0.6rem 0.8rem; text-align: left; white-space: nowrap;
    }
    .entries-table td { padding: 0.6rem 0.8rem; border-top: 1px solid rgba(255,255,255,0.05); color: var(--ink); vertical-align: middle; }
    .entries-table tr:hover td { background: rgba(255,255,255,0.03); }
    .col-amount { text-align: right; white-space: nowrap; }
    .col-notes { color: var(--ink-dim); font-size: 0.8rem; max-width: 180px; }
    .amt--income { color: var(--income); font-weight: 700; }
    .amt--expense { color: var(--expense); font-weight: 700; }
    .total-row td { border-top: 2px solid rgba(255,255,255,0.14); font-weight: 800; }
    .manual-badge {
      font-size: 0.66rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      background: rgba(96,165,250,0.14); color: #60a5fa; border-radius: 999px; padding: 0.1rem 0.45rem; margin-left: 0.35rem;
    }
    .type-badge { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; padding: 0.18rem 0.55rem; border-radius: 999px; text-transform: capitalize; }
    .badge--income { background: var(--income-dim); color: var(--income); }
    .badge--expense { background: var(--expense-dim); color: var(--expense); }

    .trend-col { width: 30%; min-width: 140px; }
    .bar { height: 7px; border-radius: 4px; margin: 2px 0; min-width: 2px; }
    .bar--income { background: var(--income); }
    .bar--expense { background: var(--expense); }

    @media (max-width: 640px) {
      .fra-shell { padding: 0.85rem; gap: 0.75rem; }
      .summary-grid { grid-template-columns: 1fr; }
      .export-actions { margin-left: 0; }
    }

    /* Print */
    .fra-print-only { display: none; }
    @media print {
      :host { background: #fff; }
      .fra-shell { padding: 0; min-height: 0; }
      .fra-no-print { display: none !important; }
      .fra-print-only { display: block; }
      .print-header h2 { color: #111; margin: 0 0 0.2rem; }
      .print-header p { color: #4b5563; margin: 0 0 0.8rem; }
      .summary-card, .breakdown-section, .entries-table { background: #fff; border-color: #ccc; box-shadow: none; }
      .summary-value, .breakdown-title, .entries-table td { color: #111; }
      .entries-table th { background: #f3f4f6; color: #374151; }
      .summary-label, .footnote, .col-notes { color: #4b5563; }
      .amt--income, .summary-card--income .summary-value, .summary-card--positive .summary-value { color: #15803d; }
      .amt--expense, .summary-card--expense .summary-value, .summary-card--negative .summary-value { color: #b91c1c; }
      .state-empty { background: #fff; color: #4b5563; }
    }
  `],
})
export class FinanceReportsAdminComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private appServicePayments = inject(AppServicePaymentsService);
  private ledger = inject(ClubLedgerService);

  clubs = signal<ClubServiceSummary[]>([]);
  loadingClubs = signal(true);
  selectedClubId = signal('');

  selectedClub = computed(() => this.clubs().find((c) => c.clubId === this.selectedClubId()) ?? null);

  report = signal<ClubFinanceReport | null>(null);
  loadingReport = signal(false);
  preset = signal<Preset>('thisMonth');
  reportFrom = '';
  reportTo = '';

  entries = signal<ClubLedgerEntry[]>([]);
  loadingEntries = signal(false);

  private maxTrendValue = computed(() => {
    const months = this.report()?.byMonth ?? [];
    return Math.max(1, ...months.map((m) => Math.max(m.income, m.expenses)));
  });

  ngOnInit() {
    if (!this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.loadingClubs.set(true);
    this.appServicePayments.getSummary().subscribe({
      next: (summary) => {
        const sorted = [...summary.clubs].sort((a, b) => a.clubName.localeCompare(b.clubName));
        this.clubs.set(sorted);
        this.loadingClubs.set(false);
        const preselect = this.route.snapshot.queryParamMap.get('clubId');
        const initial = preselect && sorted.some((c) => c.clubId === preselect) ? preselect : sorted[0]?.clubId ?? '';
        if (initial) {
          this.selectedClubId.set(initial);
          this.setPreset('thisMonth');
        }
      },
      error: () => this.loadingClubs.set(false),
    });
  }

  private toDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  onClubChange(clubId: string) {
    this.selectedClubId.set(clubId);
    this.loadReport();
    this.loadEntries();
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
    if (p !== 'custom') {
      this.loadReport();
      this.loadEntries();
    }
  }

  loadReport() {
    const clubId = this.selectedClubId();
    if (!clubId) return;
    this.loadingReport.set(true);
    this.ledger.getReport(this.reportFrom || undefined, this.reportTo || undefined, clubId).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loadingReport.set(false);
      },
      error: () => this.loadingReport.set(false),
    });
  }

  loadEntries() {
    const clubId = this.selectedClubId();
    if (!clubId) return;
    this.loadingEntries.set(true);
    this.ledger.list({ from: this.reportFrom || undefined, to: this.reportTo || undefined, clubId }).subscribe({
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

  exportCsv() {
    const r = this.report();
    if (!r) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push(`Finance Report,${esc(this.selectedClub()?.clubName ?? '')},${esc(this.rangeLabel())}`);
    lines.push('');
    lines.push('TOTALS');
    lines.push('Total Income,' + r.totalIncome.toFixed(2));
    lines.push('Total Expenses,' + r.totalExpenses.toFixed(2));
    lines.push('Net,' + r.net.toFixed(2));
    lines.push('');
    lines.push('INCOME BY SOURCE');
    lines.push('Source,Total');
    for (const row of r.chargeIncome.byCategory) {
      lines.push(`${esc(this.chargeCategoryLabel(row.category))},${row.total.toFixed(2)}`);
    }
    for (const row of r.manualIncome.byCategory) {
      lines.push(`${esc(row.category + ' (manual)')},${row.total.toFixed(2)}`);
    }
    if (r.chargeIncome.convenienceFeesExcluded > 0) {
      lines.push(`${esc('Convenience fees excluded (remitted to CourtGo)')},${r.chargeIncome.convenienceFeesExcluded.toFixed(2)}`);
    }
    lines.push('');
    lines.push('EXPENSES BY CATEGORY');
    lines.push('Category,Total');
    for (const row of r.expenses.byCategory) {
      lines.push(`${esc(row.category)},${row.total.toFixed(2)}`);
    }
    lines.push('');
    lines.push('MONTHLY TREND');
    lines.push('Month,Income,Expenses,Net');
    for (const m of r.byMonth) {
      lines.push(`${m.month},${m.income.toFixed(2)},${m.expenses.toFixed(2)},${m.net.toFixed(2)}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const clubSlug = (this.selectedClub()?.clubName ?? 'club').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const label = this.reportFrom && this.reportTo ? `${this.reportFrom}-to-${this.reportTo}` : 'all-time';
    a.download = `finance-report-${clubSlug}-${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printReport() {
    window.print();
  }

  goBack() {
    this.router.navigate(['/admin/dev-finance']);
  }
}
