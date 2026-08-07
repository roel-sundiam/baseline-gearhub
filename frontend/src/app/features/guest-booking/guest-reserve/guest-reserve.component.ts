import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PublicBookingService, PublicRates, GuestBookingResult } from '../../../core/services/public-booking.service';
import { AdditionalFee } from '../../../core/services/club.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { marked } from 'marked';

const LIGHT_SLOTS = new Set(['5am','6pm','7pm','8pm','9pm','10pm','11pm','12am']);
const WEEKEND_DAYS = new Set([0, 5, 6]);

function slotToHour(slot: string): number {
  const m = slot.match(/^(\d+)(am|pm)$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  return m[2] === 'am' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}
function hourToSlot(h: number): string {
  const h24 = h % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${h24 < 12 ? 'am' : 'pm'}`;
}
function hoursToSlots(openingHour: number, closingHour: number): string[] {
  const slots: string[] = [];
  for (let h = openingHour; h <= closingHour; h++) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${h12}${h < 12 ? 'am' : 'pm'}`);
  }
  return slots;
}
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().split('T')[0];
}
function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

@Component({
  selector: 'app-guest-reserve',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe, DatePipe],
  template: `
    <div class="gr-shell">

      <!-- ── Header ── -->
      <header class="gr-header">
        <div class="gr-header-inner">
          <button class="gr-back-btn" (click)="goBack()">&#8592; Back</button>
          <div class="gr-header-brand">
            @if (clubLogo) {
              <img class="gr-club-logo" [src]="clubLogo" [alt]="clubName" />
            } @else {
              <img class="gr-cg-icon" src="/CG.png" alt="CourtGo" />
            }
            <div>
              <div class="gr-club-name">{{ clubName || 'Loading…' }}</div>
              @if (clubLocation) {
                <div class="gr-club-loc">&#128205; {{ clubLocation }}</div>
              }
            </div>
          </div>
          <div class="gr-header-actions">
            <button class="gr-action-btn" (click)="shareBooking()">&#8599; Share</button>
          </div>
        </div>
      </header>

      <div class="gr-body">

        @if (clubError) {
          <div class="gr-error-card">&#9888; {{ clubError }}</div>
        }

        @else if (confirmed) {
          <!-- ── Confirmation ── -->
          <div class="gr-confirm-wrap">
            <div class="gr-confirm-card">
              <div class="gr-confirm-icon">&#10003;</div>
              <h2 class="gr-confirm-title">Booking Received!</h2>
              <p class="gr-confirm-sub">Your slot is reserved and awaiting payment confirmation.</p>
              <div class="gr-confirm-rows">
                <div class="gr-confirm-row"><span>Reference</span><strong class="gr-ref">{{ confirmationData!.reservation._id }}</strong></div>
                <div class="gr-confirm-row"><span>Court</span><strong>Court {{ confirmationData!.reservation.court }}</strong></div>
                <div class="gr-confirm-row"><span>Date</span><strong>{{ confirmationData!.reservation.date | date: 'EEE, MMM d, y' : 'UTC' }}</strong></div>
                <div class="gr-confirm-row"><span>Time</span><strong class="gr-green">{{ confirmTimeLabel }}</strong></div>
                <div class="gr-confirm-row"><span>Total Fee</span><strong class="gr-green">{{ confirmationData!.charge.amount | currency: 'PHP' : 'symbol' }}</strong></div>
              </div>
              @if (paymentMethods.length > 0) {
                <div class="gr-payment-list">
                  <p class="gr-payment-label">Payment Options</p>
                  @for (method of paymentMethods; track method) {
                    <div class="gr-payment-notice">
                      @if (method === 'GoTyme') {
                        <img src="/goTyme.jpg" alt="GoTyme" class="gr-pay-logo" />
                      } @else {
                        <span class="gr-pay-icon">&#128179;</span>
                      }
                      <div>
                        <strong>Pay via {{ method }}</strong>
                        @if (paymentQrCodes[method]) {
                          <img [src]="paymentQrCodes[method]" alt="QR" class="gr-qr" />
                        }
                        @if (paymentAccounts[method]) {
                          <p class="gr-pay-account">{{ paymentAccounts[method] }}</p>
                        }
                        <p>Send the exact amount and keep your reference number.</p>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="gr-payment-notice">
                  <span class="gr-pay-icon">&#8505;</span>
                  <div>
                    <strong>Next step: Pay the court fee</strong>
                    <p>Settle the fee with the club admin. Keep your reference number for follow-up.</p>
                  </div>
                </div>
              }
              <button class="gr-new-btn" (click)="resetBooking()">Make Another Booking</button>
            </div>
          </div>
        }

        @else {
          <!-- ── Main layout ── -->
          <div class="gr-layout">

            <!-- LEFT: form sections -->
            <div class="gr-left">

              <!-- Date -->
              <div class="gr-form-section">
                <div class="gr-form-label">Date</div>
                <input
                  type="date"
                  class="gr-date-input"
                  [value]="navDate()"
                  [min]="today"
                  (change)="onDateInputChange($event)"
                />
              </div>

              <!-- Court -->
              <div class="gr-form-section">
                <div class="gr-form-label">Court</div>
                <div class="gr-court-toggle">
                  @for (n of courtNumbers(); track n) {
                    <button
                      type="button"
                      class="gr-court-btn"
                      [class.active]="selectedCourt === n"
                      (click)="selectCourtLeft(n)"
                    >
                      &#127955; Court {{ n }}
                    </button>
                  }
                </div>
              </div>

              <!-- Time Slot -->
              @if (selectedCourt) {
                <div class="gr-form-section">
                  <div class="gr-form-label">
                    Time Slot
                    <span class="gr-lights-legend"><span class="gr-lights-dot"></span> with lights</span>
                  </div>
                  @if (availLoading()) {
                    <div class="gr-slot-loading">
                      <div class="gr-spinner"></div> Checking availability…
                    </div>
                  } @else {
                    <div class="gr-slot-grid">
                      @for (slot of allSlots; track slot) {
                        <button
                          type="button"
                          class="gr-slot-btn"
                          [class.selected]="cellState(selectedCourt, slot) === 'selected'"
                          [class.booked]="cellState(selectedCourt, slot) === 'booked'"
                          [class.in-range]="cellState(selectedCourt, slot) === 'in-range'"
                          [class.has-lights]="lightSlots.has(slot)"
                          [class.coaching-blocked]="coachingRequested && isCoachingBlocked(selectedCourt!, slot)"
                          [disabled]="cellState(selectedCourt, slot) === 'booked' || cellState(selectedCourt, slot) === 'in-range' || (coachingRequested && isCoachingBlocked(selectedCourt!, slot))"
                          (click)="onCellClick(selectedCourt, slot)"
                        >
                          {{ slot }}
                          @if (lightSlots.has(slot)) { <span class="gr-slot-light">&#128161;</span> }
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Duration -->
              @if (selectedSlot && availableDurations.length > 1) {
                <div class="gr-form-section">
                  <div class="gr-form-label">Duration</div>
                  <div class="gr-dur-row">
                    @for (d of availableDurations; track d) {
                      <button
                        type="button"
                        class="gr-dur-btn"
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

            </div><!-- /gr-left -->

            <!-- RIGHT sidebar -->
            <div class="gr-sidebar">

              @if (selectedSlot && selectedCourt) {
                <!-- ── Booking form panel ── -->
                <div class="gr-booking-panel">
                  <div class="gr-panel-header">
                    <div class="gr-panel-title">Booking &amp; payment</div>
                    <button class="gr-panel-clear" (click)="clearSelection()" title="Clear selection">&#10005;</button>
                  </div>

                  <div class="gr-panel-body">

                    <!-- Rate info -->
                    <div class="gr-rate-info">
                      @if (weekdayRate > 0) {
                        <div>Weekday: <strong>{{ weekdayRate | currency: 'PHP' : 'symbol' }}/hr</strong></div>
                      }
                      @if (weekendRate > 0) {
                        <div>Weekend: <strong>{{ weekendRate | currency: 'PHP' : 'symbol' }}/hr</strong></div>
                      }
                      @if (holidayRate > 0) {
                        <div>Holiday: <strong>{{ holidayRate | currency: 'PHP' : 'symbol' }}/hr</strong></div>
                      }
                    </div>

                    <!-- Selected slot summary -->
                    <div class="gr-slot-summary">
                      <span class="gr-slot-badge">Court {{ selectedCourt }}</span>
                      <span class="gr-slot-badge gr-slot-badge-time">
                        {{ selectedSlot }}{{ selectedDuration >= 1 ? ' – ' + endSlotLabel : '' }}
                      </span>
                      <span class="gr-slot-badge gr-slot-badge-date">{{ navDate() | date: 'MMM d' }}</span>
                    </div>

                    <!-- Toggles -->
                    <div class="gr-toggles-col">
                      @if (holidayRate > 0) {
                        <label class="gr-sw-row">
                          <span class="gr-sw-label">&#127958; Holiday rate</span>
                          <span class="gr-sw-meta">{{ holidayRate | currency:'PHP':'symbol' }}/hr</span>
                          <span class="gr-sw-track" [class.on]="isHoliday">
                            <input type="checkbox" [(ngModel)]="isHoliday" class="gr-sw-input" />
                            <span class="gr-sw-thumb"></span>
                          </span>
                        </label>
                      }
                      @if (ballBoyRate > 0) {
                        <label class="gr-sw-row">
                          <span class="gr-sw-label">&#127934; Ball Boy</span>
                          <span class="gr-sw-meta">+₱{{ ballBoyRate }}/hr</span>
                          <span class="gr-sw-track" [class.on]="ballBoyRequested">
                            <input type="checkbox" [(ngModel)]="ballBoyRequested" class="gr-sw-input" />
                            <span class="gr-sw-thumb"></span>
                          </span>
                        </label>
                      }
                    </div>

                    <!-- Booking type selector -->
                    @if (exclusiveEventEnabled) {
                      <div class="gr-type-grid">
                        <button type="button" class="gr-type-card" [class.gr-type-card-active]="bookingType === 'standard'" (click)="setBookingType('standard')">
                          <span class="gr-type-card-icon">🏸</span>
                          <span class="gr-type-card-label">Standard</span>
                          <span class="gr-type-card-sub">Court rental</span>
                        </button>
                        <button type="button" class="gr-type-card" [class.gr-type-card-active]="bookingType === 'exclusive_event'" (click)="setBookingType('exclusive_event')">
                          <span class="gr-type-card-icon">🎉</span>
                          <span class="gr-type-card-label">Exclusive Event</span>
                          <span class="gr-type-card-sub">Private full-court</span>
                        </button>
                      </div>
                      @if (bookingType === 'exclusive_event') {
                        <div class="gr-event-info">
                          <div class="gr-event-stat">
                            <span class="gr-event-stat-val">{{ exclusiveEventRate | currency: 'PHP' : 'symbol' }}</span>
                            <span class="gr-event-stat-lbl">per hour</span>
                          </div>
                          <div class="gr-event-stat">
                            <span class="gr-event-stat-val">{{ exclusiveEventIncludedPax }}</span>
                            <span class="gr-event-stat-lbl">pax included</span>
                          </div>
                          <div class="gr-event-stat">
                            <span class="gr-event-stat-val">+₱{{ exclusiveEventExcessPaxFee }}</span>
                            <span class="gr-event-stat-lbl">per extra guest</span>
                          </div>
                          <div class="gr-event-stat">
                            <span class="gr-event-stat-val">{{ exclusiveEventMaxPax }}</span>
                            <span class="gr-event-stat-lbl">max capacity</span>
                          </div>
                        </div>
                      }
                    }

                    <!-- Guests / Attendees -->
                    @if (bookingType === 'exclusive_event' || guestFeeRate > 0) {
                      <div class="gr-field-group">
                        <label class="gr-field-label">
                          @if (bookingType === 'exclusive_event') { Total attendees } @else { Non-member guests }
                        </label>
                        <div class="gr-counter">
                          <button type="button" class="gr-count-btn" (click)="guestCount = guestCount > 0 ? guestCount - 1 : 0">&#8722;</button>
                          <span class="gr-count-val">{{ guestCount }}</span>
                          <button type="button" class="gr-count-btn"
                            [disabled]="bookingType === 'exclusive_event' && exclusiveEventMaxPax > 0 && guestCount >= exclusiveEventMaxPax"
                            (click)="incrementGuestCount()">&#43;</button>
                          @if (guestCount > 0) {
                            <span class="gr-count-fee">
                              @if (totalGuestFee > 0) { {{ totalGuestFee | currency: 'PHP' : 'symbol' }} }
                              @else { Free }
                            </span>
                          }
                        </div>
                        @if (bookingType === 'exclusive_event' && exclusiveEventIncludedPax > 0) {
                          <div class="gr-event-pax-note">
                            <span>&#9432;</span>
                            First {{ exclusiveEventIncludedPax }} pax are included in the base rate.
                            Additional guests are charged &#8369;{{ exclusiveEventExcessPaxFee }} each,
                            up to a maximum of {{ exclusiveEventMaxPax }} persons.
                          </div>
                        }
                        @if (bookingType !== 'exclusive_event' && guestFeeRate > 0) {
                          <div class="gr-event-pax-note">
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
                    }

                    <!-- Rentals -->
                    @if (hasAnyRental) {
                      <div class="gr-field-group">
                        <label class="gr-field-label">Rentals <span class="gr-optional">optional</span></label>
                        <div class="gr-rentals">
                          @if (rentalBalls50Rate > 0) {
                            <div class="gr-rental-row">
                              <span>&#127934; Balls (50)</span>
                              <span class="gr-rental-rate">{{ rentalBalls50Rate | currency: 'PHP' : 'symbol' }}</span>
                              <div class="gr-counter gr-counter-sm">
                                <button type="button" class="gr-count-btn sm" (click)="rentalBalls50 = rentalBalls50 > 0 ? rentalBalls50 - 1 : 0">&#8722;</button>
                                <span class="gr-count-val sm">{{ rentalBalls50 }}</span>
                                <button type="button" class="gr-count-btn sm" (click)="rentalBalls50 = rentalBalls50 + 1">&#43;</button>
                              </div>
                            </div>
                          }
                          @if (rentalBalls100Rate > 0) {
                            <div class="gr-rental-row">
                              <span>&#127934; Balls (100)</span>
                              <span class="gr-rental-rate">{{ rentalBalls100Rate | currency: 'PHP' : 'symbol' }}</span>
                              <div class="gr-counter gr-counter-sm">
                                <button type="button" class="gr-count-btn sm" (click)="rentalBalls100 = rentalBalls100 > 0 ? rentalBalls100 - 1 : 0">&#8722;</button>
                                <span class="gr-count-val sm">{{ rentalBalls100 }}</span>
                                <button type="button" class="gr-count-btn sm" (click)="rentalBalls100 = rentalBalls100 + 1">&#43;</button>
                              </div>
                            </div>
                          }
                          @if (rentalBallMachineRate > 0) {
                            <div class="gr-rental-row">
                              <span>&#129302; Ball Machine</span>
                              <span class="gr-rental-rate">{{ rentalBallMachineRate | currency: 'PHP' : 'symbol' }}</span>
                              <label class="gr-toggle-item" style="margin:0">
                                <input type="checkbox" [(ngModel)]="rentalBallMachine" />
                                <span>{{ rentalBallMachine ? 'Yes' : 'No' }}</span>
                              </label>
                            </div>
                          }
                          @if (rentalRacketRate > 0) {
                            <div class="gr-rental-row">
                              <span>&#127955; Racket</span>
                              <span class="gr-rental-rate">{{ rentalRacketRate | currency: 'PHP' : 'symbol' }}</span>
                              <div class="gr-counter gr-counter-sm">
                                <button type="button" class="gr-count-btn sm" (click)="rentalRackets = rentalRackets > 0 ? rentalRackets - 1 : 0">&#8722;</button>
                                <span class="gr-count-val sm">{{ rentalRackets }}</span>
                                <button type="button" class="gr-count-btn sm" (click)="rentalRackets = rentalRackets + 1">&#43;</button>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Additional fees -->
                    @if (bookingType !== 'exclusive_event' && availableExtraFees.length > 0) {
                      <div class="gr-field-group">
                        <label class="gr-field-label">Add-ons</label>
                        <div class="gr-extra-fees">
                          @for (fee of availableExtraFees; track fee.name) {
                            <div class="gr-extra-fee-row">
                              @if (fee.isOptional) {
                                <label class="gr-toggle-item">
                                  <input type="checkbox" [checked]="isExtraFeeSelected(fee)" (change)="toggleExtraFee(fee)" />
                                  <span>{{ fee.name }}</span>
                                </label>
                              } @else {
                                <span class="gr-extra-fee-required">{{ fee.name }} <span class="gr-required-badge">required</span></span>
                              }
                              <span class="gr-extra-fee-amt">
                                {{ (fee.type === 'per_person' ? fee.amount * guestCount : fee.amount) | currency: 'PHP' : 'symbol' }}
                                @if (fee.type === 'per_person') { <span class="gr-sum-pct">(₱{{ fee.amount }} × {{ guestCount }})</span> }
                              </span>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Coaching session -->
                    @if (coachingEnabled && bookingType !== 'exclusive_event') {
                      <div class="gr-field-group">
                        <label class="gr-field-label">Coaching Session <span class="gr-optional">optional</span></label>
                        <div class="gr-extra-fees">
                          <div class="gr-extra-fee-row">
                            <label class="gr-toggle-item">
                              <input type="checkbox" [(ngModel)]="coachingRequested" (ngModelChange)="onCoachingToggle()" />
                              <span>Add coaching 🎓</span>
                            </label>
                          </div>
                          @if (coachingRequested) {
                            <div class="gr-extra-fee-row">
                              <span>Attendees</span>
                              <span class="gr-counter">
                                <button type="button" class="gr-count-btn" (click)="decCoachingPax()">&#8722;</button>
                                <span class="gr-count-val">{{ coachingPax }}</span>
                                <button type="button" class="gr-count-btn" (click)="incCoachingPax()">&#43;</button>
                              </span>
                            </div>
                            <div class="gr-extra-fee-row">
                              <span class="gr-sum-pct">{{ coachingTierRate | currency: 'PHP' : 'symbol' }} × {{ coachingPax }} pax × {{ selectedDuration }} hr</span>
                              <span class="gr-extra-fee-amt">{{ coachingFee | currency: 'PHP' : 'symbol' }}</span>
                            </div>
                            <p class="gr-optional" style="margin:.25rem 0 0">Minimum {{ coachingMinHours }} hours per coaching session.</p>
                          }
                        </div>
                      </div>
                    }

                    <!-- Exclusive event policies -->
                    @if (bookingType === 'exclusive_event' && exclusiveEventPolicies.length > 0) {
                      <div class="gr-policies-block">
                        <div class="gr-policies-title">&#128203; Event Policies</div>
                        <ol class="gr-policies-list">
                          @for (policy of exclusiveEventPolicies; track policy; let i = $index) {
                            <li>
                              <span class="gr-policy-num">{{ i + 1 }}</span>
                              <span>{{ policy }}</span>
                            </li>
                          }
                        </ol>
                        <label class="gr-policy-ack">
                          <input type="checkbox" [(ngModel)]="policiesAcknowledged" class="gr-sw-input" />
                          <span class="gr-sw-track" [class.on]="policiesAcknowledged"><span class="gr-sw-thumb"></span></span>
                          <span class="gr-policy-ack-text">I have read and agree to the event policies</span>
                        </label>
                      </div>
                    }

                    <!-- Price summary -->
                    <div class="gr-sum-block">
                      <div class="gr-sum-label">&#128176; Price Breakdown</div>
                      <div class="gr-sum-row">
                        <span>&#127955; Court rental <span class="gr-sum-pct">({{ selectedDuration }}hr)</span></span>
                        <strong>{{ subtotal | currency: 'PHP' : 'symbol' }}</strong>
                      </div>
                      @if (lightsRequested && lightsRate > 0) {
                        <div class="gr-sum-row">
                          <span>&#128161; Lights <span class="gr-sum-pct">({{ lightHours }}hr)</span></span>
                          <strong>{{ lightsRate * lightHours | currency: 'PHP' : 'symbol' }}</strong>
                        </div>
                      }
                      @if (convenienceFeeMode !== 'monthly_flat' && convenienceFeeMode !== 'club_absorbs') {
                        <div class="gr-sum-row">
                          <span>&#128179; Convenience fee <span class="gr-sum-pct">({{ (convenienceFeeRate * 100) | number: '1.0-2' }}%)</span></span>
                          <strong>{{ convenienceFee | currency: 'PHP' : 'symbol' }}</strong>
                        </div>
                      }
                      @if (extraFeeTotal > 0) {
                        <div class="gr-sum-row">
                          <span>&#10133; Add-ons</span>
                          <strong>{{ extraFeeTotal | currency: 'PHP' : 'symbol' }}</strong>
                        </div>
                      }
                      @if (coachingRequested && coachingFee > 0) {
                        <div class="gr-sum-row">
                          <span>&#127891; Coaching <span class="gr-sum-pct">({{ coachingPax }} pax × {{ selectedDuration }}hr)</span></span>
                          <strong>{{ coachingFee | currency: 'PHP' : 'symbol' }}</strong>
                        </div>
                      }
                      <div class="gr-sum-divider"></div>
                      <div class="gr-sum-total-row">
                        <span>Total due</span>
                        <strong class="gr-total-amt">{{ computedFee | currency: 'PHP' : 'symbol' }}</strong>
                      </div>
                    </div>

                    <!-- Guest info -->
                    @if (errorMsg) {
                      <div class="gr-alert-error">&#9888; {{ errorMsg }}</div>
                    }

                    <div class="gr-field-group">
                      <label class="gr-field-label">Full name *</label>
                      <input type="text" class="gr-input" [class.gr-input-error]="guestSubmitted && !guestName.trim()" placeholder="Full name" [(ngModel)]="guestName" />
                      @if (guestSubmitted && !guestName.trim()) {
                        <div class="gr-field-error"><i class="fas fa-exclamation-circle"></i> Full name is required.</div>
                      }
                    </div>
                    <div class="gr-field-group">
                      <label class="gr-field-label">Email *</label>
                      <input type="email" class="gr-input" [class.gr-input-error]="guestSubmitted && !guestEmail.trim()" placeholder="Email" [(ngModel)]="guestEmail" />
                      @if (guestSubmitted && !guestEmail.trim()) {
                        <div class="gr-field-error"><i class="fas fa-exclamation-circle"></i> Email is required.</div>
                      }
                    </div>
                    <div class="gr-field-group">
                      <label class="gr-field-label">Phone <span class="gr-optional">optional</span></label>
                      <input type="tel" class="gr-input" placeholder="Phone" [(ngModel)]="guestPhone" />
                    </div>

                    <!-- Payment Method -->
                    @if (paymentMethods.length > 0) {
                      <div class="gr-field-group">
                        <label class="gr-field-label">Payment method *</label>
                        <select class="gr-input gr-select" [class.gr-input-error]="guestSubmitted && !selectedPaymentMethod" [(ngModel)]="selectedPaymentMethod">
                          <option value="" disabled>Select payment method</option>
                          @for (method of paymentMethods; track method) {
                            <option [value]="method">{{ method }}</option>
                          }
                        </select>
                        @if (guestSubmitted && !selectedPaymentMethod) {
                          <div class="gr-field-error"><i class="fas fa-exclamation-circle"></i> Please select a payment method.</div>
                        }
                      </div>

                      @if (selectedPaymentMethod && paymentQrCodes[selectedPaymentMethod]) {
                        <div class="gr-qr-block">
                          <div class="gr-qr-label">Pay using this QR ({{ selectedPaymentMethod }})</div>
                          <img
                            class="gr-qr-img"
                            [src]="paymentQrCodes[selectedPaymentMethod]"
                            [alt]="'QR code for ' + selectedPaymentMethod"
                          />

                          @if (paymentAccounts[selectedPaymentMethod]) {
                            <div class="gr-acct-rows">
                              <div class="gr-acct-row">
                                <span class="gr-acct-label">Account Number</span>
                                <div class="gr-acct-value-wrap">
                                  <span class="gr-acct-value">{{ paymentAccounts[selectedPaymentMethod] }}</span>
                                  <button
                                    type="button"
                                    class="gr-copy-btn"
                                    (click)="copyToClipboard(paymentAccounts[selectedPaymentMethod])"
                                    [title]="'Copy ' + paymentAccounts[selectedPaymentMethod]"
                                  >
                                    @if (copiedMethod === selectedPaymentMethod) {
                                      &#10003;
                                    } @else {
                                      &#10697;
                                    }
                                  </button>
                                </div>
                              </div>
                            </div>
                          }

                          <button type="button" class="gr-dl-btn" (click)="downloadQr(selectedPaymentMethod)">
                            &#8595; Download QR Code
                          </button>
                        </div>
                      }
                    }

                    <!-- Payment screenshot disclaimer -->
                    @if (requirePaymentScreenshot) {
                      <div class="gr-payment-disclaimer">
                        <i class="fas fa-info-circle"></i>
                        <span><strong>Payment screenshot required.</strong> Please complete your payment and upload a screenshot below before confirming your booking. The slot will remain open for other users until your booking is confirmed.</span>
                      </div>
                    }

                    <!-- Payment screenshot -->
                    <div class="gr-field-group">
                      <label class="gr-field-label">Payment screenshot
                        <span [class]="requirePaymentScreenshot ? 'gr-required' : 'gr-optional'">
                          {{ requirePaymentScreenshot ? 'required' : 'optional' }}
                        </span>
                      </label>
                      <label class="gr-file-label" [class.gr-file-label-error]="guestSubmitted && requirePaymentScreenshot && !paymentScreenshot">
                        <input type="file" accept="image/*" class="gr-file-input" (change)="onScreenshotChange($event)" />
                        <span class="gr-file-btn">Choose File</span>
                        <span class="gr-file-name">{{ paymentScreenshot ? paymentScreenshot.name : 'No file chosen' }}</span>
                      </label>
                      @if (guestSubmitted && requirePaymentScreenshot && !paymentScreenshot) {
                        <div class="gr-field-error" style="margin-top:4px"><i class="fas fa-exclamation-circle"></i> Please upload a payment screenshot.</div>
                      }
                    </div>

                    <!-- Terms -->
                    @if (guestTermsNotification) {
                      <div class="gr-terms-notice">
                        <i class="fas fa-circle-exclamation"></i>
                        {{ guestTermsNotification }}
                      </div>
                    }
                    <div class="gr-terms-row" [class.gr-terms-row-error]="guestSubmitted && !agreedToTerms">
                      <button type="button" class="gr-terms-btn" (click)="showTerms = !showTerms">
                        View Terms &amp; Conditions
                      </button>
                      <label class="gr-toggle-item">
                        <input type="checkbox" [(ngModel)]="agreedToTerms" />
                        <span>I agree</span>
                      </label>
                    </div>
                    @if (guestSubmitted && !agreedToTerms) {
                      <div class="gr-field-error" style="margin-top:4px"><i class="fas fa-exclamation-circle"></i> You must agree to the Terms &amp; Conditions.</div>
                    }

                  </div><!-- /gr-panel-body -->

                  <div class="gr-panel-footer">
                    <button class="gr-submit-btn" [disabled]="booking || (requirePaymentScreenshot && !paymentScreenshot)" (click)="submit()">
                      @if (booking) { Submitting… } @else { Confirm booking }
                    </button>

                  </div>
                </div>

              } @else {
                <!-- ── Default sidebar: photo + info ── -->
                @if (clubPhotos().length > 0) {
                  <div class="gr-carousel">
                    <img class="gr-carousel-img" [src]="clubPhotos()[carouselIndex()]" alt="Club photo" />
                    @if (clubPhotos().length > 1) {
                      <button class="gr-car-btn gr-car-prev" (click)="prevPhoto()">&#8249;</button>
                      <button class="gr-car-btn gr-car-next" (click)="nextPhoto()">&#8250;</button>
                      <div class="gr-car-dots">
                        @for (p of clubPhotos(); track $index) {
                          <span class="gr-car-dot" [class.active]="$index === carouselIndex()" (click)="carouselIndex.set($index)"></span>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <div class="gr-carousel gr-carousel-placeholder">
                    <div class="gr-car-placeholder-text">No photos</div>
                  </div>
                }

                <div class="gr-info-card">
                  <div class="gr-info-title">{{ clubName }}</div>
                  @if (clubLocation) {
                    <div class="gr-info-row"><span class="gr-info-icon">&#128205;</span><span>{{ clubLocation }}</span></div>
                  }
                  <div class="gr-info-row"><span class="gr-info-icon">&#127955;</span><span>{{ courtCount() }} court{{ courtCount() !== 1 ? 's' : '' }}</span></div>
                  @if (weekdayRate > 0) {
                    <div class="gr-info-row"><span class="gr-info-icon">&#128176;</span><span>{{ weekdayRate | currency: 'PHP' : 'symbol' }}/hr (weekday)</span></div>
                  }
                  @if (clubMobile) {
                    <div class="gr-info-row"><span class="gr-info-icon">&#128222;</span><a [href]="'tel:' + clubMobile" class="gr-info-link">{{ clubMobile }}</a></div>
                  }
                  @if (clubEmail) {
                    <div class="gr-info-row"><span class="gr-info-icon">&#9993;</span><a [href]="'mailto:' + clubEmail" class="gr-info-link">{{ clubEmail }}</a></div>
                  }
                  @if (clubSocial.facebook) {
                    <div class="gr-info-row"><span class="gr-info-icon">f</span><a [href]="clubSocial.facebook" target="_blank" class="gr-info-link">Facebook</a></div>
                  }
                  @if (clubSocial.instagram) {
                    <div class="gr-info-row"><span class="gr-info-icon">&#9654;</span><a [href]="clubSocial.instagram" target="_blank" class="gr-info-link">Instagram</a></div>
                  }
                  <div class="gr-info-hint">&#8592; Select a date, court and time slot to book</div>
                </div>
              }

            </div><!-- /gr-sidebar -->

          </div><!-- /gr-layout -->
        }

      </div><!-- /gr-body -->

      <!-- ── Terms & Conditions modal ── -->
      @if (showTerms) {
        <div class="gr-modal-overlay" (click)="showTerms = false">
          <div class="gr-terms-modal" (click)="$event.stopPropagation()">
            <div class="gr-terms-modal-header">
              <div class="gr-terms-heading">
                <span class="gr-terms-heading-icon"><i class="fas fa-file-shield"></i></span>
                <div>
                  <div class="gr-terms-modal-title">Terms &amp; Conditions</div>
                  <p>Review the court rules before confirming your booking.</p>
                </div>
              </div>
              <button class="gr-modal-close" (click)="showTerms = false" aria-label="Close terms"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="gr-terms-modal-body">
              <div class="gr-terms-callout">
                <i class="fas fa-circle-info"></i>
                <span>By continuing, you agree to follow the club's rules, respect your booking time, and accept any applicable charges.</span>
              </div>
              @if (termsLoadError) {
                <div class="gr-terms-state">
                  <i class="fas fa-triangle-exclamation"></i>
                  <strong>Unable to load terms</strong>
                  <span>Please contact management before completing your booking.</span>
                </div>
              } @else if (guestTermsHtml) {
                <div class="gr-terms-doc" [innerHTML]="guestTermsHtml"></div>
              } @else {
                <div class="gr-terms-doc">
                  <h2>Respect the Court</h2>
                  <p>Please use the court, equipment, and facilities with care. Any damage, unsafe behavior, or misuse may result in additional charges or loss of booking privileges.</p>

                  <h2>Arrive on Time</h2>
                  <p>Your reservation begins and ends at the selected time. Late arrival does not extend the booking, and overtime may be charged according to club policy.</p>

                  <h2>Keep the Area Clean</h2>
                  <p>Dispose of trash properly and leave the court ready for the next players.</p>

                  <h2>Play Safely and Respectfully</h2>
                  <p>Wear proper footwear, follow posted club rules, and treat staff and other players with courtesy.</p>
                </div>
              }
            </div>
            <div class="gr-terms-modal-footer">
              <p>Acceptance is required to submit this booking.</p>
              <button class="gr-submit-btn" (click)="agreeAndClose()"><i class="fas fa-check"></i> I Agree</button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; }

    .gr-shell {
      min-height: 100vh;
      background: #0c1a11;
      color: #e8f5e9;
      font-family: inherit;
    }

    /* ── Header ── */
    .gr-header {
      position: sticky; top: 0; z-index: 50;
      background: rgba(12,26,17,0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(163,230,53,0.1);
    }
    .gr-header-inner {
      max-width: 1300px; margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex; align-items: center; gap: 1rem;
    }
    .gr-back-btn {
      background: none;
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5);
      border-radius: 8px; padding: 0.4rem 0.85rem;
      font-size: 0.82rem; cursor: pointer; white-space: nowrap;
      transition: border-color 0.15s, color 0.15s;
    }
    .gr-back-btn:hover { border-color: #a3e635; color: #a3e635; }
    .gr-header-brand {
      display: flex; align-items: center; gap: 0.75rem;
      flex: 1; min-width: 0;
    }
    .gr-club-logo, .gr-cg-icon {
      width: 40px; height: 40px; border-radius: 8px;
      object-fit: cover; flex-shrink: 0;
    }
    .gr-club-name { font-size: 1rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gr-club-loc { font-size: 0.78rem; color: rgba(255,255,255,0.4); margin-top: 1px; }
    .gr-header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
    .gr-action-btn {
      background: none; border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.5); border-radius: 8px;
      padding: 0.4rem 0.9rem; font-size: 0.8rem; cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .gr-action-btn:hover { border-color: #a3e635; color: #a3e635; }

    /* ── Body ── */
    .gr-body { max-width: 1300px; margin: 0 auto; padding: 1.5rem; }
    .gr-error-card {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
      color: #fca5a5; border-radius: 12px; padding: 1.25rem 1.5rem; font-size: 0.9rem;
    }

    /* ── Confirmation ── */
    .gr-confirm-wrap { display: flex; justify-content: center; padding: 2rem 0; }
    .gr-confirm-card {
      background: #1b3028; border: 1px solid rgba(163,230,53,0.12);
      border-radius: 16px; padding: 2rem 2.25rem; width: 100%; max-width: 520px;
    }
    .gr-confirm-icon {
      width: 52px; height: 52px; border-radius: 50%;
      background: rgba(163,230,53,0.15); color: #a3e635;
      font-size: 1.5rem; display: flex; align-items: center; justify-content: center;
      margin-bottom: 1rem;
    }
    .gr-confirm-title { font-size: 1.4rem; font-weight: 700; color: #fff; margin: 0 0 0.35rem; }
    .gr-confirm-sub { font-size: 0.875rem; color: rgba(255,255,255,0.5); margin: 0 0 1.5rem; }
    .gr-confirm-rows { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
    .gr-confirm-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; }
    .gr-confirm-row span { color: rgba(255,255,255,0.5); }
    .gr-ref { font-size: 0.72rem; font-family: monospace; letter-spacing: 0.04em; color: #a3e635; }
    .gr-green { color: #a3e635; }
    .gr-payment-list { margin-top: 1.5rem; }
    .gr-payment-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.35); margin: 0 0 0.75rem; }
    .gr-payment-notice {
      display: flex; align-items: flex-start; gap: 0.75rem;
      background: rgba(163,230,53,0.04); border: 1px solid rgba(163,230,53,0.1);
      border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 0.6rem;
      font-size: 0.85rem; color: rgba(255,255,255,0.7);
    }
    .gr-payment-notice p { margin: 0.3rem 0 0; }
    .gr-pay-logo { width: 32px; height: 32px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
    .gr-pay-icon { font-size: 1.1rem; flex-shrink: 0; }
    .gr-pay-account { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin: 0.2rem 0 0 !important; }
    .gr-qr { width: 80px; height: 80px; border-radius: 6px; display: block; margin: 0.5rem 0; }
    .gr-new-btn {
      margin-top: 1.5rem; width: 100%; padding: 0.85rem;
      background: #a3e635; color: #0c1a11; border: none; border-radius: 10px;
      font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: background 0.15s;
    }
    .gr-new-btn:hover { background: #b5f040; }

    /* ── Layout ── */
    .gr-layout {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 1.5rem;
      align-items: start;
    }

    /* ── Left form sections ── */
    .gr-form-section { margin-bottom: 1.25rem; }
    .gr-form-label {
      font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.40);
      text-transform: uppercase; letter-spacing: 0.8px;
      margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;
    }
    .gr-lights-legend { display: flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; font-weight: 500; color: rgba(255,255,255,0.3); text-transform: none; letter-spacing: 0; }
    .gr-lights-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; }

    /* Date input */
    .gr-date-input {
      width: 100%; box-sizing: border-box;
      background: #1b3028; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; padding: 0.7rem 0.9rem;
      color: #fff; font-size: 0.9rem; font-family: inherit;
      outline: none; transition: border-color 0.2s;
    }
    .gr-date-input:focus { border-color: rgba(163,230,53,0.4); }
    .gr-date-input::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }

    /* Court buttons */
    .gr-court-toggle { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .gr-court-btn {
      flex: 1; min-width: 90px; padding: 0.65rem;
      border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
      background: #1b3028; font-size: 0.88rem; font-weight: 700;
      cursor: pointer; transition: all 0.2s;
      color: rgba(255,255,255,0.55);
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
      font-family: inherit;
    }
    .gr-court-btn.active { border-color: #a3e635; background: rgba(163,230,53,0.12); color: #a3e635; }
    .gr-court-btn:hover:not(.active) { border-color: rgba(163,230,53,0.3); color: rgba(255,255,255,0.8); }

    /* Slot grid */
    .gr-slot-loading {
      display: flex; align-items: center; gap: 0.75rem;
      color: rgba(255,255,255,0.45); font-size: 0.875rem; padding: 1.5rem 0;
    }
    .gr-spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(163,230,53,0.2); border-top-color: #a3e635;
      border-radius: 50%; animation: gr-spin 0.7s linear infinite; flex-shrink: 0;
    }
    @keyframes gr-spin { to { transform: rotate(360deg); } }

    .gr-slot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
      gap: 0.45rem;
    }
    .gr-slot-btn {
      position: relative; padding: 0.55rem 0.35rem;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      background: #1b3028; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.7);
      display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
      font-family: inherit;
    }
    .gr-slot-btn.has-lights { border-color: rgba(245,158,11,0.35); background: rgba(245,158,11,0.07); }
    .gr-slot-btn.selected { border-color: #a3e635; background: rgba(163,230,53,0.15); color: #a3e635; }
    .gr-slot-btn.booked { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.2); cursor: not-allowed; border-color: rgba(255,255,255,0.05); text-decoration: line-through; }
    .gr-slot-btn.in-range { border-color: rgba(163,230,53,0.4); background: rgba(163,230,53,0.08); color: rgba(163,230,53,0.6); cursor: not-allowed; }
    .gr-slot-btn.coaching-blocked { opacity: 0.35; cursor: not-allowed; border-color: rgba(255,255,255,0.05); }
    .gr-slot-btn:hover:not(.booked):not(.selected):not(.in-range):not(.coaching-blocked) { border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.07); }
    .gr-slot-light { font-size: 0.65rem; line-height: 1; }

    /* ── Sidebar ── */
    .gr-sidebar { display: flex; flex-direction: column; gap: 1rem; position: sticky; top: 72px; }

    /* Default photo carousel */
    .gr-carousel {
      position: relative; border-radius: 12px; overflow: hidden;
      aspect-ratio: 16/9; background: #1b3028;
    }
    .gr-carousel-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .gr-carousel-placeholder { display: flex; align-items: center; justify-content: center; }
    .gr-car-placeholder-text { color: rgba(255,255,255,0.2); font-size: 0.85rem; }
    .gr-car-btn {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(0,0,0,0.45); border: none; color: #fff;
      width: 30px; height: 30px; border-radius: 50%; font-size: 1.1rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .gr-car-btn:hover { background: rgba(0,0,0,0.7); }
    .gr-car-prev { left: 8px; }
    .gr-car-next { right: 8px; }
    .gr-car-dots {
      position: absolute; bottom: 8px; left: 0; right: 0;
      display: flex; justify-content: center; gap: 4px;
    }
    .gr-car-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.3); cursor: pointer; transition: background 0.15s; }
    .gr-car-dot.active { background: #a3e635; }

    .gr-info-card {
      background: #1b3028; border: 1px solid rgba(163,230,53,0.08);
      border-radius: 12px; padding: 1.1rem 1.25rem;
    }
    .gr-info-title { font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem; }
    .gr-info-row {
      display: flex; align-items: center; gap: 0.55rem;
      font-size: 0.82rem; color: rgba(255,255,255,0.55); padding: 0.3rem 0;
    }
    .gr-info-icon { width: 16px; text-align: center; font-style: normal; flex-shrink: 0; }
    .gr-info-link { color: #a3e635; text-decoration: none; font-weight: 500; }
    .gr-info-link:hover { color: #b5f040; }
    .gr-info-hint { font-size: 0.75rem; color: rgba(255,255,255,0.2); margin-top: 0.75rem; text-align: center; }

    /* ── Booking panel ── */
    .gr-booking-panel {
      background: #1b3028;
      border: 1px solid rgba(163,230,53,0.15);
      border-radius: 14px;
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .gr-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .gr-panel-title { font-size: 1rem; font-weight: 700; color: #fff; }
    .gr-panel-clear {
      background: none; border: none; color: rgba(255,255,255,0.3);
      font-size: 0.9rem; cursor: pointer; padding: 0.2rem;
      border-radius: 4px; transition: color 0.15s;
    }
    .gr-panel-clear:hover { color: #fff; }
    .gr-panel-body {
      padding: 1rem 1.25rem;
      display: flex; flex-direction: column; gap: 0.85rem;
      overflow-y: auto; max-height: calc(100vh - 200px);
    }
    .gr-panel-footer {
      padding: 1rem 1.25rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    /* Rate info */
    .gr-rate-info {
      font-size: 0.8rem; color: rgba(255,255,255,0.45);
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .gr-rate-info strong { color: rgba(255,255,255,0.7); }

    /* Slot summary badges */
    .gr-slot-summary { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .gr-slot-badge {
      padding: 0.25rem 0.6rem; border-radius: 6px;
      font-size: 0.78rem; font-weight: 600;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
    }
    .gr-slot-badge-time { background: rgba(26,120,194,0.2); color: #5bb8f5; }
    .gr-slot-badge-date { background: rgba(26,120,194,0.1); color: rgba(91,184,245,0.7); }

    /* Booking type selector */
    .gr-type-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
    .gr-type-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.75rem 0.5rem;
      background: rgba(255,255,255,0.04);
      border: 1.5px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .gr-type-card:hover {
      background: rgba(255,255,255,0.07);
      border-color: rgba(255,255,255,0.2);
    }
    .gr-type-card-active {
      border-color: #a3e635 !important;
      background: rgba(163,230,53,0.08) !important;
    }
    .gr-type-card-icon { font-size: 1.4rem; line-height: 1; }
    .gr-type-card-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: rgba(255,255,255,0.85);
    }
    .gr-type-card-sub {
      font-size: 0.68rem;
      color: rgba(255,255,255,0.38);
    }
    .gr-type-card-active .gr-type-card-label { color: #a3e635; }
    .gr-type-card-active .gr-type-card-sub { color: rgba(163,230,53,0.55); }

    /* Exclusive event info strip */
    .gr-event-info {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 0.4rem;
      background: rgba(163,230,53,0.06);
      border: 1px solid rgba(163,230,53,0.18);
      border-radius: 10px;
      padding: 0.75rem;
    }
    .gr-event-stat {
      display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
      padding: 0.35rem 0.5rem;
      background: rgba(163,230,53,0.06); border-radius: 8px;
    }
    .gr-event-stat-val { font-size: 0.9rem; font-weight: 800; color: #a3e635; }
    .gr-event-stat-lbl { font-size: 0.65rem; color: rgba(163,230,53,0.55); text-transform: uppercase; letter-spacing: 0.05em; }

    /* Pax note */
    .gr-event-pax-note {
      display: flex; align-items: flex-start; gap: 0.45rem;
      background: rgba(163,230,53,0.05); border: 1px solid rgba(163,230,53,0.15);
      border-radius: 8px; padding: 0.6rem 0.75rem;
      font-size: 0.78rem; color: rgba(255,255,255,0.55); line-height: 1.5;
    }
    .gr-event-pax-note span:first-child { color: #a3e635; font-size: 0.85rem; flex-shrink: 0; margin-top: 0.05rem; }

    /* Policies block */
    .gr-policies-block {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-left: 3px solid rgba(163,230,53,0.4);
      border-radius: 10px; padding: 0.85rem 1rem;
      display: flex; flex-direction: column; gap: 0.65rem;
    }
    .gr-policies-title { font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.7); letter-spacing: 0.03em; }
    .gr-policies-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.45rem; }
    .gr-policies-list li { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8rem; color: rgba(255,255,255,0.55); line-height: 1.45; }
    .gr-policy-num {
      min-width: 18px; height: 18px; border-radius: 50%;
      background: rgba(163,230,53,0.15); color: #a3e635;
      font-size: 0.65rem; font-weight: 700; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; margin-top: 0.05rem;
    }
    .gr-policy-ack {
      display: flex; align-items: center; gap: 0.6rem; cursor: pointer;
      padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.06);
    }
    .gr-policy-ack-text { font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 500; }

    /* Price summary */
    .gr-sum-block {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; padding: 0.85rem 1rem;
      display: flex; flex-direction: column; gap: 0.1rem;
    }
    .gr-sum-label {
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; color: rgba(255,255,255,0.3);
      margin-bottom: 0.4rem;
    }
    .gr-sum-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.82rem; color: rgba(255,255,255,0.5); padding: 0.25rem 0;
    }
    .gr-sum-row strong { color: rgba(255,255,255,0.75); }
    .gr-sum-pct { font-size: 0.72rem; opacity: 0.7; }
    .gr-sum-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 0.4rem 0; }
    .gr-sum-total-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.9rem; color: rgba(255,255,255,0.7); padding: 0.15rem 0;
    }
    .gr-total-amt { color: #a3e635; font-size: 1.15rem; font-weight: 800; }

    /* Form fields */
    .gr-alert-error {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);
      color: #fca5a5; border-radius: 8px; padding: 0.65rem 0.85rem; font-size: 0.83rem;
    }
    .gr-field-error {
      display: flex; align-items: center; gap: 5px;
      font-size: 0.76rem; color: #f87171;
      animation: grFadeIn 0.15s ease;
    }
    .gr-field-error i { font-size: 0.7rem; flex-shrink: 0; }
    .gr-input-error { border-color: rgba(239,68,68,0.5) !important; }
    .gr-terms-row-error { outline: 1px solid rgba(239,68,68,0.4); border-radius: 8px; padding: 6px 8px; }
    @keyframes grFadeIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
    .gr-field-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .gr-field-label {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; color: rgba(255,255,255,0.4);
    }
    .gr-optional { font-weight: 400; text-transform: none; letter-spacing: 0; color: rgba(255,255,255,0.25); }
    .gr-required { font-weight: 400; text-transform: none; letter-spacing: 0; color: #f87171; }
    .gr-input {
      padding: 0.65rem 0.85rem;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
      background: rgba(255,255,255,0.04); color: #fff;
      font-size: 0.88rem; font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .gr-input::placeholder { color: rgba(255,255,255,0.22); }
    .gr-input:focus { outline: none; border-color: rgba(163,230,53,0.35); box-shadow: 0 0 0 3px rgba(163,230,53,0.08); }

    .gr-dur-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .gr-dur-btn {
      padding: 0.3rem 0.7rem; border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.5); font-size: 0.8rem; cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .gr-dur-btn.active, .gr-dur-btn:hover { border-color: #a3e635; background: rgba(163,230,53,0.1); color: #a3e635; }

    /* iOS toggle switches */
    .gr-toggles-col { display: flex; flex-direction: column; gap: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; }
    .gr-sw-row {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.7rem 0.9rem; cursor: pointer;
      transition: background 0.15s;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .gr-sw-row:last-child { border-bottom: none; }
    .gr-sw-row:hover { background: rgba(255,255,255,0.04); }
    .gr-sw-label { flex: 1; font-size: 0.86rem; font-weight: 600; color: rgba(255,255,255,0.8); }
    .gr-sw-meta { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin-right: 0.4rem; }
    .gr-sw-input { display: none; }
    .gr-sw-track {
      position: relative; width: 40px; height: 22px; border-radius: 11px;
      background: rgba(255,255,255,0.12); transition: background 0.2s; flex-shrink: 0;
    }
    .gr-sw-track.on { background: #a3e635; }
    .gr-sw-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 16px; height: 16px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      transition: left 0.2s;
    }
    .gr-sw-track.on .gr-sw-thumb { left: 21px; }

    /* Legacy toggle-item (still used in rentals) */
    .gr-toggle-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: rgba(255,255,255,0.6); cursor: pointer; white-space: nowrap; }
    .gr-toggle-item input[type=checkbox] { accent-color: #a3e635; }

    .gr-counter { display: flex; align-items: center; gap: 0.5rem; }
    .gr-counter-sm { gap: 0.3rem; }
    .gr-count-btn {
      width: 28px; height: 28px; border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
      color: #fff; font-size: 1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: border-color 0.15s;
    }
    .gr-count-btn:hover { border-color: #a3e635; }
    .gr-count-btn.sm { width: 22px; height: 22px; font-size: 0.85rem; }
    .gr-count-val { min-width: 24px; text-align: center; font-size: 0.9rem; color: #fff; }
    .gr-count-val.sm { min-width: 16px; font-size: 0.8rem; }
    .gr-count-fee { font-size: 0.78rem; color: #a3e635; margin-left: 0.2rem; }

    .gr-rentals { display: flex; flex-direction: column; gap: 0.45rem; }
    .gr-rental-row {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      font-size: 0.8rem; color: rgba(255,255,255,0.6);
      background: rgba(255,255,255,0.03); border-radius: 6px; padding: 0.4rem 0.6rem;
    }
    .gr-rental-rate { color: rgba(255,255,255,0.4); font-size: 0.76rem; }

    .gr-extra-fees { display: flex; flex-direction: column; gap: 0.45rem; }
    .gr-extra-fee-row {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      font-size: 0.8rem; color: rgba(255,255,255,0.6);
      background: rgba(255,255,255,0.03); border-radius: 6px; padding: 0.4rem 0.6rem;
    }
    .gr-extra-fee-required { display: flex; align-items: center; gap: 0.4rem; }
    .gr-required-badge { font-size: 0.68rem; background: rgba(163,230,53,0.15); color: #a3e635; border-radius: 4px; padding: 0.1rem 0.35rem; }
    .gr-extra-fee-amt { font-size: 0.8rem; color: rgba(255,255,255,0.5); white-space: nowrap; }

    .gr-file-label {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      cursor: pointer;
    }
    .gr-file-input { display: none; }
    .gr-file-btn {
      padding: 0.5rem 0.9rem;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .gr-file-label:hover .gr-file-btn { background: rgba(255,255,255,0.14); }
    .gr-file-label-error .gr-file-btn { border-color: #f87171; }
    .gr-file-name { font-size: 0.8rem; color: rgba(255,255,255,0.4); }

    .gr-payment-disclaimer {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #fff8e1;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 0.82rem;
      color: #78350f;
      margin-bottom: 12px;
    }
    .gr-payment-disclaimer i {
      margin-top: 2px;
      color: #f59e0b;
      flex-shrink: 0;
    }

    .gr-terms-notice {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      border: 1px solid rgba(248,113,113,.35);
      background: rgba(248,113,113,.08);
      color: #fca5a5;
      font-size: 0.82rem;
      font-weight: 700;
      line-height: 1.45;
    }
    .gr-terms-notice i { flex-shrink: 0; margin-top: 0.1rem; }
    .gr-terms-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .gr-terms-btn {
      background: none;
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.7);
      border-radius: 8px;
      padding: 0.45rem 0.9rem;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .gr-terms-btn:hover { border-color: #a3e635; color: #a3e635; }

    .gr-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .gr-modal-close {
      width: 38px;
      height: 38px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.68);
      font-size: 1rem;
      cursor: pointer;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .gr-modal-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

    .gr-terms-modal {
      background: #12251d;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      width: 100%;
      max-width: 660px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 28px 80px rgba(0,0,0,0.58);
    }
    .gr-terms-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.1rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background:
        linear-gradient(135deg, rgba(25,53,42,0.96), rgba(9,27,17,0.96)),
        url('/tennis-court-surface.png') center / cover;
      flex-shrink: 0;
      position: relative;
    }
    .gr-terms-modal-header::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7,19,13,0.08), rgba(7,19,13,0.68));
      pointer-events: none;
    }
    .gr-terms-modal-header > * { position: relative; z-index: 1; }
    .gr-terms-heading { display: flex; align-items: center; gap: 0.8rem; min-width: 0; }
    .gr-terms-heading-icon {
      width: 46px;
      height: 46px;
      border-radius: 8px;
      background: rgba(163,230,53,0.13);
      border: 1px solid rgba(163,230,53,0.22);
      color: #a3e635;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .gr-terms-modal-title { font-size: 1.08rem; line-height: 1.2; font-weight: 800; color: #fff; }
    .gr-terms-heading p { margin: 0.2rem 0 0; color: rgba(255,255,255,0.62); font-size: 0.8rem; line-height: 1.35; }
    .gr-terms-modal-body {
      flex: 1; overflow-y: auto; padding: 0.9rem;
      display: flex; flex-direction: column; gap: 0.75rem;
      scrollbar-width: thin;
      scrollbar-color: rgba(163,230,53,0.35) transparent;
    }
    .gr-terms-intro {
      font-size: 0.82rem; color: rgba(255,255,255,0.55); line-height: 1.55; margin: 0;
    }
    .gr-terms-callout {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: 0.65rem;
      align-items: center;
      padding: 0.68rem 0.8rem;
      border-radius: 8px;
      border: 1px solid rgba(163,230,53,0.18);
      background: rgba(163,230,53,0.08);
      color: rgba(255,255,255,0.78);
      font-size: 0.8rem;
      line-height: 1.42;
    }
    .gr-terms-callout i {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(163,230,53,0.15);
      color: #a3e635;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .gr-terms-item { display: flex; flex-direction: column; gap: 0.3rem; }
    .gr-terms-item-title { font-size: 0.85rem; font-weight: 700; color: #fff; }
    .gr-terms-item ul {
      margin: 0; padding: 0 0 0 1rem; list-style: disc;
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .gr-terms-item ul li { font-size: 0.8rem; color: rgba(255,255,255,0.55); line-height: 1.5; }
    .gr-terms-item p { font-size: 0.8rem; color: rgba(255,255,255,0.55); margin: 0; line-height: 1.5; }
    .gr-terms-golden {
      background: rgba(163,230,53,0.04);
      border: 1px solid rgba(163,230,53,0.12);
      border-radius: 10px;
      padding: 0.75rem 1rem;
    }
    .gr-terms-golden .gr-terms-item-title { color: #a3e635; }
    .gr-terms-footer-note {
      font-size: 0.78rem; color: rgba(255,255,255,0.35); line-height: 1.5;
      border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem; margin: 0;
    }
    .gr-terms-doc {
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      padding: 0.85rem;
    }
    .gr-terms-doc h1,
    .gr-terms-doc h2,
    .gr-terms-doc h3,
    .gr-terms-modal-body h1,
    .gr-terms-modal-body h2,
    .gr-terms-modal-body h3 {
      color: #a3e635;
      line-height: 1.25;
      margin: 1rem 0 0.35rem;
    }
    .gr-terms-doc h1:first-child,
    .gr-terms-doc h2:first-child,
    .gr-terms-doc h3:first-child {
      margin-top: 0;
    }
    .gr-terms-doc h1,
    .gr-terms-modal-body h1 {
      font-size: 1.05rem;
    }
    .gr-terms-doc h2,
    .gr-terms-modal-body h2 {
      font-size: 0.86rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .gr-terms-doc h3,
    .gr-terms-modal-body h3 {
      font-size: 0.84rem;
      font-weight: 800;
    }
    .gr-terms-doc p,
    .gr-terms-modal-body p {
      font-size: 0.83rem; color: rgba(255,255,255,0.66); margin: 0 0 0.55rem; line-height: 1.58;
    }
    .gr-terms-doc ul,
    .gr-terms-doc ol,
    .gr-terms-modal-body ul,
    .gr-terms-modal-body ol {
      margin: 0 0 0.55rem; padding: 0 0 0 1rem;
    }
    .gr-terms-doc li,
    .gr-terms-modal-body li {
      font-size: 0.82rem; color: rgba(255,255,255,0.64); line-height: 1.55; margin-bottom: 0.22rem;
    }
    .gr-terms-state {
      min-height: 180px;
      border: 1px dashed rgba(255,255,255,0.14);
      border-radius: 8px;
      color: rgba(255,255,255,0.58);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      text-align: center;
      padding: 1rem;
    }
    .gr-terms-state i { color: #fca5a5; font-size: 1.5rem; }
    .gr-terms-state strong { color: #fff; }
    .gr-terms-state span { font-size: 0.82rem; line-height: 1.4; }
    .gr-terms-modal-body a {
      color: #a3e635;
      text-decoration: none;
    }
    :host ::ng-deep .gr-terms-doc h1,
    :host ::ng-deep .gr-terms-doc h2,
    :host ::ng-deep .gr-terms-doc h3 {
      color: #e8f5e9;
      line-height: 1.22;
      margin: 0.95rem 0 0.35rem;
      font-weight: 800;
      letter-spacing: 0;
    }
    :host ::ng-deep .gr-terms-doc h1:first-child,
    :host ::ng-deep .gr-terms-doc h2:first-child,
    :host ::ng-deep .gr-terms-doc h3:first-child {
      margin-top: 0;
    }
    :host ::ng-deep .gr-terms-doc h1 {
      font-size: 1rem;
      color: #a3e635;
    }
    :host ::ng-deep .gr-terms-doc h2 {
      font-size: 0.96rem;
      color: #fff;
    }
    :host ::ng-deep .gr-terms-doc h3 {
      font-size: 0.9rem;
    }
    :host ::ng-deep .gr-terms-doc p {
      margin: 0 0 0.58rem;
      color: rgba(255,255,255,0.66);
      font-size: 0.84rem;
      line-height: 1.55;
      font-weight: 400;
    }
    :host ::ng-deep .gr-terms-doc ul,
    :host ::ng-deep .gr-terms-doc ol {
      margin: 0 0 0.65rem;
      padding-left: 1.1rem;
    }
    :host ::ng-deep .gr-terms-doc li {
      color: rgba(255,255,255,0.66);
      font-size: 0.84rem;
      line-height: 1.5;
      margin-bottom: 0.22rem;
    }
    :host ::ng-deep .gr-terms-doc strong {
      color: #fff;
      font-weight: 800;
    }
    :host ::ng-deep .gr-terms-doc em {
      color: rgba(255,255,255,0.72);
      font-style: normal;
    }
    :host ::ng-deep .gr-terms-doc hr {
      border: 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      margin: 0.9rem 0;
    }
    .gr-terms-modal-footer {
      padding: 0.9rem 1rem;
      border-top: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
      background: rgba(0,0,0,0.18);
    }
    .gr-terms-modal-footer p {
      margin: 0;
      color: rgba(255,255,255,0.48);
      font-size: 0.78rem;
      line-height: 1.35;
    }
    .gr-terms-modal-footer .gr-submit-btn {
      min-width: 150px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
    }

    .gr-select {
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.85rem center;
      cursor: pointer;
    }
    .gr-select option { background: #1b3028; color: #fff; }

    .gr-qr-block {
      background: rgba(26,120,194,0.06);
      border: 1px solid rgba(26,120,194,0.2);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
    }
    .gr-qr-label {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.45);
      align-self: flex-start;
    }
    .gr-qr-img {
      width: 100%;
      max-width: 200px;
      border-radius: 8px;
      display: block;
    }
    .gr-acct-rows {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .gr-acct-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 0.55rem 0.75rem;
      gap: 0.5rem;
    }
    .gr-acct-label {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.4);
      white-space: nowrap;
    }
    .gr-acct-value-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .gr-acct-value {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
      font-family: monospace;
      letter-spacing: 0.03em;
    }
    .gr-copy-btn {
      width: 28px; height: 28px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.5);
      font-size: 0.8rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .gr-copy-btn:hover { border-color: #a3e635; color: #a3e635; background: rgba(163,230,53,0.08); }
    .gr-dl-btn {
      width: 100%;
      padding: 0.65rem;
      background: #1a78c2;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
      letter-spacing: 0.02em;
    }
    .gr-dl-btn:hover { background: #1a6aad; }

    .gr-submit-btn {
      width: 100%; padding: 0.9rem;
      background: #a3e635; color: #0c1a11; border: none; border-radius: 10px;
      font-size: 0.95rem; font-weight: 700; letter-spacing: 0.04em; cursor: pointer;
      transition: background 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 18px rgba(163,230,53,0.25);
    }
    .gr-submit-btn:hover:not(:disabled) { background: #b5f040; box-shadow: 0 6px 24px rgba(163,230,53,0.38); }
    .gr-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }


    /* ── Responsive ── */
    @media (max-width: 960px) {
      .gr-layout { grid-template-columns: 1fr; }
      .gr-sidebar { position: static; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      .gr-booking-panel { grid-column: 1 / -1; }
      .gr-panel-body { max-height: none; }
    }
    @media (max-width: 600px) {
      .gr-body { padding: 1rem; }
      .gr-sidebar { grid-template-columns: 1fr; }
      .gr-modal-overlay { padding: 0; align-items: flex-end; }
      .gr-terms-modal {
        max-height: 92vh;
        border-radius: 14px 14px 0 0;
        border-left: 0;
        border-right: 0;
        border-bottom: 0;
      }
      .gr-terms-modal-header { padding: 0.9rem; }
      .gr-terms-heading { gap: 0.65rem; }
      .gr-terms-heading-icon { width: 40px; height: 40px; }
      .gr-terms-heading p { font-size: 0.76rem; }
      .gr-terms-modal-body { padding: 0.85rem; }
      .gr-terms-callout { grid-template-columns: 1fr; gap: 0.55rem; }
      .gr-terms-callout i { width: 30px; height: 30px; }
      .gr-terms-doc { padding: 0.82rem; }
      .gr-terms-modal-footer {
        grid-template-columns: 1fr;
        gap: 0.65rem;
      }
      .gr-terms-modal-footer .gr-submit-btn { width: 100%; }
    }
  `],
})
export class GuestReserveComponent implements OnInit, OnDestroy {

  clubId = '';
  clubName = '';
  clubLogo: string | null = null;
  clubLocation = '';
  clubMobile = '';
  clubEmail = '';
  clubSocial: { facebook?: string; instagram?: string; reclub?: string } = {};
  clubError = '';

  courtCount = signal(2);
  closingHour = 22;
  openingHour = 5;
  allSlots: string[] = hoursToSlots(5, 22);
  lightSlots = LIGHT_SLOTS;
  today = localDateStr();

  navDate = signal(localDateStr());
  availLoading = signal(true);
  courtAvailability = signal<Record<number, Set<string>>>({});
  clubPhotos = signal<string[]>([]);
  carouselIndex = signal(0);

  calendarOpen = signal(false);
  calendarViewYear = signal(new Date().getFullYear());
  calendarViewMonth = signal(new Date().getMonth());

  selectedCourt: number | null = null;
  selectedSlot = '';
  selectedDuration = 1;
  availableDurations: number[] = [];

  guestName = '';
  guestEmail = '';
  guestPhone = '';
  booking = false;
  errorMsg = '';
  guestSubmitted = false;
  confirmed = false;
  confirmationData: GuestBookingResult | null = null;

  convenienceFeeRate = 0.05;
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
  exclusiveEventEnabled = false;
  exclusiveEventRate = 0;
  exclusiveEventIncludedPax = 0;
  exclusiveEventExcessPaxFee = 0;
  exclusiveEventMaxPax = 0;
  exclusiveEventPolicies: string[] = [];
  bookingType: 'standard' | 'exclusive_event' = 'standard';
  policiesAcknowledged = false;
  coachingEnabled = false;
  coachingMinHours = 2;
  coachingMaxPax = 6;
  coachingRate1Pax = 0;
  coachingRate2Pax = 0;
  coachingRate3to6Pax = 0;
  coachingRequested = false;
  coachingPax = 1;
  rentalBalls50Rate = 0;
  rentalBalls100Rate = 0;
  rentalBallMachineRate = 0;
  rentalRacketRate = 0;

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

  get lightsRequested(): boolean {
    return this.lightHours > 0;
  }
  ballBoyRequested = false;
  isHoliday = false;
  guestCount = 0;
  rentalBalls50 = 0;
  rentalBalls100 = 0;
  rentalBallMachine = false;
  rentalRackets = 0;

  paymentMethods: string[] = [];
  paymentAccounts: Record<string, string> = {};
  paymentQrCodes: Record<string, string> = {};
  selectedPaymentMethod = '';
  copiedMethod = '';
  paymentScreenshot: File | null = null;
  requirePaymentScreenshot = false;
  agreedToTerms = false;
  showTerms = false;
  // Content is superadmin-managed — bypass sanitization for rendered markdown
  guestTermsHtml: SafeHtml = '';
  guestTermsNotification = '';
  termsLoadError = false;

  courtNumbers = computed(() => Array.from({ length: this.courtCount() }, (_, i) => i + 1));

  calendarMonthLabel = computed(() => {
    const d = new Date(this.calendarViewYear(), this.calendarViewMonth(), 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

  calendarDays = computed(() => {
    const year = this.calendarViewYear();
    const month = this.calendarViewMonth();
    const firstDay = new Date(year, month, 1);
    const startSunday = new Date(firstDay);
    startSunday.setDate(firstDay.getDate() - firstDay.getDay());
    const days: { dateStr: string; dayNum: number; inMonth: boolean; isPast: boolean; isToday: boolean; isSelected: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startSunday);
      d.setDate(startSunday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      days.push({
        dateStr,
        dayNum: d.getDate(),
        inMonth: d.getMonth() === month,
        isPast: dateStr < this.today,
        isToday: dateStr === this.today,
        isSelected: dateStr === this.navDate(),
      });
    }
    return days;
  });

  calPrevDisabled = computed(() => {
    const now = new Date();
    return this.calendarViewYear() === now.getFullYear() && this.calendarViewMonth() === now.getMonth();
  });

  get hasAnyRental(): boolean {
    return this.rentalBalls50Rate > 0 || this.rentalBalls100Rate > 0
      || this.rentalBallMachineRate > 0 || this.rentalRacketRate > 0;
  }

  get dayType(): 'weekday' | 'weekend' | 'holiday' {
    if (this.isHoliday) return 'holiday';
    const date = this.navDate();
    if (!date) return 'weekday';
    const day = new Date(date + 'T00:00:00Z').getUTCDay();
    return WEEKEND_DAYS.has(day) ? 'weekend' : 'weekday';
  }

  get baseHourlyRate(): number {
    switch (this.dayType) {
      case 'holiday': return this.holidayRate;
      case 'weekend': return this.weekendRate;
      default:        return this.weekdayRate;
    }
  }

  get effectiveHourlyRate(): number {
    return this.bookingType === 'exclusive_event' ? this.exclusiveEventRate : this.baseHourlyRate;
  }
  get baseCourtFee(): number { return this.effectiveHourlyRate * this.selectedDuration; }
  get chargeableGuests(): number { return Math.max(0, this.guestCount - this.guestFeeThreshold); }
  get totalGuestFee(): number {
    if (this.bookingType === 'exclusive_event') {
      return Math.max(0, this.guestCount - this.exclusiveEventIncludedPax) * this.exclusiveEventExcessPaxFee;
    }
    return this.chargeableGuests * this.guestFeeRate;
  }

  get totalRentalFee(): number {
    return (
      this.rentalBalls50 * this.rentalBalls50Rate +
      this.rentalBalls100 * this.rentalBalls100Rate +
      (this.rentalBallMachine ? this.rentalBallMachineRate : 0) +
      this.rentalRackets * this.rentalRacketRate
    ) * this.selectedDuration;
  }

  get subtotal(): number {
    return this.baseCourtFee
      + this.lightHours * this.lightsRate
      + (this.ballBoyRequested ? this.ballBoyRate * this.selectedDuration : 0)
      + this.totalGuestFee
      + this.totalRentalFee;
  }

  get convenienceFee(): number {
    if (this.convenienceFeeMode === 'monthly_flat' || this.convenienceFeeMode === 'club_absorbs') return 0;
    const base = this.convenienceFeeMode === 'per_transaction' ? this.effectiveHourlyRate : this.subtotal;
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
      if (this.selectedSlot && this.selectedCourt && this.isCoachingBlocked(this.selectedCourt, this.selectedSlot)) {
        this.selectedSlot = '';
        this.availableDurations = [];
        this.selectedDuration = this.coachingMinHours;
      }
    }
    this.cdr.detectChanges();
  }

  incCoachingPax() { if (this.coachingPax < this.coachingMaxPax) this.coachingPax++; }
  decCoachingPax() { if (this.coachingPax > 1) this.coachingPax--; }

  get computedFee(): number { return this.subtotal + this.convenienceFee + this.extraFeeTotal + this.coachingFee; }

  setBookingType(type: 'standard' | 'exclusive_event') {
    this.bookingType = type;
    this.guestCount = 0;
    this.policiesAcknowledged = false;
    if (type === 'exclusive_event') {
      this.selectedExtraFeeNames = new Set();
      this.coachingRequested = false;
    }
    this.cdr.detectChanges();
  }

  incrementGuestCount() {
    const max = this.bookingType === 'exclusive_event' && this.exclusiveEventMaxPax > 0
      ? this.exclusiveEventMaxPax : Infinity;
    if (this.guestCount < max) this.guestCount++;
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

  get endSlotLabel(): string {
    if (!this.selectedSlot) return '';
    return hourToSlot(slotToHour(this.selectedSlot) + this.selectedDuration);
  }

  get confirmTimeLabel(): string {
    if (!this.confirmationData) return '';
    const slot = this.confirmationData.reservation.timeSlot;
    const d = this.confirmationData.reservation.durationHours ?? 1;
    return `${slot} – ${hourToSlot(slotToHour(slot) + d)}`;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicBookingService: PublicBookingService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private cloudinaryService: CloudinaryService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');

    this.clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
    if (!this.clubId) { this.clubError = 'Invalid booking link.'; return; }

    this.publicBookingService.getClub(this.clubId).subscribe({
      next: (club) => {
        if (club.status === 'suspended') {
          this.clubError = 'This club is currently unavailable for bookings.';
        } else {
          this.clubName = club.name;
          this.clubLogo = club.logo ?? null;
          this.clubLocation = club.location ?? '';
          this.clubMobile = club.mobile ?? '';
          this.clubEmail = club.email ?? '';
          this.clubSocial = club.socialLinks ?? {};
          this.courtCount.set(club.courtCount ?? 2);
          this.closingHour = club.closingHour ?? 22;
          this.openingHour = club.openingHour ?? 5;
          this.allSlots = hoursToSlots(this.openingHour, this.closingHour);
          this.paymentMethods = club.paymentMethods ?? [];
          this.paymentAccounts = club.paymentAccounts ?? {};
          this.paymentQrCodes = club.paymentQrCodes ?? {};
          this.convenienceFeeRate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.10;
          this.convenienceFeeMode = club.convenienceFeeMode ?? 'per_hour';
          this.availableExtraFees = (club.additionalFees ?? []).filter(f => f.isEnabled);
          this.selectedExtraFeeNames = new Set(
            this.availableExtraFees.filter(f => !f.isOptional).map(f => f.name)
          );
          this.requirePaymentScreenshot = club.requirePaymentScreenshot ?? false;
          this.clubPhotos.set(club.photos ?? []);
          if (club.guestTermsText) {
            const html = marked.parse(club.guestTermsText) as string;
            this.guestTermsHtml = this.sanitizer.bypassSecurityTrustHtml(html);
          }
          this.guestTermsNotification = club.guestTermsNotification ?? '';
          this.loadAvailability();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.clubError = 'Club not found. Please check your booking link.';
        this.cdr.detectChanges();
      },
    });

    this.publicBookingService.getRates(this.clubId).subscribe({
      next: (rates: PublicRates) => {
        this.weekdayRate = rates.reservationWeekdayRate ?? 0;
        this.weekendRate = rates.reservationWeekendRate ?? 0;
        this.holidayRate = rates.reservationHolidayRate ?? 0;
        this.lightsRate = rates.lightRate ?? 0;
        this.ballBoyRate = rates.ballBoyRate ?? 0;
        this.guestFeeRate = rates.reservationGuestFee ?? 0;
        this.guestFeeThreshold = rates.reservationGuestFeeThreshold ?? 0;
        this.exclusiveEventEnabled = rates.exclusiveEventEnabled ?? false;
        this.exclusiveEventRate = rates.exclusiveEventRate ?? 0;
        this.exclusiveEventIncludedPax = rates.exclusiveEventIncludedPax ?? 0;
        this.exclusiveEventExcessPaxFee = rates.exclusiveEventExcessPaxFee ?? 0;
        this.exclusiveEventMaxPax = rates.exclusiveEventMaxPax ?? 0;
        this.exclusiveEventPolicies = rates.exclusiveEventPolicies ?? [];
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
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  loadAvailability() {
    if (!this.clubId || !this.navDate()) return;
    this.availLoading.set(true);
    this.courtAvailability.set({});
    this.publicBookingService.getAllCourtAvailability(this.clubId, this.navDate()).subscribe({
      next: (res) => {
        const map: Record<number, Set<string>> = {};
        for (const key of Object.keys(res)) {
          map[Number(key)] = new Set(res[key]);
        }
        this.courtAvailability.set(map);
        this.availLoading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.availLoading.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  cellState(court: number, slot: string): 'available' | 'booked' | 'selected' | 'in-range' {
    const avail = this.courtAvailability();
    if (avail[court]?.has(slot)) return 'booked';
    if (this.selectedCourt === court && this.selectedSlot === slot) return 'selected';
    if (this.selectedCourt === court && this.selectedSlot) {
      const startH = slotToHour(this.selectedSlot);
      const h = slotToHour(slot);
      if (h > startH && h < startH + this.selectedDuration) return 'in-range';
    }
    return 'available';
  }

  onCellClick(court: number, slot: string) {
    if (this.cellState(court, slot) === 'booked') return;
    if (this.coachingRequested && this.isCoachingBlocked(court, slot)) return;

    // Clicking the selected slot deselects (keep court, just clear slot)
    if (this.selectedCourt === court && this.selectedSlot === slot) {
      this.selectedSlot = '';
      this.selectedDuration = 1;
      this.availableDurations = [];
      this.errorMsg = '';
      this.cdr.detectChanges();
      return;
    }

    // New selection
    this.selectedCourt = court;
    this.selectedSlot = slot;
    this.selectedDuration = this.coachingRequested ? this.coachingMinHours : 1;
    this.errorMsg = '';
    this.computeAvailableDurations();
    this.cdr.detectChanges();
  }

  isCoachingBlocked(court: number, slot: string): boolean {
    if (!this.coachingRequested || this.coachingMinHours <= 1) return false;
    const bookedSet = this.courtAvailability()[court] ?? new Set<string>();
    const startH = slotToHour(slot);
    for (let i = 0; i < this.coachingMinHours; i++) {
      const h = startH + i;
      if (h > this.closingHour) return true;
      if (bookedSet.has(hourToSlot(h))) return true;
    }
    return false;
  }

  computeAvailableDurations() {
    if (!this.selectedSlot || !this.selectedCourt) { this.availableDurations = []; return; }
    const bookedSet = this.courtAvailability()[this.selectedCourt] ?? new Set<string>();
    const startH = slotToHour(this.selectedSlot);
    const durations: number[] = [];
    for (let d = 1; d <= 12; d++) {
      const endH = startH + d - 1;
      if (endH > this.closingHour) break;
      if (d > 1 && bookedSet.has(hourToSlot(endH))) break;
      durations.push(d);
    }
    this.availableDurations = durations;
  }

  setDuration(d: number) {
    if (this.coachingRequested && d < this.coachingMinHours) return;
    this.selectedDuration = d;
    this.cdr.detectChanges();
  }

  clearSelection() {
    this.selectedCourt = null;
    this.selectedSlot = '';
    this.selectedDuration = 1;
    this.availableDurations = [];
    this.errorMsg = '';
    this.selectedPaymentMethod = '';
    this.paymentScreenshot = null;
    this.agreedToTerms = false;
    this.showTerms = false;
    this.cdr.detectChanges();
  }

  prevDay() {
    if (this.navDate() <= this.today) return;
    this.navDate.set(addDays(this.navDate(), -1));
    this.clearSelection();
    this.loadAvailability();
  }

  nextDay() {
    this.navDate.set(addDays(this.navDate(), 1));
    this.clearSelection();
    this.loadAvailability();
  }

  goToday() {
    this.navDate.set(this.today);
    this.clearSelection();
    this.loadAvailability();
  }

  toggleCalendar() {
    if (!this.calendarOpen()) {
      const d = new Date(this.navDate() + 'T00:00:00');
      this.calendarViewYear.set(d.getFullYear());
      this.calendarViewMonth.set(d.getMonth());
    }
    this.calendarOpen.set(!this.calendarOpen());
    this.cdr.detectChanges();
  }

  calPrevMonth() {
    if (this.calPrevDisabled()) return;
    let m = this.calendarViewMonth() - 1;
    let y = this.calendarViewYear();
    if (m < 0) { m = 11; y--; }
    this.calendarViewMonth.set(m);
    this.calendarViewYear.set(y);
    this.cdr.detectChanges();
  }

  calNextMonth() {
    let m = this.calendarViewMonth() + 1;
    let y = this.calendarViewYear();
    if (m > 11) { m = 0; y++; }
    this.calendarViewMonth.set(m);
    this.calendarViewYear.set(y);
    this.cdr.detectChanges();
  }

  selectCalDate(dateStr: string) {
    if (dateStr < this.today) return;
    this.navDate.set(dateStr);
    this.calendarOpen.set(false);
    this.clearSelection();
    this.loadAvailability();
    this.cdr.detectChanges();
  }

  onDateInputChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (!val || val < this.today) return;
    this.navDate.set(val);
    this.clearSelection();
    this.loadAvailability();
    this.cdr.detectChanges();
  }

  selectCourtLeft(n: number) {
    if (this.selectedCourt === n) return;
    this.selectedCourt = n;
    this.selectedSlot = '';
    this.selectedDuration = this.coachingRequested ? this.coachingMinHours : 1;
    this.availableDurations = [];
    this.cdr.detectChanges();
  }

  prevPhoto() {
    const len = this.clubPhotos().length;
    this.carouselIndex.set((this.carouselIndex() - 1 + len) % len);
  }

  nextPhoto() {
    this.carouselIndex.set((this.carouselIndex() + 1) % this.clubPhotos().length);
  }

  formatSlotLabel(slot: string): string {
    const h = slotToHour(slot);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const period = h < 12 ? 'AM' : 'PM';
    return `${h12}:00 ${period}`;
  }

  goBack() { this.router.navigate(['/book', this.clubId]); }

  agreeAndClose() {
    this.agreedToTerms = true;
    this.showTerms = false;
    this.cdr.detectChanges();
  }

  onScreenshotChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.paymentScreenshot = input.files?.[0] ?? null;
    this.cdr.detectChanges();
  }

  copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      this.copiedMethod = this.selectedPaymentMethod;
      setTimeout(() => { this.copiedMethod = ''; this.cdr.detectChanges(); }, 2000);
      this.cdr.detectChanges();
    });
  }

  downloadQr(method: string) {
    const url = this.paymentQrCodes[method];
    if (!url) return;
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${method}-qr.png`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  }

  shareBooking() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `Book at ${this.clubName}`, url });
    } else {
      navigator.clipboard?.writeText(url);
    }
  }

  resetBooking() {
    this.confirmed = false;
    this.confirmationData = null;
    this.selectedCourt = null;
    this.selectedSlot = '';
    this.guestName = '';
    this.guestEmail = '';
    this.guestPhone = '';
    this.selectedPaymentMethod = '';
    this.paymentScreenshot = null;
    this.agreedToTerms = false;
    this.showTerms = false;
    this.bookingType = 'standard';
    this.policiesAcknowledged = false;
    this.guestCount = 0;
    this.coachingRequested = false;
    this.coachingPax = 1;
    this.selectedExtraFeeNames = new Set(
      this.availableExtraFees.filter(f => !f.isOptional).map(f => f.name)
    );
    this.loadAvailability();
    this.cdr.detectChanges();
  }

  async submit() {
    this.guestSubmitted = true;
    this.cdr.detectChanges();
    if (!this.navDate() || !this.selectedCourt || !this.selectedSlot) return;
    if (!this.guestName.trim() || !this.guestEmail.trim() || !this.agreedToTerms) return;
    if (this.paymentMethods.length > 0 && !this.selectedPaymentMethod) return;
    if (this.requirePaymentScreenshot && !this.paymentScreenshot) return;
    if (this.bookingType === 'exclusive_event' && !this.policiesAcknowledged) {
      this.errorMsg = 'Please acknowledge the event policies before confirming.';
      return;
    }
    this.guestSubmitted = false;
    this.booking = true;
    this.errorMsg = '';

    let paymentScreenshotUrl: string | undefined;
    if (this.paymentScreenshot) {
      try {
        paymentScreenshotUrl = await this.cloudinaryService.uploadImage(this.paymentScreenshot, `payment-screenshots/${this.clubId}`);
      } catch {
        this.booking = false;
        this.errorMsg = 'Failed to upload payment screenshot. Please try again.';
        this.cdr.detectChanges();
        return;
      }
    }

    const payload = {
      court: this.selectedCourt as number,
      date: this.navDate(),
      timeSlot: this.selectedSlot,
      durationHours: this.selectedDuration,
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
      guestInfo: {
        name: this.guestName.trim(),
        email: this.guestEmail.trim(),
        phone: this.guestPhone.trim() || undefined,
      },
      selectedExtraFeeNames: this.bookingType === 'exclusive_event' ? [] : [...this.selectedExtraFeeNames],
      bookingType: this.bookingType,
      coachingRequested: this.bookingType === 'exclusive_event' ? false : this.coachingRequested,
      coachingPax: this.coachingPax,
      paymentScreenshot: paymentScreenshotUrl,
    };
    console.log('[GuestReserve] submit payload:', payload);

    this.publicBookingService.createGuestBooking(this.clubId, payload).subscribe({
      next: (result) => {
        this.booking = false;
        this.confirmationData = result;
        this.confirmed = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.booking = false;
        console.error('[GuestReserve] booking error:', err?.status, err?.error);
        if (err?.status === 409) {
          this.errorMsg = 'That slot was just booked by someone else. Please choose another time.';
        } else {
          this.errorMsg = err?.error?.error || 'Failed to submit booking. Please try again.';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
