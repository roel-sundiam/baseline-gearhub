import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OpenPlayService, OpenPlaySession, OpenPlayRating, Sport } from '../../../core/services/open-play.service';

@Component({
  selector: 'app-player-open-play',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="op-shell">

      <header class="op-header">
        <button class="back-btn" (click)="router.navigate(['/player/dashboard'])">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div>
          <h2>Open Play</h2>
          <p class="op-subtitle">Join a session and play with fellow members</p>
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
        <button class="tab-btn" [class.active]="tab() === 'available'" (click)="tab.set('available')">
          Available Sessions
        </button>
        <button class="tab-btn" [class.active]="tab() === 'mine'" (click)="switchMine()">
          My Sessions
        </button>
        <button class="tab-btn" [class.active]="tab() === 'leaderboard'" (click)="switchLeaderboard()">
          Leaderboard
        </button>
      </div>

      <div class="op-body">

        <!-- ── Available sessions ── -->
        @if (tab() === 'available') {
          @if (loadingSessions()) {
            <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading sessions…</div>
          } @else if (sessions().length === 0) {
            <div class="empty-state">
              <i class="fas fa-table-tennis-paddle-ball"></i>
              <p>No open sessions right now.</p>
              <span>Check back later or ask your admin to create one.</span>
            </div>
          } @else {
            <div class="session-list">
              @for (s of sessions(); track s._id) {
                <div class="session-card" (click)="viewDetail(s._id)"
                     (keydown.enter)="viewDetail(s._id)" tabindex="0">
                  <div class="sc-club-row">
                    <div class="sc-club-logo">
                      @if (clubLogo(s)) {
                        <img [src]="clubLogo(s)" [alt]="clubName(s)" class="club-logo-img" />
                      } @else {
                        <span class="club-logo-initials">{{ clubInitials(s) }}</span>
                      }
                    </div>
                    <span class="sc-club-name">{{ clubName(s) }}</span>
                  </div>
                  <div class="sc-top">
                    <div class="sc-info">
                      <div class="sc-title">{{ s.title }}</div>
                      <div class="sc-meta">
                        <span><i class="fas fa-calendar"></i> {{ s.sessionDate | date:'EEE, MMM d' }}</span>
                        <span><i class="fas fa-clock"></i> {{ s.startTime }} – {{ s.endTime }}</span>
                        <span><i class="fas fa-users"></i> {{ s.registeredCount ?? 0 }} / {{ s.maxPlayers }}</span>
                        <span class="sc-type">{{ s.matchType }}</span>
                      </div>
                    </div>
                    <div class="sc-right">
                      @if (s.joined) {
                        <button
                          class="btn-unjoin"
                          [disabled]="unjoiningId() === s._id"
                          (click)="$event.stopPropagation(); unjoin(s)"
                          title="Leave this session"
                        >
                          @if (unjoiningId() === s._id) {
                            <i class="fas fa-circle-notch fa-spin"></i>
                          } @else {
                            <i class="fas fa-circle-check"></i> Joined
                          }
                        </button>
                      } @else if ((s.registeredCount ?? 0) >= s.maxPlayers) {
                        <span class="badge-full">Full</span>
                      } @else {
                        <button
                          class="btn-join"
                          [disabled]="joiningId() === s._id"
                          (click)="$event.stopPropagation(); join(s)"
                        >
                          @if (joiningId() === s._id) {
                            <i class="fas fa-circle-notch fa-spin"></i>
                          } @else {
                            Join
                          }
                        </button>
                      }
                    </div>
                  </div>
                  @if (joinError() && joiningId() === s._id) {
                    <div class="join-error">{{ joinError() }}</div>
                  }
                </div>
              }
            </div>
          }
        }

        <!-- ── My sessions ── -->
        @if (tab() === 'mine') {
          @if (loadingMine()) {
            <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
          } @else if (mySessions().length === 0) {
            <div class="empty-state">
              <i class="fas fa-calendar-xmark"></i>
              <p>You haven't joined any sessions yet.</p>
            </div>
          } @else {
            <div class="session-list">
              @for (s of mySessions(); track s._id) {
                <div class="session-card" (click)="viewDetail(s._id)"
                     (keydown.enter)="viewDetail(s._id)" tabindex="0">
                  <div class="sc-club-row">
                    <div class="sc-club-logo">
                      @if (clubLogo(s)) {
                        <img [src]="clubLogo(s)" [alt]="clubName(s)" class="club-logo-img" />
                      } @else {
                        <span class="club-logo-initials">{{ clubInitials(s) }}</span>
                      }
                    </div>
                    <span class="sc-club-name">{{ clubName(s) }}</span>
                  </div>
                  <div class="sc-top">
                    <div class="sc-info">
                      <div class="sc-title">{{ s.title }}</div>
                      <div class="sc-meta">
                        <span><i class="fas fa-calendar"></i> {{ s.sessionDate | date:'EEE, MMM d' }}</span>
                        <span><i class="fas fa-clock"></i> {{ s.startTime }} – {{ s.endTime }}</span>
                        <span class="sc-type">{{ s.matchType }}</span>
                      </div>
                    </div>
                    <span class="badge" [class]="'badge-' + s.status">{{ s.status.replace('_', ' ') }}</span>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- ── Leaderboard ── -->
        @if (tab() === 'leaderboard') {
          @if (loadingLeaderboard()) {
            <div class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
          } @else if (leaderboard().length === 0) {
            <div class="empty-state">
              <i class="fas fa-medal"></i>
              <p>No ratings yet for {{ sport() }}.</p>
            </div>
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
                    <td class="rank">{{ i + 1 }}</td>
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
        }

      </div>

    </div>
  `,
  styles: [`
    .op-shell { background: #0f1a0f; min-height: 100vh; color: #e8f5e8; padding-bottom: 4rem; }

    .op-header {
      display: flex; align-items: flex-start; gap: 1rem;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid #2d4a2d;
      background: linear-gradient(135deg, #1a2e1a 0%, #0f1a0f 100%);
    }
    .back-btn {
      background: none; border: 1px solid #2d4a2d; color: #86b086;
      width: 2.25rem; height: 2.25rem; border-radius: .5rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: .1rem;
    }
    .op-header h2 { font-size: 1.5rem; font-weight: 700; color: #fff; margin: 0 0 .2rem; }
    .op-subtitle { font-size: .8rem; color: #86b086; margin: 0; }

    .sport-toggle { display: flex; gap: .5rem; padding: 1rem 1.5rem .5rem; }
    .sport-btn {
      background: #1a2e1a; border: 1px solid #2d4a2d; color: #86b086;
      padding: .5rem 1.25rem; border-radius: 2rem; font-size: .875rem; cursor: pointer; transition: all .15s;
    }
    .sport-btn.active { background: #2d6a2d; border-color: #4caf50; color: #fff; }

    .tab-bar { display: flex; border-bottom: 1px solid #2d4a2d; padding: 0 1.5rem; margin-top: .25rem; }
    .tab-btn {
      background: none; border: none; color: #86b086; padding: .7rem 1rem; font-size: .85rem;
      cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; white-space: nowrap;
    }
    .tab-btn.active { color: #a3e635; border-bottom-color: #a3e635; }

    .op-body { padding: 1rem 1.5rem; }

    .state-msg { color: #86b086; text-align: center; padding: 3rem 0; font-size: .9rem; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 4rem 1rem; gap: .75rem; text-align: center;
    }
    .empty-state i { font-size: 2.5rem; color: #2d4a2d; }
    .empty-state p { font-size: 1rem; color: #86b086; margin: 0; font-weight: 600; }
    .empty-state span { font-size: .8rem; color: #4a6a4a; }

    .session-list { display: flex; flex-direction: column; gap: .75rem; }

    .session-card {
      background: #1a2e1a; border: 1px solid #2d4a2d; border-radius: .75rem;
      padding: 1rem 1.25rem; cursor: pointer; transition: border-color .15s;
    }
    .session-card:hover { border-color: #4caf50; }
    .sc-club-row {
      display: flex; align-items: center; gap: .5rem; margin-bottom: .65rem;
    }
    .sc-club-logo {
      width: 28px; height: 28px; border-radius: 50%; overflow: hidden;
      background: #2d4a2d; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .club-logo-img { width: 100%; height: 100%; object-fit: cover; }
    .club-logo-initials { font-size: .65rem; font-weight: 700; color: #a3e635; }
    .sc-club-name { font-size: .75rem; font-weight: 700; color: #a3e635; letter-spacing: .04em; }
    .sc-top { display: flex; justify-content: space-between; align-items: flex-start; gap: .75rem; }
    .sc-info { flex: 1; min-width: 0; }
    .sc-title { font-size: 1rem; font-weight: 600; color: #fff; margin-bottom: .4rem; }
    .sc-meta { display: flex; flex-wrap: wrap; gap: .5rem; font-size: .775rem; color: #86b086; }
    .sc-meta i { color: #4caf50; margin-right: .2rem; }
    .sc-type { background: #1e3a1e; color: #a3e635; font-size: .7rem; padding: .1rem .5rem; border-radius: 1rem; font-weight: 600; }
    .sc-right { flex-shrink: 0; display: flex; align-items: center; }

    .btn-join {
      background: #2d6a2d; color: #fff; border: none;
      padding: .5rem 1.25rem; border-radius: .375rem; font-size: .875rem;
      cursor: pointer; font-weight: 600; transition: background .15s; min-width: 72px; text-align: center;
    }
    .btn-join:hover:not(:disabled) { background: #3a8a3a; }
    .btn-join:disabled { opacity: .6; cursor: not-allowed; }

    .btn-unjoin {
      background: #1e3a1e; border: 1px solid #4caf50; color: #4caf50;
      padding: .4rem .9rem; border-radius: .375rem; font-size: .8rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: .35rem; transition: all .15s; white-space: nowrap;
    }
    .btn-unjoin:hover:not(:disabled) { background: #3a1a1a; border-color: #e06060; color: #e06060; }
    .btn-unjoin:disabled { opacity: .6; cursor: not-allowed; }
    .badge-full { background: #2a2a2a; color: #666; font-size: .75rem; padding: .3rem .75rem; border-radius: .375rem; }

    .badge { font-size: .7rem; padding: .2rem .6rem; border-radius: 1rem; font-weight: 600; text-transform: capitalize; white-space: nowrap; }
    .badge-open { background: #1e4620; color: #a3e635; }
    .badge-in_progress { background: #1a3a4a; color: #60c0e0; }
    .badge-completed { background: #2a2a2a; color: #888; }
    .badge-cancelled { background: #3a1a1a; color: #e06060; }

    .join-error { margin-top: .5rem; font-size: .8rem; color: #f87171; background: #3a1a1a; border-radius: .375rem; padding: .4rem .6rem; }

    .lb-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    .lb-table th { text-align: left; padding: .6rem .75rem; color: #86b086; font-weight: 600; border-bottom: 1px solid #2d4a2d; }
    .lb-table td { padding: .6rem .75rem; border-bottom: 1px solid #1a2e1a; color: #e8f5e8; }
    .lb-table tr:hover td { background: #1a2e1a; }
    .rank { color: #86b086; font-weight: 600; }
    .cri { font-weight: 700; color: #a3e635; }

    @media (max-width: 480px) {
      .op-header { padding: 1rem; }
      .op-body { padding: .75rem 1rem; }
      .tab-btn { font-size: .78rem; padding: .6rem .6rem; }
    }
  `],
})
export class PlayerOpenPlayComponent implements OnInit {
  sport = signal<Sport>('pickleball');
  tab = signal<'available' | 'mine' | 'leaderboard'>('available');

  sessions = signal<OpenPlaySession[]>([]);
  mySessions = signal<OpenPlaySession[]>([]);
  leaderboard = signal<OpenPlayRating[]>([]);

  loadingSessions = signal(false);
  loadingMine = signal(false);
  loadingLeaderboard = signal(false);
  joiningId = signal('');
  unjoiningId = signal('');
  joinError = signal('');

  constructor(
    public router: Router,
    private openPlay: OpenPlayService,
  ) {}

  ngOnInit() {
    this.loadSessions();
  }

  setSport(s: Sport) {
    this.sport.set(s);
    this.loadSessions();
    if (this.tab() === 'mine') this.loadMine();
    if (this.tab() === 'leaderboard') this.loadLeaderboard();
  }

  switchMine() {
    this.tab.set('mine');
    this.loadMine();
  }

  switchLeaderboard() {
    this.tab.set('leaderboard');
    this.loadLeaderboard();
  }

  loadSessions() {
    this.loadingSessions.set(true);
    this.openPlay.getPlayerSessions(this.sport()).subscribe({
      next: s => { this.sessions.set(s); this.loadingSessions.set(false); },
      error: () => this.loadingSessions.set(false),
    });
  }

  loadMine() {
    this.loadingMine.set(true);
    this.openPlay.getMySessions().subscribe({
      next: s => { this.mySessions.set(s); this.loadingMine.set(false); },
      error: () => this.loadingMine.set(false),
    });
  }

  loadLeaderboard() {
    this.loadingLeaderboard.set(true);
    this.openPlay.getPlayerLeaderboard(this.sport()).subscribe({
      next: r => { this.leaderboard.set(r); this.loadingLeaderboard.set(false); },
      error: () => this.loadingLeaderboard.set(false),
    });
  }

  unjoin(session: OpenPlaySession) {
    this.unjoiningId.set(session._id);
    this.openPlay.unjoinSession(session._id).subscribe({
      next: () => {
        this.sessions.update(list =>
          list.map(s => s._id === session._id
            ? { ...s, joined: false, registeredCount: Math.max(0, (s.registeredCount ?? 1) - 1) }
            : s
          )
        );
        this.mySessions.update(list => list.filter(s => s._id !== session._id));
        this.unjoiningId.set('');
      },
      error: err => {
        alert(err.error?.error || 'Failed to unjoin session.');
        this.unjoiningId.set('');
      },
    });
  }

  viewDetail(id: string) {
    this.router.navigate(['/player/open-play', id]);
  }

  clubName(session: OpenPlaySession): string {
    return session.club?.name ?? '';
  }

  clubLogo(session: OpenPlaySession): string | null {
    return session.club?.logo ?? null;
  }

  clubInitials(session: OpenPlaySession): string {
    return this.clubName(session).split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  join(session: OpenPlaySession) {
    this.joiningId.set(session._id);
    this.joinError.set('');
    this.openPlay.joinSession(session._id).subscribe({
      next: () => {
        this.sessions.update(list =>
          list.map(s => s._id === session._id
            ? { ...s, joined: true, registeredCount: (s.registeredCount ?? 0) + 1 }
            : s
          )
        );
        this.joiningId.set('');
      },
      error: err => {
        this.joinError.set(err.error?.error || 'Failed to join session.');
        this.joiningId.set('');
      },
    });
  }
}
