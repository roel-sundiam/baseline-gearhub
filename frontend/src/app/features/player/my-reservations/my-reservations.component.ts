import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
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
    <div class="dm-shell">

      <!-- Header -->
      <header class="dm-header">
        <button class="dm-back-btn" (click)="goBack()" title="Back">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="dm-header-title">My Reservations</span>
        <button class="dm-reserve-btn" (click)="reserve()">
          <i class="fas fa-plus"></i> Reserve
        </button>
      </header>

      <!-- Tabs -->
      <div class="dm-tabs">
        <button class="dm-tab" [class.dm-tab-active]="activeTab === 'upcoming'" (click)="setTab('upcoming')">
          Upcoming
          @if (upcoming.length > 0) { <span class="dm-tab-badge">{{ upcoming.length }}</span> }
        </button>
        <button class="dm-tab" [class.dm-tab-active]="activeTab === 'history'" (click)="setTab('history')">
          History
        </button>
        <button class="dm-tab" [class.dm-tab-active]="activeTab === 'all'" (click)="setTab('all')">
          All
        </button>
      </div>

      <!-- Scrollable body -->
      <div class="dm-body">

        @if (loading) {
          <div class="dm-loading">
            <i class="fas fa-circle-notch fa-spin"></i> Loading...
          </div>
        } @else {

          <!-- UPCOMING -->
          @if (activeTab === 'upcoming') {
            @if (upcoming.length === 0) {
              <div class="dm-empty">
                <div class="dm-empty-icon"><i class="far fa-calendar-check"></i></div>
                <p class="dm-empty-text">No upcoming reservations</p>
                <button class="dm-cta-btn" (click)="reserve()">Book a Court</button>
              </div>
            } @else {
              <div class="dm-res-list">
                @for (r of upcoming; track r._id) {
                  <div class="dm-res-card dm-res-upcoming">
                    <div class="dm-res-accent"></div>
                    <div class="dm-res-main">
                      <div class="dm-res-top">
                        <span class="dm-res-court">Court {{ r.court }}</span>
                        <span class="dm-status dm-status-confirmed">confirmed</span>
                      </div>
                      <div class="dm-res-date">{{ r.date | date: 'EEE, MMM d, y' : 'UTC' }}</div>
                      <div class="dm-res-time">
                        <i class="far fa-clock"></i> {{ formatSlot(r.timeSlot) }}
                        @if (r.hasLights) { <span class="dm-lights-tag"><i class="fas fa-lightbulb"></i> Lights</span> }
                      </div>
                      @if (r.players && r.players.length > 0) {
                        <div class="dm-res-with"><i class="fas fa-user-friends"></i> with {{ playerNames(r) }}</div>
                      }
                    </div>
                    <button
                      class="dm-cancel-btn"
                      [class.spinning]="cancelling === r._id"
                      [disabled]="cancelling === r._id"
                      (click)="openCancelModal(r)"
                      title="Cancel"
                    >
                      @if (cancelling === r._id) {
                        <i class="fas fa-circle-notch fa-spin"></i>
                      } @else {
                        <i class="fas fa-calendar-times"></i>
                      }
                    </button>
                  </div>
                }
              </div>
            }
          }

          <!-- HISTORY -->
          @if (activeTab === 'history') {
            @if (history.length === 0) {
              <div class="dm-empty">
                <div class="dm-empty-icon"><i class="fas fa-history"></i></div>
                <p class="dm-empty-text">No past reservations yet</p>
              </div>
            } @else {
              <div class="dm-res-list">
                @for (r of history; track r._id) {
                  <div class="dm-res-card" [class.dm-res-cancelled]="r.status === 'cancelled'">
                    <div class="dm-res-accent"></div>
                    <div class="dm-res-main">
                      <div class="dm-res-top">
                        <span class="dm-res-court">Court {{ r.court }}</span>
                        <span class="dm-status" [class.dm-status-confirmed]="r.status === 'confirmed'" [class.dm-status-cancelled]="r.status === 'cancelled'">{{ r.status }}</span>
                      </div>
                      <div class="dm-res-date">{{ r.date | date: 'EEE, MMM d, y' : 'UTC' }}</div>
                      <div class="dm-res-time">
                        <i class="far fa-clock"></i> {{ formatSlot(r.timeSlot) }}
                        @if (r.hasLights) { <span class="dm-lights-tag"><i class="fas fa-lightbulb"></i> Lights</span> }
                      </div>
                      @if (r.players && r.players.length > 0) {
                        <div class="dm-res-with"><i class="fas fa-user-friends"></i> with {{ playerNames(r) }}</div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- ALL -->
          @if (activeTab === 'all') {
            @if (allReservations.length === 0) {
              <div class="dm-empty">
                <div class="dm-empty-icon"><i class="far fa-calendar"></i></div>
                <p class="dm-empty-text">No reservations on the books</p>
              </div>
            } @else {
              @for (group of groupedAll; track group.date) {
                <div class="dm-date-group">
                  <div class="dm-date-label">{{ group.date | date: 'EEEE, MMMM d' : 'UTC' }}</div>
                  <div class="dm-res-list">
                    @for (r of group.items; track r._id) {
                      <div class="dm-res-card" [class.dm-res-mine]="isMine(r)">
                        <div class="dm-res-accent"></div>
                        <div class="dm-res-main">
                          <div class="dm-res-top">
                            <span class="dm-res-court">Court {{ r.court }}</span>
                            <span class="dm-status dm-status-confirmed">confirmed</span>
                          </div>
                          <div class="dm-res-time">
                            <i class="far fa-clock"></i> {{ formatSlot(r.timeSlot) }}
                            @if (r.hasLights) { <span class="dm-lights-tag"><i class="fas fa-lightbulb"></i></span> }
                          </div>
                          <div class="dm-res-booker">
                            <i class="far fa-user"></i> {{ bookerName(r) }}
                            @if (isMine(r)) { <span class="dm-you-tag">you</span> }
                            @if (r.players && r.players.length > 0) { · {{ playerNames(r) }} }
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            }
          }

        }

        <div class="dm-bottom-spacer"></div>
      </div>

      <!-- Bottom navigation -->
      <nav class="dm-bottom-nav">
        <button class="dm-nav-item" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-home"></i><span>Home</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i><span>Courts</span>
        </button>
        <button class="dm-nav-item dm-nav-active">
          <i class="far fa-calendar-check"></i><span>Bookings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/tournaments?tab=rankings')">
          <i class="fas fa-trophy"></i><span>Rankings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/profile/edit')">
          <i class="far fa-user"></i><span>Profile</span>
        </button>
      </nav>
    </div>

    <!-- Cancel Modal -->
    @if (modalReservation) {
      <div class="dm-modal-backdrop" (click)="closeCancelModal()">
        <div class="dm-modal" (click)="$event.stopPropagation()">
          <div class="dm-modal-icon">
            <i class="fas fa-calendar-times"></i>
          </div>
          <h3 class="dm-modal-title">Cancel Reservation?</h3>
          <p class="dm-modal-sub">This action cannot be undone.</p>
          <div class="dm-modal-details">
            <div class="dm-modal-row"><i class="fas fa-border-all"></i> Court {{ modalReservation.court }}</div>
            <div class="dm-modal-row"><i class="fas fa-calendar"></i> {{ modalReservation.date | date: 'EEEE, MMMM d, y' : 'UTC' }}</div>
            <div class="dm-modal-row"><i class="fas fa-clock"></i> {{ formatSlot(modalReservation.timeSlot) }}</div>
            @if (modalReservation.hasLights) {
              <div class="dm-modal-row"><i class="fas fa-lightbulb"></i> With Lights</div>
            }
          </div>
          <div class="dm-modal-actions">
            <button class="dm-modal-btn dm-modal-keep" (click)="closeCancelModal()">Keep It</button>
            <button class="dm-modal-btn dm-modal-cancel" [disabled]="cancelling !== ''" (click)="confirmCancel()">
              @if (cancelling !== '') {
                <i class="fas fa-circle-notch fa-spin"></i> Cancelling...
              } @else {
                <i class="fas fa-times"></i> Cancel It
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      margin: -1.5rem;
      width: calc(100% + 3rem);
    }
    @media (min-width: 769px) {
      :host { margin: 0; width: 100%; }
    }

    /* ── Shell ── */
    .dm-shell {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      max-width: 480px;
      margin: 0 auto;
      background: #0c1a11;
      font-family: inherit;
    }

    /* ── Header ── */
    .dm-header {
      background: #0c1a11;
      padding: 1rem 1.1rem 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .dm-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      color: #a3e635;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.85rem;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }
    .dm-header-title {
      color: #ffffff;
      font-size: 1.05rem;
      font-weight: 800;
      flex: 1;
      letter-spacing: -0.2px;
    }
    .dm-reserve-btn {
      background: #a3e635;
      color: #0a1f00;
      border: none;
      border-radius: 20px;
      padding: 0.35rem 0.9rem;
      font-size: 0.78rem;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .dm-reserve-btn:hover { background: #b8f040; }

    /* ── Tabs ── */
    .dm-tabs {
      display: flex;
      background: #0c1a11;
      padding: 0.75rem 1rem 0;
      gap: 0.5rem;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .dm-tab {
      flex: 1;
      padding: 0.5rem 0.4rem;
      background: rgba(255,255,255,0.05);
      border: none;
      border-radius: 8px 8px 0 0;
      color: rgba(255,255,255,0.45);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      font-family: inherit;
    }
    .dm-tab:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.08); }
    .dm-tab-active {
      background: rgba(163,230,53,0.12);
      color: #a3e635;
      border-bottom: 2px solid #a3e635;
    }
    .dm-tab-badge {
      background: #a3e635;
      color: #0a1f00;
      border-radius: 10px;
      padding: 0.05rem 0.4rem;
      font-size: 0.65rem;
      font-weight: 800;
    }

    /* ── Scrollable body ── */
    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      -webkit-overflow-scrolling: touch;
      background: #0c1a11;
    }
    .dm-bottom-spacer { height: 80px; }

    /* ── Loading / Empty ── */
    .dm-loading {
      text-align: center;
      color: rgba(255,255,255,0.35);
      padding: 3rem 1rem;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .dm-empty {
      text-align: center;
      padding: 3rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .dm-empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(163,230,53,0.1);
      color: #a3e635;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
    }
    .dm-empty-text { color: rgba(255,255,255,0.4); font-size: 0.88rem; margin: 0; }
    .dm-cta-btn {
      background: #a3e635;
      color: #0a1f00;
      border: none;
      border-radius: 20px;
      padding: 0.5rem 1.25rem;
      font-size: 0.85rem;
      font-weight: 800;
      cursor: pointer;
      margin-top: 0.25rem;
      transition: background 0.2s;
    }
    .dm-cta-btn:hover { background: #b8f040; }

    /* ── Reservation cards ── */
    .dm-res-list { display: flex; flex-direction: column; gap: 0.65rem; }
    .dm-res-card {
      background: #1b3028;
      border-radius: 12px;
      display: flex;
      align-items: stretch;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      transition: transform 0.15s;
    }
    .dm-res-card:hover { transform: translateY(-1px); }
    .dm-res-accent {
      width: 4px;
      flex-shrink: 0;
      background: rgba(255,255,255,0.12);
    }
    .dm-res-upcoming .dm-res-accent { background: #a3e635; }
    .dm-res-mine .dm-res-accent { background: #a3e635; }
    .dm-res-cancelled { opacity: 0.6; }
    .dm-res-cancelled .dm-res-accent { background: rgba(255,255,255,0.15); }

    .dm-res-main {
      flex: 1;
      padding: 0.85rem 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
    }
    .dm-res-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.1rem;
    }
    .dm-res-court {
      font-size: 0.95rem;
      font-weight: 800;
      color: #a3e635;
    }
    .dm-res-date {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.75);
      font-weight: 600;
    }
    .dm-res-time {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.55);
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .dm-res-time i { color: rgba(255,255,255,0.3); font-size: 0.72rem; }
    .dm-res-with, .dm-res-booker {
      font-size: 0.74rem;
      color: rgba(255,255,255,0.38);
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.05rem;
    }
    .dm-res-with i, .dm-res-booker i { font-size: 0.68rem; }
    .dm-lights-tag {
      background: rgba(245,158,11,0.14);
      color: #f59e0b;
      border-radius: 4px;
      padding: 0.1rem 0.35rem;
      font-size: 0.68rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
    }
    .dm-you-tag {
      background: rgba(163,230,53,0.14);
      color: #a3e635;
      border-radius: 4px;
      padding: 0.05rem 0.35rem;
      font-size: 0.65rem;
      font-weight: 700;
    }

    /* Status badges */
    .dm-status {
      font-size: 0.68rem;
      font-weight: 700;
      border-radius: 8px;
      padding: 0.18rem 0.5rem;
      text-transform: capitalize;
    }
    .dm-status-confirmed { background: rgba(163,230,53,0.14); color: #a3e635; }
    .dm-status-cancelled { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.35); }

    /* Cancel button */
    .dm-cancel-btn {
      width: 44px;
      flex-shrink: 0;
      background: none;
      border: none;
      color: rgba(255,255,255,0.25);
      font-size: 0.95rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      border-left: 1px solid rgba(255,255,255,0.06);
    }
    .dm-cancel-btn:hover:not(:disabled) { color: #ef4444; background: rgba(239,68,68,0.08); }
    .dm-cancel-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Date groups (All tab) */
    .dm-date-group { margin-bottom: 1.25rem; }
    .dm-date-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }

    /* ── Bottom Navigation ── */
    .dm-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: #111f16;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: stretch;
      height: 62px;
      z-index: 200;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }
    .dm-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.18rem;
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(255,255,255,0.35);
      font-size: 0.6rem;
      font-weight: 600;
      transition: color 0.2s;
      padding: 0;
      font-family: inherit;
    }
    .dm-nav-item i { font-size: 1.1rem; }
    .dm-nav-item.dm-nav-active { color: #a3e635; }

    /* ── Cancel Modal ── */
    .dm-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.18s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .dm-modal {
      background: #1b3028;
      border-radius: 20px;
      padding: 2rem 1.75rem;
      width: 100%;
      max-width: 360px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      animation: slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
      border: 1px solid rgba(255,255,255,0.08);
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: none; } }
    .dm-modal-icon {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: rgba(239,68,68,0.12);
      color: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 0 0 8px rgba(239,68,68,0.06);
    }
    .dm-modal-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.3rem;
    }
    .dm-modal-sub {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.4);
      margin: 0 0 1.25rem;
    }
    .dm-modal-details {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .dm-modal-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.75);
      text-align: left;
    }
    .dm-modal-row i { color: #a3e635; width: 14px; text-align: center; flex-shrink: 0; }
    .dm-modal-actions { display: flex; gap: 0.75rem; width: 100%; }
    .dm-modal-btn {
      flex: 1;
      padding: 0.75rem;
      border-radius: 10px;
      border: none;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      font-family: inherit;
    }
    .dm-modal-keep {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7);
    }
    .dm-modal-keep:hover { background: rgba(255,255,255,0.13); }
    .dm-modal-cancel {
      background: linear-gradient(135deg, #dc2626, #ef4444);
      color: #fff;
      box-shadow: 0 4px 12px rgba(239,68,68,0.3);
    }
    .dm-modal-cancel:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    .dm-modal-cancel:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

    /* ── Desktop ── */
    @media (min-width: 769px) {
      .dm-shell {
        max-width: 720px;
        height: auto;
        min-height: calc(100vh - 60px);
      }
      .dm-body {
        overflow-y: visible;
        padding: 1.5rem 2rem 2rem;
      }
      .dm-bottom-nav { display: none; }
      .dm-bottom-spacer { display: none; }
      .dm-tabs { padding: 0.85rem 2rem 0; }
    }
  `],
})
export class MyReservationsComponent implements OnInit, OnDestroy {
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
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.load();
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

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

  navigateTo(route: string) {
    const [path, query] = route.split('?');
    if (query) {
      const queryParams = Object.fromEntries(new URLSearchParams(query));
      this.router.navigate([path], { queryParams });
    } else {
      this.router.navigate([path]);
    }
  }

  goBack() { this.router.navigate(['/player/dashboard']); }
  reserve() { this.router.navigate(['/player/reserve']); }
}
