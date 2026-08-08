import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeakHourRow, DayOfWeekRow } from '../../../../core/services/club-analytics.service';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

@Component({
  selector: 'app-peak-times',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="peak-card">
      <div class="peak-header">
        <div>
          <span class="eyebrow">Demand</span>
          <h3 class="peak-title">Peak booking times</h3>
        </div>
        @if (activeHours().length) {
          <div class="peak-badge"><i class="fas fa-bolt"></i> {{ formatHour(peakHour()) }} peak</div>
        }
      </div>

      <div class="peak-section">
        <p class="peak-subtitle">Bookings by hour</p>
        @if (activeHours().length === 0) {
          <div class="peak-empty">No booking-time data for the selected range.</div>
        } @else {
          <div class="hour-bars">
            @for (h of byHour; track h.hour) {
              <div class="hour-col" [title]="formatHour(h.hour) + ': ' + h.bookings + ' bookings'" [class.hour-col--peak]="h.hour === peakHour()">
                <div class="hour-bar-wrap">
                  <div class="hour-bar" [style.height.%]="hourBarHeight(h.bookings)"></div>
                </div>
                @if (h.hour % 3 === 0) {
                  <span class="hour-label">{{ formatHour(h.hour) }}</span>
                }
              </div>
            }
          </div>
        }
      </div>

      <div class="peak-section">
        <p class="peak-subtitle">Bookings by weekday</p>
        @if (!byDayOfWeekOrdered().length) {
          <div class="peak-empty">No booking-day data for the selected range.</div>
        } @else {
          <div class="day-rows">
            @for (d of byDayOfWeekOrdered(); track d.day) {
              <div class="day-row">
                <span class="day-name">{{ d.day }}</span>
                <div class="day-bar-track">
                  <div class="day-bar" [style.width.%]="dayBarWidth(d.bookings)"></div>
                </div>
                <span class="day-count">{{ d.bookings }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .peak-card {
      height: 100%; box-sizing: border-box;
      background: #fff;
      border: 1px solid #eadfce;
      border-radius: 18px;
      padding: 1.1rem 1.2rem;
      box-shadow: 0 8px 24px rgba(83,61,34,0.07);
      display: grid;
      gap: 1rem;
    }
    .peak-header { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; }
    .eyebrow { color: #a3783d; font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .peak-title { margin: 0.15rem 0 0; font-size: 1rem; color: #302a23; }
    .peak-badge { padding: 0.35rem 0.55rem; border-radius: 999px; background: #f5ead9; color: #93682f; font-size: 0.67rem; font-weight: 800; white-space: nowrap; }
    .peak-badge i { margin-right: 0.2rem; }
    .peak-subtitle { margin: 0 0 0.55rem; font-size: 0.68rem; color: #8f8273; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    .peak-empty { color: #958979; font-size: 0.82rem; padding: 0.7rem 0; }

    .hour-bars { display: flex; gap: 3px; height: 118px; min-width: 0; padding: 0.25rem 0 0; border-bottom: 1px solid #eee5d9; }
    .hour-col { display: grid; grid-template-rows: 92px 18px; align-items: end; justify-items: center; min-width: 7px; height: 100%; flex: 1 1 0; }
    .hour-bar-wrap { display: flex; align-items: flex-end; width: 100%; height: 88px; }
    .hour-bar { width: 100%; min-height: 2px; background: #dcc5a1; border-radius: 4px 4px 1px 1px; transition: filter 0.15s; }
    .hour-col:hover .hour-bar { filter: brightness(0.93); }
    .hour-col--peak .hour-bar { background: linear-gradient(180deg, #c99b55, #ad7934); box-shadow: 0 3px 8px rgba(173,121,52,0.22); }
    .hour-label { font-size: 0.55rem; color: #9a8e7f; white-space: nowrap; }

    .day-rows { display: grid; gap: 0.48rem; }
    .day-row { display: grid; grid-template-columns: 90px 1fr 40px; align-items: center; gap: 0.6rem; }
    .day-name { font-size: 0.76rem; color: #71675a; }
    .day-bar-track { background: #f2ece4; border-radius: 6px; height: 8px; overflow: hidden; }
    .day-bar { height: 100%; background: linear-gradient(90deg, #c69a59, #e2c28f); border-radius: 6px; }
    .day-count { text-align: right; font-size: 0.76rem; color: #3b342c; font-weight: 800; }
    @media (max-width: 520px) { .peak-card { padding: 1rem 0.9rem; } .day-row { grid-template-columns: 72px 1fr 32px; } }

    /* Dark-green demand charts */
    .peak-card { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }
    .eyebrow { color: #a3e635; }
    .peak-title { color: #fff; }
    .peak-badge { color: #d9f99d; background: rgba(163,230,53,0.11); }
    .peak-subtitle, .peak-empty { color: rgba(255,255,255,0.45); }
    .hour-bars { border-color: rgba(255,255,255,0.08); }
    .hour-bar { background: rgba(163,230,53,0.3); }
    .hour-col--peak .hour-bar { background: linear-gradient(180deg, #b8f040, #84cc16); box-shadow: 0 3px 9px rgba(163,230,53,0.18); }
    .hour-label { color: rgba(255,255,255,0.38); }
    .day-name { color: rgba(255,255,255,0.6); }
    .day-bar-track { background: rgba(255,255,255,0.06); }
    .day-bar { background: linear-gradient(90deg, #84cc16, #a3e635); }
    .day-count { color: #fff; }
  `],
})
export class PeakTimesComponent {
  @Input() set byHour(value: PeakHourRow[]) {
    this._byHour.set(value ?? []);
  }
  get byHour(): PeakHourRow[] {
    return this._byHour();
  }
  @Input() set dayOfWeek(value: DayOfWeekRow[]) {
    this._byDayOfWeek.set(value ?? []);
  }
  private _byHour = signal<PeakHourRow[]>([]);
  private _byDayOfWeek = signal<DayOfWeekRow[]>([]);

  activeHours = computed(() => this._byHour().filter((h) => h.bookings > 0));
  private maxHourBookings = computed(() => Math.max(1, ...this._byHour().map((h) => h.bookings)));
  peakHour = computed(() => {
    const rows = this._byHour();
    if (!rows.length) return -1;
    return rows.reduce((best, r) => (r.bookings > best.bookings ? r : best), rows[0]).hour;
  });

  byDayOfWeekOrdered = computed(() => {
    const map = new Map(this._byDayOfWeek().map((d) => [d.day, d]));
    return DAY_ORDER.filter((d) => map.has(d)).map((d) => map.get(d)!);
  });
  private maxDayBookings = computed(() => Math.max(1, ...this._byDayOfWeek().map((d) => d.bookings)));

  hourBarHeight(bookings: number): number {
    return Math.max(1, (bookings / this.maxHourBookings()) * 100);
  }

  dayBarWidth(bookings: number): number {
    return Math.max(1, (bookings / this.maxDayBookings()) * 100);
  }

  formatHour(hour: number): string {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}${hour < 12 ? 'am' : 'pm'}`;
  }
}
