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
      background: var(--dm-bg);
    }
    .court-bg {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: none; z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: none; }
    .page-card {
      position: relative; z-index: 1; background: var(--dm-surface); border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.32); max-width: 1080px; margin: 0 auto; overflow: hidden;
      border: 1px solid rgba(163,230,53,0.12);
    }

    /* Header */
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap;
      background: var(--dm-header);
    }
    .back-btn {
      background: none; border: none; font-size: 15px;
      cursor: pointer; padding: 8px 12px; border-radius: 4px; color: rgba(255,255,255,0.72);
    }
    .back-btn:hover { background: rgba(255,255,255,0.08); }
    .header-center { flex: 1; }
    .card-header h2 { margin: 0; font-size: 22px; color: #ffffff; }
    .header-stats { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 14px; background: rgba(255,255,255,0.06); border-radius: 20px; min-width: 52px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .stat-pill-amber { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.2); }
    .stat-pill-green { background: rgba(163,230,53,0.12); border-color: rgba(163,230,53,0.2); }
    .stat-pill-purple { background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.2); }
    .stat-num { font-size: 1rem; font-weight: 700; color: #ffffff; line-height: 1.2; }
    .stat-pill-amber .stat-num { color: #fcd34d; }
    .stat-pill-green .stat-num { color: var(--dm-accent); }
    .stat-pill-purple .stat-num { color: #c4b5fd; }
    .stat-lbl { font-size: 0.65rem; color: rgba(255,255,255,0.62); text-transform: uppercase; letter-spacing: 0.4px; }

    /* Tabs */
    .tab-bar {
      display: flex; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 24px;
      gap: 2px; align-items: center; overflow-x: auto; background: rgba(255,255,255,0.02);
    }
    .tab-btn {
      background: none; border: none; padding: 14px 16px;
      font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.58); cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s;
      white-space: nowrap; display: flex; align-items: center; gap: 6px;
    }
    .tab-btn:hover { color: var(--dm-accent); }
    .tab-btn.active { color: var(--dm-accent); border-bottom-color: var(--dm-accent); }
    .tab-badge {
      background: rgba(163,230,53,0.16); color: var(--dm-accent); font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }
    .tab-btn-create {
      margin-left: auto; color: var(--dm-accent); border: 1.5px solid rgba(163,230,53,0.28);
      border-radius: 8px; padding: 7px 14px; margin-bottom: 6px;
    }
    .tab-btn-create:hover { background: rgba(163,230,53,0.14); color: var(--dm-accent); border-bottom-color: transparent; }

    /* Body */
    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 40px; color: rgba(255,255,255,0.62); font-size: 0.9rem; }

    /* Empty state */
    .empty-state { text-align: center; padding: 48px 24px; }
    .empty-icon { font-size: 2.5rem; color: rgba(255,255,255,0.3); margin-bottom: 12px; }
    .empty-title { font-size: 1rem; font-weight: 700; color: #ffffff; margin: 0 0 6px; }
    .empty-sub { font-size: 0.875rem; color: rgba(255,255,255,0.62); margin: 0 0 20px; }
    .btn-create-empty {
      padding: 10px 20px; background: rgba(163,230,53,0.16); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28); border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
    }
    .btn-create-empty:hover { background: rgba(163,230,53,0.24); }

    /* Tournament list */
    .tournament-list { display: flex; flex-direction: column; gap: 10px; }
    .tournament-card {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 18px; border: 1px solid rgba(163,230,53,0.12); border-radius: 10px;
      background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.15s;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    }
    .tournament-card:hover {
      border-color: rgba(163,230,53,0.28); background: rgba(163,230,53,0.08);
      box-shadow: 0 4px 16px rgba(163,230,53,0.12);
    }
    .tournament-icon-wrap {
      width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
    }
    .icon-draft { background: rgba(148,163,184,0.12); color: #cbd5e1; }
    .icon-active { background: rgba(163,230,53,0.14); color: var(--dm-accent); }
    .icon-completed { background: rgba(139,92,246,0.14); color: #c4b5fd; }

    .tournament-info { flex: 1; min-width: 0; }
    .tournament-name { font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-bottom: 5px; }
    .tournament-meta {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.78rem; color: rgba(255,255,255,0.62);
    }
    .meta-dot { color: rgba(255,255,255,0.4); }
    .meta-item { display: flex; align-items: center; gap: 4px; }
    .meta-progress { color: var(--dm-accent); font-weight: 600; }
    .meta-date { color: rgba(255,255,255,0.5); }
    .type-badge {
      padding: 2px 9px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .type-singles { background: rgba(59,130,246,0.16); color: #93c5fd; }
    .type-doubles { background: rgba(245,158,11,0.14); color: #fcd34d; }

    .champion-row {
      margin-top: 5px; font-size: 0.78rem; color: var(--dm-accent);
      display: flex; align-items: center; gap: 5px;
    }

    .tournament-right {
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0;
    }
    .status-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .status-draft { background: rgba(148,163,184,0.12); color: #cbd5e1; }
    .status-active { background: rgba(163,230,53,0.12); color: var(--dm-accent); }
    .status-completed { background: rgba(139,92,246,0.12); color: #c4b5fd; }

    .btn-manage {
      padding: 6px 12px; background: none; border: 1.5px solid rgba(163,230,53,0.2);
      border-radius: 6px; font-size: 0.78rem; font-weight: 600; color: rgba(163,230,53,0.72);
      cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s;
    }
    .tournament-card:hover .btn-manage { border-color: rgba(163,230,53,0.4); color: var(--dm-accent); }

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
      font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .modal-field input {
      padding: 9px 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
      font-size: 0.9rem; background: rgba(255,255,255,0.04); width: 100%; box-sizing: border-box; color: #ffffff;
    }
    .modal-field input::placeholder { color: rgba(255,255,255,0.4); }
    .modal-field input:focus { outline: none; border-color: rgba(163,230,53,0.28); box-shadow: 0 0 0 3px rgba(163,230,53,0.12); }
    .type-select { display: flex; gap: 10px; }
    .type-opt {
      flex: 1; padding: 10px; border: 1.5px solid rgba(255,255,255,0.08); border-radius: 8px;
      background: rgba(255,255,255,0.02); cursor: pointer; font-size: 0.875rem; font-weight: 600;
      color: rgba(255,255,255,0.72); transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 7px;
    }
    .type-opt:hover { border-color: rgba(163,230,53,0.28); color: var(--dm-accent); }
    .type-opt.active { border-color: rgba(163,230,53,0.28); background: rgba(163,230,53,0.12); color: var(--dm-accent); }
    .modal-error {
      background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2);
      border-radius: 8px; padding: 8px 12px; font-size: 0.82rem;
      display: flex; align-items: center; gap: 6px;
    }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);
    }
    .btn-cancel {
      padding: 9px 16px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.72);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 0.875rem; cursor: pointer;
    }
    .btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
    .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-confirm {
      padding: 9px 20px; background: rgba(163,230,53,0.16); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.28); border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px;
    }
    .btn-confirm:hover:not(:disabled) { background: rgba(163,230,53,0.24); }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Rankings */
    .rankings-wrap { display: flex; flex-direction: column; gap: 24px; }
    .rankings-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .rankings-table thead tr { background: rgba(255,255,255,0.04); }
    .rankings-table th {
      padding: 10px 14px; text-align: left; font-size: 0.72rem; font-weight: 700;
      color: rgba(255,255,255,0.62); text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .rankings-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; color: #ffffff; }
    .rankings-table tr.rank-top td { background: rgba(163,230,53,0.06); }
    .rankings-table tbody tr:hover td { background: rgba(163,230,53,0.08); }
    .col-rank { width: 60px; text-align: center; }
    .col-played { width: 110px; text-align: center; color: rgba(255,255,255,0.72); }
    .col-pts { width: 110px; text-align: right; }
    .medal { font-size: 1.3rem; }
    .rank-num { font-weight: 700; color: rgba(255,255,255,0.62); font-size: 0.9rem; }
    .player-cell { display: flex; align-items: center; gap: 10px; }
    .player-avatar {
      width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .avatar-initials {
      background: rgba(163,230,53,0.2); color: var(--dm-accent); font-size: 0.8rem;
      font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .player-name { font-weight: 600; color: #ffffff; }
    .pts-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(163,230,53,0.12); color: var(--dm-accent); padding: 4px 10px;
      border-radius: 20px; font-size: 0.8rem; font-weight: 700;
    }
    .pts-chip i { font-size: 0.65rem; }

    .pts-guide {
      background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px 20px;
    }
    .pts-guide-title {
      font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.72); margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    }
    .pts-guide-grid { display: flex; gap: 32px; flex-wrap: wrap; }
    .pts-guide-col { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 5px; }
    .pts-guide-type { font-size: 0.75rem; font-weight: 700; color: var(--dm-accent); margin-bottom: 4px; text-transform: uppercase; }
    .pts-guide-row {
      display: flex; justify-content: space-between; font-size: 0.8rem; color: rgba(255,255,255,0.72);
    }
    .pts-guide-row strong { color: #ffffff; }

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


