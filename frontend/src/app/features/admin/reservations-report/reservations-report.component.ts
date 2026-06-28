import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReservationService, Reservation } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Club } from '../../../core/services/club.service';

interface ReservationRow extends Omit<Reservation, 'court' | 'date' | 'timeSlot' | 'durationHours'> {
  court: number | null;
  date: string | null;
  timeSlot: string | null;
  durationHours?: number | null;
}

function slotToHour(slot: string): number {
  const m = slot.match(/^(\d+)(am|pm)$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  return m[2] === 'am' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}
function timeRangeLabel(r: ReservationRow): string {
  if (!r.timeSlot) return '—';
  const start = slotToHour(r.timeSlot);
  const end = start + (r.durationHours ?? 1);
  const fmt = (h: number) => {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${h < 12 ? 'am' : 'pm'}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}
function playerName(r: ReservationRow): string {
  if (r.player && typeof r.player === 'object') return r.player.name;
  if (r.guestInfo?.name) return r.guestInfo.name + ' (Guest)';
  return '—';
}
function playerEmail(r: ReservationRow): string {
  if (r.player && typeof r.player === 'object') return r.player.email;
  if (r.guestInfo?.email) return r.guestInfo.email;
  return '';
}

@Component({
  selector: 'app-reservations-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rr-shell">

      <!-- Header -->
      <div class="rr-header">
        <p class="rr-kicker"><i class="fas fa-chart-bar"></i> Superadmin</p>
        <h2 class="rr-title">Reservations Report</h2>
        <p class="rr-subtitle">Read-only view of all court reservations with status</p>
      </div>

      <!-- Summary pills -->
      <div class="summary-bar">
        <div class="stat-pill">
          <span class="stat-count">{{ reservations().length }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat-pill pill-confirmed">
          <span class="stat-count">{{ confirmedCount() }}</span>
          <span class="stat-label">Confirmed</span>
        </div>
        <div class="stat-pill pill-pending">
          <span class="stat-count">{{ pendingCount() }}</span>
          <span class="stat-label">Pending Payment</span>
        </div>
        <div class="stat-pill pill-cancelled">
          <span class="stat-count">{{ cancelledCount() }}</span>
          <span class="stat-label">Cancelled</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters">
        <input type="date" class="filter-input" [(ngModel)]="filterStartDate" placeholder="From" />
        <input type="date" class="filter-input" [(ngModel)]="filterEndDate" placeholder="To" />
        <select class="filter-input" [(ngModel)]="filterStatus">
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select class="filter-input filter-club" [(ngModel)]="filterClub">
          <option value="">All Clubs</option>
          @for (c of clubs(); track c._id) {
            <option [value]="c._id">{{ c.name }}</option>
          }
        </select>
        <input type="number" class="filter-input filter-court" [(ngModel)]="filterCourt" min="1" placeholder="Court #" />
        <button class="btn-search" (click)="load()">
          <i class="fas fa-search"></i> Search
        </button>
        <button class="clear-btn" (click)="clearFilters()">
          <i class="fas fa-times"></i> Clear
        </button>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="rr-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      }

      <!-- Empty -->
      @else if (reservations().length === 0) {
        <div class="rr-empty">
          <i class="fas fa-calendar-xmark rr-empty-icon"></i>
          <p>No reservations found. Adjust your filters and search.</p>
        </div>
      }

      <!-- Desktop table -->
      @else {
        <div class="table-wrap desktop-only">
          <table class="rr-table">
            <thead>
              <tr>
                <th>Player / Guest</th>
                <th>Club</th>
                <th>Court</th>
                <th>Date</th>
                <th>Time</th>
                <th>Duration</th>
                <th>Add-ons</th>
                <th>Status</th>
                <th>Booked</th>
              </tr>
            </thead>
            <tbody>
              @for (r of reservations(); track r._id) {
                <tr [class.row-cancelled]="r.status === 'cancelled'" [class.row-orphaned]="r._orphaned">
                  <td>
                    <div class="player-name">{{ getName(r) }}</div>
                    <div class="player-email">{{ getEmail(r) }}</div>
                  </td>
                  <td class="cell-club">{{ getClub(r) }}</td>
                  <td>{{ r.court != null ? 'Court ' + r.court : '—' }}</td>
                  <td class="cell-date">
                    @if (r._orphaned) {
                      <span class="deleted-badge">Record deleted</span>
                    } @else {
                      {{ r.date | date: 'MMM d, y' : 'UTC' }}
                    }
                  </td>
                  <td class="cell-time">{{ getTimeRange(r) }}</td>
                  <td>{{ r.durationHours != null ? r.durationHours + 'h' : '—' }}</td>
                  <td>
                    <div class="addons">
                      @if (r.hasLights) { <span class="addon-chip">💡 Lights</span> }
                      @if (r.ballBoy) { <span class="addon-chip">🎾 Ball Boy</span> }
                      @if (r.guestCount && r.guestCount > 0) { <span class="addon-chip">👥 {{ r.guestCount }}</span> }
                    </div>
                  </td>
                  <td>
                    <span class="status-badge" [class]="'status-' + r.status">
                      {{ r.status === 'pending_payment' ? 'Pending' : (r.status | titlecase) }}
                    </span>
                  </td>
                  <td class="cell-date">{{ r.createdAt | date: 'MMM d, y' : 'UTC' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="mobile-only rr-cards">
          @for (r of reservations(); track r._id) {
            <div class="rr-card" [class.card-cancelled]="r.status === 'cancelled'" [class.card-orphaned]="r._orphaned">
              <div class="card-top">
                <div>
                  <div class="player-name">{{ getName(r) }}</div>
                  <div class="player-email">{{ getEmail(r) }}</div>
                </div>
                <span class="status-badge" [class]="'status-' + r.status">
                  {{ r.status === 'pending_payment' ? 'Pending' : (r.status | titlecase) }}
                </span>
              </div>
              @if (r._orphaned) {
                <div class="card-orphan-notice"><i class="fas fa-triangle-exclamation"></i> Reservation record was deleted — date and court unknown</div>
              } @else {
                <div class="card-meta">
                  <span><i class="fas fa-building"></i> {{ getClub(r) }}</span>
                  <span><i class="fas fa-calendar-day"></i> {{ r.date | date: 'MMM d, y' : 'UTC' }}</span>
                  <span><i class="fas fa-table-tennis-paddle-ball"></i> Court {{ r.court }}</span>
                  <span><i class="fas fa-clock"></i> {{ getTimeRange(r) }}</span>
                  <span><i class="fas fa-hourglass-half"></i> {{ r.durationHours ?? 1 }}h</span>
                  @if (r.hasLights) { <span>💡 Lights</span> }
                  @if (r.ballBoy) { <span>🎾 Ball Boy</span> }
                  @if (r.guestCount && r.guestCount > 0) { <span>👥 {{ r.guestCount }} guests</span> }
                </div>
              }
              <div class="card-footer">
                Booked {{ r.createdAt | date: 'MMM d, y' : 'UTC' }}
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #0c1a11;
      --surface: #1b3028;
      --surface-hover: #213830;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.5);
      --accent: #a3e635;
    }

    .rr-shell {
      min-height: calc(100vh - 60px);
      background: var(--bg);
      padding: 1.5rem 1rem 4rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .rr-kicker {
      margin: 0 0 .2rem;
      font-size: .72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--accent);
    }
    .rr-title {
      margin: 0 0 .25rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
    }
    .rr-subtitle {
      margin: 0 0 1.5rem;
      font-size: .88rem;
      color: var(--muted);
    }

    /* Summary bar */
    .summary-bar {
      display: flex;
      flex-wrap: wrap;
      gap: .75rem;
      margin-bottom: 1.5rem;
    }
    .stat-pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: .75rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      min-width: 90px;
    }
    .stat-count {
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1;
    }
    .stat-label {
      font-size: .7rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
      margin-top: .3rem;
      white-space: nowrap;
    }
    .pill-confirmed  { border-color: rgba(163,230,53,.3); }
    .pill-confirmed .stat-count { color: var(--accent); }
    .pill-pending    { border-color: rgba(245,158,11,.3); }
    .pill-pending .stat-count   { color: #fcd34d; }
    .pill-cancelled  { border-color: rgba(255,255,255,.15); }
    .pill-cancelled .stat-count { color: var(--muted); }

    /* Filters */
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .filter-input {
      padding: .45rem .75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font-size: .88rem;
      outline: none;
      transition: border-color .15s;
      color-scheme: dark;
    }
    .filter-input:focus { border-color: var(--accent); }
    .filter-input option { background: #1b3028; }
    .filter-club  { min-width: 150px; }
    .filter-court { width: 90px; }
    .btn-search {
      padding: .45rem 1rem;
      border: none;
      border-radius: 8px;
      background: var(--accent);
      color: #0c1a11;
      font-size: .82rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: .35rem;
      transition: opacity .15s;
    }
    .btn-search:hover { opacity: .85; }
    .clear-btn {
      padding: .45rem .9rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: .82rem;
      display: flex;
      align-items: center;
      gap: .35rem;
      transition: all .15s;
    }
    .clear-btn:hover { background: var(--surface-hover); color: var(--text); }

    /* States */
    .rr-loading {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: 3rem 0;
      color: var(--muted);
      font-size: .9rem;
    }
    .rr-empty {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--muted);
    }
    .rr-empty-icon {
      font-size: 2.5rem;
      color: var(--accent);
      opacity: .35;
      display: block;
      margin-bottom: .75rem;
    }
    .rr-empty p { font-size: .92rem; margin: 0; }

    /* Desktop table */
    .table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid var(--border); }
    .rr-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
    .rr-table th {
      background: var(--surface);
      color: var(--accent);
      text-align: left;
      padding: .75rem 1rem;
      font-size: .72rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .rr-table td {
      padding: .75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      vertical-align: middle;
    }
    .rr-table tbody tr:last-child td { border-bottom: none; }
    .rr-table tbody tr { background: transparent; transition: background .12s; }
    .rr-table tbody tr:hover td { background: var(--surface-hover); }
    .rr-table tbody tr.row-cancelled td { opacity: .45; }
    .rr-table tbody tr.row-orphaned td { background: rgba(245,158,11,.04); }
    .deleted-badge {
      display: inline-flex;
      align-items: center;
      gap: .3rem;
      font-size: .7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      background: rgba(245,158,11,.12);
      color: #fcd34d;
      white-space: nowrap;
    }

    .player-name { font-weight: 600; color: var(--text); }
    .player-email { font-size: .78rem; color: var(--muted); margin-top: .1rem; }
    .cell-date { white-space: nowrap; color: var(--muted); }
    .cell-time { font-weight: 700; color: var(--accent); }
    .cell-club { white-space: nowrap; color: var(--muted); font-size: .85rem; }

    .addons { display: flex; flex-wrap: wrap; gap: .3rem; }
    .addon-chip {
      font-size: .7rem;
      background: rgba(163,230,53,0.08);
      color: var(--accent);
      border: 1px solid rgba(163,230,53,0.2);
      padding: 2px 7px;
      border-radius: 6px;
    }

    /* Status badges */
    .status-badge {
      display: inline-block;
      padding: .2rem .65rem;
      border-radius: 8px;
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      white-space: nowrap;
    }
    .status-confirmed       { background: rgba(163,230,53,.12); color: var(--accent); }
    .status-cancelled       { background: rgba(255,255,255,.07); color: var(--muted); }
    .status-pending_payment { background: rgba(245,158,11,.15); color: #fcd34d; }

    /* Mobile cards */
    .rr-cards { display: flex; flex-direction: column; gap: .75rem; }
    .rr-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem;
    }
    .rr-card.card-cancelled { opacity: .5; }
    .rr-card.card-orphaned { border-color: rgba(245,158,11,.25); background: rgba(245,158,11,.04); }
    .card-orphan-notice {
      font-size: .78rem;
      color: #fcd34d;
      display: flex;
      align-items: center;
      gap: .4rem;
      margin-bottom: .5rem;
      opacity: .85;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: .6rem;
    }
    .card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem .75rem;
      font-size: .8rem;
      color: var(--muted);
      margin-bottom: .5rem;
    }
    .card-footer {
      font-size: .75rem;
      color: var(--muted);
      opacity: .7;
    }

    /* Responsive */
    .desktop-only { display: block; }
    .mobile-only  { display: none; }
    @media (max-width: 640px) {
      .desktop-only { display: none; }
      .mobile-only  { display: block; }
      .filters { flex-direction: column; align-items: stretch; }
      .filter-court { width: 100%; }
    }
  `],
})
export class ReservationsReportComponent implements OnInit {
  private svc = inject(ReservationService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private clubSvc = inject(ClubService);

  reservations = signal<ReservationRow[]>([]);
  loading = signal(false);
  clubs = signal<Club[]>([]);

  filterStartDate = '';
  filterEndDate = '';
  filterStatus = '';
  filterClub = '';
  filterCourt = '';

  confirmedCount = computed(() => this.reservations().filter(r => r.status === 'confirmed').length);
  pendingCount   = computed(() => this.reservations().filter(r => r.status === 'pending_payment').length);
  cancelledCount = computed(() => this.reservations().filter(r => r.status === 'cancelled').length);

  ngOnInit() {
    if (!this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.clubSvc.getClubs().subscribe(clubs => this.clubs.set(clubs.filter(c => c.status !== 'suspended')));
    this.load();
  }

  load() {
    this.loading.set(true);
    const filters: Record<string, string> = {};
    if (this.filterStartDate) filters['startDate'] = this.filterStartDate;
    if (this.filterEndDate)   filters['endDate']   = this.filterEndDate;
    if (this.filterStatus)    filters['status']    = this.filterStatus;
    if (this.filterClub)      filters['clubId']    = this.filterClub;
    if (this.filterCourt)     filters['court']     = this.filterCourt;
    this.svc.getAll(filters).subscribe({
      next: (data) => { this.reservations.set(data as ReservationRow[]); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  clearFilters() {
    this.filterStartDate = '';
    this.filterEndDate   = '';
    this.filterStatus    = '';
    this.filterClub      = '';
    this.filterCourt     = '';
    this.load();
  }

  getName(r: ReservationRow)  { return playerName(r); }
  getEmail(r: ReservationRow) { return playerEmail(r); }
  getTimeRange(r: ReservationRow) { return timeRangeLabel(r); }
  getClub(r: ReservationRow): string {
    return r.clubId && typeof r.clubId === 'object' ? r.clubId.name : '—';
  }
}
