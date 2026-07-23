import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subscription, interval } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import {
  HostedPlayService,
  QueueBoard,
  QueuePlayer,
  splitCourtTeams,
} from '../../core/services/hosted-play.service';

type PageState =
  | 'loading'
  | 'ready'
  | 'invalid_token'
  | 'session_ended'
  | 'error';

type LiveScore = {
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2 | null;
  serverNumber: 1 | 2 | null;
  servingPlayerId: string | null;
  canUndo: boolean;
};

const EMPTY_LIVE_SCORE: LiveScore = {
  team1Score: 0,
  team2Score: 0,
  servingTeam: null,
  serverNumber: null,
  servingPlayerId: null,
  canUndo: false,
};

@Component({
  selector: 'app-umpire-scoring',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="umpire-viewport" [class.active]="isMobileFit">
    <div class="umpire-page" #pageEl [class.fit-canvas]="isMobileFit">
      @if (state === 'loading') {
        <section class="state-screen" aria-live="polite">
          <div class="state-visual state-visual-loading">
            <span class="loading-ring"></span>
            <i class="fas fa-table-tennis-paddle-ball"></i>
          </div>
          <p class="state-eyebrow">Umpire console</p>
          <h1>Preparing the court</h1>
          <p>Loading players and the latest score...</p>
        </section>
      } @else if (state === 'invalid_token') {
        <section class="state-screen">
          <div class="state-visual state-visual-error">
            <i class="fas fa-link-slash"></i>
          </div>
          <p class="state-eyebrow">Access unavailable</p>
          <h1>This link is no longer valid</h1>
          <p>Ask the club administrator to create a fresh umpire link for this court.</p>
        </section>
      } @else if (state === 'session_ended') {
        <section class="state-screen">
          <div class="state-visual state-visual-complete">
            <i class="fas fa-flag-checkered"></i>
          </div>
          <p class="state-eyebrow">Session complete</p>
          <h1>Scoring has ended</h1>
          <p>This hosted-play session has concluded. No more scores can be recorded.</p>
        </section>
      } @else if (state === 'error') {
        <section class="state-screen">
          <div class="state-visual state-visual-error">
            <i class="fas fa-triangle-exclamation"></i>
          </div>
          <p class="state-eyebrow">Connection issue</p>
          <h1>We could not load this court</h1>
          <p>{{ error || 'Check your connection and try again.' }}</p>
          <button type="button" class="retry-button" (click)="load()">
            <i class="fas fa-rotate-right"></i>
            Try again
          </button>
        </section>
      } @else if (board) {
        <main class="score-shell">
          <header class="score-header">
            <div class="event-identity">
              <span class="brand-mark" aria-hidden="true">
                @if (board.session.venueLogo) {
                  <img [src]="board.session.venueLogo" class="brand-logo-img" alt="" />
                } @else {
                  <i class="fas fa-table-tennis-paddle-ball"></i>
                }
              </span>
              <div class="event-copy">
                <span class="eyebrow">Umpire console</span>
                <h1>{{ board.session.title }}</h1>
              </div>
            </div>

            <div
              class="sync-status"
              [class.sync-status-busy]="busy"
              role="status"
              aria-live="polite"
            >
              <span class="status-dot"></span>
              {{ busy ? 'Saving' : 'Live' }}
            </div>
          </header>

          <section class="match-overview" aria-label="Match information">
            <div class="court-identity">
              <span>Now scoring</span>
              <strong>Court {{ courtNumber }}</strong>
            </div>
            <div class="match-meta">
              <span class="meta-pill">
                <i class="fas fa-table-tennis-paddle-ball"></i>
                {{ sportLabel() }}
              </span>
              <span class="meta-pill">
                <i class="fas fa-user-group"></i>
                {{ formatLabel() }}
              </span>
              @if (board.session.sport === 'pickleball' && board.session.scoreTarget) {
                <span class="meta-pill meta-pill-accent">
                  First to {{ board.session.scoreTarget }}
                </span>
                @if (board.session.winByTwo !== false) {
                  <span class="meta-pill meta-pill-accent">Win by 2</span>
                }
              }
            </div>
          </section>

          @if (successMessage) {
            <div class="notice notice-success" role="status">
              <i class="fas fa-circle-check"></i>
              <span>{{ successMessage }}</span>
              <button
                type="button"
                (click)="dismissSuccess()"
                aria-label="Dismiss notification"
              >
                <i class="fas fa-xmark"></i>
              </button>
            </div>
          }

          @if (actionError) {
            <div class="notice notice-error" role="alert">
              <i class="fas fa-circle-exclamation"></i>
              <span>{{ actionError }}</span>
              <button
                type="button"
                (click)="actionError = ''"
                aria-label="Dismiss error"
              >
                <i class="fas fa-xmark"></i>
              </button>
            </div>
          }

          @if (!court || court.players.length === 0) {
            <section class="waiting-card">
              <div class="waiting-visual" aria-hidden="true">
                <span class="court-line court-line-one"></span>
                <span class="court-line court-line-two"></span>
                <i class="fas fa-users"></i>
              </div>
              <span class="waiting-label">Court {{ courtNumber }}</span>
              <h2>Waiting for the next match</h2>
              <p>Players will appear here automatically when they are assigned to this court.</p>
              <div class="waiting-status">
                <span></span>
                Checking for players
              </div>
            </section>
          } @else {
            @let teams = teamsFor();
            @let live = court.liveScore ?? emptyLiveScore;

            <section class="scoreboard-heading">
              <div>
                <span class="eyebrow">Current game</span>
                <h2>{{ scoreHeading(live) }}</h2>
                @if (live.servingTeam && live.servingPlayerId) {
                  <span class="score-call">{{ scoreCall(live, teams) }}</span>
                }
              </div>
              @if (live.servingTeam) {
                <button
                  type="button"
                  class="undo-btn"
                  [disabled]="busy || !live.canUndo"
                  (click)="undo()"
                >
                  <i class="fas fa-rotate-left"></i>
                  Undo
                </button>
              }
            </section>

            @if (isGameDecided(live)) {
              <div class="game-decided-banner">
                <i class="fas fa-trophy" aria-hidden="true"></i>
                <div class="game-decided-copy">
                  <strong>{{ winningTeamName(live, teams.teamA, teams.teamB) }} has won this game</strong>
                  <span>{{ scoreCall(live, teams) }} reaches the target — finish to record it.</span>
                </div>
                <button
                  type="button"
                  class="game-decided-finish-btn"
                  [disabled]="busy"
                  (click)="openFinishConfirmation()"
                >
                  Finish Now
                </button>
              </div>
            } @else if (live.servingTeam && live.servingPlayerId) {
              <div class="now-serving-banner">
                <span class="now-serving-label">
                  <span class="now-serving-pulse" aria-hidden="true"></span>
                  Now Serving
                </span>
                <strong class="now-serving-name">{{ servingPlayerName(live, teams) }}</strong>
              </div>
            }

            <section class="team-grid" aria-label="Team scores">
              <article
                class="team-card team-card-one"
                [class.is-leading]="isLeading(1, live)"
                [class.is-serving]="isServing(1, live)"
              >
                <div class="team-card-head">
                  <div>
                    <span class="team-label">Team 1</span>
                    <span class="team-side-label">Side A</span>
                  </div>
                  @if (isServing(1, live) && live.servingPlayerId) {
                    <span class="serving-pill">
                      <i class="fas fa-table-tennis-paddle-ball"></i>
                      Serving{{ isDoublesTeam(teams.teamA) ? ' · Server ' + live.serverNumber : '' }}
                    </span>
                  } @else if (isLeading(1, live)) {
                    <span class="lead-pill">
                      <i class="fas fa-arrow-trend-up"></i>
                      Leading
                    </span>
                  }
                </div>

                @if (needsPlayerPick(1, live) || manualPickTeam === 1) {
                  <div class="players player-picker" [attr.aria-label]="'Pick server: ' + names(teams.teamA)">
                    @for (player of teams.teamA; track player._id) {
                      <button
                        type="button"
                        class="player player-pick-btn"
                        [disabled]="busy"
                        (click)="pickServer(1, player._id)"
                      >
                        <span class="player-avatar" aria-hidden="true">
                          @if (player.profileImage) {
                            <img [src]="player.profileImage" class="player-avatar-img" alt="" />
                          } @else {
                            {{ initials(player.memberName) }}
                          }
                        </span>
                        <span class="player-name">{{ player.memberName || 'Player' }}</span>
                        <i class="fas fa-table-tennis-paddle-ball pick-icon" aria-hidden="true"></i>
                      </button>
                    }
                  </div>
                  <span class="pick-helper">{{ live.servingTeam ? "Tap who's serving" : 'Tap who serves first' }}</span>
                  @if (manualPickTeam) {
                    <button type="button" class="cancel-pick-btn" [disabled]="busy" (click)="manualPickTeam = null">
                      Cancel
                    </button>
                  }
                } @else {
                  <div class="players" [attr.aria-label]="'Team 1: ' + names(teams.teamA)">
                    @for (player of teams.teamA; track player._id) {
                      <div class="player" [class.is-serving-player]="isServingPlayer(player, live)">
                        <span class="player-avatar" aria-hidden="true">
                          @if (player.profileImage) {
                            <img [src]="player.profileImage" class="player-avatar-img" alt="" />
                          } @else {
                            {{ initials(player.memberName) }}
                          }
                        </span>
                        <span class="player-name">{{ player.memberName || 'Player' }}</span>
                        @if (isServingPlayer(player, live)) {
                          <span class="serving-dot" aria-hidden="true"><i class="fas fa-table-tennis-paddle-ball"></i></span>
                        }
                      </div>
                    }
                  </div>

                  <output
                    class="score-value"
                    aria-live="polite"
                    [attr.aria-label]="'Team 1 score: ' + live.team1Score"
                  >
                    {{ live.team1Score }}
                  </output>
                  <button
                    type="button"
                    class="rally-btn"
                    [disabled]="busy || !live.servingPlayerId"
                    (click)="rallyWon(1)"
                  >
                    Team 1 won rally
                  </button>
                  @if (isServing(1, live) && live.servingPlayerId) {
                    <button type="button" class="change-server-btn" [disabled]="busy" (click)="manualPickTeam = 1">
                      Not who's serving? Change server
                    </button>
                  }
                }
              </article>

              <article
                class="team-card team-card-two"
                [class.is-leading]="isLeading(2, live)"
                [class.is-serving]="isServing(2, live)"
              >
                <div class="team-card-head">
                  <div>
                    <span class="team-label">Team 2</span>
                    <span class="team-side-label">Side B</span>
                  </div>
                  @if (isServing(2, live) && live.servingPlayerId) {
                    <span class="serving-pill">
                      <i class="fas fa-table-tennis-paddle-ball"></i>
                      Serving{{ isDoublesTeam(teams.teamB) ? ' · Server ' + live.serverNumber : '' }}
                    </span>
                  } @else if (isLeading(2, live)) {
                    <span class="lead-pill">
                      <i class="fas fa-arrow-trend-up"></i>
                      Leading
                    </span>
                  }
                </div>

                @if (needsPlayerPick(2, live) || manualPickTeam === 2) {
                  <div class="players player-picker" [attr.aria-label]="'Pick server: ' + names(teams.teamB)">
                    @for (player of teams.teamB; track player._id) {
                      <button
                        type="button"
                        class="player player-pick-btn"
                        [disabled]="busy"
                        (click)="pickServer(2, player._id)"
                      >
                        <span class="player-avatar" aria-hidden="true">
                          @if (player.profileImage) {
                            <img [src]="player.profileImage" class="player-avatar-img" alt="" />
                          } @else {
                            {{ initials(player.memberName) }}
                          }
                        </span>
                        <span class="player-name">{{ player.memberName || 'Player' }}</span>
                        <i class="fas fa-table-tennis-paddle-ball pick-icon" aria-hidden="true"></i>
                      </button>
                    }
                  </div>
                  <span class="pick-helper">{{ live.servingTeam ? "Tap who's serving" : 'Tap who serves first' }}</span>
                  @if (manualPickTeam) {
                    <button type="button" class="cancel-pick-btn" [disabled]="busy" (click)="manualPickTeam = null">
                      Cancel
                    </button>
                  }
                } @else {
                  <div class="players" [attr.aria-label]="'Team 2: ' + names(teams.teamB)">
                    @for (player of teams.teamB; track player._id) {
                      <div class="player" [class.is-serving-player]="isServingPlayer(player, live)">
                        <span class="player-avatar" aria-hidden="true">
                          @if (player.profileImage) {
                            <img [src]="player.profileImage" class="player-avatar-img" alt="" />
                          } @else {
                            {{ initials(player.memberName) }}
                          }
                        </span>
                        <span class="player-name">{{ player.memberName || 'Player' }}</span>
                        @if (isServingPlayer(player, live)) {
                          <span class="serving-dot" aria-hidden="true"><i class="fas fa-table-tennis-paddle-ball"></i></span>
                        }
                      </div>
                    }
                  </div>

                  <output
                    class="score-value"
                    aria-live="polite"
                    [attr.aria-label]="'Team 2 score: ' + live.team2Score"
                  >
                    {{ live.team2Score }}
                  </output>
                  <button
                    type="button"
                    class="rally-btn"
                    [disabled]="busy || !live.servingPlayerId"
                    (click)="rallyWon(2)"
                  >
                    Team 2 won rally
                  </button>
                  @if (isServing(2, live) && live.servingPlayerId) {
                    <button type="button" class="change-server-btn" [disabled]="busy" (click)="manualPickTeam = 2">
                      Not who's serving? Change server
                    </button>
                  }
                }
              </article>
            </section>

            <section class="game-actions">
              <div class="finish-copy">
                <span
                  class="finish-icon"
                  [class.finish-icon-ready]="live.team1Score !== live.team2Score"
                  aria-hidden="true"
                >
                  <i
                    class="fas"
                    [class.fa-flag-checkered]="live.team1Score !== live.team2Score"
                    [class.fa-scale-balanced]="live.team1Score === live.team2Score"
                  ></i>
                </span>
                <div>
                  <strong>{{ finishTitle(live) }}</strong>
                  <span>{{ finishMessage(live) }}</span>
                </div>
              </div>
              <button
                type="button"
                class="finish-button"
                [disabled]="busy || live.team1Score === live.team2Score"
                (click)="openFinishConfirmation()"
              >
                <i class="fas fa-flag-checkered"></i>
                Review & finish
              </button>
            </section>
          }
        </main>

        <footer class="page-footer">
          <i class="fas fa-shield-halved"></i>
          Secure court-only scoring link
        </footer>
      }

      @if (confirmingFinish && board && court) {
        @let teams = teamsFor();
        @let live = court.liveScore ?? emptyLiveScore;
        <div class="dialog-backdrop" (click)="cancelFinishConfirmation()">
          <section
            class="finish-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-dialog-title"
            (click)="$event.stopPropagation()"
          >
            <div class="dialog-handle" aria-hidden="true"></div>
            <div class="dialog-heading">
              <span class="dialog-icon"><i class="fas fa-flag-checkered"></i></span>
              <div>
                <span class="eyebrow">Court {{ courtNumber }}</span>
                <h2 id="finish-dialog-title">Confirm final score</h2>
              </div>
            </div>

            <div class="final-score">
              <div [class.final-winner]="live.team1Score > live.team2Score">
                <span>{{ names(teams.teamA) }}</span>
                <strong>{{ live.team1Score }}</strong>
              </div>
              <span class="final-divider">-</span>
              <div [class.final-winner]="live.team2Score > live.team1Score">
                <span>{{ names(teams.teamB) }}</span>
                <strong>{{ live.team2Score }}</strong>
              </div>
            </div>

            <div class="winner-summary">
              <i class="fas fa-trophy"></i>
              <span>
                <strong>{{ winningTeamName(live, teams.teamA, teams.teamB) }}</strong>
                will be recorded as the winner
              </span>
            </div>

            @if (scoreAdvisory(live)) {
              <div class="score-advisory">
                <i class="fas fa-circle-info"></i>
                <span>{{ scoreAdvisory(live) }} You can still finish an interrupted game.</span>
              </div>
            }

            <div class="dialog-actions">
              <button
                type="button"
                class="dialog-cancel"
                [disabled]="busy"
                (click)="cancelFinishConfirmation()"
              >
                Keep scoring
              </button>
              <button
                type="button"
                class="dialog-confirm"
                [disabled]="busy"
                (click)="finish()"
              >
                @if (busy) {
                  <i class="fas fa-circle-notch fa-spin"></i>
                  Saving...
                } @else {
                  <i class="fas fa-check"></i>
                  Confirm result
                }
              </button>
            </div>
          </section>
        </div>
      }
    </div>
    </div>
  `,
  styles: [`
    :host {
      --page-bg: #07110c;
      --surface: #102119;
      --surface-raised: #152920;
      --surface-soft: rgba(255, 255, 255, 0.045);
      --border: rgba(255, 255, 255, 0.09);
      --border-strong: rgba(255, 255, 255, 0.14);
      --text: #f7fbf8;
      --muted: rgba(235, 246, 238, 0.58);
      --muted-soft: rgba(235, 246, 238, 0.4);
      --lime: #a3e635;
      --lime-bright: #b8f04d;
      --lime-ink: #102000;
      --blue: #52b9f3;
      --danger: #fb7185;
      display: block;
      min-height: 100dvh;
      color: var(--text);
      background: var(--page-bg);
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
      outline: 3px solid rgba(163, 230, 53, 0.75);
      outline-offset: 3px;
    }

    .umpire-page {
      position: relative;
      isolation: isolate;
      min-height: 100dvh;
      overflow: hidden;
      padding:
        max(1rem, env(safe-area-inset-top))
        max(1rem, env(safe-area-inset-right))
        max(1.25rem, env(safe-area-inset-bottom))
        max(1rem, env(safe-area-inset-left));
      background:
        radial-gradient(circle at 8% -5%, rgba(163, 230, 53, 0.14), transparent 29rem),
        radial-gradient(circle at 100% 22%, rgba(82, 185, 243, 0.09), transparent 27rem),
        linear-gradient(180deg, #09160f 0%, var(--page-bg) 52%, #050d09 100%);
    }

    .umpire-page::before {
      position: fixed;
      z-index: -1;
      inset: 0;
      content: '';
      pointer-events: none;
      opacity: 0.22;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
      background-size: 46px 46px;
      mask-image: linear-gradient(to bottom, black, transparent 82%);
    }

    /* ── Mobile-only "fit everything, no scroll" mode ──────────────────────
       Below the tablet/desktop breakpoint (see @media min-width: 760px
       above), the page is instead rendered as a fixed-size design canvas
       and scaled with a CSS transform (in JS) to exactly fill the actual
       phone screen — no scrolling, whatever orientation it's held in.
       Desktop/tablet behavior above 760px is completely untouched: the
       .fit-canvas class is only ever added below that width (see
       updateMobileFit() in the component). */
    .umpire-viewport { display: contents; }
    .umpire-viewport.active {
      display: flex; align-items: center; justify-content: center;
      width: 100vw; height: 100vh; height: 100dvh; overflow: hidden;
      background: var(--page-bg);
    }
    .umpire-page.fit-canvas {
      width: 420px; flex: 0 0 auto; height: auto; min-height: 0;
    }
    .umpire-page.fit-canvas::before { position: absolute; }
    .umpire-page.fit-canvas .score-header h1 { font-size: 1.15rem; }
    .umpire-page.fit-canvas .score-value { font-size: 5.25rem; }
    .umpire-page.fit-canvas .state-screen h1 { font-size: 1.6rem; }

    /* Landscape phones: a content-driven height (however wide the canvas)
       stays roughly square, while the actual screen is a short, wide
       rectangle — scaling a near-square box to fit that shape wastes most
       of the width. Give the canvas a fixed, phone-landscape-shaped
       footprint instead (matching real device aspect ratios ~2:1) and
       tighten spacing so the core controls fit inside it without needing to
       scroll; overflow-y stays as a safety net for taller edge states
       (long names, notices, the finish dialog). */
    @media (orientation: landscape) {
      .umpire-page.fit-canvas {
        width: 1180px;
        height: 540px;
        padding: 0.6rem 0.9rem 0.75rem;
        overflow-y: auto;
      }
      .umpire-page.fit-canvas .score-header {
        padding: 0.2rem 0 0.4rem;
      }
      .umpire-page.fit-canvas .match-overview {
        padding: 0.5rem 0.7rem;
        margin-bottom: 0.5rem;
      }
      .umpire-page.fit-canvas .scoreboard-heading {
        margin: 0.5rem 0 0.4rem;
      }
      .umpire-page.fit-canvas .now-serving-banner,
      .umpire-page.fit-canvas .game-decided-banner {
        margin: 0.3rem 0 0.5rem;
        padding: 0.4rem 0.8rem;
      }
      .umpire-page.fit-canvas .team-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.6rem;
      }
      .umpire-page.fit-canvas .team-card {
        padding: 0.6rem;
      }
      .umpire-page.fit-canvas .players {
        margin-top: 0.4rem;
      }
      .umpire-page.fit-canvas .score-value {
        font-size: 3.2rem;
        margin-top: 0.3rem;
      }
      .umpire-page.fit-canvas .rally-btn {
        min-height: 44px;
      }
      .umpire-page.fit-canvas .game-actions {
        margin-top: 0.5rem;
        padding: 0.5rem 0.7rem;
      }
      .umpire-page.fit-canvas .page-footer {
        margin-top: 0.5rem;
      }
    }

    .score-shell {
      width: min(100%, 1040px);
      margin: 0 auto;
    }

    .score-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.35rem 0 1.1rem;
    }

    .event-identity {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 0.8rem;
    }

    .brand-mark {
      display: grid;
      flex: 0 0 auto;
      width: 44px;
      height: 44px;
      place-items: center;
      border: 1px solid rgba(163, 230, 53, 0.22);
      border-radius: 13px;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.1);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    }

    .brand-mark i {
      font-size: 1.05rem;
    }

    .brand-logo-img {
      width: 100%;
      height: 100%;
      border-radius: inherit;
      object-fit: cover;
    }

    .event-copy {
      min-width: 0;
    }

    .eyebrow,
    .state-eyebrow {
      display: block;
      margin: 0 0 0.18rem;
      color: var(--lime);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.11em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .score-header h1 {
      overflow: hidden;
      margin: 0;
      color: var(--text);
      font-size: clamp(1rem, 4.5vw, 1.35rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sync-status {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.42rem;
      min-height: 32px;
      padding: 0.38rem 0.68rem;
      border: 1px solid rgba(163, 230, 53, 0.2);
      border-radius: 999px;
      color: #c9f77d;
      background: rgba(163, 230, 53, 0.075);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--lime);
      box-shadow: 0 0 0 4px rgba(163, 230, 53, 0.12);
    }

    .sync-status-busy {
      border-color: rgba(82, 185, 243, 0.22);
      color: #9ddcff;
      background: rgba(82, 185, 243, 0.08);
    }

    .sync-status-busy .status-dot {
      background: var(--blue);
      box-shadow: 0 0 0 4px rgba(82, 185, 243, 0.12);
      animation: statusPulse 1s ease-in-out infinite;
    }

    .match-overview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
      padding: 0.85rem;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(16, 33, 25, 0.76);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.16);
      backdrop-filter: blur(14px);
    }

    .court-identity {
      display: flex;
      flex: 0 0 auto;
      flex-direction: column;
      padding: 0.12rem 0.95rem 0.12rem 0.25rem;
      border-right: 1px solid var(--border);
    }

    .court-identity span {
      color: var(--muted-soft);
      font-size: 0.61rem;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .court-identity strong {
      color: #fff;
      font-size: 1.02rem;
      font-weight: 850;
      white-space: nowrap;
    }

    .match-meta {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: flex-end;
      gap: 0.45rem;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .match-meta::-webkit-scrollbar {
      display: none;
    }

    .meta-pill {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.35rem;
      padding: 0.38rem 0.58rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      background: var(--surface-soft);
      font-size: 0.68rem;
      font-weight: 750;
      text-transform: capitalize;
      white-space: nowrap;
    }

    .meta-pill i {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.62rem;
    }

    .meta-pill-accent {
      border-color: rgba(163, 230, 53, 0.17);
      color: #c9f77d;
      background: rgba(163, 230, 53, 0.07);
      text-transform: none;
    }

    .notice {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 0.85rem;
      padding: 0.72rem 0.78rem;
      border: 1px solid;
      border-radius: 13px;
      font-size: 0.78rem;
      font-weight: 700;
      animation: noticeIn 0.22s ease-out;
    }

    .notice span {
      flex: 1;
    }

    .notice button {
      display: grid;
      width: 30px;
      height: 30px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      place-items: center;
      color: inherit;
      background: transparent;
      cursor: pointer;
    }

    .notice button:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .notice-success {
      border-color: rgba(163, 230, 53, 0.2);
      color: #d8fca1;
      background: rgba(163, 230, 53, 0.09);
    }

    .notice-error {
      border-color: rgba(251, 113, 133, 0.24);
      color: #fecdd3;
      background: rgba(251, 113, 133, 0.09);
    }

    .scoreboard-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 1rem;
      margin: 1.25rem 0 0.7rem;
      padding: 0 0.15rem;
    }

    .scoreboard-heading h2 {
      margin: 0;
      color: #fff;
      font-size: 1.12rem;
      font-weight: 850;
      letter-spacing: -0.02em;
    }

    .score-state {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0.3rem 0.6rem;
      border: 1px solid rgba(163, 230, 53, 0.16);
      border-radius: 999px;
      color: #d2f992;
      background: rgba(163, 230, 53, 0.07);
      font-size: 0.66rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .score-state-level {
      border-color: var(--border);
      color: var(--muted);
      background: var(--surface-soft);
    }

    .team-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.8rem;
    }

    .team-card {
      --team-accent: var(--lime);
      --team-accent-rgb: 163, 230, 53;
      position: relative;
      overflow: hidden;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 20px;
      background:
        linear-gradient(145deg, rgba(var(--team-accent-rgb), 0.055), transparent 48%),
        linear-gradient(160deg, rgba(21, 41, 32, 0.98), rgba(12, 27, 20, 0.98));
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
      transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
    }

    .team-card::before {
      position: absolute;
      top: 0;
      left: 1rem;
      width: 46px;
      height: 3px;
      border-radius: 0 0 4px 4px;
      content: '';
      background: var(--team-accent);
      box-shadow: 0 0 18px rgba(var(--team-accent-rgb), 0.28);
    }

    .team-card-two {
      --team-accent: var(--blue);
      --team-accent-rgb: 82, 185, 243;
    }

    .team-card.is-leading {
      border-color: rgba(var(--team-accent-rgb), 0.26);
      box-shadow:
        0 18px 52px rgba(0, 0, 0, 0.27),
        0 0 0 1px rgba(var(--team-accent-rgb), 0.055) inset;
    }

    .team-card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .team-card-head > div {
      display: flex;
      flex-direction: column;
    }

    .team-label {
      color: var(--team-accent);
      font-size: 0.73rem;
      font-weight: 900;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .team-side-label {
      margin-top: 0.08rem;
      color: var(--muted-soft);
      font-size: 0.62rem;
      font-weight: 650;
    }

    .lead-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.28rem 0.5rem;
      border: 1px solid rgba(var(--team-accent-rgb), 0.18);
      border-radius: 999px;
      color: var(--team-accent);
      background: rgba(var(--team-accent-rgb), 0.07);
      font-size: 0.61rem;
      font-weight: 850;
    }

    .players {
      display: flex;
      flex-wrap: wrap;
      gap: 0.42rem;
      min-height: 35px;
      margin-top: 0.65rem;
    }

    .player {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      gap: 0.38rem;
      padding: 0.25rem 0.5rem 0.25rem 0.28rem;
      border: 1px solid rgba(255, 255, 255, 0.065);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.035);
    }

    .player.is-serving-player {
      border-color: rgba(var(--team-accent-rgb), 0.4);
      background: rgba(var(--team-accent-rgb), 0.1);
    }

    .serving-dot {
      display: inline-flex;
      color: var(--team-accent);
      font-size: 0.6rem;
    }

    .player-picker {
      margin-top: 0.5rem;
    }

    .player-pick-btn {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      gap: 0.38rem;
      padding: 0.32rem 0.6rem 0.32rem 0.28rem;
      border: 1px solid rgba(var(--team-accent-rgb), 0.3);
      border-radius: 999px;
      background: rgba(var(--team-accent-rgb), 0.06);
      cursor: pointer;
      touch-action: manipulation;
      transition: transform 0.12s, background 0.15s, border-color 0.15s;
      font: inherit;
    }

    .player-pick-btn:hover:not(:disabled) {
      border-color: rgba(var(--team-accent-rgb), 0.5);
      background: rgba(var(--team-accent-rgb), 0.12);
    }

    .player-pick-btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    .player-pick-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .pick-icon {
      color: var(--team-accent);
      font-size: 0.62rem;
    }

    .pick-helper {
      display: block;
      margin-top: 0.6rem;
      color: var(--muted-soft);
      font-size: 0.66rem;
      font-weight: 700;
      text-align: center;
    }

    .change-server-btn {
      display: block;
      width: 100%;
      margin-top: 0.5rem;
      padding: 0.3rem;
      border: 0;
      background: none;
      color: var(--muted-soft);
      font-size: 0.64rem;
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
      text-align: center;
    }

    .change-server-btn:hover:not(:disabled) {
      color: rgba(255, 255, 255, 0.78);
    }

    .change-server-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .cancel-pick-btn {
      display: block;
      width: 100%;
      margin-top: 0.4rem;
      padding: 0.3rem;
      border: 0;
      background: none;
      color: var(--muted-soft);
      font-size: 0.64rem;
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
      text-align: center;
    }

    .cancel-pick-btn:hover:not(:disabled) {
      color: rgba(255, 255, 255, 0.78);
    }

    .cancel-pick-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .score-call {
      display: block;
      margin-top: 0.15rem;
      color: #fff;
      font-size: 1.05rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      letter-spacing: -0.02em;
    }

    .now-serving-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.7rem;
      margin: 0.7rem 0 1rem;
      padding: 0.7rem 1rem;
      border: 1px solid rgba(163, 230, 53, 0.28);
      border-radius: 14px;
      background:
        linear-gradient(145deg, rgba(163, 230, 53, 0.1), transparent 60%),
        rgba(163, 230, 53, 0.05);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
      flex-wrap: wrap;
    }

    .now-serving-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--lime);
      font-size: 0.68rem;
      font-weight: 900;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .now-serving-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--lime);
      box-shadow: 0 0 0 4px rgba(163, 230, 53, 0.16);
      animation: statusPulse 1.4s ease-in-out infinite;
    }

    .now-serving-name {
      color: #fff;
      font-size: 1.25rem;
      font-weight: 900;
      letter-spacing: -0.01em;
      text-align: center;
    }

    .game-decided-banner {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin: 0.7rem 0 1rem;
      padding: 0.85rem 1rem;
      border: 1px solid rgba(251, 191, 36, 0.4);
      border-radius: 14px;
      background:
        linear-gradient(145deg, rgba(251, 191, 36, 0.14), transparent 60%),
        rgba(251, 191, 36, 0.06);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
      flex-wrap: wrap;
    }

    .game-decided-banner > i {
      flex: 0 0 auto;
      color: #fbbf24;
      font-size: 1.35rem;
    }

    .game-decided-copy {
      display: flex;
      flex: 1;
      min-width: 160px;
      flex-direction: column;
      gap: 0.1rem;
    }

    .game-decided-copy strong {
      color: #fff;
      font-size: 0.9rem;
      font-weight: 900;
    }

    .game-decided-copy span {
      color: rgba(255, 255, 255, 0.68);
      font-size: 0.72rem;
      font-weight: 700;
    }

    .game-decided-finish-btn {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0.55rem 1rem;
      border: 1px solid rgba(251, 191, 36, 0.55);
      border-radius: 11px;
      color: #241a02;
      background: #fbbf24;
      font-size: 0.78rem;
      font-weight: 900;
      cursor: pointer;
      transition: filter 0.15s, transform 0.12s;
      touch-action: manipulation;
    }

    .game-decided-finish-btn:hover:not(:disabled) {
      filter: brightness(1.08);
    }

    .game-decided-finish-btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    .game-decided-finish-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    @media (min-width: 480px) {
      .now-serving-name {
        font-size: 1.4rem;
      }
    }

    .player-avatar {
      display: grid;
      flex: 0 0 auto;
      overflow: hidden;
      width: 25px;
      height: 25px;
      place-items: center;
      border: 1px solid rgba(var(--team-accent-rgb), 0.16);
      border-radius: 50%;
      color: var(--team-accent);
      background: rgba(var(--team-accent-rgb), 0.08);
      font-size: 0.55rem;
      font-weight: 900;
      letter-spacing: -0.02em;
    }

    .player-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .player-name {
      overflow: hidden;
      max-width: 140px;
      color: rgba(255, 255, 255, 0.84);
      font-size: 0.7rem;
      font-weight: 750;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .score-value {
      display: block;
      margin-top: 0.7rem;
      color: #fff;
      font-size: clamp(4.4rem, 20vw, 6.5rem);
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      letter-spacing: -0.075em;
      line-height: 0.88;
      text-align: center;
      text-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
    }

    .rally-btn {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      min-height: 58px;
      margin-top: 0.85rem;
      padding: 0.7rem 1rem;
      border: 1px solid rgba(var(--team-accent-rgb), 0.6);
      border-radius: 16px;
      color: #07120b;
      background: var(--team-accent);
      box-shadow: 0 9px 24px rgba(var(--team-accent-rgb), 0.17);
      font-size: 0.86rem;
      font-weight: 900;
      cursor: pointer;
      transition: transform 0.12s, filter 0.15s;
      touch-action: manipulation;
    }

    .team-card-two .rally-btn {
      color: #061520;
    }

    .rally-btn:hover:not(:disabled) {
      filter: brightness(1.08);
    }

    .rally-btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    .rally-btn:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .serving-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.28rem 0.5rem;
      border: 1px solid rgba(var(--team-accent-rgb), 0.28);
      border-radius: 999px;
      color: var(--team-accent);
      background: rgba(var(--team-accent-rgb), 0.1);
      font-size: 0.61rem;
      font-weight: 850;
      white-space: nowrap;
    }

    .team-card.is-serving {
      border-color: rgba(var(--team-accent-rgb), 0.35);
    }

    .undo-btn {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.4rem;
      min-height: 32px;
      padding: 0.38rem 0.7rem;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      color: rgba(255, 255, 255, 0.78);
      background: rgba(255, 255, 255, 0.045);
      font-size: 0.68rem;
      font-weight: 800;
      cursor: pointer;
    }

    .undo-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
    }

    .undo-btn:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    .game-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 0.85rem;
      padding: 0.78rem;
      border: 1px solid var(--border);
      border-radius: 17px;
      background: rgba(16, 33, 25, 0.9);
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
      backdrop-filter: blur(16px);
    }

    .finish-copy {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 0.7rem;
    }

    .finish-copy > div {
      display: flex;
      min-width: 0;
      flex-direction: column;
    }

    .finish-copy strong {
      color: #fff;
      font-size: 0.75rem;
      font-weight: 850;
    }

    .finish-copy span:not(.finish-icon) {
      overflow: hidden;
      margin-top: 0.08rem;
      color: var(--muted-soft);
      font-size: 0.62rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .finish-icon {
      display: grid;
      flex: 0 0 auto;
      width: 38px;
      height: 38px;
      border: 1px solid var(--border);
      border-radius: 11px;
      place-items: center;
      color: var(--muted);
      background: var(--surface-soft);
    }

    .finish-icon-ready {
      border-color: rgba(163, 230, 53, 0.18);
      color: var(--lime);
      background: rgba(163, 230, 53, 0.08);
    }

    .finish-button {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      gap: 0.48rem;
      min-height: 48px;
      padding: 0.7rem 1rem;
      border: 1px solid rgba(163, 230, 53, 0.35);
      border-radius: 12px;
      color: var(--lime-ink);
      background: var(--lime);
      box-shadow: 0 9px 24px rgba(163, 230, 53, 0.14);
      font-size: 0.75rem;
      font-weight: 900;
      cursor: pointer;
      transition: transform 0.14s, filter 0.15s;
      white-space: nowrap;
    }

    .finish-button:hover:not(:disabled) {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }

    .finish-button:active:not(:disabled) {
      transform: scale(0.98);
    }

    .finish-button:disabled {
      border-color: var(--border);
      color: var(--muted-soft);
      background: rgba(255, 255, 255, 0.045);
      box-shadow: none;
      cursor: not-allowed;
    }

    .waiting-card {
      display: flex;
      min-height: 430px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2.2rem 1.4rem;
      border: 1px solid var(--border);
      border-radius: 22px;
      background:
        linear-gradient(145deg, rgba(163, 230, 53, 0.035), transparent 52%),
        rgba(16, 33, 25, 0.9);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
      text-align: center;
    }

    .waiting-visual {
      position: relative;
      display: grid;
      overflow: hidden;
      width: 94px;
      height: 94px;
      margin-bottom: 1.25rem;
      border: 1px solid rgba(163, 230, 53, 0.2);
      border-radius: 24px;
      place-items: center;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.07);
    }

    .waiting-visual i {
      position: relative;
      z-index: 1;
      font-size: 1.45rem;
    }

    .court-line {
      position: absolute;
      background: rgba(163, 230, 53, 0.12);
    }

    .court-line-one {
      top: 50%;
      left: 0;
      width: 100%;
      height: 1px;
    }

    .court-line-two {
      top: 0;
      left: 50%;
      width: 1px;
      height: 100%;
    }

    .waiting-label {
      color: var(--lime);
      font-size: 0.68rem;
      font-weight: 850;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .waiting-card h2 {
      margin: 0.38rem 0 0;
      color: #fff;
      font-size: 1.35rem;
      font-weight: 850;
      letter-spacing: -0.025em;
    }

    .waiting-card p {
      max-width: 380px;
      margin: 0.6rem 0 0;
      color: var(--muted);
      font-size: 0.82rem;
      line-height: 1.55;
    }

    .waiting-status {
      display: inline-flex;
      align-items: center;
      gap: 0.48rem;
      margin-top: 1.15rem;
      padding: 0.42rem 0.7rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      background: var(--surface-soft);
      font-size: 0.66rem;
      font-weight: 750;
    }

    .waiting-status span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--lime);
      animation: statusPulse 1.5s ease-in-out infinite;
    }

    .page-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      width: min(100%, 1040px);
      margin: 1rem auto 0;
      color: rgba(235, 246, 238, 0.3);
      font-size: 0.61rem;
      font-weight: 650;
    }

    .page-footer i {
      color: rgba(163, 230, 53, 0.42);
    }

    .state-screen {
      display: flex;
      width: min(100%, 520px);
      min-height: calc(100dvh - 2.25rem);
      margin: 0 auto;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .state-visual {
      position: relative;
      display: grid;
      width: 82px;
      height: 82px;
      margin-bottom: 1.3rem;
      border: 1px solid rgba(163, 230, 53, 0.19);
      border-radius: 23px;
      place-items: center;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.075);
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
    }

    .state-visual i {
      font-size: 1.3rem;
    }

    .state-visual-error {
      border-color: rgba(251, 113, 133, 0.2);
      color: #fda4af;
      background: rgba(251, 113, 133, 0.08);
    }

    .state-visual-complete {
      border-color: rgba(82, 185, 243, 0.2);
      color: #7dd3fc;
      background: rgba(82, 185, 243, 0.08);
    }

    .loading-ring {
      position: absolute;
      inset: -7px;
      border: 2px solid transparent;
      border-top-color: var(--lime);
      border-radius: 27px;
      animation: spin 1.15s linear infinite;
    }

    .state-screen h1 {
      margin: 0.3rem 0 0;
      color: #fff;
      font-size: clamp(1.55rem, 6vw, 2rem);
      font-weight: 850;
      letter-spacing: -0.035em;
    }

    .state-screen > p:not(.state-eyebrow) {
      max-width: 430px;
      margin: 0.65rem 0 0;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.6;
    }

    .retry-button {
      display: inline-flex;
      align-items: center;
      gap: 0.48rem;
      min-height: 46px;
      margin-top: 1.25rem;
      padding: 0.65rem 1rem;
      border: 1px solid rgba(163, 230, 53, 0.3);
      border-radius: 12px;
      color: var(--lime-ink);
      background: var(--lime);
      font-size: 0.78rem;
      font-weight: 900;
      cursor: pointer;
    }

    .dialog-backdrop {
      position: fixed;
      z-index: 1000;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding:
        1rem
        max(0.8rem, env(safe-area-inset-right))
        max(0.8rem, env(safe-area-inset-bottom))
        max(0.8rem, env(safe-area-inset-left));
      background: rgba(1, 7, 4, 0.76);
      backdrop-filter: blur(10px);
      animation: backdropIn 0.18s ease-out;
    }

    .finish-dialog {
      width: min(100%, 520px);
      padding: 0.6rem 1rem 1rem;
      border: 1px solid var(--border-strong);
      border-radius: 22px;
      background:
        linear-gradient(150deg, rgba(163, 230, 53, 0.04), transparent 46%),
        #11231a;
      box-shadow: 0 26px 80px rgba(0, 0, 0, 0.52);
      animation: dialogUp 0.22s cubic-bezier(0.2, 0.75, 0.2, 1);
    }

    .dialog-handle {
      width: 38px;
      height: 4px;
      margin: 0 auto 0.9rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.16);
    }

    .dialog-heading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .dialog-icon {
      display: grid;
      flex: 0 0 auto;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(163, 230, 53, 0.2);
      border-radius: 12px;
      place-items: center;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.08);
    }

    .dialog-heading h2 {
      margin: 0;
      color: #fff;
      font-size: 1.05rem;
      font-weight: 850;
      letter-spacing: -0.02em;
    }

    .final-score {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 0.75rem;
      margin-top: 1rem;
      padding: 0.85rem;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.035);
    }

    .final-score > div {
      display: flex;
      min-width: 0;
      flex-direction: column;
      align-items: center;
      gap: 0.22rem;
    }

    .final-score span:not(.final-divider) {
      overflow: hidden;
      width: 100%;
      color: var(--muted);
      font-size: 0.65rem;
      font-weight: 700;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .final-score strong {
      color: #fff;
      font-size: 2.4rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      letter-spacing: -0.06em;
      line-height: 1;
    }

    .final-score .final-winner strong {
      color: var(--lime);
    }

    .final-divider {
      color: var(--muted-soft);
      font-size: 1.1rem;
      font-weight: 800;
    }

    .winner-summary,
    .score-advisory {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-top: 0.7rem;
      padding: 0.65rem 0.72rem;
      border: 1px solid rgba(163, 230, 53, 0.14);
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.72);
      background: rgba(163, 230, 53, 0.055);
      font-size: 0.7rem;
      line-height: 1.4;
    }

    .winner-summary i {
      color: var(--lime);
    }

    .winner-summary strong {
      color: #fff;
    }

    .score-advisory {
      border-color: rgba(245, 158, 11, 0.18);
      color: #fcd999;
      background: rgba(245, 158, 11, 0.065);
    }

    .score-advisory i {
      color: #fbbf24;
    }

    .dialog-actions {
      display: grid;
      grid-template-columns: 1fr 1.25fr;
      gap: 0.65rem;
      margin-top: 1rem;
    }

    .dialog-actions button {
      display: inline-flex;
      min-height: 50px;
      align-items: center;
      justify-content: center;
      gap: 0.42rem;
      padding: 0.7rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 900;
      cursor: pointer;
    }

    .dialog-actions button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .dialog-cancel {
      border: 1px solid var(--border-strong);
      color: rgba(255, 255, 255, 0.75);
      background: rgba(255, 255, 255, 0.04);
    }

    .dialog-confirm {
      border: 1px solid rgba(163, 230, 53, 0.35);
      color: var(--lime-ink);
      background: var(--lime);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 1; }
    }

    @keyframes noticeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes backdropIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes dialogUp {
      from { opacity: 0; transform: translateY(22px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (min-width: 760px) {
      .umpire-page {
        padding:
          max(1.5rem, env(safe-area-inset-top))
          max(1.5rem, env(safe-area-inset-right))
          max(1.5rem, env(safe-area-inset-bottom))
          max(1.5rem, env(safe-area-inset-left));
      }

      .score-header {
        padding-bottom: 1.3rem;
      }

      .brand-mark {
        width: 48px;
        height: 48px;
      }

      .match-overview {
        padding: 0.95rem 1rem;
      }

      .team-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .team-card {
        padding: 1.15rem;
        border-radius: 22px;
      }

      .score-value {
        font-size: clamp(5rem, 10vw, 7.25rem);
      }

      .game-actions {
        margin-top: 1rem;
        padding: 0.9rem;
      }

      .finish-button {
        min-height: 52px;
        padding-inline: 1.25rem;
      }

      .dialog-backdrop {
        align-items: center;
      }

      .finish-dialog {
        padding: 1rem 1.1rem 1.1rem;
      }

      .dialog-handle {
        display: none;
      }
    }

    @media (max-width: 540px) {
      .match-overview {
        align-items: stretch;
        flex-direction: column;
        gap: 0.7rem;
      }

      .court-identity {
        padding: 0 0 0.65rem;
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }

      .court-identity strong {
        font-size: 1.12rem;
      }

      .match-meta {
        justify-content: flex-start;
        margin-right: -0.85rem;
        padding-right: 0.85rem;
      }

      .scoreboard-heading {
        margin-top: 1rem;
      }

      .game-actions {
        align-items: stretch;
        flex-direction: column;
      }

      .finish-button {
        width: 100%;
        min-height: 52px;
      }

      .finish-copy span:not(.finish-icon) {
        white-space: normal;
      }
    }

    @media (max-width: 360px) {
      .umpire-page {
        padding-inline: 0.75rem;
      }

      .brand-mark {
        width: 40px;
        height: 40px;
      }

      .sync-status {
        padding-inline: 0.55rem;
      }

      .team-card {
        padding-inline: 0.8rem;
      }

      .score-value {
        font-size: 4rem;
      }

      .dialog-actions {
        grid-template-columns: 1fr;
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
export class UmpireScoringComponent implements OnInit, AfterViewInit, OnDestroy {
  state: PageState = 'loading';
  board: QueueBoard | null = null;
  error = '';
  actionError = '';
  successMessage = '';
  busy = false;
  confirmingFinish = false;
  // Set when the umpire manually reopens the player picker to correct an
  // already-resolved server (not just the automatic ambiguous-state picker).
  manualPickTeam: 1 | 2 | null = null;
  readonly emptyLiveScore = EMPTY_LIVE_SCORE;

  // Below this width, the page renders as a fixed-size canvas scaled with a
  // transform to exactly fill the screen with no scrolling (see .fit-canvas
  // in styles) — matches the breakpoint the page's own desktop/tablet
  // enhancements (@media min-width: 760px) already use, just from below.
  private static readonly MOBILE_FIT_BREAKPOINT = 760;
  isMobileFit = false;

  @ViewChild('pageEl') private pageRef?: ElementRef<HTMLElement>;

  private sessionId = '';
  courtNumber = 0;
  private token = '';
  private pollSub?: Subscription;
  private successTimer?: ReturnType<typeof setTimeout>;
  private readonly POLL_MS = 5000;
  private resizeObserver?: ResizeObserver;
  private orientationTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private hp: HostedPlayService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');

    this.sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
    this.courtNumber = Number(this.route.snapshot.paramMap.get('courtNumber'));
    this.token = this.route.snapshot.queryParamMap.get('t') || '';
    if (!this.sessionId || !this.courtNumber || !this.token) {
      this.state = 'invalid_token';
      this.cdr.detectChanges();
      return;
    }
    this.load();
  }

  ngAfterViewInit() {
    const el = this.pageRef?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateMobileFit());
      this.resizeObserver.observe(el);
    }
    this.updateMobileFit();
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    if (this.successTimer) clearTimeout(this.successTimer);
    if (this.orientationTimer) clearTimeout(this.orientationTimer);
    this.resizeObserver?.disconnect();
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.updateMobileFit();
  }

  @HostListener('window:orientationchange')
  onOrientationChange() {
    if (this.orientationTimer) clearTimeout(this.orientationTimer);
    this.orientationTimer = setTimeout(() => this.updateMobileFit(), 200);
  }

  // Decides whether the mobile "fit everything, no scroll" canvas mode
  // should be active, and if so scales it to exactly fill the screen. Above
  // the breakpoint this fully resets the page back to its normal
  // desktop/tablet flow (natural size, scrollable, transform cleared).
  //
  // Uses the SMALLER of the two viewport dimensions, not just width — a
  // phone's short side stays roughly constant across rotation (~360-430px),
  // whereas its width alone swings from ~400px in portrait to ~700-930px in
  // landscape on many modern phones, which would otherwise fall above a
  // plain width check and wrongly fall back to the desktop layout.
  private updateMobileFit() {
    const shouldFit = Math.min(window.innerWidth, window.innerHeight) < UmpireScoringComponent.MOBILE_FIT_BREAKPOINT;
    if (shouldFit !== this.isMobileFit) {
      this.isMobileFit = shouldFit;
      this.cdr.detectChanges();
    }
    const el = this.pageRef?.nativeElement;
    if (!el) return;
    if (!shouldFit) {
      el.style.transform = 'none';
      return;
    }
    const naturalWidth = el.offsetWidth;
    const naturalHeight = el.offsetHeight;
    if (!naturalWidth || !naturalHeight) return;
    const scale = Math.min(window.innerWidth / naturalWidth, window.innerHeight / naturalHeight);
    el.style.transform = `scale(${scale})`;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.confirmingFinish && !this.busy) {
      this.cancelFinishConfirmation();
    }
  }

  get court() {
    return (
      this.board?.courts.find(
        (court) => court.courtNumber === this.courtNumber,
      ) ?? null
    );
  }

  load() {
    this.state = 'loading';
    this.error = '';
    this.actionError = '';
    this.cdr.detectChanges();
    this.hp
      .getUmpireBoard(this.sessionId, this.courtNumber, this.token)
      .subscribe({
        next: (board) => {
          this.board = board;
          this.state = 'ready';
          this.startPolling();
          this.cdr.detectChanges();
        },
        error: (err) => this.handlePageError(err),
      });
  }

  private startPolling() {
    if (this.pollSub) return;
    this.pollSub = interval(this.POLL_MS)
      .pipe(
        switchMap(() =>
          this.hp
            .getUmpireBoard(this.sessionId, this.courtNumber, this.token)
            .pipe(catchError(() => EMPTY)),
        ),
      )
      .subscribe((board) => {
        this.board = board;
        this.cdr.detectChanges();
      });
  }

  private handlePageError(err: any) {
    const code = err?.error?.error;
    if (code === 'invalid_token') {
      this.state = 'invalid_token';
    } else if (code === 'session_ended') {
      this.state = 'session_ended';
    } else {
      this.state = 'error';
      this.error =
        typeof code === 'string' && code ? code : 'Unable to load this court.';
    }
    this.cdr.detectChanges();
  }

  private handleActionError(err: any) {
    const code = err?.error?.error;
    if (code === 'invalid_token' || code === 'session_ended') {
      this.confirmingFinish = false;
      this.handlePageError(err);
      return;
    }
    this.actionError =
      typeof code === 'string' && code
        ? code
        : 'The score could not be saved. Please try again.';
    this.cdr.detectChanges();
  }

  teamsFor(): { teamA: QueuePlayer[]; teamB: QueuePlayer[] } {
    return splitCourtTeams(
      this.court?.players ?? [],
      this.board?.session?.playersPerCourt ?? 4,
    );
  }

  names(team: QueuePlayer[]): string {
    return team.map((player) => player.memberName || 'Player').join(' & ');
  }

  initials(name: string): string {
    const parts = (name || 'Player')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'P';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  sportLabel(): string {
    const sport = this.board?.session?.sport || 'Hosted play';
    return sport
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatLabel(): string {
    const size = this.board?.session?.playersPerCourt ?? 4;
    if (size === 2) return 'Singles';
    if (size === 4) return 'Doubles';
    return `${size} players`;
  }

  isLeading(team: 1 | 2, live: LiveScore): boolean {
    return team === 1
      ? live.team1Score > live.team2Score
      : live.team2Score > live.team1Score;
  }

  scoreState(live: LiveScore): string {
    if (live.team1Score === 0 && live.team2Score === 0) {
      return 'Ready to score';
    }
    if (live.team1Score === live.team2Score) return 'Scores level';
    const leader = live.team1Score > live.team2Score ? 1 : 2;
    const margin = Math.abs(live.team1Score - live.team2Score);
    return `Team ${leader} leads by ${margin}`;
  }

  scoreAdvisory(live: LiveScore): string {
    const session = this.board?.session;
    if (
      !session ||
      session.sport !== 'pickleball' ||
      !session.scoreTarget
    ) {
      return '';
    }
    const winningScore = Math.max(live.team1Score, live.team2Score);
    const margin = Math.abs(live.team1Score - live.team2Score);
    if (winningScore < session.scoreTarget) {
      return `The configured target is ${session.scoreTarget} points.`;
    }
    if (session.winByTwo !== false && margin < 2) {
      return 'The configured win-by-2 margin has not been reached.';
    }
    return '';
  }

  // True once the current score already satisfies the configured target and
  // win-by-2 margin — i.e. the game is technically over even if nobody has
  // tapped Finish yet. Play isn't blocked at this point (interrupted games are
  // legitimate), but the umpire should see it clearly instead of continuing to
  // score a game that's already been won.
  isGameDecided(live: LiveScore): boolean {
    const session = this.board?.session;
    if (!session || session.sport !== 'pickleball' || !session.scoreTarget) return false;
    if (!live.servingTeam || !live.servingPlayerId) return false;
    const winningScore = Math.max(live.team1Score, live.team2Score);
    const margin = Math.abs(live.team1Score - live.team2Score);
    if (winningScore < session.scoreTarget) return false;
    if (session.winByTwo !== false && margin < 2) return false;
    return true;
  }

  finishTitle(live: LiveScore): string {
    if (live.team1Score === 0 && live.team2Score === 0) {
      return 'Awaiting the first point';
    }
    if (live.team1Score === live.team2Score) return 'The game is tied';
    return this.scoreAdvisory(live) ? 'Check the final score' : 'Result ready';
  }

  finishMessage(live: LiveScore): string {
    if (live.team1Score === 0 && live.team2Score === 0) {
      return 'Award a point to begin scoring.';
    }
    if (live.team1Score === live.team2Score) {
      return 'Enter the deciding point before finishing.';
    }
    return (
      this.scoreAdvisory(live) ||
      'Review the score before recording the result.'
    );
  }

  winningTeamName(
    live: LiveScore,
    teamA: QueuePlayer[],
    teamB: QueuePlayer[],
  ): string {
    return live.team1Score > live.team2Score
      ? this.names(teamA)
      : this.names(teamB);
  }

  isServing(team: 1 | 2, live: LiveScore): boolean {
    return live.servingTeam === team;
  }

  isDoublesTeam(team: QueuePlayer[]): boolean {
    return team.length >= 2;
  }

  isServingPlayer(player: QueuePlayer, live: LiveScore): boolean {
    return !!live.servingPlayerId && player._id === live.servingPlayerId;
  }

  servingPlayerName(live: LiveScore, teams: { teamA: QueuePlayer[]; teamB: QueuePlayer[] }): string {
    if (!live.servingPlayerId) return '';
    const roster = live.servingTeam === 1 ? teams.teamA : teams.teamB;
    const player = roster.find((p) => p._id === live.servingPlayerId);
    return player?.memberName || 'Player';
  }

  // True when this team's player rows should be tap targets rather than a
  // plain roster: either nobody has served yet this game (both teams), or
  // this specific team just won the serve via a side-out and we don't yet
  // know which of their two players is taking it.
  needsPlayerPick(team: 1 | 2, live: LiveScore): boolean {
    if (!live.servingTeam) return true;
    return live.servingTeam === team && !live.servingPlayerId;
  }

  scoreHeading(live: LiveScore): string {
    if (!live.servingTeam) return 'Who serves first?';
    if (!live.servingPlayerId) return "Who's serving?";
    return 'Live score';
  }

  // The real pickleball call: serving team's score first, then receiving
  // team's, then the server number — but only doubles uses a 3rd digit.
  scoreCall(live: LiveScore, teams: { teamA: QueuePlayer[]; teamB: QueuePlayer[] }): string {
    if (!live.servingTeam) return '';
    const servingScore = live.servingTeam === 1 ? live.team1Score : live.team2Score;
    const receivingScore = live.servingTeam === 1 ? live.team2Score : live.team1Score;
    const servingTeamPlayers = live.servingTeam === 1 ? teams.teamA : teams.teamB;
    if (servingTeamPlayers.length >= 2 && live.serverNumber) {
      return `${servingScore}-${receivingScore}-${live.serverNumber}`;
    }
    return `${servingScore}-${receivingScore}`;
  }

  // Routes a player tap to the right call depending on game state: picking
  // the very first server of the game (start-serve) vs. resolving who's
  // serving after a side-out handed the team the serve mid-game (set-server).
  pickServer(team: 1 | 2, playerId: string) {
    const live = this.court?.liveScore;
    if (!live || !live.servingTeam) {
      this.startServe(team, playerId);
    } else {
      this.setServer(playerId);
    }
  }

  startServe(team: 1 | 2, playerId: string) {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    this.cdr.detectChanges();
    this.hp.startServe(this.sessionId, this.courtNumber, this.token, team, playerId).subscribe({
      next: (board) => {
        this.board = board;
        this.busy = false;
        this.manualPickTeam = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.busy = false;
        this.handleActionError(err);
      },
    });
  }

  setServer(playerId: string) {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    this.cdr.detectChanges();
    this.hp.setServer(this.sessionId, this.courtNumber, this.token, playerId).subscribe({
      next: (board) => {
        this.board = board;
        this.busy = false;
        this.manualPickTeam = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.busy = false;
        this.handleActionError(err);
      },
    });
  }

  rallyWon(team: 1 | 2) {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    this.cdr.detectChanges();
    this.hp.rallyWon(this.sessionId, this.courtNumber, this.token, team).subscribe({
      next: (board) => {
        this.board = board;
        this.busy = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.busy = false;
        this.handleActionError(err);
      },
    });
  }

  undo() {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    this.cdr.detectChanges();
    this.hp.undoLastAction(this.sessionId, this.courtNumber, this.token).subscribe({
      next: (board) => {
        this.board = board;
        this.busy = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.busy = false;
        this.handleActionError(err);
      },
    });
  }

  openFinishConfirmation() {
    const live = this.court?.liveScore;
    if (
      this.busy ||
      !live ||
      live.team1Score === live.team2Score
    ) {
      return;
    }
    this.actionError = '';
    this.confirmingFinish = true;
    this.cdr.detectChanges();
  }

  cancelFinishConfirmation() {
    if (this.busy) return;
    this.confirmingFinish = false;
    this.cdr.detectChanges();
  }

  finish() {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    this.cdr.detectChanges();
    this.hp
      .finishUmpireCourt(this.sessionId, this.courtNumber, this.token)
      .subscribe({
        next: (board) => {
          this.board = board;
          this.busy = false;
          this.confirmingFinish = false;
          this.showSuccess('Game recorded. The court is ready for the next match.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.busy = false;
          this.handleActionError(err);
        },
      });
  }

  dismissSuccess() {
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successMessage = '';
    this.cdr.detectChanges();
  }

  private showSuccess(message: string) {
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successMessage = message;
    this.successTimer = setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges();
    }, 4500);
  }
}
