import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { RatesService } from '../../../core/services/rates.service';

interface PlayerRow {
  rowId: string;
  playerId: string;
  name: string;
  gamesWithoutLight: number;
  gamesWithLight: number;
  ballBoyUsed: boolean;
  paymentMethod: 'GCash' | 'Cash' | 'Bank Transfer';
  paid: boolean;
}

interface TrainingRow {
  rowId: string;
  trainerCoach: string;
  withLights: boolean;
  startTime: string;
  endTime: string;
}

interface CourtSessionRow {
  rowId: string;
  courtLabel: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-new-session',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="new-session-shell">
      <div class="page-header">
        <div class="hero-copy">
          <p class="eyebrow">Baseline Gearhub</p>
          <h2>Record Session</h2>
          <p class="subtitle">
            Log court sessions, players, trainings, and instantly compute billing.
          </p>
          <div class="hero-metrics">
            <span class="metric-pill">Courts: {{ courtSessions.length }}</span>
            <span class="metric-pill">Players: {{ playerRows.length }}</span>
            <span class="metric-pill">Trainings: {{ trainingRows.length }}</span>
          </div>
        </div>
        <a routerLink="/admin/sessions" class="btn-secondary back-btn">Back to Sessions</a>
      </div>

      <form (ngSubmit)="onSubmit()" class="session-form">
        <div class="form-card section-courts">
          <h3>Session Details</h3>
          <p class="hint">There are 2 courts, so enter the time range for each court.</p>

          <div class="session-meta-row">
            <div class="form-group">
              <label for="date">Date</label>
              <input id="date" type="date" [(ngModel)]="date" name="date" required />
            </div>
          </div>

          <div class="grid-scroll">
            <div class="court-session-header">
              <span class="col-court">Court</span>
              <span class="col-court-time">Start Time</span>
              <span class="col-court-time">End Time</span>
              <span class="col-court-fee">Court Fee</span>
              <span class="col-remove"></span>
            </div>

            @for (court of courtSessions; track court.rowId; let i = $index) {
              <div class="court-session-row">
                <div class="court-name">
                  <span>{{ court.courtLabel }}</span>
                  @if (i === 0) {
                    <button type="button" class="btn-copy" (click)="copyCourt1ToCourt2()">
                      Copy to Court 2
                    </button>
                  }
                </div>
                <div class="form-group col-court-time">
                  <input
                    type="time"
                    [(ngModel)]="court.startTime"
                    [name]="'courtStart_' + i"
                    required
                  />
                </div>
                <div class="form-group col-court-time">
                  <input
                    type="time"
                    [(ngModel)]="court.endTime"
                    [name]="'courtEnd_' + i"
                    required
                  />
                </div>
                <div class="court-fee fee-label">
                  {{ getCourtSessionFee(court) | currency: 'PHP' : 'symbol' : '1.2-2' }}
                </div>
                <button
                  type="button"
                  class="btn-remove col-remove"
                  (click)="removeCourtSession(court.rowId)"
                >
                  ✕
                </button>
              </div>
            }
          </div>
        </div>

        <div class="form-card section-players">
          <h3>Players & Games</h3>
          <p class="hint">Enter games without light and games with light separately per player.</p>
          <p class="rates-preview">
            Rates: 🌙 {{ withoutLightRate | currency: 'PHP' : 'symbol' : '1.2-2' }} | 💡
            {{ lightRate | currency: 'PHP' : 'symbol' : '1.2-2' }} | 🙋
            {{ ballBoyRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
          </p>

          <div class="grid-scroll">
            <div class="player-header">
              <span class="col-player">Player</span>
              <span class="col-games">🌙 Without Light</span>
              <span class="col-games">💡 With Light</span>
              <span class="col-total">Total</span>
              <span class="col-fee">Court Fee</span>
              <span class="col-ballboy">🙋 Ball Boy</span>
              <span class="col-method">Payment Method</span>
              <span class="col-paid">Paid</span>
              <span class="col-remove"></span>
            </div>

            @for (row of playerRows; track row.rowId; let i = $index) {
              <div class="player-row">
                <div class="form-group col-player">
                  <select
                    [(ngModel)]="row.playerId"
                    [name]="'playerId_' + i"
                    required
                    (change)="onPlayerSelect(i, $event)"
                  >
                    <option value="">— Select player —</option>
                    @for (p of availablePlayers; track p._id) {
                      <option [value]="p._id">{{ p.name }}</option>
                    }
                  </select>
                </div>
                <div class="form-group col-games">
                  <input
                    type="number"
                    [(ngModel)]="row.gamesWithoutLight"
                    [name]="'noLight_' + i"
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div class="form-group col-games">
                  <input
                    type="number"
                    [(ngModel)]="row.gamesWithLight"
                    [name]="'light_' + i"
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div class="col-total total-label">
                  {{ (row.gamesWithoutLight || 0) + (row.gamesWithLight || 0) }} game{{
                    (row.gamesWithoutLight || 0) + (row.gamesWithLight || 0) !== 1 ? 's' : ''
                  }}
                </div>
                <div class="col-fee fee-label">
                  {{ getRowCourtFee(row) | currency: 'PHP' : 'symbol' : '1.2-2' }}
                </div>
                <div class="form-group col-ballboy">
                  <div
                    class="toggle-switch small"
                    [class.on]="row.ballBoyUsed"
                    (click)="row.ballBoyUsed = !row.ballBoyUsed"
                  >
                    <div class="toggle-knob"></div>
                  </div>
                </div>
                <div class="form-group col-method">
                  <select [(ngModel)]="row.paymentMethod" [name]="'paymentMethod_' + i">
                    <option value="GCash">GCash</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <button
                  type="button"
                  class="btn-paid col-paid"
                  [class.active]="row.paid"
                  (click)="togglePaid(row)"
                >
                  {{ row.paid ? 'Paid' : 'Unpaid' }}
                </button>
                <button
                  type="button"
                  class="btn-remove col-remove"
                  (click)="removePlayer(row.rowId)"
                >
                  ✕
                </button>
              </div>
            }
          </div>

          <button type="button" class="btn-add-player" (click)="addPlayer()">+ Add Player</button>
        </div>

        <div class="form-card section-trainings">
          <h3>Trainings</h3>
          <p class="hint">
            Add training rows with trainer/coach, light mode, time range, and auto-computed total
            fee.
          </p>
          <p class="rates-preview">
            Training 2 Rates: 🌙
            {{ training2WithoutLightRate | currency: 'PHP' : 'symbol' : '1.2-2' }} | 💡
            {{ training2LightRate | currency: 'PHP' : 'symbol' : '1.2-2' }}
          </p>

          <div class="grid-scroll">
            <div class="training-header">
              <span class="col-coach">Trainer/Coach</span>
              <span class="col-training-mode">Light Mode</span>
              <span class="col-training-time">Start Time</span>
              <span class="col-training-time">End Time</span>
              <span class="col-training-fee">Total Fee</span>
              <span class="col-remove"></span>
            </div>

            @for (training of trainingRows; track training.rowId; let i = $index) {
              <div class="training-row">
                <div class="form-group col-coach">
                  <select [(ngModel)]="training.trainerCoach" [name]="'trainerCoach_' + i">
                    <option value="">Select Trainer/Coach</option>
                    @for (coach of coachOptions; track coach) {
                      <option [value]="coach">{{ coach }}</option>
                    }
                  </select>
                </div>
                <div class="form-group col-training-mode">
                  <div class="light-mode-toggle">
                    <span [class.mode-active]="!training.withLights">🌙 Without</span>
                    <div
                      class="toggle-switch small"
                      [class.on]="training.withLights"
                      (click)="training.withLights = !training.withLights"
                    >
                      <div class="toggle-knob"></div>
                    </div>
                    <span [class.mode-active]="training.withLights">💡 With</span>
                  </div>
                </div>
                <div class="form-group col-training-time">
                  <input
                    type="time"
                    [(ngModel)]="training.startTime"
                    [name]="'trainingStartTime_' + i"
                  />
                </div>
                <div class="form-group col-training-time">
                  <input
                    type="time"
                    [(ngModel)]="training.endTime"
                    [name]="'trainingEndTime_' + i"
                  />
                </div>
                <div class="col-training-fee fee-label">
                  {{ getTrainingTotalFee(training) | currency: 'PHP' : 'symbol' : '1.2-2' }}
                </div>
                <button
                  type="button"
                  class="btn-remove col-remove"
                  (click)="removeTraining(training.rowId)"
                >
                  ✕
                </button>
              </div>
            }
          </div>

          <button type="button" class="btn-add-player" (click)="addTraining()">
            + Add Training
          </button>
        </div>

        @if (errorMsg) {
          <div class="alert alert-error">{{ errorMsg }}</div>
        }

        <div class="form-actions">
          <button type="submit" class="btn-primary btn-lg" [disabled]="saving">
            {{ saving ? 'Saving...' : 'Record Session & Compute Charges' }}
          </button>
        </div>

        <div class="summary-card">
          <h3>Session Summary</h3>

          <div class="summary-grid">
            <div class="summary-section">
              <h4>Receipts</h4>
              <div class="summary-row">
                <span>Players & Games</span
                ><span>{{ getPlayersReceiptsTotal() | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
              </div>
              <div class="summary-row">
                <span>Trainings</span
                ><span>{{
                  getTrainingsReceiptsTotal() | currency: 'PHP' : 'symbol' : '1.2-2'
                }}</span>
              </div>
              <div class="summary-row summary-total">
                <span>Total Receipts</span
                ><span>{{ getTotalReceipts() | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
              </div>
            </div>

            <div class="summary-section">
              <h4>Expenses</h4>
              <div class="summary-row">
                <span>Ball Boy Fees</span
                ><span>{{ getBallBoyExpensesTotal() | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
              </div>
              <div class="summary-row">
                <span>Court Fees With Lights</span
                ><span>{{
                  getCourtFeesWithLightsExpense() | currency: 'PHP' : 'symbol' : '1.2-2'
                }}</span>
              </div>
              <div class="summary-row">
                <span>Court Fees Without Lights</span
                ><span>{{
                  getCourtFeesWithoutLightsExpense() | currency: 'PHP' : 'symbol' : '1.2-2'
                }}</span>
              </div>
              <div class="summary-row summary-total">
                <span>Total Expenses</span
                ><span>{{ getTotalExpenses() | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
              </div>
            </div>

            <div class="summary-section summary-net">
              <h4>Net</h4>
              <div class="summary-row summary-total">
                <span>Net Receipts</span
                ><span>{{ getNetReceipts() | currency: 'PHP' : 'symbol' : '1.2-2' }}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .new-session-shell {
        --surface: #ffffff;
        --panel: #f8fafc;
        --line: #dbe7ef;
        --ink: #0f172a;
        --muted: #4b5563;
        --accent: #0f766e;
        --accent-soft: #e6fffa;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.25rem 1.3rem;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: linear-gradient(130deg, #edfdf5 0%, #f8fafc 45%, #fff7ed 100%);
      }
      .hero-copy {
        max-width: 780px;
      }
      .eyebrow {
        margin: 0 0 0.25rem;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: #0f766e;
      }
      .page-header h2 {
        color: var(--ink);
        font-size: 1.85rem;
        line-height: 1.1;
        margin: 0;
      }
      .subtitle {
        color: var(--muted);
        font-size: 0.95rem;
        margin-top: 0.35rem;
      }
      .hero-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-top: 0.9rem;
      }
      .metric-pill {
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        border: 1px solid #bfe8dd;
        background: rgba(255, 255, 255, 0.8);
        color: #0f4f47;
        font-size: 0.77rem;
        font-weight: 700;
      }
      .back-btn {
        border-radius: 999px;
        white-space: nowrap;
        border-color: #bfd7c8;
        color: #7a5626;
        background: rgba(255, 255, 255, 0.9);
      }
      .session-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .form-card {
        background: var(--surface);
        border-radius: 16px;
        border: 1px solid var(--line);
        padding: 1.15rem;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
      }
      .form-card h3 {
        color: #0f172a;
        margin-bottom: 0.35rem;
        font-size: 1.02rem;
      }
      .hint {
        color: #667085;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }
      .rates-preview {
        color: #334155;
        font-size: 0.82rem;
        margin-bottom: 0.85rem;
      }
      .session-meta-row {
        display: grid;
        grid-template-columns: minmax(180px, 260px);
        margin-bottom: 0.75rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
      }
      .grid-scroll {
        overflow-x: auto;
        padding-bottom: 0.35rem;
      }
      .toggle-switch {
        width: 44px;
        height: 24px;
        background: #d6dee7;
        border-radius: 12px;
        position: relative;
        transition: background 0.2s;
        cursor: pointer;
      }
      .toggle-switch.on {
        background: var(--accent);
      }
      .toggle-knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: left 0.2s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }
      .toggle-switch.on .toggle-knob {
        left: 22px;
      }
      .toggle-switch.small {
        width: 38px;
        height: 22px;
      }
      .toggle-switch.small .toggle-knob {
        width: 18px;
        height: 18px;
      }
      .toggle-switch.small.on .toggle-knob {
        left: 18px;
      }
      .player-header,
      .court-session-header,
      .training-header {
        display: grid;
        gap: 0.5rem;
        padding: 0.55rem 0.25rem;
        font-size: 0.8rem;
        font-weight: 700;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 0.5rem;
        min-width: 980px;
      }
      .player-header {
        grid-template-columns: 2fr 1fr 1fr 80px 120px 80px 140px 72px 36px;
      }
      .player-row {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 80px 120px 80px 140px 72px 36px;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.45rem;
        padding: 0.45rem 0.25rem;
        min-width: 980px;
        border-radius: 10px;
        border: 1px solid transparent;
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }
      .player-row:hover,
      .court-session-row:hover,
      .training-row:hover {
        border-color: #d7e4ed;
        background: #fbfdff;
      }
      .court-session-header {
        grid-template-columns: 1fr 1fr 1fr 120px 36px;
        min-width: 760px;
      }
      .court-session-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 120px 36px;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.45rem;
        padding: 0.45rem 0.25rem;
        min-width: 760px;
        border-radius: 10px;
        border: 1px solid transparent;
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }
      .training-header {
        grid-template-columns: 2fr 1.4fr 1fr 1fr 120px 36px;
        margin-top: 0.35rem;
        min-width: 900px;
      }
      .training-row {
        display: grid;
        grid-template-columns: 2fr 1.4fr 1fr 1fr 120px 36px;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.45rem;
        padding: 0.45rem 0.25rem;
        min-width: 900px;
        border-radius: 10px;
        border: 1px solid transparent;
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }
      .court-name {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        font-weight: 700;
        color: #334155;
      }
      .btn-copy {
        border: 1px solid #bfdbfe;
        background: #eff6ff;
        color: #1e3a8a;
        border-radius: 999px;
        padding: 0.25rem 0.65rem;
        font-size: 0.75rem;
        cursor: pointer;
        font-weight: 600;
      }
      .btn-copy:hover {
        background: #dbeafe;
      }
      .total-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #0f172a;
        text-align: center;
      }
      .fee-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #0f766e;
        text-align: right;
        white-space: nowrap;
      }
      .col-method select,
      .court-session-row input,
      .training-row select,
      .training-row input,
      .player-row select,
      .player-row input {
        width: 100%;
        border: 1px solid #cbd7e1;
        border-radius: 9px;
        padding: 0.45rem 0.5rem;
        font-size: 0.85rem;
        background: white;
        box-sizing: border-box;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .col-method select:focus,
      .court-session-row input:focus,
      .training-row select:focus,
      .training-row input:focus,
      .player-row select:focus,
      .player-row input:focus {
        outline: none;
        border-color: #38bdf8;
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
      }
      .btn-paid {
        border: 1px solid #cbd7e1;
        background: #f8fafc;
        color: #4b5563;
        border-radius: 9px;
        height: 38px;
        padding: 0 0.65rem;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-paid.active {
        background: #f2e4c9;
        color: #7a5626;
        border-color: #e6d2ad;
      }
      .btn-remove {
        background: #fff5f5;
        border: 1px solid #ef4444;
        color: #b91c1c;
        border-radius: 9px;
        width: 36px;
        height: 38px;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .btn-remove:hover {
        background: #fee2e2;
      }
      .btn-add-player {
        background: linear-gradient(180deg, #f0fdfa, #f8fafc);
        border: 1px dashed #94d2c5;
        color: #0f766e;
        border-radius: 11px;
        padding: 0.6rem 1.25rem;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        width: 100%;
        margin-top: 0.5rem;
      }
      .btn-add-player:hover {
        background: linear-gradient(180deg, #def7ef, #f0fdfa);
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
      }
      .btn-lg {
        padding: 0.75rem 2rem;
        font-size: 1rem;
      }
      .light-mode-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        font-size: 0.8rem;
        color: #6b7280;
        white-space: nowrap;
      }
      .mode-active {
        color: #0f766e;
        font-weight: 700;
      }
      .summary-card {
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 1.1rem;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
      }
      .summary-card h3 {
        color: #0f172a;
        margin-bottom: 0.85rem;
        font-size: 1rem;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }
      .summary-section {
        background: #fff;
        border: 1px solid #e5edf4;
        border-radius: 12px;
        padding: 0.9rem;
      }
      .summary-section h4 {
        font-size: 0.9rem;
        color: #334155;
        margin-bottom: 0.75rem;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.35rem 0;
        font-size: 0.88rem;
        color: #475569;
      }
      .summary-total {
        border-top: 1px solid #e2e8f0;
        margin-top: 0.5rem;
        padding-top: 0.65rem;
        font-weight: 700;
        color: #0f172a;
      }
      .summary-net {
        background: linear-gradient(135deg, #faf3e6, #f8f1e4);
        border-color: #e6d2ad;
      }
      @media (max-width: 980px) {
        .page-header {
          flex-direction: column;
          align-items: stretch;
        }
        .back-btn {
          align-self: flex-start;
        }
      }
      @media (max-width: 700px) {
        .new-session-shell {
          gap: 0.75rem;
        }
        .page-header {
          padding: 1rem;
          border-radius: 14px;
        }
        .page-header h2 {
          font-size: 1.5rem;
        }
        .hero-metrics {
          gap: 0.35rem;
        }
        .metric-pill {
          font-size: 0.72rem;
        }
        .form-card,
        .summary-card {
          padding: 0.9rem;
          border-radius: 14px;
        }
        .session-meta-row {
          grid-template-columns: 1fr;
        }
        .form-actions {
          justify-content: stretch;
        }
        .btn-primary.btn-lg {
          width: 100%;
        }
        .summary-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class NewSessionComponent implements OnInit {
  date = new Date().toISOString().split('T')[0];
  courtSessions: CourtSessionRow[] = [
    this.createCourtSessionRow('Court 1'),
    this.createCourtSessionRow('Court 2'),
  ];
  playerRows: PlayerRow[] = [this.createPlayerRow()];
  trainingRows: TrainingRow[] = [this.createTrainingRow()];

  availablePlayers: { _id: string; name: string; email: string }[] = [];
  withoutLightRate = 0;
  lightRate = 0;
  training2WithoutLightRate = 0;
  training2LightRate = 0;
  ballBoyRate = 0;
  courtHourlyRateWithoutLights = 100;
  courtHourlyRateWithLights = 200;
  coachOptions = [
    'Coach Miguel Santos',
    'Coach Carla Reyes',
    'Coach Jomar Dela Cruz',
    'Coach Nina Velasco',
    'Coach Paolo Ramirez',
  ];
  saving = false;
  errorMsg = '';

  constructor(
    private usersService: UsersService,
    private sessionsService: SessionsService,
    private ratesService: RatesService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.ratesService.getRates().subscribe({
      next: (rates) => {
        this.withoutLightRate = Number(rates.withoutLightRate) || 0;
        this.lightRate = Number(rates.lightRate) || 0;
        this.training2WithoutLightRate = Number(rates.training2WithoutLightRate) || 0;
        this.training2LightRate = Number(rates.training2LightRate) || 0;
        this.ballBoyRate = Number(rates.ballBoyRate) || 0;
        this.cdr.detectChanges();
      },
    });

    this.usersService.getActivePlayers().subscribe({
      next: (players) => {
        this.availablePlayers = players;
        this.cdr.detectChanges();
      },
    });
  }

  addPlayer() {
    this.playerRows.push(this.createPlayerRow());
  }

  removePlayer(rowId: string) {
    this.playerRows = this.playerRows.filter((row) => row.rowId !== rowId);
    if (this.playerRows.length === 0) {
      this.playerRows = [this.createPlayerRow()];
    }
  }

  copyCourt1ToCourt2() {
    if (this.courtSessions.length < 2) {
      return;
    }

    this.courtSessions[1].startTime = this.courtSessions[0].startTime;
    this.courtSessions[1].endTime = this.courtSessions[0].endTime;
  }

  addTraining() {
    this.trainingRows.push(this.createTrainingRow());
  }

  removeTraining(rowId: string) {
    this.trainingRows = this.trainingRows.filter((row) => row.rowId !== rowId);
    if (this.trainingRows.length === 0) {
      this.trainingRows = [this.createTrainingRow()];
    }
  }

  removeCourtSession(rowId: string) {
    this.courtSessions = this.courtSessions.filter((row) => row.rowId !== rowId);
    if (this.courtSessions.length === 0) {
      this.courtSessions = [
        this.createCourtSessionRow('Court 1'),
        this.createCourtSessionRow('Court 2'),
      ];
    }
  }

  togglePaid(row: PlayerRow) {
    row.paid = !row.paid;
    if (!row.paid) {
      row.paymentMethod = 'GCash';
    }
  }

  onPlayerSelect(i: number, event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    const selected = this.availablePlayers.find((player) => player._id === id);
    if (selected) {
      this.playerRows[i].name = selected.name;
    }
  }

  getRowCourtFee(row: PlayerRow) {
    const gamesWithoutLight = Number(row.gamesWithoutLight) || 0;
    const gamesWithLight = Number(row.gamesWithLight) || 0;
    const totalGames = gamesWithoutLight + gamesWithLight;
    const withoutLightFee = gamesWithoutLight * this.withoutLightRate;
    const lightFee = gamesWithLight * this.lightRate;
    const ballBoyFee = row.ballBoyUsed ? totalGames * this.ballBoyRate : 0;
    return withoutLightFee + lightFee + ballBoyFee;
  }

  getTrainingTotalFee(training: TrainingRow) {
    const isBlankRow =
      !(training.trainerCoach || '').trim() &&
      !(training.startTime || '').trim() &&
      !(training.endTime || '').trim();

    if (isBlankRow) {
      return 0;
    }

    const withLightsCount = training.withLights ? 1 : 0;
    const withoutLightsCount = training.withLights ? 0 : 1;
    return (
      withoutLightsCount * this.training2WithoutLightRate +
      withLightsCount * this.training2LightRate
    );
  }

  private getTrainingDurationHours(startTime: string, endTime: string): number {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      return 0;
    }

    return (endMinutes - startMinutes) / 60;
  }

  getPlayersReceiptsTotal() {
    return this.playerRows.reduce((sum, row) => sum + this.getRowCourtFee(row), 0);
  }

  getTrainingsReceiptsTotal() {
    return this.trainingRows.reduce((sum, row) => sum + this.getTrainingTotalFee(row), 0);
  }

  getTotalReceipts() {
    return this.getPlayersReceiptsTotal() + this.getTrainingsReceiptsTotal();
  }

  getBallBoyExpensesTotal() {
    return this.playerRows.reduce((sum, row) => {
      const gamesWithoutLight = Number(row.gamesWithoutLight) || 0;
      const gamesWithLight = Number(row.gamesWithLight) || 0;
      const totalGames = gamesWithoutLight + gamesWithLight;
      return sum + (row.ballBoyUsed ? totalGames * this.ballBoyRate : 0);
    }, 0);
  }

  getCourtSessionFee(court: CourtSessionRow) {
    return this.getCourtSessionFeeBreakdown(court.startTime, court.endTime).totalFee;
  }

  getCourtFeesWithLightsExpense() {
    return this.courtSessions.reduce(
      (sum, court) =>
        sum + this.getCourtSessionFeeBreakdown(court.startTime, court.endTime).lightFee,
      0,
    );
  }

  getCourtFeesWithoutLightsExpense() {
    return this.courtSessions.reduce(
      (sum, court) =>
        sum + this.getCourtSessionFeeBreakdown(court.startTime, court.endTime).withoutLightFee,
      0,
    );
  }

  getTotalExpenses() {
    return (
      this.getBallBoyExpensesTotal() +
      this.getCourtFeesWithLightsExpense() +
      this.getCourtFeesWithoutLightsExpense()
    );
  }

  getNetReceipts() {
    return this.getTotalReceipts() - this.getTotalExpenses();
  }

  onSubmit() {
    this.errorMsg = '';

    const normalizedCourtSessions = this.courtSessions.map((court) => ({
      courtLabel: court.courtLabel,
      startTime: (court.startTime || '').trim(),
      endTime: (court.endTime || '').trim(),
    }));

    if (normalizedCourtSessions.length !== 2) {
      this.errorMsg = 'Please enter Session Details for both courts.';
      return;
    }

    for (const court of normalizedCourtSessions) {
      if (!court.startTime || !court.endTime) {
        this.errorMsg = 'Please enter start and end time for both courts.';
        return;
      }
      if (this.getCourtSessionDurationHours(court.startTime, court.endTime) <= 0) {
        this.errorMsg = 'Court end time must be later than start time.';
        return;
      }
    }

    for (const p of this.playerRows) {
      if (!p.playerId) {
        this.errorMsg = 'Please select a player for all rows.';
        return;
      }
      const totalGames = (Number(p.gamesWithoutLight) || 0) + (Number(p.gamesWithLight) || 0);
      if (totalGames < 1) {
        this.errorMsg = `${p.name || 'A player'} must have at least 1 game played.`;
        return;
      }
    }

    const uniqueIds = new Set(this.playerRows.map((row) => row.playerId));
    if (uniqueIds.size !== this.playerRows.length) {
      this.errorMsg = 'Each player can only appear once per session.';
      return;
    }

    const normalizedTrainings = this.trainingRows
      .map((t) => ({
        trainerCoach: (t.trainerCoach || '').trim(),
        withoutLights: t.withLights ? 0 : 1,
        withLights: t.withLights ? 1 : 0,
        startTime: (t.startTime || '').trim(),
        endTime: (t.endTime || '').trim(),
      }))
      .filter((t) => t.trainerCoach || t.startTime || t.endTime);

    for (const t of normalizedTrainings) {
      if (!t.trainerCoach) {
        this.errorMsg = 'Please enter Trainer/Coach for each training row.';
        return;
      }
      if (!t.startTime || !t.endTime) {
        this.errorMsg = 'Please enter start and end time for each training row.';
        return;
      }
      if (this.getTrainingDurationHours(t.startTime, t.endTime) <= 0) {
        this.errorMsg = 'Training end time must be later than start time.';
        return;
      }
    }

    this.saving = true;

    this.sessionsService
      .createSession({
        date: this.date,
        startTime: this.getEarliestCourtStartTime(this.courtSessions),
        endTime: this.getLatestCourtEndTime(this.courtSessions),
        ballBoyUsed: this.playerRows.some((player) => player.ballBoyUsed),
        players: this.playerRows.map((player) => ({
          playerId: player.playerId,
          gamesWithoutLight: Number(player.gamesWithoutLight) || 0,
          gamesWithLight: Number(player.gamesWithLight) || 0,
          ballBoyUsed: player.ballBoyUsed,
          paymentMethod: player.paymentMethod,
          paid: player.paid,
        })),
        trainings: normalizedTrainings,
        courtSessions: normalizedCourtSessions,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.cdr.detectChanges();
          this.router.navigate(['/admin/sessions']);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err.error?.error || 'Failed to record session.';
          this.cdr.detectChanges();
        },
      });
  }

  private createPlayerRow(): PlayerRow {
    return {
      rowId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      playerId: '',
      name: '',
      gamesWithoutLight: 0,
      gamesWithLight: 0,
      ballBoyUsed: false,
      paymentMethod: 'GCash',
      paid: false,
    };
  }

  private createTrainingRow(): TrainingRow {
    return {
      rowId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      trainerCoach: '',
      withLights: false,
      startTime: '',
      endTime: '',
    };
  }

  private createCourtSessionRow(courtLabel: string): CourtSessionRow {
    return {
      rowId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      courtLabel,
      startTime: '',
      endTime: '',
    };
  }

  private parseTimeToMinutes(timeStr: string) {
    if (!timeStr || !timeStr.includes(':')) {
      return null;
    }

    const [hour, minute] = timeStr.split(':').map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      return null;
    }

    return hour * 60 + minute;
  }

  private getCourtSessionDurationHours(startTime: string, endTime: string): number {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      return 0;
    }

    return (endMinutes - startMinutes) / 60;
  }

  private getCourtSessionFeeBreakdown(startTime: string, endTime: string) {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      return { withoutLightFee: 0, lightFee: 0, totalFee: 0 };
    }

    const lightsStart = 18 * 60;
    const lightsEnd = 22 * 60;
    const withLightsMinutes = Math.max(
      0,
      Math.min(endMinutes, lightsEnd) - Math.max(startMinutes, lightsStart),
    );
    const totalMinutes = endMinutes - startMinutes;
    const withoutLightsMinutes = totalMinutes - withLightsMinutes;
    const withoutLightFee = (withoutLightsMinutes / 60) * this.courtHourlyRateWithoutLights;
    const lightFee = (withLightsMinutes / 60) * this.courtHourlyRateWithLights;

    return {
      withoutLightFee: Number(withoutLightFee.toFixed(2)),
      lightFee: Number(lightFee.toFixed(2)),
      totalFee: Number((withoutLightFee + lightFee).toFixed(2)),
    };
  }

  private getEarliestCourtStartTime(rows: CourtSessionRow[]) {
    return (
      rows
        .map((court) => court.startTime)
        .filter(Boolean)
        .sort((a, b) => (this.parseTimeToMinutes(a) || 0) - (this.parseTimeToMinutes(b) || 0))[0] ||
      ''
    );
  }

  private getLatestCourtEndTime(rows: CourtSessionRow[]) {
    return (
      rows
        .map((court) => court.endTime)
        .filter(Boolean)
        .sort((a, b) => (this.parseTimeToMinutes(b) || 0) - (this.parseTimeToMinutes(a) || 0))[0] ||
      ''
    );
  }
}


