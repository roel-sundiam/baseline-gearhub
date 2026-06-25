import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Club } from '../../../core/services/club.service';
import { PublicBookingService } from '../../../core/services/public-booking.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { AdminMessagesService } from '../../../core/services/admin-messages.service';
import { AdminChatModalComponent } from '../../../shared/components/admin-chat-modal/admin-chat-modal.component';
import { SoundService } from '../../../core/services/sound.service';
import { forkJoin, timeout, of, catchError } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminChatModalComponent],
  template: `
    <section class="dashboard-shell">
      <header class="hero-panel">
        <div>
          <p class="hero-kicker"><span style="color:#a3e635">Court</span><span style="color:#ffffff">Go</span></p>
          <h2>Admin Command Center</h2>
          <p class="hero-subtitle">Monitor operations, handle approvals, and keep your club finances moving.</p>
        </div>
        <div class="hero-actions">
          <a routerLink="/admin/payment-approvals" class="btn-secondary">
            <i class="fas fa-receipt"></i>
            Review Payments
          </a>
        </div>
      </header>

      @if (loading) {
        <section class="state-shell">
          <div class="loading-skeleton">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="skeleton-card"></div>
            }
          </div>
        </section>
      } @else if (errorMsg) {
        <section class="state-shell state-error">
          <i class="fas fa-triangle-exclamation"></i>
          <p>{{ errorMsg }}</p>
        </section>
      } @else {
        <section class="stats-grid">
          <article class="stat-card stat-pending">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-user-clock"></i></span>
              <span class="stat-label">Pending Approvals</span>
            </div>
            <p class="stat-value">{{ pendingCount }}</p>
            <a routerLink="/admin/users" class="stat-link">Review users</a>
          </article>

          <article class="stat-card stat-sessions">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-calendar-days"></i></span>
              <span class="stat-label">Total Sessions</span>
            </div>
            <p class="stat-value">{{ sessionCount }}</p>
            <a routerLink="/admin/sessions" class="stat-link">View sessions</a>
          </article>

          <article class="stat-card stat-unpaid">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-wallet"></i></span>
              <span class="stat-label">Total Outstanding</span>
            </div>
            <p class="stat-value">{{ unpaidAmount | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
            <a routerLink="/admin/sessions" class="stat-link">View charges</a>
          </article>

          <article class="stat-card stat-approvals">
            <div class="stat-head">
              <span class="stat-icon"><i class="fas fa-hourglass-half"></i></span>
              <span class="stat-label">Payment Approvals</span>
            </div>
            <p class="stat-value">{{ pendingApprovalsCount }}</p>
            <a routerLink="/admin/payment-approvals" class="stat-link">Review payments</a>
          </article>
        </section>

        <section class="approvals-section">
          <div class="section-header">
            <div>
              <p class="section-kicker">Queue</p>
              <h3>Payment Approvals</h3>
            </div>
            <a routerLink="/admin/payment-approvals" class="section-link">View all</a>
          </div>

          @if (pendingApprovals.length === 0) {
            <div class="approvals-empty">No payments pending approval.</div>
          } @else {
            <div class="approvals-list">
              @for (charge of pendingApprovals.slice(0, 5); track charge._id) {
                <article class="approval-row">
                  <div class="approval-info">
                    <p class="approval-player">{{ getPlayerName(charge) }}</p>
                    <p class="approval-detail">
                      {{ charge.chargeType === 'reservation' ? 'Reservation' : 'Session' }}
                      @if (charge.chargeType === 'reservation' && charge.reservationId) {
                        · {{ charge.reservationId.date | date: 'MMM d' : 'UTC' }}
                      } @else if (charge.chargeType === 'session' && charge.sessionId) {
                        · {{ charge.sessionId.date | date: 'MMM d' : 'UTC' }}
                      }
                      · {{ charge.paymentMethod }}
                    </p>
                  </div>

                  <div class="approval-actions">
                    <span class="approval-amt">{{ charge.amount | currency: 'PHP' : 'symbol' }}</span>
                    <button class="btn-approve-sm" [disabled]="processingId === charge._id" (click)="quickApprove(charge._id)">
                      {{ processingId === charge._id ? 'Approving...' : 'Approve' }}
                    </button>
                    <a [routerLink]="['/admin/payment-approvals']" class="btn-review-sm">Review</a>
                  </div>
                </article>
              }
            </div>
            @if (pendingApprovals.length > 5) {
              <div class="approvals-overflow">
                +{{ pendingApprovals.length - 5 }} more pending ·
                <a routerLink="/admin/payment-approvals">See all</a>
              </div>
            }
          }
        </section>

        <section class="quick-actions">
          <div class="section-header">
            <div>
              <p class="section-kicker">Workflow</p>
              <h3>Quick Actions</h3>
            </div>
          </div>

          <div class="action-grid">
            <a routerLink="/admin/users" class="action-card">
              <span class="action-icon"><i class="fas fa-users"></i></span>
              <span class="action-title">Manage Users</span>
              <span class="action-sub">Approve and maintain member accounts</span>
            </a>
            <a routerLink="/admin/reservations" class="action-card">
              <span class="action-icon"><i class="fas fa-calendar-check"></i></span>
              <span class="action-title">Court Reservations</span>
              <span class="action-sub">View, edit, and manage court bookings</span>
            </a>
            @if (authService.isSuperAdmin()) {
              <a routerLink="/admin/reservations-report" class="action-card">
                <span class="action-icon"><i class="fas fa-chart-bar"></i></span>
                <span class="action-title">Reservations Report</span>
                <span class="action-sub">All reservations with status — superadmin view</span>
              </a>
              <a routerLink="/admin/admins" class="action-card">
                <span class="action-icon" style="position:relative;display:inline-block;">
                  <i class="fas fa-user-shield"></i>
                  @if (messageUnreadCount > 0) {
                    <span class="msg-badge">{{ messageUnreadCount }}</span>
                  }
                </span>
                <span class="action-title">Club Admins</span>
                <span class="action-sub">Manage admin accounts and send messages</span>
              </a>
            }
            <a routerLink="/admin/rates" class="action-card">
              <span class="action-icon"><i class="fas fa-money-bill-wave"></i></span>
              <span class="action-title">Update Rates</span>
              <span class="action-sub">Adjust pricing and billing baselines</span>
            </a>
            <!-- Tournaments hidden until feature is ready
            <a routerLink="/admin/tournaments" class="action-card">
              <span class="action-icon"><i class="fas fa-trophy"></i></span>
              <span class="action-title">Tournaments</span>
              <span class="action-sub">Schedule and manage upcoming events</span>
            </a>
            -->
            <a routerLink="/admin/news" class="action-card">
              <span class="action-icon"><i class="fas fa-newspaper"></i></span>
              <span class="action-title">Club News</span>
              <span class="action-sub">Post updates and announcements</span>
            </a>
            <a routerLink="/admin/inquiries" class="action-card">
              <span class="action-icon"><i class="fas fa-envelope"></i></span>
              <span class="action-title">Inquiries</span>
              <span class="action-sub">View and reply to guest messages</span>
            </a>
            @if (!authService.isSuperAdmin()) {
              <button class="action-card action-card--btn" (click)="openSupportChat()">
                <span class="action-icon" style="position:relative;display:inline-block;">
                  <i class="fas fa-comments"></i>
                  @if (messageUnreadCount > 0) {
                    <span class="msg-badge">{{ messageUnreadCount }}</span>
                  }
                </span>
                <span class="action-title">Messages</span>
                <span class="action-sub">Chat with CourtGo support</span>
              </button>
            }
            <a routerLink="/admin/open-play" class="action-card">
              <span class="action-icon"><i class="fas fa-table-tennis-paddle-ball"></i></span>
              <span class="action-title">Open Play</span>
              <span class="action-sub">Run skill-balanced sessions and track CRI ratings</span>
            </a>
            @if (authService.isSuperAdmin()) {
              <a routerLink="/features" target="_blank" class="action-card action-card--features">
                <span class="action-icon"><i class="fas fa-star"></i></span>
                <span class="action-title" style="display:flex;align-items:center;gap:4px;">
                  Features Page
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="opacity:0.55"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </span>
                <span class="action-sub">Public showcase — share with new clubs &amp; players</span>
              </a>
              <a href="/video/courtgo-features.mp4" target="_blank" class="action-card">
                <span class="action-icon"><i class="fas fa-film"></i></span>
                <span class="action-title" style="display:flex;align-items:center;gap:4px;">
                  Feature Video
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="opacity:0.55"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </span>
                <span class="action-sub">Animated walkthrough video — share or download</span>
              </a>
            }
          </div>
        </section>

        <!-- ── AVAILABLE SLOTS POSTER ── -->
        <section class="poster-section">
          <div class="section-header">
            <div>
              <p class="section-kicker">Share</p>
              <h3>Available Slots Poster</h3>
            </div>
          </div>

          <!-- Controls -->
          <div class="poster-ctrl-row">
            <label class="poster-ctrl-label">Date
              <input type="date" class="poster-input" [(ngModel)]="posterDate" (change)="loadPosterSlots()" />
            </label>
            <label class="poster-ctrl-label">Court
              <select class="poster-input" [(ngModel)]="posterCourt" (ngModelChange)="loadPosterSlots()">
                @for (c of courtArray(); track c) {
                  <option [value]="c">Court {{ c }}</option>
                }
              </select>
            </label>
            <div class="poster-ctrl-actions">
              @if (!club?.bookingQrCode) {
                <label class="poster-upload-btn" [class.poster-upload-btn--busy]="uploadingPosterQr">
                  <i class="fas {{ uploadingPosterQr ? 'fa-circle-notch fa-spin' : 'fa-qrcode' }}"></i>
                  {{ uploadingPosterQr ? 'Uploading…' : 'Upload QR Code' }}
                  <input type="file" accept="image/*" (change)="onPosterQrSelected($event)" [disabled]="uploadingPosterQr" hidden />
                </label>
              } @else {
                <button type="button" class="poster-remove-btn" (click)="removePosterQr()">
                  <i class="fas fa-times"></i> Remove QR
                </button>
              }
              <button type="button" class="poster-action-btn poster-action-btn--primary" (click)="copyPosterImage()" [disabled]="capturingPoster || loadingPosterSlots">
                <i class="fas {{ capturingPoster ? 'fa-circle-notch fa-spin' : 'fa-copy' }}"></i>
                {{ capturingPoster ? 'Capturing…' : 'Copy Image' }}
              </button>
              <button type="button" class="poster-action-btn" (click)="downloadPosterImage()" [disabled]="capturingPoster || loadingPosterSlots">
                <i class="fas fa-download"></i> Download
              </button>
              @if (posterCopied) {
                <span class="poster-copied-toast"><i class="fas fa-check-circle"></i> Copied!</span>
              }
            </div>
          </div>

          <!-- Poster preview -->
          @if (loadingPosterSlots) {
            <div class="poster-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading slots…</div>
          } @else {
            <div class="poster-scroll-wrap">
              <div #posterCardRef [ngStyle]="posterCardStyle()">
                <div [ngStyle]="posterOverlayStyle()">

                  <!-- ── Centered header ── -->
                  <div [ngStyle]="{ textAlign: 'center', marginBottom: '14px' }">
                    <div [ngStyle]="{ color: '#ffffff', fontWeight: '900', fontSize: '26px', letterSpacing: '3px', textShadow: '0 2px 6px rgba(0,0,0,0.6)', lineHeight: '1.1' }">
                      AVAILABLE SLOTS
                    </div>
                    <div [ngStyle]="{ color: '#e5e7eb', fontSize: '13px', fontWeight: '600', marginTop: '5px', letterSpacing: '1px' }">
                      {{ posterDateLine1() }}
                    </div>
                    <div [ngStyle]="{ color: '#e5e7eb', fontSize: '13px', fontWeight: '600', letterSpacing: '1px' }">
                      {{ posterDateLine2() }}
                    </div>
                  </div>

                  <!-- ── Body: slots + QR ── -->
                  <div [ngStyle]="{ display: 'flex', flexDirection: 'row', gap: '16px', flex: '1', minHeight: '0' }">

                    <!-- Left: court name + slot list -->
                    <div [ngStyle]="{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column' }">
                      <div [ngStyle]="{ color: '#ffffff', fontWeight: '900', fontSize: '28px', marginBottom: '10px', letterSpacing: '1px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }">
                        COURT {{ posterCourt }}
                      </div>
                      @if (posterSlots.length === 0) {
                        <div [ngStyle]="{ color: '#9ca3af', fontSize: '13px' }">No slots for this date.</div>
                      }
                      @for (s of posterSlots; track s.slot) {
                        <div [ngStyle]="posterSlotRowStyle()">
                          <span [ngStyle]="{ color: '#ffffff', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }">{{ s.label }}</span>
                          <span [ngStyle]="s.open ? posterOpenBadgeStyle() : posterTakenBadgeStyle()">
                            {{ s.open ? 'OPEN' : 'TAKEN' }}
                          </span>
                        </div>
                      }
                    </div>

                    <!-- Right: QR code -->
                    @if (club?.bookingQrCode) {
                      <div [ngStyle]="{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', justifyContent: 'center', flexShrink: '0' }">
                        <span [ngStyle]="{ color: '#ffffff', fontWeight: '800', fontSize: '15px', letterSpacing: '1px', textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }">SCAN TO BOOK:</span>
                        <img [src]="club!.bookingQrCode!"
                             [ngStyle]="{ width: '200px', height: '200px', borderRadius: '6px', backgroundColor: '#ffffff', padding: '5px', display: 'block' }"
                             alt="Booking QR Code"
                             crossorigin="anonymous" />
                      </div>
                    }
                  </div>

                  <!-- ── Bottom-right logo ── -->
                  <div [ngStyle]="{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }">
                    <img src="/CourtGo.png"
                         [ngStyle]="{ height: '28px', width: 'auto', opacity: '0.85', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }"
                         alt="CourtGo"
                         crossorigin="anonymous" />
                  </div>

                </div>
              </div>
            </div>
          }
        </section>
      }
    </section>

    @if (supportChatOpen) {
      <app-admin-chat-modal
        [recipientId]="supportContactId"
        [recipientName]="supportContactName"
        (closed)="closeSupportChat()"
      />
    }
  `,
  styles: [
    `
      :host {
        --ink: #ffffff;
        --gold: var(--dm-accent);
        --gold-dark: rgba(163,230,53,0.9);
        --gold-light: rgba(163,230,53,0.08);
        --warm-bg: var(--dm-surface);
        --line: rgba(163,230,53,0.12);
        --danger: #fca5a5;
        --card-bg: var(--dm-surface);
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--dm-bg);
      }

      .dashboard-shell {
        display: grid;
        gap: 1rem;
        padding: 1.5rem;
        min-height: calc(100vh - 60px);
      }

      .hero-panel {
        background: var(--dm-header);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 18px;
        padding: 1rem 1.2rem;
        box-shadow: 0 4px 16px rgba(0,0,0,0.32);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .hero-kicker {
        margin: 0 0 0.2rem;
        font-size: 0.74rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 800;
        color: var(--gold);
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .hero-panel h2 {
        margin: 0;
        font-size: 1.42rem;
        color: #ffffff;
        letter-spacing: -0.02em;
      }

      .hero-subtitle {
        margin: 0.38rem 0 0;
        color: rgba(255,255,255,0.7);
        font-size: 0.91rem;
      }

      .hero-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .btn-primary,
      .btn-secondary {
        border-radius: 10px;
        padding: 0.56rem 0.88rem;
        font-size: 0.86rem;
        font-weight: 700;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border: 1px solid transparent;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        white-space: nowrap;
        cursor: pointer;
        font-family: inherit;
      }

      .btn-primary {
        background: var(--gold);
        color: #111827;
        border-color: var(--gold);
        box-shadow: 0 2px 8px rgba(163,230,53,0.24);
      }

      .btn-primary:hover {
        background: var(--gold-dark);
        border-color: var(--gold-dark);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(163,230,53,0.32);
      }

      .btn-secondary {
        background: rgba(255,255,255,0.08);
        border-color: rgba(163,230,53,0.24);
        color: var(--gold);
      }

      .btn-secondary:hover {
        background: rgba(255,255,255,0.12);
        border-color: rgba(163,230,53,0.4);
        transform: translateY(-1px);
      }

      .state-shell {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 1rem;
        box-shadow: 0 2px 12px rgba(0,0,0,0.24);
      }

      .state-error {
        color: #fca5a5;
        display: grid;
        justify-items: center;
        gap: 0.55rem;
        text-align: center;
      }

      .state-error i {
        font-size: 1.4rem;
      }

      .state-error p {
        margin: 0;
      }

      .loading-skeleton {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.7rem;
      }

      .skeleton-card {
        height: 135px;
        border-radius: 14px;
        background: linear-gradient(110deg, rgba(255,255,255,0.06) 8%, rgba(255,255,255,0.1) 18%, rgba(255,255,255,0.06) 33%);
        background-size: 200% 100%;
        animation: shimmer 1.1s linear infinite;
        border: 1px solid rgba(163,230,53,0.08);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.75rem;
      }

      .stat-card {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 0.95rem;
        box-shadow: 0 2px 12px rgba(0,0,0,0.24);
        display: grid;
        gap: 0.55rem;
      }

      .stat-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .stat-icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
      }

      .stat-label {
        font-size: 0.84rem;
        color: rgba(255,255,255,0.72);
        font-weight: 700;
      }

      .stat-value {
        margin: 0;
        color: #ffffff;
        font-size: 1.45rem;
        font-weight: 800;
        line-height: 1.15;
        word-break: break-word;
      }

      .stat-link {
        color: var(--gold);
        font-size: 0.83rem;
        font-weight: 700;
        text-decoration: none;
      }

      .stat-link:hover {
        text-decoration: underline;
      }

      .stat-pending .stat-icon,
      .stat-approvals .stat-icon {
        background: rgba(245,158,11,0.12);
        border-color: rgba(245,158,11,0.2);
        color: #fcd34d;
      }

      .stat-sessions .stat-icon {
        background: rgba(163,230,53,0.12);
        border-color: rgba(163,230,53,0.2);
        color: var(--gold);
      }

      .stat-unpaid .stat-icon {
        background: rgba(239,68,68,0.12);
        border-color: rgba(239,68,68,0.2);
        color: #fca5a5;
      }

      .approvals-section,
      .quick-actions {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 0.95rem;
        box-shadow: 0 8px 22px rgba(0,0,0,0.32);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        margin-bottom: 0.7rem;
      }

      .section-kicker {
        margin: 0;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--gold);
        font-weight: 800;
      }

      .section-header h3 {
        margin: 0.1rem 0 0;
        font-size: 1rem;
        color: #ffffff;
      }

      .section-link {
        color: var(--gold);
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
      }

      .section-link:hover {
        text-decoration: underline;
      }

      .approvals-list {
        display: grid;
        gap: 0.55rem;
      }

      .approval-row {
        background: rgba(163,230,53,0.06);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 10px;
        padding: 0.62rem 0.7rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        flex-wrap: wrap;
      }

      .approval-info {
        flex: 1;
        min-width: 220px;
      }

      .approval-player {
        margin: 0;
        font-size: 0.9rem;
        color: #ffffff;
        font-weight: 800;
      }

      .approval-detail {
        margin: 0.2rem 0 0;
        font-size: 0.78rem;
        color: rgba(255,255,255,0.7);
      }

      .approval-actions {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .approval-amt {
        color: var(--gold);
        font-size: 0.93rem;
        font-weight: 800;
      }

      .btn-approve-sm,
      .btn-review-sm {
        border-radius: 8px;
        padding: 0.35rem 0.72rem;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .btn-approve-sm {
        border: 1px solid rgba(163,230,53,0.28);
        background: rgba(163,230,53,0.16);
        color: var(--gold);
        cursor: pointer;
      }

      .btn-approve-sm:hover:not(:disabled) {
        background: rgba(163,230,53,0.24);
      }

      .btn-approve-sm:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .btn-review-sm {
        background: rgba(255,255,255,0.06);
        color: var(--gold);
        border: 1px solid rgba(163,230,53,0.24);
        text-decoration: none;
      }

      .btn-review-sm:hover {
        background: rgba(255,255,255,0.1);
      }

      .approvals-empty {
        background: rgba(255,255,255,0.03);
        border: 1px dashed rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 0.8rem;
        color: rgba(255,255,255,0.6);
        font-size: 0.88rem;
      }

      .approvals-overflow {
        margin-top: 0.45rem;
        text-align: center;
        font-size: 0.8rem;
        color: rgba(255,255,255,0.6);
      }

      .approvals-overflow a {
        color: var(--gold);
        text-decoration: none;
        font-weight: 700;
      }

      .approvals-overflow a:hover {
        text-decoration: underline;
      }

      .action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.6rem;
      }

      .action-card {
        background: var(--dm-surface);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 12px;
        padding: 0.8rem;
        text-decoration: none;
        color: #ffffff;
        display: grid;
        gap: 0.34rem;
        box-shadow: 0 6px 16px rgba(0,0,0,0.24);
        transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
      }

      .action-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 22px rgba(163,230,53,0.12);
        border-color: rgba(163,230,53,0.28);
      }

      .action-card--btn {
        cursor: pointer;
        text-align: left;
        font-family: inherit;
      }

      .msg-badge {
        position: absolute;
        top: -5px;
        right: -6px;
        background: #ef4444;
        color: #fff;
        font-size: 0.65rem;
        font-weight: 700;
        min-width: 16px;
        height: 16px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 3px;
      }

      .action-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(163,230,53,0.12);
        color: var(--gold);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
      }

      .action-title {
        font-weight: 800;
        font-size: 0.9rem;
      }

      .action-sub {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.72);
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      @media (max-width: 860px) {
        .hero-panel {
          flex-direction: column;
          align-items: stretch;
        }

        .hero-actions {
          justify-content: flex-start;
        }
      }

      @media (max-width: 640px) {
        .dashboard-shell {
          gap: 0.85rem;
        }

        .hero-panel {
          padding: 0.85rem;
        }

        .hero-panel h2 {
          font-size: 1.2rem;
        }

        .hero-subtitle {
          font-size: 0.84rem;
        }

        .hero-actions {
          width: 100%;
        }

        .btn-primary,
        .btn-secondary {
          width: 100%;
        }

        .stats-grid {
          grid-template-columns: 1fr;
        }

        .approval-info {
          min-width: 0;
        }

        .approval-actions {
          width: 100%;
          justify-content: flex-start;
        }

        .action-grid {
          grid-template-columns: 1fr;
        }
      }

      .poster-section {
        background: var(--dm-surface);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 6px 16px rgba(0,0,0,0.24);
      }

      .poster-ctrl-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 20px;
      }

      .poster-ctrl-label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255,255,255,0.55);
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      .poster-input {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(163,230,53,0.18);
        border-radius: 8px;
        color: #fff;
        padding: 6px 10px;
        font-size: 0.85rem;
        outline: none;
        min-width: 0;
      }

      .poster-ctrl-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .poster-upload-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 8px;
        border: 1px solid rgba(163,230,53,0.3);
        color: rgba(163,230,53,0.9);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        background: rgba(163,230,53,0.06);
        transition: background 0.15s;
      }
      .poster-upload-btn:hover { background: rgba(163,230,53,0.12); }
      .poster-upload-btn--busy { opacity: 0.6; pointer-events: none; }

      .poster-remove-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.6);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        background: transparent;
      }

      .poster-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.8);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        background: rgba(255,255,255,0.05);
        transition: background 0.15s;
      }
      .poster-action-btn:disabled { opacity: 0.5; pointer-events: none; }
      .poster-action-btn--primary {
        background: rgba(163,230,53,0.15);
        border-color: rgba(163,230,53,0.4);
        color: #a3e635;
      }
      .poster-action-btn--primary:hover { background: rgba(163,230,53,0.22); }

      .poster-copied-toast {
        color: #4ade80;
        font-size: 0.8rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .poster-loading {
        color: rgba(255,255,255,0.5);
        font-size: 0.85rem;
        padding: 12px 0;
      }

      .poster-scroll-wrap {
        overflow-x: auto;
        padding-bottom: 8px;
      }
    `,
  ],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  errorMsg = '';
  pendingCount = 0;
  sessionCount = 0;
  unpaidAmount = 0;
  pendingApprovalsCount = 0;
  pendingApprovals: Charge[] = [];
  processingId: string | null = null;

  // ── Poster ──
  @ViewChild('posterCardRef') posterCardRef!: ElementRef;
  club: Club | null = null;
  posterDate = '';
  posterCourt = 1;
  posterSlots: { slot: string; label: string; open: boolean }[] = [];
  loadingPosterSlots = false;
  uploadingPosterQr = false;
  capturingPoster = false;
  posterCopied = false;

  // ── Support chat (club admin only) ──
  messageUnreadCount = 0;
  supportChatOpen = false;
  supportContactId = '';
  supportContactName = 'CourtGo Support';
  private msgPollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private usersService: UsersService,
    private sessionsService: SessionsService,
    private chargesService: ChargesService,
    private cdr: ChangeDetectorRef,
    protected authService: AuthService,
    private clubService: ClubService,
    private publicBooking: PublicBookingService,
    private cloudinary: CloudinaryService,
    private adminMessages: AdminMessagesService,
    private sound: SoundService,
  ) {}

  ngOnInit() {
    const today = new Date();
    this.posterDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const clubId = this.authService.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (c) => { this.club = c; this.loadPosterSlots(); this.cdr.detectChanges(); },
      });
    }

    this.adminMessages.getUnreadCount().subscribe({
      next: ({ count }) => { this.messageUnreadCount = count; this.cdr.detectChanges(); },
      error: () => {},
    });
    this.msgPollInterval = setInterval(() => {
      if (this.supportChatOpen) return;
      this.adminMessages.getUnreadCount().subscribe({
        next: ({ count }) => {
          if (count > this.messageUnreadCount) this.sound.notification();
          this.messageUnreadCount = count;
          this.cdr.detectChanges();
        },
        error: () => {},
      });
    }, 20_000);

    console.log('Dashboard ngOnInit — starting API calls');

    forkJoin({
      pending: this.usersService.getPendingUsers(),
      sessions: this.sessionsService.getSessions(),
      approvals: this.chargesService.getPendingApprovals().pipe(catchError(() => of([]))),
    })
      .pipe(timeout(20000))
      .subscribe({
        next: ({ pending, sessions, approvals }) => {
          console.log('Dashboard API success', { pending, sessions, approvals });
          this.pendingCount = pending.length;
          this.sessionCount = sessions.length;
          this.unpaidAmount = sessions.reduce((total, s) => {
            const unpaid = s.players
              .filter((p) => p.status === 'unpaid')
              .reduce((sum, p) => sum + p.charges.total, 0);
            return total + unpaid;
          }, 0);
          this.pendingApprovalsCount = approvals.length;
          this.pendingApprovals = approvals;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Dashboard API error', err);
          this.loading = false;
          if (err.name === 'TimeoutError') {
            this.errorMsg =
              'Request timed out. The server may be waking up — please wait a moment and refresh.';
          } else if (err.status === 401) {
            this.errorMsg = 'Session expired — please log out and log in again.';
          } else {
            this.errorMsg = `Error ${err.status || err.message || 'unknown'}. Check browser console (F12) for details.`;
          }
          this.cdr.detectChanges();
        },
      });
  }

  getPlayerName(charge: Charge): string {
    if (charge.playerId && typeof charge.playerId === 'object') {
      return (charge.playerId as any).name || 'Unknown';
    }
    return charge.guestName || 'Unknown';
  }

  quickApprove(id: string) {
    this.processingId = id;
    this.chargesService.approvePayment(id).subscribe({
      next: (res) => {
        this.pendingApprovals = this.pendingApprovals.filter((c) => c._id !== id);
        this.pendingApprovalsCount = this.pendingApprovals.length;
        this.processingId = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.processingId = null;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Poster ──
  courtArray(): number[] {
    return Array.from({ length: this.club?.courtCount ?? 1 }, (_, i) => i + 1);
  }

  loadPosterSlots() {
    if (!this.club?._id || !this.posterDate) return;
    this.loadingPosterSlots = true;
    this.posterSlots = [];
    this.publicBooking.getAvailability(this.club._id, this.posterCourt, this.posterDate).subscribe({
      next: ({ bookedSlots }) => {
        const slots: { slot: string; label: string; open: boolean }[] = [];
        const open = this.club!.openingHour ?? 6;
        const close = this.club!.closingHour ?? 22;
        for (let h = open; h < close; h++) {
          const key = this.slotKey(h);
          slots.push({ slot: key, label: this.slotLabel(h), open: !bookedSlots.includes(key) });
        }
        this.posterSlots = slots;
        this.loadingPosterSlots = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPosterSlots = false; this.cdr.detectChanges(); },
    });
  }

  private slotKey(h: number): string {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
  }

  private slotLabel(h: number): string {
    const fmt = (hr: number) => {
      const period = hr < 12 ? 'AM' : 'PM';
      const disp = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
      return `${disp}:00${period}`;
    };
    return `${fmt(h)} - ${fmt(h + 1)}`;
  }

  async onPosterQrSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.club) return;
    const err = this.cloudinary.validateImage(file);
    if (err) { alert(err); return; }
    this.uploadingPosterQr = true;
    this.cdr.detectChanges();
    try {
      const url = await this.cloudinary.uploadImage(file);
      this.club.bookingQrCode = url;
      this.clubService.patchBookingQrCode(this.club._id, url).subscribe();
    } finally {
      this.uploadingPosterQr = false;
      this.cdr.detectChanges();
    }
  }

  removePosterQr() {
    if (!this.club) return;
    this.club.bookingQrCode = null;
    this.clubService.patchBookingQrCode(this.club._id, null).subscribe();
    this.cdr.detectChanges();
  }

  async copyPosterImage() {
    if (!this.posterCardRef) return;
    this.capturingPoster = true;
    this.posterCopied = false;
    this.cdr.detectChanges();
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(this.posterCardRef.nativeElement, { scale: 2, useCORS: true, backgroundColor: null });
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error('No blob')); return; }
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            resolve();
          } catch (e) { reject(e); }
        }, 'image/png');
      });
      this.posterCopied = true;
      setTimeout(() => { this.posterCopied = false; this.cdr.detectChanges(); }, 2500);
    } catch (e) {
      console.error('Copy poster failed', e);
    } finally {
      this.capturingPoster = false;
      this.cdr.detectChanges();
    }
  }

  async downloadPosterImage() {
    if (!this.posterCardRef) return;
    this.capturingPoster = true;
    this.cdr.detectChanges();
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(this.posterCardRef.nativeElement, { scale: 2, useCORS: true, backgroundColor: null });
      const link = document.createElement('a');
      link.download = `slots-court${this.posterCourt}-${this.posterDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      this.capturingPoster = false;
      this.cdr.detectChanges();
    }
  }

  posterDateLine1(): string {
    if (!this.posterDate) return '';
    const d = new Date(this.posterDate + 'T00:00:00');
    const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  posterDateLine2(): string {
    if (!this.posterDate) return '';
    const d = new Date(this.posterDate + 'T00:00:00');
    return ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][d.getDay()];
  }

  posterCardStyle(): Record<string, string> {
    const bg = this.club?.photos?.[0] ?? '';
    return {
      width: '540px',
      minHeight: '580px',
      position: 'relative',
      borderRadius: '12px',
      overflow: 'hidden',
      ...(bg ? { backgroundImage: `url(${bg})` } : {}),
      backgroundColor: bg ? '#111827' : '#0d2414',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      flexShrink: '0',
      display: 'flex',
    };
  }

  posterOverlayStyle(): Record<string, string> {
    return {
      flex: '1',
      background: 'rgba(15,23,42,0.72)',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 24px 24px',
      boxSizing: 'border-box',
    };
  }

  posterSlotRowStyle(): Record<string, string> {
    return {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 10px',
      marginBottom: '4px',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: '6px',
      gap: '8px',
    };
  }

  posterOpenBadgeStyle(): Record<string, string> {
    return {
      background: '#15803d',
      color: '#ffffff',
      fontWeight: '700',
      fontSize: '12px',
      padding: '4px 14px',
      borderRadius: '5px',
      letterSpacing: '1px',
      flexShrink: '0',
    };
  }

  posterTakenBadgeStyle(): Record<string, string> {
    return {
      background: '#374151',
      color: '#9ca3af',
      fontWeight: '700',
      fontSize: '12px',
      padding: '4px 14px',
      borderRadius: '5px',
      letterSpacing: '1px',
      flexShrink: '0',
    };
  }

  ngOnDestroy() {
    if (this.msgPollInterval) clearInterval(this.msgPollInterval);
  }

  openSupportChat() {
    if (this.supportContactId) {
      this.supportChatOpen = true;
      return;
    }
    this.adminMessages.getSupportContact().subscribe({
      next: (contact) => {
        this.supportContactId = contact._id;
        this.supportContactName = contact.name;
        this.supportChatOpen = true;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  closeSupportChat() {
    this.supportChatOpen = false;
    this.adminMessages.getUnreadCount().subscribe({
      next: ({ count }) => { this.messageUnreadCount = count; this.cdr.detectChanges(); },
      error: () => {},
    });
  }
}

