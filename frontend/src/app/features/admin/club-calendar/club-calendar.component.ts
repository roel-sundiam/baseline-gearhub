import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService, Reservation } from '../../../core/services/reservation.service';
import { ClubService, Club } from '../../../core/services/club.service';
import { CalendarViewComponent } from '../../../shared/components/calendar-view/calendar-view.component';

@Component({
  selector: 'app-club-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarViewComponent],
  template: `
    <div class="shell">

      <div class="header">
        <p class="kicker"><i class="fas fa-calendar-alt"></i> Superadmin</p>
        <h2 class="title">Club Calendar</h2>
        <p class="subtitle">Select a club to view its court reservations</p>
      </div>

      <div class="club-row">
        <select class="club-select" [(ngModel)]="selectedClubId" (ngModelChange)="onClubChange($event)">
          <option value="">— Select a club —</option>
          @for (club of clubs; track club._id) {
            <option [value]="club._id">{{ club.name }}</option>
          }
        </select>
      </div>

      @if (!selectedClubId) {
        <div class="empty">
          <i class="fas fa-calendar-alt empty-icon"></i>
          <p>Choose a club above to load its calendar.</p>
        </div>
      } @else if (loading) {
        <div class="cal-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else {
        <app-calendar-view [reservations]="reservations" theme="light" [courtCount]="courtCount" />
      }

    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #0c1a11;
      --surface: #1b3028;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.5);
      --accent: #a3e635;
    }

    .shell {
      min-height: calc(100vh - 60px);
      background: var(--bg);
      padding: 1.5rem 1rem 4rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    .kicker {
      margin: 0 0 .2rem;
      font-size: .72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--accent);
    }
    .title {
      margin: 0 0 .25rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
    }
    .subtitle {
      margin: 0 0 1.5rem;
      font-size: .88rem;
      color: var(--muted);
    }

    .club-row {
      margin-bottom: 1.5rem;
    }
    .club-select {
      padding: .55rem .9rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-size: .92rem;
      font-family: inherit;
      outline: none;
      min-width: 260px;
      color-scheme: dark;
      transition: border-color .15s;
    }
    .club-select:focus { border-color: var(--accent); }
    .club-select option { background: #1b3028; }

    .empty {
      text-align: center;
      padding: 5rem 1rem;
      color: var(--muted);
    }
    .empty-icon {
      font-size: 2.5rem;
      color: var(--accent);
      opacity: .3;
      display: block;
      margin-bottom: .75rem;
    }
    .empty p { font-size: .92rem; margin: 0; }

    .cal-loading {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: 3rem 0;
      color: var(--muted);
      font-size: .9rem;
    }
  `],
})
export class ClubCalendarComponent implements OnInit {
  clubs: Club[] = [];
  selectedClubId = '';
  selectedClub: Club | null = null;
  reservations: Reservation[] = [];
  loading = false;

  get courtCount(): number {
    return this.selectedClub?.courtCount ?? 2;
  }

  constructor(
    private reservationService: ReservationService,
    private clubService: ClubService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.clubService.getClubs().subscribe({
      next: (clubs) => {
        this.clubs = clubs.filter(c => c.status === 'active');
        this.cdr.detectChanges();
      },
    });
  }

  onClubChange(clubId: string) {
    this.selectedClub = this.clubs.find(c => c._id === clubId) ?? null;
    this.reservations = [];
    if (!clubId) { this.cdr.detectChanges(); return; }
    this.loading = true;
    this.cdr.detectChanges();
    this.reservationService.getAll({ clubId }).subscribe({
      next: (res) => { this.reservations = res; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }
}
