import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PublicBookingService, PublicRates, GuestBookingResult } from '../../../core/services/public-booking.service';

const LIGHT_SLOTS = new Set(['5am','6pm','7pm','8pm','9pm']);
const WEEKEND_DAYS = new Set([0, 5, 6]);

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
    slots.push(`${h12}${h < 12 ? 'am' : 'pm'}`);
  }
  return slots;
}
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().split('T')[0];
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

            <!-- LEFT: date nav + grid -->
            <div class="gr-left">
              <div class="gr-date-nav">
                <button class="gr-nav-btn" (click)="prevDay()" [disabled]="navDate() <= today">&#8249;</button>
                <div class="gr-date-label">{{ navDate() | date: 'EEEE, MMMM d, y' : 'UTC' }}</div>
                <button class="gr-nav-btn" (click)="nextDay()">&#8250;</button>
                @if (navDate() !== today) {
                  <button class="gr-today-btn" (click)="goToday()">Today</button>
                }
              </div>

              <div class="gr-legend">
                <span class="gr-legend-item gr-leg-available">Available</span>
                <span class="gr-legend-item gr-leg-selected">Selected</span>
                <span class="gr-legend-item gr-leg-booked">Booked</span>
                <span class="gr-legend-item gr-leg-lights">&#128161; Lights slot</span>
              </div>

              @if (availLoading()) {
                <div class="gr-grid-loading">
                  <div class="gr-spinner"></div> Checking availability…
                </div>
              } @else {
                <div class="gr-grid-wrap">
                  <table class="gr-grid">
                    <thead>
                      <tr>
                        <th class="gr-time-col">Time</th>
                        @for (c of courtNumbers(); track c) {
                          <th class="gr-court-col">Court {{ c }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (slot of allSlots; track slot) {
                        <tr [class.gr-lights-row]="lightSlots.has(slot)">
                          <td class="gr-time-cell">
                            {{ formatSlotLabel(slot) }}
                            @if (lightSlots.has(slot)) { <span class="gr-light-dot">&#128161;</span> }
                          </td>
                          @for (c of courtNumbers(); track c) {
                            <td
                              class="gr-cell"
                              [class.gr-cell-available]="cellState(c, slot) === 'available'"
                              [class.gr-cell-selected]="cellState(c, slot) === 'selected'"
                              [class.gr-cell-in-range]="cellState(c, slot) === 'in-range'"
                              [class.gr-cell-booked]="cellState(c, slot) === 'booked'"
                              (click)="onCellClick(c, slot)"
                            >
                              @if (cellState(c, slot) === 'booked') { <span>&#10005;</span> }
                              @else if (cellState(c, slot) === 'selected') { <span>&#9679;</span> }
                              @else if (cellState(c, slot) === 'in-range') { <span class="gr-range-line"></span> }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
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
                        {{ selectedSlot }}{{ selectedDuration > 1 ? ' – ' + endSlotLabel : '' }}
                      </span>
                      <span class="gr-slot-badge gr-slot-badge-date">{{ navDate() | date: 'MMM d' : 'UTC' }}</span>
                    </div>

                    <!-- Toggles -->
                    <div class="gr-toggles-row">
                      <label class="gr-toggle-item">
                        <input type="checkbox" [(ngModel)]="lightsRequested" />
                        <span>&#128161; Lights</span>
                      </label>
                      @if (holidayRate > 0) {
                        <label class="gr-toggle-item">
                          <input type="checkbox" [(ngModel)]="isHoliday" />
                          <span>&#127958; Holiday</span>
                        </label>
                      }
                      @if (ballBoyRate > 0) {
                        <label class="gr-toggle-item">
                          <input type="checkbox" [(ngModel)]="ballBoyRequested" />
                          <span>&#127934; Ball Boy</span>
                        </label>
                      }
                    </div>

                    <!-- Guests -->
                    @if (guestFeeRate > 0) {
                      <div class="gr-field-group">
                        <label class="gr-field-label">Non-member guests</label>
                        <div class="gr-counter">
                          <button type="button" class="gr-count-btn" (click)="guestCount = guestCount > 0 ? guestCount - 1 : 0">&#8722;</button>
                          <span class="gr-count-val">{{ guestCount }}</span>
                          <button type="button" class="gr-count-btn" (click)="guestCount = guestCount + 1">&#43;</button>
                          @if (guestCount > 0) { <span class="gr-count-fee">{{ totalGuestFee | currency: 'PHP' : 'symbol' }}</span> }
                        </div>
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

                    <!-- Price summary -->
                    <div class="gr-sum-block">
                      <div class="gr-sum-row">
                        <span>Subtotal</span>
                        <strong>{{ subtotal | currency: 'PHP' : 'symbol' }}</strong>
                      </div>
                      <div class="gr-sum-row">
                        <span>Convenience fee <span class="gr-sum-pct">({{ (convenienceFeeRate * 100) | number: '1.0-2' }}%)</span></span>
                        <strong>{{ convenienceFee | currency: 'PHP' : 'symbol' }}</strong>
                      </div>
                      <div class="gr-sum-total-row">
                        <span>Total:</span>
                        <strong class="gr-total-amt">{{ computedFee | currency: 'PHP' : 'symbol' }}</strong>
                      </div>
                    </div>

                    <!-- Guest info -->
                    @if (errorMsg) {
                      <div class="gr-alert-error">&#9888; {{ errorMsg }}</div>
                    }

                    <div class="gr-field-group">
                      <label class="gr-field-label">Full name *</label>
                      <input type="text" class="gr-input" placeholder="Full name" [(ngModel)]="guestName" />
                    </div>
                    <div class="gr-field-group">
                      <label class="gr-field-label">Email *</label>
                      <input type="email" class="gr-input" placeholder="Email" [(ngModel)]="guestEmail" />
                    </div>
                    <div class="gr-field-group">
                      <label class="gr-field-label">Phone <span class="gr-optional">optional</span></label>
                      <input type="tel" class="gr-input" placeholder="Phone" [(ngModel)]="guestPhone" />
                    </div>

                    <!-- Payment Method -->
                    @if (paymentMethods.length > 0) {
                      <div class="gr-field-group">
                        <label class="gr-field-label">Payment method *</label>
                        <select class="gr-input gr-select" [(ngModel)]="selectedPaymentMethod">
                          <option value="" disabled>Select payment method</option>
                          @for (method of paymentMethods; track method) {
                            <option [value]="method">{{ method }}</option>
                          }
                        </select>
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

                    <!-- Payment screenshot -->
                    <div class="gr-field-group">
                      <label class="gr-field-label">Payment screenshot <span class="gr-optional">optional</span></label>
                      <label class="gr-file-label">
                        <input type="file" accept="image/*" class="gr-file-input" (change)="onScreenshotChange($event)" />
                        <span class="gr-file-btn">Choose File</span>
                        <span class="gr-file-name">{{ paymentScreenshot ? paymentScreenshot.name : 'No file chosen' }}</span>
                      </label>
                    </div>

                    <!-- Terms -->
                    <div class="gr-terms-row">
                      <button type="button" class="gr-terms-btn" (click)="showTerms = !showTerms">
                        View Terms &amp; Conditions
                      </button>
                      <label class="gr-toggle-item">
                        <input type="checkbox" [(ngModel)]="agreedToTerms" />
                        <span>I agree</span>
                      </label>
                    </div>

                  </div><!-- /gr-panel-body -->

                  <div class="gr-panel-footer">
                    <button class="gr-submit-btn" [disabled]="booking || !guestName || !guestEmail || !agreedToTerms" (click)="submit()">
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
                  <div class="gr-info-row"><span class="gr-info-icon">&#127955;</span><span>{{ courtCount }} court{{ courtCount !== 1 ? 's' : '' }}</span></div>
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
                  <div class="gr-info-hint">&#8592; Click a slot on the grid to book</div>
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
              <div class="gr-terms-modal-title">Terms &amp; Conditions</div>
              <button class="gr-modal-close" (click)="showTerms = false">&#10005;</button>
            </div>
            <div class="gr-terms-modal-body">
              <p class="gr-terms-intro">By proceeding with your booking, you confirm that you have read, understood, and agreed to follow the rules outlined below. Any violation may result in actions such as removal from the premises, penalties, or suspension of access, as determined by management.</p>

              <div class="gr-terms-item">
                <div class="gr-terms-item-title">1. Respect the Court</div>
                <p>Please treat the court, equipment, and other players with courtesy and care at all times. Unsportsmanlike conduct will not be tolerated.</p>
              </div>
              <div class="gr-terms-item">
                <div class="gr-terms-item-title">2. No Smoking &#128683;</div>
                <p>Smoking is strictly prohibited within the court premises.</p>
              </div>
              <div class="gr-terms-item">
                <div class="gr-terms-item-title">3. Clean As You Go (CLAYGO) &#128465;</div>
                <p>Dispose of all trash properly and help maintain cleanliness. Kindly leave the court in better condition than you found it.</p>
              </div>
              <div class="gr-terms-item">
                <div class="gr-terms-item-title">4. Court Time &#9200;</div>
                <p>Please be ready to play at your scheduled time. Delays or late arrivals will still be counted within your reserved slot.</p>
              </div>
              <div class="gr-terms-item">
                <div class="gr-terms-item-title">5. Proper Footwear &#128099;</div>
                <p>Players are encouraged to wear non-marking sports shoes to ensure safety and protect the court surface.</p>
              </div>
              <div class="gr-terms-item">
                <div class="gr-terms-item-title">6. Play with Respect &amp; Enjoyment &#127859;</div>
                <p>Play responsibly, keep the competition friendly, and avoid unnecessary conflicts. Let's keep the atmosphere fun and welcoming for everyone.</p>
              </div>
              <div class="gr-terms-item">
                <div class="gr-terms-item-title">7. Share the Court &#10084;</div>
                <p>Support fellow players, keep disagreements respectful, and remember that everyone is here to enjoy the game.</p>
              </div>

              <p class="gr-terms-footer-note">By continuing with your booking, you acknowledge and accept these terms. Management reserves the right to enforce rules and apply appropriate consequences for any violations.</p>
            </div>
            <div class="gr-terms-modal-footer">
              <button class="gr-submit-btn" (click)="agreeAndClose()">I Agree</button>
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

    /* ── Date nav ── */
    .gr-date-nav {
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 1rem; flex-wrap: wrap;
    }
    .gr-nav-btn {
      width: 36px; height: 36px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      color: #fff; border-radius: 8px; font-size: 1.25rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .gr-nav-btn:hover:not(:disabled) { border-color: #a3e635; background: rgba(163,230,53,0.08); }
    .gr-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .gr-date-label { font-size: 1rem; font-weight: 600; color: #fff; flex: 1; min-width: 180px; }
    .gr-today-btn {
      background: rgba(163,230,53,0.1); border: 1px solid rgba(163,230,53,0.25);
      color: #a3e635; border-radius: 8px; padding: 0.35rem 0.8rem;
      font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: background 0.15s;
    }
    .gr-today-btn:hover { background: rgba(163,230,53,0.2); }

    /* ── Legend ── */
    .gr-legend { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.9rem; }
    .gr-legend-item { font-size: 0.74rem; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 600; }
    .gr-leg-available { background: #1a7a72; color: #fff; }
    .gr-leg-selected { background: rgba(26,120,194,0.25); color: #5bb8f5; border: 1px solid #1a78c2; }
    .gr-leg-booked { background: rgba(239,68,68,0.2); color: #f87171; }
    .gr-leg-lights { background: rgba(255,200,0,0.08); color: rgba(255,220,80,0.8); }

    /* ── Loading ── */
    .gr-grid-loading {
      display: flex; align-items: center; gap: 0.75rem;
      color: rgba(255,255,255,0.45); font-size: 0.875rem; padding: 2rem 0;
    }
    .gr-spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(163,230,53,0.2); border-top-color: #a3e635;
      border-radius: 50%; animation: gr-spin 0.7s linear infinite;
    }
    @keyframes gr-spin { to { transform: rotate(360deg); } }

    /* ── Grid ── */
    .gr-grid-wrap {
      overflow-x: auto; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .gr-grid { width: 100%; border-collapse: collapse; min-width: 320px; }
    .gr-grid thead th {
      background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5);
      font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; padding: 0.65rem 0.5rem; text-align: center; white-space: nowrap;
    }
    .gr-time-col { width: 90px; text-align: left !important; padding-left: 0.75rem !important; }
    .gr-court-col { min-width: 80px; }
    .gr-time-cell {
      padding: 0 0.75rem; font-size: 0.75rem; color: rgba(255,255,255,0.4);
      white-space: nowrap; text-align: left;
    }
    .gr-light-dot { margin-left: 2px; font-size: 0.68rem; opacity: 0.7; }
    .gr-cell {
      height: 52px; text-align: center; vertical-align: middle;
      border-top: 3px solid rgba(0,0,0,0.35);
      border-left: 2px solid rgba(0,0,0,0.2);
      font-size: 0.82rem; cursor: pointer;
      transition: background 0.12s;
      background: rgba(255,255,255,0.01);
    }
    .gr-lights-row .gr-time-cell { color: rgba(255,220,80,0.55); }
    .gr-cell-available { background: #1a7a72; color: rgba(255,255,255,0.0); }
    .gr-cell-available:hover { background: #1f9089; color: rgba(255,255,255,0.8); }
    .gr-cell-selected {
      background: #1a78c2 !important; color: #fff;
      border: 1px solid rgba(255,255,255,0.6) !important; cursor: default;
    }
    .gr-cell-in-range {
      background: #1a78c2 !important; color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.6) !important; cursor: default;
    }
    .gr-range-line {
      display: block; width: 16px; height: 2px;
      background: rgba(255,255,255,0.5); margin: 0 auto;
    }
    .gr-cell-booked {
      background: rgba(239,68,68,0.18) !important;
      color: rgba(239,68,68,0.75); cursor: not-allowed;
    }

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

    /* Price summary */
    .gr-sum-block {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; padding: 0.85rem 1rem;
    }
    .gr-sum-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.82rem; color: rgba(255,255,255,0.5); padding: 0.2rem 0;
    }
    .gr-sum-pct { font-size: 0.72rem; opacity: 0.7; }
    .gr-sum-total-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 0.5rem; padding-top: 0.5rem;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 0.9rem; color: rgba(255,255,255,0.7);
    }
    .gr-total-amt { color: #a3e635; font-size: 1.1rem; font-weight: 700; }

    /* Form fields */
    .gr-alert-error {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);
      color: #fca5a5; border-radius: 8px; padding: 0.65rem 0.85rem; font-size: 0.83rem;
    }
    .gr-field-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .gr-field-label {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; color: rgba(255,255,255,0.4);
    }
    .gr-optional { font-weight: 400; text-transform: none; letter-spacing: 0; color: rgba(255,255,255,0.25); }
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

    .gr-toggles-row { display: flex; flex-wrap: wrap; gap: 0.65rem; }
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
    .gr-file-name { font-size: 0.8rem; color: rgba(255,255,255,0.4); }

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
      background: none; border: none;
      color: rgba(255,255,255,0.4); font-size: 1rem;
      cursor: pointer; padding: 0.2rem; border-radius: 4px;
      transition: color 0.15s;
    }
    .gr-modal-close:hover { color: #fff; }

    .gr-terms-modal {
      background: #1b3028;
      border: 1px solid rgba(163,230,53,0.15);
      border-radius: 16px;
      width: 100%;
      max-width: 560px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .gr-terms-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.1rem 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .gr-terms-modal-title { font-size: 1.05rem; font-weight: 700; color: #fff; }
    .gr-terms-modal-body {
      flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 0.9rem;
    }
    .gr-terms-intro {
      font-size: 0.82rem; color: rgba(255,255,255,0.55); line-height: 1.55; margin: 0;
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
    .gr-terms-modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
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

  courtCount = 2;
  closingHour = 22;
  openingHour = 5;
  allSlots: string[] = hoursToSlots(5, 22);
  lightSlots = LIGHT_SLOTS;
  today = new Date().toISOString().split('T')[0];

  navDate = signal(new Date().toISOString().split('T')[0]);
  availLoading = signal(true);
  courtAvailability = signal<Record<number, Set<string>>>({});
  clubPhotos = signal<string[]>([]);
  carouselIndex = signal(0);

  selectedCourt: number | null = null;
  selectedSlot = '';
  selectedDuration = 1;
  availableDurations: number[] = [];

  guestName = '';
  guestEmail = '';
  guestPhone = '';
  booking = false;
  errorMsg = '';
  confirmed = false;
  confirmationData: GuestBookingResult | null = null;

  convenienceFeeRate = 0.05;
  convenienceFeeMode: 'per_transaction' | 'per_hour' = 'per_hour';
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

  lightsRequested = false;
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
  agreedToTerms = false;
  showTerms = false;

  courtNumbers = computed(() => Array.from({ length: this.courtCount }, (_, i) => i + 1));

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

  get baseCourtFee(): number { return this.baseHourlyRate * this.selectedDuration; }
  get totalGuestFee(): number { return this.guestCount * this.guestFeeRate; }

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
      + (this.lightsRequested ? this.lightsRate * this.selectedDuration : 0)
      + (this.ballBoyRequested ? this.ballBoyRate * this.selectedDuration : 0)
      + this.totalGuestFee
      + this.totalRentalFee;
  }

  get convenienceFee(): number {
    const base = this.convenienceFeeMode === 'per_transaction' ? this.baseHourlyRate : this.subtotal;
    return parseFloat((base * this.convenienceFeeRate).toFixed(2));
  }

  get computedFee(): number { return this.subtotal + this.convenienceFee; }

  get endSlotLabel(): string {
    if (!this.selectedSlot) return '';
    return hourToSlot(slotToHour(this.selectedSlot) + this.selectedDuration);
  }

  get confirmTimeLabel(): string {
    if (!this.confirmationData) return '';
    const slot = this.confirmationData.reservation.timeSlot;
    const d = this.confirmationData.reservation.durationHours ?? 1;
    return d <= 1 ? slot : `${slot} – ${hourToSlot(slotToHour(slot) + d)}`;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicBookingService: PublicBookingService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
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
          this.courtCount = club.courtCount ?? 2;
          this.closingHour = club.closingHour ?? 22;
          this.openingHour = club.openingHour ?? 5;
          this.allSlots = hoursToSlots(this.openingHour, this.closingHour);
          this.paymentMethods = club.paymentMethods ?? [];
          this.paymentAccounts = club.paymentAccounts ?? {};
          this.paymentQrCodes = club.paymentQrCodes ?? {};
          this.convenienceFeeRate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.10;
          this.convenienceFeeMode = club.convenienceFeeMode ?? 'per_hour';
          this.clubPhotos.set(club.photos ?? []);
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
        this.rentalBalls50Rate = rates.rentalBalls50Rate ?? 0;
        this.rentalBalls100Rate = rates.rentalBalls100Rate ?? 0;
        this.rentalBallMachineRate = rates.rentalBallMachineRate ?? 0;
        this.rentalRacketRate = rates.rentalRacketRate ?? 0;
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

    // Clicking the selected slot deselects
    if (this.selectedCourt === court && this.selectedSlot === slot) {
      this.clearSelection();
      return;
    }

    // Same court + slot after start → extend/shrink duration by clicking
    if (this.selectedCourt === court && this.selectedSlot) {
      const startH = slotToHour(this.selectedSlot);
      const clickH = slotToHour(slot);
      if (clickH > startH) {
        const newDur = clickH - startH + 1;
        if (this.availableDurations.includes(newDur)) {
          this.selectedDuration = newDur;
          this.errorMsg = '';
          this.cdr.detectChanges();
          return;
        }
      }
    }

    // New selection
    this.selectedCourt = court;
    this.selectedSlot = slot;
    this.selectedDuration = 1;
    this.errorMsg = '';
    this.computeAvailableDurations();
    this.cdr.detectChanges();
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

  setDuration(d: number) { this.selectedDuration = d; this.cdr.detectChanges(); }

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
    this.loadAvailability();
    this.cdr.detectChanges();
  }

  submit() {
    if (!this.navDate() || !this.selectedCourt || !this.selectedSlot) return;
    if (!this.guestName.trim() || !this.guestEmail.trim()) {
      this.errorMsg = 'Please fill in your name and email.';
      return;
    }
    this.booking = true;
    this.errorMsg = '';

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
