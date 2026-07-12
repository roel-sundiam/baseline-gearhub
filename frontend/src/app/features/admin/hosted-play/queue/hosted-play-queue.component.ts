import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import QRCode from 'qrcode';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  HostedPlayService,
  QueueBoard,
  QueuePlayer,
} from '../../../../core/services/hosted-play.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ClubService, Court } from '../../../../core/services/club.service';

@Component({
  selector: 'app-admin-hosted-play-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="queue-shell">
      <header class="topbar">
        <button class="back-btn" (click)="goBack()" aria-label="Back to hosted play">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="topbar-copy">
          <span class="topbar-kicker">Hosted Play Queue</span>
          <h1>{{ board?.session?.title || 'Queue Board' }}</h1>
        </div>
        <span class="status-pill" [ngClass]="board?.session?.queueStatus">
          <span class="status-dot"></span>{{ statusLabel() }}
        </span>
        <button class="tv-display-btn" (click)="openTvDisplay()" title="Open big-screen display">
          <i class="fas fa-tv"></i> <span class="tv-display-label">TV Display</span>
        </button>
      </header>

      @if (modal) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-icon" [class.modal-icon-danger]="modal.type === 'remove'" [class.modal-icon-end]="modal.type === 'end'">
              <i [class]="modal.type === 'remove' ? 'fas fa-user-xmark' : 'fas fa-flag-checkered'"></i>
            </div>
            <div class="modal-body">
              <p class="modal-title">{{ modal.type === 'remove' ? 'Remove Player' : 'End Session' }}</p>
              <p class="modal-msg">{{ modal.type === 'remove'
                ? 'Remove ' + modal.player!.memberName + ' from the queue? They can be re-added as a walk-in.'
                : 'End this session? The queue will close and attendance will be saved.' }}</p>
            </div>
            <div class="modal-actions">
              <button class="modal-cancel" (click)="closeModal()">Cancel</button>
              <button class="modal-confirm" [class.modal-confirm-danger]="modal.type === 'remove'" [class.modal-confirm-end]="modal.type === 'end'" (click)="confirmModal()">
                {{ modal.type === 'remove' ? 'Remove' : 'End Session' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (qrModal) {
        <div class="modal-backdrop" (click)="closeQrModal()">
          <div class="modal-card qr-modal-card" (click)="$event.stopPropagation()">
            <div class="qr-modal-header">
              <div>
                <p class="modal-title">QR Check-In Code</p>
                <p class="modal-msg">Players scan this to self-check-in.</p>
              </div>
              <button class="qr-close-btn" (click)="closeQrModal()" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            @if (qrModal.generating) {
              <div class="qr-loading"><i class="fas fa-circle-notch fa-spin"></i> Generating…</div>
            } @else if (qrModal.dataUrl) {
              <div class="qr-image-wrap">
                <img [src]="qrModal.dataUrl" alt="QR check-in code" class="qr-image" />
              </div>
              <div class="qr-modal-actions">
                <button class="secondary-btn" (click)="regenerateQr()" [disabled]="qrModal.generating">
                  <i class="fas fa-rotate-right"></i> Regenerate
                </button>
                <a class="primary-small qr-download-btn" [href]="qrModal.dataUrl" [download]="'checkin-qr-' + id + '.png'">
                  <i class="fas fa-download"></i> Download
                </a>
              </div>
            }
          </div>
        </div>
      }

      @if (loading) {
        <div class="state-card"><i class="fas fa-circle-notch fa-spin"></i> Loading queue...</div>
      } @else if (!board) {
        <div class="state-card state-card-error"><i class="fas fa-triangle-exclamation"></i> {{ error || 'Unable to load the queue.' }}</div>
      } @else {
        <main class="queue-page">
          <section class="hero-panel">
            <div class="hero-main">
              <span class="eyebrow"><i class="fas fa-table-list"></i> Live operations</span>
              <div class="hero-title">
                <div class="venue-mark">
                  @if (venueLogo()) {
                    <img [src]="venueLogo()" [alt]="venueLabel()" class="venue-logo-img" />
                  } @else {
                    <span class="venue-initials">{{ venueInitials() }}</span>
                  }
                </div>
                <h2>{{ board.session.title }}</h2>
              </div>
              <p>{{ heroHint() }}</p>
            </div>
            <div class="hero-actions">
              @if (board.session.queueStatus === 'not_started') {
                <button class="primary-action" [disabled]="busy || board.counts.checkedIn < 1" (click)="startQueue()">
                  <i class="fas fa-play"></i> Start Queue
                </button>
              } @else if (board.session.queueStatus !== 'ended') {
                <button class="danger-action" [disabled]="busy" (click)="endSession()">
                  <i class="fas fa-flag-checkered"></i> End Session
                </button>
              } @else {
                <span class="ended-note"><i class="fas fa-circle-check"></i> Session completed</span>
              }
              <span class="sync-note">
                @if (busy) { <i class="fas fa-circle-notch fa-spin"></i> Updating }
                @else {
                  <button class="refresh-btn" [disabled]="busy" (click)="refresh()">
                    <i class="fas fa-rotate-right"></i> Refresh
                  </button>
                  @if (lastUpdated) { <span class="updated-ts">{{ lastUpdated }}</span> }
                }
              </span>
            </div>
          </section>

          <section class="stats-grid" aria-label="Queue summary">
            <div class="stat-card">
              <span class="stat-icon lime"><i class="fas fa-user-check"></i></span>
              <span class="stat-value">{{ board.counts.checkedIn }}</span>
              <span class="stat-label">Checked in</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon teal"><i class="fas fa-list-ol"></i></span>
              <span class="stat-value">{{ board.counts.waiting }}</span>
              <span class="stat-label">Waiting</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon blue"><i class="fas fa-table-tennis-paddle-ball"></i></span>
              <span class="stat-value">{{ board.counts.activeGames }}</span>
              <span class="stat-label">Active games</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon amber"><i class="fas fa-pause"></i></span>
              <span class="stat-value">{{ board.counts.paused }}</span>
              <span class="stat-label">Paused</span>
            </div>
          </section>

          @if (error) {
            <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ error }}</div>
          }

          <div class="content-grid">
            <div class="primary-column">
              @if (board.session.queueStatus !== 'not_started') {
                <section class="panel">
                  <div class="panel-head">
                    <div>
                      <span class="panel-kicker">Courts</span>
                      <h3>Active Court Board</h3>
                    </div>
                    <span class="panel-count">{{ board.session.numberOfCourts }} courts</span>
                  </div>

                  <div class="courts-grid">
                    @for (c of board.courts; track c.courtNumber) {
                      <article class="court-card" [class.empty]="c.players.length === 0">
                        <div class="court-top">
                          <span class="court-title">Court {{ c.courtNumber }}</span>
                          @if (c.players.length > 0 && board.session.queueStatus === 'running') {
                            <div class="court-top-actions">
                              @if (c.players.length < board.session.playersPerCourt) {
                                <button class="add-player-btn" [disabled]="busy" (click)="beginAssign(c.courtNumber)" title="Fill open slot">
                                  <i class="fas fa-user-plus"></i> Add Player
                                </button>
                              }
                              @if (confirmingFinishCourt === c.courtNumber) {
                                <button class="finish-btn finish-btn--confirm" [disabled]="busy" (click)="confirmFinish(c.courtNumber)">
                                  <i class="fas fa-exclamation"></i> Confirm?
                                </button>
                                <button class="finish-btn finish-btn--cancel" [disabled]="busy" (click)="cancelFinish()">
                                  Cancel
                                </button>
                              } @else {
                                <button class="finish-btn" [disabled]="busy" (click)="requestFinish(c.courtNumber)">
                                  <i class="fas fa-check"></i> Finish
                                </button>
                              }
                            </div>
                          }
                        </div>

                        @if (c.players.length === 0) {
                          <div class="empty-court">
                            <i class="fas fa-hourglass-half"></i>
                            <span>Waiting for players</span>
                            @if (board.session.queueStatus === 'running') {
                              <button class="text-action" [disabled]="busy" (click)="beginAssign(c.courtNumber)">Assign manually</button>
                            }
                          </div>
                        } @else {
                          <div class="court-players">
                            @for (p of c.players; track p._id) {
                              <div class="player-chip">
                                <div class="avatar">{{ initials(p.memberName) }}</div>
                                <div class="player-main">
                                  <span class="player-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                                  <span class="player-meta">{{ p.gamesPlayed }} games played</span>
                                </div>
                                <div class="row-actions">
                                  <button class="icon-btn" title="Pause" [disabled]="busy" (click)="pause(p)"><i class="fas fa-pause"></i></button>
                                  <button class="icon-btn danger" title="Remove" [disabled]="busy" (click)="remove(p)"><i class="fas fa-xmark"></i></button>
                                </div>
                              </div>
                            }
                          </div>
                        }
                      </article>
                    }
                  </div>
                </section>

                <section class="panel">
                  <div class="panel-head">
                    <div>
                      <span class="panel-kicker">Rotation</span>
                      <h3>Waiting Queue</h3>
                    </div>
                    <span class="panel-count">{{ board.waiting.length }} waiting</span>
                  </div>

                  @if (assigningCourt !== null) {
                    <div class="assign-panel">
                      <div class="assign-copy">
                        <strong>Assign Court {{ assigningCourt }}</strong>
                        @if (assignablePlayers.length === 0) {
                          <span>No available players. Add a walk-in first.</span>
                        } @else {
                          <span>Select up to {{ board.session.playersPerCourt }} players ({{ selectedIds.size }} selected).</span>
                        }
                      </div>
                      <div class="assign-actions">
                        <button class="secondary-btn" (click)="cancelAssign()">Cancel</button>
                        @if (assignablePlayers.length > 0) {
                          <button class="primary-small" [disabled]="busy || selectedIds.size === 0" (click)="confirmAssign()">Assign</button>
                        }
                      </div>
                    </div>

                    @if (assignablePlayers.length > 0) {
                      <div class="queue-list assign-list">
                        @for (p of assignablePlayers; track p._id) {
                          <button class="queue-row selectable" [class.selected]="selectedIds.has(p._id)" (click)="toggleSelect(p)">
                            <span class="avatar selectable-avatar">
                              {{ initials(p.memberName) }}
                              @if (selectedIds.has(p._id)) {
                                <span class="select-badge"><i class="fas fa-check"></i></span>
                              }
                            </span>
                            <span class="q-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                            <span class="q-games">{{ p.gamesPlayed }} games</span>
                            <span class="state-tag" [ngClass]="p.queueStatus">{{ stateLabel(p) }}</span>
                          </button>
                        }
                      </div>
                    }
                  }

                  @if (board.waiting.length === 0) {
                    @if (assigningCourt === null) {
                      <div class="empty-panel">
                        <i class="fas fa-list"></i>
                        <span>No players waiting.</span>
                      </div>
                    }
                  } @else {
                    <div class="queue-list">
                      @for (p of board.waiting; track p._id; let i = $index) {
                        <div class="queue-row">
                          <span class="queue-rank">{{ i + 1 }}</span>
                          <span class="q-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                          <span class="q-games">{{ p.gamesPlayed }} games</span>
                          <div class="row-actions">
                            <button class="icon-btn" title="Move up" [disabled]="busy || i === 0" (click)="move(p, -1)"><i class="fas fa-chevron-up"></i></button>
                            <button class="icon-btn" title="Move down" [disabled]="busy || i === board.waiting.length - 1" (click)="move(p, 1)"><i class="fas fa-chevron-down"></i></button>
                            <button class="icon-btn" title="Skip to back" [disabled]="busy" (click)="skip(p)"><i class="fas fa-angles-down"></i></button>
                            <button class="icon-btn" title="Pause" [disabled]="busy" (click)="pause(p)"><i class="fas fa-pause"></i></button>
                            <button class="icon-btn danger" title="Remove" [disabled]="busy" (click)="remove(p)"><i class="fas fa-xmark"></i></button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </section>

                @if (board.paused.length > 0) {
                  <section class="panel">
                    <div class="panel-head">
                      <div>
                        <span class="panel-kicker">Hold list</span>
                        <h3>Paused Players</h3>
                      </div>
                      <span class="panel-count">{{ board.paused.length }} paused</span>
                    </div>
                    <div class="queue-list">
                      @for (p of board.paused; track p._id) {
                        <div class="queue-row">
                          <span class="queue-rank pause-rank"><i class="fas fa-pause"></i></span>
                          <span class="q-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                          <span class="q-games">{{ p.gamesPlayed }} games</span>
                          <div class="row-actions">
                            <button class="primary-small" [disabled]="busy" (click)="resume(p)">Resume</button>
                            <button class="icon-btn danger" title="Remove" [disabled]="busy" (click)="remove(p)"><i class="fas fa-xmark"></i></button>
                          </div>
                        </div>
                      }
                    </div>
                  </section>
                }
              } @else {
                <section class="panel start-panel">
                  <i class="fas fa-clipboard-check"></i>
                  <h3>Check players in before starting</h3>
                  <p>Once the queue starts, checked-in players will be assigned to courts automatically.</p>
                </section>
              }
            </div>

            <aside class="side-column">
              <section class="panel checkin-panel">
                <div class="panel-head">
                  <div>
                    <span class="panel-kicker">Attendance</span>
                    <h3>Check-In</h3>
                  </div>
                  <div class="panel-head-right">
                    <span class="panel-count">{{ checkedInCount() }}/{{ board.roster.length }}</span>
                    @if (board.session.queueStatus !== 'ended') {
                      <button class="qr-btn" (click)="showQr()" title="Show QR check-in code">
                        <i class="fas fa-qrcode"></i>
                      </button>
                    }
                  </div>
                </div>

                @if (board.session.queueStatus !== 'ended') {
                  <div class="walkin-card">
                    <label for="walkin-name">Walk-in player</label>
                    <div class="walkin-row">
                      <input id="walkin-name" type="text" placeholder="Player name" [(ngModel)]="walkInName" (keyup.enter)="addWalkIn()" />
                      <button class="primary-small" [disabled]="busy || !walkInName.trim()" (click)="addWalkIn()">
                        <i class="fas fa-user-plus"></i> Add
                      </button>
                    </div>
                    @if ((board.session.totalPerPlayer ?? 0) > 0) {
                      <p class="walkin-fee-note">
                        <i class="fas fa-coins"></i>
                        Collect <strong>₱{{ board.session.totalPerPlayer }}</strong> cash
                        @if ((board.session.convenienceFeePerPlayer ?? 0) > 0) {
                          <span class="walkin-fee-breakdown">(₱{{ board.session.feePerPlayer }} + ₱{{ board.session.convenienceFeePerPlayer }} service fee)</span>
                        }
                        — recorded automatically on Add.
                      </p>
                    }
                  </div>
                }

                @if (board.roster.length === 0) {
                  <div class="empty-panel">
                    <i class="fas fa-user-slash"></i>
                    <span>No one has joined this session yet.</span>
                  </div>
                } @else {
                  <div class="roster-list">
                    @for (p of board.roster; track p._id) {
                      <button
                        type="button"
                        class="roster-row"
                        [class.checked]="p.checkedIn"
                        [disabled]="busy || board.session.queueStatus === 'ended'"
                        (click)="toggleCheckIn(p)"
                      >
                        <span class="avatar small roster-avatar">
                          {{ initials(p.memberName) }}
                          @if (p.checkedIn) {
                            <span class="select-badge"><i class="fas fa-check"></i></span>
                          }
                        </span>
                        <span class="roster-main">
                          <span class="roster-name">{{ p.memberName }}@if (p.isWalkIn) { <span class="walk">Walk-in</span> }</span>
                          <span class="roster-meta">{{ p.gamesPlayed }} games</span>
                        </span>
                        <span class="state-tag" [ngClass]="p.queueStatus">{{ stateLabel(p) }}</span>
                      </button>
                    }
                  </div>
                }
              </section>
            </aside>
          </div>
        </main>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #07130d;
      --surface: #12251d;
      --surface-2: #19352a;
      --panel: rgba(18, 37, 29, .94);
      --border: rgba(255,255,255,.1);
      --text: #fff;
      --muted: rgba(255,255,255,.62);
      --soft: rgba(255,255,255,.42);
      --accent: #a3e635;
      --teal: #14b8a6;
      --blue: #38bdf8;
      --amber: #f59e0b;
      --danger: #f87171;
      --shadow: 0 18px 50px rgba(0,0,0,.32);
    }

    .queue-shell {
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.13), transparent 28rem),
        linear-gradient(180deg, #0b1b12 0%, var(--bg) 34rem);
      padding: 0 1rem 2rem;
    }

    .topbar {
      max-width: 1280px;
      margin: 0 auto;
      min-height: 74px;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: .85rem;
      padding: .85rem 0;
      position: sticky;
      top: 0;
      z-index: 20;
      background: linear-gradient(180deg, rgba(7,19,13,.98), rgba(7,19,13,.88));
      backdrop-filter: blur(10px);
    }

    .back-btn {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.1);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .topbar-copy { min-width: 0; }
    .topbar-kicker { display: block; color: var(--accent); font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .15rem; }
    .topbar h1 { margin: 0; font-size: 1.05rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      white-space: nowrap;
      font-size: .72rem;
      font-weight: 900;
      border-radius: 999px;
      padding: .42rem .75rem;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--muted);
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.1);
    }
    .status-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
    .status-pill.running { color: var(--accent); background: rgba(163,230,53,.14); border-color: rgba(163,230,53,.22); }
    .status-pill.paused { color: var(--amber); background: rgba(245,158,11,.13); border-color: rgba(245,158,11,.22); }
    .status-pill.ended { color: #fca5a5; background: rgba(239,68,68,.13); border-color: rgba(239,68,68,.22); }

    .tv-display-btn {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      white-space: nowrap;
      font-family: inherit;
      font-size: .78rem;
      font-weight: 900;
      border-radius: 999px;
      padding: .5rem .85rem;
      color: var(--accent);
      background: rgba(163,230,53,.1);
      border: 1px solid rgba(163,230,53,.22);
      cursor: pointer;
      transition: background .15s, transform .15s;
    }
    .tv-display-btn:hover { background: rgba(163,230,53,.2); }
    .tv-display-btn:active { transform: scale(.96); }

    .state-card {
      max-width: 520px;
      margin: 3rem auto;
      min-height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .65rem;
      color: var(--muted);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      font-weight: 800;
    }
    .state-card-error { color: #fca5a5; }

    .queue-page { max-width: 1280px; margin: 0 auto; }

    .hero-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: end;
      padding: 1.25rem;
      background:
        linear-gradient(135deg, rgba(25,53,42,.94), rgba(9,27,17,.96)),
        url('/tennis-court-surface.png') center / cover;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      box-shadow: var(--shadow);
      overflow: hidden;
      position: relative;
    }
    .hero-panel::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7,19,13,.18), rgba(7,19,13,.7));
      pointer-events: none;
    }
    .hero-panel > * { position: relative; z-index: 1; }
    .eyebrow { display: inline-flex; align-items: center; gap: .45rem; color: var(--accent); font-size: .75rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .55rem; }
    .hero-title { display: flex; align-items: center; gap: .9rem; min-width: 0; }
    .venue-mark { width: 58px; height: 58px; border-radius: 8px; background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.2); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 58px; box-shadow: 0 12px 24px rgba(0,0,0,.18); }
    .venue-logo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .venue-initials { font-size: .9rem; font-weight: 950; letter-spacing: .02em; text-transform: uppercase; }
    .hero-main h2 { margin: 0; font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1; letter-spacing: 0; }
    .hero-main p { margin: .75rem 0 0; color: rgba(255,255,255,.73); line-height: 1.5; max-width: 650px; }
    .hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: .65rem; }
    .sync-note { display: inline-flex; align-items: center; gap: .5rem; color: rgba(255,255,255,.58); font-size: .78rem; font-weight: 800; flex-wrap: wrap; }
    .refresh-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .75rem; border-radius: 8px; background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.25); color: #a3e635; font-size: .78rem; font-weight: 900; font-family: inherit; cursor: pointer; transition: background .15s, transform .15s; }
    .refresh-btn:hover:not(:disabled) { background: rgba(163,230,53,.22); }
    .refresh-btn:active:not(:disabled) { transform: scale(.95); }
    .refresh-btn:disabled { opacity: .5; cursor: not-allowed; }
    .updated-ts { color: rgba(255,255,255,.38); font-size: .72rem; font-weight: 700; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: .85rem;
      margin: 1rem 0;
    }
    .stat-card {
      min-height: 104px;
      padding: .9rem;
      border-radius: 8px;
      background: var(--panel);
      border: 1px solid var(--border);
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-areas: "icon value" "icon label";
      column-gap: .8rem;
      align-items: center;
    }
    .stat-icon { grid-area: icon; width: 42px; height: 42px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
    .stat-icon.lime { color: var(--accent); background: rgba(163,230,53,.14); }
    .stat-icon.teal { color: var(--teal); background: rgba(20,184,166,.14); }
    .stat-icon.blue { color: var(--blue); background: rgba(56,189,248,.14); }
    .stat-icon.amber { color: var(--amber); background: rgba(245,158,11,.14); }
    .stat-value { grid-area: value; color: var(--text); font-size: 1.65rem; line-height: 1; font-weight: 950; }
    .stat-label { grid-area: label; color: var(--muted); font-size: .78rem; font-weight: 800; }

    .content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
      gap: 1rem;
      align-items: start;
    }
    .primary-column, .side-column { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .side-column { position: sticky; top: 88px; }

    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 12px 32px rgba(0,0,0,.2);
    }
    .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: .9rem; }
    .panel-kicker { color: var(--soft); font-size: .7rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .panel h3 { margin: .12rem 0 0; font-size: 1.05rem; line-height: 1.2; }
    .panel-count { white-space: nowrap; color: var(--muted); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 999px; padding: .3rem .65rem; font-size: .72rem; font-weight: 900; }

    .courts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: .85rem; }
    .court-card {
      min-height: 190px;
      padding: .9rem;
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
    }
    .court-card.empty { border-style: dashed; }
    .court-top { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .8rem; }
    .court-top-actions { display: flex; align-items: center; gap: .4rem; }
    .court-title { font-size: .95rem; font-weight: 950; }
    .add-player-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .4rem .65rem; border-radius: 8px; border: 1px solid rgba(163,230,53,.3); background: rgba(163,230,53,.08); color: var(--accent); font-size: .74rem; font-weight: 950; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .add-player-btn:hover:not(:disabled) { background: rgba(163,230,53,.15); }
    .add-player-btn:disabled { opacity: .4; cursor: not-allowed; }
    .empty-court { min-height: 128px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .55rem; color: var(--muted); text-align: center; }
    .empty-court i { color: var(--accent); font-size: 1.25rem; opacity: .8; }
    .court-players, .queue-list, .roster-list { display: flex; flex-direction: column; gap: .55rem; }

    .player-chip, .queue-row, .roster-row {
      display: flex;
      align-items: center;
      gap: .65rem;
      min-width: 0;
      border-radius: 8px;
      background: rgba(255,255,255,.045);
      border: 1px solid rgba(255,255,255,.08);
    }
    .player-chip { padding: .62rem; }
    .queue-row { padding: .62rem .7rem; }
    .roster-row {
      padding: .58rem .65rem;
      cursor: pointer;
      width: 100%;
      color: inherit;
      font-family: inherit;
      text-align: left;
      transition: background .16s, border-color .16s, transform .16s;
    }
    .roster-row:hover:not(:disabled) { background: rgba(255,255,255,.075); border-color: rgba(255,255,255,.14); }
    .roster-row:active:not(:disabled) { transform: translateY(1px); }
    .roster-row:disabled { opacity: .62; cursor: not-allowed; }
    .queue-row.selected, .roster-row.checked { border-color: rgba(163,230,53,.32); background: rgba(163,230,53,.06); }
    .selectable {
      width: 100%;
      color: inherit;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      transition: background .16s, border-color .16s, transform .16s;
    }
    .selectable:hover { background: rgba(255,255,255,.075); border-color: rgba(255,255,255,.14); }
    .selectable.selected { background: rgba(163,230,53,.1); border-color: rgba(163,230,53,.42); box-shadow: inset 0 0 0 1px rgba(163,230,53,.12); }
    .selectable:active { transform: translateY(1px); }

    .avatar, .queue-rank {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      border-radius: 50%;
      background: rgba(163,230,53,.14);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .78rem;
      font-weight: 950;
    }
    .avatar.small { width: 30px; height: 30px; flex-basis: 30px; font-size: .72rem; }
    .roster-avatar { position: relative; }
    .roster-row.checked .roster-avatar {
      color: #07130d;
      background: var(--accent);
    }
    .selectable-avatar {
      position: relative;
      transition: background .16s, color .16s;
    }
    .selectable.selected .selectable-avatar {
      color: #07130d;
      background: var(--accent);
    }
    .select-badge {
      position: absolute;
      right: -4px;
      bottom: -4px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #07130d;
      color: var(--accent);
      border: 2px solid var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .58rem;
      line-height: 1;
    }
    .pause-rank { color: var(--amber); background: rgba(245,158,11,.14); }

    .player-main, .roster-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .12rem; }
    .player-name, .q-name, .roster-name { color: var(--text); font-size: .9rem; font-weight: 850; min-width: 0; overflow-wrap: anywhere; }
    .player-meta, .roster-meta, .q-games { color: var(--muted); font-size: .74rem; font-weight: 750; white-space: nowrap; }
    .q-name { flex: 1; }

    .walk {
      display: inline-flex;
      vertical-align: middle;
      margin-left: .35rem;
      color: var(--blue);
      background: rgba(56,189,248,.14);
      border: 1px solid rgba(56,189,248,.16);
      border-radius: 999px;
      padding: .08rem .38rem;
      font-size: .58rem;
      font-weight: 950;
      text-transform: uppercase;
    }

    .row-actions { display: flex; align-items: center; justify-content: flex-end; gap: .3rem; flex-shrink: 0; }
    .icon-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.055);
      color: var(--text);
      cursor: pointer;
      font-size: .78rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon-btn:hover:not(:disabled) { background: rgba(255,255,255,.12); }
    .icon-btn:disabled { opacity: .36; cursor: not-allowed; }
    .icon-btn.danger { color: #fca5a5; border-color: rgba(239,68,68,.25); }

    .primary-action, .danger-action, .primary-small, .secondary-btn, .finish-btn, .text-action {
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      border-radius: 8px;
      font-weight: 950;
      border: 0;
      white-space: nowrap;
    }
    .primary-action { min-height: 48px; padding: .85rem 1.15rem; background: var(--accent); color: #07130d; box-shadow: 0 12px 24px rgba(163,230,53,.18); }
    .danger-action { min-height: 48px; padding: .85rem 1.15rem; background: rgba(239,68,68,.13); color: #fca5a5; border: 1px solid rgba(239,68,68,.28); }
    .primary-small, .finish-btn { min-height: 36px; padding: .48rem .78rem; background: var(--accent); color: #07130d; font-size: .78rem; }
    .finish-btn--confirm { background: #f97316; color: #fff; animation: pulse .6s ease-in-out infinite alternate; }
    .finish-btn--cancel { background: rgba(255,255,255,.08); color: var(--text); border: 1px solid var(--border); }
    @keyframes pulse { from { opacity: 1; } to { opacity: .75; } }
    .secondary-btn { min-height: 36px; padding: .48rem .78rem; background: rgba(255,255,255,.07); color: var(--text); border: 1px solid var(--border); font-size: .78rem; }
    .text-action { padding: .35rem .65rem; color: var(--accent); background: rgba(163,230,53,.09); border: 1px solid rgba(163,230,53,.18); font-size: .76rem; }
    button:disabled { opacity: .48; cursor: not-allowed; }

    .assign-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: .8rem;
      margin-bottom: .8rem;
      border-radius: 8px;
      background: rgba(163,230,53,.09);
      border: 1px solid rgba(163,230,53,.22);
    }
    .assign-copy { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
    .assign-copy strong { color: var(--text); font-size: .88rem; }
    .assign-copy span { color: var(--muted); font-size: .78rem; line-height: 1.35; }
    .assign-actions { display: flex; gap: .5rem; }

    .walkin-card {
      padding: .75rem;
      margin-bottom: .9rem;
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
    }
    .walkin-card label { display: block; margin-bottom: .45rem; color: var(--muted); font-size: .75rem; font-weight: 900; }
    .walkin-fee-note { margin: .55rem 0 0; font-size: .76rem; color: rgba(255,255,255,.55); display: flex; align-items: center; flex-wrap: wrap; gap: .3rem; }
    .walkin-fee-note i { color: #a3e635; font-size: .7rem; }
    .walkin-fee-note strong { color: #a3e635; }
    .walkin-fee-breakdown { color: rgba(255,255,255,.38); }
    .walkin-row { display: flex; gap: .5rem; }
    .walkin-row input {
      flex: 1;
      min-width: 0;
      padding: .62rem .7rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.055);
      color: var(--text);
      outline: none;
      font-family: inherit;
      font-size: .88rem;
    }

    .state-tag {
      flex-shrink: 0;
      color: var(--muted);
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 999px;
      padding: .22rem .55rem;
      font-size: .66rem;
      font-weight: 950;
      text-transform: capitalize;
      white-space: nowrap;
    }
    .state-tag.waiting { color: var(--accent); background: rgba(163,230,53,.13); border-color: rgba(163,230,53,.18); }
    .state-tag.playing { color: var(--blue); background: rgba(56,189,248,.13); border-color: rgba(56,189,248,.18); }
    .state-tag.paused { color: var(--amber); background: rgba(245,158,11,.13); border-color: rgba(245,158,11,.18); }
    .state-tag.done { color: rgba(255,255,255,.75); }

    .empty-panel, .start-panel {
      min-height: 120px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .55rem;
      text-align: center;
      color: var(--muted);
      border-radius: 8px;
      border: 1px dashed rgba(255,255,255,.12);
      background: rgba(255,255,255,.025);
    }
    .empty-panel i, .start-panel i { color: var(--accent); font-size: 1.35rem; }
    .start-panel h3 { margin: .2rem 0 0; color: var(--text); }
    .start-panel p { max-width: 480px; margin: 0; line-height: 1.5; }
    .ended-note { color: var(--muted); font-weight: 850; display: inline-flex; align-items: center; gap: .45rem; }
    .ended-note i { color: var(--accent); }

    .alert {
      margin: 0 0 1rem;
      padding: .7rem .85rem;
      border-radius: 8px;
      font-size: .84rem;
      background: rgba(239,68,68,.1);
      border: 1px solid rgba(239,68,68,.25);
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: .5rem;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(0,0,0,.68);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-card {
      width: 100%;
      max-width: 390px;
      padding: 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #12251d;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(0,0,0,.58);
    }
    .modal-icon { width: 52px; height: 52px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
    .modal-icon-danger { color: #fca5a5; background: rgba(239,68,68,.12); }
    .modal-icon-end { color: var(--amber); background: rgba(245,158,11,.12); }
    .modal-title { margin: 0; color: var(--text); font-size: 1.05rem; font-weight: 950; }
    .modal-msg { margin: .32rem 0 0; color: var(--muted); line-height: 1.5; font-size: .9rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: .6rem; }
    .modal-cancel, .modal-confirm {
      min-height: 40px;
      padding: .55rem .95rem;
      border-radius: 8px;
      font-family: inherit;
      font-weight: 900;
      cursor: pointer;
    }
    .modal-cancel { color: var(--text); border: 1px solid var(--border); background: rgba(255,255,255,.06); }
    .modal-confirm-danger { color: #fca5a5; border: 1px solid rgba(239,68,68,.32); background: rgba(239,68,68,.16); }
    .modal-confirm-end { color: var(--amber); border: 1px solid rgba(245,158,11,.32); background: rgba(245,158,11,.15); }

    .panel-head-right { display: flex; align-items: center; gap: .55rem; }
    .qr-btn {
      width: 36px; height: 36px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 8px; border: 1px solid rgba(163,230,53,.28);
      background: rgba(163,230,53,.1); color: var(--accent);
      font-size: .95rem; cursor: pointer; transition: background .15s;
    }
    .qr-btn:hover { background: rgba(163,230,53,.2); }

    .qr-modal-card { max-width: 340px; }
    .qr-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
    .qr-close-btn {
      flex-shrink: 0; width: 32px; height: 32px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 6px; border: 1px solid var(--border);
      background: rgba(255,255,255,.06); color: var(--muted); cursor: pointer;
    }
    .qr-close-btn:hover { background: rgba(255,255,255,.12); color: var(--text); }
    .qr-loading { padding: 2rem; text-align: center; color: var(--muted); }
    .qr-image-wrap {
      display: flex; align-items: center; justify-content: center;
      padding: 1rem; background: #fff; border-radius: 8px;
    }
    .qr-image { width: 220px; height: 220px; display: block; }
    .qr-modal-actions { display: flex; gap: .6rem; justify-content: flex-end; }
    .qr-download-btn {
      display: inline-flex; align-items: center; gap: .4rem;
      text-decoration: none; cursor: pointer;
      border-radius: 8px; border: 0;
    }

    @media (max-width: 980px) {
      .content-grid { grid-template-columns: 1fr; }
      .side-column { position: static; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 720px) {
      .queue-shell { padding-inline: .75rem; }
      .topbar { grid-template-columns: 42px minmax(0, 1fr); }
      .status-pill, .tv-display-btn { grid-column: 1 / -1; justify-self: start; }
      .hero-panel { grid-template-columns: 1fr; padding: 1rem; }
      .venue-mark { width: 48px; height: 48px; flex-basis: 48px; }
      .hero-actions { align-items: stretch; }
      .primary-action, .danger-action { width: 100%; }
      .courts-grid { grid-template-columns: 1fr; }
      .panel { padding: .85rem; }
      .queue-row { align-items: flex-start; flex-wrap: wrap; }
      .q-name { min-width: calc(100% - 50px); }
      .q-games { margin-left: 49px; }
      .row-actions { width: 100%; margin-left: 49px; justify-content: flex-start; flex-wrap: wrap; }
      .assign-panel, .walkin-row { flex-direction: column; align-items: stretch; }
      .assign-actions { width: 100%; }
      .assign-actions > * { flex: 1; }
      .roster-row {
        align-items: center;
        flex-wrap: nowrap;
        gap: .55rem;
        min-height: 50px;
      }
      .roster-main {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: .4rem;
      }
      .roster-name {
        display: inline-block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .roster-meta {
        display: inline-flex;
        flex-shrink: 0;
        font-size: .68rem;
        color: rgba(255,255,255,.48);
      }
      .roster-row .state-tag {
        margin-left: 0;
        max-width: 96px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .player-chip {
        align-items: center;
        flex-wrap: nowrap;
        gap: .55rem;
        min-height: 50px;
      }
      .player-main {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: .4rem;
      }
      .player-name {
        display: inline-block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .player-meta {
        flex-shrink: 0;
        font-size: .68rem;
        color: rgba(255,255,255,.48);
      }
      .player-chip .row-actions {
        width: auto;
        margin-left: 0;
        justify-content: flex-end;
        flex-wrap: nowrap;
      }
      .player-chip .icon-btn {
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
      }
    }

    @media (max-width: 440px) {
      .stats-grid { grid-template-columns: 1fr; }
      .stat-card { min-height: 82px; }
      .hero-title { gap: .65rem; }
      .hero-main h2 { font-size: 1.8rem; }
      .venue-mark { width: 42px; height: 42px; flex-basis: 42px; }
      .venue-initials { font-size: .72rem; }
      .player-chip { padding: .55rem; }
      .player-meta { max-width: 48px; overflow: hidden; text-overflow: ellipsis; }
      .modal-actions { flex-direction: column-reverse; }
      .modal-actions > * { width: 100%; }
    }
  `],
})
export class AdminHostedPlayQueueComponent implements OnInit {
  id = '';
  board: QueueBoard | null = null;
  loading = true;
  error = '';
  busy = false;
  walkInName = '';
  confirmingFinishCourt: number | null = null;
  private finishConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  lastUpdated = '';
  clubCourts: Court[] = [];

  modal: { type: 'remove' | 'end'; player?: QueuePlayer } | null = null;
  qrModal: { generating: boolean; dataUrl?: string } | null = null;

  assigningCourt: number | null = null;
  selectedIds = new Set<string>();

  constructor(
    private hp: HostedPlayService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private clubService: ClubService,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (club) => { this.clubCourts = club.courts ?? []; this.cdr.detectChanges(); },
        error: () => {},
      });
    }
    this.hp.getQueue(this.id).subscribe({
      next: (b) => { this.setBoard(b); this.loading = false; this.cdr.detectChanges(); },
      error: (err) => { this.loading = false; this.error = err?.error?.error || 'Failed to load queue.'; this.cdr.detectChanges(); },
    });
  }

  refresh() {
    if (this.busy) return;
    this.busy = true;
    this.cdr.detectChanges();
    this.hp.getQueue(this.id).subscribe({
      next: (b) => { this.setBoard(b); this.busy = false; this.cdr.detectChanges(); },
      error: () => { this.busy = false; this.cdr.detectChanges(); },
    });
  }

  private setBoard(b: QueueBoard) {
    this.board = b;
    this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private act(obs: Observable<QueueBoard>) {
    this.busy = true;
    this.error = '';
    this.cdr.detectChanges();
    obs.subscribe({
      next: (b) => { this.setBoard(b); this.busy = false; this.cdr.detectChanges(); },
      error: (err) => { this.busy = false; this.error = err?.error?.error || 'Action failed.'; this.cdr.detectChanges(); },
    });
  }

  statusLabel(): string {
    const s = this.board?.session?.queueStatus;
    return s === 'running' ? 'Live' : s === 'paused' ? 'Paused' : s === 'ended' ? 'Ended' : 'Not started';
  }

  stateLabel(p: QueuePlayer): string {
    switch (p.queueStatus) {
      case 'waiting': return 'Waiting';
      case 'playing': return 'Playing - C' + (p.courtNumber ?? '');
      case 'paused': return 'Paused';
      case 'done': return 'Done';
      default: return p.checkedIn ? 'Ready' : 'Not in';
    }
  }

  heroHint(): string {
    if (!this.board) return '';
    const status = this.board.session.queueStatus;
    if (status === 'not_started') return 'Check players in, add walk-ins, then start automatic court rotation.';
    if (status === 'ended') return 'This queue has ended. Attendance and game counts are preserved.';
    return 'Monitor active courts, manage the waiting list, and keep rotation moving.';
  }

  checkedInCount(): number {
    return this.board?.roster.filter(p => p.checkedIn).length ?? 0;
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  courtForSession(): Court | undefined {
    const session = this.board?.session;
    const venue = (session?.venue || '').trim().toLowerCase();
    const court = (session?.court || '').trim().toLowerCase();
    return this.clubCourts.find(c => {
      const name = c.name.trim().toLowerCase();
      return name === venue || (!!court && name === court);
    });
  }

  venueLogo(): string {
    return this.courtForSession()?.logo || '';
  }

  venueLabel(): string {
    const session = this.board?.session;
    return this.courtForSession()?.name || session?.court || session?.venue || session?.title || 'Venue';
  }

  venueInitials(): string {
    const parts = this.venueLabel().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  startQueue() { this.act(this.hp.startQueue(this.id)); }

  endSession() { this.modal = { type: 'end' }; this.cdr.detectChanges(); }

  toggleCheckIn(p: QueuePlayer) { this.act(this.hp.checkIn(this.id, p._id, !p.checkedIn)); }

  addWalkIn() {
    const name = this.walkInName.trim();
    if (!name) return;
    this.walkInName = '';
    this.act(this.hp.addWalkIn(this.id, name));
  }

  requestFinish(court: number) {
    this.confirmingFinishCourt = court;
    this.cdr.detectChanges();
    if (this.finishConfirmTimer) clearTimeout(this.finishConfirmTimer);
    this.finishConfirmTimer = setTimeout(() => {
      this.confirmingFinishCourt = null;
      this.finishConfirmTimer = null;
      this.cdr.detectChanges();
    }, 4000);
  }

  confirmFinish(court: number) {
    if (this.finishConfirmTimer) { clearTimeout(this.finishConfirmTimer); this.finishConfirmTimer = null; }
    this.confirmingFinishCourt = null;
    this.act(this.hp.finishCourt(this.id, court));
  }

  cancelFinish() {
    if (this.finishConfirmTimer) { clearTimeout(this.finishConfirmTimer); this.finishConfirmTimer = null; }
    this.confirmingFinishCourt = null;
    this.cdr.detectChanges();
  }

  pause(p: QueuePlayer) { this.act(this.hp.pausePlayer(this.id, p._id)); }
  resume(p: QueuePlayer) { this.act(this.hp.resumePlayer(this.id, p._id)); }
  skip(p: QueuePlayer) { this.act(this.hp.skipPlayer(this.id, p._id)); }
  remove(p: QueuePlayer) { this.modal = { type: 'remove', player: p }; this.cdr.detectChanges(); }

  closeModal() { this.modal = null; this.cdr.detectChanges(); }

  confirmModal() {
    if (!this.modal) return;
    const m = this.modal;
    this.modal = null;
    if (m.type === 'remove' && m.player) this.act(this.hp.removeFromQueue(this.id, m.player._id));
    else if (m.type === 'end') this.act(this.hp.endQueue(this.id));
    this.cdr.detectChanges();
  }

  move(p: QueuePlayer, dir: -1 | 1) {
    if (!this.board) return;
    const ids = this.board.waiting.map((x) => x._id);
    const i = ids.indexOf(p._id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.act(this.hp.reorderQueue(this.id, ids));
  }

  get assignablePlayers(): QueuePlayer[] {
    if (!this.board) return [];
    return this.board.roster.filter(
      (p) => p.checkedIn && ['waiting', 'paused', 'done'].includes(p.queueStatus),
    );
  }

  beginAssign(court: number) { this.assigningCourt = court; this.selectedIds.clear(); this.cdr.detectChanges(); }
  cancelAssign() { this.assigningCourt = null; this.selectedIds.clear(); this.cdr.detectChanges(); }

  toggleSelect(p: QueuePlayer) {
    if (this.selectedIds.has(p._id)) {
      this.selectedIds.delete(p._id);
    } else {
      const cap = this.board?.session?.playersPerCourt ?? 4;
      if (this.selectedIds.size >= cap) return;
      this.selectedIds.add(p._id);
    }
    this.cdr.detectChanges();
  }

  confirmAssign() {
    if (this.assigningCourt === null || this.selectedIds.size === 0) return;
    const court = this.assigningCourt;
    const ids = [...this.selectedIds];
    this.assigningCourt = null;
    this.selectedIds.clear();
    this.act(this.hp.assignCourt(this.id, court, ids));
  }

  showQr() {
    this.qrModal = { generating: true };
    this.cdr.detectChanges();
    this.hp.generateQr(this.id).subscribe({
      next: ({ url }) => this.renderQr(url),
      error: () => { this.qrModal = null; this.cdr.detectChanges(); },
    });
  }

  regenerateQr() {
    if (!this.qrModal) return;
    this.qrModal = { generating: true };
    this.cdr.detectChanges();
    this.hp.generateQr(this.id).subscribe({
      next: ({ url }) => this.renderQr(url),
      error: () => { this.qrModal = null; this.cdr.detectChanges(); },
    });
  }

  private renderQr(url: string) {
    QRCode.toDataURL(url, { width: 440, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((dataUrl: string) => {
        this.qrModal = { generating: false, dataUrl };
        this.cdr.detectChanges();
      })
      .catch(() => { this.qrModal = null; this.cdr.detectChanges(); });
  }

  closeQrModal() { this.qrModal = null; this.cdr.detectChanges(); }

  goBack() { this.router.navigate(['/admin/hosted-play']); }

  openTvDisplay() {
    window.open(`/admin/hosted-play/${this.id}/queue/display`, '_blank');
  }
}
