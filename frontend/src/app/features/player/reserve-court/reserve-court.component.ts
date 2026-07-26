import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReservationService } from '../../../core/services/reservation.service';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { RatesService } from '../../../core/services/rates.service';
import { SoundService } from '../../../core/services/sound.service';
import { ClubService, AdditionalFee } from '../../../core/services/club.service';

const LIGHT_SLOTS = new Set(['5am','6pm','7pm','8pm','9pm','10pm','11pm','12am']);

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

interface ActivePlayer { _id: string; name: string; email: string; }

@Component({
  selector: 'app-reserve-court',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dm-shell">
      <!-- Mobile header -->
      <header class="dm-header">
        <button class="dm-back-btn" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">Reserve a Court</span>
        <div style="width:34px"></div>
      </header>

      <div class="dm-body">
        @if (successMsg) {
          <div class="dm-alert dm-alert-success"><i class="fas fa-check-circle"></i> {{ successMsg }}</div>
        }
        @if (showPaymentInfo && paymentMethods.length > 0) {
          <div class="dm-payment-notice">
            @if (paymentMethods[0] === 'GoTyme') {
              <img src="/goTyme.jpg" alt="GoTyme" class="dm-payment-method-logo" />
            } @else {
              <i class="fas fa-wallet"></i>
            }
            <div>
              <strong>Pay via {{ paymentMethods[0] }}</strong>
              @if (paymentQrCodes[paymentMethods[0]]) {
                <img [src]="paymentQrCodes[paymentMethods[0]]" alt="Payment QR Code" class="dm-qr-code" />
                <p>Scan the QR code to pay. Your booking will be confirmed once payment is verified.</p>
              } @else if (paymentAccounts[paymentMethods[0]]) {
                <p class="dm-payment-account">{{ paymentAccounts[paymentMethods[0]] }}</p>
                <p>Send the exact amount and keep your reference. Your booking will be confirmed once payment is verified.</p>
              } @else {
                <p>Send the exact amount and keep your reference. Your booking will be confirmed once payment is verified.</p>
              }
            </div>
          </div>
        }
        @if (errorMsg) {
          <div class="dm-alert dm-alert-error"><i class="fas fa-exclamation-triangle"></i> {{ errorMsg }}</div>
        }

        <!-- Date -->
        <div class="dm-section">
          <div class="dm-section-label">Date</div>
          <input
            type="date"
            class="dm-input"
            [class.dm-input-error]="submitted && !selectedDate"
            [(ngModel)]="selectedDate"
            [min]="today"
            (change)="onDateOrCourtChange()"
          />
          @if (submitted && !selectedDate) {
            <div class="dm-field-error"><i class="fas fa-exclamation-circle"></i> Please select a date.</div>
          }
        </div>

        <!-- Court -->
        <div class="dm-section">
          <div class="dm-section-label">Court</div>
          <div class="dm-court-toggle" [class.dm-court-toggle-error]="submitted && !selectedCourt">
            @for (n of courtNumbers; track n) {
              <button class="dm-court-btn" [class.active]="selectedCourt === n" (click)="selectCourt(n)">
                <i class="fas fa-table-tennis"></i> Court {{ n }}
              </button>
            }
          </div>
          @if (submitted && !selectedCourt) {
            <div class="dm-field-error"><i class="fas fa-exclamation-circle"></i> Please select a court.</div>
          }
        </div>

        <!-- Time Slot -->
        @if (selectedDate && selectedCourt) {
          <div class="dm-section">
            <div class="dm-section-label">
              Time Slot
              <span class="dm-lights-legend"><span class="dm-lights-dot"></span> with lights</span>
            </div>
            @if (loadingSlots) {
              <div class="dm-slot-loading"><i class="fas fa-circle-notch fa-spin"></i> Checking availability…</div>
            } @else {
              <div class="dm-slot-grid">
                @for (slot of allSlots; track slot) {
                  <button
                    class="dm-slot-btn"
                    [class.selected]="selectedSlot === slot"
                    [class.booked]="bookedSlots.has(slot)"
                    [class.in-range]="isInRange(slot)"
                    [class.has-lights]="lightSlots.has(slot)"
                    [class.coaching-blocked]="coachingRequested && isCoachingBlocked(slot)"
                    [disabled]="bookedSlots.has(slot) || isInRange(slot) || (coachingRequested && isCoachingBlocked(slot))"
                    (click)="selectSlot(slot)"
                  >
                    {{ slot }}
                    @if (lightSlots.has(slot)) { <span class="dm-light-dot">💡</span> }
                  </button>
                }
              </div>
              @if (submitted && !selectedSlot) {
                <div class="dm-field-error" style="margin-top:8px"><i class="fas fa-exclamation-circle"></i> Please select a time slot.</div>
              }
            }
          </div>
        }
        @if (submitted && !selectedSlot && !(selectedDate && selectedCourt)) {
          <div class="dm-field-error dm-field-error-slot"><i class="fas fa-exclamation-circle"></i> Please select a date and court first, then choose a time slot.</div>
        }

        <!-- Duration -->
        @if (selectedSlot && availableDurations.length > 1) {
          <div class="dm-section">
            <div class="dm-section-label">Duration</div>
            <div class="dm-duration-row">
              @for (d of availableDurations; track d) {
                <button
                  type="button"
                  class="dm-duration-btn"
                  [class.active]="selectedDuration === d"
                  [disabled]="coachingRequested && d < coachingMinHours"
                  [title]="coachingRequested && d < coachingMinHours ? 'Coaching requires a minimum of ' + coachingMinHours + ' hours' : ''"
                  (click)="setDuration(d)"
                >
                  {{ d }} hr{{ d > 1 ? 's' : '' }}
                </button>
              }
            </div>
          </div>
        }

        <!-- Playing With -->
        <div class="dm-section">
          <div class="dm-section-label">Playing With <span class="dm-optional">optional</span></div>
          <div class="dm-search-wrap" #searchWrap>
            <i class="fas fa-search dm-search-icon"></i>
            <input
              type="text"
              class="dm-input dm-search-input"
              placeholder="Search member by name…"
              [(ngModel)]="playerSearch"
              (input)="onSearch()"
              (focus)="onInputFocus()"
              autocomplete="off"
            />
            @if (showDropdown && filteredPlayers.length > 0) {
              <div class="dm-dropdown">
                @for (p of filteredPlayers; track p._id) {
                  <button class="dm-dropdown-item" (click)="addPlayer(p)">
                    <span class="dm-drop-name">{{ p.name }}</span>
                    <span class="dm-drop-email">{{ p.email }}</span>
                  </button>
                }
              </div>
            }
          </div>
          @if (addedPlayers.length > 0) {
            <div class="dm-chips">
              @for (p of addedPlayers; track p._id) {
                <span class="dm-chip">
                  {{ p.name }}
                  <button class="dm-chip-remove" (click)="removePlayer(p._id)">×</button>
                </span>
              }
            </div>
          }
        </div>

        <!-- Holiday -->
        @if (holidayRate > 0) {
          <div class="dm-section">
            <div class="dm-section-label">Holiday <span class="dm-optional">optional</span></div>
            <label class="dm-toggle-row">
              <input type="checkbox" class="dm-toggle-input" [(ngModel)]="isHoliday" />
              <span class="dm-toggle-track"><span class="dm-toggle-thumb"></span></span>
              <span class="dm-toggle-label">{{ isHoliday ? 'Yes — holiday rates apply' : 'No — regular rates apply' }}</span>
            </label>
          </div>
        }

        <!-- Ball Boy -->
        @if (ballBoyRate > 0) {
          <div class="dm-section">
            <div class="dm-section-label">Ball Boy <span class="dm-optional">optional</span></div>
            <label class="dm-toggle-row">
              <input type="checkbox" class="dm-toggle-input" [(ngModel)]="ballBoyRequested" />
              <span class="dm-toggle-track"><span class="dm-toggle-thumb"></span></span>
              <span class="dm-toggle-label">{{ ballBoyRequested ? '🎾 Requested' : 'Not requested' }}</span>
            </label>
          </div>
        }

        <!-- Coaching -->
        @if (coachingEnabled) {
          <div class="dm-section">
            <div class="dm-section-label">Coaching Session <span class="dm-optional">optional</span></div>
            <label class="dm-toggle-row">
              <input type="checkbox" class="dm-toggle-input" [(ngModel)]="coachingRequested" (ngModelChange)="onCoachingToggle()" />
              <span class="dm-toggle-track"><span class="dm-toggle-thumb"></span></span>
              <span class="dm-toggle-label">{{ coachingRequested ? '🎓 Add coaching' : 'No coaching' }}</span>
            </label>
            @if (coachingRequested) {
              <div class="dm-counter-row" style="margin-top:.5rem">
                <span class="dm-section-label" style="margin:0">Attendees</span>
                <button type="button" class="dm-counter-btn" (click)="decCoachingPax()">−</button>
                <span class="dm-counter-val">{{ coachingPax }}</span>
                <button type="button" class="dm-counter-btn" (click)="incCoachingPax()">+</button>
                @if (!loadingRates) {
                  <span class="dm-counter-fee">
                    {{ coachingTierRate | currency: 'PHP' : 'symbol' }} × {{ coachingPax }} pax × {{ selectedDuration }} hr = {{ coachingFee | currency: 'PHP' : 'symbol' }}
                  </span>
                }
              </div>
              <p class="dm-optional" style="margin:.4rem 0 0">Minimum {{ coachingMinHours }} hours per coaching session.</p>
            }
          </div>
        }

        <!-- Guests -->
        <div class="dm-section">
          <div class="dm-section-label">Guests <span class="dm-optional">non-members</span></div>
          <div class="dm-counter-row">
            <button type="button" class="dm-counter-btn" (click)="guestCount = guestCount > 0 ? guestCount - 1 : 0">−</button>
            <span class="dm-counter-val">{{ guestCount }}</span>
            <button type="button" class="dm-counter-btn" (click)="guestCount = guestCount + 1">+</button>
            @if (guestCount > 0 && !loadingRates) {
              <span class="dm-counter-fee">
                @if (totalGuestFee > 0) {
                  {{ guestFeeRate | currency: 'PHP' : 'symbol' }} × {{ chargeableGuests }} = {{ totalGuestFee | currency: 'PHP' : 'symbol' }}
                } @else {
                  Free
                }
              </span>
            }
          </div>
          @if (guestFeeRate > 0) {
            <div class="dm-guest-note">
              <span>&#9432;</span>
              @if (guestFeeThreshold > 0) {
                Your rental covers up to {{ guestFeeThreshold }} guest(s) at no extra charge.
                Additional guests are charged &#8369;{{ guestFeeRate }} each.
              } @else {
                Each non-member guest is charged &#8369;{{ guestFeeRate }}.
              }
            </div>
          }
        </div>

        <!-- Rentals -->
        @if (hasAnyRental) {
          <div class="dm-section">
            <div class="dm-section-label">Rentals <span class="dm-optional">optional</span></div>
            <div class="dm-rentals-card">

              @if (rentalBalls50Rate > 0) {
                <div class="dm-rental-row">
                  <span class="dm-rental-name">🎾 Balls (50 pcs)</span>
                  <span class="dm-rental-rate">{{ rentalBalls50Rate | currency: 'PHP' : 'symbol' }}/hr</span>
                  <div class="dm-rental-counter">
                    <button type="button" class="dm-counter-btn sm" (click)="rentalBalls50 = rentalBalls50 > 0 ? rentalBalls50 - 1 : 0">−</button>
                    <span class="dm-counter-val sm">{{ rentalBalls50 }}</span>
                    <button type="button" class="dm-counter-btn sm" (click)="rentalBalls50 = rentalBalls50 + 1">+</button>
                  </div>
                </div>
              }

              @if (rentalBalls100Rate > 0) {
                <div class="dm-rental-row">
                  <span class="dm-rental-name">🎾 Balls (100 pcs)</span>
                  <span class="dm-rental-rate">{{ rentalBalls100Rate | currency: 'PHP' : 'symbol' }}/hr</span>
                  <div class="dm-rental-counter">
                    <button type="button" class="dm-counter-btn sm" (click)="rentalBalls100 = rentalBalls100 > 0 ? rentalBalls100 - 1 : 0">−</button>
                    <span class="dm-counter-val sm">{{ rentalBalls100 }}</span>
                    <button type="button" class="dm-counter-btn sm" (click)="rentalBalls100 = rentalBalls100 + 1">+</button>
                  </div>
                </div>
              }

              @if (rentalBallMachineRate > 0) {
                <div class="dm-rental-row">
                  <span class="dm-rental-name">🤖 Ball Machine</span>
                  <span class="dm-rental-rate">{{ rentalBallMachineRate | currency: 'PHP' : 'symbol' }}/hr</span>
                  <label class="dm-toggle-row" style="margin:0">
                    <input type="checkbox" class="dm-toggle-input" [(ngModel)]="rentalBallMachine" />
                    <span class="dm-toggle-track"><span class="dm-toggle-thumb"></span></span>
                    <span class="dm-toggle-label" style="font-size:.82rem">{{ rentalBallMachine ? 'Yes' : 'No' }}</span>
                  </label>
                </div>
              }

              @if (rentalRacketRate > 0) {
                <div class="dm-rental-row">
                  <span class="dm-rental-name">🏓 Racket</span>
                  <span class="dm-rental-rate">{{ rentalRacketRate | currency: 'PHP' : 'symbol' }}/hr each</span>
                  <div class="dm-rental-counter">
                    <button type="button" class="dm-counter-btn sm" (click)="rentalRackets = rentalRackets > 0 ? rentalRackets - 1 : 0">−</button>
                    <span class="dm-counter-val sm">{{ rentalRackets }}</span>
                    <button type="button" class="dm-counter-btn sm" (click)="rentalRackets = rentalRackets + 1">+</button>
                  </div>
                </div>
              }

            </div>
          </div>
        }

        <!-- Summary -->
        @if (selectedSlot) {
          <div class="dm-summary">
            <div class="dm-summary-title"><i class="fas fa-clipboard-list"></i> Booking Summary</div>

            <div class="dm-summary-row"><span>Court</span><strong>Court {{ selectedCourt }}</strong></div>
            <div class="dm-summary-row">
              <span>Date</span>
              <strong>{{ (selectedDate + 'T00:00:00Z') | date: 'EEE, MMM d, y' : 'UTC' }}</strong>
            </div>
            <div class="dm-summary-row"><span>Time</span><strong class="dm-summary-time">{{ selectedSlot }}{{ selectedDuration > 1 ? ' – ' + endSlotLabel : '' }}</strong></div>
            <div class="dm-summary-row">
              <span>Lights</span>
              <strong>{{ lightsRequested ? 'Yes 💡' : 'No 🌙' }}</strong>
            </div>
            <div class="dm-summary-row">
              <span>Day Type</span>
              <strong>
                @if (dayType === 'holiday') { Holiday 🏖️ }
                @else if (dayType === 'weekend') { Weekend 🎉 }
                @else { Weekday 📅 }
              </strong>
            </div>
            <div class="dm-summary-row"><span>Ball Boy</span><strong>{{ ballBoyRequested ? 'Yes 🎾' : 'No' }}</strong></div>
            @if (addedPlayers.length > 0) {
              <div class="dm-summary-row">
                <span>Playing with</span>
                <strong>{{ addedPlayers.map(p => p.name).join(', ') }}</strong>
              </div>
            }

            <div class="dm-summary-divider"></div>

            <div class="dm-summary-row">
              <span>Court Fee{{ selectedDuration > 1 ? ' (' + selectedDuration + ' hrs × ' + (baseHourlyRate | currency: 'PHP' : 'symbol') + ')' : '' }}</span>
              <strong>@if (loadingRates) { — } @else { {{ baseCourtFee | currency: 'PHP' : 'symbol' }} }</strong>
            </div>
            @if (lightsRequested) {
              <div class="dm-summary-row">
                <span>💡 Lights Fee{{ lightHours > 1 ? ' × ' + lightHours + ' hrs' : '' }}</span>
                <strong>@if (loadingRates) { — } @else { {{ lightsRate * lightHours | currency: 'PHP' : 'symbol' }} }</strong>
              </div>
            }
            @if (ballBoyRequested) {
              <div class="dm-summary-row">
                <span>Ball Boy Fee{{ selectedDuration > 1 ? ' × ' + selectedDuration : '' }}</span>
                <strong>@if (loadingRates) { — } @else { {{ ballBoyRate * selectedDuration | currency: 'PHP' : 'symbol' }} }</strong>
              </div>
            }
            @if (totalRentalFee > 0) {
              <div class="dm-summary-row">
                <span>Rentals</span>
                <strong>@if (loadingRates) { — } @else { {{ totalRentalFee | currency: 'PHP' : 'symbol' }} }</strong>
              </div>
            }
            @if (guestCount > 0) {
              <div class="dm-summary-row">
                <span>Guests
                  <span class="dm-summary-sub">
                    @if (chargeableGuests > 0) { ({{ chargeableGuests }} × {{ guestFeeRate | currency: 'PHP' : 'symbol' }}) }
                    @else { ({{ guestCount }} free) }
                  </span>
                </span>
                <strong>@if (loadingRates) { — } @else { {{ totalGuestFee | currency: 'PHP' : 'symbol' }} }</strong>
              </div>
            }

            @if (convenienceFeeMode !== 'monthly_flat' && convenienceFeeMode !== 'club_absorbs') {
              <div class="dm-summary-row">
                <span>Convenience Fee <span class="dm-summary-sub">({{ (convenienceFeeRate * 100) | number: '1.0-2' }}%)</span></span>
                <strong>@if (loadingRates) { — } @else { {{ convenienceFee | currency: 'PHP' : 'symbol' }} }</strong>
              </div>
            }

            <!-- Additional fees -->
            @if (availableExtraFees.length > 0) {
              <div class="dm-summary-divider"></div>
              <div class="dm-summary-row dm-summary-addons-title">
                <span>Add-ons</span>
              </div>
              @for (fee of availableExtraFees; track fee.name) {
                <div class="dm-summary-row dm-summary-addon-row">
                  @if (fee.isOptional) {
                    <label class="dm-addon-label">
                      <input type="checkbox" [checked]="isExtraFeeSelected(fee)" (change)="toggleExtraFee(fee)" />
                      <span>{{ fee.name }}</span>
                      @if (fee.type === 'per_person' && guestCount > 0) {
                        <span class="dm-summary-sub">(× {{ guestCount }})</span>
                      }
                    </label>
                  } @else {
                    <span class="dm-addon-required">
                      {{ fee.name }}
                      @if (fee.type === 'per_person' && guestCount > 0) {
                        <span class="dm-summary-sub">(× {{ guestCount }})</span>
                      }
                      <span class="dm-addon-req-badge">required</span>
                    </span>
                  }
                  <strong>
                    {{ (fee.type === 'per_person' ? fee.amount * guestCount : fee.amount) | currency:'PHP':'symbol' }}
                  </strong>
                </div>
              }
            }

            @if (coachingRequested && coachingFee > 0) {
              <div class="dm-summary-row">
                <span>Coaching <span class="dm-summary-sub">({{ coachingTierRate | currency: 'PHP' : 'symbol' }} × {{ coachingPax }} pax × {{ selectedDuration }} hr)</span></span>
                <strong>@if (loadingRates) { — } @else { {{ coachingFee | currency: 'PHP' : 'symbol' }} }</strong>
              </div>
            }

            <div class="dm-summary-divider"></div>

            <div class="dm-summary-row dm-summary-total">
              <span>Total</span>
              <strong class="dm-total-amount">
                @if (loadingRates) { — } @else { {{ computedFee | currency: 'PHP' : 'symbol' }} }
              </strong>
            </div>

          </div>

          <button class="dm-confirm-btn" [disabled]="booking" (click)="confirm()">
            @if (booking) { <i class="fas fa-circle-notch fa-spin"></i> Booking… }
            @else { <i class="fas fa-calendar-check"></i> Confirm Reservation }
          </button>
        }

        <div class="dm-bottom-spacer"></div>
      </div>

      <!-- Bottom Nav -->
      <nav class="dm-bottom-nav">
        <button class="dm-nav-item" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-home"></i><span>Home</span>
        </button>
        <button class="dm-nav-item dm-nav-active" (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i><span>Courts</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reservations')">
          <i class="far fa-calendar-check"></i><span>Bookings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/tournaments')">
          <i class="fas fa-medal"></i><span>Rankings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/profile/edit')">
          <i class="far fa-user"></i><span>Profile</span>
        </button>
      </nav>
    </div>
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

    .dm-shell {
      background: #0c1a11;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      max-width: 480px;
      margin: 0 auto;
      position: relative;
    }
    @media (min-width: 769px) {
      .dm-shell {
        max-width: 640px;
        height: auto;
        min-height: calc(100vh - 60px);
      }
    }

    /* Header */
    .dm-header {
      background: #111f16;
      padding: 1rem 1rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    @media (min-width: 769px) { .dm-header { display: none; } }

    .dm-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.7);
      width: 34px; height: 34px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }

    .dm-header-title {
      flex: 1;
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }

    /* Body */
    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.1rem 1rem 0;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 769px) {
      .dm-body {
        overflow-y: visible;
        padding: 2rem 2.5rem 2rem;
      }
    }

    /* Alerts */
    .dm-alert {
      padding: 0.85rem 1rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .dm-alert i { margin-top: 1px; flex-shrink: 0; }
    .dm-alert-success {
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.25);
      color: #a3e635;
    }
    .dm-alert-error {
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.25);
      color: #ef4444;
    }
    .dm-field-error {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.78rem; color: #f87171; margin-top: 6px;
      animation: fadeIn 0.15s ease;
    }
    .dm-field-error i { font-size: 0.72rem; flex-shrink: 0; }
    .dm-field-error-slot { margin-top: 4px; }
    .dm-input-error { border-color: rgba(239,68,68,0.5) !important; }
    .dm-court-toggle-error { outline: 1px solid rgba(239,68,68,0.4); border-radius: 8px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

    .dm-payment-notice {
      display: flex;
      gap: 0.75rem;
      background: rgba(163,230,53,0.08);
      border: 1px solid rgba(163,230,53,0.25);
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .dm-payment-notice i { color: #a3e635; font-size: 1.1rem; margin-top: 2px; flex-shrink: 0; }
    .dm-payment-notice strong { font-size: 0.88rem; color: #a3e635; display: block; margin-bottom: 0.3rem; }
    .dm-payment-notice p { font-size: 0.8rem; color: rgba(255,255,255,0.55); margin: 0; line-height: 1.5; }
    .dm-payment-account { color: #ffffff !important; font-size: 0.92rem !important; font-weight: 600; margin-bottom: 0.4rem !important; }
    .dm-payment-method-logo { width: 32px; height: 32px; object-fit: contain; border-radius: 6px; flex-shrink: 0; margin-top: 2px; }
    .dm-qr-code { display: block; width: 160px; height: 160px; object-fit: contain; border-radius: 10px; background: #fff; padding: 6px; margin: 0.6rem 0; }

    /* Sections */
    .dm-section { margin-bottom: 1.1rem; }

    .dm-section-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: rgba(255,255,255,0.40);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dm-optional {
      font-size: 0.65rem;
      font-weight: 500;
      color: rgba(255,255,255,0.28);
      text-transform: none;
      letter-spacing: 0;
    }

    .dm-lights-legend {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.68rem;
      font-weight: 500;
      color: rgba(255,255,255,0.40);
      text-transform: none;
      letter-spacing: 0;
      margin-left: auto;
    }

    .dm-lights-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      flex-shrink: 0;
    }

    /* Input */
    .dm-input {
      width: 100%;
      box-sizing: border-box;
      background: #1b3028;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 0.7rem 0.9rem;
      color: #ffffff;
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .dm-input:focus { border-color: rgba(163,230,53,0.4); }
    .dm-input::placeholder { color: rgba(255,255,255,0.25); }

    /* Date input calendar icon color */
    .dm-input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(0.7);
      cursor: pointer;
    }

    /* Court toggle */
    .dm-court-toggle { display: flex; gap: 0.6rem; }

    .dm-court-btn {
      flex: 1;
      padding: 0.65rem;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      background: #1b3028;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      color: rgba(255,255,255,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      font-family: inherit;
    }
    .dm-court-btn.active {
      border-color: #a3e635;
      background: rgba(163,230,53,0.12);
      color: #a3e635;
    }
    .dm-court-btn:hover:not(.active) {
      border-color: rgba(163,230,53,0.3);
      color: rgba(255,255,255,0.8);
    }

    /* Slot grid */
    .dm-slot-loading {
      color: rgba(255,255,255,0.45);
      font-size: 0.85rem;
      padding: 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dm-slot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
      gap: 0.45rem;
    }

    .dm-slot-btn {
      position: relative;
      padding: 0.55rem 0.35rem;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      background: #1b3028;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      color: rgba(255,255,255,0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
      font-family: inherit;
    }
    .dm-slot-btn.has-lights { border-color: rgba(245,158,11,0.35); background: rgba(245,158,11,0.07); }
    .dm-slot-btn.selected { border-color: #a3e635; background: rgba(163,230,53,0.15); color: #a3e635; }
    .dm-slot-btn.booked {
      background: rgba(255,255,255,0.03);
      color: rgba(255,255,255,0.2);
      cursor: not-allowed;
      border-color: rgba(255,255,255,0.05);
      text-decoration: line-through;
    }
    .dm-slot-btn.in-range { border-color: rgba(163,230,53,0.4); background: rgba(163,230,53,0.08); color: rgba(163,230,53,0.6); cursor: not-allowed; }
    .dm-slot-btn.coaching-blocked { opacity: 0.35; cursor: not-allowed; border-color: rgba(255,255,255,0.05); }
    .dm-slot-btn:hover:not(.booked):not(.selected):not(.in-range):not(.coaching-blocked) { border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.07); }

    .dm-duration-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .dm-duration-btn {
      padding: 0.45rem 1rem; border-radius: 8px; border: 1.5px solid rgba(255,255,255,0.15);
      background: #1b3028; color: rgba(255,255,255,0.6); font-size: 0.85rem; font-weight: 600;
      cursor: pointer; transition: all 0.15s; font-family: inherit;
    }
    .dm-duration-btn:hover { border-color: rgba(163,230,53,0.4); color: rgba(163,230,53,0.9); }
    .dm-duration-btn.active { border-color: #a3e635; background: rgba(163,230,53,0.15); color: #a3e635; }
    .dm-light-dot { font-size: 0.7rem; }

    /* Player search */
    .dm-search-wrap { position: relative; }

    .dm-search-icon {
      position: absolute;
      left: 0.85rem;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(255,255,255,0.35);
      font-size: 0.8rem;
      pointer-events: none;
    }

    .dm-search-input { padding-left: 2.2rem !important; }

    .dm-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      z-index: 100;
      background: #1b3028;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      max-height: 200px;
      overflow-y: auto;
    }

    .dm-dropdown-item {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 0.6rem 0.9rem;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: background 0.15s;
      text-align: left;
      font-family: inherit;
    }
    .dm-dropdown-item:hover { background: rgba(163,230,53,0.08); }

    .dm-drop-name { font-weight: 700; color: #ffffff; font-size: 0.85rem; }
    .dm-drop-email { color: rgba(255,255,255,0.42); font-size: 0.72rem; }

    .dm-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }

    .dm-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      background: rgba(163,230,53,0.15);
      color: #a3e635;
      border: 1px solid rgba(163,230,53,0.3);
      border-radius: 20px;
      padding: 0.3rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .dm-chip-remove {
      background: none;
      border: none;
      color: #a3e635;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0;
      font-weight: 700;
      opacity: 0.65;
      transition: opacity 0.15s;
      font-family: inherit;
    }
    .dm-chip-remove:hover { opacity: 1; }

    /* Toggle */
    .dm-toggle-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      user-select: none;
    }

    .dm-toggle-input { display: none; }

    .dm-toggle-track {
      position: relative;
      width: 42px; height: 22px;
      border-radius: 11px;
      background: rgba(255,255,255,0.15);
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .dm-toggle-input:checked + .dm-toggle-track { background: #a3e635; }

    .dm-toggle-thumb {
      position: absolute;
      top: 3px; left: 3px;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      transition: left 0.2s;
    }
    .dm-toggle-input:checked + .dm-toggle-track .dm-toggle-thumb { left: 23px; }

    .dm-toggle-label {
      font-size: 0.88rem;
      color: rgba(255,255,255,0.75);
      font-weight: 600;
    }

    /* Counter */
    .dm-counter-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .dm-counter-btn {
      width: 34px; height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(163,230,53,0.35);
      background: transparent;
      color: #a3e635;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      line-height: 1;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    }
    .dm-counter-btn:hover { background: rgba(163,230,53,0.12); }
    .dm-counter-btn.sm { width: 26px; height: 26px; font-size: 0.9rem; border-radius: 6px; }

    .dm-counter-val {
      min-width: 28px;
      text-align: center;
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff;
    }
    .dm-counter-val.sm { min-width: 22px; font-size: 0.9rem; }

    .dm-counter-fee { font-size: 0.8rem; color: #a3e635; font-weight: 600; }

    .dm-guest-note {
      display: flex; align-items: flex-start; gap: 0.45rem;
      background: rgba(163,230,53,0.05); border: 1px solid rgba(163,230,53,0.15);
      border-radius: 8px; padding: 0.6rem 0.75rem; margin-top: 0.5rem;
      font-size: 0.78rem; color: rgba(255,255,255,0.55); line-height: 1.5;
    }
    .dm-guest-note span:first-child { color: #a3e635; font-size: 0.85rem; flex-shrink: 0; margin-top: 0.05rem; }

    /* Rentals card */
    .dm-rentals-card {
      background: #1b3028;
      border-radius: 12px;
      overflow: hidden;
    }

    .dm-rental-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.75rem 0.9rem;
    }

    .dm-rental-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.06); }

    .dm-rental-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.75); }
    .dm-rental-rate { font-size: 0.72rem; color: #a3e635; font-weight: 600; white-space: nowrap; }
    .dm-rental-counter { display: flex; align-items: center; gap: 0.35rem; }

    /* Summary */
    .dm-summary {
      background: #1b3028;
      border-radius: 14px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .dm-summary-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: rgba(255,255,255,0.40);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .dm-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.55);
      padding: 0.3rem 0;
    }

    .dm-summary-row strong { color: #ffffff; }

    .dm-summary-time { color: #a3e635; }

    .dm-summary-sub { font-size: 0.72rem; font-weight: 400; color: rgba(255,255,255,0.35); }

    .dm-summary-divider {
      height: 1px;
      background: rgba(255,255,255,0.08);
      margin: 0.4rem 0;
    }

    .dm-summary-total {
      font-weight: 700;
      font-size: 0.9rem;
    }

    .dm-total-amount {
      font-size: 1.1rem;
      color: #a3e635 !important;
    }

    .dm-summary-addons-title span { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.4); }
    .dm-summary-addon-row { align-items: center; }
    .dm-addon-label { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.88rem; }
    .dm-addon-label input[type=checkbox] { accent-color: #a3e635; }
    .dm-addon-required { display: flex; align-items: center; gap: 0.4rem; font-size: 0.88rem; }
    .dm-addon-req-badge { font-size: 0.65rem; background: rgba(163,230,53,0.12); color: #a3e635; border-radius: 4px; padding: 1px 5px; font-weight: 700; }

    /* Confirm button */
    .dm-confirm-btn {
      width: 100%;
      padding: 0.9rem;
      background: #a3e635;
      color: #0a1f00;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 800;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      font-family: inherit;
    }
    .dm-confirm-btn:hover:not(:disabled) { background: #b8f040; }
    .dm-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .dm-bottom-spacer { height: 80px; }
    @media (min-width: 769px) { .dm-bottom-spacer { display: none; } }

    /* Bottom nav */
    .dm-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: #111f16;
      border-top: 1px solid rgba(255,255,255,0.08);
      height: 62px;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: space-around;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }
    @media (min-width: 769px) { .dm-bottom-nav { display: none; } }

    .dm-nav-item {
      background: none;
      border: none;
      color: rgba(255,255,255,0.35);
      font-size: 0.6rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.4rem 0.75rem;
      transition: color 0.2s;
      font-family: inherit;
    }
    .dm-nav-item i { font-size: 1.1rem; }
    .dm-nav-item.dm-nav-active { color: #a3e635; }
  `],
})
export class ReserveCourtComponent implements OnInit, OnDestroy {
  @ViewChild('searchWrap') searchWrapRef!: ElementRef<HTMLElement>;

  allSlots = hoursToSlots(5, 22);
  lightSlots = LIGHT_SLOTS;

  courtCount = 2;
  selectedDate = '';
  selectedCourt: number | null = null;
  selectedSlot = '';
  selectedDuration = 1;
  availableDurations: number[] = [];
  closingHour = 22;
  bookedSlots = new Set<string>();
  loadingSlots = false;
  booking = false;
  successMsg = '';
  errorMsg = '';
  submitted = false;
  today = new Date().toISOString().split('T')[0];
  showPaymentInfo = false;
  paymentMethods: string[] = [];
  paymentAccounts: Record<string, string> = {};
  paymentQrCodes: Record<string, string> = {};

  allActivePlayers: ActivePlayer[] = [];
  filteredPlayers: ActivePlayer[] = [];
  addedPlayers: ActivePlayer[] = [];
  playerSearch = '';
  showDropdown = false;

  convenienceFeeRate = 0.10;
  convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat' | 'club_absorbs' = 'per_hour';
  availableExtraFees: AdditionalFee[] = [];
  selectedExtraFeeNames = new Set<string>();
  weekdayRate = 0;
  weekendRate = 0;
  holidayRate = 0;
  lightsRate = 0;
  ballBoyRate = 0;
  guestFeeRate = 0;
  guestFeeThreshold = 0;
  rentalBalls50Rate = 0;
  rentalBalls100Rate = 0;
  rentalBallMachineRate = 0;
  rentalRacketRate = 0;
  rentalBalls50 = 0;
  rentalBalls100 = 0;
  rentalBallMachine = false;
  rentalRackets = 0;

  ballBoyRequested = false;
  isHoliday = false;
  guestCount = 0;
  coachingEnabled = false;
  coachingMinHours = 2;
  coachingMaxPax = 6;
  coachingRate1Pax = 0;
  coachingRate2Pax = 0;
  coachingRate3to6Pax = 0;
  coachingRequested = false;
  coachingPax = 1;
  loadingRates = true;

  private readonly WEEKEND_DAYS = new Set([0, 5, 6]);

  get courtNumbers(): number[] { return Array.from({ length: this.courtCount }, (_, i) => i + 1); }

  get hasLights(): boolean { return LIGHT_SLOTS.has(this.selectedSlot); }

  get lightHours(): number {
    if (!this.selectedSlot) return 0;
    const startHour = slotToHour(this.selectedSlot);
    const endHour = startHour + this.selectedDuration;
    let count = 0;
    for (let h = startHour; h < endHour; h++) {
      if (this.lightSlots.has(hourToSlot(h))) count++;
    }
    return count;
  }

  get lightsRequested(): boolean { return this.lightHours > 0; }

  get hasAnyRental(): boolean {
    return this.rentalBalls50Rate > 0 || this.rentalBalls100Rate > 0
      || this.rentalBallMachineRate > 0 || this.rentalRacketRate > 0;
  }

  get dayType(): 'weekday' | 'weekend' | 'holiday' {
    if (this.isHoliday) return 'holiday';
    if (!this.selectedDate) return 'weekday';
    const day = new Date(this.selectedDate + 'T00:00:00Z').getUTCDay();
    return this.WEEKEND_DAYS.has(day) ? 'weekend' : 'weekday';
  }

  get baseHourlyRate(): number {
    if (!this.selectedSlot) return 0;
    switch (this.dayType) {
      case 'holiday': return this.holidayRate;
      case 'weekend': return this.weekendRate;
      default:        return this.weekdayRate;
    }
  }

  get baseCourtFee(): number {
    return this.baseHourlyRate * this.selectedDuration;
  }

  get lightsFee(): number { return this.lightHours * this.lightsRate; }

  get chargeableGuests(): number { return Math.max(0, this.guestCount - this.guestFeeThreshold); }
  get totalGuestFee(): number { return this.chargeableGuests * this.guestFeeRate; }

  get totalRentalFee(): number {
    return (
      this.rentalBalls50 * this.rentalBalls50Rate +
      this.rentalBalls100 * this.rentalBalls100Rate +
      (this.rentalBallMachine ? this.rentalBallMachineRate : 0) +
      this.rentalRackets * this.rentalRacketRate
    ) * this.selectedDuration;
  }

  get subtotal(): number {
    return this.baseCourtFee + this.lightsFee + (this.ballBoyRequested ? this.ballBoyRate * this.selectedDuration : 0) + this.totalGuestFee + this.totalRentalFee;
  }

  get convenienceFee(): number {
    if (this.convenienceFeeMode === 'monthly_flat' || this.convenienceFeeMode === 'club_absorbs') return 0;
    const base = this.convenienceFeeMode === 'per_transaction' ? this.baseHourlyRate : this.subtotal;
    return parseFloat((base * this.convenienceFeeRate).toFixed(2));
  }

  get extraFeeTotal(): number {
    return this.availableExtraFees
      .filter(f => this.selectedExtraFeeNames.has(f.name))
      .reduce((sum, f) => sum + (f.type === 'per_person' ? f.amount * this.guestCount : f.amount), 0);
  }

  get coachingTierRate(): number {
    const pax = Math.min(this.coachingMaxPax, Math.max(1, this.coachingPax));
    if (pax <= 1) return this.coachingRate1Pax;
    if (pax === 2) return this.coachingRate2Pax;
    return this.coachingRate3to6Pax;
  }

  get coachingFee(): number {
    if (!this.coachingRequested) return 0;
    const pax = Math.min(this.coachingMaxPax, Math.max(1, this.coachingPax));
    return this.coachingTierRate * pax * this.selectedDuration;
  }

  onCoachingToggle() {
    if (this.coachingRequested) {
      if (this.selectedDuration < this.coachingMinHours) {
        this.selectedDuration = this.coachingMinHours;
      }
      if (this.selectedSlot && this.isCoachingBlocked(this.selectedSlot)) {
        this.selectedSlot = '';
        this.availableDurations = [];
        this.selectedDuration = this.coachingMinHours;
      }
    }
    this.cdr.detectChanges();
  }

  incCoachingPax() { if (this.coachingPax < this.coachingMaxPax) this.coachingPax++; }
  decCoachingPax() { if (this.coachingPax > 1) this.coachingPax--; }

  get computedFee(): number {
    return this.subtotal + this.convenienceFee + this.extraFeeTotal + this.coachingFee;
  }

  toggleExtraFee(fee: AdditionalFee) {
    if (!fee.isOptional) return;
    const next = new Set(this.selectedExtraFeeNames);
    if (next.has(fee.name)) { next.delete(fee.name); } else { next.add(fee.name); }
    this.selectedExtraFeeNames = next;
  }

  isExtraFeeSelected(fee: AdditionalFee): boolean {
    return this.selectedExtraFeeNames.has(fee.name);
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
        this.guestFeeThreshold = rates.reservationGuestFeeThreshold ?? 0;
        this.rentalBalls50Rate = rates.rentalBalls50Rate ?? 0;
        this.rentalBalls100Rate = rates.rentalBalls100Rate ?? 0;
        this.rentalBallMachineRate = rates.rentalBallMachineRate ?? 0;
        this.rentalRacketRate = rates.rentalRacketRate ?? 0;
        this.coachingEnabled = rates.coachingEnabled ?? false;
        this.coachingMinHours = rates.coachingMinHours ?? 2;
        this.coachingMaxPax = rates.coachingMaxPax ?? 6;
        this.coachingRate1Pax = rates.coachingRate1Pax ?? 0;
        this.coachingRate2Pax = rates.coachingRate2Pax ?? 0;
        this.coachingRate3to6Pax = rates.coachingRate3to6Pax ?? 0;
        this.loadingRates = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingRates = false; this.cdr.detectChanges(); },
    });

    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (club) => {
          this.courtCount = club.courtCount ?? 2;
          this.closingHour = club.closingHour ?? 22;
          this.allSlots = hoursToSlots(club.openingHour ?? 5, this.closingHour);
          this.paymentMethods = club.paymentMethods ?? [];
          this.paymentAccounts = club.paymentAccounts ?? {};
          this.paymentQrCodes = club.paymentQrCodes ?? {};
          this.convenienceFeeRate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.10;
          this.convenienceFeeMode = club.convenienceFeeMode ?? 'per_hour';
          this.availableExtraFees = (club.additionalFees ?? []).filter(f => f.isEnabled);
          this.selectedExtraFeeNames = new Set(
            this.availableExtraFees.filter(f => !f.isOptional).map(f => f.name)
          );
          this.cdr.detectChanges();
        },
      });
    }

    document.addEventListener('click', this.onDocClick);
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
    document.removeEventListener('click', this.onDocClick);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  private onDocClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.dm-search-wrap')) {
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

  selectCourt(court: number) {
    this.selectedCourt = court;
    this.selectedSlot = '';
    this.onDateOrCourtChange();
  }

  onDateOrCourtChange() {
    this.selectedSlot = '';
    this.selectedDuration = 1;
    this.availableDurations = [];
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
    if (this.bookedSlots.has(slot) || this.isInRange(slot)) return;
    this.selectedSlot = slot;
    this.selectedDuration = this.coachingRequested ? this.coachingMinHours : 1;
    this.computeAvailableDurations();
    this.successMsg = '';
    this.errorMsg = '';
    this.showPaymentInfo = false;
  }

  computeAvailableDurations() {
    if (!this.selectedSlot) { this.availableDurations = []; return; }
    const startH = slotToHour(this.selectedSlot);
    const durations: number[] = [];
    for (let d = 1; d <= 12; d++) {
      const endH = startH + d - 1;
      if (endH > this.closingHour) break;
      if (d > 1 && this.bookedSlots.has(hourToSlot(endH))) break;
      durations.push(d);
    }
    this.availableDurations = durations;
  }

  setDuration(d: number) {
    if (this.coachingRequested && d < this.coachingMinHours) return;
    this.selectedDuration = d;
    this.cdr.detectChanges();
  }

  isInRange(slot: string): boolean {
    if (!this.selectedSlot || this.selectedDuration <= 1) return false;
    const startH = slotToHour(this.selectedSlot);
    const h = slotToHour(slot);
    return h > startH && h < startH + this.selectedDuration;
  }

  isCoachingBlocked(slot: string): boolean {
    if (!this.coachingRequested || this.coachingMinHours <= 1) return false;
    const startH = slotToHour(slot);
    for (let i = 0; i < this.coachingMinHours; i++) {
      const h = startH + i;
      if (h > this.closingHour) return true;
      if (this.bookedSlots.has(hourToSlot(h))) return true;
    }
    return false;
  }

  get endSlotLabel(): string {
    if (!this.selectedSlot) return '';
    return hourToSlot(slotToHour(this.selectedSlot) + this.selectedDuration);
  }

  confirm() {
    this.submitted = true;
    this.cdr.detectChanges();
    if (!this.selectedDate || !this.selectedCourt || !this.selectedSlot) return;
    this.submitted = false;
    this.booking = true;
    this.errorMsg = '';
    this.successMsg = '';
    this.reservationService.create({
      court: this.selectedCourt,
      date: this.selectedDate,
      timeSlot: this.selectedSlot,
      durationHours: this.selectedDuration,
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
      selectedExtraFeeNames: [...this.selectedExtraFeeNames],
      coachingRequested: this.coachingRequested,
      coachingPax: this.coachingPax,
    }).subscribe({
      next: () => {
        this.booking = false;
        const withStr = this.addedPlayers.length
          ? ` with ${this.addedPlayers.map((p) => p.name).join(', ')}`
          : '';
        const timeStr = this.selectedDuration > 1 ? `${this.selectedSlot} – ${this.endSlotLabel}` : this.selectedSlot;
        this.successMsg = `Court ${this.selectedCourt} reserved for ${timeStr}${withStr}!`;
        this.showPaymentInfo = this.paymentMethods.length > 0;
        this.sound.success();
        const newBooked = new Set(this.bookedSlots);
        for (let i = 0; i < this.selectedDuration; i++) {
          newBooked.add(hourToSlot(slotToHour(this.selectedSlot) + i));
        }
        this.bookedSlots = newBooked;
        this.selectedSlot = '';
        this.selectedDuration = 1;
        this.availableDurations = [];
        this.addedPlayers = [];
        this.ballBoyRequested = false;
        this.isHoliday = false;
        this.guestCount = 0;
        this.rentalBalls50 = 0;
        this.rentalBalls100 = 0;
        this.rentalBallMachine = false;
        this.rentalRackets = 0;
        this.selectedExtraFeeNames = new Set(
          this.availableExtraFees.filter(f => !f.isOptional).map(f => f.name)
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.booking = false;
        this.sound.error();
        this.errorMsg = err?.error?.error || 'Failed to book. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
