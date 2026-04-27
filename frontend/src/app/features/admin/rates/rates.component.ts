import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs/operators';
import { RatesService } from '../../../core/services/rates.service';

@Component({
  selector: 'app-admin-rates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="rates-shell">
      <div class="page-header">
        <p class="hero-kicker">Baseline Gearhub</p>
        <h2>Rate Management</h2>
        <p class="subtitle">Set clear pricing rules for sessions, reservations, and rentals.</p>
      </div>

      @if (loading()) {
        <div class="loading">Loading current rates...</div>
      } @else if (errorMsg() && !saving()) {
        <div class="alert alert-error">{{ errorMsg() }}</div>
      } @else {
        <div class="rates-card">
          <form (ngSubmit)="onSave()" #f="ngForm">
            <div class="description-banner">
              <h3>How Pricing Is Applied</h3>
              <p>
                These values are used in player billing. Session rates are charged per game per
                player, while reservation rates are charged per court hour.
              </p>
            </div>

            <div class="section-divider">
              <span>Session Billing Rates</span>
            </div>
            <p class="section-text">
              Use these rates for court sessions recorded by admin. Light and no-light rates let
              you reflect different operational costs.
            </p>

            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-icon">🌙</div>
                <div class="form-group">
                  <label for="withoutLightRate">Without Light Rate (per game per player)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="withoutLightRate"
                      type="number"
                      [(ngModel)]="withoutLightRate"
                      name="withoutLightRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Applied when the game is played without lights.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">💡</div>
                <div class="form-group">
                  <label for="lightRate">With Light Rate (per game per player)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="lightRate"
                      type="number"
                      [(ngModel)]="lightRate"
                      name="lightRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Applied when lights are turned on during gameplay.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🎯</div>
                <div class="form-group">
                  <label for="training2WithoutLightRate"
                    >Training 2 Without Light Rate (per game per player)</label
                  >
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="training2WithoutLightRate"
                      type="number"
                      [(ngModel)]="training2WithoutLightRate"
                      name="training2WithoutLightRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Training Court 2 sessions billed without light usage.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🏟️</div>
                <div class="form-group">
                  <label for="training2LightRate"
                    >Training 2 With Light Rate (per game per player)</label
                  >
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="training2LightRate"
                      type="number"
                      [(ngModel)]="training2LightRate"
                      name="training2LightRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Training Court 2 sessions billed with light usage.</p>
                </div>
              </div>

              <div class="rate-item">
                <div class="rate-icon">🙋</div>
                <div class="form-group">
                  <label for="ballBoyRate">Ball Boy Fee (per game per player)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="ballBoyRate"
                      type="number"
                      [(ngModel)]="ballBoyRate"
                      name="ballBoyRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Optional per-game fee when a ball boy is requested.</p>
                </div>
              </div>
            </div>

            <div class="section-divider">
              <span>Court Reservation Fees (per hour)</span>
            </div>
            <p class="section-text">
              Flat rate per hour — applies to all time slots regardless of lights. Mon–Thu use the
              weekday rate, Fri–Sun use the weekend rate. Players can mark a booking as a holiday
              to apply the holiday rate instead.
            </p>

            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-icon">📅</div>
                <div class="form-group">
                  <label for="reservationWeekdayRate">Weekday Rate — Mon to Thu (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="reservationWeekdayRate"
                      type="number"
                      [(ngModel)]="reservationWeekdayRate"
                      name="reservationWeekdayRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
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
                    <input
                      id="reservationWeekendRate"
                      type="number"
                      [(ngModel)]="reservationWeekendRate"
                      name="reservationWeekendRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
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
                    <input
                      id="reservationHolidayRate"
                      type="number"
                      [(ngModel)]="reservationHolidayRate"
                      name="reservationHolidayRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Applied when the player marks the booking as a holiday.</p>
                </div>
              </div>
            </div>

            <p class="section-note">
              💡 Lights fee uses the <strong>With Light Rate</strong> from Session Billing above.
            </p>

            <div class="rates-grid" style="margin-top: .75rem">
              <div class="rate-item">
                <div class="rate-icon">🧑‍🤝‍🧑</div>
                <div class="form-group">
                  <label for="reservationGuestFee">Guest Fee (per guest)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="reservationGuestFee"
                      type="number"
                      [(ngModel)]="reservationGuestFee"
                      name="reservationGuestFee"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Charged per non-member guest joining the court booking.</p>
                </div>
              </div>
            </div>

            <div class="section-divider"><span>Rentals (per hour)</span></div>
            <p class="section-text">Rates for equipment available for rent during court bookings.</p>

            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-icon">🎾</div>
                <div class="form-group">
                  <label for="rentalBalls50Rate">Balls — 50 pcs (per hour)</label>
                  <div class="input-prefix">
                    <span>₱</span>
                    <input
                      id="rentalBalls50Rate"
                      type="number"
                      [(ngModel)]="rentalBalls50Rate"
                      name="rentalBalls50Rate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
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
                    <input
                      id="rentalBalls100Rate"
                      type="number"
                      [(ngModel)]="rentalBalls100Rate"
                      name="rentalBalls100Rate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
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
                    <input
                      id="rentalBallMachineRate"
                      type="number"
                      [(ngModel)]="rentalBallMachineRate"
                      name="rentalBallMachineRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
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
                    <input
                      id="rentalRacketRate"
                      type="number"
                      [(ngModel)]="rentalRacketRate"
                      name="rentalRacketRate"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <p class="field-help">Per racket rental per booking hour.</p>
                </div>
              </div>
            </div>

            @if (lastUpdated()) {
              <p class="last-updated">Last updated: {{ lastUpdated() | date: 'medium' }}</p>
            }

            @if (successMsg()) {
              <div class="alert alert-success">{{ successMsg() }}</div>
            }
            @if (errorMsg()) {
              <div class="alert alert-error">{{ errorMsg() }}</div>
            }

            <div class="form-actions">
              <button type="submit" class="btn-primary" [disabled]="saving()">
                {{ saving() ? 'Saving...' : 'Save Rates' }}
              </button>
            </div>
          </form>
        </div>

        <div class="billing-preview">
          <h3>Billing Formula Preview</h3>
          <div class="formula-card">
            <div class="formula-row">
              <span>🌙 Without Light Fee</span>
              <span>= games without light × {{ withoutLightRate | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>💡 With Light Fee</span>
              <span>= games with light × {{ lightRate | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>🎯 Training 2 Without Light</span>
              <span>= games × {{ training2WithoutLightRate | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>🏟️ Training 2 With Light</span>
              <span>= games × {{ training2LightRate | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>🙋 Ball Boy Fee (if used)</span>
              <span>= total games × {{ ballBoyRate | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row highlight-weekday">
              <span>📅 Reservation — Weekday (Mon–Thu)</span>
              <span>= {{ reservationWeekdayRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row highlight-weekend">
              <span>🎉 Reservation — Weekend (Fri–Sun)</span>
              <span>= {{ reservationWeekendRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row highlight-holiday">
              <span>🏖️ Reservation — Holiday</span>
              <span>= {{ reservationHolidayRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>💡 Reservation Lights (if requested)</span>
              <span>= + {{ lightRate | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>🧑‍🤝‍🧑 Guest Fee (per guest)</span>
              <span>= guests × {{ reservationGuestFee | currency: 'PHP' : 'symbol' }}</span>
            </div>
            <div class="formula-row">
              <span>🎾 Balls 50 pcs rental</span>
              <span>= {{ rentalBalls50Rate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>🎾 Balls 100 pcs rental</span>
              <span>= {{ rentalBalls100Rate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>🤖 Ball Machine rental</span>
              <span>= {{ rentalBallMachineRate | currency: 'PHP' : 'symbol' }} / hr</span>
            </div>
            <div class="formula-row">
              <span>🏓 Racket rental (per racket)</span>
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
        --ink: #102226;
        --teal-700: #16636f;
        --teal-600: #1d7b87;
        --sand: #f6f2e8;
        --line: rgba(16, 34, 38, 0.11);
        --card-bg: rgba(255, 255, 255, 0.95);
        display: block;
        font-family: 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif;
      }

      .rates-shell {
        display: grid;
        gap: 0.95rem;
      }

      .page-header {
        background:
          radial-gradient(circle at top right, rgba(242, 183, 75, 0.28), transparent 44%),
          linear-gradient(145deg, var(--sand), #ffffff);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 1rem 1.2rem;
        box-shadow: 0 10px 28px rgba(7, 24, 28, 0.12);
      }

      .hero-kicker {
        margin: 0 0 0.15rem;
        color: var(--teal-700);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.74rem;
        font-weight: 800;
      }

      .page-header h2 {
        margin: 0;
        color: var(--ink);
        font-size: 1.35rem;
        letter-spacing: -0.02em;
      }

      .subtitle {
        margin: 0.35rem 0 0;
        color: rgba(16, 34, 38, 0.72);
        font-size: 0.9rem;
      }

      .loading {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 12px;
        color: rgba(16, 34, 38, 0.74);
        padding: 1rem;
        box-shadow: 0 8px 22px rgba(10, 20, 24, 0.09);
      }

      .rates-card,
      .billing-preview {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 0.95rem;
        box-shadow: 0 8px 22px rgba(10, 20, 24, 0.09);
      }

      .description-banner {
        border: 1px solid rgba(22, 99, 111, 0.18);
        background: linear-gradient(135deg, #f0fafb 0%, #e8f5f7 100%);
        border-radius: 10px;
        padding: 0.9rem 1rem;
        margin-bottom: 1rem;
      }

      .description-banner h3 {
        margin: 0 0 0.35rem;
        color: var(--ink);
        font-size: 0.96rem;
      }

      .description-banner p,
      .section-text {
        margin: 0;
        color: rgba(16, 34, 38, 0.72);
        font-size: 0.84rem;
        line-height: 1.45;
      }

      .section-text {
        margin: -0.35rem 0 1rem;
      }

      .rates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.85rem;
        margin-bottom: 1rem;
      }

      .rate-item {
        display: flex;
        gap: 0.65rem;
        align-items: flex-start;
        background: #ffffff;
        border: 1px solid rgba(16, 34, 38, 0.11);
        border-radius: 12px;
        padding: 0.75rem;
      }

      .rate-icon {
        font-size: 1.45rem;
        margin-top: 0.25rem;
      }

      .form-group {
        width: 100%;
      }

      .form-group label {
        color: var(--ink);
        font-size: 0.84rem;
        font-weight: 700;
      }

      .input-prefix {
        display: flex;
        align-items: center;
        border: 1px solid rgba(16, 34, 38, 0.2);
        border-radius: 8px;
        overflow: hidden;
        background: #ffffff;
      }

      .input-prefix span {
        padding: 0.58rem 0.72rem;
        background: #f4f8f9;
        border-right: 1px solid rgba(16, 34, 38, 0.18);
        color: rgba(16, 34, 38, 0.75);
        font-size: 0.9rem;
        font-weight: 700;
      }

      .input-prefix input {
        border: none;
        padding: 0.58rem 0.72rem;
        width: 100%;
        font-size: 0.95rem;
        color: var(--ink);
      }

      .input-prefix input:focus {
        outline: none;
      }

      .input-prefix:focus-within {
        border-color: #0f7481;
        box-shadow: 0 0 0 2px rgba(15, 116, 129, 0.14);
      }

      .field-help {
        margin: 0.4rem 0 0;
        font-size: 0.78rem;
        color: rgba(16, 34, 38, 0.66);
        line-height: 1.4;
      }

      .section-note {
        font-size: 0.82rem;
        color: rgba(16, 34, 38, 0.72);
        margin: 0.25rem 0 0.75rem;
        padding: 0.55rem 0.72rem;
        background: #edf9ef;
        border-radius: 8px;
        border-left: 3px solid #79d89a;
      }

      .section-divider {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 1.45rem 0 1rem;
        color: rgba(16, 34, 38, 0.62);
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .section-divider::before,
      .section-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(16, 34, 38, 0.13);
      }

      .last-updated {
        color: rgba(16, 34, 38, 0.64);
        font-size: 0.82rem;
        margin-bottom: 1rem;
      }

      .form-actions {
        margin-top: 1.25rem;
      }

      .form-actions .btn-primary {
        background: linear-gradient(145deg, var(--teal-600), #155860);
        color: #ffffff;
        border: none;
        border-radius: 10px;
        padding: 0.6rem 1rem;
        font-weight: 700;
        box-shadow: 0 8px 16px rgba(21, 88, 96, 0.26);
      }

      .form-actions .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 10px 18px rgba(21, 88, 96, 0.32);
      }

      .form-actions .btn-primary:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .alert {
        border-radius: 8px;
        padding: 0.6rem 0.7rem;
        font-size: 0.84rem;
        margin-top: 0.7rem;
      }

      .alert-success {
        background: #ecfdf3;
        color: #106a2f;
        border: 1px solid rgba(16, 106, 47, 0.24);
      }

      .alert-error {
        background: #fff1f1;
        color: #b22e2e;
        border: 1px solid rgba(178, 46, 46, 0.24);
      }

      .billing-preview h3 {
        color: var(--ink);
        font-size: 1rem;
        margin: 0 0 0.75rem;
      }

      .formula-card {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .formula-row {
        display: flex;
        justify-content: space-between;
        gap: 0.6rem;
        padding: 0.58rem 0.68rem;
        background: #f4f9fa;
        border: 1px solid rgba(16, 34, 38, 0.09);
        border-radius: 8px;
        font-size: 0.85rem;
      }

      .formula-row span:last-child {
        font-weight: 600;
        color: var(--teal-700);
        text-align: right;
      }

      .highlight-weekday {
        background: #f0fdf4;
      }

      .highlight-weekday span:last-child {
        color: #15803d;
      }

      .highlight-weekend {
        background: #fff7ed;
      }

      .highlight-weekend span:last-child {
        color: #c2410c;
      }

      .highlight-holiday {
        background: #fdf4ff;
      }

      .highlight-holiday span:last-child {
        color: #7e22ce;
      }

      @media (max-width: 640px) {
        .rates-shell {
          gap: 0.8rem;
        }

        .page-header {
          padding: 0.85rem;
        }

        .page-header h2 {
          font-size: 1.2rem;
        }

        .subtitle {
          font-size: 0.84rem;
        }

        .rates-card,
        .billing-preview {
          padding: 0.78rem;
        }

        .rates-grid {
          grid-template-columns: 1fr;
          gap: 0.7rem;
        }

        .rate-item {
          padding: 0.68rem;
        }

        .formula-row {
          flex-direction: column;
          align-items: flex-start;
        }

        .formula-row span:last-child {
          text-align: left;
        }

        .form-actions .btn-primary {
          width: 100%;
        }
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
  rentalBalls50Rate = 0;
  rentalBalls100Rate = 0;
  rentalBallMachineRate = 0;
  rentalRacketRate = 0;
  readonly lastUpdated = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly successMsg = signal('');
  readonly errorMsg = signal('');

  constructor(private ratesService: RatesService) {}

  ngOnInit() {
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
          this.rentalBalls50Rate = rates.rentalBalls50Rate ?? 0;
          this.rentalBalls100Rate = rates.rentalBalls100Rate ?? 0;
          this.rentalBallMachineRate = rates.rentalBallMachineRate ?? 0;
          this.rentalRacketRate = rates.rentalRacketRate ?? 0;
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
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    this.ratesService
      .updateRates({
        withoutLightRate: Number(this.withoutLightRate),
        lightRate: Number(this.lightRate),
        training2WithoutLightRate: Number(this.training2WithoutLightRate),
        training2LightRate: Number(this.training2LightRate),
        ballBoyRate: Number(this.ballBoyRate),
        reservationWeekdayRate: Number(this.reservationWeekdayRate),
        reservationWeekendRate: Number(this.reservationWeekendRate),
        reservationHolidayRate: Number(this.reservationHolidayRate),
        reservationGuestFee: Number(this.reservationGuestFee),
        rentalBalls50Rate: Number(this.rentalBalls50Rate),
        rentalBalls100Rate: Number(this.rentalBalls100Rate),
        rentalBallMachineRate: Number(this.rentalBallMachineRate),
        rentalRacketRate: Number(this.rentalRacketRate),
      })
      .pipe(timeout(10000))
      .subscribe({
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
