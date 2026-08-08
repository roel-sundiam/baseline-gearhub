import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppServicePaymentsService, FeeInfo } from '../../../core/services/app-service-payments.service';
import { ClubService } from '../../../core/services/club.service';
import { ClubAnalyticsService, AnalyticsOverview, AnalyticsEngagement, TrendGranularity } from '../../../core/services/club-analytics.service';
import { KpiCardsComponent } from './components/kpi-cards.component';
import { TrendChartComponent, TrendSeriesPoint } from './components/trend-chart.component';
import { CourtPerformanceTableComponent } from './components/court-performance-table.component';
import { PeakTimesComponent } from './components/peak-times.component';
import { CustomerActivityComponent } from './components/customer-activity.component';
import { BreakdownListComponent, BreakdownRow } from './components/breakdown-list.component';
import { ReportsTabComponent } from './reports-tab.component';

type Preset = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear' | 'custom';
type Tab = 'dashboard' | 'reports';

@Component({
  selector: 'app-advanced-analytics',
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
        <div class="hero-copy">
          <p class="hero-kicker">Club intelligence <span class="premium-pill"><i class="fas fa-crown"></i> Premium</span></p>
          <h2>Advanced Analytics</h2>
          <p class="hero-sub">A clearer view of bookings, revenue, court demand, and member activity.</p>
        </div>
        <div class="hero-mark" aria-hidden="true">
          <i class="fas fa-chart-line"></i>
        </div>
      </header>

      @if (loadingFeeInfo()) {
        <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else if (!feeInfo()?.advancedAnalyticsEnabled) {

        <!-- ── PAYWALL ── -->
        <div class="paywall-card">
          <div class="paywall-icon"><i class="fas fa-chart-line"></i></div>
          <h3>Get deeper insight into your venue</h3>
          <ul class="paywall-features">
            <li><i class="fas fa-check"></i> Booking &amp; revenue trends, always consistent with your Finance Report</li>
            <li><i class="fas fa-check"></i> Court utilization and per-court performance</li>
            <li><i class="fas fa-check"></i> Peak booking times, day-of-week demand, and customer activity</li>
            <li><i class="fas fa-check"></i> Downloadable Booking, Revenue, Court, and Customer reports</li>
          </ul>
          <p class="paywall-price">
            <span class="price-amount">{{ feeInfo()?.advancedAnalyticsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}</span>
            <span class="price-per">/ month</span>
          </p>
          <p class="paywall-terms">
            Billed to your CourtGo service balance — the full month is charged when you subscribe and on each
            calendar month while active. Cancel anytime.
          </p>
          <button class="btn-primary btn-lg" [disabled]="subscribing()" (click)="openSubscribeModal()">
            <i class="fas {{ subscribing() ? 'fa-circle-notch fa-spin' : 'fa-crown' }}"></i>
            {{ subscribing() ? 'Subscribing…' : 'Subscribe' }}
          </button>
        </div>

      } @else {

        <!-- ── SUBSCRIBED ── -->
        <div class="sub-strip">
          <span class="sub-info">
            <i class="fas fa-crown"></i>
            Subscribed{{ feeInfo()?.advancedAnalyticsSubscribedAt ? ' since ' + (feeInfo()?.advancedAnalyticsSubscribedAt | date: 'MMM d, y') : '' }}
            · {{ feeInfo()?.advancedAnalyticsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}/mo
          </span>
          <button class="btn-ghost btn-sm" [disabled]="subscribing()" (click)="openCancelModal()">
            {{ subscribing() ? 'Cancelling…' : 'Cancel add-on' }}
          </button>
        </div>

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
            <app-reports-tab />
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
              {{ cm.type === 'subscribe' ? 'Subscribe to Advanced Analytics' : 'Cancel Advanced Analytics Add-on' }}
            </div>
            <button class="modal-close" (click)="closeConfirmModal()" [disabled]="cm.submitting"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            @if (cm.type === 'subscribe') {
              <p class="modal-price">
                <span class="modal-price-amount">{{ feeInfo()?.advancedAnalyticsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2' }}</span>
                <span class="modal-price-per">/ month</span>
              </p>
              <p class="modal-copy">
                The full current month will be billed to your CourtGo service balance now, and each
                calendar month while the add-on stays active.
              </p>
            } @else {
              <p class="modal-copy">
                Analytics &amp; Reports locks immediately. This month's fee remains due. Your data is preserved
                and will reappear if you resubscribe.
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
      --gold-border: rgba(163,230,53,0.22);
      display: block;
      background: var(--dm-bg, #111827);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .an-shell { display: grid; gap: 1rem; padding: 1.5rem; min-height: calc(100vh - 60px); }

    .an-hero {
      background: var(--dm-header, #1e2535);
      border: 1px solid rgba(250,204,21,0.22);
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
      color: #facc15;
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
    .an-hero h2 { margin: 0; font-size: 1.42rem; color: #fff; letter-spacing: -0.02em; }
    .hero-sub { margin: 0.3rem 0 0; color: rgba(255,255,255,0.65); font-size: 0.9rem; }

    .state-msg, .state-empty {
      color: rgba(255,255,255,0.6);
      font-size: 0.9rem;
      padding: 2rem;
      text-align: center;
      background: var(--dm-surface, #1a1f2e);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
    }

    /* Paywall */
    .paywall-card {
      background: var(--dm-surface, #1a1f2e);
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
      width: 58px; height: 58px; border-radius: 16px;
      background: rgba(250,204,21,0.12); color: #facc15;
      display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
    }
    .paywall-card h3 { margin: 0; color: #fff; font-size: 1.2rem; }
    .paywall-features { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; text-align: left; color: rgba(255,255,255,0.65); font-size: 0.9rem; }
    .paywall-features i { color: #4ade80; margin-right: 0.5rem; }
    .paywall-price { margin: 0.3rem 0 0; color: #fff; }
    .price-amount { font-size: 2rem; font-weight: 800; color: #facc15; }
    .price-per { color: rgba(255,255,255,0.65); font-size: 0.95rem; }
    .paywall-terms { margin: 0; color: rgba(255,255,255,0.65); font-size: 0.78rem; max-width: 420px; }

    .sub-strip {
      display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; flex-wrap: wrap;
      background: var(--dm-surface, #1a1f2e); border: 1px solid rgba(250,204,21,0.28); border-radius: 12px;
      padding: 0.6rem 0.9rem; font-size: 0.86rem; color: rgba(255,255,255,0.65);
    }
    .sub-info { display: inline-flex; align-items: center; gap: 0.45rem; }
    .sub-info i { color: #facc15; }

    .tab-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .tab-btn {
      padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid rgba(250,204,21,0.22);
      background: transparent; color: rgba(255,255,255,0.65); font-size: 0.86rem; font-weight: 700;
      cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s; font-family: inherit;
    }
    .tab-btn--active { background: rgba(250,204,21,0.14); color: #facc15; border-color: #facc15; }

    .panel { display: grid; gap: 1rem; }
    .split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 800px) { .split-grid { grid-template-columns: 1fr; } }

    .cancel-card {
      background: var(--dm-surface, #1a1f2e);
      border: 1px solid rgba(250,204,21,0.22);
      border-radius: 16px;
      padding: 1rem 1.1rem;
      box-shadow: 0 4px 14px rgba(0,0,0,0.24);
    }
    .cancel-title { margin: 0 0 0.8rem; font-size: 0.95rem; color: #fff; }
    .cancel-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
    @media (max-width: 600px) { .cancel-tiles { grid-template-columns: 1fr; } }
    .cancel-tile { background: rgba(255,255,255,0.04); border-radius: 12px; padding: 0.7rem; text-align: center; }
    .tile-value { margin: 0; font-size: 1.3rem; font-weight: 800; color: #facc15; }
    .tile-label { margin: 0.2rem 0 0; font-size: 0.7rem; color: rgba(255,255,255,0.55); }

    .filter-bar {
      display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: center;
      background: var(--dm-surface, #1a1f2e); border: 1px solid rgba(250,204,21,0.22); border-radius: 14px; padding: 0.9rem;
    }
    .preset-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .chip {
      padding: 0.38rem 0.8rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14);
      background: transparent; color: rgba(255,255,255,0.65); font-size: 0.8rem; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .chip--active { background: rgba(250,204,21,0.14); border-color: #facc15; color: #facc15; }
    .custom-range { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; }
    .filter-field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-label { font-size: 0.72rem; color: rgba(255,255,255,0.55); }
    .field-input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px;
      padding: 0.4rem 0.6rem; color: #fff; font-size: 0.85rem; font-family: inherit;
    }

    .btn-primary, .btn-ghost, .btn-cancel, .btn-confirm {
      border-radius: 10px; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.4rem;
    }
    .btn-primary { background: #facc15; color: #1a1f2e; border: none; padding: 0.55rem 1.1rem; font-size: 0.86rem; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .btn-lg { padding: 0.7rem 1.6rem; font-size: 0.95rem; }
    .btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.75); padding: 0.4rem 0.8rem; font-size: 0.8rem; }
    .btn-sm { padding: 0.35rem 0.7rem; font-size: 0.78rem; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
    .modal { background: var(--dm-surface, #1a1f2e); border: 1px solid rgba(250,204,21,0.3); border-radius: 16px; max-width: 420px; width: 100%; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .modal-title { display: flex; align-items: center; gap: 0.5rem; color: #fff; font-weight: 700; }
    .modal-title i { color: #facc15; }
    .modal-close { background: transparent; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1rem; }
    .modal-body { padding: 1.1rem; }
    .modal-price { margin: 0 0 0.6rem; }
    .modal-price-amount { font-size: 1.6rem; font-weight: 800; color: #facc15; }
    .modal-price-per { color: rgba(255,255,255,0.65); }
    .modal-copy { margin: 0; color: rgba(255,255,255,0.7); font-size: 0.85rem; }
    .modal-error { margin: 0.6rem 0 0; color: #f87171; font-size: 0.82rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 1rem 1.1rem; border-top: 1px solid rgba(255,255,255,0.08); }
    .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.75); padding: 0.5rem 1rem; font-size: 0.85rem; }
    .btn-confirm { background: #facc15; color: #1a1f2e; border: none; padding: 0.5rem 1rem; font-size: 0.85rem; }
    .btn-confirm--danger { background: #f87171; color: #fff; }
    .btn-confirm:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: default; }

    /* Warm admin analytics refresh */
    :host { --gold: #b88942; --gold-dark: #8f672f; background: transparent; color: #302a23; }
    .an-shell { max-width: 1500px; margin: 0 auto; padding: 1.25rem; gap: 1rem; box-sizing: border-box; }
    .an-hero {
      position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      min-height: 132px; padding: 1.4rem 1.6rem;
      background: linear-gradient(120deg, #fff 0%, #fcf8f1 62%, #efe0c9 100%);
      border: 1px solid #eadbc6; border-radius: 20px; box-shadow: 0 9px 30px rgba(82, 57, 27, 0.08);
    }
    .an-hero::after { content: ''; position: absolute; width: 230px; height: 230px; right: -75px; top: -105px; border-radius: 50%; border: 36px solid rgba(184,137,66,0.08); }
    .hero-copy { position: relative; z-index: 1; }
    .hero-kicker { color: #8f672f; margin-bottom: 0.35rem; font-size: 0.7rem; }
    .premium-pill { background: #f3e7d4; border-color: #ddc39b; color: #8f672f; }
    .an-hero h2 { color: #29241e; font-size: clamp(1.55rem, 2.5vw, 2.05rem); }
    .hero-sub { color: #756a5c; margin-top: 0.4rem; font-size: 0.9rem; }
    .hero-mark { position: relative; z-index: 1; width: 64px; height: 64px; flex: 0 0 64px; display: grid; place-items: center; border-radius: 18px; background: #fff; color: #b88942; font-size: 1.45rem; box-shadow: 0 10px 24px rgba(117,80,33,0.14); }

    .state-msg, .state-empty { color: #817565; background: #fff; border-color: #e9dece; box-shadow: 0 6px 20px rgba(83,61,34,0.05); }
    .paywall-card { color: #302a23; background: #fff; border-color: #ddc39b; box-shadow: 0 12px 32px rgba(83,61,34,0.1); }
    .paywall-icon { background: #f5ead9; color: #b88942; }
    .paywall-card h3 { color: #2d2821; }
    .paywall-features, .paywall-terms, .price-per { color: #776c5e; }
    .paywall-features i { color: #168c80; }
    .paywall-price { color: #2d2821; }
    .price-amount { color: #b88942; }

    .sub-strip { background: #fffaf3; border-color: #e5d1b2; color: #746858; padding: 0.7rem 0.9rem; }
    .sub-info i { color: #b88942; }
    .tab-bar { gap: 0; width: fit-content; padding: 4px; border: 1px solid #e7dac7; border-radius: 12px; background: #f5ede2; }
    .tab-btn { border: 0; border-radius: 9px; color: #7d7162; padding: 0.52rem 1rem; }
    .tab-btn:hover { color: #3a332b; }
    .tab-btn--active { color: #8f672f; background: #fff; border-color: transparent; box-shadow: 0 2px 8px rgba(82,57,27,0.12); }
    .panel { gap: 1.15rem; }
    .trend-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .insights-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 1rem; align-items: stretch; }
    .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-top: 0.45rem; padding: 0 0.15rem; }
    .section-heading span { color: #a3783d; font-size: 0.67rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; }
    .section-heading h3 { margin: 0.18rem 0 0; color: #302a23; font-size: 1.1rem; }
    .section-heading p { margin: 0; color: #8a7e6f; font-size: 0.78rem; text-align: right; }

    .filter-bar { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1rem 1.4rem; align-items: center; background: #fff; border-color: #e7dac7; border-radius: 16px; padding: 0.85rem 1rem; box-shadow: 0 7px 22px rgba(83,61,34,0.06); }
    .filter-intro { display: flex; align-items: center; gap: 0.65rem; padding-right: 1.2rem; border-right: 1px solid #eee3d5; }
    .filter-icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: #9a6e34; background: #f5ead9; }
    .filter-intro div { display: grid; gap: 0.1rem; white-space: nowrap; }
    .filter-intro strong { color: #373029; font-size: 0.78rem; }
    .filter-intro span:not(.filter-icon) { color: #8d8172; font-size: 0.68rem; }
    .filter-controls { display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: flex-end; justify-content: space-between; min-width: 0; }
    .preset-chips { gap: 0.3rem; }
    .chip { padding: 0.42rem 0.72rem; border-color: transparent; color: #756a5d; background: #f8f3ec; }
    .chip:hover { background: #f1e7da; color: #423a31; }
    .chip--active { background: #b88942; border-color: #b88942; color: #fff; box-shadow: 0 4px 10px rgba(184,137,66,0.22); }
    .custom-range { padding-top: 0.65rem; border-top: 1px solid #eee3d5; flex-basis: 100%; }
    .field-label { color: #766b5e; font-weight: 700; }
    .field-input { background: #fff; border-color: #d8cbbc; color: #352f28; }
    .field-input:focus { outline: 3px solid rgba(184,137,66,0.13); border-color: #b88942; }

    .cancel-card { background: #fff; border-color: #eadfce; box-shadow: 0 8px 24px rgba(83,61,34,0.07); }
    .cancel-title { color: #302a23; }
    .cancel-tile { background: #faf6f0; border: 1px solid #efe5d8; }
    .tile-value { color: #a67436; }
    .tile-label { color: #887c6d; }
    .btn-primary { background: #b88942; color: #fff; box-shadow: 0 4px 12px rgba(184,137,66,0.2); }
    .btn-primary:hover:not(:disabled) { background: #9f7338; }
    .btn-ghost { border-color: #d8cbbc; color: #73685b; }
    .btn-ghost:hover:not(:disabled) { background: #f3eadf; color: #413931; }

    .modal-backdrop { background: rgba(50, 42, 33, 0.56); backdrop-filter: blur(3px); }
    .modal { background: #fff; border-color: #e4d3ba; box-shadow: 0 20px 55px rgba(43,33,21,0.3); }
    .modal-header, .modal-footer { border-color: #eee4d7; }
    .modal-title { color: #302a23; }
    .modal-title i, .modal-price-amount { color: #b88942; }
    .modal-close { color: #8b7f70; }
    .modal-price-per, .modal-copy { color: #74695c; }
    .modal-error { color: #c93f3f; }
    .btn-cancel { border-color: #d8cbbc; color: #6f6457; }
    .btn-confirm { background: #b88942; color: #fff; }
    .btn-confirm--danger { background: #d85151; }

    @media (max-width: 1050px) {
      .trend-grid, .insights-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 800px) {
      .an-shell { padding: 0.9rem; }
      .filter-bar { grid-template-columns: 1fr; }
      .filter-intro { border-right: 0; border-bottom: 1px solid #eee3d5; padding: 0 0 0.7rem; }
      .filter-controls { justify-content: flex-start; }
      .section-heading { align-items: flex-start; flex-direction: column; gap: 0.25rem; }
      .section-heading p { text-align: left; }
    }
    @media (max-width: 520px) {
      .an-shell { padding: 0.7rem; }
      .an-hero { min-height: 112px; padding: 1.1rem; }
      .hero-mark { width: 48px; height: 48px; flex-basis: 48px; border-radius: 14px; }
      .hero-sub { font-size: 0.8rem; }
      .tab-bar { width: 100%; }
      .tab-btn { flex: 1; justify-content: center; }
      .preset-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 0.2rem; width: 100%; }
      .chip { white-space: nowrap; }
      .cancel-tiles { grid-template-columns: 1fr 1fr; }
      .cancel-tile:last-child { grid-column: 1 / -1; }
    }

    /* CourtGo dark-green analytics theme */
    :host { --gold: #a3e635; --gold-dark: #84cc16; background: #0c1a11; color: #fff; }
    .an-shell { background: #0c1a11; }
    .an-hero {
      background: linear-gradient(120deg, #162b21 0%, #1b3028 65%, #223b2f 100%);
      border-color: rgba(163,230,53,0.14); box-shadow: 0 10px 30px rgba(0,0,0,0.28);
    }
    .an-hero::after { border-color: rgba(163,230,53,0.06); }
    .hero-kicker { color: #a3e635; }
    .premium-pill { background: rgba(163,230,53,0.12); border-color: rgba(163,230,53,0.3); color: #a3e635; }
    .an-hero h2 { color: #fff; }
    .hero-sub { color: rgba(255,255,255,0.58); }
    .hero-mark { background: rgba(163,230,53,0.12); color: #a3e635; box-shadow: none; border: 1px solid rgba(163,230,53,0.14); }

    .state-msg, .state-empty { color: rgba(255,255,255,0.55); background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 7px 22px rgba(0,0,0,0.2); }
    .paywall-card { color: #fff; background: #1b3028; border-color: rgba(163,230,53,0.24); box-shadow: 0 12px 32px rgba(0,0,0,0.28); }
    .paywall-icon { background: rgba(163,230,53,0.12); color: #a3e635; }
    .paywall-card h3, .paywall-price { color: #fff; }
    .paywall-features, .paywall-terms, .price-per { color: rgba(255,255,255,0.58); }
    .paywall-features i { color: #4ade80; }
    .price-amount { color: #a3e635; }

    .sub-strip { background: #182d23; border-color: rgba(163,230,53,0.18); color: rgba(255,255,255,0.58); }
    .sub-info i { color: #a3e635; }
    .tab-bar { background: #14271e; border-color: rgba(255,255,255,0.08); }
    .tab-btn { color: rgba(255,255,255,0.52); }
    .tab-btn:hover { color: #fff; }
    .tab-btn--active { color: #a3e635; background: #213b2f; box-shadow: 0 2px 9px rgba(0,0,0,0.24); }
    .section-heading span { color: #a3e635; }
    .section-heading h3 { color: #fff; }
    .section-heading p { color: rgba(255,255,255,0.48); }

    .filter-bar { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 7px 22px rgba(0,0,0,0.2); }
    .filter-intro { border-color: rgba(255,255,255,0.08); }
    .filter-icon { color: #a3e635; background: rgba(163,230,53,0.11); }
    .filter-intro strong { color: #fff; }
    .filter-intro span:not(.filter-icon) { color: rgba(255,255,255,0.48); }
    .chip { color: rgba(255,255,255,0.58); background: rgba(255,255,255,0.045); }
    .chip:hover { background: rgba(163,230,53,0.1); color: #d9f99d; }
    .chip--active { color: #102015; background: #a3e635; border-color: #a3e635; box-shadow: 0 4px 12px rgba(163,230,53,0.16); }
    .custom-range { border-color: rgba(255,255,255,0.08); }
    .field-label { color: rgba(255,255,255,0.52); }
    .field-input { color: #fff; background: #14271e; border-color: rgba(255,255,255,0.14); color-scheme: dark; }
    .field-input:focus { outline-color: rgba(163,230,53,0.14); border-color: #a3e635; }
    .btn-primary { color: #102015; background: #a3e635; box-shadow: 0 4px 12px rgba(163,230,53,0.17); }
    .btn-primary:hover:not(:disabled) { background: #b8f040; }
    .btn-ghost { color: rgba(255,255,255,0.65); border-color: rgba(255,255,255,0.14); }
    .btn-ghost:hover:not(:disabled) { color: #fff; background: rgba(255,255,255,0.06); }

    .cancel-card { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }
    .cancel-title { color: #fff; }
    .cancel-tile { background: rgba(255,255,255,0.035); border-color: rgba(255,255,255,0.06); }
    .tile-value { color: #a3e635; }
    .tile-label { color: rgba(255,255,255,0.48); }

    .modal-backdrop { background: rgba(4,12,7,0.72); }
    .modal { background: #1b3028; border-color: rgba(163,230,53,0.2); box-shadow: 0 20px 55px rgba(0,0,0,0.5); }
    .modal-header, .modal-footer { border-color: rgba(255,255,255,0.08); }
    .modal-title { color: #fff; }
    .modal-title i, .modal-price-amount { color: #a3e635; }
    .modal-close, .modal-price-per, .modal-copy { color: rgba(255,255,255,0.6); }
    .btn-cancel { color: rgba(255,255,255,0.68); border-color: rgba(255,255,255,0.14); }
    .btn-confirm { color: #102015; background: #a3e635; }
    .btn-confirm--danger { color: #fff; background: #ef4444; }

    @media (max-width: 800px) { .filter-intro { border-bottom-color: rgba(255,255,255,0.08); } }
  `],
})
export class AdvancedAnalyticsComponent implements OnInit {
  private appServicePayments = inject(AppServicePaymentsService);
  private clubService = inject(ClubService);
  private analytics = inject(ClubAnalyticsService);

  feeInfo = signal<FeeInfo | null>(null);
  loadingFeeInfo = signal(true);
  subscribing = signal(false);
  confirmModal = signal<{ type: 'subscribe' | 'cancel'; submitting: boolean; error: string } | null>(null);

  activeTab = signal<Tab>('dashboard');
  preset = signal<Preset>('thisMonth');
  granularity = signal<TrendGranularity>('day');
  rangeFrom = '';
  rangeTo = '';

  overview = signal<AnalyticsOverview | null>(null);
  loadingOverview = signal(false);
  engagement = signal<AnalyticsEngagement | null>(null);

  ngOnInit() {
    this.loadFeeInfo();
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

  loadFeeInfo() {
    this.loadingFeeInfo.set(true);
    this.appServicePayments.getFeeInfo().subscribe({
      next: (info) => {
        this.feeInfo.set(info);
        this.loadingFeeInfo.set(false);
        if (info.advancedAnalyticsEnabled) {
          this.setPreset('thisMonth');
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
    this.clubService.patchMyAdvancedAnalyticsAddon(enable).subscribe({
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

  // Date-range changes affect both the KPI/trend/court-performance data (overview) and the
  // peak-times/customer/booking-type/cancellation data (engagement) — refresh both together.
  loadDashboard() {
    this.loadOverview();
    this.loadEngagement();
  }

  loadOverview() {
    if (!this.rangeFrom || !this.rangeTo) return;
    this.loadingOverview.set(true);
    this.analytics.getOverview(this.rangeFrom, this.rangeTo, this.granularity()).subscribe({
      next: (o) => {
        this.overview.set(o);
        this.loadingOverview.set(false);
      },
      error: () => this.loadingOverview.set(false),
    });
  }

  loadEngagement() {
    if (!this.rangeFrom || !this.rangeTo) return;
    this.analytics.getEngagement(this.rangeFrom, this.rangeTo).subscribe({
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
}
