import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface LedgerEntry {
  _id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  currency: 'PHP' | 'USD';
  exchangeRateToPhp: number;
  notes?: string;
}

interface LedgerReport {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  byCategory: { category: string; type: string; total: number }[];
}

const CATEGORY_SUGGESTIONS = [
  'App Revenue', 'Consulting', 'Development', 'Domain', 'Hosting',
  'Marketing', 'Other', 'Server Costs', 'Software Tools',
];

@Component({
  selector: 'app-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="ledger-shell">
      <header class="ledger-hero">
        <div>
          <p class="hero-kicker">Superadmin</p>
          <h2>Ledger</h2>
          <p class="hero-sub">Track income and expenses with a full report.</p>
        </div>
      </header>

      <!-- Tabs -->
      <div class="tab-bar">
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'entries'" (click)="activeTab.set('entries')">
          <i class="fas fa-list"></i> Entries
        </button>
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'report'" (click)="switchToReport()">
          <i class="fas fa-chart-pie"></i> Report
        </button>
      </div>

      <!-- ── ENTRIES TAB ── -->
      @if (activeTab() === 'entries') {
        <div class="panel">
          <!-- Add / Edit Form -->
          <div class="form-card">
            <h3 class="form-title">{{ editingId() ? 'Edit Entry' : 'Add Entry' }}</h3>

            <!-- Type toggle -->
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
              <div class="currency-toggle">
                <button class="currency-btn" [class.currency-btn--active]="form.currency === 'PHP'" (click)="form.currency = 'PHP'">₱ PHP</button>
                <button class="currency-btn" [class.currency-btn--active]="form.currency === 'USD'" (click)="form.currency = 'USD'">$ USD</button>
              </div>
            </div>

            <div class="form-grid">
              <label class="field">
                <span class="field-label">Category *</span>
                <input list="category-list" class="field-input" [(ngModel)]="form.category"
                       placeholder="e.g. Server Costs" />
                <datalist id="category-list">
                  @for (s of categorySuggestions(); track s) {
                    <option [value]="s"></option>
                  }
                </datalist>
              </label>

              <label class="field">
                <span class="field-label">Amount ({{ form.currency }}) *</span>
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
                {{ saving() ? (form.currency === 'USD' ? 'Fetching rate…' : 'Saving…') : (editingId() ? 'Save Changes' : 'Add Entry') }}
              </button>
              @if (editingId()) {
                <button class="btn-ghost" (click)="cancelEdit()">Cancel</button>
              }
            </div>
          </div>

          <!-- Entries list -->
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
                    <tr [class.row--income]="e.type === 'income'" [class.row--expense]="e.type === 'expense'">
                      <td>{{ e.date | date: 'MMM d, y' : 'UTC' }}</td>
                      <td>
                        <span class="type-badge" [class.badge--income]="e.type === 'income'" [class.badge--expense]="e.type === 'expense'">
                          {{ e.type }}
                        </span>
                      </td>
                      <td>{{ e.category }}</td>
                      <td>{{ e.description || '—' }}</td>
                      <td class="col-amount" [class.amt--income]="e.type === 'income'" [class.amt--expense]="e.type === 'expense'">
                        @if (e.currency === 'USD') {
                          <span>{{ e.type === 'income' ? '+' : '-' }}{{ e.amount | currency: 'USD' : 'symbol' : '1.2-2' }}</span>
                          <span class="converted-amt">≈ {{ e.type === 'income' ? '+' : '-' }}{{ e.amount * e.exchangeRateToPhp | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
                        } @else {
                          {{ e.type === 'income' ? '+' : '-' }}{{ e.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}
                        }
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

      <!-- ── REPORT TAB ── -->
      @if (activeTab() === 'report') {
        <div class="panel">
          <!-- Filters -->
          <div class="report-filters">
            <label class="filter-field">
              <span class="field-label">From</span>
              <input type="date" class="field-input" [(ngModel)]="reportFrom" />
            </label>
            <label class="filter-field">
              <span class="field-label">To</span>
              <input type="date" class="field-input" [(ngModel)]="reportTo" />
            </label>
            <button class="btn-primary" [disabled]="loadingReport()" (click)="loadReport()">
              <i class="fas {{ loadingReport() ? 'fa-circle-notch fa-spin' : 'fa-search' }}"></i>
              {{ loadingReport() ? 'Loading…' : 'Apply' }}
            </button>
          </div>

          @if (report()) {
            <p class="report-note"><i class="fas fa-info-circle"></i> All amounts converted to PHP using the exchange rate on each entry's date.</p>
            <!-- Summary cards -->
            <div class="summary-grid">
              <div class="summary-card summary-card--income">
                <p class="summary-label">Total Income</p>
                <p class="summary-value">{{ report()!.totalIncome | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
              </div>
              <div class="summary-card summary-card--expense">
                <p class="summary-label">Total Expenses</p>
                <p class="summary-value">{{ report()!.totalExpenses | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
              </div>
              <div class="summary-card" [class.summary-card--positive]="report()!.net >= 0" [class.summary-card--negative]="report()!.net < 0">
                <p class="summary-label">Net</p>
                <p class="summary-value">{{ report()!.net | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
              </div>
            </div>

            <!-- Category breakdown -->
            @if (report()!.byCategory.length > 0) {
              <div class="breakdown-section">
                <h3 class="breakdown-title">Category Breakdown</h3>
                <table class="entries-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Type</th>
                      <th class="col-amount">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of report()!.byCategory; track row.category + row.type) {
                      <tr>
                        <td>{{ row.category }}</td>
                        <td>
                          <span class="type-badge" [class.badge--income]="row.type === 'income'" [class.badge--expense]="row.type === 'expense'">
                            {{ row.type }}
                          </span>
                        </td>
                        <td class="col-amount" [class.amt--income]="row.type === 'income'" [class.amt--expense]="row.type === 'expense'">
                          {{ row.total | currency: 'PHP' : 'symbol' : '1.2-2' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Full entries in report range -->
            @if (reportEntries().length > 0) {
              <div class="breakdown-section">
                <h3 class="breakdown-title">All Entries</h3>
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
                      </tr>
                    </thead>
                    <tbody>
                      @for (e of reportEntries(); track e._id) {
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
                            @if (e.currency === 'USD') {
                              <span>{{ e.type === 'income' ? '+' : '-' }}{{ e.amount | currency: 'USD' : 'symbol' : '1.2-2' }}</span>
                              <span class="converted-amt">≈ {{ e.type === 'income' ? '+' : '-' }}{{ e.amount * e.exchangeRateToPhp | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
                            } @else {
                              {{ e.type === 'income' ? '+' : '-' }}{{ e.amount | currency: 'PHP' : 'symbol' : '1.2-2' }}
                            }
                          </td>
                          <td class="col-notes">{{ e.notes || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          } @else if (!loadingReport()) {
            <div class="state-empty">No entries found for the selected range.</div>
          }
        </div>
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

    .ledger-shell {
      display: grid;
      gap: 1rem;
      padding: 1.5rem;
      min-height: calc(100vh - 60px);
    }

    .ledger-hero {
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
    }

    .ledger-hero h2 {
      margin: 0;
      font-size: 1.42rem;
      color: var(--ink);
      letter-spacing: -0.02em;
    }

    .hero-sub {
      margin: 0.3rem 0 0;
      color: var(--ink-dim);
      font-size: 0.9rem;
    }

    .tab-bar {
      display: flex;
      gap: 0.5rem;
    }

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

    .tab-btn--active {
      background: var(--gold-dim);
      color: var(--gold);
      border-color: var(--gold);
    }

    .panel {
      display: grid;
      gap: 1rem;
    }

    .form-card {
      background: var(--card-bg);
      border: 1px solid var(--gold-border);
      border-radius: 16px;
      padding: 1.1rem;
      box-shadow: 0 4px 14px rgba(0,0,0,0.24);
    }

    .form-title {
      margin: 0 0 0.8rem;
      font-size: 1rem;
      color: var(--ink);
    }

    .type-toggle {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .currency-toggle {
      display: flex;
      gap: 0.3rem;
      margin-left: auto;
    }

    .currency-btn {
      padding: 0.38rem 0.75rem;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.12);
      background: transparent;
      color: var(--ink-dim);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .currency-btn--active {
      background: rgba(163,230,53,0.12);
      border-color: var(--gold);
      color: var(--gold);
    }

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

    .type-btn--active.type-btn--income {
      background: var(--income-dim);
      border-color: rgba(74,222,128,0.4);
      color: var(--income);
    }

    .type-btn--active.type-btn--expense {
      background: var(--expense-dim);
      border-color: rgba(248,113,113,0.4);
      color: var(--expense);
    }

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

    .form-error {
      margin: 0.6rem 0 0;
      color: var(--expense);
      font-size: 0.83rem;
    }

    .form-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.85rem;
      flex-wrap: wrap;
    }

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
    }

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

    .converted-amt {
      display: block;
      font-size: 0.75rem;
      color: var(--ink-dim);
      font-weight: 400;
    }

    .amt--income { color: var(--income); font-weight: 700; }
    .amt--expense { color: var(--expense); font-weight: 700; }

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

    /* Report */
    .report-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
      align-items: flex-end;
      background: var(--card-bg);
      border: 1px solid var(--gold-border);
      border-radius: 14px;
      padding: 0.9rem;
    }

    .filter-field { display: flex; flex-direction: column; gap: 0.3rem; }

    .report-note {
      margin: 0;
      font-size: 0.8rem;
      color: var(--ink-dim);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

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

    .summary-value {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--ink);
    }

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

    .breakdown-title {
      margin: 0 0 0.7rem;
      font-size: 0.92rem;
      color: var(--ink);
    }

    @media (max-width: 640px) {
      .ledger-shell { padding: 0.85rem; gap: 0.75rem; }
      .form-grid { grid-template-columns: 1fr; }
      .field--full { grid-column: 1; }
      .summary-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class LedgerComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly apiBase = `${environment.apiUrl}/ledger`;

  activeTab = signal<'entries' | 'report'>('entries');

  // Entries state
  entries = signal<LedgerEntry[]>([]);
  loadingEntries = signal(false);
  saving = signal(false);
  deletingId = signal<string | null>(null);
  editingId = signal<string | null>(null);
  formError = signal('');

  // Report state
  report = signal<LedgerReport | null>(null);
  reportEntries = signal<LedgerEntry[]>([]);
  loadingReport = signal(false);
  reportFrom = '';
  reportTo = '';

  form: { type: 'income' | 'expense'; currency: 'PHP' | 'USD'; category: string; amount: number | null; description: string; date: string; notes: string } = {
    type: 'income',
    currency: 'PHP',
    category: '',
    amount: null,
    description: '',
    date: '',
    notes: '',
  };

  categorySuggestions = computed(() => {
    const used = this.entries().map((e) => e.category).filter(Boolean);
    const merged = Array.from(new Set([...CATEGORY_SUGGESTIONS, ...used]));
    return merged.sort((a, b) => a.localeCompare(b));
  });

  ngOnInit() {
    const today = new Date();
    this.form.date = this.toDateString(today);

    this.loadEntries();
  }

  private toDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  loadEntries() {
    this.loadingEntries.set(true);
    this.http.get<LedgerEntry[]>(this.apiBase).subscribe({
      next: (list) => { this.entries.set(list); this.loadingEntries.set(false); },
      error: () => this.loadingEntries.set(false),
    });
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
      currency: this.form.currency,
      category: this.form.category.trim(),
      amount: this.form.amount,
      description: this.form.description.trim(),
      date: this.form.date,
      notes: this.form.notes.trim() || undefined,
    };

    const id = this.editingId();
    const req = id
      ? this.http.put<LedgerEntry>(`${this.apiBase}/${id}`, body)
      : this.http.post<LedgerEntry>(this.apiBase, body);

    req.subscribe({
      next: (saved) => {
        if (id) {
          this.entries.update((list) => list.map((e) => (e._id === id ? saved : e)));
        } else {
          this.entries.update((list) => [saved, ...list]);
        }
        this.saving.set(false);
        this.cancelEdit();
      },
      error: (err) => {
        this.formError.set(err.error?.error || 'Failed to save entry.');
        this.saving.set(false);
      },
    });
  }

  startEdit(entry: LedgerEntry) {
    this.editingId.set(entry._id);
    this.form = {
      type: entry.type,
      currency: entry.currency ?? 'PHP',
      category: entry.category,
      amount: entry.amount,
      description: entry.description,
      date: entry.date.substring(0, 10),
      notes: entry.notes || '',
    };
    this.formError.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editingId.set(null);
    const today = new Date();
    this.form = { type: 'income', currency: 'PHP', category: '', amount: null, description: '', date: this.toDateString(today), notes: '' };
    this.formError.set('');
  }

  deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;
    this.deletingId.set(id);
    this.http.delete(`${this.apiBase}/${id}`).subscribe({
      next: () => {
        this.entries.update((list) => list.filter((e) => e._id !== id));
        this.deletingId.set(null);
      },
      error: () => this.deletingId.set(null),
    });
  }

  switchToReport() {
    this.activeTab.set('report');
    this.loadReport();
  }

  loadReport() {
    this.loadingReport.set(true);
    const params: Record<string, string> = {};
    if (this.reportFrom) params['from'] = this.reportFrom;
    if (this.reportTo) params['to'] = this.reportTo;

    this.http.get<LedgerReport>(`${this.apiBase}/report`, { params }).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loadingReport.set(false);
      },
      error: () => this.loadingReport.set(false),
    });

    this.http.get<LedgerEntry[]>(this.apiBase, { params }).subscribe({
      next: (list) => this.reportEntries.set(list),
      error: () => {},
    });
  }
}
