import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal } from '@angular/core';
import QRCode from 'qrcode';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, interval, EMPTY } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import {
  HostedPlayService,
  HostedPlayMatch,
  MatchPlayer,
  QueueBoard,
  QueueCourt,
  QueuePlayer,
  splitCourtTeams,
} from '../../../../core/services/hosted-play.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ClubService, Court } from '../../../../core/services/club.service';
import { CreditService, MemberBalance } from '../../../../core/services/credit.service';
import { DuprService, DuprMatchSubmission } from '../../../../core/services/dupr.service';
import { ImportParticipantsModalComponent } from './import-participants-modal.component';

@Component({
  selector: 'app-admin-hosted-play-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportParticipantsModalComponent],
  template: `
    <div class="queue-shell">
      <header class="topbar">
        <button class="back-btn" (click)="goBack()" aria-label="Back to hosted play">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="topbar-copy">
          <span class="topbar-kicker">Hosted Play Queue</span>
          <h1>{{ board?.session?.title || 'Queue Board' }}</h1>
        </div>
        <span class="status-pill" [ngClass]="board?.session?.queueStatus">
          <span class="status-dot"></span>{{ statusLabel() }}
        </span>
        <button class="tv-display-btn" (click)="openTvDisplay()" title="Open big-screen display">
          <i class="fas fa-tv"></i> <span class="tv-display-label">TV Display</span>
        </button>
      </header>

      @if (modal) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-icon" [class.modal-icon-danger]="modal.type === 'remove'" [class.modal-icon-end]="modal.type === 'end'">
              <i [class]="modal.type === 'remove' ? 'fas fa-user-xmark' : 'fas fa-flag-checkered'"></i>
            </div>
            <div class="modal-body">
              <p class="modal-title">{{ modal.type === 'remove' ? 'Remove Player' : 'End Session' }}</p>
              <p class="modal-msg">{{ modal.type === 'remove'
                ? 'Remove ' + modal.player!.memberName + ' from the queue? They can be re-added as a walk-in.'
                : 'End this session? The queue will close and attendance will be saved.' }}</p>
            </div>
            <div class="modal-actions">
              <button class="modal-cancel" (click)="closeModal()">Cancel</button>
              <button class="modal-confirm" [class.modal-confirm-danger]="modal.type === 'remove'" [class.modal-confirm-end]="modal.type === 'end'" (click)="confirmModal()">
                {{ modal.type === 'remove' ? 'Remove' : 'End Session' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (qrModal) {
        <div class="modal-backdrop" (click)="closeQrModal()">
          <div class="modal-card qr-modal-card" (click)="$event.stopPropagation()">
            <div class="qr-modal-header">
              <div>
                <p class="modal-title">QR Check-In Code</p>
                <p class="modal-msg">Players scan this to self-check-in.</p>
              </div>
              <button class="qr-close-btn" (click)="closeQrModal()" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            @if (qrModal.generating) {
              <div class="qr-loading"><i class="fas fa-circle-notch fa-spin"></i> Generating…</div>
            } @else if (qrModal.dataUrl) {
              <div class="qr-image-wrap">
                <img [src]="qrModal.dataUrl" alt="QR check-in code" class="qr-image" />
              </div>
              <div class="qr-modal-actions">
                <button class="secondary-btn" (click)="regenerateQr()" [disabled]="qrModal.generating">
                  <i class="fas fa-rotate-right"></i> Regenerate
                </button>
                <a class="primary-small qr-download-btn" [href]="qrModal.downloadUrl || qrModal.dataUrl" [download]="'checkin-qr-' + id + '.png'">
                  <i class="fas fa-download"></i> Download
                </a>
              </div>
            }
          </div>
        </div>
      }

      @if (importModalOpen()) {
        <app-import-participants-modal
          [sessionId]="id"
          (closed)="closeImportModal()"
          (imported)="onImported($event)"
        />
      }

      @if (umpireLinkModal) {
        <div class="modal-backdrop" (click)="closeUmpireLinkModal()">
          <div class="modal-card qr-modal-card" (click)="$event.stopPropagation()">
            <div class="qr-modal-header">
              <div>
                <p class="modal-title">Umpire Link — Court {{ umpireLinkModal.courtNumber }}</p>
                <p class="modal-msg">Share this with whoever is officiating Court {{ umpireLinkModal.courtNumber }} — they can enter live scores without logging in. This link only scores this court.</p>
              </div>
              <button class="qr-close-btn" (click)="closeUmpireLinkModal()" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            @if (umpireLinkModal.generating) {
              <div class="qr-loading"><i class="fas fa-circle-notch fa-spin"></i> Generating…</div>
            } @else if (umpireLinkModal.dataUrl) {
              <div class="qr-image-wrap">
                <img [src]="umpireLinkModal.dataUrl" alt="Umpire scoring link QR code" class="qr-image" />
              </div>
              <div class="qr-modal-actions">
                <button class="secondary-btn" (click)="regenerateUmpireLink()" [disabled]="umpireLinkModal.generating">
                  <i class="fas fa-rotate-right"></i> Regenerate
                </button>
                <button class="primary-small" (click)="copyUmpireLink()">
                  <i class="fas fa-{{ umpireLinkModal.copied ? 'check' : 'copy' }}"></i> {{ umpireLinkModal.copied ? 'Copied' : 'Copy Link' }}
                </button>
              </div>
            }
          </div>
        </div>
      }

      @if (scoreModal) {
        <div class="modal-backdrop" (click)="closeScoreModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-body">
              <p class="modal-title">{{ scoreModal.match.team1Score === null ? 'Add Score' : 'Edit Score' }}</p>
              <p class="modal-msg">Court {{ scoreModal.match.courtNumber }} · {{ teamNames(scoreModal.match.team1) }} vs {{ teamNames(scoreModal.match.team2) }}</p>
              <div class="score-fields">
                <label class="score-field">
                  <span>{{ teamNames(scoreModal.match.team1) }}</span>
                  <input type="number" min="0" inputmode="numeric" [(ngModel)]="scoreModal.s1" [disabled]="scoreModal.saving" />
                </label>
                <span class="score-dash">–</span>
                <label class="score-field">
                  <span>{{ teamNames(scoreModal.match.team2) }}</span>
                  <input type="number" min="0" inputmode="numeric" [(ngModel)]="scoreModal.s2" [disabled]="scoreModal.saving" />
                </label>
              </div>
              @if (scoreModal.error) { <p class="score-error"><i class="fas fa-exclamation-triangle"></i> {{ scoreModal.error }}</p> }
              @if (!scoreModal.error && scoreModalAdvisory()) { <p class="score-hint">{{ scoreModalAdvisory() }}</p> }
            </div>
            <div class="modal-actions">
              <button class="modal-cancel" [disabled]="scoreModal.saving" (click)="closeScoreModal()">Cancel</button>
              <button class="modal-confirm modal-confirm-save" [disabled]="scoreModal.saving" (click)="saveScore()">
                {{ scoreModal.saving ? 'Saving…' : 'Save Score' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (duprActionModal; as dam) {
        <div class="modal-backdrop" (click)="closeDuprActionModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-body">
              @if (dam.mode === 'dispute') {
                <p class="modal-title">Dispute DUPR Submission</p>
                <p class="modal-msg">Freezes retries until resolved. Describe the issue:</p>
                <textarea class="dupr-modal-textarea" rows="3" [(ngModel)]="dam.reason" [disabled]="dam.saving" placeholder="e.g. wrong players, incorrect score"></textarea>
              } @else {
                <p class="modal-title">Resolve Dispute</p>
                <p class="modal-msg">Optionally correct the score, then resubmit to DUPR.</p>
                <div class="score-fields">
                  <label class="score-field">
                    <span>Team 1</span>
                    <input type="number" min="0" inputmode="numeric" [(ngModel)]="dam.s1" [disabled]="dam.saving" />
                  </label>
                  <span class="score-dash">–</span>
                  <label class="score-field">
                    <span>Team 2</span>
                    <input type="number" min="0" inputmode="numeric" [(ngModel)]="dam.s2" [disabled]="dam.saving" />
                  </label>
                </div>
              }
              @if (dam.error) { <p class="score-error"><i class="fas fa-exclamation-triangle"></i> {{ dam.error }}</p> }
            </div>
            <div class="modal-actions">
              <button class="modal-cancel" [disabled]="dam.saving" (click)="closeDuprActionModal()">Cancel</button>
              <button class="modal-confirm modal-confirm-save" [disabled]="dam.saving" (click)="submitDuprActionModal()">
                {{ dam.saving ? 'Saving…' : (dam.mode === 'dispute' ? 'Submit Dispute' : 'Resolve & Resubmit') }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (loading) {
        <div class="state-card"><i class="fas fa-circle-notch fa-spin"></i> Loading queue...</div>
      } @else if (!board) {
        <div class="state-card state-card-error"><i class="fas fa-triangle-exclamation"></i> {{ error || 'Unable to load the queue.' }}</div>
      } @else {
        <main class="queue-page">
          <section class="hero-panel">
            <div class="hero-main">
              <span class="eyebrow"><i class="fas fa-table-list"></i> Live operations</span>
              <div class="hero-title">
                <div class="venue-mark">
                  @if (venueLogo()) {
                    <img [src]="venueLogo()" [alt]="venueLabel()" class="venue-logo-img" />
                  } @else {
                    <span class="venue-initials">{{ venueInitials() }}</span>
                  }
                </div>
                <h2>{{ board.session.title }}</h2>
              </div>
              <p>{{ heroHint() }}</p>
            </div>
            <div class="hero-actions">
              @if (board.session.queueStatus === 'not_started') {
                <button class="primary-action" [disabled]="busy || board.counts.checkedIn < 1" (click)="startQueue()">
                  <i class="fas fa-play"></i> Start Queue
                </button>
              } @else if (board.session.queueStatus !== 'ended') {
                <button class="danger-action" [disabled]="busy" (click)="endSession()">
                  <i class="fas fa-flag-checkered"></i> End Session
                </button>
              } @else {
                <span class="ended-note"><i class="fas fa-circle-check"></i> Session completed</span>
              }
              <span class="sync-note">
                @if (busy) { <i class="fas fa-circle-notch fa-spin"></i> Updating }
                @else {
                  <button class="refresh-btn" [disabled]="busy" (click)="refresh()">
                    <i class="fas fa-rotate-right"></i> Refresh
                  </button>
                  @if (lastUpdated) { <span class="updated-ts">{{ lastUpdated }}</span> }
                }
              </span>
            </div>
          </section>

          <section class="stats-grid" aria-label="Queue summary">
            <div class="stat-card">
              <span class="stat-icon lime"><i class="fas fa-user-check"></i></span>
              <span class="stat-value">{{ board.counts.checkedIn }}</span>
              <span class="stat-label">Checked in</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon teal"><i class="fas fa-list-ol"></i></span>
              <span class="stat-value">{{ board.counts.waiting }}</span>
              <span class="stat-label">Waiting</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon blue"><i class="fas fa-table-tennis-paddle-ball"></i></span>
              <span class="stat-value">{{ board.counts.activeGames }}</span>
              <span class="stat-label">Active games</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon amber"><i class="fas fa-pause"></i></span>
              <span class="stat-value">{{ board.counts.paused }}</span>
              <span class="stat-label">Paused</span>
            </div>
          </section>

          @if (error) {
            <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ error }}</div>
          }

          <div class="content-grid">
            <div class="primary-column">
              @if (board.session.queueStatus !== 'not_started') {
                <section class="panel">
                  <div class="panel-head">
                    <div>
                      <span class="panel-kicker">Courts</span>
                      <h3>Active Court Board</h3>
                    </div>
                    <span class="panel-count">{{ board.session.numberOfCourts }} courts</span>
                  </div>

                  @if (scorePrompt) {
                    <div class="score-prompt">
                      <i class="fas fa-clipboard-check"></i>
                      <span class="score-prompt-msg">Game on Court {{ scorePrompt.courtNumber }} recorded.</span>
                      <button class="text-action" (click)="promptScore()">Add score</button>
                      <button class="score-prompt-dismiss" title="Dismiss" (click)="dismissScorePrompt()"><i class="fas fa-xmark"></i></button>
                    </div>
                  }

                  @if (movingPlayer) {
                    <div class="move-banner">
                      <i class="fas fa-right-left"></i>
                      <span class="move-banner-msg">Moving <strong>{{ movingPlayer.memberName }}</strong> — tap a player to swap, or an open slot to move.</span>
                      <button class="score-prompt-dismiss" title="Cancel" (click)="cancelMove()"><i class="fas fa-xmark"></i></button>
                    </div>
                  }

                  <div class="courts-grid">
                    @for (c of board.courts; track c.courtNumber) {
                      <article class="court-card" [class.empty]="c.players.length === 0">
                        <div class="court-top">
                          <span class="court-title">
                            Court {{ c.courtNumber }}
                            @if (board.session.sport === 'pickleball') {
                              <button class="umpire-link-btn" (click)="showUmpireLink(c.courtNumber)" title="Get a link an umpire can use to score this court, no login required">
                                <i class="fas fa-gavel"></i> Umpire Link
                              </button>
                            }
                          </span>
                          @if (c.players.length > 0 && board.session.queueStatus === 'running') {
                            <div class="court-top-actions">
                              @if (selectingWinnerCourt === c.courtNumber) {
                                <button class="finish-btn finish-btn--confirm" [disabled]="busy || winnerIds.size === 0 || !!finishScoreHint()" (click)="confirmFinishWinners(c.courtNumber)">
                                  <i class="fas fa-trophy"></i> Finish ({{ winnerIds.size }} won)
                                </button>
                                <button class="finish-btn finish-btn--cancel" [disabled]="busy" (click)="cancelFinish()">Cancel</button>
                              } @else if (confirmingFinishCourt === c.courtNumber) {
                                <button class="finish-btn finish-btn--confirm" [disabled]="busy" (click)="confirmFinish(c.courtNumber)">
                                  <i class="fas fa-exclamation"></i> Confirm?
                                </button>
                                <button class="finish-btn finish-btn--cancel" [disabled]="busy" (click)="cancelFinish()">
                                  Cancel
                                </button>
                              } @else {
                                @if (c.players.length < board.session.playersPerCourt) {
                                  <button class="add-player-btn" [disabled]="busy" (click)="beginAssign(c.courtNumber)" title="Fill open slot">
                                    <i class="fas fa-user-plus"></i> Add Player
                                  </button>
                                }
                                <button class="finish-btn" [disabled]="busy" (click)="requestFinish(c.courtNumber)">
                                  <i class="fas fa-check"></i> Finish
                                </button>
                              }
                            </div>
                          }
                        </div>

                        @if (c.players.length === 0) {
                          <div class="empty-court">
                            <i class="fas fa-hourglass-half"></i>
                            <span>Waiting for players</span>
                            @if (board.session.queueStatus === 'running' && !movingPlayer) {
                              <button class="text-action" [disabled]="busy" (click)="beginAssign(c.courtNumber)">Assign manually</button>
                            }
                          </div>
                          @if (movingPlayer) {
                            <div class="free-slots">
                              @for (fs of freeSlotsFor(c); track fs.slot) {
                                <button class="free-slot-btn" [disabled]="busy" (click)="moveToSlot(c.courtNumber, fs.slot)">
                                  <i class="fas fa-arrow-right"></i> Team {{ fs.team }} open slot
                                </button>
                              }
                            </div>
                          }
                        } @else {
                          @let teams = teamsFor(c);
                          @if (selectingWinnerCourt === c.courtNumber) {
                            <div class="winner-hint"><i class="fas fa-hand-pointer"></i> Tap the winning team, then Finish</div>
                            <div class="court-teams">
                              <button type="button" class="team-block team-a winner-pick" [class.is-winner]="isTeamWinner(teams.teamA)" [disabled]="busy || teams.teamA.length === 0" (click)="toggleTeamWinner(teams.teamA)">
                                <span class="team-label">Team A <i class="fas" [class.fa-trophy]="isTeamWinner(teams.teamA)"></i></span>
                                @for (p of teams.teamA; track p._id) {
                                  <div class="team-player"><div class="avatar">@if (p.profileImage) { <img class="avatar-photo" [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }</div><span class="player-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span></div>
                                }
                              </button>
                              <span class="vs-divider">VS</span>
                              <button type="button" class="team-block team-b winner-pick" [class.is-winner]="isTeamWinner(teams.teamB)" [disabled]="busy || teams.teamB.length === 0" (click)="toggleTeamWinner(teams.teamB)">
                                <span class="team-label">Team B <i class="fas" [class.fa-trophy]="isTeamWinner(teams.teamB)"></i></span>
                                @for (p of teams.teamB; track p._id) {
                                  <div class="team-player"><div class="avatar">@if (p.profileImage) { <img class="avatar-photo" [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }</div><span class="player-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span></div>
                                }
                              </button>
                            </div>
                            <div class="score-row">
                              <span class="score-label">Score <em>(optional)</em></span>
                              <input type="number" min="0" inputmode="numeric" class="score-input" placeholder="A" [(ngModel)]="finishScoreA" (ngModelChange)="scoreAutoFilled = false" [disabled]="busy" />
                              <span class="score-dash">–</span>
                              <input type="number" min="0" inputmode="numeric" class="score-input" placeholder="B" [(ngModel)]="finishScoreB" (ngModelChange)="scoreAutoFilled = false" [disabled]="busy" />
                            </div>
                            @if (scoreAutoFilled) { <div class="score-hint score-hint--auto"><i class="fas fa-gavel"></i> Carried over from the umpire's live score — review before finishing.</div> }
                            @if (finishScoreHint()) { <div class="score-hint">{{ finishScoreHint() }}</div> }
                            @if (!finishScoreHint() && finishScoreAdvisory()) { <div class="score-hint">{{ finishScoreAdvisory() }}</div> }
                          } @else {
                            <div class="court-teams">
                              <div class="team-block team-a">
                                <span class="team-label">Team A</span>
                                @for (p of teams.teamA; track p._id) {
                                  <div class="player-chip">
                                    <div class="avatar">@if (p.profileImage) { <img class="avatar-photo" [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }</div>
                                    <div class="player-main">
                                      <span class="player-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                                      <span class="player-meta">{{ p.gamesPlayed }} games@if ((p.wins ?? 0) + (p.losses ?? 0) > 0) { · {{ p.wins }}W–{{ p.losses }}L }</span>
                                    </div>
                                    <div class="row-actions">
                                      @if (movingPlayer) {
                                        @if (movingPlayer._id === p._id) {
                                          <button class="icon-btn moving-src" title="Cancel move" (click)="cancelMove()"><i class="fas fa-xmark"></i></button>
                                        } @else {
                                          <button class="icon-btn swap-target" title="Swap positions" [disabled]="busy" (click)="swapWith(p)"><i class="fas fa-right-left"></i></button>
                                        }
                                      } @else {
                                        @if (board.session.queueStatus === 'running') {
                                          <button class="icon-btn" title="Move / swap" [disabled]="busy" (click)="beginMove(p)"><i class="fas fa-right-left"></i></button>
                                        }
                                        <button class="icon-btn" title="Pause" [disabled]="busy" (click)="pause(p)"><i class="fas fa-pause"></i></button>
                                        <button class="icon-btn danger" title="Remove" [disabled]="busy" (click)="remove(p)"><i class="fas fa-xmark"></i></button>
                                      }
                                    </div>
                                  </div>
                                }
                              </div>
                              <span class="vs-divider">VS</span>
                              <div class="team-block team-b">
                                <span class="team-label">Team B</span>
                                @for (p of teams.teamB; track p._id) {
                                  <div class="player-chip">
                                    <div class="avatar">@if (p.profileImage) { <img class="avatar-photo" [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }</div>
                                    <div class="player-main">
                                      <span class="player-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                                      <span class="player-meta">{{ p.gamesPlayed }} games@if ((p.wins ?? 0) + (p.losses ?? 0) > 0) { · {{ p.wins }}W–{{ p.losses }}L }</span>
                                    </div>
                                    <div class="row-actions">
                                      @if (movingPlayer) {
                                        @if (movingPlayer._id === p._id) {
                                          <button class="icon-btn moving-src" title="Cancel move" (click)="cancelMove()"><i class="fas fa-xmark"></i></button>
                                        } @else {
                                          <button class="icon-btn swap-target" title="Swap positions" [disabled]="busy" (click)="swapWith(p)"><i class="fas fa-right-left"></i></button>
                                        }
                                      } @else {
                                        @if (board.session.queueStatus === 'running') {
                                          <button class="icon-btn" title="Move / swap" [disabled]="busy" (click)="beginMove(p)"><i class="fas fa-right-left"></i></button>
                                        }
                                        <button class="icon-btn" title="Pause" [disabled]="busy" (click)="pause(p)"><i class="fas fa-pause"></i></button>
                                        <button class="icon-btn danger" title="Remove" [disabled]="busy" (click)="remove(p)"><i class="fas fa-xmark"></i></button>
                                      }
                                    </div>
                                  </div>
                                }
                              </div>
                            </div>
                            @if (movingPlayer && freeSlotsFor(c).length > 0) {
                              <div class="free-slots">
                                @for (fs of freeSlotsFor(c); track fs.slot) {
                                  <button class="free-slot-btn" [disabled]="busy" (click)="moveToSlot(c.courtNumber, fs.slot)">
                                    <i class="fas fa-arrow-right"></i> Team {{ fs.team }} open slot
                                  </button>
                                }
                              </div>
                            }
                          }
                        }
                      </article>
                    }
                  </div>
                </section>

                <section class="panel">
                  <div class="panel-head">
                    <div>
                      <span class="panel-kicker">Results</span>
                      <h3>Recorded Games</h3>
                    </div>
                    <div class="panel-head-right">
                      <span class="panel-count">{{ matches.length }} games</span>
                      <button class="match-refresh-btn" title="Refresh games" [disabled]="matchesLoading" (click)="loadMatches()">
                        <i class="fas fa-rotate-right" [class.fa-spin]="matchesLoading"></i>
                      </button>
                    </div>
                  </div>

                  @for (m of matches; track m._id) {
                    <div class="match-row">
                      <span class="match-court">C{{ m.courtNumber }}</span>
                      <div class="match-main">
                        <span class="match-team" [class.match-winner]="m.winnerTeam === 1">{{ teamNames(m.team1) }}@if (m.winnerTeam === 1) { <i class="fas fa-trophy"></i> }</span>
                        <span class="match-vs">vs</span>
                        <span class="match-team" [class.match-winner]="m.winnerTeam === 2">{{ teamNames(m.team2) }}@if (m.winnerTeam === 2) { <i class="fas fa-trophy"></i> }</span>
                      </div>
                      @if (m.team1Score !== null) {
                        <span class="match-score">{{ m.team1Score }}–{{ m.team2Score }}</span>
                      }
                      @if (duprSubmissionFor(m._id); as dupr) {
                        <span class="dupr-chip" [class]="'dupr-chip-' + dupr.status" [title]="dupr.lastError || dupr.status">
                          DUPR: {{ dupr.status === 'pending_submission' ? 'Pending' : (dupr.status | titlecase) }}
                        </span>
                        @if (dupr.status === 'failed' || dupr.status === 'rejected') {
                          <button class="icon-btn" title="Retry DUPR submission" [disabled]="duprRetryingIds.has(dupr._id)" (click)="retryDupr(dupr)">
                            <i class="fas fa-rotate-right" [class.fa-spin]="duprRetryingIds.has(dupr._id)"></i>
                          </button>
                        }
                        @if (dupr.status === 'submitted' || dupr.status === 'accepted' || dupr.status === 'rejected') {
                          <button class="icon-btn" title="Dispute DUPR submission" (click)="openDuprDispute(dupr)">
                            <i class="fas fa-flag"></i>
                          </button>
                        }
                        @if (dupr.status === 'disputed') {
                          <button class="icon-btn" title="Resolve dispute" (click)="openDuprResolve(dupr, m)">
                            <i class="fas fa-check"></i>
                          </button>
                        }
                      }
                      <span class="match-time">{{ m.finishedAt | date:'shortTime' }}</span>
                      @if (confirmingDeleteId === m._id) {
                        <span class="match-delete-confirm">
                          Delete this game?
                          <button class="icon-btn icon-btn--danger" title="Confirm delete" [disabled]="deletingMatchIds.has(m._id)" (click)="deleteMatch(m._id)">
                            <i class="fas" [class.fa-check]="!deletingMatchIds.has(m._id)" [class.fa-circle-notch]="deletingMatchIds.has(m._id)" [class.fa-spin]="deletingMatchIds.has(m._id)"></i>
                          </button>
                          <button class="icon-btn" title="Cancel" [disabled]="deletingMatchIds.has(m._id)" (click)="cancelDeleteMatch()">
                            <i class="fas fa-xmark"></i>
                          </button>
                        </span>
                        @if (deleteMatchError) {
                          <span class="match-delete-error">{{ deleteMatchError }}</span>
                        }
                      } @else {
                        <button class="icon-btn" [title]="m.team1Score === null ? 'Add score' : 'Edit score'" [disabled]="busy" (click)="openScoreModal(m)">
                          <i class="fas" [class.fa-plus]="m.team1Score === null" [class.fa-pen]="m.team1Score !== null"></i>
                        </button>
                        <button class="icon-btn icon-btn--danger" title="Delete game" [disabled]="busy" (click)="confirmDeleteMatch(m._id)">
                          <i class="fas fa-trash"></i>
                        </button>
                      }
                    </div>
                  } @empty {
                    <div class="match-empty">No games recorded yet — finished games will appear here.</div>
                  }
                </section>

                <section class="panel">
                  <div class="panel-head">
                    <div>
                      <span class="panel-kicker">Rotation</span>
                      <h3>Waiting Queue</h3>
                    </div>
                    <span class="panel-count">{{ board.waiting.length }} waiting</span>
                  </div>

                  @if (assigningCourt !== null) {
                    <div class="assign-panel">
                      <div class="assign-copy">
                        <strong>Assign Court {{ assigningCourt }}</strong>
                        @if (assignablePlayers.length === 0) {
                          <span>No available players. Add a walk-in first.</span>
                        } @else {
                          <span>Select up to {{ board.session.playersPerCourt }} players ({{ selectedIds.size }} selected).</span>
                        }
                      </div>
                      <div class="assign-actions">
                        <button class="secondary-btn" (click)="cancelAssign()">Cancel</button>
                        @if (assignablePlayers.length > 0) {
                          <button class="primary-small" [disabled]="busy || selectedIds.size === 0" (click)="confirmAssign()">Assign</button>
                        }
                      </div>
                    </div>

                    @if (assignablePlayers.length > 0) {
                      <div class="queue-list assign-list">
                        @for (p of assignablePlayers; track p._id) {
                          <button class="queue-row selectable" [class.selected]="selectedIds.has(p._id)" (click)="toggleSelect(p)">
                            <span class="avatar selectable-avatar">
                              @if (p.profileImage) { <img class="avatar-photo" [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }
                              @if (selectedIds.has(p._id)) {
                                <span class="select-badge"><i class="fas fa-check"></i></span>
                              }
                            </span>
                            <span class="q-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                            <span class="q-games">{{ p.gamesPlayed }} games</span>
                            <span class="state-tag" [ngClass]="p.queueStatus">{{ stateLabel(p) }}</span>
                          </button>
                        }
                      </div>
                    }
                  }

                  @if (board.waiting.length === 0) {
                    @if (assigningCourt === null) {
                      <div class="empty-panel">
                        <i class="fas fa-list"></i>
                        <span>No players waiting.</span>
                      </div>
                    }
                  } @else {
                    <div class="queue-list">
                      @for (p of board.waiting; track p._id; let i = $index) {
                        <div class="queue-row">
                          <span class="queue-rank">{{ i + 1 }}</span>
                          <span class="q-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                          <span class="q-games">{{ p.gamesPlayed }} games</span>
                          <div class="row-actions">
                            @if (movingPlayer) {
                              <button class="icon-btn swap-target" title="Swap onto court" [disabled]="busy" (click)="swapWith(p)"><i class="fas fa-right-left"></i></button>
                            }
                            <button class="icon-btn" title="Move up" [disabled]="busy || i === 0" (click)="move(p, -1)"><i class="fas fa-chevron-up"></i></button>
                            <button class="icon-btn" title="Move down" [disabled]="busy || i === board.waiting.length - 1" (click)="move(p, 1)"><i class="fas fa-chevron-down"></i></button>
                            <button class="icon-btn" title="Skip to back" [disabled]="busy" (click)="skip(p)"><i class="fas fa-angles-down"></i></button>
                            <button class="icon-btn" title="Pause" [disabled]="busy" (click)="pause(p)"><i class="fas fa-pause"></i></button>
                            <button class="icon-btn danger" title="Remove" [disabled]="busy" (click)="remove(p)"><i class="fas fa-xmark"></i></button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </section>

                @if (board.paused.length > 0) {
                  <section class="panel">
                    <div class="panel-head">
                      <div>
                        <span class="panel-kicker">Hold list</span>
                        <h3>Paused Players</h3>
                      </div>
                      <span class="panel-count">{{ board.paused.length }} paused</span>
                    </div>
                    <div class="queue-list">
                      @for (p of board.paused; track p._id) {
                        <div class="queue-row">
                          <span class="queue-rank pause-rank"><i class="fas fa-pause"></i></span>
                          <span class="q-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                          <span class="q-games">{{ p.gamesPlayed }} games</span>
                          <div class="row-actions">
                            <button class="primary-small" [disabled]="busy" (click)="resume(p)">Resume</button>
                            <button class="icon-btn danger" title="Remove" [disabled]="busy" (click)="remove(p)"><i class="fas fa-xmark"></i></button>
                          </div>
                        </div>
                      }
                    </div>
                  </section>
                }
              } @else {
                <section class="panel start-panel">
                  <i class="fas fa-clipboard-check"></i>
                  <h3>Check players in before starting</h3>
                  <p>Once the queue starts, checked-in players will be assigned to courts automatically.</p>
                </section>
              }
            </div>

            <aside class="side-column">
              <section class="panel checkin-panel">
                <div class="panel-head">
                  <div>
                    <span class="panel-kicker">Attendance</span>
                    <h3>Check-In</h3>
                  </div>
                  <div class="panel-head-right">
                    <span class="panel-count">{{ checkedInCount() }}/{{ board.roster.length }}</span>
                    @if (board.session.queueStatus !== 'ended') {
                      <button class="qr-btn" (click)="showImportModal()" title="Import players from Reclub">
                        <i class="fas fa-file-import"></i>
                      </button>
                      <button class="qr-btn" (click)="showQr()" title="Show QR check-in code">
                        <i class="fas fa-qrcode"></i>
                      </button>
                    }
                  </div>
                </div>

                @if (board.session.queueStatus !== 'ended') {
                  <div class="walkin-card">
                    <label>Walk-in player</label>
                    <div class="walkin-mode" role="tablist">
                      <button type="button" [class.active]="walkInMode() === 'guest'" (click)="setWalkInMode('guest')">Guest</button>
                      <button type="button" [class.active]="walkInMode() === 'member'" (click)="setWalkInMode('member')">Member</button>
                    </div>
                    @if (walkInMode() === 'guest') {
                      <div class="walkin-row">
                        <input id="walkin-name" type="text" placeholder="Player name" [(ngModel)]="walkInName" (keyup.enter)="addWalkIn()" />
                        <button class="primary-small" [disabled]="busy || !walkInName.trim()" (click)="addWalkIn()">
                          <i class="fas fa-user-plus"></i> Add
                        </button>
                      </div>
                      @if ((board.session.guestTotalPerPlayer ?? board.session.totalPerPlayer ?? 0) > 0) {
                        <p class="walkin-fee-note">
                          <i class="fas fa-coins"></i>
                          Collect <strong>₱{{ board.session.guestTotalPerPlayer ?? board.session.totalPerPlayer }}</strong> cash
                          @if ((board.session.guestConvenienceFeePerPlayer ?? board.session.convenienceFeePerPlayer ?? 0) > 0) {
                            <span class="walkin-fee-breakdown">(₱{{ board.session.guestFeePerPlayer ?? board.session.feePerPlayer }} + ₱{{ board.session.guestConvenienceFeePerPlayer ?? board.session.convenienceFeePerPlayer }} service fee)</span>
                          }
                          — recorded automatically on Add.
                        </p>
                      }
                    } @else {
                      @if (selectedWalkInMember(); as m) {
                        <div class="member-selected">
                          <span class="avatar small">{{ initials(m.name) }}</span>
                          <span class="member-sel-name">{{ m.name }}</span>
                          @if (m.balance > 0) { <span class="credit-chip">₱{{ m.balance }} credit</span> }
                          <button type="button" class="member-clear" (click)="clearWalkInMember()" aria-label="Clear selected member"><i class="fas fa-times"></i></button>
                          <button class="primary-small" [disabled]="busy" (click)="addWalkIn()">
                            <i class="fas fa-user-plus"></i> Add
                          </button>
                        </div>
                      } @else {
                        <div class="walkin-row">
                          <input type="text" placeholder="Search members by name or email…"
                                 [ngModel]="memberSearch()" (ngModelChange)="memberSearch.set($event)" />
                        </div>
                        @if (membersLoading()) {
                          <p class="member-hint">Loading members…</p>
                        } @else if (memberSearch().trim() && filteredWalkInMembers().length === 0) {
                          <p class="member-hint">No matching members available.</p>
                        } @else if (filteredWalkInMembers().length) {
                          <div class="member-results">
                            @for (m of filteredWalkInMembers(); track m._id) {
                              <button type="button" class="member-option" (click)="selectWalkInMember(m)">
                                <span class="avatar small">{{ initials(m.name) }}</span>
                                <span class="member-opt-main">
                                  <span class="member-opt-name">{{ m.name }}</span>
                                  @if (m.email) { <span class="member-opt-meta">{{ m.email }}</span> }
                                </span>
                                @if (m.balance > 0) { <span class="credit-chip">₱{{ m.balance }}</span> }
                              </button>
                            }
                          </div>
                        }
                      }
                      @if (board.session.estimatedFee) {
                        <p class="walkin-fee-note">
                          <i class="fas fa-coins"></i>
                          No upfront charge — billed their share (est. <strong>₱{{ board.session.totalPerPlayer }}</strong>) when the session ends.
                        </p>
                      } @else if (memberWalkInTotal() > 0) {
                        <p class="walkin-fee-note">
                          <i class="fas fa-coins"></i>
                          @if (selectedWalkInMember()) {
                            @if (memberWalkInDue() === 0) {
                              Fully covered by <strong>₱{{ memberWalkInCredit() }}</strong> credit — nothing owed.
                            } @else if (memberWalkInCredit() > 0) {
                              <strong>₱{{ memberWalkInCredit() }}</strong> credit applied — <strong>₱{{ memberWalkInDue() }}</strong> billed to their account.
                            } @else {
                              <strong>₱{{ memberWalkInTotal() }}</strong> billed to their account — they pay from their Payments page.
                            }
                          } @else {
                            Member fee <strong>₱{{ memberWalkInTotal() }}</strong> — credit applied first, remainder billed to their account.
                          }
                        </p>
                      }
                    }
                  </div>
                }

                @if (board.roster.length === 0) {
                  <div class="empty-panel">
                    <i class="fas fa-user-slash"></i>
                    <span>No one has joined this session yet.</span>
                  </div>
                } @else {
                  <div class="roster-list">
                    @for (p of board.roster; track p._id) {
                      <button
                        type="button"
                        class="roster-row"
                        [class.checked]="p.checkedIn"
                        [disabled]="busy || board.session.queueStatus === 'ended'"
                        (click)="toggleCheckIn(p)"
                      >
                        <span class="avatar small roster-avatar">
                          @if (p.profileImage) { <img class="avatar-photo" [src]="p.profileImage" [alt]="p.memberName" /> } @else { {{ initials(p.memberName) }} }
                          @if (p.checkedIn) {
                            <span class="select-badge"><i class="fas fa-check"></i></span>
                          }
                        </span>
                        <span class="roster-main">
                          <span class="roster-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                          <span class="roster-meta">
                            {{ p.gamesPlayed }} games
                            @if (p.duprRating) { <span class="roster-dupr">DUPR {{ p.duprRating | number:'1.3-3' }}</span> }
                          </span>
                        </span>
                        <span class="state-tag" [ngClass]="p.queueStatus">{{ stateLabel(p) }}</span>
                      </button>
                    }
                  </div>
                }
              </section>
            </aside>
          </div>
        </main>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #07130d;
      --surface: #12251d;
      --surface-2: #19352a;
      --panel: rgba(18, 37, 29, .94);
      --border: rgba(255,255,255,.1);
      --text: #fff;
      --muted: rgba(255,255,255,.62);
      --soft: rgba(255,255,255,.42);
      --accent: #a3e635;
      --teal: #14b8a6;
      --blue: #38bdf8;
      --amber: #f59e0b;
      --danger: #f87171;
      --shadow: 0 18px 50px rgba(0,0,0,.32);
    }

    .queue-shell {
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.13), transparent 28rem),
        linear-gradient(180deg, #0b1b12 0%, var(--bg) 34rem);
      padding: 0 1rem 2rem;
    }

    .topbar {
      max-width: 1280px;
      margin: 0 auto;
      min-height: 74px;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: .85rem;
      padding: .85rem 0;
      position: sticky;
      top: 0;
      z-index: 20;
      background: linear-gradient(180deg, rgba(7,19,13,.98), rgba(7,19,13,.88));
      backdrop-filter: blur(10px);
    }

    .back-btn {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.1);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .topbar-copy { min-width: 0; }
    .topbar-kicker { display: block; color: var(--accent); font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .15rem; }
    .topbar h1 { margin: 0; font-size: 1.05rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      white-space: nowrap;
      font-size: .72rem;
      font-weight: 900;
      border-radius: 999px;
      padding: .42rem .75rem;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--muted);
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.1);
    }
    .status-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
    .status-pill.running { color: var(--accent); background: rgba(163,230,53,.14); border-color: rgba(163,230,53,.22); }
    .status-pill.paused { color: var(--amber); background: rgba(245,158,11,.13); border-color: rgba(245,158,11,.22); }
    .status-pill.ended { color: #fca5a5; background: rgba(239,68,68,.13); border-color: rgba(239,68,68,.22); }

    .tv-display-btn {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      white-space: nowrap;
      font-family: inherit;
      font-size: .78rem;
      font-weight: 900;
      border-radius: 999px;
      padding: .5rem .85rem;
      color: var(--accent);
      background: rgba(163,230,53,.1);
      border: 1px solid rgba(163,230,53,.22);
      cursor: pointer;
      transition: background .15s, transform .15s;
    }
    .tv-display-btn:hover { background: rgba(163,230,53,.2); }
    .tv-display-btn:active { transform: scale(.96); }

    .state-card {
      max-width: 520px;
      margin: 3rem auto;
      min-height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .65rem;
      color: var(--muted);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      font-weight: 800;
    }
    .state-card-error { color: #fca5a5; }

    .queue-page { max-width: 1280px; margin: 0 auto; }

    .hero-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: end;
      padding: 1.25rem;
      background:
        linear-gradient(135deg, rgba(25,53,42,.94), rgba(9,27,17,.96)),
        url('/tennis-court-surface.png') center / cover;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      box-shadow: var(--shadow);
      overflow: hidden;
      position: relative;
    }
    .hero-panel::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7,19,13,.18), rgba(7,19,13,.7));
      pointer-events: none;
    }
    .hero-panel > * { position: relative; z-index: 1; }
    .eyebrow { display: inline-flex; align-items: center; gap: .45rem; color: var(--accent); font-size: .75rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .55rem; }
    .hero-title { display: flex; align-items: center; gap: .9rem; min-width: 0; }
    .venue-mark { width: 58px; height: 58px; border-radius: 8px; background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.2); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 58px; box-shadow: 0 12px 24px rgba(0,0,0,.18); }
    .venue-logo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .venue-initials { font-size: .9rem; font-weight: 950; letter-spacing: .02em; text-transform: uppercase; }
    .hero-main h2 { margin: 0; font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1; letter-spacing: 0; }
    .hero-main p { margin: .75rem 0 0; color: rgba(255,255,255,.73); line-height: 1.5; max-width: 650px; }
    .hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: .65rem; }
    .sync-note { display: inline-flex; align-items: center; gap: .5rem; color: rgba(255,255,255,.58); font-size: .78rem; font-weight: 800; flex-wrap: wrap; }
    .refresh-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .75rem; border-radius: 8px; background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.25); color: #a3e635; font-size: .78rem; font-weight: 900; font-family: inherit; cursor: pointer; transition: background .15s, transform .15s; }
    .refresh-btn:hover:not(:disabled) { background: rgba(163,230,53,.22); }
    .refresh-btn:active:not(:disabled) { transform: scale(.95); }
    .refresh-btn:disabled { opacity: .5; cursor: not-allowed; }
    .updated-ts { color: rgba(255,255,255,.38); font-size: .72rem; font-weight: 700; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: .85rem;
      margin: 1rem 0;
    }
    .stat-card {
      min-height: 104px;
      padding: .9rem;
      border-radius: 8px;
      background: var(--panel);
      border: 1px solid var(--border);
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-areas: "icon value" "icon label";
      column-gap: .8rem;
      align-items: center;
    }
    .stat-icon { grid-area: icon; width: 42px; height: 42px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
    .stat-icon.lime { color: var(--accent); background: rgba(163,230,53,.14); }
    .stat-icon.teal { color: var(--teal); background: rgba(20,184,166,.14); }
    .stat-icon.blue { color: var(--blue); background: rgba(56,189,248,.14); }
    .stat-icon.amber { color: var(--amber); background: rgba(245,158,11,.14); }
    .stat-value { grid-area: value; color: var(--text); font-size: 1.65rem; line-height: 1; font-weight: 950; }
    .stat-label { grid-area: label; color: var(--muted); font-size: .78rem; font-weight: 800; }

    .content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
      gap: 1rem;
      align-items: start;
    }
    .primary-column, .side-column { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .side-column { position: sticky; top: 88px; }

    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 12px 32px rgba(0,0,0,.2);
    }
    .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: .9rem; }
    .panel-kicker { color: var(--soft); font-size: .7rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .panel h3 { margin: .12rem 0 0; font-size: 1.05rem; line-height: 1.2; }
    .panel-count { white-space: nowrap; color: var(--muted); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 999px; padding: .3rem .65rem; font-size: .72rem; font-weight: 900; }

    .courts-grid { display: grid; grid-template-columns: 1fr; gap: .85rem; }
    .court-card {
      min-height: 190px;
      padding: .9rem;
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
    }
    .court-card.empty { border-style: dashed; }
    .court-top { display: flex; align-items: center; justify-content: space-between; gap: .5rem .75rem; margin-bottom: .8rem; flex-wrap: wrap; }
    .court-top-actions { display: flex; align-items: center; gap: .4rem; }
    .court-title { font-size: .95rem; font-weight: 950; display: inline-flex; align-items: center; gap: .4rem; }
    .umpire-link-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .6rem; border-radius: 7px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: var(--muted); font-size: .68rem; font-weight: 800; text-transform: none; letter-spacing: 0; white-space: nowrap; cursor: pointer; font-family: inherit; }
    .umpire-link-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
    .add-player-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .4rem .65rem; border-radius: 8px; border: 1px solid rgba(163,230,53,.3); background: rgba(163,230,53,.08); color: var(--accent); font-size: .74rem; font-weight: 950; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .add-player-btn:hover:not(:disabled) { background: rgba(163,230,53,.15); }
    .add-player-btn:disabled { opacity: .4; cursor: not-allowed; }
    .empty-court { min-height: 128px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .55rem; color: var(--muted); text-align: center; }
    .empty-court i { color: var(--accent); font-size: 1.25rem; opacity: .8; }
    .court-players, .queue-list, .roster-list { display: flex; flex-direction: column; gap: .55rem; }

    .player-chip, .queue-row, .roster-row {
      display: flex;
      align-items: center;
      gap: .65rem;
      min-width: 0;
      border-radius: 8px;
      background: rgba(255,255,255,.045);
      border: 1px solid rgba(255,255,255,.08);
    }
    .player-chip { padding: .62rem; flex-wrap: wrap; row-gap: .4rem; }
    .queue-row { padding: .62rem .7rem; }
    .roster-row {
      padding: .58rem .65rem;
      cursor: pointer;
      width: 100%;
      color: inherit;
      font-family: inherit;
      text-align: left;
      transition: background .16s, border-color .16s, transform .16s;
    }
    .roster-row:hover:not(:disabled) { background: rgba(255,255,255,.075); border-color: rgba(255,255,255,.14); }
    .roster-row:active:not(:disabled) { transform: translateY(1px); }
    .roster-row:disabled { opacity: .62; cursor: not-allowed; }
    .queue-row.selected, .roster-row.checked { border-color: rgba(163,230,53,.32); background: rgba(163,230,53,.06); }
    .selectable {
      width: 100%;
      color: inherit;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      transition: background .16s, border-color .16s, transform .16s;
    }
    .selectable:hover { background: rgba(255,255,255,.075); border-color: rgba(255,255,255,.14); }
    .selectable.selected { background: rgba(163,230,53,.1); border-color: rgba(163,230,53,.42); box-shadow: inset 0 0 0 1px rgba(163,230,53,.12); }
    .selectable:active { transform: translateY(1px); }

    .avatar, .queue-rank {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      border-radius: 50%;
      background: rgba(163,230,53,.14);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .78rem;
      font-weight: 950;
    }
    .avatar.small { width: 30px; height: 30px; flex-basis: 30px; font-size: .72rem; }
    /* Rounded on the img itself (not overflow:hidden on .avatar) so the
       select/check badges can still overhang the circle's edge. */
    .avatar-photo { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
    .roster-avatar { position: relative; }
    .roster-row.checked .roster-avatar {
      color: #07130d;
      background: var(--accent);
    }
    .selectable-avatar {
      position: relative;
      transition: background .16s, color .16s;
    }
    .selectable.selected .selectable-avatar {
      color: #07130d;
      background: var(--accent);
    }
    .select-badge {
      position: absolute;
      right: -4px;
      bottom: -4px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #07130d;
      color: var(--accent);
      border: 2px solid var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .58rem;
      line-height: 1;
    }
    .pause-rank { color: var(--amber); background: rgba(245,158,11,.14); }

    .player-main, .roster-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .12rem; }
    .player-chip .player-main { flex-basis: 84px; min-width: 84px; }
    .player-chip .row-actions { margin-left: auto; }
    .player-name, .q-name, .roster-name { color: var(--text); font-size: .9rem; font-weight: 850; min-width: 0; overflow-wrap: anywhere; }
    .player-meta, .roster-meta, .q-games { color: var(--muted); font-size: .74rem; font-weight: 750; white-space: nowrap; }
    .q-name { flex: 1; }
    .roster-dupr { color: #60a5fa; margin-left: .4rem; }

    .walk {
      display: inline-flex;
      vertical-align: middle;
      margin-left: .35rem;
      color: var(--blue);
      background: rgba(56,189,248,.14);
      border: 1px solid rgba(56,189,248,.16);
      border-radius: 999px;
      padding: .08rem .38rem;
      font-size: .58rem;
      font-weight: 950;
      text-transform: uppercase;
    }

    .row-actions { display: flex; align-items: center; justify-content: flex-end; gap: .3rem; flex-shrink: 0; }
    .icon-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.055);
      color: var(--text);
      cursor: pointer;
      font-size: .78rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon-btn:hover:not(:disabled) { background: rgba(255,255,255,.12); }
    .icon-btn:disabled { opacity: .36; cursor: not-allowed; }
    .icon-btn--danger { color: #ef4444; border-color: rgba(239,68,68,.32); }
    .icon-btn--danger:hover:not(:disabled) { background: rgba(239,68,68,.14); }
    .icon-btn.danger { color: #fca5a5; border-color: rgba(239,68,68,.25); }

    .primary-action, .danger-action, .primary-small, .secondary-btn, .finish-btn, .text-action {
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      border-radius: 8px;
      font-weight: 950;
      border: 0;
      white-space: nowrap;
    }
    .primary-action { min-height: 48px; padding: .85rem 1.15rem; background: var(--accent); color: #07130d; box-shadow: 0 12px 24px rgba(163,230,53,.18); }
    .danger-action { min-height: 48px; padding: .85rem 1.15rem; background: rgba(239,68,68,.13); color: #fca5a5; border: 1px solid rgba(239,68,68,.28); }
    .primary-small, .finish-btn { min-height: 36px; padding: .48rem .78rem; background: var(--accent); color: #07130d; font-size: .78rem; }
    .finish-btn--confirm { background: #f97316; color: #fff; animation: pulse .6s ease-in-out infinite alternate; }
    .finish-btn--cancel { background: rgba(255,255,255,.08); color: var(--text); border: 1px solid var(--border); }
    @keyframes pulse { from { opacity: 1; } to { opacity: .75; } }
    .winner-hint { display: flex; align-items: center; gap: .4rem; font-size: .72rem; font-weight: 800; color: #f59e0b; margin-bottom: .5rem; }
    .winner-hint i { color: #f59e0b; }

    .court-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: .55rem; }
    .team-block { display: flex; flex-direction: column; gap: .4rem; min-width: 0; }
    .team-label { font-size: .68rem; font-weight: 950; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); display: flex; align-items: center; gap: .3rem; margin-bottom: .1rem; }
    .team-a .team-label { color: #38bdf8; }
    .team-b .team-label { color: #f472b6; }
    .vs-divider { align-self: center; font-size: .68rem; font-weight: 950; color: var(--muted); background: rgba(255,255,255,.06); border-radius: 999px; padding: .3rem .5rem; white-space: nowrap; margin-top: 1.4rem; }

    button.team-block.winner-pick { text-align: left; cursor: pointer; font-family: inherit; background: rgba(255,255,255,.03); border: 1px solid var(--border); border-radius: 10px; padding: .55rem; color: var(--text); transition: background .12s, border-color .12s; }
    button.team-block.winner-pick:hover:not(:disabled) { background: rgba(255,255,255,.07); }
    button.team-block.winner-pick.is-winner { background: rgba(245,158,11,.14); border-color: rgba(245,158,11,.5); }
    button.team-block.winner-pick.is-winner .team-label { color: #f59e0b; }
    button.team-block.winner-pick:disabled { opacity: .45; cursor: default; }
    .team-player { display: flex; align-items: center; gap: .5rem; padding: .2rem 0; font-size: .82rem; font-weight: 700; }
    .team-player .avatar { width: 26px; height: 26px; font-size: .64rem; }
    .secondary-btn { min-height: 36px; padding: .48rem .78rem; background: rgba(255,255,255,.07); color: var(--text); border: 1px solid var(--border); font-size: .78rem; }
    .text-action { padding: .35rem .65rem; color: var(--accent); background: rgba(163,230,53,.09); border: 1px solid rgba(163,230,53,.18); font-size: .76rem; }
    button:disabled { opacity: .48; cursor: not-allowed; }

    .assign-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: .8rem;
      margin-bottom: .8rem;
      border-radius: 8px;
      background: rgba(163,230,53,.09);
      border: 1px solid rgba(163,230,53,.22);
    }
    .assign-copy { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
    .assign-copy strong { color: var(--text); font-size: .88rem; }
    .assign-copy span { color: var(--muted); font-size: .78rem; line-height: 1.35; }
    .assign-actions { display: flex; gap: .5rem; }

    .walkin-card {
      padding: .75rem;
      margin-bottom: .9rem;
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
    }
    .walkin-card label { display: block; margin-bottom: .45rem; color: var(--muted); font-size: .75rem; font-weight: 900; }
    .walkin-mode { display: flex; gap: .35rem; margin-bottom: .55rem; }
    .walkin-mode button {
      flex: 1;
      padding: .38rem .6rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      color: var(--muted);
      font-family: inherit;
      font-size: .74rem;
      font-weight: 900;
      cursor: pointer;
    }
    .walkin-mode button.active {
      background: rgba(163,230,53,.12);
      border-color: rgba(163,230,53,.35);
      color: #a3e635;
    }
    .member-hint { margin: .5rem 0 0; font-size: .76rem; color: rgba(255,255,255,.45); }
    .member-results { margin-top: .5rem; display: flex; flex-direction: column; gap: .3rem; max-height: 240px; overflow-y: auto; }
    .member-option {
      display: flex; align-items: center; gap: .55rem;
      padding: .45rem .55rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
      color: var(--text);
      font-family: inherit;
      text-align: left;
      cursor: pointer;
    }
    .member-option:hover { background: rgba(163,230,53,.08); border-color: rgba(163,230,53,.25); }
    .member-opt-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .member-opt-name { font-size: .84rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .member-opt-meta { font-size: .7rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .credit-chip {
      flex-shrink: 0;
      padding: .18rem .5rem;
      border-radius: 999px;
      background: rgba(163,230,53,.12);
      border: 1px solid rgba(163,230,53,.3);
      color: #a3e635;
      font-size: .68rem;
      font-weight: 900;
      white-space: nowrap;
    }
    .member-selected {
      display: flex; align-items: center; gap: .5rem;
      padding: .45rem .55rem;
      border-radius: 8px;
      border: 1px solid rgba(163,230,53,.25);
      background: rgba(163,230,53,.07);
    }
    .member-sel-name { flex: 1; min-width: 0; font-size: .86rem; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .member-clear {
      flex-shrink: 0;
      width: 26px; height: 26px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      color: var(--muted);
      cursor: pointer;
      font-size: .68rem;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .walkin-fee-note { margin: .55rem 0 0; font-size: .76rem; color: rgba(255,255,255,.55); display: flex; align-items: center; flex-wrap: wrap; gap: .3rem; }
    .walkin-fee-note i { color: #a3e635; font-size: .7rem; }
    .walkin-fee-note strong { color: #a3e635; }
    .walkin-fee-breakdown { color: rgba(255,255,255,.38); }
    .walkin-row { display: flex; gap: .5rem; }
    .walkin-row input {
      flex: 1;
      min-width: 0;
      padding: .62rem .7rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.055);
      color: var(--text);
      outline: none;
      font-family: inherit;
      font-size: .88rem;
    }

    .state-tag {
      flex-shrink: 0;
      color: var(--muted);
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 999px;
      padding: .22rem .55rem;
      font-size: .66rem;
      font-weight: 950;
      text-transform: capitalize;
      white-space: nowrap;
    }
    .state-tag.waiting { color: var(--accent); background: rgba(163,230,53,.13); border-color: rgba(163,230,53,.18); }
    .state-tag.playing { color: var(--blue); background: rgba(56,189,248,.13); border-color: rgba(56,189,248,.18); }
    .state-tag.paused { color: var(--amber); background: rgba(245,158,11,.13); border-color: rgba(245,158,11,.18); }
    .state-tag.done { color: rgba(255,255,255,.75); }

    .empty-panel, .start-panel {
      min-height: 120px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .55rem;
      text-align: center;
      color: var(--muted);
      border-radius: 8px;
      border: 1px dashed rgba(255,255,255,.12);
      background: rgba(255,255,255,.025);
    }
    .empty-panel i, .start-panel i { color: var(--accent); font-size: 1.35rem; }
    .start-panel h3 { margin: .2rem 0 0; color: var(--text); }
    .start-panel p { max-width: 480px; margin: 0; line-height: 1.5; }
    .ended-note { color: var(--muted); font-weight: 850; display: inline-flex; align-items: center; gap: .45rem; }
    .ended-note i { color: var(--accent); }

    .alert {
      margin: 0 0 1rem;
      padding: .7rem .85rem;
      border-radius: 8px;
      font-size: .84rem;
      background: rgba(239,68,68,.1);
      border: 1px solid rgba(239,68,68,.25);
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: .5rem;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(0,0,0,.68);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-card {
      width: 100%;
      max-width: 390px;
      padding: 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #12251d;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(0,0,0,.58);
    }
    .modal-icon { width: 52px; height: 52px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
    .modal-icon-danger { color: #fca5a5; background: rgba(239,68,68,.12); }
    .modal-icon-end { color: var(--amber); background: rgba(245,158,11,.12); }
    .modal-title { margin: 0; color: var(--text); font-size: 1.05rem; font-weight: 950; }
    .modal-msg { margin: .32rem 0 0; color: var(--muted); line-height: 1.5; font-size: .9rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: .6rem; }
    .modal-cancel, .modal-confirm {
      min-height: 40px;
      padding: .55rem .95rem;
      border-radius: 8px;
      font-family: inherit;
      font-weight: 900;
      cursor: pointer;
    }
    .modal-cancel { color: var(--text); border: 1px solid var(--border); background: rgba(255,255,255,.06); }
    .modal-confirm-danger { color: #fca5a5; border: 1px solid rgba(239,68,68,.32); background: rgba(239,68,68,.16); }
    .modal-confirm-end { color: var(--amber); border: 1px solid rgba(245,158,11,.32); background: rgba(245,158,11,.15); }
    .modal-confirm-save { color: var(--accent); border: 1px solid rgba(163,230,53,.32); background: rgba(163,230,53,.14); }

    /* ── Match scores ── */
    .score-row {
      display: flex;
      align-items: center;
      gap: .5rem;
      margin-top: .6rem;
      padding: .5rem .6rem;
      border-radius: 8px;
      background: rgba(255,255,255,.05);
      border: 1px solid var(--border);
    }
    .score-label { font-size: .76rem; font-weight: 800; color: var(--muted); }
    .score-label em { font-style: normal; color: var(--soft); font-weight: 600; }
    .score-input {
      width: 64px;
      min-height: 38px;
      padding: .35rem .5rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.07);
      color: var(--text);
      font-family: inherit;
      font-size: .95rem;
      font-weight: 800;
      text-align: center;
    }
    .score-input:focus { outline: none; border-color: rgba(163,230,53,.5); }
    .score-dash { color: var(--soft); font-weight: 800; }
    .score-hint {
      margin-top: .4rem;
      font-size: .78rem;
      color: var(--amber);
    }
    .score-hint--auto {
      color: var(--accent);
    }
    .score-prompt {
      display: flex;
      align-items: center;
      gap: .55rem;
      margin-bottom: .8rem;
      padding: .55rem .7rem;
      border-radius: 8px;
      background: rgba(163,230,53,.09);
      border: 1px solid rgba(163,230,53,.24);
      font-size: .84rem;
    }
    .score-prompt i { color: var(--accent); }
    .score-prompt-msg { flex: 1; min-width: 0; color: var(--text); }
    .score-prompt-dismiss {
      width: 28px; height: 28px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 6px; border: 1px solid var(--border);
      background: rgba(255,255,255,.06); color: var(--muted); cursor: pointer;
    }
    .match-refresh-btn {
      width: 32px; height: 32px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 8px; border: 1px solid var(--border);
      background: rgba(255,255,255,.06); color: var(--muted);
      font-size: .85rem; cursor: pointer;
    }
    .match-refresh-btn:hover:not(:disabled) { background: rgba(255,255,255,.12); color: var(--text); }
    .match-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .6rem;
      padding: .5rem .35rem;
      border-bottom: 1px solid rgba(255,255,255,.06);
      font-size: .85rem;
    }
    .match-row:last-of-type { border-bottom: none; }
    .match-court {
      flex-shrink: 0;
      min-width: 34px;
      text-align: center;
      padding: .18rem .3rem;
      border-radius: 6px;
      background: rgba(56,189,248,.12);
      color: var(--blue);
      font-size: .74rem;
      font-weight: 900;
    }
    .match-main { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; }
    .match-team { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; max-width: 220px; }
    .match-team.match-winner { color: var(--text); font-weight: 800; }
    .match-team .fa-trophy { color: var(--accent); font-size: .72rem; margin-left: .25rem; }
    .match-vs { color: var(--soft); font-size: .72rem; font-weight: 800; text-transform: uppercase; }
    .match-score {
      flex-shrink: 0;
      padding: .18rem .45rem;
      border-radius: 6px;
      background: rgba(163,230,53,.12);
      color: var(--accent);
      font-weight: 900;
    }
    .dupr-chip {
      flex-shrink: 0;
      padding: .15rem .5rem;
      border-radius: 20px;
      font-size: .68rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .3px;
      white-space: nowrap;
    }
    .dupr-chip-pending_submission { background: rgba(234,179,8,.15); color: #eab308; }
    .dupr-chip-submitted { background: rgba(59,130,246,.15); color: #3b82f6; }
    .dupr-chip-accepted { background: rgba(163,230,53,.15); color: var(--accent); }
    .dupr-chip-rejected, .dupr-chip-failed { background: rgba(239,68,68,.15); color: #ef4444; }
    .dupr-chip-disputed { background: rgba(249,115,22,.15); color: #f97316; }
    .dupr-modal-textarea {
      width: 100%;
      box-sizing: border-box;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      color: var(--text);
      padding: .6rem .7rem;
      font-family: inherit;
      font-size: .88rem;
      resize: vertical;
      margin-top: .5rem;
    }
    .match-time { flex-shrink: 0; color: var(--soft); font-size: .74rem; }
    .match-empty { padding: .8rem .35rem; color: var(--soft); font-size: .84rem; }
    .match-delete-confirm { display: inline-flex; align-items: center; gap: .4rem; color: #ef4444; font-size: .78rem; font-weight: 800; flex-shrink: 0; }
    .match-delete-error { flex-basis: 100%; color: #ef4444; font-size: .74rem; }

    /* ── Tap-to-swap rearrange ── */
    .move-banner {
      display: flex;
      align-items: center;
      gap: .55rem;
      margin-bottom: .8rem;
      padding: .55rem .7rem;
      border-radius: 8px;
      background: rgba(56,189,248,.09);
      border: 1px solid rgba(56,189,248,.26);
      font-size: .84rem;
    }
    .move-banner i { color: var(--blue); }
    .move-banner-msg { flex: 1; min-width: 0; color: var(--text); }
    .icon-btn.swap-target {
      color: var(--blue);
      border-color: rgba(56,189,248,.4);
      background: rgba(56,189,248,.14);
    }
    .icon-btn.moving-src {
      color: var(--amber);
      border-color: rgba(245,158,11,.4);
      background: rgba(245,158,11,.14);
    }
    .free-slots { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: .55rem; }
    .free-slot-btn {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      min-height: 36px;
      padding: .35rem .7rem;
      border-radius: 8px;
      border: 1px dashed rgba(56,189,248,.45);
      background: rgba(56,189,248,.08);
      color: var(--blue);
      font-family: inherit;
      font-size: .78rem;
      font-weight: 800;
      cursor: pointer;
    }
    .free-slot-btn:hover:not(:disabled) { background: rgba(56,189,248,.16); }
    .score-fields { display: flex; align-items: flex-end; gap: .6rem; margin-top: .8rem; }
    .score-field { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
    .score-field span {
      font-size: .74rem;
      font-weight: 800;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .score-field input {
      width: 100%;
      min-height: 42px;
      padding: .4rem .5rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.07);
      color: var(--text);
      font-family: inherit;
      font-size: 1rem;
      font-weight: 800;
      text-align: center;
    }
    .score-field input:focus { outline: none; border-color: rgba(163,230,53,.5); }
    .score-fields .score-dash { padding-bottom: .7rem; }
    .score-error {
      margin: .6rem 0 0;
      font-size: .8rem;
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: .4rem;
    }

    .panel-head-right { display: flex; align-items: center; gap: .55rem; }
    .qr-btn {
      width: 36px; height: 36px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 8px; border: 1px solid rgba(163,230,53,.28);
      background: rgba(163,230,53,.1); color: var(--accent);
      font-size: .95rem; cursor: pointer; transition: background .15s;
    }
    .qr-btn:hover { background: rgba(163,230,53,.2); }

    .qr-modal-card { max-width: 340px; }
    .qr-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
    .qr-close-btn {
      flex-shrink: 0; width: 32px; height: 32px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 6px; border: 1px solid var(--border);
      background: rgba(255,255,255,.06); color: var(--muted); cursor: pointer;
    }
    .qr-close-btn:hover { background: rgba(255,255,255,.12); color: var(--text); }
    .qr-loading { padding: 2rem; text-align: center; color: var(--muted); }
    .qr-image-wrap {
      display: flex; align-items: center; justify-content: center;
      padding: 1rem; background: #fff; border-radius: 8px;
    }
    .qr-image { width: 220px; height: 220px; display: block; }
    .qr-modal-actions { display: flex; gap: .6rem; justify-content: flex-end; }
    .qr-download-btn {
      display: inline-flex; align-items: center; gap: .4rem;
      text-decoration: none; cursor: pointer;
      border-radius: 8px; border: 0;
    }

    @media (max-width: 980px) {
      .content-grid { grid-template-columns: 1fr; }
      .side-column { position: static; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 720px) {
      .queue-shell { padding-inline: .75rem; }
      .topbar { grid-template-columns: 42px minmax(0, 1fr); }
      .status-pill, .tv-display-btn { grid-column: 1 / -1; justify-self: start; }
      .hero-panel { grid-template-columns: 1fr; padding: 1rem; }
      .venue-mark { width: 48px; height: 48px; flex-basis: 48px; }
      .hero-actions { align-items: stretch; }
      .primary-action, .danger-action { width: 100%; }
      .panel { padding: .85rem; }
      .queue-row { align-items: flex-start; flex-wrap: wrap; }
      .q-name { min-width: calc(100% - 50px); }
      .q-games { margin-left: 49px; }
      .row-actions { width: 100%; margin-left: 49px; justify-content: flex-start; flex-wrap: wrap; }
      .assign-panel, .walkin-row { flex-direction: column; align-items: stretch; }
      .assign-actions { width: 100%; }
      .assign-actions > * { flex: 1; }
      .roster-row {
        align-items: center;
        flex-wrap: nowrap;
        gap: .55rem;
        min-height: 50px;
      }
      .roster-main {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: .4rem;
      }
      .roster-name {
        display: inline-block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .roster-meta {
        display: inline-flex;
        flex-shrink: 0;
        font-size: .68rem;
        color: rgba(255,255,255,.48);
      }
      .roster-row .state-tag {
        margin-left: 0;
        max-width: 96px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .court-teams { grid-template-columns: 1fr; gap: .7rem; }
      .vs-divider { margin: 0; justify-self: center; }
    }

    @media (max-width: 440px) {
      .stats-grid { grid-template-columns: 1fr; }
      .stat-card { min-height: 82px; }
      .hero-title { gap: .65rem; }
      .hero-main h2 { font-size: 1.8rem; }
      .venue-mark { width: 42px; height: 42px; flex-basis: 42px; }
      .venue-initials { font-size: .72rem; }
      .player-chip { padding: .55rem; }
      .player-meta { max-width: 48px; overflow: hidden; text-overflow: ellipsis; }
      .modal-actions { flex-direction: column-reverse; }
      .modal-actions > * { width: 100%; }
    }
  `],
})
export class AdminHostedPlayQueueComponent implements OnInit, OnDestroy {
  id = '';
  board: QueueBoard | null = null;
  loading = true;
  error = '';
  busy = false;
  walkInName = '';
  walkInMode = signal<'guest' | 'member'>('guest');
  members = signal<MemberBalance[]>([]);
  membersLoading = signal(false);
  memberSearch = signal('');
  selectedWalkInMember = signal<MemberBalance | null>(null);
  confirmingFinishCourt: number | null = null;
  selectingWinnerCourt: number | null = null; // winner_stays / king_of_court: pick the winning side
  winnerIds = new Set<string>();
  private finishConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  lastUpdated = '';
  clubCourts: Court[] = [];
  private pollSub?: Subscription;
  private readonly POLL_MS = 6000;

  importModalOpen = signal(false);

  modal: { type: 'remove' | 'end'; player?: QueuePlayer } | null = null;
  qrModal: { generating: boolean; dataUrl?: string; downloadUrl?: string } | null = null;
  umpireLinkModal: { courtNumber: number; generating: boolean; dataUrl?: string; url?: string; copied?: boolean } | null = null;

  matches: HostedPlayMatch[] = [];
  matchesLoading = false;
  duprSubmissions = new Map<string, DuprMatchSubmission>();
  duprRetryingIds = new Set<string>();
  confirmingDeleteId: string | null = null; // matchId showing the inline "are you sure" state
  deletingMatchIds = new Set<string>();
  deleteMatchError = '';
  duprActionModal: { submission: DuprMatchSubmission; mode: 'dispute' | 'resolve'; reason: string; s1: number | null; s2: number | null; saving: boolean; error: string } | null = null;
  finishScoreA: number | null = null; // optional score inputs in winner-picker mode
  finishScoreB: number | null = null;
  scoreAutoFilled = false; // true when finishScoreA/B were carried over from the umpire's live score
  scoreModal: { match: HostedPlayMatch; s1: number | null; s2: number | null; saving: boolean; error: string } | null = null;
  scorePrompt: HostedPlayMatch | null = null; // "Add score?" banner after a scoreless finish
  movingPlayer: QueuePlayer | null = null; // tap-to-swap: the selected court player being rearranged

  assigningCourt: number | null = null;
  selectedIds = new Set<string>();

  constructor(
    private hp: HostedPlayService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private clubService: ClubService,
    private credit: CreditService,
    private dupr: DuprService,
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
    this.hp.getQueue(this.id).subscribe({
      next: (b) => { this.setBoard(b); this.loading = false; this.startPolling(); this.cdr.detectChanges(); },
      error: (err) => { this.loading = false; this.error = err?.error?.error || 'Failed to load queue.'; this.cdr.detectChanges(); },
    });
    this.loadMatches();
  }

  ngOnDestroy() {
    this.stopPolling();
    if (this.finishConfirmTimer) clearTimeout(this.finishConfirmTimer);
  }

  // Auto-refresh the live console so self-check-ins and rotations appear without
  // tapping refresh. Skips ticks while the admin is mid-action (busy, a modal
  // open, assigning, or confirming a finish) so a background poll never clobbers
  // an in-progress interaction. Resilient to transient network errors.
  private startPolling() {
    if (this.pollSub) return;
    this.pollSub = interval(this.POLL_MS).pipe(
      switchMap(() => (this.canPoll() ? this.hp.getQueue(this.id).pipe(catchError(() => EMPTY)) : EMPTY)),
    ).subscribe((b) => {
      this.setBoard(b);
      if (b.session.queueStatus === 'ended') this.stopPolling();
      this.cdr.detectChanges();
    });
  }

  private canPoll(): boolean {
    return !this.busy
      && !this.modal
      && !this.qrModal
      && !this.scoreModal
      && !this.movingPlayer
      && this.assigningCourt === null
      && this.confirmingFinishCourt === null
      && this.selectingWinnerCourt === null
      && this.board?.session?.queueStatus !== 'ended';
  }

  private stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  refresh() {
    if (this.busy) return;
    this.busy = true;
    this.cdr.detectChanges();
    this.hp.getQueue(this.id).subscribe({
      next: (b) => { this.setBoard(b); this.busy = false; this.cdr.detectChanges(); },
      error: () => { this.busy = false; this.cdr.detectChanges(); },
    });
  }

  private setBoard(b: QueueBoard) {
    this.board = b;
    this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private act(obs: Observable<QueueBoard>, onSuccess?: () => void) {
    this.busy = true;
    this.error = '';
    this.cdr.detectChanges();
    obs.subscribe({
      next: (b) => { this.setBoard(b); this.busy = false; onSuccess?.(); this.cdr.detectChanges(); },
      error: (err) => { this.busy = false; this.error = err?.error?.error || 'Action failed.'; this.cdr.detectChanges(); },
    });
  }

  statusLabel(): string {
    const s = this.board?.session?.queueStatus;
    return s === 'running' ? 'Live' : s === 'paused' ? 'Paused' : s === 'ended' ? 'Ended' : 'Not started';
  }

  stateLabel(p: QueuePlayer): string {
    switch (p.queueStatus) {
      case 'waiting': return 'Waiting';
      case 'playing': return 'Playing - C' + (p.courtNumber ?? '');
      case 'paused': return 'Paused';
      case 'done': return 'Done';
      default: return p.checkedIn ? 'Ready' : 'Not in';
    }
  }

  heroHint(): string {
    if (!this.board) return '';
    const status = this.board.session.queueStatus;
    if (status === 'not_started') return 'Check players in, add walk-ins, then start automatic court rotation.';
    if (status === 'ended') return 'This queue has ended. Attendance and game counts are preserved.';
    return 'Monitor active courts, manage the waiting list, and keep rotation moving.';
  }

  checkedInCount(): number {
    return this.board?.roster.filter(p => p.checkedIn).length ?? 0;
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  courtForSession(): Court | undefined {
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
    return this.courtForSession()?.name || session?.court || session?.venue || session?.title || 'Venue';
  }

  venueInitials(): string {
    const parts = this.venueLabel().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  startQueue() { this.act(this.hp.startQueue(this.id)); }

  endSession() { this.modal = { type: 'end' }; this.cdr.detectChanges(); }

  toggleCheckIn(p: QueuePlayer) { this.act(this.hp.checkIn(this.id, p._id, !p.checkedIn)); }

  addWalkIn() {
    if (this.walkInMode() === 'member') {
      const m = this.selectedWalkInMember();
      if (!m) return;
      this.selectedWalkInMember.set(null);
      this.memberSearch.set('');
      // Re-fetch balances afterwards — adding may have redeemed credit.
      this.act(this.hp.addWalkIn(this.id, { memberId: m._id }), () => this.loadMembers());
      return;
    }
    const name = this.walkInName.trim();
    if (!name) return;
    this.walkInName = '';
    this.act(this.hp.addWalkIn(this.id, { name }));
  }

  setWalkInMode(mode: 'guest' | 'member') {
    this.walkInMode.set(mode);
    if (mode === 'member' && !this.members().length && !this.membersLoading()) this.loadMembers();
  }

  private loadMembers() {
    this.membersLoading.set(true);
    this.credit.getMembersWithBalances().subscribe({
      next: (list) => { this.members.set(list); this.membersLoading.set(false); this.cdr.detectChanges(); },
      error: () => { this.membersLoading.set(false); this.cdr.detectChanges(); },
    });
  }

  // Plain method (not computed): `board` is a non-signal property, so a computed
  // would go stale when the roster changes without a signal write.
  filteredWalkInMembers(): MemberBalance[] {
    const q = this.memberSearch().trim().toLowerCase();
    if (!q) return [];
    const inSession = new Set(
      (this.board?.roster ?? []).filter((p) => p.memberId).map((p) => String(p.memberId)),
    );
    return this.members()
      .filter((m) => !inSession.has(m._id))
      .filter((m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q))
      .slice(0, 8);
  }

  selectWalkInMember(m: MemberBalance) {
    this.selectedWalkInMember.set(m);
    this.memberSearch.set('');
  }

  clearWalkInMember() {
    this.selectedWalkInMember.set(null);
  }

  memberWalkInTotal(): number {
    return this.board?.session.totalPerPlayer ?? 0;
  }

  memberWalkInCredit(): number {
    const balance = this.selectedWalkInMember()?.balance ?? 0;
    return Math.min(balance, this.memberWalkInTotal());
  }

  memberWalkInDue(): number {
    return Math.max(0, this.memberWalkInTotal() - this.memberWalkInCredit());
  }

  // Winner-based modes ask the admin to tap the winning side before finishing.
  needsWinner(): boolean {
    const m = this.board?.session?.queueMode;
    return m === 'winner_stays' || m === 'king_of_court';
  }

  requestFinish(court: number) {
    if (this.needsWinner()) {
      this.confirmingFinishCourt = null;
      if (this.finishConfirmTimer) { clearTimeout(this.finishConfirmTimer); this.finishConfirmTimer = null; }
      this.selectingWinnerCourt = court;
      this.winnerIds.clear();
      this.finishScoreA = null;
      this.finishScoreB = null;
      this.scoreAutoFilled = false;

      // If an umpire has been tracking a live score for this court, carry it
      // over so the admin doesn't have to ask and retype it — they can just
      // review and confirm. Only kicks in once a game has actually started
      // (servingTeam set), not for a court that's merely idle.
      const courtData = this.board?.courts.find((c) => c.courtNumber === court);
      const live = courtData?.liveScore;
      if (courtData && live && live.servingTeam) {
        this.finishScoreA = live.team1Score;
        this.finishScoreB = live.team2Score;
        this.scoreAutoFilled = true;
        if (live.team1Score !== live.team2Score) {
          const teams = this.teamsFor(courtData);
          const winningTeam = live.team1Score > live.team2Score ? teams.teamA : teams.teamB;
          winningTeam.forEach((p) => this.winnerIds.add(p._id));
        }
      }

      this.cdr.detectChanges();
      return;
    }
    this.confirmingFinishCourt = court;
    this.cdr.detectChanges();
    if (this.finishConfirmTimer) clearTimeout(this.finishConfirmTimer);
    this.finishConfirmTimer = setTimeout(() => {
      this.confirmingFinishCourt = null;
      this.finishConfirmTimer = null;
      this.cdr.detectChanges();
    }, 4000);
  }

  confirmFinish(court: number) {
    if (this.finishConfirmTimer) { clearTimeout(this.finishConfirmTimer); this.finishConfirmTimer = null; }
    this.confirmingFinishCourt = null;
    this.act(this.hp.finishCourt(this.id, court), () => this.afterFinish());
  }

  toggleWinner(id: string) {
    if (this.winnerIds.has(id)) this.winnerIds.delete(id);
    else this.winnerIds.add(id);
    this.cdr.detectChanges();
  }

  teamsFor(c: QueueCourt): { teamA: QueuePlayer[]; teamB: QueuePlayer[] } {
    return splitCourtTeams(c.players, this.board?.session?.playersPerCourt ?? 4);
  }

  isTeamWinner(team: QueuePlayer[]): boolean {
    return team.length > 0 && team.every(p => this.winnerIds.has(p._id));
  }

  // Tap anywhere on a team block to select/deselect the whole team as winners at once.
  toggleTeamWinner(team: QueuePlayer[]) {
    const allIn = this.isTeamWinner(team);
    for (const p of team) {
      if (allIn) this.winnerIds.delete(p._id);
      else this.winnerIds.add(p._id);
    }
    this.cdr.detectChanges();
  }

  confirmFinishWinners(court: number) {
    if (this.winnerIds.size === 0) return;
    const scores = this.parseFinishScores();
    if (scores === 'invalid' || this.finishScoreHint()) return;
    const ids = [...this.winnerIds];
    this.selectingWinnerCourt = null;
    this.winnerIds.clear();
    this.finishScoreA = null;
    this.finishScoreB = null;
    this.scoreAutoFilled = false;
    this.act(this.hp.finishCourt(this.id, court, ids, scores ?? undefined), () => this.afterFinish());
  }

  cancelFinish() {
    if (this.finishConfirmTimer) { clearTimeout(this.finishConfirmTimer); this.finishConfirmTimer = null; }
    this.confirmingFinishCourt = null;
    this.selectingWinnerCourt = null;
    this.winnerIds.clear();
    this.finishScoreA = null;
    this.finishScoreB = null;
    this.scoreAutoFilled = false;
    this.cdr.detectChanges();
  }

  // ── Match records (scores) ──

  // Both empty = no scores (the common, zero-friction path); anything else must
  // be a complete pair of non-negative integers.
  private parseFinishScores(): { team1Score: number; team2Score: number } | null | 'invalid' {
    const a = this.finishScoreA;
    const b = this.finishScoreB;
    if (a === null && b === null) return null;
    if (a === null || b === null) return 'invalid';
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return 'invalid';
    return { team1Score: a, team2Score: b };
  }

  // Mirrors the backend validation so the Finish button blocks bad input early.
  finishScoreHint(): string {
    const p = this.parseFinishScores();
    if (p === 'invalid') return 'Enter both scores as whole numbers';
    if (p && this.board && this.selectingWinnerCourt !== null) {
      const court = this.board.courts.find((c) => c.courtNumber === this.selectingWinnerCourt);
      if (court) {
        const teams = this.teamsFor(court);
        const aWon = this.isTeamWinner(teams.teamA);
        const bWon = this.isTeamWinner(teams.teamB);
        if (aWon && !bWon && p.team1Score <= p.team2Score) return "The winner's score must be higher";
        if (bWon && !aWon && p.team2Score <= p.team1Score) return "The winner's score must be higher";
      }
    }
    return '';
  }

  // Advisory-only (never blocks saving): flags a score that doesn't match the
  // session's configured pickleball target/win-by-2, in case it was mistyped.
  // Real games legitimately end short at session time, so this never hard-blocks.
  private pickleballScoreAdvisory(s1: number, s2: number): string {
    const session = this.board?.session;
    if (!session || session.sport !== 'pickleball' || !session.scoreTarget) return '';
    const winning = Math.max(s1, s2);
    const margin = Math.abs(s1 - s2);
    if (winning < session.scoreTarget) return `Below the target of ${session.scoreTarget} points`;
    if (session.winByTwo !== false && margin < 2) return 'Win margin is less than 2 points';
    return '';
  }

  finishScoreAdvisory(): string {
    const p = this.parseFinishScores();
    if (!p || p === 'invalid') return '';
    return this.pickleballScoreAdvisory(p.team1Score, p.team2Score);
  }

  scoreModalAdvisory(): string {
    const sm = this.scoreModal;
    if (!sm || sm.s1 === null || sm.s2 === null || !Number.isInteger(sm.s1) || !Number.isInteger(sm.s2)) return '';
    return this.pickleballScoreAdvisory(sm.s1, sm.s2);
  }

  private afterFinish() {
    this.loadMatches();
    const m = this.board?.lastMatch;
    this.scorePrompt = m && m.team1Score === null ? m : null;
    this.cdr.detectChanges();
  }

  teamNames(t: MatchPlayer[]): string {
    return t.map((p) => p.memberName || 'Player').join(' & ');
  }

  loadMatches() {
    this.matchesLoading = true;
    this.cdr.detectChanges();
    this.hp.listMatches(this.id).subscribe({
      next: (list) => {
        this.matches = list;
        this.matchesLoading = false;
        this.cdr.detectChanges();
        this.loadDuprSubmissions();
      },
      error: () => { this.matchesLoading = false; this.cdr.detectChanges(); },
    });
  }

  private loadDuprSubmissions() {
    this.dupr.getSubmissionsForSession(this.id).subscribe({
      next: (list) => {
        this.duprSubmissions = new Map(list.map((s) => [s.sourceMatchId, s]));
        this.cdr.detectChanges();
      },
      error: () => { /* DUPR chip just stays hidden if this fails - not critical path. */ },
    });
  }

  duprSubmissionFor(matchId: string): DuprMatchSubmission | null {
    return this.duprSubmissions.get(matchId) || null;
  }

  retryDupr(submission: DuprMatchSubmission) {
    this.duprRetryingIds.add(submission._id);
    this.cdr.detectChanges();
    this.dupr.resubmit(submission._id).subscribe({
      next: () => { this.duprRetryingIds.delete(submission._id); this.loadDuprSubmissions(); this.cdr.detectChanges(); },
      error: () => { this.duprRetryingIds.delete(submission._id); this.cdr.detectChanges(); },
    });
  }

  confirmDeleteMatch(matchId: string) {
    this.deleteMatchError = '';
    this.confirmingDeleteId = matchId;
  }

  cancelDeleteMatch() {
    this.confirmingDeleteId = null;
  }

  // Deleting a match that was submitted to DUPR also retracts it there (see the
  // backend route) — DUPR recalculates ratings without it and pushes the update
  // back through the existing rating webhook, same as any other rating change.
  deleteMatch(matchId: string) {
    this.deletingMatchIds.add(matchId);
    this.deleteMatchError = '';
    this.cdr.detectChanges();
    this.hp.deleteMatch(matchId).subscribe({
      next: () => {
        this.matches = this.matches.filter((m) => m._id !== matchId);
        this.duprSubmissions.delete(matchId);
        this.deletingMatchIds.delete(matchId);
        this.confirmingDeleteId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.deletingMatchIds.delete(matchId);
        this.deleteMatchError = err?.error?.error || 'Failed to delete this game.';
        this.cdr.detectChanges();
      },
    });
  }

  openDuprDispute(submission: DuprMatchSubmission) {
    this.duprActionModal = { submission, mode: 'dispute', reason: '', s1: null, s2: null, saving: false, error: '' };
  }

  openDuprResolve(submission: DuprMatchSubmission, match: HostedPlayMatch) {
    this.duprActionModal = { submission, mode: 'resolve', reason: '', s1: match.team1Score, s2: match.team2Score, saving: false, error: '' };
  }

  closeDuprActionModal() {
    if (this.duprActionModal?.saving) return;
    this.duprActionModal = null;
  }

  submitDuprActionModal() {
    const dam = this.duprActionModal;
    if (!dam || dam.saving) return;
    if (dam.mode === 'dispute' && !dam.reason.trim()) {
      dam.error = 'A reason is required.';
      this.cdr.detectChanges();
      return;
    }
    dam.saving = true;
    dam.error = '';
    this.cdr.detectChanges();

    const request$ = dam.mode === 'dispute'
      ? this.dupr.dispute(dam.submission._id, dam.reason.trim())
      : this.dupr.resolve(dam.submission._id, dam.s1 ?? undefined, dam.s2 ?? undefined);

    request$.subscribe({
      next: () => {
        this.duprActionModal = null;
        this.loadDuprSubmissions();
        this.loadMatches();
        this.cdr.detectChanges();
      },
      error: (err) => {
        dam.saving = false;
        dam.error = err.error?.error || 'Failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  openScoreModal(m: HostedPlayMatch) {
    this.scoreModal = { match: m, s1: m.team1Score, s2: m.team2Score, saving: false, error: '' };
    this.cdr.detectChanges();
  }

  closeScoreModal() {
    if (this.scoreModal?.saving) return;
    this.scoreModal = null;
    this.cdr.detectChanges();
  }

  saveScore() {
    const sm = this.scoreModal;
    if (!sm) return;
    const s1 = sm.s1;
    const s2 = sm.s2;
    if (s1 === null || s2 === null || !Number.isInteger(s1) || !Number.isInteger(s2) || s1 < 0 || s2 < 0) {
      sm.error = 'Enter both scores as whole numbers';
      this.cdr.detectChanges();
      return;
    }
    sm.saving = true;
    sm.error = '';
    this.cdr.detectChanges();
    this.hp.updateMatchScore(sm.match._id, s1, s2).subscribe({
      next: (updated) => {
        this.matches = this.matches.map((x) => (x._id === updated._id ? updated : x));
        if (this.scorePrompt?._id === updated._id) this.scorePrompt = null;
        this.scoreModal = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        sm.saving = false;
        sm.error = err?.error?.error || 'Failed to save score.';
        this.cdr.detectChanges();
      },
    });
  }

  dismissScorePrompt() {
    this.scorePrompt = null;
    this.cdr.detectChanges();
  }

  promptScore() {
    if (!this.scorePrompt) return;
    const m = this.scorePrompt;
    this.scorePrompt = null;
    this.openScoreModal(m);
  }

  pause(p: QueuePlayer) { this.act(this.hp.pausePlayer(this.id, p._id)); }
  resume(p: QueuePlayer) { this.act(this.hp.resumePlayer(this.id, p._id)); }
  skip(p: QueuePlayer) { this.act(this.hp.skipPlayer(this.id, p._id)); }
  remove(p: QueuePlayer) { this.modal = { type: 'remove', player: p }; this.cdr.detectChanges(); }

  closeModal() { this.modal = null; this.cdr.detectChanges(); }

  confirmModal() {
    if (!this.modal) return;
    const m = this.modal;
    this.modal = null;
    if (m.type === 'remove' && m.player) this.act(this.hp.removeFromQueue(this.id, m.player._id));
    else if (m.type === 'end') this.act(this.hp.endQueue(this.id));
    this.cdr.detectChanges();
  }

  move(p: QueuePlayer, dir: -1 | 1) {
    if (!this.board) return;
    const ids = this.board.waiting.map((x) => x._id);
    const i = ids.indexOf(p._id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.act(this.hp.reorderQueue(this.id, ids));
  }

  get assignablePlayers(): QueuePlayer[] {
    if (!this.board) return [];
    return this.board.roster.filter(
      (p) => p.checkedIn && ['waiting', 'paused', 'done'].includes(p.queueStatus),
    );
  }

  // ── Tap-to-swap rearrange ──

  beginMove(p: QueuePlayer) {
    this.movingPlayer = p;
    this.cdr.detectChanges();
  }

  cancelMove() {
    this.movingPlayer = null;
    this.cdr.detectChanges();
  }

  swapWith(target: QueuePlayer) {
    const src = this.movingPlayer;
    if (!src || src._id === target._id) return;
    this.movingPlayer = null;
    this.act(this.hp.rearrange(this.id, { participantId: src._id, targetParticipantId: target._id }));
  }

  moveToSlot(courtNumber: number, courtSlot: number) {
    const src = this.movingPlayer;
    if (!src) return;
    this.movingPlayer = null;
    this.act(this.hp.rearrange(this.id, { participantId: src._id, courtNumber, courtSlot }));
  }

  freeSlotsFor(c: QueueCourt): { slot: number; team: 'A' | 'B' }[] {
    const size = this.board?.session?.playersPerCourt ?? 4;
    const half = Math.ceil(size / 2);
    const taken = new Set(c.players.map((p) => p.courtSlot));
    const out: { slot: number; team: 'A' | 'B' }[] = [];
    for (let s = 1; s <= size; s++) {
      if (!taken.has(s)) out.push({ slot: s, team: s <= half ? 'A' : 'B' });
    }
    return out;
  }

  beginAssign(court: number) { this.assigningCourt = court; this.selectedIds.clear(); this.cdr.detectChanges(); }
  cancelAssign() { this.assigningCourt = null; this.selectedIds.clear(); this.cdr.detectChanges(); }

  toggleSelect(p: QueuePlayer) {
    if (this.selectedIds.has(p._id)) {
      this.selectedIds.delete(p._id);
    } else {
      const cap = this.board?.session?.playersPerCourt ?? 4;
      if (this.selectedIds.size >= cap) return;
      this.selectedIds.add(p._id);
    }
    this.cdr.detectChanges();
  }

  confirmAssign() {
    if (this.assigningCourt === null || this.selectedIds.size === 0) return;
    const court = this.assigningCourt;
    const ids = [...this.selectedIds];
    this.assigningCourt = null;
    this.selectedIds.clear();
    this.act(this.hp.assignCourt(this.id, court, ids));
  }

  showImportModal() { this.importModalOpen.set(true); }
  closeImportModal() { this.importModalOpen.set(false); }
  onImported(board: QueueBoard) {
    this.importModalOpen.set(false);
    this.setBoard(board);
    this.cdr.detectChanges();
  }

  showQr() {
    this.qrModal = { generating: true };
    this.cdr.detectChanges();
    this.hp.generateQr(this.id).subscribe({
      next: ({ url }) => this.renderQr(url),
      error: () => { this.qrModal = null; this.cdr.detectChanges(); },
    });
  }

  regenerateQr() {
    if (!this.qrModal) return;
    this.qrModal = { generating: true };
    this.cdr.detectChanges();
    this.hp.generateQr(this.id).subscribe({
      next: ({ url }) => this.renderQr(url),
      error: () => { this.qrModal = null; this.cdr.detectChanges(); },
    });
  }

  private renderQr(url: string) {
    QRCode.toDataURL(url, { width: 440, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((dataUrl: string) => {
        this.qrModal = { generating: false, dataUrl };
        this.cdr.detectChanges();
        // Compose the download poster (headline + session name + QR) in the
        // background; the link falls back to the bare QR until it's ready.
        this.composeQrPoster(dataUrl).then((downloadUrl) => {
          if (this.qrModal?.dataUrl === dataUrl) {
            this.qrModal = { ...this.qrModal, downloadUrl };
            this.cdr.detectChanges();
          }
        });
      })
      .catch(() => { this.qrModal = null; this.cdr.detectChanges(); });
  }

  // Draws a printable poster around the QR: "Scan to Check In" headline and the
  // session title above the code, on a white background. Resolves to the bare
  // QR data URL if canvas composition fails for any reason.
  private composeQrPoster(qrDataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onerror = () => resolve(qrDataUrl);
      img.onload = () => {
        try {
          const W = 600;
          const qrSize = 440;
          const titleFont = '900 36px "Segoe UI", Arial, sans-serif';
          const nameFont = '600 24px "Segoe UI", Arial, sans-serif';
          const metaFont = '700 21px "Segoe UI", Arial, sans-serif';

          // "Sat, Jul 18, 2026 • 18:00 – 21:00" (UTC date, matching the cards)
          const s = this.board?.session;
          const dateLabel = s?.date
            ? new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
            : '';
          const timeLabel = s?.startTime && s?.endTime ? `${s.startTime} – ${s.endTime}` : '';
          const metaLine = [dateLabel, timeLabel].filter(Boolean).join('  •  ');

          // Wrap the session name to at most two lines that fit the poster.
          const scratch = document.createElement('canvas').getContext('2d');
          if (!scratch) return resolve(qrDataUrl);
          scratch.font = nameFont;
          const maxTextWidth = W - 70;
          let lines: string[] = [];
          let line = '';
          for (const word of (this.board?.session?.title || '').trim().split(/\s+/).filter(Boolean)) {
            const test = line ? line + ' ' + word : word;
            if (scratch.measureText(test).width > maxTextWidth && line) {
              lines.push(line);
              line = word;
            } else {
              line = test;
            }
          }
          if (line) lines.push(line);
          if (lines.length > 2) {
            lines = lines.slice(0, 2);
            lines[1] += '…';
          }

          const topPad = 44;
          const titleHeight = 44;
          const nameBlock = lines.length ? lines.length * 32 + 6 : 0;
          const metaBlock = metaLine ? 34 : 0;
          const gap = 18;
          const bottomPad = 44;
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = topPad + titleHeight + nameBlock + metaBlock + gap + qrSize + bottomPad;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(qrDataUrl);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          let y = topPad;
          ctx.fillStyle = '#0f172a';
          ctx.font = titleFont;
          ctx.fillText('Scan to Check In', W / 2, y);
          y += titleHeight;
          ctx.fillStyle = '#475569';
          ctx.font = nameFont;
          for (const l of lines) {
            ctx.fillText(l, W / 2, y);
            y += 32;
          }
          if (metaLine) {
            ctx.fillStyle = '#64748b';
            ctx.font = metaFont;
            ctx.fillText(metaLine, W / 2, y + 4);
            y += 34;
          }
          y += gap;
          ctx.drawImage(img, (W - qrSize) / 2, y, qrSize, qrSize);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(qrDataUrl);
        }
      };
      img.src = qrDataUrl;
    });
  }

  closeQrModal() { this.qrModal = null; this.cdr.detectChanges(); }

  showUmpireLink(courtNumber: number) {
    this.umpireLinkModal = { courtNumber, generating: true };
    this.cdr.detectChanges();
    this.hp.generateUmpireLink(this.id, courtNumber).subscribe({
      next: ({ url }) => this.renderUmpireLink(courtNumber, url),
      error: () => { this.umpireLinkModal = null; this.cdr.detectChanges(); },
    });
  }

  regenerateUmpireLink() {
    if (!this.umpireLinkModal) return;
    const courtNumber = this.umpireLinkModal.courtNumber;
    this.umpireLinkModal = { courtNumber, generating: true };
    this.cdr.detectChanges();
    this.hp.generateUmpireLink(this.id, courtNumber).subscribe({
      next: ({ url }) => this.renderUmpireLink(courtNumber, url),
      error: () => { this.umpireLinkModal = null; this.cdr.detectChanges(); },
    });
  }

  private renderUmpireLink(courtNumber: number, url: string) {
    QRCode.toDataURL(url, { width: 440, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((dataUrl: string) => {
        this.umpireLinkModal = { courtNumber, generating: false, dataUrl, url };
        this.cdr.detectChanges();
      });
  }

  // navigator.clipboard is only defined in secure contexts (HTTPS, or
  // localhost) — on mobile, opening this over a plain-HTTP LAN IP (e.g.
  // testing on a phone against http://192.168.x.x:4200) leaves it undefined,
  // which throws synchronously before any .then() ever runs. Fall back to
  // the classic hidden-textarea + execCommand('copy') technique, which
  // works without a secure context.
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
      this.umpireLinkModal = { ...this.umpireLinkModal, copied: true };
      this.cdr.detectChanges();
      setTimeout(() => {
        if (this.umpireLinkModal) { this.umpireLinkModal = { ...this.umpireLinkModal, copied: false }; this.cdr.detectChanges(); }
      }, 2000);
    }).catch(() => {
      this.cdr.detectChanges();
    });
  }

  closeUmpireLinkModal() { this.umpireLinkModal = null; this.cdr.detectChanges(); }

  goBack() { this.router.navigate(['/admin/hosted-play']); }

  openTvDisplay() {
    window.open(`/admin/hosted-play/${this.id}/queue/display`, '_blank');
  }
}
