import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { UsersService } from '../../../core/services/users.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Club, Court } from '../../../core/services/club.service';
import { PublicBookingService } from '../../../core/services/public-booking.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { AdminMessagesService } from '../../../core/services/admin-messages.service';
import { AdminChatModalComponent } from '../../../shared/components/admin-chat-modal/admin-chat-modal.component';
import { BalanceAlertModalComponent } from '../../../shared/components/balance-alert-modal/balance-alert-modal.component';
import { AnnouncementModalComponent } from '../../../shared/components/announcement-modal/announcement-modal.component';
import { SoundService } from '../../../core/services/sound.service';
import { AppServicePaymentsService } from '../../../core/services/app-service-payments.service';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { HostedPlayService, HostedPlaySession } from '../../../core/services/hosted-play.service';
import { DuprService } from '../../../core/services/dupr.service';
import { forkJoin, timeout, of, catchError } from 'rxjs';
import { marked } from 'marked';
import QRCode from 'qrcode';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminChatModalComponent, BalanceAlertModalComponent, AnnouncementModalComponent],
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

        @if (!authService.isSuperAdmin() && feeInfo() !== null) {
          <article class="balance-due-card" [class.balance-due-card--owed]="feeInfo()!.balance > 0">
            <div class="balance-due-left">
              <span class="balance-due-icon"><i class="fas fa-file-invoice-dollar"></i></span>
              <div>
                <p class="balance-due-label">App Service Balance</p>
                <p class="balance-due-amount">{{ feeInfo()!.balance | currency: 'PHP' : 'symbol' : '1.2-2' }}</p>
              </div>
            </div>
            <div class="balance-due-right">
              <span class="balance-due-due">Due by {{ monthEndDate | date: 'MMMM d, yyyy' }}</span>
              <a routerLink="/admin/finance" class="balance-due-link">View details →</a>
            </div>
          </article>
        }

        @if (authService.isSuperAdmin()) {
          <section class="quick-actions">
            <div class="section-header">
              <div>
                <p class="section-kicker">Superadmin</p>
                <h3>Superadmin Workspace</h3>
              </div>
            </div>
            <div class="action-grid">
              <a routerLink="/admin/clubs" class="action-card">
                <span class="action-icon"><i class="fas fa-building"></i></span>
                <span class="action-title">Club Portfolio</span>
                <span class="action-sub">Manage clubs, admins, payments, and app service fees.</span>
              </a>
              <a routerLink="/admin/ledger" class="action-card">
                <span class="action-icon"><i class="fas fa-book-open"></i></span>
                <span class="action-title">Ledger</span>
                <span class="action-sub">Track income and expenses with a full report.</span>
              </a>
            </div>
          </section>
        }

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
                    <button class="btn-approve-sm" [disabled]="processingId === charge._id" (click)="quickApprove(charge._id)" aria-label="Approve payment">
                      <i class="fas" [class.fa-circle-notch]="processingId === charge._id" [class.fa-spin]="processingId === charge._id" [class.fa-check]="processingId !== charge._id"></i>
                      <span>{{ processingId === charge._id ? 'Approving...' : 'Approve' }}</span>
                    </button>
                    <a [routerLink]="['/admin/payment-approvals']" class="btn-review-sm" aria-label="Review payment">
                      <i class="fas fa-eye"></i>
                      <span>Review</span>
                    </a>
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
            <a routerLink="/admin/member-credits" class="action-card">
              <span class="action-icon"><i class="fas fa-coins"></i></span>
              <span class="action-title">Member Credits</span>
              <span class="action-sub">Grant and track member credit balances</span>
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
              <a routerLink="/admin/convenience-fee-report" class="action-card">
                <span class="action-icon"><i class="fas fa-percent"></i></span>
                <span class="action-title">Convenience Fee Report</span>
                <span class="action-sub">Fee analytics by date, club, and trend</span>
              </a>
              <a routerLink="/admin/club-calendar" class="action-card">
                <span class="action-icon"><i class="fas fa-calendar-alt"></i></span>
                <span class="action-title">Club Calendar</span>
                <span class="action-sub">View any club's court reservations by month</span>
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
            <!-- Open Play hidden until feature is ready
            <a routerLink="/admin/open-play" class="action-card">
              <span class="action-icon"><i class="fas fa-table-tennis-paddle-ball"></i></span>
              <span class="action-title">Open Play</span>
              <span class="action-sub">Run skill-balanced sessions and track CRI ratings</span>
            </a>
            -->
            @if (!authService.isSuperAdmin() && club?.bookingProcess === 'per_game') {
              <a routerLink="/admin/per-game" class="action-card">
                <span class="action-icon"><i class="fas fa-play-circle"></i></span>
                <span class="action-title">Per Game</span>
                <span class="action-sub">See joined players and record games played</span>
              </a>
            }
            @if (!authService.isSuperAdmin() && isReservationClub) {
              <div class="action-card action-card--toggle">
                <span class="action-icon"><i class="fas fa-calendar-check"></i></span>
                <span class="action-title">Hosted Play Add-on
                  <label class="hpq-switch">
                    <input type="checkbox" [checked]="!!club?.hostedPlayEnabled" [disabled]="togglingHostedPlayAddon" (change)="toggleHostedPlayAddon($any($event.target).checked)" />
                    <span class="hpq-slider"></span>
                  </label>
                </span>
                <span class="action-sub">Run hosted sessions alongside court reservations</span>
              </div>
            }
            @if (!authService.isSuperAdmin() && hostedPlayActive) {
              <a routerLink="/admin/hosted-play" class="action-card">
                <span class="action-icon"><i class="fas fa-calendar-check"></i></span>
                <span class="action-title">Hosted Play</span>
                <span class="action-sub">Schedule play sessions and manage participants</span>
              </a>
            }
            @if (!authService.isSuperAdmin() && hostedPlayActive && club?.hostedPlayQueueEnabled) {
              <a routerLink="/admin/hosted-play" class="action-card action-card--queue">
                <span class="action-icon action-icon--queue"><i class="fas fa-list-ol"></i></span>
                <span class="action-title">Queue Management
                  <span class="queue-live-badge"><i class="fas fa-circle"></i> Live</span>
                </span>
                <span class="action-sub">Check in players, manage courts and live rotation</span>
              </a>
            }
            @if (!authService.isSuperAdmin() && hostedPlayActive) {
              <div class="action-card action-card--toggle" [title]="!duprConfigured ? 'DUPR is not configured on this platform yet' : ''">
                <span class="action-icon"><i class="fas fa-table-tennis-paddle-ball"></i></span>
                <span class="action-title">DUPR Rating Sync
                  <label class="hpq-switch">
                    <input type="checkbox" [checked]="!!club?.duprEnabled" [disabled]="togglingDuprAddon || !duprConfigured" (change)="toggleDuprAddon($any($event.target).checked)" />
                    <span class="hpq-slider"></span>
                  </label>
                </span>
                <span class="action-sub">Submit Hosted Play pickleball scores to DUPR for official ratings</span>
                @if (club?.duprEnabled) {
                  <div class="dupr-club-id-row" (click)="$event.stopPropagation()">
                    <input
                      type="text"
                      placeholder="Your DUPR Club ID"
                      [(ngModel)]="editDuprClubId"
                      [disabled]="savingDuprClubId"
                      (keyup.enter)="saveMyDuprClubId()"
                    />
                    <button type="button" [disabled]="savingDuprClubId" (click)="saveMyDuprClubId()">
                      @if (savingDuprClubId) { <i class="fas fa-circle-notch fa-spin"></i> } @else { Save }
                    </button>
                    @if (duprClubIdSaveMsg) { <span class="dupr-club-id-msg">{{ duprClubIdSaveMsg }}</span> }
                    <span class="dupr-club-id-hint">Find your 10-digit Club ID at <a href="https://www.dupr.com/clubs" target="_blank" rel="noopener" (click)="$event.stopPropagation()">dupr.com/clubs</a> — register your club there first if you haven't already.</span>
                  </div>
                }
              </div>
            }
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
              <a href="/video/hosted-play.mp4" target="_blank" class="action-card">
                <span class="action-icon"><i class="fas fa-circle-play"></i></span>
                <span class="action-title" style="display:flex;align-items:center;gap:4px;">
                  Hosted Play Video
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="opacity:0.55"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </span>
                <span class="action-sub">Hosted Play demo video — share or download</span>
              </a>
            }
          </div>
        </section>

        <!-- ── PREMIUM FEATURES ── -->
        @if (!authService.isSuperAdmin()) {
          <section class="premium-features">
            <div class="section-header">
              <div>
                <p class="section-kicker section-kicker--premium"><i class="fas fa-crown"></i> Premium</p>
                <h3>Premium Features</h3>
              </div>
            </div>

            <div class="action-grid">
              <a routerLink="/admin/finance-report" class="action-card action-card--premium">
                <span class="action-icon action-icon--premium"><i class="fas fa-chart-line"></i></span>
                <span class="action-title">Finance Report
                  <span class="premium-badge"><i class="fas fa-crown"></i> Premium</span>
                </span>
                <span class="action-sub">
                  {{ club?.financeReportEnabled
                    ? 'Income & expenses report for your club'
                    : 'Add-on — subscribe to unlock income & expense reports' }}
                </span>
              </a>
              <a routerLink="/admin/advanced-analytics" class="action-card action-card--premium">
                <span class="action-icon action-icon--premium"><i class="fas fa-chart-pie"></i></span>
                <span class="action-title">Advanced Analytics &amp; Reports
                  <span class="premium-badge"><i class="fas fa-crown"></i> Premium</span>
                </span>
                <span class="action-sub">
                  {{ club?.advancedAnalyticsEnabled
                    ? 'Booking, revenue, and customer analytics for your club'
                    : 'Add-on — subscribe to unlock booking, revenue, and utilization analytics' }}
                </span>
              </a>
              <div class="action-card action-card--toggle action-card--premium">
                <div class="action-card-header">
                  <span class="action-icon action-icon--premium"><i class="fas fa-envelope-circle-check"></i></span>
                  <label class="hpq-switch">
                    <input #emailConfirmationsToggleEl type="checkbox" [checked]="!!club?.emailConfirmationsEnabled" [disabled]="togglingEmailConfirmationsAddon" (change)="onEmailConfirmationsToggleChange($any($event.target).checked, emailConfirmationsToggleEl)" />
                    <span class="hpq-slider"></span>
                  </label>
                </div>
                <span class="action-title">Booking Confirmation Emails
                  <span class="premium-badge"><i class="fas fa-crown"></i> Premium</span>
                </span>
                <span class="action-sub">
                  {{ club?.emailConfirmationsEnabled
                    ? ('Active' + (feeInfo()?.emailConfirmationsMonthlyFee ? ' · ' + (feeInfo()!.emailConfirmationsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2') + '/mo' : ''))
                    : ('Add-on — subscribe to email players a confirmation on every booking' + (feeInfo()?.emailConfirmationsMonthlyFee ? ' (' + (feeInfo()!.emailConfirmationsMonthlyFee | currency: 'PHP' : 'symbol' : '1.0-2') + '/mo)' : '')) }}
                </span>
              </div>
            </div>
          </section>
        }

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
            @if (!isPureHostedPlayClub) {
              <label class="poster-ctrl-label">Date
                <input type="date" class="poster-input" [(ngModel)]="posterDate" (change)="loadPosterData()" />
              </label>
              <label class="poster-ctrl-label">Court
                <select class="poster-input" [(ngModel)]="posterCourt" (ngModelChange)="loadPosterSlots()">
                  @for (c of courtArray(); track c) {
                    <option [value]="c">Court {{ c }}</option>
                  }
                </select>
              </label>
            }
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
                    @if (!isPureHostedPlayClub) {
                      <div [ngStyle]="{ color: '#ffffff', fontWeight: '900', fontSize: '26px', letterSpacing: '3px', textShadow: '0 2px 6px rgba(0,0,0,0.6)', lineHeight: '1.1' }">
                        AVAILABLE SLOTS
                      </div>
                      <div [ngStyle]="{ color: '#e5e7eb', fontSize: '13px', fontWeight: '600', marginTop: '5px', letterSpacing: '1px' }">
                        {{ posterDateLine1() }}
                      </div>
                      <div [ngStyle]="{ color: '#e5e7eb', fontSize: '13px', fontWeight: '600', letterSpacing: '1px' }">
                        {{ posterDateLine2() }}
                      </div>
                    } @else {
                      <div [ngStyle]="{ color: '#ffffff', fontWeight: '900', fontSize: '26px', letterSpacing: '3px', textShadow: '0 2px 6px rgba(0,0,0,0.6)', lineHeight: '1.1' }">
                        HOSTED PLAY
                      </div>
                      <div [ngStyle]="{ color: '#e5e7eb', fontSize: '13px', fontWeight: '600', marginTop: '5px', letterSpacing: '1px' }">
                        UPCOMING SESSIONS
                      </div>
                    }
                  </div>

                  @if (!isPureHostedPlayClub) {
                    <!-- ── Body: court slot list + QR, side by side ── -->
                    <div [ngStyle]="{ display: 'flex', flexDirection: 'row', gap: '16px', flex: '1', minHeight: '0' }">
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
                  } @else {
                    <!-- ── Body: full-width Hosted Play session list, QR centered below ── -->
                    <div [ngStyle]="{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1', minHeight: '0' }">
                      <div [ngStyle]="{ display: 'flex', flexDirection: 'column', gap: '8px' }">
                        @if (posterHostedPlaySessions.length === 0) {
                          <div [ngStyle]="{ color: '#9ca3af', fontSize: '13px' }">No upcoming sessions.</div>
                        }
                        @for (s of posterHostedPlaySessions; track s._id; let i = $index) {
                          <div [ngStyle]="{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'linear-gradient(135deg, #fdfcf8 0%, #eee9db 100%)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 14px rgba(0,0,0,0.28)', borderRadius: '14px' }">
                            <!-- Day badge -->
                            <div [ngStyle]="posterDayBadgeStyle(i)">
                              <span [ngStyle]="{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px', opacity: '0.85' }">{{ posterSessionMonthLabel(s.date) }}</span>
                              <span [ngStyle]="{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }">{{ posterSessionDayNumLabel(s.date) }}</span>
                            </div>

                            <!-- Venue + time -->
                            <div [ngStyle]="{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '5px' }">
                              <div [ngStyle]="{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' }">
                                <span [ngStyle]="{ fontSize: '14px', flexShrink: '0' }">📍</span>
                                <span [ngStyle]="{ color: '#111827', fontSize: '17px', fontWeight: '900', letterSpacing: '0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">
                                  {{ posterSessionVenueLabel(s) }}
                                </span>
                              </div>
                              <div [ngStyle]="{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }">
                                <span [ngStyle]="{ color: '#ffffff', backgroundColor: '#14532d', fontSize: '12px', fontWeight: '800', letterSpacing: '0.3px', padding: '4px 12px', borderRadius: '999px' }">
                                  {{ posterSessionTimeLabel(s) }}
                                </span>
                                <span [ngStyle]="{ color: '#6b7280', fontSize: '12px', fontWeight: '700' }">{{ s.title }}</span>
                              </div>
                            </div>

                            <!-- Venue logo + status -->
                            <div [ngStyle]="{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: '0' }">
                              @if (posterSessionLogo(s)) {
                                <img [src]="posterSessionLogo(s)"
                                     [ngStyle]="{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #14532d', backgroundColor: '#ffffff' }"
                                     alt="" crossorigin="anonymous" />
                              }
                              <span [ngStyle]="s.currentPlayers < s.maxPlayers ? posterHPOpenBadgeStyle() : posterHPTakenBadgeStyle()">
                                {{ s.currentPlayers < s.maxPlayers ? 'OPEN' : 'FULL' }}
                              </span>
                            </div>
                          </div>
                        }
                      </div>

                      @if (club?.bookingQrCode) {
                        <div [ngStyle]="{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', margin: '6px 0 0' }">
                          <span [ngStyle]="{ color: '#ffffff', fontWeight: '800', fontSize: '14px', letterSpacing: '1px', textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }">SCAN TO BOOK:</span>
                          <img [src]="club!.bookingQrCode!"
                               [ngStyle]="{ width: '150px', height: '150px', borderRadius: '6px', backgroundColor: '#ffffff', padding: '5px', display: 'block' }"
                               alt="Booking QR Code"
                               crossorigin="anonymous" />
                        </div>
                      }
                    </div>
                  }

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

        <!-- Booking link QR -->
        @if (club) {
          <section class="qr-link-section">
            <div class="section-header">
              <div>
                <p class="section-kicker">Share</p>
                <h3>Your Booking Link</h3>
              </div>
            </div>

            <div class="qr-link-body">
              <div #qrLinkCardRef class="qr-link-shareable">
                @if (bookingLinkQrDataUrl) {
                  <img [src]="bookingLinkQrDataUrl" alt="Booking link QR code" class="qr-link-image" />
                } @else {
                  <div class="qr-link-image qr-link-image--placeholder">
                    <i class="fas fa-circle-notch fa-spin"></i>
                  </div>
                }
                <p class="qr-link-shareable-caption">Scan to book at {{ club.name }}</p>
              </div>

              <div class="qr-link-info">
                <p class="qr-link-desc">Players can scan this code or use the link below to book courts at your club directly.</p>
                <div class="qr-link-row">
                  <input type="text" class="poster-input qr-link-input" [value]="bookingLinkUrl" readonly
                         (focus)="$any($event.target).select()" />
                  <button type="button" class="poster-action-btn poster-action-btn--primary"
                          (click)="copyBookingLinkUrl()" [disabled]="!bookingLinkUrl">
                    <i class="fas {{ bookingLinkCopied ? 'fa-check' : 'fa-copy' }}"></i>
                    {{ bookingLinkCopied ? 'Copied!' : 'Copy Link' }}
                  </button>
                </div>
                <div class="qr-link-row">
                  <button type="button" class="poster-action-btn" (click)="copyQrLinkImage()" [disabled]="capturingQrLinkImage || !bookingLinkQrDataUrl">
                    <i class="fas {{ capturingQrLinkImage ? 'fa-circle-notch fa-spin' : 'fa-copy' }}"></i>
                    {{ capturingQrLinkImage ? 'Capturing…' : 'Copy Image' }}
                  </button>
                  @if (qrLinkImageCopied) {
                    <span class="poster-copied-toast"><i class="fas fa-check-circle"></i> Copied!</span>
                  }
                </div>
              </div>
            </div>
          </section>
        }
      }
    </section>

    @if (supportChatOpen) {
      <app-admin-chat-modal
        [recipientId]="supportContactId"
        [recipientName]="supportContactName"
        (closed)="closeSupportChat()"
      />
    }

    @if (showBalanceAlert()) {
      <app-balance-alert-modal
        [balance]="balanceAlertAmount()"
        (dismissed)="showBalanceAlert.set(false)"
      />
    }

    @if (showAnnouncementModal()) {
      <app-announcement-modal
        [title]="announcementTitle()"
        [html]="announcementHtml()"
        [confirming]="announcementConfirming()"
        (confirmed)="onAnnouncementConfirmed()"
        (closed)="showAnnouncementModal.set(false)"
      />
    }

    @if (showEmailConfirmationsConfirm) {
      <div class="modal-backdrop" (click)="cancelEmailConfirmationsSubscribe()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-envelope-circle-check"></i> Subscribe to Email Confirmations</div>
            <button class="modal-close" (click)="cancelEmailConfirmationsSubscribe()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>
              This subscribes your club to the Email Confirmations add-on for
              <strong>{{ (feeInfo()?.emailConfirmationsMonthlyFee ?? 199) | currency: 'PHP' : 'symbol' : '1.0-2' }}/month</strong>.
            </p>
            <ul class="modal-bullets">
              <li>Players automatically get a booking confirmation email for every reservation.</li>
              <li>The current month is billed immediately, then again automatically each month while it stays enabled.</li>
              <li>The charge is added to your App Service balance — same as your other add-ons and convenience fees.</li>
            </ul>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="cancelEmailConfirmationsSubscribe()" [disabled]="togglingEmailConfirmationsAddon">Cancel</button>
            <button class="btn-confirm-subscribe" (click)="confirmEmailConfirmationsSubscribe()" [disabled]="togglingEmailConfirmationsAddon">
              @if (togglingEmailConfirmationsAddon) { <i class="fas fa-circle-notch fa-spin"></i> Subscribing... }
              @else { <i class="fas fa-check"></i> Subscribe }
            </button>
          </div>
        </div>
      </div>
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
      .quick-actions,
      .premium-features {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 0.95rem;
        box-shadow: 0 8px 22px rgba(0,0,0,0.32);
      }

      .premium-features {
        border-color: rgba(250,204,21,.28);
      }

      .section-kicker--premium {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
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
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: .3rem .45rem;
      }

      .action-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .action-sub {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.72);
      }

      .action-card--toggle { cursor: default; }
      .action-card--toggle:hover { transform: none; }
      .action-card--toggle .action-title { justify-content: space-between; }
      .hpq-switch { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
      .hpq-switch input { opacity: 0; width: 0; height: 0; }
      .hpq-slider { position: absolute; inset: 0; cursor: pointer; background: rgba(255,255,255,.16); border-radius: 999px; transition: .2s; }
      .hpq-slider:before { content: ""; position: absolute; height: 20px; width: 20px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
      .hpq-switch input:checked + .hpq-slider { background: var(--dm-accent); }
      .hpq-switch input:checked + .hpq-slider:before { transform: translateX(20px); }
      .hpq-switch input:disabled + .hpq-slider { opacity: .5; cursor: wait; }
      .dupr-club-id-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 0.6rem;
        cursor: default;
        flex-wrap: wrap;
      }
      .dupr-club-id-row input {
        flex: 1;
        min-width: 120px;
        padding: 0.4rem 0.6rem;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06);
        color: #fff;
        font-size: 0.78rem;
        font-family: inherit;
      }
      .dupr-club-id-row input:disabled { opacity: 0.6; }
      .dupr-club-id-row button {
        flex-shrink: 0;
        padding: 0.4rem 0.8rem;
        border-radius: 8px;
        border: none;
        background: var(--dm-accent);
        color: #07130d;
        font-weight: 800;
        font-size: 0.78rem;
        cursor: pointer;
      }
      .dupr-club-id-row button:disabled { opacity: 0.6; cursor: not-allowed; }
      .dupr-club-id-msg { font-size: 0.72rem; color: var(--dm-accent); flex-basis: 100%; }
      .dupr-club-id-hint { font-size: 0.68rem; color: rgba(255,255,255,0.5); flex-basis: 100%; line-height: 1.4; }
      .dupr-club-id-hint a { color: var(--dm-accent); text-decoration: underline; }

      .action-card--queue {
        border-color: rgba(56,189,248,.22);
        background: rgba(56,189,248,.05);
      }
      .action-card--queue:hover {
        border-color: rgba(56,189,248,.45);
        box-shadow: 0 10px 22px rgba(56,189,248,.1);
      }
      .action-icon--queue {
        background: rgba(56,189,248,.14);
        color: #38bdf8;
      }
      .queue-live-badge {
        display: inline-flex;
        align-items: center;
        gap: .25rem;
        font-size: .62rem;
        font-weight: 900;
        color: #07130d;
        background: #a3e635;
        border-radius: 99px;
        padding: .1rem .4rem;
      }

      .action-card--premium {
        border-color: rgba(250,204,21,.24);
        background: rgba(250,204,21,.04);
      }
      .action-card--premium:hover {
        border-color: rgba(250,204,21,.5);
        box-shadow: 0 10px 22px rgba(250,204,21,.1);
      }
      .action-icon--premium {
        background: rgba(250,204,21,.14);
        color: #facc15;
      }
      .premium-badge {
        display: inline-flex;
        align-items: center;
        gap: .25rem;
        font-size: .62rem;
        font-weight: 900;
        color: #1c1503;
        background: #facc15;
        border-radius: 99px;
        padding: .1rem .4rem;
      }

      .modal-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        z-index: 100; display: flex; align-items: center; justify-content: center;
        padding: 20px;
      }
      .modal {
        background: var(--dm-surface); border-radius: 14px; width: 100%; max-width: 440px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.45);
        border: 1px solid rgba(250,204,21,0.24); overflow: hidden;
      }
      .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(250,204,21,0.08);
      }
      .modal-title {
        font-size: 1rem; font-weight: 800; color: #facc15;
        display: flex; align-items: center; gap: 8px;
      }
      .modal-close {
        background: none; border: none; font-size: 1rem; color: rgba(255,255,255,0.5);
        cursor: pointer; padding: 4px 8px; border-radius: 4px;
      }
      .modal-close:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
      .modal-body { padding: 18px 20px; font-size: 0.88rem; color: rgba(255,255,255,0.85); line-height: 1.5; }
      .modal-body p { margin: 0 0 10px; }
      .modal-bullets { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 6px; }
      .modal-footer {
        display: flex; justify-content: flex-end; gap: 10px;
        padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02);
      }
      .btn-cancel {
        padding: 8px 16px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-family: inherit;
      }
      .btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
      .btn-confirm-subscribe {
        padding: 8px 18px; background: rgba(250,204,21,0.2); color: #facc15;
        border: 1px solid rgba(250,204,21,0.4); border-radius: 8px; font-size: 0.875rem; font-weight: 700;
        cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit;
        transition: background 0.15s;
      }
      .btn-confirm-subscribe:hover:not(:disabled) { background: rgba(250,204,21,0.32); }
      .btn-confirm-subscribe:disabled, .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
      .queue-live-badge i {
        font-size: .45rem;
        animation: pulse-dot 1.4s ease-in-out infinite;
      }
      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: .3; }
      }

      .balance-due-card {
        background: var(--card-bg);
        border: 1px solid rgba(163,230,53,0.18);
        border-radius: 14px;
        padding: 0.8rem 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        box-shadow: 0 2px 12px rgba(0,0,0,0.24);
      }

      .balance-due-card--owed {
        border-color: rgba(251,146,60,0.35);
        background: rgba(251,146,60,0.06);
      }

      .balance-due-left {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }

      .balance-due-icon {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: rgba(163,230,53,0.12);
        color: var(--gold);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        flex-shrink: 0;
      }

      .balance-due-card--owed .balance-due-icon {
        background: rgba(251,146,60,0.14);
        color: #fb923c;
      }

      .balance-due-label {
        margin: 0;
        font-size: 0.78rem;
        color: rgba(255,255,255,0.65);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .balance-due-amount {
        margin: 0.15rem 0 0;
        font-size: 1.22rem;
        font-weight: 800;
        color: #ffffff;
      }

      .balance-due-card--owed .balance-due-amount {
        color: #fb923c;
      }

      .balance-due-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.3rem;
      }

      .balance-due-due {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.6);
        font-weight: 600;
      }

      .balance-due-link {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--gold);
        text-decoration: none;
      }

      .balance-due-link:hover { text-decoration: underline; }

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

      .qr-link-section {
        background: var(--dm-surface);
        border: 1px solid rgba(163,230,53,0.12);
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 6px 16px rgba(0,0,0,0.24);
      }

      .qr-link-body {
        display: flex;
        align-items: center;
        gap: 1.1rem;
      }

      .qr-link-shareable {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
        padding: 10px;
        background: #ffffff;
        border-radius: 10px;
      }

      .qr-link-shareable-caption {
        margin: 0;
        font-size: 0.7rem;
        font-weight: 700;
        color: #111827;
        text-align: center;
      }

      .qr-link-image {
        width: 120px;
        height: 120px;
        border-radius: 8px;
        background: #ffffff;
        object-fit: contain;
      }

      .qr-link-image--placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(0,0,0,0.35);
        font-size: 1.4rem;
      }

      .qr-link-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .qr-link-desc {
        margin: 0;
        font-size: 0.82rem;
        color: rgba(255,255,255,0.6);
        line-height: 1.4;
      }

      .qr-link-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .qr-link-input {
        flex: 1;
        min-width: 200px;
        cursor: text;
      }

      @media (max-width: 640px) {
        .dashboard-shell {
          padding: 0;
          margin: 0 -1.5rem;
          overflow-x: hidden;
          gap: 0.75rem;
          background:
            radial-gradient(circle at 16% 0%, rgba(163,230,53,0.12), transparent 28%),
            var(--dm-bg);
        }

        .hero-panel {
          margin: 0;
          border-left: 0;
          border-right: 0;
          border-radius: 0;
          padding: 1rem;
          background:
            linear-gradient(90deg, rgba(6,18,11,0.96), rgba(18,50,32,0.78)),
            url('/tennis-court-surface.png') center/cover;
        }

        .hero-kicker {
          font-size: 0.66rem;
        }

        .hero-panel h2 {
          font-size: 1.45rem;
          line-height: 1.05;
        }

        .hero-subtitle {
          max-width: 24rem;
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .btn-primary,
        .btn-secondary {
          min-height: 42px;
          border-radius: 8px;
        }

        .state-shell,
        .approvals-section,
        .quick-actions,
        .premium-features,
        .poster-section,
        .qr-link-section {
          margin: 0 0.75rem;
          border-radius: 10px;
          padding: 0.85rem;
        }

        .stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          padding: 0 0.75rem;
        }

        .stat-card {
          min-height: auto;
          padding: 0.72rem 0.55rem;
          align-items: center;
          justify-items: center;
          text-align: center;
          gap: 0.28rem;
          border-radius: 10px;
          border-color: rgba(163,230,53,0.18);
          background: rgba(255,255,255,0.04);
        }

        .stat-head {
          display: contents;
        }

        .stat-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          font-size: 0.78rem;
        }

        .stat-value {
          font-size: clamp(0.98rem, 4.6vw, 1.2rem);
          line-height: 1.05;
          overflow-wrap: anywhere;
        }

        .stat-label {
          font-size: 0.58rem;
          line-height: 1.12;
          letter-spacing: 0.035em;
          text-transform: uppercase;
        }

        .stat-link {
          display: none;
        }

        .section-header {
          align-items: flex-start;
          margin-bottom: 0.65rem;
        }

        .section-kicker {
          font-size: 0.64rem;
        }

        .section-header h3 {
          font-size: 0.95rem;
        }

        .section-link {
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0 0.65rem;
          background: rgba(163,230,53,0.1);
          border: 1px solid rgba(163,230,53,0.18);
          text-decoration: none;
        }

        .approval-row {
          align-items: stretch;
          padding: 0.7rem;
          border-radius: 10px;
        }

        .approval-player {
          font-size: 0.88rem;
        }

        .approval-detail {
          font-size: 0.72rem;
          line-height: 1.3;
        }

        .approval-actions {
          display: grid;
          grid-template-columns: 42px 42px;
          gap: 0.45rem;
          align-items: center;
          justify-content: flex-start;
        }

        .approval-amt {
          grid-column: 1 / -1;
          font-size: 1rem;
        }

        .btn-approve-sm,
        .btn-review-sm {
          width: 42px;
          height: 42px;
          min-height: 42px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          gap: 0.35rem;
          min-width: 0;
        }

        .btn-approve-sm span,
        .btn-review-sm span {
          display: none;
        }

        .btn-approve-sm i,
        .btn-review-sm i {
          font-size: 0.9rem;
        }

        .action-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .action-card {
          min-height: 116px;
          padding: 0.68rem;
          border-radius: 10px;
          align-content: start;
          gap: 0.28rem;
        }

        .action-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          font-size: 0.82rem;
        }

        .action-title {
          font-size: 0.78rem;
          line-height: 1.16;
        }

        .action-sub {
          font-size: 0.66rem;
          line-height: 1.25;
        }

        .queue-live-badge {
          font-size: 0.52rem;
          padding: 0.08rem 0.32rem;
        }

        .balance-due-card {
          margin: 0 0.75rem;
          border-radius: 10px;
          padding: 0.75rem;
        }

        .balance-due-right {
          align-items: flex-start;
        }

        .poster-ctrl-row,
        .poster-ctrl-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          align-items: stretch;
        }

        .poster-ctrl-actions {
          grid-column: 1 / -1;
        }

        .poster-ctrl-label,
        .poster-upload-btn,
        .poster-remove-btn,
        .poster-action-btn {
          width: 100%;
        }

        .poster-upload-btn,
        .poster-remove-btn,
        .poster-action-btn {
          min-height: 40px;
          justify-content: center;
          padding: 0.55rem 0.5rem;
          border-radius: 8px;
          font-size: 0.74rem;
        }

        .poster-input {
          min-height: 40px;
          width: 100%;
        }

        .qr-link-body {
          flex-direction: column;
          align-items: stretch;
          text-align: center;
        }

        .qr-link-image {
          width: 100%;
          max-width: 160px;
          height: auto;
          aspect-ratio: 1 / 1;
          margin: 0 auto;
        }

        .qr-link-row {
          flex-direction: column;
        }

        .qr-link-input,
        .qr-link-row .poster-action-btn {
          width: 100%;
          min-height: 40px;
        }

        /* Swipeable dashboard cards on phones */
        .stats-grid,
        .action-grid {
          display: flex;
          grid-template-columns: none;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scroll-padding-inline: 0.75rem;
          overscroll-behavior-inline: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: rgba(163,230,53,0.45) rgba(255,255,255,0.06);
          padding-bottom: 0.6rem;
        }

        .stats-grid::-webkit-scrollbar,
        .action-grid::-webkit-scrollbar {
          height: 4px;
        }

        .stats-grid::-webkit-scrollbar-track,
        .action-grid::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
        }

        .stats-grid::-webkit-scrollbar-thumb,
        .action-grid::-webkit-scrollbar-thumb {
          background: rgba(163,230,53,0.45);
          border-radius: 999px;
        }

        .stats-grid .stat-card {
          flex: 0 0 min(72vw, 250px);
          scroll-snap-align: start;
        }

        .action-grid .action-card {
          flex: 0 0 min(76vw, 270px);
          scroll-snap-align: start;
        }
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
  posterHostedPlaySessions: HostedPlaySession[] = [];
  loadingPosterSlots = false;
  uploadingPosterQr = false;
  capturingPoster = false;
  posterCopied = false;

  // ── Booking link QR ──
  @ViewChild('qrLinkCardRef') qrLinkCardRef!: ElementRef;
  bookingLinkUrl = '';
  bookingLinkQrDataUrl: string | null = null;
  bookingLinkCopied = false;
  capturingQrLinkImage = false;
  qrLinkImageCopied = false;

  // ── Support chat (club admin only) ──
  messageUnreadCount = 0;
  supportChatOpen = false;
  supportContactId = '';
  supportContactName = 'CourtGo Support';
  private msgPollInterval: ReturnType<typeof setInterval> | null = null;

  // ── Hosted Play add-on toggle (reservation-mode clubs) ──
  togglingHostedPlayAddon = false;
  togglingEmailConfirmationsAddon = false;
  showEmailConfirmationsConfirm = false;
  private pendingEmailConfirmationsToggleEl: HTMLInputElement | null = null;
  get isReservationClub() {
    return !!this.club && (this.club.bookingProcess ?? 'reservation') === 'reservation';
  }
  get hostedPlayActive() {
    return this.club?.bookingProcess === 'hosted_play' || !!this.club?.hostedPlayEnabled;
  }
  get isPureHostedPlayClub() {
    return this.club?.bookingProcess === 'hosted_play';
  }

  // ── Balance alert modal ──
  showBalanceAlert = signal(false);
  balanceAlertAmount = signal(0);

  // ── Announcement modal ──
  showAnnouncementModal = signal(false);
  announcementTitle = signal('');
  announcementHtml = signal<SafeHtml>('');
  announcementConfirming = signal(false);

  // ── App service balance due card ──
  feeInfo = signal<{ balance: number; convenienceFeeMode: string; convenienceFeeMonthlyAmount: number; balanceAlertEnabled: boolean; emailConfirmationsMonthlyFee?: number } | null>(null);
  readonly monthEndDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

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
    private appServicePayments: AppServicePaymentsService,
    private announcementService: AnnouncementService,
    private hostedPlayService: HostedPlayService,
    private sanitizer: DomSanitizer,
    private duprService: DuprService,
  ) {}

  duprConfigured = false;
  togglingDuprAddon = false;
  editDuprClubId = '';
  savingDuprClubId = false;
  duprClubIdSaveMsg = '';

  toggleDuprAddon(enabled: boolean) {
    if (!this.club || this.togglingDuprAddon || !this.duprConfigured) return;
    this.togglingDuprAddon = true;
    this.clubService.patchMyDuprAddon(enabled).subscribe({
      next: (club) => {
        this.club = { ...this.club!, duprEnabled: !!club.duprEnabled };
        this.togglingDuprAddon = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.togglingDuprAddon = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveMyDuprClubId() {
    if (!this.club || this.savingDuprClubId) return;
    this.savingDuprClubId = true;
    this.duprClubIdSaveMsg = '';
    this.clubService.patchMyDuprClubId(this.editDuprClubId.trim() || null).subscribe({
      next: (res) => {
        this.club = { ...this.club!, duprClubId: res.duprClubId };
        this.savingDuprClubId = false;
        this.duprClubIdSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.duprClubIdSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => {
        this.savingDuprClubId = false;
        this.duprClubIdSaveMsg = 'Failed to save.';
        this.cdr.detectChanges();
      },
    });
  }

  toggleHostedPlayAddon(enabled: boolean) {
    if (!this.club || this.togglingHostedPlayAddon) return;
    this.togglingHostedPlayAddon = true;
    this.clubService.patchMyHostedPlayAddon(enabled).subscribe({
      next: (club) => {
        this.club = { ...this.club!, hostedPlayEnabled: !!club.hostedPlayEnabled };
        this.togglingHostedPlayAddon = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.togglingHostedPlayAddon = false;
        this.cdr.detectChanges();
      },
    });
  }

  onEmailConfirmationsToggleChange(checked: boolean, inputEl: HTMLInputElement) {
    if (checked) {
      // Turning on costs money — confirm before actually subscribing. Angular's [checked]
      // binding won't revert the DOM checkbox on cancel (its bound value never changes), so
      // we hang onto the element and reset it manually if the user backs out.
      this.pendingEmailConfirmationsToggleEl = inputEl;
      this.showEmailConfirmationsConfirm = true;
    } else {
      this.toggleEmailConfirmationsAddon(false);
    }
  }

  cancelEmailConfirmationsSubscribe() {
    if (this.togglingEmailConfirmationsAddon) return;
    if (this.pendingEmailConfirmationsToggleEl) {
      this.pendingEmailConfirmationsToggleEl.checked = false;
      this.pendingEmailConfirmationsToggleEl = null;
    }
    this.showEmailConfirmationsConfirm = false;
    this.cdr.detectChanges();
  }

  confirmEmailConfirmationsSubscribe() {
    this.pendingEmailConfirmationsToggleEl = null;
    this.toggleEmailConfirmationsAddon(true);
    this.showEmailConfirmationsConfirm = false;
  }

  toggleEmailConfirmationsAddon(enabled: boolean) {
    if (!this.club || this.togglingEmailConfirmationsAddon) return;
    this.togglingEmailConfirmationsAddon = true;
    this.clubService.patchMyEmailConfirmationsAddon(enabled).subscribe({
      next: (club) => {
        this.club = {
          ...this.club!,
          emailConfirmationsEnabled: !!club.emailConfirmationsEnabled,
          emailConfirmationsSubscribedAt: club.emailConfirmationsSubscribedAt ?? null,
        };
        this.togglingEmailConfirmationsAddon = false;
        this.appServicePayments.getFeeInfo().subscribe({
          next: (info) => this.feeInfo.set(info),
          error: () => {},
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.togglingEmailConfirmationsAddon = false;
        this.cdr.detectChanges();
      },
    });
  }

  ngOnInit() {
    const today = new Date();
    this.posterDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const clubId = this.authService.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (c) => {
          this.club = c;
          this.editDuprClubId = c.duprClubId ?? '';
          if (this.isPureHostedPlayClub) this.loadPosterHostedPlaySessions();
          else this.loadPosterSlots();
          this.buildBookingLinkQr();
          this.cdr.detectChanges();
        },
      });
    }

    this.adminMessages.getUnreadCount().subscribe({
      next: ({ count }) => { this.messageUnreadCount = count; this.cdr.detectChanges(); },
      error: () => {},
    });

    if (!this.authService.isSuperAdmin()) {
      this.duprService.getStatus().subscribe({
        next: (status) => { this.duprConfigured = status.configured; this.cdr.detectChanges(); },
        error: () => {},
      });
    }

    this.msgPollInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
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

    const user = this.authService.user();
    if (user?.role === 'admin') {
      this.appServicePayments.getFeeInfo().subscribe({
        next: (info) => {
          this.feeInfo.set(info);
          if (info.balanceAlertEnabled && info.balance > 0) {
            this.balanceAlertAmount.set(info.balance);
            this.showBalanceAlert.set(true);
            this.cdr.detectChanges();
          }
        },
        error: (err) => console.error('Balance alert check failed:', err),
      });

      this.announcementService.getAnnouncement().subscribe({
        next: (announcement) => {
          if (announcement.enabled && announcement.acceptedVersion !== announcement.version) {
            this.announcementTitle.set(announcement.title || 'Announcement');
            const html = marked.parse(announcement.text || '') as string;
            this.announcementHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
            this.showAnnouncementModal.set(true);
            this.cdr.detectChanges();
          }
        },
        error: (err) => console.error('Announcement check failed:', err),
      });
    }
  }

  onAnnouncementConfirmed(): void {
    if (this.announcementConfirming()) return;
    this.announcementConfirming.set(true);
    this.announcementService.acceptAnnouncement().subscribe({
      next: () => {
        this.announcementConfirming.set(false);
        this.showAnnouncementModal.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Announcement confirm failed:', err);
        this.announcementConfirming.set(false);
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
        for (let h = open; h <= close; h++) {
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

  loadPosterHostedPlaySessions() {
    this.loadingPosterSlots = true;
    this.posterHostedPlaySessions = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    this.hostedPlayService.listAll().subscribe({
      next: (sessions) => {
        this.posterHostedPlaySessions = sessions
          .filter((s) => (s.status === 'open' || s.status === 'full' || s.status === 'closed') && s.date?.slice(0, 10) >= todayStr)
          .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
        this.loadingPosterSlots = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPosterSlots = false; this.cdr.detectChanges(); },
    });
  }

  posterSessionMonthLabel(dateStr: string): string {
    const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return months[d.getMonth()];
  }

  posterSessionDayNumLabel(dateStr: string): string {
    const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
    return String(d.getDate());
  }

  posterDayBadgeStyle(index: number): Record<string, string> {
    const light = index % 2 === 0;
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '54px',
      height: '54px',
      borderRadius: '12px',
      flexShrink: '0',
      backgroundColor: light ? '#a3e635' : '#14532d',
      color: light ? '#111827' : '#ffffff',
    };
  }

  private formatClockTime(hhmm: string): string {
    const [hStr, mStr] = (hhmm || '0:0').split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  posterSessionTimeLabel(s: HostedPlaySession): string {
    return `${this.formatClockTime(s.startTime)} - ${this.formatClockTime(s.endTime)}`;
  }

  posterSessionVenueLabel(s: HostedPlaySession): string {
    return this.courtForSession(s)?.name || s.venue || s.court || s.title || 'Venue';
  }

  private courtForSession(s: HostedPlaySession): Court | undefined {
    const venue = (s.venue || '').trim().toLowerCase();
    const court = (s.court || '').trim().toLowerCase();
    return this.club?.courts?.find((c) => {
      const name = c.name.trim().toLowerCase();
      return name === venue || (!!court && name === court);
    });
  }

  posterSessionLogo(s: HostedPlaySession): string {
    return this.courtForSession(s)?.logo || '';
  }

  loadPosterData() {
    if (this.isPureHostedPlayClub) this.loadPosterHostedPlaySessions();
    else this.loadPosterSlots();
  }

  private slotKey(h: number): string {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
  }

  private slotLabel(h: number): string {
    const fmt = (hr: number) => {
      const h24 = hr % 24;
      const period = h24 < 12 ? 'AM' : 'PM';
      const disp = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
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

  private buildBookingLinkQr() {
    if (!this.club) return;
    const identifier = this.club.slug || this.club._id;
    this.bookingLinkUrl = `${window.location.origin}/book/${identifier}`;

    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, this.bookingLinkUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(() => this.overlayClubLogo(canvas))
      .then((dataUrl) => { this.bookingLinkQrDataUrl = dataUrl; this.cdr.detectChanges(); })
      .catch(() => { this.bookingLinkQrDataUrl = null; this.cdr.detectChanges(); });
  }

  private overlayClubLogo(canvas: HTMLCanvasElement): Promise<string> {
    const logoUrl = this.club?.logo;
    if (!logoUrl) return Promise.resolve(canvas.toDataURL('image/png'));

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(canvas.toDataURL('image/png')); return; }

        const size = canvas.width * 0.22;
        const x = (canvas.width - size) / 2;
        const y = (canvas.height - size) / 2;
        const pad = size * 0.14;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
        ctx.drawImage(img, x, y, size, size);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(canvas.toDataURL('image/png'));
      img.src = logoUrl;
    });
  }

  copyBookingLinkUrl() {
    if (!this.bookingLinkUrl) return;
    navigator.clipboard.writeText(this.bookingLinkUrl).then(() => {
      this.bookingLinkCopied = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.bookingLinkCopied = false; this.cdr.detectChanges(); }, 2000);
    });
  }

  async copyQrLinkImage() {
    if (!this.qrLinkCardRef) return;
    this.capturingQrLinkImage = true;
    this.qrLinkImageCopied = false;
    this.cdr.detectChanges();
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(this.qrLinkCardRef.nativeElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error('No blob')); return; }
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            resolve();
          } catch (e) { reject(e); }
        }, 'image/png');
      });
      this.qrLinkImageCopied = true;
      setTimeout(() => { this.qrLinkImageCopied = false; this.cdr.detectChanges(); }, 2500);
    } catch (e) {
      console.error('Copy QR link image failed', e);
    } finally {
      this.capturingQrLinkImage = false;
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

  posterHPOpenBadgeStyle(): Record<string, string> {
    return {
      background: '#15803d',
      color: '#ffffff',
      fontWeight: '800',
      fontSize: '15px',
      padding: '6px 18px',
      borderRadius: '6px',
      letterSpacing: '1px',
      flexShrink: '0',
    };
  }

  posterHPTakenBadgeStyle(): Record<string, string> {
    return {
      background: '#374151',
      color: '#9ca3af',
      fontWeight: '800',
      fontSize: '15px',
      padding: '6px 18px',
      borderRadius: '6px',
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

