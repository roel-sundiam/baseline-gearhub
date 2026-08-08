import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SponsorService, SponsorInquiry } from '../../../core/services/sponsor.service';

@Component({
  selector: 'app-admin-sponsor-inquiries',
  imports: [DatePipe, TitleCasePipe, RouterLink],
  template: `
    <div class="si-page">
      <header class="si-header">
        <button class="si-back" (click)="router.navigate(['/admin/sponsors'])">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div>
          <span class="si-kicker"><i class="fas fa-inbox"></i> Partner applications</span>
          <h1 class="si-title">Sponsor Inquiries</h1>
          <p class="si-subtitle">Businesses that applied through the "Become a Partner" form.</p>
        </div>
      </header>

      @if (loading()) {
        <div class="si-loading">
          <div class="si-spinner"></div>
          <span>Loading inquiries...</span>
        </div>
      } @else if (items().length === 0) {
        <div class="si-empty">
          <i class="fas fa-inbox"></i>
          <p>No partner applications yet.</p>
        </div>
      } @else {
        <div class="si-list">
          @for (item of items(); track item._id) {
            <article class="si-card">
              <div class="si-card-top">
                <div>
                  <h3 class="si-card-title">{{ item.businessName }}</h3>
                  <span class="si-status-badge si-status-{{ item.status }}">{{ item.status | titlecase }}</span>
                </div>
                <span class="si-card-date">{{ item.createdAt | date:'mediumDate' }}</span>
              </div>
              <div class="si-contact">
                <span><i class="fas fa-user"></i> {{ item.contactName }}</span>
                <a [href]="'mailto:' + item.email"><i class="fas fa-envelope"></i> {{ item.email }}</a>
                @if (item.phone) { <span><i class="fas fa-phone"></i> {{ item.phone }}</span> }
              </div>
              <p class="si-message">{{ item.message }}</p>
              <div class="si-actions">
                @if (item.status !== 'reviewed') {
                  <button class="si-action-btn si-reviewed-btn" (click)="setStatus(item, 'reviewed')">
                    <i class="fas fa-check"></i> Mark Reviewed
                  </button>
                }
                @if (item.status !== 'archived') {
                  <button class="si-action-btn si-archive-btn" (click)="setStatus(item, 'archived')">
                    <i class="fas fa-box-archive"></i> Archive
                  </button>
                }
                <button class="si-action-btn si-delete-btn" (click)="confirmDelete(item)">
                  <i class="fas fa-trash"></i> Delete
                </button>
                <a routerLink="/admin/sponsors" class="si-action-btn si-create-btn">
                  <i class="fas fa-plus"></i> Create Sponsor
                </a>
              </div>
            </article>
          }
        </div>
      }

      @if (deleteTarget()) {
        <div class="si-modal-backdrop" (click)="deleteTarget.set(null)">
          <div class="si-modal" (click)="$event.stopPropagation()">
            <p class="si-modal-msg">Delete application from "<strong>{{ deleteTarget()!.businessName }}</strong>"?</p>
            <p class="si-modal-sub">This cannot be undone.</p>
            <div class="si-modal-actions">
              <button class="si-delete-confirm-btn" [disabled]="deleting()" (click)="doDelete()">
                @if (deleting()) { Deleting... } @else { Delete }
              </button>
              <button class="si-cancel-btn" (click)="deleteTarget.set(null)">Cancel</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; background: #0c1a11; min-height: calc(100vh - 60px); }
    .si-page { max-width: 820px; margin: 0 auto; padding: 1.25rem 1rem 2.5rem; color: #fff; }
    .si-header { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.5rem; }
    .si-back {
      background: rgba(163,230,53,0.09); border: 1px solid rgba(163,230,53,0.19); color: #a3e635;
      width: 40px; height: 40px; border-radius: 12px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0;
    }
    .si-back:hover { background: rgba(163,230,53,0.16); }
    .si-kicker { color: #a3e635; font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
    .si-kicker i { margin-right: 0.3rem; }
    .si-title { margin: 0.15rem 0 0.1rem; font-size: 1.35rem; font-weight: 800; color: #fff; }
    .si-subtitle { margin: 0; font-size: 0.8rem; color: rgba(255,255,255,0.45); }

    .si-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem 0; color: rgba(255,255,255,0.5); font-size: 0.9rem; }
    .si-spinner { width: 28px; height: 28px; border: 2px solid rgba(163,230,53,0.2); border-top-color: #a3e635; border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .si-empty { text-align: center; padding: 3rem 1rem; color: rgba(255,255,255,0.35); border: 1px dashed rgba(163,230,53,0.16); border-radius: 17px; background: #162a20; }
    .si-empty i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; color: rgba(163,230,53,0.3); }
    .si-empty p { margin: 0; font-size: 0.9rem; }

    .si-list { display: flex; flex-direction: column; gap: 0.85rem; }
    .si-card { background: #1b3028; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.1rem 1.25rem; }
    .si-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.6rem; }
    .si-card-title { font-size: 1rem; font-weight: 700; color: #fff; margin: 0 0 0.35rem; }
    .si-status-badge { font-size: 0.68rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em; }
    .si-status-new { background: rgba(56,189,248,0.15); color: #38bdf8; }
    .si-status-reviewed { background: rgba(163,230,53,0.15); color: #a3e635; }
    .si-status-archived { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
    .si-card-date { font-size: 0.75rem; color: rgba(255,255,255,0.35); white-space: nowrap; }

    .si-contact { display: flex; flex-wrap: wrap; gap: 0.9rem; font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-bottom: 0.65rem; }
    .si-contact i { color: #a3e635; margin-right: 0.35rem; }
    .si-contact a { color: rgba(255,255,255,0.6); text-decoration: none; }
    .si-contact a:hover { color: #a3e635; }

    .si-message { font-size: 0.85rem; color: rgba(255,255,255,0.7); line-height: 1.6; margin: 0 0 0.85rem; white-space: pre-wrap; }

    .si-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .si-action-btn {
      font-size: 0.78rem; font-weight: 600; padding: 0.35rem 0.75rem; border-radius: 8px; cursor: pointer;
      font-family: inherit; display: flex; align-items: center; gap: 0.35rem; border: 1px solid transparent;
      text-decoration: none; transition: background 0.15s;
    }
    .si-reviewed-btn { background: rgba(163,230,53,0.09); color: #a3e635; border-color: rgba(163,230,53,0.2); }
    .si-reviewed-btn:hover { background: rgba(163,230,53,0.18); }
    .si-archive-btn { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.12); }
    .si-archive-btn:hover { background: rgba(255,255,255,0.13); }
    .si-delete-btn { background: rgba(248,113,113,0.08); color: #f87171; border-color: rgba(248,113,113,0.2); }
    .si-delete-btn:hover { background: rgba(248,113,113,0.16); }
    .si-create-btn { background: rgba(56,189,248,0.09); color: #38bdf8; border-color: rgba(56,189,248,0.2); margin-left: auto; }
    .si-create-btn:hover { background: rgba(56,189,248,0.18); }

    .si-modal-backdrop { position: fixed; inset: 0; background: rgba(3,12,7,0.72); z-index: 500; display: flex; align-items: center; justify-content: center; }
    .si-modal { background: #1b3028; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 1.5rem; max-width: 360px; width: calc(100% - 2rem); }
    .si-modal-msg { font-size: 0.95rem; color: #fff; margin: 0 0 0.25rem; }
    .si-modal-sub { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin: 0 0 1.25rem; }
    .si-modal-actions { display: flex; gap: 0.75rem; }
    .si-delete-confirm-btn {
      background: #f87171; color: #fff; border: none; border-radius: 9px; padding: 0.55rem 1.25rem;
      font-size: 0.88rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.15s;
    }
    .si-delete-confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .si-cancel-btn {
      background: transparent; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 9px; padding: 0.55rem 1rem; font-size: 0.85rem; cursor: pointer; font-family: inherit;
    }
    .si-cancel-btn:hover { color: rgba(255,255,255,0.8); }
  `],
})
export class AdminSponsorInquiriesComponent implements OnInit {
  protected router = inject(Router);
  private auth = inject(AuthService);
  private sponsorService = inject(SponsorService);

  items = signal<SponsorInquiry[]>([]);
  loading = signal(true);
  deleteTarget = signal<SponsorInquiry | null>(null);
  deleting = signal(false);

  ngOnInit() {
    if (!this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.sponsorService.getInquiries().subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setStatus(item: SponsorInquiry, status: SponsorInquiry['status']) {
    this.sponsorService.setInquiryStatus(item._id, status).subscribe({
      next: (updated) => this.items.update(list => list.map(i => i._id === updated._id ? updated : i)),
      error: () => {},
    });
  }

  confirmDelete(item: SponsorInquiry) {
    this.deleteTarget.set(item);
  }

  doDelete() {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.sponsorService.deleteInquiry(target._id).subscribe({
      next: () => {
        this.items.update(list => list.filter(i => i._id !== target._id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }
}
