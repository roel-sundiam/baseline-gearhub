import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService, Reservation } from '../../../core/services/reservation.service';
import { ClubService } from '../../../core/services/club.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { CalendarViewComponent } from '../../../shared/components/calendar-view/calendar-view.component';

const LIGHT_SLOTS = new Set(['5am', '6pm', '7pm', '8pm', '9pm']);

function slotToHour(slot: string): number {
  if (!slot) return 0;
  const m = slot.match(/^(\d+)(am|pm)$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  return m[2] === 'am' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}
function hourToSlot(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? 'am' : 'pm'}`;
}

function hoursToSlots(opening: number, closing: number): string[] {
  const slots: string[] = [];
  for (let h = opening; h <= closing; h++) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${h12}${h < 12 ? 'am' : 'pm'}`);
  }
  return slots;
}

interface MemberSummary {
  key: string;
  name: string;
  email: string;
  count: number;
  bookings: Reservation[];
  isGuest: boolean;
}

interface DateSummary {
  key: string;
  date: string;
  count: number;
  bookings: Reservation[];
}

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarViewComponent],
  styleUrls: ['./admin-reservations-modern.scss'],
  template: `
    <div class="res-shell">

      <header class="res-header">
        <div class="hero-copy">
          <p class="res-kicker"><i class="fas fa-calendar-check" aria-hidden="true"></i> Reservations workspace</p>
          <h1 class="res-title">Court reservations</h1>
          <p class="res-subtitle">Review bookings, verify payment status, and keep every court schedule running smoothly.</p>
        </div>

        <div class="hero-stats" aria-label="Reservation summary">
          <div class="hero-stat">
            <span class="hero-stat-icon"><i class="fas fa-calendar-day" aria-hidden="true"></i></span>
            <span>
              <strong>{{ visibleReservations.length }}</strong>
              <small>{{ showPast ? 'Visible bookings' : 'Upcoming bookings' }}</small>
            </span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-icon confirmed"><i class="fas fa-circle-check" aria-hidden="true"></i></span>
            <span>
              <strong>{{ confirmedCount }}</strong>
              <small>Confirmed</small>
            </span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-icon pending"><i class="fas fa-clock" aria-hidden="true"></i></span>
            <span>
              <strong>{{ pendingCount }}</strong>
              <small>Pending payment</small>
            </span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-icon courts"><i class="fas fa-table-tennis-paddle-ball" aria-hidden="true"></i></span>
            <span>
              <strong>{{ courtCount }}</strong>
              <small>Active courts</small>
            </span>
          </div>
        </div>
      </header>

      <section class="toolbar" aria-label="Reservation views and filters">
        <div class="toolbar-top">
          <div>
            <p class="toolbar-eyebrow">Workspace view</p>
            <h2>Manage bookings</h2>
          </div>
          @if (viewMode !== 'calendar') {
            <span class="result-count">{{ visibleReservations.length }} result{{ visibleReservations.length === 1 ? '' : 's' }}</span>
          }
        </div>

        <div class="view-toggle" role="group" aria-label="Choose reservation view">
          <button type="button" class="view-btn" [class.active]="viewMode === 'table'" [attr.aria-pressed]="viewMode === 'table'" (click)="setView('table')">
            <i class="fas fa-table-list" aria-hidden="true"></i><span>All bookings</span>
          </button>
          <button type="button" class="view-btn" [class.active]="viewMode === 'member'" [attr.aria-pressed]="viewMode === 'member'" (click)="setView('member')">
            <i class="fas fa-users" aria-hidden="true"></i><span>By member</span>
          </button>
          <button type="button" class="view-btn" [class.active]="viewMode === 'date'" [attr.aria-pressed]="viewMode === 'date'" (click)="setView('date')">
            <i class="fas fa-calendar-day" aria-hidden="true"></i><span>By date</span>
          </button>
          <button type="button" class="view-btn" [class.active]="viewMode === 'calendar'" [attr.aria-pressed]="viewMode === 'calendar'" (click)="setView('calendar')">
            <i class="fas fa-calendar-alt" aria-hidden="true"></i><span>Calendar</span>
          </button>
        </div>

        @if (viewMode === 'table' || viewMode === 'member' || viewMode === 'date') {
          <div class="filters">
            <div class="filter-field">
              <label for="reservation-date-from">From date</label>
              <input id="reservation-date-from" type="date" class="filter-input" [(ngModel)]="filterDateFrom" (change)="load()" />
            </div>
            <div class="filter-field">
              <label for="reservation-date-to">To date</label>
              <input id="reservation-date-to" type="date" class="filter-input" [(ngModel)]="filterDateTo" (change)="load()" />
            </div>
            <div class="filter-field">
              <label for="reservation-court">Court</label>
              <select id="reservation-court" class="filter-input" [(ngModel)]="filterCourt" (change)="load()">
                <option value="">All courts</option>
                @for (c of courtNumbers; track c) {
                  <option [value]="c">Court {{ c }}</option>
                }
              </select>
            </div>
            <div class="filter-actions">
              <button type="button" class="toggle-past-btn" [class.active]="showPast" [attr.aria-pressed]="showPast" (click)="togglePast()">
                <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
                {{ showPast ? 'Past included' : 'Include past' }}
              </button>
              <button type="button" class="clear-btn" [disabled]="activeFilterCount === 0" (click)="clearFilters()">
                <i class="fas fa-filter-circle-xmark" aria-hidden="true"></i>
                Clear filters
              </button>
            </div>
          </div>
        }
      </section>

      <!-- Calendar view -->
      @if (viewMode === 'calendar') {
        <section class="calendar-panel" aria-label="Reservation calendar">
          @if (calLoading) {
            <div class="res-loading" role="status"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Loading calendar...</div>
          } @else if (calendarError) {
            <div class="res-empty res-error" role="alert">
              <i class="fas fa-cloud-arrow-down res-empty-icon" aria-hidden="true"></i>
              <h3>Calendar could not be loaded</h3>
              <p>{{ calendarError }}</p>
              <button type="button" class="state-action" (click)="loadAllForCalendar()">Try again</button>
            </div>
          } @else {
            <app-calendar-view [reservations]="calendarReservations" theme="dark" [courtCount]="courtCount" />
          }
        </section>
      }

      <!-- Table view -->
      @if (viewMode === 'table') {
        @if (loading) {
          <div class="res-loading" role="status"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Loading reservations...</div>
        } @else if (loadError) {
          <div class="res-empty res-error" role="alert">
            <i class="fas fa-cloud-arrow-down res-empty-icon" aria-hidden="true"></i>
            <h3>Reservations could not be loaded</h3>
            <p>{{ loadError }}</p>
            <button type="button" class="state-action" (click)="load()">Try again</button>
          </div>
        } @else if (visibleReservations.length === 0) {
          <div class="res-empty">
            <i class="fas fa-calendar-xmark res-empty-icon" aria-hidden="true"></i>
            <h3>No matching reservations</h3>
            <p>{{ reservations.length > 0 ? 'No upcoming reservations. Toggle "Show past" to see older bookings.' : 'No reservations found.' }}</p>
          </div>
        } @else {

          <!-- Desktop table -->
          <div class="table-wrap desktop-only">
            <table class="res-table">
              <thead>
                <tr>
                  <th>Player / Guest</th>
                  <th>Date</th>
                  <th>Court</th>
                  <th>Time</th>
                  <th>Add-ons</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (r of visibleReservations; track r._id) {
                  <tr [class.row-cancelled]="r.status === 'cancelled'">
                    <td>
                      <div class="player-name">{{ playerName(r) }}</div>
                      <div class="player-email">{{ playerEmail(r) }}</div>
                    </td>
                    <td class="cell-date">{{ r.date | date: 'MMM d, y' : 'UTC' }}</td>
                    <td>Court {{ r.court }}</td>
                    <td class="cell-time">{{ timeRangeLabel(r) }}</td>
                    <td>
                      <div class="addons">
                        @if (r.hasLights) { <span class="addon-chip"><i class="fas fa-lightbulb" aria-hidden="true"></i> Lights</span> }
                        @if (r.ballBoy) { <span class="addon-chip"><i class="fas fa-baseball" aria-hidden="true"></i> Ball boy</span> }
                        @if (r.guestCount && r.guestCount > 0) { <span class="addon-chip"><i class="fas fa-user-group" aria-hidden="true"></i> {{ r.guestCount }} guest{{ r.guestCount === 1 ? '' : 's' }}</span> }
                        @if (r.coachingRequested) { <span class="addon-chip"><i class="fas fa-graduation-cap" aria-hidden="true"></i> Coaching{{ r.coachingPax ? ' (' + r.coachingPax + ')' : '' }}</span> }
                      </div>
                    </td>
                    <td>
                      <span class="status-badge" [class]="'status-' + r.status">
                        {{ r.status === 'pending_payment' ? 'Pending' : r.status | titlecase }}
                      </span>
                    </td>
                    <td>
                      <span class="status-badge" [class]="paymentBadgeClass(r)">{{ paymentStatusLabel(r) }}</span>
                      @if (paymentMethodLabel(r)) { <div class="payment-method">{{ paymentMethodLabel(r) }}</div> }
                    </td>
                    <td class="cell-actions">
                      @if (r.status !== 'cancelled') {
                        <button type="button" class="btn-action btn-edit" [disabled]="acting === r._id" (click)="openEditModal(r)" [attr.aria-label]="'Edit reservation for ' + playerName(r)">
                          <i class="fas fa-pen" aria-hidden="true"></i> Edit
                        </button>
                      }
                      @if (r.status === 'confirmed' || r.status === 'pending_payment') {
                        <button type="button" class="btn-action btn-cancel-res" [disabled]="acting === r._id" (click)="cancel(r)" [attr.aria-label]="'Cancel reservation for ' + playerName(r)">
                          {{ acting === r._id ? '…' : 'Cancel' }}
                        </button>
                      }
                      <button type="button" class="btn-action btn-delete" [disabled]="acting === r._id" (click)="deleteRes(r)" [attr.aria-label]="'Delete reservation for ' + playerName(r)">
                        {{ acting === r._id ? '…' : 'Delete' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="mobile-only res-cards">
            @for (r of visibleReservations; track r._id) {
              <div class="res-card" [class.card-cancelled]="r.status === 'cancelled'">
                <div class="card-top">
                  <div>
                    <div class="player-name">{{ playerName(r) }}</div>
                    <div class="player-email">{{ playerEmail(r) }}</div>
                  </div>
                  <span class="status-badge" [class]="'status-' + r.status">
                    {{ r.status === 'pending_payment' ? 'Pending' : r.status | titlecase }}
                  </span>
                </div>
                <div class="card-meta">
                  <span><i class="fas fa-calendar-day" aria-hidden="true"></i> {{ r.date | date: 'MMM d, y' : 'UTC' }}</span>
                  <span><i class="fas fa-table-tennis-paddle-ball" aria-hidden="true"></i> Court {{ r.court }}</span>
                  <span><i class="fas fa-clock" aria-hidden="true"></i> {{ timeRangeLabel(r) }}</span>
                  @if (r.hasLights) { <span><i class="fas fa-lightbulb" aria-hidden="true"></i> Lights</span> }
                  @if (r.ballBoy) { <span><i class="fas fa-baseball" aria-hidden="true"></i> Ball boy</span> }
                  @if (r.coachingRequested) { <span><i class="fas fa-graduation-cap" aria-hidden="true"></i> Coaching{{ r.coachingPax ? ' (' + r.coachingPax + ')' : '' }}</span> }
                </div>
                <div class="card-payment">
                  <span>Payment</span>
                  <span class="status-badge" [class]="paymentBadgeClass(r)">{{ paymentStatusLabel(r) }}</span>
                  @if (paymentMethodLabel(r)) { <small>{{ paymentMethodLabel(r) }}</small> }
                </div>
                <div class="card-actions">
                  @if (r.status !== 'cancelled') {
                    <button type="button" class="btn-action btn-edit" [disabled]="acting === r._id" (click)="openEditModal(r)">
                      <i class="fas fa-pen" aria-hidden="true"></i> Edit
                    </button>
                  }
                  @if (r.status === 'confirmed' || r.status === 'pending_payment') {
                    <button type="button" class="btn-action btn-cancel-res" [disabled]="acting === r._id" (click)="cancel(r)">
                      {{ acting === r._id ? '…' : 'Cancel' }}
                    </button>
                  }
                  <button type="button" class="btn-action btn-delete" [disabled]="acting === r._id" (click)="deleteRes(r)">
                    {{ acting === r._id ? '…' : 'Delete' }}
                  </button>
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- By Member view -->
      @if (viewMode === 'member') {
        @if (loading) {
          <div class="res-loading" role="status"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Loading member groups...</div>
        } @else if (loadError) {
          <div class="res-empty res-error" role="alert">
            <i class="fas fa-cloud-arrow-down res-empty-icon" aria-hidden="true"></i>
            <h3>Reservations could not be loaded</h3>
            <p>{{ loadError }}</p>
            <button type="button" class="state-action" (click)="load()">Try again</button>
          </div>
        } @else if (visibleReservations.length === 0) {
          <div class="res-empty">
            <i class="fas fa-calendar-xmark res-empty-icon" aria-hidden="true"></i>
            <h3>No matching reservations</h3>
            <p>{{ reservations.length > 0 ? 'No upcoming reservations. Toggle "Show past" to see older bookings.' : 'No reservations found.' }}</p>
          </div>
        } @else {

          <!-- Summary strip -->
          <div class="summary-bar">
            <div class="stat-pill">
              <span class="stat-count">{{ memberCount }}</span>
              <span class="stat-label">Members</span>
            </div>
            <div class="stat-pill pill-guest">
              <span class="stat-count">{{ guestGroupCount }}</span>
              <span class="stat-label">Guest Parties</span>
            </div>
            <div class="stat-pill">
              <span class="stat-count">{{ visibleReservations.length }}</span>
              <span class="stat-label">Total Bookings</span>
            </div>
          </div>

          <!-- Desktop table -->
          <div class="table-wrap desktop-only">
            <table class="res-table member-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Bookings</th>
                </tr>
              </thead>
              <tbody>
                @for (m of memberSummaries; track m.key) {
                  <tr class="member-row" [class.row-guest]="m.isGuest" tabindex="0" role="button"
                    [attr.aria-expanded]="isMemberExpanded(m.key)"
                    (click)="toggleMemberExpanded(m.key)"
                    (keydown.enter)="toggleMemberExpanded(m.key)"
                    (keydown.space)="$event.preventDefault(); toggleMemberExpanded(m.key)">
                    <td class="cell-expand">
                      <i class="fas" [class.fa-chevron-right]="!isMemberExpanded(m.key)" [class.fa-chevron-down]="isMemberExpanded(m.key)"></i>
                    </td>
                    <td>
                      <div class="player-name">{{ m.name }}</div>
                      @if (m.isGuest) { <span class="addon-chip chip-guest">Guest</span> }
                    </td>
                    <td class="player-email">{{ m.email || '—' }}</td>
                    <td><span class="member-count-badge">{{ m.count }}</span></td>
                  </tr>
                  @if (isMemberExpanded(m.key)) {
                    <tr class="member-detail-row">
                      <td colspan="4">
                        <table class="member-bookings-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Court</th>
                              <th>Time</th>
                              <th>Status</th>
                              <th>Court Fee</th>
                              <th>Payment</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (b of m.bookings; track b._id) {
                              <tr [class.row-cancelled]="b.status === 'cancelled'">
                                <td>{{ b.date | date: 'MMM d, y' : 'UTC' }}</td>
                                <td>Court {{ b.court }}</td>
                                <td>{{ timeRangeLabel(b) }}</td>
                                <td>
                                  <span class="status-badge" [class]="'status-' + b.status">
                                    {{ b.status === 'pending_payment' ? 'Pending' : b.status | titlecase }}
                                  </span>
                                </td>
                                <td>{{ (b.courtFee ?? 0) | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                                <td>
                                  <span class="status-badge" [class]="paymentBadgeClass(b)">{{ paymentStatusLabel(b) }}</span>
                                  @if (paymentMethodLabel(b)) { <div class="payment-method">{{ paymentMethodLabel(b) }}</div> }
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="mobile-only res-cards">
            @for (m of memberSummaries; track m.key) {
              <div class="res-card member-card" [class.card-guest]="m.isGuest" tabindex="0" role="button"
                [attr.aria-expanded]="isMemberExpanded(m.key)"
                (click)="toggleMemberExpanded(m.key)"
                (keydown.enter)="toggleMemberExpanded(m.key)"
                (keydown.space)="$event.preventDefault(); toggleMemberExpanded(m.key)">
                <div class="card-top">
                  <div>
                    <div class="player-name">{{ m.name }}</div>
                    <div class="player-email">{{ m.email || '—' }}</div>
                  </div>
                  <span class="member-count-badge">{{ m.count }}</span>
                </div>
                @if (isMemberExpanded(m.key)) {
                  <div class="member-bookings-list">
                    @for (b of m.bookings; track b._id) {
                      <div class="member-booking-line" [class.row-cancelled]="b.status === 'cancelled'">
                        <span>{{ b.date | date: 'MMM d, y' : 'UTC' }}</span>
                        <span>Court {{ b.court }}</span>
                        <span>{{ timeRangeLabel(b) }}</span>
                        <span class="status-badge" [class]="'status-' + b.status">
                          {{ b.status === 'pending_payment' ? 'Pending' : b.status | titlecase }}
                        </span>
                        <span>{{ (b.courtFee ?? 0) | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
                        <span class="status-badge" [class]="paymentBadgeClass(b)">{{ paymentStatusLabel(b) }}{{ paymentMethodLabel(b) ? ' · ' + paymentMethodLabel(b) : '' }}</span>
                      </div>
                    }
                  </div>
                }
                <div class="card-expand-hint">
                  <i class="fas" [class.fa-chevron-right]="!isMemberExpanded(m.key)" [class.fa-chevron-down]="isMemberExpanded(m.key)"></i>
                  {{ isMemberExpanded(m.key) ? 'Hide bookings' : 'Show bookings' }}
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- By Date view -->
      @if (viewMode === 'date') {
        @if (loading) {
          <div class="res-loading" role="status"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Loading date groups...</div>
        } @else if (loadError) {
          <div class="res-empty res-error" role="alert">
            <i class="fas fa-cloud-arrow-down res-empty-icon" aria-hidden="true"></i>
            <h3>Reservations could not be loaded</h3>
            <p>{{ loadError }}</p>
            <button type="button" class="state-action" (click)="load()">Try again</button>
          </div>
        } @else if (visibleReservations.length === 0) {
          <div class="res-empty">
            <i class="fas fa-calendar-xmark res-empty-icon" aria-hidden="true"></i>
            <h3>No matching reservations</h3>
            <p>{{ reservations.length > 0 ? 'No upcoming reservations. Toggle "Show past" to see older bookings.' : 'No reservations found.' }}</p>
          </div>
        } @else {

          <!-- Summary strip -->
          <div class="summary-bar">
            <div class="stat-pill">
              <span class="stat-count">{{ dateSummaries.length }}</span>
              <span class="stat-label">Dates</span>
            </div>
            <div class="stat-pill">
              <span class="stat-count">{{ visibleReservations.length }}</span>
              <span class="stat-label">Total Bookings</span>
            </div>
          </div>

          <!-- Desktop table -->
          <div class="table-wrap desktop-only">
            <table class="res-table date-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Bookings</th>
                </tr>
              </thead>
              <tbody>
                @for (d of dateSummaries; track d.key) {
                  <tr class="member-row" tabindex="0" role="button"
                    [attr.aria-expanded]="isDateExpanded(d.key)"
                    (click)="toggleDateExpanded(d.key)"
                    (keydown.enter)="toggleDateExpanded(d.key)"
                    (keydown.space)="$event.preventDefault(); toggleDateExpanded(d.key)">
                    <td class="cell-expand">
                      <i class="fas" [class.fa-chevron-right]="!isDateExpanded(d.key)" [class.fa-chevron-down]="isDateExpanded(d.key)"></i>
                    </td>
                    <td class="player-name">{{ d.date | date: 'EEE, MMM d, y' : 'UTC' }}</td>
                    <td><span class="member-count-badge">{{ d.count }}</span></td>
                  </tr>
                  @if (isDateExpanded(d.key)) {
                    <tr class="member-detail-row">
                      <td colspan="3">
                        <table class="member-bookings-table">
                          <thead>
                            <tr>
                              <th>Member / Guest</th>
                              <th>Court</th>
                              <th>Time</th>
                              <th>Status</th>
                              <th>Court Fee</th>
                              <th>Payment</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (b of d.bookings; track b._id) {
                              <tr [class.row-cancelled]="b.status === 'cancelled'">
                                <td>
                                  <div class="player-name">{{ playerName(b) }}</div>
                                  <div class="player-email">{{ playerEmail(b) }}</div>
                                </td>
                                <td>Court {{ b.court }}</td>
                                <td>{{ timeRangeLabel(b) }}</td>
                                <td>
                                  <span class="status-badge" [class]="'status-' + b.status">
                                    {{ b.status === 'pending_payment' ? 'Pending' : b.status | titlecase }}
                                  </span>
                                </td>
                                <td>{{ (b.courtFee ?? 0) | currency: 'PHP' : 'symbol' : '1.2-2' }}</td>
                                <td>
                                  <span class="status-badge" [class]="paymentBadgeClass(b)">{{ paymentStatusLabel(b) }}</span>
                                  @if (paymentMethodLabel(b)) { <div class="payment-method">{{ paymentMethodLabel(b) }}</div> }
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="mobile-only res-cards">
            @for (d of dateSummaries; track d.key) {
              <div class="res-card member-card" tabindex="0" role="button"
                [attr.aria-expanded]="isDateExpanded(d.key)"
                (click)="toggleDateExpanded(d.key)"
                (keydown.enter)="toggleDateExpanded(d.key)"
                (keydown.space)="$event.preventDefault(); toggleDateExpanded(d.key)">
                <div class="card-top">
                  <div class="player-name">{{ d.date | date: 'EEE, MMM d, y' : 'UTC' }}</div>
                  <span class="member-count-badge">{{ d.count }}</span>
                </div>
                @if (isDateExpanded(d.key)) {
                  <div class="member-bookings-list">
                    @for (b of d.bookings; track b._id) {
                      <div class="member-booking-line" [class.row-cancelled]="b.status === 'cancelled'">
                        <span>{{ playerName(b) }}</span>
                        <span>Court {{ b.court }}</span>
                        <span>{{ timeRangeLabel(b) }}</span>
                        <span class="status-badge" [class]="'status-' + b.status">
                          {{ b.status === 'pending_payment' ? 'Pending' : b.status | titlecase }}
                        </span>
                        <span>{{ (b.courtFee ?? 0) | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
                        <span class="status-badge" [class]="paymentBadgeClass(b)">{{ paymentStatusLabel(b) }}{{ paymentMethodLabel(b) ? ' · ' + paymentMethodLabel(b) : '' }}</span>
                      </div>
                    }
                  </div>
                }
                <div class="card-expand-hint">
                  <i class="fas" [class.fa-chevron-right]="!isDateExpanded(d.key)" [class.fa-chevron-down]="isDateExpanded(d.key)"></i>
                  {{ isDateExpanded(d.key) ? 'Hide bookings' : 'Show bookings' }}
                </div>
              </div>
            }
          </div>
        }
      }
    </div>

    <!-- ── Confirm modal ────────────────────────────────────────── -->
    @if (confirmModal) {
      <div class="modal-backdrop" aria-hidden="true" (click)="dismissConfirm()"></div>
      <div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-description">
        <div class="confirm-icon" [class.icon-danger]="confirmModal.danger">
          <i class="fas" aria-hidden="true" [class.fa-triangle-exclamation]="confirmModal.danger" [class.fa-circle-question]="!confirmModal.danger"></i>
        </div>
        <h3 id="confirm-modal-title" class="confirm-title">{{ confirmModal.title }}</h3>
        <p id="confirm-modal-description" class="confirm-body">{{ confirmModal.message }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-secondary" (click)="dismissConfirm()">Keep reservation</button>
          <button type="button" class="btn-confirm" [class.btn-confirm-danger]="confirmModal.danger" [disabled]="acting !== ''" (click)="confirmModal.onConfirm()">
            {{ confirmModal.confirmLabel }}
          </button>
        </div>
      </div>
    }

    <!-- ── Edit modal ────────────────────────────────────────── -->
    @if (editingReservation) {
      <div class="modal-backdrop" aria-hidden="true" (click)="closeEditModal()"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-reservation-title">
        <div class="modal-header">
          <div>
            <p class="modal-kicker">Booking details</p>
            <h3 id="edit-reservation-title">Edit reservation</h3>
          </div>
          <button type="button" class="modal-close" aria-label="Close edit reservation dialog" (click)="closeEditModal()">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">

          <!-- Guest info section (guest bookings only) -->
          @if (!editingReservation.player) {
            <div class="m-section-label">Guest Details</div>
            <div class="m-field">
              <label>Name</label>
              <input class="m-input" type="text" [(ngModel)]="editGuestName" placeholder="Guest name" />
            </div>
            <div class="m-field">
              <label>Email</label>
              <input class="m-input" type="email" [(ngModel)]="editGuestEmail" placeholder="Guest email" />
            </div>
            <div class="m-field">
              <label>Phone</label>
              <input class="m-input" type="text" [(ngModel)]="editGuestPhone" placeholder="Phone (optional)" />
            </div>
            <div class="m-divider"></div>
          }

          <!-- Booking details -->
          <div class="m-section-label">Booking Details</div>

          <div class="m-field">
            <label>Court</label>
            <div class="court-row">
              @for (c of courtNumbers; track c) {
                <button type="button" class="court-btn" [class.active]="editCourt === c" [attr.aria-pressed]="editCourt === c" (click)="setEditCourt(c)">
                  Court {{ c }}
                </button>
              }
            </div>
          </div>

          <div class="m-field">
            <label>Date</label>
            <input class="m-input" type="date" [(ngModel)]="editDate" (change)="onEditDateOrCourtChange()" />
          </div>

          <div class="m-field">
            <label>Time Slot</label>
            @if (editLoadingSlots) {
              <span class="slot-loading">Loading available slots…</span>
            } @else {
              <div class="slot-grid">
                @for (slot of allSlots; track slot) {
                  <button type="button" class="slot-btn"
                    [class.booked]="editBookedSlots.has(slot)"
                    [class.selected]="editSlot === slot"
                    [class.in-range]="isEditInRange(slot)"
                    [attr.aria-pressed]="editSlot === slot"
                    [disabled]="editBookedSlots.has(slot) || isEditInRange(slot)"
                    (click)="selectEditSlot(slot)">
                    {{ slot }}
                  </button>
                }
              </div>
              @if (editSlot && editAvailableDurations.length > 1) {
                <div class="edit-duration-row">
                  @for (d of editAvailableDurations; track d) {
                    <button type="button" class="edit-duration-btn" [class.active]="editDuration === d" (click)="setEditDuration(d)">
                      {{ d }} hr{{ d > 1 ? 's' : '' }}
                    </button>
                  }
                </div>
              }
            }
          </div>

          <div class="m-divider"></div>

          <!-- Add-ons -->
          <div class="m-section-label">Add-ons</div>
          <div class="checks-row">
            <label class="check-label">
              <input type="checkbox" [(ngModel)]="editLightsRequested" [disabled]="!lightSlots.has(editSlot)" />
              Lights
            </label>
            <label class="check-label">
              <input type="checkbox" [(ngModel)]="editBallBoy" />
              Ball Boy
            </label>
            <label class="check-label">
              <input type="checkbox" [(ngModel)]="editIsHoliday" />
              Holiday Rate
            </label>
          </div>

          <div class="m-field">
            <label>Guest Count</label>
            <input class="m-input m-input-sm" type="number" min="0" [(ngModel)]="editGuestCount" />
          </div>

          <!-- Rentals -->
          <div class="m-section-label">Rentals</div>
          <div class="rentals-grid">
            <div class="rental-item">
              <label>Balls (50-pc)</label>
              <input class="m-input" type="number" min="0" [(ngModel)]="editRentalBalls50" />
            </div>
            <div class="rental-item">
              <label>Balls (100-pc)</label>
              <input class="m-input" type="number" min="0" [(ngModel)]="editRentalBalls100" />
            </div>
            <div class="rental-item">
              <label class="check-label" style="padding-top:.4rem">
                <input type="checkbox" [(ngModel)]="editRentalBallMachine" />
                Ball Machine
              </label>
            </div>
            <div class="rental-item">
              <label>Rackets</label>
              <input class="m-input" type="number" min="0" [(ngModel)]="editRentalRackets" />
            </div>
          </div>

          <!-- Admin Notes -->
          <div class="m-divider"></div>
          <div class="m-section-label"><i class="fas fa-note-sticky" aria-hidden="true"></i> Admin Notes <span class="m-note-hint">(internal only — not visible to guests)</span></div>
          <div class="m-field">
            <textarea class="m-input m-notes" rows="3" [(ngModel)]="editAdminNote" placeholder="e.g. Payment collected weekly, confirmed arrangement"></textarea>
          </div>

          @if (editError) {
            <div class="m-error" role="alert"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> {{ editError }}</div>
          }
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" (click)="closeEditModal()">Cancel</button>
          <button type="button" class="btn-primary" [disabled]="editSaving || !editSlot" (click)="saveEdit()">
            {{ editSaving ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
    }
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

    /* ── Shell ── */
    .res-shell {
      min-height: calc(100vh - 60px);
      background: var(--bg);
      padding: 1.5rem 1rem 4rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .res-kicker {
      margin: 0 0 .2rem;
      font-size: .72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--accent);
    }
    .res-title {
      margin: 0 0 .25rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
    }
    .res-subtitle {
      margin: 0 0 1.5rem;
      font-size: .88rem;
      color: var(--muted);
    }

    /* ── Toolbar ── */
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .75rem;
      margin-bottom: 1.25rem;
    }
    .view-toggle { display: flex; gap: .3rem; }
    .view-btn {
      padding: .45rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--muted);
      cursor: pointer;
      font-size: .82rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: .35rem;
      transition: all .15s;
    }
    .view-btn:hover { background: var(--surface-hover); color: var(--text); }
    .view-btn.active { background: var(--accent); border-color: var(--accent); color: #0c1a11; }

    .filters { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
    .filter-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
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
    .toggle-past-btn {
      padding: .45rem .9rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: .82rem;
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: .35rem;
      transition: all .15s;
    }
    .toggle-past-btn:hover { background: var(--surface-hover); color: var(--text); }
    .toggle-past-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(163,230,53,.07); }

    /* ── States ── */
    .res-loading {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: 3rem 0;
      color: var(--muted);
      font-size: .9rem;
    }
    .res-empty {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--muted);
    }
    .res-empty-icon {
      font-size: 2.5rem;
      color: var(--accent);
      opacity: .35;
      display: block;
      margin-bottom: .75rem;
    }
    .res-empty p { font-size: .92rem; margin: 0; }

    /* ── Desktop table ── */
    .table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid var(--border); }
    .res-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
    .res-table th {
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
    .res-table td {
      padding: .75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      vertical-align: middle;
    }
    .res-table tbody tr:last-child td { border-bottom: none; }
    .res-table tbody tr { background: transparent; transition: background .12s; }
    .res-table tbody tr:hover td { background: var(--surface-hover); }
    .res-table tbody tr.row-cancelled td { opacity: .45; }

    .player-name { font-weight: 600; color: var(--text); }
    .player-email { font-size: .78rem; color: var(--muted); margin-top: .1rem; }
    .cell-date { white-space: nowrap; color: var(--muted); }
    .cell-time { font-weight: 700; color: var(--accent); }

    .addons { display: flex; flex-wrap: wrap; gap: .3rem; }
    .addon-chip {
      font-size: .7rem;
      background: rgba(163,230,53,0.08);
      color: var(--accent);
      border: 1px solid rgba(163,230,53,0.2);
      padding: 2px 7px;
      border-radius: 6px;
    }

    /* ── By Member view ── */
    .summary-bar { display: flex; flex-wrap: wrap; gap: .75rem; margin-bottom: 1.25rem; }
    .stat-pill {
      padding: .75rem 1.25rem;
      min-width: 90px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: .1rem;
    }
    .stat-count { font-size: 1.6rem; font-weight: 800; color: var(--accent); line-height: 1.1; }
    .stat-label { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .pill-guest { border-color: rgba(255,255,255,.15); }
    .pill-guest .stat-count { color: var(--muted); }

    .member-row { cursor: pointer; }
    .member-row:hover td { background: var(--surface-hover); }
    .member-row.row-guest .player-name { color: var(--muted); }
    .cell-expand { width: 2rem; color: var(--muted); text-align: center; }
    .chip-guest { background: rgba(255,255,255,.06); color: var(--muted); border-color: var(--border); margin-left: .4rem; }

    .member-count-badge {
      display: inline-block;
      min-width: 1.6rem;
      padding: .2rem .55rem;
      border-radius: 8px;
      background: rgba(163,230,53,.12);
      color: var(--accent);
      font-weight: 700;
      font-size: .8rem;
      text-align: center;
    }

    .member-detail-row td { padding: 0; border-bottom: 1px solid var(--border); }
    .member-bookings-table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,.02); }
    .member-bookings-table th {
      padding: .5rem 1rem .5rem 3rem;
      font-size: .68rem;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--muted);
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .member-bookings-table td {
      padding: .55rem 1rem .55rem 3rem;
      font-size: .84rem;
      color: var(--text);
      border-bottom: 1px solid var(--border);
    }
    .member-bookings-table tr:last-child td { border-bottom: none; }
    .member-bookings-table tr.row-cancelled td { opacity: .45; }

    .member-card { cursor: pointer; }
    .member-card.card-guest { border-left-color: rgba(255,255,255,.15); }
    .card-expand-hint {
      margin-top: .6rem;
      font-size: .78rem;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: .35rem;
    }
    .member-bookings-list {
      display: flex;
      flex-direction: column;
      gap: .4rem;
      margin-top: .6rem;
      padding-top: .6rem;
      border-top: 1px solid var(--border);
    }
    .member-booking-line {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem;
      align-items: center;
      font-size: .8rem;
      color: var(--muted);
    }
    .member-booking-line.row-cancelled { opacity: .5; }

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
    .status-confirmed      { background: rgba(163,230,53,.12); color: var(--accent); }
    .status-cancelled      { background: rgba(255,255,255,.07); color: var(--muted); }
    .status-pending_payment { background: rgba(245,158,11,.15); color: #fcd34d; }
    .status-paid            { background: rgba(163,230,53,.12); color: var(--accent); }
    .status-unpaid          { background: rgba(239,68,68,.12); color: #fca5a5; }
    .status-pending-approval { background: rgba(245,158,11,.15); color: #fcd34d; }
    .status-rejected        { background: rgba(239,68,68,.15); color: #fca5a5; }
    .status-none            { background: rgba(255,255,255,.07); color: var(--muted); }
    .payment-method { font-size: .72rem; color: var(--muted); margin-top: .2rem; }

    /* Action buttons */
    .cell-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
    .btn-action {
      padding: .3rem .7rem;
      border-radius: 7px;
      font-size: .78rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all .15s;
      display: flex;
      align-items: center;
      gap: .3rem;
    }
    .btn-action:disabled { opacity: .45; cursor: not-allowed; }
    .btn-edit       { background: rgba(59,130,246,.12); color: #93c5fd; border-color: rgba(59,130,246,.25); }
    .btn-edit:hover:not(:disabled) { background: rgba(59,130,246,.22); }
    .btn-cancel-res { background: rgba(245,158,11,.1);  color: #fcd34d; border-color: rgba(245,158,11,.25); }
    .btn-cancel-res:hover:not(:disabled) { background: rgba(245,158,11,.2); }
    .btn-delete     { background: rgba(239,68,68,.1);   color: #fca5a5; border-color: rgba(239,68,68,.25); }
    .btn-delete:hover:not(:disabled) { background: rgba(239,68,68,.2); }

    /* ── Mobile cards ── */
    .desktop-only { display: block; }
    .mobile-only  { display: none; }
    @media (max-width: 640px) {
      .desktop-only { display: none; }
      .mobile-only  { display: flex; flex-direction: column; gap: .75rem; }
    }
    .res-cards { }
    .res-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 14px;
      padding: 1rem 1.1rem;
    }
    .res-card.card-cancelled { border-left-color: rgba(255,255,255,.15); opacity: .6; }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: .65rem; }
    .card-meta {
      display: flex; flex-wrap: wrap; gap: .4rem;
      font-size: .78rem; color: var(--muted); margin-bottom: .75rem;
    }
    .card-meta span {
      background: rgba(255,255,255,.05);
      border-radius: 6px; padding: 2px 8px;
      display: flex; align-items: center; gap: .3rem;
    }
    .card-actions { display: flex; gap: .4rem; flex-wrap: wrap; }

    /* ── Modal ── */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.6);
      backdrop-filter: blur(3px);
      z-index: 100;
    }
    .modal {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #132219;
      border: 1px solid var(--border);
      border-radius: 18px;
      width: min(560px, 95vw);
      max-height: 90vh;
      overflow-y: auto;
      z-index: 101;
      box-shadow: 0 24px 64px rgba(0,0,0,.55);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.1rem 1.4rem;
      border-bottom: 1px solid var(--border);
    }
    .modal-header h3 { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text); }
    .modal-close {
      background: none; border: none;
      color: var(--muted); cursor: pointer;
      font-size: 1rem; padding: .25rem .5rem;
      border-radius: 6px; transition: all .15s;
    }
    .modal-close:hover { background: rgba(255,255,255,.08); color: var(--text); }
    .modal-body {
      padding: 1.25rem 1.4rem;
      display: flex; flex-direction: column; gap: .85rem;
    }
    .modal-footer {
      display: flex; gap: .65rem; justify-content: flex-end;
      padding: 1rem 1.4rem;
      border-top: 1px solid var(--border);
    }

    .m-section-label {
      font-size: .7rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: .07em;
      color: var(--accent); opacity: .7;
      margin-top: .15rem;
    }
    .m-divider { border-top: 1px solid var(--border); }

    .m-field { display: flex; flex-direction: column; gap: .35rem; }
    .m-field label { font-size: .83rem; font-weight: 600; color: var(--muted); }
    .m-input {
      padding: .55rem .8rem;
      background: rgba(255,255,255,.05);
      border: 1px solid var(--border);
      border-radius: 9px;
      color: var(--text);
      font-size: .9rem;
      font-family: inherit;
      outline: none;
      transition: border-color .15s;
      width: 100%;
      box-sizing: border-box;
      color-scheme: dark;
    }
    .m-input:focus { border-color: var(--accent); }
    .m-input-sm { width: 100px; }
    .m-notes { resize: vertical; font-family: inherit; }
    .m-note-hint { font-size: .72rem; font-weight: 400; color: var(--muted); margin-left: .3rem; }

    .court-row { display: flex; gap: .5rem; flex-wrap: wrap; }
    .court-btn {
      padding: .4rem .9rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      color: var(--muted);
      cursor: pointer;
      font-size: .85rem;
      font-weight: 600;
      font-family: inherit;
      transition: all .15s;
    }
    .court-btn:hover { border-color: var(--accent); color: var(--text); }
    .court-btn.active { background: var(--accent); border-color: var(--accent); color: #0c1a11; }

    .slot-loading { font-size: .83rem; color: var(--muted); }
    .slot-grid { display: flex; flex-wrap: wrap; gap: .35rem; }
    .slot-btn {
      padding: .3rem .65rem;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: rgba(255,255,255,.04);
      color: var(--text);
      cursor: pointer;
      font-size: .78rem;
      font-weight: 600;
      font-family: inherit;
      transition: all .12s;
    }
    .slot-btn:hover:not(:disabled) { border-color: var(--accent); }
    .slot-btn.selected { background: var(--accent); border-color: var(--accent); color: #0c1a11; }
    .slot-btn.booked { background: rgba(255,255,255,.03); color: rgba(255,255,255,.2); cursor: not-allowed; border-color: transparent; }
    .slot-btn.in-range { border-color: rgba(163,230,53,0.3); background: rgba(163,230,53,0.07); color: rgba(163,230,53,0.6); cursor: not-allowed; }
    .edit-duration-row { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .6rem; }
    .edit-duration-btn { padding: .3rem .65rem; border: 1px solid var(--border); border-radius: 7px; background: rgba(255,255,255,.04); color: var(--muted); font-size: .8rem; cursor: pointer; font-family: inherit; transition: all .12s; }
    .edit-duration-btn:hover { border-color: var(--accent); color: var(--accent); }
    .edit-duration-btn.active { background: var(--accent); border-color: var(--accent); color: #0c1a11; }

    .checks-row { display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .check-label {
      display: flex; align-items: center; gap: .4rem;
      font-size: .86rem; color: var(--muted); cursor: pointer;
    }
    .check-label input[type="checkbox"] {
      width: 16px; height: 16px; accent-color: var(--accent);
    }

    .rentals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .rental-item { display: flex; flex-direction: column; gap: .3rem; }
    .rental-item label { font-size: .8rem; color: var(--muted); }

    .m-error {
      background: rgba(239,68,68,.1);
      border: 1px solid rgba(239,68,68,.25);
      color: #fca5a5;
      border-radius: 9px;
      padding: .6rem .9rem;
      font-size: .85rem;
      display: flex; align-items: center; gap: .45rem;
    }

    .btn-primary {
      padding: .6rem 1.4rem;
      background: var(--accent);
      color: #0c1a11;
      border: none;
      border-radius: 9px;
      font-weight: 700;
      cursor: pointer;
      font-size: .9rem;
      font-family: inherit;
      transition: opacity .15s;
    }
    .btn-primary:hover:not(:disabled) { opacity: .85; }
    .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
    .btn-secondary {
      padding: .6rem 1.2rem;
      background: rgba(255,255,255,.06);
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 9px;
      font-weight: 600;
      cursor: pointer;
      font-size: .9rem;
      font-family: inherit;
      transition: all .15s;
    }
    .btn-secondary:hover { background: rgba(255,255,255,.1); color: var(--text); }

    /* ── Confirm modal ── */
    .confirm-modal {
      text-align: center;
      padding: 2rem 1.75rem;
      max-width: 380px;
    }
    .confirm-icon {
      width: 52px; height: 52px;
      border-radius: 50%;
      background: rgba(163,230,53,.1);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1rem;
      font-size: 1.4rem;
      color: var(--accent);
    }
    .confirm-icon.icon-danger {
      background: rgba(239,68,68,.12);
      color: #fca5a5;
    }
    .confirm-title {
      margin: 0 0 .5rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text);
    }
    .confirm-body {
      margin: 0 0 1.5rem;
      font-size: .88rem;
      color: var(--muted);
      line-height: 1.5;
    }
    .confirm-actions {
      display: flex; gap: .65rem; justify-content: center;
    }
    .btn-confirm {
      padding: .6rem 1.4rem;
      background: var(--accent);
      color: #0c1a11;
      border: none;
      border-radius: 9px;
      font-weight: 700;
      cursor: pointer;
      font-size: .9rem;
      font-family: inherit;
      transition: opacity .15s;
    }
    .btn-confirm:hover:not(:disabled) { opacity: .85; }
    .btn-confirm:disabled { opacity: .4; cursor: not-allowed; }
    .btn-confirm-danger {
      background: #ef4444;
      color: #fff;
    }
  `],
})
export class AdminReservationsComponent implements OnInit {
  reservations: Reservation[] = [];
  calendarReservations: Reservation[] = [];
  loading = true;
  calLoading = false;
  loadError = '';
  calendarError = '';
  acting = '';
  filterDateFrom = '';
  filterDateTo = '';
  filterCourt = '';
  showPast = false;
  viewMode: 'table' | 'calendar' | 'member' | 'date' = 'table';
  expandedMemberKeys = new Set<string>();
  expandedDateKeys = new Set<string>();

  togglePast() { this.showPast = !this.showPast; this.cdr.detectChanges(); }

  get visibleReservations(): Reservation[] {
    if (this.showPast) return this.reservations;
    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    return this.reservations.filter(r => r.date && r.date.split('T')[0] >= todayStr);
  }

  get confirmedCount(): number {
    return this.visibleReservations.filter(r => r.status === 'confirmed').length;
  }

  get pendingCount(): number {
    return this.visibleReservations.filter(r => r.status === 'pending_payment').length;
  }

  get activeFilterCount(): number {
    return [this.filterDateFrom, this.filterDateTo, this.filterCourt].filter(Boolean).length;
  }

  get memberSummaries(): MemberSummary[] {
    const map = new Map<string, MemberSummary>();

    for (const r of this.visibleReservations) {
      let key: string;
      let name: string;
      let email: string;
      let isGuest = false;

      if (typeof r.player === 'object' && r.player) {
        key = r.player._id;
        name = r.player.name;
        email = r.player.email;
      } else if (r.guestInfo?.name || r.guestInfo?.email) {
        const identity = (r.guestInfo.email || r.guestInfo.name || '').trim().toLowerCase();
        key = `guest:${identity}`;
        name = `${r.guestInfo.name} (Guest)`;
        email = r.guestInfo.email ?? '';
        isGuest = true;
      } else {
        key = 'unknown';
        name = 'Unknown';
        email = '';
        isGuest = true;
      }

      let entry = map.get(key);
      if (!entry) {
        entry = { key, name, email, count: 0, bookings: [], isGuest };
        map.set(key, entry);
      }
      entry.count++;
      entry.bookings.push(r);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
      return b.count - a.count || a.name.localeCompare(b.name);
    });
  }

  get memberCount(): number { return this.memberSummaries.filter(m => !m.isGuest).length; }
  get guestGroupCount(): number { return this.memberSummaries.filter(m => m.isGuest).length; }

  toggleMemberExpanded(key: string) {
    if (this.expandedMemberKeys.has(key)) this.expandedMemberKeys.delete(key);
    else this.expandedMemberKeys.add(key);
    this.cdr.detectChanges();
  }

  isMemberExpanded(key: string): boolean {
    return this.expandedMemberKeys.has(key);
  }

  get dateSummaries(): DateSummary[] {
    const map = new Map<string, DateSummary>();

    for (const r of this.visibleReservations) {
      const key = r.date ? r.date.split('T')[0] : 'unknown';
      let entry = map.get(key);
      if (!entry) {
        entry = { key, date: r.date, count: 0, bookings: [] };
        map.set(key, entry);
      }
      entry.count++;
      entry.bookings.push(r);
    }

    for (const entry of map.values()) {
      entry.bookings.sort((a, b) => slotToHour(a.timeSlot) - slotToHour(b.timeSlot) || a.court - b.court);
    }

    return Array.from(map.values()).sort((a, b) =>
      this.showPast ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)
    );
  }

  toggleDateExpanded(key: string) {
    if (this.expandedDateKeys.has(key)) this.expandedDateKeys.delete(key);
    else this.expandedDateKeys.add(key);
    this.cdr.detectChanges();
  }

  isDateExpanded(key: string): boolean {
    return this.expandedDateKeys.has(key);
  }

  // Confirm modal state
  confirmModal: { title: string; message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null = null;

  // Edit modal state
  editingReservation: Reservation | null = null;
  editDate = '';
  editCourt = 1;
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
  editGuestName = '';
  editGuestEmail = '';
  editGuestPhone = '';
  editAdminNote = '';
  editBookedSlots = new Set<string>();
  editLoadingSlots = false;
  editSaving = false;
  editError = '';

  allSlots: string[] = hoursToSlots(5, 22);
  readonly lightSlots = LIGHT_SLOTS;
  courtCount = 2;
  chargesByReservationId = new Map<string, Charge>();

  get courtNumbers(): number[] { return Array.from({ length: this.courtCount }, (_, i) => i + 1); }

  constructor(
    private reservationService: ReservationService,
    private clubService: ClubService,
    private chargesService: ChargesService,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener('document:keydown.escape')
  handleEscape() {
    if (this.confirmModal) {
      this.dismissConfirm();
    } else if (this.editingReservation && !this.editSaving) {
      this.closeEditModal();
    }
  }

  ngOnInit() {
    this.load();
    this.loadCharges();
    const clubId = this.clubService.getSelectedClubId();
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

  loadCharges() {
    this.chargesService.getAllCharges().subscribe({
      next: (charges) => {
        this.chargesByReservationId.clear();
        for (const c of charges) {
          if (c.chargeType !== 'reservation' || !c.reservationId) continue;
          const resId = typeof c.reservationId === 'object' ? c.reservationId._id : c.reservationId;
          this.chargesByReservationId.set(resId, c);
        }
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  chargeFor(r: Reservation): Charge | undefined {
    return this.chargesByReservationId.get(r._id);
  }

  paymentStatusLabel(r: Reservation): string {
    const c = this.chargeFor(r);
    if (!c) return '—';
    if (c.status === 'paid') return 'Paid';
    if (c.approvalStatus === 'pending') return 'Pending Approval';
    if (c.approvalStatus === 'rejected') return 'Rejected';
    return 'Unpaid';
  }

  paymentBadgeClass(r: Reservation): string {
    const c = this.chargeFor(r);
    if (!c) return 'status-none';
    if (c.status === 'paid') return 'status-paid';
    if (c.approvalStatus === 'pending') return 'status-pending-approval';
    if (c.approvalStatus === 'rejected') return 'status-rejected';
    return 'status-unpaid';
  }

  paymentMethodLabel(r: Reservation): string {
    return this.chargeFor(r)?.paymentMethod ?? '';
  }

  load() {
    this.loading = true;
    this.loadError = '';
    this.expandedMemberKeys.clear();
    this.expandedDateKeys.clear();
    const filters: { startDate?: string; endDate?: string; court?: string } = {};
    if (this.filterDateFrom) filters.startDate = this.filterDateFrom;
    if (this.filterDateTo) filters.endDate = this.filterDateTo;
    if (this.filterCourt) filters.court = this.filterCourt;
    this.reservationService.getAll(filters).subscribe({
      next: (res) => { this.reservations = res; this.loading = false; this.cdr.detectChanges(); },
      error: () => {
        this.loading = false;
        this.loadError = 'Check your connection and try loading the reservation list again.';
        this.cdr.detectChanges();
      },
    });
  }

  clearFilters() {
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterCourt = '';
    this.load();
  }

  setView(mode: 'table' | 'calendar' | 'member' | 'date') {
    this.viewMode = mode;
    if (mode === 'calendar' && this.calendarReservations.length === 0) {
      this.loadAllForCalendar();
    }
    this.cdr.detectChanges();
  }

  loadAllForCalendar() {
    this.calLoading = true;
    this.calendarError = '';
    this.reservationService.getAll().subscribe({
      next: (res) => { this.calendarReservations = res; this.calLoading = false; this.cdr.detectChanges(); },
      error: () => {
        this.calLoading = false;
        this.calendarError = 'Check your connection and try loading the calendar again.';
        this.cdr.detectChanges();
      },
    });
  }

  playerName(r: Reservation): string {
    if (typeof r.player === 'object' && r.player) return r.player.name;
    if (r.guestInfo?.name) return `${r.guestInfo.name} (Guest)`;
    return '—';
  }

  playerEmail(r: Reservation): string {
    if (typeof r.player === 'object' && r.player) return r.player.email;
    return r.guestInfo?.email ?? '';
  }

  dismissConfirm() {
    this.confirmModal = null;
    this.cdr.detectChanges();
  }

  cancel(r: Reservation) {
    this.confirmModal = {
      title: 'Cancel Reservation?',
      message: `Court ${r.court} · ${r.timeSlot} · ${this.playerName(r)}. The booking will be marked cancelled and any unpaid charge will be removed.`,
      confirmLabel: 'Yes, Cancel',
      danger: false,
      onConfirm: () => {
        this.confirmModal = null;
        this.acting = r._id;
        this.cdr.detectChanges();
        this.reservationService.cancel(r._id).subscribe({
          next: () => { this.acting = ''; this.load(); },
          error: () => {
            this.acting = '';
            this.confirmModal = {
              title: 'Cancellation failed',
              message: 'The reservation was not changed. Please check your connection and try again.',
              confirmLabel: 'Close',
              danger: false,
              onConfirm: () => this.dismissConfirm(),
            };
            this.cdr.detectChanges();
          },
        });
      },
    };
    this.cdr.detectChanges();
  }

  deleteRes(r: Reservation) {
    this.confirmModal = {
      title: 'Delete Reservation?',
      message: `This will permanently remove the booking for ${this.playerName(r)} on Court ${r.court} at ${r.timeSlot}. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        this.confirmModal = null;
        this.acting = r._id;
        this.cdr.detectChanges();
        this.reservationService.delete(r._id).subscribe({
          next: () => { this.acting = ''; this.load(); },
          error: (err) => {
            this.acting = '';
            const msg = err?.error?.error ?? 'Failed to delete reservation.';
            this.confirmModal = { title: 'Cannot Delete', message: msg, confirmLabel: 'OK', danger: false, onConfirm: () => { this.confirmModal = null; this.cdr.detectChanges(); } };
            this.cdr.detectChanges();
          },
        });
      },
    };
    this.cdr.detectChanges();
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
    this.editGuestName = r.guestInfo?.name ?? '';
    this.editGuestEmail = r.guestInfo?.email ?? '';
    this.editGuestPhone = r.guestInfo?.phone ?? '';
    this.editAdminNote = r.adminNote ?? '';
    this.editError = '';
    this.editSaving = false;
    this.loadEditAvailability();
    this.cdr.detectChanges();
  }

  closeEditModal() {
    this.editingReservation = null;
    this.cdr.detectChanges();
  }

  loadEditAvailability() {
    if (!this.editDate || !this.editCourt) return;
    this.editLoadingSlots = true;
    this.reservationService.getAvailability(this.editCourt, this.editDate).subscribe({
      next: (res) => {
        const booked = new Set([...res.bookedSlots, ...res.pendingSlots]);
        if (this.editingReservation &&
            this.editDate === this.editingReservation.date.split('T')[0] &&
            this.editCourt === this.editingReservation.court) {
          const ownStart = slotToHour(this.editingReservation.timeSlot);
          const ownDur = this.editingReservation.durationHours ?? 1;
          for (let i = 0; i < ownDur; i++) booked.delete(hourToSlot(ownStart + i));
        }
        this.editBookedSlots = booked;
        this.editLoadingSlots = false;
        this.computeEditAvailableDurations();
        this.cdr.detectChanges();
      },
      error: () => {
        this.editLoadingSlots = false;
        this.editError = 'Available time slots could not be loaded. Please try another date or court.';
        this.cdr.detectChanges();
      },
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

  timeRangeLabel(r: Reservation): string {
    const d = r.durationHours ?? 1;
    if (d <= 1) return r.timeSlot;
    return `${r.timeSlot} – ${hourToSlot(slotToHour(r.timeSlot) + d)}`;
  }

  saveEdit() {
    if (!this.editingReservation || !this.editSlot) return;
    this.editSaving = true;
    this.editError = '';

    const isGuest = !this.editingReservation.player;
    const payload: Parameters<ReservationService['update']>[1] = {
      court: this.editCourt,
      date: this.editDate,
      timeSlot: this.editSlot,
      durationHours: this.editDuration,
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
    };
    if (isGuest) {
      payload.guestInfo = {
        name: this.editGuestName,
        email: this.editGuestEmail,
        phone: this.editGuestPhone,
      };
    }
    payload.adminNote = this.editAdminNote;

    this.reservationService.update(this.editingReservation._id, payload).subscribe({
      next: () => {
        this.editSaving = false;
        this.editingReservation = null;
        this.load();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.editSaving = false;
        this.editError = err?.error?.error || 'Failed to save. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }
}
