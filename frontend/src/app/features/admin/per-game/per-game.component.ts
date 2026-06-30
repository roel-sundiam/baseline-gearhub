import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PerGameService, GameJoin } from '../../../core/services/per-game.service';
import { RatesService } from '../../../core/services/rates.service';
import { ClubService } from '../../../core/services/club.service';
import { AuthService } from '../../../core/services/auth.service';

interface RosterRow extends GameJoin {
  recordGames: number;
  recordGuests: number;
  recordMethod: string;
  saving?: boolean;
  rowError?: string;
}

interface FeePreview {
  gameFee: number;
  guestFee: number;
  convenienceFee: number;
  total: number;
}

@Component({
  selector: 'app-admin-per-game',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe],
  template: `
    <div class="shell">
      <div class="header">
        <div class="header-left">
          <p class="kicker"><i class="fas fa-play-circle"></i> Per Game</p>
          <h2 class="title">Joined Players</h2>
          <p class="subtitle">Record games played for each joined player to generate their charge.</p>
        </div>
        <button class="btn-refresh" (click)="load()"><i class="fas fa-rotate"></i> Refresh</button>
      </div>

      <div class="date-bar">
        <div class="date-tabs">
          <button class="date-tab" [class.active]="!useCalendar" (click)="pickToday()">
            <i class="fas fa-bolt"></i> Today
          </button>
          <button class="date-tab" [class.active]="useCalendar" (click)="pickCalendar()">
            <i class="fas fa-calendar"></i> Calendar
          </button>
        </div>
        @if (useCalendar) {
          <input class="date-input" type="date" [value]="selectedDate" (change)="onDateChange($any($event.target).value)" />
        } @else {
          <div class="date-display"><i class="fas fa-calendar-day"></i> {{ selectedDate | date: 'MMMM d, yyyy' }}</div>
        }
      </div>

      @if (loading) {
        <div class="state-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else if (rows.length === 0) {
        <div class="state-empty">
          <i class="fas fa-user-clock state-empty-icon"></i>
          <p>No players have joined yet.</p>
        </div>
      } @else {
        <div class="cards">
          @for (row of rows; track row._id) {
            <div class="player-card" [class.is-recorded]="row.status === 'recorded'">
              <div class="player-head">
                <span class="player-avatar">{{ initials(row) }}</span>
                <div class="player-meta">
                  <div class="player-name">
                    {{ playerName(row) }}
                    @if (row.status === 'recorded') {
                      <span class="recorded-badge"><i class="fas fa-check"></i> Recorded</span>
                    }
                  </div>
                  <div class="player-since">Joined {{ row.createdAt | date: 'shortTime' }}</div>
                  @if (row.playDate) {
                    <div class="player-date"><i class="fas fa-calendar-day"></i> {{ row.playDate | date: 'MMM d, yyyy' }}</div>
                  }
                </div>
              </div>

              <div class="record-grid">
                <div class="field">
                  <label>Games played</label>
                  <input type="number" min="0" step="1"
                    [(ngModel)]="row.recordGames" name="games-{{ row._id }}"
                    (ngModelChange)="cdr.detectChanges()" />
                </div>
                <div class="field">
                  <label>Guests</label>
                  <input type="number" min="0" step="1"
                    [(ngModel)]="row.recordGuests" name="guests-{{ row._id }}"
                    (ngModelChange)="cdr.detectChanges()" />
                </div>
                <div class="field">
                  <label>Mark paid (optional)</label>
                  <select [(ngModel)]="row.recordMethod" name="method-{{ row._id }}">
                    <option value="">Leave unpaid</option>
                    <option value="GCash">GCash</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="GoTyme">GoTyme</option>
                  </select>
                </div>
              </div>

              @if (row.recordGames > 0 || row.recordGuests > 0) {
                @let p = preview(row);
                <div class="fee-preview">
                  <div class="fee-row">
                    <span>Game fee <span class="fee-calc">({{ row.recordGames }} × {{ perGameFee | currency:'PHP':'symbol':'1.2-2' }})</span></span>
                    <span>{{ p.gameFee | currency:'PHP':'symbol':'1.2-2' }}</span>
                  </div>
                  @if (p.guestFee > 0) {
                    <div class="fee-row">
                      <span>Guest fee <span class="fee-calc">({{ row.recordGuests }} × {{ perGameGuestFee | currency:'PHP':'symbol':'1.2-2' }})</span></span>
                      <span>{{ p.guestFee | currency:'PHP':'symbol':'1.2-2' }}</span>
                    </div>
                  }
                  @if (p.convenienceFee > 0) {
                    <div class="fee-row">
                      <span>Convenience fee</span>
                      <span>{{ p.convenienceFee | currency:'PHP':'symbol':'1.2-2' }}</span>
                    </div>
                  }
                  <div class="fee-total">
                    <span>Total</span>
                    <span>{{ p.total | currency:'PHP':'symbol':'1.2-2' }}</span>
                  </div>
                </div>
              }

              @if (row.rowError) { <div class="row-error"><i class="fas fa-exclamation-triangle"></i> {{ row.rowError }}</div> }

              <div class="card-actions">
                <button class="btn-record" [class.btn-update]="row.status === 'recorded'" [disabled]="row.saving" (click)="save(row)">
                  {{ row.saving ? (row.status === 'recorded' ? 'Updating…' : 'Recording…') : (row.status === 'recorded' ? 'Update Charge' : 'Record & Charge') }}
                </button>
              </div>
            </div>
          }
        </div>
      }

      @if (successMsg) { <div class="toast"><i class="fas fa-check-circle"></i> {{ successMsg }}</div> }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #0c1a11;
      --surface: #1b3028;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.5);
      --accent: #a3e635;
    }
    .shell { min-height: calc(100vh - 60px); background: var(--bg); padding: 1.5rem 1rem 4rem; max-width: 1000px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem; }
    .kicker { margin: 0 0 .2rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); }
    .title { margin: 0 0 .25rem; font-size: 1.5rem; font-weight: 800; color: var(--text); }
    .subtitle { margin: 0; font-size: .88rem; color: var(--muted); }
    .btn-refresh { padding: .5rem 1rem; background: rgba(255,255,255,.06); border: 1px solid var(--border); color: var(--text); border-radius: 9px; font-weight: 600; font-size: .85rem; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: .4rem; align-self: center; }
    .btn-refresh:hover { background: rgba(255,255,255,.1); }
    .date-bar { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .date-tabs { display: flex; gap: .4rem; }
    .date-tab { padding: .45rem .9rem; border: 1px solid var(--border); border-radius: 9px; background: rgba(255,255,255,.04); color: var(--muted); font-size: .85rem; font-weight: 600; font-family: inherit; cursor: pointer; display: flex; align-items: center; gap: .35rem; transition: all .15s; }
    .date-tab.active { background: rgba(163,230,53,.12); border-color: var(--accent); color: var(--accent); }
    .date-display { display: flex; align-items: center; gap: .4rem; font-size: .9rem; color: var(--text); padding: .45rem .8rem; background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 9px; }
    .date-display i { color: var(--accent); }
    .date-input { padding: .45rem .8rem; background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 9px; color: var(--text); font-size: .9rem; font-family: inherit; outline: none; color-scheme: dark; }
    .date-input:focus { border-color: var(--accent); }
    .state-loading { display: flex; align-items: center; gap: .6rem; padding: 3rem 0; color: var(--muted); font-size: .9rem; }
    .state-empty { text-align: center; padding: 4rem 1rem; color: var(--muted); }
    .state-empty-icon { font-size: 2.5rem; color: var(--accent); opacity: .3; display: block; margin-bottom: .75rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
    .player-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.1rem; }
    .player-card.is-recorded { border-color: rgba(163,230,53,.25); }
    .recorded-badge { display: inline-flex; align-items: center; gap: .25rem; font-size: .7rem; font-weight: 700; color: var(--accent); background: rgba(163,230,53,.12); border-radius: 999px; padding: .15rem .5rem; margin-left: .4rem; vertical-align: middle; }
    .player-head { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; }
    .player-avatar { width: 42px; height: 42px; border-radius: 50%; background: rgba(163,230,53,.12); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: .9rem; text-transform: uppercase; flex-shrink: 0; }
    .player-name { font-weight: 700; color: var(--text); font-size: .95rem; }
    .player-since { font-size: .75rem; color: var(--muted); }
    .player-date { font-size: .75rem; color: var(--accent); margin-top: .15rem; display: flex; align-items: center; gap: .3rem; }
    .record-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .field { display: flex; flex-direction: column; gap: .3rem; }
    .field:last-child { grid-column: 1 / -1; }
    .field label { font-size: .75rem; font-weight: 600; color: var(--muted); }
    .field input, .field select { padding: .5rem .7rem; background: rgba(255,255,255,.05); border: 1px solid var(--border); border-radius: 9px; color: var(--text); font-size: .9rem; font-family: inherit; outline: none; color-scheme: dark; }
    .field input:focus, .field select:focus { border-color: var(--accent); }
    .field select option { background: #1b3028; }
    .fee-preview { margin-top: .85rem; background: rgba(163,230,53,.05); border: 1px solid rgba(163,230,53,.15); border-radius: 10px; padding: .75rem .9rem; display: flex; flex-direction: column; gap: .35rem; }
    .fee-row { display: flex; justify-content: space-between; align-items: baseline; font-size: .82rem; color: var(--muted); }
    .fee-calc { font-size: .75rem; opacity: .7; margin-left: .25rem; }
    .fee-total { display: flex; justify-content: space-between; align-items: baseline; font-size: .92rem; font-weight: 800; color: var(--accent); border-top: 1px solid rgba(163,230,53,.15); padding-top: .35rem; margin-top: .1rem; }
    .row-error { margin-top: .6rem; font-size: .8rem; color: #fca5a5; display: flex; align-items: center; gap: .4rem; }
    .card-actions { margin-top: 1rem; }
    .btn-record { width: 100%; padding: .6rem; background: var(--accent); color: #0c1a11; border: none; border-radius: 9px; font-weight: 700; font-size: .9rem; font-family: inherit; cursor: pointer; transition: opacity .15s; }
    .btn-record.btn-update { background: rgba(163,230,53,.15); color: var(--accent); border: 1px solid rgba(163,230,53,.3); }
    .btn-record:hover:not(:disabled) { opacity: .85; }
    .btn-record:disabled { opacity: .4; cursor: not-allowed; }
    .toast { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); background: var(--surface); border: 1px solid rgba(163,230,53,.3); color: var(--accent); padding: .7rem 1.2rem; border-radius: 10px; font-size: .88rem; font-weight: 600; display: flex; align-items: center; gap: .5rem; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
    @media (max-width: 600px) { .header { flex-direction: column; align-items: flex-start; } }
  `],
})
export class AdminPerGameComponent implements OnInit {
  rows: RosterRow[] = [];
  loading = true;
  successMsg = '';

  todayStr = new Date().toISOString().slice(0, 10);
  selectedDate = this.todayStr;
  useCalendar = false;

  perGameFee = 0;
  perGameGuestFee = 0;
  convenienceFeeRate = 0;
  convenienceFeeMode = 'per_transaction';

  constructor(
    private perGame: PerGameService,
    private ratesService: RatesService,
    private clubService: ClubService,
    private auth: AuthService,
    public cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      forkJoin([this.ratesService.getRates(), this.clubService.getClub(clubId)]).subscribe({
        next: ([rates, club]) => {
          this.perGameFee = rates.perGameFee ?? 0;
          this.perGameGuestFee = rates.perGameGuestFee ?? 0;
          this.convenienceFeeRate = club.convenienceFeeRate ?? 0;
          this.convenienceFeeMode = club.convenienceFeeMode ?? 'per_transaction';
        },
      });
    }
    this.load();
  }

  preview(row: RosterRow): FeePreview {
    const games = Number(row.recordGames) || 0;
    const guests = Number(row.recordGuests) || 0;
    const gameFee = parseFloat((games * this.perGameFee).toFixed(2));
    const guestFee = parseFloat((guests * this.perGameGuestFee).toFixed(2));
    const subtotal = gameFee + guestFee;
    const convenienceFee = this.convenienceFeeMode === 'monthly_flat'
      ? 0
      : parseFloat((subtotal * this.convenienceFeeRate).toFixed(2));
    return { gameFee, guestFee, convenienceFee, total: parseFloat((subtotal + convenienceFee).toFixed(2)) };
  }

  pickToday() {
    this.selectedDate = this.todayStr;
    this.useCalendar = false;
    this.load();
  }

  pickCalendar() {
    this.useCalendar = true;
    this.cdr.detectChanges();
  }

  onDateChange(val: string) {
    if (!val) return;
    this.selectedDate = val;
    this.load();
  }

  load() {
    this.loading = true;
    this.cdr.detectChanges();
    this.perGame.getJoined(undefined, this.selectedDate).subscribe({
      next: (entries) => {
        this.rows = entries.map((e) => ({
          ...e,
          recordGames: e.status === 'recorded' ? (e.gamesPlayed ?? 0) : 0,
          recordGuests: e.guestCount ?? 0,
          recordMethod: '',
        }));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  playerName(row: GameJoin): string {
    return typeof row.playerId === 'object' && row.playerId ? row.playerId.name : 'Player';
  }

  initials(row: GameJoin): string {
    return this.playerName(row).split(' ').map((p) => p.charAt(0)).slice(0, 2).join('');
  }

  save(row: RosterRow) {
    row.rowError = '';
    if (!Number.isFinite(row.recordGames) || row.recordGames < 0) {
      row.rowError = 'Enter a valid number of games.';
      return;
    }
    row.saving = true;
    const body = {
      gamesPlayed: Number(row.recordGames),
      guestCount: Number(row.recordGuests) || 0,
      paymentMethod: row.recordMethod || undefined,
    };
    const call$ = row.status === 'recorded'
      ? this.perGame.updateRecord(row._id, body)
      : this.perGame.record(row._id, body);

    call$.subscribe({
      next: () => {
        const verb = row.status === 'recorded' ? 'Updated' : 'Recorded';
        row.status = 'recorded';
        row.saving = false;
        this.successMsg = `${verb} games for ${this.playerName(row)}.`;
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: (err) => {
        row.saving = false;
        row.rowError = err?.error?.error || 'Failed to save.';
        this.cdr.detectChanges();
      },
    });
  }
}
