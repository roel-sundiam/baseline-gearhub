import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { TermsService, ClubSummary } from '../../../core/services/terms.service';
import { marked } from 'marked';

@Component({
  selector: 'app-terms-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="te-shell">
      <header class="te-topbar">
        <button class="icon-btn" (click)="router.navigate(['/admin/clubs'])" aria-label="Back to clubs">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="topbar-copy">
          <span class="kicker">Super Admin</span>
          <h1>Terms Editor</h1>
        </div>
        <div class="topbar-actions">
          <button class="secondary-btn" (click)="previewMode.set(!previewMode())" [disabled]="loading()">
            <i class="fas" [class.fa-eye]="!previewMode()" [class.fa-pen]="previewMode()"></i>
            {{ previewMode() ? 'Edit' : 'Preview' }}
          </button>
          <button class="primary-btn" [disabled]="saving() || loading()" (click)="save()">
            <i class="fas" [class.fa-save]="!saving()" [class.fa-circle-notch]="saving()" [class.fa-spin]="saving()"></i>
            {{ saving() ? 'Publishing' : 'Save & Publish' }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="state-card">
          <span class="spinner"></span>
          <span>Loading terms configuration...</span>
        </div>
      } @else {
        <main class="te-content">
          <section class="hero">
            <div class="hero-copy">
              <span class="eyebrow"><i class="fas fa-file-shield"></i> Dynamic content</span>
              <h2>Manage Terms & Conditions</h2>
              <p>Publish global administrator terms and club-specific guest booking terms from one controlled workspace.</p>
            </div>
            <div class="hero-metrics">
              <div class="metric">
                <span>{{ adminVersion() || '-' }}</span>
                <small>Admin version</small>
              </div>
              <div class="metric">
                <span>{{ customGuestTermsCount() }}</span>
                <small>Custom guest terms</small>
              </div>
              <div class="metric">
                <span>{{ clubs().length }}</span>
                <small>Clubs</small>
              </div>
            </div>
          </section>

          <section class="workspace">
            <aside class="side-panel">
              <div class="mode-group" aria-label="Terms type">
                <button class="mode-btn" [class.active]="activeTab() === 'admin'" (click)="switchTab('admin')">
                  <span class="mode-icon"><i class="fas fa-user-tie"></i></span>
                  <span>
                    <strong>Admin Terms</strong>
                    <small>Platform agreement</small>
                  </span>
                </button>
                <button class="mode-btn" [class.active]="activeTab() === 'guest'" (click)="switchTab('guest')">
                  <span class="mode-icon"><i class="fas fa-users"></i></span>
                  <span>
                    <strong>Guest Terms</strong>
                    <small>Per-club booking rules</small>
                  </span>
                </button>
              </div>

              @if (activeTab() === 'admin') {
                <div class="info-box">
                  <span class="info-label">Publishing target</span>
                  <strong>All club administrators</strong>
                  <p>Shown when an admin must accept terms before using the dashboard.</p>
                </div>
                <div class="meta-list">
                  <div>
                    <span>Version</span>
                    <strong>{{ adminVersion() > 0 ? 'v' + adminVersion() : 'Draft' }}</strong>
                  </div>
                  <div>
                    <span>Last editor</span>
                    <strong>{{ adminUpdatedBy() || 'Not available' }}</strong>
                  </div>
                </div>
              }

              @if (activeTab() === 'guest') {
                <label class="select-label" for="clubSelect">Club</label>
                <select id="clubSelect" class="club-select" [(ngModel)]="selectedClubId" (ngModelChange)="onClubSelect($event)">
                  <option value="">Select a club</option>
                  @for (club of clubs(); track club._id) {
                    <option [value]="club._id">{{ club.name }}</option>
                  }
                </select>

                <div class="info-box">
                  <span class="info-label">Publishing target</span>
                  <strong>{{ selectedClub()?.name || 'No club selected' }}</strong>
                  <p>Guest booking terms appear in the public reservation checkout modal.</p>
                </div>

                @if (selectedClubId) {
                  @if (selectedClub()?.guestTermsText) {
                    <span class="status-pill custom"><i class="fas fa-circle-check"></i> Custom terms active</span>
                  } @else {
                    <span class="status-pill default"><i class="fas fa-layer-group"></i> Uses global default</span>
                  }

                  <div class="notif-field">
                    <label class="notif-label" for="guestNotifInput">
                      <i class="fas fa-bell"></i> Club Notification
                    </label>
                    <textarea
                      id="guestNotifInput"
                      class="notif-input"
                      [(ngModel)]="guestNotificationValue"
                      placeholder="Optional — shown in red above View Terms &amp; Conditions"
                      rows="3"
                    ></textarea>
                    <span class="notif-hint">Appears in red to guests before they view the terms. Leave empty to hide.</span>
                  </div>
                }
              }

              <div class="markdown-help">
                <span class="info-label">Markdown tips</span>
                <code>## Heading</code>
                <code>- Bullet item</code>
                <code>**Bold text**</code>
              </div>
            </aside>

            <section class="editor-panel">
              <div class="panel-head">
                <div>
                  <span class="panel-kicker">{{ activeTab() === 'admin' ? 'Global admin agreement' : 'Guest booking rules' }}</span>
                  <h3>{{ editorTitle() }}</h3>
                </div>
                @if (activeTab() === 'guest' && selectedClubId) {
                  <button type="button" class="text-btn" (click)="clearGuestTerms()">
                    <i class="fas fa-eraser"></i> Clear custom terms
                  </button>
                }
              </div>

              @if (activeTab() === 'admin') {
                @if (!previewMode()) {
                  <textarea
                    class="editor"
                    [(ngModel)]="adminTextValue"
                    (ngModelChange)="adminPreviewHtml.set(parseMarkdown($event))"
                    placeholder="## 1. Section Title&#10;Paragraph text here."
                    aria-label="Admin terms markdown editor"
                  ></textarea>
                } @else {
                  <div class="preview-card">
                    <div class="preview" [innerHTML]="adminPreviewHtml()"></div>
                  </div>
                }
              }

              @if (activeTab() === 'guest') {
                @if (selectedClubId) {
                  @if (!previewMode()) {
                    <textarea
                      class="editor"
                      [(ngModel)]="guestTextValue"
                      (ngModelChange)="guestPreviewHtml.set(parseMarkdown($event))"
                      placeholder="Intro sentence here.&#10;&#10;## 1. Rule Title&#10;Rule description."
                      aria-label="Guest terms markdown editor"
                    ></textarea>
                    <p class="helper-note">
                      Leave this empty to show the global default guest terms for this club.
                    </p>
                  } @else {
                    <div class="preview-card">
                      @if (guestTextValue) {
                        <div class="preview" [innerHTML]="guestPreviewHtml()"></div>
                      } @else {
                        <div class="empty-preview">
                          <i class="fas fa-layer-group"></i>
                          <strong>Global default will be used</strong>
                          <span>No custom guest terms are set for this club.</span>
                        </div>
                      }
                    </div>
                  }
                } @else {
                  <div class="empty-preview large">
                    <i class="fas fa-building"></i>
                    <strong>Select a club to continue</strong>
                    <span>Choose a club from the left panel to edit guest Terms & Conditions.</span>
                  </div>
                }
              }
            </section>
          </section>

          @if (successMsg()) {
            <div class="toast success"><i class="fas fa-circle-check"></i> {{ successMsg() }}</div>
          }
          @if (errorMsg()) {
            <div class="toast error"><i class="fas fa-triangle-exclamation"></i> {{ errorMsg() }}</div>
          }
        </main>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #07130d;
      --panel: rgba(18,37,29,.94);
      --panel-2: rgba(25,53,42,.9);
      --border: rgba(255,255,255,.1);
      --text: #fff;
      --muted: rgba(255,255,255,.62);
      --soft: rgba(255,255,255,.42);
      --accent: #a3e635;
      --teal: #14b8a6;
      --blue: #38bdf8;
      --amber: #f59e0b;
      --danger: #f87171;
    }

    .te-shell {
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.13), transparent 28rem),
        linear-gradient(180deg, #0b1b12 0%, var(--bg) 34rem);
      padding: 0 1rem 2rem;
    }

    .te-topbar {
      max-width: 1280px;
      margin: 0 auto;
      min-height: 76px;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      align-items: center;
      gap: .85rem;
      position: sticky;
      top: 0;
      z-index: 20;
      background: linear-gradient(180deg, rgba(7,19,13,.98), rgba(7,19,13,.86));
      backdrop-filter: blur(10px);
    }

    .icon-btn, .secondary-btn, .primary-btn, .text-btn {
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
    .icon-btn {
      width: 44px;
      height: 44px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.08);
      color: var(--text);
    }
    .secondary-btn {
      min-height: 42px;
      padding: .65rem .9rem;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.06);
      color: var(--text);
    }
    .primary-btn {
      min-height: 42px;
      padding: .65rem 1rem;
      border: 0;
      background: var(--accent);
      color: #07130d;
      box-shadow: 0 12px 24px rgba(163,230,53,.16);
    }
    .text-btn {
      min-height: 36px;
      padding: .45rem .7rem;
      border: 1px solid rgba(245,158,11,.25);
      background: rgba(245,158,11,.1);
      color: #fcd34d;
      font-size: .76rem;
    }
    button:disabled { opacity: .5; cursor: not-allowed; }

    .topbar-copy { min-width: 0; }
    .kicker, .eyebrow, .panel-kicker, .info-label {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      color: var(--accent);
      font-size: .72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .te-topbar h1 { margin: .12rem 0 0; font-size: 1.1rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-actions { display: flex; align-items: center; gap: .6rem; }

    .te-content {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: end;
      padding: 1.25rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background:
        linear-gradient(135deg, rgba(25,53,42,.95), rgba(9,27,17,.96)),
        url('/tennis-court-surface.png') center / cover;
      box-shadow: 0 18px 50px rgba(0,0,0,.32);
      overflow: hidden;
      position: relative;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7,19,13,.16), rgba(7,19,13,.7));
      pointer-events: none;
    }
    .hero > * { position: relative; z-index: 1; }
    .hero h2 { margin: .45rem 0 .45rem; font-size: clamp(1.9rem, 4vw, 3.25rem); line-height: 1; letter-spacing: 0; }
    .hero p { margin: 0; max-width: 690px; color: rgba(255,255,255,.72); line-height: 1.5; }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(104px, 1fr));
      gap: .65rem;
      min-width: 360px;
    }
    .metric {
      min-height: 82px;
      padding: .75rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.06);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: .2rem;
    }
    .metric span { color: var(--accent); font-size: 1.45rem; font-weight: 950; line-height: 1; }
    .metric small { color: var(--muted); font-size: .72rem; font-weight: 800; }

    .workspace {
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .side-panel, .editor-panel {
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      box-shadow: 0 12px 32px rgba(0,0,0,.2);
    }
    .side-panel {
      padding: .9rem;
      display: flex;
      flex-direction: column;
      gap: .9rem;
      position: sticky;
      top: 92px;
    }

    .mode-group { display: grid; gap: .55rem; }
    .mode-btn {
      width: 100%;
      min-height: 70px;
      padding: .7rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.045);
      color: var(--text);
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: .65rem;
      align-items: center;
      text-align: left;
      font-family: inherit;
      cursor: pointer;
    }
    .mode-btn.active {
      border-color: rgba(163,230,53,.34);
      background: rgba(163,230,53,.08);
      box-shadow: inset 0 0 0 1px rgba(163,230,53,.08);
    }
    .mode-icon {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      color: var(--accent);
      background: rgba(163,230,53,.12);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .mode-btn strong { display: block; font-size: .9rem; }
    .mode-btn small { display: block; color: var(--muted); font-size: .74rem; margin-top: .12rem; }

    .info-box, .markdown-help, .meta-list {
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      padding: .8rem;
    }
    .info-box strong { display: block; margin-top: .35rem; line-height: 1.25; overflow-wrap: anywhere; }
    .info-box p { margin: .35rem 0 0; color: var(--muted); font-size: .8rem; line-height: 1.45; }

    .meta-list { display: grid; gap: .65rem; }
    .meta-list div { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
    .meta-list span { color: var(--muted); font-size: .78rem; font-weight: 800; }
    .meta-list strong { font-size: .82rem; text-align: right; overflow-wrap: anywhere; }

    .select-label { color: var(--muted); font-size: .78rem; font-weight: 900; }
    .club-select {
      width: 100%;
      min-height: 44px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #1b3028;
      color: var(--text);
      padding: .65rem .75rem;
      font: inherit;
      outline: none;
      color-scheme: dark;
    }
    .club-select option { color: #0c1a11; background: #fff; }
    .club-select:focus { border-color: rgba(163,230,53,.42); box-shadow: 0 0 0 3px rgba(163,230,53,.1); }

    .status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .42rem;
      min-height: 32px;
      border-radius: 999px;
      padding: .35rem .7rem;
      font-size: .74rem;
      font-weight: 900;
    }
    .status-pill.custom { color: var(--accent); background: rgba(163,230,53,.12); border: 1px solid rgba(163,230,53,.22); }
    .status-pill.default { color: #fcd34d; background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.22); }

    .notif-field { display: flex; flex-direction: column; gap: .35rem; }
    .notif-label {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      color: var(--danger);
      font-size: .72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .notif-input {
      width: 100%;
      border-radius: 8px;
      border: 1px solid rgba(248,113,113,.3);
      background: rgba(248,113,113,.06);
      color: var(--text);
      padding: .6rem .75rem;
      font: inherit;
      font-size: .82rem;
      line-height: 1.5;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
    }
    .notif-input::placeholder { color: rgba(255,255,255,.3); }
    .notif-input:focus { border-color: rgba(248,113,113,.55); box-shadow: 0 0 0 3px rgba(248,113,113,.1); }
    .notif-hint { color: var(--muted); font-size: .72rem; line-height: 1.4; }

    .markdown-help { display: flex; flex-direction: column; gap: .45rem; }
    .markdown-help code {
      color: rgba(255,255,255,.78);
      background: rgba(0,0,0,.22);
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 6px;
      padding: .35rem .45rem;
      font-size: .78rem;
    }

    .editor-panel { min-width: 0; overflow: hidden; }
    .panel-head {
      min-height: 74px;
      padding: 1rem;
      border-bottom: 1px solid rgba(255,255,255,.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .panel-head h3 { margin: .12rem 0 0; font-size: 1.1rem; line-height: 1.2; }

    .editor {
      width: 100%;
      min-height: 620px;
      display: block;
      padding: 1.1rem;
      border: 0;
      border-radius: 0;
      background: rgba(0,0,0,.26);
      color: var(--text);
      font-family: Consolas, 'Courier New', monospace;
      font-size: .9rem;
      line-height: 1.65;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
    }
    .editor::placeholder { color: rgba(255,255,255,.28); }
    .editor:focus { box-shadow: inset 0 0 0 2px rgba(163,230,53,.18); }

    .helper-note {
      margin: 0;
      padding: .8rem 1rem 1rem;
      color: var(--muted);
      font-size: .8rem;
      background: rgba(0,0,0,.18);
    }

    .preview-card {
      min-height: 620px;
      padding: 1.1rem;
      background: rgba(0,0,0,.18);
    }
    .preview {
      max-width: 820px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      padding: 1.25rem;
    }
    .preview h1, .preview h2, .preview h3 {
      color: var(--accent);
      line-height: 1.2;
      margin: 1.05rem 0 .45rem;
    }
    .preview h1:first-child, .preview h2:first-child, .preview h3:first-child { margin-top: 0; }
    .preview h1 { font-size: 1.15rem; }
    .preview h2 { font-size: .95rem; text-transform: uppercase; letter-spacing: .06em; }
    .preview h3 { font-size: .9rem; }
    .preview p, .preview li {
      color: rgba(255,255,255,.72);
      font-size: .9rem;
      line-height: 1.65;
    }
    .preview p { margin: 0 0 .65rem; }
    .preview ul, .preview ol { margin: .25rem 0 .75rem 1.2rem; padding: 0; }

    .empty-preview {
      min-height: 240px;
      border-radius: 8px;
      border: 1px dashed rgba(255,255,255,.14);
      color: var(--muted);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .55rem;
      text-align: center;
      padding: 1.25rem;
    }
    .empty-preview.large { min-height: 520px; margin: 1rem; }
    .empty-preview i { color: var(--accent); font-size: 1.6rem; }
    .empty-preview strong { color: var(--text); }
    .empty-preview span { max-width: 360px; font-size: .86rem; line-height: 1.45; }

    .toast {
      padding: .75rem .9rem;
      border-radius: 8px;
      font-size: .86rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: .55rem;
    }
    .toast.success { background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.22); color: var(--accent); }
    .toast.error { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.22); color: #fca5a5; }

    .state-card {
      max-width: 520px;
      min-height: 170px;
      margin: 3rem auto;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .75rem;
      font-weight: 800;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 2px solid rgba(163,230,53,.2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin .9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; }
      .hero-metrics { min-width: 0; width: 100%; }
      .workspace { grid-template-columns: 1fr; }
      .side-panel { position: static; }
    }

    @media (max-width: 680px) {
      .te-shell { padding-inline: .75rem; }
      .te-topbar { grid-template-columns: 42px minmax(0, 1fr); padding: .75rem 0; }
      .topbar-actions { grid-column: 1 / -1; width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
      .secondary-btn, .primary-btn { width: 100%; }
      .hero { padding: 1rem; }
      .hero h2 { font-size: 1.9rem; }
      .hero-metrics { grid-template-columns: 1fr; }
      .metric { min-height: 68px; }
      .side-panel { padding: .75rem; }
      .panel-head { align-items: flex-start; flex-direction: column; padding: .9rem; }
      .text-btn { width: 100%; }
      .editor, .preview-card { min-height: 460px; }
      .preview-card { padding: .85rem; }
      .preview { padding: 1rem; }
    }
  `],
})
export class TermsEditorComponent implements OnInit {
  router = inject(Router);
  private auth = inject(AuthService);
  private termsService = inject(TermsService);
  // Content is superadmin-managed; rendered Markdown preview is trusted here.
  private sanitizer = inject(DomSanitizer);

  loading = signal(true);
  saving = signal(false);
  errorMsg = signal('');
  successMsg = signal('');
  activeTab = signal<'admin' | 'guest'>('admin');
  previewMode = signal(false);

  adminVersion = signal(0);
  adminUpdatedBy = signal('');
  adminPreviewHtml = signal<SafeHtml>('');
  guestPreviewHtml = signal<SafeHtml>('');

  clubs = signal<ClubSummary[]>([]);
  selectedClubId = '';

  adminTextValue = '';
  guestTextValue = '';
  guestNotificationValue = '';

  selectedClub() {
    return this.clubs().find(c => c._id === this.selectedClubId) ?? null;
  }

  customGuestTermsCount(): number {
    return this.clubs().filter(c => !!c.guestTermsText).length;
  }

  editorTitle(): string {
    if (this.activeTab() === 'admin') return 'Administrator Terms & Conditions';
    return this.selectedClub()?.name ? `Guest Terms for ${this.selectedClub()!.name}` : 'Guest Terms & Conditions';
  }

  ngOnInit() {
    if (!this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/clubs']);
      return;
    }
    Promise.all([
      this.termsService.getTerms().toPromise(),
      this.termsService.getClubs().toPromise(),
    ]).then(([terms, clubs]) => {
      if (terms) {
        this.adminTextValue = terms.adminTermsText;
        this.adminVersion.set(terms.termsVersion);
        this.adminUpdatedBy.set(terms.termsUpdatedBy);
        this.adminPreviewHtml.set(this.parseMarkdown(terms.adminTermsText));
      }
      if (clubs) {
        this.clubs.set(clubs.map(c => ({ _id: c._id, name: c.name, guestTermsText: c.guestTermsText, guestTermsNotification: c.guestTermsNotification })));
      }
      this.loading.set(false);
    }).catch(() => {
      this.errorMsg.set('Failed to load data. Please refresh.');
      this.loading.set(false);
    });
  }

  switchTab(tab: 'admin' | 'guest') {
    this.activeTab.set(tab);
    this.previewMode.set(false);
    this.successMsg.set('');
    this.errorMsg.set('');
  }

  onClubSelect(clubId: string) {
    const club = this.clubs().find(c => c._id === clubId);
    this.guestTextValue = club?.guestTermsText ?? '';
    this.guestNotificationValue = club?.guestTermsNotification ?? '';
    this.guestPreviewHtml.set(this.parseMarkdown(this.guestTextValue));
    this.successMsg.set('');
    this.errorMsg.set('');
  }

  clearGuestTerms() {
    this.guestTextValue = '';
    this.guestPreviewHtml.set(this.parseMarkdown(''));
  }

  save() {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    if (this.activeTab() === 'admin') {
      this.termsService.updateAdminTerms(this.adminTextValue).subscribe({
        next: (res) => {
          this.adminVersion.set(res.termsVersion);
          this.adminUpdatedBy.set(res.termsUpdatedBy);
          this.successMsg.set(`Admin T&C published - version ${res.termsVersion}.`);
          this.saving.set(false);
        },
        error: () => {
          this.errorMsg.set('Save failed. Please try again.');
          this.saving.set(false);
        },
      });
    } else {
      if (!this.selectedClubId) {
        this.errorMsg.set('Please select a club first.');
        this.saving.set(false);
        return;
      }
      this.termsService.updateClubGuestTerms(this.selectedClubId, this.guestTextValue, this.guestNotificationValue).subscribe({
        next: (res) => {
          const updated = this.clubs().map(c =>
            c._id === this.selectedClubId ? { ...c, guestTermsText: res.guestTermsText, guestTermsNotification: res.guestTermsNotification } : c,
          );
          this.clubs.set(updated);
          const clubName = this.selectedClub()?.name ?? 'Club';
          this.successMsg.set(
            res.guestTermsText
              ? `Guest T&C for ${clubName} saved.`
              : `Guest T&C for ${clubName} cleared - global default will be used.`,
          );
          this.saving.set(false);
        },
        error: () => {
          this.errorMsg.set('Save failed. Please try again.');
          this.saving.set(false);
        },
      });
    }
  }

  parseMarkdown(text: string): SafeHtml {
    if (!text) return '';
    const html = marked.parse(text) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
