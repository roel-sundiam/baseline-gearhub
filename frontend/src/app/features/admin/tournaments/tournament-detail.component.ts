import { Component, OnInit } from '@angular/core';
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

      @if (loading) {
        <div class="page-card loading-card">
          <i class="fas fa-circle-notch fa-spin"></i> Loading tournament...
        </div>
      } @else if (!tournament) {
        <div class="page-card loading-card">Tournament not found.</div>
      } @else {
        <div class="page-card">

          <!-- Header -->
          <div class="card-header">
            <button class="back-btn" (click)="goBack()">← Back</button>
            <div class="header-center">
              <div class="header-title-row">
                <h2>{{ tournament.name }}</h2>
                <span class="type-badge type-{{ tournament.type }}">{{ tournament.type }}</span>
                <span class="status-badge status-{{ tournament.status }}">{{ tournament.status }}</span>
              </div>
            </div>
            <div class="header-stats">
              <div class="stat-pill">
                <span class="stat-num">{{ tournament.participants.length }}</span>
                <span class="stat-lbl">Players</span>
              </div>
              @if (tournament.status !== 'draft') {
                <div class="stat-pill stat-pill-green">
                  <span class="stat-num">{{ completedMatchCount }}</span>
                  <span class="stat-lbl">Done</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-num">{{ tournament.matches.length }}</span>
                  <span class="stat-lbl">Matches</span>
                </div>
              }
            </div>
          </div>

          <!-- Action bar -->
          @if (tournament.status === 'draft' || (tournament.status === 'active' && canComplete()) || true) {
            <div class="action-bar">
              @if (actionError) {
                <div class="action-error"><i class="fas fa-exclamation-circle"></i> {{ actionError }}</div>
              }
              <div class="action-bar-right">
                @if (tournament.status === 'draft') {
                  <div class="bracket-hint">
                    <i class="fas fa-info-circle"></i>
                    Add at least 2 {{ tournament.type === 'singles' ? 'players' : 'teams' }}, then use Auto Matches to create the bracket.
                  </div>
                }
                @if (tournament.status === 'active' && canComplete()) {
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
            <button class="tab-btn" [class.active]="activeTab === 'participants'" (click)="activeTab = 'participants'">
              <i class="fas fa-{{ tournament.type === 'singles' ? 'user' : 'user-friends' }}"></i>
              {{ tournament.type === 'singles' ? 'Players' : 'Teams' }}
              <span class="tab-badge">{{ entryCount }}</span>
            </button>
            @if (tournament.status !== 'draft' || tournament.matches.length > 0) {
              <button class="tab-btn" [class.active]="activeTab === 'matches'" (click)="activeTab = 'matches'">
                <i class="fas fa-sitemap"></i> Matches
              </button>
              <button class="tab-btn" [class.active]="activeTab === 'schedule'" (click)="activeTab = 'schedule'">
                <i class="fas fa-calendar-alt"></i> Schedule
              </button>
            }
            <button class="tab-btn" [class.active]="activeTab === 'info'" (click)="activeTab = 'info'">
              <i class="fas fa-info-circle"></i> Info
            </button>
            @if (tournament.status !== 'draft' || tournament.matches.length > 0) {
              <button class="tab-btn" [class.active]="activeTab === 'rankings'" (click)="activeTab = 'rankings'">
                <i class="fas fa-medal"></i> Rankings
              </button>
            }
          </div>

          <div class="card-body">

            <!-- ── PARTICIPANTS TAB ─────────────────────────────────── -->
            @if (activeTab === 'participants') {
              @if (tournament.type === 'singles') {
                <div class="two-col">
                  <!-- Enrolled -->
                  <div class="panel">
                    <div class="panel-header">
                      <span class="panel-title"><i class="fas fa-users"></i> Enrolled Players</span>
                      <span class="panel-count">{{ tournament.participants.length }}</span>
                      @if (tournament.participants.length >= 2) {
                        <button class="btn-random-matches" [disabled]="generatingRandom" (click)="generateRandomMatches()">
                          @if (generatingRandom) { <i class="fas fa-circle-notch fa-spin"></i> }
                          @else { <i class="fas fa-random"></i> }
                          Auto Matches
                        </button>
                      }
                    </div>
                    @if (tournament.participants.length === 0) {
                      <div class="panel-empty">
                        <i class="fas fa-user-plus"></i>
                        <p>No players added yet.</p>
                      </div>
                    } @else {
                      <div class="player-list">
                        @for (p of tournament.participants; track p._id) {
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
                      @for (u of filteredUsers; track u._id) {
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
                      <span class="panel-count">{{ tournament.teams?.length || 0 }}</span>
                      @if ((tournament.teams?.length || 0) >= 2) {
                        <button class="btn-random-matches" [disabled]="generatingRandom" (click)="generateRandomMatches()">
                          @if (generatingRandom) { <i class="fas fa-circle-notch fa-spin"></i> }
                          @else { <i class="fas fa-random"></i> }
                          Auto Matches
                        </button>
                      }
                    </div>
                    @if (!tournament.teams || tournament.teams.length === 0) {
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
                    <button class="btn-add-team" [disabled]="!doublesP1 || !doublesP2 || addingTeam" (click)="addTeam()">
                      @if (addingTeam) {
                        <i class="fas fa-circle-notch fa-spin"></i> Adding...
                      } @else {
                        <i class="fas fa-plus"></i> Add Team
                      }
                    </button>
                  </div>
                </div>
              }

              @if (entryCount >= 2 && tournament.status === 'draft') {
                <div class="bracket-preview-bar">
                  <i class="fas fa-sitemap"></i>
                  <strong>{{ entryCount }}</strong> {{ tournament.type === 'singles' ? 'players' : 'teams' }} →
                  <strong>{{ totalRoundsPreview }}</strong> rounds ·
                  <strong>{{ bracketSizePreview }}</strong>-player bracket ·
                  <strong>{{ bracketSizePreview - entryCount }}</strong> bye{{ bracketSizePreview - entryCount !== 1 ? 's' : '' }}
                </div>
              }
            }

            <!-- ── BRACKET TAB ──────────────────────────────────────── -->
            @if (activeTab === 'matches') {
              @if (tournament.status === 'completed') {
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
              @if (tournament.status === 'active') {
                @if (swapping) {
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

                    @if (tournament.status === 'active' && editingMatchRoundId === match._id) {
                      <input class="round-name-input"
                        [(ngModel)]="editRoundNameValue"
                        (keydown.enter)="saveRoundName()"
                        (keydown.escape)="cancelRoundName()"
                        (blur)="saveRoundName()"
                        [disabled]="savingRoundName"
                        autofocus />
                    } @else {
                      <span class="row-round-chip"
                        [class.chip-editable]="tournament.status === 'active'"
                        (click)="tournament.status === 'active' && startEditRoundName(match._id, match.roundName)"
                        [title]="tournament.status === 'active' ? 'Click to rename' : ''">
                        {{ match.roundName }}
                        @if (tournament.status === 'active') { <i class="fas fa-pen chip-edit-icon"></i> }
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
                        [draggable]="canDrag(match) && !swapping"
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
                        [draggable]="canDrag(match) && !swapping"
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

                    @if (tournament.status === 'active') {
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
              @if (tournament.status === 'active') {
                <button class="btn-add-match" (click)="openAddMatch()">
                  <i class="fas fa-plus-circle"></i> Add Match
                </button>
              }
            }

            <!-- ── SCHEDULE TAB ─────────────────────────────────────── -->
            @if (activeTab === 'schedule') {
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
                        @if (tournament.status === 'active' && editingMatchRoundId === match._id) {
                          <input class="round-name-input"
                            [(ngModel)]="editRoundNameValue"
                            (keydown.enter)="saveRoundName()"
                            (keydown.escape)="cancelRoundName()"
                            (blur)="saveRoundName()"
                            [disabled]="savingRoundName" />
                        } @else {
                          <span class="sched-label"
                            [class.chip-editable]="tournament.status === 'active'"
                            (click)="tournament.status === 'active' && startEditRoundName(match._id, match.roundName)"
                            [title]="tournament.status === 'active' ? 'Click to rename' : ''">
                            {{ match.roundName }}
                            @if (tournament.status === 'active') { <i class="fas fa-pen chip-edit-icon"></i> }
                          </span>
                        }
                        <span class="status-chip chip-{{ match.status }}">{{ match.status }}</span>
                        @if (tournament.status === 'active') {
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
                      @if (match.scheduledDate || match.timeSlot) {
                        <div class="sched-meta">
                          <i class="fas fa-calendar"></i>
                          @if (match.scheduledDate) { {{ match.scheduledDate | date: 'MMM d, yyyy' : 'UTC' }} }
                          @if (match.timeSlot) { <span class="sched-time"><i class="fas fa-clock"></i> {{ match.timeSlot }}</span> }
                        </div>
                      } @else {
                        <div class="sched-meta sched-unscheduled"><i class="fas fa-calendar-plus"></i> Not scheduled</div>
                      }

                    </div>
                  }
                </div>
              }
            }

            <!-- ── INFO TAB ────────────────────────────────────────── -->
            @if (activeTab === 'info') {

              <!-- Visibility card -->
              <div class="info-visibility-card" [class.vis-published]="tournament.published" [class.vis-inactive]="!tournament.published">
                <div class="vis-left">
                  <div class="vis-icon">
                    <i class="fas fa-{{ tournament.published ? 'eye' : 'eye-slash' }}"></i>
                  </div>
                  <div>
                    <div class="vis-title">{{ tournament.published ? 'Published' : 'Inactive' }}</div>
                    <div class="vis-sub">
                      {{ tournament.published
                        ? 'Visible to all players in the Tournaments section.'
                        : 'Hidden from players. Publish to make it visible.' }}
                    </div>
                  </div>
                </div>
                <button class="btn-vis" [class.btn-unpublish]="tournament.published" (click)="togglePublished()" [disabled]="togglingPublish">
                  @if (togglingPublish) { <i class="fas fa-circle-notch fa-spin"></i> }
                  @else { <i class="fas fa-{{ tournament.published ? 'eye-slash' : 'rocket' }}"></i> }
                  {{ tournament.published ? 'Unpublish' : 'Publish Tournament' }}
                </button>
              </div>

              <!-- Stats row -->
              <div class="info-stats-row">
                <div class="info-stat-box">
                  <div class="info-stat-num">{{ tournament.participants.length }}</div>
                  <div class="info-stat-lbl"><i class="fas fa-users"></i> Players</div>
                </div>
                <div class="info-stat-box">
                  <div class="info-stat-num">{{ tournament.matches.length }}</div>
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
                  <span class="info-detail-val">{{ tournament.name }}</span>
                </div>
                <div class="info-detail-row">
                  <span class="info-detail-lbl"><i class="fas fa-tag"></i> Type</span>
                  <span class="info-detail-val capitalize">{{ tournament.type }}</span>
                </div>
                <div class="info-detail-row">
                  <span class="info-detail-lbl"><i class="fas fa-circle-dot"></i> Status</span>
                  <span class="status-badge status-{{ tournament.status }}">{{ tournament.status }}</span>
                </div>
                <div class="info-detail-row">
                  <span class="info-detail-lbl"><i class="fas fa-calendar"></i> Created</span>
                  <span class="info-detail-val">{{ tournament.createdAt | date: 'MMMM d, yyyy' }}</span>
                </div>
              </div>

              @if (tournament.status === 'completed') {
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
            @if (activeTab === 'rankings') {
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
    @if (editingMatch) {
      <div class="modal-backdrop" (click)="closeMatchEditor()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="fas fa-pen"></i> Edit Match — {{ editingMatch.roundName }}</h3>
            <button class="modal-close" (click)="closeMatchEditor()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">

            <!-- Winner picker with per-team score -->
            <div class="modal-field">
              <label>Score &amp; Winner</label>
              <div class="winner-picker">
                <div class="winner-opt" [class.winner-selected]="editWinner === 1" (click)="editWinner = 1">
                  <div class="winner-names">
                    @for (p of editingMatch.slot1Players; track p._id) { <span>{{ p.name }}</span> }
                    @if (editingMatch.slot1Players.length === 0) { <span class="slot-tbd">TBD</span> }
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
                    @for (p of editingMatch.slot2Players; track p._id) { <span>{{ p.name }}</span> }
                    @if (editingMatch.slot2Players.length === 0) { <span class="slot-tbd">TBD</span> }
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

            @if (matchError) {
              <div class="modal-error"><i class="fas fa-exclamation-circle"></i> {{ matchError }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeMatchEditor()" [disabled]="savingMatch">Cancel</button>
            <button class="btn-confirm" (click)="saveMatch()" [disabled]="savingMatch">
              @if (savingMatch) { <i class="fas fa-circle-notch fa-spin"></i> Saving... }
              @else { <i class="fas fa-check"></i> Save Match }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── ADD MATCH MODAL ──────────────────────────────────────────── -->
    @if (showAddMatch) {
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
                <label>{{ tournament!.type === 'singles' ? 'Player 1' : 'Team 1' }}</label>
                <select [(ngModel)]="newMatchSlot1">
                  <option value="">— Select —</option>
                  @if (tournament!.type === 'singles') {
                    @for (p of tournament!.participants; track p._id) {
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
                <label>{{ tournament!.type === 'singles' ? 'Player 2' : 'Team 2' }}</label>
                <select [(ngModel)]="newMatchSlot2">
                  <option value="">— Select —</option>
                  @if (tournament!.type === 'singles') {
                    @for (p of tournament!.participants; track p._id) {
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
            @if (addMatchError) {
              <div class="modal-error"><i class="fas fa-exclamation-circle"></i> {{ addMatchError }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeAddMatch()" [disabled]="addingMatch">Cancel</button>
            <button class="btn-confirm" (click)="saveAddMatch()" [disabled]="!newMatchLabel.trim() || addingMatch">
              @if (addingMatch) { <i class="fas fa-circle-notch fa-spin"></i> Adding... }
              @else { <i class="fas fa-plus"></i> Add Match }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── DELETE CONFIRM MODAL ─────────────────────────────────────── -->
    @if (confirmPrompt) {
      <div class="modal-backdrop" (click)="cancelPrompt()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header delete-header">
            <div class="delete-icon-wrap"><i class="fas fa-{{ confirmPrompt.icon }}"></i></div>
            <div>
              <h3>{{ confirmPrompt.title }}</h3>
              <p class="delete-sub">{{ confirmPrompt.subtitle }}</p>
            </div>
            <button class="modal-close" (click)="cancelPrompt()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="cancelPrompt()">Cancel</button>
            <button [class]="confirmPrompt.confirmClass" (click)="executePrompt()">
              <i class="fas fa-{{ confirmPrompt.icon }}"></i> {{ confirmPrompt.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Layout ──────────────────────────────────────────────────── */
    .page-wrap {
      position: relative; min-height: 100vh; padding: 20px;
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
    }
    .court-bg {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: url('/tennis-court-surface.png') center/cover no-repeat; z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); }
    .page-card {
      position: relative; z-index: 1; background: white; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 1000px; margin: 0 auto; overflow: hidden;
    }
    .loading-card {
      padding: 40px; text-align: center; color: #888; font-size: 0.9rem;
    }

    /* ── Header ──────────────────────────────────────────────────── */
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; border-bottom: 1px solid #eee; flex-wrap: wrap;
    }
    .back-btn {
      background: none; border: none; font-size: 15px;
      cursor: pointer; padding: 8px 12px; border-radius: 4px; color: #555; white-space: nowrap;
    }
    .back-btn:hover { background: #f0f0f0; }
    .header-center { flex: 1; min-width: 0; }
    .header-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .header-title-row h2 { margin: 0; font-size: 20px; color: #1a1a1a; }
    .type-badge, .status-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .type-singles { background: #dbeafe; color: #1e40af; }
    .type-doubles { background: #fef3c7; color: #92400e; }
    .status-draft   { background: #f1f5f9; color: #475569; }
    .status-active  { background: #f4ead6; color: #7a5626; }
    .status-completed { background: #ede9fe; color: #5b21b6; }

    .header-stats { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 14px; background: #f1f5f9; border-radius: 20px; min-width: 52px;
    }
    .stat-pill-green { background: #f4ead6; }
    .stat-num { font-size: 1rem; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
    .stat-pill-green .stat-num { color: #7a5626; }
    .stat-lbl { font-size: 0.65rem; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }

    /* ── Action bar ──────────────────────────────────────────────── */
    .action-bar {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      padding: 12px 24px; background: #f8fafc; border-bottom: 1px solid #eee;
    }
    .action-error {
      font-size: 0.82rem; color: #b91c1c; display: flex; align-items: center; gap: 6px;
    }
    .action-bar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: auto; }
    .bracket-hint {
      font-size: 0.78rem; color: #64748b; background: #f0f9ff; border: 1px solid #bae6fd;
      border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; gap: 6px;
    }
    .btn-action {
      padding: 8px 16px; border: none; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-action:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-generate { background: #9f7338; color: white; }
    .btn-generate:hover:not(:disabled) { background: #245517; }
    .btn-complete { background: #7c3aed; color: white; }
    .btn-complete:hover { background: #6d28d9; }
    .btn-danger  { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
    .btn-danger:hover { background: #fee2e2; }

    /* ── Tab bar ─────────────────────────────────────────────────── */
    .tab-bar {
      display: flex; border-bottom: 2px solid #e9ecef;
      padding: 0 24px; overflow-x: auto; gap: 2px;
    }
    .tab-btn {
      background: none; border: none; padding: 14px 16px;
      font-size: 0.875rem; font-weight: 600; color: #888; cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px;
      transition: all 0.15s; white-space: nowrap; display: flex; align-items: center; gap: 7px;
    }
    .tab-btn:hover { color: #9f7338; }
    .tab-btn.active { color: #9f7338; border-bottom-color: #9f7338; }
    .tab-badge {
      background: #f4ead6; color: #7a5626; font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }

    /* ── Card body ───────────────────────────────────────────────── */
    .card-body { padding: 24px; }

    /* ── Two-col layout ──────────────────────────────────────────── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 680px) { .two-col { grid-template-columns: 1fr; } }

    .panel { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .panel-title { font-size: 0.82rem; font-weight: 700; color: #374151; display: flex; align-items: center; gap: 7px; }
    .panel-count {
      background: #9f7338; color: white; font-size: 0.7rem; font-weight: 700;
      padding: 2px 8px; border-radius: 10px;
    }
    .btn-random-matches {
      margin-left: auto; padding: 4px 10px; background: #f8f1e4; color: #9f7338;
      border: 1.5px solid #e6d2ad; border-radius: 6px; font-size: 0.72rem; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s;
    }
    .btn-random-matches:hover:not(:disabled) { background: #f2e4c9; border-color: #9f7338; }
    .btn-random-matches:disabled { opacity: 0.5; cursor: not-allowed; }
    .panel-empty { padding: 32px 16px; text-align: center; color: #94a3b8; }
    .panel-empty i { font-size: 1.8rem; display: block; margin-bottom: 8px; }
    .panel-empty p { margin: 0; font-size: 0.82rem; }

    .player-list { display: flex; flex-direction: column; max-height: 360px; overflow-y: auto; }
    .player-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid #f0f4f8;
      transition: background 0.12s;
    }
    .player-row:last-child { border-bottom: none; }
    .player-row:hover { background: #f8fafc; }

    .team-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid #f0f4f8;
    }
    .team-row:last-child { border-bottom: none; }
    .team-num { width: 22px; font-size: 0.75rem; font-weight: 700; color: #94a3b8; flex-shrink: 0; }
    .team-names { flex: 1; font-size: 0.875rem; font-weight: 600; color: #1a1a1a; display: flex; align-items: center; gap: 6px; }
    .team-amp { color: #94a3b8; font-weight: 400; }

    .player-avatar {
      width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      background: linear-gradient(135deg, #9f7338, #c9a15d);
      color: white; font-size: 0.7rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .player-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .player-avatar.sm { width: 26px; height: 26px; font-size: 0.62rem; }
    .player-name { flex: 1; font-size: 0.875rem; font-weight: 600; color: #1a1a1a; }
    .btn-remove {
      background: none; border: none; color: #cbd5e1; cursor: pointer;
      padding: 4px 6px; border-radius: 4px; font-size: 0.8rem;
    }
    .btn-remove:hover { color: #b91c1c; background: #fef2f2; }

    .search-bar {
      position: relative; padding: 10px 14px; border-bottom: 1px solid #e2e8f0;
    }
    .search-icon { position: absolute; left: 24px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem; }
    .search-bar input {
      width: 100%; padding: 7px 10px 7px 28px; border: 1px solid #ddd; border-radius: 6px;
      font-size: 0.875rem; box-sizing: border-box;
    }
    .search-bar input:focus { outline: none; border-color: #9f7338; }

    .user-search-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; }
    .user-row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px; border-bottom: 1px solid #f0f4f8; cursor: pointer;
      transition: background 0.12s;
    }
    .user-row:last-child { border-bottom: none; }
    .user-row:hover:not(.enrolled) { background: #f8f1e4; }
    .user-row.enrolled { opacity: 0.5; cursor: default; }
    .user-name { flex: 1; font-size: 0.875rem; color: #374151; }
    .enrolled-tag { font-size: 0.75rem; font-weight: 700; color: #9f7338; display: flex; align-items: center; gap: 4px; }
    .add-tag { font-size: 0.75rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
    .user-row:hover:not(.enrolled) .add-tag { color: #9f7338; }

    .form-field { padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; }
    .form-field label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
    .form-field select {
      padding: 7px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.875rem; background: white; width: 100%;
    }
    .form-field select:focus { outline: none; border-color: #9f7338; }
    .btn-add-team {
      margin: 10px 14px 14px; padding: 9px; background: #9f7338; color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-add-team:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-add-team:hover:not(:disabled) { background: #245517; }

    .bracket-preview-bar {
      margin-top: 20px; padding: 12px 16px;
      background: #f8f1e4; border: 1px solid #e6d2ad; border-radius: 8px;
      font-size: 0.875rem; color: #374151; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .bracket-preview-bar i { color: #9f7338; }
    .bracket-preview-bar strong { color: #9f7338; }

    /* ── Bracket (match rows) ────────────────────────────────────── */
    .champion-banner {
      display: flex; align-items: center; gap: 16px; padding: 16px 20px;
      background: linear-gradient(135deg, #fffbeb, #fef3c7);
      border: 1px solid #fcd34d; border-radius: 10px; margin-bottom: 20px;
    }
    .champion-trophy { font-size: 2.2rem; }
    .champion-label { font-size: 0.7rem; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; }
    .champion-name { font-size: 1.1rem; font-weight: 800; color: #1a1a1a; margin-top: 2px; }
    .runner-up-block { margin-left: auto; text-align: right; }
    .runner-label { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .runner-name { font-size: 0.95rem; font-weight: 700; color: #374151; margin-top: 2px; }

    .drag-hint {
      font-size: 0.78rem; color: #94a3b8; margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    }
    .swap-loading {
      font-size: 0.82rem; color: #9f7338; font-weight: 600; margin-bottom: 12px;
      display: flex; align-items: center; gap: 8px;
      background: #f8f1e4; border: 1px solid #e6d2ad;
      padding: 8px 12px; border-radius: 8px;
    }
    .match-rows { display: flex; flex-direction: column; }
    .match-row {
      display: flex; align-items: center; gap: 14px; padding: 13px 4px;
      border-bottom: 1px solid #f1f5f9; transition: background 0.12s;
    }
    .match-row:last-child { border-bottom: none; }
    .match-row.row-completed { opacity: 0.85; }

    .slot-draggable { cursor: grab; }
    .slot-draggable:active { cursor: grabbing; }
    .slot-dragging { opacity: 0.35 !important; }
    .slot-drag-over {
      background: #f8f1e4; border-radius: 6px;
      outline: 2px dashed #9f7338; outline-offset: 2px;
      color: #9f7338 !important; font-weight: 700;
    }

    .row-round-chip {
      background: #dbeafe; color: #1e40af; padding: 3px 9px;
      border-radius: 12px; font-size: 0.72rem; font-weight: 700;
      white-space: nowrap; flex-shrink: 0;
    }
    .row-players {
      flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap;
    }
    .row-player {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.875rem; color: #374151;
    }
    .row-player.row-winner { font-weight: 700; color: #1a1a1a; }
    .row-player.row-loser  { opacity: 0.5; }
    .row-win-flag {
      background: #9f7338; color: white; font-size: 0.62rem; font-weight: 800;
      padding: 1px 5px; border-radius: 4px;
    }
    .row-vs { font-size: 0.78rem; color: #cbd5e1; font-weight: 600; flex-shrink: 0; }

    .btn-add-match {
      display: flex; align-items: center; gap: 7px; margin-top: 14px;
      padding: 8px 16px; background: none; border: 1.5px dashed #cbd5e1;
      border-radius: 8px; font-size: 0.82rem; font-weight: 600; color: #64748b;
      cursor: pointer; transition: all 0.15s; width: 100%; justify-content: center;
    }
    .btn-add-match:hover { border-color: #9f7338; color: #9f7338; background: #f8f1e4; }
    .btn-add-match i { font-size: 0.9rem; }

    /* ── Schedule cards ──────────────────────────────────────────── */
    .sched-empty { text-align: center; color: #94a3b8; padding: 40px 20px; }
    .sched-empty i { font-size: 2rem; display: block; margin-bottom: 8px; }
    .sched-empty p { margin: 0; font-size: 0.875rem; }
    .sched-list { display: flex; flex-direction: column; gap: 10px; }
    .sched-card {
      border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
      background: white; transition: box-shadow 0.15s;
    }
    .sched-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .sched-done { opacity: 0.8; }
    .sched-live { border-color: #fcd34d; background: #fffbeb; }
    .sched-top {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .sched-label {
      font-size: 0.78rem; font-weight: 700; color: #1e40af;
      background: #dbeafe; padding: 3px 10px; border-radius: 12px;
    }
    .sched-edit { margin-left: auto; }
    .sched-matchup {
      display: flex; align-items: center; gap: 0; padding: 14px 16px;
    }
    .sched-player {
      flex: 1; display: flex; align-items: center; gap: 8px;
      font-size: 0.9rem; font-weight: 600; color: #1a1a1a; min-width: 0;
    }
    .sched-player:last-child { justify-content: flex-end; text-align: right; }
    .sched-avatar { font-size: 1.3rem; color: #cbd5e1; flex-shrink: 0; }
    .sched-winner { color: #9f7338; font-weight: 700; }
    .sched-winner .sched-avatar { color: #9f7338; }
    .sched-loser { opacity: 0.45; }
    .sched-trophy { font-size: 1rem; flex-shrink: 0; }
    .sched-vs {
      flex-shrink: 0; width: 60px; text-align: center;
      font-size: 0.75rem; font-weight: 700; color: #94a3b8;
    }
    .sched-score {
      font-size: 0.85rem; font-weight: 800; color: #1a1a1a;
      background: #f1f5f9; padding: 2px 8px; border-radius: 6px;
    }
    .sched-meta {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; font-size: 0.78rem; color: #64748b;
      border-top: 1px solid #f1f5f9; background: #fafafa;
    }
    .sched-meta i { color: #94a3b8; }
    .sched-time { display: flex; align-items: center; gap: 4px; }
    .sched-unscheduled { color: #cbd5e1; font-style: italic; }
    .status-chip {
      padding: 3px 9px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize; white-space: nowrap;
    }
    .chip-upcoming  { background: #f1f5f9; color: #475569; }
    .chip-ongoing   { background: #fef3c7; color: #92400e; }
    .chip-completed { background: #f4ead6; color: #7a5626; }
    .btn-edit-row {
      padding: 5px 10px; border: 1.5px solid #e2e8f0; border-radius: 6px;
      background: white; color: #475569; font-size: 0.78rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.12s;
    }
    .btn-edit-row:hover { border-color: #9f7338; color: #9f7338; background: #f8f1e4; }
    .row-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .icon-btn {
      width: 30px; height: 30px; border-radius: 6px; border: none;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; cursor: pointer; transition: all 0.15s;
    }
    .icon-edit { background: #f0f9ff; color: #0369a1; }
    .icon-edit:hover { background: #0369a1; color: white; }
    .icon-delete { background: #fef2f2; color: #dc2626; }
    .icon-delete:hover { background: #dc2626; color: white; }
    .chip-editable { cursor: pointer; transition: background 0.12s; }
    .chip-editable:hover { background: #bfdbfe; }
    .chip-edit-icon { font-size: 0.6rem; opacity: 0.5; margin-left: 3px; }
    .round-name-input {
      padding: 2px 8px; border: 1.5px solid #9f7338; border-radius: 12px;
      font-size: 0.72rem; font-weight: 700; color: #1e40af; background: #dbeafe;
      width: 110px; outline: none; box-shadow: 0 0 0 2px rgba(159,115,56,0.15);
    }

    /* ── Info tab ────────────────────────────────────────────────── */
    .capitalize { text-transform: capitalize; }
    .info-visibility-card {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
      padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; border: 1.5px solid;
    }
    .vis-published { background: #f8f1e4; border-color: #e6d2ad; }
    .vis-inactive  { background: #fafafa; border-color: #e2e8f0; }
    .vis-left { display: flex; align-items: center; gap: 14px; }
    .vis-icon {
      width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;
    }
    .vis-published .vis-icon { background: #f4ead6; color: #7a5626; }
    .vis-inactive  .vis-icon { background: #f1f5f9; color: #94a3b8; }
    .vis-title { font-size: 0.95rem; font-weight: 700; color: #1a1a1a; }
    .vis-sub { font-size: 0.78rem; color: #64748b; margin-top: 2px; max-width: 340px; }
    .btn-vis {
      padding: 9px 18px; border: none; border-radius: 8px; font-size: 0.82rem; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.15s; flex-shrink: 0;
      background: #9f7338; color: white;
    }
    .btn-vis:hover:not(:disabled) { background: #245517; }
    .btn-vis:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-unpublish { background: #f1f5f9; color: #475569; border: 1.5px solid #e2e8f0; }
    .btn-unpublish:hover:not(:disabled) { background: #fef2f2; color: #dc2626; border-color: #fca5a5; }

    .info-stats-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;
    }
    .info-stat-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 16px; text-align: center;
    }
    .info-stat-num { font-size: 1.6rem; font-weight: 800; color: #1a1a1a; line-height: 1; }
    .info-stat-lbl { font-size: 0.72rem; font-weight: 600; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 5px; text-transform: uppercase; letter-spacing: 0.4px; }

    .info-details-grid {
      border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 20px;
    }
    .info-detail-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem;
    }
    .info-detail-row:last-child { border-bottom: none; }
    .info-detail-lbl { color: #64748b; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .info-detail-lbl i { color: #94a3b8; width: 14px; text-align: center; }
    .info-detail-val { font-weight: 700; color: #1a1a1a; }

    .results-section { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .results-title {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: #f8fafc; border-bottom: 1px solid #e2e8f0;
      font-size: 0.82rem; font-weight: 700; color: #374151;
    }
    .podium { display: flex; gap: 12px; padding: 16px; }
    .podium-card {
      flex: 1; padding: 16px; border-radius: 10px; text-align: center; display: flex; flex-direction: column; gap: 4px;
    }
    .podium-gold   { background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1px solid #fcd34d; }
    .podium-silver { background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; }
    .podium-medal { font-size: 1.8rem; }
    .podium-role { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .podium-name { font-size: 0.95rem; font-weight: 700; color: #1a1a1a; margin-top: 2px; }

    /* ── Modal ───────────────────────────────────────────────────── */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: white; border-radius: 14px; width: 100%; max-width: 500px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: slideUp 0.2s ease; overflow: hidden;
    }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #eee;
    }
    .modal-header h3 {
      margin: 0; font-size: 0.95rem; font-weight: 700; color: #1a1a1a;
      display: flex; align-items: center; gap: 8px;
    }
    .modal-header h3 i { color: #9f7338; }
    .modal-close {
      background: none; border: none; font-size: 1rem; color: #888;
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .modal-close:hover { background: #f0f0f0; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field label {
      font-size: 0.75rem; font-weight: 700; color: #444;
      text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 6px;
    }
    .field-hint { font-size: 0.72rem; font-weight: 400; color: #94a3b8; text-transform: none; letter-spacing: 0; }
    .modal-field input, .modal-field select {
      padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px;
      font-size: 0.9rem; background: white; width: 100%; box-sizing: border-box;
    }
    .modal-field input:focus, .modal-field select:focus {
      outline: none; border-color: #9f7338; box-shadow: 0 0 0 3px rgba(159,115,56,0.1);
    }
    .modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .winner-picker { display: flex; align-items: stretch; gap: 10px; }
    .winner-opt {
      flex: 1; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
    }
    .winner-opt:hover { border-color: #9f7338; background: #f8f1e4; }
    .winner-opt.winner-selected { border-color: #9f7338; background: #f8f1e4; }
    .winner-names { display: flex; flex-direction: column; gap: 2px; font-size: 0.875rem; font-weight: 600; color: #374151; }
    .winner-check { font-size: 0.75rem; font-weight: 700; color: #9f7338; display: flex; align-items: center; gap: 4px; }
    .winner-vs {
      display: flex; align-items: center; font-size: 0.78rem; font-weight: 700; color: #94a3b8; flex-shrink: 0;
    }
    .slot-tbd { color: #cbd5e1; font-style: italic; font-size: 0.8rem; }
    .score-input {
      width: 100%; box-sizing: border-box; padding: 5px 8px;
      border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.82rem;
      text-align: center; background: white; color: #1a1a1a;
      margin-top: 2px;
    }
    .score-input:focus { outline: none; border-color: #9f7338; box-shadow: 0 0 0 2px rgba(159,115,56,0.1); }
    .winner-selected .score-input { border-color: #e6d2ad; }

    .modal-sm { max-width: 380px; }
    .delete-header { gap: 12px; align-items: flex-start; }
    .delete-icon-wrap {
      width: 40px; height: 40px; border-radius: 10px; background: #fef2f2;
      display: flex; align-items: center; justify-content: center;
      color: #dc2626; font-size: 1rem; flex-shrink: 0;
    }
    .delete-header h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #1a1a1a; }
    .delete-sub { margin: 3px 0 0; font-size: 0.8rem; color: #64748b; font-weight: 400; }
    .btn-delete-confirm {
      padding: 9px 20px; background: #dc2626; color: white; border: none;
      border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-delete-confirm:hover { background: #b91c1c; }
    .btn-complete-confirm {
      padding: 9px 20px; background: #9f7338; color: white; border: none;
      border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-complete-confirm:hover { background: #245517; }

    .modal-error {
      background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5;
      border-radius: 8px; padding: 8px 12px; font-size: 0.82rem;
      display: flex; align-items: center; gap: 6px;
    }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 20px; border-top: 1px solid #eee; background: #f9fafb;
    }
    .btn-cancel {
      padding: 9px 16px; background: white; color: #555;
      border: 1px solid #ddd; border-radius: 8px; font-size: 0.875rem; cursor: pointer;
    }
    .btn-cancel:hover:not(:disabled) { background: #f0f0f0; }
    .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-confirm {
      padding: 9px 20px; background: #9f7338; color: white; border: none;
      border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .btn-confirm:hover:not(:disabled) { background: #245517; }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

    .no-winner-warn {
      display: flex; align-items: center; gap: 10px;
      background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px;
      padding: 10px 14px; font-size: 0.82rem; color: #92400e; margin-bottom: 16px;
    }
    .no-winner-warn i { flex-shrink: 0; }

    /* Tournament Rankings Tab */
    .rank-empty { text-align: center; padding: 48px 24px; }
    .rank-empty-icon { font-size: 2.5rem; color: #ccc; margin-bottom: 12px; }
    .rank-empty-title { font-size: 1rem; font-weight: 700; color: #444; margin: 0 0 6px; }
    .rank-empty-sub { font-size: 0.875rem; color: #888; margin: 0; }

    .rank-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .rank-table thead tr { background: #f8fafc; }
    .rank-table th {
      padding: 10px 12px; text-align: left; font-size: 0.72rem; font-weight: 700;
      color: #888; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #eee;
    }
    .rank-table td { padding: 11px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .rank-table tbody tr:hover td { background: #f8f1e4; }
    .rc-rank { width: 56px; text-align: center; }
    .rc-played, .rc-won, .rc-lost { width: 70px; text-align: center; color: #555; }
    .rc-pts { width: 90px; text-align: right; }
    .medal { font-size: 1.2rem; }
    .rank-num { font-weight: 700; color: #999; }
    .wins-val { font-weight: 700; color: #9f7338; }
    .player-cell { display: flex; align-items: center; gap: 9px; }
    .player-av {
      width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .av-init {
      background: #9f7338; color: white; font-size: 0.75rem;
      font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .player-nm { font-weight: 600; color: #1a1a1a; }
    .place-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 0.72rem; font-weight: 700;
    }
    .place-badge.place-champion { background: #fef3c7; color: #92400e; }
    .place-badge.place-runner-up { background: #f1f5f9; color: #475569; }
    .place-badge.place-semifinalist { background: #fce7f3; color: #9d174d; }
    .place-badge.place-quarterfinalist { background: #ede9fe; color: #5b21b6; }
    .place-badge.place-participant { background: #f8f1e4; color: #7a5626; }
    .pts-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fef3c7; color: #92400e; padding: 4px 10px;
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
export class AdminTournamentDetailComponent implements OnInit {
  tournament: Tournament | null = null;
  loading = true;
  actionError = '';
  activeTab: 'participants' | 'matches' | 'schedule' | 'info' | 'rankings' = 'participants';

  allUsers: User[] = [];
  playerSearch = '';
  filteredUsers: User[] = [];
  doublesP1 = '';
  doublesP2 = '';
  addingTeam = false;

  rounds: number[] = [];

  editingMatch: TournamentMatch | null = null;
  editScore1 = '';
  editScore2 = '';
  editWinner: number | null = null;
  editDate = '';
  editTimeSlot = '';
  editStatus = 'upcoming';
  savingMatch = false;
  matchError = '';

  generating = false;
  dragSource: { matchId: string; slot: 1 | 2 } | null = null;
  dragOverTarget: { matchId: string; slot: 1 | 2 } | null = null;
  swapping = false;

  editingMatchRoundId: string | null = null;
  editRoundNameValue = '';
  savingRoundName = false;

  confirmPrompt: {
    title: string;
    subtitle: string;
    icon: string;
    confirmLabel: string;
    confirmClass: 'btn-delete-confirm' | 'btn-complete-confirm';
    action: () => void;
  } | null = null;
  togglingPublish = false;
  generatingRandom = false;
  showAddMatch = false;
  newMatchLabel = '';
  newMatchSlot1 = '';
  newMatchSlot2 = '';
  newMatchDate = '';
  newMatchTime = '';
  addingMatch = false;
  addMatchError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tournamentService: TournamentService,
    private usersService: UsersService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => this.loadTournament(params['id']));
    this.usersService.getAllUsers().subscribe({
      next: (users: any[]) => {
        this.allUsers = users.filter((u: any) => u.status === 'active');
        this.filteredUsers = [...this.allUsers];
      },
      error: () => {}
    });
  }

  loadTournament(id: string) {
    this.loading = true;
    this.tournamentService.getById(id).subscribe({
      next: (t) => {
        this.tournament = t;
        this.loading = false;
        this.rounds = this.computeRounds(t);
        this.filterUsers();
      },
      error: () => { this.loading = false; }
    });
  }

  computeRounds(t: Tournament): number[] {
    if (!t.matches.length) return [];
    const max = Math.max(...t.matches.map(m => m.round));
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  get completedMatchCount(): number {
    return this.tournament?.matches.filter(m => m.status === 'completed').length ?? 0;
  }

  get entryCount(): number {
    if (!this.tournament) return 0;
    return this.tournament.type === 'singles'
      ? this.tournament.participants.length
      : (this.tournament.teams?.length || 0);
  }

  get totalRoundsPreview(): number {
    return this.entryCount >= 2 ? Math.ceil(Math.log2(this.entryCount)) : 0;
  }

  get bracketSizePreview(): number {
    return this.totalRoundsPreview > 0 ? Math.pow(2, this.totalRoundsPreview) : 0;
  }

  get availableUsers(): User[] {
    const enrolled = new Set(this.tournament?.participants.map(p => p._id) || []);
    return this.allUsers.filter(u => !enrolled.has(u._id));
  }

  get teamPickerUsers(): User[] {
    const inTeam = new Set((this.tournament?.teams || []).flat().map((p: any) => p?._id || p?.toString?.() || p));
    return this.allUsers.filter(u => !inTeam.has(u._id));
  }

  get teamsWithNames(): (TournamentPlayer | undefined)[][] {
    if (!this.tournament) return [];
    return (this.tournament.teams || []).map(team =>
      team.map(pid => this.tournament!.participants.find(p => p._id === pid))
    );
  }

  get sortedMatches(): TournamentMatch[] {
    return [...(this.tournament?.matches || [])]
      .filter(m => m.slot1Players.length > 0 || m.slot2Players.length > 0)
      .sort((a, b) => a.round - b.round || a.position - b.position);
  }

  goBack() { this.router.navigate(['/admin/tournaments']); }

  filterUsers() {
    const q = this.playerSearch.toLowerCase();
    this.filteredUsers = q
      ? this.allUsers.filter(u => u.name.toLowerCase().includes(q))
      : [...this.allUsers];
  }

  isEnrolled(userId: string): boolean {
    return this.tournament?.participants.some(p => p._id === userId) || false;
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  addParticipant(playerId: string) {
    if (!this.tournament) return;
    this.tournamentService.addParticipant(this.tournament._id, playerId).subscribe({
      next: (t) => { this.tournament = { ...this.tournament!, participants: t.participants }; },
      error: (err) => { this.actionError = err.error?.error || 'Failed to add player'; }
    });
  }

  removeParticipant(playerId: string) {
    if (!this.tournament) return;
    this.tournamentService.removeParticipant(this.tournament._id, playerId).subscribe({
      next: (t) => { this.tournament = { ...this.tournament!, participants: t.participants }; },
      error: (err) => { this.actionError = err.error?.error || 'Failed to remove player'; }
    });
  }

  addTeam() {
    if (!this.tournament || !this.doublesP1 || !this.doublesP2) return;
    this.addingTeam = true;
    this.tournamentService.addTeam(this.tournament._id, this.doublesP1, this.doublesP2).subscribe({
      next: (t) => {
        this.tournament = { ...this.tournament!, participants: t.participants, teams: t.teams };
        this.doublesP1 = '';
        this.doublesP2 = '';
        this.addingTeam = false;
      },
      error: (err) => {
        this.actionError = err.error?.error || 'Failed to add team';
        this.addingTeam = false;
      }
    });
  }

  removeTeam(idx: number) {
    if (!this.tournament) return;
    const id = this.tournament._id;
    this.tournamentService.removeTeam(id, idx).subscribe({
      next: () => this.loadTournament(id),
      error: (err) => { this.actionError = err.error?.error || 'Failed to remove team'; }
    });
  }

  generateBracket() {
    if (!this.tournament) return;
    this.generating = true;
    this.actionError = '';
    this.tournamentService.generateBracket(this.tournament._id).subscribe({
      next: (t) => {
        this.tournament = t;
        this.rounds = this.computeRounds(t);
        this.activeTab = 'matches';
        this.generating = false;
      },
      error: (err) => {
        this.generating = false;
        this.actionError = err.error?.error || 'Failed to generate bracket';
      }
    });
  }

  canComplete(): boolean {
    if (!this.tournament) return false;
    const matches = this.tournament.matches;
    if (!matches.length) return true;
    if (this.rounds.length > 0) {
      const final = matches.find(m => m.round === this.rounds.length && m.position === 0);
      return !!final && final.winner !== null;
    }
    const playable = matches.filter(m => m.slot1Players.length > 0 && m.slot2Players.length > 0);
    return playable.length > 0 && playable.every(m => m.winner !== null || m.status === 'completed');
  }

  completeTournament() {
    if (!this.tournament) return;
    const name = this.tournament.name;
    const id = this.tournament._id;
    this.confirmPrompt = {
      title: `Complete "${name}"?`,
      subtitle: 'This will lock the tournament. Scores and results can no longer be edited.',
      icon: 'flag-checkered',
      confirmLabel: 'Complete Tournament',
      confirmClass: 'btn-complete-confirm',
      action: () => {
        this.tournamentService.completeTournament(id).subscribe({
          next: (t) => { this.tournament = t; this.activeTab = 'info'; },
          error: (err) => { this.actionError = err.error?.error || 'Failed to complete tournament'; }
        });
      }
    };
  }

  confirmDelete() {
    if (!this.tournament) return;
    const name = this.tournament.name;
    const id = this.tournament._id;
    this.confirmPrompt = {
      title: `Delete "${name}"?`,
      subtitle: 'This tournament and all its data will be permanently removed.',
      icon: 'trash',
      confirmLabel: 'Delete',
      confirmClass: 'btn-delete-confirm',
      action: () => {
        this.tournamentService.delete(id).subscribe({
          next: () => this.router.navigate(['/admin/tournaments']),
          error: (err) => { this.actionError = err.error?.error || 'Failed to delete'; }
        });
      }
    };
  }

  togglePublished() {
    if (!this.tournament) return;
    this.togglingPublish = true;
    this.tournamentService.setPublished(this.tournament._id, !this.tournament.published).subscribe({
      next: (t) => { this.tournament = t; this.togglingPublish = false; },
      error: () => { this.togglingPublish = false; }
    });
  }

  cancelPrompt() { this.confirmPrompt = null; }

  executePrompt() {
    if (!this.confirmPrompt) return;
    const action = this.confirmPrompt.action;
    this.confirmPrompt = null;
    action();
  }

  getMatchesForRound(round: number): TournamentMatch[] {
    return (this.tournament?.matches || [])
      .filter(m => m.round === round)
      .sort((a, b) => a.position - b.position);
  }

  getRoundName(round: number): string {
    return this.tournament?.matches.find(m => m.round === round)?.roundName || `Round ${round}`;
  }

  slotLabel(players: TournamentPlayer[]): string {
    return players.length ? players.map(p => p.name).join(' & ') : 'TBD';
  }

  openMatchEditor(match: TournamentMatch) {
    if (this.tournament?.status !== 'active') return;
    this.editingMatch = match;
    const parts = (match.score || '').split(' - ');
    this.editScore1 = parts[0]?.trim() || '';
    this.editScore2 = parts[1]?.trim() || '';
    this.editWinner = match.winner ?? null;
    this.editDate = match.scheduledDate ? match.scheduledDate.split('T')[0] : '';
    this.editTimeSlot = match.timeSlot || '';
    this.editStatus = match.status;
    this.matchError = '';
  }

  closeMatchEditor() { this.editingMatch = null; this.matchError = ''; }

  saveMatch() {
    if (!this.tournament || !this.editingMatch) return;
    this.savingMatch = true;
    this.matchError = '';
    this.tournamentService.updateMatch(this.tournament._id, this.editingMatch._id, {
      score: [this.editScore1.trim(), this.editScore2.trim()].filter(Boolean).join(' - '),
      winner: this.editWinner,
      status: this.editStatus,
      scheduledDate: this.editDate || null,
      timeSlot: this.editTimeSlot,
    }).subscribe({
      next: (t) => {
        this.tournament = t;
        this.rounds = this.computeRounds(t);
        this.savingMatch = false;
        this.editingMatch = null;
      },
      error: (err) => {
        this.savingMatch = false;
        this.matchError = err.error?.error || 'Failed to save match';
      }
    });
  }

  canDrag(match: TournamentMatch): boolean {
    return this.tournament?.status === 'active' && match.status === 'upcoming';
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
    if (!this.dragSource || !this.tournament) return;
    const source = this.dragSource;
    const sameSlot = source.matchId === match._id && source.slot === slot;
    if (sameSlot || !this.canDrag(match)) return;
    this.dragSource = null;
    this.dragOverTarget = null;
    this.swapping = true;
    this.tournamentService.swapSlots(this.tournament._id, source.matchId, source.slot, match._id, slot).subscribe({
      next: (t) => { this.tournament = t; this.rounds = this.computeRounds(t); this.swapping = false; },
      error: (err) => { this.actionError = err.error?.error || 'Failed to swap'; this.swapping = false; }
    });
  }

  onDragEnd() {
    this.dragSource = null;
    this.dragOverTarget = null;
  }

  generateRandomMatches() {
    if (!this.tournament) return;
    this.generatingRandom = true;
    this.actionError = '';
    this.tournamentService.generateRandomMatches(this.tournament._id).subscribe({
      next: (t) => {
        this.tournament = t;
        this.rounds = this.computeRounds(t);
        this.generatingRandom = false;
        this.activeTab = 'matches';
      },
      error: (err) => {
        this.actionError = err.error?.error || 'Failed to generate matches';
        this.generatingRandom = false;
      }
    });
  }

  deleteMatch(matchId: string) {
    if (!this.tournament) return;
    const id = this.tournament._id;
    this.confirmPrompt = {
      title: 'Delete Match',
      subtitle: 'This match will be permanently removed.',
      icon: 'trash',
      confirmLabel: 'Delete',
      confirmClass: 'btn-delete-confirm',
      action: () => {
        this.tournamentService.deleteMatch(id, matchId).subscribe({
          next: (t) => { this.tournament = t; this.rounds = this.computeRounds(t); },
          error: (err) => { this.actionError = err.error?.error || 'Failed to delete match'; }
        });
      }
    };
  }

  openAddMatch() {
    this.showAddMatch = true;
    this.newMatchLabel = '';
    this.newMatchSlot1 = '';
    this.newMatchSlot2 = '';
    this.newMatchDate = '';
    this.newMatchTime = '';
    this.addMatchError = '';
  }

  closeAddMatch() { this.showAddMatch = false; this.addMatchError = ''; }

  saveAddMatch() {
    if (!this.tournament || !this.newMatchLabel.trim()) return;
    this.addingMatch = true;
    this.addMatchError = '';

    let slot1: string[] = [];
    let slot2: string[] = [];

    if (this.tournament.type === 'singles') {
      if (this.newMatchSlot1) slot1 = [this.newMatchSlot1];
      if (this.newMatchSlot2) slot2 = [this.newMatchSlot2];
    } else {
      const t1 = this.tournament.teams[+this.newMatchSlot1];
      const t2 = this.tournament.teams[+this.newMatchSlot2];
      if (t1) slot1 = t1.map((p: any) => typeof p === 'string' ? p : p._id || p);
      if (t2) slot2 = t2.map((p: any) => typeof p === 'string' ? p : p._id || p);
    }

    this.tournamentService.addMatch(this.tournament._id, {
      roundName: this.newMatchLabel.trim(),
      slot1Players: slot1,
      slot2Players: slot2,
      scheduledDate: this.newMatchDate || undefined,
      timeSlot: this.newMatchTime || undefined,
    }).subscribe({
      next: (t) => {
        this.tournament = t;
        this.rounds = this.computeRounds(t);
        this.addingMatch = false;
        this.showAddMatch = false;
      },
      error: (err) => {
        this.addMatchError = err.error?.error || 'Failed to add match';
        this.addingMatch = false;
      }
    });
  }

  startEditRoundName(matchId: string, currentName: string) {
    this.editingMatchRoundId = matchId;
    this.editRoundNameValue = currentName;
  }

  cancelRoundName() {
    this.editingMatchRoundId = null;
    this.editRoundNameValue = '';
  }

  saveRoundName() {
    if (!this.tournament || !this.editingMatchRoundId || this.savingRoundName) return;
    const name = this.editRoundNameValue.trim();
    if (!name) { this.cancelRoundName(); return; }
    this.savingRoundName = true;
    this.tournamentService.updateMatch(this.tournament._id, this.editingMatchRoundId, { roundName: name }).subscribe({
      next: (t) => {
        this.tournament = t;
        this.rounds = this.computeRounds(t);
        this.editingMatchRoundId = null;
        this.editRoundNameValue = '';
        this.savingRoundName = false;
      },
      error: (err) => {
        this.actionError = err.error?.error || 'Failed to rename';
        this.savingRoundName = false;
        this.editingMatchRoundId = null;
      }
    });
  }

  getPlacement(type: 'champion' | 'runnerUp'): string {
    if (!this.tournament || !this.rounds.length) return '—';
    const final = this.tournament.matches.find(m => m.round === this.rounds.length && m.position === 0);
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
    return (this.tournament?.matches || [])
      .some(m => m.status === 'completed' && this.inferWinner(m) == null);
  }

  get tournamentRankings(): PlayerStat[] {
    if (!this.tournament) return [];
    const t = this.tournament;
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
      'Champion':      'place-badge place-champion',
      'Runner-up':     'place-badge place-runner-up',
      'Semifinalist':  'place-badge place-semifinalist',
      'Quarterfinalist': 'place-badge place-quarterfinalist',
      'Participant':   'place-badge place-participant'
    };
    return classes[placement] ?? 'place-badge place-participant';
  }
}


