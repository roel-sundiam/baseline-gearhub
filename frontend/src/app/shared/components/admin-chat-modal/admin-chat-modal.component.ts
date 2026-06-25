import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy,
  SimpleChanges, ChangeDetectorRef, inject, ViewChild, ElementRef, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminMessagesService, AdminMessage } from '../../../core/services/admin-messages.service';
import { AuthService } from '../../../core/services/auth.service';
import { SoundService } from '../../../core/services/sound.service';

@Component({
  selector: 'app-admin-chat-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat-backdrop">
      <div class="chat-modal">

        <div class="chat-header">
          <div class="chat-header-info">
            <i class="fas fa-comments"></i>
            <span>{{ recipientName }}</span>
          </div>
          <button class="chat-close" (click)="closed.emit()"><i class="fas fa-times"></i></button>
        </div>

        <div class="chat-body" #scrollContainer>
          @if (loading) {
            <div class="chat-loading"><i class="fas fa-circle-notch fa-spin"></i></div>
          } @else if (messages.length === 0) {
            <div class="chat-empty">No messages yet. Start the conversation below.</div>
          } @else {
            @for (msg of messages; track msg._id) {
              <div class="chat-bubble-row" [class.mine]="msg.from._id === myId">
                <div class="chat-bubble" [class.bubble-mine]="msg.from._id === myId" [class.bubble-theirs]="msg.from._id !== myId">
                  <span class="bubble-sender">{{ msg.from._id === myId ? 'You' : msg.from.name }}</span>
                  <p class="bubble-body">{{ msg.body }}</p>
                  <span class="bubble-time">{{ msg.createdAt | date:'MMM d, h:mm a' }}</span>
                </div>
              </div>
            }
          }
        </div>

        <div class="chat-footer">
          <textarea
            class="chat-input"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
            placeholder="Type a message…"
            rows="2"
            (keydown.enter)="onEnter($event)"
          ></textarea>
          <button class="chat-send" [disabled]="sending || !draft().trim()" (click)="send()">
            @if (sending) { <i class="fas fa-circle-notch fa-spin"></i> } @else { <i class="fas fa-paper-plane"></i> }
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .chat-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .chat-modal {
      background: #fff; border-radius: 12px; width: 100%; max-width: 520px;
      display: flex; flex-direction: column; max-height: 80vh; box-shadow: 0 8px 40px rgba(0,0,0,0.25);
    }
    .chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem; border-bottom: 1px solid #f0f0f0;
      background: #9f7338; color: #fff; border-radius: 12px 12px 0 0;
    }
    .chat-header-info { display: flex; align-items: center; gap: 0.6rem; font-weight: 600; font-size: 1rem; }
    .chat-close {
      background: none; border: none; color: #fff; font-size: 1rem;
      cursor: pointer; padding: 0.25rem 0.5rem; border-radius: 6px; opacity: 0.8;
    }
    .chat-close:hover { opacity: 1; background: rgba(255,255,255,0.15); }
    .chat-body {
      flex: 1; overflow-y: auto; padding: 1rem; display: flex;
      flex-direction: column; gap: 0.6rem; min-height: 200px;
    }
    .chat-loading, .chat-empty {
      text-align: center; color: #9ca3af; font-size: 0.9rem; margin: auto;
    }
    .chat-bubble-row { display: flex; }
    .chat-bubble-row.mine { justify-content: flex-end; }
    .chat-bubble {
      max-width: 75%; padding: 0.6rem 0.85rem; border-radius: 12px;
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .bubble-mine { background: #9f7338; color: #fff; border-bottom-right-radius: 3px; }
    .bubble-theirs { background: #f3f4f6; color: #111; border-bottom-left-radius: 3px; }
    .bubble-sender { font-size: 0.72rem; font-weight: 600; opacity: 0.7; }
    .bubble-body { margin: 0; font-size: 0.9rem; line-height: 1.4; white-space: pre-wrap; }
    .bubble-time { font-size: 0.68rem; opacity: 0.6; align-self: flex-end; }
    .chat-footer {
      display: flex; gap: 0.5rem; padding: 0.75rem 1rem;
      border-top: 1px solid #f0f0f0; align-items: flex-end;
    }
    .chat-input {
      flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 0.75rem;
      font-size: 0.9rem; resize: none; font-family: inherit; line-height: 1.4;
      color: #111; background: #fff;
    }
    .chat-input:focus { outline: none; border-color: #9f7338; }
    .chat-send {
      background: #9f7338; color: #fff; border: none; border-radius: 8px;
      padding: 0.6rem 0.9rem; cursor: pointer; font-size: 1rem; flex-shrink: 0;
    }
    .chat-send:hover:not(:disabled) { background: #7d5a2a; }
    .chat-send:disabled { opacity: 0.5; cursor: default; }
  `],
})
export class AdminChatModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() recipientId = '';
  @Input() recipientName = '';
  @Output() closed = new EventEmitter<void>();
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  private readonly msgService = inject(AdminMessagesService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sound = inject(SoundService);

  messages: AdminMessage[] = [];
  loading = false;
  sending = false;
  draft = signal('');
  myId = '';
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.myId = this.authService.user()?.id ?? '';
    this.load();
    this.startPolling();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['recipientId'] && !changes['recipientId'].firstChange) {
      this.messages = [];
      this.stopPolling();
      this.load();
      this.startPolling();
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    this.pollInterval = setInterval(() => this.poll(), 5_000);
  }

  private stopPolling() {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
  }

  private poll() {
    if (!this.recipientId || this.sending) return;
    this.msgService.getConversation(this.recipientId).subscribe({
      next: (msgs) => {
        if (msgs.length > this.messages.length) {
          const isIncoming = msgs[msgs.length - 1].from._id !== this.myId;
          this.messages = msgs;
          if (isIncoming) this.sound.notification();
          this.cdr.detectChanges();
          this.scrollToBottom();
          this.msgService.markRead(this.recipientId).subscribe();
        }
      },
      error: () => {},
    });
  }

  load() {
    if (!this.recipientId) return;
    this.loading = true;
    this.msgService.getConversation(this.recipientId).subscribe({
      next: (msgs) => {
        this.messages = msgs;
        this.loading = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
        this.msgService.markRead(this.recipientId).subscribe();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  send() {
    const body = this.draft().trim();
    if (!body || this.sending) return;
    this.sending = true;
    this.msgService.send(this.recipientId, body).subscribe({
      next: (msg) => {
        this.messages = [...this.messages, msg];
        this.draft.set('');
        this.sending = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: () => { this.sending = false; this.cdr.detectChanges(); },
    });
  }

  onEnter(event: Event) {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }
}
