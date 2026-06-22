import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs/operators';
import { RatesService } from '../../../core/services/rates.service';
import { ClubService } from '../../../core/services/club.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-rates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="rates-shell">

      <header class="hero-panel">
        <div>
          <p class="hero-kicker"><span style="color:#a3e635">Court</span><span style="color:#ffffff">Go</span></p>
          <h2>Rate Management</h2>
          <p class="hero-subtitle">Set pricing rules for sessions, reservations, and rentals.</p>
        </div>
      </header>

      @if (loading()) {
        <div class="state-card">
          <i class="fas fa-circle-notch fa-spin"></i>
          <p>Loading current rates…</p>
        </div>
      } @else if (errorMsg() && !saving()) {
        <div class="alert alert-error">{{ errorMsg() }}</div>
      } @else {
        <div class="rates-card">
          <form (ngSubmit)="onSave()" #f="ngForm">

            <div class="info-banner">
              <i class="fas fa-circle-info"></i>
              <p>Session rates are charged <strong>per hour</strong>. Reservation rates are charged <strong>per court hour</strong>.</p>
            </div>

            <div class="section-divider"><span>Session Billing Rates</span></div>

            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-icon">🌙</div>
                <div class="form-group">
                  <label for="withoutLightRate">Without Light Rate (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="withoutLightRate" type="number" [(ngModel)]="withoutLightRate"
                      name="withoutLightRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Applied when the session is played without lights.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">💡</div>
                <div class="form-group">
                  <label for="lightRate">With Light Rate (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="lightRate" type="number" [(ngModel)]="lightRate"
                      name="lightRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Applied when lights are turned on during the session.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🙋</div>
                <div class="form-group">
                  <label for="ballBoyRate">Ball Boy Fee (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="ballBoyRate" type="number" [(ngModel)]="ballBoyRate"
                      name="ballBoyRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Optional hourly fee when a ball boy is requested.</p>
                </div>
              </div>
            </div>

            <div class="section-divider"><span>Court Reservation Fees (per hour)</span></div>
            <p class="section-text">Mon–Thu use the weekday rate, Fri–Sun use the weekend rate. Players can mark a booking as a holiday to apply the holiday rate.</p>

            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-icon">📅</div>
                <div class="form-group">
                  <label for="reservationWeekdayRate">Weekday Rate — Mon to Thu (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="reservationWeekdayRate" type="number" [(ngModel)]="reservationWeekdayRate"
                      name="reservationWeekdayRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Flat rate applied to all time slots on weekdays.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🎉</div>
                <div class="form-group">
                  <label for="reservationWeekendRate">Weekend Rate — Fri to Sun (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="reservationWeekendRate" type="number" [(ngModel)]="reservationWeekendRate"
                      name="reservationWeekendRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Flat rate applied to all time slots on weekends.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🏖️</div>
                <div class="form-group">
                  <label for="reservationHolidayRate">Holiday Rate (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="reservationHolidayRate" type="number" [(ngModel)]="reservationHolidayRate"
                      name="reservationHolidayRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Applied when the player marks the booking as a holiday.</p>
                </div>
              </div>
            </div>

            <p class="section-note">
              <i class="fas fa-lightbulb"></i> Lights fee on reservations uses the <strong>With Light Rate</strong> from Session Billing above.
            </p>

            <div class="rates-grid" style="margin-top:.75rem">
              <div class="rate-item">
                <div class="rate-icon">🧑‍🤝‍🧑</div>
                <div class="form-group">
                  <label for="reservationGuestFee">Guest Fee (per excess guest)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="reservationGuestFee" type="number" [(ngModel)]="reservationGuestFee"
                      name="reservationGuestFee" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Charged per non-member guest exceeding the free allowance below.</p>
                </div>
              </div>
              <div class="rate-item">
                <div class="rate-icon">🆓</div>
                <div class="form-group">
                  <label for="reservationGuestFeeThreshold">Free Guest Allowance</label>
                  <div class="input-prefix">
                    <span>#</span>
                    <input id="reservationGuestFeeThreshold" type="number" [(ngModel)]="reservationGuestFeeThreshold"
                      name="reservationGuestFeeThreshold" required min="0" step="1" placeholder="0" />
                  </div>
                  <p class="field-help">Number of guests included at no charge. Guests beyond this count are charged the fee above. Set to 0 to charge all guests.</p>
                </div>
              </div>
            </div>

            <div class="section-divider"><span>Exclusive Event</span></div>

            <div class="ee-toggle-card">
              <div class="ee-toggle-left">
                <span class="ee-toggle-icon">🎉</span>
                <div>
                  <div class="ee-toggle-title">Enable Exclusive Event Booking</div>
                  <div class="ee-toggle-desc">When enabled, guests will see an "Exclusive Event" option on the booking page.</div>
                </div>
              </div>
              <label class="ee-switch">
                <input type="checkbox" [(ngModel)]="exclusiveEventEnabled" name="exclusiveEventEnabled" />
                <span class="ee-slider"></span>
              </label>
            </div>

            @if (exclusiveEventEnabled) {
              <div class="rates-grid" style="margin-top:.75rem">
                <div class="rate-item">
                  <div class="rate-icon">💰</div>
                  <div class="form-group">
                    <label for="exclusiveEventRate">Hourly Rate</label>
                    <div class="input-prefix">
                      <span>₱</span>
                      <input id="exclusiveEventRate" type="number" [(ngModel)]="exclusiveEventRate"
                        name="exclusiveEventRate" min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <p class="field-help">Base rate per hour for the exclusive event.</p>
                  </div>
                </div>
                <div class="rate-item">
                  <div class="rate-icon">👥</div>
                  <div class="form-group">
                    <label for="exclusiveEventIncludedPax">Included Pax</label>
                    <div class="input-prefix">
                      <span>#</span>
                      <input id="exclusiveEventIncludedPax" type="number" [(ngModel)]="exclusiveEventIncludedPax"
                        name="exclusiveEventIncludedPax" min="0" step="1" placeholder="0" />
                    </div>
                    <p class="field-help">Number of attendees included in the base rate.</p>
                  </div>
                </div>
                <div class="rate-item">
                  <div class="rate-icon">➕</div>
                  <div class="form-group">
                    <label for="exclusiveEventExcessPaxFee">Excess Pax Fee</label>
                    <div class="input-prefix">
                      <span>₱</span>
                      <input id="exclusiveEventExcessPaxFee" type="number" [(ngModel)]="exclusiveEventExcessPaxFee"
                        name="exclusiveEventExcessPaxFee" min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <p class="field-help">Fee per attendee beyond the included count.</p>
                  </div>
                </div>
                <div class="rate-item">
                  <div class="rate-icon">🔢</div>
                  <div class="form-group">
                    <label for="exclusiveEventMaxPax">Max Capacity (pax)</label>
                    <div class="input-prefix">
                      <span>#</span>
                      <input id="exclusiveEventMaxPax" type="number" [(ngModel)]="exclusiveEventMaxPax"
                        name="exclusiveEventMaxPax" min="0" step="1" placeholder="0" />
                    </div>
                    <p class="field-help">Maximum number of attendees allowed.</p>
                  </div>
                </div>
                <div class="rate-item" style="grid-column:1/-1">
                  <div class="rate-icon">📋</div>
                  <div class="form-group">
                    <label for="exclusiveEventPolicies">Event Policies</label>
                    <textarea id="exclusiveEventPolicies" [(ngModel)]="exclusiveEventPoliciesText"
                      name="exclusiveEventPolicies" rows="4"
                      style="width:100%;padding:.5rem;border:1px solid var(--border-color,#ddd);border-radius:6px;font-size:.9rem;resize:vertical"
                      placeholder="Enter one policy per line&#10;e.g. Can bring food and drinks. Except alcoholic drinks.&#10;Strictly Clean as you go policy"></textarea>
                    <p class="field-help">One policy per line. These are shown to guests before they confirm their booking.</p>
                  </div>
                </div>
              </div>
            }

            <div class="section-divider"><span>Rentals (per hour)</span></div>

            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-icon">🎾</div>
                <div class="form-group">
                  <label for="rentalBalls50Rate">Balls — 50 pcs (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="rentalBalls50Rate" type="number" [(ngModel)]="rentalBalls50Rate"
                      name="rentalBalls50Rate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">50-piece ball set rental per booking hour.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🎾</div>
                <div class="form-group">
                  <label for="rentalBalls100Rate">Balls — 100 pcs (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="rentalBalls100Rate" type="number" [(ngModel)]="rentalBalls100Rate"
                      name="rentalBalls100Rate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">100-piece ball set rental per booking hour.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🤖</div>
                <div class="form-group">
                  <label for="rentalBallMachineRate">Ball Machine (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="rentalBallMachineRate" type="number" [(ngModel)]="rentalBallMachineRate"
                      name="rentalBallMachineRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Ball machine rental per booking hour.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🏓</div>
                <div class="form-group">
                  <label for="rentalRacketRate">Racket (per racket / hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input id="rentalRacketRate" type="number" [(ngModel)]="rentalRacketRate"
                      name="rentalRacketRate" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <p class="field-help">Per racket rental per booking hour.</p>
                </div>
              </div>
            </div>

            <div class="section-divider"><span>Coaching Sessions</span></div>

            <div class="ee-toggle-card">
              <div class="ee-toggle-left">
                <span class="ee-toggle-icon">🎓</span>
                <div>
                  <div class="ee-toggle-title">Enable Coaching Sessions</div>
                  <div class="ee-toggle-desc">When enabled, players and guests can add a coaching session at checkout. Billed per pax, per hour.</div>
                </div>
              </div>
              <label class="ee-switch">
                <input type="checkbox" [(ngModel)]="coachingEnabled" name="coachingEnabled" />
                <span class="ee-slider"></span>
              </label>
            </div>

            @if (coachingEnabled) {
              <div class="rates-grid" style="margin-top:.75rem">
                <div class="rate-item">
                  <div class="rate-icon">👤</div>
                  <div class="form-group">
                    <label for="coachingRate1Pax">1 Pax (1-on-1) — per pax / hour</label>
                    <div class="input-prefix">
                      <span>₱</span>
                      <input id="coachingRate1Pax" type="number" [(ngModel)]="coachingRate1Pax"
                        name="coachingRate1Pax" min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <p class="field-help">Rate per attendee per hour for a 1-on-1 session.</p>
                  </div>
                </div>
                <div class="rate-item">
                  <div class="rate-icon">👥</div>
                  <div class="form-group">
                    <label for="coachingRate2Pax">2 Pax — per pax / hour</label>
                    <div class="input-prefix">
                      <span>₱</span>
                      <input id="coachingRate2Pax" type="number" [(ngModel)]="coachingRate2Pax"
                        name="coachingRate2Pax" min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <p class="field-help">Rate per attendee per hour for 2 players.</p>
                  </div>
                </div>
                <div class="rate-item">
                  <div class="rate-icon">👨‍👩‍👧‍👦</div>
                  <div class="form-group">
                    <label for="coachingRate3to6Pax">3–6 Pax — per pax / hour</label>
                    <div class="input-prefix">
                      <span>₱</span>
                      <input id="coachingRate3to6Pax" type="number" [(ngModel)]="coachingRate3to6Pax"
                        name="coachingRate3to6Pax" min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <p class="field-help">Rate per attendee per hour for 3 to 6 players.</p>
                  </div>
                </div>
                <div class="rate-item">
                  <div class="rate-icon">⏱️</div>
                  <div class="form-group">
                    <label for="coachingMinHours">Minimum Hours</label>
                    <div class="input-prefix">
                      <span>#</span>
                      <input id="coachingMinHours" type="number" [(ngModel)]="coachingMinHours"
                        name="coachingMinHours" min="1" step="1" placeholder="2" />
                    </div>
                    <p class="field-help">Minimum session length when coaching is selected.</p>
                  </div>
                </div>
                <div class="rate-item">
                  <div class="rate-icon">🔢</div>
                  <div class="form-group">
                    <label for="coachingMaxPax">Maximum Pax</label>
                    <div class="input-prefix">
                      <span>#</span>
                      <input id="coachingMaxPax" type="number" [(ngModel)]="coachingMaxPax"
                        name="coachingMaxPax" min="1" step="1" placeholder="6" />
                    </div>
                    <p class="field-help">Maximum attendees per coaching session.</p>
                  </div>
                </div>
              </div>
            }

            @if (lastUpdated()) {
              <p class="last-updated"><i class="fas fa-clock"></i> Last updated: {{ lastUpdated() | date: 'medium' }}</p>
            }

            @if (successMsg()) {
              <div class="alert alert-success"><i class="fas fa-check-circle"></i> {{ successMsg() }}</div>
            }
            <div class="section-divider"><span>Court Configuration</span></div>

            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-icon">🎾</div>
                <div class="form-group">
                  <label for="courtCount">Number of Courts</label>
                  <input id="courtCount" type="number" [(ngModel)]="courtCount"
                    name="courtCount" required min="1" max="20" step="1" placeholder="2" />
                  <p class="field-help">How many courts are available for reservation at your club.</p>
                </div>
              </div>
            </div>

            @if (errorMsg()) {
              <div class="alert alert-error"><i class="fas fa-triangle-exclamation"></i> {{ errorMsg() }}</div>
            }

            <div class="form-actions">
              <button type="submit" class="btn-save" [disabled]="saving()">
                <i class="fas" [class.fa-floppy-disk]="!saving()" [class.fa-circle-notch]="saving()" [class.fa-spin]="saving()"></i>
                {{ saving() ? 'Saving…' : 'Save Rates' }}
              </button>
            </div>
          </form>
        </div>

        <div class="billing-preview">
          <div class="section-header">
            <p class="section-kicker">Reference</p>
            <h3>Billing Formula Preview</h3>
          </div>
          <div class="formula-card">
            <div class="formula-row">
              <span>🌙 Without Light Fee</span>
              <span>= {{ withoutLightRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>💡 With Light Fee</span>
              <span>= {{ lightRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>🙋 Ball Boy Fee</span>
              <span>= {{ ballBoyRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row accent-green">
              <span>📅 Reservation — Weekday (Mon–Thu)</span>
              <span>= {{ reservationWeekdayRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row accent-amber">
              <span>🎉 Reservation — Weekend (Fri–Sun)</span>
              <span>= {{ reservationWeekendRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row accent-purple">
              <span>🏖️ Reservation — Holiday</span>
              <span>= {{ reservationHolidayRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>💡 Lights add-on</span>
              <span>= + {{ lightRate | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>🧑‍🤝‍🧑 Guest Fee</span>
              <span>= guests × {{ reservationGuestFee | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>🎾 Balls 50 pcs</span>
              <span>= {{ rentalBalls50Rate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>🎾 Balls 100 pcs</span>
              <span>= {{ rentalBalls100Rate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>🤖 Ball Machine</span>
              <span>= {{ rentalBallMachineRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>🏓 Racket (per racket)</span>
              <span>= {{ rentalRacketRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--dm-bg);
      }

      .rates-shell {
        display: grid;
        gap: 1rem;
        padding: 1.5rem;
        min-height: calc(100vh - 60px);
      }

      /* ── Hero ── */
      .hero-panel {
        background: var(--dm-header);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 18px;
        padding: 1rem 1.2rem;
        box-shadow: 0 4px 16px rgba(0,0,0,0.32);
      }

      .hero-kicker {
        margin: 0 0 0.2rem;
        font-size: 0.74rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 800;
      }

      .hero-panel h2 {
        margin: 0;
        font-size: 1.42rem;
        color: #ffffff;
        letter-spacing: -0.02em;
      }

      .hero-subtitle {
        margin: 0.35rem 0 0;
        color: rgba(255,255,255,0.7);
        font-size: 0.91rem;
      }

      /* ── State ── */
      .state-card {
        background: var(--dm-surface);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 14px;
        padding: 1.5rem;
        color: rgba(255,255,255,0.6);
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.9rem;
      }

      /* ── Main card ── */
      .rates-card,
      .billing-preview {
        background: var(--dm-surface);
        border: 1px solid rgba(163,230,53,0.10);
        border-radius: 16px;
        padding: 1.1rem;
        box-shadow: 0 4px 18px rgba(0,0,0,0.28);
      }

      /* ── Info banner ── */
      .info-banner {
        display: flex;
        align-items: flex-start;
        gap: 0.55rem;
        background: rgba(163,230,53,0.07);
        border: 1px solid rgba(163,230,53,0.18);
        border-radius: 10px;
        padding: 0.75rem 0.9rem;
        margin-bottom: 1.1rem;
        font-size: 0.85rem;
        color: rgba(255,255,255,0.75);
        line-height: 1.5;
      }

      .info-banner i {
        color: var(--dm-accent);
        margin-top: 0.15rem;
        flex-shrink: 0;
      }

      .info-banner p { margin: 0; }
      .info-banner strong { color: #ffffff; }

      /* ── Section divider ── */
      .section-divider {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 1.3rem 0 0.9rem;
        color: var(--dm-accent);
        font-size: 0.75rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .section-divider::before,
      .section-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(163,230,53,0.18);
      }

      .section-text {
        margin: -0.4rem 0 0.9rem;
        font-size: 0.83rem;
        color: rgba(255,255,255,0.55);
        line-height: 1.45;
      }

      /* ── Rate grid ── */
      .rates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.8rem;
        margin-bottom: 0.9rem;
      }

      .rate-item {
        display: flex;
        gap: 0.65rem;
        align-items: flex-start;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(163,230,53,0.1);
        border-radius: 12px;
        padding: 0.8rem;
        transition: border-color 0.2s;
      }

      .rate-item:focus-within {
        border-color: rgba(163,230,53,0.35);
      }

      .rate-icon {
        font-size: 1.35rem;
        margin-top: 0.2rem;
        flex-shrink: 0;
      }

      .form-group { width: 100%; }

      .form-group label {
        display: block;
        color: rgba(255,255,255,0.85);
        font-size: 0.83rem;
        font-weight: 700;
        margin-bottom: 0.45rem;
      }

      /* ── Input ── */
      .input-prefix {
        display: flex;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(255,255,255,0.05);
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .input-prefix:focus-within {
        border-color: rgba(163,230,53,0.45);
        box-shadow: 0 0 0 3px rgba(163,230,53,0.12);
      }

      .input-prefix span {
        padding: 0.58rem 0.72rem;
        background: rgba(163,230,53,0.08);
        border-right: 1px solid rgba(255,255,255,0.08);
        color: var(--dm-accent);
        font-size: 0.88rem;
        font-weight: 800;
        flex-shrink: 0;
      }

      .input-prefix input {
        border: none;
        background: transparent;
        padding: 0.58rem 0.72rem;
        width: 100%;
        font-size: 0.95rem;
        color: #ffffff;
        font-family: inherit;
      }

      .input-prefix input:focus { outline: none; }
      .input-prefix input::placeholder { color: rgba(255,255,255,0.3); }

      .field-help {
        margin: 0.38rem 0 0;
        font-size: 0.77rem;
        color: rgba(255,255,255,0.45);
        line-height: 1.4;
      }

      /* ── Exclusive Event toggle card ── */
      .ee-toggle-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(163,230,53,0.1);
        border-radius: 12px;
        padding: 1rem 1.1rem;
        margin-top: 0.75rem;
        transition: border-color 0.2s;
      }
      .ee-toggle-card:hover { border-color: rgba(163,230,53,0.25); }

      .ee-toggle-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .ee-toggle-icon { font-size: 1.5rem; flex-shrink: 0; }
      .ee-toggle-title {
        font-size: 0.88rem;
        font-weight: 700;
        color: rgba(255,255,255,0.9);
        margin-bottom: 0.2rem;
      }
      .ee-toggle-desc {
        font-size: 0.77rem;
        color: rgba(255,255,255,0.45);
        line-height: 1.4;
      }

      .ee-switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 28px;
        flex-shrink: 0;
        cursor: pointer;
      }
      .ee-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
      .ee-slider {
        position: absolute;
        inset: 0;
        background: rgba(255,255,255,0.12);
        border-radius: 28px;
        transition: background 0.2s;
        border: 1px solid rgba(255,255,255,0.15);
      }
      .ee-slider::before {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        left: 3px;
        top: 3px;
        background: rgba(255,255,255,0.6);
        border-radius: 50%;
        transition: transform 0.2s, background 0.2s;
      }
      .ee-switch input:checked + .ee-slider {
        background: var(--dm-accent, #a3e635);
        border-color: var(--dm-accent, #a3e635);
      }
      .ee-switch input:checked + .ee-slider::before {
        transform: translateX(22px);
        background: #1a2e05;
      }

      /* ── Section note ── */
      .section-note {
        font-size: 0.82rem;
        color: rgba(255,255,255,0.65);
        margin: 0.1rem 0 0.75rem;
        padding: 0.55rem 0.8rem;
        background: rgba(163,230,53,0.07);
        border-radius: 8px;
        border-left: 3px solid rgba(163,230,53,0.45);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .section-note i { color: var(--dm-accent); }
      .section-note strong { color: #ffffff; }

      /* ── Last updated ── */
      .last-updated {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.4);
        margin: 0.75rem 0 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      /* ── Save button ── */
      .form-actions { margin-top: 1.1rem; }

      .btn-save {
        background: #a3e635;
        color: #0c1a11;
        border: none;
        border-radius: 10px;
        padding: 0.62rem 1.4rem;
        font-size: 0.92rem;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: background 0.2s, transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 14px rgba(163,230,53,0.25);
        font-family: inherit;
      }

      .btn-save:hover:not(:disabled) {
        background: #b5f542;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(163,230,53,0.32);
      }

      .btn-save:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      /* ── Alerts ── */
      .alert {
        border-radius: 9px;
        padding: 0.65rem 0.8rem;
        font-size: 0.84rem;
        margin-top: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .alert-success {
        background: rgba(163,230,53,0.1);
        color: #a3e635;
        border: 1px solid rgba(163,230,53,0.25);
      }

      .alert-error {
        background: rgba(239,68,68,0.1);
        color: #fca5a5;
        border: 1px solid rgba(239,68,68,0.22);
      }

      /* ── Billing preview ── */
      .section-header { margin-bottom: 0.75rem; }

      .section-kicker {
        margin: 0 0 0.1rem;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--dm-accent);
        font-weight: 800;
      }

      .billing-preview h3 {
        margin: 0;
        font-size: 1rem;
        color: #ffffff;
      }

      .formula-card {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .formula-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0.72rem;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        font-size: 0.84rem;
        color: rgba(255,255,255,0.75);
      }

      .formula-row span:last-child {
        font-weight: 700;
        color: var(--dm-accent);
        text-align: right;
        white-space: nowrap;
      }

      .accent-green { border-left: 3px solid rgba(163,230,53,0.45); }
      .accent-green span:last-child { color: #a3e635; }

      .accent-amber { border-left: 3px solid rgba(251,191,36,0.45); }
      .accent-amber span:last-child { color: #fbbf24; }

      .accent-purple { border-left: 3px solid rgba(167,139,250,0.45); }
      .accent-purple span:last-child { color: #c4b5fd; }

      /* ── Mobile ── */
      @media (max-width: 640px) {
        .rates-shell { padding: 0.85rem; gap: 0.85rem; }
        .hero-panel { padding: 0.85rem; }
        .hero-panel h2 { font-size: 1.2rem; }
        .rates-card, .billing-preview { padding: 0.85rem; }
        .rates-grid { grid-template-columns: 1fr; gap: 0.65rem; }
        .formula-row { flex-direction: column; align-items: flex-start; gap: 0.2rem; }
        .formula-row span:last-child { text-align: left; }
        .btn-save { width: 100%; justify-content: center; }
      }
    `,
  ],
})
export class AdminRatesComponent implements OnInit {
  withoutLightRate = 0;
  lightRate = 0;
  training2WithoutLightRate = 0;
  training2LightRate = 0;
  ballBoyRate = 0;
  reservationWeekdayRate = 0;
  reservationWeekendRate = 0;
  reservationHolidayRate = 0;
  reservationGuestFee = 0;
  reservationGuestFeeThreshold = 0;
  exclusiveEventEnabled = false;
  exclusiveEventRate = 0;
  exclusiveEventIncludedPax = 0;
  exclusiveEventExcessPaxFee = 0;
  exclusiveEventMaxPax = 0;
  exclusiveEventPoliciesText = '';
  rentalBalls50Rate = 0;
  rentalBalls100Rate = 0;
  rentalBallMachineRate = 0;
  rentalRacketRate = 0;
  coachingEnabled = false;
  coachingMinHours = 2;
  coachingMaxPax = 6;
  coachingRate1Pax = 0;
  coachingRate2Pax = 0;
  coachingRate3to6Pax = 0;
  courtCount = 2;
  readonly lastUpdated = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly successMsg = signal('');
  readonly errorMsg = signal('');

  constructor(
    private ratesService: RatesService,
    private clubService: ClubService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (club) => { this.courtCount = club.courtCount ?? 2; },
      });
    }

    this.ratesService.getRates()
      .pipe(timeout(10000))
      .subscribe({
        next: (rates) => {
          this.withoutLightRate = rates.withoutLightRate;
          this.lightRate = rates.lightRate;
          this.training2WithoutLightRate = rates.training2WithoutLightRate;
          this.training2LightRate = rates.training2LightRate;
          this.ballBoyRate = rates.ballBoyRate;
          this.reservationWeekdayRate = rates.reservationWeekdayRate ?? 0;
          this.reservationWeekendRate = rates.reservationWeekendRate ?? 0;
          this.reservationHolidayRate = rates.reservationHolidayRate ?? 0;
          this.reservationGuestFee = rates.reservationGuestFee ?? 0;
          this.reservationGuestFeeThreshold = rates.reservationGuestFeeThreshold ?? 0;
          this.exclusiveEventEnabled = rates.exclusiveEventEnabled ?? false;
          this.exclusiveEventRate = rates.exclusiveEventRate ?? 0;
          this.exclusiveEventIncludedPax = rates.exclusiveEventIncludedPax ?? 0;
          this.exclusiveEventExcessPaxFee = rates.exclusiveEventExcessPaxFee ?? 0;
          this.exclusiveEventMaxPax = rates.exclusiveEventMaxPax ?? 0;
          this.exclusiveEventPoliciesText = (rates.exclusiveEventPolicies ?? []).join('\n');
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
          this.lastUpdated.set(rates.updatedAt);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Rates load error:', err);
          this.loading.set(false);
          this.errorMsg.set(
            err.name === 'TimeoutError'
              ? 'Request timed out — check backend connection.'
              : (err.error?.error || 'Failed to load rates.'),
          );
        },
      });
  }

  onSave() {
    const clubId = this.auth.user()?.clubId;
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    const saveRates$ = this.ratesService.updateRates({
      withoutLightRate: Number(this.withoutLightRate),
      lightRate: Number(this.lightRate),
      training2WithoutLightRate: Number(this.training2WithoutLightRate),
      training2LightRate: Number(this.training2LightRate),
      ballBoyRate: Number(this.ballBoyRate),
      reservationWeekdayRate: Number(this.reservationWeekdayRate),
      reservationWeekendRate: Number(this.reservationWeekendRate),
      reservationHolidayRate: Number(this.reservationHolidayRate),
      reservationGuestFee: Number(this.reservationGuestFee),
      reservationGuestFeeThreshold: Number(this.reservationGuestFeeThreshold),
      exclusiveEventEnabled: this.exclusiveEventEnabled,
      exclusiveEventRate: Number(this.exclusiveEventRate),
      exclusiveEventIncludedPax: Number(this.exclusiveEventIncludedPax),
      exclusiveEventExcessPaxFee: Number(this.exclusiveEventExcessPaxFee),
      exclusiveEventMaxPax: Number(this.exclusiveEventMaxPax),
      exclusiveEventPolicies: this.exclusiveEventPoliciesText.split('\n').map(s => s.trim()).filter(Boolean),
      rentalBalls50Rate: Number(this.rentalBalls50Rate),
      rentalBalls100Rate: Number(this.rentalBalls100Rate),
      rentalBallMachineRate: Number(this.rentalBallMachineRate),
      rentalRacketRate: Number(this.rentalRacketRate),
      coachingEnabled: this.coachingEnabled,
      coachingMinHours: Number(this.coachingMinHours),
      coachingMaxPax: Number(this.coachingMaxPax),
      coachingRate1Pax: Number(this.coachingRate1Pax),
      coachingRate2Pax: Number(this.coachingRate2Pax),
      coachingRate3to6Pax: Number(this.coachingRate3to6Pax),
    }).pipe(timeout(10000));

    if (clubId) {
      this.clubService.updateClub(clubId, { courtCount: Number(this.courtCount) }).subscribe();
    }

    saveRates$.subscribe({
      next: (rates) => {
        this.saving.set(false);
        this.lastUpdated.set(rates.updatedAt);
        this.successMsg.set('Rates updated successfully!');
        setTimeout(() => { this.successMsg.set(''); }, 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(
          err.name === 'TimeoutError'
            ? 'Request timed out — check backend connection.'
            : (err.error?.error || err.message || 'Failed to update rates.'),
        );
        console.error('Rates save error:', err);
      },
    });
  }
}
