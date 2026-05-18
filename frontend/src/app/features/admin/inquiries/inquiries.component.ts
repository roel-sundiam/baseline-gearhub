import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InquiriesService, Inquiry } from '../../../core/services/inquiries.service';

@Component({
  selector: 'app-admin-inquiries',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="inq-page">
      <div class="inq-header">
        <button class="inq-back" (click)="router.navigate(['/admin/dashboard'])">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div>
          <h1 class="inq-title"><i class="fas fa-envelope"></i> Inquiries</h1>
          <p class="inq-subtitle">Messages sent from your public booking page</p>
        </div>
        @if (unreadCount() > 0) {
          <span class="inq-badge">{{ unreadCount() }} unread</span>
        }
      </div>

      @if (loading()) {
        <div class="inq-state">Loading inquiries...</div>
      } @else if (error()) {
        <div class="inq-state inq-state-error">{{ error() }}</div>
      } @else if (inquiries().length === 0) {
        <div class="inq-state">No inquiries yet.</div>
      } @else {
        <div class="inq-list">
          @for (inq of inquiries(); track inq._id) {
            <div class="inq-card" [class.inq-card-unread]="inq.status === 'unread'">
              <div class="inq-card-top" (click)="toggle(inq._id)">
                <div class="inq-card-info">
                  <span class="inq-sender">{{ inq.senderName }}</span>
                  <span class="inq-email">{{ inq.senderEmail }}</span>
                </div>
                <div class="inq-card-meta">
                  <span class="inq-status inq-status-{{ inq.status }}">{{ inq.status }}</span>
                  <span class="inq-date">{{ inq.createdAt | date:'MMM d, h:mm a' }}</span>
                  <i class="fas" [class.fa-chevron-down]="expanded() !== inq._id" [class.fa-chevron-up]="expanded() === inq._id"></i>
                </div>
              </div>

              @if (expanded() === inq._id) {
                <div class="inq-thread">
                  <!-- Unified chat thread -->
                  <div class="inq-chat-thread">
                    @for (msg of inq.messages; track msg.createdAt) {
                      <div class="inq-chat-msg" [class.inq-chat-guest]="msg.sender === 'guest'" [class.inq-chat-admin]="msg.sender === 'admin'">
                        <div class="inq-chat-meta">
                          <span class="inq-chat-name">{{ msg.sender === 'guest' ? inq.senderName : msg.name }}</span>
                          <span class="inq-chat-time">{{ msg.createdAt | date:'MMM d, h:mm a' }}</span>
                        </div>
                        <div class="inq-chat-bubble">{{ msg.body }}</div>
                      </div>
                    }
                    @if (inq.messages.length === 0) {
                      <p class="inq-empty-thread">No messages yet.</p>
                    }
                  </div>

                  <div class="inq-reply-form">
                    <textarea
                      class="inq-reply-input"
                      placeholder="Type your reply..."
                      [(ngModel)]="replyText"
                      rows="3"
                    ></textarea>
                    @if (replyError()) {
                      <p class="inq-form-error">{{ replyError() }}</p>
                    }
                    <div class="inq-reply-actions">
                      <button class="inq-btn inq-btn-reply" (click)="sendReply(inq)" [disabled]="replying()">
                        @if (replying()) { Sending... } @else { <i class="fas fa-reply"></i> Send Reply }
                      </button>
                      <button class="inq-btn inq-btn-delete" (click)="deleteInquiry(inq._id)" [disabled]="deleting()">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .inq-page {
      max-width: 720px;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 3rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .inq-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.75rem;
      flex-wrap: wrap;
    }
    .inq-back {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff;
      border-radius: 10px;
      width: 38px; height: 38px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .inq-back:hover { background: rgba(255,255,255,0.1); }
    .inq-title {
      font-size: 1.3rem;
      font-weight: 800;
      color: #fff;
      margin: 0 0 0.2rem;
    }
    .inq-title i { color: #a3e635; margin-right: 0.4rem; }
    .inq-subtitle { font-size: 0.8rem; color: rgba(255,255,255,0.38); margin: 0; }
    .inq-badge {
      margin-left: auto;
      background: rgba(163,230,53,0.15);
      border: 1px solid rgba(163,230,53,0.3);
      color: #a3e635;
      border-radius: 20px;
      padding: 0.25rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .inq-state {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.35);
      font-size: 0.9rem;
    }
    .inq-state-error { color: #f87171; }

    .inq-list { display: flex; flex-direction: column; gap: 0.75rem; }

    .inq-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      overflow: hidden;
    }
    .inq-card-unread {
      border-color: rgba(163,230,53,0.25);
      background: rgba(163,230,53,0.04);
    }

    .inq-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.1rem;
      cursor: pointer;
      gap: 1rem;
    }
    .inq-card-top:hover { background: rgba(255,255,255,0.03); }
    .inq-card-info { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .inq-sender { font-size: 0.93rem; font-weight: 700; color: #fff; }
    .inq-email { font-size: 0.76rem; color: rgba(255,255,255,0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .inq-card-meta { display: flex; align-items: center; gap: 0.65rem; flex-shrink: 0; }
    .inq-date { font-size: 0.72rem; color: rgba(255,255,255,0.3); white-space: nowrap; }
    .inq-card-meta i { color: rgba(255,255,255,0.3); font-size: 0.75rem; }

    .inq-status {
      font-size: 0.67rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 0.18rem 0.55rem;
      border-radius: 6px;
    }
    .inq-status-unread { background: rgba(163,230,53,0.12); color: #a3e635; }
    .inq-status-read { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.4); }
    .inq-status-replied { background: rgba(96,165,250,0.12); color: #60a5fa; }

    .inq-thread {
      border-top: 1px solid rgba(255,255,255,0.07);
      padding: 1.1rem 1.1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Unified chat thread */
    .inq-chat-thread {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      max-height: 320px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .inq-chat-msg { display: flex; flex-direction: column; max-width: 80%; }
    .inq-chat-guest { align-self: flex-end; align-items: flex-end; }
    .inq-chat-admin { align-self: flex-start; align-items: flex-start; }
    .inq-chat-meta {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      margin-bottom: 0.2rem;
    }
    .inq-chat-name { font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.38); }
    .inq-chat-time { font-size: 0.65rem; color: rgba(255,255,255,0.22); }
    .inq-chat-bubble {
      padding: 0.55rem 0.85rem;
      border-radius: 14px;
      font-size: 0.87rem;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .inq-chat-guest .inq-chat-bubble {
      background: rgba(163,230,53,0.1);
      border: 1px solid rgba(163,230,53,0.2);
      color: #d4f7a0;
      border-bottom-right-radius: 4px;
    }
    .inq-chat-admin .inq-chat-bubble {
      background: rgba(96,165,250,0.1);
      border: 1px solid rgba(96,165,250,0.2);
      color: rgba(255,255,255,0.82);
      border-bottom-left-radius: 4px;
    }
    .inq-empty-thread { font-size: 0.8rem; color: rgba(255,255,255,0.25); text-align: center; margin: 0.5rem 0; }

    .inq-reply-form { display: flex; flex-direction: column; gap: 0.55rem; }
    .inq-reply-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #fff;
      font-family: inherit;
      font-size: 0.87rem;
      padding: 0.65rem 0.85rem;
      outline: none;
      resize: none;
      transition: border-color 0.18s;
    }
    .inq-reply-input::placeholder { color: rgba(255,255,255,0.25); }
    .inq-reply-input:focus { border-color: rgba(163,230,53,0.4); }
    .inq-form-error { font-size: 0.78rem; color: #f87171; margin: 0; }

    .inq-reply-actions { display: flex; gap: 0.6rem; }
    .inq-btn {
      border: none;
      border-radius: 9px;
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0.58rem 1rem;
      transition: opacity 0.15s;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .inq-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .inq-btn-reply {
      flex: 1;
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.3);
      color: #a3e635;
    }
    .inq-btn-reply:hover:not(:disabled) { background: rgba(163,230,53,0.2); }
    .inq-btn-delete {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.25);
      color: #f87171;
      padding: 0.58rem 0.85rem;
    }
    .inq-btn-delete:hover:not(:disabled) { background: rgba(239,68,68,0.18); }
  `],
})
export class InquiriesComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  private svc = inject(InquiriesService);

  inquiries = signal<Inquiry[]>([]);
  loading = signal(true);
  error = signal('');
  expanded = signal<string | null>(null);
  replying = signal(false);
  deleting = signal(false);
  replyError = signal('');
  replyText = '';
  private pollTimer: any = null;

  unreadCount = () => this.inquiries().filter(i => i.status === 'unread').length;

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  load() {
    this.loading.set(true);
    this.svc.getInquiries().subscribe({
      next: (data) => { this.inquiries.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load inquiries.'); this.loading.set(false); },
    });
  }

  private refresh() {
    this.svc.getInquiries().subscribe({
      next: (data) => this.inquiries.set(data),
      error: () => {},
    });
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.refresh(), 4000);
  }

  private stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  toggle(id: string) {
    if (this.expanded() === id) {
      this.expanded.set(null);
      this.replyText = '';
      this.replyError.set('');
      this.stopPolling();
      return;
    }
    this.expanded.set(id);
    this.replyText = '';
    this.replyError.set('');
    this.startPolling();

    const inq = this.inquiries().find(i => i._id === id);
    if (inq && inq.status === 'unread') {
      this.svc.markRead(id).subscribe({
        next: (updated) => {
          this.inquiries.update(list => list.map(i => i._id === id ? updated : i));
        },
      });
    }
  }

  sendReply(inq: Inquiry) {
    if (!this.replyText.trim()) {
      this.replyError.set('Reply cannot be empty.');
      return;
    }
    this.replying.set(true);
    this.replyError.set('');
    this.svc.reply(inq._id, this.replyText.trim()).subscribe({
      next: (updated) => {
        this.inquiries.update(list => list.map(i => i._id === inq._id ? updated : i));
        this.replyText = '';
        this.replying.set(false);
      },
      error: () => { this.replyError.set('Failed to send reply.'); this.replying.set(false); },
    });
  }

  deleteInquiry(id: string) {
    this.deleting.set(true);
    this.svc.deleteInquiry(id).subscribe({
      next: () => {
        this.inquiries.update(list => list.filter(i => i._id !== id));
        if (this.expanded() === id) this.expanded.set(null);
        this.deleting.set(false);
      },
      error: () => { this.deleting.set(false); },
    });
  }
}
