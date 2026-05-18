import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NewsService, ClubNews } from '../../../core/services/news.service';

@Component({
  selector: 'app-admin-news',
  imports: [FormsModule, DatePipe, TitleCasePipe],
  template: `
    <div class="an-page">
      <div class="an-header">
        <div class="an-header-left">
          <button class="an-back" (click)="router.navigate(['/admin/dashboard'])">
            <i class="fas fa-arrow-left"></i>
          </button>
          <div>
            <h1 class="an-title"><i class="fas fa-newspaper"></i> Club News</h1>
            <p class="an-subtitle">Manage posts visible to all club members</p>
          </div>
        </div>
        <button class="an-new-btn" (click)="openForm()">
          <i class="fas fa-plus"></i> New Post
        </button>
      </div>

      <!-- Create / Edit form -->
      @if (formOpen()) {
        <div class="an-form-card">
          <h3 class="an-form-title">{{ editId() ? 'Edit Post' : 'New Post' }}</h3>
          <div class="an-form-grid">
            <div class="an-field">
              <label>Title <span class="an-req">*</span></label>
              <input [(ngModel)]="form.title" placeholder="e.g. Court closed this Saturday" class="an-input" />
            </div>
            <div class="an-field">
              <label>Type</label>
              <select [(ngModel)]="form.type" class="an-input">
                <option value="news">News</option>
                <option value="announcement">Announcement</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div class="an-field an-field-full">
              <label>Body <span class="an-req">*</span></label>
              <textarea [(ngModel)]="form.body" rows="4" placeholder="Write the full post content here..." class="an-input an-textarea"></textarea>
            </div>
            <div class="an-field an-field-pin">
              <label class="an-toggle-label">
                <input type="checkbox" [(ngModel)]="form.pinned" class="an-checkbox" />
                <span class="an-toggle-text">
                  <i class="fas fa-thumbtack"></i> Pin this post
                  <small>(appears at top of Club News)</small>
                </span>
              </label>
            </div>
          </div>
          @if (formError()) {
            <p class="an-error">{{ formError() }}</p>
          }
          <div class="an-form-actions">
            <button class="an-save-btn" [disabled]="saving()" (click)="save()">
              @if (saving()) { <i class="fas fa-circle-notch fa-spin"></i> Saving... }
              @else { <i class="fas fa-check"></i> {{ editId() ? 'Save Changes' : 'Publish Post' }} }
            </button>
            <button class="an-cancel-btn" (click)="closeForm()">Cancel</button>
          </div>
        </div>
      }

      <!-- Posts list -->
      @if (loading()) {
        <div class="an-loading">
          <div class="an-spinner"></div>
          <span>Loading posts...</span>
        </div>
      } @else if (items().length === 0) {
        <div class="an-empty">
          <i class="fas fa-newspaper"></i>
          <p>No posts yet. Create the first one!</p>
        </div>
      } @else {
        <div class="an-list">
          @for (item of items(); track item._id) {
            <div class="an-card" [class.an-card-pinned]="item.pinned">
              <div class="an-card-top">
                <div class="an-card-badges">
                  <span class="an-type-badge an-type-{{ item.type }}">{{ item.type | titlecase }}</span>
                  @if (item.pinned) {
                    <span class="an-pinned-badge"><i class="fas fa-thumbtack"></i> Pinned</span>
                  }
                </div>
                <span class="an-card-date">{{ item.createdAt | date:'mediumDate' }}</span>
              </div>
              <h3 class="an-card-title">{{ item.title }}</h3>
              <p class="an-card-body">{{ item.body }}</p>
              @if (item.createdBy?.name) {
                <p class="an-card-by">Posted by {{ item.createdBy!.name }}</p>
              }
              <div class="an-card-actions">
                <button class="an-action-btn an-edit-btn" (click)="openEdit(item)">
                  <i class="fas fa-pen"></i> Edit
                </button>
                <button class="an-action-btn an-pin-btn" (click)="togglePin(item)">
                  <i class="fas fa-thumbtack"></i> {{ item.pinned ? 'Unpin' : 'Pin' }}
                </button>
                <button class="an-action-btn an-delete-btn" (click)="confirmDelete(item)">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Delete confirm modal -->
      @if (deleteTarget()) {
        <div class="an-modal-backdrop" (click)="deleteTarget.set(null)">
          <div class="an-modal" (click)="$event.stopPropagation()">
            <p class="an-modal-msg">Delete "<strong>{{ deleteTarget()!.title }}</strong>"?</p>
            <p class="an-modal-sub">This cannot be undone.</p>
            <div class="an-modal-actions">
              <button class="an-delete-confirm-btn" [disabled]="deleting()" (click)="doDelete()">
                @if (deleting()) { Deleting... } @else { Delete }
              </button>
              <button class="an-cancel-btn" (click)="deleteTarget.set(null)">Cancel</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .an-page {
      max-width: 760px;
      margin: 0 auto;
      padding-bottom: 2rem;
    }
    .an-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .an-header-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .an-back {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #fff;
      width: 36px; height: 36px;
      border-radius: 10px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.9rem;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .an-back:hover { background: rgba(255,255,255,0.13); }
    .an-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.1rem;
    }
    .an-title i { color: #a3e635; margin-right: 0.4rem; }
    .an-subtitle {
      font-size: 0.77rem;
      color: rgba(255,255,255,0.4);
      margin: 0;
    }
    .an-new-btn {
      background: rgba(163,230,53,0.15);
      color: #a3e635;
      border: 1px solid rgba(163,230,53,0.4);
      border-radius: 10px;
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      display: flex; align-items: center; gap: 0.4rem;
      transition: background 0.15s;
    }
    .an-new-btn:hover { background: rgba(163,230,53,0.25); }

    /* Form */
    .an-form-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(163,230,53,0.2);
      border-radius: 14px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }
    .an-form-title {
      font-size: 1rem;
      font-weight: 700;
      color: #a3e635;
      margin: 0 0 1rem;
    }
    .an-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    .an-field { display: flex; flex-direction: column; gap: 0.35rem; }
    .an-field label { font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600; }
    .an-req { color: #a3e635; }
    .an-field-full { grid-column: 1 / -1; }
    .an-field-pin { grid-column: 1 / -1; }
    .an-input {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #fff;
      padding: 0.55rem 0.75rem;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    .an-input:focus { border-color: rgba(163,230,53,0.5); }
    .an-textarea { resize: vertical; min-height: 90px; }
    select.an-input option { background: #1a2e1a; }
    .an-toggle-label {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      cursor: pointer;
    }
    .an-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: #a3e635; }
    .an-toggle-text {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.75);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .an-toggle-text i { color: #a3e635; }
    .an-toggle-text small { color: rgba(255,255,255,0.4); font-size: 0.75rem; }
    .an-error {
      color: #f87171;
      font-size: 0.82rem;
      margin: 0.5rem 0 0;
    }
    .an-form-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .an-save-btn {
      background: #a3e635;
      color: #0c1a11;
      border: none;
      border-radius: 9px;
      padding: 0.55rem 1.25rem;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      display: flex; align-items: center; gap: 0.4rem;
      transition: opacity 0.15s;
    }
    .an-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .an-cancel-btn {
      background: transparent;
      color: rgba(255,255,255,0.5);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 9px;
      padding: 0.55rem 1rem;
      font-size: 0.85rem;
      cursor: pointer;
      font-family: inherit;
      transition: color 0.15s;
    }
    .an-cancel-btn:hover { color: rgba(255,255,255,0.8); }

    /* Loading / Empty */
    .an-loading {
      display: flex; flex-direction: column; align-items: center;
      gap: 1rem; padding: 3rem 0;
      color: rgba(255,255,255,0.5); font-size: 0.9rem;
    }
    .an-spinner {
      width: 28px; height: 28px;
      border: 2px solid rgba(163,230,53,0.2);
      border-top-color: #a3e635;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .an-empty {
      text-align: center; padding: 3rem 1rem;
      color: rgba(255,255,255,0.35);
    }
    .an-empty i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; color: rgba(163,230,53,0.3); }
    .an-empty p { margin: 0; font-size: 0.9rem; }

    /* Post cards */
    .an-list { display: flex; flex-direction: column; gap: 0.85rem; }
    .an-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 1rem 1.1rem;
    }
    .an-card-pinned {
      border-color: rgba(163,230,53,0.3);
      background: rgba(163,230,53,0.05);
    }
    .an-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .an-card-badges { display: flex; align-items: center; gap: 0.5rem; }
    .an-type-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .an-type-news { background: rgba(56,189,248,0.15); color: #38bdf8; }
    .an-type-announcement { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .an-type-event { background: rgba(163,230,53,0.15); color: #a3e635; }
    .an-pinned-badge {
      font-size: 0.7rem;
      color: #a3e635;
      display: flex; align-items: center; gap: 0.25rem;
    }
    .an-card-date { font-size: 0.75rem; color: rgba(255,255,255,0.35); }
    .an-card-title {
      font-size: 0.97rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.35rem;
    }
    .an-card-body {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.65);
      margin: 0 0 0.35rem;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .an-card-by {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.3);
      margin: 0 0 0.65rem;
    }
    .an-card-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .an-action-btn {
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.3rem 0.7rem;
      border-radius: 7px;
      cursor: pointer;
      font-family: inherit;
      display: flex; align-items: center; gap: 0.3rem;
      border: 1px solid transparent;
      transition: background 0.15s;
    }
    .an-edit-btn { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.12); }
    .an-edit-btn:hover { background: rgba(255,255,255,0.13); }
    .an-pin-btn { background: rgba(163,230,53,0.09); color: #a3e635; border-color: rgba(163,230,53,0.2); }
    .an-pin-btn:hover { background: rgba(163,230,53,0.18); }
    .an-delete-btn { background: rgba(248,113,113,0.08); color: #f87171; border-color: rgba(248,113,113,0.2); }
    .an-delete-btn:hover { background: rgba(248,113,113,0.16); }

    /* Delete modal */
    .an-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 500;
      display: flex; align-items: center; justify-content: center;
    }
    .an-modal {
      background: #1a2e1a;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      padding: 1.5rem;
      max-width: 360px;
      width: calc(100% - 2rem);
    }
    .an-modal-msg { font-size: 0.95rem; color: #fff; margin: 0 0 0.25rem; }
    .an-modal-sub { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin: 0 0 1.25rem; }
    .an-modal-actions { display: flex; gap: 0.75rem; }
    .an-delete-confirm-btn {
      background: #f87171;
      color: #fff;
      border: none;
      border-radius: 9px;
      padding: 0.55rem 1.25rem;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.15s;
    }
    .an-delete-confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 520px) {
      .an-form-grid { grid-template-columns: 1fr; }
      .an-field-full, .an-field-pin { grid-column: 1; }
      .an-header { flex-direction: column; }
    }
  `],
})
export class AdminNewsComponent implements OnInit {
  protected router = inject(Router);
  private newsService = inject(NewsService);

  items = signal<ClubNews[]>([]);
  loading = signal(true);
  formOpen = signal(false);
  saving = signal(false);
  editId = signal<string | null>(null);
  formError = signal('');
  deleteTarget = signal<ClubNews | null>(null);
  deleting = signal(false);

  form = { title: '', body: '', type: 'news', pinned: false };

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.newsService.getNews().subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm() {
    this.editId.set(null);
    this.form = { title: '', body: '', type: 'news', pinned: false };
    this.formError.set('');
    this.formOpen.set(true);
  }

  openEdit(item: ClubNews) {
    this.editId.set(item._id);
    this.form = { title: item.title, body: item.body, type: item.type, pinned: item.pinned };
    this.formError.set('');
    this.formOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() {
    this.formOpen.set(false);
    this.editId.set(null);
    this.formError.set('');
  }

  save() {
    if (!this.form.title.trim()) { this.formError.set('Title is required.'); return; }
    if (!this.form.body.trim()) { this.formError.set('Body is required.'); return; }
    this.formError.set('');
    this.saving.set(true);

    const obs = this.editId()
      ? this.newsService.update(this.editId()!, this.form)
      : this.newsService.create(this.form);

    obs.subscribe({
      next: (saved) => {
        if (this.editId()) {
          this.items.update(list => list.map(i => i._id === saved._id ? saved : i));
        } else {
          this.items.update(list => [saved, ...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
        }
        this.saving.set(false);
        this.closeForm();
      },
      error: () => {
        this.formError.set('Failed to save. Please try again.');
        this.saving.set(false);
      },
    });
  }

  togglePin(item: ClubNews) {
    this.newsService.togglePin(item._id).subscribe({
      next: (updated) => {
        this.items.update(list =>
          list.map(i => i._id === updated._id ? updated : i)
              .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
        );
      },
      error: () => {},
    });
  }

  confirmDelete(item: ClubNews) {
    this.deleteTarget.set(item);
  }

  doDelete() {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.newsService.delete(target._id).subscribe({
      next: () => {
        this.items.update(list => list.filter(i => i._id !== target._id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }
}
