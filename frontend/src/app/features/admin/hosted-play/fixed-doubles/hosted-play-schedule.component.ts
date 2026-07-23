import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { retry as retryOnError, Subscription } from 'rxjs';
import QRCode from 'qrcode';
import {
  FixedDoublesBoard,
  FixedDoublesFixture,
  FixturePairSnapshot,
  HostedPlayService,
} from '../../../../core/services/hosted-play.service';

interface UmpireLinkModalState {
  courtNumber: number;
  generating: boolean;
  dataUrl?: string;
  url?: string;
  copied?: boolean;
  error?: string;
}

type ScheduleView = 'now' | 'upcoming' | 'completed' | 'all';

@Component({
  selector: 'app-admin-hosted-play-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="schedule-page" [attr.aria-busy]="loading || busy">
      <header class="schedule-hero">
        <div class="hero-topbar">
          <button type="button" class="back-button" (click)="goBack()">
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span>All sessions</span>
          </button>

          <div class="hero-actions">
            <button type="button" class="hero-action tv-top-action" (click)="openTvDisplay()">
              <i class="fas fa-tv" aria-hidden="true"></i>
              <span>TV display</span>
            </button>
            <button type="button" class="hero-action" (click)="goToTeams()">
              <i class="fas fa-people-group" aria-hidden="true"></i>
              <span>Manage teams</span>
            </button>
          </div>
        </div>

        <div class="hero-copy">
          <div class="eyebrow"><i class="fas fa-calendar-days" aria-hidden="true"></i> Fixed doubles rotation</div>
          <h1>{{ board?.session?.title || 'Match schedule' }}</h1>
          <p>Run the rotation, record results, and keep every court moving from one match-day workspace.</p>

          @if (board?.session; as session) {
            <div class="session-meta" aria-label="Session details">
              @if (session.date) {
                <span><i class="far fa-calendar" aria-hidden="true"></i>{{ session.date | date: 'EEE, MMM d' }}</span>
              }
              @if (sessionTime()) {
                <span><i class="far fa-clock" aria-hidden="true"></i>{{ sessionTime() }}</span>
              }
              @if (session.venue) {
                <span><i class="fas fa-location-dot" aria-hidden="true"></i>{{ session.venue }}</span>
              }
              @if (session.sport) {
                <span><i class="fas fa-table-tennis-paddle-ball" aria-hidden="true"></i>{{ sportLabel() }}</span>
              }
            </div>
          }
        </div>

        @if (!loading && board) {
          <div class="metric-grid" aria-label="Schedule summary">
            <div class="metric-card">
              <span class="metric-icon amber"><i class="fas fa-tower-broadcast" aria-hidden="true"></i></span>
              <div><strong>{{ liveMatchCount() }}</strong><span>Live now</span></div>
            </div>
            <div class="metric-card">
              <span class="metric-icon blue"><i class="fas fa-hourglass-half" aria-hidden="true"></i></span>
              <div><strong>{{ remainingMatchCount() }}</strong><span>Remaining</span></div>
            </div>
            <div class="metric-card">
              <span class="metric-icon lime"><i class="fas fa-circle-check" aria-hidden="true"></i></span>
              <div><strong>{{ completedMatchCount() }}<small>/{{ totalMatchCount() }}</small></strong><span>Completed</span></div>
            </div>
            <div class="metric-card">
              <span class="metric-icon teal"><i class="fas fa-table-tennis-paddle-ball" aria-hidden="true"></i></span>
              <div><strong>{{ board.session.numberOfCourts || 1 }}</strong><span>Courts</span></div>
            </div>
          </div>
        }
      </header>

      @if (umpireLinkModal) {
        <div class="modal-backdrop" (click)="closeUmpireLinkModal()">
          <section
            #umpireDialog
            class="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="umpire-dialog-title"
            aria-describedby="umpire-dialog-description"
            (click)="$event.stopPropagation()"
          >
            <header class="modal-head">
              <div class="modal-heading">
                <span class="modal-icon"><i class="fas fa-gavel" aria-hidden="true"></i></span>
                <div>
                  <span class="section-kicker">Court access</span>
                  <h2 id="umpire-dialog-title">Umpire link · Court {{ umpireLinkModal.courtNumber }}</h2>
                </div>
              </div>
              <button #modalClose type="button" class="modal-close" (click)="closeUmpireLinkModal()" aria-label="Close umpire link dialog">
                <i class="fas fa-xmark" aria-hidden="true"></i>
              </button>
            </header>

            <p id="umpire-dialog-description" class="modal-description">This private link scores whichever match is currently assigned to Court {{ umpireLinkModal.courtNumber }}. No login is required.</p>

            @if (umpireLinkModal.generating) {
              <div class="qr-loading" role="status" aria-live="polite">
                <span><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i></span>
                <strong>Creating secure link</strong>
                <p>Generating a fresh QR code for this court…</p>
              </div>
            } @else if (umpireLinkModal.dataUrl) {
              <div class="qr-image-wrap">
                <img [src]="umpireLinkModal.dataUrl" alt="QR code for Court {{ umpireLinkModal.courtNumber }} umpire scoring" class="qr-image" />
              </div>
              <div class="security-note"><i class="fas fa-shield-halved" aria-hidden="true"></i> Regenerating invalidates the previous link for this court.</div>
              <div class="qr-modal-actions">
                <button type="button" class="secondary-action" (click)="regenerateUmpireLink()">
                  <i class="fas fa-rotate-right" aria-hidden="true"></i> Regenerate
                </button>
                <button type="button" class="primary-action" (click)="copyUmpireLink()" aria-live="polite">
                  <i class="fas fa-{{ umpireLinkModal.copied ? 'check' : 'copy' }}" aria-hidden="true"></i>
                  {{ umpireLinkModal.copied ? 'Link copied' : 'Copy link' }}
                </button>
              </div>
            }

            @if (umpireLinkModal.error) {
              <div class="modal-inline-error" role="alert">
                <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
                <span>{{ umpireLinkModal.error }}</span>
                @if (!umpireLinkModal.dataUrl) {
                  <button type="button" (click)="regenerateUmpireLink()">Try again</button>
                }
              </div>
            }
          </section>
        </div>
      }

      @if (loading) {
        <section class="state-card" role="status" aria-live="polite">
          <span class="state-icon loading-icon"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i></span>
          <h2>Loading match schedule</h2>
          <p>Syncing courts, fixtures, results, and standings…</p>
        </section>
      } @else if (error && !board) {
        <section class="state-card error-state" role="alert">
          <span class="state-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
          <h2>We couldn’t load the schedule</h2>
          <p>{{ error }}</p>
          <button type="button" class="secondary-action retry-action" (click)="retry()">
            <i class="fas fa-rotate-right" aria-hidden="true"></i> Try again
          </button>
        </section>
      } @else {
        @if (board?.locked) {
          <div class="notice-banner lock-banner" role="status">
            <span class="notice-icon"><i class="fas fa-lock" aria-hidden="true"></i></span>
            <div>
              <strong>Schedule locked</strong>
              <p>Match play has started. Fixtures and teams are frozen, but scores can still be recorded and corrected.</p>
            </div>
          </div>
        }

        @if (error) {
          <div class="notice-banner error-banner" role="alert">
            <span class="notice-icon"><i class="fas fa-circle-exclamation" aria-hidden="true"></i></span>
            <div><strong>Action unsuccessful</strong><p>{{ error }}</p></div>
            <button type="button" class="banner-retry" (click)="retry()">Refresh</button>
          </div>
        }

        @for (warning of warnings; track $index) {
          <div class="notice-banner warning-banner" role="status">
            <span class="notice-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
            <div><strong>Schedule notice</strong><p>{{ warning }}</p></div>
          </div>
        }

        @if (!hasSchedule()) {
          <section class="empty-schedule">
            <div class="empty-visual"><i class="fas fa-shuffle" aria-hidden="true"></i></div>
            <span class="section-kicker">Rotation builder</span>
            <h2>Ready to create the schedule?</h2>
            <p>Generate a complete round robin from the confirmed roster. Every pair meets once, with courts and start times assigned automatically.</p>

            <div class="readiness-grid" aria-label="Schedule readiness">
              <div><strong>{{ confirmedPairCount() }}</strong><span>Confirmed pairs</span></div>
              <div><strong>{{ projectedMatchCount() }}</strong><span>Projected matches</span></div>
              <div><strong>{{ board?.session?.numberOfCourts || 1 }}</strong><span>Available courts</span></div>
            </div>

            @if (confirmedPairCount() < 2) {
              <div class="readiness-note"><i class="fas fa-circle-info" aria-hidden="true"></i>At least two complete, confirmed pairs are required.</div>
            }

            <div class="empty-actions">
              <button type="button" class="secondary-action" (click)="goToTeams()">
                <i class="fas fa-people-group" aria-hidden="true"></i> Manage teams
              </button>
              <button type="button" class="primary-action" [disabled]="busy || confirmedPairCount() < 2" (click)="generate()">
                @if (busy) {<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>} @else {<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>}
                Generate schedule
              </button>
            </div>
          </section>
        } @else {
          <div class="schedule-workspace">
            <section class="panel fixtures-panel">
              <div class="panel-heading fixtures-heading">
                <div class="panel-title-wrap">
                  <span class="panel-icon lime"><i class="fas fa-calendar-days" aria-hidden="true"></i></span>
                  <div>
                    <span class="section-kicker">Match board</span>
                    <h2>Schedule</h2>
                    <p>{{ completedMatchCount() }} of {{ totalMatchCount() }} matches complete</p>
                  </div>
                </div>
                @if (!board?.locked) {
                  <button type="button" class="secondary-action regenerate-action" [disabled]="busy" (click)="generate()">
                    <i class="fas fa-rotate" aria-hidden="true"></i>
                    {{ scheduleNeedsRefresh() ? 'Refresh' : 'Regenerate' }}
                  </button>
                } @else {
                  <span class="lock-pill"><i class="fas fa-lock" aria-hidden="true"></i> Locked</span>
                }
              </div>

              @if (scheduleNeedsRefresh()) {
                <div class="stale-schedule-note" role="alert">
                  <i class="fas fa-arrows-rotate" aria-hidden="true"></i>
                  <div><strong>Roster changed</strong><span>Refresh the schedule so every confirmed pair is included.</span></div>
                </div>
              }

              <div class="schedule-progress">
                <div class="progress-copy"><span>Session progress</span><strong>{{ completionPercent() }}%</strong></div>
                <div class="progress-track" role="progressbar" aria-label="Match completion" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="completionPercent()">
                  <span [style.width.%]="completionPercent()"></span>
                </div>
              </div>

              @if (board?.session?.fixedDoubles?.matchDurationMinutes) {
                <div class="duration-note"><i class="far fa-clock" aria-hidden="true"></i> Match windows are auto-fitted to {{ board!.session.fixedDoubles!.matchDurationMinutes }} minutes.</div>
              }

              <nav class="schedule-tabs" aria-label="Schedule filters">
                <button type="button" [attr.aria-pressed]="viewFilter === 'now'" [class.active]="viewFilter === 'now'" [disabled]="nowMatchCount() === 0" (click)="setViewFilter('now')">
                  <span>Now</span><small>{{ nowMatchCount() }}</small>
                </button>
                <button type="button" [attr.aria-pressed]="viewFilter === 'upcoming'" [class.active]="viewFilter === 'upcoming'" [disabled]="(board?.upcomingMatches?.length || 0) === 0" (click)="setViewFilter('upcoming')">
                  <span>Upcoming</span><small>{{ board?.upcomingMatches?.length || 0 }}</small>
                </button>
                <button type="button" [attr.aria-pressed]="viewFilter === 'completed'" [class.active]="viewFilter === 'completed'" [disabled]="completedMatchCount() === 0" (click)="setViewFilter('completed')">
                  <span>Completed</span><small>{{ completedMatchCount() }}</small>
                </button>
                <button type="button" [attr.aria-pressed]="viewFilter === 'all'" [class.active]="viewFilter === 'all'" (click)="setViewFilter('all')">
                  <span>All</span><small>{{ totalMatchCount() }}</small>
                </button>
              </nav>

              @if ((board?.byesThisRound?.length || 0) > 0 && (viewFilter === 'now' || viewFilter === 'all')) {
                <div class="bye-note"><i class="fas fa-person-walking-arrow-right" aria-hidden="true"></i><span>{{ byeSummary() }}</span></div>
              }

              <div class="fixture-groups">
                @if ((viewFilter === 'now' || viewFilter === 'all') && (board?.currentMatches?.length || 0) > 0) {
                  <section class="fixture-group current-group" aria-labelledby="current-matches-heading">
                    <div class="group-heading">
                      <div><span class="group-dot amber-dot"></span><h3 id="current-matches-heading">Current courts</h3></div>
                      <span>{{ board!.currentMatches.length }}</span>
                    </div>
                    <div class="match-grid" role="list">
                      @for (fixture of board!.currentMatches; track fixture._id) {
                        <ng-container *ngTemplateOutlet="matchCard; context: { fixture }"></ng-container>
                      }
                    </div>
                  </section>
                }

                @if ((viewFilter === 'now' || viewFilter === 'all') && (board?.nextMatches?.length || 0) > 0) {
                  <section class="fixture-group next-group" aria-labelledby="next-matches-heading">
                    <div class="group-heading">
                      <div><span class="group-dot blue-dot"></span><h3 id="next-matches-heading">Next on court</h3></div>
                      <span>{{ board!.nextMatches.length }}</span>
                    </div>
                    <div class="match-grid" role="list">
                      @for (fixture of board!.nextMatches; track fixture._id) {
                        <ng-container *ngTemplateOutlet="matchCard; context: { fixture }"></ng-container>
                      }
                    </div>
                  </section>
                }

                @if ((viewFilter === 'upcoming' || viewFilter === 'all') && (board?.upcomingMatches?.length || 0) > 0) {
                  <section class="fixture-group upcoming-group" aria-labelledby="upcoming-matches-heading">
                    <div class="group-heading">
                      <div><span class="group-dot neutral-dot"></span><h3 id="upcoming-matches-heading">Upcoming</h3></div>
                      <span>{{ board!.upcomingMatches.length }}</span>
                    </div>
                    <div class="match-grid" role="list">
                      @for (fixture of board!.upcomingMatches; track fixture._id) {
                        <ng-container *ngTemplateOutlet="matchCard; context: { fixture }"></ng-container>
                      }
                    </div>
                  </section>
                }

                @if ((viewFilter === 'completed' || viewFilter === 'all') && completedMatchCount() > 0) {
                  <section class="fixture-group completed-group" aria-labelledby="completed-matches-heading">
                    <div class="group-heading">
                      <div><span class="group-dot lime-dot"></span><h3 id="completed-matches-heading">Completed</h3></div>
                      <span>{{ completedMatchCount() }}</span>
                    </div>
                    <div class="match-grid" role="list">
                      @for (fixture of board!.completedMatches; track fixture._id) {
                        <ng-container *ngTemplateOutlet="matchCard; context: { fixture }"></ng-container>
                      }
                    </div>
                  </section>
                }

                @if (!hasVisibleMatches()) {
                  <div class="filter-empty">
                    <i class="far fa-calendar" aria-hidden="true"></i>
                    <strong>No matches in this view</strong>
                    <span>Choose another schedule filter to continue.</span>
                  </div>
                }
              </div>
            </section>

            <aside class="side-column">
              <section class="panel operations-panel">
                <div class="panel-heading">
                  <div class="panel-title-wrap">
                    <span class="panel-icon blue"><i class="fas fa-tower-broadcast" aria-hidden="true"></i></span>
                    <div><span class="section-kicker">Match-day tools</span><h2>Operations</h2></div>
                  </div>
                </div>

                <button type="button" class="display-action" (click)="openTvDisplay()">
                  <span><i class="fas fa-tv" aria-hidden="true"></i></span>
                  <div><strong>Open TV display</strong><small>Public court and match board</small></div>
                  <i class="fas fa-arrow-up-right-from-square trailing-icon" aria-hidden="true"></i>
                </button>

                @if (board?.session?.sport === 'pickleball') {
                  <div class="tool-divider"></div>
                  <div class="court-tools-heading">
                    <div><strong>Umpire links</strong><span>Anonymous scoring access by court</span></div>
                    <i class="fas fa-shield-halved" aria-hidden="true"></i>
                  </div>
                  <div class="umpire-court-grid">
                    @for (court of courtNumbers(); track court) {
                      <button type="button" class="court-link-action" [class.live-court]="courtHasLiveMatch(court)" [attr.aria-label]="'Open umpire access for Court ' + court" [disabled]="busy" (click)="showUmpireLink(court)">
                        <span class="court-number">{{ court }}</span>
                        <span><strong>Court {{ court }}</strong><small>{{ courtHasLiveMatch(court) ? 'Live now' : 'Get link' }}</small></span>
                        <i class="fas fa-qrcode" aria-hidden="true"></i>
                      </button>
                    }
                  </div>
                }
              </section>

              <section class="panel swap-panel">
                <div class="panel-heading">
                  <div class="panel-title-wrap">
                    <span class="panel-icon amber"><i class="fas fa-right-left" aria-hidden="true"></i></span>
                    <div><span class="section-kicker">Reorder</span><h2>Swap Matches</h2></div>
                  </div>
                </div>
                <p class="panel-description">Exchange the court and time between two matches that haven't finished yet — works even after play has started.</p>

                @if (swappableFixtures().length < 2) {
                  <div class="inline-note"><i class="fas fa-circle-info" aria-hidden="true"></i>At least two not-yet-completed matches are required.</div>
                }

                <div class="swap-builder">
                  <label class="form-field" for="swap-match-a">
                    <span>Match</span>
                    <select id="swap-match-a" [(ngModel)]="swapFixtureAId" [disabled]="busy">
                      <option [ngValue]="null" disabled>Choose match</option>
                      @for (f of swappableFixtures(); track f._id) {
                        <option [ngValue]="f._id" [disabled]="f._id === swapFixtureBId">{{ matchOptionLabel(f) }}</option>
                      }
                    </select>
                  </label>

                  <span class="swap-divider" aria-hidden="true"><i class="fas fa-right-left"></i></span>

                  <label class="form-field" for="swap-match-b">
                    <span>With</span>
                    <select id="swap-match-b" [(ngModel)]="swapFixtureBId" [disabled]="busy">
                      <option [ngValue]="null" disabled>Choose match</option>
                      @for (f of swappableFixtures(); track f._id) {
                        <option [ngValue]="f._id" [disabled]="f._id === swapFixtureAId">{{ matchOptionLabel(f) }}</option>
                      }
                    </select>
                  </label>
                </div>

                @if (swapError) {
                  <div class="inline-note swap-error"><i class="fas fa-circle-exclamation" aria-hidden="true"></i>{{ swapError }}</div>
                }

                <button
                  type="button"
                  class="secondary-action swap-action"
                  [disabled]="busy || swappableFixtures().length < 2 || !swapFixtureAId || !swapFixtureBId || swapFixtureAId === swapFixtureBId"
                  (click)="swapMatches()"
                >
                  @if (busy) {<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>} @else {<i class="fas fa-right-left" aria-hidden="true"></i>}
                  Swap selected matches
                </button>
              </section>
            </aside>
          </div>
        }

        <section class="panel standalone-standings">
          <div class="lb-toolbar">
            <span class="lb-toolbar-title"><i class="fas fa-trophy" aria-hidden="true"></i> Standings</span>
            <span class="lb-count">{{ board?.standings?.length || 0 }} Ranked</span>
          </div>

          @if ((board?.standings?.length || 0) === 0) {
            <div class="standings-empty"><i class="fas fa-trophy" aria-hidden="true"></i><span>Standings appear after results are recorded.</span></div>
          } @else {
            <div class="lb-header">
              <span class="lb-header-spacer"></span>
              <span class="lb-col-label">W</span>
              <span class="lb-col-label">L</span>
            </div>
            <div class="lb-list">
              @for (standing of board!.standings; track standing.pairId) {
                <div class="lb-card" [class.rank-1]="standing.rank === 1" [class.rank-2]="standing.rank === 2" [class.rank-3]="standing.rank === 3">
                  @if (standing.rank === 1) { <span class="lb-trophy"><i class="fas fa-trophy" aria-hidden="true"></i></span> }
                  <span class="lb-rank">{{ standing.rank }}</span>
                  <span class="lb-name">{{ standing.pairLabel || 'Pair' }}</span>
                  <span class="lb-w">{{ standing.wins }}</span>
                  <span class="lb-l">{{ standing.losses }}</span>
                </div>
              }
            </div>
          }
        </section>
      }
    </div>

    <ng-template #matchCard let-fixture="fixture">
      <article
        class="match-card"
        role="listitem"
        [class.completed]="fixture.status === 'completed'"
        [class.in-progress]="fixture.status === 'in_progress'"
        [class.editor-open]="recordingFixtureId === fixture._id || editingFixtureId === fixture._id"
      >
        <header class="match-card-head">
          <div class="match-id">
            <span>Match {{ fixture.matchNumber }}</span>
            <small>Round {{ fixture.roundNumber }}</small>
          </div>
          <span class="status-pill" [ngClass]="fixture.status">
            @if (fixture.status === 'in_progress') {<i class="fas fa-circle fa-beat-fade" aria-hidden="true"></i>}
            @else if (fixture.status === 'completed') {<i class="fas fa-circle-check" aria-hidden="true"></i>}
            @else {<i class="far fa-clock" aria-hidden="true"></i>}
            {{ statusLabel(fixture.status) }}
          </span>
        </header>

        <div class="match-logistics">
          <span><i class="fas fa-table-tennis-paddle-ball" aria-hidden="true"></i>Court {{ fixture.courtNumber }}</span>
          <span><i class="far fa-clock" aria-hidden="true"></i>{{ fixture.scheduledStart | date: 'shortTime' }}–{{ fixture.scheduledEnd | date: 'shortTime' }}</span>
          @if (scoreCall(fixture); as call) {
            <span class="live-call-chip"><i class="fas fa-signal" aria-hidden="true"></i>Live {{ call }}</span>
          }
        </div>

        @if (recordingFixtureId === fixture._id || editingFixtureId === fixture._id) {
          <fieldset class="score-editor">
            <legend>{{ editingFixtureId === fixture._id ? 'Correct final score' : 'Record final score' }}</legend>
            <p>Enter non-negative whole numbers. The selected winner must have the higher score.</p>

            <div class="score-team-row">
              <button type="button" class="winner-pick" [class.picked]="tappedWinner === 'pair1'" [attr.aria-pressed]="tappedWinner === 'pair1'" [disabled]="busy" (click)="tappedWinner = tappedWinner === 'pair1' ? null : 'pair1'">
                <span class="team-avatar">{{ pairInitials(fixture.pair1) }}</span>
                <span><strong>{{ pairName(fixture.pair1) }}</strong><small>{{ tappedWinner === 'pair1' ? 'Selected winner' : 'Select winner' }}</small></span>
                <i class="fas fa-trophy" aria-hidden="true"></i>
              </button>
              <label class="score-field">
                <span>Score</span>
                <input type="number" min="0" step="1" inputmode="numeric" [(ngModel)]="scoreA" [attr.aria-label]="'Score for ' + pairName(fixture.pair1)" />
              </label>
            </div>

            <div class="score-team-row">
              <button type="button" class="winner-pick" [class.picked]="tappedWinner === 'pair2'" [attr.aria-pressed]="tappedWinner === 'pair2'" [disabled]="busy" (click)="tappedWinner = tappedWinner === 'pair2' ? null : 'pair2'">
                <span class="team-avatar blue-avatar">{{ pairInitials(fixture.pair2) }}</span>
                <span><strong>{{ pairName(fixture.pair2) }}</strong><small>{{ tappedWinner === 'pair2' ? 'Selected winner' : 'Select winner' }}</small></span>
                <i class="fas fa-trophy" aria-hidden="true"></i>
              </button>
              <label class="score-field">
                <span>Score</span>
                <input type="number" min="0" step="1" inputmode="numeric" [(ngModel)]="scoreB" [attr.aria-label]="'Score for ' + pairName(fixture.pair2)" />
              </label>
            </div>

            @if (scoreValidationMessage()) {
              <div class="score-validation" role="status"><i class="fas fa-circle-info" aria-hidden="true"></i>{{ scoreValidationMessage() }}</div>
            }

            <div class="score-actions">
              <button type="button" class="primary-action" [disabled]="busy || !canConfirmScore()" (click)="editingFixtureId === fixture._id ? confirmEdit(fixture) : confirmFinish(fixture)">
                @if (busy) {<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>} @else {<i class="fas fa-check" aria-hidden="true"></i>}
                {{ editingFixtureId === fixture._id ? 'Save correction' : 'Save result' }}
              </button>
              <button type="button" class="secondary-action" [disabled]="busy" (click)="cancelRecording()">Cancel</button>
            </div>
          </fieldset>
        } @else {
          <div class="matchup">
            <div class="team-line" [class.winner]="fixture.winnerPairId === fixture.pair1Id">
              <span class="team-avatar">{{ pairInitials(fixture.pair1) }}</span>
              <div><small>{{ fixture.winnerPairId === fixture.pair1Id ? 'Pair one · Winner' : isServingPair(1, fixture) ? 'Pair one · Serving' : 'Pair one' }}</small><strong>{{ pairName(fixture.pair1) }}</strong></div>
              @if (fixture.winnerPairId === fixture.pair1Id) {<i class="fas fa-trophy winner-icon" aria-hidden="true"></i>}
              @if (fixture.pair1Score !== null) {<span class="team-score" [class.live]="fixture.status === 'in_progress'">{{ fixture.pair1Score }}</span>}
            </div>
            <div class="versus-line"><span>{{ fixture.status === 'completed' ? 'Final' : fixture.pair1Score !== null ? 'Live' : 'vs' }}</span></div>
            <div class="team-line" [class.winner]="fixture.winnerPairId === fixture.pair2Id">
              <span class="team-avatar blue-avatar">{{ pairInitials(fixture.pair2) }}</span>
              <div><small>{{ fixture.winnerPairId === fixture.pair2Id ? 'Pair two · Winner' : isServingPair(2, fixture) ? 'Pair two · Serving' : 'Pair two' }}</small><strong>{{ pairName(fixture.pair2) }}</strong></div>
              @if (fixture.winnerPairId === fixture.pair2Id) {<i class="fas fa-trophy winner-icon" aria-hidden="true"></i>}
              @if (fixture.pair2Score !== null) {<span class="team-score" [class.live]="fixture.status === 'in_progress'">{{ fixture.pair2Score }}</span>}
            </div>
          </div>

          <footer class="match-actions">
            @if (fixture.status !== 'completed') {
              @if (canStartFixture(fixture)) {
                <button type="button" class="secondary-action" [disabled]="busy" (click)="startFixture(fixture)">
                  <i class="fas fa-play" aria-hidden="true"></i> Start
                </button>
              }
              <button type="button" class="primary-action" [disabled]="busy" (click)="beginRecording(fixture)">
                <i class="fas fa-pen-to-square" aria-hidden="true"></i> Record score
              </button>
            } @else {
              <button type="button" class="secondary-action edit-score-action" [disabled]="busy" (click)="beginEditing(fixture)">
                <i class="fas fa-pen" aria-hidden="true"></i> Edit score
              </button>
            }
          </footer>
        }
      </article>
    </ng-template>
  `,
  styles: [`
    :host { display: block; width: 100%; color: #fff; }

    .schedule-page {
      --surface: #12251d;
      --surface-soft: rgba(255, 255, 255, 0.045);
      --border: rgba(255, 255, 255, 0.1);
      --border-strong: rgba(255, 255, 255, 0.16);
      --muted: rgba(255, 255, 255, 0.62);
      --soft: rgba(255, 255, 255, 0.5);
      --lime: #a3e635;
      --lime-ink: #102006;
      width: 100%;
      max-width: 1050px;
      margin: 0 auto;
      padding-bottom: 4rem;
    }

    button, input { font: inherit; }
    button { -webkit-tap-highlight-color: transparent; }
    button:focus-visible, input:focus-visible {
      outline: 3px solid rgba(163, 230, 53, 0.34);
      outline-offset: 2px;
    }

    .schedule-hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      padding: clamp(1.15rem, 3vw, 2rem);
      border: 1px solid rgba(163, 230, 53, 0.16);
      border-radius: 24px;
      background:
        radial-gradient(circle at 88% 12%, rgba(163, 230, 53, 0.18), transparent 28%),
        radial-gradient(circle at 68% 112%, rgba(20, 184, 166, 0.13), transparent 34%),
        linear-gradient(140deg, #19382a 0%, #10271d 48%, #0a1c13 100%);
      box-shadow: 0 22px 55px rgba(0, 0, 0, 0.3);
    }

    .schedule-hero::after {
      position: absolute;
      z-index: -1;
      right: -58px;
      bottom: -84px;
      width: 270px;
      height: 270px;
      border: 1px solid rgba(163, 230, 53, 0.12);
      border-radius: 50%;
      box-shadow: 0 0 0 38px rgba(163, 230, 53, 0.025), 0 0 0 76px rgba(163, 230, 53, 0.016);
      content: '';
      pointer-events: none;
    }

    .hero-topbar, .hero-actions, .back-button, .hero-action, .session-meta,
    .metric-card, .panel-heading, .panel-title-wrap,
    .primary-action, .secondary-action, .stale-schedule-note,
    .duration-note, .bye-note, .group-heading, .group-heading > div,
    .match-card-head, .match-logistics, .team-line, .winner-pick,
    .match-actions, .score-actions, .display-action, .court-link-action,
    .court-tools-heading {
      display: flex;
      align-items: center;
    }

    .hero-topbar {
      position: relative;
      z-index: 1;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: clamp(1.5rem, 4vw, 2.6rem);
    }

    .hero-actions { gap: 0.5rem; }

    .back-button, .hero-action {
      min-height: 44px;
      gap: 0.5rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;
    }

    .back-button {
      padding: 0.6rem 0.75rem;
      border: 0;
      color: var(--muted);
      background: transparent;
    }

    .back-button:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }

    .hero-action {
      padding: 0.65rem 0.85rem;
      border: 1px solid var(--border-strong);
      color: #fff;
      background: rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(10px);
    }

    .hero-action:hover { border-color: rgba(163, 230, 53, 0.28); background: rgba(163, 230, 53, 0.1); }

    .hero-copy { position: relative; z-index: 1; max-width: 700px; }

    .eyebrow, .section-kicker {
      color: var(--lime);
      font-size: 0.7rem;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.38rem 0.65rem;
      border: 1px solid rgba(163, 230, 53, 0.22);
      border-radius: 999px;
      background: rgba(163, 230, 53, 0.08);
    }

    .hero-copy h1 {
      margin: 0.7rem 0 0;
      font-size: clamp(2rem, 5vw, 3.25rem);
      line-height: 1.02;
      letter-spacing: -0.045em;
    }

    .hero-copy > p {
      max-width: 640px;
      margin-top: 0.75rem;
      color: var(--muted);
      font-size: clamp(0.9rem, 1.8vw, 1rem);
      line-height: 1.6;
    }

    .session-meta {
      flex-wrap: wrap;
      gap: 0.55rem 1rem;
      margin-top: 1rem;
      color: rgba(255, 255, 255, 0.72);
      font-size: 0.78rem;
      font-weight: 650;
    }

    .session-meta span { display: inline-flex; align-items: center; gap: 0.4rem; }
    .session-meta i { color: var(--lime); }

    .metric-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.65rem;
      margin-top: clamp(1.5rem, 4vw, 2.3rem);
    }

    .metric-card {
      min-width: 0;
      gap: 0.7rem;
      padding: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      background: rgba(5, 17, 11, 0.48);
      backdrop-filter: blur(12px);
    }

    .metric-icon, .panel-icon {
      display: grid;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 11px;
    }

    .metric-icon { width: 38px; height: 38px; font-size: 0.9rem; }
    .panel-icon { width: 42px; height: 42px; font-size: 0.95rem; }
    .lime { color: var(--lime); background: rgba(163, 230, 53, 0.13); }
    .blue { color: #60a5fa; background: rgba(59, 130, 246, 0.13); }
    .amber { color: #fbbf24; background: rgba(245, 158, 11, 0.13); }
    .teal { color: #2dd4bf; background: rgba(20, 184, 166, 0.13); }

    .metric-card > div { min-width: 0; }
    .metric-card strong { display: block; color: #fff; font-size: 1.25rem; line-height: 1.1; }
    .metric-card strong small { margin-left: 0.15rem; color: var(--soft); font-size: 0.72em; }
    .metric-card div span { display: block; margin-top: 0.18rem; color: var(--soft); font-size: 0.7rem; font-weight: 750; }

    .schedule-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(310px, 0.82fr);
      align-items: start;
      gap: 1rem;
      margin-top: 1rem;
    }

    .panel {
      min-width: 0;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(18, 37, 29, 0.94);
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
    }

    .panel-heading { justify-content: space-between; gap: 0.85rem; }
    .panel-title-wrap { min-width: 0; gap: 0.75rem; }
    .panel-title-wrap > div { min-width: 0; }
    .panel-heading h2 { margin-top: 0.12rem; font-size: 1.05rem; line-height: 1.2; }
    .fixtures-heading p { margin-top: 0.18rem; color: var(--soft); font-size: 0.72rem; }

    .primary-action, .secondary-action {
      min-height: 44px;
      justify-content: center;
      gap: 0.48rem;
      padding: 0.62rem 0.85rem;
      border-radius: 10px;
      font-size: 0.76rem;
      font-weight: 900;
      cursor: pointer;
    }

    .primary-action { border: 1px solid var(--lime); color: var(--lime-ink); background: var(--lime); box-shadow: 0 7px 18px rgba(163, 230, 53, 0.16); }
    .primary-action:hover:not(:disabled) { background: #b5f040; }
    .secondary-action { border: 1px solid var(--border-strong); color: #fff; background: rgba(255, 255, 255, 0.055); }
    .secondary-action:hover:not(:disabled) { border-color: rgba(163, 230, 53, 0.28); background: rgba(163, 230, 53, 0.08); }
    button:disabled, input:disabled { cursor: not-allowed; opacity: 0.48; }

    .lock-pill, .count-pill {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.62rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 900;
    }

    .lock-pill { border: 1px solid rgba(245, 158, 11, 0.22); color: #fbbf24; background: rgba(245, 158, 11, 0.08); }
    .count-pill { border: 1px solid rgba(163, 230, 53, 0.2); color: var(--lime); background: rgba(163, 230, 53, 0.08); }

    .stale-schedule-note {
      gap: 0.6rem;
      margin-top: 0.85rem;
      padding: 0.7rem;
      border: 1px solid rgba(245, 158, 11, 0.22);
      border-radius: 11px;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.07);
    }

    .stale-schedule-note > div { display: flex; min-width: 0; flex-direction: column; gap: 0.12rem; }
    .stale-schedule-note strong { font-size: 0.75rem; }
    .stale-schedule-note span { color: #fde68a; font-size: 0.68rem; line-height: 1.4; }

    .schedule-progress { margin-top: 0.9rem; padding: 0.7rem; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 11px; background: rgba(255, 255, 255, 0.025); }
    .progress-copy { display: flex; justify-content: space-between; margin-bottom: 0.45rem; color: var(--muted); font-size: 0.7rem; font-weight: 750; }
    .progress-copy strong { color: var(--lime); }
    .progress-track { overflow: hidden; height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); }
    .progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #84cc16, var(--lime)); box-shadow: 0 0 12px rgba(163, 230, 53, 0.35); }

    .duration-note, .bye-note { gap: 0.45rem; margin-top: 0.7rem; color: var(--muted); font-size: 0.7rem; line-height: 1.4; }
    .duration-note i { color: #60a5fa; }
    .bye-note { padding: 0.65rem 0.7rem; border: 1px solid rgba(96, 165, 250, 0.16); border-radius: 10px; color: #bfdbfe; background: rgba(59, 130, 246, 0.06); }

    .schedule-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.35rem;
      margin-top: 0.9rem;
      padding: 0.3rem;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      background: rgba(3, 12, 8, 0.38);
    }

    .schedule-tabs button {
      display: flex;
      min-width: 0;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.45rem;
      border: 0;
      border-radius: 9px;
      color: var(--soft);
      background: transparent;
      font-size: 0.69rem;
      font-weight: 800;
      cursor: pointer;
    }

    .schedule-tabs button small { display: grid; min-width: 19px; height: 19px; padding: 0 0.28rem; place-items: center; border-radius: 999px; background: rgba(255, 255, 255, 0.06); font-size: 0.58rem; }
    .schedule-tabs button.active { color: var(--lime); background: rgba(163, 230, 53, 0.1); box-shadow: inset 0 0 0 1px rgba(163, 230, 53, 0.14); }

    .fixture-groups { display: flex; margin-top: 0.9rem; flex-direction: column; gap: 1rem; }
    .group-heading { justify-content: space-between; margin-bottom: 0.55rem; }
    .group-heading > div { gap: 0.45rem; }
    .group-heading h3 { font-size: 0.75rem; font-weight: 850; }
    .group-heading > span { color: var(--soft); font-size: 0.68rem; font-weight: 850; }
    .group-dot { width: 7px; height: 7px; border-radius: 50%; }
    .amber-dot { background: #f59e0b; box-shadow: 0 0 9px rgba(245, 158, 11, 0.6); }
    .blue-dot { background: #60a5fa; }
    .neutral-dot { background: rgba(255, 255, 255, 0.35); }
    .lime-dot { background: var(--lime); }

    .match-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; }

    .match-card {
      min-width: 0;
      padding: 0.8rem;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 15px;
      background: linear-gradient(145deg, rgba(163, 230, 53, 0.02), transparent 45%), rgba(255, 255, 255, 0.035);
    }

    .match-card.in-progress { border-color: rgba(245, 158, 11, 0.34); box-shadow: inset 0 2px 0 rgba(245, 158, 11, 0.55); }
    .match-card.completed { background: rgba(255, 255, 255, 0.025); }
    .match-card.editor-open { grid-column: 1 / -1; border-color: rgba(163, 230, 53, 0.24); background: rgba(163, 230, 53, 0.035); }

    .match-card-head { justify-content: space-between; gap: 0.55rem; padding-bottom: 0.55rem; border-bottom: 1px solid rgba(255, 255, 255, 0.07); }
    .match-id { min-width: 0; }
    .match-id span { display: block; font-size: 0.74rem; font-weight: 850; }
    .match-id small { display: block; margin-top: 0.1rem; color: var(--soft); font-size: 0.66rem; }

    .status-pill {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.3rem;
      padding: 0.3rem 0.48rem;
      border: 1px solid rgba(255, 255, 255, 0.11);
      border-radius: 999px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.045);
      font-size: 0.65rem;
      font-weight: 850;
    }

    .status-pill.in_progress { border-color: rgba(245, 158, 11, 0.22); color: #fbbf24; background: rgba(245, 158, 11, 0.08); }
    .status-pill.completed { border-color: rgba(163, 230, 53, 0.2); color: var(--lime); background: rgba(163, 230, 53, 0.08); }
    .status-pill .fa-circle { font-size: 0.45rem; }

    .match-logistics { flex-wrap: wrap; gap: 0.4rem 0.75rem; padding: 0.55rem 0; color: var(--soft); font-size: 0.65rem; font-weight: 700; }
    .match-logistics span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .match-logistics i { color: #93c5fd; }
    .live-call-chip { color: #fbbf24 !important; font-variant-numeric: tabular-nums; }
    .live-call-chip i { color: #fbbf24 !important; }

    .matchup { padding: 0.2rem 0; }
    .team-line { min-width: 0; gap: 0.55rem; padding: 0.5rem; border: 1px solid transparent; border-radius: 10px; }
    .team-line.winner { border-color: rgba(163, 230, 53, 0.16); background: rgba(163, 230, 53, 0.06); }
    .team-line > div { flex: 1; min-width: 0; }
    .team-line small { display: block; color: var(--soft); font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
    .team-line strong { display: block; margin-top: 0.08rem; overflow: hidden; font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; }

    .team-avatar {
      display: grid;
      flex: 0 0 auto;
      width: 32px;
      height: 32px;
      place-items: center;
      border: 1px solid rgba(163, 230, 53, 0.22);
      border-radius: 10px;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.1);
      font-size: 0.6rem;
      font-weight: 900;
    }

    .blue-avatar { border-color: rgba(96, 165, 250, 0.22); color: #93c5fd; background: rgba(59, 130, 246, 0.1); }
    .winner-icon { flex: 0 0 auto; color: #fbbf24; font-size: 0.7rem; }
    .team-score { flex: 0 0 auto; min-width: 28px; color: #fff; font-size: 1.15rem; font-weight: 900; text-align: right; }
    .team-score.live { color: #fbbf24; }

    .versus-line { position: relative; display: flex; align-items: center; justify-content: center; height: 12px; }
    .versus-line::before { position: absolute; right: 0; left: 0; height: 1px; content: ''; background: rgba(255, 255, 255, 0.06); }
    .versus-line span { position: relative; padding: 0 0.4rem; color: var(--soft); background: #172c23; font-size: 0.58rem; font-weight: 850; text-transform: uppercase; }

    .match-actions { justify-content: flex-end; gap: 0.45rem; margin-top: 0.55rem; padding-top: 0.55rem; border-top: 1px solid rgba(255, 255, 255, 0.07); }
    .match-actions .primary-action, .match-actions .secondary-action { min-height: 44px; padding: 0.5rem 0.62rem; font-size: 0.68rem; }
    .edit-score-action { width: 100%; }

    .score-editor { min-width: 0; margin-top: 0.25rem; padding: 0.7rem; border: 1px solid rgba(163, 230, 53, 0.16); border-radius: 12px; background: rgba(4, 15, 9, 0.32); }
    .score-editor legend { padding: 0 0.3rem; color: #fff; font-size: 0.78rem; font-weight: 850; }
    .score-editor > p { margin: 0 0 0.65rem; color: var(--soft); font-size: 0.68rem; line-height: 1.45; }
    .score-team-row { display: grid; grid-template-columns: minmax(0, 1fr) 76px; align-items: end; gap: 0.55rem; margin-top: 0.55rem; }

    .winner-pick {
      min-width: 0;
      min-height: 52px;
      gap: 0.55rem;
      padding: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      color: #fff;
      text-align: left;
      background: rgba(255, 255, 255, 0.04);
      cursor: pointer;
    }

    .winner-pick > span:nth-child(2) { flex: 1; min-width: 0; }
    .winner-pick strong { display: block; overflow: hidden; font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }
    .winner-pick small { display: block; margin-top: 0.08rem; color: var(--soft); font-size: 0.62rem; }
    .winner-pick > i { color: var(--soft); font-size: 0.7rem; }
    .winner-pick.picked { border-color: rgba(163, 230, 53, 0.34); background: rgba(163, 230, 53, 0.1); }
    .winner-pick.picked > i, .winner-pick.picked small { color: var(--lime); }

    .score-field { display: flex; min-width: 0; flex-direction: column; gap: 0.3rem; }
    .score-field > span { color: var(--muted); font-size: 0.66rem; font-weight: 800; }
    .score-field input { width: 100%; min-height: 52px; padding: 0.45rem; border: 1px solid var(--border); border-radius: 10px; color: #fff; text-align: center; background: rgba(255, 255, 255, 0.05); font-size: 1rem; font-weight: 850; }
    .score-field input:focus { border-color: rgba(163, 230, 53, 0.42); box-shadow: 0 0 0 3px rgba(163, 230, 53, 0.1); }
    .score-validation { display: flex; align-items: flex-start; gap: 0.4rem; margin-top: 0.6rem; color: #fbbf24; font-size: 0.67rem; line-height: 1.4; }
    .score-actions { justify-content: flex-end; gap: 0.5rem; margin-top: 0.7rem; }

    .filter-empty { display: flex; min-height: 180px; flex-direction: column; align-items: center; justify-content: center; color: var(--soft); text-align: center; }
    .filter-empty i { margin-bottom: 0.55rem; color: var(--lime); font-size: 1.15rem; }
    .filter-empty strong { color: #fff; font-size: 0.8rem; }
    .filter-empty span { margin-top: 0.25rem; font-size: 0.67rem; }

    .side-column { display: flex; min-width: 0; flex-direction: column; gap: 1rem; }

    .display-action {
      width: 100%;
      gap: 0.65rem;
      margin-top: 0.9rem;
      padding: 0.65rem;
      border: 1px solid rgba(96, 165, 250, 0.18);
      border-radius: 11px;
      color: #fff;
      text-align: left;
      background: rgba(59, 130, 246, 0.07);
      cursor: pointer;
    }

    .display-action > span { display: grid; flex: 0 0 auto; width: 36px; height: 36px; place-items: center; border-radius: 10px; color: #93c5fd; background: rgba(59, 130, 246, 0.12); }
    .display-action > div { flex: 1; min-width: 0; }
    .display-action strong, .court-link-action strong { display: block; font-size: 0.72rem; }
    .display-action small, .court-link-action small { display: block; margin-top: 0.1rem; color: var(--soft); font-size: 0.64rem; }
    .trailing-icon { color: var(--soft); font-size: 0.7rem; }

    .tool-divider { height: 1px; margin: 0.9rem 0; background: rgba(255, 255, 255, 0.07); }
    .court-tools-heading { justify-content: space-between; gap: 0.6rem; }
    .court-tools-heading > div { min-width: 0; }
    .court-tools-heading strong { display: block; font-size: 0.75rem; }
    .court-tools-heading span { display: block; margin-top: 0.15rem; color: var(--soft); font-size: 0.65rem; }
    .court-tools-heading > i { color: var(--lime); }

    .umpire-court-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.7rem; }
    .court-link-action { min-width: 0; min-height: 52px; gap: 0.45rem; padding: 0.45rem; border: 1px solid var(--border); border-radius: 10px; color: #fff; text-align: left; background: var(--surface-soft); cursor: pointer; }
    .court-link-action > span:nth-child(2) { flex: 1; min-width: 0; }
    .court-number { display: grid; flex: 0 0 auto; width: 28px; height: 28px; place-items: center; border-radius: 8px; color: var(--lime); background: rgba(163, 230, 53, 0.1); font-size: 0.68rem; font-weight: 900; }
    .court-link-action > i { color: var(--soft); font-size: 0.68rem; }
    .court-link-action.live-court { border-color: rgba(245, 158, 11, 0.24); background: rgba(245, 158, 11, 0.06); }
    .court-link-action.live-court .court-number { color: #fbbf24; background: rgba(245, 158, 11, 0.11); }

    .swap-panel { margin-top: 1rem; }
    .panel-description { margin: 0.4rem 0 0.85rem; color: var(--soft); font-size: 0.72rem; line-height: 1.45; }
    .inline-note { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem; padding: 0.6rem 0.75rem; border: 1px solid var(--border); border-radius: 10px; color: var(--soft); font-size: 0.68rem; line-height: 1.4; background: var(--surface-soft); }
    .inline-note i { color: var(--lime); }
    .inline-note.swap-error { border-color: rgba(248, 113, 113, 0.3); color: #fca5a5; background: rgba(248, 113, 113, 0.08); }
    .inline-note.swap-error i { color: #f87171; }

    .swap-builder { display: flex; flex-direction: column; gap: 0.55rem; }
    .form-field { display: flex; min-width: 0; flex-direction: column; gap: 0.35rem; }
    .form-field > span { color: var(--muted); font-size: 0.68rem; font-weight: 800; }
    .form-field select { width: 100%; min-height: 44px; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 10px; color: #fff; background: var(--surface-soft); font-size: 0.74rem; }
    .form-field select:focus { border-color: rgba(163, 230, 53, 0.42); box-shadow: 0 0 0 3px rgba(163, 230, 53, 0.1); outline: none; }
    .form-field option { color: #fff; background: #12251d; }
    .swap-divider { display: flex; align-items: center; justify-content: center; color: var(--soft); font-size: 0.8rem; }
    .swap-action { width: 100%; margin-top: 0.85rem; }

    .standalone-standings { margin-top: 1rem; padding: 1.35rem 1.5rem; }
    .lb-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.1rem; }
    .lb-toolbar-title { display: flex; align-items: center; gap: 0.6rem; font-size: 1.35rem; font-weight: 950; letter-spacing: -0.01em; text-transform: uppercase; color: #fff; }
    .lb-toolbar-title i { color: #fbbf24; }
    .lb-count { font-size: 0.78rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: var(--soft); }
    .lb-header { display: grid; grid-template-columns: 3rem 1fr 3rem 3rem; gap: 0.9rem; padding: 0 1.1rem; margin-bottom: 0.8rem; }
    .lb-header-spacer { grid-column: span 2; }
    .lb-col-label { text-align: center; font-size: 0.68rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: var(--soft); opacity: 0.75; }
    .lb-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .lb-card {
      position: relative; display: grid; grid-template-columns: 3rem 1fr 3rem 3rem; align-items: center; gap: 0.9rem;
      padding: 0.85rem 1.1rem; border-radius: 16px; background: rgba(255, 255, 255, 0.035); border: 1px solid var(--border);
    }
    .lb-card.rank-1 { border-color: rgba(251, 191, 36, 0.4); background: linear-gradient(135deg, rgba(251, 191, 36, 0.14), rgba(251, 191, 36, 0.02)); }
    .lb-card.rank-2 { border-color: rgba(203, 213, 225, 0.32); background: rgba(203, 213, 225, 0.06); }
    .lb-card.rank-3 { border-color: rgba(205, 127, 50, 0.35); background: rgba(205, 127, 50, 0.07); }
    .lb-rank { display: flex; align-items: center; justify-content: center; width: 2.4rem; height: 2.4rem; border-radius: 50%; background: rgba(255, 255, 255, 0.07); font-size: 1.05rem; font-weight: 900; color: var(--soft); }
    .lb-card.rank-1 .lb-rank { color: #1a1400; background: linear-gradient(145deg, #ffe873, #f5df18); }
    .lb-card.rank-2 .lb-rank { color: #1a1a1a; background: linear-gradient(145deg, #eef1f5, #c0c8d2); }
    .lb-card.rank-3 .lb-rank { color: #2a1200; background: linear-gradient(145deg, #e2a165, #cd7f32); }
    .lb-trophy {
      position: absolute; z-index: 1; top: 0.3rem; left: 2.65rem; width: 1.4rem; height: 1.4rem; border-radius: 50%;
      background: #f5df18; color: #1a1400; display: flex; align-items: center; justify-content: center;
      font-size: 0.68rem; box-shadow: 0 4px 10px rgba(245, 223, 24, 0.4);
    }
    .lb-name { font-size: 1.05rem; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lb-w, .lb-l { text-align: center; font-size: 1.1rem; font-weight: 900; font-variant-numeric: tabular-nums; }
    .lb-w { color: #4ade80; }
    .lb-l { color: #f87171; }
    .standings-empty { display: flex; min-height: 130px; flex-direction: column; align-items: center; justify-content: center; gap: 0.45rem; color: var(--soft); text-align: center; }
    .standings-empty i { color: #fbbf24; }
    .standings-empty span { max-width: 190px; font-size: 0.68rem; line-height: 1.45; }
    @media (max-width: 560px) {
      .lb-header, .lb-card { grid-template-columns: 2.2rem 1fr 2.4rem 2.4rem; gap: 0.55rem; padding-left: 0.75rem; padding-right: 0.75rem; }
      .lb-rank { width: 2rem; height: 2rem; font-size: 0.9rem; }
      .lb-trophy { left: 2.1rem; }
      .lb-name { overflow: visible; white-space: normal; text-overflow: clip; word-break: break-word; font-size: 0.86rem; line-height: 1.25; }
      .lb-w, .lb-l { font-size: 0.92rem; }
      .lb-toolbar-title { font-size: 1.15rem; }
      .lb-col-label { font-size: 0.6rem; }
    }

    @media (max-width: 980px) {
      .schedule-workspace { grid-template-columns: 1fr; }
      .side-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
    }

    @media (max-width: 720px) {
      .schedule-page { padding-bottom: calc(6rem + env(safe-area-inset-bottom)); }
      .schedule-hero { border-radius: 18px; }
      .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .match-grid { grid-template-columns: 1fr; }
      .side-column { display: flex; }
      .match-card.editor-open { grid-column: auto; }
    }

    @media (max-width: 520px) {
      .schedule-hero { padding: 0.85rem; }
      .hero-topbar { margin-bottom: 1.25rem; }
      .tv-top-action { display: none; }
      .back-button, .hero-action { padding-inline: 0.65rem; font-size: 0.74rem; }
      .hero-copy h1 { font-size: 1.9rem; }
      .hero-copy > p { font-size: 0.84rem; }
      .session-meta { gap: 0.45rem 0.75rem; font-size: 0.7rem; }
      .metric-card { gap: 0.55rem; padding: 0.65rem; }
      .metric-icon { width: 34px; height: 34px; }
      .metric-card strong { font-size: 1.05rem; }
      .panel { padding: 0.8rem; border-radius: 15px; }
      .panel-icon { width: 38px; height: 38px; }
      .fixtures-heading { align-items: flex-start; }
      .regenerate-action { min-width: 44px; padding-inline: 0.6rem; }
      .schedule-tabs { overflow-x: auto; grid-template-columns: repeat(4, minmax(76px, 1fr)); }
      .score-actions, .empty-actions { align-items: stretch; flex-direction: column; }
      .score-actions > button, .empty-actions > button { width: 100%; }
      .readiness-grid { gap: 0.4rem; }
      .readiness-grid div { padding: 0.65rem 0.35rem; }
      .notice-banner { align-items: flex-start; }
      .error-banner { flex-wrap: wrap; }
      .error-banner .banner-retry { width: 100%; justify-content: center; }
    }

    @media (max-width: 380px) {
      .hero-action span, .back-button span { max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .metric-card div span { font-size: 0.64rem; }
      .score-team-row { grid-template-columns: minmax(0, 1fr) 68px; }
      .match-actions { align-items: stretch; flex-direction: column; }
      .match-actions > button { width: 100%; min-height: 44px; }
      .qr-modal-actions { align-items: stretch; flex-direction: column; }
      .umpire-court-grid { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
    }
  `],
  styleUrls: ['./hosted-play-schedule-states.scss'],
})
export class AdminHostedPlayScheduleComponent implements OnInit, OnDestroy {
  id = '';
  board: FixedDoublesBoard | null = null;
  loading = true;
  busy = false;
  error = '';
  warnings: string[] = [];
  viewFilter: ScheduleView = 'now';

  recordingFixtureId: string | null = null;
  editingFixtureId: string | null = null;
  scoreA: number | null = null;
  scoreB: number | null = null;
  tappedWinner: 'pair1' | 'pair2' | null = null;

  umpireLinkModal: UmpireLinkModalState | null = null;

  swapFixtureAId: string | null = null;
  swapFixtureBId: string | null = null;
  swapError = '';

  @ViewChild('umpireDialog') private umpireDialog?: ElementRef<HTMLElement>;
  @ViewChild('modalClose') private modalClose?: ElementRef<HTMLButtonElement>;

  private pollSub?: Subscription;
  private filterInitialized = false;
  private copiedTimer?: ReturnType<typeof setTimeout>;
  private modalOpener?: HTMLElement;
  private umpireRequestId = 0;
  private errorKind: 'load' | 'action' | null = null;

  constructor(
    private hp: HostedPlayService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.fetchBoard(true);
    this.pollSub = this.hp.pollFixedDoublesBoard(this.id, 6000)
      .pipe(retryOnError({ count: Infinity, delay: 6000 }))
      .subscribe({ next: board => this.applyBoard(board, true) });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
  }

  @HostListener('document:keydown', ['$event'])
  handleModalKeydown(event: KeyboardEvent) {
    if (!this.umpireLinkModal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeUmpireLinkModal();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = this.umpireDialog?.nativeElement;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => !element.hasAttribute('hidden'));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  retry() {
    this.fetchBoard(!this.board);
  }

  private fetchBoard(showLoading = false) {
    if (showLoading) this.loading = true;
    this.error = '';
    this.errorKind = null;
    this.hp.getFixedDoublesBoard(this.id).subscribe({
      next: board => this.applyBoard(board),
      error: err => this.handleBoardError(err),
    });
  }

  private applyBoard(board: FixedDoublesBoard, preserveActionError = false) {
    this.board = board;
    this.loading = false;
    if (!preserveActionError || this.errorKind !== 'action') {
      this.error = '';
      this.errorKind = null;
    }
    if (board.warnings !== undefined) this.warnings = board.warnings;
    this.reconcileViewFilter();
    this.cdr.detectChanges();
  }

  private handleBoardError(err: any) {
    this.error = err?.error?.error || 'Unable to load schedule.';
    this.errorKind = 'load';
    this.loading = false;
    this.cdr.detectChanges();
  }

  private reconcileViewFilter() {
    if (!this.hasSchedule()) return;
    const currentViewCount = this.viewFilter === 'now'
      ? this.nowMatchCount()
      : this.viewFilter === 'upcoming'
        ? this.board?.upcomingMatches.length || 0
        : this.viewFilter === 'completed'
          ? this.completedMatchCount()
          : this.totalMatchCount();

    if (!this.filterInitialized || currentViewCount === 0) {
      if (this.nowMatchCount() > 0) this.viewFilter = 'now';
      else if ((this.board?.upcomingMatches.length || 0) > 0) this.viewFilter = 'upcoming';
      else if (this.completedMatchCount() > 0) this.viewFilter = 'completed';
      else this.viewFilter = 'all';
      this.filterInitialized = true;
    }
  }

  setViewFilter(view: ScheduleView) {
    this.viewFilter = view;
  }

  hasSchedule(): boolean {
    return this.totalMatchCount() > 0;
  }

  allFixtures(): FixedDoublesFixture[] {
    if (!this.board) return [];
    return [
      ...this.board.currentMatches,
      ...this.board.nextMatches,
      ...this.board.upcomingMatches,
      ...this.board.completedMatches,
    ];
  }

  totalMatchCount(): number {
    return this.allFixtures().length;
  }

  swappableFixtures(): FixedDoublesFixture[] {
    return this.allFixtures().filter(f => f.status !== 'completed');
  }

  matchOptionLabel(f: FixedDoublesFixture): string {
    const time = new Date(f.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Match ${f.matchNumber} · Court ${f.courtNumber} · ${time} — ${this.pairName(f.pair1)} vs ${this.pairName(f.pair2)}`;
  }

  swapMatches() {
    if (!this.swapFixtureAId || !this.swapFixtureBId || this.swapFixtureAId === this.swapFixtureBId) return;
    this.busy = true;
    this.swapError = '';
    this.hp.swapFixtures(this.id, this.swapFixtureAId, this.swapFixtureBId).subscribe({
      next: board => {
        this.swapFixtureAId = null;
        this.swapFixtureBId = null;
        this.busy = false;
        this.applyBoard(board);
      },
      error: err => {
        this.swapError = err?.error?.error || 'Unable to swap matches.';
        this.busy = false;
        this.cdr.detectChanges();
      },
    });
  }

  completedMatchCount(): number {
    return this.board?.completedMatches.length || 0;
  }

  liveMatchCount(): number {
    return this.board?.currentMatches.filter(fixture => fixture.status === 'in_progress').length || 0;
  }

  nowMatchCount(): number {
    return (this.board?.currentMatches.length || 0) + (this.board?.nextMatches.length || 0);
  }

  remainingMatchCount(): number {
    return Math.max(0, this.totalMatchCount() - this.completedMatchCount());
  }

  completionPercent(): number {
    const total = this.totalMatchCount();
    return total ? Math.round((this.completedMatchCount() / total) * 100) : 0;
  }

  confirmedPairCount(): number {
    return this.board?.pairs.filter(pair => pair.status === 'confirmed' && !!pair.participantAId && !!pair.participantBId).length || 0;
  }

  projectedMatchCount(): number {
    const pairs = this.confirmedPairCount();
    return pairs < 2 ? 0 : (pairs * (pairs - 1)) / 2;
  }

  hasVisibleMatches(): boolean {
    if (this.viewFilter === 'now') return this.nowMatchCount() > 0;
    if (this.viewFilter === 'upcoming') return (this.board?.upcomingMatches.length || 0) > 0;
    if (this.viewFilter === 'completed') return this.completedMatchCount() > 0;
    return this.totalMatchCount() > 0;
  }

  scheduleNeedsRefresh(): boolean {
    if (!this.board || !this.hasSchedule()) return false;
    const scheduledPairIds = new Set(this.allFixtures().flatMap(fixture => [fixture.pair1Id, fixture.pair2Id]));
    const confirmedPairIds = this.board.pairs
      .filter(pair => pair.status === 'confirmed' && !!pair.participantAId && !!pair.participantBId)
      .map(pair => pair._id);
    if (confirmedPairIds.length !== scheduledPairIds.size || confirmedPairIds.some(pairId => !scheduledPairIds.has(pairId))) return true;

    const generatedAt = this.board.session.fixedDoubles?.scheduleGeneratedAt;
    const pairsUpdatedAt = this.board.session.fixedDoubles?.pairsUpdatedAt;
    if (!generatedAt || !pairsUpdatedAt) return false;
    const generatedTime = Date.parse(generatedAt);
    const pairsUpdatedTime = Date.parse(pairsUpdatedAt);
    return Number.isFinite(generatedTime) && Number.isFinite(pairsUpdatedTime) && pairsUpdatedTime > generatedTime;
  }

  sessionTime(): string {
    const start = this.board?.session.startTime;
    const end = this.board?.session.endTime;
    if (start && end) return `${start}–${end}`;
    return start || end || '';
  }

  sportLabel(): string {
    const sport = this.board?.session.sport;
    if (!sport) return '';
    return sport.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  pairName(snapshot: FixturePairSnapshot | undefined): string {
    if (!snapshot) return '—';
    return snapshot.players.map(player => player.memberName).filter(Boolean).join(' & ') || snapshot.pairLabel || 'Pair';
  }

  pairInitials(snapshot: FixturePairSnapshot | undefined): string {
    return this.initials(snapshot?.pairLabel || this.pairName(snapshot));
  }

  isServingPair(pair: 1 | 2, fixture: FixedDoublesFixture): boolean {
    return fixture.status === 'in_progress' && fixture.servingPair === pair;
  }

  // Real pickleball score call: serving pair's score, receiving pair's score,
  // then server number (always 3-digit once a server is picked, since fixed
  // doubles is always 2-per-pair). Only meaningful for a live pickleball match.
  scoreCall(fixture: FixedDoublesFixture): string {
    if (fixture.status !== 'in_progress' || this.board?.session?.sport !== 'pickleball') return '';
    if (!fixture.servingPair || fixture.pair1Score === null || fixture.pair2Score === null) return '';
    const servingScore = fixture.servingPair === 1 ? fixture.pair1Score : fixture.pair2Score;
    const receivingScore = fixture.servingPair === 1 ? fixture.pair2Score : fixture.pair1Score;
    return fixture.serverNumber ? `${servingScore}-${receivingScore}-${fixture.serverNumber}` : `${servingScore}-${receivingScore}`;
  }

  initials(value: string): string {
    return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'P';
  }

  statusLabel(status: string): string {
    if (status === 'in_progress') return 'In progress';
    if (status === 'completed') return 'Completed';
    return 'Waiting';
  }

  byeSummary(): string {
    if (!this.board?.byesThisRound.length) return '';
    const round = this.board.byesThisRound[0].roundNumber;
    const labels = this.board.byesThisRound.map(bye => {
      const pair = this.board?.pairs.find(candidate => candidate._id === bye.pairId);
      return pair?.pairLabel || 'A pair';
    });
    return `Round ${round} bye: ${labels.join(', ')}`;
  }

  courtHasLiveMatch(courtNumber: number): boolean {
    return !!this.board?.currentMatches.some(fixture => fixture.courtNumber === courtNumber && fixture.status === 'in_progress');
  }

  canStartFixture(fixture: FixedDoublesFixture): boolean {
    if (!this.board || fixture.status !== 'scheduled') return false;
    const isCurrentForCourt = this.board.currentMatches.some(candidate => candidate._id === fixture._id);
    const courtIsBusy = this.board.currentMatches.some(candidate =>
      candidate._id !== fixture._id &&
      candidate.courtNumber === fixture.courtNumber &&
      candidate.status === 'in_progress',
    );
    return isCurrentForCourt && !courtIsBusy;
  }

  generate() {
    if (this.hasSchedule() && !confirm('Regenerate this schedule? All unstarted fixtures will be replaced with a fresh rotation.')) return;
    this.busy = true;
    this.error = '';
    this.errorKind = null;
    this.hp.generateFixedDoublesSchedule(this.id).subscribe({
      next: board => {
        this.busy = false;
        this.filterInitialized = false;
        this.applyBoard(board);
      },
      error: err => {
        this.error = err?.error?.error || 'Unable to generate schedule.';
        this.errorKind = 'action';
        this.busy = false;
        this.cdr.detectChanges();
      },
    });
  }

  startFixture(fixture: FixedDoublesFixture) {
    if (!this.canStartFixture(fixture)) return;
    this.busy = true;
    this.error = '';
    this.errorKind = null;
    this.hp.startFixture(this.id, fixture._id).subscribe({
      next: board => { this.busy = false; this.applyBoard(board); },
      error: err => { this.error = err?.error?.error || 'Unable to start match.'; this.errorKind = 'action'; this.busy = false; this.cdr.detectChanges(); },
    });
  }

  beginRecording(fixture: FixedDoublesFixture) {
    this.recordingFixtureId = fixture._id;
    this.editingFixtureId = null;
    // Pre-fill with whatever the umpire live-scoring link has already
    // recorded for this match (pair1Score/pair2Score double as the live score
    // while a fixture is in_progress) — an admin taking over mid-game should
    // see the current score, not a blank form.
    this.scoreA = fixture.pair1Score;
    this.scoreB = fixture.pair2Score;
    this.tappedWinner = null;
    this.cdr.detectChanges();
  }

  beginEditing(fixture: FixedDoublesFixture) {
    this.editingFixtureId = fixture._id;
    this.recordingFixtureId = null;
    this.scoreA = fixture.pair1Score;
    this.scoreB = fixture.pair2Score;
    this.tappedWinner = fixture.winnerPairId === fixture.pair1Id ? 'pair1' : fixture.winnerPairId === fixture.pair2Id ? 'pair2' : null;
    this.cdr.detectChanges();
  }

  cancelRecording() {
    this.recordingFixtureId = null;
    this.editingFixtureId = null;
    this.scoreA = null;
    this.scoreB = null;
    this.tappedWinner = null;
    this.cdr.detectChanges();
  }

  scoreValidationMessage(): string {
    if (this.scoreA === null || this.scoreB === null) return '';
    if (!Number.isInteger(this.scoreA) || !Number.isInteger(this.scoreB) || this.scoreA < 0 || this.scoreB < 0) {
      return 'Scores must be non-negative whole numbers.';
    }
    if (this.scoreA === this.scoreB) return 'Scores cannot be tied. Enter the final winning score.';
    if (this.tappedWinner === 'pair1' && this.scoreA <= this.scoreB) return 'The selected winner must have the higher score.';
    if (this.tappedWinner === 'pair2' && this.scoreB <= this.scoreA) return 'The selected winner must have the higher score.';
    return '';
  }

  canConfirmScore(): boolean {
    return this.scoreA !== null && this.scoreB !== null && !this.scoreValidationMessage();
  }

  private selectedWinnerPairId(fixture: FixedDoublesFixture): string | undefined {
    if (this.tappedWinner === 'pair1') return fixture.pair1Id;
    if (this.tappedWinner === 'pair2') return fixture.pair2Id;
    return undefined;
  }

  confirmFinish(fixture: FixedDoublesFixture) {
    if (!this.canConfirmScore()) return;
    this.busy = true;
    this.error = '';
    this.errorKind = null;
    this.hp.finishFixture(this.id, fixture._id, this.scoreA!, this.scoreB!, this.selectedWinnerPairId(fixture)).subscribe({
      next: board => { this.cancelRecording(); this.busy = false; this.applyBoard(board); },
      error: err => { this.error = err?.error?.error || 'Unable to save score.'; this.errorKind = 'action'; this.busy = false; this.cdr.detectChanges(); },
    });
  }

  confirmEdit(fixture: FixedDoublesFixture) {
    if (!this.canConfirmScore()) return;
    this.busy = true;
    this.error = '';
    this.errorKind = null;
    this.hp.updateFixtureScore(this.id, fixture._id, this.scoreA!, this.scoreB!, this.selectedWinnerPairId(fixture)).subscribe({
      next: board => { this.cancelRecording(); this.busy = false; this.applyBoard(board); },
      error: err => { this.error = err?.error?.error || 'Unable to update score.'; this.errorKind = 'action'; this.busy = false; this.cdr.detectChanges(); },
    });
  }

  goBack() { this.router.navigate(['/admin/hosted-play']); }
  goToTeams() { this.router.navigate(['/admin/hosted-play', this.id, 'teams']); }

  openTvDisplay() {
    window.open(`/admin/hosted-play/${this.id}/schedule/display`, '_blank');
  }

  courtNumbers(): number[] {
    const count = this.board?.session.numberOfCourts || 1;
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  showUmpireLink(courtNumber: number) {
    this.error = '';
    this.errorKind = null;
    const requestId = ++this.umpireRequestId;
    this.modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.umpireLinkModal = { courtNumber, generating: true };
    this.cdr.detectChanges();
    setTimeout(() => this.modalClose?.nativeElement.focus());
    this.hp.generateUmpireLink(this.id, courtNumber).subscribe({
      next: ({ url }) => this.renderUmpireLink(courtNumber, url, requestId),
      error: err => {
        if (requestId !== this.umpireRequestId || !this.umpireLinkModal) return;
        this.umpireLinkModal = { courtNumber, generating: false, error: err?.error?.error || 'Unable to generate the umpire link.' };
        this.cdr.detectChanges();
      },
    });
  }

  regenerateUmpireLink() {
    if (!this.umpireLinkModal) return;
    const courtNumber = this.umpireLinkModal.courtNumber;
    const requestId = ++this.umpireRequestId;
    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
      this.copiedTimer = undefined;
    }
    this.umpireLinkModal = { courtNumber, generating: true };
    this.cdr.detectChanges();
    this.hp.generateUmpireLink(this.id, courtNumber).subscribe({
      next: ({ url }) => this.renderUmpireLink(courtNumber, url, requestId),
      error: err => {
        if (requestId !== this.umpireRequestId || !this.umpireLinkModal) return;
        this.umpireLinkModal = { courtNumber, generating: false, error: err?.error?.error || 'Unable to regenerate the umpire link.' };
        this.cdr.detectChanges();
      },
    });
  }

  private renderUmpireLink(courtNumber: number, url: string, requestId: number) {
    QRCode.toDataURL(url, { width: 440, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((dataUrl: string) => {
        if (requestId !== this.umpireRequestId || !this.umpireLinkModal) return;
        this.umpireLinkModal = { courtNumber, generating: false, dataUrl, url };
        this.cdr.detectChanges();
      })
      .catch(() => {
        if (requestId !== this.umpireRequestId || !this.umpireLinkModal) return;
        this.umpireLinkModal = { courtNumber, generating: false, error: 'Unable to render the umpire QR code.' };
        this.cdr.detectChanges();
      });
  }

  // navigator.clipboard is only defined in secure contexts (HTTPS, or
  // localhost) — on mobile, opening this over a plain-HTTP LAN IP (e.g.
  // testing on a phone against http://192.168.x.x:4200) leaves it undefined,
  // which throws synchronously before any .then()/.catch() ever runs. Fall
  // back to the classic hidden-textarea + execCommand('copy') technique,
  // which works without a secure context.
  private copyTextToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      try {
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        ok ? resolve() : reject(new Error('execCommand copy failed'));
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  copyUmpireLink() {
    const url = this.umpireLinkModal?.url;
    if (!url || !this.umpireLinkModal) return;
    this.copyTextToClipboard(url).then(() => {
      if (!this.umpireLinkModal) return;
      this.umpireLinkModal = { ...this.umpireLinkModal, copied: true, error: undefined };
      this.cdr.detectChanges();
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        if (this.umpireLinkModal) {
          this.umpireLinkModal = { ...this.umpireLinkModal, copied: false };
          this.cdr.detectChanges();
        }
      }, 2000);
    }).catch(() => {
      if (this.umpireLinkModal) {
        this.umpireLinkModal = { ...this.umpireLinkModal, error: 'Unable to copy the umpire link. Please try again.' };
      }
      this.cdr.detectChanges();
    });
  }

  closeUmpireLinkModal() {
    const opener = this.modalOpener;
    this.umpireRequestId += 1;
    this.umpireLinkModal = null;
    this.modalOpener = undefined;
    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
      this.copiedTimer = undefined;
    }
    this.cdr.detectChanges();
    setTimeout(() => opener?.focus());
  }
}
