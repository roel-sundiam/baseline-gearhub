import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { AnnouncementService, AnnouncementConfirmation } from '../../../core/services/announcement.service';
import { marked } from 'marked';

@Component({
  selector: 'app-announcement-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ae-shell">
      <header class="ae-topbar">
        <button class="icon-btn" (click)="router.navigate(['/admin/clubs'])" aria-label="Back to clubs">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="topbar-copy">
          <span class="kicker">Super Admin</span>
          <h1>Announcement Editor</h1>
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
          <span>Loading announcement configuration...</span>
        </div>
      } @else {
        <main class="ae-content">
          <section class="hero">
            <div class="hero-copy">
              <span class="eyebrow"><i class="fas fa-bullhorn"></i> Broadcast message</span>
              <h2>Manage Club Admin Announcement</h2>
              <p>Publish a one-time announcement modal shown to every club administrator's dashboard until they dismiss it.</p>
            </div>
            <div class="hero-metrics">
              <div class="metric">
                <span>{{ version() > 0 ? 'v' + version() : '-' }}</span>
                <small>Version</small>
              </div>
              <div class="metric">
                <span>{{ enabled() ? 'On' : 'Off' }}</span>
                <small>Status</small>
              </div>
            </div>
          </section>

          <section class="workspace">
            <aside class="side-panel">
              <div class="toggle-row">
                <span>
                  <strong>Enabled</strong>
                  <small>Show this announcement to club admins</small>
                </span>
                <button
                  type="button"
                  class="switch"
                  [class.on]="enabled()"
                  (click)="enabled.set(!enabled())"
                  role="switch"
                  [attr.aria-checked]="enabled()"
                  aria-label="Toggle announcement enabled"
                >
                  <span class="switch-knob"></span>
                </button>
              </div>

              <div class="field">
                <label class="select-label" for="annTitle">Title</label>
                <input
                  id="annTitle"
                  class="title-input"
                  type="text"
                  [(ngModel)]="titleValue"
                  placeholder="e.g. Scheduled Maintenance"
                />
              </div>

              <div class="info-box">
                <span class="info-label">Publishing target</span>
                <strong>All club administrators</strong>
                <p>Shown once per admin as a dashboard modal. Reappears only when you publish a new version.</p>
              </div>

              <div class="meta-list">
                <div>
                  <span>Version</span>
                  <strong>{{ version() > 0 ? 'v' + version() : 'Draft' }}</strong>
                </div>
                <div>
                  <span>Last editor</span>
                  <strong>{{ updatedBy() || 'Not available' }}</strong>
                </div>
              </div>

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
                  <span class="panel-kicker">Announcement content</span>
                  <h3>Message body</h3>
                </div>
              </div>

              @if (!previewMode()) {
                <textarea
                  class="editor"
                  [(ngModel)]="textValue"
                  (ngModelChange)="previewHtml.set(parseMarkdown($event))"
                  placeholder="## We're upgrading our servers&#10;Expect brief downtime this weekend."
                  aria-label="Announcement markdown editor"
                ></textarea>
              } @else {
                <div class="preview-card">
                  @if (textValue) {
                    <div class="preview" [innerHTML]="previewHtml()"></div>
                  } @else {
                    <div class="empty-preview">
                      <i class="fas fa-bullhorn"></i>
                      <strong>Nothing to preview yet</strong>
                      <span>Write announcement content to see a preview.</span>
                    </div>
                  }
                </div>
              }
            </section>
          </section>

          <section class="confirmations-panel">
            <div class="panel-head">
              <div>
                <span class="panel-kicker">Audit trail</span>
                <h3>{{ confirmationsTab() === 'current' ? 'Confirmations — v' + version() : 'Confirmation History' }}</h3>
              </div>
              <div class="tab-row">
                <button
                  type="button"
                  class="tab-btn"
                  [class.active]="confirmationsTab() === 'current'"
                  (click)="confirmationsTab.set('current')"
                >Current</button>
                <button
                  type="button"
                  class="tab-btn"
                  [class.active]="confirmationsTab() === 'history'"
                  (click)="onHistoryTab()"
                >History</button>
              </div>
            </div>

            @if (confirmationsTab() === 'current') {
              @if (confirmationsLoading()) {
                <div class="confirmations-empty">Loading confirmations...</div>
              } @else if (confirmations().length === 0) {
                <div class="confirmations-empty">No admins have confirmed this version yet.</div>
              } @else {
                <table class="confirmations-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Admin</th>
                      <th>Club</th>
                      <th>Confirmed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of confirmations(); track c.username + c.confirmedAt) {
                      <tr>
                        <td>{{ c.announcementTitle || 'Untitled' }}</td>
                        <td>{{ c.username }}</td>
                        <td>{{ c.clubName || 'Unknown' }}</td>
                        <td>{{ c.confirmedAt | date: 'medium' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            } @else {
              @if (historyLoading()) {
                <div class="confirmations-empty">Loading history...</div>
              } @else if (history().length === 0) {
                <div class="confirmations-empty">No confirmations recorded yet.</div>
              } @else {
                <table class="confirmations-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Title</th>
                      <th>Admin</th>
                      <th>Club</th>
                      <th>Confirmed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of history(); track c.username + c.confirmedAt) {
                      <tr>
                        <td>v{{ c.announcementVersion }}</td>
                        <td>{{ c.announcementTitle || 'Untitled' }}</td>
                        <td>{{ c.username }}</td>
                        <td>{{ c.clubName || 'Unknown' }}</td>
                        <td>{{ c.confirmedAt | date: 'medium' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            }
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
      --border: rgba(255,255,255,.1);
      --text: #fff;
      --muted: rgba(255,255,255,.62);
      --accent: #a3e635;
      --danger: #f87171;
    }

    .ae-shell {
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.13), transparent 28rem),
        linear-gradient(180deg, #0b1b12 0%, var(--bg) 34rem);
      padding: 0 1rem 2rem;
    }

    .ae-topbar {
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

    .icon-btn, .secondary-btn, .primary-btn {
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
    .ae-topbar h1 { margin: .12rem 0 0; font-size: 1.1rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-actions { display: flex; align-items: center; gap: .6rem; }

    .ae-content {
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
      background: linear-gradient(135deg, rgba(25,53,42,.95), rgba(9,27,17,.96));
      box-shadow: 0 18px 50px rgba(0,0,0,.32);
    }
    .hero h2 { margin: .45rem 0 .45rem; font-size: clamp(1.6rem, 3.4vw, 2.6rem); line-height: 1.1; letter-spacing: 0; }
    .hero p { margin: 0; max-width: 640px; color: rgba(255,255,255,.72); line-height: 1.5; }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(104px, 1fr));
      gap: .65rem;
      min-width: 240px;
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

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .75rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      padding: .75rem .85rem;
    }
    .toggle-row strong { display: block; font-size: .85rem; }
    .toggle-row small { display: block; color: var(--muted); font-size: .72rem; margin-top: .12rem; }
    .switch {
      width: 44px;
      height: 26px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.1);
      position: relative;
      cursor: pointer;
      flex-shrink: 0;
    }
    .switch.on { background: rgba(163,230,53,.5); border-color: rgba(163,230,53,.6); }
    .switch-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #fff;
      transition: transform .15s ease;
    }
    .switch.on .switch-knob { transform: translateX(18px); }

    .field { display: flex; flex-direction: column; gap: .35rem; }
    .select-label { color: var(--muted); font-size: .78rem; font-weight: 900; }
    .title-input {
      width: 100%;
      min-height: 44px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #1b3028;
      color: var(--text);
      padding: .65rem .75rem;
      font: inherit;
      outline: none;
      box-sizing: border-box;
    }
    .title-input::placeholder { color: rgba(255,255,255,.3); }
    .title-input:focus { border-color: rgba(163,230,53,.42); box-shadow: 0 0 0 3px rgba(163,230,53,.1); }

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

    .tab-row { display: flex; gap: .4rem; flex-shrink: 0; }
    .tab-btn {
      font-family: inherit;
      cursor: pointer;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      font-size: .78rem;
      font-weight: 800;
      padding: .45rem .8rem;
      border-radius: 999px;
      transition: background .15s, color .15s, border-color .15s;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active {
      background: rgba(163,230,53,.14);
      border-color: rgba(163,230,53,.4);
      color: var(--accent);
    }

    .editor {
      width: 100%;
      min-height: 460px;
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

    .preview-card {
      min-height: 460px;
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
    .empty-preview i { color: var(--accent); font-size: 1.6rem; }
    .empty-preview strong { color: var(--text); }
    .empty-preview span { max-width: 360px; font-size: .86rem; line-height: 1.45; }

    .confirmations-panel {
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      box-shadow: 0 12px 32px rgba(0,0,0,.2);
      overflow: hidden;
    }

    .confirmations-empty {
      padding: 1.25rem;
      color: var(--muted);
      font-size: .85rem;
      text-align: center;
    }

    .confirmations-table {
      width: 100%;
      border-collapse: collapse;
      font-size: .85rem;
    }
    .confirmations-table th {
      text-align: left;
      padding: .65rem 1rem;
      color: var(--muted);
      font-size: .72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .06em;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .confirmations-table td {
      padding: .65rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,.05);
      color: var(--text);
    }
    .confirmations-table tr:last-child td { border-bottom: 0; }

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
      .ae-shell { padding-inline: .75rem; }
      .ae-topbar { grid-template-columns: 42px minmax(0, 1fr); padding: .75rem 0; }
      .topbar-actions { grid-column: 1 / -1; width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
      .secondary-btn, .primary-btn { width: 100%; }
      .hero { padding: 1rem; }
      .hero h2 { font-size: 1.6rem; }
      .hero-metrics { grid-template-columns: 1fr; }
      .metric { min-height: 68px; }
      .side-panel { padding: .75rem; }
      .panel-head { align-items: flex-start; flex-direction: column; padding: .9rem; }
      .editor, .preview-card { min-height: 360px; }
      .preview-card { padding: .85rem; }
      .preview { padding: 1rem; }
    }
  `],
})
export class AnnouncementEditorComponent implements OnInit {
  router = inject(Router);
  private auth = inject(AuthService);
  private announcementService = inject(AnnouncementService);
  // Content is superadmin-managed; rendered Markdown preview is trusted here.
  private sanitizer = inject(DomSanitizer);

  loading = signal(true);
  saving = signal(false);
  errorMsg = signal('');
  successMsg = signal('');
  previewMode = signal(false);

  enabled = signal(false);
  version = signal(0);
  updatedBy = signal('');
  previewHtml = signal<SafeHtml>('');

  confirmations = signal<AnnouncementConfirmation[]>([]);
  confirmationsLoading = signal(false);

  confirmationsTab = signal<'current' | 'history'>('current');
  history = signal<AnnouncementConfirmation[]>([]);
  historyLoading = signal(false);
  private historyLoaded = false;

  titleValue = '';
  textValue = '';

  ngOnInit() {
    if (!this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/clubs']);
      return;
    }
    this.announcementService.getAnnouncement().subscribe({
      next: (announcement) => {
        this.titleValue = announcement.title;
        this.textValue = announcement.text;
        this.enabled.set(announcement.enabled);
        this.version.set(announcement.version);
        this.updatedBy.set(announcement.updatedBy || '');
        this.previewHtml.set(this.parseMarkdown(announcement.text));
        this.loading.set(false);
        this.loadConfirmations();
      },
      error: () => {
        this.errorMsg.set('Failed to load data. Please refresh.');
        this.loading.set(false);
      },
    });
  }

  loadConfirmations() {
    this.confirmationsLoading.set(true);
    this.announcementService.getConfirmations(this.version()).subscribe({
      next: (res) => {
        this.confirmations.set(res.confirmations);
        this.confirmationsLoading.set(false);
      },
      error: () => this.confirmationsLoading.set(false),
    });
  }

  onHistoryTab() {
    this.confirmationsTab.set('history');
    if (this.historyLoaded) return;
    this.historyLoading.set(true);
    this.announcementService.getConfirmationHistory().subscribe({
      next: (res) => {
        this.history.set(res.confirmations);
        this.historyLoading.set(false);
        this.historyLoaded = true;
      },
      error: () => this.historyLoading.set(false),
    });
  }

  save() {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    this.announcementService.updateAnnouncement(this.titleValue, this.textValue, this.enabled()).subscribe({
      next: (res) => {
        this.version.set(res.version);
        this.updatedBy.set(res.updatedBy || '');
        this.successMsg.set(`Announcement published - version ${res.version}.`);
        this.saving.set(false);
        this.loadConfirmations();
        this.historyLoaded = false;
      },
      error: () => {
        this.errorMsg.set('Save failed. Please try again.');
        this.saving.set(false);
      },
    });
  }

  parseMarkdown(text: string): SafeHtml {
    if (!text) return '';
    const html = marked.parse(text) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
