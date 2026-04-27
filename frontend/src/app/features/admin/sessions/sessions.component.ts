import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SessionsService, Session } from '../../../core/services/sessions.service';

@Component({
  selector: 'app-admin-sessions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="sessions-shell">
      <div class="hero">
        <div>
          <p class="hero-kicker">Baseline Gearhub</p>
          <h2>Admin Sessions</h2>
          <p class="subtitle">
            Professional ledger of courts, players, trainings, rates, and totals.
          </p>
        </div>
        <a routerLink="/admin/sessions/new" class="btn-primary">+ Record Session</a>
      </div>

      @if (!loading && sessions.length > 0) {
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Total Sessions</span>
            <span class="stat-value">{{ sessions.length }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Revenue</span>
            <span class="stat-value">{{
              getTotalRevenue() | currency: 'PHP' : 'symbol' : '1.2-2'
            }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Players Logged</span>
            <span class="stat-value">{{ getTotalPlayersCount() }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Pending Charges</span>
            <span class="stat-value">{{ getUnpaidPlayersCount() }}</span>
          </div>
        </div>
      }

      @if (loading) {
        <div class="loading">Loading sessions...</div>
      } @else if (sessions.length === 0) {
        <div class="empty-state">
          <span>🎾</span>
          <p>No sessions recorded yet.</p>
          <a routerLink="/admin/sessions/new" class="btn-primary">Record First Session</a>
        </div>
      } @else {
        <div class="desktop-view table-wrap">
          <table class="sessions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Courts</th>
                <th>Players</th>
                <th>Trainings</th>
                <th>Rates Used</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (session of sessions; track session._id) {
                <tr>
                  <td>
                    <div class="cell-main">{{ session.date | date: 'EEE, MMM d, y' }}</div>
                    <div class="cell-sub">
                      Created {{ session.createdAt | date: 'MMM d, y h:mm a' }}
                    </div>
                  </td>
                  <td>
                    <div class="cell-main">{{ getSessionTimeRange(session) }}</div>
                    <div class="cell-sub">Ball Boy: {{ session.ballBoyUsed ? 'Yes' : 'No' }}</div>
                  </td>
                  <td>
                    @if (session.courtSessions.length) {
                      <div class="cell-list">
                        @for (
                          court of session.courtSessions;
                          track court.courtLabel + court.startTime + court.endTime
                        ) {
                          <div>
                            <strong>{{ court.courtLabel }}</strong
                            >: {{ court.startTime }}-{{ court.endTime }} ({{
                              court.withLights ? 'With Lights' : 'Without Lights'
                            }}) · {{ court.fee | currency: 'PHP' : 'symbol' : '1.2-2' }}
                          </div>
                        }
                      </div>
                    } @else {
                      <span class="muted">No courts</span>
                    }
                  </td>
                  <td>
                    <table class="mini-table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Games</th>
                          <th>Charges</th>
                          <th>Method</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (player of session.players; track player.playerId) {
                          <tr>
                            <td>{{ player.name }}</td>
                            <td>{{ player.gamesWithoutLight + player.gamesWithLight }}</td>
                            <td>
                              {{ player.charges.total | currency: 'PHP' : 'symbol' : '1.2-2' }}
                            </td>
                            <td>
                              <span class="method-chip">{{
                                player.paymentMethod || 'Not set'
                              }}</span>
                            </td>
                            <td>
                              <span class="status-badge status-{{ player.status }}">{{
                                player.status
                              }}</span>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </td>
                  <td>
                    @if (session.trainings.length) {
                      <div class="cell-list">
                        @for (
                          training of session.trainings;
                          track training.trainerCoach + training.startTime + training.endTime
                        ) {
                          <div>
                            <strong>{{ training.trainerCoach }}</strong>
                            · {{ training.startTime }}-{{ training.endTime }} · 🌙
                            {{ training.withoutLights }} / 💡 {{ training.withLights }} ·
                            {{ training.totalFee | currency: 'PHP' : 'symbol' : '1.2-2' }}
                          </div>
                        }
                      </div>
                    } @else {
                      <span class="muted">No trainings</span>
                    }
                  </td>
                  <td>
                    <div class="cell-list">
                      <div>
                        🌙 No Light:
                        {{
                          session.ratesUsed.withoutLightRate | currency: 'PHP' : 'symbol' : '1.2-2'
                        }}
                      </div>
                      <div>
                        💡 Light:
                        {{ session.ratesUsed.lightRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
                      </div>
                      <div>
                        🏋️ T2 No Light:
                        {{
                          session.ratesUsed.training2WithoutLightRate
                            | currency: 'PHP' : 'symbol' : '1.2-2'
                        }}
                      </div>
                      <div>
                        🏋️ T2 Light:
                        {{
                          session.ratesUsed.training2LightRate
                            | currency: 'PHP' : 'symbol' : '1.2-2'
                        }}
                      </div>
                      <div>
                        🙋 Ball Boy:
                        {{ session.ratesUsed.ballBoyRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
                      </div>
                    </div>
                  </td>
                  <td class="fw-bold">
                    {{ session.totalAmount | currency: 'PHP' : 'symbol' : '1.2-2' }}
                  </td>
                  <td>
                    @if (allPaid(session)) {
                      <span class="badge-paid">All Paid</span>
                    } @else {
                      <span class="badge-unpaid">With Unpaid</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="mobile-view card-list">
          @for (session of sessions; track session._id) {
            <article class="session-card">
              <div class="card-top">
                <div>
                  <p class="card-date">{{ session.date | date: 'EEE, MMM d, y' }}</p>
                  <p class="card-time">{{ getSessionTimeRange(session) }}</p>
                </div>
                @if (allPaid(session)) {
                  <span class="badge-paid">All Paid</span>
                } @else {
                  <span class="badge-unpaid">With Unpaid</span>
                }
              </div>

              <div class="mobile-total">
                {{ session.totalAmount | currency: 'PHP' : 'symbol' : '1.2-2' }}
              </div>

              <div class="mobile-block">
                <h4>Courts</h4>
                @if (session.courtSessions.length) {
                  @for (
                    court of session.courtSessions;
                    track court.courtLabel + court.startTime + court.endTime
                  ) {
                    <p>
                      <strong>{{ court.courtLabel }}</strong> {{ court.startTime }}-{{
                        court.endTime
                      }}
                      · {{ court.withLights ? 'With Lights' : 'Without Lights' }} ·
                      {{ court.fee | currency: 'PHP' : 'symbol' : '1.2-2' }}
                    </p>
                  }
                } @else {
                  <p class="muted">No courts</p>
                }
              </div>

              <div class="mobile-block">
                <h4>Players</h4>
                @for (player of session.players; track player.playerId) {
                  <p>
                    <strong>{{ player.name }}</strong>
                    · {{ player.gamesWithoutLight + player.gamesWithLight }} games ·
                    {{ player.charges.total | currency: 'PHP' : 'symbol' : '1.2-2' }} ·
                    {{ player.paymentMethod || 'Not set' }} ·
                    <span class="status-inline status-{{ player.status }}">{{
                      player.status
                    }}</span>
                  </p>
                }
              </div>

              <div class="mobile-block">
                <h4>Trainings</h4>
                @if (session.trainings.length) {
                  @for (
                    training of session.trainings;
                    track training.trainerCoach + training.startTime + training.endTime
                  ) {
                    <p>
                      <strong>{{ training.trainerCoach }}</strong>
                      · {{ training.startTime }}-{{ training.endTime }} · 🌙
                      {{ training.withoutLights }} / 💡 {{ training.withLights }} ·
                      {{ training.totalFee | currency: 'PHP' : 'symbol' : '1.2-2' }}
                    </p>
                  }
                } @else {
                  <p class="muted">No trainings</p>
                }
              </div>

              <div class="mobile-block">
                <h4>Rates Used</h4>
                <p>
                  🌙 No Light:
                  {{ session.ratesUsed.withoutLightRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
                </p>
                <p>
                  💡 Light: {{ session.ratesUsed.lightRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
                </p>
                <p>
                  🏋️ T2 No Light:
                  {{
                    session.ratesUsed.training2WithoutLightRate
                      | currency: 'PHP' : 'symbol' : '1.2-2'
                  }}
                </p>
                <p>
                  🏋️ T2 Light:
                  {{ session.ratesUsed.training2LightRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
                </p>
                <p>
                  🙋 Ball Boy:
                  {{ session.ratesUsed.ballBoyRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
                </p>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        --surface: #ffffff;
        --panel: #f8fafc;
        --ink: #0f172a;
        --muted: #64748b;
        --line: #e2e8f0;
        --success-bg: #f2e4c9;
        --success-ink: #7a5626;
        --warn-bg: #fef3c7;
        --warn-ink: #92400e;
        display: block;
        font-family: 'Manrope', 'Segoe UI', Tahoma, sans-serif;
      }
      .sessions-shell {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.1rem 1.25rem;
        background: linear-gradient(140deg, #eefbf2 0%, #f8fafc 55%, #fff7ed 100%);
        border: 1px solid #dbeafe;
        border-radius: 14px;
        gap: 1rem;
      }
      .hero-kicker {
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #0f766e;
        margin-bottom: 0.25rem;
        font-weight: 700;
      }
      .hero h2 {
        color: var(--ink);
        font-size: 1.5rem;
        line-height: 1.15;
      }
      .subtitle {
        color: var(--muted);
        font-size: 0.9rem;
        margin-top: 0.25rem;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(140px, 1fr));
        gap: 0.75rem;
      }
      .stat-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 0.75rem 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .stat-label {
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .stat-value {
        color: var(--ink);
        font-size: 1.1rem;
        font-weight: 800;
      }
      .loading {
        color: var(--muted);
        padding: 1.75rem 0.25rem;
      }
      .empty-state {
        text-align: center;
        padding: 2.4rem 1.2rem;
        color: var(--muted);
        border: 1px dashed #cbd5e1;
        background: #fcfffd;
        border-radius: 14px;
      }
      .empty-state span {
        font-size: 3rem;
        display: block;
        margin-bottom: 0.5rem;
      }
      .empty-state p {
        margin-bottom: 1rem;
      }

      .table-wrap {
        background: var(--surface);
        border-radius: 14px;
        border: 1px solid var(--line);
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        overflow-x: auto;
      }
      .sessions-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
      }
      .sessions-table thead th {
        background: var(--panel);
        color: #334155;
        font-size: 0.8rem;
        font-weight: 700;
        text-align: left;
        padding: 0.75rem 0.65rem;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .sessions-table tbody td {
        padding: 0.75rem 0.65rem;
        border-bottom: 1px solid #eef2f7;
        vertical-align: top;
        font-size: 0.84rem;
        word-break: normal;
      }
      .sessions-table tbody tr:hover {
        background: #fcfffd;
      }
      .cell-main {
        font-weight: 600;
        color: var(--ink);
      }
      .cell-sub {
        margin-top: 0.2rem;
        color: var(--muted);
        font-size: 0.78rem;
      }
      .cell-list {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .muted {
        color: #94a3b8;
        font-style: italic;
      }
      .mini-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
      }
      .mini-table th {
        font-size: 0.72rem;
        color: var(--muted);
        text-align: left;
        border-bottom: 1px solid var(--line);
        padding: 0.35rem 0.3rem;
        background: #f8fafc;
      }
      .mini-table td {
        font-size: 0.78rem;
        border-bottom: 1px solid #f1f5f9;
        padding: 0.35rem 0.3rem;
      }
      .badge-paid {
        background: var(--success-bg);
        color: var(--success-ink);
        padding: 0.2rem 0.6rem;
        border-radius: 10px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .badge-unpaid {
        background: var(--warn-bg);
        color: var(--warn-ink);
        padding: 0.2rem 0.6rem;
        border-radius: 10px;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .fw-bold {
        font-weight: 700;
      }
      .status-badge {
        padding: 0.15rem 0.5rem;
        border-radius: 8px;
        font-size: 0.76rem;
        font-weight: 600;
        text-transform: capitalize;
      }
      .status-paid {
        background: var(--success-bg);
        color: var(--success-ink);
      }
      .status-unpaid {
        background: var(--warn-bg);
        color: var(--warn-ink);
      }
      .method-chip {
        background: #e0f2fe;
        color: #0f4c75;
        padding: 0.15rem 0.5rem;
        border-radius: 8px;
        font-size: 0.76rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .desktop-view {
        display: block;
      }
      .mobile-view {
        display: none;
      }
      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .session-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 0.95rem;
        box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
      }
      .card-date {
        font-size: 0.94rem;
        color: var(--ink);
        font-weight: 700;
      }
      .card-time {
        font-size: 0.8rem;
        color: var(--muted);
      }
      .mobile-total {
        margin-top: 0.65rem;
        margin-bottom: 0.45rem;
        color: #0f766e;
        font-size: 1.15rem;
        font-weight: 800;
      }
      .mobile-block {
        padding-top: 0.6rem;
        margin-top: 0.6rem;
        border-top: 1px solid #edf2f7;
      }
      .mobile-block h4 {
        font-size: 0.78rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #475569;
        margin-bottom: 0.35rem;
      }
      .mobile-block p {
        color: #1f2937;
        font-size: 0.8rem;
        line-height: 1.4;
        margin: 0.2rem 0;
      }
      .status-inline {
        font-weight: 700;
        text-transform: capitalize;
      }
      .status-inline.status-paid {
        color: var(--success-ink);
      }
      .status-inline.status-unpaid {
        color: var(--warn-ink);
      }

      @media (max-width: 1100px) {
        .stats-grid {
          grid-template-columns: repeat(2, minmax(140px, 1fr));
        }
      }
      @media (min-width: 1200px) {
        .sessions-shell {
          width: 100%;
          margin-left: 0;
          margin-right: auto;
          padding-left: 0;
          padding-right: 0;
        }
        .hero {
          margin-left: -1rem;
          margin-right: -1rem;
          border-radius: 0;
          padding-left: 1.25rem;
          background-position: left;
        }
        .stats-grid {
          margin-left: -1rem;
          margin-right: -1rem;
          padding-left: 1rem;
          padding-right: 1rem;
        }
        .table-wrap {
          margin-left: -1rem;
          margin-right: -1rem;
          border-radius: 0;
        }
      }
      @media (max-width: 900px) {
        .desktop-view {
          display: none;
        }
        .mobile-view {
          display: block;
        }
      }
      @media (max-width: 700px) {
        .hero {
          flex-direction: column;
          align-items: stretch;
        }
        .stats-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminSessionsComponent implements OnInit {
  sessions: Session[] = [];
  loading = true;

  constructor(
    private sessionsService: SessionsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.sessionsService.getSessions().subscribe({
      next: (s) => {
        this.sessions = s;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  allPaid(session: Session): boolean {
    return session.players.every((p) => p.status === 'paid');
  }

  getSessionTimeRange(session: Session): string {
    return `${session.startTime || '--:--'}${session.endTime ? ' - ' + session.endTime : ''}`;
  }

  getTotalRevenue(): number {
    return this.sessions.reduce((sum, session) => sum + (Number(session.totalAmount) || 0), 0);
  }

  getTotalPlayersCount(): number {
    return this.sessions.reduce((sum, session) => sum + (session.players?.length || 0), 0);
  }

  getUnpaidPlayersCount(): number {
    return this.sessions.reduce(
      (sum, session) =>
        sum + (session.players?.filter((player) => player.status === 'unpaid').length || 0),
      0,
    );
  }
}

