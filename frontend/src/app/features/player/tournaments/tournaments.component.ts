import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TournamentService, Tournament, RankingEntry } from '../../../core/services/tournament.service';
import { CoinsService } from '../../../core/services/coins.service';

@Component({
  selector: 'app-player-tournaments',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dm-shell">
      <!-- Mobile header -->
      <header class="dm-header">
        <button class="dm-back-btn" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">Tournaments</span>
        <div class="dm-header-pills">
          <span class="dm-pill">{{ tournaments.length }} active</span>
        </div>
      </header>

      <!-- Tabs -->
      <div class="dm-tabs">
        <button class="dm-tab" [class.active]="activeTab === 'tournaments'" (click)="activeTab = 'tournaments'">
          <i class="fas fa-sitemap"></i> Tournaments
          @if (tournaments.length) { <span class="dm-tab-badge">{{ tournaments.length }}</span> }
        </button>
        <button class="dm-tab" [class.active]="activeTab === 'rankings'" (click)="loadRankings()">
          <i class="fas fa-medal"></i> Rankings
        </button>
      </div>

      <div class="dm-body">

        <!-- TOURNAMENTS TAB -->
        @if (activeTab === 'tournaments') {
          @if (loading) {
            <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading tournaments…</div>
          } @else if (tournaments.length === 0) {
            <div class="dm-empty">
              <i class="fas fa-trophy"></i>
              <p>No tournaments yet. Check back soon!</p>
            </div>
          } @else {
            <div class="dm-section-label">{{ tournaments.length }} tournament{{ tournaments.length !== 1 ? 's' : '' }}</div>
            <div class="dm-tournament-list">
              @for (t of tournaments; track t._id) {
                <div class="dm-t-card" (click)="openTournament(t._id)">
                  <div class="dm-t-icon" [class.icon-active]="t.status === 'active'" [class.icon-done]="t.status === 'completed'" [class.icon-draft]="t.status === 'draft'">
                    <i class="fas fa-{{ t.status === 'completed' ? 'flag-checkered' : 'table-tennis' }}"></i>
                  </div>
                  <div class="dm-t-info">
                    <div class="dm-t-name">{{ t.name }}</div>
                    <div class="dm-t-meta">
                      <span class="dm-t-type" [class.type-singles]="t.type === 'singles'" [class.type-doubles]="t.type === 'doubles'">{{ t.type }}</span>
                      <span class="dm-t-dot">·</span>
                      <span>{{ t.participants.length }} players</span>
                      @if (t.status === 'active') {
                        <span class="dm-t-dot">·</span>
                        <span class="dm-t-progress">{{ completedMatches(t) }}/{{ t.matches.length }}</span>
                      }
                    </div>
                    @if (t.status === 'completed') {
                      <div class="dm-t-champion">🥇 {{ getChampion(t) }}</div>
                    }
                  </div>
                  <div class="dm-t-right">
                    <span class="dm-status-chip" [class.chip-active]="t.status === 'active'" [class.chip-done]="t.status === 'completed'" [class.chip-draft]="t.status === 'draft'">{{ t.status }}</span>
                    <i class="fas fa-chevron-right dm-t-arrow"></i>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- RANKINGS TAB -->
        @if (activeTab === 'rankings') {
          @if (rankingsLoading) {
            <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading rankings…</div>
          } @else if (rankings.length === 0) {
            <div class="dm-empty">
              <i class="fas fa-medal"></i>
              <p>No rankings yet. Rankings appear once tournaments are completed.</p>
            </div>
          } @else {
            <div class="dm-section-label">Player Leaderboard</div>

            <div class="dm-gender-tabs">
              <button class="dm-gender-tab" [class.active]="genderFilter === 'all'" (click)="genderFilter = 'all'">All</button>
              <button class="dm-gender-tab" [class.active]="genderFilter === 'men'" (click)="genderFilter = 'men'">Men's</button>
              <button class="dm-gender-tab" [class.active]="genderFilter === 'women'" (click)="genderFilter = 'women'">Women's</button>
            </div>

            <div class="dm-rankings-list">
              @for (entry of filteredRankings; track entry.playerId; let i = $index) {
                <div class="dm-rank-row" [class.rank-gold]="i === 0" [class.rank-silver]="i === 1" [class.rank-bronze]="i === 2">
                  <div class="dm-rank-pos">
                    @if (i === 0) { <span>🥇</span> }
                    @else if (i === 1) { <span>🥈</span> }
                    @else if (i === 2) { <span>🥉</span> }
                    @else { <span class="dm-rank-num">{{ i + 1 }}</span> }
                  </div>
                  <div class="dm-rank-avatar">
                    @if (entry.profileImage) {
                      <img [src]="entry.profileImage" [alt]="entry.name" />
                    } @else {
                      {{ initials(entry.name) }}
                    }
                  </div>
                  <div class="dm-rank-info">
                    <div class="dm-rank-name">{{ entry.name }}</div>
                    <div class="dm-rank-meta">{{ entry.tournamentsPlayed }} tournament{{ entry.tournamentsPlayed !== 1 ? 's' : '' }}</div>
                  </div>
                  <div class="dm-rank-points">
                    <span class="dm-pts-val">{{ entry.points }}</span>
                    <span class="dm-pts-lbl">pts</span>
                  </div>
                </div>
              }
            </div>

            <!-- Points guide -->
            <div class="dm-section-label" style="margin-top:1.25rem">Points Guide</div>
            <div class="dm-points-guide">
              <div class="dm-guide-col">
                <div class="dm-guide-title">Singles</div>
                <div class="dm-guide-row"><span>Champion</span><span class="dm-guide-pts">100</span></div>
                <div class="dm-guide-row"><span>Runner-up</span><span class="dm-guide-pts">70</span></div>
                <div class="dm-guide-row"><span>Semi-finalist</span><span class="dm-guide-pts">40</span></div>
                <div class="dm-guide-row"><span>Quarter-finalist</span><span class="dm-guide-pts">20</span></div>
                <div class="dm-guide-row"><span>Participation</span><span class="dm-guide-pts">10</span></div>
              </div>
              <div class="dm-guide-col">
                <div class="dm-guide-title">Doubles</div>
                <div class="dm-guide-row"><span>Champion</span><span class="dm-guide-pts">80</span></div>
                <div class="dm-guide-row"><span>Runner-up</span><span class="dm-guide-pts">50</span></div>
                <div class="dm-guide-row"><span>Semi-finalist</span><span class="dm-guide-pts">30</span></div>
                <div class="dm-guide-row"><span>Quarter-finalist</span><span class="dm-guide-pts">15</span></div>
                <div class="dm-guide-row"><span>Participation</span><span class="dm-guide-pts">5</span></div>
              </div>
            </div>
          }
        }

        <div class="dm-bottom-spacer"></div>
      </div>

      <!-- Bottom Nav -->
      <nav class="dm-bottom-nav">
        <button class="dm-nav-item" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-home"></i><span>Home</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i><span>Courts</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reservations')">
          <i class="far fa-calendar-check"></i><span>Bookings</span>
        </button>
        <button class="dm-nav-item dm-nav-active" (click)="navigateTo('/player/tournaments')">
          <i class="fas fa-medal"></i><span>Rankings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/profile/edit')">
          <i class="far fa-user"></i><span>Profile</span>
        </button>
      </nav>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin: -1.5rem;
      width: calc(100% + 3rem);
    }
    @media (min-width: 769px) {
      :host { margin: 0; width: 100%; }
    }

    .dm-shell {
      background: #0c1a11;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      max-width: 480px;
      margin: 0 auto;
      position: relative;
    }
    @media (min-width: 769px) {
      .dm-shell {
        max-width: 720px;
        height: auto;
        min-height: calc(100vh - 60px);
      }
    }

    /* Header */
    .dm-header {
      background: #111f16;
      padding: 1rem 1rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    @media (min-width: 769px) { .dm-header { display: none; } }

    .dm-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.7);
      width: 34px; height: 34px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }

    .dm-header-title {
      flex: 1;
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }

    .dm-header-pills { display: flex; gap: 0.4rem; }

    .dm-pill {
      font-size: 0.68rem;
      font-weight: 700;
      color: rgba(255,255,255,0.45);
      background: rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 2px 8px;
    }

    /* Tabs */
    .dm-tabs {
      display: flex;
      background: #111f16;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .dm-tab {
      flex: 1;
      padding: 0.75rem 0.5rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: rgba(255,255,255,0.40);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      font-family: inherit;
    }
    .dm-tab.active { color: #a3e635; border-bottom-color: #a3e635; }
    .dm-tab i { font-size: 0.9rem; }

    .dm-tab-badge {
      background: rgba(163,230,53,0.15);
      color: #a3e635;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 10px;
    }

    /* Body */
    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 769px) {
      .dm-body {
        overflow-y: visible;
        padding: 2rem 2.5rem 2rem;
      }
    }

    .dm-state-msg {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.40);
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .dm-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.35);
    }
    .dm-empty i { font-size: 2rem; display: block; margin-bottom: 0.75rem; opacity: 0.3; }
    .dm-empty p { margin: 0; font-size: 0.88rem; }

    .dm-section-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: rgba(255,255,255,0.40);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.65rem;
    }

    /* Tournament list */
    .dm-tournament-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-bottom: 1.1rem;
    }

    .dm-t-card {
      background: #1b3028;
      border-radius: 12px;
      padding: 0.85rem 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.15s;
    }
    .dm-t-card:hover { background: #213830; transform: translateY(-1px); }

    .dm-t-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .icon-active { background: rgba(163,230,53,0.14); color: #a3e635; }
    .icon-done { background: rgba(139,92,246,0.14); color: #a78bfa; }
    .icon-draft { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }

    .dm-t-info { flex: 1; min-width: 0; }

    .dm-t-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dm-t-meta {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
      font-size: 0.72rem;
      color: rgba(255,255,255,0.45);
    }

    .dm-t-type {
      padding: 1px 7px;
      border-radius: 8px;
      font-size: 0.67rem;
      font-weight: 700;
      text-transform: capitalize;
    }
    .type-singles { background: rgba(59,130,246,0.2); color: #60a5fa; }
    .type-doubles { background: rgba(245,158,11,0.2); color: #f59e0b; }

    .dm-t-dot { color: rgba(255,255,255,0.2); }
    .dm-t-progress { color: #a3e635; font-weight: 600; }
    .dm-t-champion { font-size: 0.72rem; color: #a78bfa; font-weight: 700; margin-top: 0.2rem; }

    .dm-t-right { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }

    .dm-status-chip {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: capitalize;
    }
    .chip-active { background: rgba(163,230,53,0.15); color: #a3e635; }
    .chip-done { background: rgba(139,92,246,0.15); color: #a78bfa; }
    .chip-draft { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.45); }

    .dm-t-arrow { color: rgba(255,255,255,0.2); font-size: 0.7rem; }

    /* Gender tabs */
    .dm-gender-tabs {
      display: flex;
      gap: 0.4rem;
      margin-bottom: 0.85rem;
    }

    .dm-gender-tab {
      padding: 0.35rem 0.9rem;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.12);
      background: transparent;
      font-size: 0.78rem;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .dm-gender-tab:hover { border-color: rgba(163,230,53,0.3); color: #a3e635; }
    .dm-gender-tab.active { background: #a3e635; color: #0a1f00; border-color: #a3e635; }

    /* Rankings list */
    .dm-rankings-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }

    .dm-rank-row {
      background: #1b3028;
      border-radius: 10px;
      padding: 0.75rem 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: background 0.15s;
    }
    .dm-rank-row:hover { background: #213830; }

    .rank-gold { border: 1px solid rgba(234,179,8,0.3); background: rgba(234,179,8,0.07); }
    .rank-silver { border: 1px solid rgba(255,255,255,0.1); }
    .rank-bronze { border: 1px solid rgba(249,115,22,0.2); background: rgba(249,115,22,0.05); }

    .dm-rank-pos {
      width: 28px;
      text-align: center;
      font-size: 1.2rem;
      flex-shrink: 0;
    }

    .dm-rank-num {
      font-size: 0.85rem;
      font-weight: 700;
      color: rgba(255,255,255,0.35);
    }

    .dm-rank-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      background: rgba(163,230,53,0.15);
      color: #a3e635;
      font-size: 0.68rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dm-rank-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .dm-rank-info { flex: 1; min-width: 0; }

    .dm-rank-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: #ffffff;
    }

    .dm-rank-meta {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.40);
      margin-top: 1px;
    }

    .dm-rank-points {
      display: flex;
      align-items: baseline;
      gap: 2px;
      flex-shrink: 0;
    }

    .dm-pts-val {
      font-size: 1.1rem;
      font-weight: 800;
      color: #a3e635;
    }

    .dm-pts-lbl {
      font-size: 0.65rem;
      color: rgba(255,255,255,0.40);
      font-weight: 600;
    }

    /* Points guide */
    .dm-points-guide {
      background: #1b3028;
      border-radius: 12px;
      overflow: hidden;
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-bottom: 1.25rem;
    }

    .dm-guide-col {
      padding: 0.85rem 1rem;
    }

    .dm-guide-col:first-child {
      border-right: 1px solid rgba(255,255,255,0.07);
    }

    .dm-guide-title {
      font-size: 0.68rem;
      font-weight: 800;
      color: #a3e635;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.65rem;
    }

    .dm-guide-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.3rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.78rem;
      color: rgba(255,255,255,0.55);
    }
    .dm-guide-row:last-child { border-bottom: none; }

    .dm-guide-pts {
      font-weight: 700;
      color: #a3e635;
    }

    .dm-bottom-spacer { height: 80px; }
    @media (min-width: 769px) { .dm-bottom-spacer { display: none; } }

    /* Bottom nav */
    .dm-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: #111f16;
      border-top: 1px solid rgba(255,255,255,0.08);
      height: 62px;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: space-around;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }
    @media (min-width: 769px) { .dm-bottom-nav { display: none; } }

    .dm-nav-item {
      background: none;
      border: none;
      color: rgba(255,255,255,0.35);
      font-size: 0.6rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.4rem 0.75rem;
      transition: color 0.2s;
      font-family: inherit;
    }
    .dm-nav-item i { font-size: 1.1rem; }
    .dm-nav-item.dm-nav-active { color: #a3e635; }
  `]
})
export class PlayerTournamentsComponent implements OnInit, OnDestroy {
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
    private route: ActivatedRoute,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.coinsService.trackVisit('tournament-list').subscribe({ error: () => {} });
    this.tournamentService.getAll().subscribe({
      next: (data) => { this.tournaments = data.filter(t => t.published); this.loading = false; },
      error: () => { this.loading = false; }
    });
    this.route.queryParams.subscribe(p => {
      if (p['tab'] === 'rankings') this.loadRankings();
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
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
