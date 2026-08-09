import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Tesseract from 'tesseract.js';
import { HostedPlayService, QueueBoard, ReclubImportConfirmRow } from '../../../../core/services/hosted-play.service';
import { extractNameCandidates, extractNamesFromOcrPage } from '../../../../core/utils/reclub-import-parser';

type Step = 'source' | 'parsing' | 'review';
type SourceMode = 'paste' | 'screenshot';

interface ReviewRow {
  rawName: string;
  finalName: string;
  suggestions: { userId: string; name: string; score: number; alreadyJoined: boolean }[];
  selection: string; // matched userId, or 'guest'
  alreadyImportedAsGuest: boolean;
}

@Component({
  selector: 'app-import-participants-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-card import-card" [class.review-mode]="step() === 'review'" (click)="$event.stopPropagation()">
        <div class="import-head">
          <div class="import-title">
            <span class="import-brand" aria-hidden="true"><i class="fas fa-users"></i></span>
            <div>
              <span class="panel-kicker">Reclub Participant Import</span>
              <h3>Import Players</h3>
            </div>
          </div>
          <div class="head-actions">
            <span class="step-pill">
              @if (step() === 'source') { Step 1 of 2 }
              @else if (step() === 'review') { Step 2 of 2 }
              @else { Preparing }
            </span>
            <button type="button" class="icon-close" (click)="close()" aria-label="Close"><i class="fas fa-times"></i></button>
          </div>
        </div>

        @if (step() === 'source') {
          <div class="source-tabs" role="tablist">
            <button type="button" [class.active]="sourceMode() === 'paste'" (click)="sourceMode.set('paste')">
              <span class="tab-icon"><i class="fas fa-clipboard"></i></span>
              <span><strong>Paste List</strong><small>Copy names from Reclub</small></span>
            </button>
            <button type="button" [class.active]="sourceMode() === 'screenshot'" (click)="sourceMode.set('screenshot')">
              <span class="tab-icon"><i class="fas fa-camera"></i></span>
              <span><strong>Upload Screenshot</strong><small>Extract names from an image</small></span>
            </button>
          </div>

          @if (sourceMode() === 'paste') {
            <div class="source-copy">
              <h4>Paste your participant list</h4>
              <p class="import-hint">Ratings, status labels, and other clutter are filtered out automatically.</p>
            </div>
            <div class="paste-field">
              <textarea rows="8" aria-label="Reclub participant list" placeholder="Juan Dela Cruz&#10;Pedro Santos&#10;Maria Garcia…" [(ngModel)]="pasteText"></textarea>
              <span class="paste-helper"><i class="fas fa-wand-magic-sparkles"></i> One player per line works best</span>
            </div>
            @if (error()) { <p class="import-error">{{ error() }}</p> }
            <div class="import-actions">
              <button class="modal-cancel" (click)="close()">Cancel</button>
              <button class="modal-confirm modal-confirm-save" [disabled]="!pasteText.trim()" (click)="parsePaste()">
                <i class="fas fa-arrow-right"></i> Continue
              </button>
            </div>
          } @else {
            <div class="source-copy">
              <h4>Upload the Reclub participant list</h4>
              <p class="import-hint">Choose a clear screenshot of your Reclub participant list and we’ll extract the player names for you.</p>
              <button type="button" class="sample-toggle" (click)="showSample.set(!showSample())">
                <i class="fas fa-image"></i> {{ showSample() ? 'Hide sample screenshot' : 'See a sample screenshot' }}
              </button>
            </div>
            @if (showSample()) {
              <div class="sample-panel">
                <img src="/images/hosted-play/reclub-sample.jpg" alt="Example Reclub participant list screenshot — a grid of player photos and names" />
                <span class="sample-caption">This is what a Reclub participant list screenshot looks like — a grid of player photos with names underneath.</span>
              </div>
            }
            <label class="screenshot-picker">
              <span class="picker-icon" aria-hidden="true"><i class="fas fa-image"></i></span>
              <span class="picker-copy">
                <strong>Select a screenshot</strong>
                <small>PNG, JPG, or WEBP &middot; Max 8 MB</small>
              </span>
              <span class="picker-button" aria-hidden="true">
                Choose screenshot <i class="fas fa-arrow-up-from-bracket"></i>
              </span>
              <input
                class="screenshot-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*"
                aria-label="Choose a Reclub participant list screenshot"
                (change)="onFileSelected($event)"
              />
            </label>
            <div class="privacy-note"><i class="fas fa-shield-halved"></i> Processed securely in your browser. Your image is never uploaded.</div>
            @if (error()) { <p class="import-error">{{ error() }}</p> }
            <div class="import-actions">
              <button class="modal-cancel" (click)="close()">Cancel</button>
            </div>
          }
        }

        @if (step() === 'parsing') {
          <div class="import-loading">
            <span class="loading-icon"><i class="fas fa-circle-notch fa-spin"></i></span>
            <div>
              <strong>{{ sourceMode() === 'screenshot' ? 'Reading your screenshot' : 'Matching your players' }}</strong>
              <p>This should only take a moment.</p>
            </div>
            @if (ocrProgress() != null) { <div class="progress-bar"><div class="progress-fill" [style.width.%]="ocrProgress()"></div></div> }
          </div>
        }

        @if (step() === 'review') {
          <div class="review-summary">
            <div class="summary-copy">
              <span class="summary-icon"><i class="fas fa-list-check"></i></span>
              <div>
                <strong>{{ rows().length }} player{{ rows().length === 1 ? '' : 's' }} ready to review</strong>
                <span>Check each name and choose how the player should be imported.</span>
              </div>
            </div>
            <div class="summary-count"><strong>{{ rows().length }}</strong><span>Players</span></div>
          </div>

          @if (rows().length === 0) {
            <div class="empty-panel">
              <span class="empty-icon"><i class="fas fa-user-slash"></i></span>
              <strong>No players found</strong>
              <span>Go back and try another source, or add a player manually.</span>
            </div>
          } @else {
            <div class="review-table">
              <div class="review-labels" aria-hidden="true">
                <span></span><span>Player name</span><span>Import as</span><span></span>
              </div>
              @for (row of rows(); track row; let i = $index) {
                <div class="review-row" [class.has-warning]="row.alreadyImportedAsGuest">
                  <span class="player-number">{{ i + 1 }}</span>
                  <div class="review-name-wrap field-wrap">
                    <label [for]="'import-player-' + i">Player name</label>
                    <input [id]="'import-player-' + i" type="text" class="review-name" [(ngModel)]="row.finalName" placeholder="Player name" />
                    @if (row.alreadyImportedAsGuest) {
                      <span class="review-dupe-warning"><i class="fas fa-triangle-exclamation"></i> Already in this session</span>
                    }
                  </div>
                  <div class="field-wrap match-wrap">
                    <label [for]="'import-match-' + i">Import as</label>
                    @if (row.suggestions.length > 0) {
                      <div class="select-shell" [class.member-selected]="row.selection !== 'guest'">
                        <i class="fas" [class.fa-user-plus]="row.selection === 'guest'" [class.fa-address-card]="row.selection !== 'guest'"></i>
                        <select [id]="'import-match-' + i" class="review-match" [(ngModel)]="row.selection">
                          <option value="guest">New / Guest Player</option>
                          @for (s of row.suggestions; track s.userId) {
                            <option [value]="s.userId" [disabled]="s.alreadyJoined">
                              {{ s.alreadyJoined ? s.name + ' (already in session)' : s.name + ' — ' + matchPct(s.score) + '% match' }}
                            </option>
                          }
                        </select>
                      </div>
                    } @else {
                      <div [id]="'import-match-' + i" class="guest-badge"><i class="fas fa-user-plus"></i> New / Guest Player</div>
                    }
                  </div>
                  <button type="button" class="review-remove" (click)="removeRow(i)" [attr.aria-label]="'Remove ' + (row.finalName || 'player')" title="Remove player"><i class="fas fa-trash-can"></i></button>
                </div>
              }
            </div>
          }

          <div class="review-tools">
            <button type="button" class="add-manual-btn" (click)="addManualRow()"><i class="fas fa-plus"></i> Add another player</button>
            <span><i class="fas fa-circle-info"></i> You can edit any detected name before importing.</span>
          </div>

          @if (error()) { <p class="import-error">{{ error() }}</p> }

          <div class="import-actions review-actions">
            <button class="modal-cancel" (click)="step.set('source')"><i class="fas fa-arrow-left"></i> Back</button>
            <button class="modal-confirm modal-confirm-save" [disabled]="busy() || rows().length === 0" (click)="confirm()">
              @if (busy()) { <i class="fas fa-circle-notch fa-spin"></i> } @else { <i class="fas fa-check"></i> }
              Import {{ rows().length }} Player{{ rows().length === 1 ? '' : 's' }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(0,0,0,.68);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }
    .import-card {
      width: 100%; max-width: 560px; max-height: 88vh; overflow-y: auto;
      padding: 1.4rem;
      display: flex; flex-direction: column; gap: 1rem;
      background: #12251d;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(0,0,0,.58);
    }
    .import-head { display: flex; align-items: flex-start; justify-content: space-between; }
    .panel-kicker { display: block; font-size: .72rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--soft); }
    .import-head h3 { margin: .15rem 0 0; color: var(--text); font-size: 1.15rem; font-weight: 950; }
    .icon-close { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; padding: .3rem; }
    .icon-close:hover { color: var(--text); }

    .source-tabs { display: flex; gap: .5rem; }
    .source-tabs button {
      flex: 1; min-height: 44px; border-radius: 8px; border: 1px solid var(--border);
      background: rgba(255,255,255,.05); color: var(--muted); font-weight: 800; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: .4rem;
    }
    .source-tabs button.active { color: var(--accent); border-color: rgba(163,230,53,.4); background: rgba(163,230,53,.1); }

    .import-hint { margin: 0; color: var(--muted); font-size: .87rem; line-height: 1.5; }
    .import-error { margin: 0; color: #fca5a5; font-size: .85rem; }

    textarea {
      width: 100%; padding: .7rem .8rem; border-radius: 8px; border: 1px solid var(--border);
      background: rgba(255,255,255,.05); color: var(--text); font-family: inherit; font-size: .9rem; resize: vertical;
    }
    .screenshot-picker {
      position: relative;
      display: flex;
      align-items: center;
      gap: .85rem;
      min-height: 78px;
      padding: .8rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
      cursor: pointer;
      overflow: hidden;
      transition: border-color .2s ease, background .2s ease, box-shadow .2s ease, transform .2s ease;
    }
    .screenshot-picker::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 0 50%, rgba(163,230,53,.1), transparent 42%);
      opacity: 0;
      transition: opacity .2s ease;
      pointer-events: none;
    }
    .screenshot-picker:hover,
    .screenshot-picker:focus-within {
      border-color: rgba(163,230,53,.55);
      background: linear-gradient(135deg, rgba(163,230,53,.08), rgba(255,255,255,.035));
      box-shadow: 0 0 0 3px rgba(163,230,53,.08), 0 10px 25px rgba(0,0,0,.18);
      transform: translateY(-1px);
    }
    .screenshot-picker:hover::before,
    .screenshot-picker:focus-within::before { opacity: 1; }
    .picker-icon {
      position: relative;
      z-index: 1;
      flex: 0 0 48px;
      height: 48px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      color: var(--accent);
      background: rgba(163,230,53,.12);
      border: 1px solid rgba(163,230,53,.24);
      font-size: 1.05rem;
    }
    .picker-copy {
      position: relative;
      z-index: 1;
      display: flex;
      flex: 1;
      min-width: 0;
      flex-direction: column;
      gap: .2rem;
    }
    .picker-copy strong { color: var(--text); font-size: .9rem; font-weight: 850; }
    .picker-copy small { color: var(--soft); font-size: .72rem; line-height: 1.35; }
    .picker-button {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      min-height: 38px;
      padding: .5rem .75rem;
      border-radius: 9px;
      color: #14210f;
      background: var(--accent);
      box-shadow: 0 7px 18px rgba(163,230,53,.16);
      font-size: .78rem;
      font-weight: 900;
      white-space: nowrap;
      transition: filter .2s ease, box-shadow .2s ease;
    }
    .screenshot-picker:hover .picker-button {
      filter: brightness(1.06);
      box-shadow: 0 8px 22px rgba(163,230,53,.24);
    }
    .screenshot-input {
      position: absolute;
      inset: 0;
      z-index: 2;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .import-loading { display: flex; flex-direction: column; align-items: center; gap: .8rem; padding: 2rem 0; color: var(--muted); }
    .import-loading i { font-size: 1.6rem; color: var(--accent); }
    .progress-bar { width: 70%; height: 6px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; }
    .progress-fill { height: 100%; background: var(--accent); transition: width .2s ease; }

    .empty-panel { display: flex; flex-direction: column; align-items: center; gap: .5rem; padding: 1.5rem 0; color: var(--soft); text-align: center; }

    .review-table { display: flex; flex-direction: column; gap: .5rem; max-height: 40vh; overflow-y: auto; }
    .review-row { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: .5rem; align-items: center; }
    .review-name-wrap { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
    .review-name, .review-match {
      min-height: 40px; padding: .4rem .6rem; border-radius: 8px; border: 1px solid var(--border);
      background: rgba(255,255,255,.05); color: var(--text); font-family: inherit; font-size: .85rem;
    }
    .review-dupe-warning { display: flex; align-items: center; gap: .3rem; color: #fbbf24; font-size: .72rem; font-weight: 700; }
    .review-remove {
      min-width: 40px; min-height: 40px; border-radius: 8px; border: 1px solid rgba(239,68,68,.3);
      background: rgba(239,68,68,.1); color: #fca5a5; cursor: pointer;
    }

    .add-manual-btn {
      align-self: flex-start; min-height: 38px; padding: .4rem .8rem; border-radius: 8px;
      border: 1px dashed var(--border); background: transparent; color: var(--muted); font-weight: 700; cursor: pointer;
    }
    .add-manual-btn:hover { color: var(--accent); border-color: rgba(163,230,53,.4); }

    .import-actions { display: flex; justify-content: flex-end; gap: .6rem; }
    .modal-cancel, .modal-confirm {
      min-height: 40px; padding: .55rem .95rem; border-radius: 8px; font-family: inherit; font-weight: 900; cursor: pointer;
    }
    .modal-cancel { color: var(--text); border: 1px solid var(--border); background: rgba(255,255,255,.06); }
    .modal-confirm-save { color: var(--accent); border: 1px solid rgba(163,230,53,.32); background: rgba(163,230,53,.14); }
    .modal-confirm:disabled { opacity: .5; cursor: not-allowed; }

    @media (max-width: 520px) {
      .screenshot-picker { align-items: flex-start; flex-wrap: wrap; }
      .picker-copy { padding-top: .25rem; }
      .picker-button { flex-basis: 100%; }
    }

    /* Redesigned import workspace */
    .modal-backdrop {
      padding: 1.25rem;
      background: rgba(3, 12, 8, .78);
      backdrop-filter: blur(10px);
    }
    .import-card {
      width: 100%;
      max-width: 640px;
      max-height: min(90vh, 820px);
      padding: 0;
      gap: 0;
      overflow: hidden;
      background:
        radial-gradient(circle at 100% 0, rgba(163,230,53,.07), transparent 34%),
        #10251c;
      border: 1px solid rgba(163,230,53,.16);
      border-radius: 20px;
      box-shadow: 0 32px 90px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.025) inset;
      animation: import-modal-in .22s ease-out;
    }
    .import-card.review-mode { max-width: 880px; height: min(90vh, 820px); }
    @keyframes import-modal-in {
      from { opacity: 0; transform: translateY(10px) scale(.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .import-head {
      flex: 0 0 auto;
      align-items: center;
      padding: 1.35rem 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,.075);
      background: rgba(255,255,255,.018);
    }
    .import-title, .head-actions { display: flex; align-items: center; }
    .import-title { gap: .8rem; }
    .head-actions { gap: .65rem; }
    .import-brand {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      flex: 0 0 42px;
      border: 1px solid rgba(163,230,53,.28);
      border-radius: 12px;
      color: var(--accent);
      background: linear-gradient(145deg, rgba(163,230,53,.17), rgba(163,230,53,.07));
      box-shadow: 0 8px 20px rgba(0,0,0,.16);
    }
    .panel-kicker { color: #8da297; font-size: .67rem; letter-spacing: .09em; }
    .import-head h3 { margin-top: .18rem; font-size: 1.22rem; letter-spacing: -.02em; }
    .step-pill {
      padding: .35rem .58rem;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 999px;
      color: #9eb0a6;
      background: rgba(255,255,255,.04);
      font-size: .68rem;
      font-weight: 800;
      letter-spacing: .02em;
    }
    .icon-close {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 10px;
      transition: color .18s ease, border-color .18s ease, background .18s ease;
    }
    .icon-close:hover { border-color: rgba(255,255,255,.1); background: rgba(255,255,255,.055); }

    .source-tabs {
      gap: .65rem;
      margin: 1.25rem 1.5rem 0;
      padding: .3rem;
      border: 1px solid rgba(255,255,255,.075);
      border-radius: 14px;
      background: rgba(0,0,0,.14);
    }
    .source-tabs button {
      min-height: 62px;
      justify-content: flex-start;
      gap: .7rem;
      padding: .55rem .7rem;
      border-color: transparent;
      border-radius: 10px;
      text-align: left;
      transition: color .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
    }
    .source-tabs button > span:last-child { display: flex; flex-direction: column; gap: .1rem; }
    .source-tabs button strong { color: inherit; font-size: .82rem; }
    .source-tabs button small { color: #788e82; font-size: .65rem; font-weight: 600; }
    .source-tabs button.active {
      border-color: rgba(163,230,53,.25);
      background: linear-gradient(135deg, rgba(163,230,53,.14), rgba(163,230,53,.07));
      box-shadow: 0 7px 18px rgba(0,0,0,.12);
    }
    .source-tabs button.active small { color: #9cad9f; }
    .tab-icon {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      flex: 0 0 34px;
      border-radius: 9px;
      color: #90a298;
      background: rgba(255,255,255,.06);
    }
    .source-tabs button.active .tab-icon { color: var(--accent); background: rgba(163,230,53,.13); }

    .source-copy { margin: 1.35rem 1.5rem 0; }
    .source-copy h4 { margin: 0 0 .25rem; color: var(--text); font-size: .96rem; }
    .source-copy .import-hint { color: #91a49a; font-size: .8rem; }
    .sample-toggle {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      margin-top: .55rem;
      padding: 0;
      border: none;
      background: none;
      color: var(--accent);
      font-family: inherit;
      font-size: .74rem;
      font-weight: 800;
      cursor: pointer;
    }
    .sample-toggle:hover { text-decoration: underline; }
    .sample-panel {
      display: flex;
      flex-direction: column;
      gap: .5rem;
      align-items: center;
      margin: .75rem 1.5rem 0;
      padding: .85rem;
      border: 1px solid rgba(163,230,53,.18);
      border-radius: 13px;
      background: rgba(163,230,53,.04);
    }
    .sample-panel img {
      max-width: 100%;
      max-height: 260px;
      border-radius: 9px;
      border: 1px solid rgba(255,255,255,.08);
    }
    .sample-caption { color: #91a49a; font-size: .72rem; text-align: center; line-height: 1.4; }
    .paste-field { position: relative; margin: .75rem 1.5rem 0; }
    .paste-field textarea {
      box-sizing: border-box;
      min-height: 190px;
      padding: .9rem 1rem 2.35rem;
      border-color: rgba(255,255,255,.1);
      border-radius: 13px;
      outline: none;
      background: rgba(4,15,10,.35);
      line-height: 1.65;
      transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }
    .paste-field textarea:focus {
      border-color: rgba(163,230,53,.48);
      background: rgba(4,15,10,.48);
      box-shadow: 0 0 0 3px rgba(163,230,53,.08);
    }
    .paste-helper {
      position: absolute;
      left: .85rem;
      bottom: .7rem;
      display: flex;
      align-items: center;
      gap: .35rem;
      color: #71877b;
      font-size: .66rem;
      font-weight: 700;
      pointer-events: none;
    }
    .paste-helper i { color: var(--accent); }
    .screenshot-picker { margin: .75rem 1.5rem 0; min-height: 92px; border-style: dashed; }
    .privacy-note {
      display: flex;
      align-items: center;
      gap: .4rem;
      margin: .65rem 1.5rem 0;
      color: #71877b;
      font-size: .66rem;
      font-weight: 650;
    }
    .privacy-note i { color: #88a595; }
    .import-card > .import-error { margin: .75rem 1.5rem 0; }

    .import-loading {
      justify-content: center;
      flex: 1;
      min-height: 300px;
      padding: 2.5rem;
      text-align: center;
    }
    .loading-icon {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(163,230,53,.24);
      border-radius: 18px;
      background: rgba(163,230,53,.1);
    }
    .import-loading .loading-icon i { font-size: 1.45rem; }
    .import-loading strong { display: block; color: var(--text); font-size: 1rem; }
    .import-loading p { margin: .25rem 0 0; font-size: .76rem; }
    .progress-bar { width: min(320px, 80%); height: 7px; }

    .review-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 0 0 auto;
      gap: 1rem;
      margin: 1.15rem 1.5rem .8rem;
      padding: .9rem 1rem;
      border: 1px solid rgba(163,230,53,.15);
      border-radius: 14px;
      background: linear-gradient(110deg, rgba(163,230,53,.09), rgba(255,255,255,.025));
    }
    .summary-copy { display: flex; align-items: center; gap: .75rem; min-width: 0; }
    .summary-icon {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      flex: 0 0 38px;
      border-radius: 10px;
      color: var(--accent);
      background: rgba(163,230,53,.13);
    }
    .summary-copy div { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
    .summary-copy strong { color: var(--text); font-size: .83rem; }
    .summary-copy span { color: #83988d; font-size: .7rem; line-height: 1.35; }
    .summary-count {
      display: flex;
      align-items: baseline;
      gap: .35rem;
      padding-left: 1rem;
      border-left: 1px solid rgba(255,255,255,.1);
      white-space: nowrap;
    }
    .summary-count strong { color: var(--accent); font-size: 1.35rem; line-height: 1; }
    .summary-count span { color: #82978c; font-size: .65rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }

    .review-table {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      margin: 0 1.5rem;
      padding: 0 .3rem .15rem 0;
      gap: .45rem;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(163,230,53,.36) rgba(255,255,255,.035);
    }
    .review-labels {
      display: grid;
      grid-template-columns: 32px minmax(180px, .85fr) minmax(270px, 1.15fr) 38px;
      gap: .65rem;
      padding: 0 .65rem .15rem;
      color: #71867b;
      font-size: .62rem;
      font-weight: 850;
      letter-spacing: .07em;
      text-transform: uppercase;
    }
    .review-row {
      display: grid;
      grid-template-columns: 32px minmax(180px, .85fr) minmax(270px, 1.15fr) 38px;
      gap: .65rem;
      align-items: center;
      padding: .65rem;
      border: 1px solid rgba(255,255,255,.075);
      border-radius: 13px;
      background: rgba(255,255,255,.028);
      transition: border-color .18s ease, background .18s ease;
    }
    .review-row:hover { border-color: rgba(255,255,255,.13); background: rgba(255,255,255,.04); }
    .review-row.has-warning { border-color: rgba(251,191,36,.16); background: rgba(251,191,36,.025); }
    .player-number {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      color: #81958a;
      background: rgba(255,255,255,.055);
      font-size: .68rem;
      font-weight: 850;
    }
    .field-wrap { min-width: 0; }
    .field-wrap > label { display: none; }
    .review-name-wrap { gap: .3rem; }
    .review-name, .review-match {
      box-sizing: border-box;
      width: 100%;
      min-height: 43px;
      border-color: rgba(255,255,255,.09);
      border-radius: 10px;
      outline: none;
      background: rgba(5,17,12,.35);
      font-size: .8rem;
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    .review-name:focus, .review-match:focus {
      border-color: rgba(163,230,53,.45);
      box-shadow: 0 0 0 3px rgba(163,230,53,.07);
    }
    .select-shell { position: relative; }
    .select-shell > i {
      position: absolute;
      z-index: 1;
      left: .7rem;
      top: 50%;
      color: #6daff5;
      font-size: .72rem;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .select-shell.member-selected > i { color: var(--accent); }
    .review-match { padding-left: 2rem; padding-right: 1.8rem; cursor: pointer; }
    .guest-badge {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: .45rem;
      width: 100%;
      min-height: 43px;
      padding: 0 .75rem;
      border: 1px solid rgba(255,255,255,.075);
      border-radius: 10px;
      background: rgba(255,255,255,.02);
      color: #8ea297;
      font-size: .8rem;
    }
    .guest-badge i { color: #6b8177; font-size: .72rem; }
    .review-dupe-warning {
      width: fit-content;
      padding: .16rem .42rem;
      border-radius: 6px;
      color: #f8c653;
      background: rgba(251,191,36,.09);
      font-size: .61rem;
      line-height: 1.2;
    }
    .review-remove {
      min-width: 36px;
      width: 36px;
      min-height: 36px;
      height: 36px;
      border-color: transparent;
      border-radius: 9px;
      color: #cd7f81;
      background: transparent;
      transition: color .18s ease, border-color .18s ease, background .18s ease;
    }
    .review-remove:hover { color: #fca5a5; border-color: rgba(239,68,68,.2); background: rgba(239,68,68,.1); }

    .empty-panel {
      flex: 1;
      justify-content: center;
      margin: 0 1.5rem;
      padding: 2.5rem;
      border: 1px dashed rgba(255,255,255,.1);
      border-radius: 14px;
    }
    .empty-panel strong { color: var(--text); font-size: .9rem; }
    .empty-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      color: #81968b;
      background: rgba(255,255,255,.05);
      font-size: 1rem;
    }
    .review-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 0 0 auto;
      gap: 1rem;
      padding: .8rem 1.5rem;
    }
    .review-tools > span { color: #6f8579; font-size: .65rem; }
    .review-tools > span i { margin-right: .25rem; }
    .add-manual-btn {
      min-height: 36px;
      padding: .42rem .72rem;
      border-style: solid;
      border-color: rgba(163,230,53,.2);
      border-radius: 9px;
      color: #a9bdaf;
      background: rgba(163,230,53,.055);
      font-size: .7rem;
      transition: color .18s ease, border-color .18s ease, background .18s ease;
    }
    .add-manual-btn:hover { color: var(--accent); border-color: rgba(163,230,53,.38); background: rgba(163,230,53,.1); }

    .import-actions {
      flex: 0 0 auto;
      align-items: center;
      padding: 1rem 1.5rem;
      margin-top: 1.2rem;
      border-top: 1px solid rgba(255,255,255,.075);
      background: rgba(4,15,10,.24);
    }
    .review-actions { margin-top: 0; }
    .modal-cancel, .modal-confirm {
      min-height: 44px;
      padding: .6rem 1rem;
      border-radius: 10px;
      font-size: .78rem;
      transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease;
    }
    .modal-cancel { color: #b4c2ba; background: rgba(255,255,255,.045); }
    .modal-cancel:hover { border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.075); }
    .modal-confirm-save {
      color: #17220f;
      border-color: var(--accent);
      background: var(--accent);
      box-shadow: 0 8px 20px rgba(163,230,53,.14);
    }
    .modal-confirm-save:not(:disabled):hover { box-shadow: 0 10px 25px rgba(163,230,53,.23); transform: translateY(-1px); }

    @media (max-width: 720px) {
      .modal-backdrop { align-items: flex-end; padding: .6rem; }
      .import-card, .import-card.review-mode { max-height: 94vh; height: auto; border-radius: 18px; }
      .import-card.review-mode { height: 94vh; }
      .import-head { padding: 1rem; }
      .source-tabs, .source-copy, .paste-field, .screenshot-picker, .privacy-note { margin-left: 1rem; margin-right: 1rem; }
      .source-tabs { flex-direction: column; }
      .source-tabs button { min-height: 54px; }
      .review-summary { margin: .85rem 1rem .65rem; }
      .summary-count { display: none; }
      .review-table { margin: 0 1rem; }
      .review-labels { display: none; }
      .review-row { grid-template-columns: 30px minmax(0, 1fr) 36px; align-items: start; }
      .field-wrap > label { display: block; margin: 0 0 .28rem .1rem; color: #71867b; font-size: .58rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
      .match-wrap { grid-column: 2 / -1; }
      .review-remove { grid-column: 3; grid-row: 1; margin-top: 1.05rem; }
      .review-tools { align-items: flex-start; flex-direction: column; padding: .7rem 1rem; }
      .import-actions { padding: .85rem 1rem; }
    }
    @media (max-width: 440px) {
      .import-brand { width: 38px; height: 38px; flex-basis: 38px; }
      .panel-kicker { font-size: .59rem; }
      .import-head h3 { font-size: 1.05rem; }
      .step-pill { display: none; }
      .picker-button { font-size: .7rem; }
      .summary-copy span { display: none; }
      .review-actions .modal-confirm { flex: 1; }
    }
  `],
})
export class ImportParticipantsModalComponent {
  @Input({ required: true }) sessionId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<QueueBoard>();

  step = signal<Step>('source');
  sourceMode = signal<SourceMode>('paste');
  showSample = signal(false);
  pasteText = '';
  ocrProgress = signal<number | null>(null);
  rows = signal<ReviewRow[]>([]);
  busy = signal(false);
  error = signal('');
  private method: SourceMode = 'paste';

  constructor(private hp: HostedPlayService) {}

  close() { this.closed.emit(); }

  matchPct(score: number): number { return Math.round(score * 100); }

  parsePaste() {
    const names = extractNameCandidates(this.pasteText);
    this.runPreview(names, 'paste');
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.error.set('Please choose an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { this.error.set('Image must be smaller than 8MB.'); return; }

    this.error.set('');
    this.method = 'screenshot';
    this.step.set('parsing');
    this.ocrProgress.set(0);

    try {
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => { if (m.status === 'recognizing text') this.ocrProgress.set(Math.round((m.progress ?? 0) * 100)); },
      });
      // blocks:true is required — Tesseract.js omits word/line bounding
      // boxes by default and only returns flat text, which is exactly the
      // jumbled-order data our geometry reconstruction below needs to avoid.
      const { data } = await worker.recognize(file, {}, { blocks: true });
      await worker.terminate();
      // Real Reclub screenshots are often a photo-grid roster (avatars in
      // columns, names below), which jumbles multiple people together in
      // Tesseract's own line text — reconstruct names from word positions
      // instead. Falls back to plain line-splitting for simple text shots.
      const geometryNames = extractNamesFromOcrPage(data);
      const names = geometryNames.length ? geometryNames : extractNameCandidates(data.text || '');
      // Diagnostic trail — if the review screen still shows junk, open the
      // browser console and paste this block back rather than a screenshot;
      // it's the ground truth, a screenshot of the result is one step removed.
      console.debug('[Reclub Import] OCR raw text:', data.text);
      console.debug('[Reclub Import] OCR block count:', data.blocks?.length ?? 0);
      console.debug('[Reclub Import] geometry-reconstructed names:', geometryNames);
      console.debug('[Reclub Import] final candidates used:', names, geometryNames.length ? '(geometry)' : '(line-split fallback)');
      this.runPreview(names, 'screenshot');
    } catch {
      this.step.set('source');
      this.error.set('Could not read text from that screenshot. Try a clearer image, or paste the list instead.');
    } finally {
      this.ocrProgress.set(null);
    }
  }

  private runPreview(names: string[], method: SourceMode) {
    this.method = method;
    if (!names.length) {
      this.rows.set([]);
      this.step.set('review');
      return;
    }
    this.step.set('parsing');
    this.error.set('');
    this.hp.previewImport(this.sessionId, names, method).subscribe({
      next: (res) => {
        this.rows.set(res.results.map((r) => ({
          rawName: r.rawName,
          finalName: r.rawName,
          suggestions: r.suggestions,
          selection: r.bestMatch ? r.bestMatch.userId : 'guest',
          alreadyImportedAsGuest: r.alreadyImportedAsGuest,
        })));
        this.step.set('review');
      },
      error: (err) => {
        this.step.set('source');
        this.error.set(err?.error?.error || 'Could not match players. Please try again.');
      },
    });
  }

  removeRow(i: number) {
    this.rows.update((rows) => rows.filter((_, idx) => idx !== i));
  }

  addManualRow() {
    this.rows.update((rows) => [...rows, { rawName: '', finalName: '', suggestions: [], selection: 'guest', alreadyImportedAsGuest: false }]);
  }

  confirm() {
    const payload: ReclubImportConfirmRow[] = this.rows()
      .filter((r) => r.finalName.trim())
      .map((r) => ({
        rawName: r.rawName || r.finalName,
        finalName: r.finalName.trim(),
        memberId: r.selection !== 'guest' ? r.selection : null,
        isGuest: r.selection === 'guest',
      }));
    if (!payload.length) { this.error.set('Add at least one player name.'); return; }

    this.busy.set(true);
    this.error.set('');
    this.hp.confirmImport(this.sessionId, this.method, payload).subscribe({
      next: (board) => { this.busy.set(false); this.imported.emit(board); },
      error: (err) => { this.busy.set(false); this.error.set(err?.error?.error || 'Import failed. Please try again.'); },
    });
  }
}
