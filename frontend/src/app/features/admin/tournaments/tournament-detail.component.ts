import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentService, Tournament, TournamentMatch, TournamentPlayer } from '../../../core/services/tournament.service';
import { UsersService } from '../../../core/services/users.service';

interface User { _id: string; name: string; profileImage?: string; }

interface PlayerStat {
  playerId: string;
  name: string;
  profileImage?: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  placement: 'Champion' | 'Runner-up' | 'Semifinalist' | 'Quarterfinalist' | 'Participant';
  pointsEarned: number;
}

@Component({
  selector: 'app-admin-tournament-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>

      @if (loading()) {
        <div class="page-card loading-card">
          <i class="fas fa-circle-notch fa-spin"></i> Loading tournament...
        </div>
      } @else if (!tournament()) {
        <div class="page-card loading-card">Tournament not found.</div>
      } @else {
        @let t = tournament()!;
        <div class="page-card">

          <!-- Header -->
          <div class="card-header">
            <button class="back-btn" (click)="goBack()">← Back</button>
            <div class="header-center">
              <div class="header-title-row">
                <h2>{{ t.name }}</h2>
                <span class="type-badge type-{{ t.type }}">{{ t.type }}</span>
                <span class="status-badge status-{{ t.status }}">{{ t.status }}</span>
              </div>
            </div>
            <div class="header-stats">
              <div class="stat-pill">
                <span class="stat-num">{{ t.participants.length }}</span>
                <span class="stat-lbl">Players</span>
              </div>
              @if (t.status !== 'draft') {
                <div class="stat-pill stat-pill-green">
                  <span class="stat-num">{{ completedMatchCount }}</span>
                  <span class="stat-lbl">Done</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-num">{{ t.matches.length }}</span>
                  <span class="stat-lbl">Matches</span>
                </div>
              }
            </div>
          </div>

          <!-- Action bar -->
          @if (t.status === 'draft' || (t.status === 'active' && canComplete()) || true) {
            <div class="action-bar">
              @if (actionError()) {
                <div class="action-error"><i class="fas fa-exclamation-circle"></i> {{ actionError() }}</div>
              }
              <div class="action-bar-right">
                @if (t.status === 'draft') {
                  <div class="bracket-hint">
                    <i class="fas fa-info-circle"></i>
                    Add at least 2 {{ t.type === 'singles' ? 'players' : 'teams' }}, then use Auto Matches to create the bracket.
                  </div>
                }
                @if (t.status === 'active' && canComplete()) {
                  <button class="btn-action btn-complete" (click)="completeTournament()">
                    <i class="fas fa-flag-checkered"></i> Complete Tournament
                  </button>
                }
                <button class="btn-action btn-danger" (click)="confirmDelete()">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          }

          <!-- Tab Bar -->
          <div class="tab-bar">
            <button class="tab-btn" [class.active]="activeTab() === 'participants'" (click)="activeTab.set('participants')">
              <i class="fas fa-{{ t.type === 'singles' ? 'user' : 'user-friends' }}"></i>
              {{ t.type === 'singles' ? 'Players' : 'Teams' }}
              <span class="tab-badge">{{ entryCount }}</span>
            </button>
            <button class="tab-btn" [class.active]="activeTab() === 'matches'" (click)="activeTab.set('matches')">
              <i class="fas fa-sitemap"></i> Matches
            </button>
            @if (t.status !== 'draft' || t.matches.length > 0) {
              <button class="tab-btn" [class.active]="activeTab() === 'schedule'" (click)="activeTab.set('schedule')">
                <i class="fas fa-calendar-alt"></i> Schedule
              </button>
            }
            <button class="tab-btn" [class.active]="activeTab() === 'info'" (click)="activeTab.set('info')">
              <i class="fas fa-info-circle"></i> Info
            </button>
            @if (t.status !== 'draft' || t.matches.length > 0) {
              <button class="tab-btn" [class.active]="activeTab() === 'rankings'" (click)="activeTab.set('rankings')">
                <i class="fas fa-medal"></i> Rankings
              </button>
            }
          </div>

          <div class="card-body">

            <!-- ── PARTICIPANTS TAB ─────────────────────────────────── -->
            @if (activeTab() === 'participants') {
              @if (t.type === 'singles') {
                <div class="two-col">
                  <!-- Enrolled -->
                  <div class="panel">
                    <div class="panel-header">
                      <span class="panel-title"><i class="fas fa-users"></i> Enrolled Players</span>
                      <span class="panel-count">{{ t.participants.length }}</span>
                      @if (t.participants.length >= 2) {
                        <button class="btn-random-matches" [disabled]="generatingRandom()" (click)="generateRandomMatches()">
                          @if (generatingRandom()) { <i class="fas fa-circle-notch fa-spin"></i> }
                          @else { <i class="fas fa-random"></i> }
                          Auto Matches
                        </button>
                      }
                    </div>
                    @if (t.participants.length === 0) {
                      <div class="panel-empty">
                        <i class="fas fa-user-plus"></i>
                        <p>No players added yet.</p>
                      </div>
                    } @else {
                      <div class="player-list">
                        @for (p of t.participants; track p._id) {
                          <div class="player-row">
                            <div class="player-avatar">
                              @if (p.profileImage) {
                                <img [src]="p.profileImage" [alt]="p.name" />
                              } @else {
                                {{ initials(p.name) }}
                              }
                            </div>
                            <span class="player-name">{{ p.name }}</span>
                            <button class="btn-remove" (click)="removeParticipant(p._id)" title="Remove">
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Add Players -->
                  <div class="panel">
                    <div class="panel-header">
                      <span class="panel-title"><i class="fas fa-search"></i> Add Players</span>
                    </div>
                    <div class="search-bar">
                      <i class="fas fa-search search-icon"></i>
                      <input type="text" placeholder="Search members..." [(ngModel)]="playerSearch" (input)="filterUsers()" />
                    </div>
                    <div class="user-search-list">
                      @for (u of filteredUsers(); track u._id) {
                        <div class="user-row" [class.enrolled]="isEnrolled(u._id)" (click)="!isEnrolled(u._id) && addParticipant(u._id)">
                          <div class="player-avatar sm">
                            @if (u.profileImage) {
                              <img [src]="u.profileImage" [alt]="u.name" />
                            } @else {
                              {{ initials(u.name) }}
                            }
                          </div>
                          <span class="user-name">{{ u.name }}</span>
                          @if (isEnrolled(u._id)) {
                            <span class="enrolled-tag"><i class="fas fa-check"></i> Added</span>
                          } @else {
                            <span class="add-tag"><i class="fas fa-plus"></i> Add</span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              } @else {
                <!-- Doubles Teams -->
                <div class="two-col">
                  <div class="panel">
                    <div class="panel-header">
                      <span class="panel-title"><i class="fas fa-user-friends"></i> Teams</span>
                      <span class="panel-count">{{ t.teams?.length || 0 }}</span>
                      @if ((t.teams?.length || 0) >= 2) {
                        <button class="btn-random-matches" [disabled]="generatingRandom()" (click)="generateRandomMatches()">
                          @if (generatingRandom()) { <i class="fas fa-circle-notch fa-spin"></i> }
                          @else { <i class="fas fa-random"></i> }
                          Auto Matches
                        </button>
                      }
                    </div>
                    @if (!t.teams || t.teams.length === 0) {
                      <div class="panel-empty">
                        <i class="fas fa-user-friends"></i>
                        <p>No teams added yet.</p>
                      </div>
                    } @else {
                      <div class="player-list">
                        @for (team of teamsWithNames; track $index) {
                          <div class="team-row">
                            <div class="team-num">{{ $index + 1 }}</div>
                            <div class="team-names">
                              <span>{{ team[0]?.name || '—' }}</span>
                              <span class="team-amp">&amp;</span>
                              <span>{{ team[1]?.name || '—' }}</span>
                            </div>
                            <button class="btn-remove" (click)="removeTeam($index)" title="Remove team">
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <div class="panel">
                    <div class="panel-header">
                      <span class="panel-title"><i class="fas fa-plus"></i> Add Team</span>
                    </div>
                    <div class="form-field">
                      <label>Player 1</label>
                      <select [(ngModel)]="doublesP1">
                        <option value="">Select player 1…</option>
                        @for (u of teamPickerUsers; track u._id) {
                          <option [value]="u._id">{{ u.name }}</option>
                        }
                      </select>
                    </div>
                    <div class="form-field">
                      <label>Player 2</label>
                      <select [(ngModel)]="doublesP2">
                        <option value="">Select player 2…</option>
                        @for (u of teamPickerUsers; track u._id) {
                          @if (u._id !== doublesP1) {
                            <option [value]="u._id">{{ u.name }}</option>
                          }
                        }
                      </select>
                    </div>
                    <button class="btn-add-team" [disabled]="!doublesP1 || !doublesP2 || addingTeam()" (click)="addTeam()">
                      @if (addingTeam()) {
                        <i class="fas fa-circle-notch fa-spin"></i> Adding...
                      } @else {
                        <i class="fas fa-plus"></i> Add Team
                      }
                    </button>
                  </div>
                </div>
              }

              @if (entryCount >= 2 && t.status === 'draft') {
                <div class="bracket-preview-bar">
                  <i class="fas fa-sitemap"></i>
                  <strong>{{ entryCount }}</strong> {{ t.type === 'singles' ? 'players' : 'teams' }} →
                  <strong>{{ totalRoundsPreview }}</strong> rounds ·
                  <strong>{{ bracketSizePreview }}</strong>-player bracket ·
                  <strong>{{ bracketSizePreview - entryCount }}</strong> bye{{ bracketSizePreview - entryCount !== 1 ? 's' : '' }}
                </div>
              }
            }

            <!-- ── BRACKET TAB ──────────────────────────────────────── -->
            @if (activeTab() === 'matches') {
              @if (t.status === 'completed') {
                <div class="champion-banner">
                  <div class="champion-trophy">🏆</div>
                  <div>
                    <div class="champion-label">Tournament Champion</div>
                    <div class="champion-name">{{ getPlacement('champion') }}</div>
                  </div>
                  <div class="runner-up-block">
                    <div class="runner-label">Runner-up</div>
                    <div class="runner-name">{{ getPlacement('runnerUp') }}</div>
                  </div>
                </div>
              }
              @if (t.status === 'active') {
                @if (swapping()) {
                  <div class="swap-loading">
                    <i class="fas fa-circle-notch fa-spin"></i> Swapping teams…
                  </div>
                } @else {
                  <div class="drag-hint"><i class="fas fa-arrows-alt"></i> Drag a team to swap it with another</div>
                }
              }
              <div class="match-rows">
                @for (match of sortedMatches; track match._id) {
                  <div class="match-row"
                    [class.row-completed]="match.status === 'completed'"
                    [class.row-ongoing]="match.status === 'ongoing'">

                    @if (t.status === 'active' && editingMatchRoundId() === match._id) {
                      <input class="round-name-input"
                        [(ngModel)]="editRoundNameValue"
                        (keydown.enter)="saveRoundName()"
                        (keydown.escape)="cancelRoundName()"
                        (blur)="saveRoundName()"
                        [disabled]="savingRoundName()"
                        autofocus />
                    } @else {
                      <span class="row-round-chip"
                        [class.chip-editable]="t.status === 'active'"
                        (click)="t.status === 'active' && startEditRoundName(match._id, match.roundName)"
                        [title]="t.status === 'active' ? 'Click to rename' : ''">
                        {{ match.roundName }}
                        @if (t.status === 'active') { <i class="fas fa-pen chip-edit-icon"></i> }
                      </span>
                    }

                    <div class="row-players">
                      <!-- Slot 1 -->
                      <span class="row-player"
                        [class.row-winner]="match.winner === 1"
                        [class.row-loser]="match.winner === 2"
                        [class.slot-draggable]="canDrag(match)"
                        [class.slot-dragging]="isSlotDragging(match._id, 1)"
                        [class.slot-drag-over]="isSlotDragOver(match._id, 1)"
                        [draggable]="canDrag(match) && !swapping()"
                        (dragstart)="onSlotDragStart($event, match, 1)"
                        (dragover)="onSlotDragOver($event, match, 1)"
                        (dragleave)="onSlotDragLeave()"
                        (drop)="onSlotDrop($event, match, 1)"
                        (dragend)="onDragEnd()">
                        {{ slotLabel(match.slot1Players) }}
                        @if (match.winner === 1) { <span class="row-win-flag">W</span> }
                      </span>

                      <span class="row-vs">
                        @if (match.score) { {{ match.score }} } @else { vs }
                      </span>

                      <!-- Slot 2 -->
                      <span class="row-player"
                        [class.row-winner]="match.winner === 2"
                        [class.row-loser]="match.winner === 1"
                        [class.slot-draggable]="canDrag(match)"
                        [class.slot-dragging]="isSlotDragging(match._id, 2)"
                        [class.slot-drag-over]="isSlotDragOver(match._id, 2)"
                        [draggable]="canDrag(match) && !swapping()"
                        (dragstart)="onSlotDragStart($event, match, 2)"
                        (dragover)="onSlotDragOver($event, match, 2)"
                        (dragleave)="onSlotDragLeave()"
                        (drop)="onSlotDrop($event, match, 2)"
                        (dragend)="onDragEnd()">
                        {{ slotLabel(match.slot2Players) }}
                        @if (match.winner === 2) { <span class="row-win-flag">W</span> }
                      </span>
                    </div>

                    <span class="status-chip chip-{{ match.status }}">{{ match.status }}</span>

                    @if (t.status === 'active') {
                      <div class="row-actions">
                        <button class="icon-btn icon-edit" (click)="openMatchEditor(match)" title="Edit match">
                          <i class="fas fa-pen"></i>
                        </button>
                        <button class="icon-btn icon-delete" (click)="deleteMatch(match._id)" title="Delete match">
                          <i class="fas fa-trash"></i>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
              @if (t.status === 'active' || t.status === 'draft') {
                <button class="btn-add-match" (click)="openAddMatch()">
                  <i class="fas fa-plus-circle"></i> Add Match
                </button>
              }
            }

            <!-- ── SCHEDULE TAB ─────────────────────────────────────── -->
            @if (activeTab() === 'schedule') {
              @if (sortedMatches.length === 0) {
                <div class="sched-empty">
                  <i class="fas fa-calendar-alt"></i>
                  <p>No matches scheduled yet.</p>
                </div>
              } @else {
                <div class="sched-list">
                  @for (match of sortedMatches; track match._id) {
                    <div class="sched-card" [class.sched-done]="match.status === 'completed'" [class.sched-live]="match.status === 'ongoing'">

                      <!-- Top row: label + status + edit -->
                      <div class="sched-top">
                        @if (t.status !== 'completed' && editingMatchRoundId() === match._id) {
                          <input class="round-name-input"
                            [(ngModel)]="editRoundNameValue"
                            (keydown.enter)="saveRoundName()"
                            (keydown.escape)="cancelRoundName()"
                            (blur)="saveRoundName()"
                            [disabled]="savingRoundName()" />
                        } @else {
                          <span class="sched-label"
                            [class.chip-editable]="t.status !== 'completed'"
                            (click)="t.status !== 'completed' && startEditRoundName(match._id, match.roundName)"
                            [title]="t.status !== 'completed' ? 'Click to rename' : ''">
                            {{ match.roundName }}
                            @if (t.status !== 'completed') { <i class="fas fa-pen chip-edit-icon"></i> }
                          </span>
                        }
                        <span class="status-chip chip-{{ match.status }}">{{ match.status }}</span>
                        @if (t.status !== 'completed') {
                          <div class="row-actions sched-edit">
                            <button class="icon-btn icon-edit" (click)="openMatchEditor(match)" title="Edit match">
                              <i class="fas fa-pen"></i>
                            </button>
                            <button class="icon-btn icon-delete" (click)="deleteMatch(match._id)" title="Delete match">
                              <i class="fas fa-trash"></i>
                            </button>
                          </div>
                        }
                      </div>

                      <!-- Players -->
                      <div class="sched-matchup">
                        <div class="sched-player" [class.sched-winner]="match.winner === 1" [class.sched-loser]="match.winner === 2">
                          <i class="fas fa-user-circle sched-avatar"></i>
                          <span>{{ slotLabel(match.slot1Players) }}</span>
                          @if (match.winner === 1) { <span class="sched-trophy">🏆</span> }
                        </div>
                        <div class="sched-vs">
                          @if (match.score) { <span class="sched-score">{{ match.score }}</span> }
                          @else { <span>vs</span> }
                        </div>
                        <div class="sched-player" [class.sched-winner]="match.winner === 2" [class.sched-loser]="match.winner === 1">
                          <i class="fas fa-user-circle sched-avatar"></i>
                          <span>{{ slotLabel(match.slot2Players) }}</span>
                          @if (match.winner === 2) { <span class="sched-trophy">🏆</span> }
                        </div>
                      </div>

                      <!-- Date / time -->
                      @if (schedEditId() === match._id) {
                        <div class="sched-inline-form">
                          <div class="sched-inline-row">
                            <div class="sched-inline-field">
                              <label><i class="fas fa-calendar-alt"></i> Date</label>
                              <input type="date" [(ngModel)]="schedDate" class="sched-date-input" />
                            </div>
                            <div class="sched-inline-field">
                              <label><i class="fas fa-clock"></i> Time</label>
                              <input type="text" [(ngModel)]="schedTime" placeholder="e.g. 9:00 AM" class="sched-time-input" />
                            </div>
                          </div>
                          <div class="sched-inline-actions">
                            <button class="sched-save-btn" (click)="saveSchedEdit(match._id)" [disabled]="savingSchedEdit()">
                              @if (savingSchedEdit()) { <i class="fas fa-circle-notch fa-spin"></i> } @else { <i class="fas fa-check"></i> }
                              Save
                            </button>
                            <button class="sched-cancel-btn" (click)="schedEditId.set(null)">Cancel</button>
                          </div>
                        </div>
                      } @else if (match.scheduledDate || match.timeSlot) {
                        <div class="sched-meta sched-meta-set">
                          <i class="fas fa-calendar-check"></i>
                          @if (match.scheduledDate) { {{ match.scheduledDate | date: 'MMM d, yyyy' : 'UTC' }} }
                          @if (match.timeSlot) { <span class="sched-time"><i class="fas fa-clock"></i> {{ match.timeSlot }}</span> }
                          @if (t.status !== 'completed') {
                            <button class="sched-edit-date-btn" (click)="openSchedEdit(match)" title="Change schedule">
                              <i class="fas fa-pen"></i>
                            </button>
                          }
                        </div>
                      } @else {
                        <div class="sched-meta sched-unscheduled">
                          <i class="fas fa-calendar-plus"></i> Not scheduled
                          @if (t.status !== 'completed') {
                            <button class="sched-set-btn" (click)="openSchedEdit(match)">
                              <i class="fas fa-plus"></i> Set Date &amp; Time
                            </button>
                          }
                        </div>
                      }

                    </div>
                  }
                </div>
              }
            }

            <!-- ── INFO TAB ────────────────────────────────────────── -->
            @if (activeTab() === 'info') {

              <!-- Visibility card -->
              <div class="info-visibility-card" [class.vis-published]="t.published" [class.vis-inactive]="!t.published">
                <div class="vis-left">
                  <div class="vis-icon">
                    <i class="fas fa-{{ t.published ? 'eye' : 'eye-slash' }}"></i>
                  </div>
                  <div>
                    <div class="vis-title">{{ t.published ? 'Published' : 'Inactive' }}</div>
                    <div class="vis-sub">
                      {{ t.published
                        ? 'Visible to all players in the Tournaments section.'
                        : 'Hidden from players. Publish to make it visible.' }}
                    </div>
                  </div>
                </div>
                <button class="btn-vis" [class.btn-unpublish]="t.published" (click)="togglePublished()" [disabled]="togglingPublish()">
                  @if (togglingPublish()) { <i class="fas fa-circle-notch fa-spin"></i> }
                  @else { <i class="fas fa-{{ t.published ? 'eye-slash' : 'rocket' }}"></i> }
                  {{ t.published ? 'Unpublish' : 'Publish Tournament' }}
                </button>
              </div>

              <!-- Stats row -->
              <div class="info-stats-row">
                <div class="info-stat-box">
                  <div class="info-stat-num">{{ t.participants.length }}</div>
                  <div class="info-stat-lbl"><i class="fas fa-users"></i> Players</div>
                </div>
                <div class="info-stat-box">
                  <div class="info-stat-num">{{ t.matches.length }}</div>
                  <div class="info-stat-lbl"><i class="fas fa-table-tennis"></i> Matches</div>
                </div>
                <div class="info-stat-box">
                  <div class="info-stat-num">{{ completedMatchCount }}</div>
                  <div class="info-stat-lbl"><i class="fas fa-check-circle"></i> Completed</div>
                </div>
              </div>

              <!-- Details grid -->
              <div class="info-details-grid">
                <div class="info-detail-row">
                  <span class="info-detail-lbl"><i class="fas fa-trophy"></i> Name</span>
                  <span class="info-detail-val">{{ t.name }}</span>
                </div>
                <div class="info-detail-row">
                  <span class="info-detail-lbl"><i class="fas fa-tag"></i> Type</span>
                  <span class="info-detail-val capitalize">{{ t.type }}</span>
                </div>
                <div class="info-detail-row">
                  <span class="info-detail-lbl"><i class="fas fa-circle-dot"></i> Status</span>
                  <span class="status-badge status-{{ t.status }}">{{ t.status }}</span>
                </div>
                <div class="info-detail-row">
                  <span class="info-detail-lbl"><i class="fas fa-calendar"></i> Created</span>
                  <span class="info-detail-val">{{ t.createdAt | date: 'MMMM d, yyyy' }}</span>
                </div>
              </div>

              @if (t.status === 'completed') {
                <div class="results-section">
                  <div class="results-title"><i class="fas fa-medal"></i> Final Results</div>
                  <div class="podium">
                    <div class="podium-card podium-gold">
                      <div class="podium-medal">🥇</div>
                      <div class="podium-role">Champion</div>
                      <div class="podium-name">{{ getPlacement('champion') }}</div>
                    </div>
                    <div class="podium-card podium-silver">
                      <div class="podium-medal">🥈</div>
                      <div class="podium-role">Runner-up</div>
                      <div class="podium-name">{{ getPlacement('runnerUp') }}</div>
                    </div>
                  </div>
                </div>
              }
            }

            <!-- ── RANKINGS TAB ───────────────────────────────────── -->
            @if (activeTab() === 'rankings') {
              @if (hasMatchesWithoutWinner) {
                <div class="no-winner-warn">
                  <i class="fas fa-exclamation-triangle"></i>
                  Some matches have no winner selected. Open each match and pick a winner for accurate placement and points.
                </div>
              }
              @if (tournamentRankings.length === 0) {
                <div class="rank-empty">
                  <div class="rank-empty-icon"><i class="fas fa-medal"></i></div>
                  <p class="rank-empty-title">No completed matches yet</p>
                  <p class="rank-empty-sub">Rankings will appear once matches have been scored.</p>
                </div>
              } @else {
                <table class="rank-table">
                  <thead>
                    <tr>
                      <th class="rc-rank">Rank</th>
                      <th class="rc-player">Player</th>
                      <th class="rc-played">Played</th>
                      <th class="rc-won">Won</th>
                      <th class="rc-lost">Lost</th>
                      <th class="rc-place">Placement</th>
                      <th class="rc-pts">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of tournamentRankings; track r.playerId; let i = $index) {
                      <tr>
                        <td class="rc-rank">
                          @if (i === 0) { <span class="medal">🥇</span> }
                          @else if (i === 1) { <span class="medal">🥈</span> }
                          @else if (i === 2) { <span class="medal">🥉</span> }
                          @else { <span class="rank-num">{{ i + 1 }}</span> }
                        </td>
                        <td class="rc-player">
                          <div class="player-cell">
                            @if (r.profileImage) {
                              <img class="player-av" [src]="r.profileImage" [alt]="r.name" />
                            } @else {
                              <div class="player-av av-init">{{ r.name.charAt(0).toUpperCase() }}</div>
                            }
                            <span class="player-nm">{{ r.name }}</span>
                          </div>
                        </td>
                        <td class="rc-played">{{ r.matchesPlayed }}</td>
                        <td class="rc-won"><span class="wins-val">{{ r.matchesWon }}</span></td>
                        <td class="rc-lost">{{ r.matchesLost }}</td>
                        <td class="rc-place">
                          <span class="place-badge" [class]="placementClass(r.placement)">
                            {{ r.placement }}
                          </span>
                        </td>
                        <td class="rc-pts">
                          <span class="pts-chip"><i class="fas fa-star"></i> {{ r.pointsEarned }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            }

          </div><!-- end card-body -->
        </div><!-- end page-card -->
      }
    </div><!-- end page-wrap -->

    <!-- ── MATCH EDITOR MODAL ──────────────────────────────────────── -->
    @if (editingMatch()) {
      <div class="modal-backdrop" (click)="closeMatchEditor()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="fas fa-pen"></i> Edit Match — {{ editingMatch()!.roundName }}</h3>
            <button class="modal-close" (click)="closeMatchEditor()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">

            <!-- Winner picker with per-team score -->
            <div class="modal-field">
              <label>Score &amp; Winner</label>
              <div class="winner-picker">
                <div class="winner-opt" [class.winner-selected]="editWinner === 1" (click)="editWinner = 1">
                  <div class="winner-names">
                    @for (p of editingMatch()!.slot1Players; track p._id) { <span>{{ p.name }}</span> }
                    @if (editingMatch()!.slot1Players.length === 0) { <span class="slot-tbd">TBD</span> }
                  </div>
                  <input
                    class="score-input"
                    type="text"
                    [(ngModel)]="editScore1"
                    placeholder="e.g. 6, 7"
                    (click)="$event.stopPropagation()"
                  />
                  @if (editWinner === 1) { <span class="winner-check"><i class="fas fa-trophy"></i> Winner</span> }
                </div>
                <div class="winner-vs">VS</div>
                <div class="winner-opt" [class.winner-selected]="editWinner === 2" (click)="editWinner = 2">
                  <div class="winner-names">
                    @for (p of editingMatch()!.slot2Players; track p._id) { <span>{{ p.name }}</span> }
                    @if (editingMatch()!.slot2Players.length === 0) { <span class="slot-tbd">TBD</span> }
                  </div>
                  <input
                    class="score-input"
                    type="text"
                    [(ngModel)]="editScore2"
                    placeholder="e.g. 4, 5"
                    (click)="$event.stopPropagation()"
                  />
                  @if (editWinner === 2) { <span class="winner-check"><i class="fas fa-trophy"></i> Winner</span> }
                </div>
              </div>
            </div>

            <div class="modal-row">
              <div class="modal-field">
                <label>Date</label>
                <input type="date" [(ngModel)]="editDate" />
              </div>
              <div class="modal-field">
                <label>Time Slot</label>
                <input type="text" [(ngModel)]="editTimeSlot" placeholder="e.g. 8:00 AM" />
              </div>
            </div>

            <div class="modal-field">
              <label>Status</label>
              <select [(ngModel)]="editStatus">
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            @if (matchError()) {
              <div class="modal-error"><i class="fas fa-exclamation-circle"></i> {{ matchError() }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeMatchEditor()" [disabled]="savingMatch()">Cancel</button>
            <button class="btn-confirm" (click)="saveMatch()" [disabled]="savingMatch()">
              @if (savingMatch()) { <i class="fas fa-circle-notch fa-spin"></i> Saving... }
              @else { <i class="fas fa-check"></i> Save Match }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── ADD MATCH MODAL ──────────────────────────────────────────── -->
    @if (showAddMatch()) {
      <div class="modal-backdrop" (click)="closeAddMatch()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="fas fa-plus-circle"></i> Add Match</h3>
            <button class="modal-close" (click)="closeAddMatch()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="modal-field">
              <label>Match Label</label>
              <input type="text" [(ngModel)]="newMatchLabel" placeholder="e.g. Game 1, Wild Card Match…" />
            </div>
            <div class="modal-row">
              <div class="modal-field">
                <label>{{ tournament()!.type === 'singles' ? 'Player 1' : 'Team 1' }}</label>
                <select [(ngModel)]="newMatchSlot1">
                  <option value="">— Select —</option>
                  @if (tournament()!.type === 'singles') {
                    @for (p of tournament()!.participants; track p._id) {
                      <option [value]="p._id">{{ p.name }}</option>
                    }
                  } @else {
                    @for (team of teamsWithNames; track $index) {
                      <option [value]="$index">{{ team[0]?.name }} &amp; {{ team[1]?.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="modal-field">
                <label>{{ tournament()!.type === 'singles' ? 'Player 2' : 'Team 2' }}</label>
                <select [(ngModel)]="newMatchSlot2">
                  <option value="">— Select —</option>
                  @if (tournament()!.type === 'singles') {
                    @for (p of tournament()!.participants; track p._id) {
                      @if (p._id !== newMatchSlot1) {
                        <option [value]="p._id">{{ p.name }}</option>
                      }
                    }
                  } @else {
                    @for (team of teamsWithNames; track $index) {
                      @if ('' + $index !== newMatchSlot1) {
                        <option [value]="$index">{{ team[0]?.name }} &amp; {{ team[1]?.name }}</option>
                      }
                    }
                  }
                </select>
              </div>
            </div>
            <div class="modal-row">
              <div class="modal-field">
                <label>Date <span class="field-hint">(optional)</span></label>
                <input type="date" [(ngModel)]="newMatchDate" />
              </div>
              <div class="modal-field">
                <label>Time <span class="field-hint">(optional)</span></label>
                <input type="text" [(ngModel)]="newMatchTime" placeholder="e.g. 9:00 AM" />
              </div>
            </div>
            @if (addMatchError()) {
              <div class="modal-error"><i class="fas fa-exclamation-circle"></i> {{ addMatchError() }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeAddMatch()" [disabled]="addingMatch()">Cancel</button>
            <button class="btn-confirm" (click)="saveAddMatch()" [disabled]="!newMatchLabel.trim() || addingMatch()">
              @if (addingMatch()) { <i class="fas fa-circle-notch fa-spin"></i> Adding... }
              @else { <i class="fas fa-plus"></i> Add Match }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── DELETE CONFIRM MODAL ─────────────────────────────────────── -->
    @if (confirmPrompt()) {
      <div class="modal-backdrop" (click)="cancelPrompt()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header delete-header">
            <div class="delete-icon-wrap"><i class="fas fa-{{ confirmPrompt()!.icon }}"></i></div>
            <div>
              <h3>{{ confirmPrompt()!.title }}</h3>
              <p class="delete-sub">{{ confirmPrompt()!.subtitle }}</p>
            </div>
            <button class="modal-close" (click)="cancelPrompt()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="cancelPrompt()">Cancel</button>
            <button [class]="confirmPrompt()!.confirmClass" (click)="executePrompt()">
              <i class="fas fa-{{ confirmPrompt()!.icon }}"></i> {{ confirmPrompt()!.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Design tokens ───────────────────────────────────────────── */
    :host {
      --dm-bg: #0c1a11;
      --dm-surface: #1b3028;
      --dm-header: #16251d;
      --dm-accent: #a3e635;
    }

    /* ── Layout ──────────────────────────────────────────────────── */
    .page-wrap {
      position: relative; min-height: 100vh; padding: 20px;
      background: var(--dm-bg);
    }
    .court-bg {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--dm-bg); z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.18); }
    .page-card {
      position: relative; z-index: 1;
      background: var(--dm-surface);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.32);
      border: 1px solid rgba(163,230,53,0.12);
      max-width: 1000px; margin: 0 auto; overflow: hidden;
    }
    .loading-card {
      padding: 40px; text-align: center; color: rgba(255,255,255,0.62); font-size: 0.9rem;
    }

    /* ── Header ──────────────────────────────────────────────────── */
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--dm-header);
      flex-wrap: wrap;
    }
    .back-btn {
      background: none; border: none; font-size: 15px;
      cursor: pointer; padding: 8px 12px; border-radius: 4px;
      color: rgba(255,255,255,0.7); white-space: nowrap;
      transition: background 0.15s;
    }
    .back-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .header-center { flex: 1; min-width: 0; }
    .header-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .header-title-row h2 { margin: 0; font-size: 20px; color: #ffffff; }
    .type-badge, .status-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .type-singles { background: rgba(163,230,53,0.15); color: var(--dm-accent); }
    .type-doubles { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .status-draft   { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }
    .status-active  { background: rgba(163,230,53,0.15); color: var(--dm-accent); }
    .status-completed { background: rgba(139,92,246,0.18); color: #a78bfa; }

    .header-stats { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 14px; background: rgba(255,255,255,0.06); border-radius: 20px; min-width: 52px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .stat-pill-green { background: rgba(163,230,53,0.12); border-color: rgba(163,230,53,0.2); }
    .stat-num { font-size: 1rem; font-weight: 700; color: #ffffff; line-height: 1.2; }
    .stat-pill-green .stat-num { color: var(--dm-accent); }
    .stat-lbl { font-size: 0.65rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.4px; }

    /* ── Action bar ──────────────────────────────────────────────── */
    .action-bar {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      padding: 12px 24px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .action-error {
      font-size: 0.82rem; color: #f87171; display: flex; align-items: center; gap: 6px;
    }
    .action-bar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: auto; }
    .bracket-hint {
      font-size: 0.78rem; color: rgba(255,255,255,0.6);
      background: rgba(163,230,53,0.06); border: 1px solid rgba(163,230,53,0.18);
      border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; gap: 6px;
    }
    .btn-action {
      padding: 8px 16px; border: none; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-action:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-generate {
      background: rgba(163,230,53,0.18); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28);
    }
    .btn-generate:hover:not(:disabled) { background: rgba(163,230,53,0.28); }
    .btn-complete { background: rgba(139,92,246,0.2); color: #a78bfa; border: 1px solid rgba(139,92,246,0.3); }
    .btn-complete:hover { background: rgba(139,92,246,0.3); }
    .btn-danger { background: rgba(220,38,38,0.12); color: #f87171; border: 1px solid rgba(220,38,38,0.25); }
    .btn-danger:hover { background: rgba(220,38,38,0.22); }

    /* ── Tab bar ─────────────────────────────────────────────────── */
    .tab-bar {
      display: flex; border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 0 24px; overflow-x: auto; gap: 2px;
      background: var(--dm-header);
    }
    .tab-btn {
      background: none; border: none; padding: 14px 16px;
      font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.5); cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -1px;
      transition: all 0.15s; white-space: nowrap; display: flex; align-items: center; gap: 7px;
    }
    .tab-btn:hover { color: var(--dm-accent); }
    .tab-btn.active { color: var(--dm-accent); border-bottom-color: var(--dm-accent); }
    .tab-badge {
      background: rgba(163,230,53,0.15); color: var(--dm-accent); font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }

    /* ── Card body ───────────────────────────────────────────────── */
    .card-body { padding: 24px; }

    /* ── Two-col layout ──────────────────────────────────────────── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 680px) { .two-col { grid-template-columns: 1fr; } }

    .panel {
      border: 1px solid rgba(163,230,53,0.12); border-radius: 10px; overflow: hidden;
      background: rgba(255,255,255,0.02);
    }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .panel-title { font-size: 0.82rem; font-weight: 700; color: rgba(255,255,255,0.8); display: flex; align-items: center; gap: 7px; }
    .panel-count {
      background: var(--dm-accent); color: #0c1a11; font-size: 0.7rem; font-weight: 700;
      padding: 2px 8px; border-radius: 10px;
    }
    .btn-random-matches {
      margin-left: auto; padding: 4px 10px;
      background: rgba(163,230,53,0.12); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.25); border-radius: 6px; font-size: 0.72rem; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s;
    }
    .btn-random-matches:hover:not(:disabled) { background: rgba(163,230,53,0.22); }
    .btn-random-matches:disabled { opacity: 0.5; cursor: not-allowed; }
    .panel-empty { padding: 32px 16px; text-align: center; color: rgba(255,255,255,0.35); }
    .panel-empty i { font-size: 1.8rem; display: block; margin-bottom: 8px; }
    .panel-empty p { margin: 0; font-size: 0.82rem; }

    .player-list { display: flex; flex-direction: column; max-height: 360px; overflow-y: auto; }
    .player-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
      transition: background 0.12s;
    }
    .player-row:last-child { border-bottom: none; }
    .player-row:hover { background: rgba(255,255,255,0.04); }

    .team-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .team-row:last-child { border-bottom: none; }
    .team-num { width: 22px; font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.35); flex-shrink: 0; }
    .team-names { flex: 1; font-size: 0.875rem; font-weight: 600; color: #ffffff; display: flex; align-items: center; gap: 6px; }
    .team-amp { color: rgba(255,255,255,0.4); font-weight: 400; }

    .player-avatar {
      width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      background: linear-gradient(135deg, rgba(163,230,53,0.4), rgba(163,230,53,0.2));
      color: var(--dm-accent); font-size: 0.7rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .player-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .player-avatar.sm { width: 26px; height: 26px; font-size: 0.62rem; }
    .player-name { flex: 1; font-size: 0.875rem; font-weight: 600; color: #ffffff; }
    .btn-remove {
      background: none; border: none; color: rgba(255,255,255,0.2); cursor: pointer;
      padding: 4px 6px; border-radius: 4px; font-size: 0.8rem;
    }
    .btn-remove:hover { color: #f87171; background: rgba(220,38,38,0.12); }

    .search-bar {
      position: relative; padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .search-icon { position: absolute; left: 24px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.3); font-size: 0.8rem; }
    .search-bar input {
      width: 100%; padding: 7px 10px 7px 28px;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
      font-size: 0.875rem; box-sizing: border-box;
      background: rgba(255,255,255,0.05); color: #ffffff;
    }
    .search-bar input::placeholder { color: rgba(255,255,255,0.3); }
    .search-bar input:focus { outline: none; border-color: rgba(163,230,53,0.4); }

    .user-search-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; }
    .user-row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer;
      transition: background 0.12s;
    }
    .user-row:last-child { border-bottom: none; }
    .user-row:hover:not(.enrolled) { background: rgba(163,230,53,0.06); }
    .user-row.enrolled { opacity: 0.45; cursor: default; }
    .user-name { flex: 1; font-size: 0.875rem; color: rgba(255,255,255,0.8); }
    .enrolled-tag { font-size: 0.75rem; font-weight: 700; color: var(--dm-accent); display: flex; align-items: center; gap: 4px; }
    .add-tag { font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.35); display: flex; align-items: center; gap: 4px; }
    .user-row:hover:not(.enrolled) .add-tag { color: var(--dm-accent); }

    .form-field { padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; }
    .form-field label { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.4px; }
    .form-field select {
      padding: 7px 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
      font-size: 0.875rem; background: #1b3028; color: #ffffff; width: 100%;
    }
    .form-field select:focus { outline: none; border-color: rgba(163,230,53,0.4); }
    .form-field select option { background: #1b3028; color: #ffffff; }
    .btn-add-team {
      margin: 10px 14px 14px; padding: 9px;
      background: rgba(163,230,53,0.18); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28); border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: background 0.15s;
    }
    .btn-add-team:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-add-team:hover:not(:disabled) { background: rgba(163,230,53,0.28); }

    .bracket-preview-bar {
      margin-top: 20px; padding: 12px 16px;
      background: rgba(163,230,53,0.06); border: 1px solid rgba(163,230,53,0.18); border-radius: 8px;
      font-size: 0.875rem; color: rgba(255,255,255,0.7); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .bracket-preview-bar i { color: var(--dm-accent); }
    .bracket-preview-bar strong { color: var(--dm-accent); }

    /* ── Bracket (match rows) ────────────────────────────────────── */
    .champion-banner {
      display: flex; align-items: center; gap: 16px; padding: 16px 20px;
      background: rgba(163,230,53,0.06);
      border: 1px solid rgba(163,230,53,0.2); border-radius: 10px; margin-bottom: 20px;
    }
    .champion-trophy { font-size: 2.2rem; }
    .champion-label { font-size: 0.7rem; font-weight: 700; color: var(--dm-accent); text-transform: uppercase; letter-spacing: 0.5px; }
    .champion-name { font-size: 1.1rem; font-weight: 800; color: #ffffff; margin-top: 2px; }
    .runner-up-block { margin-left: auto; text-align: right; }
    .runner-label { font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }
    .runner-name { font-size: 0.95rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-top: 2px; }

    .drag-hint {
      font-size: 0.78rem; color: rgba(255,255,255,0.4); margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    }
    .swap-loading {
      font-size: 0.82rem; color: var(--dm-accent); font-weight: 600; margin-bottom: 12px;
      display: flex; align-items: center; gap: 8px;
      background: rgba(163,230,53,0.08); border: 1px solid rgba(163,230,53,0.2);
      padding: 8px 12px; border-radius: 8px;
    }
    .match-rows { display: flex; flex-direction: column; }
    .match-row {
      display: flex; align-items: center; gap: 14px; padding: 13px 4px;
      border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.12s;
    }
    .match-row:last-child { border-bottom: none; }
    .match-row:hover { background: rgba(255,255,255,0.02); }
    .match-row.row-completed { opacity: 0.85; }

    .slot-draggable { cursor: grab; }
    .slot-draggable:active { cursor: grabbing; }
    .slot-dragging { opacity: 0.35 !important; }
    .slot-drag-over {
      background: rgba(163,230,53,0.1); border-radius: 6px;
      outline: 2px dashed var(--dm-accent); outline-offset: 2px;
      color: var(--dm-accent) !important; font-weight: 700;
    }

    .row-round-chip {
      background: rgba(163,230,53,0.12); color: var(--dm-accent); padding: 3px 9px;
      border-radius: 12px; font-size: 0.72rem; font-weight: 700;
      white-space: nowrap; flex-shrink: 0; border: 1px solid rgba(163,230,53,0.2);
    }
    .row-players {
      flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap;
    }
    .row-player {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.875rem; color: rgba(255,255,255,0.75);
    }
    .row-player.row-winner { font-weight: 700; color: #ffffff; }
    .row-player.row-loser  { opacity: 0.4; }
    .row-win-flag {
      background: var(--dm-accent); color: #0c1a11; font-size: 0.62rem; font-weight: 800;
      padding: 1px 5px; border-radius: 4px;
    }
    .row-vs { font-size: 0.78rem; color: rgba(255,255,255,0.25); font-weight: 600; flex-shrink: 0; }

    .btn-add-match {
      display: flex; align-items: center; gap: 7px; margin-top: 14px;
      padding: 8px 16px; background: none;
      border: 1.5px dashed rgba(163,230,53,0.25);
      border-radius: 8px; font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.4);
      cursor: pointer; transition: all 0.15s; width: 100%; justify-content: center;
    }
    .btn-add-match:hover { border-color: var(--dm-accent); color: var(--dm-accent); background: rgba(163,230,53,0.06); }
    .btn-add-match i { font-size: 0.9rem; }

    /* ── Schedule cards ──────────────────────────────────────────── */
    .sched-empty { text-align: center; color: rgba(255,255,255,0.35); padding: 40px 20px; }
    .sched-empty i { font-size: 2rem; display: block; margin-bottom: 8px; }
    .sched-empty p { margin: 0; font-size: 0.875rem; }
    .sched-list { display: flex; flex-direction: column; gap: 10px; }
    .sched-card {
      border: 1px solid rgba(163,230,53,0.12); border-radius: 10px; overflow: hidden;
      background: rgba(255,255,255,0.02); transition: box-shadow 0.15s;
    }
    .sched-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.3); border-color: rgba(163,230,53,0.22); }
    .sched-done { opacity: 0.75; }
    .sched-live { border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.04); }
    .sched-top {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 14px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .sched-label {
      font-size: 0.78rem; font-weight: 700; color: var(--dm-accent);
      background: rgba(163,230,53,0.12); padding: 3px 10px; border-radius: 12px;
      border: 1px solid rgba(163,230,53,0.2);
    }
    .sched-edit { margin-left: auto; }
    .sched-matchup {
      display: flex; align-items: center; gap: 0; padding: 14px 16px;
    }
    .sched-player {
      flex: 1; display: flex; align-items: center; gap: 8px;
      font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.8); min-width: 0;
    }
    .sched-player:last-child { justify-content: flex-end; text-align: right; }
    .sched-avatar { font-size: 1.3rem; color: rgba(255,255,255,0.2); flex-shrink: 0; }
    .sched-winner { color: var(--dm-accent); font-weight: 700; }
    .sched-winner .sched-avatar { color: var(--dm-accent); }
    .sched-loser { opacity: 0.35; }
    .sched-trophy { font-size: 1rem; flex-shrink: 0; }
    .sched-vs {
      flex-shrink: 0; width: 60px; text-align: center;
      font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.3);
    }
    .sched-score {
      font-size: 0.85rem; font-weight: 800; color: #ffffff;
      background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 6px;
    }
    .sched-meta {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; font-size: 0.78rem; color: rgba(255,255,255,0.45);
      border-top: 1px solid rgba(255,255,255,0.05);
      background: rgba(255,255,255,0.01);
    }
    .sched-meta i { color: rgba(255,255,255,0.25); }
    .sched-time { display: flex; align-items: center; gap: 4px; }
    .sched-unscheduled { color: rgba(255,255,255,0.2); font-style: italic; }
    .sched-meta-set { color: rgba(255,255,255,0.65); }
    .sched-meta-set i { color: var(--dm-accent); }
    .sched-edit-date-btn {
      margin-left: 4px; padding: 2px 7px; border: 1px solid rgba(163,230,53,0.25); border-radius: 6px;
      background: rgba(163,230,53,0.07); color: var(--dm-accent); font-size: 0.72rem; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; transition: all 0.12s;
    }
    .sched-edit-date-btn:hover { background: rgba(163,230,53,0.18); border-color: var(--dm-accent); }
    .sched-set-btn {
      margin-left: 8px; padding: 3px 10px; border: 1px solid rgba(163,230,53,0.25); border-radius: 6px;
      background: rgba(163,230,53,0.07); color: var(--dm-accent); font-size: 0.75rem; cursor: pointer;
      display: inline-flex; align-items: center; gap: 5px; transition: all 0.12s;
    }
    .sched-set-btn:hover { background: rgba(163,230,53,0.18); border-color: var(--dm-accent); }
    .sched-inline-form {
      padding: 12px 16px; border-top: 1px solid rgba(163,230,53,0.12);
      background: rgba(163,230,53,0.04);
    }
    .sched-inline-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .sched-inline-field { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 140px; }
    .sched-inline-field label { font-size: 0.72rem; color: rgba(255,255,255,0.45); display: flex; align-items: center; gap: 5px; }
    .sched-inline-field label i { color: var(--dm-accent); }
    .sched-date-input, .sched-time-input {
      padding: 6px 10px; border: 1.5px solid rgba(163,230,53,0.25); border-radius: 8px;
      background: rgba(255,255,255,0.05); color: #fff; font-size: 0.82rem; outline: none;
      color-scheme: dark;
    }
    .sched-date-input:focus, .sched-time-input:focus { border-color: var(--dm-accent); background: rgba(163,230,53,0.07); }
    .sched-inline-actions { display: flex; gap: 8px; margin-top: 10px; }
    .sched-save-btn {
      padding: 6px 16px; border: none; border-radius: 8px; background: var(--dm-accent);
      color: #111; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;
      transition: opacity 0.15s;
    }
    .sched-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sched-cancel-btn {
      padding: 6px 14px; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
      background: transparent; color: rgba(255,255,255,0.55); font-size: 0.82rem; cursor: pointer;
      transition: all 0.12s;
    }
    .sched-cancel-btn:hover { border-color: rgba(255,255,255,0.35); color: #fff; }
    .status-chip {
      padding: 3px 9px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize; white-space: nowrap;
    }
    .chip-upcoming  { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.55); }
    .chip-ongoing   { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .chip-completed { background: rgba(163,230,53,0.12); color: var(--dm-accent); }
    .btn-edit-row {
      padding: 5px 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
      background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6); font-size: 0.78rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.12s;
    }
    .btn-edit-row:hover { border-color: var(--dm-accent); color: var(--dm-accent); background: rgba(163,230,53,0.06); }
    .row-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .icon-btn {
      width: 30px; height: 30px; border-radius: 6px; border: none;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; cursor: pointer; transition: all 0.15s;
    }
    .icon-edit { background: rgba(163,230,53,0.10); color: var(--dm-accent); }
    .icon-edit:hover { background: rgba(163,230,53,0.22); }
    .icon-delete { background: rgba(220,38,38,0.1); color: #f87171; }
    .icon-delete:hover { background: #dc2626; color: white; }
    .chip-editable { cursor: pointer; transition: background 0.12s; }
    .chip-editable:hover { background: rgba(163,230,53,0.22); }
    .chip-edit-icon { font-size: 0.6rem; opacity: 0.5; margin-left: 3px; }
    .round-name-input {
      padding: 2px 8px; border: 1.5px solid rgba(163,230,53,0.4); border-radius: 12px;
      font-size: 0.72rem; font-weight: 700; color: var(--dm-accent);
      background: rgba(163,230,53,0.08);
      width: 110px; outline: none; box-shadow: 0 0 0 2px rgba(163,230,53,0.1);
    }

    /* ── Info tab ────────────────────────────────────────────────── */
    .capitalize { text-transform: capitalize; }
    .info-visibility-card {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
      padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; border: 1.5px solid;
    }
    .vis-published { background: rgba(163,230,53,0.06); border-color: rgba(163,230,53,0.25); }
    .vis-inactive  { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.1); }
    .vis-left { display: flex; align-items: center; gap: 14px; }
    .vis-icon {
      width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;
    }
    .vis-published .vis-icon { background: rgba(163,230,53,0.15); color: var(--dm-accent); }
    .vis-inactive  .vis-icon { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }
    .vis-title { font-size: 0.95rem; font-weight: 700; color: #ffffff; }
    .vis-sub { font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-top: 2px; max-width: 340px; }
    .btn-vis {
      padding: 9px 18px; border: none; border-radius: 8px; font-size: 0.82rem; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.15s; flex-shrink: 0;
      background: rgba(163,230,53,0.18); color: var(--dm-accent); border: 1px solid rgba(163,230,53,0.28);
    }
    .btn-vis:hover:not(:disabled) { background: rgba(163,230,53,0.28); }
    .btn-vis:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-unpublish {
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .btn-unpublish:hover:not(:disabled) { background: rgba(220,38,38,0.12); color: #f87171; border-color: rgba(220,38,38,0.25); }

    .info-stats-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;
    }
    .info-stat-box {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(163,230,53,0.12); border-radius: 10px;
      padding: 16px; text-align: center;
    }
    .info-stat-num { font-size: 1.6rem; font-weight: 800; color: var(--dm-accent); line-height: 1; }
    .info-stat-lbl { font-size: 0.72rem; font-weight: 600; color: rgba(255,255,255,0.45); margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 5px; text-transform: uppercase; letter-spacing: 0.4px; }

    .info-details-grid {
      border: 1px solid rgba(163,230,53,0.12); border-radius: 10px; overflow: hidden; margin-bottom: 20px;
    }
    .info-detail-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.875rem;
    }
    .info-detail-row:last-child { border-bottom: none; }
    .info-detail-lbl { color: rgba(255,255,255,0.5); font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .info-detail-lbl i { color: rgba(255,255,255,0.3); width: 14px; text-align: center; }
    .info-detail-val { font-weight: 700; color: #ffffff; }

    .results-section { border: 1px solid rgba(163,230,53,0.12); border-radius: 10px; overflow: hidden; }
    .results-title {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 0.82rem; font-weight: 700; color: rgba(255,255,255,0.8);
    }
    .podium { display: flex; gap: 12px; padding: 16px; }
    .podium-card {
      flex: 1; padding: 16px; border-radius: 10px; text-align: center; display: flex; flex-direction: column; gap: 4px;
    }
    .podium-gold   { background: rgba(163,230,53,0.08); border: 1px solid rgba(163,230,53,0.25); }
    .podium-silver { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
    .podium-medal { font-size: 1.8rem; }
    .podium-role { font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }
    .podium-name { font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-top: 2px; }

    /* ── Modal ───────────────────────────────────────────────────── */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 100;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--dm-surface); border-radius: 14px; width: 100%; max-width: 500px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 1px solid rgba(163,230,53,0.18);
      animation: slideUp 0.2s ease; overflow: hidden;
    }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--dm-header);
    }
    .modal-header h3 {
      margin: 0; font-size: 0.95rem; font-weight: 700; color: #ffffff;
      display: flex; align-items: center; gap: 8px;
    }
    .modal-header h3 i { color: var(--dm-accent); }
    .modal-close {
      background: none; border: none; font-size: 1rem; color: rgba(255,255,255,0.4);
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .modal-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field label {
      font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5);
      text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 6px;
    }
    .field-hint { font-size: 0.72rem; font-weight: 400; color: rgba(255,255,255,0.3); text-transform: none; letter-spacing: 0; }
    .modal-field input, .modal-field select {
      padding: 9px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      font-size: 0.9rem; background: #1b3028; color: #ffffff; width: 100%; box-sizing: border-box;
    }
    .modal-field select option { background: #1b3028; color: #ffffff; }
    .modal-field input::placeholder { color: rgba(255,255,255,0.3); }
    .modal-field input:focus, .modal-field select:focus {
      outline: none; border-color: rgba(163,230,53,0.4); box-shadow: 0 0 0 3px rgba(163,230,53,0.08);
    }
    .modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .winner-picker { display: flex; align-items: stretch; gap: 10px; }
    .winner-opt {
      flex: 1; padding: 12px; border: 1.5px solid rgba(255,255,255,0.1); border-radius: 8px;
      cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
      background: rgba(255,255,255,0.03);
    }
    .winner-opt:hover { border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.06); }
    .winner-opt.winner-selected { border-color: var(--dm-accent); background: rgba(163,230,53,0.1); }
    .winner-names { display: flex; flex-direction: column; gap: 2px; font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.8); }
    .winner-check { font-size: 0.75rem; font-weight: 700; color: var(--dm-accent); display: flex; align-items: center; gap: 4px; }
    .winner-vs {
      display: flex; align-items: center; font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.3); flex-shrink: 0;
    }
    .slot-tbd { color: rgba(255,255,255,0.25); font-style: italic; font-size: 0.8rem; }
    .score-input {
      width: 100%; box-sizing: border-box; padding: 5px 8px;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 0.82rem;
      text-align: center; background: rgba(255,255,255,0.05); color: #ffffff;
      margin-top: 2px;
    }
    .score-input::placeholder { color: rgba(255,255,255,0.25); }
    .score-input:focus { outline: none; border-color: rgba(163,230,53,0.4); box-shadow: 0 0 0 2px rgba(163,230,53,0.08); }
    .winner-selected .score-input { border-color: rgba(163,230,53,0.25); }

    .modal-sm { max-width: 380px; }
    .delete-header { gap: 12px; align-items: flex-start; }
    .delete-icon-wrap {
      width: 40px; height: 40px; border-radius: 10px; background: rgba(220,38,38,0.15);
      display: flex; align-items: center; justify-content: center;
      color: #f87171; font-size: 1rem; flex-shrink: 0;
    }
    .delete-header h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #ffffff; }
    .delete-sub { margin: 3px 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.5); font-weight: 400; }
    .btn-delete-confirm {
      padding: 9px 20px; background: rgba(220,38,38,0.18); color: #f87171;
      border: 1px solid rgba(220,38,38,0.3);
      border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-delete-confirm:hover { background: rgba(220,38,38,0.3); }
    .btn-complete-confirm {
      padding: 9px 20px; background: rgba(163,230,53,0.18); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28);
      border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-complete-confirm:hover { background: rgba(163,230,53,0.28); }

    .modal-error {
      background: rgba(220,38,38,0.1); color: #f87171; border: 1px solid rgba(220,38,38,0.25);
      border-radius: 8px; padding: 8px 12px; font-size: 0.82rem;
      display: flex; align-items: center; gap: 6px;
    }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06);
      background: rgba(255,255,255,0.02);
    }
    .btn-cancel {
      padding: 9px 16px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.875rem; cursor: pointer;
      transition: background 0.15s;
    }
    .btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #fff; }
    .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-confirm {
      padding: 9px 20px; background: rgba(163,230,53,0.18); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28);
      border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-confirm:hover:not(:disabled) { background: rgba(163,230,53,0.28); }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

    .no-winner-warn {
      display: flex; align-items: center; gap: 10px;
      background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); border-radius: 8px;
      padding: 10px 14px; font-size: 0.82rem; color: #fbbf24; margin-bottom: 16px;
    }
    .no-winner-warn i { flex-shrink: 0; }

    /* Tournament Rankings Tab */
    .rank-empty { text-align: center; padding: 48px 24px; }
    .rank-empty-icon { font-size: 2.5rem; color: rgba(255,255,255,0.15); margin-bottom: 12px; }
    .rank-empty-title { font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.7); margin: 0 0 6px; }
    .rank-empty-sub { font-size: 0.875rem; color: rgba(255,255,255,0.4); margin: 0; }

    .rank-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .rank-table thead tr { background: rgba(255,255,255,0.03); }
    .rank-table th {
      padding: 10px 12px; text-align: left; font-size: 0.72rem; font-weight: 700;
      color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.4px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .rank-table td { padding: 11px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; color: rgba(255,255,255,0.8); }
    .rank-table tbody tr:hover td { background: rgba(163,230,53,0.04); }
    .rc-rank { width: 56px; text-align: center; }
    .rc-played, .rc-won, .rc-lost { width: 70px; text-align: center; }
    .rc-pts { width: 90px; text-align: right; }
    .medal { font-size: 1.2rem; }
    .rank-num { font-weight: 700; color: rgba(255,255,255,0.35); }
    .wins-val { font-weight: 700; color: var(--dm-accent); }
    .player-cell { display: flex; align-items: center; gap: 9px; }
    .player-av {
      width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .av-init {
      background: rgba(163,230,53,0.2); color: var(--dm-accent); font-size: 0.75rem;
      font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .player-nm { font-weight: 600; color: #ffffff; }
    .place-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 0.72rem; font-weight: 700;
    }
    .place-badge.place-champion { background: rgba(163,230,53,0.15); color: var(--dm-accent); }
    .place-badge.place-runner-up { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }
    .place-badge.place-semifinalist { background: rgba(139,92,246,0.15); color: #a78bfa; }
    .place-badge.place-quarterfinalist { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .place-badge.place-participant { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.45); }
    .pts-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(163,230,53,0.12); color: var(--dm-accent); padding: 4px 10px;
      border-radius: 20px; font-size: 0.8rem; font-weight: 700;
    }
    .pts-chip i { font-size: 0.65rem; }

    @media (max-width: 640px) {
      .card-header { flex-direction: column; align-items: flex-start; }
      .header-stats { width: 100%; }
      .action-bar { flex-direction: column; align-items: flex-start; }
      .action-bar-right { width: 100%; }
      .podium { flex-direction: column; }
      .modal-row { grid-template-columns: 1fr; }
      .rank-table { font-size: 0.78rem; }
      .rc-played, .rc-lost { display: none; }
    }
  `]
})
export class AdminTournamentDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tournamentService = inject(TournamentService);
  private usersService = inject(UsersService);

  tournament = signal<Tournament | null>(null);
  loading = signal(true);
  actionError = signal('');
  activeTab = signal<'participants' | 'matches' | 'schedule' | 'info' | 'rankings'>('participants');

  allUsers = signal<User[]>([]);
  filteredUsers = signal<User[]>([]);
  addingTeam = signal(false);

  rounds = signal<number[]>([]);

  editingMatch = signal<TournamentMatch | null>(null);
  savingMatch = signal(false);
  matchError = signal('');

  generating = signal(false);
  swapping = signal(false);

  editingMatchRoundId = signal<string | null>(null);
  savingRoundName = signal(false);

  confirmPrompt = signal<{
    title: string;
    subtitle: string;
    icon: string;
    confirmLabel: string;
    confirmClass: 'btn-delete-confirm' | 'btn-complete-confirm';
    action: () => void;
  } | null>(null);

  togglingPublish = signal(false);
  generatingRandom = signal(false);
  showAddMatch = signal(false);
  addingMatch = signal(false);
  addMatchError = signal('');
  schedEditId = signal<string | null>(null);
  savingSchedEdit = signal(false);

  // Plain properties (used in [(ngModel)] two-way binding)
  playerSearch = '';
  doublesP1 = '';
  doublesP2 = '';
  editScore1 = '';
  editScore2 = '';
  editWinner: number | null = null;
  editDate = '';
  editTimeSlot = '';
  editStatus = 'upcoming';
  editRoundNameValue = '';
  newMatchLabel = '';
  newMatchSlot1 = '';
  newMatchSlot2 = '';
  newMatchDate = '';
  newMatchTime = '';
  schedDate = '';
  schedTime = '';
  dragSource: { matchId: string; slot: 1 | 2 } | null = null;
  dragOverTarget: { matchId: string; slot: 1 | 2 } | null = null;

  constructor() {
    this.route.params.subscribe(params => this.loadTournament(params['id']));
    this.usersService.getAllUsers().subscribe({
      next: (users: any[]) => {
        this.allUsers.set(users.filter((u: any) => u.status === 'active'));
        this.filteredUsers.set([...this.allUsers()]);
      },
      error: () => {}
    });
  }

  loadTournament(id: string) {
    this.loading.set(true);
    this.tournamentService.getById(id).subscribe({
      next: (t) => {
        this.tournament.set(t);
        this.loading.set(false);
        this.rounds.set(this.computeRounds(t));
        this.filterUsers();
      },
      error: () => { this.loading.set(false); }
    });
  }

  computeRounds(t: Tournament): number[] {
    if (!t.matches.length) return [];
    const max = Math.max(...t.matches.map(m => m.round));
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  get completedMatchCount(): number {
    return this.tournament()?.matches.filter(m => m.status === 'completed').length ?? 0;
  }

  get entryCount(): number {
    const t = this.tournament();
    if (!t) return 0;
    return t.type === 'singles'
      ? t.participants.length
      : (t.teams?.length || 0);
  }

  get totalRoundsPreview(): number {
    return this.entryCount >= 2 ? Math.ceil(Math.log2(this.entryCount)) : 0;
  }

  get bracketSizePreview(): number {
    return this.totalRoundsPreview > 0 ? Math.pow(2, this.totalRoundsPreview) : 0;
  }

  get availableUsers(): User[] {
    const t = this.tournament();
    const enrolled = new Set(t?.participants.map(p => p._id) || []);
    return this.allUsers().filter(u => !enrolled.has(u._id));
  }

  get teamPickerUsers(): User[] {
    const t = this.tournament();
    const inTeam = new Set((t?.teams || []).flat().map((p: any) => p?._id || p?.toString?.() || p));
    return this.allUsers().filter(u => !inTeam.has(u._id));
  }

  get teamsWithNames(): (TournamentPlayer | undefined)[][] {
    const t = this.tournament();
    if (!t) return [];
    return (t.teams || []).map(team =>
      team.map(pid => t.participants.find(p => p._id === pid))
    );
  }

  get sortedMatches(): TournamentMatch[] {
    return [...(this.tournament()?.matches || [])]
      .filter(m => m.slot1Players.length > 0 || m.slot2Players.length > 0)
      .sort((a, b) => a.round - b.round || a.position - b.position);
  }

  goBack() { this.router.navigate(['/admin/tournaments']); }

  filterUsers() {
    const q = this.playerSearch.toLowerCase();
    this.filteredUsers.set(q
      ? this.allUsers().filter(u => u.name.toLowerCase().includes(q))
      : [...this.allUsers()]);
  }

  isEnrolled(userId: string): boolean {
    return this.tournament()?.participants.some(p => p._id === userId) || false;
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  addParticipant(playerId: string) {
    const t = this.tournament();
    if (!t) return;
    this.tournamentService.addParticipant(t._id, playerId).subscribe({
      next: (updated) => { this.tournament.set({ ...t, participants: updated.participants }); },
      error: (err) => { this.actionError.set(err.error?.error || 'Failed to add player'); }
    });
  }

  removeParticipant(playerId: string) {
    const t = this.tournament();
    if (!t) return;
    this.tournamentService.removeParticipant(t._id, playerId).subscribe({
      next: (updated) => { this.tournament.set({ ...t, participants: updated.participants }); },
      error: (err) => { this.actionError.set(err.error?.error || 'Failed to remove player'); }
    });
  }

  addTeam() {
    const t = this.tournament();
    if (!t || !this.doublesP1 || !this.doublesP2) return;
    this.addingTeam.set(true);
    this.tournamentService.addTeam(t._id, this.doublesP1, this.doublesP2).subscribe({
      next: (updated) => {
        this.tournament.set({ ...t, participants: updated.participants, teams: updated.teams });
        this.doublesP1 = '';
        this.doublesP2 = '';
        this.addingTeam.set(false);
      },
      error: (err) => {
        this.actionError.set(err.error?.error || 'Failed to add team');
        this.addingTeam.set(false);
      }
    });
  }

  removeTeam(idx: number) {
    const t = this.tournament();
    if (!t) return;
    const id = t._id;
    this.tournamentService.removeTeam(id, idx).subscribe({
      next: () => this.loadTournament(id),
      error: (err) => { this.actionError.set(err.error?.error || 'Failed to remove team'); }
    });
  }

  generateBracket() {
    const t = this.tournament();
    if (!t) return;
    this.generating.set(true);
    this.actionError.set('');
    this.tournamentService.generateBracket(t._id).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.rounds.set(this.computeRounds(updated));
        this.activeTab.set('matches');
        this.generating.set(false);
      },
      error: (err) => {
        this.generating.set(false);
        this.actionError.set(err.error?.error || 'Failed to generate bracket');
      }
    });
  }

  canComplete(): boolean {
    const t = this.tournament();
    if (!t) return false;
    const matches = t.matches;
    if (!matches.length) return true;
    const r = this.rounds();
    if (r.length > 0) {
      const final = matches.find(m => m.round === r.length && m.position === 0);
      return !!final && final.winner !== null;
    }
    const playable = matches.filter(m => m.slot1Players.length > 0 && m.slot2Players.length > 0);
    return playable.length > 0 && playable.every(m => m.winner !== null || m.status === 'completed');
  }

  completeTournament() {
    const t = this.tournament();
    if (!t) return;
    const name = t.name;
    const id = t._id;
    this.confirmPrompt.set({
      title: `Complete "${name}"?`,
      subtitle: 'This will lock the tournament. Scores and results can no longer be edited.',
      icon: 'flag-checkered',
      confirmLabel: 'Complete Tournament',
      confirmClass: 'btn-complete-confirm',
      action: () => {
        this.tournamentService.completeTournament(id).subscribe({
          next: (updated) => { this.tournament.set(updated); this.activeTab.set('info'); },
          error: (err) => { this.actionError.set(err.error?.error || 'Failed to complete tournament'); }
        });
      }
    });
  }

  confirmDelete() {
    const t = this.tournament();
    if (!t) return;
    const name = t.name;
    const id = t._id;
    this.confirmPrompt.set({
      title: `Delete "${name}"?`,
      subtitle: 'This tournament and all its data will be permanently removed.',
      icon: 'trash',
      confirmLabel: 'Delete',
      confirmClass: 'btn-delete-confirm',
      action: () => {
        this.tournamentService.delete(id).subscribe({
          next: () => this.router.navigate(['/admin/tournaments']),
          error: (err) => { this.actionError.set(err.error?.error || 'Failed to delete'); }
        });
      }
    });
  }

  togglePublished() {
    const t = this.tournament();
    if (!t) return;
    this.togglingPublish.set(true);
    this.tournamentService.setPublished(t._id, !t.published).subscribe({
      next: (updated) => { this.tournament.set(updated); this.togglingPublish.set(false); },
      error: () => { this.togglingPublish.set(false); }
    });
  }

  cancelPrompt() { this.confirmPrompt.set(null); }

  executePrompt() {
    const prompt = this.confirmPrompt();
    if (!prompt) return;
    const action = prompt.action;
    this.confirmPrompt.set(null);
    action();
  }

  getMatchesForRound(round: number): TournamentMatch[] {
    return (this.tournament()?.matches || [])
      .filter(m => m.round === round)
      .sort((a, b) => a.position - b.position);
  }

  getRoundName(round: number): string {
    return this.tournament()?.matches.find(m => m.round === round)?.roundName || `Round ${round}`;
  }

  slotLabel(players: TournamentPlayer[]): string {
    return players.length ? players.map(p => p.name).join(' & ') : 'TBD';
  }

  openMatchEditor(match: TournamentMatch) {
    if (this.tournament()?.status !== 'active') return;
    this.editingMatch.set(match);
    const parts = (match.score || '').split(' - ');
    this.editScore1 = parts[0]?.trim() || '';
    this.editScore2 = parts[1]?.trim() || '';
    this.editWinner = match.winner ?? null;
    this.editDate = match.scheduledDate ? match.scheduledDate.split('T')[0] : '';
    this.editTimeSlot = match.timeSlot || '';
    this.editStatus = match.status;
    this.matchError.set('');
  }

  closeMatchEditor() { this.editingMatch.set(null); this.matchError.set(''); }

  saveMatch() {
    const t = this.tournament();
    const em = this.editingMatch();
    if (!t || !em) return;
    this.savingMatch.set(true);
    this.matchError.set('');
    this.tournamentService.updateMatch(t._id, em._id, {
      score: [this.editScore1.trim(), this.editScore2.trim()].filter(Boolean).join(' - '),
      winner: this.editWinner,
      status: this.editStatus,
      scheduledDate: this.editDate || null,
      timeSlot: this.editTimeSlot,
    }).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.rounds.set(this.computeRounds(updated));
        this.savingMatch.set(false);
        this.editingMatch.set(null);
      },
      error: (err) => {
        this.savingMatch.set(false);
        this.matchError.set(err.error?.error || 'Failed to save match');
      }
    });
  }

  canDrag(match: TournamentMatch): boolean {
    return this.tournament()?.status === 'active' && match.status === 'upcoming';
  }

  isSlotDragging(matchId: string, slot: 1 | 2): boolean {
    return this.dragSource?.matchId === matchId && this.dragSource?.slot === slot;
  }

  isSlotDragOver(matchId: string, slot: 1 | 2): boolean {
    return this.dragOverTarget?.matchId === matchId && this.dragOverTarget?.slot === slot;
  }

  onSlotDragStart(event: DragEvent, match: TournamentMatch, slot: 1 | 2) {
    this.dragSource = { matchId: match._id, slot };
    event.dataTransfer?.setData('text/plain', `${match._id}:${slot}`);
  }

  onSlotDragOver(event: DragEvent, match: TournamentMatch, slot: 1 | 2) {
    if (!this.dragSource) return;
    const sameSlot = this.dragSource.matchId === match._id && this.dragSource.slot === slot;
    if (sameSlot || !this.canDrag(match)) return;
    event.preventDefault();
    this.dragOverTarget = { matchId: match._id, slot };
  }

  onSlotDragLeave() {
    this.dragOverTarget = null;
  }

  onSlotDrop(event: DragEvent, match: TournamentMatch, slot: 1 | 2) {
    event.preventDefault();
    const t = this.tournament();
    if (!this.dragSource || !t) return;
    const source = this.dragSource;
    const sameSlot = source.matchId === match._id && source.slot === slot;
    if (sameSlot || !this.canDrag(match)) return;
    this.dragSource = null;
    this.dragOverTarget = null;
    this.swapping.set(true);
    this.tournamentService.swapSlots(t._id, source.matchId, source.slot, match._id, slot).subscribe({
      next: (updated) => { this.tournament.set(updated); this.rounds.set(this.computeRounds(updated)); this.swapping.set(false); },
      error: (err) => { this.actionError.set(err.error?.error || 'Failed to swap'); this.swapping.set(false); }
    });
  }

  onDragEnd() {
    this.dragSource = null;
    this.dragOverTarget = null;
  }

  generateRandomMatches() {
    const t = this.tournament();
    if (!t) return;
    this.generatingRandom.set(true);
    this.actionError.set('');
    this.tournamentService.generateRandomMatches(t._id).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.rounds.set(this.computeRounds(updated));
        this.generatingRandom.set(false);
        this.activeTab.set('matches');
      },
      error: (err) => {
        this.actionError.set(err.error?.error || 'Failed to generate matches');
        this.generatingRandom.set(false);
      }
    });
  }

  deleteMatch(matchId: string) {
    const t = this.tournament();
    if (!t) return;
    const id = t._id;
    this.confirmPrompt.set({
      title: 'Delete Match',
      subtitle: 'This match will be permanently removed.',
      icon: 'trash',
      confirmLabel: 'Delete',
      confirmClass: 'btn-delete-confirm',
      action: () => {
        this.tournamentService.deleteMatch(id, matchId).subscribe({
          next: (updated) => { this.tournament.set(updated); this.rounds.set(this.computeRounds(updated)); },
          error: (err) => { this.actionError.set(err.error?.error || 'Failed to delete match'); }
        });
      }
    });
  }

  openAddMatch() {
    this.showAddMatch.set(true);
    this.newMatchLabel = '';
    this.newMatchSlot1 = '';
    this.newMatchSlot2 = '';
    this.newMatchDate = '';
    this.newMatchTime = '';
    this.addMatchError.set('');
  }

  closeAddMatch() { this.showAddMatch.set(false); this.addMatchError.set(''); }

  saveAddMatch() {
    const t = this.tournament();
    if (!t || !this.newMatchLabel.trim()) return;
    this.addingMatch.set(true);
    this.addMatchError.set('');

    let slot1: string[] = [];
    let slot2: string[] = [];

    if (t.type === 'singles') {
      if (this.newMatchSlot1) slot1 = [this.newMatchSlot1];
      if (this.newMatchSlot2) slot2 = [this.newMatchSlot2];
    } else {
      const t1 = t.teams[+this.newMatchSlot1];
      const t2 = t.teams[+this.newMatchSlot2];
      if (t1) slot1 = t1.map((p: any) => typeof p === 'string' ? p : p._id || p);
      if (t2) slot2 = t2.map((p: any) => typeof p === 'string' ? p : p._id || p);
    }

    this.tournamentService.addMatch(t._id, {
      roundName: this.newMatchLabel.trim(),
      slot1Players: slot1,
      slot2Players: slot2,
      scheduledDate: this.newMatchDate || undefined,
      timeSlot: this.newMatchTime || undefined,
    }).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.rounds.set(this.computeRounds(updated));
        this.addingMatch.set(false);
        this.showAddMatch.set(false);
      },
      error: (err) => {
        this.addMatchError.set(err.error?.error || 'Failed to add match');
        this.addingMatch.set(false);
      }
    });
  }

  startEditRoundName(matchId: string, currentName: string) {
    this.editingMatchRoundId.set(matchId);
    this.editRoundNameValue = currentName;
  }

  cancelRoundName() {
    this.editingMatchRoundId.set(null);
    this.editRoundNameValue = '';
  }

  saveRoundName() {
    const t = this.tournament();
    const erId = this.editingMatchRoundId();
    if (!t || !erId || this.savingRoundName()) return;
    const name = this.editRoundNameValue.trim();
    if (!name) { this.cancelRoundName(); return; }
    this.savingRoundName.set(true);
    this.tournamentService.updateMatch(t._id, erId, { roundName: name }).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.rounds.set(this.computeRounds(updated));
        this.editingMatchRoundId.set(null);
        this.editRoundNameValue = '';
        this.savingRoundName.set(false);
      },
      error: (err) => {
        this.actionError.set(err.error?.error || 'Failed to rename');
        this.savingRoundName.set(false);
        this.editingMatchRoundId.set(null);
      }
    });
  }

  openSchedEdit(match: TournamentMatch) {
    this.schedDate = match.scheduledDate ? match.scheduledDate.split('T')[0] : '';
    this.schedTime = match.timeSlot || '';
    this.schedEditId.set(match._id);
  }

  saveSchedEdit(matchId: string) {
    const t = this.tournament();
    if (!t) return;
    this.savingSchedEdit.set(true);
    this.tournamentService.updateMatch(t._id, matchId, {
      scheduledDate: this.schedDate || null,
      timeSlot: this.schedTime || undefined,
    }).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.rounds.set(this.computeRounds(updated));
        this.schedEditId.set(null);
        this.savingSchedEdit.set(false);
      },
      error: (err) => {
        this.actionError.set(err.error?.error || 'Failed to save schedule');
        this.savingSchedEdit.set(false);
      }
    });
  }

  getPlacement(type: 'champion' | 'runnerUp'): string {
    const t = this.tournament();
    const r = this.rounds();
    if (!t || !r.length) return '—';
    const final = t.matches.find(m => m.round === r.length && m.position === 0);
    if (!final || !final.winner) return '—';
    const players = type === 'champion'
      ? (final.winner === 1 ? final.slot1Players : final.slot2Players)
      : (final.winner === 1 ? final.slot2Players : final.slot1Players);
    return players.map(p => p.name).join(' & ') || '—';
  }

  inferWinner(match: TournamentMatch): number | null {
    if (match.winner != null) return match.winner;
    if (!match.score) return null;
    const parts = match.score.split(' - ');
    if (parts.length !== 2) return null;
    const sum = (s: string) => s.split(',').reduce((acc, v) => acc + (parseFloat(v.trim()) || 0), 0);
    const s1 = sum(parts[0]);
    const s2 = sum(parts[1]);
    if (s1 > s2) return 1;
    if (s2 > s1) return 2;
    return null;
  }

  get hasMatchesWithoutWinner(): boolean {
    return (this.tournament()?.matches || [])
      .some(m => m.status === 'completed' && this.inferWinner(m) == null);
  }

  get tournamentRankings(): PlayerStat[] {
    const t = this.tournament();
    if (!t) return [];
    const POINTS = {
      singles: { champion: 100, runnerUp: 70, semiFinal: 40, quarterFinal: 20, participation: 10 },
      doubles: { champion: 80,  runnerUp: 50, semiFinal: 30, quarterFinal: 15, participation: 5 }
    };
    const pts = POINTS[t.type];
    const map = new Map<string, PlayerStat>();

    for (const p of t.participants) {
      map.set(p._id, {
        playerId: p._id, name: p.name, profileImage: p.profileImage,
        matchesPlayed: 0, matchesWon: 0, matchesLost: 0,
        placement: 'Participant', pointsEarned: pts.participation
      });
    }

    const done = t.matches.filter(m => m.winner != null || m.status === 'completed');
    for (const m of done) {
      const w = this.inferWinner(m);
      for (const p of m.slot1Players) {
        const s = map.get(p._id);
        if (!s) continue;
        s.matchesPlayed++;
        if (w === 1) s.matchesWon++;
        else if (w === 2) s.matchesLost++;
      }
      for (const p of m.slot2Players) {
        const s = map.get(p._id);
        if (!s) continue;
        s.matchesPlayed++;
        if (w === 2) s.matchesWon++;
        else if (w === 1) s.matchesLost++;
      }
    }

    const bracket = done.filter(m => m.round > 0);
    if (bracket.length > 0) {
      const sortedRounds = [...new Set(bracket.map(m => m.round))].sort((a, b) => b - a);
      const [finalRound, semiRound, quarterRound] = sortedRounds;

      for (const m of bracket.filter(m => m.round === finalRound)) {
        const w = this.inferWinner(m);
        if (w == null) continue;
        const winners = w === 1 ? m.slot1Players : m.slot2Players;
        const losers  = w === 1 ? m.slot2Players : m.slot1Players;
        winners.forEach(p => { const s = map.get(p._id); if (s) { s.placement = 'Champion';  s.pointsEarned = pts.champion; } });
        losers.forEach(p  => { const s = map.get(p._id); if (s) { s.placement = 'Runner-up'; s.pointsEarned = pts.runnerUp; } });
      }
      if (semiRound !== undefined) {
        for (const m of bracket.filter(m => m.round === semiRound)) {
          const w = this.inferWinner(m);
          if (w == null) continue;
          const losers = w === 1 ? m.slot2Players : m.slot1Players;
          losers.forEach(p => { const s = map.get(p._id); if (s && s.placement === 'Participant') { s.placement = 'Semifinalist';    s.pointsEarned = pts.semiFinal; } });
        }
      }
      if (quarterRound !== undefined) {
        for (const m of bracket.filter(m => m.round === quarterRound)) {
          const w = this.inferWinner(m);
          if (w == null) continue;
          const losers = w === 1 ? m.slot2Players : m.slot1Players;
          losers.forEach(p => { const s = map.get(p._id); if (s && s.placement === 'Participant') { s.placement = 'Quarterfinalist'; s.pointsEarned = pts.quarterFinal; } });
        }
      }
    } else if (done.length > 0) {
      // Custom matches (round=0): rank by win count
      const played = [...map.values()].filter(s => s.matchesPlayed > 0);
      const winLevels = [...new Set(played.map(s => s.matchesWon))].sort((a, b) => b - a);
      const placementNames: PlayerStat['placement'][] = ['Champion', 'Runner-up', 'Semifinalist', 'Quarterfinalist'];
      const pointKeys = ['champion', 'runnerUp', 'semiFinal', 'quarterFinal'] as const;
      winLevels.forEach((wins, idx) => {
        if (idx >= placementNames.length) return;
        played.filter(s => s.matchesWon === wins).forEach(s => {
          s.placement = placementNames[idx];
          s.pointsEarned = pts[pointKeys[idx]];
        });
      });
    }

    const order: Record<string, number> = { Champion: 0, 'Runner-up': 1, Semifinalist: 2, Quarterfinalist: 3, Participant: 4 };
    return [...map.values()].sort((a, b) => {
      const d = order[a.placement] - order[b.placement];
      return d !== 0 ? d : b.matchesWon - a.matchesWon;
    });
  }

  placementClass(placement: string): string {
    const classes: Record<string, string> = {
      'Champion':        'place-badge place-champion',
      'Runner-up':       'place-badge place-runner-up',
      'Semifinalist':    'place-badge place-semifinalist',
      'Quarterfinalist': 'place-badge place-quarterfinalist',
      'Participant':     'place-badge place-participant'
    };
    return classes[placement] ?? 'place-badge place-participant';
  }
}
