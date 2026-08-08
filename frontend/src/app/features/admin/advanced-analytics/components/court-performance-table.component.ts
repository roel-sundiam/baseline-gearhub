import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourtPerformanceRow } from '../../../../core/services/club-analytics.service';

type SortKey = 'bookings' | 'revenue' | 'utilizationPct';

@Component({
  selector: 'app-court-performance-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-card">
      <div class="table-header">
        <h3 class="table-title"><span class="title-icon"><i class="fas fa-table-tennis-paddle-ball"></i></span> Court performance</h3>
        <div class="sort-toggle">
          <button class="sort-btn" [class.sort-btn--active]="sortKey() === 'bookings'" (click)="setSort('bookings')">Most Bookings</button>
          <button class="sort-btn" [class.sort-btn--active]="sortKey() === 'revenue'" (click)="setSort('revenue')">Highest Revenue</button>
          <button class="sort-btn" [class.sort-btn--active]="sortKey() === 'utilizationPct'" (click)="setSort('utilizationPct')">Utilization</button>
        </div>
      </div>
      @if (!rows || rows.length === 0) {
        <div class="table-empty">No court activity for the selected range.</div>
      } @else {
        <div class="table-wrap">
          <table class="perf-table">
            <thead>
              <tr>
                <th>Court</th>
                <th class="col-num">Bookings</th>
                <th class="col-num">Revenue</th>
                <th class="col-num">Hours</th>
                <th class="col-num">Avg Duration</th>
                <th class="col-num">Utilization</th>
              </tr>
            </thead>
            <tbody>
              @for (r of sortedRows(); track r.court) {
                <tr>
                  <td><span class="court-name">{{ r.courtName }}</span></td>
                  <td class="col-num">{{ r.bookings | number }}</td>
                  <td class="col-num">{{ r.revenue | currency: 'PHP' : 'symbol' : '1.0-2' }}</td>
                  <td class="col-num">{{ r.hours | number: '1.0-1' }}</td>
                  <td class="col-num">{{ r.avgDurationHours | number: '1.0-1' }}h</td>
                  <td class="col-num">
                    @if (r.utilizationPct === null) {
                      <span class="muted">—</span>
                    } @else {
                      <div class="util-cell">
                        <span class="util-track"><span class="util-fill" [style.width.%]="r.utilizationPct"></span></span>
                        <strong>{{ r.utilizationPct }}%</strong>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .table-card { background: #fff; border: 1px solid #eadfce; border-radius: 18px; padding: 1.05rem 1.15rem; box-shadow: 0 8px 24px rgba(83,61,34,0.07); }
    .table-header { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
    .table-title { margin: 0; display: flex; align-items: center; gap: 0.55rem; font-size: 1rem; color: #302a23; }
    .title-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: #b88942; background: #f5ead9; font-size: 0.78rem; }
    .sort-toggle { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .sort-btn {
      padding: 0.28rem 0.6rem;
      border-radius: 8px;
      border: 1px solid #e1d5c5;
      background: #fff;
      color: #817567;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    .sort-btn:hover { background: #f8f3ec; color: #403930; }
    .sort-btn--active { background: #f3e7d4; border-color: #d8b987; color: #93682f; }
    .table-empty { color: #958979; font-size: 0.85rem; padding: 1.5rem 0; text-align: center; }
    .table-wrap { overflow-x: auto; }
    .perf-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .perf-table th { text-align: left; padding: 0.65rem 0.6rem; color: #8f8273; font-weight: 800; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e8ddce; }
    .perf-table td { padding: 0.68rem 0.6rem; color: #51483e; border-bottom: 1px solid #f0e8dc; }
    .perf-table tbody tr:hover { background: #fcf9f4; }
    .perf-table tbody tr:last-child td { border-bottom: 0; }
    .court-name { color: #302a23; font-weight: 750; }
    .col-num { text-align: right; }
    .util-cell { display: flex; align-items: center; justify-content: flex-end; gap: 0.55rem; min-width: 120px; }
    .util-track { width: 62px; height: 6px; border-radius: 99px; overflow: hidden; background: #efe7dc; }
    .util-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #168c80, #58b5a7); }
    .util-cell strong { min-width: 36px; color: #2f615c; font-size: 0.76rem; }
    .muted { color: #aaa093; }
    @media (max-width: 520px) { .table-card { padding: 0.9rem 0.75rem; } }

    /* Dark-green court table */
    .table-card { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }
    .table-title { color: #fff; }
    .title-icon { color: #a3e635; background: rgba(163,230,53,0.11); }
    .sort-btn { color: rgba(255,255,255,0.5); background: transparent; border-color: rgba(255,255,255,0.12); }
    .sort-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .sort-btn--active { color: #d9f99d; background: rgba(163,230,53,0.1); border-color: rgba(163,230,53,0.3); }
    .table-empty { color: rgba(255,255,255,0.45); }
    .perf-table th { color: rgba(255,255,255,0.42); border-color: rgba(255,255,255,0.09); }
    .perf-table td { color: rgba(255,255,255,0.68); border-color: rgba(255,255,255,0.06); }
    .perf-table tbody tr:hover { background: rgba(255,255,255,0.025); }
    .court-name { color: #fff; }
    .util-track { background: rgba(255,255,255,0.07); }
    .util-fill { background: linear-gradient(90deg, #14b8a6, #2dd4bf); }
    .util-cell strong { color: #5eead4; }
    .muted { color: rgba(255,255,255,0.35); }
  `],
})
export class CourtPerformanceTableComponent {
  @Input() set data(value: CourtPerformanceRow[]) {
    this._rows.set(value ?? []);
  }
  get rows() {
    return this._rows();
  }

  private _rows = signal<CourtPerformanceRow[]>([]);
  sortKey = signal<SortKey>('bookings');

  sortedRows = computed(() => {
    const key = this.sortKey();
    return [...this._rows()].sort((a, b) => {
      const av = a[key] ?? -1;
      const bv = b[key] ?? -1;
      return bv - av;
    });
  });

  setSort(key: SortKey) {
    this.sortKey.set(key);
  }
}
