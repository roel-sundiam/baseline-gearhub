import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiComparison } from '../../../../core/services/club-analytics.service';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi-grid">
      <article class="kpi-card kpi-card--gold">
        <div class="kpi-top">
          <span class="kpi-icon"><i class="fas fa-calendar-check"></i></span>
          <span class="kpi-label">Total bookings</span>
        </div>
        <p class="kpi-value">{{ totalBookings?.current ?? 0 | number }}</p>
        <p class="kpi-delta" [class.kpi-delta--up]="isUp(totalBookings)" [class.kpi-delta--down]="isDown(totalBookings)">
          <i class="fas {{ deltaIcon(totalBookings) }}"></i>{{ deltaLabel(totalBookings) }}
        </p>
      </article>

      <article class="kpi-card kpi-card--teal">
        <div class="kpi-top">
          <span class="kpi-icon"><i class="fas fa-peso-sign"></i></span>
          <span class="kpi-label">Total revenue</span>
        </div>
        <p class="kpi-value">{{ totalRevenue?.current ?? 0 | currency: 'PHP' : 'symbol' : '1.0-2' }}</p>
        <p class="kpi-delta" [class.kpi-delta--up]="isUp(totalRevenue)" [class.kpi-delta--down]="isDown(totalRevenue)">
          <i class="fas {{ deltaIcon(totalRevenue) }}"></i>{{ deltaLabel(totalRevenue) }}
        </p>
      </article>

      <article class="kpi-card kpi-card--blue">
        <div class="kpi-top">
          <span class="kpi-icon"><i class="fas fa-chart-pie"></i></span>
          <span class="kpi-label">Court utilization</span>
        </div>
        <p class="kpi-value">
          {{ courtUtilizationPct?.current === null || courtUtilizationPct === undefined ? '—' : (courtUtilizationPct!.current + '%') }}
        </p>
        <p class="kpi-delta" [class.kpi-delta--up]="isUp(courtUtilizationPct)" [class.kpi-delta--down]="isDown(courtUtilizationPct)">
          <i class="fas {{ deltaIcon(courtUtilizationPct) }}"></i>
          {{ courtUtilizationPct?.current === null ? 'Operating hours not configured' : deltaLabel(courtUtilizationPct) }}
        </p>
      </article>

      <article class="kpi-card kpi-card--violet">
        <div class="kpi-top">
          <span class="kpi-icon"><i class="fas fa-users"></i></span>
          <span class="kpi-label">Active customers</span>
        </div>
        <p class="kpi-value">{{ activeCustomers?.current ?? 0 | number }}</p>
        <p class="kpi-delta" [class.kpi-delta--up]="isUp(activeCustomers)" [class.kpi-delta--down]="isDown(activeCustomers)">
          <i class="fas {{ deltaIcon(activeCustomers) }}"></i>{{ deltaLabel(activeCustomers) }}
        </p>
      </article>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.85rem; }
    .kpi-card {
      --accent: #b88942; --accent-rgb: 184,137,66;
      position: relative; overflow: hidden; min-width: 0;
      background: #fff; border: 1px solid #eadfce; border-radius: 17px; padding: 1rem 1.05rem;
      box-shadow: 0 7px 22px rgba(83,61,34,0.06); transition: transform 0.16s, box-shadow 0.16s;
    }
    .kpi-card::after { content: ''; position: absolute; width: 78px; height: 78px; right: -28px; top: -34px; border-radius: 50%; background: rgba(var(--accent-rgb), 0.08); }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 11px 27px rgba(83,61,34,0.1); }
    .kpi-card--teal { --accent: #168c80; --accent-rgb: 22,140,128; }
    .kpi-card--blue { --accent: #3f74b5; --accent-rgb: 63,116,181; }
    .kpi-card--violet { --accent: #8065a8; --accent-rgb: 128,101,168; }
    .kpi-top { display: flex; align-items: center; gap: 0.55rem; position: relative; z-index: 1; }
    .kpi-icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; background: rgba(var(--accent-rgb), 0.11); color: var(--accent); font-size: 0.78rem; }
    .kpi-label { color: #807466; font-size: 0.74rem; font-weight: 700; }
    .kpi-value { margin: 0.75rem 0 0; color: #2d2822; font-size: clamp(1.35rem, 2vw, 1.72rem); line-height: 1; font-weight: 800; letter-spacing: -0.035em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .kpi-delta { display: flex; align-items: center; gap: 0.3rem; min-height: 1rem; margin: 0.55rem 0 0; color: #988c7d; font-size: 0.67rem; }
    .kpi-delta i { font-size: 0.6rem; }
    .kpi-delta--up { color: #21866a; }
    .kpi-delta--down { color: #c95757; }
    @media (max-width: 1000px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 520px) { .kpi-grid { grid-template-columns: 1fr 1fr; gap: 0.65rem; } .kpi-card { padding: 0.85rem; } .kpi-value { font-size: 1.23rem; } }

    /* Dark-green dashboard palette */
    .kpi-card {
      --accent: #a3e635; --accent-rgb: 163,230,53;
      background: #1b3028; border-color: rgba(255,255,255,0.08);
      box-shadow: 0 7px 22px rgba(0,0,0,0.2);
    }
    .kpi-card:hover { box-shadow: 0 11px 27px rgba(0,0,0,0.28); }
    .kpi-card--teal { --accent: #2dd4bf; --accent-rgb: 45,212,191; }
    .kpi-card--blue { --accent: #60a5fa; --accent-rgb: 96,165,250; }
    .kpi-card--violet { --accent: #c084fc; --accent-rgb: 192,132,252; }
    .kpi-label { color: rgba(255,255,255,0.52); }
    .kpi-value { color: #fff; }
    .kpi-delta { color: rgba(255,255,255,0.4); }
    .kpi-delta--up { color: #4ade80; }
    .kpi-delta--down { color: #fb7185; }
  `],
})
export class KpiCardsComponent {
  @Input() totalBookings?: KpiComparison;
  @Input() totalRevenue?: KpiComparison;
  @Input() courtUtilizationPct?: KpiComparison;
  @Input() activeCustomers?: KpiComparison;

  isUp(kpi?: KpiComparison): boolean {
    return !!kpi && kpi.hasPreviousData && (kpi.pctChange ?? 0) > 0;
  }

  isDown(kpi?: KpiComparison): boolean {
    return !!kpi && kpi.hasPreviousData && (kpi.pctChange ?? 0) < 0;
  }

  deltaIcon(kpi?: KpiComparison): string {
    if (!kpi || !kpi.hasPreviousData || kpi.pctChange === null || kpi.pctChange === 0) return 'fa-minus';
    return kpi.pctChange > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
  }

  deltaLabel(kpi?: KpiComparison): string {
    if (!kpi || !kpi.hasPreviousData || kpi.pctChange === null) return 'No prior-period data';
    if (kpi.pctChange === 0) return 'No change from previous period';
    return `${Math.abs(kpi.pctChange)}% vs previous period`;
  }
}
