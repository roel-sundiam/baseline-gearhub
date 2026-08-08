import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SponsorService } from '../../core/services/sponsor.service';

@Component({
  selector: 'app-partner-apply',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="pa-page">
      <div class="pa-shell">
        <a routerLink="/" class="pa-brand">
          <img src="/CourtGo.png" alt="CourtGo" class="pa-logo" />
        </a>

        @if (submitted()) {
          <div class="pa-success">
            <div class="pa-success-icon"><i class="fas fa-circle-check"></i></div>
            <h1>Thanks for reaching out!</h1>
            <p>We've received your application. Our team reviews every request and will follow up at the email you provided if it's a good fit.</p>
            <a routerLink="/" class="pa-back-link">Back to CourtGo</a>
          </div>
        } @else {
          <div class="pa-card">
            <span class="pa-kicker"><i class="fas fa-handshake"></i> Sponsored Partners</span>
            <h1 class="pa-title">Become a CourtGo Partner</h1>
            <p class="pa-sub">
              Get your business featured in front of active players — logo, description, and a promo
              of your choice, shown on the CourtGo app and club pages for a period you choose.
            </p>
            <p class="pa-email-note">
              Prefer email? Reach us directly at
              <a href="mailto:courtgo.club@outlook.com">courtgo.club@outlook.com</a>
            </p>

            <form class="pa-form" (ngSubmit)="submit()">
              <div class="pa-field">
                <label>Business Name <span class="pa-req">*</span></label>
                <input type="text" [(ngModel)]="form.businessName" name="businessName" placeholder="e.g. Baseline Sports Shop" class="pa-input" required />
              </div>
              <div class="pa-row">
                <div class="pa-field">
                  <label>Your Name <span class="pa-req">*</span></label>
                  <input type="text" [(ngModel)]="form.contactName" name="contactName" placeholder="Contact person" class="pa-input" required />
                </div>
                <div class="pa-field">
                  <label>Email <span class="pa-req">*</span></label>
                  <input type="email" [(ngModel)]="form.email" name="email" placeholder="you@business.com" class="pa-input" required />
                </div>
              </div>
              <div class="pa-field">
                <label>Phone</label>
                <input type="tel" [(ngModel)]="form.phone" name="phone" placeholder="Optional" class="pa-input" />
              </div>
              <div class="pa-field">
                <label>Tell us about your business <span class="pa-req">*</span></label>
                <textarea [(ngModel)]="form.message" name="message" rows="4" maxlength="1000"
                  placeholder="What do you offer, and what would you like to promote to CourtGo members?" class="pa-input pa-textarea" required></textarea>
              </div>

              @if (error()) { <p class="pa-error">{{ error() }}</p> }

              <button type="submit" class="pa-submit" [disabled]="submitting()">
                @if (submitting()) { <i class="fas fa-circle-notch fa-spin"></i> Sending... }
                @else { <i class="fas fa-paper-plane"></i> Submit Application }
              </button>
            </form>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pa-page {
      min-height: 100vh;
      background: #0a1610;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.25rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .pa-shell { width: 100%; max-width: 540px; }
    .pa-brand { display: block; text-align: center; margin-bottom: 1.75rem; }
    .pa-logo { height: 32px; width: auto; }

    .pa-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 2rem;
    }
    .pa-kicker {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.09em;
      text-transform: uppercase; color: #7cff4e;
      margin-bottom: 0.85rem;
    }
    .pa-title { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 0 0 0.6rem; letter-spacing: -0.02em; }
    .pa-sub { font-size: 0.88rem; color: rgba(255,255,255,0.48); line-height: 1.65; margin: 0 0 0.85rem; }
    .pa-email-note {
      font-size: 0.83rem; color: rgba(255,255,255,0.4);
      margin: 0 0 1.75rem;
    }
    .pa-email-note a { color: #7cff4e; text-decoration: none; font-weight: 600; }
    .pa-email-note a:hover { text-decoration: underline; }

    .pa-form { display: flex; flex-direction: column; gap: 1rem; }
    .pa-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .pa-field { display: flex; flex-direction: column; gap: 0.4rem; }
    .pa-field label { font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600; }
    .pa-req { color: #7cff4e; }
    .pa-input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px; color: #fff; padding: 0.7rem 0.85rem; font-size: 0.9rem;
      font-family: inherit; outline: none; transition: border-color 0.15s; box-sizing: border-box; width: 100%;
    }
    .pa-input:focus { border-color: rgba(124,255,78,0.5); }
    .pa-input::placeholder { color: rgba(255,255,255,0.28); }
    .pa-textarea { resize: vertical; min-height: 100px; }

    .pa-error { color: #f87171; font-size: 0.83rem; margin: 0; }

    .pa-submit {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      background: #7cff4e; color: #081209; border: none; border-radius: 10px;
      padding: 0.85rem; font-size: 0.92rem; font-weight: 700; cursor: pointer;
      font-family: inherit; transition: background 0.15s, opacity 0.15s;
      box-shadow: 0 0 22px rgba(124,255,78,0.3);
    }
    .pa-submit:hover:not(:disabled) { background: #8fff5e; }
    .pa-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .pa-success {
      text-align: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(124,255,78,0.2);
      border-radius: 20px;
      padding: 3rem 2rem;
    }
    .pa-success-icon { font-size: 2.75rem; color: #7cff4e; margin-bottom: 1rem; }
    .pa-success h1 { font-size: 1.4rem; font-weight: 800; margin: 0 0 0.75rem; }
    .pa-success p { font-size: 0.9rem; color: rgba(255,255,255,0.5); line-height: 1.65; margin: 0 0 1.5rem; }
    .pa-back-link {
      display: inline-flex; color: #7cff4e; text-decoration: none;
      font-size: 0.88rem; font-weight: 700;
      border: 1px solid rgba(124,255,78,0.3); border-radius: 9px;
      padding: 0.55rem 1.2rem; transition: background 0.15s;
    }
    .pa-back-link:hover { background: rgba(124,255,78,0.08); }

    @media (max-width: 480px) {
      .pa-card { padding: 1.5rem; }
      .pa-row { grid-template-columns: 1fr; }
    }
  `],
})
export class PartnerApplyComponent {
  private sponsorService = inject(SponsorService);

  form = { businessName: '', contactName: '', email: '', phone: '', message: '' };
  submitting = signal(false);
  submitted = signal(false);
  error = signal('');

  submit() {
    if (!this.form.businessName.trim()) { this.error.set('Business name is required.'); return; }
    if (!this.form.contactName.trim()) { this.error.set('Your name is required.'); return; }
    if (!this.form.email.trim()) { this.error.set('Email is required.'); return; }
    if (!this.form.message.trim()) { this.error.set('Please tell us a bit about your business.'); return; }

    this.error.set('');
    this.submitting.set(true);
    this.sponsorService.submitInquiry(this.form).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Something went wrong. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
