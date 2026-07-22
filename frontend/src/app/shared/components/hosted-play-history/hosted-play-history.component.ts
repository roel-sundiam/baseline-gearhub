import {
  Component,
  OnDestroy,
  OnInit,
  Renderer2,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  HostedPlayMatchHistoryItem,
  HostedPlayService,
  IndividualStanding,
  MatchPlayer,
  PairingStanding,
} from '../../../core/services/hosted-play.service';
import { AuthService } from '../../../core/services/auth.service';

type MainTab = 'history' | 'standings';
type StandingsTab = 'individual' | 'pairs';

@Component({
  selector: 'app-hosted-play-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="history-page" [class.admin-view]="role === 'admin'">
      <div class="page-shell">
        <header class="topbar">
          <button
            type="button"
            class="back-button"
            (click)="goBack()"
            [attr.aria-label]="role === 'admin' ? 'Back to hosted play management' : 'Back to hosted play'"
          >
            <span aria-hidden="true">&larr;</span>
          </button>
          <div class="topbar-copy">
            <span class="topbar-eyebrow">Hosted play records</span>
            <span class="topbar-title">
              {{ role === 'admin' ? 'Club records' : 'History & standings' }}
            </span>
          </div>
          <span class="archive-pill">
            <span class="archive-dot"></span>
            All time
          </span>
        </header>

        <section class="history-hero">
          <div class="hero-copy">
            <span class="eyebrow">
              <i class="fas fa-trophy" aria-hidden="true"></i>
              Club competition
            </span>
            <h1>Every match tells the story.</h1>
            <p>
              Review completed games, follow the club leaderboard, and see which
              partnerships are building momentum.
            </p>
          </div>

          <div class="hero-stats" aria-label="Hosted play record summary">
            <article class="hero-stat hero-stat-primary">
              <span class="stat-icon"><i class="fas fa-flag-checkered" aria-hidden="true"></i></span>
              <strong>{{ loadingMatches() && total() === 0 ? '—' : total() }}</strong>
              <span>Recorded matches</span>
            </article>
            <article class="hero-stat">
              <span class="stat-icon"><i class="fas fa-users" aria-hidden="true"></i></span>
              <strong>{{ loadingStandings() ? '—' : individuals().length }}</strong>
              <span>Ranked players</span>
            </article>
            @if (role === 'player') {
              <article class="hero-stat">
                <span class="stat-icon"><i class="fas fa-medal" aria-hidden="true"></i></span>
                <strong>{{ loadingStandings() ? '—' : (myRank() ? '#' + myRank() : '—') }}</strong>
                <span>My club rank</span>
              </article>
              <article class="hero-stat">
                <span class="stat-icon"><i class="fas fa-chart-line" aria-hidden="true"></i></span>
                <strong>{{ loadingStandings() ? '—' : winPercentage(myStanding()?.winPct) + '%' }}</strong>
                <span>My win rate</span>
              </article>
            } @else {
              <article class="hero-stat">
                <span class="stat-icon"><i class="fas fa-user-group" aria-hidden="true"></i></span>
                <strong>{{ loadingStandings() ? '—' : pairings().length }}</strong>
                <span>Ranked pairings</span>
              </article>
              <article class="hero-stat">
                <span class="stat-icon"><i class="fas fa-chart-line" aria-hidden="true"></i></span>
                <strong>{{ loadingStandings() ? '—' : winPercentage(individuals()[0]?.winPct) + '%' }}</strong>
                <span>Top win rate</span>
              </article>
            }
          </div>
        </section>

        <nav class="view-tabs" aria-label="History sections">
          <button
            type="button"
            class="view-tab"
            [class.active]="tab() === 'history'"
            [attr.aria-current]="tab() === 'history' ? 'page' : null"
            (click)="tab.set('history')"
          >
            <span class="tab-icon"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i></span>
            <span>
              <strong>Match history</strong>
              <small>Recent club results</small>
            </span>
            <span class="tab-count">{{ total() }}</span>
          </button>
          <button
            type="button"
            class="view-tab"
            [class.active]="tab() === 'standings'"
            [attr.aria-current]="tab() === 'standings' ? 'page' : null"
            (click)="tab.set('standings')"
          >
            <span class="tab-icon"><i class="fas fa-ranking-star" aria-hidden="true"></i></span>
            <span>
              <strong>Standings</strong>
              <small>Players and pairings</small>
            </span>
            <span class="tab-count">{{ individuals().length }}</span>
          </button>
        </nav>

        <main class="page-content">
          @if (tab() === 'history') {
            <section class="content-section" aria-labelledby="history-title">
              <div class="section-heading">
                <div>
                  <span class="section-kicker">Results archive</span>
                  <h2 id="history-title">Match history</h2>
                  <p>{{ historyRangeLabel() }}</p>
                </div>
                @if (!loadingMatches() && matches().length > 0) {
                  <span class="section-status">
                    <span></span>
                    Newest first
                  </span>
                }
              </div>

              @if (loadingMatches()) {
                <div class="state-card state-card-loading" aria-live="polite">
                  <span class="loading-spinner" aria-hidden="true"></span>
                  <h3>Loading match history</h3>
                  <p>Bringing in the latest completed games...</p>
                </div>
              } @else if (matchesError()) {
                <div class="state-card state-card-error">
                  <span class="state-icon"><i class="fas fa-cloud-arrow-down" aria-hidden="true"></i></span>
                  <h3>Match history is unavailable</h3>
                  <p>{{ matchesError() }}</p>
                  <button type="button" class="state-action" (click)="loadMatches(page())">
                    Try again
                  </button>
                </div>
              } @else if (matches().length === 0) {
                <div class="state-card">
                  <span class="state-icon"><i class="fas fa-table-tennis-paddle-ball" aria-hidden="true"></i></span>
                  <h3>No matches recorded yet</h3>
                  <p>Completed hosted-play games will appear here with teams, scores, and winners.</p>
                  <button type="button" class="state-action" (click)="goBack()">
                    Browse hosted play
                  </button>
                </div>
              } @else {
                <div class="match-grid">
                  @for (match of matches(); track match._id) {
                    <article
                      class="match-card"
                      [class.my-match]="isMyMatch(match)"
                      [attr.aria-label]="matchAriaLabel(match)"
                    >
                      <header class="match-card-header">
                        <div class="match-date">
                          <span class="date-tile">
                            <strong>{{ match.finishedAt | date:'dd' }}</strong>
                            <small>{{ match.finishedAt | date:'MMM' }}</small>
                          </span>
                          <span>
                            <strong>{{ match.finishedAt | date:'EEEE' }}</strong>
                            <small>{{ match.finishedAt | date:'h:mm a' }}</small>
                          </span>
                        </div>
                        <div class="match-badges">
                          @if (playerOutcome(match); as outcome) {
                            <span class="outcome-pill" [class.outcome-loss]="outcome === 'Loss'">
                              {{ outcome === 'Win' ? 'Your win' : 'Your loss' }}
                            </span>
                          }
                          <span class="court-pill">Court {{ match.courtNumber }}</span>
                        </div>
                      </header>

                      <div class="session-copy">
                        <span class="sport-label">{{ sportLabel(match.session?.sport) }}</span>
                        @if (role === 'admin' && match.session) {
                          <button
                            type="button"
                            class="session-link"
                            (click)="openSession(match.sessionId)"
                          >
                            {{ match.session.title }}
                          </button>
                        } @else {
                          <h3>{{ match.session?.title || 'Hosted play session' }}</h3>
                        }
                        <p>
                          <i class="fas fa-location-dot" aria-hidden="true"></i>
                          {{ match.session?.venue || 'Club venue' }}
                        </p>
                      </div>

                      <div class="matchup">
                        <div class="team-row" [class.winner]="match.winnerTeam === 1">
                          <span class="team-marker">A</span>
                          <div class="team-copy">
                            <span>Team A</span>
                            <strong>{{ teamNames(match.team1) }}</strong>
                          </div>
                          @if (hasScore(match)) {
                            <strong class="team-score">{{ match.team1Score }}</strong>
                          } @else if (match.winnerTeam === 1) {
                            <span class="winner-label"><i class="fas fa-trophy" aria-hidden="true"></i> Won</span>
                          } @else {
                            <span class="no-score">—</span>
                          }
                        </div>

                        <div class="versus-line"><span>vs</span></div>

                        <div class="team-row" [class.winner]="match.winnerTeam === 2">
                          <span class="team-marker team-marker-two">B</span>
                          <div class="team-copy">
                            <span>Team B</span>
                            <strong>{{ teamNames(match.team2) }}</strong>
                          </div>
                          @if (hasScore(match)) {
                            <strong class="team-score">{{ match.team2Score }}</strong>
                          } @else if (match.winnerTeam === 2) {
                            <span class="winner-label"><i class="fas fa-trophy" aria-hidden="true"></i> Won</span>
                          } @else {
                            <span class="no-score">—</span>
                          }
                        </div>
                      </div>

                      <footer class="match-card-footer">
                        <span>
                          <i class="fas fa-user-group" aria-hidden="true"></i>
                          {{ matchFormat(match) }}
                        </span>
                        @if (!hasScore(match)) {
                          <span>Result saved without a score</span>
                        } @else {
                          <span class="final-score-label">Final {{ match.team1Score }}–{{ match.team2Score }}</span>
                        }
                      </footer>
                    </article>
                  }
                </div>

                @if (totalPages() > 1) {
                  <nav class="pagination" aria-label="Match history pages">
                    <button
                      type="button"
                      class="page-button"
                      (click)="loadMatches(page() - 1)"
                      [disabled]="page() <= 1 || loadingMatches()"
                    >
                      <span aria-hidden="true">&larr;</span>
                      Previous
                    </button>
                    <div class="page-progress">
                      <span>Page {{ page() }} of {{ totalPages() }}</span>
                      <div class="page-track" aria-hidden="true">
                        <span [style.width.%]="(page() / totalPages()) * 100"></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="page-button"
                      (click)="loadMatches(page() + 1)"
                      [disabled]="page() >= totalPages() || loadingMatches()"
                    >
                      Next
                      <span aria-hidden="true">&rarr;</span>
                    </button>
                  </nav>
                }
              }
            </section>
          } @else {
            <section class="content-section" aria-labelledby="standings-title">
              <div class="section-heading standings-heading">
                <div>
                  <span class="section-kicker">Club leaderboard</span>
                  <h2 id="standings-title">Standings</h2>
                  <p>Decided matches ranked by wins, win rate, and games played.</p>
                </div>
                <div class="standings-tabs" aria-label="Standings type">
                  <button
                    type="button"
                    [class.active]="standingsTab() === 'individual'"
                    (click)="standingsTab.set('individual')"
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    [class.active]="standingsTab() === 'pairs'"
                    (click)="standingsTab.set('pairs')"
                  >
                    Pairs
                  </button>
                </div>
              </div>

              @if (loadingStandings()) {
                <div class="state-card state-card-loading" aria-live="polite">
                  <span class="loading-spinner" aria-hidden="true"></span>
                  <h3>Loading standings</h3>
                  <p>Calculating the latest player and pairing records...</p>
                </div>
              } @else if (standingsError()) {
                <div class="state-card state-card-error">
                  <span class="state-icon"><i class="fas fa-chart-simple" aria-hidden="true"></i></span>
                  <h3>Standings are unavailable</h3>
                  <p>{{ standingsError() }}</p>
                  <button type="button" class="state-action" (click)="loadStandings()">
                    Try again
                  </button>
                </div>
              } @else if (standingsTab() === 'individual') {
                @if (role === 'player' && myStanding(); as me) {
                  <article class="my-standing-card">
                    <div class="my-rank">
                      <span>My rank</span>
                      <strong>#{{ myRank() }}</strong>
                    </div>
                    <span class="standing-avatar my-avatar">{{ initials(me.memberName) }}</span>
                    <div class="my-standing-copy">
                      <span class="you-label">Your performance</span>
                      <h3>{{ me.memberName }}</h3>
                      <p>{{ me.wins }} wins · {{ me.losses }} losses · {{ me.gamesPlayed }} games</p>
                    </div>
                    <div class="my-rate">
                      <strong>{{ winPercentage(me.winPct) }}%</strong>
                      <span>Win rate</span>
                      <div class="mini-progress" aria-hidden="true">
                        <span [style.width.%]="winPercentage(me.winPct)"></span>
                      </div>
                    </div>
                  </article>
                }

                @if (individuals().length === 0) {
                  <div class="state-card">
                    <span class="state-icon"><i class="fas fa-ranking-star" aria-hidden="true"></i></span>
                    <h3>No ranked players yet</h3>
                    <p>Standings begin once a hosted-play match has a decided winner.</p>
                  </div>
                } @else {
                  <div class="standings-list">
                    <div class="standing-table-head" aria-hidden="true">
                      <span>Rank</span>
                      <span>Player</span>
                      <span>Record</span>
                      <span>Win rate</span>
                    </div>
                    @for (row of individuals(); track row.memberId; let index = $index) {
                      <article
                        class="standing-row"
                        [class.is-me]="isMe(row.memberId)"
                        [class.rank-first]="index === 0"
                        [class.rank-second]="index === 1"
                        [class.rank-third]="index === 2"
                      >
                        <div class="rank-badge">
                          @if (index < 3) {
                            <i class="fas fa-medal" aria-hidden="true"></i>
                          }
                          <strong>{{ index + 1 }}</strong>
                        </div>
                        <div class="standing-identity">
                          <span class="standing-avatar">{{ initials(row.memberName) }}</span>
                          <div>
                            <strong>{{ row.memberName || 'Player' }}</strong>
                            <span>
                              {{ row.gamesPlayed }} {{ row.gamesPlayed === 1 ? 'game' : 'games' }}
                              @if (isMe(row.memberId)) { <em>You</em> }
                            </span>
                          </div>
                        </div>
                        <div class="standing-record">
                          <span><strong>{{ row.wins }}</strong><small>Wins</small></span>
                          <span><strong>{{ row.losses }}</strong><small>Losses</small></span>
                        </div>
                        <div class="standing-rate">
                          <strong>{{ winPercentage(row.winPct) }}%</strong>
                          <span class="rate-track" aria-hidden="true">
                            <span [style.width.%]="winPercentage(row.winPct)"></span>
                          </span>
                        </div>
                      </article>
                    }
                  </div>
                }
              } @else {
                @if (pairings().length === 0) {
                  <div class="state-card">
                    <span class="state-icon"><i class="fas fa-user-group" aria-hidden="true"></i></span>
                    <h3>No ranked pairs yet</h3>
                    <p>Doubles pairings appear after both partners complete a decided match together.</p>
                  </div>
                } @else {
                  <div class="standings-list">
                    <div class="standing-table-head" aria-hidden="true">
                      <span>Rank</span>
                      <span>Pairing</span>
                      <span>Record</span>
                      <span>Win rate</span>
                    </div>
                    @for (row of pairings(); track row.memberIds.join('|'); let index = $index) {
                      <article
                        class="standing-row"
                        [class.is-me]="pairIncludesMe(row)"
                        [class.rank-first]="index === 0"
                        [class.rank-second]="index === 1"
                        [class.rank-third]="index === 2"
                      >
                        <div class="rank-badge">
                          @if (index < 3) {
                            <i class="fas fa-medal" aria-hidden="true"></i>
                          }
                          <strong>{{ index + 1 }}</strong>
                        </div>
                        <div class="standing-identity">
                          <span class="pair-avatars" aria-hidden="true">
                            @for (player of row.players.slice(0, 2); track player.memberId) {
                              <span class="standing-avatar">{{ initials(player.memberName) }}</span>
                            }
                          </span>
                          <div>
                            <strong>{{ pairingNames(row) }}</strong>
                            <span>
                              {{ row.gamesPlayed }} {{ row.gamesPlayed === 1 ? 'game' : 'games' }} together
                              @if (pairIncludesMe(row)) { <em>Your pair</em> }
                            </span>
                          </div>
                        </div>
                        <div class="standing-record">
                          <span><strong>{{ row.wins }}</strong><small>Wins</small></span>
                          <span><strong>{{ row.losses }}</strong><small>Losses</small></span>
                        </div>
                        <div class="standing-rate">
                          <strong>{{ winPercentage(row.winPct) }}%</strong>
                          <span class="rate-track" aria-hidden="true">
                            <span [style.width.%]="winPercentage(row.winPct)"></span>
                          </span>
                        </div>
                      </article>
                    }
                  </div>
                }
              }
            </section>
          }
        </main>

        <footer class="page-footer">
          <i class="fas fa-shield-halved" aria-hidden="true"></i>
          Results include completed hosted-play matches for your current club.
        </footer>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --page-bg: #0c1a11;
      --page-bg-deep: #07110c;
      --surface: #172d24;
      --surface-raised: #1b3329;
      --surface-soft: rgba(255, 255, 255, 0.045);
      --surface-hover: #213a30;
      --border: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.14);
      --text: #ffffff;
      --muted: rgba(241, 248, 243, 0.6);
      --muted-soft: rgba(241, 248, 243, 0.4);
      --accent: #a3e635;
      --accent-hover: #b8f040;
      --accent-ink: #102000;
      --blue: #52b9f3;
      --danger: #fb7185;
      display: block;
      width: 100%;
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        'Helvetica Neue', Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    button {
      font: inherit;
      -webkit-tap-highlight-color: transparent;
    }

    button:focus-visible {
      outline: 3px solid rgba(163, 230, 53, 0.72);
      outline-offset: 3px;
    }

    .history-page {
      min-height: calc(100dvh - 60px);
      background:
        radial-gradient(circle at 8% -8%, rgba(163, 230, 53, 0.15), transparent 31rem),
        radial-gradient(circle at 100% 25%, rgba(82, 185, 243, 0.08), transparent 30rem),
        linear-gradient(180deg, #0f2117 0%, var(--page-bg) 34rem, var(--page-bg-deep) 100%);
    }

    .page-shell {
      width: min(100%, 1180px);
      min-height: calc(100dvh - 60px);
      margin: 0 auto;
      padding: 1rem 1rem calc(6rem + env(safe-area-inset-bottom));
    }

    .topbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .back-button {
      display: grid;
      flex: 0 0 auto;
      width: 42px;
      height: 42px;
      padding: 0;
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      place-items: center;
      color: rgba(255, 255, 255, 0.84);
      background: rgba(255, 255, 255, 0.055);
      font-size: 1.2rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.16s, border-color 0.16s, transform 0.16s;
    }

    .back-button:hover {
      border-color: rgba(255, 255, 255, 0.22);
      background: rgba(255, 255, 255, 0.095);
    }

    .back-button:active {
      transform: scale(0.96);
    }

    .topbar-copy {
      display: flex;
      min-width: 0;
      flex: 1;
      flex-direction: column;
    }

    .topbar-eyebrow {
      color: var(--accent);
      font-size: 0.63rem;
      font-weight: 850;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .topbar-title {
      overflow: hidden;
      color: var(--text);
      font-size: 0.95rem;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .archive-pill,
    .section-status {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.4rem;
      min-height: 30px;
      padding: 0.32rem 0.65rem;
      border: 1px solid rgba(163, 230, 53, 0.18);
      border-radius: 999px;
      color: #cef787;
      background: rgba(163, 230, 53, 0.07);
      font-size: 0.65rem;
      font-weight: 800;
    }

    .archive-dot,
    .section-status > span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 4px rgba(163, 230, 53, 0.1);
    }

    .history-hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      padding: 1.25rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 22px;
      background:
        linear-gradient(135deg, rgba(34, 65, 51, 0.95), rgba(13, 35, 24, 0.98));
      box-shadow: 0 20px 54px rgba(0, 0, 0, 0.28);
    }

    .hero-copy {
      position: relative;
      z-index: 1;
    }

    .eyebrow,
    .section-kicker {
      display: inline-flex;
      align-items: center;
      gap: 0.42rem;
      color: var(--accent);
      font-size: 0.68rem;
      font-weight: 850;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .hero-copy h1 {
      max-width: 620px;
      margin: 0.55rem 0 0;
      color: #fff;
      font-size: clamp(1.85rem, 7.7vw, 3.7rem);
      font-weight: 900;
      letter-spacing: -0.05em;
      line-height: 0.98;
    }

    .hero-copy p {
      max-width: 590px;
      margin: 0.8rem 0 0;
      color: rgba(255, 255, 255, 0.68);
      font-size: 0.86rem;
      line-height: 1.55;
    }

    .hero-stats {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
      margin-top: 1.2rem;
    }

    .hero-stat {
      position: relative;
      display: flex;
      min-height: 96px;
      flex-direction: column;
      justify-content: flex-end;
      padding: 0.8rem;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 15px;
      background: rgba(5, 20, 12, 0.38);
      backdrop-filter: blur(12px);
    }

    .hero-stat-primary {
      border-color: rgba(163, 230, 53, 0.18);
      background: rgba(163, 230, 53, 0.07);
    }

    .stat-icon {
      position: absolute;
      top: 0.65rem;
      right: 0.65rem;
      display: grid;
      width: 28px;
      height: 28px;
      border-radius: 9px;
      place-items: center;
      color: rgba(163, 230, 53, 0.8);
      background: rgba(163, 230, 53, 0.09);
      font-size: 0.68rem;
    }

    .hero-stat strong {
      color: #fff;
      font-size: 1.45rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      letter-spacing: -0.04em;
      line-height: 1;
    }

    .hero-stat > span:last-child {
      margin-top: 0.3rem;
      color: var(--muted);
      font-size: 0.64rem;
      font-weight: 700;
    }

    .view-tabs {
      position: sticky;
      z-index: 20;
      top: 60px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
      margin: 0.9rem 0 0;
      padding: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 17px;
      background: rgba(12, 26, 17, 0.92);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(16px);
    }

    .view-tab {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      min-height: 52px;
      padding: 0.45rem 0.55rem;
      border: 1px solid transparent;
      border-radius: 12px;
      color: var(--muted);
      background: transparent;
      text-align: left;
      cursor: pointer;
      transition: color 0.16s, background 0.16s, border-color 0.16s;
    }

    .view-tab:hover {
      color: rgba(255, 255, 255, 0.82);
      background: rgba(255, 255, 255, 0.04);
    }

    .view-tab.active {
      border-color: rgba(163, 230, 53, 0.18);
      color: #fff;
      background: rgba(163, 230, 53, 0.085);
    }

    .view-tab > span:nth-child(2) {
      display: flex;
      min-width: 0;
      flex-direction: column;
    }

    .view-tab strong {
      overflow: hidden;
      font-size: 0.72rem;
      font-weight: 850;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .view-tab small {
      display: none;
      margin-top: 0.08rem;
      color: var(--muted-soft);
      font-size: 0.59rem;
      font-weight: 650;
    }

    .tab-icon {
      display: none;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      place-items: center;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.04);
      font-size: 0.72rem;
    }

    .view-tab.active .tab-icon {
      color: var(--accent);
      background: rgba(163, 230, 53, 0.1);
    }

    .tab-count {
      display: grid;
      min-width: 23px;
      height: 23px;
      padding: 0 0.28rem;
      border-radius: 999px;
      place-items: center;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.055);
      font-size: 0.58rem;
      font-variant-numeric: tabular-nums;
      font-weight: 850;
    }

    .view-tab.active .tab-count {
      color: var(--accent-ink);
      background: var(--accent);
    }

    .page-content {
      margin-top: 1.25rem;
    }

    .section-heading {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.8rem;
      padding: 0 0.15rem;
    }

    .section-heading h2 {
      margin: 0.2rem 0 0;
      color: #fff;
      font-size: 1.35rem;
      font-weight: 900;
      letter-spacing: -0.035em;
    }

    .section-heading p {
      margin: 0.25rem 0 0;
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.45;
    }

    .section-status {
      display: none;
      border-color: var(--border);
      color: var(--muted);
      background: var(--surface-soft);
    }

    .section-status > span {
      box-shadow: none;
    }

    .match-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.75rem;
    }

    .match-card {
      position: relative;
      overflow: hidden;
      padding: 0.95rem;
      border: 1px solid var(--border);
      border-radius: 18px;
      background:
        linear-gradient(145deg, rgba(163, 230, 53, 0.025), transparent 46%),
        var(--surface);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.2);
    }

    .match-card::before {
      position: absolute;
      top: 0;
      left: 0.95rem;
      width: 42px;
      height: 3px;
      border-radius: 0 0 4px 4px;
      content: '';
      background: rgba(163, 230, 53, 0.8);
    }

    .match-card.my-match {
      border-color: rgba(163, 230, 53, 0.18);
    }

    .match-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      padding-bottom: 0.72rem;
      border-bottom: 1px solid var(--border);
    }

    .match-date {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 0.55rem;
    }

    .match-date > span:last-child {
      display: flex;
      min-width: 0;
      flex-direction: column;
    }

    .match-date > span:last-child strong {
      overflow: hidden;
      color: rgba(255, 255, 255, 0.84);
      font-size: 0.69rem;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .match-date > span:last-child small {
      margin-top: 0.06rem;
      color: var(--muted-soft);
      font-size: 0.59rem;
      font-weight: 650;
    }

    .date-tile {
      display: grid;
      flex: 0 0 auto;
      width: 38px;
      height: 42px;
      grid-template-rows: 1fr auto;
      padding: 0.28rem 0.2rem;
      border: 1px solid rgba(163, 230, 53, 0.15);
      border-radius: 10px;
      place-items: center;
      color: var(--accent);
      background: rgba(163, 230, 53, 0.07);
    }

    .date-tile strong {
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      line-height: 1;
    }

    .date-tile small {
      font-size: 0.48rem;
      font-weight: 850;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .match-badges {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.3rem;
    }

    .court-pill,
    .outcome-pill {
      display: inline-flex;
      align-items: center;
      min-height: 25px;
      padding: 0.28rem 0.48rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.035);
      font-size: 0.56rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .outcome-pill {
      border-color: rgba(163, 230, 53, 0.18);
      color: #cef787;
      background: rgba(163, 230, 53, 0.07);
    }

    .outcome-pill.outcome-loss {
      border-color: rgba(251, 113, 133, 0.16);
      color: #fda4af;
      background: rgba(251, 113, 133, 0.06);
    }

    .session-copy {
      margin-top: 0.72rem;
    }

    .sport-label {
      color: var(--accent);
      font-size: 0.56rem;
      font-weight: 850;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .session-copy h3,
    .session-link {
      display: block;
      margin: 0.12rem 0 0;
      color: #fff;
      font-size: 0.88rem;
      font-weight: 850;
      letter-spacing: -0.015em;
      line-height: 1.3;
    }

    .session-link {
      padding: 0;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }

    .session-link:hover {
      color: var(--accent);
      text-decoration: underline;
    }

    .session-copy p {
      display: flex;
      align-items: center;
      gap: 0.32rem;
      margin: 0.22rem 0 0;
      color: var(--muted-soft);
      font-size: 0.61rem;
      font-weight: 650;
    }

    .session-copy p i {
      color: rgba(163, 230, 53, 0.65);
      font-size: 0.55rem;
    }

    .matchup {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.26rem;
      margin-top: 0.72rem;
      padding: 0.4rem;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      background: rgba(4, 16, 10, 0.28);
    }

    .team-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.55rem;
      min-height: 52px;
      padding: 0.42rem 0.5rem;
      border: 1px solid transparent;
      border-radius: 11px;
    }

    .team-row.winner {
      border-color: rgba(163, 230, 53, 0.12);
      background: rgba(163, 230, 53, 0.055);
    }

    .team-marker {
      display: grid;
      width: 29px;
      height: 29px;
      border: 1px solid rgba(163, 230, 53, 0.16);
      border-radius: 9px;
      place-items: center;
      color: var(--accent);
      background: rgba(163, 230, 53, 0.075);
      font-size: 0.6rem;
      font-weight: 900;
    }

    .team-marker-two {
      border-color: rgba(82, 185, 243, 0.17);
      color: var(--blue);
      background: rgba(82, 185, 243, 0.075);
    }

    .team-copy {
      display: flex;
      min-width: 0;
      flex-direction: column;
    }

    .team-copy span {
      color: var(--muted-soft);
      font-size: 0.53rem;
      font-weight: 750;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .team-copy strong {
      display: -webkit-box;
      overflow: hidden;
      margin-top: 0.05rem;
      color: rgba(255, 255, 255, 0.82);
      font-size: 0.67rem;
      font-weight: 750;
      line-height: 1.25;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .team-row.winner .team-copy strong {
      color: #fff;
    }

    .team-score {
      min-width: 32px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 1.35rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      letter-spacing: -0.05em;
      text-align: right;
    }

    .team-row.winner .team-score {
      color: var(--accent);
    }

    .winner-label {
      display: inline-flex;
      align-items: center;
      gap: 0.27rem;
      color: var(--accent);
      font-size: 0.58rem;
      font-weight: 850;
    }

    .no-score {
      color: var(--muted-soft);
      font-size: 0.8rem;
    }

    .versus-line {
      position: absolute;
      z-index: 2;
      top: 50%;
      left: 50%;
      display: grid;
      width: 22px;
      height: 22px;
      border: 3px solid #11261c;
      border-radius: 50%;
      place-items: center;
      color: var(--muted-soft);
      background: #1d342a;
      font-size: 0.45rem;
      font-weight: 850;
      text-transform: uppercase;
      transform: translate(-50%, -50%);
    }

    .match-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      margin-top: 0.68rem;
      color: var(--muted-soft);
      font-size: 0.57rem;
      font-weight: 650;
    }

    .match-card-footer span {
      display: inline-flex;
      align-items: center;
      gap: 0.28rem;
    }

    .final-score-label {
      color: rgba(255, 255, 255, 0.64);
      font-weight: 800;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 1rem;
      padding: 0.65rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(23, 45, 36, 0.82);
    }

    .page-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-height: 40px;
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      color: rgba(255, 255, 255, 0.78);
      background: rgba(255, 255, 255, 0.045);
      font-size: 0.66rem;
      font-weight: 800;
      cursor: pointer;
    }

    .page-button:hover:not(:disabled) {
      border-color: rgba(163, 230, 53, 0.24);
      color: var(--accent);
      background: rgba(163, 230, 53, 0.06);
    }

    .page-button:disabled {
      cursor: not-allowed;
      opacity: 0.35;
    }

    .page-progress {
      display: flex;
      min-width: 82px;
      flex-direction: column;
      gap: 0.35rem;
      color: var(--muted);
      font-size: 0.58rem;
      font-variant-numeric: tabular-nums;
      font-weight: 750;
      text-align: center;
    }

    .page-track,
    .rate-track,
    .mini-progress {
      display: block;
      overflow: hidden;
      width: 100%;
      height: 3px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
    }

    .page-track > span,
    .rate-track > span,
    .mini-progress > span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }

    .standings-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .standings-tabs {
      display: grid;
      width: 100%;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.35rem;
      padding: 0.3rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.025);
    }

    .standings-tabs button {
      min-height: 38px;
      padding: 0.45rem 0.75rem;
      border: 1px solid transparent;
      border-radius: 9px;
      color: var(--muted);
      background: transparent;
      font-size: 0.68rem;
      font-weight: 800;
      cursor: pointer;
    }

    .standings-tabs button.active {
      border-color: rgba(163, 230, 53, 0.16);
      color: var(--accent);
      background: rgba(163, 230, 53, 0.08);
    }

    .my-standing-card {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      align-items: center;
      gap: 0.7rem;
      margin-bottom: 0.8rem;
      padding: 0.85rem;
      border: 1px solid rgba(163, 230, 53, 0.2);
      border-radius: 17px;
      background:
        linear-gradient(135deg, rgba(163, 230, 53, 0.09), rgba(163, 230, 53, 0.025)),
        var(--surface);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
    }

    .my-rank {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 52px;
      min-height: 52px;
      padding: 0.35rem;
      border: 1px solid rgba(163, 230, 53, 0.18);
      border-radius: 12px;
      background: rgba(163, 230, 53, 0.07);
    }

    .my-rank span {
      color: var(--muted-soft);
      font-size: 0.48rem;
      font-weight: 750;
      text-transform: uppercase;
    }

    .my-rank strong {
      color: var(--accent);
      font-size: 1.05rem;
      font-weight: 900;
    }

    .my-standing-copy {
      min-width: 0;
    }

    .you-label {
      color: var(--accent);
      font-size: 0.52rem;
      font-weight: 850;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .my-standing-copy h3 {
      overflow: hidden;
      margin: 0.12rem 0 0;
      color: #fff;
      font-size: 0.8rem;
      font-weight: 850;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .my-standing-copy p {
      margin: 0.14rem 0 0;
      color: var(--muted);
      font-size: 0.58rem;
      font-weight: 650;
    }

    .my-rate {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 0.15rem 0.7rem;
      padding-top: 0.7rem;
      border-top: 1px solid rgba(255, 255, 255, 0.065);
    }

    .my-rate strong {
      grid-row: 1 / 3;
      color: #fff;
      font-size: 1rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
    }

    .my-rate > span:not(.mini-progress) {
      color: var(--muted-soft);
      font-size: 0.54rem;
      font-weight: 700;
    }

    .mini-progress {
      height: 4px;
    }

    .standings-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .standing-table-head {
      display: none;
    }

    .standing-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.65rem;
      padding: 0.72rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
    }

    .standing-row.is-me {
      border-color: rgba(163, 230, 53, 0.22);
      background:
        linear-gradient(90deg, rgba(163, 230, 53, 0.065), transparent 55%),
        var(--surface);
    }

    .rank-badge {
      position: relative;
      display: grid;
      width: 36px;
      height: 36px;
      border: 1px solid var(--border);
      border-radius: 11px;
      place-items: center;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.035);
    }

    .rank-badge i {
      position: absolute;
      top: -5px;
      right: -4px;
      font-size: 0.58rem;
    }

    .rank-badge strong {
      font-size: 0.72rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
    }

    .rank-first .rank-badge {
      border-color: rgba(245, 191, 66, 0.28);
      color: #f7c95e;
      background: rgba(245, 191, 66, 0.08);
    }

    .rank-second .rank-badge {
      border-color: rgba(203, 213, 225, 0.25);
      color: #d5dce6;
      background: rgba(203, 213, 225, 0.07);
    }

    .rank-third .rank-badge {
      border-color: rgba(217, 146, 91, 0.25);
      color: #e6a673;
      background: rgba(217, 146, 91, 0.07);
    }

    .standing-identity {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 0.55rem;
    }

    .standing-avatar {
      display: grid;
      flex: 0 0 auto;
      width: 35px;
      height: 35px;
      border: 1px solid rgba(163, 230, 53, 0.16);
      border-radius: 11px;
      place-items: center;
      color: var(--accent);
      background: rgba(163, 230, 53, 0.075);
      font-size: 0.58rem;
      font-weight: 900;
    }

    .my-avatar {
      width: 43px;
      height: 43px;
      border-radius: 13px;
    }

    .pair-avatars {
      display: flex;
      min-width: 55px;
      padding-left: 3px;
    }

    .pair-avatars .standing-avatar + .standing-avatar {
      margin-left: -12px;
      border-color: rgba(82, 185, 243, 0.28);
      color: var(--blue);
      background: #18352e;
    }

    .standing-identity > div {
      display: flex;
      min-width: 0;
      flex-direction: column;
    }

    .standing-identity > div > strong {
      overflow: hidden;
      color: rgba(255, 255, 255, 0.88);
      font-size: 0.69rem;
      font-weight: 800;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .standing-identity > div > span {
      overflow: hidden;
      margin-top: 0.1rem;
      color: var(--muted-soft);
      font-size: 0.54rem;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .standing-identity em {
      display: inline-flex;
      margin-left: 0.28rem;
      padding: 0.08rem 0.3rem;
      border-radius: 999px;
      color: var(--accent);
      background: rgba(163, 230, 53, 0.09);
      font-size: 0.46rem;
      font-style: normal;
      font-weight: 850;
      text-transform: uppercase;
    }

    .standing-record {
      display: grid;
      grid-column: 2 / -1;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.35rem;
      padding-top: 0.55rem;
      border-top: 1px solid rgba(255, 255, 255, 0.055);
    }

    .standing-record > span {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      color: var(--muted-soft);
    }

    .standing-record strong {
      color: rgba(255, 255, 255, 0.86);
      font-size: 0.73rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
    }

    .standing-record small {
      font-size: 0.5rem;
      font-weight: 700;
    }

    .standing-rate {
      display: flex;
      min-width: 62px;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }

    .standing-rate strong {
      color: #fff;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
    }

    .rate-track {
      width: 58px;
    }

    .state-card {
      display: flex;
      min-height: 300px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
      text-align: center;
    }

    .state-icon {
      display: grid;
      width: 54px;
      height: 54px;
      border: 1px solid rgba(163, 230, 53, 0.17);
      border-radius: 16px;
      place-items: center;
      color: var(--accent);
      background: rgba(163, 230, 53, 0.07);
      font-size: 1.05rem;
    }

    .state-card-error .state-icon {
      border-color: rgba(251, 113, 133, 0.18);
      color: #fda4af;
      background: rgba(251, 113, 133, 0.07);
    }

    .state-card h3 {
      margin: 0.85rem 0 0;
      color: #fff;
      font-size: 1rem;
      font-weight: 850;
    }

    .state-card p {
      max-width: 430px;
      margin: 0.4rem 0 0;
      color: var(--muted);
      font-size: 0.75rem;
      line-height: 1.55;
    }

    .state-action {
      min-height: 42px;
      margin-top: 1rem;
      padding: 0.58rem 0.9rem;
      border: 1px solid rgba(163, 230, 53, 0.28);
      border-radius: 10px;
      color: var(--accent-ink);
      background: var(--accent);
      font-size: 0.7rem;
      font-weight: 900;
      cursor: pointer;
    }

    .loading-spinner {
      width: 42px;
      height: 42px;
      border: 3px solid rgba(163, 230, 53, 0.14);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }

    .page-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.38rem;
      margin-top: 1.2rem;
      color: rgba(241, 248, 243, 0.32);
      font-size: 0.58rem;
      font-weight: 650;
      text-align: center;
    }

    .page-footer i {
      color: rgba(163, 230, 53, 0.45);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (min-width: 560px) {
      .page-shell {
        padding-inline: 1.4rem;
      }

      .history-hero {
        padding: 1.5rem;
      }

      .hero-stats {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .view-tab {
        padding-inline: 0.7rem;
      }

      .view-tab small,
      .tab-icon {
        display: flex;
      }

      .tab-icon {
        display: grid;
      }

      .section-status {
        display: inline-flex;
      }

      .match-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .my-standing-card {
        grid-template-columns: auto auto minmax(0, 1fr) minmax(120px, 0.55fr);
      }

      .my-rate {
        grid-column: auto;
        padding: 0 0 0 0.8rem;
        border-top: 0;
        border-left: 1px solid rgba(255, 255, 255, 0.065);
      }
    }

    @media (min-width: 769px) {
      .history-page {
        min-height: calc(100dvh - 60px);
        border-radius: 18px;
      }

      .page-shell {
        padding: 1.5rem 1.65rem 2rem;
      }

      .topbar {
        margin-bottom: 1.25rem;
      }

      .history-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.95fr);
        align-items: end;
        gap: 1.5rem;
        padding: 1.8rem;
      }

      .hero-copy p {
        font-size: 0.9rem;
      }

      .hero-stats {
        margin-top: 0;
      }

      .view-tabs {
        position: static;
        width: min(100%, 620px);
        margin-top: 1rem;
      }

      .page-content {
        margin-top: 1.5rem;
      }

      .section-heading h2 {
        font-size: 1.5rem;
      }

      .standings-heading {
        align-items: flex-end;
        flex-direction: row;
      }

      .standings-tabs {
        width: auto;
        min-width: 250px;
      }

      .standing-table-head {
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr) 150px 110px;
        gap: 0.75rem;
        padding: 0 0.85rem 0.2rem;
        color: var(--muted-soft);
        font-size: 0.55rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .standing-table-head span:nth-child(3),
      .standing-table-head span:nth-child(4) {
        text-align: right;
      }

      .standing-row {
        grid-template-columns: 42px minmax(0, 1fr) 150px 110px;
        gap: 0.75rem;
        padding: 0.8rem 0.85rem;
      }

      .standing-record {
        grid-column: auto;
        padding: 0;
        border-top: 0;
        text-align: right;
      }

      .standing-record > span {
        justify-content: flex-end;
      }

      .standing-rate {
        min-width: 100px;
      }

      .rate-track {
        width: 92px;
      }
    }

    @media (min-width: 769px) and (max-width: 980px) {
      .hero-copy h1 {
        font-size: 2.65rem;
        line-height: 1.02;
      }
    }

    @media (max-width: 380px) {
      .archive-pill {
        padding-inline: 0.5rem;
      }

      .view-tabs {
        gap: 0.3rem;
        padding: 0.35rem;
      }

      .view-tab {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .view-tab .tab-icon {
        display: none;
      }

      .hero-copy h1 {
        font-size: 1.75rem;
      }

      .match-card {
        padding-inline: 0.8rem;
      }

      .outcome-pill {
        display: none;
      }

      .page-button {
        padding-inline: 0.55rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class HostedPlayHistoryComponent implements OnInit, OnDestroy {
  private hp = inject(HostedPlayService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private renderer = inject(Renderer2);

  role: 'admin' | 'player' =
    (this.route.snapshot.data['role'] as 'admin' | 'player') ?? 'player';
  myUserId = this.auth.getUser()?.id ?? null;

  tab = signal<MainTab>('history');
  standingsTab = signal<StandingsTab>('individual');

  matches = signal<HostedPlayMatchHistoryItem[]>([]);
  total = signal(0);
  page = signal(1);
  readonly limit = 25;
  loadingMatches = signal(false);
  matchesError = signal('');
  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit)),
  );

  individuals = signal<IndividualStanding[]>([]);
  pairings = signal<PairingStanding[]>([]);
  loadingStandings = signal(false);
  standingsError = signal('');

  myStanding = computed(() => {
    if (!this.myUserId) return null;
    return (
      this.individuals().find(
        (row) => String(row.memberId) === String(this.myUserId),
      ) ?? null
    );
  });

  myRank = computed(() => {
    if (!this.myUserId) return null;
    const index = this.individuals().findIndex(
      (row) => String(row.memberId) === String(this.myUserId),
    );
    return index >= 0 ? index + 1 : null;
  });

  ngOnInit() {
    if (this.role === 'player') {
      this.renderer.addClass(document.documentElement, 'dark-player-page');
      this.renderer.addClass(document.body, 'dark-player-page');
    }
    this.loadMatches(1);
    this.loadStandings();
  }

  ngOnDestroy() {
    if (this.role === 'player') {
      this.renderer.removeClass(document.documentElement, 'dark-player-page');
      this.renderer.removeClass(document.body, 'dark-player-page');
    }
  }

  loadMatches(page: number) {
    if (page < 1) return;
    this.loadingMatches.set(true);
    this.matchesError.set('');
    const call =
      this.role === 'admin'
        ? this.hp.listMatchHistory({ page, limit: this.limit })
        : this.hp.listPlayerMatchHistory({ page, limit: this.limit });
    call.subscribe({
      next: (response) => {
        this.matches.set(response.matches);
        this.total.set(response.total);
        this.page.set(response.page);
        this.loadingMatches.set(false);
      },
      error: () => {
        this.loadingMatches.set(false);
        this.matchesError.set(
          'We could not retrieve the latest results. Check your connection and try again.',
        );
      },
    });
  }

  loadStandings() {
    this.loadingStandings.set(true);
    this.standingsError.set('');
    const call =
      this.role === 'admin'
        ? this.hp.getStandings()
        : this.hp.getPlayerStandings();
    call.subscribe({
      next: (response) => {
        this.individuals.set(response.individuals);
        this.pairings.set(response.pairings);
        this.loadingStandings.set(false);
      },
      error: () => {
        this.loadingStandings.set(false);
        this.standingsError.set(
          'We could not retrieve the leaderboard. Check your connection and try again.',
        );
      },
    });
  }

  teamNames(team: MatchPlayer[]): string {
    return team.length
      ? team.map((player) => player.memberName || 'Player').join(' & ')
      : 'No opponent recorded';
  }

  pairingNames(pairing: PairingStanding): string {
    return pairing.players
      .map((player) => player.memberName || 'Player')
      .join(' & ');
  }

  initials(name?: string | null): string {
    const parts = (name || 'Player')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'P';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  sportLabel(sport?: string | null): string {
    if (!sport) return 'Hosted play';
    return sport
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  matchFormat(match: HostedPlayMatchHistoryItem): string {
    const largestTeam = Math.max(match.team1.length, match.team2.length);
    return largestTeam > 1 ? 'Doubles' : 'Singles';
  }

  hasScore(match: HostedPlayMatchHistoryItem): boolean {
    return match.team1Score !== null && match.team2Score !== null;
  }

  isMe(memberId?: string | null): boolean {
    return !!(
      memberId &&
      this.myUserId &&
      String(memberId) === String(this.myUserId)
    );
  }

  pairIncludesMe(pairing: PairingStanding): boolean {
    return !!(
      this.myUserId &&
      pairing.memberIds.some(
        (memberId) => String(memberId) === String(this.myUserId),
      )
    );
  }

  private myTeam(match: HostedPlayMatchHistoryItem): 1 | 2 | null {
    if (!this.myUserId) return null;
    if (match.team1.some((player) => this.isMe(player.memberId))) return 1;
    if (match.team2.some((player) => this.isMe(player.memberId))) return 2;
    return null;
  }

  isMyMatch(match: HostedPlayMatchHistoryItem): boolean {
    return this.role === 'player' && this.myTeam(match) !== null;
  }

  playerOutcome(match: HostedPlayMatchHistoryItem): 'Win' | 'Loss' | '' {
    if (this.role !== 'player' || !match.winnerTeam) return '';
    const team = this.myTeam(match);
    if (!team) return '';
    return team === match.winnerTeam ? 'Win' : 'Loss';
  }

  winPercentage(rate?: number | null): number {
    if (typeof rate !== 'number' || !Number.isFinite(rate)) return 0;
    return Math.round(Math.max(0, Math.min(1, rate)) * 100);
  }

  historyRangeLabel(): string {
    if (this.loadingMatches() && !this.total()) return 'Loading club results...';
    if (!this.total()) return 'No recorded results yet';
    const start = (this.page() - 1) * this.limit + 1;
    const end = Math.min(this.page() * this.limit, this.total());
    return `Showing ${start}–${end} of ${this.total()} recorded matches`;
  }

  matchAriaLabel(match: HostedPlayMatchHistoryItem): string {
    const score = this.hasScore(match)
      ? `${match.team1Score} to ${match.team2Score}`
      : 'score not recorded';
    return `${match.session?.title || 'Hosted play session'}, ${this.teamNames(match.team1)} versus ${this.teamNames(match.team2)}, ${score}`;
  }

  goBack() {
    this.router.navigate([
      this.role === 'admin' ? '/admin/hosted-play' : '/player/hosted-play',
    ]);
  }

  openSession(sessionId: string) {
    if (this.role === 'admin') {
      this.router.navigate(['/admin/hosted-play', sessionId, 'queue']);
    }
  }
}
