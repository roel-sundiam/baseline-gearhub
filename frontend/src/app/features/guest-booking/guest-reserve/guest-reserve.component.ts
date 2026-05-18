import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PublicBookingService, PublicRates, GuestBookingResult } from '../../../core/services/public-booking.service';

const ALL_SLOTS = [
  '5am','6am','7am','8am','9am','10am','11am',
  '12pm','1pm','2pm','3pm','4pm','5pm',
  '6pm','7pm','8pm','9pm','10pm',
];
const LIGHT_SLOTS = new Set(['5am','6pm','7pm','8pm','9pm']);
const WEEKEND_DAYS = new Set([0, 5, 6]);

@Component({
  selector: 'app-guest-reserve',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="gb-shell">
      <header class="gb-header">
        <div class="gb-header-inner">
          <button class="gb-back-btn" (click)="goBack()" title="Back to club page">
            <i class="fas fa-arrow-left"></i>
          </button>
          @if (clubLogo) {
            <img class="gb-club-logo" [src]="clubLogo" [alt]="clubName" />
          } @else {
            <img class="gb-cg-icon" src="/CG.png" alt="CourtGo" />
          }
          <div>
            <div class="gb-club-name">{{ clubName || 'Loading…' }}</div>
            <div class="gb-header-sub">Guest Court Booking</div>
          </div>
        </div>
      </header>

      <div class="gb-body">

        @if (clubError) {
          <div class="gb-error-card">
            <i class="fas fa-exclamation-circle"></i>
            <p>{{ clubError }}</p>
          </div>
        }

        @else if (confirmed) {
          <!-- Confirmation view -->
          <div class="gb-confirm-card">
            <div class="gb-confirm-icon"><i class="fas fa-calendar-check"></i></div>
            <h2 class="gb-confirm-title">Booking Received!</h2>
            <p class="gb-confirm-sub">Your slot is reserved and awaiting payment confirmation.</p>

            <div class="gb-confirm-rows">
              <div class="gb-confirm-row">
                <span>Reference</span>
                <strong class="gb-ref">{{ confirmationData!.reservation._id }}</strong>
              </div>
              <div class="gb-confirm-row">
                <span>Court</span>
                <strong>Court {{ confirmationData!.reservation.court }}</strong>
              </div>
              <div class="gb-confirm-row">
                <span>Date</span>
                <strong>{{ confirmationData!.reservation.date | date: 'EEE, MMM d, y' : 'UTC' }}</strong>
              </div>
              <div class="gb-confirm-row">
                <span>Time</span>
                <strong class="gb-green">{{ confirmationData!.reservation.timeSlot }}</strong>
              </div>
              <div class="gb-confirm-row">
                <span>Total Fee</span>
                <strong class="gb-green">{{ confirmationData!.charge.amount | currency: 'PHP' : 'symbol' }}</strong>
              </div>
            </div>

            <div class="gb-payment-notice">
              <i class="fas fa-info-circle"></i>
              <div>
                <strong>Next step: Pay the court fee</strong>
                <p>Please settle the fee with the club admin. Your slot will be confirmed once payment is verified. Keep your reference number for follow-up.</p>
              </div>
            </div>
          </div>
        }

        @else {
          <!-- Booking form -->
          @if (errorMsg) {
            <div class="gb-alert gb-alert-error"><i class="fas fa-exclamation-triangle"></i> {{ errorMsg }}</div>
          }

          <!-- Guest Info -->
          <div class="gb-section">
            <div class="gb-section-label">Your Info</div>
            <input
              type="text"
              class="gb-input"
              placeholder="Full name *"
              [(ngModel)]="guestName"
            />
            <input
              type="email"
              class="gb-input gb-input-mt"
              placeholder="Email address *"
              [(ngModel)]="guestEmail"
            />
            <input
              type="tel"
              class="gb-input gb-input-mt"
              placeholder="Phone number (optional)"
              [(ngModel)]="guestPhone"
            />
          </div>

          <!-- Date -->
          <div class="gb-section">
            <div class="gb-section-label">Date</div>
            <input
              type="date"
              class="gb-input"
              [(ngModel)]="selectedDate"
              [min]="today"
              (change)="onDateOrCourtChange()"
            />
          </div>

          <!-- Court -->
          <div class="gb-section">
            <div class="gb-section-label">Court</div>
            <div class="gb-court-toggle">
              <button class="gb-court-btn" [class.active]="selectedCourt === 1" (click)="selectCourt(1)">
                <i class="fas fa-table-tennis"></i> Court 1
              </button>
              <button class="gb-court-btn" [class.active]="selectedCourt === 2" (click)="selectCourt(2)">
                <i class="fas fa-table-tennis"></i> Court 2
              </button>
            </div>
          </div>

          <!-- Time Slot -->
          @if (selectedDate && selectedCourt) {
            <div class="gb-section">
              <div class="gb-section-label">
                Time Slot
                <span class="gb-lights-legend"><span class="gb-lights-dot"></span> with lights</span>
              </div>
              @if (loadingSlots) {
                <div class="gb-slot-loading"><i class="fas fa-circle-notch fa-spin"></i> Checking availability…</div>
              } @else {
                <div class="gb-slot-grid">
                  @for (slot of allSlots; track slot) {
                    <button
                      class="gb-slot-btn"
                      [class.selected]="selectedSlot === slot"
                      [class.booked]="bookedSlots.has(slot)"
                      [class.has-lights]="lightSlots.has(slot)"
                      [disabled]="bookedSlots.has(slot)"
                      (click)="selectSlot(slot)"
                    >
                      {{ slot }}
                      @if (lightSlots.has(slot)) { <span class="gb-light-dot">💡</span> }
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- Lights -->
          <div class="gb-section">
            <div class="gb-section-label">Lights</div>
            <label class="gb-toggle-row">
              <input type="checkbox" class="gb-toggle-input" [(ngModel)]="lightsRequested" />
              <span class="gb-toggle-track"><span class="gb-toggle-thumb"></span></span>
              <span class="gb-toggle-label">{{ lightsRequested ? '💡 Lights on' : '🌙 No lights' }}</span>
            </label>
          </div>

          <!-- Holiday -->
          @if (holidayRate > 0) {
            <div class="gb-section">
              <div class="gb-section-label">Holiday <span class="gb-optional">optional</span></div>
              <label class="gb-toggle-row">
                <input type="checkbox" class="gb-toggle-input" [(ngModel)]="isHoliday" />
                <span class="gb-toggle-track"><span class="gb-toggle-thumb"></span></span>
                <span class="gb-toggle-label">{{ isHoliday ? 'Yes — holiday rates apply' : 'No — regular rates apply' }}</span>
              </label>
            </div>
          }

          <!-- Ball Boy -->
          @if (ballBoyRate > 0) {
            <div class="gb-section">
              <div class="gb-section-label">Ball Boy <span class="gb-optional">optional</span></div>
              <label class="gb-toggle-row">
                <input type="checkbox" class="gb-toggle-input" [(ngModel)]="ballBoyRequested" />
                <span class="gb-toggle-track"><span class="gb-toggle-thumb"></span></span>
                <span class="gb-toggle-label">{{ ballBoyRequested ? '🎾 Requested' : 'Not requested' }}</span>
              </label>
            </div>
          }

          <!-- Guests -->
          @if (guestFeeRate > 0) {
            <div class="gb-section">
              <div class="gb-section-label">Additional Non-members <span class="gb-optional">guests</span></div>
              <div class="gb-counter-row">
                <button type="button" class="gb-counter-btn" (click)="guestCount = guestCount > 0 ? guestCount - 1 : 0">−</button>
                <span class="gb-counter-val">{{ guestCount }}</span>
                <button type="button" class="gb-counter-btn" (click)="guestCount = guestCount + 1">+</button>
                @if (guestCount > 0) {
                  <span class="gb-counter-fee">{{ guestFeeRate | currency: 'PHP' : 'symbol' }} × {{ guestCount }} = {{ totalGuestFee | currency: 'PHP' : 'symbol' }}</span>
                }
              </div>
            </div>
          }

          <!-- Rentals -->
          @if (hasAnyRental) {
            <div class="gb-section">
              <div class="gb-section-label">Rentals <span class="gb-optional">optional</span></div>
              <div class="gb-rentals-card">
                @if (rentalBalls50Rate > 0) {
                  <div class="gb-rental-row">
                    <span class="gb-rental-name">🎾 Balls (50 pcs)</span>
                    <span class="gb-rental-rate">{{ rentalBalls50Rate | currency: 'PHP' : 'symbol' }}</span>
                    <div class="gb-rental-counter">
                      <button type="button" class="gb-counter-btn sm" (click)="rentalBalls50 = rentalBalls50 > 0 ? rentalBalls50 - 1 : 0">−</button>
                      <span class="gb-counter-val sm">{{ rentalBalls50 }}</span>
                      <button type="button" class="gb-counter-btn sm" (click)="rentalBalls50 = rentalBalls50 + 1">+</button>
                    </div>
                  </div>
                }
                @if (rentalBalls100Rate > 0) {
                  <div class="gb-rental-row">
                    <span class="gb-rental-name">🎾 Balls (100 pcs)</span>
                    <span class="gb-rental-rate">{{ rentalBalls100Rate | currency: 'PHP' : 'symbol' }}</span>
                    <div class="gb-rental-counter">
                      <button type="button" class="gb-counter-btn sm" (click)="rentalBalls100 = rentalBalls100 > 0 ? rentalBalls100 - 1 : 0">−</button>
                      <span class="gb-counter-val sm">{{ rentalBalls100 }}</span>
                      <button type="button" class="gb-counter-btn sm" (click)="rentalBalls100 = rentalBalls100 + 1">+</button>
                    </div>
                  </div>
                }
                @if (rentalBallMachineRate > 0) {
                  <div class="gb-rental-row">
                    <span class="gb-rental-name">🤖 Ball Machine</span>
                    <span class="gb-rental-rate">{{ rentalBallMachineRate | currency: 'PHP' : 'symbol' }}</span>
                    <label class="gb-toggle-row" style="margin:0">
                      <input type="checkbox" class="gb-toggle-input" [(ngModel)]="rentalBallMachine" />
                      <span class="gb-toggle-track"><span class="gb-toggle-thumb"></span></span>
                      <span class="gb-toggle-label" style="font-size:.82rem">{{ rentalBallMachine ? 'Yes' : 'No' }}</span>
                    </label>
                  </div>
                }
                @if (rentalRacketRate > 0) {
                  <div class="gb-rental-row">
                    <span class="gb-rental-name">🏓 Racket</span>
                    <span class="gb-rental-rate">{{ rentalRacketRate | currency: 'PHP' : 'symbol' }} each</span>
                    <div class="gb-rental-counter">
                      <button type="button" class="gb-counter-btn sm" (click)="rentalRackets = rentalRackets > 0 ? rentalRackets - 1 : 0">−</button>
                      <span class="gb-counter-val sm">{{ rentalRackets }}</span>
                      <button type="button" class="gb-counter-btn sm" (click)="rentalRackets = rentalRackets + 1">+</button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Summary -->
          @if (selectedSlot) {
            <div class="gb-summary">
              <div class="gb-summary-title"><i class="fas fa-clipboard-list"></i> Booking Summary</div>
              <div class="gb-summary-row"><span>Name</span><strong>{{ guestName || '—' }}</strong></div>
              <div class="gb-summary-row"><span>Court</span><strong>Court {{ selectedCourt }}</strong></div>
              <div class="gb-summary-row"><span>Date</span><strong>{{ selectedDate | date: 'EEE, MMM d, y' : 'UTC' }}</strong></div>
              <div class="gb-summary-row"><span>Time</span><strong class="gb-green">{{ selectedSlot }}</strong></div>
              <div class="gb-summary-row">
                <span>Day Type</span>
                <strong>
                  @if (dayType === 'holiday') { Holiday 🏖️ }
                  @else if (dayType === 'weekend') { Weekend 🎉 }
                  @else { Weekday 📅 }
                </strong>
              </div>
              <div class="gb-summary-divider"></div>
              <div class="gb-summary-row"><span>Court Fee</span><strong>{{ baseCourtFee | currency: 'PHP' : 'symbol' }}</strong></div>
              @if (lightsRequested) {
                <div class="gb-summary-row"><span>Lights Fee</span><strong>{{ lightsRate | currency: 'PHP' : 'symbol' }}</strong></div>
              }
              @if (ballBoyRequested) {
                <div class="gb-summary-row"><span>Ball Boy Fee</span><strong>{{ ballBoyRate | currency: 'PHP' : 'symbol' }}</strong></div>
              }
              @if (totalRentalFee > 0) {
                <div class="gb-summary-row"><span>Rentals</span><strong>{{ totalRentalFee | currency: 'PHP' : 'symbol' }}</strong></div>
              }
              @if (guestCount > 0) {
                <div class="gb-summary-row">
                  <span>Guests ({{ guestCount }} × {{ guestFeeRate | currency: 'PHP' : 'symbol' }})</span>
                  <strong>{{ totalGuestFee | currency: 'PHP' : 'symbol' }}</strong>
                </div>
              }
              <div class="gb-summary-divider"></div>
              <div class="gb-summary-row gb-summary-total">
                <span>Total</span>
                <strong class="gb-total-amount">{{ computedFee | currency: 'PHP' : 'symbol' }}</strong>
              </div>
            </div>

            <button class="gb-confirm-btn" [disabled]="booking || !guestName || !guestEmail" (click)="submit()">
              @if (booking) { <i class="fas fa-circle-notch fa-spin"></i> Submitting… }
              @else { <i class="fas fa-calendar-check"></i> Request Booking }
            </button>
          }

          <div class="gb-bottom-spacer"></div>
        }

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #0c1a11;
    }

    .gb-shell {
      background: #0c1a11;
      min-height: 100vh;
      max-width: 520px;
      margin: 0 auto;
    }

    /* Header */
    .gb-header {
      background: #111f16;
      padding: 1.1rem 1.25rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .gb-header-inner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .gb-back-btn {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.45);
      font-size: 0.95rem;
      cursor: pointer;
      padding: 0.3rem 0.4rem;
      border-radius: 6px;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
      line-height: 1;
    }
    .gb-back-btn:hover { color: #ffffff; background: rgba(255,255,255,0.07); }
    .gb-club-logo {
      width: 36px; height: 36px;
      border-radius: 10px;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid rgba(163,230,53,0.2);
    }
    .gb-cg-icon {
      width: 36px; height: 36px;
      border-radius: 10px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .gb-club-name {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
    }
    .gb-header-sub {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.40);
      font-weight: 500;
    }

    /* Body */
    .gb-body {
      padding: 1.25rem 1.1rem 2rem;
    }

    /* Error card */
    .gb-error-card {
      text-align: center;
      padding: 3rem 1.5rem;
      color: #ef4444;
    }
    .gb-error-card i { font-size: 2.5rem; margin-bottom: 1rem; display: block; }
    .gb-error-card p { font-size: 0.95rem; font-weight: 600; }

    /* Alert */
    .gb-alert {
      padding: 0.85rem 1rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .gb-alert i { margin-top: 1px; flex-shrink: 0; }
    .gb-alert-error {
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.25);
      color: #ef4444;
    }

    /* Sections */
    .gb-section { margin-bottom: 1.2rem; }
    .gb-section-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: rgba(255,255,255,0.40);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .gb-optional {
      font-size: 0.65rem;
      font-weight: 500;
      color: rgba(255,255,255,0.25);
      text-transform: none;
      letter-spacing: 0;
    }
    .gb-lights-legend {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.68rem;
      color: rgba(255,255,255,0.35);
      text-transform: none;
      letter-spacing: 0;
      margin-left: auto;
    }
    .gb-lights-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      flex-shrink: 0;
    }

    /* Input */
    .gb-input {
      width: 100%;
      box-sizing: border-box;
      background: #1b3028;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 0.75rem 0.9rem;
      color: #ffffff;
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .gb-input:focus { border-color: rgba(163,230,53,0.4); }
    .gb-input::placeholder { color: rgba(255,255,255,0.25); }
    .gb-input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
    .gb-input-mt { margin-top: 0.5rem; }

    /* Court toggle */
    .gb-court-toggle { display: flex; gap: 0.6rem; }
    .gb-court-btn {
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
    .gb-court-btn.active { border-color: #a3e635; background: rgba(163,230,53,0.12); color: #a3e635; }
    .gb-court-btn:hover:not(.active) { border-color: rgba(163,230,53,0.3); color: rgba(255,255,255,0.8); }

    /* Slot grid */
    .gb-slot-loading { color: rgba(255,255,255,0.45); font-size: 0.85rem; padding: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem; }
    .gb-slot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 0.45rem; }
    .gb-slot-btn {
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
    .gb-slot-btn.has-lights { border-color: rgba(245,158,11,0.35); background: rgba(245,158,11,0.07); }
    .gb-slot-btn.selected { border-color: #a3e635; background: rgba(163,230,53,0.15); color: #a3e635; }
    .gb-slot-btn.booked { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.2); cursor: not-allowed; border-color: rgba(255,255,255,0.05); text-decoration: line-through; }
    .gb-slot-btn:hover:not(.booked):not(.selected) { border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.07); }
    .gb-light-dot { font-size: 0.7rem; }

    /* Toggle */
    .gb-toggle-row { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; user-select: none; }
    .gb-toggle-input { display: none; }
    .gb-toggle-track { position: relative; width: 42px; height: 22px; border-radius: 11px; background: rgba(255,255,255,0.15); transition: background 0.2s; flex-shrink: 0; }
    .gb-toggle-input:checked + .gb-toggle-track { background: #a3e635; }
    .gb-toggle-thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: left 0.2s; }
    .gb-toggle-input:checked + .gb-toggle-track .gb-toggle-thumb { left: 23px; }
    .gb-toggle-label { font-size: 0.88rem; color: rgba(255,255,255,0.75); font-weight: 600; }

    /* Counter */
    .gb-counter-row { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
    .gb-counter-btn {
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
    .gb-counter-btn:hover { background: rgba(163,230,53,0.12); }
    .gb-counter-btn.sm { width: 26px; height: 26px; font-size: 0.9rem; border-radius: 6px; }
    .gb-counter-val { min-width: 28px; text-align: center; font-size: 1.1rem; font-weight: 700; color: #ffffff; }
    .gb-counter-val.sm { min-width: 22px; font-size: 0.9rem; }
    .gb-counter-fee { font-size: 0.8rem; color: #a3e635; font-weight: 600; }

    /* Rentals */
    .gb-rentals-card { background: #1b3028; border-radius: 12px; overflow: hidden; }
    .gb-rental-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 0.9rem; }
    .gb-rental-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.06); }
    .gb-rental-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.75); }
    .gb-rental-rate { font-size: 0.72rem; color: #a3e635; font-weight: 600; white-space: nowrap; }
    .gb-rental-counter { display: flex; align-items: center; gap: 0.35rem; }

    /* Summary */
    .gb-summary { background: #1b3028; border-radius: 14px; padding: 1rem; margin-bottom: 1rem; }
    .gb-summary-title { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.40); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem; }
    .gb-summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: rgba(255,255,255,0.55); padding: 0.3rem 0; }
    .gb-summary-row strong { color: #ffffff; }
    .gb-summary-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 0.4rem 0; }
    .gb-summary-total { font-weight: 700; font-size: 0.9rem; }
    .gb-total-amount { font-size: 1.1rem; color: #a3e635 !important; }
    .gb-green { color: #a3e635 !important; }

    /* Confirm button */
    .gb-confirm-btn {
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
    .gb-confirm-btn:hover:not(:disabled) { background: #b8f040; }
    .gb-confirm-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    .gb-bottom-spacer { height: 2rem; }

    /* Confirmation card */
    .gb-confirm-card {
      text-align: center;
      padding: 1rem 0 2rem;
    }
    .gb-confirm-icon {
      font-size: 3rem;
      color: #a3e635;
      margin-bottom: 1rem;
    }
    .gb-confirm-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.4rem;
    }
    .gb-confirm-sub {
      font-size: 0.88rem;
      color: rgba(255,255,255,0.45);
      margin: 0 0 1.5rem;
    }
    .gb-confirm-rows {
      background: #1b3028;
      border-radius: 14px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      text-align: left;
    }
    .gb-confirm-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.50);
      padding: 0.35rem 0;
    }
    .gb-confirm-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.06); }
    .gb-confirm-row strong { color: #ffffff; text-align: right; max-width: 60%; word-break: break-all; }
    .gb-ref { font-size: 0.72rem; color: #a3e635 !important; font-family: monospace; }
    .gb-payment-notice {
      display: flex;
      gap: 0.75rem;
      background: rgba(245,158,11,0.1);
      border: 1px solid rgba(245,158,11,0.25);
      border-radius: 12px;
      padding: 1rem;
      text-align: left;
    }
    .gb-payment-notice i { color: #f59e0b; font-size: 1.1rem; margin-top: 2px; flex-shrink: 0; }
    .gb-payment-notice strong { font-size: 0.88rem; color: #f59e0b; display: block; margin-bottom: 0.3rem; }
    .gb-payment-notice p { font-size: 0.8rem; color: rgba(255,255,255,0.55); margin: 0; line-height: 1.5; }
  `],
})
export class GuestReserveComponent implements OnInit, OnDestroy {
  allSlots = ALL_SLOTS;
  lightSlots = LIGHT_SLOTS;

  clubId = '';
  clubName = '';
  clubLogo: string | null = null;
  clubError = '';

  guestName = '';
  guestEmail = '';
  guestPhone = '';

  selectedDate = '';
  selectedCourt: 1 | 2 | null = null;
  selectedSlot = '';
  bookedSlots = new Set<string>();
  loadingSlots = false;
  booking = false;
  errorMsg = '';
  today = new Date().toISOString().split('T')[0];

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

  confirmed = false;
  confirmationData: GuestBookingResult | null = null;

  get hasAnyRental(): boolean {
    return this.rentalBalls50Rate > 0 || this.rentalBalls100Rate > 0
      || this.rentalBallMachineRate > 0 || this.rentalRacketRate > 0;
  }

  get dayType(): 'weekday' | 'weekend' | 'holiday' {
    if (this.isHoliday) return 'holiday';
    if (!this.selectedDate) return 'weekday';
    const day = new Date(this.selectedDate + 'T00:00:00Z').getUTCDay();
    return WEEKEND_DAYS.has(day) ? 'weekend' : 'weekday';
  }

  get baseCourtFee(): number {
    switch (this.dayType) {
      case 'holiday': return this.holidayRate;
      case 'weekend': return this.weekendRate;
      default:        return this.weekdayRate;
    }
  }

  get totalGuestFee(): number { return this.guestCount * this.guestFeeRate; }

  get totalRentalFee(): number {
    return (
      this.rentalBalls50 * this.rentalBalls50Rate +
      this.rentalBalls100 * this.rentalBalls100Rate +
      (this.rentalBallMachine ? this.rentalBallMachineRate : 0) +
      this.rentalRackets * this.rentalRacketRate
    );
  }

  get computedFee(): number {
    return this.baseCourtFee
      + (this.lightsRequested ? this.lightsRate : 0)
      + (this.ballBoyRequested ? this.ballBoyRate : 0)
      + this.totalGuestFee
      + this.totalRentalFee;
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
    if (!this.clubId) {
      this.clubError = 'Invalid booking link.';
      return;
    }

    this.publicBookingService.getClub(this.clubId).subscribe({
      next: (club) => {
        if (club.status === 'suspended') {
          this.clubError = 'This club is currently unavailable for bookings.';
        } else {
          this.clubName = club.name;
          this.clubLogo = club.logo ?? null;
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

  goBack() {
    this.router.navigate(['/book', this.clubId]);
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
    this.publicBookingService.getAvailability(this.clubId, this.selectedCourt, this.selectedDate).subscribe({
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
    this.errorMsg = '';
  }

  submit() {
    if (!this.selectedDate || !this.selectedCourt || !this.selectedSlot) return;
    if (!this.guestName.trim() || !this.guestEmail.trim()) {
      this.errorMsg = 'Please fill in your name and email.';
      return;
    }

    this.booking = true;
    this.errorMsg = '';

    this.publicBookingService.createGuestBooking(this.clubId, {
      court: this.selectedCourt,
      date: this.selectedDate,
      timeSlot: this.selectedSlot,
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
    }).subscribe({
      next: (result) => {
        this.booking = false;
        this.confirmationData = result;
        this.confirmed = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.booking = false;
        if (err?.status === 409) {
          this.errorMsg = 'That slot was just booked by someone else. Please choose another time.';
        } else if (err?.status === 402) {
          this.errorMsg = 'This club is temporarily unable to accept bookings. Please contact them directly.';
        } else {
          this.errorMsg = err?.error?.error || 'Failed to submit booking. Please try again.';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
