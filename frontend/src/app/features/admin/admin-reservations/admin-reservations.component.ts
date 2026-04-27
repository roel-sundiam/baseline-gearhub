import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService, Reservation } from '../../../core/services/reservation.service';

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h2>Court Reservations</h2>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input type="date" class="filter-input" [(ngModel)]="filterDate" (change)="load()" placeholder="Filter by date" />
      <select class="filter-input" [(ngModel)]="filterCourt" (change)="load()">
        <option value="">All Courts</option>
        <option value="1">Court 1</option>
        <option value="2">Court 2</option>
      </select>
      <button class="clear-btn" (click)="clearFilters()">Clear</button>
    </div>

    @if (loading) {
      <div class="loading">Loading...</div>
    } @else if (reservations.length === 0) {
      <div class="empty">No reservations found.</div>
    } @else {
      <!-- Desktop table -->
      <div class="table-wrap desktop-only">
        <table class="res-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Date</th>
              <th>Court</th>
              <th>Time</th>
              <th>Lights</th>
              <th>Players</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (r of reservations; track r._id) {
              <tr [class.cancelled-row]="r.status === 'cancelled'">
                <td>
                  <div class="player-name">{{ playerName(r) }}</div>
                  <div class="player-email">{{ playerEmail(r) }}</div>
                </td>
                <td>{{ r.date | date: 'MMM d, y' : 'UTC' }}</td>
                <td>Court {{ r.court }}</td>
                <td>{{ r.timeSlot }}</td>
                <td>{{ r.hasLights ? '💡 Yes' : '—' }}</td>
                <td>
                  @if (r.players && r.players.length > 0) {
                    <span class="players-list">{{ r.players.map(p => p.name).join(', ') }}</span>
                  } @else { <span class="no-players">—</span> }
                </td>
                <td>
                  <span class="status-badge status-{{ r.status }}">{{ r.status }}</span>
                </td>
                <td class="actions">
                  @if (r.status === 'confirmed') {
                    <button class="btn-cancel" [disabled]="acting === r._id" (click)="cancel(r)">
                      {{ acting === r._id ? '...' : 'Cancel' }}
                    </button>
                  }
                  <button class="btn-delete" [disabled]="acting === r._id" (click)="deleteRes(r)">
                    {{ acting === r._id ? '...' : 'Delete' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="mobile-only res-list">
        @for (r of reservations; track r._id) {
          <div class="res-card" [class.cancelled]="r.status === 'cancelled'">
            <div class="res-top">
              <div>
                <div class="player-name">{{ playerName(r) }}</div>
                <div class="player-email">{{ playerEmail(r) }}</div>
              </div>
              <span class="status-badge status-{{ r.status }}">{{ r.status }}</span>
            </div>
            <div class="res-details">
              <span>Court {{ r.court }}</span>
              <span>{{ r.date | date: 'MMM d, y' : 'UTC' }}</span>
              <span>{{ r.timeSlot }}</span>
              @if (r.hasLights) { <span>💡 Lights</span> }
            </div>
            <div class="res-actions">
              @if (r.status === 'confirmed') {
                <button class="btn-cancel" [disabled]="acting === r._id" (click)="cancel(r)">
                  {{ acting === r._id ? '...' : 'Cancel' }}
                </button>
              }
              <button class="btn-delete" [disabled]="acting === r._id" (click)="deleteRes(r)">
                {{ acting === r._id ? '...' : 'Delete' }}
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 1.5rem; }
    .page-header h2 { color: var(--primary); font-size: 1.4rem; }

    .filters {
      display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: center;
    }
    .filter-input {
      padding: .5rem .75rem; border: 2px solid #e5e7eb; border-radius: 8px;
      font-size: .9rem; outline: none; transition: border-color .2s;
    }
    .filter-input:focus { border-color: var(--primary); }
    .clear-btn {
      padding: .5rem 1rem; border: 1px solid #d1d5db; border-radius: 8px;
      background: #f9fafb; cursor: pointer; font-size: .88rem; transition: all .2s;
    }
    .clear-btn:hover { background: #e5e7eb; }

    .loading { color: #666; padding: 2rem 0; }
    .empty { color: #666; padding: 2rem 0; text-align: center; }

    .table-wrap { overflow-x: auto; }
    .res-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    .res-table th {
      background: #f8f1e4; color: var(--primary);
      text-align: left; padding: .75rem 1rem;
      font-size: .8rem; text-transform: uppercase; letter-spacing: .5px;
      border-bottom: 2px solid #e6d2ad;
    }
    .res-table td { padding: .75rem 1rem; border-bottom: 1px solid #f3f4f6; }
    .res-table tr:hover td { background: #fafff8; }
    .cancelled-row td { opacity: .55; }

    .player-name { font-weight: 600; color: #1a1a1a; }
    .player-email { font-size: .8rem; color: #6b7280; }
    .players-list { font-size: .85rem; color: #374151; }
    .no-players { color: #d1d5db; }

    .status-badge {
      padding: .2rem .65rem; border-radius: 10px;
      font-size: .78rem; font-weight: 700; text-transform: capitalize;
    }
    .status-confirmed { background: #f4ead6; color: #7a5626; }
    .status-cancelled { background: #f3f4f6; color: #6b7280; }

    .actions { display: flex; gap: .5rem; }
    .btn-cancel {
      padding: .3rem .7rem; border: 1px solid #f59e0b; border-radius: 6px;
      background: transparent; color: #92400e; font-size: .8rem; cursor: pointer; transition: all .2s;
    }
    .btn-cancel:hover:not(:disabled) { background: #fef3c7; }
    .btn-delete {
      padding: .3rem .7rem; border: 1px solid #ef4444; border-radius: 6px;
      background: transparent; color: #ef4444; font-size: .8rem; cursor: pointer; transition: all .2s;
    }
    .btn-delete:hover:not(:disabled) { background: #fee2e2; }
    .btn-cancel:disabled, .btn-delete:disabled { opacity: .5; cursor: not-allowed; }

    /* Mobile */
    .desktop-only { display: block; }
    .mobile-only { display: none; }
    @media (max-width: 640px) {
      .desktop-only { display: none; }
      .mobile-only { display: flex; flex-direction: column; gap: .75rem; }
    }
    .res-list { }
    .res-card {
      background: #fafafa; border-radius: 12px; padding: 1rem 1.25rem;
      border-left: 4px solid var(--primary);
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .res-card.cancelled { border-left-color: #9ca3af; opacity: .7; }
    .res-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: .75rem; }
    .res-details { display: flex; flex-wrap: wrap; gap: .5rem; font-size: .88rem; color: #374151; margin-bottom: .75rem; }
    .res-details span { background: #f3f4f6; border-radius: 6px; padding: .2rem .5rem; }
    .res-actions { display: flex; gap: .5rem; }
  `],
})
export class AdminReservationsComponent implements OnInit {
  reservations: Reservation[] = [];
  loading = true;
  acting = '';
  filterDate = '';
  filterCourt = '';

  constructor(
    private reservationService: ReservationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const filters: { date?: string; court?: string } = {};
    if (this.filterDate) filters.date = this.filterDate;
    if (this.filterCourt) filters.court = this.filterCourt;
    this.reservationService.getAll(filters).subscribe({
      next: (res) => {
        this.reservations = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  clearFilters() {
    this.filterDate = '';
    this.filterCourt = '';
    this.load();
  }

  playerName(r: Reservation): string {
    return typeof r.player === 'object' ? r.player.name : '—';
  }

  playerEmail(r: Reservation): string {
    return typeof r.player === 'object' ? r.player.email : '';
  }

  cancel(r: Reservation) {
    if (!confirm(`Cancel Court ${r.court} at ${r.timeSlot} for ${this.playerName(r)}?`)) return;
    this.acting = r._id;
    this.reservationService.cancel(r._id).subscribe({
      next: () => { this.acting = ''; this.load(); },
      error: () => { this.acting = ''; this.cdr.detectChanges(); },
    });
  }

  deleteRes(r: Reservation) {
    if (!confirm(`Permanently delete this reservation? This cannot be undone.`)) return;
    this.acting = r._id;
    this.reservationService.delete(r._id).subscribe({
      next: () => { this.acting = ''; this.load(); },
      error: () => { this.acting = ''; this.cdr.detectChanges(); },
    });
  }
}


