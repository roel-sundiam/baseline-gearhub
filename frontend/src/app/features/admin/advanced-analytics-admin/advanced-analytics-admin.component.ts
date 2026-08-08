import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AppServicePaymentsService, ClubServiceSummary } from '../../../core/services/app-service-payments.service';
import { ClubAnalyticsService, AnalyticsOverview, AnalyticsEngagement, TrendGranularity } from '../../../core/services/club-analytics.service';
import { KpiCardsComponent } from '../advanced-analytics/components/kpi-cards.component';
import { TrendChartComponent, TrendSeriesPoint } from '../advanced-analytics/components/trend-chart.component';
import { CourtPerformanceTableComponent } from '../advanced-analytics/components/court-performance-table.component';
import { PeakTimesComponent } from '../advanced-analytics/components/peak-times.component';
import { CustomerActivityComponent } from '../advanced-analytics/components/customer-activity.component';
import { BreakdownListComponent, BreakdownRow } from '../advanced-analytics/components/breakdown-list.component';
import { ReportsTabComponent } from '../advanced-analytics/reports-tab.component';

type Preset = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear' | 'custom';
type Tab = 'dashboard' | 'reports';

@Component({
  selector: 'app-advanced-analytics-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KpiCardsComponent,
    TrendChartComponent,
    CourtPerformanceTableComponent,
    PeakTimesComponent,
    CustomerActivityComponent,
    BreakdownListComponent,
    ReportsTabComponent,
  ],
  template: `
    <section class="an-shell">
      <header class="an-hero">
        <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
        <div class="hero-copy">
          <p class="hero-kicker"><span class="superadmin-badge"><i class="fas fa-shield-alt"></i> Superadmin</span></p>
          <h2>Advanced Analytics — All Clubs</h2>
          <p class="hero-sub">View any club's booking, revenue, and customer analytics, regardless of add-on subscription.</p>
        </div>
      </header>

      <div class="club-select-bar">
        <label class="field">
          <span class="field-label">Club</span>
          <select class="field-input" [ngModel]="selectedClubId()" (ngModelChange)="onClubChange($event)">
            <option value="" disabled>Select a club…</option>
            @for (c of clubs(); track c.clubId) {
              <option [value]="c.clubId">{{ c.clubName }}{{ c.advancedAnalyticsEnabled ? ' — Subscribed' : '' }}</option>
            }
          </select>
        </label>
        @if (selectedClub(); as sc) {
          <span class="sub-badge" [class.sub-badge--on]="sc.advancedAnalyticsEnabled">
            <i class="fas {{ sc.advancedAnalyticsEnabled ? 'fa-crown' : 'fa-circle-xmark' }}"></i>
            {{ sc.advancedAnalyticsEnabled ? ('Subscribed · ' + (sc.advancedAnalyticsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2') + '/mo') : 'Not subscribed' }}
          </span>
        }
      </div>

      @if (loadingClubs()) {
        <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading clubs…</div>
      } @else if (!selectedClubId()) {
        <div class="state-empty">Select a club above to view its analytics.</div>
      } @else {

        <div class="tab-bar">
          <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'dashboard'" (click)="activeTab.set('dashboard')">
            <i class="fas fa-chart-pie"></i> Dashboard
          </button>
          <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'reports'" (click)="activeTab.set('reports')">
            <i class="fas fa-file-lines"></i> Reports
          </button>
        </div>

        @if (activeTab() === 'dashboard') {
          <div class="panel">
            <div class="filter-bar">
              <div class="filter-intro">
                <span class="filter-icon"><i class="far fa-calendar"></i></span>
                <div>
                  <strong>Date range</strong>
                  <span>{{ displayRange() }}</span>
                </div>
              </div>
              <div class="filter-controls">
                <div class="preset-chips">
                  <button class="chip" [class.chip--active]="preset() === 'today'" (click)="setPreset('today')">Today</button>
                  <button class="chip" [class.chip--active]="preset() === 'thisWeek'" (click)="setPreset('thisWeek')">This week</button>
                  <button class="chip" [class.chip--active]="preset() === 'thisMonth'" (click)="setPreset('thisMonth')">This month</button>
                  <button class="chip" [class.chip--active]="preset() === 'lastMonth'" (click)="setPreset('lastMonth')">Last month</button>
                  <button class="chip" [class.chip--active]="preset() === 'last3Months'" (click)="setPreset('last3Months')">3 months</button>
                  <button class="chip" [class.chip--active]="preset() === 'thisYear'" (click)="setPreset('thisYear')">This year</button>
                  <button class="chip" [class.chip--active]="preset() === 'custom'" (click)="preset.set('custom')"><i class="fas fa-sliders"></i> Custom</button>
                </div>
                @if (preset() === 'custom') {
                  <div class="custom-range">
                    <label class="filter-field">
                      <span class="field-label">From</span>
                      <input type="date" class="field-input" [(ngModel)]="rangeFrom" />
                    </label>
                    <label class="filter-field">
                      <span class="field-label">To</span>
                      <input type="date" class="field-input" [(ngModel)]="rangeTo" />
                    </label>
                    <button class="btn-primary" [disabled]="loadingOverview()" (click)="loadDashboard()">
                      <i class="fas {{ loadingOverview() ? 'fa-circle-notch fa-spin' : 'fa-check' }}"></i> Apply range
                    </button>
                  </div>
                }
              </div>
            </div>

            @if (loadingOverview()) {
              <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading analytics…</div>
            } @else if (overview(); as o) {
              <app-kpi-cards
                [totalBookings]="o.kpis.totalBookings"
                [totalRevenue]="o.kpis.totalRevenue"
                [courtUtilizationPct]="o.kpis.courtUtilizationPct"
                [activeCustomers]="o.kpis.activeCustomers"
              />

              <div class="trend-grid">
                <app-trend-chart
                  title="Booking trend"
                  subtitle="Completed and active bookings over time"
                  icon="fa-calendar-check"
                  tone="gold"
                  valueFormat="number"
                  [data]="bookingTrendSeries()"
                  [granularity]="granularity()"
                  (granularityChange)="setGranularity($event)"
                />

                <app-trend-chart
                  title="Revenue trend"
                  subtitle="Recognized booking revenue over time"
                  icon="fa-peso-sign"
                  tone="teal"
                  valueFormat="currency"
                  [data]="revenueTrendSeries()"
                  [granularity]="granularity()"
                  [showGranularityToggle]="false"
                />
              </div>

              <div class="section-heading">
                <div><span>Courts</span><h3>Performance by court</h3></div>
                <p>Compare demand, earnings, and operating-hour utilization.</p>
              </div>
              <app-court-performance-table [data]="o.courtPerformance" />

              @if (engagement(); as e) {
                <div class="section-heading">
                  <div><span>Audience &amp; demand</span><h3>Engagement insights</h3></div>
                  <p>Understand when members book and who keeps coming back.</p>
                </div>

                <div class="insights-grid">
                  <app-peak-times [byHour]="e.peakTimes.byHour" [dayOfWeek]="e.peakTimes.byDayOfWeek" />
                  <app-customer-activity [data]="e.customerActivity" />
                </div>

                <div class="split-grid">
                  <app-breakdown-list
                    title="Booking Type Breakdown"
                    amountFormat="currency"
                    countLabel="bookings"
                    [rows]="bookingTypeRows()"
                  />
                  <app-breakdown-list
                    title="Payment Methods"
                    amountFormat="currency"
                    countLabel="transactions"
                    [rows]="paymentMethodRows()"
                  />
                </div>

                @if (e.cancellationOverview; as c) {
                  <div class="cancel-card">
                    <h3 class="cancel-title">Cancellation Overview</h3>
                    <div class="cancel-tiles">
                      <div class="cancel-tile">
                        <p class="tile-value">{{ c.count | number }}</p>
                        <p class="tile-label">Cancellations</p>
                      </div>
                      <div class="cancel-tile">
                        <p class="tile-value">{{ c.rate }}%</p>
                        <p class="tile-label">Cancellation Rate</p>
                      </div>
                      <div class="cancel-tile">
                        <p class="tile-value">{{ c.revenueAffected | currency: 'PHP' : 'symbol' : '1.0-2' }}</p>
                        <p class="tile-label">Revenue Affected</p>
                      </div>
                    </div>
                  </div>
                }
              }
            } @else {
              <div class="state-empty">No booking data available for the selected date range.</div>
            }
          </div>
        }

        @if (activeTab() === 'reports') {
          <div class="panel">
            <app-reports-tab [clubId]="selectedClubId()" />
          </div>
        }
      }
    </section>
  `,
  styles: [`
    :host { display: block; background: #0c1a11; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .an-shell { max-width: 1500px; margin: 0 auto; padding: 1.25rem; display: grid; gap: 1rem; box-sizing: border-box; min-height: calc(100vh - 60px); }

    .an-hero {
      display: flex; align-items: center; gap: 14px;
      background: linear-gradient(120deg, #162b21 0%, #1b3028 65%, #223b2f 100%);
      border: 1px solid rgba(163,230,53,0.14); border-radius: 20px;
      padding: 1.2rem 1.4rem; box-shadow: 0 10px 30px rgba(0,0,0,0.28);
    }
    .back-btn {
      background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.22); color: #a3e635;
      font-size: 0.9rem; cursor: pointer; padding: 9px 13px; border-radius: 10px; font-family: inherit;
    }
    .back-btn:hover { background: rgba(163,230,53,0.2); }
    .hero-kicker { margin: 0 0 0.3rem; }
    .superadmin-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;
      background: rgba(139,92,246,0.18); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.32);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .an-hero h2 { margin: 0; font-size: 1.35rem; color: #fff; letter-spacing: -0.02em; }
    .hero-sub { margin: 0.35rem 0 0; color: rgba(255,255,255,0.58); font-size: 0.86rem; }

    .club-select-bar {
      display: flex; align-items: flex-end; gap: 0.9rem; flex-wrap: wrap;
      background: #1b3028; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 0.9rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 260px; }
    .field-label { font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.52); text-transform: uppercase; letter-spacing: 0.05em; }
    .field-input {
      background: #14271e; border: 1px solid rgba(255,255,255,0.14); border-radius: 8px;
      color: #fff; padding: 0.5rem 0.7rem; font-size: 0.88rem; outline: none; width: 100%;
      box-sizing: border-box; font-family: inherit; transition: border-color 0.15s; color-scheme: dark;
    }
    .field-input:focus { border-color: #a3e635; }
    select.field-input option { background: #1b3028; color: #fff; }

    .sub-badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.82rem; font-weight: 700; color: rgba(255,255,255,0.6);
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 999px; padding: 0.35rem 0.8rem;
    }
    .sub-badge--on { color: #a3e635; border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.08); }

    .state-msg, .state-empty {
      background: #1b3028; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;
      padding: 1.2rem; text-align: center; color: rgba(255,255,255,0.55); font-size: 0.88rem;
    }
    .state-msg { border-style: solid; }

    .tab-bar { display: flex; gap: 0; width: fit-content; padding: 4px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: #14271e; }
    .tab-btn {
      border: 0; border-radius: 9px; background: transparent; color: rgba(255,255,255,0.52);
      padding: 0.52rem 1rem; font-size: 0.86rem; font-weight: 700; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.4rem; font-family: inherit; transition: all 0.15s;
    }
    .tab-btn:hover { color: #fff; }
    .tab-btn--active { color: #a3e635; background: #213b2f; box-shadow: 0 2px 9px rgba(0,0,0,0.24); }

    .panel { display: grid; gap: 1.15rem; }
    .trend-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .insights-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 1rem; align-items: stretch; }
    .split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-top: 0.45rem; padding: 0 0.15rem; }
    .section-heading span { color: #a3e635; font-size: 0.67rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; }
    .section-heading h3 { margin: 0.18rem 0 0; color: #fff; font-size: 1.1rem; }
    .section-heading p { margin: 0; color: rgba(255,255,255,0.48); font-size: 0.78rem; text-align: right; }

    .filter-bar {
      display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1rem 1.4rem; align-items: center;
      background: #1b3028; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 0.85rem 1rem;
      box-shadow: 0 7px 22px rgba(0,0,0,0.2);
    }
    .filter-intro { display: flex; align-items: center; gap: 0.65rem; padding-right: 1.2rem; border-right: 1px solid rgba(255,255,255,0.08); }
    .filter-icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: #a3e635; background: rgba(163,230,53,0.11); }
    .filter-intro div { display: grid; gap: 0.1rem; white-space: nowrap; }
    .filter-intro strong { color: #fff; font-size: 0.78rem; }
    .filter-intro span:not(.filter-icon) { color: rgba(255,255,255,0.48); font-size: 0.68rem; }
    .filter-controls { display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: flex-end; justify-content: space-between; min-width: 0; }
    .preset-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .chip {
      padding: 0.42rem 0.72rem; border-radius: 999px; border: 1px solid transparent;
      color: rgba(255,255,255,0.58); background: rgba(255,255,255,0.045); font-size: 0.8rem; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .chip:hover { background: rgba(163,230,53,0.1); color: #d9f99d; }
    .chip--active { color: #102015; background: #a3e635; border-color: #a3e635; box-shadow: 0 4px 12px rgba(163,230,53,0.16); }
    .custom-range { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; padding-top: 0.65rem; border-top: 1px solid rgba(255,255,255,0.08); flex-basis: 100%; }
    .filter-field { display: flex; flex-direction: column; gap: 0.3rem; }

    .btn-primary, .btn-ghost {
      border-radius: 10px; font-weight: 700; cursor: pointer; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.4rem;
    }
    .btn-primary { color: #102015; background: #a3e635; border: none; padding: 0.55rem 1.1rem; font-size: 0.86rem; box-shadow: 0 4px 12px rgba(163,230,53,0.17); }
    .btn-primary:hover:not(:disabled) { background: #b8f040; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }

    .cancel-card {
      background: #1b3028; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
      padding: 1rem 1.1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.22);
    }
    .cancel-title { margin: 0 0 0.8rem; font-size: 0.95rem; color: #fff; }
    .cancel-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
    .cancel-tile { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 0.7rem; text-align: center; }
    .tile-value { margin: 0; font-size: 1.3rem; font-weight: 800; color: #a3e635; }
    .tile-label { margin: 0.2rem 0 0; font-size: 0.7rem; color: rgba(255,255,255,0.48); }

    @media (max-width: 1050px) {
      .trend-grid, .insights-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 800px) {
      .an-shell { padding: 0.9rem; }
      .filter-bar { grid-template-columns: 1fr; }
      .filter-intro { border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 0 0.7rem; }
      .filter-controls { justify-content: flex-start; }
      .section-heading { align-items: flex-start; flex-direction: column; gap: 0.25rem; }
      .section-heading p { text-align: left; }
      .split-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .an-shell { padding: 0.85rem; gap: 0.75rem; }
      .an-hero { flex-direction: column; align-items: flex-start; }
      .tab-bar { width: 100%; }
      .tab-btn { flex: 1; justify-content: center; }
      .preset-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 0.2rem; width: 100%; }
      .chip { white-space: nowrap; }
      .cancel-tiles { grid-template-columns: 1fr 1fr; }
      .cancel-tile:last-child { grid-column: 1 / -1; }
    }
  `],
})
export class AdvancedAnalyticsAdminComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private appServicePayments = inject(AppServicePaymentsService);
  private analytics = inject(ClubAnalyticsService);

  clubs = signal<ClubServiceSummary[]>([]);
  loadingClubs = signal(true);
  selectedClubId = signal('');
  selectedClub = computed(() => this.clubs().find((c) => c.clubId === this.selectedClubId()) ?? null);

  activeTab = signal<Tab>('dashboard');
  preset = signal<Preset>('thisMonth');
  granularity = signal<TrendGranularity>('day');
  rangeFrom = '';
  rangeTo = '';

  overview = signal<AnalyticsOverview | null>(null);
  loadingOverview = signal(false);
  engagement = signal<AnalyticsEngagement | null>(null);

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

  displayRange(): string {
    if (!this.rangeFrom || !this.rangeTo) return 'Choose a period';
    const parse = (value: string) => {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    const from = parse(this.rangeFrom);
    const to = parse(this.rangeTo);
    const fromLabel = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const toLabel = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fromLabel} – ${toLabel}`;
  }

  onClubChange(clubId: string) {
    this.selectedClubId.set(clubId);
    this.overview.set(null);
    this.engagement.set(null);
    this.loadDashboard();
  }

  setPreset(p: Preset) {
    this.preset.set(p);
    const now = new Date();
    if (p === 'today') {
      this.rangeFrom = this.toDateString(now);
      this.rangeTo = this.toDateString(now);
    } else if (p === 'thisWeek') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Sunday start
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      this.rangeFrom = this.toDateString(start);
      this.rangeTo = this.toDateString(end);
    } else if (p === 'thisMonth') {
      this.rangeFrom = this.toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
      this.rangeTo = this.toDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (p === 'lastMonth') {
      this.rangeFrom = this.toDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      this.rangeTo = this.toDateString(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (p === 'last3Months') {
      this.rangeFrom = this.toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      this.rangeTo = this.toDateString(now);
    } else if (p === 'thisYear') {
      this.rangeFrom = this.toDateString(new Date(now.getFullYear(), 0, 1));
      this.rangeTo = this.toDateString(new Date(now.getFullYear(), 11, 31));
    }
    if (p !== 'custom') this.loadDashboard();
  }

  setGranularity(g: TrendGranularity) {
    this.granularity.set(g);
    this.loadOverview();
  }

  loadDashboard() {
    this.loadOverview();
    this.loadEngagement();
  }

  loadOverview() {
    const clubId = this.selectedClubId();
    if (!clubId || !this.rangeFrom || !this.rangeTo) return;
    this.loadingOverview.set(true);
    this.analytics.getOverview(this.rangeFrom, this.rangeTo, this.granularity(), clubId).subscribe({
      next: (o) => {
        this.overview.set(o);
        this.loadingOverview.set(false);
      },
      error: () => this.loadingOverview.set(false),
    });
  }

  loadEngagement() {
    const clubId = this.selectedClubId();
    if (!clubId || !this.rangeFrom || !this.rangeTo) return;
    this.analytics.getEngagement(this.rangeFrom, this.rangeTo, clubId).subscribe({
      next: (e) => this.engagement.set(e),
      error: () => this.engagement.set(null),
    });
  }

  bookingTrendSeries(): TrendSeriesPoint[] {
    return (this.overview()?.bookingTrend ?? []).map((p) => ({ period: p.period, value: p.bookings }));
  }

  revenueTrendSeries(): TrendSeriesPoint[] {
    return (this.overview()?.revenueTrend ?? []).map((p) => ({ period: p.period, value: p.revenue }));
  }

  bookingTypeRows(): BreakdownRow[] {
    return (this.engagement()?.bookingTypeBreakdown ?? []).map((r) => ({
      label: r.label,
      count: r.bookings,
      amount: r.revenue,
      pct: r.pct,
    }));
  }

  paymentMethodRows(): BreakdownRow[] {
    return (this.engagement()?.paymentMethodBreakdown ?? []).map((r) => ({
      label: r.method,
      count: r.transactions,
      amount: r.amount,
    }));
  }

  goBack() {
    this.router.navigate(['/admin/dev-finance']);
  }
}
