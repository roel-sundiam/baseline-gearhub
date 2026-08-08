import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BreakdownRow {
  label: string;
  count: number;
  amount: number;
  pct?: number;
}

@Component({
  selector: 'app-breakdown-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bd-card">
      <h3 class="bd-title">{{ title }}</h3>
      @if (!rows || rows.length === 0) {
        <div class="bd-empty">{{ emptyLabel }}</div>
      } @else {
        <div class="bd-rows">
          @for (r of rows; track r.label) {
            <div class="bd-row">
              <div class="bd-row-head">
                <span class="bd-label">{{ r.label }}</span>
                <span class="bd-amount">{{ amountFormat === 'currency' ? (r.amount | currency: 'PHP' : 'symbol' : '1.0-2') : (r.amount | number) }}</span>
              </div>
              <div class="bd-row-sub">
                <div class="bd-bar-track">
                  <div class="bd-bar" [style.width.%]="r.pct ?? barPct(r)"></div>
                </div>
                <span class="bd-meta">{{ r.count | number }} {{ countLabel }}@if (r.pct !== undefined) { &middot; {{ r.pct }}% }</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bd-card {
      height: 100%; box-sizing: border-box;
      background: #fff;
      border: 1px solid #eadfce;
      border-radius: 18px;
      padding: 1.1rem 1.2rem;
      box-shadow: 0 8px 24px rgba(83,61,34,0.07);
    }
    .bd-title { margin: 0 0 0.9rem; font-size: 1rem; color: #302a23; }
    .bd-empty { color: #958979; font-size: 0.85rem; padding: 1rem 0; text-align: center; }
    .bd-rows { display: grid; gap: 0.7rem; }
    .bd-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; }
    .bd-label { color: #433b33; font-size: 0.82rem; font-weight: 700; }
    .bd-amount { color: #9a6e34; font-size: 0.82rem; font-weight: 800; }
    .bd-row-sub { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.3rem; }
    .bd-bar-track { flex: 1; background: #f0e9df; border-radius: 6px; height: 7px; overflow: hidden; }
    .bd-bar { height: 100%; background: linear-gradient(90deg, #b88942, #dec08e); border-radius: 6px; }
    .bd-meta { font-size: 0.68rem; color: #918577; white-space: nowrap; }
    @media (max-width: 520px) { .bd-card { padding: 1rem 0.9rem; } }

    /* Dark-green breakdown cards */
    .bd-card { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }
    .bd-title { color: #fff; }
    .bd-empty { color: rgba(255,255,255,0.45); }
    .bd-label { color: rgba(255,255,255,0.76); }
    .bd-amount { color: #a3e635; }
    .bd-bar-track { background: rgba(255,255,255,0.06); }
    .bd-bar { background: linear-gradient(90deg, #84cc16, #a3e635); }
    .bd-meta { color: rgba(255,255,255,0.42); }
  `],
})
export class BreakdownListComponent {
  @Input() title = '';
  @Input() rows: BreakdownRow[] = [];
  @Input() amountFormat: 'currency' | 'number' = 'currency';
  @Input() countLabel = 'bookings';
  @Input() emptyLabel = 'No data for the selected range.';

  private maxAmount(): number {
    return Math.max(1, ...this.rows.map((r) => r.amount));
  }

  barPct(r: BreakdownRow): number {
    return Math.max(1, (r.amount / this.maxAmount()) * 100);
  }
}
