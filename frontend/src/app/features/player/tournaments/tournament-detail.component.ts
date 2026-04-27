import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentService, Tournament, TournamentMatch, TournamentPlayer } from '../../../core/services/tournament.service';
import { CoinsService } from '../../../core/services/coins.service';

@Component({
  selector: 'app-player-tournament-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>

      @if (loading) {
        <div class="page-card loading-card">
          <i class="fas fa-circle-notch fa-spin"></i> Loading tournament…
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
              <div class="stat-pill">
                <span class="stat-num">{{ visibleMatches.length }}</span>
                <span class="stat-lbl">Matches</span>
              </div>
              @if (tournament.status !== 'draft') {
                <div class="stat-pill stat-pill-green">
                  <span class="stat-num">{{ completedCount }}</span>
                  <span class="stat-lbl">Done</span>
                </div>
              }
            </div>
          </div>

          <!-- Champion banner -->
          @if (tournament.status === 'completed') {
            <div class="champion-banner">
              <div class="champion-trophy">🏆</div>
              <div>
                <div class="champion-label">Tournament Champion</div>
                <div class="champion-name">{{ getChampion() }}</div>
              </div>
              <div class="runner-block">
                <div class="runner-label">Runner-up</div>
                <div class="runner-name">{{ getRunnerUp() }}</div>
              </div>
            </div>
          }

          <!-- Tab bar -->
          <div class="tab-bar">
            <button class="tab-btn" [class.active]="activeTab === 'matches'" (click)="activeTab = 'matches'">
              <i class="fas fa-table-tennis"></i> Matches
            </button>
            <button class="tab-btn" [class.active]="activeTab === 'players'" (click)="activeTab = 'players'">
              <i class="fas fa-users"></i> Players
              <span class="tab-badge">{{ tournament.participants.length }}</span>
            </button>
          </div>

          <div class="card-body">

            <!-- ── MATCHES TAB ── -->
            @if (activeTab === 'matches') {
              @if (visibleMatches.length === 0) {
                <div class="empty-state">
                  <i class="fas fa-table-tennis"></i>
                  <p>No matches available yet.</p>
                </div>
              } @else {
                <div class="match-list">
                  @for (match of visibleMatches; track match._id) {
                    <div class="match-card" [class.card-completed]="match.status === 'completed'" [class.card-ongoing]="match.status === 'ongoing'">

                      <!-- Top: label + status -->
                      <div class="match-card-top">
                        <span class="round-chip">{{ match.roundName }}</span>
                        <span class="status-chip chip-{{ match.status }}">{{ match.status }}</span>
                        @if (match.scheduledDate) {
                          <span class="match-date"><i class="fas fa-calendar"></i> {{ match.scheduledDate | date: 'MMM d' : 'UTC' }}@if (match.timeSlot) { · {{ match.timeSlot }} }</span>
                        }
                      </div>

                      <!-- Players -->
                      <div class="match-players">
                        <div class="match-player" [class.player-winner]="match.winner === 1" [class.player-loser]="match.winner === 2">
                          <i class="fas fa-user-circle player-icon"></i>
                          <span class="player-name">{{ slotLabel(match.slot1Players) }}</span>
                          @if (match.winner === 1) { <span class="win-tag">🏆</span> }
                        </div>

                        <div class="match-divider">
                          @if (match.score) { <span class="score-badge">{{ match.score }}</span> }
                          @else { <span class="vs-text">vs</span> }
                        </div>

                        <div class="match-player" [class.player-winner]="match.winner === 2" [class.player-loser]="match.winner === 1">
                          <i class="fas fa-user-circle player-icon"></i>
                          <span class="player-name">{{ slotLabel(match.slot2Players) }}</span>
                          @if (match.winner === 2) { <span class="win-tag">🏆</span> }
                        </div>
                      </div>

                    </div>
                  }
                </div>
              }
            }

            <!-- ── PLAYERS TAB ── -->
            @if (activeTab === 'players') {
              <div class="players-list">
                @for (p of tournament.participants; track p._id) {
                  <div class="player-row">
                    <div class="p-avatar">
                      @if (p.profileImage) {
                        <img [src]="p.profileImage" [alt]="p.name" />
                      } @else {
                        {{ initials(p.name) }}
                      }
                    </div>
                    <span class="p-name">{{ p.name }}</span>
                    @if (isChampion(p._id)) {
                      <span class="p-badge badge-champion">🥇 Champion</span>
                    } @else if (isRunnerUp(p._id)) {
                      <span class="p-badge badge-runner">🥈 Runner-up</span>
                    }
                  </div>
                }
              </div>
            }

          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Layout ── */
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
      box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; overflow: hidden;
    }
    .loading-card { padding: 40px; text-align: center; color: #94a3b8; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; }

    /* ── Header ── */
    .card-header {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 20px 24px; border-bottom: 1px solid #eee;
    }
    .back-btn {
      background: none; border: none; font-size: 15px; cursor: pointer;
      padding: 8px 12px; border-radius: 4px; color: #555; white-space: nowrap;
    }
    .back-btn:hover { background: #f0f0f0; }
    .header-center { flex: 1; min-width: 0; }
    .header-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .header-title-row h2 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #1a1a1a; }
    .type-badge, .status-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .type-singles { background: #dbeafe; color: #1e40af; }
    .type-doubles { background: #fef3c7; color: #92400e; }
    .status-draft     { background: #f1f5f9; color: #475569; }
    .status-active    { background: #f4ead6; color: #7a5626; }
    .status-completed { background: #ede9fe; color: #5b21b6; }
    .header-stats { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 14px; background: #f1f5f9; border-radius: 20px; min-width: 48px;
    }
    .stat-pill-green { background: #f4ead6; }
    .stat-num { font-size: 1rem; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
    .stat-pill-green .stat-num { color: #7a5626; }
    .stat-lbl { font-size: 0.65rem; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }

    /* ── Champion banner ── */
    .champion-banner {
      display: flex; align-items: center; gap: 16px; padding: 16px 24px;
      background: linear-gradient(135deg, #fffbeb, #fef3c7);
      border-bottom: 1px solid #fcd34d;
    }
    .champion-trophy { font-size: 2rem; flex-shrink: 0; }
    .champion-label { font-size: 0.68rem; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; }
    .champion-name { font-size: 1.05rem; font-weight: 800; color: #1a1a1a; margin-top: 2px; }
    .runner-block { margin-left: auto; text-align: right; }
    .runner-label { font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .runner-name { font-size: 0.9rem; font-weight: 700; color: #374151; margin-top: 2px; }

    /* ── Tab bar ── */
    .tab-bar {
      display: flex; border-bottom: 2px solid #e9ecef; padding: 0 24px; gap: 2px;
    }
    .tab-btn {
      background: none; border: none; padding: 14px 16px;
      font-size: 0.875rem; font-weight: 600; color: #888; cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px;
      transition: all 0.15s; display: flex; align-items: center; gap: 7px;
    }
    .tab-btn:hover { color: #9f7338; }
    .tab-btn.active { color: #9f7338; border-bottom-color: #9f7338; }
    .tab-badge {
      background: #f4ead6; color: #7a5626; font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }

    /* ── Body ── */
    .card-body { padding: 20px 24px; }
    .empty-state { text-align: center; padding: 40px 20px; color: #94a3b8; }
    .empty-state i { font-size: 2rem; display: block; margin-bottom: 10px; }
    .empty-state p { margin: 0; font-size: 0.875rem; }

    /* ── Match cards ── */
    .match-list { display: flex; flex-direction: column; gap: 10px; }
    .match-card {
      border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
      transition: box-shadow 0.15s;
    }
    .match-card:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
    .card-completed { opacity: 0.85; }
    .card-ongoing { border-color: #fcd34d; }

    .match-card-top {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 9px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .round-chip {
      background: #dbeafe; color: #1e40af; padding: 3px 9px;
      border-radius: 12px; font-size: 0.72rem; font-weight: 700;
    }
    .status-chip {
      padding: 3px 9px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; text-transform: capitalize;
    }
    .chip-upcoming  { background: #f1f5f9; color: #475569; }
    .chip-ongoing   { background: #fef3c7; color: #92400e; }
    .chip-completed { background: #f4ead6; color: #7a5626; }
    .match-date { font-size: 0.75rem; color: #64748b; margin-left: auto; display: flex; align-items: center; gap: 5px; }
    .match-date i { color: #94a3b8; }

    .match-players {
      display: flex; align-items: center; padding: 14px 16px; gap: 0;
    }
    .match-player {
      flex: 1; display: flex; align-items: center; gap: 8px;
      font-size: 0.9rem; color: #1a1a1a; min-width: 0;
    }
    .match-player:last-child { justify-content: flex-end; text-align: right; flex-direction: row-reverse; }
    .player-icon { font-size: 1.3rem; color: #cbd5e1; flex-shrink: 0; }
    .player-name { font-weight: 600; color: #1a1a1a; }
    .player-winner .player-name { color: #9f7338; font-weight: 700; }
    .player-winner .player-icon { color: #9f7338; }
    .player-loser { opacity: 0.4; }
    .win-tag { font-size: 1rem; flex-shrink: 0; }

    .match-divider {
      flex-shrink: 0; width: 64px; text-align: center;
    }
    .vs-text { font-size: 0.75rem; font-weight: 700; color: #cbd5e1; }
    .score-badge {
      font-size: 0.82rem; font-weight: 800; color: #1a1a1a;
      background: #f1f5f9; padding: 3px 8px; border-radius: 6px;
    }

    /* ── Players list ── */
    .players-list { display: flex; flex-direction: column; }
    .player-row {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 4px; border-bottom: 1px solid #f1f5f9;
    }
    .player-row:last-child { border-bottom: none; }
    .p-avatar {
      width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      background: linear-gradient(135deg, #9f7338, #c9a15d);
      color: white; font-size: 0.7rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .p-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .p-name { flex: 1; font-size: 0.9rem; font-weight: 600; color: #1a1a1a; }
    .p-badge {
      padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700;
    }
    .badge-champion { background: #fef3c7; color: #92400e; }
    .badge-runner   { background: #f1f5f9; color: #475569; }

    @media (max-width: 600px) {
      .card-header { flex-direction: column; align-items: flex-start; }
      .match-players { flex-wrap: wrap; gap: 8px; }
      .match-divider { width: 100%; text-align: left; padding-left: 8px; }
    }
  `]
})
export class PlayerTournamentDetailComponent implements OnInit {
  tournament: Tournament | null = null;
  loading = true;
  activeTab: 'matches' | 'players' = 'matches';
  rounds: number[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tournamentService: TournamentService,
    private coinsService: CoinsService,
  ) {}

  ngOnInit() {
    this.coinsService.trackVisit('tournament-detail').subscribe({ error: () => {} });
    this.route.params.subscribe(params => {
      this.tournamentService.getById(params['id']).subscribe({
        next: (t) => {
          this.tournament = t;
          this.loading = false;
          if (t.matches.length) {
            const max = Math.max(...t.matches.map(m => m.round));
            this.rounds = Array.from({ length: max }, (_, i) => i + 1);
          }
        },
        error: () => { this.loading = false; }
      });
    });
  }

  goBack() { this.router.navigate(['/player/tournaments']); }

  get visibleMatches(): TournamentMatch[] {
    return [...(this.tournament?.matches || [])]
      .filter(m => m.slot1Players.length > 0 || m.slot2Players.length > 0)
      .sort((a, b) => a.round - b.round || a.position - b.position);
  }

  get completedCount(): number {
    return this.tournament?.matches.filter(m => m.status === 'completed').length ?? 0;
  }

  slotLabel(players: TournamentPlayer[]): string {
    return players.length ? players.map(p => p.name).join(' & ') : 'TBD';
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getChampion(): string {
    if (!this.tournament || !this.rounds.length) return '—';
    const final = this.tournament.matches.find(m => m.round === this.rounds[this.rounds.length - 1] && m.position === 0);
    if (!final || !final.winner) return '—';
    return (final.winner === 1 ? final.slot1Players : final.slot2Players).map(p => p.name).join(' & ') || '—';
  }

  getRunnerUp(): string {
    if (!this.tournament || !this.rounds.length) return '—';
    const final = this.tournament.matches.find(m => m.round === this.rounds[this.rounds.length - 1] && m.position === 0);
    if (!final || !final.winner) return '—';
    return (final.winner === 1 ? final.slot2Players : final.slot1Players).map(p => p.name).join(' & ') || '—';
  }

  isChampion(pid: string): boolean {
    if (!this.tournament || this.tournament.status !== 'completed' || !this.rounds.length) return false;
    const final = this.tournament.matches.find(m => m.round === this.rounds[this.rounds.length - 1] && m.position === 0);
    if (!final || !final.winner) return false;
    return (final.winner === 1 ? final.slot1Players : final.slot2Players).some(p => p._id === pid);
  }

  isRunnerUp(pid: string): boolean {
    if (!this.tournament || this.tournament.status !== 'completed' || !this.rounds.length) return false;
    const final = this.tournament.matches.find(m => m.round === this.rounds[this.rounds.length - 1] && m.position === 0);
    if (!final || !final.winner) return false;
    return (final.winner === 1 ? final.slot2Players : final.slot1Players).some(p => p._id === pid);
  }
}


