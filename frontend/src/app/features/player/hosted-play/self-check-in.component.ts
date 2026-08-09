import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HostedPlayService } from '../../../core/services/hosted-play.service';
import { AuthService } from '../../../core/services/auth.service';

type CheckInState = 'loading' | 'success' | 'already_checked_in' | 'not_a_participant' | 'invalid_qr' | 'session_ended' | 'error' | 'find_name';

@Component({
  selector: 'app-player-self-check-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <p>You haven't joined this session under your account. If you registered through Reclub, look yourself up by name instead.</p>
          <button class="primary-btn" (click)="showFindName()">
            <i class="fas fa-magnifying-glass"></i> Find My Name
          </button>
          <button class="secondary-btn" (click)="goHome()">
            <i class="fas fa-arrow-left"></i> Back to Hosted Play
          </button>
        } @else if (state === 'find_name') {
          <div class="icon-wrap info-icon"><i class="fas fa-magnifying-glass"></i></div>
          <h2>Find your name</h2>
          <p>No account needed — just search for the name you registered under.</p>
          <input
            class="name-search"
            type="text"
            placeholder="Type your name…"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange($event)"
            autocomplete="off"
          />
          @if (searching) {
            <p class="search-hint"><i class="fas fa-circle-notch fa-spin"></i> Searching…</p>
          } @else if (searchQuery.trim().length >= 2 && searchResults.length === 0) {
            <p class="search-hint">No matches. Check the spelling or ask the organizer.</p>
          } @else if (searchResults.length) {
            <div class="name-results">
              @for (r of searchResults; track r._id) {
                <button
                  type="button"
                  class="name-result"
                  [disabled]="r.checkedIn || checkingInId === r._id"
                  (click)="checkInAs(r._id)"
                >
                  <span>{{ r.memberName }}</span>
                  @if (r.checkedIn) {
                    <span class="already-tag">Already in</span>
                  } @else if (checkingInId === r._id) {
                    <i class="fas fa-circle-notch fa-spin"></i>
                  } @else {
                    <i class="fas fa-chevron-right"></i>
                  }
                </button>
              }
            </div>
          }
          @if (errorMsg) { <p class="search-hint search-error">{{ errorMsg }}</p> }
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

    .name-search {
      width: 100%;
      min-height: 48px;
      padding: .7rem .9rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.06);
      color: #fff;
      font-family: inherit;
      font-size: .95rem;
    }
    .name-search:focus { outline: none; border-color: rgba(163,230,53,.5); }
    .search-hint { font-size: .85rem; color: rgba(255,255,255,.55); }
    .search-error { color: #f87171; }
    .name-results {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: .4rem;
      max-height: 240px;
      overflow-y: auto;
    }
    .name-result {
      width: 100%;
      min-height: 46px;
      padding: .6rem .9rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.05);
      color: #fff;
      font-family: inherit;
      font-weight: 700;
      cursor: pointer;
      text-align: left;
    }
    .name-result:hover:not(:disabled) { border-color: rgba(163,230,53,.4); }
    .name-result:disabled { opacity: .55; cursor: not-allowed; }
    .already-tag { font-size: .75rem; font-weight: 800; color: rgba(255,255,255,.5); }
  `],
})
export class SelfCheckInComponent implements OnInit {
  state: CheckInState = 'loading';
  sessionId = '';
  errorMsg = '';
  private token = '';

  // ── "Find your name" (no account / not logged in) ──
  searchQuery = '';
  searchResults: { _id: string; memberName: string; checkedIn: boolean }[] = [];
  searching = false;
  checkingInId: string | null = null;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hp: HostedPlayService,
    private auth: AuthService,
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

    // No account (e.g. a Reclub-imported guest never asked to sign up) — go
    // straight to name search instead of attempting the member-only check-in.
    if (!this.auth.isLoggedIn()) {
      this.state = 'find_name';
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

  showFindName() {
    this.state = 'find_name';
    this.errorMsg = '';
    this.cdr.detectChanges();
  }

  onSearchChange(q: string) {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    const query = q.trim();
    if (query.length < 2) {
      this.searchResults = [];
      this.searching = false;
      this.cdr.detectChanges();
      return;
    }
    this.searching = true;
    this.cdr.detectChanges();
    this.searchDebounce = setTimeout(() => {
      this.hp.searchParticipants(this.sessionId, query, this.token).subscribe({
        next: (res) => { this.searchResults = res.results; this.searching = false; this.cdr.detectChanges(); },
        error: () => { this.searchResults = []; this.searching = false; this.cdr.detectChanges(); },
      });
    }, 300);
  }

  checkInAs(participantId: string) {
    this.checkingInId = participantId;
    this.errorMsg = '';
    this.cdr.detectChanges();
    this.hp.anonymousCheckIn(this.sessionId, participantId, this.token).subscribe({
      next: () => { this.checkingInId = null; this.state = 'success'; this.cdr.detectChanges(); },
      error: (err) => {
        this.checkingInId = null;
        const code = err?.error?.error;
        if (code === 'already_checked_in') this.state = 'already_checked_in';
        else if (code === 'invalid_qr') this.state = 'invalid_qr';
        else if (code === 'session_ended') this.state = 'session_ended';
        else this.errorMsg = 'Could not check you in. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  retry() { this.checkIn(); }
  viewBoard() { this.router.navigate(['/player/hosted-play', this.sessionId, 'live']); }
  goHome() { this.router.navigate(['/player/hosted-play']); }
}
