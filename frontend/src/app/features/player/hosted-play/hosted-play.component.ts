import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HostedPlayService, HostedPlaySession, HostedPlayParticipant, HostedPlayJoinPayload, SkillLevel } from '../../../core/services/hosted-play.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Court } from '../../../core/services/club.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { CreditService } from '../../../core/services/credit.service';

@Component({
  selector: 'app-player-hosted-play',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, FormsModule],
  template: `
    <div class="hp-shell">
      <header class="hp-topbar">
        <button class="back-btn" (click)="goBack()" aria-label="Back to dashboard">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="header-title">Hosted Play</span>
        <span class="topbar-spacer"></span>
      </header>

      @if (loading) {
        <div class="state-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading sessions...</div>
      } @else if (sessions.length === 0) {
        <section class="hp-hero hp-hero--empty">
          <div class="hero-copy">
            <span class="eyebrow"><i class="fas fa-calendar-days"></i> Member events</span>
            <h1>Hosted Play</h1>
            <p>Join club-organized sessions, see who is playing, and manage your spot from one clean view.</p>
          </div>
        </section>

        <div class="empty-card">
          <div class="empty-icon"><i class="fas fa-calendar-xmark"></i></div>
          <h2>No sessions yet</h2>
          <p>There are no hosted play sessions available right now. Check back soon.</p>
        </div>
      } @else {
        <section class="hp-hero">
          <div class="hero-copy">
            <span class="eyebrow"><i class="fas fa-calendar-days"></i> Member events</span>
            <h1>Hosted Play</h1>
            <p>Reserve your spot in club-hosted tennis and pickleball sessions.</p>
          </div>
          <div class="hero-stats" aria-label="Hosted play summary">
            <div class="stat">
              <span class="stat-value">{{ sessions.length }}</span>
              <span class="stat-label">Sessions</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ joinedCount() }}</span>
              <span class="stat-label">My sessions</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ openSpotsTotal() }}</span>
              <span class="stat-label">Open spots</span>
            </div>
          </div>
        </section>

        <div class="level-bar">
          <span class="level-bar-label"><i class="fas fa-signal"></i> Your skill level</span>
          <div class="level-choices">
            @for (lvl of skillLevels; track lvl) {
              <button class="level-chip" [class.active]="myLevel === lvl" [disabled]="savingLevel" (click)="setMyLevel(lvl)">{{ levelLabel(lvl) }}</button>
            }
            <button class="level-chip level-chip--none" [class.active]="!myLevel" [disabled]="savingLevel" (click)="setMyLevel(null)">Not set</button>
          </div>
          <span class="level-bar-label dupr-label"><i class="fas fa-table-tennis-paddle-ball"></i> DUPR rating</span>
          <div class="dupr-input-row">
            <input type="number" class="dupr-input" min="2.0" max="8.0" step="0.001"
                   [(ngModel)]="myDuprRating" [disabled]="savingDupr" placeholder="e.g. 3.500" />
            <button type="button" class="dupr-save-btn" (click)="saveMyDupr()" [disabled]="savingDupr">
              @if (savingDupr) { <i class="fas fa-circle-notch fa-spin"></i> } Save
            </button>
            @if (duprSaveMsg) { <span class="dupr-save-msg">{{ duprSaveMsg }}</span> }
          </div>
        </div>

        <main class="session-grid">
          @for (s of sessions; track s._id) {
            <article class="session-card" [class.session-card--joined]="s.joined">
              @if (levelBand(s)) {
                <div class="level-band-badge"><i class="fas fa-signal"></i> {{ levelBand(s) }} level</div>
              }
              <div class="card-head">
                <div class="club-mark">
                  @if (venueLogo(s)) {
                    <img [src]="venueLogo(s)" [alt]="venueLabel(s)" class="club-mark-img" />
                  } @else {
                    <span class="club-mark-initials">{{ venueInitials(s) }}</span>
                  }
                </div>
                <div class="title-block">
                  <span class="sport-label">{{ s.sport | titlecase }}</span>
                  <h2>{{ s.title }}</h2>
                </div>
                <span class="status-pill" [class.full]="s.status === 'full'" [class.joined]="s.joined || s.offered" [class.pending]="s.pendingApproval || s.waitlisted">
                  {{ s.joined ? 'Joined' : s.offered ? 'Spot open!' : s.pendingApproval ? 'Pending' : s.waitlisted ? 'Waitlisted' : statusLabel(s) }}
                </span>
              </div>

              <div class="detail-grid">
                <div class="detail-item">
                  <i class="fas fa-calendar-day"></i>
                  <span>{{ s.date | date: 'EEE, MMM d, y' : 'UTC' }}</span>
                </div>
                <div class="detail-item">
                  <i class="fas fa-clock"></i>
                  <span>{{ s.startTime }} - {{ s.endTime }}</span>
                </div>
                <div class="detail-item">
                  <i class="fas fa-location-dot"></i>
                  <span>{{ s.venue }}{{ s.court ? ' - ' + s.court : '' }}</span>
                </div>
                <div class="detail-item">
                  <i class="fas fa-coins"></i>
                  @if (s.estimatedFee) {
                    <span>≈ {{ (s.totalPerPlayer ?? s.feePerPlayer) | currency: 'PHP' : 'symbol-narrow' }} / player (est.)</span>
                  } @else {
                    <span>{{ (s.totalPerPlayer ?? s.feePerPlayer) | currency: 'PHP' : 'symbol-narrow' }} / player</span>
                  }
                </div>
              </div>

              <div class="capacity">
                <div class="capacity-line">
                  <span><i class="fas fa-users"></i> {{ s.currentPlayers }}/{{ s.maxPlayers }} players</span>
                  <strong>{{ spotsLeft(s) }} {{ spotsLeft(s) === 1 ? 'spot' : 'spots' }} left</strong>
                </div>
                <div class="slots-bar" aria-hidden="true">
                  <div class="slots-fill" [class.warning]="isNearlyFull(s)" [style.width.%]="fillPct(s)"></div>
                </div>
              </div>

              @if (s.description) { <p class="card-desc">{{ s.description }}</p> }

              <button class="players-toggle" (click)="togglePlayers(s)" [attr.aria-expanded]="expandedId === s._id">
                <i class="fas" [class.fa-chevron-down]="expandedId !== s._id" [class.fa-chevron-up]="expandedId === s._id"></i>
                {{ expandedId === s._id ? 'Hide players' : 'View players' }}
              </button>

              @if (expandedId === s._id) {
                <div class="players-panel">
                  @if (playersLoading) {
                    <div class="players-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading players...</div>
                  } @else if (players.length === 0) {
                    <p class="players-empty">No one has joined yet. Be the first!</p>
                  } @else {
                    @for (p of players; track p._id; let i = $index) {
                      <div class="player-row">
                        <span class="player-num">{{ i + 1 }}</span>
                        <span class="player-name">{{ p.memberName || 'Member' }}@if (p.isMe) { <span class="player-you">You</span> }</span>
                      </div>
                    }
                  }
                </div>
              }

              @if (errorMap[s._id]) {
                <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ errorMap[s._id] }}</div>
              }

              <div class="action-area">
                @if (s.joined) {
                  <div class="joined-note"><i class="fas fa-circle-check"></i> You're in for this session.</div>
                  @if (s.queueStatus === 'running') {
                    <button class="btn-live" (click)="openLiveBoard(s)">
                      <i class="fas fa-signal"></i> View Live Board
                    </button>
                  }
                  <button class="btn-cancel" [disabled]="busyId === s._id" (click)="cancel(s)">
                    {{ busyId === s._id ? 'Cancelling...' : 'Cancel my spot' }}
                  </button>
                } @else if (s.pendingApproval) {
                  <div class="pending-note"><i class="fas fa-clock"></i> Your spot is held — awaiting admin approval of your payment.</div>
                  <button class="btn-cancel" [disabled]="busyId === s._id" (click)="cancel(s)">
                    {{ busyId === s._id ? 'Cancelling...' : 'Cancel my reservation' }}
                  </button>
                } @else if (s.offered) {
                  <div class="joined-note"><i class="fas fa-star"></i> A spot opened up — it's yours to claim!</div>
                  <button class="btn-join" [disabled]="busyId === s._id" (click)="claim(s)">
                    {{ busyId === s._id ? 'Opening...' : 'Claim my spot' }}
                  </button>
                  <button class="btn-cancel" [disabled]="busyId === s._id" (click)="cancel(s)">Give up spot</button>
                } @else if (s.waitlisted) {
                  <div class="pending-note"><i class="fas fa-hourglass-half"></i> On the waitlist@if (s.waitlistPosition) { — position {{ s.waitlistPosition }}}. We'll notify you if a spot opens.</div>
                  <button class="btn-cancel" [disabled]="busyId === s._id" (click)="cancel(s)">
                    {{ busyId === s._id ? 'Leaving...' : 'Leave waitlist' }}
                  </button>
                } @else if (s.status === 'full') {
                  <button class="btn-join" [disabled]="busyId === s._id" (click)="join(s)">
                    {{ busyId === s._id ? 'Joining...' : 'Join waitlist' }}
                  </button>
                } @else {
                  <button class="btn-join" [disabled]="busyId === s._id" (click)="join(s)">
                    {{ busyId === s._id ? 'Joining...' : 'Join session' }}
                  </button>
                }
              </div>

              @if (s.feeSplitMode === 'split_total' && !s.joined && !s.pendingApproval && !s.waitlisted) {
                <p class="fee-note"><i class="fas fa-circle-info"></i>
                  Joining is free. This session's {{ (s.sessionFee || 0) | currency: 'PHP' : 'symbol-narrow' }} total fee is split evenly among everyone still joined once the session ends — your estimated share is ≈ {{ (s.totalPerPlayer ?? s.feePerPlayer) | currency: 'PHP' : 'symbol-narrow' }}, billed to Payments afterward.
                </p>
              } @else if (s.feePerPlayer > 0 && !s.joined && !s.pendingApproval && !s.waitlisted) {
                <p class="fee-note"><i class="fas fa-circle-info"></i>
                  @if (creditBalance >= (s.totalPerPlayer ?? s.feePerPlayer)) {
                    You have enough account credit to join this session for free.
                  } @else if (creditBalance > 0) {
                    You have {{ creditBalance | currency: 'PHP' : 'symbol-narrow' }} credit available toward this session's {{ (s.totalPerPlayer ?? s.feePerPlayer) | currency: 'PHP' : 'symbol-narrow' }} fee.
                  } @else {
                    {{ s.feePerPlayer | currency: 'PHP' : 'symbol-narrow' }} player fee@if ((s.convenienceFeePerPlayer ?? 0) > 0) { + {{ s.convenienceFeePerPlayer | currency: 'PHP' : 'symbol-narrow' }} service fee} = {{ (s.totalPerPlayer ?? s.feePerPlayer) | currency: 'PHP' : 'symbol-narrow' }} total, billed to Payments after you join.
                  }
                </p>
              }
            </article>
          }
        </main>
      }

      @if (showPaymentModal && pendingSession) {
        <div class="pm-backdrop" (click)="closePaymentModal()">
          <div class="pm-modal" (click)="$event.stopPropagation()">

            <div class="pm-header">
              <span class="pm-title"><i class="fas fa-credit-card"></i> {{ claimMode ? 'Claim Your Spot' : 'Complete Payment' }}</span>
              <button class="pm-close" (click)="closePaymentModal()" [disabled]="submittingPayment">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <div class="pm-body">
              <div class="pm-session-box">
                <div class="pm-session-name">{{ pendingSession.title }}</div>
                <div class="pm-fee-row">
                  <span>Session fee</span>
                  <span>{{ (pendingSession.convenienceFeeMode === 'club_absorbs'
                    ? (pendingSession.feePerPlayer - (pendingSession.convenienceFeePerPlayer ?? 0))
                    : pendingSession.feePerPlayer) | currency:'PHP':'symbol-narrow' }}</span>
                </div>
                <div class="pm-fee-row pm-fee-sub">
                  <span>Convenience fee @if (pendingSession.convenienceFeeMode === 'club_absorbs') { <span class="pm-fee-absorbed">(Club absorbs)</span> }</span>
                  <span>{{ (pendingSession.convenienceFeePerPlayer ?? 0) | currency:'PHP':'symbol-narrow' }}</span>
                </div>
                @if (useCredit && creditBalance > 0) {
                  <div class="pm-fee-row pm-fee-sub pm-fee-credit">
                    <span>Credit applied</span>
                    <span>-{{ creditForSession(pendingSession) | currency:'PHP':'symbol-narrow' }}</span>
                  </div>
                }
                <div class="pm-fee-row pm-fee-total">
                  <span>{{ useCredit && creditBalance > 0 ? 'Remaining due' : 'Total due' }}</span>
                  <span>{{ remainingAfterCredit(pendingSession) | currency:'PHP':'symbol-narrow' }}</span>
                </div>
              </div>

              @if (creditBalance > 0) {
                <label class="pm-credit-toggle">
                  <input type="checkbox" [checked]="useCredit" (change)="toggleUseCredit()" />
                  <span>Use my {{ creditBalance | currency:'PHP':'symbol-narrow' }} account credit</span>
                </label>
              }

              @if (remainingAfterCredit(pendingSession) <= 0) {
                <div class="pm-credit-only-note">
                  <i class="fas fa-circle-check"></i>
                  Fully covered by your account credit — no payment needed.
                </div>
              } @else {
                <div class="pm-section-label">Select Payment Method</div>
                <div class="pm-methods">
                  @for (method of clubPaymentMethods; track method) {
                    <button class="pm-method-btn" [class.active]="paymentMethod === method"
                      (click)="setPaymentMethod(method)">{{ method }}</button>
                  }
                </div>

                @if (clubPaymentQrCodes[paymentMethod] || clubPaymentAccounts[paymentMethod]) {
                  <div class="pm-pay-details">
                    @if (clubPaymentQrCodes[paymentMethod]) {
                      <img [src]="clubPaymentQrCodes[paymentMethod]" alt="QR Code" class="pm-qr" />
                    }
                    @if (clubPaymentAccounts[paymentMethod]) {
                      <div class="pm-account">
                        <span class="pm-account-label">{{ paymentMethod }}</span>
                        <span class="pm-account-value">{{ clubPaymentAccounts[paymentMethod] }}</span>
                      </div>
                    }
                  </div>
                }

                <div class="pm-section-label">Proof of Payment <span class="pm-required">Required</span></div>
                @if (screenshotPreviewUrl) {
                  <div class="pm-preview">
                    <img [src]="screenshotPreviewUrl" alt="Payment screenshot" class="pm-preview-img" />
                    @if (uploadingScreenshot) {
                      <div class="pm-uploading-overlay"><i class="fas fa-circle-notch fa-spin"></i></div>
                    } @else {
                      <button class="pm-preview-remove" type="button"
                        (click)="clearScreenshot()">
                        <i class="fas fa-times"></i>
                      </button>
                    }
                  </div>
                } @else {
                  <label class="pm-upload-btn" [class.uploading]="uploadingScreenshot">
                    <i class="fas fa-camera"></i>
                    <span>{{ uploadingScreenshot ? 'Uploading…' : 'Tap to attach screenshot' }}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none"
                      [disabled]="uploadingScreenshot" (change)="onScreenshotSelected($event)" />
                  </label>
                }

                <div class="pm-disclaimer">
                  <i class="fas fa-circle-info"></i>
                  Your spot will be held as soon as you submit. You'll be fully confirmed once the club admin approves your payment.
                </div>
              }

              @if (paymentError) {
                <div class="pm-error"><i class="fas fa-exclamation-triangle"></i> {{ paymentError }}</div>
              }

              <div class="pm-footer">
                <button class="pm-cancel" (click)="closePaymentModal()" [disabled]="submittingPayment">Cancel</button>
                <button class="pm-submit"
                  [disabled]="(remainingAfterCredit(pendingSession) > 0 && !paymentScreenshotUrl) || uploadingScreenshot || submittingPayment"
                  (click)="submitJoinWithPayment()">
                  @if (submittingPayment) {
                    <i class="fas fa-circle-notch fa-spin"></i> {{ claimMode ? 'Claiming…' : 'Joining…' }}
                  } @else if (remainingAfterCredit(pendingSession) <= 0) {
                    {{ claimMode ? 'Claim with Credit' : 'Join with Credit' }}
                  } @else {
                    {{ claimMode ? 'Claim & Submit Payment' : 'Join & Submit Payment' }}
                  }
                </button>
              </div>
            </div>

          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --bg: #07130d;
      --surface: #12251d;
      --border: rgba(255,255,255,0.1);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.62);
      --accent: #a3e635;
      --accent-2: #14b8a6;
      --shadow: 0 18px 50px rgba(0,0,0,.34);
    }

    .hp-shell {
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.16), transparent 30rem),
        linear-gradient(180deg, #0b1b12 0%, var(--bg) 36rem);
      padding: 0 1rem 2rem;
    }

    .hp-topbar {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: max(1rem, env(safe-area-inset-top)) 0 1rem;
    }

    .topbar-spacer { width: 42px; height: 42px; }
    .header-title { font-weight: 700; color: var(--text); font-size: 1rem; }

    .back-btn {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.1);
      color: var(--text);
      cursor: pointer;
      font-size: 1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background .16s, border-color .16s, transform .16s;
    }

    .back-btn:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.18); }
    .back-btn:active { transform: translateY(1px); }

    .state-loading {
      min-height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .6rem;
      color: var(--muted);
      font-weight: 700;
    }

    .hp-hero {
      max-width: 1120px;
      margin: 0 auto 1.25rem;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: end;
      padding: 1.5rem;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgba(25,53,42,.94), rgba(9,27,17,.94)),
        url('/tennis-court-surface.png') center / cover;
      box-shadow: var(--shadow);
      overflow: hidden;
      position: relative;
    }

    .hp-hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7,19,13,.22), rgba(7,19,13,.68));
      pointer-events: none;
    }

    .hp-hero > * { position: relative; z-index: 1; }
    .hp-hero--empty { max-width: 760px; grid-template-columns: 1fr; margin-top: .25rem; }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      margin-bottom: .7rem;
      color: var(--accent);
      font-size: .76rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .hero-copy h1 {
      margin: 0;
      color: var(--text);
      font-size: clamp(2rem, 5vw, 3.5rem);
      line-height: 1;
      letter-spacing: 0;
    }

    .hero-copy p {
      max-width: 620px;
      margin: .75rem 0 0;
      color: rgba(255,255,255,.74);
      line-height: 1.55;
      font-size: .98rem;
    }

    .hero-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(88px, 1fr));
      gap: .65rem;
      min-width: 330px;
    }

    .stat {
      min-height: 86px;
      padding: .9rem;
      border-radius: 8px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .stat-value { color: var(--text); font-size: 1.6rem; font-weight: 900; line-height: 1; }
    .stat-label { color: rgba(255,255,255,.62); font-size: .75rem; font-weight: 700; margin-top: .35rem; }

    .empty-card {
      max-width: 520px;
      margin: 1.25rem auto 0;
      text-align: center;
      padding: 2rem 1.5rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(18,37,29,.82);
      box-shadow: var(--shadow);
    }

    .empty-icon {
      width: 76px;
      height: 76px;
      margin: 0 auto 1.1rem;
      border-radius: 50%;
      background: rgba(255,255,255,.06);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      color: var(--accent);
    }

    .empty-card h2 { color: var(--text); font-size: 1.35rem; margin: 0 0 .45rem; }
    .empty-card p { color: var(--muted); font-size: .92rem; line-height: 1.5; margin: 0; }

    .session-grid {
      max-width: 1120px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .level-bar { display: flex; align-items: center; flex-wrap: wrap; gap: .6rem .9rem; margin-bottom: 1rem; padding: .7rem .9rem; background: rgba(18,37,29,.7); border: 1px solid var(--border); border-radius: 8px; }
    .level-bar-label { font-size: .8rem; font-weight: 800; color: var(--muted); display: inline-flex; align-items: center; gap: .4rem; }
    .level-bar-label i { color: var(--accent); }
    .level-choices { display: flex; flex-wrap: wrap; gap: .4rem; }
    .level-chip { min-height: 32px; padding: .35rem .7rem; border-radius: 999px; border: 1px solid var(--border); background: rgba(255,255,255,.05); color: var(--text); font-size: .76rem; font-weight: 800; font-family: inherit; cursor: pointer; transition: background .12s, border-color .12s; }
    .level-chip:hover:not(:disabled) { background: rgba(255,255,255,.1); }
    .level-chip.active { background: var(--accent); color: #07130d; border-color: var(--accent); }
    .level-chip--none.active { background: rgba(255,255,255,.16); color: var(--text); }
    .level-chip:disabled { opacity: .55; cursor: default; }
    .dupr-label { margin-left: .4rem; }
    .dupr-input-row { display: flex; align-items: center; gap: .5rem; }
    .dupr-input { width: 90px; padding: .35rem .55rem; border-radius: 6px; border: 1px solid var(--border); background: rgba(255,255,255,.05); color: var(--text); font-size: .8rem; font-weight: 700; font-family: inherit; }
    .dupr-save-btn { min-height: 32px; padding: .35rem .8rem; border-radius: 999px; border: 1px solid var(--border); background: var(--accent); color: #07130d; font-size: .76rem; font-weight: 800; cursor: pointer; }
    .dupr-save-btn:disabled { opacity: .55; cursor: default; }
    .dupr-save-msg { font-size: .74rem; color: var(--muted); }
    .level-band-badge { display: inline-flex; align-items: center; gap: .35rem; align-self: flex-start; margin-bottom: .55rem; padding: .2rem .55rem; border-radius: 999px; font-size: .68rem; font-weight: 900; letter-spacing: .02em; color: #c4b5fd; background: rgba(139,92,246,.14); border: 1px solid rgba(139,92,246,.32); }
    .level-band-badge i { font-size: .6rem; }

    .session-card {
      background: rgba(18,37,29,.92);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 12px 32px rgba(0,0,0,.22);
      transition: border-color .16s, transform .16s, background .16s;
    }

    .session-card:hover { border-color: rgba(163,230,53,.32); background: rgba(21,45,35,.96); }
    .session-card--joined { border-color: rgba(163,230,53,.34); }

    .card-head {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) auto;
      gap: .75rem;
      align-items: center;
      margin-bottom: 1rem;
    }

    .club-mark {
      width: 46px;
      height: 46px;
      border-radius: 8px;
      background: rgba(163,230,53,.14);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      overflow: hidden;
      flex-shrink: 0;
    }

    .club-mark-img { width: 100%; height: 100%; object-fit: cover; }
    .club-mark-initials { font-size: .78rem; font-weight: 900; letter-spacing: 0; }
    .title-block { min-width: 0; }

    .sport-label {
      display: block;
      color: var(--muted);
      font-size: .72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
      margin-bottom: .18rem;
    }

    .title-block h2 {
      margin: 0;
      color: var(--text);
      font-size: 1.08rem;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .status-pill {
      align-self: start;
      white-space: nowrap;
      font-size: .72rem;
      font-weight: 900;
      color: var(--accent);
      background: rgba(163,230,53,.14);
      border: 1px solid rgba(163,230,53,.18);
      border-radius: 999px;
      padding: .32rem .72rem;
    }

    .status-pill.full { color: #fca5a5; background: rgba(239,68,68,.13); border-color: rgba(239,68,68,.2); }
    .status-pill.joined { color: #07130d; background: var(--accent); border-color: var(--accent); }
    .status-pill.pending { color: #fbbf24; background: rgba(251,191,36,.13); border-color: rgba(251,191,36,.3); }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; margin-bottom: 1rem; }

    .detail-item {
      min-width: 0;
      display: flex;
      align-items: flex-start;
      gap: .5rem;
      color: var(--muted);
      font-size: .84rem;
      line-height: 1.35;
    }

    .detail-item i {
      width: 16px;
      margin-top: .12rem;
      color: var(--accent);
      text-align: center;
      flex: 0 0 16px;
      font-size: .82rem;
    }

    .detail-item span { min-width: 0; overflow-wrap: anywhere; }
    .capacity { margin-bottom: .9rem; }

    .capacity-line {
      display: flex;
      justify-content: space-between;
      gap: .75rem;
      margin-bottom: .5rem;
      color: var(--muted);
      font-size: .8rem;
      font-weight: 800;
    }

    .capacity-line span { display: inline-flex; align-items: center; gap: .4rem; }
    .capacity-line i { color: var(--accent); }
    .capacity-line strong { color: var(--text); white-space: nowrap; }

    .slots-bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
    .slots-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); border-radius: 999px; transition: width .25s; }
    .slots-fill.warning { background: linear-gradient(90deg, #f59e0b, #f87171); }
    .card-desc { margin: -.15rem 0 .8rem; font-size: .85rem; color: var(--muted); line-height: 1.5; }

    .players-toggle {
      width: 100%;
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      padding: .55rem .75rem;
      margin-bottom: .75rem;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      color: var(--accent);
      font-size: .83rem;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      transition: background .16s, border-color .16s;
    }

    .players-toggle:hover { background: rgba(163,230,53,.08); border-color: rgba(163,230,53,.2); }
    .players-toggle i { font-size: .7rem; }

    .players-panel {
      background: rgba(255,255,255,.04);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: .75rem;
      margin-bottom: .75rem;
      display: flex;
      flex-direction: column;
      gap: .45rem;
    }

    .players-loading { display: flex; align-items: center; gap: .5rem; color: var(--muted); font-size: .82rem; padding: .25rem 0; }
    .players-empty { margin: 0; color: var(--muted); font-size: .82rem; }
    .player-row { display: flex; align-items: center; gap: .6rem; }
    .player-num { width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; background: rgba(163,230,53,.14); color: var(--accent); font-size: .72rem; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .player-name { color: var(--text); font-size: .86rem; font-weight: 600; display: inline-flex; align-items: center; gap: .4rem; }
    .player-you { font-size: .64rem; font-weight: 700; color: var(--accent); background: rgba(163,230,53,.14); border-radius: 99px; padding: .1rem .4rem; }

    .alert {
      padding: .65rem .8rem;
      border-radius: 8px;
      font-size: .82rem;
      background: rgba(239,68,68,.1);
      border: 1px solid rgba(239,68,68,.25);
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: .45rem;
      margin-bottom: .75rem;
    }

    .action-area { display: grid; gap: .65rem; }

    .joined-note {
      display: flex;
      align-items: center;
      gap: .45rem;
      padding: .65rem .75rem;
      border-radius: 8px;
      background: rgba(163,230,53,.1);
      border: 1px solid rgba(163,230,53,.18);
      color: var(--accent);
      font-size: .83rem;
      font-weight: 800;
    }

    .pending-note {
      display: flex;
      align-items: center;
      gap: .45rem;
      padding: .65rem .75rem;
      border-radius: 8px;
      background: rgba(251,191,36,.08);
      border: 1px solid rgba(251,191,36,.25);
      color: #fbbf24;
      font-size: .83rem;
      font-weight: 600;
    }

    .btn-join,
    .btn-cancel,
    .btn-live {
      width: 100%;
      min-height: 46px;
      padding: .85rem;
      border: none;
      border-radius: 8px;
      font-weight: 900;
      font-size: .94rem;
      font-family: inherit;
      cursor: pointer;
      transition: opacity .15s, transform .15s, background .15s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
    }

    .btn-join { background: var(--accent); color: #07130d; box-shadow: 0 10px 22px rgba(163,230,53,.18); }
    .btn-cancel { background: rgba(255,255,255,.08); color: var(--text); border: 1px solid var(--border); }
    .btn-live { background: rgba(56,189,248,.12); color: #38bdf8; border: 1px solid rgba(56,189,248,.3); }
    .btn-live:hover { background: rgba(56,189,248,.2); border-color: rgba(56,189,248,.45); transform: translateY(-1px); }
    .btn-join:hover:not(:disabled), .btn-cancel:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
    .btn-join:disabled { opacity: .45; cursor: not-allowed; }
    .btn-cancel:disabled { opacity: .5; cursor: not-allowed; }

    .fee-note {
      margin: .7rem 0 0;
      font-size: .76rem;
      color: var(--muted);
      line-height: 1.45;
      display: flex;
      align-items: flex-start;
      gap: .4rem;
    }

    .fee-note i { color: var(--accent); margin-top: .12rem; }

    @media (max-width: 760px) {
      .hp-shell { padding-inline: .9rem; }
      .hp-hero { grid-template-columns: 1fr; padding: 1.1rem; }
      .hero-stats { min-width: 0; width: 100%; grid-template-columns: repeat(3, 1fr); }
      .stat { min-height: 74px; padding: .75rem; }
      .stat-value { font-size: 1.35rem; }
      .session-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 440px) {
      .hp-shell { padding-inline: .75rem; }
      .hp-topbar { padding-bottom: .85rem; }
      .hp-hero { margin-bottom: .85rem; }
      .hero-copy h1 { font-size: 2rem; }
      .hero-copy p { font-size: .9rem; }
      .hero-stats { gap: .45rem; }
      .stat { min-height: 68px; padding: .6rem; }
      .stat-label { font-size: .68rem; }
      .session-card { padding: .9rem; }
      .card-head { grid-template-columns: 42px minmax(0, 1fr); }
      .club-mark { width: 42px; height: 42px; }
      .status-pill { grid-column: 1 / -1; justify-self: start; }
      .detail-grid { grid-template-columns: 1fr; gap: .55rem; }
      .capacity-line { align-items: flex-start; flex-direction: column; gap: .25rem; }
    }

    .pm-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.65); z-index:1000; display:flex; align-items:flex-end; justify-content:center; }
    @media (min-width:600px) { .pm-backdrop { align-items:center; } }
    .pm-modal { background:#1b3028; border-radius:20px 20px 0 0; width:100%; max-width:480px; max-height:85vh; overflow-y:auto; animation:pmSlideUp .22s ease-out; }
    @media (min-width:600px) { .pm-modal { border-radius:16px; } }
    @keyframes pmSlideUp { from { transform:translateY(24px); opacity:0; } to { transform:translateY(0); opacity:1; } }
    .pm-header { display:flex; align-items:center; justify-content:space-between; padding:1.1rem 1.25rem .9rem; border-bottom:1px solid rgba(255,255,255,.07); }
    .pm-title { font-size:.95rem; font-weight:700; color:#fff; display:flex; align-items:center; gap:.5rem; }
    .pm-close { background:rgba(255,255,255,.08); border:none; color:rgba(255,255,255,.5); width:30px; height:30px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .pm-close:disabled { opacity:.4; cursor:not-allowed; }
    .pm-body { padding:1.25rem; display:flex; flex-direction:column; gap:1rem; }
    .pm-session-box { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:.85rem 1rem; }
    .pm-session-name { font-weight:700; color:#fff; font-size:.9rem; margin-bottom:.55rem; }
    .pm-fee-row { display:flex; justify-content:space-between; color:rgba(255,255,255,.62); font-size:.83rem; padding:.2rem 0; }
    .pm-fee-sub { font-size:.78rem; }
    .pm-fee-absorbed { font-size:.72rem; color:rgba(255,255,255,.45); font-style:italic; margin-left:.25rem; }
    .pm-fee-total { color:#fff; font-weight:700; font-size:.9rem; border-top:1px solid rgba(255,255,255,.08); margin-top:.35rem; padding-top:.45rem; }
    .pm-fee-credit { color:#a3e635; }
    .pm-credit-toggle { display:flex; align-items:center; gap:.55rem; padding:.7rem .85rem; border-radius:10px; background:rgba(163,230,53,.08); border:1px solid rgba(163,230,53,.25); color:#a3e635; font-size:.85rem; font-weight:600; cursor:pointer; }
    .pm-credit-toggle input { width:17px; height:17px; accent-color:#a3e635; cursor:pointer; }
    .pm-credit-only-note { display:flex; align-items:center; gap:.5rem; padding:.7rem .85rem; border-radius:10px; background:rgba(163,230,53,.08); border:1px solid rgba(163,230,53,.25); color:#a3e635; font-size:.83rem; font-weight:600; }
    .pm-section-label { font-size:.78rem; font-weight:800; color:rgba(255,255,255,.55); text-transform:uppercase; letter-spacing:.06em; }
    .pm-required { color:#f87171; font-size:.72rem; font-weight:700; margin-left:.35rem; }
    .pm-methods { display:flex; gap:.5rem; flex-wrap:wrap; }
    .pm-method-btn { flex:1 1 0; min-width:80px; padding:.65rem .5rem; border:1px solid rgba(255,255,255,.12); border-radius:8px; background:rgba(255,255,255,.05); color:rgba(255,255,255,.7); font-size:.82rem; font-weight:700; font-family:inherit; cursor:pointer; transition:border-color .15s,background .15s; }
    .pm-method-btn.active { border-color:var(--accent); background:rgba(163,230,53,.1); color:var(--accent); }
    .pm-upload-btn { display:flex; flex-direction:column; align-items:center; gap:.55rem; padding:1.25rem; border:2px dashed rgba(255,255,255,.15); border-radius:10px; background:rgba(255,255,255,.03); color:rgba(255,255,255,.55); font-size:.86rem; font-weight:700; cursor:pointer; transition:border-color .15s,background .15s; }
    .pm-upload-btn i { font-size:1.35rem; color:var(--accent); }
    .pm-upload-btn.uploading { opacity:.6; cursor:not-allowed; }
    .pm-upload-btn:hover:not(.uploading) { border-color:rgba(163,230,53,.35); background:rgba(163,230,53,.04); }
    .pm-preview { position:relative; border-radius:10px; overflow:hidden; max-height:180px; }
    .pm-preview-img { width:100%; max-height:180px; object-fit:cover; display:block; }
    .pm-preview-remove { position:absolute; top:.5rem; right:.5rem; background:rgba(0,0,0,.65); color:#fff; border:none; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
    .pm-uploading-overlay { position:absolute; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.5rem; }
    .pm-error { padding:.6rem .85rem; border-radius:8px; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.25); color:#fca5a5; font-size:.82rem; display:flex; align-items:center; gap:.4rem; }
    .pm-disclaimer { padding:.6rem .85rem; border-radius:8px; background:rgba(251,191,36,.07); border:1px solid rgba(251,191,36,.2); color:#fbbf24; font-size:.78rem; display:flex; align-items:flex-start; gap:.4rem; line-height:1.45; }
    .pm-disclaimer i { margin-top:.12rem; flex-shrink:0; }
    .pm-footer { display:flex; gap:.65rem; }
    .pm-cancel { flex:0 0 auto; padding:.8rem 1.1rem; border:1px solid rgba(255,255,255,.12); border-radius:8px; background:rgba(255,255,255,.06); color:rgba(255,255,255,.7); font-weight:700; font-family:inherit; cursor:pointer; }
    .pm-cancel:disabled { opacity:.4; cursor:not-allowed; }
    .pm-submit { flex:1; min-height:46px; border:none; border-radius:8px; background:var(--accent); color:#07130d; font-weight:900; font-size:.94rem; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:.45rem; transition:opacity .15s; }
    .pm-submit:disabled { opacity:.4; cursor:not-allowed; }
    .pm-pay-details { display:flex; flex-direction:column; align-items:center; gap:.75rem; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:1rem; }
    .pm-qr { width:160px; height:160px; object-fit:contain; border-radius:8px; background:#fff; padding:6px; }
    .pm-account { display:flex; flex-direction:column; align-items:center; gap:.2rem; }
    .pm-account-label { font-size:.72rem; font-weight:800; color:rgba(255,255,255,.45); text-transform:uppercase; letter-spacing:.06em; }
    .pm-account-value { font-size:1rem; font-weight:700; color:#fff; letter-spacing:.03em; }
  `],
})
export class PlayerHostedPlayComponent implements OnInit {
  loading = true;
  busyId: string | null = null;
  sessions: HostedPlaySession[] = [];
  errorMap: Record<string, string> = {};
  clubCourts: Court[] = [];

  expandedId: string | null = null;
  playersLoading = false;
  players: HostedPlayParticipant[] = [];

  // Self-declared skill level (for level-gated sessions)
  readonly skillLevels: SkillLevel[] = [
    'beginner',
    'novice',
    'lower_intermediate',
    'intermediate',
    'upper_intermediate',
    'advanced',
    'expert_elite',
    'professional',
  ];
  myLevel: SkillLevel | null = null;
  savingLevel = false;

  // Self-reported DUPR doubles rating (2.000-8.000). Phase 0: no DUPR API verification.
  myDuprRating: number | null = null;
  savingDupr = false;
  duprSaveMsg = '';
  clubPaymentMethods: string[] = [];
  clubPaymentAccounts: Record<string, string> = {};
  clubPaymentQrCodes: Record<string, string> = {};

  showPaymentModal = false;
  claimMode = false; // payment modal is claiming an offered waitlist spot vs a normal join
  pendingSession: HostedPlaySession | null = null;
  paymentMethod: string = 'GCash';
  paymentScreenshotUrl: string | null = null;
  screenshotPreviewUrl: string | null = null;
  uploadingScreenshot = false;
  submittingPayment = false;
  paymentError: string | null = null;

  creditBalance = 0;
  useCredit = true; // whether the join/claim modal should apply available credit, or the player opted for club payment methods

  constructor(
    private hp: HostedPlayService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private clubService: ClubService,
    private cloudinary: CloudinaryService,
    private creditService: CreditService,
  ) {}

  ngOnInit() {
    this.loadClubCourts();
    this.refresh();
    this.loadMyLevel();
    this.loadCreditBalance();
  }

  private loadCreditBalance() {
    this.creditService.getMyCredit().subscribe({
      next: ({ balance }) => { this.creditBalance = balance; this.cdr.detectChanges(); },
    });
  }

  // How much credit would be applied toward this session's fee, respecting the player's toggle choice.
  creditForSession(s: HostedPlaySession): number {
    if (!this.useCredit) return 0;
    return Math.min(this.creditBalance, s.totalPerPlayer ?? s.feePerPlayer ?? 0);
  }

  // Amount still owed externally after account credit is applied (or the full fee if the
  // player opted out of using credit).
  remainingAfterCredit(s: HostedPlaySession): number {
    return Math.max(0, (s.totalPerPlayer ?? s.feePerPlayer ?? 0) - this.creditForSession(s));
  }

  private loadMyLevel() {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    this.hp.getSkillLevel(uid).subscribe({
      next: (u) => { this.myLevel = u.skillLevel ?? null; this.myDuprRating = u.duprRating ?? null; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  setMyLevel(level: SkillLevel | null) {
    const uid = this.auth.user()?.id;
    if (!uid || this.savingLevel || this.myLevel === level) return;
    this.savingLevel = true;
    this.cdr.detectChanges();
    this.hp.setSkillLevel(uid, level).subscribe({
      next: (u) => { this.myLevel = u.skillLevel ?? null; this.savingLevel = false; this.cdr.detectChanges(); },
      error: () => { this.savingLevel = false; this.cdr.detectChanges(); },
    });
  }

  saveMyDupr() {
    const uid = this.auth.user()?.id;
    if (!uid || this.savingDupr) return;
    const val = this.myDuprRating;
    if (val !== null && (isNaN(val) || val < 2.0 || val > 8.0)) {
      this.duprSaveMsg = 'Must be between 2.000 and 8.000';
      this.cdr.detectChanges();
      return;
    }
    this.savingDupr = true;
    this.duprSaveMsg = '';
    this.cdr.detectChanges();
    this.hp.setDuprProfile(uid, { duprRating: val }).subscribe({
      next: (u) => {
        this.myDuprRating = u.duprRating ?? null;
        this.savingDupr = false;
        this.duprSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.duprSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingDupr = false; this.duprSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  private readonly skillLevelLabels: Record<SkillLevel, string> = {
    beginner: 'Beginner',
    novice: 'Novice',
    lower_intermediate: 'Lower Intermediate',
    intermediate: 'Intermediate',
    upper_intermediate: 'Upper Intermediate',
    advanced: 'Advanced',
    expert_elite: 'Expert / Elite',
    professional: 'Professional',
  };

  levelLabel(l: SkillLevel | null): string {
    return l ? this.skillLevelLabels[l] : 'Not set';
  }

  // Human-readable band on a session card, e.g. "Intermediate+" / "Up to Advanced" / "Intermediate–Advanced".
  levelBand(s: HostedPlaySession): string {
    const min = s.minSkillLevel, max = s.maxSkillLevel;
    if (!min && !max) return '';
    if (min && max) return min === max ? this.levelLabel(min) : `${this.levelLabel(min)}–${this.levelLabel(max)}`;
    if (min) return `${this.levelLabel(min)}+`;
    return `Up to ${this.levelLabel(max!)}`;
  }

  // Mirrors the server-side SKILL_ORDER in hosted-play.routes.js — checked here too so a
  // blocked player is told immediately, before wading into the payment modal for a paid session.
  private readonly skillOrder: Record<SkillLevel, number> = {
    beginner: 1,
    novice: 2,
    lower_intermediate: 3,
    intermediate: 4,
    upper_intermediate: 5,
    advanced: 6,
    expert_elite: 7,
    professional: 8,
  };

  skillGateError(s: HostedPlaySession): string | null {
    const min = s.minSkillLevel, max = s.maxSkillLevel;
    if (!min && !max) return null;
    if (!this.myLevel) return 'This session is limited by skill level — set your level in your profile first.';
    const o = this.skillOrder[this.myLevel];
    if (min && o < this.skillOrder[min]) return `This session is for ${this.levelLabel(min)} level and up.`;
    if (max && o > this.skillOrder[max]) return `This session is capped at ${this.levelLabel(max)} level.`;
    return null;
  }

  loadClubCourts() {
    const clubId = this.auth.user()?.clubId || this.clubService.getSelectedClubId();
    if (!clubId) return;

    this.clubService.getClub(clubId).subscribe({
      next: (club) => {
        this.clubCourts = club.courts ?? [];
        this.clubPaymentMethods = (club.paymentMethods ?? []).filter(m => m !== 'Cash');
        this.clubPaymentAccounts = club.paymentAccounts ?? {};
        this.clubPaymentQrCodes = club.paymentQrCodes ?? {};
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  courtForSession(s: HostedPlaySession): Court | undefined {
    const venue = (s.venue || '').trim().toLowerCase();
    const court = (s.court || '').trim().toLowerCase();
    return this.clubCourts.find(c => {
      const name = c.name.trim().toLowerCase();
      return name === venue || (!!court && name === court);
    });
  }

  venueLogo(s: HostedPlaySession): string {
    return this.courtForSession(s)?.logo || '';
  }

  venueLabel(s: HostedPlaySession): string {
    return this.courtForSession(s)?.name || s.court || s.venue || s.title || 'Venue';
  }

  venueInitials(s: HostedPlaySession): string {
    const parts = this.venueLabel(s).split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  togglePlayers(s: HostedPlaySession) {
    if (this.expandedId === s._id) { this.expandedId = null; this.cdr.detectChanges(); return; }
    this.expandedId = s._id;
    this.loadPlayers(s._id);
  }

  loadPlayers(id: string) {
    this.playersLoading = true;
    this.players = [];
    this.cdr.detectChanges();
    this.hp.getSession(id).subscribe({
      next: (detail) => { this.players = detail.participants ?? []; this.playersLoading = false; this.cdr.detectChanges(); },
      error: () => { this.playersLoading = false; this.cdr.detectChanges(); },
    });
  }

  refresh() {
    this.loading = true;
    this.hp.listOpen().subscribe({
      next: (list) => { this.sessions = list; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  fillPct(s: HostedPlaySession): number {
    if (!s.maxPlayers) return 0;
    return Math.min(100, Math.round((s.currentPlayers / s.maxPlayers) * 100));
  }

  spotsLeft(s: HostedPlaySession): number {
    return Math.max(0, (s.maxPlayers || 0) - (s.currentPlayers || 0));
  }

  isNearlyFull(s: HostedPlaySession): boolean {
    return this.fillPct(s) >= 80;
  }

  joinedCount(): number {
    return this.sessions.filter(s => s.joined).length;
  }

  openSpotsTotal(): number {
    return this.sessions.reduce((total, s) => total + this.spotsLeft(s), 0);
  }

  statusLabel(s: HostedPlaySession): string {
    if (s.status === 'full') return 'Full';
    if (s.status === 'closed') return 'Closed';
    if (s.status === 'cancelled') return 'Cancelled';
    return 'Open';
  }

  join(s: HostedPlaySession) {
    // Check the skill gate up front so a blocked player is told immediately,
    // instead of only after filling out the payment modal for a paid session.
    const gateErr = this.skillGateError(s);
    if (gateErr) {
      this.errorMap[s._id] = gateErr;
      this.cdr.detectChanges();
      return;
    }
    // Full session → join the waitlist (no upfront payment; paid players pay on claim).
    if (s.status === 'full') { this.joinWaitlist(s); return; }
    // Split Session Fee sessions are billed once, after the session ends — joining
    // itself is always free, so skip the payment modal regardless of the estimate.
    // Paid session — let the player choose credit vs. club payment methods before joining.
    if (s.feeSplitMode !== 'split_total' && (s.totalPerPlayer ?? s.feePerPlayer ?? 0) > 0) {
      this.openPaymentModal(s, false);
      return;
    }
    this.busyId = s._id;
    this.errorMap[s._id] = '';
    this.hp.join(s._id).subscribe({
      next: (r) => {
        if (r.status === 'waitlisted') {
          s.waitlisted = true;
          s.waitlistPosition = r.waitlistPosition ?? null;
        } else {
          s.joined = true;
          s.currentPlayers = r.currentPlayers ?? s.currentPlayers;
          s.status = r.status as any;
        }
        if (r.creditApplied) this.creditBalance = Math.max(0, this.creditBalance - r.creditApplied);
        this.busyId = null;
        if (this.expandedId === s._id) this.loadPlayers(s._id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.busyId = null;
        this.errorMap[s._id] = err?.error?.error || 'Failed to join.';
        this.cdr.detectChanges();
      },
    });
  }

  // Full session: add to the waitlist (works for free and paid — no payment yet).
  private joinWaitlist(s: HostedPlaySession) {
    this.busyId = s._id;
    this.errorMap[s._id] = '';
    this.hp.join(s._id).subscribe({
      next: (r) => {
        if (r.status === 'waitlisted') {
          s.waitlisted = true;
          s.waitlistPosition = r.waitlistPosition ?? null;
        } else {
          // Race: a spot was free after all.
          s.joined = true;
          s.currentPlayers = r.currentPlayers ?? s.currentPlayers;
          s.status = r.status as any;
        }
        this.busyId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.busyId = null;
        this.errorMap[s._id] = err?.error?.error || 'Failed to join the waitlist.';
        this.cdr.detectChanges();
      },
    });
  }

  // Claim an offered waitlist spot (paid session) — let the player choose
  // credit vs. club payment methods before claiming.
  claim(s: HostedPlaySession) {
    this.openPaymentModal(s, true);
  }

  private openPaymentModal(s: HostedPlaySession, claimMode: boolean) {
    this.pendingSession = s;
    this.claimMode = claimMode;
    this.useCredit = this.creditBalance > 0;
    this.paymentMethod = this.clubPaymentMethods[0] ?? 'GCash';
    this.paymentScreenshotUrl = null;
    this.screenshotPreviewUrl = null;
    this.uploadingScreenshot = false;
    this.submittingPayment = false;
    this.paymentError = null;
    this.showPaymentModal = true;
    this.cdr.detectChanges();
  }

  toggleUseCredit() {
    this.useCredit = !this.useCredit;
    this.cdr.detectChanges();
  }

  async onScreenshotSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const err = this.cloudinary.validateImage(file);
    if (err) { this.paymentError = err; this.cdr.detectChanges(); return; }

    this.uploadingScreenshot = true;
    this.paymentError = null;
    this.screenshotPreviewUrl = URL.createObjectURL(file);
    this.cdr.detectChanges();
    try {
      this.paymentScreenshotUrl = await this.cloudinary.uploadImage(file, 'payment-screenshots');
    } catch {
      this.paymentError = 'Failed to upload screenshot. Please try again.';
      this.paymentScreenshotUrl = null;
      this.screenshotPreviewUrl = null;
    } finally {
      this.uploadingScreenshot = false;
      this.cdr.detectChanges();
    }
  }

  submitJoinWithPayment() {
    const s = this.pendingSession;
    if (!s || this.submittingPayment) return;
    const remaining = this.remainingAfterCredit(s);
    if (remaining > 0 && !this.paymentScreenshotUrl) return;

    this.submittingPayment = true;
    this.paymentError = null;
    this.busyId = s._id;
    this.cdr.detectChanges();

    const payload: HostedPlayJoinPayload = {
      useCredit: this.useCredit,
      ...(remaining > 0
        ? { paymentMethod: this.paymentMethod, paymentScreenshot: this.paymentScreenshotUrl! }
        : {}),
    };

    const request$ = (this.claimMode ? this.hp.claim(s._id, payload) : this.hp.join(s._id, payload)) as
      import('rxjs').Observable<{ status: string; currentPlayers?: number; sessionStatus?: string; creditApplied?: number }>;
    request$.subscribe({
      next: (r: { status: string; currentPlayers?: number; sessionStatus?: string; creditApplied?: number }) => {
        if (this.claimMode) {
          s.offered = false;
          if (r.status === 'active') {
            // Fully covered by credit — claimed immediately, no approval needed.
            s.joined = true;
          } else {
            s.pendingApproval = true;
          }
        } else if (r.status === 'pending_approval') {
          s.pendingApproval = true;
          s.currentPlayers = r.currentPlayers ?? s.currentPlayers;
          if (r.sessionStatus) s.status = r.sessionStatus as any;
        } else {
          s.joined = true;
          s.currentPlayers = r.currentPlayers ?? s.currentPlayers;
          s.status = r.status as any;
        }
        if (r.creditApplied) this.creditBalance = Math.max(0, this.creditBalance - r.creditApplied);
        this.busyId = null;
        this.submittingPayment = false;
        this.closePaymentModal();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.busyId = null;
        this.submittingPayment = false;
        this.paymentError = err?.error?.error || 'Something went wrong. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  setPaymentMethod(method: string) {
    this.paymentMethod = method;
    this.cdr.detectChanges();
  }

  clearScreenshot() {
    this.paymentScreenshotUrl = null;
    this.screenshotPreviewUrl = null;
    this.cdr.detectChanges();
  }

  closePaymentModal() {
    if (this.submittingPayment) return;
    this.showPaymentModal = false;
    this.claimMode = false;
    this.pendingSession = null;
    this.paymentMethod = 'GCash';
    this.paymentScreenshotUrl = null;
    this.screenshotPreviewUrl = null;
    this.uploadingScreenshot = false;
    this.submittingPayment = false;
    this.paymentError = null;
    this.cdr.detectChanges();
  }

  cancel(s: HostedPlaySession) {
    this.busyId = s._id;
    this.errorMap[s._id] = '';
    this.hp.cancelJoin(s._id).subscribe({
      next: (r) => {
        s.joined = false;
        s.waitlisted = false;
        s.offered = false;
        s.pendingApproval = false;
        s.waitlistPosition = null;
        s.currentPlayers = r.currentPlayers;
        s.status = r.status;
        this.busyId = null;
        if (this.expandedId === s._id) this.loadPlayers(s._id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.busyId = null;
        this.errorMap[s._id] = err?.error?.error || 'Failed to cancel.';
        this.cdr.detectChanges();
      },
    });
  }

  openLiveBoard(s: HostedPlaySession) {
    this.router.navigate(['/player/hosted-play', s._id, 'live']);
  }

  goBack() { this.router.navigate(['/player/dashboard']); }
}
