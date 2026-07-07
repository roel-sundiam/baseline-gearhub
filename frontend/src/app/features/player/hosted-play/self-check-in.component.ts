import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HostedPlayService } from '../../../core/services/hosted-play.service';

type CheckInState = 'loading' | 'success' | 'already_checked_in' | 'not_a_participant' | 'invalid_qr' | 'session_ended' | 'error';

@Component({
  selector: 'app-player-self-check-in',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="shell">
      <div class="card">
        @if (state === 'loading') {
          <div class="icon-wrap loading-icon"><i class="fas fa-circle-notch fa-spin"></i></div>
          <h2>Checking you in…</h2>
          <p>Please wait.</p>
        } @else if (state === 'success') {
          <div class="icon-wrap success-icon"><i class="fas fa-circle-check"></i></div>
          <h2>You're checked in!</h2>
          <p>You've been added to the waiting queue. Head to the courts and wait for your turn.</p>
          @if (sessionId) {
            <button class="primary-btn" (click)="viewBoard()">
              <i class="fas fa-list-ol"></i> View Live Board
            </button>
          }
        } @else if (state === 'already_checked_in') {
          <div class="icon-wrap info-icon"><i class="fas fa-circle-info"></i></div>
          <h2>Already checked in</h2>
          <p>You're already checked in for this session. Head to the courts!</p>
          @if (sessionId) {
            <button class="primary-btn" (click)="viewBoard()">
              <i class="fas fa-list-ol"></i> View Live Board
            </button>
          }
        } @else if (state === 'not_a_participant') {
          <div class="icon-wrap warn-icon"><i class="fas fa-circle-exclamation"></i></div>
          <h2>Not registered</h2>
          <p>You haven't joined this session. Join the session first before checking in.</p>
          <button class="secondary-btn" (click)="goHome()">
            <i class="fas fa-arrow-left"></i> Back to Hosted Play
          </button>
        } @else if (state === 'invalid_qr') {
          <div class="icon-wrap warn-icon"><i class="fas fa-qrcode"></i></div>
          <h2>Invalid QR code</h2>
          <p>This QR code is no longer valid. Ask the admin to show the latest QR code.</p>
          <button class="secondary-btn" (click)="goHome()">
            <i class="fas fa-arrow-left"></i> Back to Hosted Play
          </button>
        } @else if (state === 'session_ended') {
          <div class="icon-wrap warn-icon"><i class="fas fa-flag-checkered"></i></div>
          <h2>Session ended</h2>
          <p>This session has already concluded. Check the app for upcoming sessions.</p>
          <button class="secondary-btn" (click)="goHome()">
            <i class="fas fa-arrow-left"></i> Back to Hosted Play
          </button>
        } @else {
          <div class="icon-wrap error-icon"><i class="fas fa-triangle-exclamation"></i></div>
          <h2>Something went wrong</h2>
          <p>{{ errorMsg || 'Unable to check you in. Please try again or ask an admin.' }}</p>
          <button class="secondary-btn" (click)="retry()">
            <i class="fas fa-rotate-right"></i> Try again
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      background:
        radial-gradient(circle at 18% 0%, rgba(54,211,153,.14), transparent 28%),
        linear-gradient(135deg, #06110b 0%, #092015 48%, #07140d 100%);
      padding: 1.5rem;
    }

    .card {
      width: 100%;
      max-width: 400px;
      padding: 2.2rem 1.8rem;
      background: rgba(12, 28, 20, 0.92);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px;
      box-shadow: 0 24px 70px rgba(0,0,0,.48);
      backdrop-filter: blur(18px);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: .85rem;
    }

    .icon-wrap {
      width: 72px; height: 72px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.9rem;
      margin-bottom: .3rem;
    }
    .loading-icon { background: rgba(163,230,53,.12); color: #a3e635; }
    .success-icon { background: rgba(52,211,153,.14); color: #34d399; }
    .info-icon    { background: rgba(56,189,248,.12); color: #38bdf8; }
    .warn-icon    { background: rgba(245,158,11,.12); color: #f59e0b; }
    .error-icon   { background: rgba(239,68,68,.12); color: #f87171; }

    h2 {
      margin: 0;
      color: #fff;
      font-size: 1.45rem;
      font-weight: 900;
      line-height: 1.2;
    }

    p {
      margin: 0;
      color: rgba(255,255,255,.68);
      line-height: 1.6;
      font-size: .95rem;
    }

    .primary-btn, .secondary-btn {
      margin-top: .4rem;
      width: 100%;
      min-height: 48px;
      padding: .75rem 1.2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .5rem;
      border-radius: 10px;
      border: 0;
      font-family: inherit;
      font-size: .95rem;
      font-weight: 900;
      cursor: pointer;
    }
    .primary-btn { background: #a3e635; color: #07130d; }
    .primary-btn:hover { background: #b4f050; }
    .secondary-btn { background: rgba(255,255,255,.08); color: #fff; border: 1px solid rgba(255,255,255,.14); }
    .secondary-btn:hover { background: rgba(255,255,255,.13); }
  `],
})
export class SelfCheckInComponent implements OnInit {
  state: CheckInState = 'loading';
  sessionId = '';
  errorMsg = '';
  private token = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hp: HostedPlayService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.sessionId = params.get('s') || '';
    this.token = params.get('t') || '';

    if (!this.sessionId || !this.token) {
      this.state = 'invalid_qr';
      this.cdr.detectChanges();
      return;
    }

    this.checkIn();
  }

  checkIn() {
    this.state = 'loading';
    this.cdr.detectChanges();
    this.hp.selfCheckIn(this.sessionId, this.token).subscribe({
      next: () => { this.state = 'success'; this.cdr.detectChanges(); },
      error: (err) => {
        const code = err?.error?.error;
        if (code === 'already_checked_in') this.state = 'already_checked_in';
        else if (code === 'not_a_participant') this.state = 'not_a_participant';
        else if (code === 'invalid_qr') this.state = 'invalid_qr';
        else if (code === 'session_ended') this.state = 'session_ended';
        else { this.state = 'error'; this.errorMsg = err?.error?.error || ''; }
        this.cdr.detectChanges();
      },
    });
  }

  retry() { this.checkIn(); }
  viewBoard() { this.router.navigate(['/player/hosted-play', this.sessionId, 'live']); }
  goHome() { this.router.navigate(['/player/hosted-play']); }
}
