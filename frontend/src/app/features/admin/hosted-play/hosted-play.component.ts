import { Component, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  HostedPlayService,
  HostedPlaySession,
  HostedPlayInput,
  HostedPlayParticipant,
} from '../../../core/services/hosted-play.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Court } from '../../../core/services/club.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';

type FormModel = HostedPlayInput;

@Component({
  selector: 'app-admin-hosted-play',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="hp-shell">
      <header class="topbar">
        <button class="back-btn" (click)="goBack()" aria-label="Back to dashboard"><i class="fas fa-arrow-left"></i></button>
        <div class="topbar-copy">
          <span class="topbar-kicker">Admin</span>
          <h1>Hosted Play</h1>
        </div>
      </header>

      @if (loading) {
        <div class="state-card"><i class="fas fa-circle-notch fa-spin"></i> Loading hosted play...</div>
      } @else {
        <main class="page">
          <section class="hero">
            <div class="hero-copy">
              <span class="eyebrow"><i class="fas fa-calendar-check"></i> Session management</span>
              <h2>Manage Hosted Play</h2>
              <p>Create sessions, track player capacity, check rosters, and launch queue operations from one admin view.</p>
            </div>
            <div class="hero-actions">
              <button class="primary-action" (click)="openCreate()"><i class="fas fa-plus"></i> Create Session</button>
              <button class="secondary-action" (click)="openCourts()"><i class="fas fa-map-marker-alt"></i> Manage Courts</button>
            </div>
            <div class="queue-setting-row">
              <div class="queue-setting-copy">
                <div class="queue-setting-title"><i class="fas fa-list-ol"></i> Queue Management</div>
                <div class="queue-setting-desc">Enable check-in, court rotation, and live queue board for sessions.</div>
              </div>
              <label class="queue-switch">
                <input type="checkbox" [checked]="queueEnabled()" (change)="requestToggleQueue($event)" [disabled]="togglingQueue" />
                <span class="queue-slider"></span>
              </label>
            </div>
          </section>

          <section class="stats-grid" aria-label="Hosted play summary">
            <div class="stat-card">
              <span class="stat-icon lime"><i class="fas fa-calendar-days"></i></span>
              <span class="stat-value">{{ sessions.length }}</span>
              <span class="stat-label">Sessions</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon teal"><i class="fas fa-door-open"></i></span>
              <span class="stat-value">{{ openCount() }}</span>
              <span class="stat-label">Open</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon blue"><i class="fas fa-users"></i></span>
              <span class="stat-value">{{ joinedTotal() }}</span>
              <span class="stat-label">Joined players</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon amber"><i class="fas fa-table-tennis-paddle-ball"></i></span>
              <span class="stat-value">{{ queueReadyCount() }}</span>
              <span class="stat-label">Queue ready</span>
            </div>
          </section>

          @if (sessions.length === 0) {
            <section class="empty-panel">
              <div class="empty-icon"><i class="fas fa-calendar-plus"></i></div>
              <h3>No hosted play sessions yet</h3>
              <p>Create your first session so members can join from the player app.</p>
              <button class="primary-action" (click)="openCreate()"><i class="fas fa-plus"></i> Create Session</button>
            </section>
          } @else {
            <section class="session-grid">
              @for (s of sessions; track s._id) {
                <article class="session-card">
                  <div class="card-head">
                    <div class="venue-mark">
                      @if (venueLogo(s)) {
                        <img [src]="venueLogo(s)" [alt]="venueLabel(s)" class="venue-logo-img" />
                      } @else {
                        <span class="venue-initials">{{ venueInitials(s) }}</span>
                      }
                    </div>
                    <div class="title-block">
                      <span class="sport-label">{{ s.sport | titlecase }}</span>
                      <h3>{{ s.title }}</h3>
                    </div>
                    <span class="status-pill" [ngClass]="s.status">{{ statusLabel(s.status) }}</span>
                  </div>

                  <div class="detail-grid">
                    <span><i class="fas fa-calendar-day"></i> {{ s.date | date: 'EEE, MMM d, y' : 'UTC' }}</span>
                    <span><i class="fas fa-clock"></i> {{ s.startTime }} - {{ s.endTime }}</span>
                    <span><i class="fas fa-location-dot"></i> {{ s.venue }}{{ s.court ? ' - ' + s.court : '' }}</span>
                    <span><i class="fas fa-coins"></i> {{ s.feePerPlayer | currency: 'PHP' : 'symbol-narrow' }} / player</span>
                  </div>

                  <div class="capacity">
                    <div class="capacity-line">
                      <span>{{ s.currentPlayers }}/{{ s.maxPlayers }} joined</span>
                      <strong>{{ spotsLeft(s) }} {{ spotsLeft(s) === 1 ? 'spot' : 'spots' }} left</strong>
                    </div>
                    <div class="slots-bar" aria-hidden="true">
                      <div class="slots-fill" [class.warning]="fillPct(s) >= 80" [style.width.%]="fillPct(s)"></div>
                    </div>
                  </div>

                  @if (s.description) {
                    <p class="description">{{ s.description }}</p>
                  }

                  <div class="actions">
                    @if (s.queueManagementEnabled ?? queueEnabled()) {
                      <button class="action primary" (click)="openQueue(s)"><i class="fas fa-list-ol"></i> Queue</button>
                    } @else if ((s.status === 'open' || s.status === 'full' || s.status === 'closed') && s.date >= todayStr) {
                      <button class="action" (click)="openEnableQueue(s)"><i class="fas fa-list-ol"></i> Enable Queue</button>
                    }
                    <button class="action" (click)="viewParticipants(s)"><i class="fas fa-user-group"></i> Participants</button>
                    <button class="action" (click)="openEdit(s)"><i class="fas fa-pen"></i> Edit</button>
                    @if (s.status === 'open' || s.status === 'full') {
                      <button class="action" (click)="setStatus(s, 'closed')"><i class="fas fa-lock"></i> Close</button>
                    } @else if (s.status === 'closed' || s.status === 'completed') {
                      <button class="action" (click)="setStatus(s, 'open')"><i class="fas fa-lock-open"></i> Reopen</button>
                    }
                    <button class="action danger" (click)="confirmDelete(s)"><i class="fas fa-trash"></i> Delete</button>
                  </div>

                  @if (errorMap[s._id]) {
                    <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ errorMap[s._id] }}</div>
                  }
                </article>
              }
            </section>
          }
        </main>
      }
    </div>

    @if (showForm) {
      <div class="modal-backdrop">
        <div class="modal session-modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <span class="modal-kicker">{{ editingId ? 'Update session' : 'Create session' }}</span>
              <h3>{{ editingId ? 'Edit Hosted Play' : 'New Hosted Play' }}</h3>
            </div>
            <button class="x" (click)="closeForm()" aria-label="Close"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="modal-body form-grid">
            <label class="field wide"><span>Event Title *</span>
              <input type="text" [(ngModel)]="form.title" placeholder="Friday Night Doubles" />
            </label>
            <label class="field"><span>Sport *</span>
              <select [(ngModel)]="form.sport">
                <option value="tennis">Tennis</option>
                <option value="pickleball">Pickleball</option>
              </select>
            </label>
            <label class="field"><span>Date *</span>
              <input type="date" [(ngModel)]="form.date" [min]="todayStr" />
            </label>
            <label class="field"><span>Start Time *</span>
              <input type="time" [(ngModel)]="form.startTime" />
            </label>
            <label class="field"><span>End Time *</span>
              <input type="time" [(ngModel)]="form.endTime" />
            </label>
            <label class="field wide"><span>Venue Name *</span>
              @if (clubCourts.length > 0) {
                <select [ngModel]="form.venue" (ngModelChange)="onVenueSelected($event)">
                  <option value="" disabled>Select court...</option>
                  @for (c of clubCourts; track c.name) {
                    <option [value]="c.name">{{ c.name }}</option>
                  }
                </select>
              } @else {
                <input type="text" [(ngModel)]="form.venue" placeholder="Baseline Courts" />
              }
            </label>
            <label class="field"><span>Court Name</span>
              <input type="text" [(ngModel)]="form.court" placeholder="Court 1" />
            </label>
            <label class="field"><span>Fee Per Player</span>
              <input type="number" min="0" step="1" [(ngModel)]="form.feePerPlayer" />
            </label>
            <label class="field"><span>Maximum Players *</span>
              <input type="number" min="2" step="1" [(ngModel)]="form.maxPlayers" />
            </label>
            @if (queueEnabled()) {
              <label class="field"><span>Number of Courts *</span>
                <input type="number" min="1" step="1" [(ngModel)]="form.numberOfCourts" />
              </label>
            }
            <label class="field wide"><span>Address</span>
              <input type="text" [(ngModel)]="form.address" placeholder="123 Main St" />
            </label>
            <label class="field wide"><span>Description</span>
              <textarea rows="3" [(ngModel)]="form.description" placeholder="Notes for members..."></textarea>
            </label>
            @if (formError) {
              <div class="alert wide"><i class="fas fa-exclamation-triangle"></i> {{ formError }}</div>
            }
          </div>

          <div class="modal-foot">
            <button class="secondary-btn" (click)="closeForm()">Cancel</button>
            <button class="primary-action" [disabled]="saving" (click)="save()">
              @if (saving) { <i class="fas fa-circle-notch fa-spin"></i> Saving }
              @else { {{ editingId ? 'Save Changes' : 'Create Session' }} }
            </button>
          </div>
        </div>
      </div>
    }

    @if (showQueueFeeDisclaimer) {
      <div class="modal-backdrop" (click)="cancelQueueEnable()">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()">
          <div class="confirm-icon queue-confirm-icon"><i class="fas fa-list-ol"></i></div>
          <h3>Enable Queue Management?</h3>
          @if (queueFeePerPlayer() > 0) {
            <p>
              Queue Management charges a fee of
              <strong>{{ queueFeePerPlayer() | currency: 'PHP' : 'symbol' }}</strong> per session created
              while this feature is active.
              This fee is recorded in Finance &rsaquo; App Services.
            </p>
          } @else {
            <p>
              Enabling Queue Management turns on check-in, court rotation, and a live queue board
              for sessions you create while this feature is active.
            </p>
          }
          <div class="modal-foot">
            <button class="secondary-btn" (click)="cancelQueueEnable()">Cancel</button>
            <button class="primary-action" (click)="confirmQueueEnable()"><i class="fas fa-check"></i> Enable Queue</button>
          </div>
        </div>
      </div>
    }

    @if (showEnableQueue && enablingQueueSession) {
      <div class="modal-backdrop" (click)="cancelEnableQueue()">
        <div class="modal session-modal" style="max-width:420px" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <span class="modal-kicker">Queue setup</span>
              <h3>Enable Queue Management</h3>
            </div>
            <button class="x" (click)="cancelEnableQueue()" aria-label="Close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <p style="color:var(--muted);font-size:.84rem;margin:0 0 .75rem;line-height:1.5">
              Enabling Queue Management on <strong style="color:var(--text)">{{ enablingQueueSession.title }}</strong> is permanent.
              Once enabled, court rotation and check-in management will be active. You can configure courts and players per court via <strong style="color:var(--text)">Edit</strong>.
            </p>
            @if (queueFeePerPlayer() > 0) {
              <p style="color:var(--muted);font-size:.84rem;margin:0 0 .75rem;line-height:1.5">
                A Queue Management fee of <strong style="color:var(--text)">{{ queueFeePerPlayer() | currency: 'PHP' : 'symbol' }}</strong> will be billed to App Services for this session.
              </p>
            }
            @if (enableQueueError) {
              <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ enableQueueError }}</div>
            }
          </div>
          <div class="modal-foot">
            <button class="secondary-btn" (click)="cancelEnableQueue()" [disabled]="enablingQueue">Cancel</button>
            <button class="primary-action" (click)="doEnableQueue()" [disabled]="enablingQueue">
              @if (enablingQueue) { <i class="fas fa-circle-notch fa-spin"></i> Enabling }
              @else { <i class="fas fa-check"></i> Enable Queue }
            </button>
          </div>
        </div>
      </div>
    }

    @if (showDeleteConfirm && deletingSession) {
      <div class="modal-backdrop" (click)="cancelDelete()">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()">
          <div class="confirm-icon"><i class="fas fa-trash"></i></div>
          <h3>Delete Session?</h3>
          <p><strong>{{ deletingSession.title }}</strong> will be permanently deleted along with all participants. This cannot be undone.</p>
          <div class="modal-foot">
            <button class="secondary-btn" (click)="cancelDelete()" [disabled]="deleting">Cancel</button>
            <button class="danger-action" (click)="doDelete()" [disabled]="deleting">
              @if (deleting) { <i class="fas fa-circle-notch fa-spin"></i> Deleting }
              @else { <i class="fas fa-trash"></i> Delete }
            </button>
          </div>
        </div>
      </div>
    }

    @if (showParticipants) {
      <div class="modal-backdrop" (click)="closeParticipants()">
        <div class="modal participants-modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <span class="modal-kicker">Roster</span>
              <h3>Participants</h3>
            </div>
            <button class="x" (click)="closeParticipants()" aria-label="Close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            @if (participantsLoading) {
              <div class="state-inline"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>
            } @else if (participants.length === 0) {
              <div class="empty-inline"><i class="fas fa-user-slash"></i><span>No members have joined yet.</span></div>
            } @else {
              <div class="participant-list">
                @for (p of participants; track p._id; let i = $index) {
                  <div class="participant-row">
                    <span class="participant-num">{{ i + 1 }}</span>
                    <span class="participant-name">{{ p.memberName || 'Member' }}</span>
                    <span class="participant-date">{{ (p.dateJoined || p.createdAt) | date: 'MMM d, h:mm a' }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }

    @if (showCourtsModal) {
      <div class="modal-backdrop">
        <div class="modal courts-modal">
          <div class="modal-head">
            <div>
              <span class="modal-kicker">Club settings</span>
              <h3>Manage Courts</h3>
            </div>
            <button class="x" (click)="closeCourts()" aria-label="Close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <p class="courts-hint">Courts appear as venue options when creating a session. Selecting one auto-fills the address.</p>

            <div class="courts-list">
              @if (courtsEdit.length === 0) {
                <div class="courts-empty">No courts added yet.</div>
              }
              @for (court of courtsEdit; track $index; let i = $index) {
                <div class="court-row">
                  @if (court.logo) {
                    <img [src]="court.logo" class="court-logo-thumb" alt="logo" />
                  } @else {
                    <div class="court-logo-placeholder"><i class="fas fa-map-marker-alt"></i></div>
                  }
                  <div class="court-info">
                    <span class="court-name">{{ court.name }}</span>
                    @if (court.address) {
                      <span class="court-address">{{ court.address }}</span>
                    }
                  </div>
                  <button type="button" class="court-remove" (click)="removeCourt(i)" aria-label="Remove"><i class="fas fa-times"></i></button>
                </div>
              }
            </div>

            <div class="court-add-form">
              <span class="court-add-label">Add a court</span>
              <div class="court-logo-row">
                @if (newCourtLogo) {
                  <img [src]="newCourtLogo" class="court-logo-preview" alt="preview" />
                  <button type="button" class="court-logo-clear" (click)="newCourtLogo = ''"><i class="fas fa-times"></i> Remove</button>
                } @else {
                  <label class="court-logo-upload-btn" [class.uploading]="uploadingCourtLogo">
                    <i class="fas" [class.fa-circle-notch]="uploadingCourtLogo" [class.fa-spin]="uploadingCourtLogo" [class.fa-image]="!uploadingCourtLogo"></i>
                    <span>{{ uploadingCourtLogo ? 'Uploading…' : 'Upload Logo' }}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none"
                      (change)="onCourtLogoSelected($event)" [disabled]="uploadingCourtLogo" />
                  </label>
                }
              </div>
              <input class="court-input" type="text" [(ngModel)]="newCourtName" placeholder="Court name *" (keydown.enter)="addCourt()" />
              <input class="court-input" type="text" [(ngModel)]="newCourtAddress" placeholder="Address (optional)" (keydown.enter)="addCourt()" />
              <button type="button" class="court-add-btn" (click)="addCourt()" [disabled]="!newCourtName.trim() || uploadingCourtLogo">
                <i class="fas fa-plus"></i> Add Court
              </button>
            </div>

            @if (courtsError) {
              <div class="alert" style="margin-top:.75rem"><i class="fas fa-exclamation-triangle"></i> {{ courtsError }}</div>
            }
          </div>
          <div class="modal-foot">
            <button class="secondary-btn" (click)="closeCourts()">Cancel</button>
            <button class="primary-action" [disabled]="courtsSaving" (click)="saveCourts()">
              @if (courtsSaving) { <i class="fas fa-circle-notch fa-spin"></i> Saving }
              @else { Save Courts }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      --bg: #07130d;
      --panel: rgba(18,37,29,.94);
      --surface: #12251d;
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

    .hp-shell {
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.13), transparent 28rem),
        linear-gradient(180deg, #0b1b12 0%, var(--bg) 34rem);
      padding: 0 1rem 2rem;
    }
    .topbar {
      max-width: 1180px;
      margin: 0 auto;
      min-height: 74px;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      align-items: center;
      gap: .85rem;
      padding: .85rem 0;
      position: sticky;
      top: 0;
      z-index: 20;
      background: linear-gradient(180deg, rgba(7,19,13,.98), rgba(7,19,13,.88));
      backdrop-filter: blur(10px);
    }
    .back-btn, .x {
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
    .x { width: 38px; height: 38px; border-radius: 10px; }
    .topbar-kicker, .modal-kicker { display: block; color: var(--accent); font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .15rem; }
    .topbar h1 { margin: 0; font-size: 1.08rem; line-height: 1.2; }
    .page { max-width: 1180px; margin: 0 auto; }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: end;
      padding: 1.25rem;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgba(25,53,42,.94), rgba(9,27,17,.96)),
        url('/tennis-court-surface.png') center / cover;
      box-shadow: var(--shadow);
      overflow: hidden;
      position: relative;
    }
    .hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(7,19,13,.18), rgba(7,19,13,.7)); pointer-events: none; }
    .hero > * { position: relative; z-index: 1; }
    .eyebrow { display: inline-flex; align-items: center; gap: .45rem; color: var(--accent); font-size: .75rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .55rem; }
    .hero h2 { margin: 0; font-size: clamp(1.9rem, 4vw, 3.3rem); line-height: 1; letter-spacing: 0; }
    .hero p { margin: .75rem 0 0; color: rgba(255,255,255,.73); line-height: 1.5; max-width: 680px; }
    .hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: .65rem; }
    .queue-badge { display: inline-flex; align-items: center; gap: .45rem; color: var(--accent); background: rgba(163,230,53,.13); border: 1px solid rgba(163,230,53,.22); border-radius: 999px; padding: .42rem .75rem; font-size: .74rem; font-weight: 900; }
    .secondary-action { display: inline-flex; align-items: center; gap: .45rem; padding: .55rem 1.1rem; background: rgba(255,255,255,.07); color: var(--text); border: 1px solid var(--border); border-radius: 10px; font-size: .85rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s; }
    .secondary-action:hover { background: rgba(255,255,255,.13); }

    /* Courts modal */
    .courts-modal { max-width: 460px; }
    .courts-hint { font-size: .82rem; color: var(--muted); margin: 0 0 .85rem; line-height: 1.5; }
    .courts-list { display: flex; flex-direction: column; gap: .4rem; margin-bottom: .85rem; }
    .courts-empty { font-size: .85rem; color: var(--soft); padding: .4rem 0; }
    .court-row { display: flex; align-items: center; gap: .65rem; padding: .5rem .75rem; background: rgba(255,255,255,.05); border: 1px solid var(--border); border-radius: 10px; }
    .court-logo-thumb { width: 38px; height: 38px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: rgba(255,255,255,.08); }
    .court-logo-placeholder { width: 38px; height: 38px; border-radius: 8px; background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.2); display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: .85rem; flex-shrink: 0; }
    .court-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
    .court-name { font-size: .9rem; color: var(--text); font-weight: 700; }
    .court-address { font-size: .76rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .court-remove { background: none; border: none; color: rgba(248,113,113,.6); cursor: pointer; font-size: .8rem; padding: 2px 4px; font-family: inherit; transition: color .15s; flex-shrink: 0; }
    .court-remove:hover { color: #fb7185; }
    .court-add-form { display: flex; flex-direction: column; gap: .55rem; padding: .85rem; background: rgba(255,255,255,.03); border: 1px dashed rgba(255,255,255,.12); border-radius: 12px; }
    .court-add-label { font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); }
    .court-logo-row { display: flex; align-items: center; gap: .65rem; }
    .court-logo-preview { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; border: 1px solid var(--border); }
    .court-logo-clear { background: none; border: none; color: rgba(248,113,113,.7); font-size: .78rem; cursor: pointer; font-family: inherit; padding: 0; display: flex; align-items: center; gap: .3rem; }
    .court-logo-clear:hover { color: #fb7185; }
    .court-logo-upload-btn { display: inline-flex; align-items: center; gap: .4rem; padding: .48rem .85rem; background: rgba(255,255,255,.05); border: 1px dashed rgba(255,255,255,.2); border-radius: 8px; color: var(--muted); font-size: .82rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
    .court-logo-upload-btn:hover { background: rgba(255,255,255,.1); }
    .court-logo-upload-btn.uploading { opacity: .6; cursor: wait; }
    .court-input { width: 100%; padding: .6rem .8rem; background: rgba(255,255,255,.05); border: 1px solid var(--border); border-radius: 10px; font-size: .9rem; color: var(--text); font-family: inherit; outline: none; box-sizing: border-box; }
    .court-input::placeholder { color: rgba(255,255,255,.28); }
    .court-input:focus { border-color: rgba(163,230,53,.42); box-shadow: 0 0 0 3px rgba(163,230,53,.1); }
    .court-add-btn { align-self: flex-start; display: inline-flex; align-items: center; gap: .35rem; padding: .6rem 1rem; background: rgba(163,230,53,.1); color: var(--accent); border: 1px solid rgba(163,230,53,.3); border-radius: 10px; font-size: .85rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s; }
    .court-add-btn:hover:not(:disabled) { background: rgba(163,230,53,.2); }
    .court-add-btn:disabled { opacity: .4; cursor: default; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: .85rem; margin: 1rem 0; }
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

    .session-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 1rem; align-items: start; }
    .session-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 12px 32px rgba(0,0,0,.2);
    }
    .card-head { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; gap: .75rem; align-items: center; margin-bottom: 1rem; }
    .venue-mark { width: 46px; height: 46px; border-radius: 8px; background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.18); color: var(--accent); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .venue-logo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .venue-initials { font-size: .72rem; font-weight: 950; letter-spacing: .02em; text-transform: uppercase; }
    .title-block { min-width: 0; }
    .sport-label { display: block; color: var(--muted); font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; margin-bottom: .18rem; }
    .title-block h3 { margin: 0; font-size: 1.1rem; line-height: 1.25; overflow-wrap: anywhere; }
    .status-pill { white-space: nowrap; font-size: .72rem; font-weight: 950; border-radius: 999px; padding: .32rem .72rem; text-transform: capitalize; }
    .status-pill.open { color: var(--accent); background: rgba(163,230,53,.14); border: 1px solid rgba(163,230,53,.18); }
    .status-pill.full { color: var(--amber); background: rgba(245,158,11,.14); border: 1px solid rgba(245,158,11,.18); }
    .status-pill.closed { color: var(--muted); background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1); }
    .status-pill.cancelled, .status-pill.completed { color: #fca5a5; background: rgba(239,68,68,.14); border: 1px solid rgba(239,68,68,.18); }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; margin-bottom: 1rem; }
    .detail-grid span { min-width: 0; display: flex; align-items: flex-start; gap: .5rem; color: var(--muted); font-size: .84rem; line-height: 1.35; overflow-wrap: anywhere; }
    .detail-grid i { width: 16px; margin-top: .12rem; color: var(--accent); text-align: center; flex: 0 0 16px; }
    .capacity { margin-bottom: .9rem; }
    .capacity-line { display: flex; justify-content: space-between; gap: .75rem; margin-bottom: .5rem; color: var(--muted); font-size: .8rem; font-weight: 850; }
    .capacity-line strong { color: var(--text); white-space: nowrap; }
    .slots-bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
    .slots-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--teal)); border-radius: 999px; transition: width .25s; }
    .slots-fill.warning { background: linear-gradient(90deg, var(--amber), var(--danger)); }
    .description { margin: -.2rem 0 .85rem; color: var(--muted); font-size: .84rem; line-height: 1.5; }

    .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .action, .primary-action, .secondary-btn, .danger-action {
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      border-radius: 8px;
      font-weight: 900;
      white-space: nowrap;
    }
    .action { min-height: 38px; padding: .48rem .75rem; border: 1px solid var(--border); background: rgba(255,255,255,.055); color: var(--text); font-size: .78rem; }
    .action.primary, .primary-action { border: 0; background: var(--accent); color: #07130d; }
    .primary-action { min-height: 44px; padding: .72rem 1rem; box-shadow: 0 12px 24px rgba(163,230,53,.16); }
    .action.danger, .danger-action { color: #fca5a5; border: 1px solid rgba(239,68,68,.28); background: rgba(239,68,68,.12); }
    .secondary-btn { min-height: 44px; padding: .72rem 1rem; border: 1px solid var(--border); background: rgba(255,255,255,.06); color: var(--text); }
    button:disabled { opacity: .5; cursor: not-allowed; }

    .empty-panel, .state-card {
      min-height: 260px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .75rem;
      text-align: center;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 2rem 1rem;
    }
    .state-card { max-width: 520px; min-height: 160px; margin: 3rem auto; color: var(--muted); font-weight: 800; flex-direction: row; }
    .empty-icon { width: 76px; height: 76px; border-radius: 50%; background: rgba(163,230,53,.12); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; }
    .empty-panel h3 { margin: 0; font-size: 1.35rem; }
    .empty-panel p { max-width: 420px; margin: 0; color: var(--muted); line-height: 1.5; }
    .alert { padding: .7rem .85rem; border-radius: 8px; font-size: .84rem; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25); color: #fca5a5; display: flex; align-items: center; gap: .5rem; margin-top: .75rem; }

    .modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.68); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .modal { width: 100%; background: #12251d; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; box-shadow: 0 24px 70px rgba(0,0,0,.58); max-height: 92vh; overflow-y: auto; }
    .session-modal { max-width: 760px; }
    .participants-modal { max-width: 520px; }
    .confirm-modal { max-width: 390px; padding: 1.4rem; text-align: center; }
    .modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.1rem .7rem; }
    .modal h3 { margin: .1rem 0 0; font-size: 1.15rem; }
    .modal-body { padding: .4rem 1.1rem 1rem; }
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .8rem; }
    .wide { grid-column: 1 / -1; }
    .field { display: flex; flex-direction: column; gap: .35rem; }
    .field span { color: var(--muted); font-size: .78rem; font-weight: 850; }
    .field input, .field select, .field textarea {
      width: 100%;
      padding: .68rem .75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.055);
      color: var(--text);
      outline: none;
      font-family: inherit;
      font-size: .9rem;
      box-sizing: border-box;
    }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: rgba(163,230,53,.42); box-shadow: 0 0 0 3px rgba(163,230,53,.1); }
    .field input::-webkit-calendar-picker-indicator { filter: invert(1) sepia(1) saturate(5) hue-rotate(50deg); cursor: pointer; }
    .field select {
      color-scheme: dark;
      color: var(--text);
      background-color: #1b3028;
    }
    .field select option {
      color: #0c1a11;
      background: #ffffff;
    }
    .field select option:disabled {
      color: #6b7280;
    }
    .modal-foot { display: flex; justify-content: flex-end; gap: .65rem; padding: .85rem 1.1rem 1.1rem; }
    .modal-foot > * { min-width: 140px; }
    .confirm-icon { width: 58px; height: 58px; margin: 0 auto .8rem; border-radius: 50%; background: rgba(239,68,68,.14); color: #fca5a5; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; }
    .queue-confirm-icon { background: rgba(163,230,53,.13); color: var(--accent); }
    .confirm-modal p { color: var(--muted); line-height: 1.55; margin: .6rem 0 0; }
    .confirm-modal strong { color: var(--text); }

    /* Queue Management toggle row */
    .queue-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: .9rem; padding: .85rem 1rem; border: 1px solid rgba(163,230,53,.22); border-radius: 12px; background: rgba(8,25,17,.4); }
    .queue-setting-copy { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
    .queue-setting-title { color: var(--text); font-size: .9rem; font-weight: 800; display: flex; align-items: center; gap: .45rem; }
    .queue-setting-title i { color: var(--accent); }
    .queue-setting-desc { color: var(--muted); font-size: .78rem; line-height: 1.4; }
    .queue-switch { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
    .queue-switch input { opacity: 0; width: 0; height: 0; }
    .queue-slider { position: absolute; inset: 0; cursor: pointer; background: rgba(255,255,255,.16); border-radius: 999px; transition: .2s; }
    .queue-slider:before { content: ""; position: absolute; height: 20px; width: 20px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
    .queue-switch input:checked + .queue-slider { background: var(--accent); }
    .queue-switch input:checked + .queue-slider:before { transform: translateX(20px); }
    .queue-switch input:disabled + .queue-slider { opacity: .5; cursor: not-allowed; }

    .participant-list { display: flex; flex-direction: column; gap: .55rem; }
    .participant-row { display: flex; align-items: center; gap: .7rem; padding: .62rem .7rem; border-radius: 8px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.08); }
    .participant-num { width: 28px; height: 28px; flex: 0 0 28px; border-radius: 50%; background: rgba(163,230,53,.14); color: var(--accent); font-size: .75rem; font-weight: 950; display: flex; align-items: center; justify-content: center; }
    .participant-name { flex: 1; min-width: 0; color: var(--text); font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .participant-date { color: var(--muted); font-size: .76rem; white-space: nowrap; }
    .state-inline, .empty-inline { min-height: 150px; display: flex; align-items: center; justify-content: center; gap: .65rem; color: var(--muted); font-weight: 800; }
    .empty-inline { flex-direction: column; }
    .empty-inline i { color: var(--accent); font-size: 1.4rem; }

    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; }
      .hero-actions { align-items: flex-start; flex-direction: row; flex-wrap: wrap; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 620px) {
      .hp-shell { padding-inline: .75rem; }
      .topbar { grid-template-columns: 42px minmax(0, 1fr); }
      .session-grid { grid-template-columns: 1fr; }
      .card-head { grid-template-columns: 42px minmax(0, 1fr); }
      .venue-mark { width: 42px; height: 42px; }
      .status-pill { grid-column: 1 / -1; justify-self: start; }
      .detail-grid { grid-template-columns: 1fr; }
      .capacity-line { flex-direction: column; gap: .2rem; }
      .actions { display: grid; grid-template-columns: 1fr 1fr; }
      .action { width: 100%; }
      .modal-backdrop { align-items: flex-end; padding: 0; }
      .modal { border-radius: 14px 14px 0 0; max-height: 94vh; }
      .form-grid { grid-template-columns: 1fr; }
      .modal-foot { flex-direction: column-reverse; }
      .modal-foot > * { width: 100%; }
      .participant-date { display: none; }
    }

    @media (max-width: 420px) {
      .stats-grid { grid-template-columns: 1fr; }
      .hero h2 { font-size: 1.85rem; }
      .actions { grid-template-columns: 1fr; }
    }
  `],
})
export class AdminHostedPlayComponent implements OnInit {
  loading = true;
  sessions: HostedPlaySession[] = [];
  errorMap: Record<string, string> = {};
  todayStr = new Date().toISOString().slice(0, 10);
  queueEnabled = signal(false);
  queueFeePerPlayer = signal(0);
  togglingQueue = false;
  showQueueFeeDisclaimer = false;
  clubCourts: Court[] = [];

  showCourtsModal = false;
  courtsEdit: Court[] = [];
  newCourtName = '';
  newCourtAddress = '';
  newCourtLogo = '';
  uploadingCourtLogo = false;
  courtsSaving = false;
  courtsError = '';

  showForm = false;
  editingId: string | null = null;
  saving = false;
  formError = '';
  form: FormModel = this.blankForm();

  showParticipants = false;
  participantsLoading = false;
  participants: HostedPlayParticipant[] = [];

  showDeleteConfirm = false;
  deletingSession: HostedPlaySession | null = null;
  deleting = false;

  showEnableQueue = false;
  enablingQueueSession: HostedPlaySession | null = null;
  enablingQueue = false;
  enableQueueError = '';

  constructor(
    private hp: HostedPlayService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private clubService: ClubService,
    private cloudinary: CloudinaryService,
  ) {}

  ngOnInit() {
    this.load();
    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (c) => {
          this.queueEnabled.set(!!c.hostedPlayQueueEnabled);
          this.queueFeePerPlayer.set(c.queueManagementFeePerPlayer ?? 0);
          this.clubCourts = (c.courts ?? []) as Court[];
          this.cdr.detectChanges();
        },
        error: () => {},
      });
    }
  }

  load() {
    this.loading = true;
    this.hp.listAll().subscribe({
      next: (list) => { this.sessions = list; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  blankForm(): FormModel {
    return {
      title: '', sport: 'tennis', date: '', startTime: '', endTime: '',
      venue: '', court: '', address: '', feePerPlayer: 0, maxPlayers: 8, description: '',
      numberOfCourts: 1,
    };
  }

  statusLabel(s: string): string {
    if (s === 'full') return 'Full';
    if (s === 'open') return 'Open';
    if (s === 'closed') return 'Closed';
    if (s === 'completed') return 'Completed';
    return 'Cancelled';
  }

  openCount(): number {
    return this.sessions.filter(s => s.status === 'open' || s.status === 'full').length;
  }

  joinedTotal(): number {
    return this.sessions.reduce((sum, s) => sum + (s.currentPlayers || 0), 0);
  }

  queueReadyCount(): number {
    return this.sessions.filter(s => (s.queueManagementEnabled ?? this.queueEnabled()) && (s.status === 'open' || s.status === 'full')).length;
  }

  requestToggleQueue(e: Event) {
    const enabled = (e.target as HTMLInputElement).checked;
    if (enabled) {
      this.showQueueFeeDisclaimer = true;
    } else {
      this.applyQueueToggle(enabled);
    }
  }

  confirmQueueEnable() {
    this.showQueueFeeDisclaimer = false;
    this.applyQueueToggle(true);
  }

  cancelQueueEnable() {
    this.showQueueFeeDisclaimer = false;
    this.cdr.detectChanges();
  }

  private applyQueueToggle(enabled: boolean) {
    this.togglingQueue = true;
    this.clubService.patchMyHostedPlayQueue(enabled).subscribe({
      next: (club) => {
        this.queueEnabled.set(!!club.hostedPlayQueueEnabled);
        this.togglingQueue = false;
        this.cdr.detectChanges();
      },
      error: () => { this.togglingQueue = false; this.cdr.detectChanges(); },
    });
  }

  fillPct(s: HostedPlaySession): number {
    if (!s.maxPlayers) return 0;
    return Math.min(100, Math.round(((s.currentPlayers || 0) / s.maxPlayers) * 100));
  }

  spotsLeft(s: HostedPlaySession): number {
    return Math.max(0, (s.maxPlayers || 0) - (s.currentPlayers || 0));
  }

  courtForSession(s: HostedPlaySession): Court | undefined {
    const venue = (s.venue || '').trim().toLowerCase();
    const court = (s.court || '').trim().toLowerCase();
    return this.clubCourts.find(c => {
      const name = c.name.trim().toLowerCase();
      return name === venue || (!!court && name === court);
    });
  }

  venueLogo(s: HostedPlaySession): string {
    return this.courtForSession(s)?.logo || '';
  }

  venueLabel(s: HostedPlaySession): string {
    return this.courtForSession(s)?.name || s.court || s.venue || s.title || 'Venue';
  }

  venueInitials(s: HostedPlaySession): string {
    const label = this.venueLabel(s);
    const parts = label.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  openCreate() {
    this.editingId = null;
    this.form = this.blankForm();
    this.formError = '';
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEdit(s: HostedPlaySession) {
    this.editingId = s._id;
    this.form = {
      title: s.title, sport: s.sport, date: (s.date || '').slice(0, 10),
      startTime: s.startTime, endTime: s.endTime, venue: s.venue, court: s.court || '',
      address: s.address || '', feePerPlayer: s.feePerPlayer, maxPlayers: s.maxPlayers,
      description: s.description || '', numberOfCourts: s.numberOfCourts ?? 1,
    };
    this.formError = '';
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm() { this.showForm = false; this.cdr.detectChanges(); }

  save() {
    if (!this.form.title || !this.form.date || !this.form.startTime || !this.form.endTime || !this.form.venue) {
      this.formError = 'Please fill in all required fields.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.form.maxPlayers || this.form.maxPlayers < 2) {
      this.formError = 'Maximum players must be at least 2.';
      this.cdr.detectChanges();
      return;
    }
    this.saving = true;
    this.formError = '';
    const req$ = this.editingId
      ? this.hp.update(this.editingId, this.form)
      : this.hp.create(this.form);
    req$.subscribe({
      next: () => { this.saving = false; this.showForm = false; this.load(); },
      error: (err) => { this.saving = false; this.formError = err?.error?.error || 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  setStatus(s: HostedPlaySession, status: 'open' | 'closed') {
    this.errorMap[s._id] = '';
    this.hp.setStatus(s._id, status).subscribe({
      next: (updated) => { s.status = updated.status; this.cdr.detectChanges(); },
      error: (err) => { this.errorMap[s._id] = err?.error?.error || 'Failed to update.'; this.cdr.detectChanges(); },
    });
  }

  confirmDelete(s: HostedPlaySession) {
    this.deletingSession = s;
    this.showDeleteConfirm = true;
    this.cdr.detectChanges();
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
    this.deletingSession = null;
    this.cdr.detectChanges();
  }

  doDelete() {
    if (!this.deletingSession) return;
    const s = this.deletingSession;
    this.deleting = true;
    this.errorMap[s._id] = '';
    this.hp.remove(s._id).subscribe({
      next: () => {
        this.sessions = this.sessions.filter((x) => x._id !== s._id);
        this.showDeleteConfirm = false;
        this.deletingSession = null;
        this.deleting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMap[s._id] = err?.error?.error || 'Failed to delete.';
        this.showDeleteConfirm = false;
        this.deletingSession = null;
        this.deleting = false;
        this.cdr.detectChanges();
      },
    });
  }

  openEnableQueue(s: HostedPlaySession) {
    this.enablingQueueSession = s;
    this.enableQueueError = '';
    this.showEnableQueue = true;
    this.cdr.detectChanges();
  }

  cancelEnableQueue() {
    this.showEnableQueue = false;
    this.enablingQueueSession = null;
    this.cdr.detectChanges();
  }

  doEnableQueue() {
    if (!this.enablingQueueSession) return;
    const s = this.enablingQueueSession;
    this.enablingQueue = true;
    this.enableQueueError = '';
    this.hp.enableQueue(s._id).subscribe({
      next: (updated) => {
        const idx = this.sessions.findIndex((x) => x._id === s._id);
        if (idx !== -1) this.sessions[idx] = { ...this.sessions[idx], ...updated };
        this.enablingQueue = false;
        this.showEnableQueue = false;
        this.enablingQueueSession = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.enableQueueError = err?.error?.error || 'Failed to enable queue.';
        this.enablingQueue = false;
        this.cdr.detectChanges();
      },
    });
  }

  viewParticipants(s: HostedPlaySession) {
    this.showParticipants = true;
    this.participantsLoading = true;
    this.participants = [];
    this.cdr.detectChanges();
    this.hp.getParticipants(s._id).subscribe({
      next: (list) => { this.participants = list; this.participantsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.participantsLoading = false; this.cdr.detectChanges(); },
    });
  }

  closeParticipants() { this.showParticipants = false; this.cdr.detectChanges(); }

  openQueue(s: HostedPlaySession) { this.router.navigate(['/admin/hosted-play', s._id, 'queue']); }

  onVenueSelected(name: string) {
    this.form.venue = name;
    const court = this.clubCourts.find(c => c.name === name);
    if (court?.address) this.form.address = court.address;
  }

  openCourts() {
    this.courtsEdit = this.clubCourts.map(c => ({ ...c }));
    this.newCourtName = '';
    this.newCourtAddress = '';
    this.newCourtLogo = '';
    this.courtsError = '';
    this.showCourtsModal = true;
    this.cdr.detectChanges();
  }

  closeCourts() { this.showCourtsModal = false; this.cdr.detectChanges(); }

  addCourt() {
    const name = this.newCourtName.trim();
    if (!name || this.courtsEdit.some(c => c.name === name)) return;
    this.courtsEdit = [...this.courtsEdit, {
      name,
      address: this.newCourtAddress.trim() || undefined,
      logo: this.newCourtLogo || undefined,
    }];
    this.newCourtName = '';
    this.newCourtAddress = '';
    this.newCourtLogo = '';
  }

  removeCourt(index: number) {
    this.courtsEdit = this.courtsEdit.filter((_, i) => i !== index);
  }

  async onCourtLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    const err = this.cloudinary.validateImage(file);
    if (err) { this.courtsError = err; this.cdr.detectChanges(); return; }
    this.uploadingCourtLogo = true;
    this.cdr.detectChanges();
    try {
      this.newCourtLogo = await this.cloudinary.uploadImage(file, 'courts');
    } catch {
      this.courtsError = 'Logo upload failed. Please try again.';
    } finally {
      this.uploadingCourtLogo = false;
      this.cdr.detectChanges();
    }
  }

  saveCourts() {
    const clubId = this.auth.user()?.clubId;
    if (!clubId) return;
    this.courtsSaving = true;
    this.courtsError = '';
    this.clubService.updateClub(clubId, { courts: this.courtsEdit } as any).subscribe({
      next: () => {
        this.clubCourts = [...this.courtsEdit];
        this.courtsSaving = false;
        this.showCourtsModal = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.courtsSaving = false;
        this.courtsError = err?.error?.error || 'Failed to save courts.';
        this.cdr.detectChanges();
      },
    });
  }

  goBack() { this.router.navigate(['/admin/dashboard']); }
}
