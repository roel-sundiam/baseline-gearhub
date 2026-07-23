import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { HostedPlayService, FixedDoublesBoard, FixedDoublesFixture, FixedDoublesStanding } from '../../../../core/services/hosted-play.service';

const MAX_VISIBLE_UPCOMING = 9;
const MAX_VISIBLE_STANDINGS = 9;

@Component({
  selector: 'app-admin-hosted-play-schedule-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tv-viewport">
    <div class="tv-shell" #shell>
      <header class="tv-topbar">
        <div class="brand">
          <div class="brand-mark">
            @if (board?.session?.venueLogo) {
              <img [src]="board!.session.venueLogo" class="brand-logo" alt="" />
            } @else {
              <span class="brand-initials">{{ venueInitials() }}</span>
            }
          </div>
          <div class="brand-copy">
            <span class="brand-kicker">Fixed Doubles <em>Rotation</em></span>
            <h1>{{ board?.session?.title || 'Hosted Play' }}</h1>
            <p>Round-robin schedule <span>•</span> Live standings</p>
          </div>
        </div>
        <div class="tv-status">
          <span class="status-pill" [class.running]="isLive()" [class.ended]="isEnded()">
            <span class="status-dot"></span>{{ statusLabel() }}
          </span>
          <div class="time-block"><span class="tv-clock">{{ clock }}</span><span class="date-label">{{ today }}</span></div>
        </div>
      </header>

      @if (loading) {
        <div class="tv-state"><i class="fas fa-circle-notch fa-spin"></i> Loading schedule…</div>
      } @else if (!board) {
        <div class="tv-state tv-state-error"><i class="fas fa-triangle-exclamation"></i> {{ error || 'Unable to load the schedule.' }}</div>
      } @else if (!hasSchedule()) {
        <div class="tv-state tv-state-idle">
          <i class="fas fa-shuffle"></i>
          <p>Waiting for the schedule to be generated…</p>
        </div>
      } @else if (isEnded()) {
        <main class="tv-main">
          <div class="tv-standings">
            <div class="lb-toolbar">
              <span class="lb-toolbar-title"><i class="fas fa-trophy"></i> Final Standings</span>
              <span class="lb-count">{{ board.standings.length }} Ranked</span>
            </div>
            <div class="lb-header">
              <span class="lb-header-spacer"></span>
              <span class="lb-col-label">W</span>
              <span class="lb-col-label">L</span>
              <span class="lb-col-label">Diff</span>
            </div>
            <div class="lb-list">
              @for (s of board.standings; track s.pairId) {
                <div class="lb-card" [class.rank-1]="s.rank === 1" [class.rank-2]="s.rank === 2" [class.rank-3]="s.rank === 3">
                  @if (s.rank === 1) { <span class="lb-trophy"><i class="fas fa-trophy"></i></span> }
                  <span class="lb-rank">{{ s.rank }}</span>
                  <span class="lb-name">{{ s.pairLabel }}</span>
                  <span class="lb-w">{{ s.wins }}</span>
                  <span class="lb-l">{{ s.losses }}</span>
                  <span class="lb-diff" [class.pos]="s.pointDiff > 0" [class.neg]="s.pointDiff < 0">{{ s.pointDiff > 0 ? '+' : '' }}{{ s.pointDiff }}</span>
                </div>
              }
            </div>
          </div>
        </main>
      } @else {
        <main class="tv-main">
          <section class="tv-stats" aria-label="Session summary">
            <div class="stat-tile">
              <span class="stat-value lime">{{ board.currentMatches.length }}</span>
              <span class="stat-label">Live Now</span>
            </div>
            <div class="stat-tile">
              <span class="stat-value teal">{{ remainingCount() }}</span>
              <span class="stat-label">Remaining</span>
            </div>
            <div class="stat-tile">
              <span class="stat-value blue">{{ board.completedMatches.length }}</span>
              <span class="stat-label">Completed</span>
            </div>
            <div class="stat-tile">
              <span class="stat-value amber">{{ board.pairs.length }}</span>
              <span class="stat-label">Pairs</span>
            </div>
          </section>

          <div class="tv-columns">
            <section class="tv-courts">
              <div class="section-heading"><h2 class="tv-section-title"><i class="fas fa-table-tennis-paddle-ball"></i> Courts</h2><span>{{ board.currentMatches.length }} live</span></div>
              <div class="courts-grid" [class.dense]="board.currentMatches.length > 4">
                @for (f of board.currentMatches; track f._id) {
                  <article class="court-card">
                    <div class="court-head">
                      <span>Court {{ f.courtNumber }}</span>
                      @if (scoreCall(f); as call) {
                        <span class="live-score-tag">Live {{ call }}</span>
                      } @else {
                        <span class="live-score-tag">Match {{ f.matchNumber }} / {{ totalMatches() }}</span>
                      }
                      <strong [class.available]="f.status !== 'in_progress'">{{ f.status === 'in_progress' ? 'Live' : 'Starting' }}</strong>
                    </div>
                    <div class="court-teams">
                      <div class="team-block team-a" [class.is-winner]="f.status === 'completed' && f.winnerPairId === f.pair1Id">
                        <span class="team-label">
                          {{ pairLabelShort(f.pair1) }}
                          @if (isServingPair(1, f)) { <span class="serving-tag"><i class="fas fa-table-tennis-paddle-ball"></i> Serving</span> }
                        </span>
                        @for (p of f.pair1.players; track p.participantId) {
                          <div class="player-row"><span class="pname">{{ p.memberName }}</span></div>
                        }
                      </div>
                      <div class="score-block">
                        @if (f.pair1Score !== null && f.pair2Score !== null) {
                          <span class="score-big" [class.live]="f.status === 'in_progress'">{{ f.pair1Score }}–{{ f.pair2Score }}</span>
                        } @else {
                          <span class="score-vs">VS</span>
                        }
                      </div>
                      <div class="team-block team-b" [class.is-winner]="f.status === 'completed' && f.winnerPairId === f.pair2Id">
                        <span class="team-label">
                          {{ pairLabelShort(f.pair2) }}
                          @if (isServingPair(2, f)) { <span class="serving-tag"><i class="fas fa-table-tennis-paddle-ball"></i> Serving</span> }
                        </span>
                        @for (p of f.pair2.players; track p.participantId) {
                          <div class="player-row"><span class="pname">{{ p.memberName }}</span></div>
                        }
                      </div>
                    </div>
                  </article>
                }
                @for (bye of board.byesThisRound; track bye.pairId) {
                  <article class="court-card empty">
                    <div class="court-empty"><i class="fas fa-mug-hot"></i><strong>Bye this round</strong><span>{{ byeName(bye.pairId) }}</span></div>
                  </article>
                }
              </div>
            </section>

            <section class="tv-queue">
              <div class="section-heading"><h2 class="tv-section-title"><i class="fas fa-list-ol"></i> Up Next</h2><span>{{ remainingCount() }} remaining</span></div>
              @if (board.nextMatches.length === 0 && board.upcomingMatches.length === 0) {
                <div class="queue-empty"><i class="fas fa-mug-hot"></i> No more matches queued</div>
              } @else {
                <div class="queue-list">
                  @for (f of visibleUpcoming(); track f._id; let i = $index) {
                    <div class="queue-row">
                      <span class="qnum">{{ i + 1 }}</span>
                      <span class="pname">{{ pairLabelShort(f.pair1) }} <em>vs</em> {{ pairLabelShort(f.pair2) }}<small>Court {{ f.courtNumber }} · {{ f.scheduledStart | date: 'shortTime' }}</small></span>
                    </div>
                  }
                </div>
                @if (remainingCount() > maxVisible) {
                  <div class="queue-more">+{{ remainingCount() - maxVisible }} more scheduled</div>
                }
              }

              @if (hasStandings()) {
                <div class="section-heading standings-heading"><h2 class="tv-section-title"><i class="fas fa-trophy"></i> Standings</h2><span>{{ board.standings.length }} ranked</span></div>
                <div class="lb-mini">
                  <div class="lb-header">
                    <span class="lb-header-spacer"></span>
                    <span class="lb-col-label">W</span>
                    <span class="lb-col-label">L</span>
                  </div>
                  <div class="lb-list">
                    @for (s of visibleStandings(); track s.pairId) {
                      <div class="lb-card" [class.rank-1]="s.rank === 1" [class.rank-2]="s.rank === 2" [class.rank-3]="s.rank === 3">
                        @if (s.rank === 1) { <span class="lb-trophy"><i class="fas fa-trophy"></i></span> }
                        <span class="lb-rank">{{ s.rank }}</span>
                        <span class="lb-name">{{ s.pairLabel }}</span>
                        <span class="lb-w">{{ s.wins }}</span>
                        <span class="lb-l">{{ s.losses }}</span>
                      </div>
                    }
                  </div>
                </div>
                @if (board.standings.length > maxVisible) {
                  <div class="queue-more">+{{ board.standings.length - maxVisible }} more ranked</div>
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
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #020817; --surface: #071a3d; --surface-2: #0b2452;
      --border: rgba(65,132,255,.25); --text: #fff; --muted: rgba(255,255,255,.6);
      --accent: #f5df18; --blue: #2384ff; --teal: #49df9b; --amber: #f5df18;
    }

    /* This page is meant to be cast to a TV, not viewed directly on the
       device opening it. Rather than reflow responsively (which would just
       track whatever small viewport opened the page), .tv-shell is a fixed
       "design canvas" and the component JS scales that whole canvas with a
       CSS transform to exactly fill whatever screen it's actually on —
       landscape phone or a real TV — with no scrolling and no reflow. */
    .tv-viewport {
      width: 100vw; height: 100vh; height: 100dvh; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #020817;
    }
    /* Fixed 16:9-ish canvas — height is deliberately capped (not content-
       driven) so the canvas's aspect ratio stays close to a real TV/monitor
       regardless of how many matches or standings rows exist. Without this,
       a long "Up Next" or standings list would inflate the canvas taller,
       and scale-to-fit would then letterbox (black bars) on the sides to
       preserve that now-mismatched aspect ratio. Long lists scroll within
       their own panel instead (see .queue-list / .lb-mini). */
    .tv-shell {
      width: 1600px; height: 900px; flex: 0 0 auto; display: flex; flex-direction: column; color: var(--text);
      background: radial-gradient(circle at 15% 5%, rgba(28,111,255,.24), transparent 32rem), linear-gradient(145deg, #031b4b 0%, #020817 48%, #06183b 100%);
      padding: 1.75rem 2.25rem 1rem;
      position: relative; overflow: hidden;
    }
    .tv-shell::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .18; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 36px 36px; }

    .tv-topbar { display: flex; align-items: center; gap: 1.25rem; position: relative; }
    .brand { display: flex; align-items: center; gap: 1rem; min-width: 0; flex: 1; }
    .brand-mark {
      width: 68px; height: 68px; flex: 0 0 68px; border-radius: 50%;
      background: rgba(245,223,24,.13); border: 1px solid rgba(245,223,24,.5);
      color: var(--accent); display: flex; align-items: center; justify-content: center;
      overflow: hidden; box-shadow: 0 0 30px rgba(245,223,24,.1);
    }
    .brand-logo { width: 100%; height: 100%; object-fit: cover; display: block; }
    .brand-initials { font-size: 1.5rem; font-weight: 950; letter-spacing: .02em; }
    .brand-copy { min-width: 0; }
    .brand-kicker { display: block; color: #90b9ff; font-size: .78rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .2rem; }
    .brand-kicker em { color: var(--accent); font-style: normal; }
    .brand-copy h1 { margin: 0; font-size: 2.4rem; line-height: .95; text-transform: uppercase; font-weight: 1000; letter-spacing: -.045em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 640px; }
    .brand-copy p { margin: .15rem 0 0; color: var(--muted); font-size: .85rem; font-weight: 700; }
    .brand-copy p span { color: var(--accent); padding: 0 .25rem; }

    .tv-status { display: flex; align-items: center; gap: 1.25rem; flex-shrink: 0; }
    .status-pill {
      display: inline-flex; align-items: center; gap: .55rem;
      font-size: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: .06em;
      border-radius: 999px; padding: .55rem 1.1rem;
      color: var(--muted); background: rgba(255,255,255,.07); border: 1px solid var(--border);
    }
    .status-dot { width: 10px; height: 10px; border-radius: 999px; background: currentColor; }
    .status-pill.running { color: var(--accent); background: rgba(245,223,24,.1); border-color: rgba(245,223,24,.3); }
    .status-pill.running .status-dot { animation: pulse-dot 1.4s ease-in-out infinite; }
    .status-pill.ended { color: #fca5a5; background: rgba(239,68,68,.13); border-color: rgba(239,68,68,.24); }
    @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
    .time-block { display: flex; flex-direction: column; align-items: flex-end; }
    .tv-clock { color: var(--accent); font-size: 1.7rem; font-weight: 900; font-variant-numeric: tabular-nums; min-width: 5.5ch; text-align: right; }
    .date-label { color: var(--muted); font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }

    .tv-state { flex: 1; display: flex; align-items: center; justify-content: center; gap: 1rem; font-size: 1.6rem; font-weight: 800; color: var(--muted); }
    .tv-state i { font-size: 1.8rem; color: var(--accent); }
    .tv-state-error, .tv-state-error i { color: #fca5a5; }
    .tv-state-idle { flex-direction: column; }
    .tv-state-idle i { font-size: 3rem; }

    .tv-standings { max-width: 1100px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
    .lb-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.1rem; }
    .lb-toolbar-title { display: flex; align-items: center; gap: .6rem; font-size: 1.7rem; font-weight: 950; letter-spacing: -.01em; text-transform: uppercase; }
    .lb-toolbar-title i { color: #f5df18; }
    .lb-count { font-size: .82rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .lb-header { display: grid; grid-template-columns: 3.2rem 1fr 3.5rem 3.5rem 3.5rem; gap: 1rem; padding: 0 1.1rem; margin-bottom: 1rem; }
    .lb-header-spacer { grid-column: span 2; }
    .lb-col-label { text-align: center; font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); opacity: .7; }
    .lb-list { display: flex; flex-direction: column; gap: .6rem; }
    .lb-card {
      position: relative; display: grid; grid-template-columns: 3.2rem 1fr 3.5rem 3.5rem 3.5rem; align-items: center; gap: 1rem;
      padding: .85rem 1.1rem; border-radius: 16px; background: rgba(255,255,255,.045); border: 1px solid var(--border);
    }
    .lb-card.rank-1 { border-color: rgba(245,223,24,.4); background: linear-gradient(135deg, rgba(245,223,24,.13), rgba(245,223,24,.03)); }
    .lb-card.rank-2 { border-color: rgba(203,213,225,.35); background: rgba(203,213,225,.06); }
    .lb-card.rank-3 { border-color: rgba(205,127,50,.4); background: rgba(205,127,50,.07); }
    .lb-rank { display: flex; align-items: center; justify-content: center; width: 2.6rem; height: 2.6rem; border-radius: 50%; background: rgba(255,255,255,.06); font-size: 1.15rem; font-weight: 900; color: var(--muted); }
    .lb-card.rank-1 .lb-rank { color: #1a1400; background: linear-gradient(145deg, #ffe873, #f5df18); }
    .lb-card.rank-2 .lb-rank { color: #1a1a1a; background: linear-gradient(145deg, #eef1f5, #c0c8d2); }
    .lb-card.rank-3 .lb-rank { color: #2a1200; background: linear-gradient(145deg, #e2a165, #cd7f32); }
    .lb-trophy { position: absolute; z-index: 1; top: .35rem; left: 3rem; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: #f5df18; color: #1a1400; display: flex; align-items: center; justify-content: center; font-size: .78rem; box-shadow: 0 4px 10px rgba(245,223,24,.4); }
    .lb-name { font-size: 1.15rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lb-w, .lb-l, .lb-diff { text-align: center; font-size: 1.2rem; font-weight: 900; font-variant-numeric: tabular-nums; }
    .lb-w { color: #4ade80; }
    .lb-l { color: #f87171; }
    .lb-diff.pos { color: #4ade80; }
    .lb-diff.neg { color: #f87171; }

    .tv-main { flex: 1; display: flex; flex-direction: column; gap: 1rem; min-height: 0; margin-top: 1.25rem; }
    .tv-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .65rem; }
    .stat-tile { display: flex; align-items: baseline; justify-content: center; gap: .6rem; padding: .65rem; border-radius: 10px; background: rgba(7,26,61,.8); border: 1px solid rgba(65,132,255,.25); }
    .stat-value { display: block; font-size: 1.9rem; font-weight: 950; line-height: 1; color: var(--accent); }
    .stat-label { display: block; margin: 0; font-size: .72rem; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }

    .tv-columns { flex: 1; display: grid; grid-template-columns: minmax(0, 2.25fr) minmax(260px, .75fr); gap: .85rem; min-height: 0; }
    .tv-courts, .tv-queue { padding: .85rem; border-radius: 12px; background: rgba(4,18,48,.86); border: 1px solid rgba(65,132,255,.3); box-shadow: 0 22px 50px rgba(0,0,0,.25); display: flex; flex-direction: column; min-height: 0; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: .7rem; }
    .section-heading > span { color: #90b9ff; font-size: .7rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .tv-section-title { margin: 0; text-transform: uppercase; letter-spacing: .04em; display: flex; align-items: center; gap: .6rem; font-size: 1.05rem; font-weight: 900; }
    .tv-section-title i { color: var(--accent); }

    .courts-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); grid-auto-rows: min-content; gap: .65rem; align-content: start; }
    .court-card { padding: 0; overflow: hidden; min-height: 190px; border-radius: 9px; border: 1px solid #1f76e8; background: linear-gradient(180deg, rgba(20,79,175,.5), rgba(3,20,58,.92)); display: flex; flex-direction: column; }
    .court-card.empty { border-style: solid; opacity: 1; align-items: center; justify-content: center; }
    .court-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .5rem .65rem; color: #fff; background: linear-gradient(180deg, #2187ff, #1261d5); font-size: .86rem; font-weight: 1000; text-transform: uppercase; letter-spacing: .045em; }
    .court-head strong { color: #071431; background: var(--accent); border-radius: 999px; padding: .18rem .45rem; font-size: .58rem; letter-spacing: .05em; }
    .court-head strong.available { background: #7ce848; }
    .live-score-tag { flex: 1; min-width: 0; text-align: center; color: var(--accent); font-size: .72rem; font-weight: 950; letter-spacing: .03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .court-empty { flex-direction: column; text-align: center; color: #9bd4ff; gap: .3rem; padding: 1rem; }
    .court-empty i { color: var(--accent); font-size: 1.6rem; }
    .court-empty strong { color: #fff; text-transform: uppercase; font-size: .8rem; }
    .court-empty span { max-width: 15rem; font-size: .72rem; }
    .court-teams { flex: 1; display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch; gap: .5rem; }
    .team-block { padding: .7rem .55rem; display: flex; flex-direction: column; gap: .3rem; justify-content: center; text-align: center; }
    .team-a { border-bottom: 5px solid #ff426d; }
    .team-b { border-bottom: 5px solid var(--accent); }
    .team-block.is-winner { background: rgba(245,223,24,.1); }
    .team-label { color: #8eb8fb; font-size: .7rem; font-weight: 950; text-transform: uppercase; letter-spacing: .04em; margin-bottom: .2rem; display: flex; align-items: center; justify-content: center; gap: .3rem; flex-wrap: wrap; }
    .serving-tag { display: inline-flex; align-items: center; gap: .2rem; font-size: .58rem; font-weight: 950; text-transform: uppercase; letter-spacing: .03em; color: #071431; background: var(--accent); border-radius: 999px; padding: .1rem .4rem; }
    .player-row { min-height: 20px; }
    .pname { font-size: .85rem; font-weight: 800; text-transform: uppercase; color: #fff; }
    .score-block { z-index: 1; align-self: center; padding: 0 .35rem; display: flex; }
    .score-big { color: white; background: #07193c; border: 2px solid #244d94; box-shadow: 0 4px 12px rgba(0,0,0,.4); font-size: 1.4rem; padding: .5rem .8rem; border-radius: 14px; white-space: nowrap; font-weight: 950; font-variant-numeric: tabular-nums; }
    .score-big.live { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(245,223,24,.15), 0 4px 12px rgba(0,0,0,.4); animation: pulse-score 1.6s ease-in-out infinite; }
    @keyframes pulse-score { 0%, 100% { opacity: 1; } 50% { opacity: .72; } }
    .score-vs { color: white; background: #07193c; border: 2px solid #244d94; box-shadow: 0 4px 12px rgba(0,0,0,.4); border-radius: 999px; font-size: .72rem; font-weight: 950; padding: .3rem .6rem; }

    .queue-empty { display: flex; align-items: center; gap: .5rem; color: var(--muted); font-size: 1rem; font-weight: 700; padding: .6rem 0; }
    .queue-list { display: flex; flex-direction: column; gap: .4rem; overflow-y: auto; flex: 1 1 0; min-height: 40px; }
    .queue-row { display: flex; align-items: center; gap: .65rem; padding: .55rem; border-radius: 8px; background: rgba(20,65,138,.35); border: 1px solid rgba(77,140,255,.25); }
    .queue-row:first-child { border-color: rgba(245,223,24,.65); background: rgba(245,223,24,.09); }
    .qnum { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50%; background: rgba(255,255,255,.08); color: var(--muted); font-weight: 950; font-size: .7rem; display: flex; align-items: center; justify-content: center; }
    .queue-row:first-child .qnum { background: rgba(245,223,24,.2); color: var(--accent); }
    .queue-row .pname { flex: 1; min-width: 0; font-size: .86rem; font-weight: 800; text-transform: none; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .queue-row .pname em { color: #90b9ff; font-style: normal; margin: 0 .25rem; }
    .queue-row .pname small { display: block; margin-top: .12rem; color: #86a6d8; font-size: .58rem; font-weight: 700; }
    .queue-row:first-child .pname small { color: var(--accent); }
    .queue-more { margin-top: .6rem; color: var(--muted); font-size: .9rem; font-weight: 800; text-align: center; }

    .standings-heading { margin-top: 1.1rem; padding-top: .9rem; border-top: 1px solid var(--border); }
    .lb-mini { display: flex; flex-direction: column; flex: 1 1 0; min-height: 40px; overflow: hidden; }
    .lb-mini .lb-header { grid-template-columns: 1.7rem 1fr 2rem 2rem; gap: .5rem; padding: 0 .65rem; margin-bottom: .65rem; }
    .lb-mini .lb-col-label { font-size: .6rem; }
    .lb-mini .lb-list { gap: .4rem; overflow-y: auto; min-height: 0; flex: 1 1 auto; }
    .lb-mini .lb-card { grid-template-columns: 1.7rem 1fr 2rem 2rem; gap: .5rem; padding: .5rem .65rem; border-radius: 12px; }
    .lb-mini .lb-rank { width: 1.7rem; height: 1.7rem; font-size: .78rem; }
    .lb-mini .lb-trophy { width: 1rem; height: 1rem; font-size: .48rem; top: .25rem; left: 1.85rem; }
    .lb-mini .lb-name { font-size: .9rem; }
    .lb-mini .lb-w, .lb-mini .lb-l { font-size: .95rem; }

    .tv-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 1.25rem; padding-top: .85rem; border-top: 1px solid rgba(65,132,255,.2); color: var(--muted); font-size: .72rem; font-weight: 700; }
    .tv-footer i { color: var(--accent); margin-right: .4rem; }

  `],
})
export class AdminHostedPlayScheduleDisplayComponent implements OnInit, AfterViewInit, OnDestroy {
  id = '';
  board: FixedDoublesBoard | null = null;
  loading = true;
  error = '';
  lastUpdated = '';
  clock = '';
  today = '';
  maxVisible = MAX_VISIBLE_UPCOMING;

  @ViewChild('shell') private shellRef?: ElementRef<HTMLElement>;

  private pollSub?: Subscription;
  private clockTimer?: ReturnType<typeof setInterval>;
  private resizeObserver?: ResizeObserver;
  private orientationTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private hp: HostedPlayService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);

    const onBoard = (b: FixedDoublesBoard) => { this.setBoard(b); this.loading = false; this.cdr.detectChanges(); };
    const onError = (err: any) => { this.error = err?.error?.error || 'Unable to load the schedule.'; this.loading = false; this.cdr.detectChanges(); };
    this.hp.getFixedDoublesBoard(this.id).subscribe({ next: onBoard, error: onError });
    this.pollSub = this.hp.pollFixedDoublesBoard(this.id, 6000).subscribe({ next: onBoard, error: onError });
  }

  ngAfterViewInit() {
    const el = this.shellRef?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.fitToViewport());
      this.resizeObserver.observe(el);
    }
    this.fitToViewport();
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.orientationTimer) clearTimeout(this.orientationTimer);
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.fitToViewport();
  }

  @HostListener('window:orientationchange')
  onOrientationChange() {
    // The viewport doesn't settle to its new size instantly on rotation.
    if (this.orientationTimer) clearTimeout(this.orientationTimer);
    this.orientationTimer = setTimeout(() => this.fitToViewport(), 200);
  }

  // Scales the fixed-width .tv-shell "canvas" with a CSS transform so it
  // always exactly fills whatever screen it's actually on — landscape phone
  // or a real TV — with no scrolling and no responsive reflow. offsetWidth/
  // offsetHeight reflect the element's real layout size and are unaffected
  // by the transform itself, so this is safe to call repeatedly (a
  // ResizeObserver on the shell re-triggers it whenever content height
  // changes, e.g. more/fewer matches or standings rows).
  private fitToViewport() {
    const el = this.shellRef?.nativeElement;
    if (!el) return;
    const naturalWidth = el.offsetWidth;
    const naturalHeight = el.offsetHeight;
    if (!naturalWidth || !naturalHeight) return;
    const scale = Math.min(window.innerWidth / naturalWidth, window.innerHeight / naturalHeight);
    el.style.transform = `scale(${scale})`;
  }

  private setBoard(b: FixedDoublesBoard) {
    this.board = b;
    this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private updateClock() {
    const now = new Date();
    this.clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.today = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    this.cdr.detectChanges();
  }

  hasSchedule(): boolean {
    const b = this.board;
    if (!b) return false;
    return (b.currentMatches.length + b.nextMatches.length + b.upcomingMatches.length + b.completedMatches.length) > 0;
  }

  totalMatches(): number {
    const b = this.board;
    if (!b) return 0;
    return b.currentMatches.length + b.nextMatches.length + b.upcomingMatches.length + b.completedMatches.length;
  }

  remainingCount(): number {
    const b = this.board;
    if (!b) return 0;
    return b.currentMatches.length + b.nextMatches.length + b.upcomingMatches.length;
  }

  visibleUpcoming(): FixedDoublesFixture[] {
    return [...(this.board?.nextMatches ?? []), ...(this.board?.upcomingMatches ?? [])].slice(0, this.maxVisible);
  }

  hasStandings(): boolean {
    return (this.board?.standings.length ?? 0) > 0;
  }

  visibleStandings(): FixedDoublesStanding[] {
    return (this.board?.standings ?? []).slice(0, MAX_VISIBLE_STANDINGS);
  }

  isLive(): boolean {
    return !!this.board && !this.isEnded() && this.board.currentMatches.some(f => f.status === 'in_progress');
  }

  isEnded(): boolean {
    return this.board?.session?.status === 'completed';
  }

  statusLabel(): string {
    if (this.isEnded()) return 'Ended';
    if (this.isLive()) return 'Live';
    if (this.board?.locked) return 'In Progress';
    return 'Scheduled';
  }

  pairLabelShort(snapshot: { pairLabel: string; players: { memberName: string }[] } | undefined): string {
    if (!snapshot) return '—';
    return snapshot.players.map(p => p.memberName).filter(Boolean).join(' & ') || snapshot.pairLabel || 'Pair';
  }

  isServingPair(pair: 1 | 2, f: FixedDoublesFixture): boolean {
    return f.status === 'in_progress' && f.servingPair === pair;
  }

  // Real pickleball score call: serving pair's score, receiving pair's score,
  // then server number (fixed doubles is always 2-per-pair, so always 3-digit
  // once a server is picked). Only meaningful for a live pickleball match.
  scoreCall(f: FixedDoublesFixture): string {
    if (f.status !== 'in_progress' || this.board?.session?.sport !== 'pickleball') return '';
    if (!f.servingPair || f.pair1Score === null || f.pair2Score === null) return '';
    const servingScore = f.servingPair === 1 ? f.pair1Score : f.pair2Score;
    const receivingScore = f.servingPair === 1 ? f.pair2Score : f.pair1Score;
    return f.serverNumber ? `${servingScore}-${receivingScore}-${f.serverNumber}` : `${servingScore}-${receivingScore}`;
  }

  byeName(pairId: string): string {
    const all = [...(this.board?.currentMatches ?? []), ...(this.board?.nextMatches ?? []), ...(this.board?.upcomingMatches ?? []), ...(this.board?.completedMatches ?? [])];
    const match = all.find(f => f.pair1Id === pairId || f.pair2Id === pairId);
    const snapshot = match ? (match.pair1Id === pairId ? match.pair1 : match.pair2) : null;
    return snapshot ? this.pairLabelShort(snapshot) : 'Pair';
  }

  venueInitials(): string {
    const name = this.board?.session?.venue || this.board?.session?.title || 'HP';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
}
