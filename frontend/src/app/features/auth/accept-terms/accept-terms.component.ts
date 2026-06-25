import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-accept-terms',
  standalone: true,
  template: `
    <div class="page">
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>

      <div class="card">
        <img src="/CourtGo.png" alt="CourtGo" class="card-logo" />
        <h1>Terms &amp; Conditions</h1>
        <p class="card-sub">Please read and accept before continuing</p>

        <div class="terms-body">
          <p class="terms-section-title">1. Acceptance of Terms</p>
          <p>By accepting these Terms &amp; Conditions, you ("Club Administrator") agree to be bound by this agreement with CourtGo ("Platform"). If you do not agree, you may not use the Platform.</p>

          <p class="terms-section-title">2. Club Administrator Responsibilities</p>
          <p>You are responsible for:</p>
          <ul>
            <li>Ensuring accurate club information, court availability, and pricing are maintained on the Platform</li>
            <li>Managing member registrations, approvals, and access within your club</li>
            <li>Complying with all applicable local laws regarding sports facility operation</li>
            <li>Keeping your account credentials secure and confidential</li>
          </ul>

          <p class="terms-section-title">3. Reservations &amp; Bookings</p>
          <p>You agree to honor all reservations made through the Platform by members and guests. Cancellation policies you set must be applied fairly and consistently.</p>

          <p class="terms-section-title">4. Convenience Fee</p>
          <p>As a Club Administrator, you acknowledge that CourtGo charges a convenience fee for the use of the Platform and its services. This fee covers platform maintenance, booking management, and ongoing support. The applicable fee rate will be communicated to you separately and may be updated by CourtGo with reasonable notice. Continued use of the Platform after notice of a fee change constitutes acceptance of the updated fee.</p>

          <p class="terms-section-title">5. Member Data</p>
          <p>You will only use member information collected through the Platform for the purpose of managing club activities. You may not sell, share, or misuse member personal data.</p>

          <p class="terms-section-title">6. Prohibited Conduct</p>
          <p>You may not use the Platform to post false information, discriminate against members, or conduct any activity that violates applicable law.</p>

          <p class="terms-section-title">7. Account Suspension</p>
          <p>CourtGo reserves the right to suspend or terminate your club account for violation of these terms, fraudulent activity, or conduct harmful to members.</p>

          <p class="terms-section-title">8. Limitation of Liability</p>
          <p>CourtGo is not liable for disputes between club administrators and members, or for losses arising from your use of the Platform.</p>

          <p class="terms-section-title">9. Changes to Terms</p>
          <p>CourtGo may update these terms. Continued use of the Platform constitutes acceptance of updated terms.</p>
        </div>

        @if (errorMsg()) {
          <div class="alert-error">{{ errorMsg() }}</div>
        }

        <div class="actions">
          <button class="btn-accept" [disabled]="loading()" (click)="onAccept()">
            {{ loading() ? 'Processing...' : 'I Accept' }}
          </button>
          <button class="btn-decline" [disabled]="loading()" (click)="onDecline()">
            Decline &amp; Log Out
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--dm-bg, #0c1a11);
      padding: 2rem 1rem;
      position: relative;
      overflow: hidden;
    }

    .bg-orb {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, rgba(163,230,53,0.45), rgba(163,230,53,0.03));
      filter: blur(28px);
      pointer-events: none;
      animation: float ease-in-out infinite alternate;
    }
    .bg-orb-1 { width: 340px; height: 340px; top: -100px; left: -100px; opacity: 0.2; animation-duration: 10s; }
    .bg-orb-2 { width: 200px; height: 200px; bottom: -60px; right: -60px; opacity: 0.14; animation-duration: 8s; animation-delay: -4s; }

    @keyframes float {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-24px) scale(1.06); }
    }

    .card {
      position: relative;
      z-index: 1;
      background: var(--dm-surface, #1b3028);
      border: 1px solid rgba(163,230,53,0.1);
      border-radius: 20px;
      padding: 2.5rem 2.25rem;
      width: 100%;
      max-width: 560px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }

    .card-logo {
      height: 32px;
      width: auto;
      display: block;
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 1.65rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.35rem;
      letter-spacing: -0.01em;
    }

    .card-sub {
      font-size: 0.875rem;
      color: rgba(255,255,255,0.4);
      margin: 0 0 1.5rem;
    }

    .terms-body {
      background: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 1.25rem 1.4rem;
      max-height: 340px;
      overflow-y: auto;
      margin-bottom: 1.5rem;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.7);
      line-height: 1.65;
      scrollbar-width: thin;
      scrollbar-color: rgba(163,230,53,0.3) transparent;
    }

    .terms-body p { margin: 0 0 0.6rem; }

    .terms-section-title {
      font-weight: 700;
      color: #a3e635;
      margin-top: 1rem !important;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .terms-body ul {
      margin: 0.25rem 0 0.6rem 1.2rem;
      padding: 0;
    }
    .terms-body li { margin-bottom: 0.3rem; }

    .alert-error {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 0.75rem;
      font-size: 0.875rem;
      background: rgba(239,68,68,0.1);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.2);
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .btn-accept {
      width: 100%;
      padding: 0.9rem;
      border-radius: 10px;
      border: none;
      background: #a3e635;
      color: #0c1a11;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
      box-shadow: 0 4px 18px rgba(163,230,53,0.28);
    }
    .btn-accept:hover:not(:disabled) {
      background: #b5f040;
      box-shadow: 0 6px 24px rgba(163,230,53,0.4);
      transform: translateY(-1px);
    }
    .btn-accept:disabled { opacity: 0.55; cursor: not-allowed; }

    .btn-decline {
      width: 100%;
      padding: 0.75rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: transparent;
      color: rgba(255,255,255,0.45);
      font-size: 0.85rem;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-decline:hover:not(:disabled) {
      color: rgba(255,255,255,0.7);
      border-color: rgba(255,255,255,0.25);
    }
    .btn-decline:disabled { opacity: 0.45; cursor: not-allowed; }
  `],
})
export class AcceptTermsComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  errorMsg = signal('');

  onAccept() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.auth.acceptTerms().subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('Something went wrong. Please try again.');
      },
    });
  }

  onDecline() {
    this.auth.logout();
  }
}
