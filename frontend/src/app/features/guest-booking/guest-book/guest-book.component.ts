import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PublicBookingService } from '../../../core/services/public-booking.service';

@Component({
  selector: 'app-guest-book',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lp-shell">
      <!-- Top bar -->
      <div class="lp-topbar">
        <img src="/CourtGo.png" alt="CourtGo" class="lp-courtgo-logo" />
      </div>

      @if (clubError) {
        <div class="lp-center">
          <div class="lp-error-icon"><i class="fas fa-exclamation-circle"></i></div>
          <p class="lp-error-msg">{{ clubError }}</p>
        </div>
      } @else {
        <!-- Club hero -->
        <div class="lp-hero">
          @if (clubLogo) {
            <img class="lp-club-logo-img" [src]="clubLogo" [alt]="clubName" />
          } @else {
            <div class="lp-club-logo-placeholder">
              <i class="fas fa-table-tennis"></i>
            </div>
          }
          <h1 class="lp-club-name">{{ clubName || '&nbsp;' }}</h1>
          @if (clubLocation) {
            <div class="lp-club-location">
              <i class="fas fa-map-marker-alt"></i>
              {{ clubLocation }}
            </div>
          }
          @if (isVineyard) {
            <div class="lp-social-links">
              <a href="https://www.facebook.com/profile.php?id=61579492273927"
                 target="_blank" rel="noopener noreferrer"
                 class="lp-social-link lp-social-fb">
                <img src="/facebook.svg" class="lp-social-icon" alt="Facebook" />
              </a>
              <a href="https://reclub.co/clubs/@the-vineyard-pickleball-court"
                 target="_blank" rel="noopener noreferrer"
                 class="lp-social-link lp-social-reclub">
                <img src="/reclub.png" class="lp-social-icon" alt="Reclub" />
              </a>
            </div>
          }
        </div>

        <div class="lp-body">
          @if (clubSuspended) {
            <div class="lp-suspended">
              <i class="fas fa-ban"></i>
              <p>This club is currently unavailable for bookings.</p>
            </div>
          } @else {
            <div class="lp-about">
              <div class="lp-about-label">Book a Court Online</div>
              <p class="lp-about-text">Reserve your court in minutes — members and guests welcome. Choose a time slot, submit your booking, and pay at the club.</p>
            </div>

            <div class="lp-ctas">
              <button class="lp-cta lp-cta-member" (click)="goToLogin()">
                <div class="lp-cta-left">
                  <div class="lp-cta-icon lp-cta-icon-member">
                    <i class="fas fa-user-circle"></i>
                  </div>
                  <div>
                    <div class="lp-cta-title">Member Login</div>
                    <div class="lp-cta-sub">Sign in with your club account</div>
                  </div>
                </div>
                <i class="fas fa-chevron-right lp-cta-arrow"></i>
              </button>

              <button class="lp-cta lp-cta-guest" (click)="goToReserve()">
                <div class="lp-cta-left">
                  <div class="lp-cta-icon lp-cta-icon-guest">
                    <i class="fas fa-calendar-plus"></i>
                  </div>
                  <div>
                    <div class="lp-cta-title">Book as Guest</div>
                    <div class="lp-cta-sub">No account needed — walk-in booking</div>
                  </div>
                </div>
                <i class="fas fa-chevron-right lp-cta-arrow"></i>
              </button>
            </div>

            <!-- Chat Widget -->
            <div class="lp-contact">
              <div class="lp-contact-header">
                <span class="lp-contact-label">
                  <i class="fas fa-comment-dots"></i> Chat with us
                </span>
                <p class="lp-contact-sub">
                  @if (!chatOpen) {
                    Send a message — the club admin will reply here.
                  } @else {
                    Live chat active · replies appear automatically
                  }
                </p>
              </div>

              @if (!chatOpen) {
                <!-- Pre-chat form -->
                <form class="lp-inq-form" (ngSubmit)="submitInquiry()">
                  <input
                    class="lp-inq-input"
                    type="text"
                    placeholder="Your name"
                    [(ngModel)]="inquiry.senderName"
                    name="senderName"
                    required
                  />
                  <input
                    class="lp-inq-input"
                    type="email"
                    placeholder="Your email"
                    [(ngModel)]="inquiry.senderEmail"
                    name="senderEmail"
                    required
                  />
                  <textarea
                    class="lp-inq-input lp-inq-textarea"
                    placeholder="Your message..."
                    [(ngModel)]="inquiry.message"
                    name="message"
                    rows="3"
                    required
                  ></textarea>
                  @if (inquiryError) {
                    <p class="lp-inq-error">{{ inquiryError }}</p>
                  }
                  <button class="lp-inq-btn" type="submit" [disabled]="inquirySubmitting">
                    @if (inquirySubmitting) {
                      <i class="fas fa-spinner fa-spin"></i> Starting chat...
                    } @else {
                      <i class="fas fa-comment-dots"></i> Start Chat
                    }
                  </button>
                </form>
              } @else {
                <!-- Live chat thread -->
                <div class="lp-chat-thread" #chatThread>
                  @for (msg of chatMessages; track msg.createdAt) {
                    <div class="lp-chat-msg" [class.lp-chat-guest]="msg.sender === 'guest'" [class.lp-chat-admin]="msg.sender === 'admin'">
                      <span class="lp-chat-name">{{ msg.sender === 'guest' ? 'You' : msg.name }}</span>
                      <div class="lp-chat-bubble">{{ msg.body }}</div>
                    </div>
                  }
                  @if (chatMessages.length === 0) {
                    <p class="lp-chat-waiting">Waiting for admin to join...</p>
                  }
                </div>
                <form class="lp-chat-input-row" (ngSubmit)="sendFollowup()">
                  <input
                    class="lp-chat-input"
                    type="text"
                    placeholder="Type a message..."
                    [(ngModel)]="followupText"
                    name="followup"
                    autocomplete="off"
                  />
                  <button class="lp-chat-send" type="submit" [disabled]="followupSending">
                    <i class="fas fa-paper-plane"></i>
                  </button>
                </form>
              }
            </div>
          }
        </div>

        <div class="lp-footer">Powered by <strong>CourtGo</strong></div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #0c1a11; }

    .lp-shell {
      min-height: 100vh;
      background: #0c1a11;
      display: flex;
      flex-direction: column;
      max-width: 480px;
      margin: 0 auto;
    }

    .lp-topbar {
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .lp-courtgo-logo {
      height: 30px;
      width: auto;
      display: block;
      filter: brightness(0.9);
    }

    .lp-hero {
      padding: 2.75rem 1.25rem 1.75rem;
      text-align: center;
    }
    .lp-club-logo-img {
      width: 84px; height: 84px;
      border-radius: 22px;
      object-fit: cover;
      margin-bottom: 1.1rem;
      border: 2px solid rgba(163,230,53,0.25);
    }
    .lp-club-logo-placeholder {
      width: 84px; height: 84px;
      border-radius: 22px;
      background: linear-gradient(135deg, #1f4d2e 0%, #0f2d18 100%);
      border: 2px solid rgba(163,230,53,0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.1rem;
      font-size: 1.9rem;
      color: rgba(163,230,53,0.55);
    }
    .lp-club-name {
      font-size: 1.55rem;
      font-weight: 900;
      color: #ffffff;
      margin: 0 0 0.45rem;
      line-height: 1.2;
      min-height: 1.85rem;
    }
    .lp-club-location {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.38);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
    }
    .lp-club-location i { color: #a3e635; font-size: 0.72rem; }

    .lp-social-links {
      display: flex;
      gap: 0.55rem;
      justify-content: center;
      margin-top: 0.85rem;
      flex-wrap: wrap;
    }
    .lp-social-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .lp-social-link:hover { opacity: 0.82; }
    .lp-social-fb {
      background: rgba(24,119,242,0.18);
      border: 1px solid rgba(24,119,242,0.35);
    }
    .lp-social-reclub {
      background: rgba(250,190,0,0.15);
      border: 1px solid rgba(250,190,0,0.35);
    }
    .lp-social-icon {
      width: 32px;
      height: 32px;
      object-fit: contain;
      border-radius: 6px;
    }

    .lp-body {
      padding: 0 1.25rem;
      flex: 1;
    }

    .lp-about {
      margin-bottom: 1.75rem;
      text-align: center;
    }
    .lp-about-label {
      font-size: 0.63rem;
      font-weight: 700;
      color: #a3e635;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin-bottom: 0.45rem;
    }
    .lp-about-text {
      font-size: 0.87rem;
      color: rgba(255,255,255,0.42);
      line-height: 1.65;
      margin: 0;
    }

    .lp-ctas {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .lp-cta {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.1rem;
      border-radius: 14px;
      border: 1px solid;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
      text-align: left;
    }
    .lp-cta-left {
      display: flex;
      align-items: center;
      gap: 0.95rem;
    }
    .lp-cta-icon {
      width: 46px; height: 46px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    .lp-cta-title {
      font-size: 0.97rem;
      font-weight: 800;
      margin-bottom: 0.18rem;
    }
    .lp-cta-sub {
      font-size: 0.75rem;
      font-weight: 500;
    }
    .lp-cta-arrow {
      font-size: 0.78rem;
      opacity: 0.45;
      flex-shrink: 0;
    }

    .lp-cta-member {
      background: #1b3028;
      border-color: rgba(255,255,255,0.1);
    }
    .lp-cta-member:hover { border-color: rgba(255,255,255,0.22); background: #1f3a2e; }
    .lp-cta-member .lp-cta-icon-member { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.65); }
    .lp-cta-member .lp-cta-title { color: #ffffff; }
    .lp-cta-member .lp-cta-sub { color: rgba(255,255,255,0.38); }
    .lp-cta-member .lp-cta-arrow { color: rgba(255,255,255,0.35); }

    .lp-cta-guest {
      background: rgba(163,230,53,0.09);
      border-color: rgba(163,230,53,0.32);
    }
    .lp-cta-guest:hover { background: rgba(163,230,53,0.15); border-color: rgba(163,230,53,0.5); }
    .lp-cta-guest .lp-cta-icon-guest { background: rgba(163,230,53,0.14); color: #a3e635; }
    .lp-cta-guest .lp-cta-title { color: #a3e635; }
    .lp-cta-guest .lp-cta-sub { color: rgba(163,230,53,0.52); }
    .lp-cta-guest .lp-cta-arrow { color: #a3e635; opacity: 0.6; }

    .lp-suspended {
      text-align: center;
      padding: 2rem 1rem;
      color: #ef4444;
    }
    .lp-suspended i { font-size: 2rem; margin-bottom: 0.75rem; display: block; }
    .lp-suspended p { font-size: 0.9rem; font-weight: 600; margin: 0; }

    .lp-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1.5rem;
    }
    .lp-error-icon { font-size: 2.5rem; color: #ef4444; margin-bottom: 1rem; }
    .lp-error-msg { font-size: 0.9rem; font-weight: 600; color: #ef4444; text-align: center; margin: 0; }

    .lp-contact {
      margin-top: 2rem;
      padding: 1.35rem 1.2rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
    }
    .lp-contact-header { margin-bottom: 1.1rem; }
    .lp-contact-label {
      font-size: 0.63rem;
      font-weight: 700;
      color: #a3e635;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      display: block;
      margin-bottom: 0.35rem;
    }
    .lp-contact-label i { margin-right: 0.3rem; }
    .lp-contact-sub {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.38);
      margin: 0;
      line-height: 1.5;
    }
    .lp-inq-form { display: flex; flex-direction: column; gap: 0.65rem; }
    .lp-inq-input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #ffffff;
      font-family: inherit;
      font-size: 0.88rem;
      padding: 0.7rem 0.85rem;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.18s;
    }
    .lp-inq-input::placeholder { color: rgba(255,255,255,0.28); }
    .lp-inq-input:focus { border-color: rgba(163,230,53,0.45); }
    .lp-inq-textarea { resize: none; }
    .lp-inq-error { font-size: 0.8rem; color: #f87171; margin: 0; }
    .lp-inq-btn {
      width: 100%;
      padding: 0.78rem;
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.35);
      border-radius: 10px;
      color: #a3e635;
      font-size: 0.9rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.18s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .lp-inq-btn:hover:not(:disabled) { background: rgba(163,230,53,0.2); }
    .lp-inq-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    /* Live chat thread */
    .lp-chat-thread {
      max-height: 280px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      margin-bottom: 0.85rem;
      padding-right: 2px;
    }
    .lp-chat-msg { display: flex; flex-direction: column; max-width: 82%; }
    .lp-chat-guest { align-self: flex-end; align-items: flex-end; }
    .lp-chat-admin { align-self: flex-start; align-items: flex-start; }
    .lp-chat-name {
      font-size: 0.65rem;
      font-weight: 700;
      color: rgba(255,255,255,0.32);
      margin-bottom: 0.22rem;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .lp-chat-bubble {
      padding: 0.6rem 0.85rem;
      border-radius: 14px;
      font-size: 0.87rem;
      line-height: 1.5;
      word-break: break-word;
    }
    .lp-chat-guest .lp-chat-bubble {
      background: rgba(163,230,53,0.14);
      border: 1px solid rgba(163,230,53,0.25);
      color: #e8ffc3;
      border-bottom-right-radius: 4px;
    }
    .lp-chat-admin .lp-chat-bubble {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.85);
      border-bottom-left-radius: 4px;
    }
    .lp-chat-waiting {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.28);
      text-align: center;
      padding: 1.5rem 0 0.5rem;
      margin: 0;
      font-style: italic;
    }
    .lp-chat-input-row {
      display: flex;
      gap: 0.5rem;
      border-top: 1px solid rgba(255,255,255,0.07);
      padding-top: 0.85rem;
    }
    .lp-chat-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #fff;
      font-family: inherit;
      font-size: 0.87rem;
      padding: 0.6rem 0.8rem;
      outline: none;
      transition: border-color 0.18s;
    }
    .lp-chat-input::placeholder { color: rgba(255,255,255,0.25); }
    .lp-chat-input:focus { border-color: rgba(163,230,53,0.4); }
    .lp-chat-send {
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.3);
      border-radius: 10px;
      color: #a3e635;
      font-size: 0.95rem;
      width: 40px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .lp-chat-send:hover:not(:disabled) { background: rgba(163,230,53,0.22); }
    .lp-chat-send:disabled { opacity: 0.45; cursor: not-allowed; }

    .lp-footer {
      padding: 2rem 1.25rem 1.5rem;
      text-align: center;
      font-size: 0.73rem;
      color: rgba(255,255,255,0.16);
      margin-top: auto;
    }
    .lp-footer strong { color: rgba(255,255,255,0.26); }
  `],
})
export class GuestBookComponent implements OnInit, OnDestroy {
  readonly VINEYARD_ID = '6a032212a6b7ae3acacad633';
  clubId = '';
  clubName = '';
  clubLocation = '';
  clubLogo: string | null = null;
  clubError = '';
  clubSuspended = false;
  isVineyard = false;

  // Chat state
  inquiry = { senderName: '', senderEmail: '', message: '' };
  inquirySubmitting = false;
  inquiryError = '';
  chatOpen = false;
  chatInquiryId = '';
  chatMessages: { sender: 'guest' | 'admin'; name: string; body: string; createdAt: string }[] = [];
  followupText = '';
  followupSending = false;
  private pollTimer: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicBookingService: PublicBookingService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');

    this.clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
    this.isVineyard = this.clubId === this.VINEYARD_ID;
    if (!this.clubId) {
      this.clubError = 'Invalid booking link.';
      return;
    }

    this.publicBookingService.getClub(this.clubId).subscribe({
      next: (club) => {
        this.clubName = club.name;
        this.clubLocation = club.location ?? '';
        this.clubLogo = club.logo ?? null;
        if (club.status === 'suspended') this.clubSuspended = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.clubError = 'Club not found. Please check your booking link.';
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
    this.stopPolling();
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToReserve() {
    this.router.navigate(['/book', this.clubId, 'reserve']);
  }

  submitInquiry() {
    const { senderName, senderEmail, message } = this.inquiry;
    if (!senderName.trim() || !senderEmail.trim() || !message.trim()) {
      this.inquiryError = 'Please fill in all fields.';
      this.cdr.detectChanges();
      return;
    }
    this.inquirySubmitting = true;
    this.inquiryError = '';
    this.cdr.detectChanges();

    this.publicBookingService
      .submitInquiry(this.clubId, { senderName: senderName.trim(), senderEmail: senderEmail.trim(), message: message.trim() })
      .subscribe({
        next: (inq: any) => {
          this.chatInquiryId = inq._id;
          this.chatMessages = inq.messages ?? [];
          this.chatOpen = true;
          this.inquirySubmitting = false;
          this.cdr.detectChanges();
          this.startPolling();
        },
        error: () => {
          this.inquiryError = 'Failed to send message. Please try again.';
          this.inquirySubmitting = false;
          this.cdr.detectChanges();
        },
      });
  }

  sendFollowup() {
    const text = this.followupText.trim();
    if (!text || this.followupSending) return;
    this.followupSending = true;
    this.cdr.detectChanges();

    this.publicBookingService.sendFollowup(this.clubId, this.chatInquiryId, text).subscribe({
      next: (inq: any) => {
        this.chatMessages = inq.messages ?? [];
        this.followupText = '';
        this.followupSending = false;
        this.cdr.detectChanges();
      },
      error: () => { this.followupSending = false; this.cdr.detectChanges(); },
    });
  }

  private startPolling() {
    this.pollTimer = setInterval(() => {
      this.publicBookingService.pollInquiry(this.clubId, this.chatInquiryId).subscribe({
        next: (inq: any) => {
          this.chatMessages = inq.messages ?? [];
          this.cdr.detectChanges();
        },
        error: () => {},
      });
    }, 4000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
