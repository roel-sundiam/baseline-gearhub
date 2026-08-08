import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SponsorService, Sponsor } from '../../../core/services/sponsor.service';

@Component({
  selector: 'app-partners',
  template: `
    <div class="pt-page">
      <div class="pt-header">
        <button class="pt-back" (click)="router.navigate(['/player/dashboard'])">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div>
          <h1 class="pt-title"><i class="fas fa-handshake"></i> Partners</h1>
          <p class="pt-subtitle">Local businesses sponsoring CourtGo</p>
        </div>
      </div>

      @if (loading()) {
        <div class="pt-loading">
          <div class="pt-spinner"></div>
          <span>Loading partners...</span>
        </div>
      } @else if (items().length === 0) {
        <div class="pt-empty">
          <i class="fas fa-handshake"></i>
          <p>No partners featured right now — check back soon.</p>
        </div>
      } @else {
        <div class="pt-list">
          @for (item of items(); track item._id) {
            <div class="pt-card">
              <div class="pt-card-top">
                <img [src]="item.logoUrl" alt="" class="pt-card-logo" />
                <div class="pt-card-top-info">
                  <span class="pt-sponsored-badge">Sponsored</span>
                  <h3 class="pt-card-title">{{ item.businessName }}</h3>
                </div>
              </div>
              <p class="pt-card-body">{{ item.description }}</p>
              @if (item.promoText) { <p class="pt-card-promo"><i class="fas fa-tag"></i> {{ item.promoText }}</p> }
              <a [href]="item.link" target="_blank" rel="noopener" class="pt-visit-btn">
                Visit <i class="fas fa-arrow-up-right-from-square"></i>
              </a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .pt-page { max-width: 640px; margin: 0 auto; padding-bottom: 2rem; }
    .pt-header { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.5rem; }
    .pt-back {
      background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: #fff;
      width: 36px; height: 36px; border-radius: 10px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0;
      transition: background 0.15s;
    }
    .pt-back:hover { background: rgba(255,255,255,0.13); }
    .pt-title { font-size: 1.2rem; font-weight: 700; color: #fff; margin: 0 0 0.1rem; }
    .pt-title i { color: #a3e635; margin-right: 0.4rem; }
    .pt-subtitle { font-size: 0.77rem; color: rgba(255,255,255,0.4); margin: 0; }

    .pt-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem 0; color: rgba(255,255,255,0.5); font-size: 0.9rem; }
    .pt-spinner { width: 28px; height: 28px; border: 2px solid rgba(163,230,53,0.2); border-top-color: #a3e635; border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pt-empty { text-align: center; padding: 3rem 1rem; color: rgba(255,255,255,0.35); }
    .pt-empty i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; color: rgba(163,230,53,0.3); }
    .pt-empty p { margin: 0; font-size: 0.9rem; }

    .pt-list { display: flex; flex-direction: column; gap: 0.85rem; }
    .pt-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 1.1rem; }
    .pt-card-top { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.6rem; }
    .pt-card-logo { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.12); }
    .pt-card-top-info { flex: 1; min-width: 0; }
    .pt-sponsored-badge {
      display: inline-block; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.08); padding: 0.15rem 0.5rem; border-radius: 99px;
      margin-bottom: 0.3rem;
    }
    .pt-card-title { font-size: 1rem; font-weight: 700; color: #fff; margin: 0; }
    .pt-card-body { font-size: 0.85rem; color: rgba(255,255,255,0.65); margin: 0 0 0.5rem; line-height: 1.5; }
    .pt-card-promo { font-size: 0.82rem; color: #fbbf24; margin: 0 0 0.75rem; display: flex; align-items: center; gap: 0.35rem; }
    .pt-visit-btn {
      display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(163,230,53,0.12); color: #a3e635;
      border: 1px solid rgba(163,230,53,0.3); border-radius: 9px; padding: 0.45rem 0.9rem; font-size: 0.82rem;
      font-weight: 700; text-decoration: none; transition: background 0.15s;
    }
    .pt-visit-btn:hover { background: rgba(163,230,53,0.2); }
  `],
})
export class PlayerPartnersComponent implements OnInit {
  protected router = inject(Router);
  private sponsorService = inject(SponsorService);

  items = signal<Sponsor[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.sponsorService.getActiveSponsors().subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
