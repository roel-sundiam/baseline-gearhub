import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RatesService, Rates } from '../../../core/services/rates.service';

@Component({
  selector: 'app-player-rules',
  imports: [CurrencyPipe, DatePipe],
  template: `
    <div class="rules-page">
      <div class="rules-header">
        <button class="rules-back" (click)="goBack()">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="rules-header-text">
          <h1 class="rules-title"><i class="fas fa-gavel"></i> Club Rules & Pricing</h1>
          <p class="rules-subtitle">Current rates as set by your club admin</p>
        </div>
      </div>

      @if (loading()) {
        <div class="rules-loading">
          <div class="rules-spinner"></div>
          <span>Loading rates...</span>
        </div>
      } @else if (rates()) {
        <div class="rules-sections">

          <!-- Session Billing Rates -->
          <div class="rules-card">
            <div class="rules-card-header">
              <i class="fas fa-table-tennis"></i>
              <h2>Session Rates</h2>
              <span class="rules-card-note">per player / per game</span>
            </div>
            <div class="rules-rows">
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-sun"></i> Without Lights</span>
                <span class="rules-row-value">{{ rates()!.withoutLightRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-lightbulb"></i> With Lights</span>
                <span class="rules-row-value">{{ rates()!.lightRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-dumbbell"></i> Training (without lights)</span>
                <span class="rules-row-value">{{ rates()!.training2WithoutLightRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-dumbbell"></i> Training (with lights)</span>
                <span class="rules-row-value">{{ rates()!.training2LightRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-hand-sparkles"></i> Ball Boy</span>
                <span class="rules-row-value">{{ rates()!.ballBoyRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <!-- Court Reservation Fees -->
          <div class="rules-card">
            <div class="rules-card-header">
              <i class="fas fa-calendar-alt"></i>
              <h2>Court Reservation Fees</h2>
              <span class="rules-card-note">per hour</span>
            </div>
            <div class="rules-rows">
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-briefcase"></i> Weekday <small>(Mon – Thu)</small></span>
                <span class="rules-row-value">{{ rates()!.reservationWeekdayRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-umbrella-beach"></i> Weekend <small>(Fri – Sun)</small></span>
                <span class="rules-row-value">{{ rates()!.reservationWeekendRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-star"></i> Holiday</span>
                <span class="rules-row-value">{{ rates()!.reservationHolidayRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <!-- Guest Fee -->
          <div class="rules-card">
            <div class="rules-card-header">
              <i class="fas fa-user-plus"></i>
              <h2>Guest Fee</h2>
              <span class="rules-card-note">per guest</span>
            </div>
            <div class="rules-rows">
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-user"></i> Guest entry fee</span>
                <span class="rules-row-value">{{ rates()!.reservationGuestFee | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <!-- Rentals -->
          <div class="rules-card">
            <div class="rules-card-header">
              <i class="fas fa-shopping-bag"></i>
              <h2>Rentals</h2>
              <span class="rules-card-note">per hour</span>
            </div>
            <div class="rules-rows">
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-circle"></i> Balls — 50 pcs</span>
                <span class="rules-row-value">{{ rates()!.rentalBalls50Rate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-circle"></i> Balls — 100 pcs</span>
                <span class="rules-row-value">{{ rates()!.rentalBalls100Rate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-robot"></i> Ball Machine</span>
                <span class="rules-row-value">{{ rates()!.rentalBallMachineRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="rules-row">
                <span class="rules-row-label"><i class="fas fa-baseball-ball"></i> Racket</span>
                <span class="rules-row-value">{{ rates()!.rentalRacketRate | currency:'PHP':'symbol':'1.0-0' }}</span>
              </div>
            </div>
          </div>

        </div>

        @if (rates()!.updatedAt) {
          <p class="rules-updated">Last updated: {{ rates()!.updatedAt | date:'mediumDate' }}</p>
        }

      } @else {
        <div class="rules-empty">
          <i class="fas fa-info-circle"></i>
          <p>Rates have not been configured yet. Contact your club admin.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .rules-page {
      max-width: 640px;
      margin: 0 auto;
      padding-bottom: 2rem;
    }

    .rules-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .rules-back {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #fff;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .rules-back:hover { background: rgba(255,255,255,0.13); }
    .rules-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.15rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .rules-title i { color: #a3e635; }
    .rules-subtitle {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.45);
      margin: 0;
    }

    .rules-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 4rem 0;
      color: rgba(255,255,255,0.5);
      font-size: 0.9rem;
    }
    .rules-spinner {
      width: 32px;
      height: 32px;
      border: 2px solid rgba(163,230,53,0.2);
      border-top-color: #a3e635;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .rules-sections {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .rules-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      overflow: hidden;
    }
    .rules-card-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.9rem 1.1rem;
      background: rgba(163,230,53,0.07);
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .rules-card-header i {
      color: #a3e635;
      font-size: 1rem;
      width: 18px;
      text-align: center;
    }
    .rules-card-header h2 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      margin: 0;
      flex: 1;
    }
    .rules-card-note {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.4);
      font-style: italic;
    }

    .rules-rows {
      padding: 0.4rem 0;
    }
    .rules-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 1.1rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .rules-row:last-child { border-bottom: none; }
    .rules-row-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.87rem;
      color: rgba(255,255,255,0.8);
    }
    .rules-row-label i {
      color: rgba(163,230,53,0.6);
      width: 14px;
      text-align: center;
      font-size: 0.8rem;
    }
    .rules-row-label small {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.4);
    }
    .rules-row-value {
      font-size: 0.95rem;
      font-weight: 700;
      color: #a3e635;
      letter-spacing: 0.01em;
    }

    .rules-updated {
      text-align: center;
      font-size: 0.75rem;
      color: rgba(255,255,255,0.3);
      margin-top: 1rem;
    }

    .rules-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.4);
    }
    .rules-empty i {
      font-size: 2rem;
      margin-bottom: 0.75rem;
      display: block;
      color: rgba(163,230,53,0.4);
    }
    .rules-empty p { margin: 0; font-size: 0.9rem; }
  `],
})
export class PlayerRulesComponent implements OnInit {
  private ratesService = inject(RatesService);
  private router = inject(Router);

  rates = signal<Rates | null>(null);
  loading = signal(true);

  ngOnInit() {
    this.ratesService.getRates().subscribe({
      next: r => {
        this.rates.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
