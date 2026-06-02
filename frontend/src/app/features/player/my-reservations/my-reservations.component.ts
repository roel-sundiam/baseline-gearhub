import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ReservationService, Reservation } from '../../../core/services/reservation.service';
import { UsersService } from '../../../core/services/users.service';
import { RatesService } from '../../../core/services/rates.service';
import { SoundService } from '../../../core/services/sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService } from '../../../core/services/club.service';
import { CalendarViewComponent } from '../../../shared/components/calendar-view/calendar-view.component';

interface ActivePlayer { _id: string; name: string; email: string; }

const LIGHT_SLOTS = new Set(['5am','6pm','7pm','8pm','9pm']);

function slotToHour(slot: string): number {
  const m = slot.match(/^(\d+)(am|pm)$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  return m[2] === 'am' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}
function hourToSlot(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? 'am' : 'pm'}`;
}

function hoursToSlots(openingHour: number, closingHour: number): string[] {
  const slots: string[] = [];
  for (let h = openingHour; h <= closingHour; h++) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const period = h < 12 ? 'am' : 'pm';
    slots.push(`${h12}${period}`);
  }
  return slots;
}
const WEEKEND_DAYS = new Set([0, 5, 6]);

type Tab = 'upcoming' | 'history' | 'all' | 'calendar';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarViewComponent],
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
        <button class="dm-tab" [class.dm-tab-active]="activeTab === 'calendar'" (click)="setTab('calendar')">
          <i class="fas fa-calendar-alt"></i> Calendar
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
                        <i class="far fa-clock"></i> {{ formatSlot(r.timeSlot, r.durationHours ?? 1) }}
                        @if (r.hasLights) { <span class="dm-lights-tag"><i class="fas fa-lightbulb"></i> Lights</span> }
                      </div>
                      @if (r.players && r.players.length > 0) {
                        <div class="dm-res-with"><i class="fas fa-user-friends"></i> with {{ playerNames(r) }}</div>
                      }
                    </div>
                    <div class="dm-card-actions">
                      <button
                        class="dm-edit-btn"
                        [disabled]="cancelling === r._id"
                        (click)="openEditModal(r)"
                        title="Edit"
                      ><i class="fas fa-pencil-alt"></i></button>
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
                        <i class="far fa-clock"></i> {{ formatSlot(r.timeSlot, r.durationHours ?? 1) }}
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
                  <div class="dm-date-label">{{ (group.date + 'T00:00:00Z') | date: 'EEEE, MMMM d' : 'UTC' }}</div>
                  <div class="dm-res-list">
                    @for (r of group.items; track r._id) {
                      <div class="dm-res-card" [class.dm-res-mine]="isMine(r)">
                        <div class="dm-res-accent"></div>
                        <div class="dm-res-main">
                          <div class="dm-res-top">
                            <span class="dm-res-court">Court {{ r.court }}</span>
                            @if (r.status === 'pending_payment') {
                              <span class="dm-status dm-status-pending">pending payment</span>
                            } @else {
                              <span class="dm-status dm-status-confirmed">confirmed</span>
                            }
                          </div>
                          <div class="dm-res-time">
                            <i class="far fa-clock"></i> {{ formatSlot(r.timeSlot, r.durationHours ?? 1) }}
                            @if (r.hasLights) { <span class="dm-lights-tag"><i class="fas fa-lightbulb"></i></span> }
                          </div>
                          <div class="dm-res-booker">
                            <i class="far fa-user"></i> {{ bookerName(r) }}
                            @if (isGuest(r)) { <span class="dm-guest-tag">Guest</span> }
                            @else if (isMine(r)) { <span class="dm-you-tag">you</span> }
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

          <!-- CALENDAR -->
          @if (activeTab === 'calendar') {
            <app-calendar-view
              [reservations]="allReservations"
              [myIds]="myReservationIds"
              theme="dark"
            />
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
            <div class="dm-modal-row"><i class="fas fa-clock"></i> {{ formatSlot(modalReservation.timeSlot, modalReservation.durationHours ?? 1) }}</div>
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

    <!-- Edit Modal -->
    @if (editingReservation) {
      <div class="dm-modal-backdrop">
        <div class="dm-edit-modal">

          <!-- Header -->
          <div class="dm-edit-header">
            <span class="dm-edit-title"><i class="fas fa-pencil-alt"></i> Edit Reservation</span>
            <button class="dm-edit-close" (click)="closeEditModal()"><i class="fas fa-times"></i></button>
          </div>

          <!-- Scrollable body -->
          <div class="dm-edit-body">
            @if (editError) {
              <div class="dm-edit-error"><i class="fas fa-exclamation-triangle"></i> {{ editError }}</div>
            }

            <!-- Date -->
            <div class="dm-edit-section">
              <div class="dm-edit-label">Date</div>
              <input type="date" class="dm-edit-input" [(ngModel)]="editDate" [min]="today" (change)="onEditDateOrCourtChange()" />
            </div>

            <!-- Court -->
            <div class="dm-edit-section">
              <div class="dm-edit-label">Court</div>
              <div class="dm-court-row">
                @for (n of courtNumbers; track n) {
                  <button class="dm-court-opt" [class.active]="editCourt === n" (click)="setEditCourt(n)">
                    <i class="fas fa-table-tennis"></i> Court {{ n }}
                  </button>
                }
              </div>
            </div>

            <!-- Time Slot -->
            <div class="dm-edit-section">
              <div class="dm-edit-label">
                Time Slot
                <span class="dm-lights-legend-sm"><span class="dm-lights-dot-sm"></span> with lights</span>
              </div>
              @if (editLoadingSlots) {
                <div class="dm-edit-slot-loading"><i class="fas fa-circle-notch fa-spin"></i> Checking…</div>
              } @else {
                <div class="dm-edit-slot-grid">
                  @for (slot of allSlots; track slot) {
                    <button
                      class="dm-edit-slot"
                      [class.selected]="editSlot === slot"
                      [class.booked]="editBookedSlots.has(slot)"
                      [class.in-range]="isEditInRange(slot)"
                      [class.has-lights]="lightSlots.has(slot)"
                      [disabled]="editBookedSlots.has(slot) || isEditInRange(slot)"
                      (click)="selectEditSlot(slot)"
                    >
                      {{ slot }}
                      @if (lightSlots.has(slot)) { <span class="dm-slot-light">💡</span> }
                    </button>
                  }
                </div>
                @if (editSlot && editAvailableDurations.length > 1) {
                  <div class="dm-edit-duration-row">
                    @for (d of editAvailableDurations; track d) {
                      <button type="button" class="dm-edit-duration-btn" [class.active]="editDuration === d" (click)="setEditDuration(d)">
                        {{ d }} hr{{ d > 1 ? 's' : '' }}
                      </button>
                    }
                  </div>
                }
              }
            </div>

            <!-- Playing With -->
            <div class="dm-edit-section">
              <div class="dm-edit-label">Playing With <span class="dm-opt-tag">optional</span></div>
              @if (editAddedPlayers.length > 0) {
                <div class="dm-chips">
                  @for (p of editAddedPlayers; track p._id) {
                    <span class="dm-chip">{{ p.name }}<button class="dm-chip-rm" (click)="removeEditPlayer(p._id)"><i class="fas fa-times"></i></button></span>
                  }
                </div>
              }
              <div class="dm-edit-search-wrap">
                <i class="fas fa-search dm-edit-search-icon"></i>
                <input
                  type="text"
                  class="dm-edit-input dm-edit-search"
                  placeholder="Search member…"
                  [(ngModel)]="editPlayerSearch"
                  (input)="onEditSearch()"
                  autocomplete="off"
                />
                @if (editShowDropdown && editFilteredPlayers.length > 0) {
                  <div class="dm-edit-dropdown">
                    @for (p of editFilteredPlayers; track p._id) {
                      <button class="dm-edit-drop-item" (click)="addEditPlayer(p)">
                        <span>{{ p.name }}</span><span class="dm-drop-email">{{ p.email }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Options -->
            <div class="dm-edit-section">
              <div class="dm-edit-label">Options</div>
              <div class="dm-edit-checks">
                @if (editHasLights) {
                  <label class="dm-check"><input type="checkbox" [(ngModel)]="editLightsRequested" /><span>Lights Requested</span></label>
                }
                @if (editBallBoyRate > 0) {
                  <label class="dm-check"><input type="checkbox" [(ngModel)]="editBallBoy" /><span>Ball Boy</span></label>
                }
                @if (editHolidayRate > 0) {
                  <label class="dm-check"><input type="checkbox" [(ngModel)]="editIsHoliday" /><span>Holiday Rate</span></label>
                }
              </div>
              <div class="dm-edit-number-row">
                <div class="dm-edit-number">
                  <span class="dm-edit-num-label">Guests</span>
                  <input type="number" class="dm-edit-num-input" [(ngModel)]="editGuestCount" min="0" />
                </div>
              </div>
            </div>

            <!-- Rentals -->
            @if (editHasAnyRental) {
              <div class="dm-edit-section">
                <div class="dm-edit-label">Rentals <span class="dm-opt-tag">optional</span></div>
                <div class="dm-edit-number-row">
                  @if (editRentalBalls50Rate > 0) {
                    <div class="dm-edit-number">
                      <span class="dm-edit-num-label">Balls 50</span>
                      <input type="number" class="dm-edit-num-input" [(ngModel)]="editRentalBalls50" min="0" />
                    </div>
                  }
                  @if (editRentalBalls100Rate > 0) {
                    <div class="dm-edit-number">
                      <span class="dm-edit-num-label">Balls 100</span>
                      <input type="number" class="dm-edit-num-input" [(ngModel)]="editRentalBalls100" min="0" />
                    </div>
                  }
                  @if (editRentalRacketRate > 0) {
                    <div class="dm-edit-number">
                      <span class="dm-edit-num-label">Rackets</span>
                      <input type="number" class="dm-edit-num-input" [(ngModel)]="editRentalRackets" min="0" />
                    </div>
                  }
                </div>
                @if (editRentalBallMachineRate > 0) {
                  <label class="dm-check" style="margin-top:.5rem"><input type="checkbox" [(ngModel)]="editRentalBallMachine" /><span>Ball Machine</span></label>
                }
              </div>
            }

            <!-- Fee summary -->
            <div class="dm-edit-fee-box">
              <div class="dm-edit-fee-row">
                <span>Court Fee</span>
                <span>₱ {{ editComputedFee | number:'1.0-0' }}</span>
              </div>
            </div>

          </div><!-- end edit body -->

          <!-- Footer -->
          <div class="dm-edit-footer">
            <button class="dm-modal-btn dm-modal-keep" (click)="closeEditModal()">Keep Original</button>
            <button class="dm-modal-btn dm-modal-save" [disabled]="editSaving || !editSlot" (click)="saveEdit()">
              @if (editSaving) {
                <i class="fas fa-circle-notch fa-spin"></i> Saving…
              } @else {
                <i class="fas fa-check"></i> Save Changes
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
    .dm-guest-tag {
      background: rgba(139,92,246,0.18);
      color: #a78bfa;
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
    .dm-status-pending { background: rgba(245,158,11,0.14); color: #f59e0b; }

    /* Card action buttons (edit + cancel) */
    .dm-card-actions {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      border-left: 1px solid rgba(255,255,255,0.06);
    }
    .dm-edit-btn, .dm-cancel-btn {
      flex: 1;
      width: 44px;
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      font-size: 0.85rem;
    }
    .dm-edit-btn { color: rgba(163,230,53,0.5); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .dm-edit-btn:hover:not(:disabled) { color: #a3e635; background: rgba(163,230,53,0.08); }
    .dm-cancel-btn { color: rgba(255,255,255,0.25); font-size: 0.95rem; }
    .dm-cancel-btn:hover:not(:disabled) { color: #ef4444; background: rgba(239,68,68,0.08); }
    .dm-edit-btn:disabled, .dm-cancel-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Edit Modal ── */
    .dm-edit-modal {
      background: #1b3028;
      border-radius: 20px;
      width: 100%;
      max-width: 420px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.08);
      animation: slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
    }
    .dm-edit-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem 0.85rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .dm-edit-title {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dm-edit-title i { color: #a3e635; }
    .dm-edit-close {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.6);
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      transition: background 0.2s;
    }
    .dm-edit-close:hover { background: rgba(255,255,255,0.14); }

    .dm-edit-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .dm-edit-footer {
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .dm-modal-save {
      background: linear-gradient(135deg, #16a34a, #22c55e);
      color: #fff;
      box-shadow: 0 4px 12px rgba(34,197,94,0.3);
    }
    .dm-modal-save:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    .dm-modal-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    .dm-edit-error {
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 10px;
      padding: 0.65rem 0.9rem;
      font-size: 0.82rem;
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .dm-edit-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .dm-edit-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dm-opt-tag {
      font-size: 0.62rem;
      color: rgba(255,255,255,0.25);
      text-transform: none;
      letter-spacing: 0;
      font-weight: 500;
    }
    .dm-edit-input {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 0.6rem 0.75rem;
      color: #ffffff;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      width: 100%;
      transition: border-color 0.2s;
    }
    .dm-edit-input:focus { border-color: #a3e635; }
    .dm-edit-input::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; }

    .dm-court-row { display: flex; gap: 0.5rem; }
    .dm-court-opt {
      flex: 1;
      padding: 0.55rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: rgba(255,255,255,0.55);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      font-family: inherit;
    }
    .dm-court-opt.active { background: rgba(163,230,53,0.14); border-color: #a3e635; color: #a3e635; }
    .dm-court-opt:hover:not(.active) { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.8); }

    .dm-edit-slot-loading { color: rgba(255,255,255,0.35); font-size: 0.82rem; padding: 0.5rem 0; display: flex; align-items: center; gap: 0.4rem; }
    .dm-lights-legend-sm { font-size: 0.65rem; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 0.3rem; font-weight: 500; text-transform: none; letter-spacing: 0; }
    .dm-lights-dot-sm { width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; display: inline-block; }
    .dm-edit-slot-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.35rem;
    }
    .dm-edit-slot {
      padding: 0.5rem 0.25rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: rgba(255,255,255,0.65);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
      position: relative;
    }
    .dm-edit-slot.selected { background: rgba(163,230,53,0.2); border-color: #a3e635; color: #a3e635; }
    .dm-edit-slot.booked { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); color: rgba(255,255,255,0.2); cursor: not-allowed; text-decoration: line-through; }
    .dm-edit-slot.in-range { border-color: rgba(163,230,53,0.3); background: rgba(163,230,53,0.07); color: rgba(163,230,53,0.6); cursor: not-allowed; }
    .dm-edit-slot.has-lights { border-color: rgba(245,158,11,0.3); }
    .dm-edit-slot:hover:not(:disabled):not(.selected):not(.booked):not(.in-range) { background: rgba(255,255,255,0.1); color: #fff; }
    .dm-slot-light { font-size: 0.55rem; position: absolute; top: 2px; right: 3px; }
    .dm-edit-duration-row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.6rem; }
    .dm-edit-duration-btn { padding: 0.35rem 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    .dm-edit-duration-btn:hover { border-color: #a3e635; color: #a3e635; }
    .dm-edit-duration-btn.active { background: rgba(163,230,53,0.2); border-color: #a3e635; color: #a3e635; }

    /* Player search */
    .dm-edit-search-wrap { position: relative; }
    .dm-edit-search-icon { position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.3); font-size: 0.75rem; pointer-events: none; }
    .dm-edit-search { padding-left: 2rem !important; }
    .dm-edit-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      background: #1b3028;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      z-index: 100;
      max-height: 160px;
      overflow-y: auto;
    }
    .dm-edit-drop-item {
      width: 100%;
      padding: 0.55rem 0.75rem;
      background: none;
      border: none;
      color: #fff;
      font-size: 0.82rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      font-family: inherit;
      text-align: left;
    }
    .dm-edit-drop-item:hover { background: rgba(255,255,255,0.07); }
    .dm-drop-email { font-size: 0.72rem; color: rgba(255,255,255,0.4); }
    .dm-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.4rem; }
    .dm-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.25);
      color: #a3e635;
      border-radius: 20px;
      padding: 0.2rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .dm-chip-rm { background: none; border: none; color: rgba(163,230,53,0.6); cursor: pointer; font-size: 0.65rem; padding: 0; line-height: 1; }
    .dm-chip-rm:hover { color: #a3e635; }

    /* Checks & numbers */
    .dm-edit-checks { display: flex; flex-direction: column; gap: 0.45rem; }
    .dm-check {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      font-size: 0.82rem;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
    }
    .dm-check input[type="checkbox"] { width: 15px; height: 15px; accent-color: #a3e635; cursor: pointer; }
    .dm-edit-number-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .dm-edit-number { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 70px; }
    .dm-edit-num-label { font-size: 0.68rem; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .dm-edit-num-input {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 0.45rem 0.6rem;
      color: #fff;
      font-size: 0.85rem;
      font-family: inherit;
      outline: none;
      width: 100%;
    }
    .dm-edit-num-input:focus { border-color: #a3e635; }

    /* Fee box */
    .dm-edit-fee-box {
      background: rgba(255,255,255,0.04);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .dm-edit-fee-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.88rem;
      color: rgba(255,255,255,0.75);
      font-weight: 600;
    }
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

  get myReservationIds(): string[] {
    return this.myReservations.map(r => r._id);
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
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) => {
          const courtDiff = a.court - b.court;
          if (courtDiff !== 0) return courtDiff;
          return slotToHour(a.timeSlot) - slotToHour(b.timeSlot);
        }),
      }));
  }

  // ── Edit modal state ──────────────────────────────────
  editingReservation: Reservation | null = null;
  readonly today = new Date().toISOString().split('T')[0];
  allSlots = hoursToSlots(5, 22);
  readonly lightSlots = LIGHT_SLOTS;

  courtCount = 2;
  editDate = '';
  editCourt: number = 1;
  editSlot = '';
  editDuration = 1;
  editAvailableDurations: number[] = [];
  editClosingHour = 22;
  editLightsRequested = false;
  editBallBoy = false;
  editIsHoliday = false;
  editGuestCount = 0;
  editRentalBalls50 = 0;
  editRentalBalls100 = 0;
  editRentalBallMachine = false;
  editRentalRackets = 0;
  editBookedSlots = new Set<string>();
  editLoadingSlots = false;
  editSaving = false;
  editError = '';
  editAllPlayers: ActivePlayer[] = [];
  editAddedPlayers: ActivePlayer[] = [];
  editPlayerSearch = '';
  editFilteredPlayers: ActivePlayer[] = [];
  editShowDropdown = false;

  editWeekdayRate = 0;
  editWeekendRate = 0;
  editHolidayRate = 0;
  editLightsRate = 0;
  editBallBoyRate = 0;
  editGuestFeeRate = 0;
  editRentalBalls50Rate = 0;
  editRentalBalls100Rate = 0;
  editRentalBallMachineRate = 0;
  editRentalRacketRate = 0;
  editRatesLoaded = false;
  // ─────────────────────────────────────────────────────

  get courtNumbers(): number[] { return Array.from({ length: this.courtCount }, (_, i) => i + 1); }

  get editHasLights(): boolean { return LIGHT_SLOTS.has(this.editSlot); }

  get editDayType(): 'weekday' | 'weekend' | 'holiday' {
    if (this.editIsHoliday) return 'holiday';
    if (!this.editDate) return 'weekday';
    const day = new Date(this.editDate + 'T00:00:00Z').getUTCDay();
    return WEEKEND_DAYS.has(day) ? 'weekend' : 'weekday';
  }

  get editBaseCourtFee(): number {
    if (!this.editSlot) return 0;
    switch (this.editDayType) {
      case 'holiday': return this.editHolidayRate;
      case 'weekend': return this.editWeekendRate;
      default:        return this.editWeekdayRate;
    }
  }

  get editComputedFee(): number {
    const lights  = this.editLightsRequested ? this.editLightsRate : 0;
    const bb      = this.editBallBoy ? this.editBallBoyRate : 0;
    const guests  = this.editGuestCount * this.editGuestFeeRate;
    const rentals = this.editRentalBalls50 * this.editRentalBalls50Rate
      + this.editRentalBalls100 * this.editRentalBalls100Rate
      + (this.editRentalBallMachine ? this.editRentalBallMachineRate : 0)
      + this.editRentalRackets * this.editRentalRacketRate;
    return this.editBaseCourtFee + lights + bb + guests + rentals;
  }

  get editHasAnyRental(): boolean {
    return this.editRentalBalls50Rate > 0 || this.editRentalBalls100Rate > 0
      || this.editRentalBallMachineRate > 0 || this.editRentalRacketRate > 0;
  }

  get editCoreChanged(): boolean {
    if (!this.editingReservation) return false;
    return (
      this.editCourt !== this.editingReservation.court ||
      this.editDate !== this.editingReservation.date.split('T')[0] ||
      this.editSlot !== this.editingReservation.timeSlot ||
      this.editDuration !== (this.editingReservation.durationHours ?? 1)
    );
  }

  constructor(
    private reservationService: ReservationService,
    private usersService: UsersService,
    private ratesService: RatesService,
    private auth: AuthService,
    private clubService: ClubService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private sound: SoundService,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.load();
    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (club) => {
          this.courtCount = club.courtCount ?? 2;
          this.editClosingHour = club.closingHour ?? 22;
          this.allSlots = hoursToSlots(club.openingHour ?? 5, this.editClosingHour);
          this.cdr.detectChanges();
        },
      });
    }
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

  formatSlot(slot: string, durationHours = 1): string {
    const startH = slotToHour(slot);
    const endH = startH + durationHours;
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
    if (r.guestInfo) return r.guestInfo.name;
    return typeof r.player === 'object' && r.player ? r.player.name : '';
  }

  isGuest(r: Reservation) {
    return !!r.guestInfo;
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
        this.sound.pop();
        this.load();
      },
      error: () => {
        this.cancelling = '';
        this.sound.error();
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

  openEditModal(r: Reservation) {
    this.editingReservation = r;
    this.editDate = r.date.split('T')[0];
    this.editCourt = r.court;
    this.editSlot = r.timeSlot;
    this.editDuration = r.durationHours ?? 1;
    this.editAvailableDurations = [];
    this.editLightsRequested = r.lightsRequested ?? false;
    this.editBallBoy = r.ballBoy ?? false;
    this.editIsHoliday = r.isHoliday ?? false;
    this.editGuestCount = r.guestCount ?? 0;
    this.editRentalBalls50 = r.rentals?.balls50 ?? 0;
    this.editRentalBalls100 = r.rentals?.balls100 ?? 0;
    this.editRentalBallMachine = r.rentals?.ballMachine ?? false;
    this.editRentalRackets = r.rentals?.rackets ?? 0;
    this.editAddedPlayers = (r.players as { _id: string; name: string; email: string }[])
      .filter(p => typeof p === 'object');
    this.editPlayerSearch = '';
    this.editFilteredPlayers = [];
    this.editShowDropdown = false;
    this.editError = '';
    this.editSaving = false;
    this.cdr.detectChanges();

    this.loadEditAvailability();

    if (!this.editRatesLoaded) {
      this.ratesService.getRates().subscribe({
        next: (rates) => {
          this.editWeekdayRate          = rates.reservationWeekdayRate ?? 0;
          this.editWeekendRate          = rates.reservationWeekendRate ?? 0;
          this.editHolidayRate          = rates.reservationHolidayRate ?? 0;
          this.editLightsRate           = rates.lightRate ?? 0;
          this.editBallBoyRate          = rates.ballBoyRate ?? 0;
          this.editGuestFeeRate         = rates.reservationGuestFee ?? 0;
          this.editRentalBalls50Rate    = rates.rentalBalls50Rate ?? 0;
          this.editRentalBalls100Rate   = rates.rentalBalls100Rate ?? 0;
          this.editRentalBallMachineRate= rates.rentalBallMachineRate ?? 0;
          this.editRentalRacketRate     = rates.rentalRacketRate ?? 0;
          this.editRatesLoaded = true;
          this.cdr.detectChanges();
        },
      });
    }

    if (this.editAllPlayers.length === 0) {
      this.usersService.getActivePlayers().subscribe({
        next: (players) => { this.editAllPlayers = players; this.cdr.detectChanges(); },
      });
    }
  }

  closeEditModal() {
    this.editingReservation = null;
    this.editShowDropdown = false;
    this.cdr.detectChanges();
  }

  loadEditAvailability() {
    if (!this.editDate || !this.editCourt) return;
    this.editLoadingSlots = true;
    this.editBookedSlots = new Set();
    this.reservationService.getAvailability(this.editCourt, this.editDate).subscribe({
      next: (res) => {
        const slots = new Set(res.bookedSlots);
        if (this.editingReservation &&
            this.editDate === this.editingReservation.date.split('T')[0] &&
            this.editCourt === this.editingReservation.court) {
          const ownStart = slotToHour(this.editingReservation.timeSlot);
          const ownDur = this.editingReservation.durationHours ?? 1;
          for (let i = 0; i < ownDur; i++) slots.delete(hourToSlot(ownStart + i));
        }
        this.editBookedSlots = slots;
        this.editLoadingSlots = false;
        this.computeEditAvailableDurations();
        this.cdr.detectChanges();
      },
      error: () => { this.editLoadingSlots = false; this.cdr.detectChanges(); },
    });
  }

  onEditDateOrCourtChange() {
    this.editSlot = '';
    this.editDuration = 1;
    this.editAvailableDurations = [];
    this.loadEditAvailability();
  }

  setEditCourt(court: number) {
    this.editCourt = court;
    this.editSlot = '';
    this.editDuration = 1;
    this.editAvailableDurations = [];
    this.loadEditAvailability();
  }

  selectEditSlot(slot: string) {
    if (this.editBookedSlots.has(slot) || this.isEditInRange(slot)) return;
    this.editSlot = slot;
    this.editDuration = 1;
    if (!LIGHT_SLOTS.has(slot)) this.editLightsRequested = false;
    this.computeEditAvailableDurations();
    this.cdr.detectChanges();
  }

  computeEditAvailableDurations() {
    if (!this.editSlot) { this.editAvailableDurations = []; return; }
    const startH = slotToHour(this.editSlot);
    const durations: number[] = [];
    for (let d = 1; d <= 12; d++) {
      const endH = startH + d - 1;
      if (endH > this.editClosingHour) break;
      if (d > 1 && this.editBookedSlots.has(hourToSlot(endH))) break;
      durations.push(d);
    }
    this.editAvailableDurations = durations;
  }

  setEditDuration(d: number) {
    this.editDuration = d;
    this.cdr.detectChanges();
  }

  isEditInRange(slot: string): boolean {
    if (!this.editSlot || this.editDuration <= 1) return false;
    const startH = slotToHour(this.editSlot);
    const h = slotToHour(slot);
    return h > startH && h < startH + this.editDuration;
  }

  get editEndSlotLabel(): string {
    if (!this.editSlot) return '';
    return hourToSlot(slotToHour(this.editSlot) + this.editDuration);
  }

  onEditSearch() {
    const q = this.editPlayerSearch.trim().toLowerCase();
    const added = new Set(this.editAddedPlayers.map(p => p._id));
    this.editFilteredPlayers = q
      ? this.editAllPlayers.filter(p => !added.has(p._id) && p.name.toLowerCase().includes(q))
      : [];
    this.editShowDropdown = this.editFilteredPlayers.length > 0;
    this.cdr.detectChanges();
  }

  addEditPlayer(p: ActivePlayer) {
    if (!this.editAddedPlayers.find(x => x._id === p._id)) {
      this.editAddedPlayers = [...this.editAddedPlayers, p];
    }
    this.editPlayerSearch = '';
    this.editFilteredPlayers = [];
    this.editShowDropdown = false;
    this.cdr.detectChanges();
  }

  removeEditPlayer(id: string) {
    this.editAddedPlayers = this.editAddedPlayers.filter(p => p._id !== id);
    this.cdr.detectChanges();
  }

  saveEdit() {
    if (!this.editingReservation || !this.editSlot) return;
    this.editSaving = true;
    this.editError = '';
    this.reservationService.update(this.editingReservation._id, {
      court: this.editCourt,
      date: this.editDate,
      timeSlot: this.editSlot,
      durationHours: this.editDuration,
      players: this.editAddedPlayers.map(p => p._id),
      lightsRequested: this.editLightsRequested,
      ballBoy: this.editBallBoy,
      isHoliday: this.editIsHoliday,
      guestCount: this.editGuestCount,
      rentals: {
        balls50: this.editRentalBalls50,
        balls100: this.editRentalBalls100,
        ballMachine: this.editRentalBallMachine,
        rackets: this.editRentalRackets,
      },
    }).subscribe({
      next: () => {
        this.editSaving = false;
        this.editingReservation = null;
        this.sound.success();
        this.load();
      },
      error: (err) => {
        this.editSaving = false;
        this.sound.error();
        this.editError = err?.error?.error || 'Failed to save. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  goBack() { this.router.navigate(['/player/dashboard']); }
  reserve() { this.router.navigate(['/player/reserve']); }
}
