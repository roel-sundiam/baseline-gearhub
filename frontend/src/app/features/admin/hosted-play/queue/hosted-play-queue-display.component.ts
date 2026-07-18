import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { HostedPlayService, QueueBoard, QueueCourt, QueuePlayer, splitCourtTeams } from '../../../../core/services/hosted-play.service';
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
            <h1>Open Play <em>Queue</em></h1>
            <p>{{ board?.session?.title || 'Hosted Play' }} <span>•</span> Live court rotation</p>
          </div>
        </div>
        <div class="tv-status">
          <span class="status-pill" [ngClass]="board?.session?.queueStatus">
            <span class="status-dot"></span>{{ statusLabel() }}
          </span>
          <div class="time-block"><span class="tv-clock">{{ clock }}</span><span class="date-label">{{ today }}</span></div>
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
      } @else if (board.session.queueStatus === 'ended') {
        <main class="tv-main">
          @if (board.leaderboard && board.leaderboard.length > 0) {
            <div class="tv-standings">
              <div class="lb-toolbar">
                <span class="lb-toolbar-title"><i class="fas fa-trophy"></i> Final Standings</span>
                <span class="lb-count">{{ board.leaderboard.length }} Ranked</span>
              </div>
              <div class="lb-header">
                <span class="lb-header-spacer"></span>
                <span class="lb-col-label">W</span>
                <span class="lb-col-label">L</span>
              </div>
              <div class="lb-list">
                @for (p of board.leaderboard; track p._id; let i = $index) {
                  <div class="lb-card" [class.rank-1]="i === 0" [class.rank-2]="i === 1" [class.rank-3]="i === 2">
                    @if (i === 0) { <span class="lb-trophy"><i class="fas fa-trophy"></i></span> }
                    <span class="lb-rank">{{ i + 1 }}</span>
                    <span class="lb-name">
                      @if (p.profileImage) { <img class="lb-avatar" [src]="p.profileImage" [alt]="p.memberName" /> }
                      {{ p.memberName }}
                    </span>
                    <span class="lb-w">{{ p.wins || 0 }}</span>
                    <span class="lb-l">{{ p.losses || 0 }}</span>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="tv-state"><i class="fas fa-flag-checkered"></i> Session complete — thanks for playing!</div>
          }
        </main>
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
              <div class="section-heading"><h2 class="tv-section-title"><i class="fas fa-table-tennis-paddle-ball"></i> Courts</h2><span>{{ board.counts.activeGames }} active</span></div>
              <div class="courts-grid" [class.dense]="board.courts.length > 4">
                @for (c of board.courts; track c.courtNumber) {
                  <article class="court-card" [class.empty]="c.players.length === 0">
                    <div class="court-head"><span>Court {{ c.courtNumber }}</span><strong [class.available]="c.players.length === 0">{{ c.players.length === 0 ? 'Available' : 'In play' }}</strong></div>
                    @if (c.players.length === 0) {
                      <div class="court-empty"><i class="fas fa-table-tennis-paddle-ball"></i><strong>Court ready</strong><span>Players will be assigned automatically</span></div>
                    } @else {
                      @let teams = teamsFor(c);
                      <div class="court-teams">
                        <div class="team-block team-a">
                          <span class="team-label">Team A</span>
                          @for (p of teams.teamA; track p._id) {
                            <div class="player-row">
                              <span class="pavatar">
                                @if (p.profileImage) { <img [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }
                              </span>
                              <span class="pname">{{ p.memberName }}</span>
                              @if (p.isWalkIn) { <span class="walk-tag">Walk-in</span> }
                            </div>
                          }
                        </div>
                        <span class="vs-divider">VS</span>
                        <div class="team-block team-b">
                          <span class="team-label">Team B</span>
                          @for (p of teams.teamB; track p._id) {
                            <div class="player-row">
                              <span class="pavatar">
                                @if (p.profileImage) { <img [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }
                              </span>
                              <span class="pname">{{ p.memberName }}</span>
                              @if (p.isWalkIn) { <span class="walk-tag">Walk-in</span> }
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </article>
                }
              </div>
            </section>

            <section class="tv-queue">
              <div class="section-heading"><h2 class="tv-section-title"><i class="fas fa-list-ol"></i> Up Next</h2><span>{{ board.counts.waiting }} waiting</span></div>
              @if (board.waiting.length === 0) {
                <div class="queue-empty"><i class="fas fa-mug-hot"></i> No one waiting</div>
              } @else {
                <div class="queue-list">
                  @for (p of visibleWaiting(); track p._id; let i = $index) {
                    <div class="queue-row">
                      <span class="qnum">{{ i + 1 }}</span>
                      <span class="avatar">
                        @if (p.profileImage) { <img [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }
                      </span>
                      <span class="pname">{{ p.memberName }}<small>{{ i === 0 ? 'Next available court' : 'In queue' }}</small></span>
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

              @if (hasStandings()) {
                <div class="section-heading standings-heading"><h2 class="tv-section-title"><i class="fas fa-trophy"></i> Standings</h2><span>{{ standingsCount() }} ranked</span></div>
                <div class="lb-mini">
                  <div class="lb-header">
                    <span class="lb-header-spacer"></span>
                    <span class="lb-col-label">W</span>
                    <span class="lb-col-label">L</span>
                  </div>
                  <div class="lb-list">
                    @for (p of visibleStandings(); track p._id; let i = $index) {
                      <div class="lb-card" [class.rank-1]="i === 0" [class.rank-2]="i === 1" [class.rank-3]="i === 2">
                        @if (i === 0) { <span class="lb-trophy"><i class="fas fa-trophy"></i></span> }
                        <span class="lb-rank">{{ i + 1 }}</span>
                        <span class="lb-name">
                      @if (p.profileImage) { <img class="lb-avatar" [src]="p.profileImage" [alt]="p.memberName" /> }
                      {{ p.memberName }}
                    </span>
                        <span class="lb-w">{{ p.wins || 0 }}</span>
                        <span class="lb-l">{{ p.losses || 0 }}</span>
                      </div>
                    }
                  </div>
                </div>
                @if (standingsCount() > maxVisible) {
                  <div class="queue-more">+{{ standingsCount() - maxVisible }} more ranked</div>
                }
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
    .tv-standings { max-width: 1100px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
    .lb-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.1rem; }
    .lb-toolbar-title { display: flex; align-items: center; gap: .6rem; font-size: 1.7rem; font-weight: 950; letter-spacing: -.01em; text-transform: uppercase; }
    .lb-toolbar-title i { color: #f5df18; }
    .lb-count { font-size: .82rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }

    /* Shared leaderboard-card system (reused by the mini panel via .lb-mini overrides below) */
    .lb-header { display: grid; grid-template-columns: 3.2rem 1fr 3.5rem 3.5rem; gap: 1rem; padding: 0 1.1rem; margin-bottom: 1rem; }
    .lb-header-spacer { grid-column: span 2; }
    .lb-col-label { text-align: center; font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); opacity: .7; }
    .lb-list { display: flex; flex-direction: column; gap: .6rem; }
    .lb-card {
      position: relative; display: grid; grid-template-columns: 3.2rem 1fr 3.5rem 3.5rem; align-items: center; gap: 1rem;
      padding: .85rem 1.1rem; border-radius: 16px; background: rgba(255,255,255,.045); border: 1px solid var(--border);
      transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease;
    }
    .lb-card:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.25); background: rgba(255,255,255,.07); }
    .lb-card.rank-1 { border-color: rgba(245,223,24,.4); background: linear-gradient(135deg, rgba(245,223,24,.13), rgba(245,223,24,.03)); }
    .lb-card.rank-2 { border-color: rgba(203,213,225,.35); background: rgba(203,213,225,.06); }
    .lb-card.rank-3 { border-color: rgba(205,127,50,.4); background: rgba(205,127,50,.07); }
    .lb-rank { display: flex; align-items: center; justify-content: center; width: 2.6rem; height: 2.6rem; border-radius: 50%; background: rgba(255,255,255,.06); font-size: 1.15rem; font-weight: 900; color: var(--muted); }
    .lb-card.rank-1 .lb-rank { color: #1a1400; background: linear-gradient(145deg, #ffe873, #f5df18); }
    .lb-card.rank-2 .lb-rank { color: #1a1a1a; background: linear-gradient(145deg, #eef1f5, #c0c8d2); }
    .lb-card.rank-3 .lb-rank { color: #2a1200; background: linear-gradient(145deg, #e2a165, #cd7f32); }
    .lb-trophy {
      position: absolute; z-index: 1; top: .35rem; left: 3rem; width: 1.6rem; height: 1.6rem; border-radius: 50%;
      background: #f5df18; color: #1a1400; display: flex; align-items: center; justify-content: center;
      font-size: .78rem; box-shadow: 0 4px 10px rgba(245,223,24,.4);
    }
    .lb-name { display: flex; align-items: center; gap: .5rem; font-size: 1.15rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lb-w, .lb-l { text-align: center; font-size: 1.2rem; font-weight: 900; font-variant-numeric: tabular-nums; }
    .lb-w { color: #4ade80; }
    .lb-l { color: #f87171; }

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

    .court-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: .6rem; }
    .team-block { display: flex; flex-direction: column; gap: .5rem; min-width: 0; }
    .team-label { font-size: .74rem; font-weight: 950; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .team-a .team-label { color: #38bdf8; }
    .team-b .team-label { color: #f472b6; }
    .vs-divider { align-self: center; margin-top: 1.6rem; font-size: .72rem; font-weight: 950; color: var(--muted); background: rgba(255,255,255,.07); border-radius: 999px; padding: .3rem .55rem; white-space: nowrap; }
    .avatar {
      width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%; background: rgba(163,230,53,.16);
      color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 950; font-size: .9rem;
      overflow: hidden;
    }
    .avatar img, .pavatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .pavatar {
      width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%; background: rgba(163,230,53,.16);
      color: var(--accent); display: inline-flex; align-items: center; justify-content: center;
      font-weight: 950; font-size: .64rem; overflow: hidden;
    }
    .lb-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
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

    .standings-heading { margin-top: 1.1rem; padding-top: .9rem; border-top: 1px solid var(--border); }

    /* Compact leaderboard-card variant for the narrow stacked panel */
    .lb-mini { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
    .lb-mini .lb-header { grid-template-columns: 1.7rem 1fr 2rem 2rem; gap: .5rem; padding: 0 .65rem; margin-bottom: .65rem; }
    .lb-mini .lb-col-label { font-size: .6rem; }
    .lb-mini .lb-list { gap: .4rem; overflow: hidden; }
    .lb-mini .lb-card { grid-template-columns: 1.7rem 1fr 2rem 2rem; gap: .5rem; padding: .5rem .65rem; border-radius: 12px; }
    .lb-mini .lb-rank { width: 1.7rem; height: 1.7rem; font-size: .78rem; }
    .lb-mini .lb-trophy { width: 1rem; height: 1rem; font-size: .48rem; top: .25rem; left: 1.85rem; }
    .lb-mini .lb-name { font-size: .9rem; gap: .35rem; }
    .lb-mini .lb-avatar { width: 20px; height: 20px; }
    .lb-mini .lb-w, .lb-mini .lb-l { font-size: .95rem; }

    .tv-footer {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 1.25rem; padding-top: .85rem; border-top: 1px solid var(--border);
      color: var(--muted); font-size: .85rem; font-weight: 700;
    }
    .tv-footer i { color: var(--accent); margin-right: .4rem; }

    /* Broadcast-board visual system */
    :host { --bg: #020817; --surface: #071a3d; --surface-2: #0b2452; --accent: #f5df18; --blue: #2384ff; --teal: #49df9b; }
    .tv-shell {
      background: radial-gradient(circle at 15% 5%, rgba(28,111,255,.24), transparent 32rem), linear-gradient(145deg, #031b4b 0%, #020817 48%, #06183b 100%);
      padding: clamp(1rem, 2.2vw, 2rem) clamp(.85rem, 2.8vw, 2.75rem) 1rem;
    }
    .tv-shell::before { content: ''; position: fixed; inset: 0; pointer-events: none; opacity: .18; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 36px 36px; }
    .brand-mark { border-radius: 50%; background: rgba(245,223,24,.13); border-color: rgba(245,223,24,.5); color: var(--accent); box-shadow: 0 0 30px rgba(245,223,24,.1); }
    .brand-kicker { color: #90b9ff; font-size: .78rem; }
    .brand-copy h1 { font-size: clamp(1.8rem, 4vw, 3.5rem); text-transform: uppercase; font-weight: 1000; letter-spacing: -.045em; }
    .brand-copy h1 em { color: var(--accent); font-style: normal; }
    .brand-copy p { margin: .15rem 0 0; color: var(--muted); font-size: clamp(.72rem, 1.3vw, .95rem); font-weight: 700; }
    .brand-copy p span { color: var(--accent); padding: 0 .25rem; }
    .time-block { display: flex; flex-direction: column; align-items: flex-end; }
    .tv-clock { color: var(--accent); font-size: clamp(1.3rem, 2.4vw, 2rem); }
    .date-label { color: var(--muted); font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
    .status-pill.running { color: var(--accent); background: rgba(245,223,24,.1); border-color: rgba(245,223,24,.3); }
    .tv-main { gap: 1rem; margin-top: 1.25rem; }
    .tv-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .65rem; }
    .stat-tile { display: flex; align-items: baseline; justify-content: center; gap: .6rem; padding: .65rem; border-radius: 10px; background: rgba(7,26,61,.8); border-color: rgba(65,132,255,.25); box-shadow: none; }
    .stat-value { font-size: clamp(1.45rem, 2.6vw, 2.2rem); }
    .stat-value.lime, .stat-value.amber { color: var(--accent); }
    .stat-label { margin: 0; font-size: clamp(.6rem, 1vw, .78rem); }
    .tv-columns { grid-template-columns: minmax(0, 2.25fr) minmax(260px, .75fr); gap: .85rem; }
    .tv-courts, .tv-queue { padding: .85rem; border-radius: 12px; background: rgba(4,18,48,.86); border-color: rgba(65,132,255,.3); box-shadow: 0 22px 50px rgba(0,0,0,.25); }
    .section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: .7rem; }
    .section-heading > span { color: #90b9ff; font-size: .7rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .tv-section-title { margin: 0; text-transform: uppercase; letter-spacing: .04em; }
    .tv-section-title i { color: var(--accent); }
    .courts-grid, .courts-grid.dense { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: .65rem; }
    .court-card { padding: 0; gap: 0; overflow: hidden; min-height: 190px; border-radius: 9px; border-color: #1f76e8; background: linear-gradient(180deg, rgba(20,79,175,.5), rgba(3,20,58,.92)); }
    .court-card.empty { opacity: 1; border-style: solid; }
    .court-head { display: flex; align-items: center; justify-content: space-between; padding: .5rem .65rem; color: #fff; background: linear-gradient(180deg, #2187ff, #1261d5); font-size: .86rem; font-weight: 1000; text-transform: uppercase; letter-spacing: .045em; }
    .court-head strong { color: #071431; background: var(--accent); border-radius: 999px; padding: .18rem .45rem; font-size: .58rem; letter-spacing: .05em; }
    .court-head strong.available { background: #7ce848; }
    .court-empty { flex-direction: column; text-align: center; color: #9bd4ff; }
    .court-empty i { color: var(--accent); font-size: 1.6rem; }
    .court-empty strong { color: #fff; text-transform: uppercase; font-size: .8rem; }
    .court-empty span { max-width: 15rem; font-size: .66rem; }
    .court-teams { flex: 1; grid-template-columns: 1fr auto 1fr; align-items: stretch; gap: 0; }
    .team-block { padding: .7rem .55rem; justify-content: center; }
    .team-a { border-bottom: 5px solid #ff426d; }
    .team-b { border-bottom: 5px solid var(--accent); }
    .team-label, .team-a .team-label, .team-b .team-label { color: #8eb8fb; text-align: center; }
    .team-block .player-row { min-height: 43px; justify-content: center; text-align: center; }
    .team-block .pname { font-size: clamp(.72rem, 1vw, .92rem); text-transform: uppercase; }
    .team-block .walk-tag { display: none; }
    .vs-divider { z-index: 1; align-self: center; margin: 0 -.7rem; color: white; background: #07193c; border: 2px solid #244d94; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
    .queue-list { gap: .4rem; overflow-y: auto; }
    .queue-row { padding: .55rem; border-radius: 8px; background: rgba(20,65,138,.35); border-color: rgba(77,140,255,.25); }
    .queue-row:first-child { border-color: rgba(245,223,24,.65); background: rgba(245,223,24,.09); }
    .queue-row .avatar { width: 34px; height: 34px; flex-basis: 34px; font-size: .72rem; }
    .queue-row .pname { font-size: .86rem; }
    .queue-row .pname small { display: block; margin-top: .12rem; color: #86a6d8; font-size: .58rem; font-weight: 700; }
    .queue-row:first-child .pname small { color: var(--accent); }
    .qnum { width: 24px; height: 24px; flex-basis: 24px; font-size: .7rem; }
    .tv-footer { border-color: rgba(65,132,255,.2); font-size: .72rem; }

    @media (max-width: 760px) {
      .tv-shell { min-height: 100dvh; overflow: visible; }
      .tv-topbar { align-items: flex-start; }
      .brand-mark { width: 48px; height: 48px; flex-basis: 48px; border-radius: 12px; }
      .brand-copy h1 { white-space: normal; line-height: .95; }
      .brand-copy p { display: none; }
      .tv-status { flex-direction: column-reverse; align-items: flex-end; gap: .35rem; }
      .status-pill { padding: .3rem .55rem; font-size: .58rem; }
      .date-label { display: none; }
      .tv-stats { grid-template-columns: repeat(2, 1fr); }
      .stat-tile { justify-content: flex-start; }
      .tv-columns { grid-template-columns: 1fr; }
      .courts-grid, .courts-grid.dense { grid-template-columns: 1fr; }
      .court-card { min-height: 175px; }
      .tv-courts, .tv-queue { min-height: auto; }
      .tv-footer { flex-wrap: wrap; gap: .35rem; }
      .lb-toolbar-title { font-size: 1.15rem; }
      .lb-header, .lb-card { grid-template-columns: 2.2rem 1fr 2.4rem 2.4rem; gap: .55rem; padding-left: .75rem; padding-right: .75rem; }
      .lb-card { padding-top: .65rem; padding-bottom: .65rem; }
      .lb-rank { width: 2rem; height: 2rem; font-size: .95rem; }
      .lb-name { font-size: .95rem; }
      .lb-w, .lb-l { font-size: 1rem; }
    }

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
  today = '';
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
    const now = new Date();
    this.clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.today = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    this.cdr.detectChanges();
  }

  visibleWaiting() {
    return (this.board?.waiting ?? []).slice(0, this.maxVisible);
  }

  hasStandings(): boolean {
    return this.standingsCount() > 0;
  }

  standingsCount(): number {
    return this.board?.leaderboard?.length ?? 0;
  }

  visibleStandings() {
    return (this.board?.leaderboard ?? []).slice(0, this.maxVisible);
  }

  statusLabel(): string {
    const s = this.board?.session?.queueStatus;
    return s === 'running' ? 'Live' : s === 'paused' ? 'Paused' : s === 'ended' ? 'Ended' : 'Not Started';
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  teamsFor(c: QueueCourt): { teamA: QueuePlayer[]; teamB: QueuePlayer[] } {
    return splitCourtTeams(c.players, this.board?.session?.playersPerCourt ?? 4);
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
