import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TournamentService, Tournament, RankingEntry } from '../../../core/services/tournament.service';
import { CoinsService } from '../../../core/services/coins.service';

@Component({
  selector: 'app-player-tournaments',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>

      <div class="page-card">

        <!-- Header -->
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <div class="header-center">
            <h2><i class="fas fa-trophy"></i> Tournaments</h2>
          </div>
          <div class="header-pills">
            <div class="stat-pill">
              <span class="pill-num">{{ tournaments.length }}</span>
              <span class="pill-lbl">Active</span>
            </div>
            <div class="stat-pill stat-pill-purple">
              <span class="pill-num">{{ completedCount }}</span>
              <span class="pill-lbl">Done</span>
            </div>
          </div>
        </div>

        <!-- Tab bar -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab === 'tournaments'" (click)="activeTab = 'tournaments'">
            <i class="fas fa-sitemap"></i> Tournaments
            @if (tournaments.length) { <span class="tab-badge">{{ tournaments.length }}</span> }
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'rankings'" (click)="loadRankings()">
            <i class="fas fa-medal"></i> Rankings
          </button>
        </div>

        <div class="card-body">

          <!-- ── TOURNAMENTS TAB ── -->
          @if (activeTab === 'tournaments') {
            @if (loading) {
              <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading tournaments…</div>
            } @else if (tournaments.length === 0) {
              <div class="empty-state">
                <div class="empty-icon">🏆</div>
                <h3>No tournaments yet</h3>
                <p>Check back soon for upcoming tournaments.</p>
              </div>
            } @else {
              <div class="tournament-list">
                @for (t of tournaments; track t._id) {
                  <div class="t-card" (click)="openTournament(t._id)">
                    <div class="t-card-left">
                      <div class="t-trophy-icon status-{{ t.status }}">
                        <i class="fas fa-{{ t.status === 'completed' ? 'flag-checkered' : 'table-tennis' }}"></i>
                      </div>
                      <div class="t-info">
                        <div class="t-name">{{ t.name }}</div>
                        <div class="t-meta">
                          <span class="t-badge type-{{ t.type }}">{{ t.type }}</span>
                          <span class="t-dot">·</span>
                          <span>{{ t.participants.length }} players</span>
                          @if (t.status === 'active') {
                            <span class="t-dot">·</span>
                            <span class="t-progress">{{ completedMatches(t) }}/{{ t.matches.length }} matches</span>
                          }
                        </div>
                        @if (t.status === 'completed') {
                          <div class="t-champion">🥇 {{ getChampion(t) }}</div>
                        }
                      </div>
                    </div>
                    <div class="t-card-right">
                      <span class="status-chip chip-{{ t.status }}">{{ t.status }}</span>
                      <i class="fas fa-chevron-right t-arrow"></i>
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- ── RANKINGS TAB ── -->
          @if (activeTab === 'rankings') {
            @if (rankingsLoading) {
              <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading rankings…</div>
            } @else if (rankings.length === 0) {
              <div class="empty-state">
                <div class="empty-icon">🏅</div>
                <h3>No rankings yet</h3>
                <p>Rankings appear once tournaments are completed.</p>
              </div>
            } @else {
              <div class="rankings-header">
                <span class="rankings-title"><i class="fas fa-medal"></i> Player Leaderboard</span>
                <span class="rankings-sub">Points from completed tournaments</span>
              </div>

              <div class="gender-tabs">
                <button class="gender-tab" [class.active]="genderFilter === 'all'"   (click)="genderFilter = 'all'">All</button>
                <button class="gender-tab" [class.active]="genderFilter === 'men'"   (click)="genderFilter = 'men'">Men's</button>
                <button class="gender-tab" [class.active]="genderFilter === 'women'" (click)="genderFilter = 'women'">Women's</button>
              </div>

              <div class="rankings-list">
                @for (entry of filteredRankings; track entry.playerId; let i = $index) {
                  <div class="rank-row" [class.rank-gold]="i === 0" [class.rank-silver]="i === 1" [class.rank-bronze]="i === 2">
                    <div class="rank-pos">
                      @if (i === 0) { <span>🥇</span> }
                      @else if (i === 1) { <span>🥈</span> }
                      @else if (i === 2) { <span>🥉</span> }
                      @else { <span class="rank-num">{{ i + 1 }}</span> }
                    </div>
                    <div class="rank-avatar">
                      @if (entry.profileImage) {
                        <img [src]="entry.profileImage" [alt]="entry.name" />
                      } @else {
                        {{ initials(entry.name) }}
                      }
                    </div>
                    <div class="rank-info">
                      <div class="rank-name">{{ entry.name }}</div>
                      <div class="rank-meta">{{ entry.tournamentsPlayed }} tournament{{ entry.tournamentsPlayed !== 1 ? 's' : '' }}</div>
                    </div>
                    <div class="rank-points">
                      <span class="pts-val">{{ entry.points }}</span>
                      <span class="pts-lbl">pts</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Points guide -->
              <div class="points-guide">
                <div class="guide-header"><i class="fas fa-info-circle"></i> Points Guide</div>
                <div class="guide-grid">
                  <div class="guide-col">
                    <div class="guide-title">Singles</div>
                    <div class="guide-row"><span>Champion</span><span class="guide-pts">100</span></div>
                    <div class="guide-row"><span>Runner-up</span><span class="guide-pts">70</span></div>
                    <div class="guide-row"><span>Semi-finalist</span><span class="guide-pts">40</span></div>
                    <div class="guide-row"><span>Quarter-finalist</span><span class="guide-pts">20</span></div>
                    <div class="guide-row"><span>Participation</span><span class="guide-pts">10</span></div>
                  </div>
                  <div class="guide-col">
                    <div class="guide-title">Doubles</div>
                    <div class="guide-row"><span>Champion</span><span class="guide-pts">80</span></div>
                    <div class="guide-row"><span>Runner-up</span><span class="guide-pts">50</span></div>
                    <div class="guide-row"><span>Semi-finalist</span><span class="guide-pts">30</span></div>
                    <div class="guide-row"><span>Quarter-finalist</span><span class="guide-pts">15</span></div>
                    <div class="guide-row"><span>Participation</span><span class="guide-pts">5</span></div>
                  </div>
                </div>
              </div>
            }
          }

        </div>
      </div>
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
    .header-center { flex: 1; }
    .header-center h2 {
      margin: 0; font-size: 1.2rem; font-weight: 800; color: #1a1a1a;
      display: flex; align-items: center; gap: 8px;
    }
    .header-center h2 i { color: #9f7338; }
    .header-pills { display: flex; gap: 8px; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 14px; background: #f1f5f9; border-radius: 20px; min-width: 52px;
    }
    .stat-pill-purple { background: #ede9fe; }
    .pill-num { font-size: 1rem; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
    .stat-pill-purple .pill-num { color: #5b21b6; }
    .pill-lbl { font-size: 0.65rem; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }

    /* ── Tab bar ── */
    .tab-bar {
      display: flex; border-bottom: 2px solid #e9ecef; padding: 0 24px; gap: 2px;
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

    /* ── Body ── */
    .card-body { padding: 24px; }
    .state-msg { text-align: center; padding: 40px; color: #94a3b8; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .empty-state { text-align: center; padding: 48px 20px; color: #94a3b8; }
    .empty-icon { font-size: 2.8rem; margin-bottom: 12px; }
    .empty-state h3 { margin: 0 0 6px; font-size: 1rem; color: #374151; }
    .empty-state p { margin: 0; font-size: 0.875rem; }

    /* ── Tournament list ── */
    .tournament-list { display: flex; flex-direction: column; gap: 10px; }
    .t-card {
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
      padding: 16px; border: 1px solid #e2e8f0; border-radius: 10px;
      cursor: pointer; transition: all 0.15s; background: white;
    }
    .t-card:hover { border-color: #9f7338; background: #f8f1e4; box-shadow: 0 2px 8px rgba(159,115,56,0.1); }
    .t-card-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .t-trophy-icon {
      width: 44px; height: 44px; border-radius: 10px; display: flex;
      align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;
    }
    .t-trophy-icon.status-active { background: #f4ead6; color: #7a5626; }
    .t-trophy-icon.status-completed { background: #ede9fe; color: #5b21b6; }
    .t-trophy-icon.status-draft { background: #f1f5f9; color: #64748b; }
    .t-info { min-width: 0; }
    .t-name { font-size: 0.95rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .t-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.78rem; color: #64748b; }
    .t-badge {
      padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; text-transform: capitalize;
    }
    .type-singles { background: #dbeafe; color: #1e40af; }
    .type-doubles { background: #fef3c7; color: #92400e; }
    .t-dot { color: #cbd5e1; }
    .t-progress { color: #9f7338; font-weight: 600; }
    .t-champion { margin-top: 4px; font-size: 0.78rem; font-weight: 700; color: #7c3aed; }
    .t-card-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .t-arrow { color: #cbd5e1; font-size: 0.75rem; }
    .status-chip {
      padding: 3px 9px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; text-transform: capitalize;
    }
    .chip-active { background: #f4ead6; color: #7a5626; }
    .chip-completed { background: #ede9fe; color: #5b21b6; }
    .chip-draft { background: #f1f5f9; color: #475569; }

    /* ── Rankings ── */
    .gender-tabs {
      display: flex; gap: 6px; margin-bottom: 14px;
    }
    .gender-tab {
      padding: 6px 16px; border-radius: 20px; border: 1.5px solid #e2e8f0;
      background: white; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer;
      transition: all 0.15s;
    }
    .gender-tab:hover { border-color: #9f7338; color: #9f7338; }
    .gender-tab.active { background: #9f7338; color: white; border-color: #9f7338; }

    .rankings-header {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
      margin-bottom: 16px; gap: 8px;
    }
    .rankings-title { font-size: 0.9rem; font-weight: 700; color: #1a1a1a; display: flex; align-items: center; gap: 7px; }
    .rankings-title i { color: #9f7338; }
    .rankings-sub { font-size: 0.78rem; color: #94a3b8; }
    .rankings-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
    .rank-row {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      border: 1px solid #e2e8f0; border-radius: 10px; background: white; transition: box-shadow 0.12s;
    }
    .rank-row:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .rank-gold   { border-color: #fcd34d; background: linear-gradient(135deg, #fffbeb, #fef9e7); }
    .rank-silver { border-color: #e2e8f0; background: linear-gradient(135deg, #f8fafc, #f1f5f9); }
    .rank-bronze { border-color: #fed7aa; background: linear-gradient(135deg, #fff7ed, #fef3e8); }
    .rank-pos { width: 32px; text-align: center; font-size: 1.3rem; flex-shrink: 0; }
    .rank-num { font-size: 0.9rem; font-weight: 700; color: #94a3b8; }
    .rank-avatar {
      width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      background: linear-gradient(135deg, #9f7338, #c9a15d);
      color: white; font-size: 0.7rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .rank-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .rank-info { flex: 1; min-width: 0; }
    .rank-name { font-size: 0.9rem; font-weight: 700; color: #1a1a1a; }
    .rank-meta { font-size: 0.75rem; color: #94a3b8; margin-top: 1px; }
    .rank-points { display: flex; align-items: baseline; gap: 3px; flex-shrink: 0; }
    .pts-val { font-size: 1.25rem; font-weight: 800; color: #9f7338; }
    .pts-lbl { font-size: 0.7rem; color: #94a3b8; font-weight: 600; }

    /* ── Points guide ── */
    .points-guide {
      border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
    }
    .guide-header {
      padding: 11px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
      font-size: 0.82rem; font-weight: 700; color: #374151;
      display: flex; align-items: center; gap: 7px;
    }
    .guide-header i { color: #9f7338; }
    .guide-grid { display: grid; grid-template-columns: 1fr 1fr; }
    .guide-col { padding: 14px 16px; }
    .guide-col:first-child { border-right: 1px solid #f1f5f9; }
    .guide-title {
      font-size: 0.72rem; font-weight: 800; color: #9f7338; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 10px;
    }
    .guide-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 5px 0; border-bottom: 1px solid #f8fafc; font-size: 0.82rem; color: #374151;
    }
    .guide-row:last-child { border-bottom: none; }
    .guide-pts { font-weight: 700; color: #9f7338; }

    @media (max-width: 600px) {
      .card-header { flex-direction: column; align-items: flex-start; }
      .guide-grid { grid-template-columns: 1fr; }
      .guide-col:first-child { border-right: none; border-bottom: 1px solid #f1f5f9; }
    }
  `]
})
export class PlayerTournamentsComponent implements OnInit {
  activeTab: 'tournaments' | 'rankings' = 'tournaments';
  tournaments: Tournament[] = [];
  rankings: RankingEntry[] = [];
  loading = true;
  rankingsLoading = false;
  genderFilter: 'all' | 'men' | 'women' = 'all';

  constructor(
    private tournamentService: TournamentService,
    private coinsService: CoinsService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.coinsService.trackVisit('tournament-list').subscribe({ error: () => {} });
    this.tournamentService.getAll().subscribe({
      next: (data) => { this.tournaments = data.filter(t => t.published); this.loading = false; },
      error: () => { this.loading = false; }
    });
    this.route.queryParams.subscribe(p => {
      if (p['tab'] === 'rankings') this.loadRankings();
    });
  }

  get filteredRankings(): RankingEntry[] {
    if (this.genderFilter === 'men')   return this.rankings.filter(r => r.gender === 'Male');
    if (this.genderFilter === 'women') return this.rankings.filter(r => r.gender === 'Female');
    return this.rankings;
  }

  loadRankings() {
    this.activeTab = 'rankings';
    this.rankingsLoading = true;
    this.tournamentService.getRankings().subscribe({
      next: (data) => { this.rankings = data; this.rankingsLoading = false; },
      error: () => { this.rankingsLoading = false; }
    });
  }

  openTournament(id: string) { this.router.navigate(['/player/tournaments', id]); }
  goBack() { this.router.navigate(['/player/dashboard']); }

  get completedCount(): number {
    return this.tournaments.filter(t => t.status === 'completed').length;
  }

  completedMatches(t: Tournament): number {
    return t.matches.filter(m => m.status === 'completed').length;
  }

  getChampion(t: Tournament): string {
    const max = t.matches.length ? Math.max(...t.matches.map(m => m.round)) : 0;
    const final = t.matches.find(m => m.round === max && m.position === 0);
    if (!final || !final.winner) return '—';
    const winners = final.winner === 1 ? final.slot1Players : final.slot2Players;
    return winners.map(p => p.name).join(' & ') || '—';
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}


