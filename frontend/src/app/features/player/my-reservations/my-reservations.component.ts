import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ReservationService, Reservation } from '../../../core/services/reservation.service';

type Tab = 'upcoming' | 'history' | 'all';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
      <div class="page-card">
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <h2>Reservations</h2>
          <button class="new-btn" (click)="reserve()">+ Reserve</button>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn" [class.active]="activeTab === 'upcoming'" (click)="setTab('upcoming')">
            Upcoming
            @if (upcoming.length > 0) { <span class="tab-badge">{{ upcoming.length }}</span> }
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'history'" (click)="setTab('history')">
            History
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'all'" (click)="setTab('all')">
            All Reservations
          </button>
        </div>

        <div class="card-body">
          @if (loading) {
            <div class="loading">Loading reservations...</div>
          } @else {

            <!-- UPCOMING TAB -->
            @if (activeTab === 'upcoming') {
              @if (upcoming.length === 0) {
                <div class="empty-state">
                  <span>📅</span>
                  <p>No upcoming reservations.</p>
                  <button class="cta-btn" (click)="reserve()">Reserve a Court</button>
                </div>
              } @else {
                <div class="res-list">
                  @for (r of upcoming; track r._id) {
                    <div class="res-card upcoming-card">
                      <div class="res-left">
                        <div class="res-court">Court {{ r.court }}</div>
                        <div class="res-date">{{ r.date | date: 'EEE, MMM d, y' : 'UTC' }}</div>
                        <div class="res-time">
                          {{ formatSlot(r.timeSlot) }}
                          @if (r.hasLights) { <span class="lights-tag">💡 Lights</span> }
                        </div>
                        @if (r.players && r.players.length > 0) {
                          <div class="res-with">with {{ playerNames(r) }}</div>
                        }
                      </div>
                      <div class="res-right">
                        <span class="status-badge status-confirmed">confirmed</span>
                        <button
                          class="icon-cancel-btn"
                          [class.spinning]="cancelling === r._id"
                          [disabled]="cancelling === r._id"
                          (click)="openCancelModal(r)"
                          title="Cancel reservation"
                        >
                          @if (cancelling === r._id) {
                            <i class="fas fa-circle-notch fa-spin"></i>
                          } @else {
                            <i class="fas fa-calendar-times"></i>
                          }
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            }

            <!-- HISTORY TAB -->
            @if (activeTab === 'history') {
              @if (history.length === 0) {
                <div class="empty-state">
                  <span>🎾</span>
                  <p>No past reservations yet.</p>
                </div>
              } @else {
                <div class="res-list">
                  @for (r of history; track r._id) {
                    <div class="res-card" [class.cancelled-card]="r.status === 'cancelled'">
                      <div class="res-left">
                        <div class="res-court">Court {{ r.court }}</div>
                        <div class="res-date">{{ r.date | date: 'EEE, MMM d, y' : 'UTC' }}</div>
                        <div class="res-time">
                          {{ formatSlot(r.timeSlot) }}
                          @if (r.hasLights) { <span class="lights-tag">💡 Lights</span> }
                        </div>
                        @if (r.players && r.players.length > 0) {
                          <div class="res-with">with {{ playerNames(r) }}</div>
                        }
                      </div>
                      <div class="res-right">
                        <span class="status-badge status-{{ r.status }}">{{ r.status }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            }

            <!-- ALL RESERVATIONS TAB -->
            @if (activeTab === 'all') {
              @if (allReservations.length === 0) {
                <div class="empty-state">
                  <span>🗓️</span>
                  <p>No reservations on the books.</p>
                </div>
              } @else {
                @for (group of groupedAll; track group.date) {
                  <div class="date-group">
                    <div class="date-label">{{ group.date | date: 'EEEE, MMMM d, y' : 'UTC' }}</div>
                    <div class="res-list">
                      @for (r of group.items; track r._id) {
                        <div class="res-card all-card" [class.mine]="isMine(r)">
                          <div class="res-left">
                            <div class="res-court">Court {{ r.court }}</div>
                            <div class="res-time">
                              {{ formatSlot(r.timeSlot) }}
                              @if (r.hasLights) { <span class="lights-tag">💡</span> }
                            </div>
                            <div class="res-booker">
                              {{ bookerName(r) }}
                              @if (isMine(r)) { <span class="you-tag">you</span> }
                              @if (r.players && r.players.length > 0) {
                                + {{ playerNames(r) }}
                              }
                            </div>
                          </div>
                          <div class="res-right">
                            <span class="status-badge status-confirmed">confirmed</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            }

          }
        </div>
      </div>
    </div>

    <!-- Cancel Modal -->
    @if (modalReservation) {
      <div class="modal-backdrop" (click)="closeCancelModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-icon-wrap">
            <div class="modal-icon">
              <i class="fas fa-calendar-times"></i>
            </div>
          </div>
          <h3 class="modal-title">Cancel Reservation?</h3>
          <p class="modal-subtitle">This action cannot be undone.</p>
          <div class="modal-details">
            <div class="modal-detail-row">
              <i class="fas fa-border-all"></i>
              <span>Court {{ modalReservation.court }}</span>
            </div>
            <div class="modal-detail-row">
              <i class="fas fa-calendar"></i>
              <span>{{ modalReservation.date | date: 'EEEE, MMMM d, y' : 'UTC' }}</span>
            </div>
            <div class="modal-detail-row">
              <i class="fas fa-clock"></i>
              <span>{{ formatSlot(modalReservation.timeSlot) }}</span>
            </div>
            @if (modalReservation.hasLights) {
              <div class="modal-detail-row">
                <i class="fas fa-lightbulb"></i>
                <span>With Lights</span>
              </div>
            }
          </div>
          <div class="modal-actions">
            <button class="modal-btn modal-btn-keep" (click)="closeCancelModal()">
              Keep It
            </button>
            <button
              class="modal-btn modal-btn-cancel"
              [disabled]="cancelling !== ''"
              (click)="confirmCancel()"
            >
              @if (cancelling !== '') {
                <i class="fas fa-circle-notch fa-spin"></i> Cancelling...
              } @else {
                <i class="fas fa-times"></i> Cancel Reservation
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .page-wrap {
      position: relative; min-height: calc(100vh - 60px);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 1.5rem;
      background: linear-gradient(135deg, rgba(0,18,0,.15), rgba(0,18,0,.05));
    }
    .court-bg {
      position: absolute; inset: 0;
      background: url('/tennis-court-surface.png') center/cover no-repeat; z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: rgba(0,18,0,.35); z-index: 0; }
    .page-card {
      position: relative; z-index: 1; background: #fff;
      border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,.45);
      width: 100%; max-width: 680px; overflow: hidden;
    }
    .card-header {
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
      padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;
    }
    .back-btn {
      background: rgba(255,255,255,.2); border: none; color: #fff;
      padding: .4rem .9rem; border-radius: 8px; cursor: pointer; font-size: .85rem; transition: background .2s;
    }
    .back-btn:hover { background: rgba(255,255,255,.35); }
    .card-header h2 { color: #fff; margin: 0; font-size: 1.3rem; flex: 1; }
    .new-btn {
      background: rgba(255,255,255,.2); border: none; color: #fff;
      padding: .4rem .9rem; border-radius: 8px; cursor: pointer;
      font-size: .85rem; font-weight: 700; transition: background .2s;
    }
    .new-btn:hover { background: rgba(255,255,255,.35); }

    /* Tabs */
    .tabs { display: flex; border-bottom: 2px solid #e5e7eb; background: #fafff8; }
    .tab-btn {
      flex: 1; padding: .85rem .5rem; border: none; background: transparent;
      font-size: .88rem; font-weight: 600; color: #6b7280; cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px;
      transition: all .2s; display: flex; align-items: center; justify-content: center; gap: .4rem;
    }
    .tab-btn:hover { color: #9f7338; background: #f8f1e4; }
    .tab-btn.active { color: #9f7338; border-bottom-color: #9f7338; background: #fff; }
    .tab-badge {
      background: #9f7338; color: #fff;
      border-radius: 10px; padding: .1rem .45rem; font-size: .72rem; font-weight: 700;
    }

    .card-body { padding: 1.5rem; }
    .loading { color: #666; padding: 2rem 0; text-align: center; }

    .empty-state { text-align: center; padding: 3rem 1rem; color: #666; }
    .empty-state span { font-size: 3rem; display: block; margin-bottom: .5rem; }
    .empty-state p { margin-bottom: 1.25rem; }
    .cta-btn {
      padding: .65rem 1.5rem;
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
      color: #fff; border: none; border-radius: 10px; font-size: .95rem; font-weight: 700; cursor: pointer;
    }

    /* Reservation cards */
    .res-list { display: flex; flex-direction: column; gap: .65rem; }
    .res-card {
      background: #fafafa; border-radius: 12px;
      padding: .9rem 1.1rem; border-left: 4px solid #e5e7eb;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .upcoming-card { border-left-color: #9f7338; }
    .cancelled-card { border-left-color: #9ca3af; opacity: .7; }
    .all-card { border-left-color: #d1d5db; }
    .all-card.mine { border-left-color: #9f7338; background: #f8f1e4; }

    .res-court { font-weight: 800; color: #9f7338; font-size: .95rem; }
    .res-date { font-size: .85rem; color: #374151; margin-top: .15rem; }
    .res-time {
      font-size: .88rem; font-weight: 600; color: #1a1a1a;
      margin-top: .1rem; display: flex; align-items: center; gap: .35rem; flex-wrap: wrap;
    }
    .res-booker { font-size: .8rem; color: #6b7280; margin-top: .15rem; }
    .res-with { font-size: .8rem; color: #6b7280; margin-top: .1rem; font-style: italic; }
    .lights-tag { font-size: .78rem; color: #92400e; background: #fef3c7; border-radius: 4px; padding: .1rem .35rem; }
    .you-tag {
      display: inline-block; background: #f4ead6; color: #7a5626;
      border-radius: 4px; padding: .05rem .35rem; font-size: .72rem; font-weight: 700;
      margin-left: .25rem; vertical-align: middle;
    }

    .res-right { display: flex; flex-direction: column; align-items: flex-end; gap: .45rem; flex-shrink: 0; }
    .status-badge {
      padding: .2rem .6rem; border-radius: 10px; font-size: .76rem; font-weight: 700; text-transform: capitalize;
    }
    .status-confirmed { background: #f4ead6; color: #7a5626; }
    .status-cancelled { background: #f3f4f6; color: #6b7280; }

    /* Icon cancel button */
    .icon-cancel-btn {
      width: 34px; height: 34px; border-radius: 50%;
      border: none; background: #fff0f0; color: #ef4444;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: .95rem;
      box-shadow: 0 1px 4px rgba(239,68,68,.2);
      transition: all .22s;
    }
    .icon-cancel-btn:hover:not(:disabled) {
      background: #ef4444; color: #fff;
      box-shadow: 0 4px 12px rgba(239,68,68,.35);
      transform: scale(1.1);
    }
    .icon-cancel-btn:disabled { opacity: .45; cursor: not-allowed; }

    /* Date groups */
    .date-group { margin-bottom: 1.5rem; }
    .date-label {
      font-size: .8rem; font-weight: 700; color: #9f7338;
      text-transform: uppercase; letter-spacing: .6px;
      padding: .3rem 0 .6rem; border-bottom: 1px solid #e5e7eb; margin-bottom: .65rem;
    }

    /* Cancel Modal */
    .modal-backdrop {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      animation: fadeIn .18s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal {
      background: #fff; border-radius: 20px;
      padding: 2rem 1.75rem; width: 100%; max-width: 380px;
      box-shadow: 0 24px 60px rgba(0,0,0,.3);
      display: flex; flex-direction: column; align-items: center; text-align: center;
      animation: slideUp .22s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(.96); } to { opacity: 1; transform: none; } }

    .modal-icon-wrap { margin-bottom: 1rem; }
    .modal-icon {
      width: 60px; height: 60px; border-radius: 50%;
      background: #fff0f0; color: #ef4444;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.6rem;
      box-shadow: 0 0 0 8px rgba(239,68,68,.08);
    }
    .modal-title { font-size: 1.2rem; font-weight: 800; color: #111; margin: 0 0 .35rem; }
    .modal-subtitle { font-size: .88rem; color: #6b7280; margin: 0 0 1.25rem; }

    .modal-details {
      width: 100%; background: #f9fafb; border-radius: 12px;
      padding: .85rem 1rem; margin-bottom: 1.5rem;
      display: flex; flex-direction: column; gap: .5rem;
    }
    .modal-detail-row {
      display: flex; align-items: center; gap: .65rem;
      font-size: .88rem; color: #374151; text-align: left;
    }
    .modal-detail-row i { color: #9f7338; width: 16px; text-align: center; flex-shrink: 0; }

    .modal-actions { display: flex; gap: .75rem; width: 100%; }
    .modal-btn {
      flex: 1; padding: .75rem; border-radius: 10px; border: none;
      font-size: .92rem; font-weight: 700; cursor: pointer; transition: all .2s;
      display: flex; align-items: center; justify-content: center; gap: .4rem;
    }
    .modal-btn-keep {
      background: #f3f4f6; color: #374151;
    }
    .modal-btn-keep:hover { background: #e5e7eb; }
    .modal-btn-cancel {
      background: linear-gradient(135deg, #dc2626, #ef4444);
      color: #fff; box-shadow: 0 4px 12px rgba(239,68,68,.3);
    }
    .modal-btn-cancel:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
    .modal-btn-cancel:disabled { opacity: .6; cursor: not-allowed; transform: none; }

    @media (max-width: 480px) {
      .page-wrap { padding: 1rem; }
      .card-body { padding: 1rem; }
      .tab-btn { font-size: .8rem; padding: .75rem .25rem; }
      .modal { padding: 1.5rem 1.25rem; }
      .modal-actions { flex-direction: column-reverse; }
    }
  `],
})
export class MyReservationsComponent implements OnInit {
  activeTab: Tab = 'upcoming';
  loading = true;
  cancelling = '';
  modalReservation: Reservation | null = null;

  myReservations: Reservation[] = [];
  allReservations: Reservation[] = [];

  get upcoming() {
    return this.myReservations
      .filter((r) => r.status === 'confirmed' && this.isOnOrAfterToday(r.date))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  get history() {
    return this.myReservations
      .filter((r) => r.status === 'cancelled' || !this.isOnOrAfterToday(r.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  get groupedAll(): { date: string; items: Reservation[] }[] {
    const map = new Map<string, Reservation[]>();
    for (const r of this.allReservations) {
      const key = r.date.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items }));
  }

  constructor(
    private reservationService: ReservationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    forkJoin({
      my: this.reservationService.getMy(),
      schedule: this.reservationService.getSchedule(),
    }).subscribe({
      next: ({ my, schedule }) => {
        this.myReservations = my;
        this.allReservations = schedule;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
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

  setTab(tab: Tab) { this.activeTab = tab; }

  isOnOrAfterToday(date: string) {
    return date.split('T')[0] >= new Date().toISOString().split('T')[0];
  }

  isMine(r: Reservation) {
    return this.myReservations.some((m) => m._id === r._id);
  }

  bookerName(r: Reservation) {
    return typeof r.player === 'object' ? r.player.name : '';
  }

  playerNames(r: Reservation) {
    return r.players?.map((p) => p.name).join(', ') ?? '';
  }

  openCancelModal(r: Reservation) {
    this.modalReservation = r;
    this.cdr.detectChanges();
  }

  closeCancelModal() {
    this.modalReservation = null;
    this.cdr.detectChanges();
  }

  confirmCancel() {
    if (!this.modalReservation) return;
    this.cancelling = this.modalReservation._id;
    this.reservationService.cancel(this.modalReservation._id).subscribe({
      next: () => {
        this.cancelling = '';
        this.modalReservation = null;
        this.load();
      },
      error: () => {
        this.cancelling = '';
        this.cdr.detectChanges();
      },
    });
  }

  goBack() { this.router.navigate(['/player/dashboard']); }
  reserve() { this.router.navigate(['/player/reserve']); }
}


