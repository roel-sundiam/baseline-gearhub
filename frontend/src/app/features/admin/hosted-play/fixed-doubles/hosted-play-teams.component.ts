import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FixedDoublesBoard,
  HostedPlayPair,
  HostedPlayParticipant,
  HostedPlayService,
  HostedPlaySession,
  PairStatus,
} from '../../../../core/services/hosted-play.service';

@Component({
  selector: 'app-admin-hosted-play-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="teams-page" [attr.aria-busy]="loading || busy">
      <header class="teams-hero">
        <div class="hero-topbar">
          <button type="button" class="back-button" (click)="goBack()">
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span>All sessions</span>
          </button>

          <button type="button" class="schedule-top-action" (click)="goToSchedule()">
            <i class="fas fa-calendar-days" aria-hidden="true"></i>
            <span>View schedule</span>
          </button>
        </div>

        <div class="hero-copy">
          <div class="eyebrow"><i class="fas fa-people-group" aria-hidden="true"></i> Fixed doubles rotation</div>
          <h1>{{ session?.title || 'Team setup' }}</h1>
          <p>Build the pair roster, resolve partner invitations, and prepare the rotation before play begins.</p>

          @if (session) {
            <div class="session-meta" aria-label="Session details">
              @if (session.date) {
                <span><i class="far fa-calendar" aria-hidden="true"></i>{{ session.date | date: 'EEE, MMM d' }}</span>
              }
              @if (sessionTime()) {
                <span><i class="far fa-clock" aria-hidden="true"></i>{{ sessionTime() }}</span>
              }
              @if (session.venue) {
                <span><i class="fas fa-location-dot" aria-hidden="true"></i>{{ session.venue }}</span>
              }
              @if (session.sport) {
                <span><i class="fas fa-table-tennis-paddle-ball" aria-hidden="true"></i>{{ sportLabel() }}</span>
              }
            </div>
          }
        </div>

        @if (!loading && session) {
          <div class="metric-grid" aria-label="Roster summary">
            <div class="metric-card">
              <span class="metric-icon lime"><i class="fas fa-people-group" aria-hidden="true"></i></span>
              <div><strong>{{ activePairCount() }}@if (targetPairCount) {<small>/{{ targetPairCount }}</small>}</strong><span>Active pairs</span></div>
            </div>
            <div class="metric-card">
              <span class="metric-icon blue"><i class="fas fa-user-check" aria-hidden="true"></i></span>
              <div><strong>{{ pairedPlayerCount() }}</strong><span>Players paired</span></div>
            </div>
            <div class="metric-card">
              <span class="metric-icon amber"><i class="fas fa-hourglass-half" aria-hidden="true"></i></span>
              <div><strong>{{ pendingPairCount() }}</strong><span>Invites pending</span></div>
            </div>
            <div class="metric-card">
              <span class="metric-icon teal"><i class="fas fa-list-check" aria-hidden="true"></i></span>
              <div><strong class="metric-word" [class.metric-warning]="scheduleNeedsRefresh()">{{ scheduleStatusLabel() }}</strong><span>Schedule</span></div>
            </div>
          </div>
        }
      </header>

      @if (loading) {
        <section class="state-card" role="status" aria-live="polite">
          <span class="state-icon loading-icon"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i></span>
          <h2>Loading team workspace</h2>
          <p>Gathering pairs, participants, and schedule status…</p>
        </section>
      } @else if (error && !session) {
        <section class="state-card error-state" role="alert">
          <span class="state-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
          <h2>We couldn’t load the teams</h2>
          <p>{{ error }}</p>
          <button type="button" class="secondary-action retry-action" (click)="retry()">
            <i class="fas fa-rotate-right" aria-hidden="true"></i> Try again
          </button>
        </section>
      } @else {
        @if (locked) {
          <div class="notice-banner lock-banner" role="status">
            <span class="notice-icon"><i class="fas fa-lock" aria-hidden="true"></i></span>
            <div>
              <strong>Roster locked</strong>
              <p>The schedule has started, so team edits, swaps, and withdrawals are now disabled.</p>
            </div>
          </div>
        }

        @if (error) {
          <div class="notice-banner error-banner" role="alert">
            <span class="notice-icon"><i class="fas fa-circle-exclamation" aria-hidden="true"></i></span>
            <div><strong>Action unsuccessful</strong><p>{{ error }}</p></div>
            <button type="button" class="banner-retry" (click)="retry()">Refresh</button>
          </div>
        }

        <div class="workspace">
          <section class="panel roster-panel">
            <div class="panel-heading roster-heading">
              <div class="panel-title-wrap">
                <span class="panel-icon lime"><i class="fas fa-people-group" aria-hidden="true"></i></span>
                <div>
                  <span class="section-kicker">Pair roster</span>
                  <h2>Teams</h2>
                  <p>{{ confirmedPairCount() }} confirmed · {{ unpairedParticipants().length }} players available</p>
                </div>
              </div>
              <span class="count-pill">{{ activePairCount() }}@if (targetPairCount) { / {{ targetPairCount }}}</span>
            </div>

            @if (targetPairCount) {
              <div class="roster-progress">
                <div class="progress-copy"><span>Roster progress</span><strong>{{ pairProgress() }}%</strong></div>
                <div
                  class="progress-track"
                  role="progressbar"
                  aria-label="Pair roster progress"
                  aria-valuemin="0"
                  [attr.aria-valuemax]="targetPairCount"
                  [attr.aria-valuenow]="activePairCount()"
                >
                  <span [style.width.%]="pairProgress()"></span>
                </div>
              </div>
            }

            @if (pairs.length === 0) {
              <div class="empty-roster">
                <span><i class="fas fa-user-group" aria-hidden="true"></i></span>
                <h3>No pairs created yet</h3>
                <p>Assign the first pair from the organizer tools, or wait for players to invite their partners.</p>
              </div>
            } @else {
              <div class="pair-grid" role="list" aria-label="Registered pairs">
                @for (p of pairs; track p._id; let pairIndex = $index) {
                  <article
                    class="pair-card"
                    role="listitem"
                    [class.pending]="p.status === 'pending_partner'"
                    [class.withdrawn]="p.status === 'withdrawn'"
                  >
                    <div class="pair-card-head">
                      <div>
                        <span class="pair-number">Pair {{ pairIndex + 1 }}</span>
                        <h3>{{ p.pairLabel || 'Unnamed pair' }}</h3>
                      </div>
                      <span class="status-pill" [ngClass]="p.status">
                        @if (p.status === 'confirmed') {
                          <i class="fas fa-circle-check" aria-hidden="true"></i>
                        } @else if (p.status === 'pending_partner') {
                          <i class="fas fa-clock" aria-hidden="true"></i>
                        } @else {
                          <i class="fas fa-ban" aria-hidden="true"></i>
                        }
                        {{ pairStatusLabel(p.status) }}
                      </span>
                    </div>

                    <div class="players-stack">
                      <div class="player-row">
                        <span class="player-avatar">{{ initialsFor(p.participantAId) }}</span>
                        <div><span class="slot-label">Player A</span><strong>{{ nameFor(p.participantAId) }}</strong></div>
                      </div>
                      <span class="partner-link" aria-hidden="true"><i class="fas fa-link"></i></span>
                      <div class="player-row" [class.invite-row]="!p.participantBId">
                        @if (p.participantBId) {
                          <span class="player-avatar alt">{{ initialsFor(p.participantBId) }}</span>
                          <div><span class="slot-label">Player B</span><strong>{{ nameFor(p.participantBId) }}</strong></div>
                        } @else {
                          <span class="player-avatar pending-avatar"><i class="fas fa-user-clock" aria-hidden="true"></i></span>
                          <div><span class="slot-label">Player B</span><strong>Partner invite pending</strong></div>
                        }
                      </div>
                    </div>

                    <div class="pair-card-footer">
                      <span class="source-note"><i class="fas fa-{{ p.source === 'organizer_assigned' ? 'user-shield' : 'paper-plane' }}" aria-hidden="true"></i>{{ pairSourceLabel(p) }}</span>
                      @if (!locked && p.status !== 'withdrawn') {
                        <button
                          type="button"
                          class="withdraw-action"
                          [disabled]="busy"
                          [attr.aria-label]="'Withdraw ' + (p.pairLabel || 'pair ' + (pairIndex + 1))"
                          (click)="withdrawPair(p)"
                        >
                          <i class="fas fa-user-slash" aria-hidden="true"></i> Withdraw
                        </button>
                      }
                    </div>
                  </article>
                }
              </div>
            }
          </section>

          <aside class="management-column" aria-label="Organizer tools">
            @if (!locked) {
              <section class="panel action-panel">
                <div class="panel-heading">
                  <div class="panel-title-wrap">
                    <span class="panel-icon blue"><i class="fas fa-user-plus" aria-hidden="true"></i></span>
                    <div><span class="section-kicker">Organizer tool</span><h2>Add a pair</h2></div>
                  </div>
                </div>
                <p class="panel-description">Choose two available players and optionally give their team a name.</p>

                @if (unpairedParticipants().length < 2) {
                  <div class="inline-note"><i class="fas fa-circle-info" aria-hidden="true"></i>At least two unpaired players are needed.</div>
                }

                <div class="form-stack">
                  <div class="field-grid">
                    <label class="form-field" for="pair-player-a">
                      <span>Player A</span>
                      <select id="pair-player-a" [(ngModel)]="newPairA" [disabled]="busy">
                        <option [ngValue]="null" disabled>Choose player</option>
                        @for (p of unpairedParticipants(); track p._id) {
                          <option [ngValue]="p._id" [disabled]="p._id === newPairB">{{ p.memberName || 'Player' }}</option>
                        }
                      </select>
                    </label>
                    <label class="form-field" for="pair-player-b">
                      <span>Player B</span>
                      <select id="pair-player-b" [(ngModel)]="newPairB" [disabled]="busy">
                        <option [ngValue]="null" disabled>Choose player</option>
                        @for (p of unpairedParticipants(); track p._id) {
                          <option [ngValue]="p._id" [disabled]="p._id === newPairA">{{ p.memberName || 'Player' }}</option>
                        }
                      </select>
                    </label>
                  </div>

                  <label class="form-field" for="pair-name">
                    <span>Pair name <small>Optional</small></span>
                    <input id="pair-name" type="text" [(ngModel)]="newPairLabel" placeholder="e.g. Baseline Duo" autocomplete="off" [disabled]="busy" />
                  </label>

                  <button
                    type="button"
                    class="primary-action"
                    [disabled]="busy || !newPairA || !newPairB || newPairA === newPairB || unpairedParticipants().length < 2"
                    (click)="addPair()"
                  >
                    @if (busy) {<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>} @else {<i class="fas fa-plus" aria-hidden="true"></i>}
                    Add pair
                  </button>
                </div>
              </section>

              <section class="panel action-panel">
                <div class="panel-heading">
                  <div class="panel-title-wrap">
                    <span class="panel-icon amber"><i class="fas fa-right-left" aria-hidden="true"></i></span>
                    <div><span class="section-kicker">Roster adjustment</span><h2>Swap players</h2></div>
                  </div>
                </div>
                <p class="panel-description">Exchange one player between two existing pairs without rebuilding the roster.</p>

                @if (swappablePairs().length < 2) {
                  <div class="inline-note"><i class="fas fa-circle-info" aria-hidden="true"></i>Two complete, confirmed pairs are required for a swap.</div>
                }

                <div class="swap-builder">
                  <fieldset class="swap-side">
                    <legend>From first pair</legend>
                    <div class="swap-fields">
                      <label class="form-field" for="swap-pair-a">
                        <span>Pair</span>
                        <select id="swap-pair-a" [(ngModel)]="swapPairAId" [disabled]="busy">
                          <option [ngValue]="null" disabled>Choose pair</option>
                          @for (p of swappablePairs(); track p._id) {
                            <option [ngValue]="p._id">{{ p.pairLabel || 'Unnamed pair' }}</option>
                          }
                        </select>
                      </label>
                      <label class="form-field slot-field" for="swap-slot-a">
                        <span>Player</span>
                        <select id="swap-slot-a" [(ngModel)]="swapSlotA" [disabled]="busy || !swapPairAId">
                          <option value="A">{{ swapPairAId ? nameFor(pairById(swapPairAId)?.participantAId ?? null) : 'Player A' }}</option>
                          <option value="B">{{ swapPairAId ? nameFor(pairById(swapPairAId)?.participantBId ?? null) : 'Player B' }}</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>

                  <span class="swap-divider" aria-hidden="true"><i class="fas fa-arrow-down"></i></span>

                  <fieldset class="swap-side">
                    <legend>With second pair</legend>
                    <div class="swap-fields">
                      <label class="form-field" for="swap-pair-b">
                        <span>Pair</span>
                        <select id="swap-pair-b" [(ngModel)]="swapPairBId" [disabled]="busy">
                          <option [ngValue]="null" disabled>Choose pair</option>
                          @for (p of swappablePairs(); track p._id) {
                            <option [ngValue]="p._id">{{ p.pairLabel || 'Unnamed pair' }}</option>
                          }
                        </select>
                      </label>
                      <label class="form-field slot-field" for="swap-slot-b">
                        <span>Player</span>
                        <select id="swap-slot-b" [(ngModel)]="swapSlotB" [disabled]="busy || !swapPairBId">
                          <option value="A">{{ swapPairBId ? nameFor(pairById(swapPairBId)?.participantAId ?? null) : 'Player A' }}</option>
                          <option value="B">{{ swapPairBId ? nameFor(pairById(swapPairBId)?.participantBId ?? null) : 'Player B' }}</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>
                </div>

                <button
                  type="button"
                  class="secondary-action swap-action"
                  [disabled]="busy || swappablePairs().length < 2 || !swapPairAId || !swapPairBId || swapPairAId === swapPairBId"
                  (click)="swapPlayers()"
                >
                  @if (busy) {<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>} @else {<i class="fas fa-right-left" aria-hidden="true"></i>}
                  Swap selected players
                </button>
              </section>
            }

            <section
              class="schedule-card"
              [class.schedule-ready]="fixturesGenerated && !scheduleNeedsRefresh()"
              [class.schedule-stale]="scheduleNeedsRefresh()"
            >
              <span class="schedule-card-icon"><i class="fas fa-calendar-check" aria-hidden="true"></i></span>
              <div>
                <span class="section-kicker">Next step</span>
                <h2>{{ scheduleNeedsRefresh() ? 'Schedule needs refresh' : (fixturesGenerated ? 'Schedule ready' : 'Create the rotation') }}</h2>
                <p>
                  @if (scheduleNeedsRefresh()) {
                    The roster changed after the current schedule was generated. Review and regenerate it before play begins.
                  } @else if (fixturesGenerated) {
                    The match schedule is generated for {{ activePairCount() }} active pairs.
                  } @else {
                    Once every pair is confirmed, generate the round-robin match schedule.
                  }
                </p>
              </div>
              <button type="button" class="primary-action" (click)="goToSchedule()">
                <i class="fas fa-calendar-days" aria-hidden="true"></i>
                {{ scheduleNeedsRefresh() ? 'Review schedule' : (fixturesGenerated ? 'Open schedule' : 'Go to schedule') }}
              </button>
            </section>
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      color: #fff;
    }

    .teams-page {
      --page-bg: #07130d;
      --surface: #12251d;
      --surface-raised: #19352a;
      --surface-soft: rgba(255, 255, 255, 0.045);
      --surface-hover: rgba(255, 255, 255, 0.075);
      --border: rgba(255, 255, 255, 0.1);
      --border-strong: rgba(255, 255, 255, 0.16);
      --text: #fff;
      --muted: rgba(255, 255, 255, 0.62);
      --soft: rgba(255, 255, 255, 0.42);
      --lime: #a3e635;
      --lime-ink: #102006;
      width: 100%;
      max-width: 1050px;
      margin: 0 auto;
      padding-bottom: 4rem;
    }

    button,
    input,
    select {
      font: inherit;
    }

    button {
      -webkit-tap-highlight-color: transparent;
    }

    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 3px solid rgba(163, 230, 53, 0.34);
      outline-offset: 2px;
    }

    .teams-hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      padding: clamp(1.15rem, 3vw, 2rem);
      border: 1px solid rgba(163, 230, 53, 0.16);
      border-radius: 24px;
      background:
        radial-gradient(circle at 88% 12%, rgba(163, 230, 53, 0.18), transparent 28%),
        radial-gradient(circle at 68% 112%, rgba(20, 184, 166, 0.13), transparent 34%),
        linear-gradient(140deg, #19382a 0%, #10271d 48%, #0a1c13 100%);
      box-shadow: 0 22px 55px rgba(0, 0, 0, 0.3);
    }

    .teams-hero::after {
      position: absolute;
      z-index: -1;
      right: -58px;
      bottom: -84px;
      width: 270px;
      height: 270px;
      border: 1px solid rgba(163, 230, 53, 0.12);
      border-radius: 50%;
      box-shadow: 0 0 0 38px rgba(163, 230, 53, 0.025), 0 0 0 76px rgba(163, 230, 53, 0.016);
      content: '';
      pointer-events: none;
    }

    .hero-topbar,
    .back-button,
    .schedule-top-action,
    .session-meta,
    .metric-card,
    .notice-banner,
    .panel-heading,
    .panel-title-wrap,
    .player-row,
    .pair-card-footer,
    .primary-action,
    .secondary-action,
    .withdraw-action,
    .banner-retry,
    .inline-note {
      display: flex;
      align-items: center;
    }

    .hero-topbar {
      position: relative;
      z-index: 1;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: clamp(1.5rem, 4vw, 2.6rem);
    }

    .back-button,
    .schedule-top-action {
      min-height: 44px;
      gap: 0.55rem;
      border-radius: 12px;
      font-size: 0.84rem;
      font-weight: 800;
      cursor: pointer;
    }

    .back-button {
      padding: 0.6rem 0.75rem;
      border: 0;
      color: var(--muted);
      background: transparent;
    }

    .back-button:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }

    .schedule-top-action {
      padding: 0.65rem 0.9rem;
      border: 1px solid var(--border-strong);
      color: #fff;
      background: rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(10px);
    }

    .schedule-top-action:hover {
      border-color: rgba(163, 230, 53, 0.28);
      background: rgba(163, 230, 53, 0.1);
    }

    .hero-copy {
      position: relative;
      z-index: 1;
      max-width: 690px;
    }

    .eyebrow,
    .section-kicker {
      color: var(--lime);
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.38rem 0.65rem;
      border: 1px solid rgba(163, 230, 53, 0.22);
      border-radius: 999px;
      background: rgba(163, 230, 53, 0.08);
    }

    .hero-copy h1 {
      max-width: 760px;
      margin: 0.7rem 0 0;
      font-size: clamp(2rem, 5vw, 3.25rem);
      line-height: 1.02;
      letter-spacing: -0.045em;
    }

    .hero-copy > p {
      max-width: 640px;
      margin: 0.75rem 0 0;
      color: var(--muted);
      font-size: clamp(0.9rem, 1.8vw, 1rem);
      line-height: 1.6;
    }

    .session-meta {
      flex-wrap: wrap;
      gap: 0.55rem 1rem;
      margin-top: 1rem;
      color: rgba(255, 255, 255, 0.72);
      font-size: 0.78rem;
      font-weight: 650;
    }

    .session-meta span {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .session-meta i {
      color: var(--lime);
    }

    .metric-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.65rem;
      margin-top: clamp(1.5rem, 4vw, 2.3rem);
    }

    .metric-card {
      min-width: 0;
      gap: 0.7rem;
      padding: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      background: rgba(5, 17, 11, 0.48);
      backdrop-filter: blur(12px);
    }

    .metric-icon,
    .panel-icon {
      display: grid;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 11px;
    }

    .metric-icon {
      width: 38px;
      height: 38px;
      font-size: 0.9rem;
    }

    .lime { color: var(--lime); background: rgba(163, 230, 53, 0.13); }
    .blue { color: #60a5fa; background: rgba(59, 130, 246, 0.13); }
    .amber { color: #fbbf24; background: rgba(245, 158, 11, 0.13); }
    .teal { color: #2dd4bf; background: rgba(20, 184, 166, 0.13); }

    .metric-card > div {
      min-width: 0;
    }

    .metric-card strong {
      display: block;
      overflow: hidden;
      color: #fff;
      font-size: 1.25rem;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .metric-card strong small {
      margin-left: 0.15rem;
      color: var(--soft);
      font-size: 0.72em;
      font-weight: 750;
    }

    .metric-card .metric-word {
      color: var(--lime);
      font-size: 0.95rem;
    }

    .metric-card .metric-warning {
      color: #fbbf24;
    }

    .metric-card div span {
      display: block;
      margin-top: 0.18rem;
      overflow: hidden;
      color: var(--soft);
      font-size: 0.7rem;
      font-weight: 750;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .state-card {
      display: flex;
      min-height: 320px;
      margin-top: 1rem;
      padding: 2rem;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      border-radius: 18px;
      text-align: center;
      background: var(--surface);
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.24);
    }

    .state-icon {
      display: grid;
      width: 54px;
      height: 54px;
      margin-bottom: 1rem;
      place-items: center;
      border-radius: 16px;
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.12);
      font-size: 1.25rem;
    }

    .loading-icon {
      color: var(--lime);
      background: rgba(163, 230, 53, 0.1);
    }

    .state-card h2 {
      font-size: 1.18rem;
    }

    .state-card p {
      max-width: 460px;
      margin-top: 0.5rem;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.55;
    }

    .retry-action {
      width: auto;
      margin-top: 1rem;
    }

    .notice-banner {
      gap: 0.8rem;
      margin-top: 1rem;
      padding: 0.85rem 1rem;
      border: 1px solid;
      border-radius: 14px;
    }

    .notice-icon {
      display: grid;
      flex: 0 0 auto;
      width: 36px;
      height: 36px;
      place-items: center;
      border-radius: 10px;
    }

    .notice-banner > div {
      flex: 1;
      min-width: 0;
    }

    .notice-banner strong {
      display: block;
      font-size: 0.84rem;
    }

    .notice-banner p {
      margin-top: 0.15rem;
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .lock-banner {
      border-color: rgba(245, 158, 11, 0.25);
      color: #fde68a;
      background: rgba(245, 158, 11, 0.08);
    }

    .lock-banner .notice-icon {
      background: rgba(245, 158, 11, 0.14);
    }

    .error-banner {
      border-color: rgba(239, 68, 68, 0.26);
      color: #fecaca;
      background: rgba(239, 68, 68, 0.08);
    }

    .error-banner .notice-icon {
      background: rgba(239, 68, 68, 0.13);
    }

    .banner-retry {
      min-height: 44px;
      padding: 0.45rem 0.7rem;
      border: 1px solid rgba(254, 202, 202, 0.26);
      border-radius: 9px;
      color: #fecaca;
      background: transparent;
      font-size: 0.76rem;
      font-weight: 850;
      cursor: pointer;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(310px, 0.82fr);
      align-items: start;
      gap: 1rem;
      margin-top: 1rem;
    }

    .panel {
      min-width: 0;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(18, 37, 29, 0.94);
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
    }

    .panel-heading {
      justify-content: space-between;
      gap: 0.85rem;
    }

    .panel-title-wrap {
      min-width: 0;
      gap: 0.75rem;
    }

    .panel-title-wrap > div {
      min-width: 0;
    }

    .panel-icon {
      width: 42px;
      height: 42px;
      font-size: 0.95rem;
    }

    .panel-heading h2,
    .schedule-card h2 {
      margin-top: 0.12rem;
      font-size: 1.05rem;
      line-height: 1.2;
    }

    .roster-heading p {
      margin-top: 0.18rem;
      color: var(--soft);
      font-size: 0.72rem;
    }

    .count-pill {
      flex: 0 0 auto;
      padding: 0.38rem 0.68rem;
      border: 1px solid rgba(163, 230, 53, 0.2);
      border-radius: 999px;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.08);
      font-size: 0.75rem;
      font-weight: 900;
    }

    .roster-progress {
      margin: 1rem 0;
      padding: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.025);
    }

    .progress-copy {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 750;
    }

    .progress-copy strong {
      color: var(--lime);
    }

    .progress-track {
      overflow: hidden;
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.07);
    }

    .progress-track span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #84cc16, var(--lime));
      box-shadow: 0 0 12px rgba(163, 230, 53, 0.35);
    }

    .pair-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(270px, 100%), 1fr));
      gap: 0.7rem;
      margin-top: 1rem;
    }

    .pair-card {
      min-width: 0;
      padding: 0.85rem;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 15px;
      background:
        linear-gradient(145deg, rgba(163, 230, 53, 0.025), transparent 42%),
        rgba(255, 255, 255, 0.035);
    }

    .pair-card.pending {
      border-color: rgba(245, 158, 11, 0.28);
      border-style: dashed;
    }

    .pair-card.withdrawn {
      opacity: 0.62;
      filter: saturate(0.6);
    }

    .pair-card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.65rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }

    .pair-number,
    .slot-label {
      display: block;
      color: var(--soft);
      font-size: 0.64rem;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .pair-card-head h3 {
      margin-top: 0.2rem;
      overflow-wrap: anywhere;
      font-size: 0.94rem;
      line-height: 1.25;
    }

    .status-pill {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.3rem;
      padding: 0.3rem 0.48rem;
      border: 1px solid;
      border-radius: 999px;
      font-size: 0.64rem;
      font-weight: 850;
      white-space: nowrap;
    }

    .status-pill.confirmed {
      border-color: rgba(163, 230, 53, 0.2);
      color: var(--lime);
      background: rgba(163, 230, 53, 0.08);
    }

    .status-pill.pending_partner {
      border-color: rgba(245, 158, 11, 0.22);
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.08);
    }

    .status-pill.withdrawn {
      border-color: rgba(248, 113, 113, 0.2);
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.08);
    }

    .players-stack {
      position: relative;
      display: flex;
      padding: 0.85rem 0;
      flex-direction: column;
      gap: 0.7rem;
    }

    .player-row {
      position: relative;
      z-index: 1;
      min-width: 0;
      gap: 0.65rem;
    }

    .player-row > div {
      min-width: 0;
    }

    .player-row strong {
      display: block;
      margin-top: 0.12rem;
      overflow: hidden;
      font-size: 0.8rem;
      font-weight: 750;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-avatar {
      display: grid;
      flex: 0 0 auto;
      width: 36px;
      height: 36px;
      place-items: center;
      border: 1px solid rgba(163, 230, 53, 0.22);
      border-radius: 11px;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.1);
      font-size: 0.67rem;
      font-weight: 900;
      letter-spacing: 0.03em;
    }

    .player-avatar.alt {
      border-color: rgba(96, 165, 250, 0.22);
      color: #93c5fd;
      background: rgba(59, 130, 246, 0.1);
    }

    .pending-avatar {
      border-color: rgba(245, 158, 11, 0.22);
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.09);
    }

    .partner-link {
      position: absolute;
      top: 50%;
      left: 13px;
      display: grid;
      z-index: 2;
      width: 10px;
      height: 18px;
      place-items: center;
      transform: translateY(-50%);
      color: var(--soft);
      background: #172c23;
      font-size: 0.48rem;
    }

    .players-stack::before {
      position: absolute;
      top: 1.65rem;
      bottom: 1.65rem;
      left: 17px;
      width: 1px;
      content: '';
      background: rgba(255, 255, 255, 0.12);
    }

    .pair-card-footer {
      justify-content: space-between;
      gap: 0.65rem;
      padding-top: 0.65rem;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
    }

    .source-note {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--soft);
      font-size: 0.66rem;
      font-weight: 700;
    }

    .withdraw-action {
      flex: 0 0 auto;
      min-height: 44px;
      gap: 0.38rem;
      padding: 0.4rem 0.55rem;
      border: 1px solid rgba(248, 113, 113, 0.2);
      border-radius: 9px;
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.06);
      font-size: 0.68rem;
      font-weight: 800;
      cursor: pointer;
    }

    .withdraw-action:hover:not(:disabled) {
      border-color: rgba(248, 113, 113, 0.35);
      background: rgba(239, 68, 68, 0.12);
    }

    .empty-roster {
      display: flex;
      min-height: 260px;
      padding: 2rem 1rem;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .empty-roster > span {
      display: grid;
      width: 52px;
      height: 52px;
      margin-bottom: 0.85rem;
      place-items: center;
      border-radius: 16px;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.1);
      font-size: 1.15rem;
    }

    .empty-roster h3 {
      font-size: 1rem;
    }

    .empty-roster p {
      max-width: 410px;
      margin-top: 0.4rem;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.55;
    }

    .management-column {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 1rem;
    }

    .panel-description {
      margin: 0.8rem 0;
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.5;
    }

    .inline-note {
      gap: 0.45rem;
      margin-bottom: 0.75rem;
      padding: 0.6rem 0.65rem;
      border: 1px solid rgba(56, 189, 248, 0.16);
      border-radius: 9px;
      color: #bae6fd;
      background: rgba(14, 165, 233, 0.07);
      font-size: 0.68rem;
      line-height: 1.35;
    }

    .form-stack,
    .swap-builder {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }

    .field-grid,
    .swap-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
    }

    .form-field {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-field > span,
    .swap-side legend {
      color: var(--muted);
      font-size: 0.68rem;
      font-weight: 800;
    }

    .form-field > span small {
      margin-left: 0.25rem;
      color: var(--soft);
      font-size: 0.88em;
      font-weight: 650;
    }

    .form-field select,
    .form-field input {
      width: 100%;
      min-height: 44px;
      padding: 0.65rem 0.7rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
      font-size: 0.76rem;
    }

    .form-field select:focus,
    .form-field input:focus {
      border-color: rgba(163, 230, 53, 0.42);
      box-shadow: 0 0 0 3px rgba(163, 230, 53, 0.1);
    }

    .form-field option {
      color: #fff;
      background: #12251d;
    }

    .form-field input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    .primary-action,
    .secondary-action {
      min-height: 46px;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.65rem 0.9rem;
      border-radius: 10px;
      font-size: 0.78rem;
      font-weight: 900;
      cursor: pointer;
    }

    .primary-action {
      border: 1px solid var(--lime);
      color: var(--lime-ink);
      background: var(--lime);
      box-shadow: 0 7px 18px rgba(163, 230, 53, 0.16);
    }

    .primary-action:hover:not(:disabled) {
      background: #b5f040;
    }

    .secondary-action {
      border: 1px solid var(--border-strong);
      color: #fff;
      background: rgba(255, 255, 255, 0.055);
    }

    .secondary-action:hover:not(:disabled) {
      border-color: rgba(163, 230, 53, 0.28);
      background: rgba(163, 230, 53, 0.08);
    }

    button:disabled,
    input:disabled,
    select:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }

    .swap-side {
      min-width: 0;
      padding: 0.65rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.025);
    }

    .swap-side legend {
      padding: 0 0.25rem;
    }

    .swap-fields {
      grid-template-columns: minmax(0, 1fr) 95px;
    }

    .swap-divider {
      display: grid;
      width: 30px;
      height: 30px;
      margin: -0.3rem auto;
      place-items: center;
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 9px;
      color: #fbbf24;
      background: #182d24;
      font-size: 0.7rem;
    }

    .swap-action {
      width: 100%;
      margin-top: 0.75rem;
    }

    .schedule-card {
      position: relative;
      overflow: hidden;
      padding: 1.1rem;
      border: 1px solid rgba(163, 230, 53, 0.16);
      border-radius: 18px;
      background:
        radial-gradient(circle at 100% 0%, rgba(163, 230, 53, 0.16), transparent 40%),
        linear-gradient(145deg, #1b382b, #10241a);
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
    }

    .schedule-card.schedule-stale {
      border-color: rgba(245, 158, 11, 0.28);
      background:
        radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.14), transparent 40%),
        linear-gradient(145deg, #2d2d1a, #17241a);
    }

    .schedule-card.schedule-stale .schedule-card-icon {
      border-color: rgba(245, 158, 11, 0.26);
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.1);
    }

    .schedule-card-icon {
      display: grid;
      width: 44px;
      height: 44px;
      margin-bottom: 0.9rem;
      place-items: center;
      border: 1px solid rgba(163, 230, 53, 0.22);
      border-radius: 13px;
      color: var(--lime);
      background: rgba(163, 230, 53, 0.1);
    }

    .schedule-card p {
      margin: 0.55rem 0 1rem;
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.5;
    }

    .schedule-card .primary-action {
      width: 100%;
    }

    @media (max-width: 980px) {
      .workspace {
        grid-template-columns: 1fr;
      }

      .management-column {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
      }

      .schedule-card {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 720px) {
      .teams-page {
        padding-bottom: calc(6rem + env(safe-area-inset-bottom));
      }

      .teams-hero {
        border-radius: 18px;
      }

      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .management-column {
        display: flex;
      }

      .schedule-card {
        grid-column: auto;
      }
    }

    @media (max-width: 520px) {
      .teams-hero {
        padding: 0.85rem;
      }

      .hero-topbar {
        margin-bottom: 1.25rem;
      }

      .back-button,
      .schedule-top-action {
        padding-inline: 0.65rem;
        font-size: 0.75rem;
      }

      .hero-copy h1 {
        font-size: 1.9rem;
      }

      .hero-copy > p {
        font-size: 0.84rem;
      }

      .session-meta {
        gap: 0.45rem 0.75rem;
        font-size: 0.7rem;
      }

      .metric-card {
        gap: 0.55rem;
        padding: 0.65rem;
      }

      .metric-icon {
        width: 34px;
        height: 34px;
      }

      .metric-card strong {
        font-size: 1.05rem;
      }

      .panel {
        padding: 0.8rem;
        border-radius: 15px;
      }

      .panel-icon {
        width: 38px;
        height: 38px;
      }

      .field-grid {
        grid-template-columns: 1fr;
      }

      .notice-banner {
        align-items: flex-start;
      }

      .error-banner {
        flex-wrap: wrap;
      }

      .error-banner .banner-retry {
        width: 100%;
        justify-content: center;
      }
    }

    @media (max-width: 380px) {
      .schedule-top-action span,
      .back-button span {
        max-width: 92px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .metric-card div span {
        font-size: 0.64rem;
      }

      .swap-fields {
        grid-template-columns: 1fr;
      }

      .pair-card-footer {
        align-items: flex-start;
        flex-direction: column;
      }

      .withdraw-action {
        width: 100%;
        justify-content: center;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
      }
    }
  `],
})
export class AdminHostedPlayTeamsComponent implements OnInit {
  id = '';
  session: HostedPlaySession | null = null;
  pairs: HostedPlayPair[] = [];
  participants: HostedPlayParticipant[] = [];
  loading = true;
  busy = false;
  error = '';
  locked = false;
  fixturesGenerated = false;
  targetPairCount: number | null = null;
  private scheduledPairIds = new Set<string>();

  newPairA: string | null = null;
  newPairB: string | null = null;
  newPairLabel = '';

  swapPairAId: string | null = null;
  swapSlotA: 'A' | 'B' = 'A';
  swapPairBId: string | null = null;
  swapSlotB: 'A' | 'B' = 'A';

  constructor(
    private hp: HostedPlayService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.load();
  }

  retry() {
    this.load();
  }

  private load() {
    this.loading = true;
    this.error = '';
    Promise.all([
      this.hp.getFixedDoublesBoard(this.id).toPromise(),
      this.hp.getParticipants(this.id).toPromise(),
    ]).then(([board, participants]) => {
      this.applyBoard(board!);
      this.participants = participants ?? [];
      this.loading = false;
      this.cdr.detectChanges();
    }).catch((err) => {
      this.error = err?.error?.error || 'Unable to load teams.';
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  private applyBoard(board: FixedDoublesBoard) {
    this.session = board.session as unknown as HostedPlaySession;
    this.pairs = board.pairs;
    this.locked = board.locked;
    const fixtures = [
      ...board.currentMatches,
      ...board.nextMatches,
      ...board.upcomingMatches,
      ...board.completedMatches,
    ];
    this.fixturesGenerated = fixtures.length > 0;
    this.scheduledPairIds = new Set(fixtures.flatMap(fixture => [fixture.pair1Id, fixture.pair2Id]));
    this.targetPairCount = board.session.fixedDoubles?.pairCount ?? null;
  }

  nameFor(participantId: string | null): string {
    if (!participantId) return '—';
    return this.participants.find(p => p._id === participantId)?.memberName || 'Player';
  }

  pairById(pairId: string | null): HostedPlayPair | undefined {
    if (!pairId) return undefined;
    return this.pairs.find(p => p._id === pairId);
  }

  initialsFor(participantId: string | null): string {
    if (!participantId) return '—';
    const name = this.nameFor(participantId);
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'P';
  }

  activePairCount(): number {
    return this.pairs.filter(pair => pair.status !== 'withdrawn').length;
  }

  confirmedPairCount(): number {
    return this.pairs.filter(pair => pair.status === 'confirmed').length;
  }

  pendingPairCount(): number {
    return this.pairs.filter(pair => pair.status === 'pending_partner').length;
  }

  swappablePairs(): HostedPlayPair[] {
    return this.pairs.filter(pair =>
      pair.status === 'confirmed' && !!pair.participantAId && !!pair.participantBId,
    );
  }

  pairedPlayerCount(): number {
    const participantIds = this.pairs
      .filter(pair => pair.status !== 'withdrawn')
      .flatMap(pair => [pair.participantAId, pair.participantBId])
      .filter((participantId): participantId is string => !!participantId);
    return new Set(participantIds).size;
  }

  pairProgress(): number {
    if (!this.targetPairCount) return 0;
    return Math.min(100, Math.round((this.activePairCount() / this.targetPairCount) * 100));
  }

  scheduleNeedsRefresh(): boolean {
    if (!this.fixturesGenerated) return false;

    const confirmedPairIds = this.swappablePairs().map(pair => pair._id);
    const rosterChanged = confirmedPairIds.length !== this.scheduledPairIds.size
      || confirmedPairIds.some(pairId => !this.scheduledPairIds.has(pairId));
    if (rosterChanged) return true;

    const generatedAt = this.session?.fixedDoubles?.scheduleGeneratedAt;
    const pairsUpdatedAt = this.session?.fixedDoubles?.pairsUpdatedAt;
    if (!generatedAt || !pairsUpdatedAt) return false;

    const generatedTime = Date.parse(generatedAt);
    const pairsUpdatedTime = Date.parse(pairsUpdatedAt);
    return Number.isFinite(generatedTime) && Number.isFinite(pairsUpdatedTime) && pairsUpdatedTime > generatedTime;
  }

  scheduleStatusLabel(): string {
    if (this.scheduleNeedsRefresh()) return 'Refresh';
    return this.fixturesGenerated ? 'Ready' : 'Pending';
  }

  pairStatusLabel(status: PairStatus): string {
    if (status === 'pending_partner') return 'Pending';
    if (status === 'withdrawn') return 'Withdrawn';
    return 'Confirmed';
  }

  pairSourceLabel(pair: HostedPlayPair): string {
    return pair.source === 'organizer_assigned' ? 'Assigned by organizer' : 'Player invitation';
  }

  sportLabel(): string {
    const sport = this.session?.sport;
    if (!sport) return '';
    return sport.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  sessionTime(): string {
    const start = this.session?.startTime;
    const end = this.session?.endTime;
    if (start && end) return `${start}–${end}`;
    return start || end || '';
  }

  unpairedParticipants(): HostedPlayParticipant[] {
    const paired = new Set(this.pairs.flatMap(p => [p.participantAId, p.participantBId]).filter((x): x is string => !!x));
    return this.participants.filter(p => !paired.has(p._id));
  }

  addPair() {
    if (!this.newPairA || !this.newPairB || this.newPairA === this.newPairB) return;
    this.busy = true;
    this.hp.organizerAssignPair(this.id, this.newPairA, this.newPairB, this.newPairLabel || undefined).subscribe({
      next: () => {
        this.newPairA = null;
        this.newPairB = null;
        this.newPairLabel = '';
        this.busy = false;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.error || 'Unable to add pair.';
        this.busy = false;
        this.cdr.detectChanges();
      },
    });
  }

  withdrawPair(p: HostedPlayPair) {
    if (!confirm(`Withdraw ${p.pairLabel || 'this pair'}?`)) return;
    this.busy = true;
    this.hp.withdrawPair(this.id, p._id).subscribe({
      next: () => { this.busy = false; this.load(); },
      error: (err) => {
        this.error = err?.error?.error || 'Unable to withdraw pair.';
        this.busy = false;
        this.cdr.detectChanges();
      },
    });
  }

  swapPlayers() {
    if (!this.swapPairAId || !this.swapPairBId || this.swapPairAId === this.swapPairBId) return;
    const validPairIds = new Set(this.swappablePairs().map(pair => pair._id));
    if (!validPairIds.has(this.swapPairAId) || !validPairIds.has(this.swapPairBId)) return;
    this.busy = true;
    this.hp.swapPairPlayers(this.id, {
      pairAId: this.swapPairAId,
      slotA: this.swapSlotA,
      pairBId: this.swapPairBId,
      slotB: this.swapSlotB,
    }).subscribe({
      next: () => {
        this.swapPairAId = null;
        this.swapPairBId = null;
        this.busy = false;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.error || 'Unable to swap players.';
        this.busy = false;
        this.cdr.detectChanges();
      },
    });
  }

  goBack() { this.router.navigate(['/admin/hosted-play']); }
  goToSchedule() { this.router.navigate(['/admin/hosted-play', this.id, 'schedule']); }
}
