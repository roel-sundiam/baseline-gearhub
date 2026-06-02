import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OpenPlayService, OpenPlaySession, OpenPlayMatch } from '../../../core/services/open-play.service';

type SessionDetail = OpenPlaySession & {
  club: { _id: string; name: string; location?: string; logo?: string | null } | null;
  players: { _id: string; name: string; ratingSnapshot: number; checkedIn: boolean; isMe: boolean }[];
  matches: OpenPlayMatch[];
  myEntry: { checkedIn: boolean } | null;
};

@Component({
  selector: 'app-player-open-play-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="opd-shell">

      <header class="opd-header">
        <button class="back-btn" (click)="router.navigate(['/player/open-play'])">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="opd-header-text">
          <h2>{{ detail()?.title ?? 'Session Detail' }}</h2>
          @if (detail()) {
            <span class="badge" [class]="'badge-' + detail()!.status">{{ detail()!.status.replace('_', ' ') }}</span>
          }
        </div>
      </header>

      @if (loading()) {
        <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else if (error()) {
        <div class="state-error">{{ error() }}</div>
      } @else if (detail()) {

        <div class="opd-body">

          <!-- Club card -->
          <div class="club-card">
            <div class="club-logo">
              @if (detail()!.club?.logo) {
                <img [src]="detail()!.club!.logo!" [alt]="detail()!.club!.name" class="club-logo-img" />
              } @else {
                <span class="club-logo-initials">{{ initials(detail()!.club?.name) }}</span>
              }
            </div>
            <div class="club-info">
              <div class="club-name">{{ detail()!.club?.name }}</div>
              @if (detail()!.club?.location) {
                <div class="club-location"><i class="fas fa-location-dot"></i> {{ detail()!.club!.location }}</div>
              }
            </div>
          </div>

          <!-- Session info -->
          <div class="info-card">
            <div class="info-row">
              <span class="info-icon"><i class="fas fa-calendar"></i></span>
              <span>{{ detail()!.sessionDate | date:'EEEE, MMMM d, y' }}</span>
            </div>
            <div class="info-row">
              <span class="info-icon"><i class="fas fa-clock"></i></span>
              <span>{{ detail()!.startTime }} – {{ detail()!.endTime }}</span>
            </div>
            <div class="info-row">
              <span class="info-icon"><i class="fas fa-table-tennis-paddle-ball"></i></span>
              <span>{{ detail()!.sport | titlecase }} · {{ detail()!.matchType }}</span>
            </div>
            <div class="info-row">
              <span class="info-icon"><i class="fas fa-users"></i></span>
              <span>{{ detail()!.players.length }} / {{ detail()!.maxPlayers }} players registered</span>
            </div>
            @if (detail()!.myEntry) {
              <div class="info-row my-status" [class.checked-in]="detail()!.myEntry!.checkedIn">
                <span class="info-icon">
                  <i class="fas" [class.fa-circle-check]="detail()!.myEntry!.checkedIn" [class.fa-circle-dot]="!detail()!.myEntry!.checkedIn"></i>
                </span>
                <span>You are {{ detail()!.myEntry!.checkedIn ? 'checked in' : 'registered but not yet checked in' }}</span>
              </div>
            }
          </div>

          <!-- Players -->
          <div class="section">
            <h3 class="section-title">
              <i class="fas fa-users"></i> Players
              <span class="count-chip">{{ detail()!.players.length }}</span>
            </h3>
            @if (detail()!.players.length === 0) {
              <p class="empty-note">No players registered yet.</p>
            } @else {
              <div class="player-grid">
                @for (p of detail()!.players; track p._id) {
                  <div class="player-chip" [class.me]="p.isMe" [class.checked]="p.checkedIn">
                    <div class="player-avatar">{{ p.name[0].toUpperCase() }}</div>
                    <div class="player-details">
                      <span class="player-name">{{ p.name }}{{ p.isMe ? ' (you)' : '' }}</span>
                      <span class="player-cri">CRI {{ p.ratingSnapshot.toFixed(1) }}</span>
                    </div>
                    @if (p.checkedIn) {
                      <i class="fas fa-circle-check checkin-icon"></i>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Matches -->
          @if (detail()!.matches.length > 0) {
            <div class="section">
              <h3 class="section-title">
                <i class="fas fa-shuffle"></i> Matches
                <span class="count-chip">{{ detail()!.matches.length }}</span>
              </h3>
              <div class="match-list">
                @for (m of detail()!.matches; track m._id) {
                  <div class="match-card" [class.done]="m.status === 'completed'">
                    <div class="match-court">{{ m.court }}</div>
                    <div class="match-body">
                      <div class="match-team">
                        <span [class.me]="isMe(m.team1Player1)">{{ name(m.team1Player1) }}</span>
                        @if (m.team1Player2) {
                          <span class="partner-sep">&</span>
                          <span [class.me]="isMe(m.team1Player2)">{{ name(m.team1Player2) }}</span>
                        }
                      </div>
                      <div class="match-score">
                        @if (m.status === 'completed') {
                          <span class="score-val">{{ m.team1Score }}</span>
                          <span class="score-sep">–</span>
                          <span class="score-val">{{ m.team2Score }}</span>
                        } @else {
                          <span class="vs-label">vs</span>
                        }
                      </div>
                      <div class="match-team team-right">
                        <span [class.me]="isMe(m.team2Player1)">{{ name(m.team2Player1) }}</span>
                        @if (m.team2Player2) {
                          <span class="partner-sep">&</span>
                          <span [class.me]="isMe(m.team2Player2)">{{ name(m.team2Player2) }}</span>
                        }
                      </div>
                    </div>
                    @if (m.status === 'completed') {
                      <div class="match-done-badge"><i class="fas fa-check"></i> Done</div>
                    }
                  </div>
                }
              </div>
            </div>
          }

        </div>
      }
    </div>
  `,
  styles: [`
    .opd-shell { background: #0f1a0f; min-height: 100vh; color: #e8f5e8; padding-bottom: 4rem; }

    .opd-header {
      display: flex; align-items: center; gap: 1rem;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid #2d4a2d;
      background: linear-gradient(135deg, #1a2e1a 0%, #0f1a0f 100%);
    }
    .back-btn {
      background: none; border: 1px solid #2d4a2d; color: #86b086;
      width: 2.25rem; height: 2.25rem; border-radius: .5rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .opd-header-text { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .opd-header-text h2 { font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0; }

    .badge { font-size: .7rem; padding: .2rem .6rem; border-radius: 1rem; font-weight: 600; text-transform: capitalize; white-space: nowrap; }
    .badge-open { background: #1e4620; color: #a3e635; }
    .badge-in_progress { background: #1a3a4a; color: #60c0e0; }
    .badge-completed { background: #2a2a2a; color: #888; }
    .badge-cancelled { background: #3a1a1a; color: #e06060; }

    .state-msg { color: #86b086; text-align: center; padding: 4rem 0; font-size: .9rem; }
    .state-error { color: #f87171; text-align: center; padding: 2rem; font-size: .875rem; }

    .opd-body { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem 1.5rem; max-width: 640px; margin: 0 auto; }

    /* Club card */
    .club-card {
      display: flex; align-items: center; gap: .85rem;
      background: #1a2e1a; border: 1px solid #2d4a2d; border-radius: .75rem; padding: 1rem;
    }
    .club-logo {
      width: 48px; height: 48px; border-radius: 50%; background: #2d4a2d;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
    }
    .club-logo-img { width: 100%; height: 100%; object-fit: cover; }
    .club-logo-initials { font-size: .9rem; font-weight: 700; color: #a3e635; }
    .club-name { font-size: 1rem; font-weight: 700; color: #fff; }
    .club-location { font-size: .8rem; color: #86b086; margin-top: .2rem; display: flex; align-items: center; gap: .3rem; }

    /* Info card */
    .info-card {
      background: #1a2e1a; border: 1px solid #2d4a2d; border-radius: .75rem; padding: 1rem;
      display: flex; flex-direction: column; gap: .6rem;
    }
    .info-row { display: flex; align-items: center; gap: .65rem; font-size: .875rem; color: #e8f5e8; }
    .info-icon { width: 1.25rem; text-align: center; color: #4caf50; flex-shrink: 0; }
    .my-status { margin-top: .25rem; padding-top: .6rem; border-top: 1px solid #2d4a2d; color: #86b086; }
    .my-status.checked-in { color: #4caf50; }

    /* Section */
    .section { background: #1a2e1a; border: 1px solid #2d4a2d; border-radius: .75rem; padding: 1rem; }
    .section-title {
      font-size: .9rem; font-weight: 700; color: #e8f5e8; margin: 0 0 .85rem;
      display: flex; align-items: center; gap: .5rem;
    }
    .section-title i { color: #4caf50; }
    .count-chip { background: #2d6a2d; color: #a3e635; font-size: .7rem; padding: .1rem .5rem; border-radius: 1rem; font-weight: 700; }
    .empty-note { color: #4a6a4a; font-size: .85rem; margin: 0; }

    /* Player grid */
    .player-grid { display: flex; flex-direction: column; gap: .5rem; }
    .player-chip {
      display: flex; align-items: center; gap: .65rem;
      background: #0f1a0f; border: 1px solid #2d4a2d; border-radius: .5rem; padding: .5rem .75rem;
    }
    .player-chip.me { border-color: #4caf50; background: #1a3a1a; }
    .player-avatar {
      width: 32px; height: 32px; border-radius: 50%; background: #2d4a2d;
      display: flex; align-items: center; justify-content: center;
      font-size: .8rem; font-weight: 700; color: #a3e635; flex-shrink: 0;
    }
    .player-chip.me .player-avatar { background: #2d6a2d; }
    .player-details { flex: 1; display: flex; flex-direction: column; gap: .1rem; }
    .player-name { font-size: .875rem; color: #e8f5e8; font-weight: 500; }
    .player-chip.me .player-name { color: #fff; font-weight: 700; }
    .player-cri { font-size: .7rem; color: #86b086; }
    .checkin-icon { color: #4caf50; font-size: .9rem; margin-left: auto; }

    /* Match list */
    .match-list { display: flex; flex-direction: column; gap: .6rem; }
    .match-card {
      background: #0f1a0f; border: 1px solid #2d4a2d; border-radius: .5rem; padding: .75rem;
    }
    .match-card.done { opacity: .8; }
    .match-court { font-size: .7rem; color: #86b086; margin-bottom: .4rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
    .match-body { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .match-team { flex: 1; display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; font-size: .85rem; color: #e8f5e8; }
    .team-right { justify-content: flex-end; }
    .match-team span.me { color: #a3e635; font-weight: 700; }
    .partner-sep { color: #4a6a4a; font-size: .75rem; }
    .match-score { display: flex; align-items: center; gap: .3rem; flex-shrink: 0; }
    .score-val { font-size: 1.1rem; font-weight: 700; color: #a3e635; }
    .score-sep { color: #86b086; font-size: .9rem; }
    .vs-label { font-size: .8rem; color: #4a6a4a; padding: 0 .25rem; }
    .match-done-badge { margin-top: .4rem; font-size: .7rem; color: #4caf50; display: flex; align-items: center; gap: .25rem; }

    @media (max-width: 480px) {
      .opd-header { padding: 1rem; }
      .opd-body { padding: .75rem 1rem; }
      .match-body { flex-direction: column; align-items: flex-start; gap: .3rem; }
      .team-right { justify-content: flex-start; }
    }
  `],
})
export class PlayerOpenPlayDetailComponent implements OnInit {
  detail = signal<SessionDetail | null>(null);
  loading = signal(true);
  error = signal('');

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private openPlay: OpenPlayService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.openPlay.getPlayerSessionDetail(id).subscribe({
      next: d => { this.detail.set(d as SessionDetail); this.loading.set(false); },
      error: () => { this.error.set('Could not load session details.'); this.loading.set(false); },
    });
  }

  initials(name?: string | null): string {
    return (name ?? '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  name(player: { _id: string; name: string } | null | undefined): string {
    return player?.name ?? '';
  }

  isMe(player: { _id: string; name: string } | null | undefined): boolean {
    if (!this.detail() || !player) return false;
    return this.detail()!.players.some(p => p.isMe && p.name === player.name);
  }
}
