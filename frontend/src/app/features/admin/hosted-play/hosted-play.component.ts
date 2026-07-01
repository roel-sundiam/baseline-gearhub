import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  HostedPlayService,
  HostedPlaySession,
  HostedPlayInput,
  HostedPlayParticipant,
} from '../../../core/services/hosted-play.service';

type FormModel = HostedPlayInput;

@Component({
  selector: 'app-admin-hosted-play',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="shell">
      <header class="hp-header">
        <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i></button>
        <span class="header-title">Hosted Play</span>
        <button class="new-btn" (click)="openCreate()"><i class="fas fa-plus"></i> New</button>
      </header>

      @if (loading) {
        <div class="state-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else {
        @if (sessions.length === 0) {
          <div class="empty">
            <div class="empty-icon"><i class="fas fa-calendar-plus"></i></div>
            <h2>No sessions yet</h2>
            <p>Create your first hosted play session for members to join.</p>
            <button class="btn-primary" (click)="openCreate()"><i class="fas fa-plus"></i> Create Session</button>
          </div>
        } @else {
          <div class="list">
            @for (s of sessions; track s._id) {
              <div class="card">
                <div class="card-top">
                  <span class="sport-pill" [class.pickleball]="s.sport === 'pickleball'">{{ s.sport | titlecase }}</span>
                  <span class="status-pill" [ngClass]="s.status">{{ statusLabel(s.status) }}</span>
                </div>
                <h3 class="card-title">{{ s.title }}</h3>
                <div class="meta">
                  <div class="meta-row"><i class="fas fa-calendar-day"></i> {{ s.date | date: 'EEE, MMM d, y' : 'UTC' }}</div>
                  <div class="meta-row"><i class="fas fa-clock"></i> {{ s.startTime }} – {{ s.endTime }}</div>
                  <div class="meta-row"><i class="fas fa-location-dot"></i> {{ s.venue }}{{ s.court ? ' · ' + s.court : '' }}</div>
                  <div class="meta-row"><i class="fas fa-coins"></i> {{ s.feePerPlayer | currency: 'PHP' : 'symbol-narrow' }} / player</div>
                  <div class="meta-row"><i class="fas fa-users"></i> {{ s.currentPlayers }}/{{ s.maxPlayers }} joined</div>
                </div>
                <div class="actions">
                  <button class="act" (click)="viewParticipants(s)"><i class="fas fa-user-group"></i> Participants</button>
                  <button class="act" (click)="openEdit(s)"><i class="fas fa-pen"></i> Edit</button>
                  @if (s.status === 'open' || s.status === 'full') {
                    <button class="act" (click)="setStatus(s, 'closed')"><i class="fas fa-lock"></i> Close</button>
                  } @else if (s.status === 'closed') {
                    <button class="act" (click)="setStatus(s, 'open')"><i class="fas fa-lock-open"></i> Reopen</button>
                  }
                  <button class="act danger" (click)="remove(s)"><i class="fas fa-trash"></i> Delete</button>
                </div>
                @if (errorMap[s._id]) { <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ errorMap[s._id] }}</div> }
              </div>
            }
          </div>
        }
      }
    </div>

    <!-- Create / Edit modal -->
    @if (showForm) {
      <div class="modal-backdrop" (click)="closeForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ editingId ? 'Edit Session' : 'New Hosted Play' }}</h3>
            <button class="x" (click)="closeForm()"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <label class="fld"><span>Event Title *</span>
              <input type="text" [(ngModel)]="form.title" placeholder="Friday Night Doubles" /></label>
            <label class="fld"><span>Sport *</span>
              <select [(ngModel)]="form.sport">
                <option value="tennis">Tennis</option>
                <option value="pickleball">Pickleball</option>
              </select></label>
            <label class="fld"><span>Date *</span>
              <input type="date" [(ngModel)]="form.date" [min]="todayStr" /></label>
            <div class="fld-row">
              <label class="fld"><span>Start Time *</span>
                <input type="time" [(ngModel)]="form.startTime" /></label>
              <label class="fld"><span>End Time *</span>
                <input type="time" [(ngModel)]="form.endTime" /></label>
            </div>
            <label class="fld"><span>Venue Name *</span>
              <input type="text" [(ngModel)]="form.venue" placeholder="Baseline Courts" /></label>
            <label class="fld"><span>Court Name (optional)</span>
              <input type="text" [(ngModel)]="form.court" placeholder="Court 1" /></label>
            <label class="fld"><span>Address</span>
              <input type="text" [(ngModel)]="form.address" placeholder="123 Main St" /></label>
            <div class="fld-row">
              <label class="fld"><span>Fee Per Player</span>
                <input type="number" min="0" step="1" [(ngModel)]="form.feePerPlayer" /></label>
              <label class="fld"><span>Maximum Players *</span>
                <input type="number" min="2" step="1" [(ngModel)]="form.maxPlayers" /></label>
            </div>
            <label class="fld"><span>Description (optional)</span>
              <textarea rows="2" [(ngModel)]="form.description" placeholder="Notes for members…"></textarea></label>
            @if (formError) { <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ formError }}</div> }
          </div>
          <div class="modal-foot">
            <button class="btn-ghost" (click)="closeForm()">Cancel</button>
            <button class="btn-primary" [disabled]="saving" (click)="save()">
              {{ saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Participants modal -->
    @if (showParticipants) {
      <div class="modal-backdrop" (click)="closeParticipants()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>Participants</h3>
            <button class="x" (click)="closeParticipants()"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            @if (participantsLoading) {
              <div class="state-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
            } @else if (participants.length === 0) {
              <p class="muted-center">No members have joined yet.</p>
            } @else {
              <div class="plist">
                @for (p of participants; track p._id; let i = $index) {
                  <div class="prow">
                    <span class="pnum">{{ i + 1 }}</span>
                    <span class="pname">{{ p.memberName || 'Member' }}</span>
                    <span class="pdate">{{ (p.dateJoined || p.createdAt) | date: 'MMM d, h:mm a' }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      --bg: #0c1a11;
      --surface: #1b3028;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.55);
      --accent: #a3e635;
    }
    .shell { min-height: 100vh; background: var(--bg); padding-bottom: 2rem; }
    .hp-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; }
    .back-btn { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,.08); border: none; color: var(--text); cursor: pointer; font-size: 1rem; }
    .header-title { font-weight: 700; color: var(--text); font-size: 1rem; }
    .new-btn { display: inline-flex; align-items: center; gap: .4rem; padding: .5rem .85rem; border: none; border-radius: 10px; background: var(--accent); color: #0c1a11; font-weight: 800; font-size: .82rem; cursor: pointer; font-family: inherit; }
    .state-loading { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 3rem 0; color: var(--muted); }
    .muted-center { text-align: center; color: var(--muted); font-size: .9rem; padding: 1.5rem 0; }
    .empty { max-width: 420px; margin: 3rem auto; text-align: center; padding: 0 1.5rem; }
    .empty-icon { width: 84px; height: 84px; margin: 0 auto 1.25rem; border-radius: 50%; background: rgba(163,230,53,.1); display: flex; align-items: center; justify-content: center; font-size: 2rem; color: var(--accent); }
    .empty h2 { color: var(--text); font-size: 1.3rem; margin: 0 0 .4rem; }
    .empty p { color: var(--muted); font-size: .9rem; line-height: 1.5; margin: 0 0 1.25rem; }
    .list { max-width: 560px; margin: .5rem auto 0; padding: 0 1rem; display: flex; flex-direction: column; gap: 1rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.1rem 1.2rem; }
    .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: .65rem; }
    .sport-pill { font-size: .72rem; font-weight: 700; color: var(--accent); background: rgba(163,230,53,.12); border-radius: 99px; padding: .28rem .7rem; }
    .sport-pill.pickleball { color: #63b3ed; background: rgba(99,179,237,.12); }
    .status-pill { font-size: .72rem; font-weight: 800; border-radius: 99px; padding: .28rem .75rem; text-transform: capitalize; }
    .status-pill.open { color: var(--accent); background: rgba(163,230,53,.14); }
    .status-pill.full { color: #fbbf24; background: rgba(251,191,36,.14); }
    .status-pill.closed { color: var(--muted); background: rgba(255,255,255,.08); }
    .status-pill.cancelled { color: #fca5a5; background: rgba(239,68,68,.14); }
    .card-title { color: var(--text); font-size: 1.15rem; font-weight: 800; margin: 0 0 .7rem; }
    .meta { display: flex; flex-direction: column; gap: .4rem; margin-bottom: .9rem; }
    .meta-row { display: flex; align-items: center; gap: .55rem; font-size: .86rem; color: var(--muted); }
    .meta-row i { width: 16px; text-align: center; color: var(--accent); font-size: .8rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .act { display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .75rem; border-radius: 9px; border: 1px solid var(--border); background: rgba(255,255,255,.05); color: var(--text); font-size: .8rem; font-weight: 700; cursor: pointer; font-family: inherit; }
    .act:hover { background: rgba(255,255,255,.1); }
    .act.danger { color: #fca5a5; border-color: rgba(239,68,68,.25); background: rgba(239,68,68,.08); }
    .alert { padding: .6rem .85rem; border-radius: 9px; font-size: .82rem; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25); color: #fca5a5; display: flex; align-items: center; gap: .45rem; margin-top: .75rem; }
    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: flex-end; justify-content: center; z-index: 1000; padding: 0; }
    .modal { background: var(--surface); width: 100%; max-width: 460px; max-height: 92vh; overflow-y: auto; border-radius: 18px 18px 0 0; display: flex; flex-direction: column; }
    @media (min-width: 600px) { .modal-backdrop { align-items: center; } .modal { border-radius: 18px; } }
    .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.2rem .6rem; }
    .modal-head h3 { margin: 0; color: var(--text); font-size: 1.1rem; }
    .x { width: 34px; height: 34px; border-radius: 8px; border: none; background: rgba(255,255,255,.08); color: var(--text); cursor: pointer; }
    .modal-body { padding: .4rem 1.2rem 1rem; display: flex; flex-direction: column; gap: .75rem; }
    .fld { display: flex; flex-direction: column; gap: .3rem; }
    .fld > span { font-size: .78rem; font-weight: 700; color: var(--muted); }
    .fld input, .fld select, .fld textarea { padding: .6rem .7rem; border-radius: 9px; border: 1px solid var(--border); background: rgba(255,255,255,.05); color: var(--text); font-size: .9rem; font-family: inherit; outline: none; box-sizing: border-box; }
    .fld input:focus, .fld select:focus, .fld textarea:focus { border-color: rgba(163,230,53,.4); }
    .fld input::-webkit-calendar-picker-indicator { filter: invert(1) sepia(1) saturate(5) hue-rotate(50deg); cursor: pointer; }
    .fld-row { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
    .modal-foot { display: flex; gap: .65rem; padding: .8rem 1.2rem 1.2rem; }
    .btn-ghost { flex: 1; padding: .75rem; border-radius: 11px; border: 1px solid var(--border); background: rgba(255,255,255,.05); color: var(--text); font-weight: 700; cursor: pointer; font-family: inherit; }
    .btn-primary { flex: 1; padding: .75rem; border-radius: 11px; border: none; background: var(--accent); color: #0c1a11; font-weight: 800; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: .4rem; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .plist { display: flex; flex-direction: column; gap: .5rem; }
    .prow { display: flex; align-items: center; gap: .7rem; padding: .55rem .65rem; border-radius: 10px; background: rgba(255,255,255,.04); border: 1px solid var(--border); }
    .pnum { width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; background: rgba(163,230,53,.14); color: var(--accent); font-size: .75rem; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .pname { flex: 1; color: var(--text); font-size: .9rem; font-weight: 600; }
    .pdate { color: var(--muted); font-size: .76rem; }
  `],
})
export class AdminHostedPlayComponent implements OnInit {
  loading = true;
  sessions: HostedPlaySession[] = [];
  errorMap: Record<string, string> = {};
  todayStr = new Date().toISOString().slice(0, 10);

  showForm = false;
  editingId: string | null = null;
  saving = false;
  formError = '';
  form: FormModel = this.blankForm();

  showParticipants = false;
  participantsLoading = false;
  participants: HostedPlayParticipant[] = [];

  constructor(private hp: HostedPlayService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.load(); }

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
    };
  }

  statusLabel(s: string): string {
    return s === 'full' ? 'Full' : s === 'open' ? 'Open' : s === 'closed' ? 'Closed' : 'Cancelled';
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
      description: s.description || '',
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

  remove(s: HostedPlaySession) {
    if (!confirm(`Delete "${s.title}"? This removes the session and its participants.`)) return;
    this.errorMap[s._id] = '';
    this.hp.remove(s._id).subscribe({
      next: () => { this.sessions = this.sessions.filter((x) => x._id !== s._id); this.cdr.detectChanges(); },
      error: (err) => { this.errorMap[s._id] = err?.error?.error || 'Failed to delete.'; this.cdr.detectChanges(); },
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

  goBack() { this.router.navigate(['/admin/dashboard']); }
}
