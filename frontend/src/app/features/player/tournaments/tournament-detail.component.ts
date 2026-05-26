import { Component, OnDestroy, signal, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentService, Tournament, TournamentMatch, TournamentPlayer } from '../../../core/services/tournament.service';

@Component({
  selector: 'app-player-tournament-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dm-shell">
      <!-- Mobile header -->
      <header class="dm-header">
        <button class="dm-back-btn" (click)="navigateTo('/player/tournaments')">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">
          @if (tournament()) { {{ tournament()!.name }} }
          @else { Tournament }
        </span>
        @if (tournament()) {
          <span class="dm-status-chip" [class.chip-active]="tournament()!.status === 'active'" [class.chip-done]="tournament()!.status === 'completed'" [class.chip-draft]="tournament()!.status === 'draft'">
            {{ tournament()!.status }}
          </span>
        }
      </header>

      <!-- Tabs -->
      <div class="dm-tabs">
        <button class="dm-tab" [class.active]="activeTab() === 'matches'" (click)="activeTab.set('matches')">
          <i class="fas fa-table-tennis"></i> Matches
        </button>
        <button class="dm-tab" [class.active]="activeTab() === 'players'" (click)="activeTab.set('players')">
          <i class="fas fa-users"></i> Players
          @if (tournament()) { <span class="dm-tab-badge">{{ tournament()!.participants.length }}</span> }
        </button>
      </div>

      <div class="dm-body">

        @if (loading()) {
          <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading tournament…</div>
        } @else if (!tournament()) {
          <div class="dm-empty">
            <i class="fas fa-trophy"></i>
            <p>Tournament not found.</p>
          </div>
        } @else {
          @let t = tournament()!;

          <!-- Tournament meta -->
          <div class="dm-t-meta-row">
            <span class="dm-t-type-badge" [class.type-singles]="t.type === 'singles'" [class.type-doubles]="t.type === 'doubles'">{{ t.type }}</span>
            <span class="dm-t-meta-item"><i class="fas fa-users"></i> {{ t.participants.length }} players</span>
            @if (t.status !== 'draft') {
              <span class="dm-t-meta-item"><i class="fas fa-check"></i> {{ completedCount }}/{{ t.matches.length }} done</span>
            }
          </div>

          <!-- Champion banner -->
          @if (t.status === 'completed') {
            <div class="dm-champion-banner">
              <div class="dm-champion-trophy">🏆</div>
              <div class="dm-champion-left">
                <div class="dm-champion-lbl">Tournament Champion</div>
                <div class="dm-champion-name">{{ getChampion() }}</div>
              </div>
              <div class="dm-runner-block">
                <div class="dm-runner-lbl">Runner-up</div>
                <div class="dm-runner-name">{{ getRunnerUp() }}</div>
              </div>
            </div>
          }

          <!-- MATCHES TAB -->
          @if (activeTab() === 'matches') {
            @if (visibleMatches.length === 0) {
              <div class="dm-empty">
                <i class="fas fa-table-tennis"></i>
                <p>No matches available yet.</p>
              </div>
            } @else {
              <div class="dm-section-label">{{ visibleMatches.length }} match{{ visibleMatches.length !== 1 ? 'es' : '' }}</div>
              <div class="dm-match-list">
                @for (match of visibleMatches; track match._id) {
                  <div class="dm-match-card" [class.card-ongoing]="match.status === 'ongoing'">
                    <div class="dm-match-top">
                      <span class="dm-round-chip">{{ match.roundName }}</span>
                      <span class="dm-match-status-chip" [class.mchip-upcoming]="match.status === 'upcoming'" [class.mchip-ongoing]="match.status === 'ongoing'" [class.mchip-done]="match.status === 'completed'">{{ match.status }}</span>
                      @if (match.scheduledDate) {
                        <span class="dm-match-date"><i class="fas fa-calendar-alt"></i> {{ match.scheduledDate | date: 'MMM d' : 'UTC' }}@if (match.timeSlot) { · {{ match.timeSlot }} }</span>
                      }
                    </div>
                    <div class="dm-match-players">
                      <div class="dm-match-player" [class.player-winner]="match.winner === 1" [class.player-loser]="match.winner === 2">
                        <i class="fas fa-user-circle dm-player-icon"></i>
                        <span class="dm-player-name">{{ slotLabel(match.slot1Players) }}</span>
                        @if (match.winner === 1) { <span class="dm-win-tag">🏆</span> }
                      </div>
                      <div class="dm-match-divider">
                        @if (match.score) { <span class="dm-score-badge">{{ match.score }}</span> }
                        @else { <span class="dm-vs-text">vs</span> }
                      </div>
                      <div class="dm-match-player dm-match-player-right" [class.player-winner]="match.winner === 2" [class.player-loser]="match.winner === 1">
                        <i class="fas fa-user-circle dm-player-icon"></i>
                        <span class="dm-player-name">{{ slotLabel(match.slot2Players) }}</span>
                        @if (match.winner === 2) { <span class="dm-win-tag">🏆</span> }
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- PLAYERS TAB -->
          @if (activeTab() === 'players') {
            <div class="dm-section-label">{{ t.participants.length }} participant{{ t.participants.length !== 1 ? 's' : '' }}</div>
            <div class="dm-players-list">
              @for (p of t.participants; track p._id) {
                <div class="dm-player-row">
                  <div class="dm-p-avatar">
                    @if (p.profileImage) {
                      <img [src]="p.profileImage" [alt]="p.name" />
                    } @else {
                      {{ initials(p.name) }}
                    }
                  </div>
                  <span class="dm-p-name">{{ p.name }}</span>
                  @if (isChampion(p._id)) {
                    <span class="dm-p-badge badge-champion">🥇 Champion</span>
                  } @else if (isRunnerUp(p._id)) {
                    <span class="dm-p-badge badge-runner">🥈 Runner-up</span>
                  }
                </div>
              }
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
      min-width: 0;
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
      flex-shrink: 0;
    }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }

    .dm-header-title {
      flex: 1;
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .dm-status-chip {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: capitalize;
      flex-shrink: 0;
    }
    .chip-active { background: rgba(163,230,53,0.15); color: #a3e635; }
    .chip-done { background: rgba(139,92,246,0.15); color: #a78bfa; }
    .chip-draft { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.45); }

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

    /* Tournament meta row */
    .dm-t-meta-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin-bottom: 0.85rem;
    }

    .dm-t-type-badge {
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: capitalize;
    }
    .type-singles { background: rgba(59,130,246,0.2); color: #60a5fa; }
    .type-doubles { background: rgba(245,158,11,0.2); color: #f59e0b; }

    .dm-t-meta-item {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.45);
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .dm-t-meta-item i { font-size: 0.7rem; }

    /* Champion banner */
    .dm-champion-banner {
      background: rgba(234,179,8,0.1);
      border: 1px solid rgba(234,179,8,0.25);
      border-radius: 12px;
      padding: 0.9rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1rem;
    }

    .dm-champion-trophy { font-size: 1.75rem; flex-shrink: 0; }

    .dm-champion-left { flex: 1; min-width: 0; }

    .dm-champion-lbl {
      font-size: 0.65rem;
      font-weight: 700;
      color: rgba(234,179,8,0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .dm-champion-name {
      font-size: 0.95rem;
      font-weight: 800;
      color: #ffffff;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dm-runner-block { text-align: right; flex-shrink: 0; }

    .dm-runner-lbl {
      font-size: 0.62rem;
      font-weight: 700;
      color: rgba(255,255,255,0.35);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .dm-runner-name {
      font-size: 0.82rem;
      font-weight: 700;
      color: rgba(255,255,255,0.65);
      margin-top: 2px;
    }

    /* Match list */
    .dm-match-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-bottom: 1rem;
    }

    .dm-match-card {
      background: #1b3028;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.05);
      transition: background 0.15s;
    }
    .dm-match-card:hover { background: #213830; }
    .card-ongoing { border-color: rgba(245,158,11,0.3); }

    .dm-match-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      padding: 0.6rem 0.85rem;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .dm-round-chip {
      background: rgba(59,130,246,0.2);
      color: #60a5fa;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.67rem;
      font-weight: 700;
    }

    .dm-match-status-chip {
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: capitalize;
    }
    .mchip-upcoming { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.45); }
    .mchip-ongoing { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .mchip-done { background: rgba(163,230,53,0.15); color: #a3e635; }

    .dm-match-date {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.40);
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .dm-match-date i { color: rgba(255,255,255,0.28); }

    .dm-match-players {
      display: flex;
      align-items: center;
      padding: 0.85rem 0.85rem;
      gap: 0;
    }

    .dm-match-player {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      min-width: 0;
    }

    .dm-match-player-right {
      justify-content: flex-end;
      flex-direction: row-reverse;
    }

    .dm-player-icon { font-size: 1.2rem; color: rgba(255,255,255,0.2); flex-shrink: 0; }
    .dm-player-name { font-weight: 600; color: rgba(255,255,255,0.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .player-winner .dm-player-name { color: #a3e635; font-weight: 700; }
    .player-winner .dm-player-icon { color: #a3e635; }
    .player-loser { opacity: 0.35; }

    .dm-win-tag { font-size: 0.9rem; flex-shrink: 0; }

    .dm-match-divider {
      flex-shrink: 0;
      width: 56px;
      text-align: center;
    }

    .dm-vs-text { font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.2); }

    .dm-score-badge {
      font-size: 0.78rem;
      font-weight: 800;
      color: #ffffff;
      background: rgba(255,255,255,0.1);
      padding: 2px 7px;
      border-radius: 6px;
    }

    /* Players list */
    .dm-players-list {
      display: flex;
      flex-direction: column;
    }

    .dm-player-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .dm-player-row:last-child { border-bottom: none; }

    .dm-p-avatar {
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
    .dm-p-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .dm-p-name { flex: 1; font-size: 0.88rem; font-weight: 600; color: #ffffff; }

    .dm-p-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.67rem;
      font-weight: 700;
    }
    .badge-champion { background: rgba(234,179,8,0.2); color: #eab308; }
    .badge-runner { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.55); }

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
export class PlayerTournamentDetailComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tournamentService = inject(TournamentService);
  private renderer = inject(Renderer2);

  tournament = signal<Tournament | null>(null);
  loading = signal(true);
  activeTab = signal<'matches' | 'players'>('matches');
  rounds = signal<number[]>([]);

  constructor() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.route.params.subscribe(params => {
      this.tournamentService.getById(params['id']).subscribe({
        next: (t) => {
          this.tournament.set(t);
          this.loading.set(false);
          if (t.matches.length) {
            const max = Math.max(...t.matches.map(m => m.round));
            this.rounds.set(Array.from({ length: max }, (_, i) => i + 1));
          }
        },
        error: () => { this.loading.set(false); }
      });
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  navigateTo(path: string) { this.router.navigate([path]); }

  get visibleMatches(): TournamentMatch[] {
    return [...(this.tournament()?.matches || [])]
      .filter(m => m.slot1Players.length > 0 || m.slot2Players.length > 0)
      .sort((a, b) => a.round - b.round || a.position - b.position);
  }

  get completedCount(): number {
    return this.tournament()?.matches.filter(m => m.status === 'completed').length ?? 0;
  }

  slotLabel(players: TournamentPlayer[]): string {
    return players.length ? players.map(p => p.name).join(' & ') : 'TBD';
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  private getFinalMatch() {
    const r = this.rounds();
    if (!r.length) return null;
    return this.tournament()?.matches.find(m => m.round === r[r.length - 1] && m.position === 0) ?? null;
  }

  getChampion(): string {
    const final = this.getFinalMatch();
    if (!final?.winner) return '—';
    return (final.winner === 1 ? final.slot1Players : final.slot2Players).map(p => p.name).join(' & ') || '—';
  }

  getRunnerUp(): string {
    const final = this.getFinalMatch();
    if (!final?.winner) return '—';
    return (final.winner === 1 ? final.slot2Players : final.slot1Players).map(p => p.name).join(' & ') || '—';
  }

  isChampion(pid: string): boolean {
    const t = this.tournament();
    if (!t || t.status !== 'completed') return false;
    const final = this.getFinalMatch();
    if (!final?.winner) return false;
    return (final.winner === 1 ? final.slot1Players : final.slot2Players).some(p => p._id === pid);
  }

  isRunnerUp(pid: string): boolean {
    const t = this.tournament();
    if (!t || t.status !== 'completed') return false;
    const final = this.getFinalMatch();
    if (!final?.winner) return false;
    return (final.winner === 1 ? final.slot2Players : final.slot1Players).some(p => p._id === pid);
  }
}
