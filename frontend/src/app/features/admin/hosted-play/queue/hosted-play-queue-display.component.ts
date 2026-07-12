import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { HostedPlayService, QueueBoard } from '../../../../core/services/hosted-play.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ClubService, Court } from '../../../../core/services/club.service';

const MAX_VISIBLE_WAITING = 9;

@Component({
  selector: 'app-admin-hosted-play-queue-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tv-shell">
      <header class="tv-topbar">
        <div class="brand">
          <div class="brand-mark">
            @if (venueLogo()) {
              <img [src]="venueLogo()" [alt]="venueLabel()" class="brand-logo" />
            } @else {
              <span class="brand-initials">{{ venueInitials() }}</span>
            }
          </div>
          <div class="brand-copy">
            <span class="brand-kicker">{{ venueLabel() }}</span>
            <h1>{{ board?.session?.title || 'Hosted Play' }}</h1>
          </div>
        </div>
        <div class="tv-status">
          <span class="status-pill" [ngClass]="board?.session?.queueStatus">
            <span class="status-dot"></span>{{ statusLabel() }}
          </span>
          <span class="tv-clock">{{ clock }}</span>
        </div>
      </header>

      @if (loading) {
        <div class="tv-state"><i class="fas fa-circle-notch fa-spin"></i> Loading queue…</div>
      } @else if (!board) {
        <div class="tv-state tv-state-error"><i class="fas fa-triangle-exclamation"></i> {{ error || 'Unable to load the queue.' }}</div>
      } @else if (board.session.queueStatus === 'not_started') {
        <div class="tv-state tv-state-idle">
          <i class="fas fa-clipboard-check"></i>
          <p>Check-in is open. Play will begin shortly.</p>
        </div>
      } @else {
        <main class="tv-main">
          <section class="tv-stats" aria-label="Session summary">
            <div class="stat-tile">
              <span class="stat-value lime">{{ board.counts.playing }}</span>
              <span class="stat-label">Playing</span>
            </div>
            <div class="stat-tile">
              <span class="stat-value teal">{{ board.counts.waiting }}</span>
              <span class="stat-label">Waiting</span>
            </div>
            <div class="stat-tile">
              <span class="stat-value blue">{{ board.counts.activeGames }}</span>
              <span class="stat-label">Active Games</span>
            </div>
            <div class="stat-tile">
              <span class="stat-value amber">{{ board.counts.checkedIn }}</span>
              <span class="stat-label">Checked In</span>
            </div>
          </section>

          <div class="tv-columns">
            <section class="tv-courts">
              <h2 class="tv-section-title"><i class="fas fa-table-tennis-paddle-ball"></i> Now Playing</h2>
              <div class="courts-grid" [class.dense]="board.courts.length > 4">
                @for (c of board.courts; track c.courtNumber) {
                  <article class="court-card" [class.empty]="c.players.length === 0">
                    <div class="court-badge">Court {{ c.courtNumber }}</div>
                    @if (c.players.length === 0) {
                      <div class="court-empty"><i class="fas fa-hourglass-half"></i> Open</div>
                    } @else {
                      <div class="court-players">
                        @for (p of c.players; track p._id) {
                          <div class="player-row">
                            <span class="avatar">{{ initials(p.memberName) }}</span>
                            <span class="pname">{{ p.memberName }}</span>
                            @if (p.isWalkIn) { <span class="walk-tag">Walk-in</span> }
                          </div>
                        }
                      </div>
                    }
                  </article>
                }
              </div>
            </section>

            <section class="tv-queue">
              <h2 class="tv-section-title"><i class="fas fa-list-ol"></i> Up Next</h2>
              @if (board.waiting.length === 0) {
                <div class="queue-empty"><i class="fas fa-mug-hot"></i> No one waiting</div>
              } @else {
                <div class="queue-list">
                  @for (p of visibleWaiting(); track p._id; let i = $index) {
                    <div class="queue-row">
                      <span class="qnum">{{ i + 1 }}</span>
                      <span class="pname">{{ p.memberName }}</span>
                      @if (p.isWalkIn) { <span class="walk-tag">Walk-in</span> }
                    </div>
                  }
                </div>
                @if (board.waiting.length > maxVisible) {
                  <div class="queue-more">+{{ board.waiting.length - maxVisible }} more waiting</div>
                }
              }

              @if (board.paused.length > 0) {
                <div class="paused-note"><i class="fas fa-pause"></i> {{ board.paused.length }} on hold</div>
              }
            </section>
          </div>
        </main>
      }

      <footer class="tv-footer">
        <span><i class="fas fa-rotate"></i> Live — updates automatically</span>
        @if (lastUpdated) { <span class="tv-updated">Last synced {{ lastUpdated }}</span> }
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #05100a;
      --surface: #0f221a;
      --surface-2: #16302475;
      --border: rgba(255,255,255,.08);
      --text: #fff;
      --muted: rgba(255,255,255,.6);
      --accent: #a3e635;
      --teal: #14b8a6;
      --blue: #38bdf8;
      --amber: #f59e0b;
    }

    .tv-shell {
      min-height: 100vh;
      width: 100%;
      display: flex;
      flex-direction: column;
      color: var(--text);
      background:
        radial-gradient(circle at 15% 0%, rgba(163,230,53,.10), transparent 45rem),
        radial-gradient(circle at 100% 100%, rgba(56,189,248,.08), transparent 45rem),
        linear-gradient(180deg, #081b12 0%, var(--bg) 40rem);
      padding: 1.75rem 2.5rem 1rem;
      overflow: hidden;
    }

    .tv-topbar { display: flex; align-items: center; gap: 1.25rem; position: relative; }
    .brand { display: flex; align-items: center; gap: 1rem; min-width: 0; flex: 1; }
    .brand-mark {
      width: 68px; height: 68px; flex: 0 0 68px; border-radius: 16px;
      background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.22);
      color: var(--accent); display: flex; align-items: center; justify-content: center;
      overflow: hidden; box-shadow: 0 14px 30px rgba(0,0,0,.25);
    }
    .brand-logo { width: 100%; height: 100%; object-fit: cover; display: block; }
    .brand-initials { font-size: 1.5rem; font-weight: 950; letter-spacing: .02em; }
    .brand-copy { min-width: 0; }
    .brand-kicker { display: block; color: var(--accent); font-size: .95rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .2rem; }
    .brand-copy h1 { margin: 0; font-size: clamp(1.6rem, 2.6vw, 2.4rem); line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .tv-status { display: flex; align-items: center; gap: 1.25rem; flex-shrink: 0; }
    .status-pill {
      display: inline-flex; align-items: center; gap: .55rem;
      font-size: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: .06em;
      border-radius: 999px; padding: .55rem 1.1rem;
      color: var(--muted); background: rgba(255,255,255,.07); border: 1px solid var(--border);
    }
    .status-dot { width: 10px; height: 10px; border-radius: 999px; background: currentColor; }
    .status-pill.running { color: var(--accent); background: rgba(163,230,53,.14); border-color: rgba(163,230,53,.24); }
    .status-pill.running .status-dot { animation: pulse-dot 1.4s ease-in-out infinite; }
    .status-pill.paused { color: var(--amber); background: rgba(245,158,11,.13); border-color: rgba(245,158,11,.24); }
    .status-pill.ended { color: #fca5a5; background: rgba(239,68,68,.13); border-color: rgba(239,68,68,.24); }
    @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

    .tv-clock { font-size: 1.4rem; font-weight: 900; font-variant-numeric: tabular-nums; color: var(--text); min-width: 5.5ch; text-align: right; }

    .tv-state {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 1rem;
      font-size: 1.6rem; font-weight: 800; color: var(--muted);
    }
    .tv-state i { font-size: 1.8rem; color: var(--accent); }
    .tv-state-error { color: #fca5a5; }
    .tv-state-error i { color: #fca5a5; }
    .tv-state-idle { flex-direction: column; }
    .tv-state-idle i { font-size: 3rem; }

    .tv-main { flex: 1; display: flex; flex-direction: column; gap: 1.5rem; min-height: 0; margin-top: 1.75rem; }

    .tv-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .stat-tile {
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      padding: 1.1rem 1rem; text-align: center; box-shadow: 0 12px 30px rgba(0,0,0,.18);
    }
    .stat-value { display: block; font-size: clamp(2rem, 3.4vw, 3rem); font-weight: 950; line-height: 1; }
    .stat-value.lime { color: var(--accent); }
    .stat-value.teal { color: var(--teal); }
    .stat-value.blue { color: var(--blue); }
    .stat-value.amber { color: var(--amber); }
    .stat-label { display: block; margin-top: .4rem; font-size: 1rem; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }

    .tv-columns { flex: 1; display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(320px, 1fr); gap: 1.25rem; min-height: 0; }
    .tv-courts, .tv-queue {
      background: var(--surface); border: 1px solid var(--border); border-radius: 18px;
      padding: 1.25rem 1.4rem; display: flex; flex-direction: column; min-height: 0;
      box-shadow: 0 16px 40px rgba(0,0,0,.2);
    }
    .tv-section-title { display: flex; align-items: center; gap: .6rem; margin: 0 0 1rem; font-size: 1.15rem; font-weight: 900; }
    .tv-section-title i { color: var(--accent); }

    .courts-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); grid-auto-rows: min-content; gap: .9rem; align-content: start; }
    .courts-grid.dense { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .court-card {
      background: rgba(255,255,255,.045); border: 1px solid var(--border); border-radius: 14px;
      padding: 1rem; min-height: 150px; display: flex; flex-direction: column; gap: .75rem;
    }
    .court-card.empty { border-style: dashed; opacity: .75; }
    .court-badge {
      align-self: flex-start; font-size: .8rem; font-weight: 950; text-transform: uppercase; letter-spacing: .05em;
      color: var(--accent); background: rgba(163,230,53,.14); border: 1px solid rgba(163,230,53,.22);
      border-radius: 999px; padding: .3rem .75rem;
    }
    .court-empty { flex: 1; display: flex; align-items: center; justify-content: center; gap: .5rem; color: var(--muted); font-size: 1rem; font-weight: 700; }
    .court-players { display: flex; flex-direction: column; gap: .55rem; }
    .player-row { display: flex; align-items: center; gap: .65rem; }
    .avatar {
      width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%; background: rgba(163,230,53,.16);
      color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 950; font-size: .9rem;
    }
    .pname { flex: 1; min-width: 0; font-size: 1.05rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .walk-tag {
      flex-shrink: 0; font-size: .68rem; font-weight: 950; text-transform: uppercase;
      color: var(--blue); background: rgba(56,189,248,.14); border: 1px solid rgba(56,189,248,.18);
      border-radius: 999px; padding: .18rem .5rem;
    }

    .queue-empty, .paused-note {
      display: flex; align-items: center; gap: .5rem; color: var(--muted); font-size: 1rem; font-weight: 700;
      padding: .6rem 0;
    }
    .queue-list { display: flex; flex-direction: column; gap: .55rem; overflow: hidden; }
    .queue-row {
      display: flex; align-items: center; gap: .65rem; padding: .65rem .75rem;
      background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 12px;
    }
    .qnum {
      width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; background: rgba(255,255,255,.08);
      color: var(--muted); font-weight: 950; font-size: .9rem; display: flex; align-items: center; justify-content: center;
    }
    .queue-row:first-child .qnum { background: rgba(163,230,53,.2); color: var(--accent); }
    .queue-more { margin-top: .6rem; color: var(--muted); font-size: .9rem; font-weight: 800; text-align: center; }
    .paused-note { margin-top: .75rem; border-top: 1px solid var(--border); }
    .paused-note i { color: var(--amber); }

    .tv-footer {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 1.25rem; padding-top: .85rem; border-top: 1px solid var(--border);
      color: var(--muted); font-size: .85rem; font-weight: 700;
    }
    .tv-footer i { color: var(--accent); margin-right: .4rem; }

    @media (max-width: 1100px) {
      .tv-columns { grid-template-columns: 1fr; }
    }
  `],
})
export class AdminHostedPlayQueueDisplayComponent implements OnInit, OnDestroy {
  id = '';
  board: QueueBoard | null = null;
  loading = true;
  error = '';
  lastUpdated = '';
  clock = '';
  clubCourts: Court[] = [];
  maxVisible = MAX_VISIBLE_WAITING;

  private pollSub?: Subscription;
  private clockTimer?: ReturnType<typeof setInterval>;

  constructor(
    private hp: HostedPlayService,
    private auth: AuthService,
    private clubService: ClubService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';

    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (club) => { this.clubCourts = club.courts ?? []; this.cdr.detectChanges(); },
        error: () => {},
      });
    }

    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);

    const onBoard = (b: QueueBoard) => { this.setBoard(b); this.loading = false; this.cdr.detectChanges(); };
    const onError = (err: any) => { this.loading = false; this.error = err?.error?.error || 'Unable to load the queue.'; this.cdr.detectChanges(); };

    this.hp.getQueue(this.id).subscribe({ next: onBoard, error: onError });
    this.pollSub = this.hp.pollQueue(this.id, 6000).subscribe({ next: onBoard, error: onError });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private setBoard(b: QueueBoard) {
    this.board = b;
    this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private updateClock() {
    this.clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.cdr.detectChanges();
  }

  visibleWaiting() {
    return (this.board?.waiting ?? []).slice(0, this.maxVisible);
  }

  statusLabel(): string {
    const s = this.board?.session?.queueStatus;
    return s === 'running' ? 'Live' : s === 'paused' ? 'Paused' : s === 'ended' ? 'Ended' : 'Not Started';
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  private courtForSession(): Court | undefined {
    const session = this.board?.session;
    const venue = (session?.venue || '').trim().toLowerCase();
    const court = (session?.court || '').trim().toLowerCase();
    return this.clubCourts.find(c => {
      const name = c.name.trim().toLowerCase();
      return name === venue || (!!court && name === court);
    });
  }

  venueLogo(): string {
    return this.courtForSession()?.logo || '';
  }

  venueLabel(): string {
    const session = this.board?.session;
    return this.courtForSession()?.name || session?.court || session?.venue || 'Venue';
  }

  venueInitials(): string {
    const parts = this.venueLabel().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
}
