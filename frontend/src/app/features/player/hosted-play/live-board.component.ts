import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval, EMPTY } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { HostedPlayService, HostedPlaySession, QueueBoard, QueueCourt, QueuePlayer, splitCourtTeams } from '../../../core/services/hosted-play.service';
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
          <span class="topbar-kicker"><i class="fas fa-circle"></i> Live Board</span>
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

          <section class="event-hero">
            <div class="event-mark">
              @if (venueLogo()) {
                <img [src]="venueLogo()" [alt]="venueLabel()" class="venue-logo-img" />
              } @else {
                <span class="venue-initials">{{ venueInitials() }}</span>
              }
            </div>
            <div class="event-copy">
              <span class="event-eyebrow">{{ sessionDetail?.sport || 'Hosted play' }}</span>
              <h2>{{ board.session.title }}</h2>
              <div class="event-meta">
                <span><i class="fas fa-location-dot"></i> {{ venueLabel() }}</span>
                @if (sessionDetail?.date) { <span><i class="fas fa-calendar"></i> {{ sessionDetail?.date | date:'EEE, MMM d' }}</span> }
                @if (sessionDetail?.startTime) { <span><i class="fas fa-clock"></i> {{ sessionDetail?.startTime }}–{{ sessionDetail?.endTime }}</span> }
              </div>
            </div>
            <span class="live-pill" [class.ended]="board.session.queueStatus === 'ended'" [class.paused]="board.session.queueStatus === 'paused'">
              <i class="fas fa-circle"></i> {{ queueStatusLabel() }}
            </span>
          </section>

          <!-- My status card -->
          @if (me) {
            <section class="my-card" [ngClass]="me.queueStatus">
              <div class="my-icon">
                <i [class]="myIcon()"></i>
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
            <div class="stat-chip playing-stat"><i class="fas fa-table-tennis-paddle-ball"></i><div><span class="sv">{{ board.counts.playing }}</span><span class="sl">Playing now</span></div></div>
            <div class="stat-chip waiting-stat"><i class="fas fa-user-clock"></i><div><span class="sv">{{ board.counts.waiting }}</span><span class="sl">In queue</span></div></div>
            <div class="stat-chip games-stat"><i class="fas fa-bolt"></i><div><span class="sv">{{ board.counts.activeGames }}</span><span class="sl">Active games</span></div></div>
          </div>

          <!-- Courts -->
          @if (board.session.queueStatus !== 'not_started') {
            <section class="block">
              <div class="block-heading"><h2 class="block-title"><i class="fas fa-table-tennis-paddle-ball"></i> Courts</h2><span>{{ board.courts.length }} courts</span></div>
              <div class="courts-grid">
                @for (c of board.courts; track c.courtNumber) {
                  <div class="court-card" [class.empty]="c.players.length === 0">
                    <div class="court-head"><span class="court-label">Court {{ c.courtNumber }}</span><span class="court-state" [class.available]="c.players.length === 0">{{ c.players.length === 0 ? 'Available' : 'In play' }}</span></div>
                    @if (c.players.length === 0) {
                      <div class="court-empty"><i class="fas fa-hourglass-half"></i> Waiting for players</div>
                    } @else {
                      @let teams = teamsFor(c);
                      <div class="court-teams">
                        <div class="team-block team-a">
                          <span class="team-label">Team A</span>
                          @for (p of teams.teamA; track p._id) {
                            <div class="player-row" [class.is-me]="isMe(p)">
                              <div class="avatar" [class.avatar-me]="isMe(p)">
                                @if (p.profileImage) {
                                  <img [src]="p.profileImage" [alt]="p.memberName" />
                                } @else {
                                  {{ initials(p.memberName) }}
                                }
                              </div>
                              <span class="pname">{{ p.memberName }}@if (isMe(p)) { <span class="you-tag">You</span> }</span>
                              <span class="pgames">{{ p.gamesPlayed }}×</span>
                            </div>
                          }
                        </div>
                        <span class="vs-divider">VS</span>
                        <div class="team-block team-b">
                          <span class="team-label">Team B</span>
                          @for (p of teams.teamB; track p._id) {
                            <div class="player-row" [class.is-me]="isMe(p)">
                              <div class="avatar" [class.avatar-me]="isMe(p)">
                                @if (p.profileImage) {
                                  <img [src]="p.profileImage" [alt]="p.memberName" />
                                } @else {
                                  {{ initials(p.memberName) }}
                                }
                              </div>
                              <span class="pname">{{ p.memberName }}@if (isMe(p)) { <span class="you-tag">You</span> }</span>
                              <span class="pgames">{{ p.gamesPlayed }}×</span>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </section>

            <!-- Waiting queue -->
            @if (board.waiting.length > 0) {
              <section class="block">
                <div class="block-heading"><h2 class="block-title"><i class="fas fa-list-ol"></i> Waiting Queue</h2><span>{{ board.waiting.length }} waiting</span></div>
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
                <div class="block-heading"><h2 class="block-title"><i class="fas fa-pause-circle"></i> On Hold</h2><span>{{ board.paused.length }} players</span></div>
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

            <!-- Standings -->
            @if (board.leaderboard && board.leaderboard.length > 0) {
              <section class="block lb-block">
                <div class="lb-toolbar">
                  <span class="lb-toolbar-title"><i class="fas fa-trophy"></i> Standings@if (board.session.queueStatus === 'ended') { — Final }</span>
                  <span class="lb-count">{{ board.leaderboard.length }} Ranked</span>
                </div>
                <div class="lb-header">
                  <span class="lb-header-spacer"></span>
                  <span class="lb-col-label">W</span>
                  <span class="lb-col-label">L</span>
                </div>
                <div class="lb-list">
                  @for (p of board.leaderboard; track p._id; let i = $index) {
                    <div class="lb-card" [class.rank-1]="i === 0" [class.rank-2]="i === 1" [class.rank-3]="i === 2" [class.is-me]="isMe(p)">
                      @if (i === 0) { <span class="lb-trophy"><i class="fas fa-trophy"></i></span> }
                      <span class="lb-rank">{{ i + 1 }}</span>
                      <span class="lb-name">{{ p.memberName }}@if (isMe(p)) { <span class="you-tag">You</span> }</span>
                      <span class="lb-w">{{ p.wins || 0 }}</span>
                      <span class="lb-l">{{ p.losses || 0 }}</span>
                    </div>
                  }
                </div>
                @if (myRank() > 0) {
                  <div class="my-rank-note">
                    <i class="fas fa-trophy"></i>
                    @if (board.session.queueStatus === 'ended') {
                      You finished #{{ myRank() }} of {{ board.leaderboard.length }} — {{ me?.wins || 0 }}W–{{ me?.losses || 0 }}L
                    } @else {
                      You're currently #{{ myRank() }} of {{ board.leaderboard.length }} — {{ me?.wins || 0 }}W–{{ me?.losses || 0 }}L
                    }
                  </div>
                }
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
              <p>The queue hasn't started yet. This board updates automatically once play begins.</p>
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

    .court-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: .5rem; }
    .team-block { display: flex; flex-direction: column; gap: .35rem; min-width: 0; }
    .team-label { font-size: .64rem; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .team-a .team-label { color: var(--blue); }
    .team-b .team-label { color: #f472b6; }
    .vs-divider { align-self: center; margin-top: 1.1rem; font-size: .6rem; font-weight: 900; color: var(--muted); background: rgba(255,255,255,.06); border-radius: 999px; padding: .25rem .45rem; white-space: nowrap; }

    .player-row, .queue-row { display: flex; align-items: center; gap: .55rem; padding: .4rem .5rem; border-radius: 8px; }
    .player-row.is-me, .queue-row.is-me { background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.25); }
    .queue-row { padding: .5rem .6rem; background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 8px; }
    .queue-list { display: flex; flex-direction: column; gap: .4rem; }

    .avatar { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; background: rgba(163,230,53,.14); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: .7rem; font-weight: 900; overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .avatar-me { background: var(--accent); color: #07130d; }
    .avatar-me img { border: 2px solid var(--accent); border-radius: 50%; }
    .qnum { width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: rgba(255,255,255,.08); color: var(--muted); font-size: .72rem; font-weight: 900; display: flex; align-items: center; justify-content: center; }
    .qnum-me { background: rgba(163,230,53,.2); color: var(--accent); }
    .pause-num { color: var(--amber); background: rgba(245,158,11,.14); }

    .pname { flex: 1; color: var(--text); font-size: .88rem; font-weight: 700; display: flex; align-items: center; gap: .35rem; overflow-wrap: anywhere; }
    .pgames { color: var(--muted); font-size: .72rem; white-space: nowrap; }
    .my-rank-note { margin-top: .7rem; display: flex; align-items: center; gap: .45rem; font-size: .82rem; font-weight: 800; color: var(--accent); padding: .55rem .7rem; background: rgba(163,230,53,.08); border: 1px solid rgba(163,230,53,.2); border-radius: 8px; }
    .my-rank-note i { color: #f59e0b; }
    .you-tag { font-size: .62rem; font-weight: 900; color: #07130d; background: var(--accent); border-radius: 99px; padding: .08rem .35rem; }

    /* Leaderboard — premium ranking cards */
    .lb-block { padding: .9rem .85rem 1rem; }
    .lb-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: .7rem; }
    .lb-toolbar-title { display: flex; align-items: center; gap: .45rem; font-size: .88rem; font-weight: 900; color: var(--text); }
    .lb-toolbar-title i { color: #f5df18; }
    .lb-count { font-size: .66rem; font-weight: 900; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); }
    .lb-header { display: grid; grid-template-columns: 2rem 1fr 2.1rem 2.1rem; gap: .5rem; padding: 0 .6rem; margin-bottom: .65rem; }
    .lb-col-label { text-align: center; font-size: .6rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); opacity: .7; }
    .lb-list { display: flex; flex-direction: column; gap: .45rem; }
    .lb-card {
      position: relative; display: grid; grid-template-columns: 2rem 1fr 2.1rem 2.1rem; align-items: center; gap: .5rem;
      padding: .6rem .65rem; border-radius: 14px; background: rgba(255,255,255,.04); border: 1px solid var(--border);
      transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease;
    }
    .lb-card:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(0,0,0,.22); }
    .lb-card.is-me { border-color: rgba(163,230,53,.35); background: rgba(163,230,53,.08); }
    .lb-card.rank-1 { border-color: rgba(245,223,24,.4); background: linear-gradient(135deg, rgba(245,223,24,.13), rgba(245,223,24,.03)); }
    .lb-card.rank-2 { border-color: rgba(203,213,225,.35); background: rgba(203,213,225,.06); }
    .lb-card.rank-3 { border-color: rgba(205,127,50,.4); background: rgba(205,127,50,.07); }
    .lb-rank { display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 50%; background: rgba(255,255,255,.06); font-size: .78rem; font-weight: 900; color: var(--muted); }
    .lb-card.rank-1 .lb-rank { color: #1a1400; background: linear-gradient(145deg, #ffe873, #f5df18); }
    .lb-card.rank-2 .lb-rank { color: #1a1a1a; background: linear-gradient(145deg, #eef1f5, #c0c8d2); }
    .lb-card.rank-3 .lb-rank { color: #2a1200; background: linear-gradient(145deg, #e2a165, #cd7f32); }
    .lb-trophy {
      position: absolute; top: -.45rem; right: .55rem; width: 1.15rem; height: 1.15rem; border-radius: 50%;
      background: #f5df18; color: #1a1400; display: flex; align-items: center; justify-content: center;
      font-size: .55rem; box-shadow: 0 3px 8px rgba(245,223,24,.4);
    }
    .lb-name { font-size: .92rem; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: .35rem; min-width: 0; }
    .lb-w, .lb-l { text-align: center; font-size: 1rem; font-weight: 900; font-variant-numeric: tabular-nums; }
    .lb-w { color: #4ade80; }
    .lb-l { color: #f87171; }

    .refresh-full-btn { width: 100%; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border-radius: 12px; background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.22); color: var(--accent); font-size: .9rem; font-weight: 900; font-family: inherit; cursor: pointer; transition: background .15s, transform .15s; }
    .refresh-full-btn:hover:not(:disabled) { background: rgba(163,230,53,.18); }
    .refresh-full-btn:active:not(:disabled) { transform: scale(.98); }
    .refresh-full-btn:disabled { opacity: .5; cursor: not-allowed; }

    .not-started { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .75rem; min-height: 220px; border: 1px dashed var(--border); border-radius: 14px; text-align: center; color: var(--muted); padding: 1.5rem; }
    .not-started i { font-size: 1.8rem; color: var(--accent); }
    .not-started p { margin: 0; font-size: .9rem; line-height: 1.5; }

    /* Modern player live-board theme */
    :host {
      --bg: #050b09;
      --surface: #0d1915;
      --surface-raised: #12221c;
      --border: rgba(191, 219, 204, .12);
      --text: #f5faf7;
      --muted: #91a59a;
      --accent: #a3e635;
      --blue: #52b8ff;
    }
    .live-shell {
      min-height: 100dvh;
      padding: 0 clamp(1rem, 3vw, 2rem) 4rem;
      background:
        radial-gradient(circle at 15% -5%, rgba(163,230,53,.13), transparent 30rem),
        radial-gradient(circle at 90% 20%, rgba(56,189,248,.08), transparent 26rem),
        var(--bg);
    }
    .topbar {
      max-width: 960px; min-height: 72px; padding: .75rem 0;
      background: rgba(5,11,9,.82); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(255,255,255,.05);
    }
    .back-btn, .refresh-btn { border-radius: 14px; transition: transform .18s, background-color .18s, border-color .18s; }
    .back-btn:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.18); }
    .topbar-kicker { display: flex; align-items: center; gap: .35rem; }
    .topbar-kicker i { font-size: .4rem; filter: drop-shadow(0 0 5px var(--accent)); }
    .topbar h1 { margin-top: .15rem; font-size: 1.08rem; }
    .updated-bar { max-width: 960px; justify-content: flex-end; margin: .55rem auto .8rem; }
    .live-page { max-width: 960px; gap: 1rem; }

    .event-hero {
      position: relative; overflow: hidden; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 1rem;
      padding: 1.2rem; border: 1px solid rgba(163,230,53,.18); border-radius: 20px;
      background: linear-gradient(125deg, rgba(26,52,40,.96), rgba(10,24,19,.98));
      box-shadow: 0 22px 55px rgba(0,0,0,.25);
    }
    .event-hero::after { content: ''; position: absolute; width: 220px; height: 220px; right: -80px; top: -130px; border-radius: 50%; background: rgba(163,230,53,.08); pointer-events: none; }
    .event-mark { width: 58px; height: 58px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 58px; border-radius: 16px; color: var(--accent); background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.25); }
    .event-mark .venue-initials { font-size: .9rem; }
    .event-copy { min-width: 0; position: relative; z-index: 1; }
    .event-eyebrow { display: block; margin-bottom: .2rem; color: var(--accent); font-size: .68rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .event-copy h2 { margin: 0; font-size: clamp(1.2rem, 3vw, 1.65rem); line-height: 1.2; }
    .event-meta { display: flex; flex-wrap: wrap; gap: .4rem 1rem; margin-top: .55rem; color: var(--muted); font-size: .75rem; }
    .event-meta span { display: inline-flex; align-items: center; gap: .35rem; min-width: 0; }
    .event-meta i { color: var(--accent); }
    .live-pill { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .7rem; border-radius: 999px; color: var(--accent); background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.24); font-size: .67rem; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
    .live-pill i { font-size: .42rem; filter: drop-shadow(0 0 4px currentColor); }
    .live-pill.paused { color: #fbbf24; background: rgba(245,158,11,.1); border-color: rgba(245,158,11,.25); }
    .live-pill.ended { color: var(--muted); background: rgba(255,255,255,.06); border-color: var(--border); }

    .my-card { position: relative; overflow: hidden; min-height: 78px; padding: 1rem 1.15rem; border-radius: 18px; background: var(--surface-raised); box-shadow: 0 14px 35px rgba(0,0,0,.16); }
    .my-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--accent); }
    .my-card.playing::before { background: var(--blue); }
    .my-card.paused::before { background: var(--amber); }
    .my-icon { width: 48px; height: 48px; border-radius: 15px; font-size: 1rem; }
    .my-card.playing .my-icon { color: var(--blue); background: rgba(56,189,248,.12); border-color: rgba(56,189,248,.22); }
    .my-card.paused .my-icon { color: var(--amber); background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.22); }
    .my-label { font-size: .66rem; letter-spacing: .1em; }
    .my-status { font-size: 1.05rem; }
    .my-games { padding: .4rem .6rem; border-radius: 999px; background: rgba(255,255,255,.05); }

    .stats-row { gap: .75rem; }
    .stat-chip { display: flex; align-items: center; justify-content: flex-start; gap: .7rem; min-height: 76px; padding: .85rem 1rem; text-align: left; border-radius: 16px; background: var(--surface); box-shadow: 0 12px 28px rgba(0,0,0,.13); }
    .stat-chip > i { width: 36px; height: 36px; flex: 0 0 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; color: var(--accent); background: rgba(163,230,53,.1); }
    .playing-stat > i { color: var(--blue); background: rgba(56,189,248,.1); }
    .games-stat > i { color: #fbbf24; background: rgba(245,158,11,.1); }
    .sv { line-height: 1; font-size: 1.35rem; }
    .sl { display: block; margin-top: .15rem; font-size: .68rem; }

    .block { padding: 1.1rem; border-radius: 18px; background: rgba(13,25,21,.92); box-shadow: 0 16px 38px rgba(0,0,0,.15); }
    .block-heading, .lb-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .9rem; }
    .block-heading > span, .lb-count { color: var(--muted); font-size: .65rem; font-weight: 900; text-transform: uppercase; letter-spacing: .07em; }
    .block-title { margin: 0; font-size: .92rem; }
    .courts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
    .court-card { overflow: hidden; padding: 0; border-radius: 14px; background: rgba(255,255,255,.025); }
    .court-card.empty { opacity: 1; }
    .court-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .65rem .75rem; border-bottom: 1px solid var(--border); background: rgba(255,255,255,.025); }
    .court-label { margin: 0; font-size: .78rem; letter-spacing: .03em; text-transform: uppercase; }
    .court-state { padding: .2rem .45rem; border-radius: 999px; color: var(--blue); background: rgba(56,189,248,.1); font-size: .58rem; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
    .court-state.available { color: var(--accent); background: rgba(163,230,53,.1); }
    .court-empty { min-height: 84px; justify-content: center; padding: .8rem; }
    .court-teams { padding: .75rem; }
    .player-row { min-width: 0; padding: .45rem; }
    .pname { min-width: 0; font-size: .82rem; }
    .player-row .pname { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .player-row .you-tag { margin-left: .25rem; }
    .queue-list { gap: .5rem; }
    .queue-row { min-height: 48px; padding: .55rem .7rem; border-radius: 11px; background: rgba(255,255,255,.025); }
    .queue-row.is-me, .player-row.is-me { box-shadow: inset 0 0 0 1px rgba(163,230,53,.12); }
    .qnum { width: 30px; height: 30px; }

    .lb-block { padding: 1.1rem; }
    .lb-toolbar { margin-bottom: .8rem; }
    .lb-header-spacer { grid-column: span 2; }
    .lb-card { border-radius: 12px; }
    .lb-trophy { z-index: 1; top: .2rem; left: 2.15rem; right: auto; }
    .refresh-full-btn { border-radius: 14px; background: var(--surface); }
    .not-started { min-height: 260px; border-radius: 18px; background: var(--surface); }

    @media (max-width: 720px) {
      .live-shell { padding-inline: .8rem; }
      .event-hero { grid-template-columns: auto minmax(0,1fr); padding: 1rem; }
      .live-pill { grid-column: 2; justify-self: start; }
      .event-meta { gap: .35rem .75rem; }
      .courts-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 520px) {
      .live-shell { padding-inline: .65rem; padding-bottom: 2rem; }
      .topbar { grid-template-columns: 40px minmax(0,1fr) 40px; min-height: 64px; gap: .55rem; }
      .back-btn, .refresh-btn { width: 40px; height: 40px; border-radius: 12px; }
      .updated-bar { margin-top: .35rem; }
      .event-mark { width: 48px; height: 48px; flex-basis: 48px; border-radius: 13px; }
      .event-copy h2 { font-size: 1.1rem; }
      .event-meta { flex-direction: column; }
      .my-card { display: grid; grid-template-columns: auto minmax(0,1fr); min-height: 0; padding: .85rem; }
      .my-games { grid-column: 2; justify-self: start; padding: 0; background: transparent; }
      .stats-row { gap: .4rem; }
      .stat-chip { min-height: 70px; flex-direction: column; justify-content: center; gap: .25rem; padding: .55rem .25rem; text-align: center; }
      .stat-chip > i { width: auto; height: auto; flex-basis: auto; background: transparent; }
      .sv { font-size: 1.15rem; }
      .sl { font-size: .6rem; }
      .block, .lb-block { padding: .8rem; border-radius: 15px; }
      .court-teams { grid-template-columns: 1fr; gap: .55rem; }
      .vs-divider { margin: 0; justify-self: center; }
      .team-label { margin-left: .25rem; }
      .lb-header, .lb-card { grid-template-columns: 2rem minmax(0,1fr) 1.8rem 1.8rem; gap: .35rem; padding-left: .5rem; padding-right: .5rem; }
      .lb-name { font-size: .82rem; }
      .lb-w, .lb-l { font-size: .9rem; }
      .pgames { font-size: .65rem; }
    }
  `],
})
export class PlayerHostedPlayLiveBoardComponent implements OnInit, OnDestroy {
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
  private pollSub?: Subscription;
  private readonly POLL_MS = 6000;

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
      next: (b) => { this.setBoard(b); this.loading = false; this.startPolling(); this.cdr.detectChanges(); },
      error: (err) => { this.loading = false; this.error = err?.error?.error || 'Unable to load live board.'; this.cdr.detectChanges(); },
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  // Silently refresh the board on an interval so players see rotations without
  // tapping refresh. Resilient to transient network errors (catchError → skip
  // that tick), and stops once the session's queue has ended.
  private startPolling() {
    if (this.pollSub || this.board?.session?.queueStatus === 'ended') return;
    this.pollSub = interval(this.POLL_MS).pipe(
      switchMap(() => this.hp.getPlayerQueue(this.id).pipe(catchError(() => EMPTY))),
    ).subscribe((b) => {
      this.setBoard(b);
      if (b.session.queueStatus === 'ended') this.stopPolling();
      this.cdr.detectChanges();
    });
  }

  private stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
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

  teamsFor(c: QueueCourt): { teamA: QueuePlayer[]; teamB: QueuePlayer[] } {
    return splitCourtTeams(c.players, this.board?.session?.playersPerCourt ?? 4);
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

  queueStatusLabel(): string {
    switch (this.board?.session.queueStatus) {
      case 'running': return 'Live now';
      case 'paused': return 'Paused';
      case 'ended': return 'Completed';
      default: return 'Starting soon';
    }
  }

  myRank(): number {
    const lb = this.board?.leaderboard;
    if (!lb || !this.myMemberId) return 0;
    const idx = lb.findIndex(p => p.memberId === this.myMemberId);
    return idx >= 0 ? idx + 1 : 0;
  }

  goBack() { this.router.navigate(['/player/hosted-play']); }
}
