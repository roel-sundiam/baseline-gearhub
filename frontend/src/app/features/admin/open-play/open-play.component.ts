import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OpenPlayService,
  OpenPlaySession,
  OpenPlaySessionPlayer,
  OpenPlayMatch,
  OpenPlayRating,
  Sport,
  SessionStatus,
} from '../../../core/services/open-play.service';
import { UsersService } from '../../../core/services/users.service';

@Component({
  selector: 'app-open-play',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="op-shell">

      <header class="hero-panel">
        <div>
          <p class="hero-kicker">Open Play</p>
          <h2>Open Play Sessions</h2>
          <p class="hero-subtitle">Create skill-balanced sessions, generate matches, and track player ratings.</p>
        </div>
      </header>

      <!-- Sport toggle -->
      <div class="sport-toggle">
        <button class="sport-btn" [class.active]="sport() === 'pickleball'" (click)="setSport('pickleball')">
          🏓 Pickleball
        </button>
        <button class="sport-btn" [class.active]="sport() === 'tennis'" (click)="setSport('tennis')">
          🎾 Tennis
        </button>
      </div>

      <!-- Tab bar -->
      <div class="tab-bar">
        <button class="tab-btn" [class.active]="activeTab() === 'sessions'" (click)="activeTab.set('sessions')">
          Sessions
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'leaderboard'" (click)="switchLeaderboard()">
          Leaderboard
        </button>
      </div>

      <!-- ── Sessions Tab ── -->
      @if (activeTab() === 'sessions') {
        <div class="sessions-layout">

          <!-- Session list -->
          <div class="session-list-col">
            <div class="col-header">
              <h3>{{ sport() === 'tennis' ? 'Tennis' : 'Pickleball' }} Sessions</h3>
              <button class="btn-primary" (click)="openCreateModal()">+ New Session</button>
            </div>

            @if (loadingSessions()) {
              <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
            } @else if (sessions().length === 0) {
              <div class="state-msg">No sessions yet. Create one to get started.</div>
            } @else {
              <div class="session-cards">
                @for (s of sessions(); track s._id) {
                  <div class="session-card" [class.active]="selectedSession()?._id === s._id" (click)="selectSession(s)">
                    <div class="sc-top">
                      <span class="sc-title">{{ s.title }}</span>
                      <span class="badge" [class]="'badge-' + s.status">{{ s.status.replace('_', ' ') }}</span>
                    </div>
                    <div class="sc-meta">
                      <span>{{ s.sessionDate | date:'mediumDate' }}</span>
                      <span>{{ s.startTime }} – {{ s.endTime }}</span>
                      <span>{{ s.matchType }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Session detail -->
          @if (selectedSession()) {
            <div class="session-detail-col">
              <div class="detail-header">
                <div class="detail-title-row">
                  <h3>{{ selectedSession()!.title }}</h3>
                  <div class="detail-actions">
                    <button class="btn-icon" title="Edit" (click)="openEditModal(selectedSession()!)">
                      <i class="fas fa-pencil"></i>
                    </button>
                    @if (selectedSession()!.status === 'open') {
                      <button class="btn-icon btn-play" title="Start session" (click)="setStatus('in_progress')">
                        <i class="fas fa-play"></i>
                      </button>
                    }
                    @if (selectedSession()!.status === 'in_progress') {
                      <button class="btn-icon btn-complete" title="Complete session" (click)="setStatus('completed')">
                        <i class="fas fa-check"></i>
                      </button>
                    }
                    <button class="btn-icon btn-danger" title="Delete" (click)="deleteSession()">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <div class="sc-meta">
                  <span>{{ selectedSession()!.sessionDate | date:'mediumDate' }}</span>
                  <span>{{ selectedSession()!.startTime }} – {{ selectedSession()!.endTime }}</span>
                  <span class="badge" [class]="'badge-' + selectedSession()!.status">
                    {{ selectedSession()!.status.replace('_', ' ') }}
                  </span>
                </div>
              </div>

              <div class="detail-panels">

                <!-- Players panel -->
                <div class="panel">
                  <div class="panel-header">
                    <h4>Players ({{ sessionPlayers().length }} / {{ selectedSession()!.maxPlayers }})</h4>
                    <button class="btn-sm" (click)="showAddPlayer = !showAddPlayer">
                      {{ showAddPlayer ? 'Cancel' : '+ Add Player' }}
                    </button>
                  </div>

                  @if (showAddPlayer) {
                    <div class="add-player-row">
                      <select class="select-input" [(ngModel)]="addPlayerId">
                        <option value="">— Select player —</option>
                        @for (u of availablePlayers(); track u._id) {
                          <option [value]="u._id">{{ u.name }}</option>
                        }
                      </select>
                      <button class="btn-primary" [disabled]="!addPlayerId || addingPlayer()" (click)="addPlayer()">
                        Add
                      </button>
                    </div>
                  }

                  @if (loadingPlayers()) {
                    <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
                  } @else if (sessionPlayers().length === 0) {
                    <div class="state-msg">No players registered yet.</div>
                  } @else {
                    <div class="player-list">
                      @for (p of sessionPlayers(); track p._id) {
                        <div class="player-row">
                          <div class="player-info">
                            <span class="player-name">{{ p.playerId?.name ?? p.guestName ?? 'Guest' }}</span>
                            <span class="player-rating">CRI {{ p.ratingSnapshot.toFixed(1) }}</span>
                          </div>
                          <div class="player-actions">
                            <button
                              class="btn-checkin"
                              [class.checked]="p.checkedIn"
                              (click)="toggleCheckin(p)"
                              title="{{ p.checkedIn ? 'Uncheck' : 'Check in' }}"
                            >
                              <i class="fas" [class.fa-circle-check]="p.checkedIn" [class.fa-circle]="!p.checkedIn"></i>
                            </button>
                            <button class="btn-icon btn-danger" (click)="removePlayer(p)">
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Matches panel -->
                <div class="panel">
                  <div class="panel-header">
                    <h4>Matches</h4>
                    <div class="panel-header-actions">
                      @if (matches().length > 0) {
                        <button class="btn-sm" [class.active-mode]="rearrangeMode()" (click)="toggleRearrange()">
                          <i class="fas fa-arrows-up-down-left-right"></i>
                          {{ rearrangeMode() ? 'Done' : 'Rearrange' }}
                        </button>
                      }
                      <button
                        class="btn-primary"
                        [disabled]="checkedInCount() < 2 || generatingMatches()"
                        (click)="generateMatches()"
                      >
                        @if (generatingMatches()) { <i class="fas fa-circle-notch fa-spin"></i> } @else { ⚡ }
                        Generate
                      </button>
                    </div>
                  </div>

                  @if (checkedInCount() < 2 && sessionPlayers().length > 0) {
                    <div class="info-note">Check in at least 2 players to generate matches.</div>
                  }

                  @if (loadingMatches()) {
                    <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
                  } @else if (matches().length === 0) {
                    <div class="state-msg">No matches yet.</div>
                  } @else {

                    <!-- Rearrange mode: player pool -->
                    @if (rearrangeMode()) {
                      <div class="player-pool">
                        <div class="pool-label">Drag players into match slots</div>
                        <div class="pool-chips">
                          @for (p of sessionPlayers(); track p._id) {
                            @if (p.playerId) {
                              <div
                                class="pool-chip"
                                draggable="true"
                                (dragstart)="onDragStart($event, p.playerId._id, p.playerId.name)"
                              >
                                {{ p.playerId.name }}
                              </div>
                            }
                          }
                        </div>
                      </div>
                    }

                    <div class="match-list">
                      @for (m of matches(); track m._id) {
                        <div class="match-card" [class.completed]="m.status === 'completed'" [class.saving]="savingMatchId() === m._id">

                          <div class="match-court">
                            {{ m.court }}
                            @if (savingMatchId() === m._id) {
                              <i class="fas fa-circle-notch fa-spin saving-spin"></i>
                            }
                          </div>

                          @if (rearrangeMode() && m.status === 'pending') {
                            <!-- Drag-and-drop layout -->
                            <div class="dnd-match">
                              <div class="dnd-team">
                                <span class="dnd-team-label">Team 1</span>
                                <div
                                  class="dnd-slot"
                                  [class.filled]="m.team1Player1"
                                  (dragover)="onDragOver($event)"
                                  (dragleave)="onDragLeave($event)"
                                  (drop)="onDrop($event, m._id, 'team1Player1')"
                                >
                                  @if (m.team1Player1) {
                                    <span
                                      class="dnd-player"
                                      draggable="true"
                                      (dragstart)="onDragStart($event, m.team1Player1._id, m.team1Player1.name, m._id, 'team1Player1')"
                                    >
                                      <i class="fas fa-grip-vertical dnd-grip"></i>
                                      {{ m.team1Player1.name }}
                                    </span>
                                  } @else {
                                    <span class="dnd-empty">Drop here</span>
                                  }
                                </div>
                                @if (selectedSession()?.matchType === 'doubles') {
                                  <div
                                    class="dnd-slot"
                                    [class.filled]="m.team1Player2"
                                    (dragover)="onDragOver($event)"
                                    (dragleave)="onDragLeave($event)"
                                    (drop)="onDrop($event, m._id, 'team1Player2')"
                                  >
                                    @if (m.team1Player2) {
                                      <span
                                        class="dnd-player"
                                        draggable="true"
                                        (dragstart)="onDragStart($event, m.team1Player2._id, m.team1Player2.name, m._id, 'team1Player2')"
                                      >
                                        <i class="fas fa-grip-vertical dnd-grip"></i>
                                        {{ m.team1Player2.name }}
                                      </span>
                                    } @else {
                                      <span class="dnd-empty">Drop here</span>
                                    }
                                  </div>
                                }
                              </div>

                              <div class="dnd-vs">vs</div>

                              <div class="dnd-team">
                                <span class="dnd-team-label">Team 2</span>
                                <div
                                  class="dnd-slot"
                                  [class.filled]="m.team2Player1"
                                  (dragover)="onDragOver($event)"
                                  (dragleave)="onDragLeave($event)"
                                  (drop)="onDrop($event, m._id, 'team2Player1')"
                                >
                                  @if (m.team2Player1) {
                                    <span
                                      class="dnd-player"
                                      draggable="true"
                                      (dragstart)="onDragStart($event, m.team2Player1._id, m.team2Player1.name, m._id, 'team2Player1')"
                                    >
                                      <i class="fas fa-grip-vertical dnd-grip"></i>
                                      {{ m.team2Player1.name }}
                                    </span>
                                  } @else {
                                    <span class="dnd-empty">Drop here</span>
                                  }
                                </div>
                                @if (selectedSession()?.matchType === 'doubles') {
                                  <div
                                    class="dnd-slot"
                                    [class.filled]="m.team2Player2"
                                    (dragover)="onDragOver($event)"
                                    (dragleave)="onDragLeave($event)"
                                    (drop)="onDrop($event, m._id, 'team2Player2')"
                                  >
                                    @if (m.team2Player2) {
                                      <span
                                        class="dnd-player"
                                        draggable="true"
                                        (dragstart)="onDragStart($event, m.team2Player2._id, m.team2Player2.name, m._id, 'team2Player2')"
                                      >
                                        <i class="fas fa-grip-vertical dnd-grip"></i>
                                        {{ m.team2Player2.name }}
                                      </span>
                                    } @else {
                                      <span class="dnd-empty">Drop here</span>
                                    }
                                  </div>
                                }
                              </div>
                            </div>

                          } @else {
                            <!-- Normal view -->
                            <div class="match-teams">
                              <div class="team">
                                <span>{{ m.team1Player1?.name }}</span>
                                @if (m.team1Player2) { <span>/ {{ m.team1Player2.name }}</span> }
                              </div>
                              <div class="vs">
                                @if (m.status === 'completed') {
                                  <span class="score">{{ m.team1Score }} – {{ m.team2Score }}</span>
                                } @else {
                                  <span>vs</span>
                                }
                              </div>
                              <div class="team">
                                <span>{{ m.team2Player1?.name }}</span>
                                @if (m.team2Player2) { <span>/ {{ m.team2Player2.name }}</span> }
                              </div>
                            </div>
                            <div class="match-actions">
                              @if (m.status === 'pending') {
                                <button class="btn-sm btn-score" (click)="openScoreModal(m)">Enter Score</button>
                              } @else {
                                <span class="badge badge-completed">Done</span>
                              }
                            </div>
                          }

                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          } @else {
            <div class="detail-empty">
              <i class="fas fa-table-tennis-paddle-ball"></i>
              <p>Select a session to manage it.</p>
            </div>
          }

        </div>
      }

      <!-- ── Leaderboard Tab ── -->
      @if (activeTab() === 'leaderboard') {
        <div class="leaderboard-wrap">
          @if (loadingLeaderboard()) {
            <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
          } @else if (leaderboard().length === 0) {
            <div class="state-msg">No ratings yet for {{ sport() }}.</div>
          } @else {
            <table class="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>CRI</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Played</th>
                </tr>
              </thead>
              <tbody>
                @for (r of leaderboard(); track r._id; let i = $index) {
                  <tr>
                    <td>{{ i + 1 }}</td>
                    <td>{{ r.playerId?.name }}</td>
                    <td class="cri">{{ r.rating.toFixed(2) }}</td>
                    <td>{{ r.wins }}</td>
                    <td>{{ r.losses }}</td>
                    <td>{{ r.matchesPlayed }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }

    </section>

    <!-- ── Create / Edit Modal ── -->
    @if (showSessionModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingSession ? 'Edit Session' : 'New Session' }}</h3>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Title</label>
              <input class="input" type="text" [(ngModel)]="form.title" placeholder="e.g. Friday Open Play" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Sport</label>
                <select class="input" [(ngModel)]="form.sport">
                  <option value="tennis">Tennis</option>
                  <option value="pickleball">Pickleball</option>
                </select>
              </div>
              <div class="form-group">
                <label>Match Type</label>
                <select class="input" [(ngModel)]="form.matchType">
                  <option value="doubles">Doubles</option>
                  <option value="singles">Singles</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Date</label>
              <input class="input" type="date" [(ngModel)]="form.sessionDate" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Start Time</label>
                <input class="input" type="time" [(ngModel)]="form.startTime" />
              </div>
              <div class="form-group">
                <label>End Time</label>
                <input class="input" type="time" [(ngModel)]="form.endTime" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Max Players</label>
                <input class="input" type="number" [(ngModel)]="form.maxPlayers" min="2" max="64" />
              </div>
              <div class="form-group">
                <label>Max Matches</label>
                <input class="input" type="number" [(ngModel)]="form.maxMatches" min="1" max="50" />
              </div>
            </div>
            @if (modalError()) {
              <div class="alert-error">{{ modalError() }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="btn-primary" [disabled]="savingSession()" (click)="saveSession()">
              @if (savingSession()) { <i class="fas fa-circle-notch fa-spin"></i> } @else { Save }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Score Modal ── -->
    @if (showScoreModal()) {
      <div class="modal-backdrop" (click)="closeScoreModal()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Enter Score</h3>
            <button class="modal-close" (click)="closeScoreModal()"><i class="fas fa-times"></i></button>
          </div>
          @if (scoringMatch) {
            <div class="modal-body">
              <div class="score-teams">
                <div class="score-team">
                  <div class="score-names">
                    <span>{{ scoringMatch.team1Player1?.name }}</span>
                    @if (scoringMatch.team1Player2) { <span>{{ scoringMatch.team1Player2.name }}</span> }
                  </div>
                  <input class="score-input" type="number" [(ngModel)]="score1" min="0" />
                </div>
                <div class="score-vs">vs</div>
                <div class="score-team">
                  <div class="score-names">
                    <span>{{ scoringMatch.team2Player1?.name }}</span>
                    @if (scoringMatch.team2Player2) { <span>{{ scoringMatch.team2Player2.name }}</span> }
                  </div>
                  <input class="score-input" type="number" [(ngModel)]="score2" min="0" />
                </div>
              </div>
              @if (score1 !== null && score2 !== null && score1 === score2) {
                <div class="alert-error">Scores cannot be tied.</div>
              }
              @if (scoreError()) {
                <div class="alert-error">{{ scoreError() }}</div>
              }
            </div>
          }
          <div class="modal-footer">
            <button class="btn-ghost" (click)="closeScoreModal()">Cancel</button>
            <button
              class="btn-primary"
              [disabled]="score1 === null || score2 === null || score1 === score2 || submittingScore()"
              (click)="submitScore()"
            >
              @if (submittingScore()) { <i class="fas fa-circle-notch fa-spin"></i> } @else { Save Score }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .op-shell { padding: 0 0 4rem; background: #0f1a0f; min-height: 100vh; color: #e8f5e8; }

    .hero-panel {
      background: linear-gradient(135deg, #1a2e1a 0%, #0f1a0f 100%);
      border-bottom: 1px solid #2d4a2d;
      padding: 2rem 1.5rem 1.5rem;
    }
    .hero-kicker { color: #a3e635; font-size: .75rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin: 0 0 .25rem; }
    .hero-panel h2 { font-size: 1.75rem; font-weight: 700; color: #fff; margin: 0 0 .25rem; }
    .hero-subtitle { color: #86b086; font-size: .875rem; margin: 0; }

    .sport-toggle {
      display: flex; gap: .5rem; padding: 1rem 1.5rem .5rem;
    }
    .sport-btn {
      background: #1a2e1a; border: 1px solid #2d4a2d; color: #86b086;
      padding: .5rem 1.25rem; border-radius: 2rem; font-size: .875rem; cursor: pointer; transition: all .15s;
    }
    .sport-btn.active { background: #2d6a2d; border-color: #4caf50; color: #fff; }

    .tab-bar {
      display: flex; gap: 0; border-bottom: 1px solid #2d4a2d; padding: 0 1.5rem; margin-top: .5rem;
    }
    .tab-btn {
      background: none; border: none; color: #86b086; padding: .75rem 1.25rem; font-size: .875rem;
      cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s;
    }
    .tab-btn.active { color: #a3e635; border-bottom-color: #a3e635; }

    /* Sessions layout */
    .sessions-layout { display: flex; gap: 1rem; padding: 1rem 1.5rem; min-height: 60vh; }

    .session-list-col { width: 280px; flex-shrink: 0; }
    .col-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; }
    .col-header h3 { font-size: 1rem; font-weight: 600; color: #e8f5e8; margin: 0; }

    .session-cards { display: flex; flex-direction: column; gap: .5rem; }
    .session-card {
      background: #1a2e1a; border: 1px solid #2d4a2d; border-radius: .5rem;
      padding: .75rem; cursor: pointer; transition: all .15s;
    }
    .session-card:hover, .session-card.active { border-color: #4caf50; background: #1e3a1e; }
    .sc-top { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; margin-bottom: .35rem; }
    .sc-title { font-weight: 600; color: #e8f5e8; font-size: .875rem; }
    .sc-meta { display: flex; flex-wrap: wrap; gap: .4rem; font-size: .75rem; color: #86b086; }

    /* Badge */
    .badge { font-size: .7rem; padding: .15rem .5rem; border-radius: 1rem; font-weight: 600; text-transform: capitalize; white-space: nowrap; }
    .badge-open { background: #1e4620; color: #a3e635; }
    .badge-in_progress { background: #1a3a4a; color: #60c0e0; }
    .badge-completed { background: #2a2a2a; color: #888; }
    .badge-cancelled { background: #3a1a1a; color: #e06060; }

    /* Detail col */
    .session-detail-col { flex: 1; min-width: 0; }
    .detail-empty {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #4a6a4a; gap: 1rem; font-size: 3rem;
    }
    .detail-empty p { font-size: 1rem; }

    .detail-header { margin-bottom: 1rem; }
    .detail-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
    .detail-title-row h3 { font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0; }
    .detail-actions { display: flex; gap: .4rem; }

    /* Detail panels */
    .detail-panels { display: flex; gap: 1rem; flex-wrap: wrap; }
    .panel { background: #1a2e1a; border: 1px solid #2d4a2d; border-radius: .75rem; padding: 1rem; flex: 1; min-width: 260px; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; }
    .panel-header h4 { font-size: .9rem; font-weight: 600; color: #e8f5e8; margin: 0; }
    .info-note { font-size: .75rem; color: #86b086; margin-bottom: .5rem; }

    /* Player list */
    .add-player-row { display: flex; gap: .5rem; margin-bottom: .75rem; }
    .select-input { flex: 1; background: #0f1a0f; border: 1px solid #2d4a2d; color: #e8f5e8; padding: .4rem .6rem; border-radius: .375rem; font-size: .8rem; }
    .player-list { display: flex; flex-direction: column; gap: .4rem; }
    .player-row { display: flex; justify-content: space-between; align-items: center; padding: .5rem .6rem; background: #0f1a0f; border-radius: .375rem; }
    .player-info { display: flex; flex-direction: column; gap: .1rem; }
    .player-name { font-size: .85rem; color: #e8f5e8; }
    .player-rating { font-size: .7rem; color: #86b086; }
    .player-actions { display: flex; gap: .3rem; align-items: center; }
    .btn-checkin { background: none; border: none; color: #4a6a4a; font-size: 1.1rem; cursor: pointer; padding: 0; }
    .btn-checkin.checked { color: #4caf50; }

    /* Match list */
    .match-list { display: flex; flex-direction: column; gap: .6rem; }
    .match-card {
      background: #0f1a0f; border: 1px solid #2d4a2d; border-radius: .5rem;
      padding: .6rem .75rem; display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
    }
    .match-card.completed { opacity: .7; }
    .match-court { font-size: .7rem; color: #86b086; min-width: 56px; }
    .match-teams { flex: 1; display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .team { font-size: .8rem; color: #e8f5e8; display: flex; flex-direction: column; gap: .1rem; flex: 1; }
    .vs { font-size: .75rem; color: #86b086; white-space: nowrap; }
    .score { font-weight: 700; color: #a3e635; }
    .panel-header-actions { display: flex; gap: .4rem; align-items: center; }
    .btn-sm.active-mode { background: #2d6a2d; color: #a3e635; border-color: #4caf50; }
    .match-actions { display: flex; align-items: center; gap: .35rem; flex-shrink: 0; }
    .match-card.saving { opacity: .7; }
    .saving-spin { margin-left: .35rem; font-size: .7rem; color: #86b086; }
    .btn-score { background: #2d6a2d; color: #fff; }

    /* Player pool */
    .player-pool { background: #0f1a0f; border: 1px dashed #2d4a2d; border-radius: .5rem; padding: .6rem .75rem; margin-bottom: .75rem; }
    .pool-label { font-size: .7rem; color: #4a6a4a; margin-bottom: .4rem; }
    .pool-chips { display: flex; flex-wrap: wrap; gap: .35rem; }
    .pool-chip {
      background: #1e3a1e; border: 1px solid #3a6a3a; color: #e8f5e8;
      padding: .3rem .7rem; border-radius: 1rem; font-size: .78rem; cursor: grab;
      user-select: none; transition: background .1s;
    }
    .pool-chip:hover { background: #2d6a2d; }
    .pool-chip:active { cursor: grabbing; }

    /* DnD match layout */
    .dnd-match { display: flex; align-items: flex-start; gap: .5rem; padding: .25rem 0; }
    .dnd-team { flex: 1; display: flex; flex-direction: column; gap: .35rem; }
    .dnd-team-label { font-size: .65rem; font-weight: 700; color: #a3e635; text-transform: uppercase; letter-spacing: .06em; margin-bottom: .1rem; }
    .dnd-vs { color: #4a6a4a; font-size: .8rem; padding-top: 1.4rem; flex-shrink: 0; }
    .dnd-slot {
      background: #0f1a0f; border: 1px dashed #2d4a2d; border-radius: .375rem;
      padding: .4rem .6rem; min-height: 34px; display: flex; align-items: center;
      transition: border-color .15s, background .15s;
    }
    .dnd-slot.drag-over { border-color: #4caf50; background: #1a3a1a; }
    .dnd-slot.filled { border-style: solid; border-color: #3a6a3a; }
    .dnd-player {
      display: flex; align-items: center; gap: .4rem; font-size: .8rem; color: #e8f5e8;
      cursor: grab; user-select: none; width: 100%;
    }
    .dnd-player:active { cursor: grabbing; }
    .dnd-grip { color: #4a6a4a; font-size: .65rem; }
    .dnd-empty { font-size: .75rem; color: #3a5a3a; font-style: italic; }

    /* Leaderboard */
    .leaderboard-wrap { padding: 1rem 1.5rem; }
    .lb-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    .lb-table th { text-align: left; padding: .6rem .75rem; color: #86b086; font-weight: 600; border-bottom: 1px solid #2d4a2d; }
    .lb-table td { padding: .6rem .75rem; border-bottom: 1px solid #1a2e1a; color: #e8f5e8; }
    .lb-table tr:hover td { background: #1a2e1a; }
    .cri { font-weight: 700; color: #a3e635; }

    /* Buttons */
    .btn-primary {
      background: #2d6a2d; color: #fff; border: none; padding: .5rem 1rem;
      border-radius: .375rem; font-size: .8rem; cursor: pointer; transition: background .15s;
    }
    .btn-primary:hover:not(:disabled) { background: #3a8a3a; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-sm { background: #1e3a1e; color: #a3e635; border: 1px solid #2d4a2d; padding: .3rem .7rem; border-radius: .375rem; font-size: .75rem; cursor: pointer; }
    .btn-ghost { background: none; border: 1px solid #2d4a2d; color: #86b086; padding: .5rem 1rem; border-radius: .375rem; font-size: .85rem; cursor: pointer; }
    .btn-icon { background: none; border: 1px solid #2d4a2d; color: #86b086; width: 2rem; height: 2rem; border-radius: .375rem; cursor: pointer; font-size: .85rem; display: flex; align-items: center; justify-content: center; }
    .btn-play { border-color: #4caf50; color: #4caf50; }
    .btn-complete { border-color: #a3e635; color: #a3e635; }
    .btn-danger { border-color: #8b3030; color: #e06060; }

    /* State */
    .state-msg { color: #4a6a4a; font-size: .875rem; padding: 1rem 0; text-align: center; }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex;
      align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
    }
    .modal {
      background: #1a2e1a; border: 1px solid #2d4a2d; border-radius: .75rem;
      width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
    }
    .modal-sm { max-width: 380px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #2d4a2d; }
    .modal-header h3 { font-size: 1rem; font-weight: 700; color: #fff; margin: 0; }
    .modal-close { background: none; border: none; color: #86b086; font-size: 1rem; cursor: pointer; }
    .modal-body { padding: 1.25rem; display: flex; flex-direction: column; gap: .75rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: .5rem; padding: 1rem 1.25rem; border-top: 1px solid #2d4a2d; }
    .form-group { display: flex; flex-direction: column; gap: .35rem; }
    .form-group label { font-size: .8rem; color: #86b086; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .input {
      background: #0f1a0f; border: 1px solid #2d4a2d; color: #e8f5e8;
      padding: .5rem .75rem; border-radius: .375rem; font-size: .875rem;
    }
    .input:focus { outline: none; border-color: #4caf50; }
    .alert-error { background: #3a1a1a; border: 1px solid #8b3030; color: #f87171; border-radius: .375rem; padding: .6rem .75rem; font-size: .8rem; }

    /* Score modal */
    .score-teams { display: flex; align-items: center; gap: 1rem; }
    .score-team { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .5rem; }
    .score-names { display: flex; flex-direction: column; align-items: center; gap: .15rem; font-size: .8rem; color: #e8f5e8; text-align: center; }
    .score-input {
      background: #0f1a0f; border: 1px solid #2d4a2d; color: #a3e635;
      padding: .5rem; border-radius: .375rem; font-size: 1.5rem; font-weight: 700;
      width: 5rem; text-align: center;
    }
    .score-vs { color: #86b086; font-size: .85rem; }

    @media (max-width: 768px) {
      .sessions-layout { flex-direction: column; padding: 1rem; }
      .session-list-col { width: 100%; }
      .detail-panels { flex-direction: column; }
      .form-row { grid-template-columns: 1fr; }
    }
  `],
})
export class OpenPlayComponent implements OnInit {
  sport = signal<Sport>('pickleball');
  activeTab = signal<'sessions' | 'leaderboard'>('sessions');

  sessions = signal<OpenPlaySession[]>([]);
  selectedSession = signal<OpenPlaySession | null>(null);
  sessionPlayers = signal<OpenPlaySessionPlayer[]>([]);
  matches = signal<OpenPlayMatch[]>([]);
  leaderboard = signal<OpenPlayRating[]>([]);

  loadingSessions = signal(false);
  loadingPlayers = signal(false);
  loadingMatches = signal(false);
  loadingLeaderboard = signal(false);
  savingSession = signal(false);
  generatingMatches = signal(false);
  addingPlayer = signal(false);
  submittingScore = signal(false);

  showSessionModal = signal(false);
  showScoreModal = signal(false);
  rearrangeMode = signal(false);
  savingMatchId = signal('');
  modalError = signal('');
  scoreError = signal('');

  editingSession: OpenPlaySession | null = null;
  scoringMatch: OpenPlayMatch | null = null;
  private _drag: { playerId: string; playerName: string; fromMatchId: string | null; fromSlot: string | null } | null = null;
  showAddPlayer = false;
  addPlayerId = '';
  score1: number | null = null;
  score2: number | null = null;

  allPlayers = signal<{ _id: string; name: string; email: string }[]>([]);

  form = {
    sport: 'tennis' as Sport,
    title: '',
    sessionDate: '',
    startTime: '',
    endTime: '',
    maxPlayers: 16,
    maxMatches: 8,
    matchType: 'doubles' as 'doubles' | 'singles',
  };

  constructor(
    private openPlay: OpenPlayService,
    private users: UsersService,
  ) {}

  ngOnInit() {
    this.loadSessions();
    this.users.getActivePlayers().subscribe({ next: p => this.allPlayers.set(p) });
  }

  get availablePlayers() {
    return signal(
      this.allPlayers().filter(
        u => !this.sessionPlayers().some(p => p.playerId?._id === u._id),
      ),
    );
  }

  checkedInCount() {
    return this.sessionPlayers().filter(p => p.checkedIn).length;
  }

  setSport(s: Sport) {
    this.sport.set(s);
    this.selectedSession.set(null);
    this.sessionPlayers.set([]);
    this.matches.set([]);
    this.loadSessions();
    if (this.activeTab() === 'leaderboard') this.loadLeaderboard();
  }

  switchLeaderboard() {
    this.activeTab.set('leaderboard');
    this.loadLeaderboard();
  }

  loadSessions() {
    this.loadingSessions.set(true);
    this.openPlay.getSessions(this.sport()).subscribe({
      next: s => { this.sessions.set(s); this.loadingSessions.set(false); },
      error: () => this.loadingSessions.set(false),
    });
  }

  selectSession(s: OpenPlaySession) {
    this.selectedSession.set(s);
    this.showAddPlayer = false;
    this.addPlayerId = '';
    this.rearrangeMode.set(false);
    this.loadSessionPlayers();
    this.loadMatches();
  }

  loadSessionPlayers() {
    if (!this.selectedSession()) return;
    this.loadingPlayers.set(true);
    this.openPlay.getSessionPlayers(this.selectedSession()!._id).subscribe({
      next: p => { this.sessionPlayers.set(p); this.loadingPlayers.set(false); },
      error: () => this.loadingPlayers.set(false),
    });
  }

  loadMatches() {
    if (!this.selectedSession()) return;
    this.loadingMatches.set(true);
    this.openPlay.getMatches(this.selectedSession()!._id).subscribe({
      next: m => { this.matches.set(m); this.loadingMatches.set(false); },
      error: () => this.loadingMatches.set(false),
    });
  }

  loadLeaderboard() {
    this.loadingLeaderboard.set(true);
    this.openPlay.getLeaderboard(this.sport()).subscribe({
      next: r => { this.leaderboard.set(r); this.loadingLeaderboard.set(false); },
      error: () => this.loadingLeaderboard.set(false),
    });
  }

  openCreateModal() {
    this.editingSession = null;
    this.form = {
      sport: this.sport(),
      title: '',
      sessionDate: '',
      startTime: '',
      endTime: '',
      maxPlayers: 16,
      maxMatches: 8,
      matchType: 'doubles',
    };
    this.modalError.set('');
    this.showSessionModal.set(true);
  }

  openEditModal(s: OpenPlaySession) {
    this.editingSession = s;
    this.form = {
      sport: s.sport,
      title: s.title,
      sessionDate: s.sessionDate.substring(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      maxPlayers: s.maxPlayers,
      maxMatches: s.maxMatches,
      matchType: s.matchType,
    };
    this.modalError.set('');
    this.showSessionModal.set(true);
  }

  closeModal() {
    this.showSessionModal.set(false);
  }

  saveSession() {
    if (!this.form.title || !this.form.sessionDate || !this.form.startTime || !this.form.endTime) {
      this.modalError.set('Please fill in all required fields.');
      return;
    }
    this.savingSession.set(true);
    this.modalError.set('');

    const obs = this.editingSession
      ? this.openPlay.updateSession(this.editingSession._id, this.form)
      : this.openPlay.createSession(this.form);

    obs.subscribe({
      next: updated => {
        this.savingSession.set(false);
        this.showSessionModal.set(false);
        this.loadSessions();
        if (this.editingSession) {
          this.selectedSession.set(updated);
        }
      },
      error: err => {
        this.savingSession.set(false);
        this.modalError.set(err.error?.error || 'Failed to save session.');
      },
    });
  }

  setStatus(status: SessionStatus) {
    if (!this.selectedSession()) return;
    this.openPlay.patchSessionStatus(this.selectedSession()!._id, status).subscribe({
      next: s => {
        this.selectedSession.set(s);
        this.sessions.update(list => list.map(x => x._id === s._id ? s : x));
      },
    });
  }

  deleteSession() {
    if (!this.selectedSession()) return;
    if (!confirm(`Delete "${this.selectedSession()!.title}"? This cannot be undone.`)) return;
    this.openPlay.deleteSession(this.selectedSession()!._id).subscribe({
      next: () => {
        this.sessions.update(list => list.filter(x => x._id !== this.selectedSession()!._id));
        this.selectedSession.set(null);
        this.sessionPlayers.set([]);
        this.matches.set([]);
      },
    });
  }

  addPlayer() {
    if (!this.addPlayerId || !this.selectedSession()) return;
    this.addingPlayer.set(true);
    this.openPlay.addPlayer(this.selectedSession()!._id, this.addPlayerId).subscribe({
      next: p => {
        this.sessionPlayers.update(list => [...list, p]);
        this.addPlayerId = '';
        this.showAddPlayer = false;
        this.addingPlayer.set(false);
      },
      error: err => {
        alert(err.error?.error || 'Failed to add player.');
        this.addingPlayer.set(false);
      },
    });
  }

  removePlayer(p: OpenPlaySessionPlayer) {
    this.openPlay.removePlayer(this.selectedSession()!._id, p._id).subscribe({
      next: () => this.sessionPlayers.update(list => list.filter(x => x._id !== p._id)),
    });
  }

  toggleCheckin(p: OpenPlaySessionPlayer) {
    this.openPlay.toggleCheckin(this.selectedSession()!._id, p._id, !p.checkedIn).subscribe({
      next: updated => this.sessionPlayers.update(list => list.map(x => x._id === updated._id ? updated : x)),
    });
  }

  generateMatches() {
    if (!this.selectedSession()) return;
    this.generatingMatches.set(true);
    this.openPlay.generateMatches(this.selectedSession()!._id).subscribe({
      next: m => { this.matches.set(m); this.generatingMatches.set(false); },
      error: err => {
        alert(err.error?.error || 'Failed to generate matches.');
        this.generatingMatches.set(false);
      },
    });
  }

  toggleRearrange() {
    this.rearrangeMode.update(v => !v);
  }

  onDragStart(event: DragEvent, playerId: string, playerName: string, fromMatchId: string | null = null, fromSlot: string | null = null) {
    this._drag = { playerId, playerName, fromMatchId, fromSlot };
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('drag-over');
    event.dataTransfer!.dropEffect = 'move';
  }

  onDragLeave(event: DragEvent) {
    (event.currentTarget as HTMLElement).classList.remove('drag-over');
  }

  onDrop(event: DragEvent, targetMatchId: string, targetSlot: string) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove('drag-over');
    const drag = this._drag;
    this._drag = null;
    if (!drag) return;

    const allMatches = this.matches();
    const targetMatch = allMatches.find(m => m._id === targetMatchId);
    if (!targetMatch) return;

    const slotPlayer = (m: OpenPlayMatch, slot: string) => (m as any)[slot] as { _id: string; name: string } | null;
    const targetCurrentPlayer = slotPlayer(targetMatch, targetSlot);

    // Build target match payload
    const targetPayload: any = {
      team1Player1: targetMatch.team1Player1?._id ?? '',
      team1Player2: targetMatch.team1Player2?._id ?? '',
      team2Player1: targetMatch.team2Player1?._id ?? '',
      team2Player2: targetMatch.team2Player2?._id ?? '',
    };
    targetPayload[targetSlot] = drag.playerId;

    // If dragging from a slot (not pool): handle swap
    let sourcePayload: any = null;
    if (drag.fromMatchId && drag.fromSlot) {
      if (drag.fromMatchId === targetMatchId) {
        // Same match — swap within one API call
        targetPayload[drag.fromSlot] = targetCurrentPlayer?._id ?? '';
      } else {
        // Different match — also update source
        const sourceMatch = allMatches.find(m => m._id === drag.fromMatchId);
        if (sourceMatch) {
          sourcePayload = {
            team1Player1: sourceMatch.team1Player1?._id ?? '',
            team1Player2: sourceMatch.team1Player2?._id ?? '',
            team2Player1: sourceMatch.team2Player1?._id ?? '',
            team2Player2: sourceMatch.team2Player2?._id ?? '',
          };
          sourcePayload[drag.fromSlot] = targetCurrentPlayer?._id ?? '';
        }
      }
    }

    // Save target match
    this.savingMatchId.set(targetMatchId);
    this.openPlay.editMatch(targetMatchId, targetPayload).subscribe({
      next: updated => {
        this.matches.update(list => list.map(m => m._id === updated._id ? updated : m));
        this.savingMatchId.set('');
      },
      error: () => this.savingMatchId.set(''),
    });

    // Save source match if different
    if (sourcePayload && drag.fromMatchId) {
      this.openPlay.editMatch(drag.fromMatchId, sourcePayload).subscribe({
        next: updated => this.matches.update(list => list.map(m => m._id === updated._id ? updated : m)),
      });
    }
  }

  openScoreModal(m: OpenPlayMatch) {
    this.scoringMatch = m;
    this.score1 = null;
    this.score2 = null;
    this.scoreError.set('');
    this.showScoreModal.set(true);
  }

  closeScoreModal() {
    this.showScoreModal.set(false);
    this.scoringMatch = null;
  }

  submitScore() {
    if (this.score1 === null || this.score2 === null || !this.scoringMatch) return;
    this.submittingScore.set(true);
    this.openPlay.submitScore(this.scoringMatch._id, this.score1, this.score2).subscribe({
      next: updated => {
        this.matches.update(list => list.map(m => m._id === updated._id ? updated : m));
        this.submittingScore.set(false);
        this.showScoreModal.set(false);
        this.scoringMatch = null;
      },
      error: err => {
        this.scoreError.set(err.error?.error || 'Failed to submit score.');
        this.submittingScore.set(false);
      },
    });
  }
}
