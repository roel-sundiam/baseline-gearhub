import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { PerGameService, GameJoin } from '../../../core/services/per-game.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService } from '../../../core/services/club.service';

@Component({
  selector: 'app-player-per-game',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  template: `
    <div class="shell">
      <header class="pg-header">
        <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
        <span class="header-title">Play</span>
        <span style="width:38px"></span>
      </header>

      @if (loading) {
        <div class="state-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else {
        <div class="hero">
          <div class="hero-icon" [class.joined]="status === 'joined'" [class.recorded]="status === 'recorded'">
            @if (status === 'none') {
              @if (clubLogo) {
                <img [src]="clubLogo" [alt]="clubName" class="hero-club-logo" />
              } @else {
                <span class="hero-club-initials">{{ clubInitials }}</span>
              }
            } @else {
              <i class="fas"
                [class.fa-circle-check]="status === 'joined'"
                [class.fa-receipt]="status === 'recorded'"></i>
            }
          </div>

          @if (status === 'none') {
            <h2 class="hero-title">Ready to play?</h2>
            <p class="hero-sub">Choose your play date and tap Join. No court reservation needed — just show up and play.</p>
            <div class="date-section">
              <div class="date-tabs">
                <button class="date-tab" [class.active]="!useCalendar" (click)="pickToday()">
                  <i class="fas fa-bolt"></i> Today
                </button>
                <button class="date-tab" [class.active]="useCalendar" (click)="pickCalendar()">
                  <i class="fas fa-calendar"></i> Pick a Date
                </button>
              </div>
              @if (useCalendar) {
                <input class="date-input" type="date" [value]="selectedDate" [min]="todayStr"
                  (change)="onDateChange($any($event.target).value)" />
              } @else {
                <div class="date-chip"><i class="fas fa-calendar-day"></i> {{ (selectedDate + 'T00:00:00Z') | date: 'MMMM d, yyyy' : 'UTC' }}</div>
              }
            </div>
            <div class="guest-section">
              <div class="guest-label"><i class="fas fa-user-friends"></i> Bringing guests?</div>
              <div class="guest-stepper">
                <button class="stepper-btn" [disabled]="guestCount === 0" (click)="decGuest()">
                  <i class="fas fa-minus"></i>
                </button>
                <span class="stepper-val">{{ guestCount }}</span>
                <button class="stepper-btn" (click)="incGuest()">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>
            @if (errorMsg) { <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ errorMsg }}</div> }
            <button class="btn-join" [disabled]="busy" (click)="join()">
              {{ busy ? 'Joining…' : 'Join' }}
            </button>
          } @else if (status === 'joined') {
            <h2 class="hero-title">You're in!</h2>
            <span class="status-pill"><i class="fas fa-circle"></i> Joined</span>
            @if (entry?.playDate) {
              <div class="play-date-chip">
                <i class="fas fa-calendar-day"></i>
                {{ entry!.playDate | date: 'EEEE, MMMM d' : 'UTC' }}
              </div>
            }
            <p class="hero-sub">Enjoy your games. The club admin will record the number of games you played and your charge will appear in Payments.</p>
            <div class="guest-section">
              <div class="guest-label"><i class="fas fa-user-friends"></i> Guests with you</div>
              <div class="guest-stepper">
                <button class="stepper-btn" [disabled]="guestCount === 0 || busy" (click)="decGuest()">
                  <i class="fas fa-minus"></i>
                </button>
                <span class="stepper-val">{{ guestCount }}</span>
                <button class="stepper-btn" [disabled]="busy" (click)="incGuest()">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              @if (guestCount !== (entry?.guestCount ?? 0)) {
                <button class="btn-update-guests" [disabled]="busy" (click)="saveGuests()">
                  {{ busy ? 'Saving…' : 'Update Guests' }}
                </button>
              }
            </div>
            @if (errorMsg) { <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ errorMsg }}</div> }
            <button class="btn-leave" [disabled]="busy" (click)="leave()">
              {{ busy ? 'Leaving…' : 'Leave' }}
            </button>
          } @else {
            <h2 class="hero-title">Games Recorded</h2>
            <span class="status-pill status-pill--done"><i class="fas fa-check"></i> Recorded</span>
            <p class="hero-sub">Your games have been recorded by the club admin. Your charge is now in <strong>Payments</strong>.</p>
            @if (entry?.gamesPlayed) {
              <div class="recorded-summary">
                <div class="rec-row"><span>Games played</span><span>{{ entry!.gamesPlayed }}</span></div>
                @if (entry!.guestCount > 0) {
                  <div class="rec-row"><span>Guests</span><span>{{ entry!.guestCount }}</span></div>
                }
              </div>
            }
            <button class="btn-payments" (click)="router.navigate(['/player/payments'])">
              <i class="fas fa-receipt"></i> View in Payments
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #0c1a11;
      --surface: #1b3028;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.55);
      --accent: #a3e635;
    }
    .shell { min-height: 100vh; background: var(--bg); }
    .pg-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; }
    .back-btn { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,.08); border: none; color: var(--text); cursor: pointer; font-size: 1rem; }
    .header-title { font-weight: 700; color: var(--text); font-size: 1rem; }
    .state-loading { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 4rem 0; color: var(--muted); }
    .hero { max-width: 420px; margin: 2rem auto; padding: 2rem 1.5rem; text-align: center; }
    .hero-icon { width: 96px; height: 96px; margin: 0 auto 1.5rem; border-radius: 50%; background: rgba(163,230,53,.1); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: var(--accent); overflow: hidden; }
    .hero-icon.joined { background: rgba(163,230,53,.18); }
    .hero-icon.recorded { background: rgba(99,179,237,.12); color: #63b3ed; }
    .hero-club-logo { width: 100%; height: 100%; object-fit: cover; }
    .hero-club-initials { font-size: 1.35rem; font-weight: 900; letter-spacing: 0; }
    .hero-title { font-size: 1.6rem; font-weight: 800; color: var(--text); margin: 0 0 .5rem; }
    .hero-sub { font-size: .92rem; color: var(--muted); line-height: 1.5; margin: 0 0 1.5rem; }
    .hero-sub strong { color: var(--text); }
    .status-pill { display: inline-flex; align-items: center; gap: .4rem; padding: .35rem .9rem; border-radius: 999px; background: rgba(163,230,53,.14); color: var(--accent); font-weight: 700; font-size: .8rem; margin-bottom: 1rem; }
    .status-pill--done { background: rgba(99,179,237,.12); color: #63b3ed; }
    .status-pill i { font-size: .75rem; }
    .alert { padding: .7rem 1rem; border-radius: 9px; font-size: .85rem; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25); color: #fca5a5; display: flex; align-items: center; gap: .45rem; margin-bottom: 1rem; text-align: left; }
    .recorded-summary { background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 10px; padding: .7rem .9rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: .35rem; }
    .rec-row { display: flex; justify-content: space-between; font-size: .88rem; color: var(--muted); }
    .rec-row span:last-child { color: var(--text); font-weight: 600; }
    .date-section { margin-bottom: 1.25rem; }
    .date-tabs { display: inline-flex; background: rgba(255,255,255,.06); border: 1px solid var(--border); border-radius: 10px; padding: .2rem; gap: .2rem; margin-bottom: .65rem; }
    .date-tab { padding: .35rem .85rem; border: none; border-radius: 7px; font-size: .8rem; font-weight: 700; cursor: pointer; background: none; color: var(--muted); font-family: inherit; transition: background .15s, color .15s; display: flex; align-items: center; gap: .35rem; }
    .date-tab.active { background: rgba(163,230,53,.18); color: var(--accent); }
    .date-tab i { font-size: .75rem; }
    .date-input { display: block; width: 100%; padding: .5rem .75rem; background: rgba(255,255,255,.06); border: 1px solid rgba(163,230,53,.25); border-radius: 9px; color: var(--accent); font-size: .88rem; font-weight: 600; font-family: inherit; outline: none; box-sizing: border-box; }
    .date-input::-webkit-calendar-picker-indicator { filter: invert(1) sepia(1) saturate(5) hue-rotate(50deg); cursor: pointer; }
    .date-chip { display: inline-flex; align-items: center; gap: .4rem; font-size: .85rem; font-weight: 700; color: var(--accent); background: rgba(163,230,53,.1); border-radius: 99px; padding: .35rem .9rem; }
    .play-date-chip { display: inline-flex; align-items: center; gap: .4rem; font-size: .82rem; font-weight: 700; color: var(--accent); background: rgba(163,230,53,.1); border-radius: 99px; padding: .3rem .85rem; margin-bottom: .85rem; }
    .guest-section { margin-bottom: 1.25rem; }
    .guest-label { font-size: .82rem; font-weight: 600; color: var(--muted); margin-bottom: .6rem; display: flex; align-items: center; justify-content: center; gap: .35rem; }
    .guest-label i { color: var(--accent); }
    .guest-stepper { display: inline-flex; align-items: center; gap: 0; background: rgba(255,255,255,.06); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .stepper-btn { width: 44px; height: 44px; border: none; background: none; color: var(--text); font-size: .85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .stepper-btn:hover:not(:disabled) { background: rgba(255,255,255,.08); }
    .stepper-btn:disabled { color: rgba(255,255,255,.2); cursor: not-allowed; }
    .stepper-val { min-width: 44px; text-align: center; font-size: 1.2rem; font-weight: 800; color: var(--text); }
    .btn-update-guests { margin-top: .6rem; padding: .45rem 1rem; border: 1px solid rgba(163,230,53,.35); background: rgba(163,230,53,.08); color: var(--accent); border-radius: 10px; font-size: .82rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s; }
    .btn-update-guests:hover:not(:disabled) { background: rgba(163,230,53,.15); }
    .btn-update-guests:disabled { opacity: .5; cursor: not-allowed; }
    .btn-join, .btn-leave, .btn-payments { width: 100%; padding: .9rem; border: none; border-radius: 12px; font-weight: 800; font-size: 1rem; font-family: inherit; cursor: pointer; transition: opacity .15s; }
    .btn-join { background: var(--accent); color: #0c1a11; }
    .btn-leave { background: rgba(255,255,255,.08); color: var(--text); border: 1px solid var(--border); }
    .btn-payments { background: rgba(99,179,237,.15); color: #63b3ed; border: 1px solid rgba(99,179,237,.25); display: flex; align-items: center; justify-content: center; gap: .5rem; }
    .btn-join:hover:not(:disabled), .btn-leave:hover:not(:disabled), .btn-payments:hover { opacity: .85; }
    .btn-join:disabled, .btn-leave:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class PlayerPerGameComponent implements OnInit {
  loading = true;
  busy = false;
  entry: GameJoin | null = null;
  errorMsg = '';
  guestCount = 0;
  clubLogo = '';
  clubName = 'Club';
  todayStr = new Date().toISOString().slice(0, 10);
  selectedDate = this.todayStr;
  useCalendar = false;

  get status(): 'none' | 'joined' | 'recorded' {
    if (!this.entry) return 'none';
    return this.entry.status === 'recorded' ? 'recorded' : 'joined';
  }

  get clubInitials(): string {
    return this.clubName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  constructor(
    private perGame: PerGameService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private auth: AuthService,
    private clubService: ClubService,
  ) {}

  ngOnInit() {
    this.loadClubIdentity();
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    if (dateParam) {
      this.selectedDate = dateParam;
      this.useCalendar = dateParam !== this.todayStr;
    }
    this.refresh();
  }

  loadClubIdentity() {
    const clubId = this.auth.user()?.clubId || this.clubService.getSelectedClubId();
    if (!clubId) return;

    this.clubService.getClub(clubId).subscribe({
      next: (club) => {
        this.clubName = club.name || 'Club';
        this.clubLogo = club.logo ?? '';
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  refresh() {
    this.loading = true;
    this.perGame.myStatus(this.selectedDate).subscribe({
      next: (e: GameJoin | null) => {
        this.entry = e;
        this.guestCount = e?.guestCount ?? 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  pickToday() { this.useCalendar = false; this.selectedDate = this.todayStr; this.refresh(); }
  pickCalendar() { this.useCalendar = true; this.cdr.detectChanges(); }
  onDateChange(val: string) { if (val) { this.selectedDate = val; this.refresh(); } }

  incGuest() { this.guestCount++; this.cdr.detectChanges(); }
  decGuest() { if (this.guestCount > 0) { this.guestCount--; this.cdr.detectChanges(); } }

  join() {
    this.busy = true;
    this.errorMsg = '';
    this.perGame.join(this.guestCount, this.selectedDate).subscribe({
      next: (e) => { this.entry = e; this.guestCount = e.guestCount ?? 0; this.busy = false; this.cdr.detectChanges(); },
      error: (err) => { this.busy = false; this.errorMsg = err?.error?.error || 'Failed to join.'; this.cdr.detectChanges(); },
    });
  }

  saveGuests() {
    if (!this.entry) return;
    this.busy = true;
    this.errorMsg = '';
    this.perGame.updateGuests(this.entry._id, this.guestCount).subscribe({
      next: (e) => { this.entry = e; this.guestCount = e.guestCount ?? 0; this.busy = false; this.cdr.detectChanges(); },
      error: (err) => { this.busy = false; this.errorMsg = err?.error?.error || 'Failed to update.'; this.cdr.detectChanges(); },
    });
  }

  leave() {
    this.busy = true;
    this.errorMsg = '';
    this.perGame.cancelJoin().subscribe({
      next: () => { this.entry = null; this.guestCount = 0; this.busy = false; this.cdr.detectChanges(); },
      error: (err) => { this.busy = false; this.errorMsg = err?.error?.error || 'Failed to leave.'; this.cdr.detectChanges(); },
    });
  }

  goBack() { this.router.navigate(['/player/dashboard']); }
}
