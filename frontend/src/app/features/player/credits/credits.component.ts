import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CreditService, CreditEntry } from '../../../core/services/credit.service';

@Component({
  selector: 'app-my-credits',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dm-shell">
      <header class="dm-header">
        <button class="dm-back-btn" (click)="goBack()">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">My Credits</span>
      </header>

      <div class="dm-body">
        <div class="dm-credit-hero">
          <div class="dm-credit-hero-icon"><i class="fas fa-coins"></i></div>
          <div class="dm-credit-hero-amount">{{ balance | currency: 'PHP' : 'symbol' }}</div>
          <div class="dm-credit-hero-label">Available Credit</div>
        </div>

        <h4 class="dm-section-label">History</h4>

        @if (loading) {
          <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading history…</div>
        } @else if (history.length === 0) {
          <div class="dm-empty">
            <i class="fas fa-receipt"></i>
            <p>No credit activity yet.</p>
          </div>
        } @else {
          <div class="dm-history-list">
            @for (entry of history; track entry._id) {
              <div class="dm-history-item">
                <div class="dm-history-icon" [class.dm-history-icon-grant]="entry.amount > 0">
                  <i class="fas" [class.fa-plus]="entry.amount > 0" [class.fa-minus]="entry.amount < 0"></i>
                </div>
                <div class="dm-history-info">
                  <div class="dm-history-reason">{{ entry.reason || (entry.type === 'redemption' ? 'Applied to a charge' : '—') }}</div>
                  <div class="dm-history-meta">{{ entry.createdAt | date: 'MMM d, yyyy h:mm a' }}</div>
                </div>
                <div class="dm-history-amount" [class.dm-amount-negative]="entry.amount < 0">
                  {{ entry.amount > 0 ? '+' : '' }}{{ entry.amount | currency: 'PHP' : 'symbol' }}
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
        max-width: 720px;
        height: auto;
        min-height: calc(100vh - 60px);
      }
    }

    .dm-header {
      background: #111f16;
      padding: 1rem 1rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .dm-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.7);
      width: 34px; height: 34px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
      transition: background 0.2s;
    }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }

    .dm-header-title {
      flex: 1;
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }

    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 769px) {
      .dm-body {
        overflow-y: visible;
        padding: 1.5rem 2rem 2rem;
      }
    }

    .dm-credit-hero {
      background: #111f16;
      border: 1px solid rgba(163,230,53,0.16);
      border-radius: 14px;
      padding: 1.75rem 1rem;
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .dm-credit-hero-icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(163,230,53,0.12); color: #a3e635;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; margin: 0 auto 0.75rem;
    }
    .dm-credit-hero-amount { font-size: 1.9rem; font-weight: 800; color: #ffffff; }
    .dm-credit-hero-label { font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.4px; }

    .dm-section-label {
      font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.5);
      text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 0.75rem;
    }

    .dm-state-msg {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.40);
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .dm-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.35);
    }
    .dm-empty i { font-size: 2rem; display: block; margin-bottom: 0.75rem; opacity: 0.4; }
    .dm-empty p { margin: 0; font-size: 0.88rem; }

    .dm-history-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .dm-history-item {
      display: flex; align-items: center; gap: 0.75rem;
      background: #111f16; border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px; padding: 0.75rem;
    }
    .dm-history-icon {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      background: rgba(239,68,68,0.14); color: #fca5a5;
      display: flex; align-items: center; justify-content: center; font-size: 0.75rem;
    }
    .dm-history-icon-grant { background: rgba(163,230,53,0.14); color: #a3e635; }
    .dm-history-info { flex: 1; min-width: 0; }
    .dm-history-reason { font-size: 0.85rem; color: #ffffff; }
    .dm-history-meta { font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 2px; }
    .dm-history-amount { font-weight: 700; color: #86efac; white-space: nowrap; font-size: 0.88rem; }
    .dm-amount-negative { color: #fca5a5; }
  `],
})
export class CreditsComponent implements OnInit, OnDestroy {
  balance = 0;
  history: CreditEntry[] = [];
  loading = true;

  constructor(
    private creditService: CreditService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private router: Router,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');

    this.creditService.getMyCredit().subscribe({
      next: ({ balance, history }) => {
        this.balance = balance;
        this.history = history;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
