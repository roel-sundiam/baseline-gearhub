import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HostedPlayService, HostedPlaySession, QueueBoard, QueuePlayer } from '../../../core/services/hosted-play.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Court } from '../../../core/services/club.service';

@Component({
  selector: 'app-player-hosted-play-live',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="live-shell">
      <header class="topbar">
        <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
        <div class="topbar-copy">
          <span class="topbar-kicker">Live Board</span>
          <h1>{{ board?.session?.title || sessionDetail?.title || 'Queue' }}</h1>
        </div>
        <button class="refresh-btn" [disabled]="refreshing" (click)="refresh()" [title]="lastUpdated ? 'Updated ' + lastUpdated : 'Refresh'">
          <i class="fas fa-rotate-right" [class.fa-spin]="refreshing"></i>
        </button>
      </header>

      @if (lastUpdated) {
        <div class="updated-bar">
          <i class="fas fa-clock"></i> Updated {{ lastUpdated }}
          @if (refreshing) { <span>— refreshing…</span> }
        </div>
      }

      @if (loading) {
        <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else if (!board) {
        <div class="state-msg state-err"><i class="fas fa-triangle-exclamation"></i> {{ error }}</div>
      } @else {
        <main class="live-page">

          <!-- My status card -->
          @if (me) {
            <section class="my-card" [ngClass]="me.queueStatus">
              <div class="my-icon">
                @if (venueLogo()) {
                  <img [src]="venueLogo()" [alt]="venueLabel()" class="venue-logo-img" />
                } @else {
                  <span class="venue-initials">{{ venueInitials() }}</span>
                }
              </div>
              <div class="my-body">
                <span class="my-label">Your status</span>
                <span class="my-status">{{ myStatusText() }}</span>
              </div>
              <span class="my-games"><i class="fas fa-table-tennis-paddle-ball"></i> {{ me.gamesPlayed }} played</span>
            </section>
          }

          <!-- Stats strip -->
          <div class="stats-row">
            <div class="stat-chip"><span class="sv">{{ board.counts.playing }}</span><span class="sl">Playing</span></div>
            <div class="stat-chip"><span class="sv">{{ board.counts.waiting }}</span><span class="sl">Waiting</span></div>
            <div class="stat-chip"><span class="sv">{{ board.counts.activeGames }}</span><span class="sl">Games</span></div>
          </div>

          <!-- Courts -->
          @if (board.session.queueStatus !== 'not_started') {
            <section class="block">
              <h2 class="block-title"><i class="fas fa-table-tennis-paddle-ball"></i> Courts</h2>
              <div class="courts-grid">
                @for (c of board.courts; track c.courtNumber) {
                  <div class="court-card" [class.empty]="c.players.length === 0">
                    <div class="court-label">Court {{ c.courtNumber }}</div>
                    @if (c.players.length === 0) {
                      <div class="court-empty"><i class="fas fa-hourglass-half"></i> Waiting for players</div>
                    } @else {
                      <div class="court-players">
                        @for (p of c.players; track p._id) {
                          <div class="player-row" [class.is-me]="isMe(p)">
                            <div class="avatar" [class.avatar-me]="isMe(p)">{{ initials(p.memberName) }}</div>
                            <span class="pname">{{ p.memberName }}@if (isMe(p)) { <span class="you-tag">You</span> }</span>
                            <span class="pgames">{{ p.gamesPlayed }}×</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </section>

            <!-- Waiting queue -->
            @if (board.waiting.length > 0) {
              <section class="block">
                <h2 class="block-title"><i class="fas fa-list-ol"></i> Waiting Queue</h2>
                <div class="queue-list">
                  @for (p of board.waiting; track p._id; let i = $index) {
                    <div class="queue-row" [class.is-me]="isMe(p)">
                      <span class="qnum" [class.qnum-me]="isMe(p)">{{ i + 1 }}</span>
                      <span class="pname">{{ p.memberName }}@if (isMe(p)) { <span class="you-tag">You</span> }</span>
                      <span class="pgames">{{ p.gamesPlayed }} games</span>
                    </div>
                  }
                </div>
              </section>
            }

            <!-- Paused -->
            @if (board.paused.length > 0) {
              <section class="block">
                <h2 class="block-title"><i class="fas fa-pause-circle"></i> On Hold</h2>
                <div class="queue-list">
                  @for (p of board.paused; track p._id) {
                    <div class="queue-row" [class.is-me]="isMe(p)">
                      <span class="qnum pause-num"><i class="fas fa-pause"></i></span>
                      <span class="pname">{{ p.memberName }}@if (isMe(p)) { <span class="you-tag">You</span> }</span>
                      <span class="pgames">{{ p.gamesPlayed }} games</span>
                    </div>
                  }
                </div>
              </section>
            }

            <!-- Refresh prompt -->
            <button class="refresh-full-btn" [disabled]="refreshing" (click)="refresh()">
              <i class="fas fa-rotate-right" [class.fa-spin]="refreshing"></i>
              {{ refreshing ? 'Refreshing…' : 'Refresh Board' }}
            </button>

          } @else {
            <div class="not-started">
              <i class="fas fa-clipboard-check"></i>
              <p>The queue hasn't started yet. Tap refresh to check again.</p>
              <button class="refresh-full-btn" [disabled]="refreshing" (click)="refresh()">
                <i class="fas fa-rotate-right" [class.fa-spin]="refreshing"></i>
                {{ refreshing ? 'Refreshing…' : 'Refresh' }}
              </button>
            </div>
          }

        </main>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #07130d;
      --surface: #12251d;
      --border: rgba(255,255,255,.1);
      --text: #fff;
      --muted: rgba(255,255,255,.62);
      --accent: #a3e635;
      --blue: #38bdf8;
      --amber: #f59e0b;
    }

    .live-shell { min-height: 100vh; background: linear-gradient(180deg, #0b1b12 0%, var(--bg) 36rem); padding: 0 1rem 3rem; }

    .topbar { max-width: 640px; margin: 0 auto; display: grid; grid-template-columns: 44px minmax(0,1fr) auto; align-items: center; gap: .75rem; padding: .9rem 0; position: sticky; top: 0; background: rgba(7,19,13,.95); backdrop-filter: blur(10px); z-index: 10; }
    .back-btn { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,.08); border: 1px solid var(--border); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .topbar-copy { min-width: 0; }
    .topbar-kicker { display: block; color: var(--accent); font-size: .68rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .venue-logo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .venue-initials { font-size: .78rem; font-weight: 950; letter-spacing: .02em; text-transform: uppercase; }
    .topbar h1 { margin: 0; font-size: 1rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .refresh-btn { width: 44px; height: 44px; border-radius: 12px; background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.25); color: var(--accent); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: .95rem; transition: background .15s, transform .15s; }
    .refresh-btn:hover:not(:disabled) { background: rgba(163,230,53,.22); }
    .refresh-btn:active:not(:disabled) { transform: scale(.93); }
    .refresh-btn:disabled { opacity: .5; cursor: not-allowed; }

    .updated-bar { max-width: 640px; margin: 0 auto .6rem; font-size: .74rem; color: var(--muted); display: flex; align-items: center; gap: .35rem; }
    .updated-bar i { color: var(--accent); font-size: .68rem; }

    .state-msg { display: flex; align-items: center; justify-content: center; gap: .6rem; min-height: 50vh; color: var(--muted); font-weight: 700; }
    .state-err { color: #fca5a5; }

    .live-page { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.1rem; }

    .my-card { display: flex; align-items: center; gap: .85rem; padding: 1rem 1.1rem; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); }
    .my-card.playing { border-color: rgba(56,189,248,.3); background: rgba(56,189,248,.07); }
    .my-card.waiting { border-color: rgba(163,230,53,.3); background: rgba(163,230,53,.07); }
    .my-card.paused  { border-color: rgba(245,158,11,.3); background: rgba(245,158,11,.07); }
    .my-card.done    { border-color: rgba(255,255,255,.12); }
    .my-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.2); color: var(--accent); overflow: hidden; }
    .my-body { flex: 1; min-width: 0; }
    .my-label { display: block; color: var(--muted); font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; margin-bottom: .2rem; }
    .my-status { display: block; color: var(--text); font-size: 1rem; font-weight: 900; }
    .my-games { color: var(--muted); font-size: .78rem; font-weight: 700; white-space: nowrap; display: flex; align-items: center; gap: .3rem; }

    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; }
    .stat-chip { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: .7rem; text-align: center; }
    .sv { display: block; font-size: 1.4rem; font-weight: 900; color: var(--accent); }
    .sl { font-size: .72rem; color: var(--muted); font-weight: 700; }

    .block { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1rem; }
    .block-title { display: flex; align-items: center; gap: .5rem; font-size: .88rem; font-weight: 900; color: var(--text); margin: 0 0 .8rem; }
    .block-title i { color: var(--accent); }

    .courts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .7rem; }
    .court-card { background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 10px; padding: .8rem; }
    .court-card.empty { border-style: dashed; opacity: .8; }
    .court-label { font-size: .85rem; font-weight: 900; color: var(--text); margin-bottom: .55rem; }
    .court-empty { color: var(--muted); font-size: .82rem; display: flex; align-items: center; gap: .45rem; padding: .3rem 0; }
    .court-players { display: flex; flex-direction: column; gap: .4rem; }

    .player-row, .queue-row { display: flex; align-items: center; gap: .55rem; padding: .4rem .5rem; border-radius: 8px; }
    .player-row.is-me, .queue-row.is-me { background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.25); }
    .queue-row { padding: .5rem .6rem; background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 8px; }
    .queue-list { display: flex; flex-direction: column; gap: .4rem; }

    .avatar { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; background: rgba(163,230,53,.14); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: .7rem; font-weight: 900; }
    .avatar-me { background: var(--accent); color: #07130d; }
    .qnum { width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: rgba(255,255,255,.08); color: var(--muted); font-size: .72rem; font-weight: 900; display: flex; align-items: center; justify-content: center; }
    .qnum-me { background: rgba(163,230,53,.2); color: var(--accent); }
    .pause-num { color: var(--amber); background: rgba(245,158,11,.14); }

    .pname { flex: 1; color: var(--text); font-size: .88rem; font-weight: 700; display: flex; align-items: center; gap: .35rem; overflow-wrap: anywhere; }
    .pgames { color: var(--muted); font-size: .72rem; white-space: nowrap; }
    .you-tag { font-size: .62rem; font-weight: 900; color: #07130d; background: var(--accent); border-radius: 99px; padding: .08rem .35rem; }

    .refresh-full-btn { width: 100%; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border-radius: 12px; background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.22); color: var(--accent); font-size: .9rem; font-weight: 900; font-family: inherit; cursor: pointer; transition: background .15s, transform .15s; }
    .refresh-full-btn:hover:not(:disabled) { background: rgba(163,230,53,.18); }
    .refresh-full-btn:active:not(:disabled) { transform: scale(.98); }
    .refresh-full-btn:disabled { opacity: .5; cursor: not-allowed; }

    .not-started { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .75rem; min-height: 220px; border: 1px dashed var(--border); border-radius: 14px; text-align: center; color: var(--muted); padding: 1.5rem; }
    .not-started i { font-size: 1.8rem; color: var(--accent); }
    .not-started p { margin: 0; font-size: .9rem; line-height: 1.5; }
  `],
})
export class PlayerHostedPlayLiveBoardComponent implements OnInit {
  id = '';
  board: QueueBoard | null = null;
  loading = true;
  refreshing = false;
  error = '';
  me: QueuePlayer | null = null;
  lastUpdated = '';
  clubCourts: Court[] = [];
  sessionDetail: HostedPlaySession | null = null;

  private myMemberId = '';

  constructor(
    private hp: HostedPlayService,
    private auth: AuthService,
    private clubService: ClubService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.myMemberId = this.auth.user()?.id || '';
    this.loadClubCourts();
    this.loadSessionDetail();
    this.hp.getPlayerQueue(this.id).subscribe({
      next: (b) => { this.setBoard(b); this.loading = false; this.cdr.detectChanges(); },
      error: (err) => { this.loading = false; this.error = err?.error?.error || 'Unable to load live board.'; this.cdr.detectChanges(); },
    });
  }

  private loadClubCourts() {
    const clubId = this.auth.user()?.clubId || this.clubService.getSelectedClubId();
    if (!clubId) return;
    this.clubService.getClub(clubId).subscribe({
      next: (club) => { this.clubCourts = club.courts ?? []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  private loadSessionDetail() {
    if (!this.id) return;
    this.hp.getSession(this.id).subscribe({
      next: (session) => { this.sessionDetail = session; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.cdr.detectChanges();
    this.hp.getPlayerQueue(this.id).subscribe({
      next: (b) => { this.setBoard(b); this.refreshing = false; this.cdr.detectChanges(); },
      error: () => { this.refreshing = false; this.cdr.detectChanges(); },
    });
  }

  private setBoard(b: QueueBoard) {
    this.board = b;
    this.me = b.roster.find((p) => p.memberId === this.myMemberId) ?? null;
    const now = new Date();
    this.lastUpdated = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  isMe(p: QueuePlayer): boolean {
    return !!this.myMemberId && p.memberId === this.myMemberId;
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  courtForSession(): Court | undefined {
    const venue = (this.board?.session?.venue || this.sessionDetail?.venue || '').trim().toLowerCase();
    const court = (this.board?.session?.court || this.sessionDetail?.court || '').trim().toLowerCase();
    return this.clubCourts.find(c => {
      const name = c.name.trim().toLowerCase();
      return name === venue || (!!court && name === court);
    });
  }

  venueLogo(): string {
    return this.courtForSession()?.logo || '';
  }

  venueLabel(): string {
    return this.courtForSession()?.name
      || this.board?.session?.court
      || this.sessionDetail?.court
      || this.board?.session?.venue
      || this.sessionDetail?.venue
      || this.board?.session?.title
      || this.sessionDetail?.title
      || 'Venue';
  }

  venueInitials(): string {
    const parts = this.venueLabel().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  myIcon(): string {
    switch (this.me?.queueStatus) {
      case 'playing': return 'fas fa-table-tennis-paddle-ball';
      case 'waiting': return 'fas fa-list-ol';
      case 'paused':  return 'fas fa-pause';
      case 'done':    return 'fas fa-circle-check';
      default: return 'fas fa-user-clock';
    }
  }

  myStatusText(): string {
    if (!this.me) return 'Not in queue';
    switch (this.me.queueStatus) {
      case 'playing': return `Playing on Court ${this.me.courtNumber}`;
      case 'waiting': {
        const pos = (this.board?.waiting ?? []).findIndex(p => p._id === this.me!._id) + 1;
        return `Waiting — position ${pos}`;
      }
      case 'paused':  return 'On hold — waiting for admin to resume';
      case 'done':    return 'Done for today — great game!';
      default: return 'Checked in — queue not started yet';
    }
  }

  goBack() { this.router.navigate(['/player/hosted-play']); }
}
