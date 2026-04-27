import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TournamentService, Tournament, RankingEntry } from '../../../core/services/tournament.service';

@Component({
  selector: 'app-admin-tournaments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
      <div class="page-card">

        <!-- Header -->
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <div class="header-center">
            <h2>Tournaments</h2>
          </div>
          <div class="header-stats">
            <div class="stat-pill">
              <span class="stat-num">{{ tournaments.length }}</span>
              <span class="stat-lbl">Total</span>
            </div>
            <div class="stat-pill stat-pill-amber">
              <span class="stat-num">{{ countByStatus('draft') }}</span>
              <span class="stat-lbl">Draft</span>
            </div>
            <div class="stat-pill stat-pill-green">
              <span class="stat-num">{{ countByStatus('active') }}</span>
              <span class="stat-lbl">Active</span>
            </div>
            <div class="stat-pill stat-pill-purple">
              <span class="stat-num">{{ countByStatus('completed') }}</span>
              <span class="stat-lbl">Done</span>
            </div>
          </div>
        </div>

        <!-- Tab Bar -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab === 'all'" (click)="activeTab = 'all'">
            <i class="fas fa-list"></i> All
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'active'" (click)="activeTab = 'active'">
            <i class="fas fa-play-circle"></i> Active
            @if (countByStatus('active') > 0) {
              <span class="tab-badge">{{ countByStatus('active') }}</span>
            }
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'draft'" (click)="activeTab = 'draft'">
            <i class="fas fa-pencil-alt"></i> Draft
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'completed'" (click)="activeTab = 'completed'">
            <i class="fas fa-trophy"></i> Completed
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'rankings'" (click)="switchToRankings()">
            <i class="fas fa-medal"></i> Rankings
          </button>
          <button class="tab-btn tab-btn-create" (click)="showCreate = true">
            <i class="fas fa-plus"></i> New Tournament
          </button>
        </div>

        <div class="card-body">

          <!-- ── RANKINGS TAB ──────────────────────────────────────── -->
          @if (activeTab === 'rankings') {
            @if (rankingsLoading) {
              <div class="loading"><i class="fas fa-circle-notch fa-spin"></i> Loading rankings...</div>
            } @else if (rankings.length === 0) {
              <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-medal"></i></div>
                <p class="empty-title">No rankings yet</p>
                <p class="empty-sub">Complete tournaments to see player standings here.</p>
              </div>
            } @else {
              <div class="rankings-wrap">
                <table class="rankings-table">
                  <thead>
                    <tr>
                      <th class="col-rank">Rank</th>
                      <th class="col-player">Player</th>
                      <th class="col-played">Tournaments</th>
                      <th class="col-pts">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of rankings; track r.playerId; let i = $index) {
                      <tr [class.rank-top]="i < 3">
                        <td class="col-rank">
                          @if (i === 0) { <span class="medal">🥇</span> }
                          @else if (i === 1) { <span class="medal">🥈</span> }
                          @else if (i === 2) { <span class="medal">🥉</span> }
                          @else { <span class="rank-num">{{ i + 1 }}</span> }
                        </td>
                        <td class="col-player">
                          <div class="player-cell">
                            @if (r.profileImage) {
                              <img class="player-avatar" [src]="r.profileImage" [alt]="r.name" />
                            } @else {
                              <div class="player-avatar avatar-initials">{{ r.name.charAt(0).toUpperCase() }}</div>
                            }
                            <span class="player-name">{{ r.name }}</span>
                          </div>
                        </td>
                        <td class="col-played">{{ r.tournamentsPlayed }}</td>
                        <td class="col-pts"><span class="pts-chip"><i class="fas fa-star"></i> {{ r.points }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>

                <div class="pts-guide">
                  <div class="pts-guide-title"><i class="fas fa-info-circle"></i> Points Guide</div>
                  <div class="pts-guide-grid">
                    <div class="pts-guide-col">
                      <div class="pts-guide-type">Singles</div>
                      <div class="pts-guide-row"><span>Champion</span><strong>100 pts</strong></div>
                      <div class="pts-guide-row"><span>Runner-up</span><strong>70 pts</strong></div>
                      <div class="pts-guide-row"><span>Semifinalist</span><strong>40 pts</strong></div>
                      <div class="pts-guide-row"><span>Quarterfinalist</span><strong>20 pts</strong></div>
                      <div class="pts-guide-row"><span>Participation</span><strong>10 pts</strong></div>
                    </div>
                    <div class="pts-guide-col">
                      <div class="pts-guide-type">Doubles</div>
                      <div class="pts-guide-row"><span>Champion</span><strong>80 pts</strong></div>
                      <div class="pts-guide-row"><span>Runner-up</span><strong>50 pts</strong></div>
                      <div class="pts-guide-row"><span>Semifinalist</span><strong>30 pts</strong></div>
                      <div class="pts-guide-row"><span>Quarterfinalist</span><strong>15 pts</strong></div>
                      <div class="pts-guide-row"><span>Participation</span><strong>5 pts</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            }

          <!-- ── TOURNAMENT LIST TABS ───────────────────────────────── -->
          } @else if (loading) {
            <div class="loading"><i class="fas fa-circle-notch fa-spin"></i> Loading tournaments...</div>
          } @else if (filtered.length === 0) {
            <div class="empty-state">
              <div class="empty-icon"><i class="fas fa-trophy"></i></div>
              <p class="empty-title">
                {{ activeTab === 'all' ? 'No tournaments yet' : 'No ' + activeTab + ' tournaments' }}
              </p>
              <p class="empty-sub">
                {{ activeTab === 'all' ? 'Create your first tournament to get started.' : 'Switch tabs or create a new tournament.' }}
              </p>
              @if (activeTab === 'all') {
                <button class="btn-create-empty" (click)="showCreate = true">
                  <i class="fas fa-plus"></i> Create Tournament
                </button>
              }
            </div>
          } @else {
            <div class="tournament-list">
              @for (t of filtered; track t._id) {
                <div class="tournament-card" (click)="openTournament(t._id)">
                  <div class="tournament-icon-wrap" [class]="'icon-' + t.status">
                    <i class="fas fa-trophy"></i>
                  </div>
                  <div class="tournament-info">
                    <div class="tournament-name">{{ t.name }}</div>
                    <div class="tournament-meta">
                      <span class="type-badge" [class]="'type-' + t.type">{{ t.type }}</span>
                      <span class="meta-dot">·</span>
                      <span class="meta-item"><i class="fas fa-users"></i> {{ t.participants.length }} player{{ t.participants.length !== 1 ? 's' : '' }}</span>
                      @if (t.status === 'active' && t.matches.length > 0) {
                        <span class="meta-dot">·</span>
                        <span class="meta-item meta-progress">
                          <i class="fas fa-sitemap"></i>
                          {{ completedMatches(t) }}/{{ t.matches.length }} matches
                        </span>
                      }
                      <span class="meta-dot">·</span>
                      <span class="meta-item meta-date"><i class="fas fa-calendar-alt"></i> {{ t.createdAt | date: 'MMM d, yyyy' }}</span>
                    </div>
                    @if (t.status === 'completed') {
                      <div class="champion-row">
                        <i class="fas fa-medal"></i> Champion: <strong>{{ getChampion(t) }}</strong>
                      </div>
                    }
                  </div>
                  <div class="tournament-right">
                    <span class="status-badge" [class]="'status-' + t.status">{{ t.status }}</span>
                    <button class="btn-manage" (click)="$event.stopPropagation(); openTournament(t._id)">
                      Manage <i class="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Create Tournament Modal -->
    @if (showCreate) {
      <div class="modal-backdrop" (click)="cancelCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="fas fa-trophy"></i> New Tournament</h3>
            <button class="modal-close" (click)="cancelCreate()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="modal-field">
              <label>Tournament Name</label>
              <input
                type="text"
                [(ngModel)]="newName"
                placeholder="e.g. Spring 2026 Open"
                (keyup.enter)="createTournament()"
                autofocus
              />
            </div>
            <div class="modal-field">
              <label>Type</label>
              <div class="type-select">
                <button class="type-opt" [class.active]="newType === 'singles'" (click)="newType = 'singles'">
                  <i class="fas fa-user"></i> Singles
                </button>
                <button class="type-opt" [class.active]="newType === 'doubles'" (click)="newType = 'doubles'">
                  <i class="fas fa-user-friends"></i> Doubles
                </button>
              </div>
            </div>
            @if (createError) {
              <div class="modal-error"><i class="fas fa-exclamation-circle"></i> {{ createError }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="cancelCreate()" [disabled]="creating">Cancel</button>
            <button class="btn-confirm" (click)="createTournament()" [disabled]="creating || !newName.trim()">
              @if (creating) { <i class="fas fa-circle-notch fa-spin"></i> Creating... }
              @else { <i class="fas fa-plus"></i> Create Tournament }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
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

    /* Header */
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; border-bottom: 1px solid #eee; flex-wrap: wrap;
    }
    .back-btn {
      background: none; border: none; font-size: 15px;
      cursor: pointer; padding: 8px 12px; border-radius: 4px; color: #555;
    }
    .back-btn:hover { background: #f0f0f0; }
    .header-center { flex: 1; }
    .card-header h2 { margin: 0; font-size: 22px; color: #333; }
    .header-stats { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 14px; background: #f1f5f9; border-radius: 20px; min-width: 52px;
    }
    .stat-pill-amber { background: #fef3c7; }
    .stat-pill-green { background: #f4ead6; }
    .stat-pill-purple { background: #ede9fe; }
    .stat-num { font-size: 1rem; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
    .stat-pill-amber .stat-num { color: #92400e; }
    .stat-pill-green .stat-num { color: #7a5626; }
    .stat-pill-purple .stat-num { color: #5b21b6; }
    .stat-lbl { font-size: 0.65rem; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }

    /* Tabs */
    .tab-bar {
      display: flex; border-bottom: 2px solid #e9ecef; padding: 0 24px;
      gap: 2px; align-items: center; overflow-x: auto;
    }
    .tab-btn {
      background: none; border: none; padding: 14px 16px;
      font-size: 0.875rem; font-weight: 600; color: #888; cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s;
      white-space: nowrap; display: flex; align-items: center; gap: 6px;
    }
    .tab-btn:hover { color: #9f7338; }
    .tab-btn.active { color: #9f7338; border-bottom-color: #9f7338; }
    .tab-badge {
      background: #9f7338; color: white; font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }
    .tab-btn-create {
      margin-left: auto; color: #9f7338; border: 1.5px solid #9f7338;
      border-radius: 8px; padding: 7px 14px; margin-bottom: 6px;
    }
    .tab-btn-create:hover { background: #9f7338; color: white; border-bottom-color: transparent; }

    /* Body */
    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 40px; color: #999; font-size: 0.9rem; }

    /* Empty state */
    .empty-state { text-align: center; padding: 48px 24px; }
    .empty-icon { font-size: 2.5rem; color: #ccc; margin-bottom: 12px; }
    .empty-title { font-size: 1rem; font-weight: 700; color: #444; margin: 0 0 6px; }
    .empty-sub { font-size: 0.875rem; color: #888; margin: 0 0 20px; }
    .btn-create-empty {
      padding: 10px 20px; background: #9f7338; color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
    }
    .btn-create-empty:hover { background: #245517; }

    /* Tournament list */
    .tournament-list { display: flex; flex-direction: column; gap: 10px; }
    .tournament-card {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 18px; border: 1px solid #eee; border-radius: 10px;
      background: white; cursor: pointer; transition: all 0.15s;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .tournament-card:hover {
      border-color: #9f7338; background: #f8f1e4;
      box-shadow: 0 4px 16px rgba(159,115,56,0.1);
    }
    .tournament-icon-wrap {
      width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
    }
    .icon-draft { background: #f1f5f9; color: #64748b; }
    .icon-active { background: #f4ead6; color: #9f7338; }
    .icon-completed { background: #ede9fe; color: #7c3aed; }

    .tournament-info { flex: 1; min-width: 0; }
    .tournament-name { font-size: 0.95rem; font-weight: 700; color: #1a1a1a; margin-bottom: 5px; }
    .tournament-meta {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.78rem; color: #888;
    }
    .meta-dot { color: #ccc; }
    .meta-item { display: flex; align-items: center; gap: 4px; }
    .meta-progress { color: #9f7338; font-weight: 600; }
    .meta-date { color: #aaa; }
    .type-badge {
      padding: 2px 9px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .type-singles { background: #dbeafe; color: #1e40af; }
    .type-doubles { background: #fef3c7; color: #92400e; }

    .champion-row {
      margin-top: 5px; font-size: 0.78rem; color: #7c3aed;
      display: flex; align-items: center; gap: 5px;
    }

    .tournament-right {
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0;
    }
    .status-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .status-draft { background: #f1f5f9; color: #475569; }
    .status-active { background: #f4ead6; color: #7a5626; }
    .status-completed { background: #ede9fe; color: #5b21b6; }

    .btn-manage {
      padding: 6px 12px; background: none; border: 1.5px solid #e2e8f0;
      border-radius: 6px; font-size: 0.78rem; font-weight: 600; color: #475569;
      cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s;
    }
    .tournament-card:hover .btn-manage { border-color: #9f7338; color: #9f7338; }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: white; border-radius: 14px; width: 100%; max-width: 440px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: slideUp 0.2s ease; overflow: hidden;
    }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #eee;
    }
    .modal-header h3 {
      margin: 0; font-size: 1rem; font-weight: 700; color: #1a1a1a;
      display: flex; align-items: center; gap: 8px;
    }
    .modal-header h3 i { color: #9f7338; }
    .modal-close {
      background: none; border: none; font-size: 1rem; color: #888;
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .modal-close:hover { background: #f0f0f0; color: #333; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 18px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field label {
      font-size: 0.8rem; font-weight: 700; color: #444;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .modal-field input {
      padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px;
      font-size: 0.9rem; background: white; width: 100%; box-sizing: border-box;
    }
    .modal-field input:focus { outline: none; border-color: #9f7338; box-shadow: 0 0 0 3px rgba(159,115,56,0.1); }
    .type-select { display: flex; gap: 10px; }
    .type-opt {
      flex: 1; padding: 10px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      background: white; cursor: pointer; font-size: 0.875rem; font-weight: 600;
      color: #555; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 7px;
    }
    .type-opt:hover { border-color: #9f7338; color: #9f7338; }
    .type-opt.active { border-color: #9f7338; background: #9f7338; color: white; }
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
      padding: 9px 20px; background: #9f7338; color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px;
    }
    .btn-confirm:hover:not(:disabled) { background: #245517; }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Rankings */
    .rankings-wrap { display: flex; flex-direction: column; gap: 24px; }
    .rankings-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .rankings-table thead tr { background: #f8fafc; }
    .rankings-table th {
      padding: 10px 14px; text-align: left; font-size: 0.72rem; font-weight: 700;
      color: #888; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #eee;
    }
    .rankings-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .rankings-table tr.rank-top td { background: #fffbeb; }
    .rankings-table tbody tr:hover td { background: #f8f1e4; }
    .col-rank { width: 60px; text-align: center; }
    .col-played { width: 110px; text-align: center; color: #666; }
    .col-pts { width: 110px; text-align: right; }
    .medal { font-size: 1.3rem; }
    .rank-num { font-weight: 700; color: #888; font-size: 0.9rem; }
    .player-cell { display: flex; align-items: center; gap: 10px; }
    .player-avatar {
      width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .avatar-initials {
      background: #9f7338; color: white; font-size: 0.8rem;
      font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .player-name { font-weight: 600; color: #1a1a1a; }
    .pts-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fef3c7; color: #92400e; padding: 4px 10px;
      border-radius: 20px; font-size: 0.8rem; font-weight: 700;
    }
    .pts-chip i { font-size: 0.65rem; }

    .pts-guide {
      background: #f8fafc; border: 1px solid #e9ecef; border-radius: 10px; padding: 16px 20px;
    }
    .pts-guide-title {
      font-size: 0.8rem; font-weight: 700; color: #555; margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    }
    .pts-guide-grid { display: flex; gap: 32px; flex-wrap: wrap; }
    .pts-guide-col { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 5px; }
    .pts-guide-type { font-size: 0.75rem; font-weight: 700; color: #9f7338; margin-bottom: 4px; text-transform: uppercase; }
    .pts-guide-row {
      display: flex; justify-content: space-between; font-size: 0.8rem; color: #555;
    }
    .pts-guide-row strong { color: #1a1a1a; }

    @media (max-width: 640px) {
      .card-header { flex-direction: column; align-items: flex-start; }
      .header-stats { width: 100%; }
      .tournament-card { flex-wrap: wrap; }
      .tournament-right { flex-direction: row; align-items: center; width: 100%; justify-content: space-between; }
      .pts-guide-grid { flex-direction: column; gap: 16px; }
    }
  `]
})
export class AdminTournamentsComponent implements OnInit {
  tournaments: Tournament[] = [];
  loading = true;
  activeTab: 'all' | 'active' | 'draft' | 'completed' | 'rankings' = 'all';

  rankings: RankingEntry[] = [];
  rankingsLoading = false;

  showCreate = false;
  newName = '';
  newType: 'singles' | 'doubles' = 'singles';
  creating = false;
  createError = '';

  constructor(private tournamentService: TournamentService, private router: Router) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.tournamentService.getAll().subscribe({
      next: (data) => { this.tournaments = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  switchToRankings() {
    this.activeTab = 'rankings';
    this.rankingsLoading = true;
    this.tournamentService.getRankings().subscribe({
      next: (data) => { this.rankings = data; this.rankingsLoading = false; },
      error: () => { this.rankingsLoading = false; }
    });
  }

  get filtered(): Tournament[] {
    if (this.activeTab === 'all' || this.activeTab === 'rankings') return this.tournaments;
    return this.tournaments.filter(t => t.status === this.activeTab);
  }

  countByStatus(status: string): number {
    return this.tournaments.filter(t => t.status === status).length;
  }

  completedMatches(t: Tournament): number {
    return t.matches.filter(m => m.status === 'completed').length;
  }

  getChampion(t: Tournament): string {
    const max = t.matches.length ? Math.max(...t.matches.map(m => m.round)) : 0;
    const final = t.matches.find(m => m.round === max && m.position === 0);
    if (!final || !final.winner) return '—';
    return (final.winner === 1 ? final.slot1Players : final.slot2Players).map(p => p.name).join(' & ') || '—';
  }

  openTournament(id: string) {
    this.router.navigate(['/admin/tournaments', id]);
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }

  cancelCreate() {
    this.showCreate = false;
    this.newName = '';
    this.newType = 'singles';
    this.createError = '';
  }

  createTournament() {
    if (!this.newName.trim()) return;
    this.creating = true;
    this.createError = '';
    this.tournamentService.create({ name: this.newName.trim(), type: this.newType }).subscribe({
      next: (t) => {
        this.creating = false;
        this.showCreate = false;
        this.newName = '';
        this.newType = 'singles';
        this.router.navigate(['/admin/tournaments', t._id]);
      },
      error: (err) => {
        this.creating = false;
        this.createError = err.error?.error || 'Failed to create tournament';
      }
    });
  }
}


