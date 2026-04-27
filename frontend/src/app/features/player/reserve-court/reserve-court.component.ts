import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReservationService } from '../../../core/services/reservation.service';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { RatesService } from '../../../core/services/rates.service';
import { CoinsService } from '../../../core/services/coins.service';

const ALL_SLOTS = [
  '5am','6am','7am','8am','9am','10am','11am',
  '12pm','1pm','2pm','3pm','4pm','5pm',
  '6pm','7pm','8pm','9pm','10pm',
];
const LIGHT_SLOTS = new Set(['5am','6pm','7pm','8pm','9pm']);

interface ActivePlayer { _id: string; name: string; email: string; }

@Component({
  selector: 'app-reserve-court',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
      <div class="page-card">
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <h2>Reserve a Court</h2>
        </div>

        <div class="card-body">
          @if (successMsg) {
            <div class="alert alert-success">{{ successMsg }}</div>
          }
          @if (errorMsg) {
            <div class="alert alert-error">{{ errorMsg }}</div>
          }

          <!-- Date -->
          <div class="form-group">
            <label class="form-label">Date</label>
            <input
              type="date"
              class="form-input"
              [(ngModel)]="selectedDate"
              [min]="today"
              (change)="onDateOrCourtChange()"
            />
          </div>

          <!-- Court -->
          <div class="form-group">
            <label class="form-label">Court</label>
            <div class="court-toggle">
              <button class="court-btn" [class.active]="selectedCourt === 1" (click)="selectCourt(1)">Court 1</button>
              <button class="court-btn" [class.active]="selectedCourt === 2" (click)="selectCourt(2)">Court 2</button>
            </div>
          </div>

          <!-- Time Slot -->
          @if (selectedDate && selectedCourt) {
            <div class="form-group">
              <label class="form-label">
                Time Slot
                <span class="legend"><span class="legend-dot lights-dot"></span> with lights</span>
              </label>
              @if (loadingSlots) {
                <div class="slot-loading">Checking availability...</div>
              } @else {
                <div class="slot-grid">
                  @for (slot of allSlots; track slot) {
                    <button
                      class="slot-btn"
                      [class.selected]="selectedSlot === slot"
                      [class.booked]="bookedSlots.has(slot)"
                      [class.has-lights]="lightSlots.has(slot)"
                      [disabled]="bookedSlots.has(slot)"
                      (click)="selectSlot(slot)"
                    >
                      {{ slot }}
                      @if (lightSlots.has(slot)) { <span class="light-icon">💡</span> }
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- Playing With -->
          <div class="form-group">
            <label class="form-label">Playing With <span class="optional">(optional)</span></label>

            <!-- Search input -->
            <div class="search-wrap" #searchWrap>
              <input
                type="text"
                class="form-input"
                placeholder="Search member by name..."
                [(ngModel)]="playerSearch"
                (input)="onSearch()"
                (focus)="onInputFocus()"
                autocomplete="off"
              />
              @if (showDropdown && filteredPlayers.length > 0) {
                <div class="dropdown">
                  @for (p of filteredPlayers; track p._id) {
                    <button class="dropdown-item" (click)="addPlayer(p)">
                      <span class="drop-name">{{ p.name }}</span>
                      <span class="drop-email">{{ p.email }}</span>
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Selected players chips -->
            @if (addedPlayers.length > 0) {
              <div class="chips">
                @for (p of addedPlayers; track p._id) {
                  <span class="chip">
                    {{ p.name }}
                    <button class="chip-remove" (click)="removePlayer(p._id)">×</button>
                  </span>
                }
              </div>
            }
          </div>

          <!-- Lights -->
          <div class="form-group">
            <label class="form-label">Lights</label>
            <label class="toggle-row">
              <input type="checkbox" class="toggle-input" [(ngModel)]="lightsRequested" />
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">{{ lightsRequested ? 'Lights on 💡' : 'No lights 🌙' }}</span>
            </label>
          </div>

          <!-- Holiday -->
          <div class="form-group">
            <label class="form-label">Holiday <span class="optional">(optional)</span></label>
            <label class="toggle-row">
              <input type="checkbox" class="toggle-input" [(ngModel)]="isHoliday" />
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">{{ isHoliday ? 'Yes — holiday rates apply' : 'No — regular rates apply' }}</span>
            </label>
          </div>

          <!-- Ball Boy -->
          <div class="form-group">
            <label class="form-label">Ball Boy <span class="optional">(optional)</span></label>
            <label class="toggle-row">
              <input type="checkbox" class="toggle-input" [(ngModel)]="ballBoyRequested" />
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">{{ ballBoyRequested ? 'Requested' : 'Not requested' }}</span>
            </label>
          </div>

          <!-- Guests -->
          <div class="form-group">
            <label class="form-label">Guests <span class="optional">(non-members)</span></label>
            <div class="guest-counter">
              <button type="button" class="counter-btn" (click)="guestCount = guestCount > 0 ? guestCount - 1 : 0">−</button>
              <span class="counter-value">{{ guestCount }}</span>
              <button type="button" class="counter-btn" (click)="guestCount = guestCount + 1">+</button>
              @if (guestCount > 0 && !loadingRates) {
                <span class="counter-fee">{{ guestFeeRate | currency: 'PHP' : 'symbol' }} × {{ guestCount }} = {{ totalGuestFee | currency: 'PHP' : 'symbol' }}</span>
              }
            </div>
          </div>

          <!-- Rentals -->
          <div class="form-group">
            <label class="form-label">Rentals <span class="optional">(optional)</span></label>
            <div class="rental-list">

              <!-- Balls 50pcs -->
              <div class="rental-row">
                <span class="rental-name">🎾 Balls (50 pcs)</span>
                <span class="rental-rate">{{ rentalBalls50Rate | currency: 'PHP' : 'symbol' }}/hr</span>
                <div class="rental-counter">
                  <button type="button" class="counter-btn sm" (click)="rentalBalls50 = rentalBalls50 > 0 ? rentalBalls50 - 1 : 0">−</button>
                  <span class="counter-value sm">{{ rentalBalls50 }}</span>
                  <button type="button" class="counter-btn sm" (click)="rentalBalls50 = rentalBalls50 + 1">+</button>
                </div>
              </div>

              <!-- Balls 100pcs -->
              <div class="rental-row">
                <span class="rental-name">🎾 Balls (100 pcs)</span>
                <span class="rental-rate">{{ rentalBalls100Rate | currency: 'PHP' : 'symbol' }}/hr</span>
                <div class="rental-counter">
                  <button type="button" class="counter-btn sm" (click)="rentalBalls100 = rentalBalls100 > 0 ? rentalBalls100 - 1 : 0">−</button>
                  <span class="counter-value sm">{{ rentalBalls100 }}</span>
                  <button type="button" class="counter-btn sm" (click)="rentalBalls100 = rentalBalls100 + 1">+</button>
                </div>
              </div>

              <!-- Ball Machine -->
              <div class="rental-row">
                <span class="rental-name">🤖 Ball Machine</span>
                <span class="rental-rate">{{ rentalBallMachineRate | currency: 'PHP' : 'symbol' }}/hr</span>
                <label class="toggle-row" style="margin:0">
                  <input type="checkbox" class="toggle-input" [(ngModel)]="rentalBallMachine" />
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                  <span class="toggle-label" style="font-size:.82rem">{{ rentalBallMachine ? 'Yes' : 'No' }}</span>
                </label>
              </div>

              <!-- Racket -->
              <div class="rental-row">
                <span class="rental-name">🏓 Racket</span>
                <span class="rental-rate">{{ rentalRacketRate | currency: 'PHP' : 'symbol' }}/hr each</span>
                <div class="rental-counter">
                  <button type="button" class="counter-btn sm" (click)="rentalRackets = rentalRackets > 0 ? rentalRackets - 1 : 0">−</button>
                  <span class="counter-value sm">{{ rentalRackets }}</span>
                  <button type="button" class="counter-btn sm" (click)="rentalRackets = rentalRackets + 1">+</button>
                </div>
              </div>

            </div>
          </div>

          <!-- Summary + Confirm -->
          @if (selectedSlot) {
            <div class="summary-box">
              <div class="summary-row"><span>Court</span><strong>Court {{ selectedCourt }}</strong></div>
              <div class="summary-row">
                <span>Date</span>
                <strong>{{ selectedDate | date: 'EEE, MMM d, y' : 'UTC' }}</strong>
              </div>
              <div class="summary-row"><span>Time</span><strong>{{ selectedSlot }}</strong></div>
              <div class="summary-row">
                <span>Lights</span>
                <strong>{{ lightsRequested ? 'Yes 💡' : 'No 🌙' }}</strong>
              </div>
              <div class="summary-row">
                <span>Day Type</span>
                <strong>
                  @if (dayType === 'holiday') { Holiday 🏖️ }
                  @else if (dayType === 'weekend') { Weekend 🎉 }
                  @else { Weekday 📅 }
                </strong>
              </div>
              <div class="summary-row">
                <span>Ball Boy</span>
                <strong>{{ ballBoyRequested ? 'Yes 🎾' : 'No' }}</strong>
              </div>
              @if (addedPlayers.length > 0) {
                <div class="summary-row">
                  <span>Playing with</span>
                  <strong>{{ addedPlayers.map(p => p.name).join(', ') }}</strong>
                </div>
              }
              <div class="summary-divider"></div>
              <div class="summary-row">
                <span>Court Fee</span>
                <strong>
                  @if (loadingRates) { — }
                  @else { {{ baseCourtFee | currency: 'PHP' : 'symbol' }} }
                </strong>
              </div>
              @if (lightsRequested) {
                <div class="summary-row">
                  <span>Lights Fee</span>
                  <strong>
                    @if (loadingRates) { — }
                    @else { {{ lightsRate | currency: 'PHP' : 'symbol' }} }
                  </strong>
                </div>
              }
              @if (ballBoyRequested) {
                <div class="summary-row">
                  <span>Ball Boy Fee</span>
                  <strong>
                    @if (loadingRates) { — }
                    @else { {{ ballBoyRate | currency: 'PHP' : 'symbol' }} }
                  </strong>
                </div>
              }
              @if (totalRentalFee > 0) {
                <div class="summary-row">
                  <span>Rentals</span>
                  <strong>
                    @if (loadingRates) { — }
                    @else { {{ totalRentalFee | currency: 'PHP' : 'symbol' }} }
                  </strong>
                </div>
              }
              @if (guestCount > 0) {
                <div class="summary-row">
                  <span>Guests <span class="summary-sub">({{ guestCount }} × {{ guestFeeRate | currency: 'PHP' : 'symbol' }})</span></span>
                  <strong>
                    @if (loadingRates) { — }
                    @else { {{ totalGuestFee | currency: 'PHP' : 'symbol' }} }
                  </strong>
                </div>
              }
              <div class="summary-divider"></div>
              <div class="summary-row fee-row">
                <span>Total</span>
                <strong class="fee-amount">
                  @if (loadingRates) { — }
                  @else { {{ computedFee | currency: 'PHP' : 'symbol' }} }
                </strong>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-row coin-row">
                <span><i class="fas fa-coins" style="color:#f59e0b;margin-right:4px"></i> Coin Cost</span>
                <strong class="coin-cost">5 coins</strong>
              </div>
            </div>

            <button class="confirm-btn" [disabled]="booking" (click)="confirm()">
              {{ booking ? 'Booking...' : 'Confirm Reservation' }}
            </button>
          }
        </div>
      </div>
    </div>
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
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: url('/tennis-court-surface.png') center/cover no-repeat; z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: rgba(0,18,0,.35); z-index: 0; }
    .page-card {
      position: relative; z-index: 1; background: #fff; border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,.45); width: 100%; max-width: 560px;
    }
    .card-header {
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
      padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;
      border-radius: 20px 20px 0 0;
    }
    .back-btn {
      background: rgba(255,255,255,.2); border: none; color: #fff;
      padding: .4rem .9rem; border-radius: 8px; cursor: pointer; font-size: .85rem; transition: background .2s;
    }
    .back-btn:hover { background: rgba(255,255,255,.35); }
    .card-header h2 { color: #fff; margin: 0; font-size: 1.3rem; }
    .card-body { padding: 1.75rem; display: flex; flex-direction: column; gap: 1.25rem; }

    .alert { padding: .75rem 1rem; border-radius: 8px; font-weight: 600; font-size: .9rem; }
    .alert-success { background: #f4ead6; color: #7a5626; }
    .alert-error { background: #fee2e2; color: #991b1b; }

    .form-group { display: flex; flex-direction: column; gap: .5rem; }
    .form-label {
      font-size: .85rem; font-weight: 700; color: #9f7338;
      text-transform: uppercase; letter-spacing: .5px;
      display: flex; align-items: center; gap: .75rem;
    }
    .optional { font-size: .78rem; font-weight: 500; color: #9ca3af; text-transform: none; letter-spacing: 0; }
    .legend { display: flex; align-items: center; gap: .3rem; font-weight: 500; color: #555; text-transform: none; letter-spacing: 0; font-size: .8rem; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
    .lights-dot { background: #f59e0b; }
    .form-input {
      width: 100%; box-sizing: border-box;
      padding: .6rem .9rem; border: 2px solid #e5e7eb; border-radius: 8px;
      font-size: .95rem; outline: none; transition: border-color .2s;
    }
    .form-input:focus { border-color: #9f7338; }

    .court-toggle { display: flex; gap: .75rem; }
    .court-btn {
      flex: 1; padding: .65rem; border: 2px solid #e5e7eb; border-radius: 10px;
      background: #f9fafb; font-size: .95rem; font-weight: 700; cursor: pointer;
      transition: all .2s; color: #374151;
    }
    .court-btn.active { border-color: #9f7338; background: #9f7338; color: #fff; }
    .court-btn:hover:not(.active) { border-color: #9f7338; background: #f8f1e4; }

    .slot-loading { color: #666; font-size: .9rem; padding: .5rem 0; }
    .slot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: .5rem; }
    .slot-btn {
      position: relative; padding: .6rem .4rem; border: 2px solid #e5e7eb; border-radius: 8px;
      background: #f9fafb; font-size: .88rem; font-weight: 600; cursor: pointer;
      transition: all .2s; color: #374151; display: flex; flex-direction: column; align-items: center; gap: .1rem;
    }
    .slot-btn.has-lights { border-color: #fcd34d; background: #fffbeb; }
    .slot-btn.selected { border-color: #9f7338; background: #9f7338; color: #fff; }
    .slot-btn.selected.has-lights { background: #9f7338; }
    .slot-btn.booked { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; border-color: #e5e7eb; text-decoration: line-through; }
    .slot-btn:hover:not(.booked):not(.selected) { border-color: #9f7338; background: #f8f1e4; }
    .light-icon { font-size: .75rem; }

    /* Player search */
    .search-wrap { position: relative; }
    .dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10;
      background: #fff; border: 2px solid #e5e7eb; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 220px; overflow-y: auto;
    }
    .dropdown-item {
      width: 100%; display: flex; flex-direction: column; align-items: flex-start;
      padding: .65rem 1rem; border: none; background: transparent;
      cursor: pointer; transition: background .15s; text-align: left;
    }
    .dropdown-item:hover { background: #f8f1e4; }
    .drop-name { font-weight: 600; color: #1a1a1a; font-size: .9rem; }
    .drop-email { color: #6b7280; font-size: .8rem; }

    .chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .25rem; }
    .chip {
      display: inline-flex; align-items: center; gap: .3rem;
      background: #f4ead6; color: #7a5626; border-radius: 20px;
      padding: .3rem .75rem; font-size: .85rem; font-weight: 600;
    }
    .chip-remove {
      background: none; border: none; color: #7a5626; cursor: pointer;
      font-size: 1.1rem; line-height: 1; padding: 0; font-weight: 700;
      opacity: .7; transition: opacity .15s;
    }
    .chip-remove:hover { opacity: 1; }

    .summary-box {
      background: #f8f1e4; border: 1px solid #e6d2ad; border-radius: 12px;
      padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: .5rem;
    }
    .summary-row { display: flex; justify-content: space-between; align-items: center; font-size: .9rem; color: #374151; }
    .summary-row strong { color: #1a1a1a; }
    .summary-divider { height: 1px; background: #e6d2ad; margin: .25rem 0; }
    .fee-row { font-weight: 700; }
    .fee-row span { display: flex; align-items: center; gap: .5rem; }
    .fee-tag {
      font-size: .72rem; font-weight: 700; padding: .15rem .45rem;
      border-radius: 6px; background: #f3f4f6; color: #374151;
    }
    .fee-tag.lights { background: #fef9c3; color: #854d0e; }
    .fee-amount { font-size: 1.1rem; color: #9f7338; }

    .rental-list {
      display: flex; flex-direction: column; gap: .5rem;
      border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;
    }
    .rental-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .6rem .9rem; background: #fafafa; border-bottom: 1px solid #f0f0f0;
    }
    .rental-row:last-child { border-bottom: none; }
    .rental-name { flex: 1; font-size: .9rem; font-weight: 600; color: #374151; }
    .rental-rate { font-size: .8rem; color: #9f7338; font-weight: 600; white-space: nowrap; }
    .rental-counter { display: flex; align-items: center; gap: .4rem; }
    .counter-btn.sm { width: 28px; height: 28px; font-size: 1rem; border-radius: 6px; }
    .counter-value.sm { min-width: 24px; font-size: 1rem; }

    .guest-counter {
      display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
    }
    .counter-btn {
      width: 36px; height: 36px; border-radius: 8px;
      border: 2px solid #9f7338; background: #fff; color: #9f7338;
      font-size: 1.2rem; font-weight: 700; cursor: pointer; line-height: 1;
      transition: all .15s; display: flex; align-items: center; justify-content: center;
    }
    .counter-btn:hover { background: #9f7338; color: #fff; }
    .counter-value {
      min-width: 32px; text-align: center; font-size: 1.2rem;
      font-weight: 700; color: #1a1a1a;
    }
    .counter-fee {
      font-size: .85rem; color: #9f7338; font-weight: 600;
    }
    .summary-sub {
      font-size: .78rem; font-weight: 400; color: #6b7280;
    }

    .toggle-row {
      display: flex; align-items: center; gap: .75rem; cursor: pointer; user-select: none;
    }
    .toggle-input { display: none; }
    .toggle-track {
      position: relative; width: 44px; height: 24px; border-radius: 12px;
      background: #d1d5db; transition: background .2s; flex-shrink: 0;
    }
    .toggle-input:checked + .toggle-track { background: #9f7338; }
    .toggle-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: left .2s;
    }
    .toggle-input:checked + .toggle-track .toggle-thumb { left: 23px; }
    .toggle-label { font-size: .9rem; color: #374151; font-weight: 600; }

    .confirm-btn {
      width: 100%; padding: .85rem;
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
      color: #fff; border: none; border-radius: 10px;
      font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity .2s;
    }
    .confirm-btn:disabled { opacity: .6; cursor: not-allowed; }
    .confirm-btn:not(:disabled):hover { opacity: .9; }

    @media (max-width: 480px) {
      .page-wrap { padding: 1rem; }
      .card-body { padding: 1.25rem; }
      .slot-grid { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); }
    }
  `],
})
export class ReserveCourtComponent implements OnInit, OnDestroy {
  @ViewChild('searchWrap') searchWrapRef!: ElementRef<HTMLElement>;

  allSlots = ALL_SLOTS;
  lightSlots = LIGHT_SLOTS;

  selectedDate = '';
  selectedCourt: 1 | 2 | null = null;
  selectedSlot = '';
  bookedSlots = new Set<string>();
  loadingSlots = false;
  booking = false;
  successMsg = '';
  errorMsg = '';
  today = new Date().toISOString().split('T')[0];

  allActivePlayers: ActivePlayer[] = [];
  filteredPlayers: ActivePlayer[] = [];
  addedPlayers: ActivePlayer[] = [];
  playerSearch = '';
  showDropdown = false;

  weekdayRate = 0;
  weekendRate = 0;
  holidayRate = 0;
  lightsRate = 0;
  ballBoyRate = 0;
  guestFeeRate = 0;
  rentalBalls50Rate = 0;
  rentalBalls100Rate = 0;
  rentalBallMachineRate = 0;
  rentalRacketRate = 0;
  rentalBalls50 = 0;
  rentalBalls100 = 0;
  rentalBallMachine = false;
  rentalRackets = 0;
  lightsRequested = false;
  ballBoyRequested = false;
  isHoliday = false;
  guestCount = 0;
  loadingRates = true;

  private readonly WEEKEND_DAYS = new Set([0, 5, 6]); // Sun=0, Fri=5, Sat=6

  get hasLights(): boolean {
    return LIGHT_SLOTS.has(this.selectedSlot);
  }

  get dayType(): 'weekday' | 'weekend' | 'holiday' {
    if (this.isHoliday) return 'holiday';
    if (!this.selectedDate) return 'weekday';
    const day = new Date(this.selectedDate + 'T00:00:00Z').getUTCDay();
    return this.WEEKEND_DAYS.has(day) ? 'weekend' : 'weekday';
  }

  get baseCourtFee(): number {
    if (!this.selectedSlot) return 0;
    switch (this.dayType) {
      case 'holiday': return this.holidayRate;
      case 'weekend': return this.weekendRate;
      default:        return this.weekdayRate;
    }
  }

  get lightsFee(): number {
    return this.lightsRequested ? this.lightsRate : 0;
  }

  get totalGuestFee(): number {
    return this.guestCount * this.guestFeeRate;
  }

  get totalRentalFee(): number {
    return (
      this.rentalBalls50 * this.rentalBalls50Rate +
      this.rentalBalls100 * this.rentalBalls100Rate +
      (this.rentalBallMachine ? this.rentalBallMachineRate : 0) +
      this.rentalRackets * this.rentalRacketRate
    );
  }

  get computedFee(): number {
    return this.baseCourtFee + this.lightsFee + (this.ballBoyRequested ? this.ballBoyRate : 0) + this.totalGuestFee + this.totalRentalFee;
  }

  constructor(
    private reservationService: ReservationService,
    private usersService: UsersService,
    private ratesService: RatesService,
    private auth: AuthService,
    private coinsService: CoinsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.usersService.getActivePlayers().subscribe({
      next: (players) => {
        const myId = this.auth.user()?.id;
        this.allActivePlayers = players.filter((p) => p._id !== myId);
        this.cdr.detectChanges();
      },
    });

    this.ratesService.getRates().subscribe({
      next: (rates) => {
        this.weekdayRate = rates.reservationWeekdayRate ?? 0;
        this.weekendRate = rates.reservationWeekendRate ?? 0;
        this.holidayRate = rates.reservationHolidayRate ?? 0;
        this.lightsRate = rates.lightRate ?? 0;
        this.ballBoyRate = rates.ballBoyRate ?? 0;
        this.guestFeeRate = rates.reservationGuestFee ?? 0;
        this.rentalBalls50Rate = rates.rentalBalls50Rate ?? 0;
        this.rentalBalls100Rate = rates.rentalBalls100Rate ?? 0;
        this.rentalBallMachineRate = rates.rentalBallMachineRate ?? 0;
        this.rentalRacketRate = rates.rentalRacketRate ?? 0;
        this.loadingRates = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingRates = false; this.cdr.detectChanges(); },
    });

    document.addEventListener('click', this.onDocClick);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.onDocClick);
  }

  private onDocClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.search-wrap')) {
      this.showDropdown = false;
      this.cdr.detectChanges();
    }
  };

  onInputFocus() {
    this.showDropdown = true;
    this.scrollSearchIntoView();
  }

  private scrollSearchIntoView() {
    setTimeout(() => {
      this.searchWrapRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  onSearch() {
    const q = this.playerSearch.trim().toLowerCase();
    const addedIds = new Set(this.addedPlayers.map((p) => p._id));
    this.filteredPlayers = q
      ? this.allActivePlayers.filter(
          (p) => !addedIds.has(p._id) && p.name.toLowerCase().includes(q),
        )
      : [];
    this.showDropdown = this.filteredPlayers.length > 0;
    if (this.showDropdown) this.scrollSearchIntoView();
    this.cdr.detectChanges();
  }

  addPlayer(p: ActivePlayer) {
    if (!this.addedPlayers.find((x) => x._id === p._id)) {
      this.addedPlayers = [...this.addedPlayers, p];
    }
    this.playerSearch = '';
    this.filteredPlayers = [];
    this.showDropdown = false;
    this.cdr.detectChanges();
  }

  removePlayer(id: string) {
    this.addedPlayers = this.addedPlayers.filter((p) => p._id !== id);
    this.cdr.detectChanges();
  }

  selectCourt(court: 1 | 2) {
    this.selectedCourt = court;
    this.selectedSlot = '';
    this.onDateOrCourtChange();
  }

  onDateOrCourtChange() {
    this.selectedSlot = '';
    this.bookedSlots = new Set();
    if (!this.selectedDate || !this.selectedCourt) return;
    this.loadingSlots = true;
    this.reservationService.getAvailability(this.selectedCourt, this.selectedDate).subscribe({
      next: (res) => {
        this.bookedSlots = new Set(res.bookedSlots);
        this.loadingSlots = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingSlots = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectSlot(slot: string) {
    if (this.bookedSlots.has(slot)) return;
    this.selectedSlot = slot;
    this.successMsg = '';
    this.errorMsg = '';
  }

  confirm() {
    if (!this.selectedDate || !this.selectedCourt || !this.selectedSlot) return;
    this.booking = true;
    this.errorMsg = '';
    this.successMsg = '';
    this.reservationService.create({
      court: this.selectedCourt,
      date: this.selectedDate,
      timeSlot: this.selectedSlot,
      players: this.addedPlayers.map((p) => p._id),
      lightsRequested: this.lightsRequested,
      ballBoy: this.ballBoyRequested,
      isHoliday: this.isHoliday,
      guestCount: this.guestCount,
      rentals: {
        balls50: this.rentalBalls50,
        balls100: this.rentalBalls100,
        ballMachine: this.rentalBallMachine,
        rackets: this.rentalRackets,
      },
    }).subscribe({
      next: () => {
        this.booking = false;
        const withStr = this.addedPlayers.length
          ? ` with ${this.addedPlayers.map((p) => p.name).join(', ')}`
          : '';
        this.successMsg = `Court ${this.selectedCourt} reserved for ${this.selectedSlot}${withStr}!`;
        this.bookedSlots = new Set([...this.bookedSlots, this.selectedSlot]);
        this.selectedSlot = '';
        this.addedPlayers = [];
        this.lightsRequested = false;
        this.ballBoyRequested = false;
        this.isHoliday = false;
        this.guestCount = 0;
        this.rentalBalls50 = 0;
        this.rentalBalls100 = 0;
        this.rentalBallMachine = false;
        this.rentalRackets = 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.booking = false;
        if (err?.status === 402) {
          this.errorMsg = `Insufficient coins. Your club has ${err.error?.coinBalance ?? 0} coins but 5 are needed. Please ask your admin to request more coins.`;
        } else {
          this.errorMsg = err?.error?.error || 'Failed to book. Please try again.';
        }
        this.cdr.detectChanges();
      },
    });
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}


