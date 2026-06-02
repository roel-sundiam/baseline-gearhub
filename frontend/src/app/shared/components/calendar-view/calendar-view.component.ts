import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Reservation } from '../../../core/services/reservation.service';

interface CalDay {
  dateStr: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  items: Reservation[];
  court1Count: number;
  court2Count: number;
}

const SLOT_ORDER: Record<string, number> = {
  '5am':1,'6am':2,'7am':3,'8am':4,'9am':5,'10am':6,'11am':7,
  '12pm':8,'1pm':9,'2pm':10,'3pm':11,'4pm':12,'5pm':13,
  '6pm':14,'7pm':15,'8pm':16,'9pm':17,'10pm':18,
};

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule],
  host: { '[class.dark]': 'theme() === "dark"' },
  template: `
    <div class="cal-wrap">

      <!-- Month navigation -->
      <div class="cal-nav">
        <button class="cal-nav-btn" (click)="prevMonth()" aria-label="Previous month">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="cal-month-label">{{ monthLabel() }}</span>
        <button class="cal-nav-btn" (click)="nextMonth()" aria-label="Next month">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- Legend -->
      <div class="cal-legend">
        <span class="legend-item"><span class="legend-dot c1"></span>Court 1</span>
        <span class="legend-item"><span class="legend-dot c2"></span>Court 2</span>
      </div>

      <!-- Day-of-week headers -->
      <div class="cal-grid">
        @for (d of DOW; track d) {
          <div class="cal-dow">{{ d }}</div>
        }

        <!-- Day cells -->
        @for (cell of calendarDays(); track cell.dateStr || ('out-' + $index)) {
          <button
            class="cal-cell"
            [class.cal-cell-today]="cell.isToday"
            [class.cal-cell-out]="!cell.inMonth"
            [class.cal-cell-selected]="selectedDate() === cell.dateStr"
            [class.cal-cell-has-res]="cell.items.length > 0"
            (click)="selectDay(cell)"
            [disabled]="!cell.inMonth"
          >
            <span class="cal-day-num">{{ cell.dayNum }}</span>
            @if (cell.inMonth && (cell.court1Count > 0 || cell.court2Count > 0)) {
              <span class="cal-dots">
                @if (cell.court1Count > 0) {
                  <span class="cal-dot c1">{{ cell.court1Count }}</span>
                }
                @if (cell.court2Count > 0) {
                  <span class="cal-dot c2">{{ cell.court2Count }}</span>
                }
              </span>
            }
          </button>
        }
      </div>

      <!-- Selected day detail panel -->
      @if (selectedDate() && selectedDayItems().length > 0) {
        <div class="cal-panel">
          <div class="cal-panel-date">{{ (selectedDate()! + 'T00:00:00Z') | date: 'EEEE, MMMM d, y' : 'UTC' }}</div>
          <div class="cal-panel-list">
            @for (r of selectedDayItems(); track r._id) {
              <div class="cal-res-card" [class.cal-res-mine]="myIds().includes(r._id)">
                <span class="cal-court-bar" [class.c1]="r.court === 1" [class.c2]="r.court === 2"></span>
                <div class="cal-res-info">
                  <div class="cal-res-top">
                    <strong class="cal-res-court">Court {{ r.court }}</strong>
                    <span class="cal-res-time">{{ formatSlot(r.timeSlot) }}</span>
                    @if (r.hasLights) { <span class="cal-lights">💡</span> }
                    @if (myIds().includes(r._id)) { <span class="cal-you-tag">you</span> }
                  </div>
                  <div class="cal-res-player">
                    <i class="far fa-user"></i> {{ bookerName(r) }}
                    @if (r.players && r.players.length > 0) {
                      · {{ playerNamesSlice(r.players) }}
                      @if (r.players.length > 2) { +{{ r.players.length - 2 }} more }
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (selectedDate() && selectedDayItems().length === 0) {
        <div class="cal-panel cal-panel-empty">
          <i class="far fa-calendar"></i> No reservations on this day
        </div>
      }

    </div>
  `,
  styles: [`
    /* ── Light theme defaults ── */
    :host {
      display: block;
      --cal-bg: #ffffff;
      --cal-nav-bg: #f9f7f3;
      --cal-border: #e5e7eb;
      --cal-text: #1a1a1a;
      --cal-text-muted: #6b7280;
      --cal-cell-hover: #f3f4f6;
      --cal-today-bg: #fef3c7;
      --cal-today-border: #f59e0b;
      --cal-selected-bg: #fffbeb;
      --cal-selected-border: #e6d2ad;
      --cal-out-text: #d1d5db;
      --cal-panel-bg: #f9f7f3;
      --cal-c1: #16a34a;
      --cal-c2: #2563eb;
      --cal-mine-border: #16a34a;
    }

    /* ── Dark theme (player view) ── */
    :host(.dark) {
      --cal-bg: #152a1e;
      --cal-nav-bg: #0f2117;
      --cal-border: rgba(255,255,255,0.08);
      --cal-text: #ffffff;
      --cal-text-muted: rgba(255,255,255,0.45);
      --cal-cell-hover: rgba(255,255,255,0.06);
      --cal-today-bg: rgba(163,230,53,0.15);
      --cal-today-border: #a3e635;
      --cal-selected-bg: rgba(163,230,53,0.12);
      --cal-selected-border: #a3e635;
      --cal-out-text: rgba(255,255,255,0.15);
      --cal-panel-bg: rgba(255,255,255,0.04);
      --cal-c1: #4ade80;
      --cal-c2: #60a5fa;
      --cal-mine-border: #a3e635;
    }

    .cal-wrap {
      background: var(--cal-bg);
      border-radius: 14px;
      border: 1px solid var(--cal-border);
      overflow: hidden;
    }

    /* ── Nav ── */
    .cal-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--cal-nav-bg);
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--cal-border);
    }
    .cal-nav-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--cal-border);
      background: var(--cal-bg);
      color: var(--cal-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      transition: all 0.15s;
    }
    .cal-nav-btn:hover { background: var(--cal-cell-hover); }
    .cal-month-label {
      font-size: 0.95rem;
      font-weight: 800;
      color: var(--cal-text);
      letter-spacing: -0.2px;
    }

    /* ── Legend ── */
    .cal-legend {
      display: flex;
      gap: 1rem;
      padding: 0.45rem 1rem;
      border-bottom: 1px solid var(--cal-border);
      background: var(--cal-nav-bg);
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      color: var(--cal-text-muted);
      font-weight: 600;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .legend-dot.c1 { background: var(--cal-c1); }
    .legend-dot.c2 { background: var(--cal-c2); }

    /* ── Grid ── */
    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      border-bottom: 1px solid var(--cal-border);
    }
    .cal-dow {
      text-align: center;
      padding: 0.55rem 0;
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--cal-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--cal-border);
    }

    /* ── Cell ── */
    .cal-cell {
      min-height: 56px;
      padding: 0.35rem 0.3rem 0.25rem;
      border: none;
      border-right: 1px solid var(--cal-border);
      border-bottom: 1px solid var(--cal-border);
      background: var(--cal-bg);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      transition: background 0.12s;
      position: relative;
    }
    .cal-cell:nth-child(7n) { border-right: none; }
    .cal-cell:hover:not(:disabled):not(.cal-cell-out) { background: var(--cal-cell-hover); }
    .cal-cell:disabled { cursor: default; }
    .cal-cell-out {
      background: transparent;
    }
    .cal-cell-today {
      background: var(--cal-today-bg);
    }
    .cal-cell-today .cal-day-num {
      background: var(--cal-today-border);
      color: #ffffff;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cal-cell-selected {
      background: var(--cal-selected-bg) !important;
      outline: 2px solid var(--cal-selected-border);
      outline-offset: -2px;
    }

    .cal-day-num {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--cal-text);
      line-height: 1;
    }
    .cal-cell-out .cal-day-num { color: var(--cal-out-text); }

    /* ── Dots ── */
    .cal-dots {
      display: flex;
      gap: 2px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .cal-dot {
      font-size: 0.58rem;
      font-weight: 800;
      border-radius: 10px;
      padding: 0.05rem 0.3rem;
      line-height: 1.3;
    }
    .cal-dot.c1 { background: var(--cal-c1); color: #fff; }
    .cal-dot.c2 { background: var(--cal-c2); color: #fff; }

    /* ── Detail panel ── */
    .cal-panel {
      padding: 1rem;
      background: var(--cal-panel-bg);
      border-top: 1px solid var(--cal-border);
    }
    .cal-panel-empty {
      color: var(--cal-text-muted);
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .cal-panel-date {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--cal-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 0.65rem;
    }
    .cal-panel-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .cal-res-card {
      background: var(--cal-bg);
      border-radius: 10px;
      border: 1px solid var(--cal-border);
      display: flex;
      align-items: stretch;
      overflow: hidden;
    }
    .cal-res-card.cal-res-mine {
      border-color: var(--cal-mine-border);
    }
    .cal-court-bar {
      width: 4px;
      flex-shrink: 0;
    }
    .cal-court-bar.c1 { background: var(--cal-c1); }
    .cal-court-bar.c2 { background: var(--cal-c2); }

    .cal-res-info {
      flex: 1;
      padding: 0.55rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .cal-res-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .cal-res-court {
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--cal-text);
    }
    .cal-res-time {
      font-size: 0.78rem;
      color: var(--cal-text-muted);
      font-weight: 600;
    }
    .cal-lights { font-size: 0.78rem; }
    .cal-you-tag {
      font-size: 0.65rem;
      font-weight: 800;
      background: var(--cal-today-bg);
      color: var(--cal-today-border);
      border-radius: 4px;
      padding: 0.05rem 0.4rem;
    }
    :host(.dark) .cal-you-tag {
      background: rgba(163,230,53,0.14);
      color: #a3e635;
    }
    .cal-res-player {
      font-size: 0.74rem;
      color: var(--cal-text-muted);
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .cal-res-player i { font-size: 0.68rem; }

    /* ── Mobile responsive ── */
    @media (max-width: 400px) {
      .cal-cell { min-height: 46px; }
      .cal-day-num { font-size: 0.72rem; }
      .cal-dot { font-size: 0.52rem; padding: 0 0.2rem; }
    }
  `],
})
export class CalendarViewComponent {
  reservations = input<Reservation[]>([]);
  myIds = input<string[]>([]);
  theme = input<'dark' | 'light'>('light');

  readonly DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  private readonly MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  currentMonth = signal(new Date().getMonth());
  currentYear = signal(new Date().getFullYear());
  selectedDate = signal<string | null>(null);

  reservationsByDate = computed(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of this.reservations()) {
      if (r.status !== 'confirmed') continue;
      const key = r.date.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  });

  monthLabel = computed(() => `${this.MONTHS[this.currentMonth()]} ${this.currentYear()}`);

  calendarDays = computed((): CalDay[] => {
    const month = this.currentMonth();
    const year = this.currentYear();
    const today = new Date().toISOString().split('T')[0];
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const byDate = this.reservationsByDate();
    const cells: CalDay[] = [];

    for (let i = firstDow - 1; i >= 0; i--) {
      cells.push({ dateStr: '', dayNum: prevMonthDays - i, inMonth: false, isToday: false, items: [], court1Count: 0, court2Count: 0 });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = byDate.get(dateStr) ?? [];
      cells.push({
        dateStr,
        dayNum: d,
        inMonth: true,
        isToday: dateStr === today,
        items,
        court1Count: items.filter(r => r.court === 1).length,
        court2Count: items.filter(r => r.court === 2).length,
      });
    }

    let nextDay = 1;
    while (cells.length < 42) {
      cells.push({ dateStr: '', dayNum: nextDay++, inMonth: false, isToday: false, items: [], court1Count: 0, court2Count: 0 });
    }
    return cells;
  });

  selectedDayItems = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    const items = this.reservationsByDate().get(date) ?? [];
    return [...items].sort((a, b) =>
      a.court - b.court || (SLOT_ORDER[a.timeSlot] ?? 99) - (SLOT_ORDER[b.timeSlot] ?? 99)
    );
  });

  prevMonth() {
    const m = this.currentMonth();
    const y = this.currentYear();
    if (m === 0) { this.currentMonth.set(11); this.currentYear.set(y - 1); }
    else { this.currentMonth.set(m - 1); }
    this.selectedDate.set(null);
  }

  nextMonth() {
    const m = this.currentMonth();
    const y = this.currentYear();
    if (m === 11) { this.currentMonth.set(0); this.currentYear.set(y + 1); }
    else { this.currentMonth.set(m + 1); }
    this.selectedDate.set(null);
  }

  selectDay(cell: CalDay) {
    if (!cell.inMonth) return;
    this.selectedDate.set(this.selectedDate() === cell.dateStr ? null : cell.dateStr);
  }

  bookerName(r: Reservation): string {
    if (r.guestInfo) return r.guestInfo.name;
    return typeof r.player === 'object' && r.player ? r.player.name : '';
  }

  playerNamesSlice(players: { name: string }[]): string {
    return players.slice(0, 2).map(p => p.name).join(', ');
  }

  formatSlot(slot: string): string {
    const isPM = slot.endsWith('pm');
    const hour = parseInt(slot.replace('am', '').replace('pm', ''), 10);
    let startH = hour;
    if (isPM && hour !== 12) startH = hour + 12;
    if (!isPM && hour === 12) startH = 0;
    const endH = (startH + 1) % 24;
    const fmt = (h: number) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:00 ${period}`;
    };
    return `${fmt(startH)} – ${fmt(endH)}`;
  }
}
