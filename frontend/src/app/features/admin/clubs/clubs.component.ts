import { Component, OnInit, OnDestroy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ClubService, Club, AdditionalFee } from '../../../core/services/club.service';
import { UsersService } from '../../../core/services/users.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AppServicePaymentsService, AppServicePayment } from '../../../core/services/app-service-payments.service';
import { AuthService } from '../../../core/services/auth.service';
import { InquiriesService, Inquiry } from '../../../core/services/inquiries.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminMessagesService } from '../../../core/services/admin-messages.service';
import { AdminChatModalComponent } from '../../../shared/components/admin-chat-modal/admin-chat-modal.component';
import { SoundService } from '../../../core/services/sound.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';

interface AdminUser {
  _id: string;
  name: string;
  username: string;
  email?: string;
  role: string;
  status: string;
  profileImage?: string;
  clubId?: { _id: string; name: string } | string;
  createdAt: string;
}

@Component({
  selector: 'app-admin-clubs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminChatModalComponent],
  template: `
    <div class="clubs-page">

      <!-- ── Hero ── -->
      <header class="hero-panel">
        <div class="hero-left">
          <div class="hero-badge hero-badge-logo"><img src="/CG.png" alt="CourtGo" class="hero-badge-img" /></div>
          <div class="hero-text">
            <p class="hero-kicker"><i class="fas fa-bolt"></i> Superadmin Workspace</p>
            <h2 class="hero-title">Club Portfolio</h2>
            <p class="hero-sub">Manage clubs, admins, payments, and app service fees.</p>
            @if (dbStatus()) {
              <span class="db-badge" [class.db-local]="dbStatus()!.db === 'local'" [class.db-atlas]="dbStatus()!.db === 'atlas'">
                <i class="fas fa-database"></i>
                {{ dbStatus()!.db === 'local' ? 'Local DB' : 'Production DB' }} &middot; {{ dbStatus()!.dbHost }}
              </span>
              <span class="db-badge" [class.db-local]="dbStatus()!.runtime === 'local'" [class.db-atlas]="dbStatus()!.runtime !== 'local'">
                <i class="fas fa-server"></i>
                {{ dbStatus()!.runtime === 'render' ? 'Render' : dbStatus()!.runtime === 'netlify' ? 'Netlify Functions' : 'Local Server' }}
              </span>
            }
          </div>
        </div>
        <div class="hero-actions">
          <button type="button" class="btn btn-notif" (click)="showNotifications = !showNotifications" title="Notifications">
            <i class="fas fa-bell"></i>
            @if (notifService.unreadCount() > 0) {
              <span class="notif-badge">{{ notifService.unreadCount() }}</span>
            }
          </button>
          <span class="count-chip">
            <i class="fas fa-shield-alt"></i>
            {{ clubs.length }} {{ clubs.length === 1 ? 'Club' : 'Clubs' }}
          </span>
          <a routerLink="/player/dashboard" class="btn btn-purple">
            <i class="fas fa-user"></i> Player Dashboard
          </a>
          <a routerLink="/admin/terms-editor" class="btn btn-dev">
            <i class="fas fa-file-contract"></i> T&amp;C Editor
          </a>
          <a routerLink="/admin/announcement-editor" class="btn btn-dev">
            <i class="fas fa-bullhorn"></i> Announcements
          </a>
          <a routerLink="/admin/dev-finance" class="btn btn-dev">
            <i class="fas fa-chart-line"></i> Dev Finance
          </a>
          <a routerLink="/admin/clubs/new" class="btn btn-primary">
            <i class="fas fa-plus"></i> New Club
          </a>
        </div>
      </header>

      <!-- ── Notification inbox panel ── -->
      @if (showNotifications) {
        <div class="notif-panel">
          <div class="notif-panel-header">
            <span class="notif-panel-title"><i class="fas fa-bell"></i> Notifications</span>
            @if (notifService.unreadCount() > 0) {
              <button type="button" class="btn-text" (click)="notifService.markAllRead()">Mark all read</button>
            }
            <button type="button" class="notif-close" (click)="showNotifications = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="notif-list">
            @if (notifService.notifications().length === 0) {
              <p class="notif-empty">No notifications yet.</p>
            }
            @for (notif of notifService.notifications(); track notif._id) {
              <div class="notif-item" [class.notif-unread]="!notif.read" (click)="notifService.markRead(notif._id)">
                <div class="notif-icon">
                  <i class="fas fa-building"></i>
                </div>
                <div class="notif-content">
                  <p class="notif-title">{{ notif.title }}</p>
                  <p class="notif-body">{{ notif.body }}</p>
                  <p class="notif-time">{{ formatDate(notif.createdAt) }}</p>
                </div>
                @if (!notif.read) {
                  <span class="notif-dot"></span>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- ── KPI stat row ── -->
      @if (!loading && !error && clubs.length > 0) {
        <div class="kpi-row">
          <div class="kpi-card kpi-lime">
            <div class="kpi-icon"><i class="fas fa-shield-halved"></i></div>
            <div class="kpi-meta">
              <span class="kpi-value">{{ clubs.length }}</span>
              <span class="kpi-label">Total Clubs</span>
            </div>
          </div>
          <div class="kpi-card kpi-green">
            <div class="kpi-icon"><i class="fas fa-circle-check"></i></div>
            <div class="kpi-meta">
              <span class="kpi-value">{{ activeClubCount }}</span>
              <span class="kpi-label">Active</span>
            </div>
          </div>
          <div class="kpi-card kpi-rose">
            <div class="kpi-icon"><i class="fas fa-ban"></i></div>
            <div class="kpi-meta">
              <span class="kpi-value">{{ suspendedClubCount }}</span>
              <span class="kpi-label">Suspended</span>
            </div>
          </div>
          <div class="kpi-card kpi-amber">
            <div class="kpi-icon"><i class="fas fa-file-circle-exclamation"></i></div>
            <div class="kpi-meta">
              <span class="kpi-value">{{ tcPendingCount }}</span>
              <span class="kpi-label">T&amp;C Pending</span>
            </div>
          </div>
          @if (auth.isSuperAdmin()) {
            <div class="kpi-card kpi-orange">
              <div class="kpi-icon"><i class="fas fa-coins"></i></div>
              <div class="kpi-meta">
                <span class="kpi-value">₱{{ outstandingTotal | number:'1.0-0' }}</span>
                <span class="kpi-label">Outstanding</span>
              </div>
            </div>
          }
        </div>
      }

      <!-- ── App Reviews Panel (superadmin only) ── -->
      @if (auth.isSuperAdmin()) {
        <div class="reviews-panel">
          <div class="reviews-panel-header" (click)="reviewsPanelOpen = !reviewsPanelOpen">
            <span class="reviews-panel-title">
              <i class="fas fa-star"></i> App Reviews &amp; Ratings
            </span>
            <i class="fas" [class.fa-chevron-down]="!reviewsPanelOpen" [class.fa-chevron-up]="reviewsPanelOpen"></i>
          </div>

          @if (reviewsPanelOpen) {
            <div class="reviews-panel-body">

              <!-- Per-club review links -->
              <div class="reviews-section">
                <h4 class="reviews-section-title"><i class="fas fa-link"></i> Send Review Links</h4>
                <p class="reviews-section-desc">Each club has a unique review form. Copy the link and send it directly to the club admin.</p>
                <div class="reviews-link-list">
                  @for (club of clubs; track club._id) {
                    @if (club.status !== 'suspended') {
                      <div class="reviews-link-row">
                        <span class="reviews-link-club-name">{{ club.name }}</span>
                        <code class="reviews-link-url">/review/{{ club.slug || club._id }}</code>
                        <button type="button" class="btn btn-sm btn-outline" (click)="copyReviewLink(club._id, club.name, club.slug)" title="Copy review link">
                          <i class="fas" [class.fa-copy]="copiedClubId !== club._id" [class.fa-check]="copiedClubId === club._id"></i>
                          {{ copiedClubId === club._id ? 'Copied!' : 'Copy' }}
                        </button>
                      </div>
                    }
                  }
                </div>
              </div>

              <!-- Add review -->
              <div class="reviews-section">
                <h4 class="reviews-section-title"><i class="fas fa-plus-circle"></i> Add Review</h4>
                <div class="reviews-add-form">
                  <input type="text" class="reviews-input" [(ngModel)]="newReview.reviewerName" placeholder="Reviewer name (e.g., John D.)" />
                  <input type="text" class="reviews-input" [(ngModel)]="newReview.clubName" placeholder="Club name" />
                  <div class="reviews-rating-row">
                    <label class="reviews-label">Rating:</label>
                    @for (star of [1,2,3,4,5]; track star) {
                      <button type="button" class="star-btn" [class.star-btn-filled]="star <= newReview.rating" (click)="newReview.rating = star">★</button>
                    }
                  </div>
                  <textarea class="reviews-input reviews-textarea" [(ngModel)]="newReview.text" placeholder="Review text (copy from Google Form response)…" rows="3"></textarea>
                  <button type="button" class="btn btn-primary btn-sm" (click)="addReview()" [disabled]="reviewsAdding">
                    @if (reviewsAdding) { <i class="fas fa-spinner fa-spin"></i> } @else { <i class="fas fa-plus"></i> Add Review }
                  </button>
                  @if (reviewsAddMsg) {
                    <p class="reviews-save-msg">{{ reviewsAddMsg }}</p>
                  }
                </div>
              </div>

              <!-- Reviews list -->
              <div class="reviews-section">
                <h4 class="reviews-section-title"><i class="fas fa-list"></i> All Reviews ({{ reviewsList().length }})</h4>
                @if (reviewsLoading()) {
                  <p class="reviews-save-msg"><i class="fas fa-spinner fa-spin"></i> Loading…</p>
                } @else if (reviewsList().length === 0) {
                  <p class="reviews-empty">No reviews yet. Add one above.</p>
                } @else {
                  <div class="reviews-list">
                    @for (r of reviewsList(); track r._id) {
                      <div class="reviews-list-item" [class.reviews-list-item-hidden]="!r.isVisible">
                        <div class="reviews-list-stars">
                          @for (star of [1,2,3,4,5]; track star) {
                            <span [class.star-filled-sm]="star <= r.rating" [class.star-empty-sm]="star > r.rating">★</span>
                          }
                        </div>
                        <div class="reviews-list-meta">
                          <span class="reviews-list-name">{{ r.reviewerName }}</span>
                          <span class="reviews-list-club">{{ r.clubName }}</span>
                        </div>
                        <p class="reviews-list-text">{{ r.text }}</p>
                        <div class="reviews-list-actions">
                          <button type="button" class="btn btn-sm" [class.btn-outline]="r.isVisible" [class.btn-ghost-muted]="!r.isVisible"
                            (click)="toggleReviewVisibility(r)" [title]="r.isVisible ? 'Hide from landing page' : 'Show on landing page'">
                            <i class="fas" [class.fa-eye]="r.isVisible" [class.fa-eye-slash]="!r.isVisible"></i>
                            {{ r.isVisible ? 'Visible' : 'Hidden' }}
                          </button>
                          <button type="button" class="btn btn-sm btn-danger-ghost" (click)="deleteReview(r._id)" title="Delete review">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

            </div>
          }
        </div>
      }

      <!-- ── Loading overlay ── -->
      @if (loading) {
        <div class="cg-loader-overlay">
          <div class="cg-loader-scene">
            <img src="/CGLoader.png" alt="Loading" class="cg-loader-img" />
            <div class="cg-loader-spin-ring"></div>
            <div class="cg-loader-ball-glow"></div>
            <div class="cg-loader-bar"><div class="cg-loader-bar-fill"></div></div>
          </div>
        </div>
      }

      <!-- ── Error ── -->
      @else if (error) {
        <div class="state-card state-error">
          <i class="fas fa-triangle-exclamation"></i>
          <p>{{ error }}</p>
          <button type="button" class="btn btn-outline" (click)="loadClubs()">Try Again</button>
        </div>
      }

      <!-- ── Empty ── -->
      @else if (clubs.length === 0) {
        <div class="state-card state-empty">
          <i class="fas fa-shield-alt"></i>
          <h3>No clubs yet</h3>
          <p>Create your first club to get started.</p>
          <a routerLink="/admin/clubs/new" class="btn btn-primary">Create Club</a>
        </div>
      }

      <!-- ── Club grid ── -->
      @else {
        <!-- ── List tabs + view toggle ── -->
        <div class="list-controls">
          <div class="tabs-bar club-list-tabs-bar">
            <button type="button" class="tab-btn" [class.tab-active]="clubListTab === 'active'" (click)="clubListTab = 'active'">
              <i class="fas fa-circle-check"></i> Active
              @if (activeClubCount > 0) {
                <span class="tab-badge tab-badge-members">{{ activeClubCount }}</span>
              }
            </button>
            <button type="button" class="tab-btn" [class.tab-active]="clubListTab === 'suspended'" (click)="clubListTab = 'suspended'">
              <i class="fas fa-ban"></i> Suspended
              @if (suspendedClubCount > 0) {
                <span class="tab-badge">{{ suspendedClubCount }}</span>
              }
            </button>
          </div>
          <div class="view-toggle" role="group" aria-label="View mode">
            <button type="button" class="vt-btn" [class.vt-active]="viewMode === 'grid'" (click)="viewMode = 'grid'" title="Grid view" aria-label="Grid view">
              <i class="fas fa-table-cells-large"></i>
            </button>
            <button type="button" class="vt-btn" [class.vt-active]="viewMode === 'list'" (click)="viewMode = 'list'" title="List view" aria-label="List view">
              <i class="fas fa-list"></i>
            </button>
          </div>
        </div>

        @if (visibleClubs.length === 0) {
          <div class="state-card state-empty">
            <i class="fas fa-ban"></i>
            <p>No {{ clubListTab }} clubs.</p>
          </div>
        } @else {
        <div class="clubs-grid" [class.clubs-list]="viewMode === 'list'">
          @for (club of visibleClubs; track club._id) {
            <article
              class="club-card"
              [class.club-card--list]="viewMode === 'list'"
              [class.selected]="selectedClub?._id === club._id"
              (click)="selectClub(club)"
              role="button"
              tabindex="0"
              (keydown.enter)="selectClub(club)"
              (keydown.space)="selectClub(club); $event.preventDefault()"
            >
              <div class="card-accent"></div>

              <div class="club-head">
                @if (club.logo) {
                  <img [src]="club.logo" [alt]="club.name" class="club-logo" />
                } @else {
                  <div class="club-logo-placeholder">{{ getInitials(club.name) }}</div>
                }
                <div class="club-identity">
                  <h3>{{ club.name }}</h3>
                  <p class="club-id">{{ club._id }}</p>
                  <span class="club-booking-badge">
                    @if (club.bookingProcess === 'per_game') {
                      <i class="fas fa-table-tennis-paddle-ball"></i> Per Game
                    } @else if (club.bookingProcess === 'hosted_play') {
                      <i class="fas fa-users"></i> Hosted Play
                    } @else {
                      <i class="fas fa-calendar-check"></i> Reservation
                    }
                  </span>
                </div>
              </div>

              <div class="club-pills">
                @if (isNewClub(club)) {
                  <span class="pill pill-new"><i class="fas fa-star"></i> NEW</span>
                }
                @if (club.location) {
                  <span class="pill pill-default">
                    <i class="fas fa-location-dot"></i> {{ club.location }}
                  </span>
                }
                @if (club.mobile) {
                  <span class="pill pill-default">
                    <i class="fas fa-phone"></i> {{ club.mobile }}
                  </span>
                }
                @if (club.email) {
                  <span class="pill pill-default">
                    <i class="fas fa-envelope"></i> {{ club.email }}
                  </span>
                }
                @if (club.createdAt) {
                  <span class="pill pill-default">
                    <i class="fas fa-calendar-days"></i> {{ formatDate(club.createdAt) }}
                  </span>
                }
                <span class="pill pill-fee">
                  @if (club.convenienceFeeMode === 'monthly_flat') {
                    <i class="fas fa-money-bill-wave"></i>
                    ₱{{ (club.convenienceFeeMonthlyAmount ?? 0) | number:'1.0-2' }} flat/mo
                  } @else if (club.convenienceFeeMode === 'club_absorbs') {
                    <i class="fas fa-building"></i>
                    {{ ((club.convenienceFeeRate ?? 0.10) * 100) | number:'1.0-1' }}% club absorbs
                  } @else {
                    <i class="fas fa-percentage"></i>
                    {{ ((club.convenienceFeeRate ?? 0.10) * 100) | number:'1.0-1' }}%
                    · {{ club.convenienceFeeMode === 'per_transaction' ? 'per txn' : 'per hr' }}
                  }
                </span>
                @if (club.status === 'suspended') {
                  <span class="pill pill-suspended">
                    <i class="fas fa-ban"></i> Suspended
                  </span>
                }
                @if (club.adminTermsAccepted) {
                  <span class="pill pill-terms-ok">
                    <i class="fas fa-file-contract"></i> T&amp;C Accepted
                  </span>
                } @else {
                  <span class="pill pill-terms-pending">
                    <i class="fas fa-file-circle-exclamation"></i> T&amp;C Pending
                  </span>
                }
              </div>

              <div class="club-actions">
                <button type="button" class="btn btn-sm btn-primary" (click)="$event.stopPropagation(); selectClub(club)" title="Manage admins">
                  <i class="fas fa-user-cog"></i>
                </button>
                <button type="button" class="btn btn-sm btn-message" (click)="$event.stopPropagation(); messageClubAdmin(club)" title="Message club admin" style="position:relative;">
                  <i class="fas fa-comment-dots"></i>
                  @if (getClubUnread(club) > 0) {
                    <span class="msg-badge" style="position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;font-size:0.65rem;font-weight:700;min-width:16px;height:16px;border-radius:999px;display:flex;align-items:center;justify-content:center;padding:0 3px;pointer-events:none;">{{ getClubUnread(club) }}</span>
                  }
                </button>
                <a [routerLink]="['/admin/clubs', club._id, 'edit']" class="btn btn-sm btn-outline" (click)="$event.stopPropagation()" title="Edit club">
                  <i class="fas fa-pen"></i>
                </a>
                <button type="button" class="btn btn-sm btn-copy" (click)="$event.stopPropagation(); copyBookingLink(club)" title="Copy booking link">
                  <i class="fas" [class.fa-copy]="copiedClubId !== club._id" [class.fa-check]="copiedClubId === club._id"></i>
                </button>
                <button type="button" class="btn btn-sm btn-danger" (click)="$event.stopPropagation(); deleteClub(club)" title="Delete club">
                  <i class="fas fa-trash"></i>
                </button>
                @if (club.status === 'suspended') {
                  <button type="button" class="btn btn-sm btn-unsuspend" (click)="$event.stopPropagation(); suspendClub(club)" title="Unsuspend club">
                    <i class="fas fa-circle-check"></i>
                  </button>
                } @else {
                  <button type="button" class="btn btn-sm btn-suspend" (click)="$event.stopPropagation(); suspendClub(club)" title="Suspend club">
                    <i class="fas fa-ban"></i>
                  </button>
                }
              </div>
            </article>
          }
        </div>
        } <!-- end @else visibleClubs -->

        <!-- ── Detail module ── -->
        @if (selectedClub) {
          <section class="detail-panel">

            <div class="detail-header">
              <div>
                <p class="hero-kicker" style="margin:0 0 0.15rem"><i class="fas fa-shield-alt"></i> {{ selectedClub.name }}</p>
                <p class="detail-sub">Manage admins, payments, and app service fees for this club.</p>
              </div>
              @if (activeTab === 'admins') {
                <button type="button" class="btn btn-primary" (click)="showAdminForm = !showAdminForm">
                  <i class="fas" [class.fa-plus]="!showAdminForm" [class.fa-times]="showAdminForm"></i>
                  {{ showAdminForm ? 'Close Form' : 'Add Admin' }}
                </button>
              }
              @if (activeTab === 'appfees' && aspBalance > 0 && !aspLoading) {
                <button type="button" class="btn btn-primary" (click)="openAspModal()">
                  <i class="fas fa-paper-plane"></i> Record Payment
                </button>
              }
            </div>

            <!-- Menu Bar -->
            <div class="tabs-bar clubs-menu-bar">
              <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'admins'" (click)="setTab('admins')">
                <i class="fas fa-user-cog"></i> Admins
              </button>
              @if (auth.isSuperAdmin()) {
                <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'members'" (click)="setTab('members')">
                  <i class="fas fa-users"></i> Members
                  @if (clubMembers.length > 0) {
                    <span class="tab-badge tab-badge-members">{{ clubMembers.length }}</span>
                  }
                </button>
                <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'payments'" (click)="setTab('payments')">
                  <i class="fas fa-money-check-alt"></i> Payments
                </button>
                <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'appfees'" (click)="setTab('appfees')">
                  <i class="fas fa-percentage"></i> App Service
                  @if (!aspLoading && aspBalance > 0) {
                    <span class="tab-badge tab-badge-amber">unpaid</span>
                  }
                </button>
                <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'extrafees'" (click)="setTab('extrafees')">
                  <i class="fas fa-tags"></i> Extra Fees
                </button>
                <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'chat'" (click)="setTab('chat')">
                  <i class="fas fa-comment-dots"></i> Chat
                  @if (clubInquiries.length > 0) {
                    <span class="tab-badge tab-badge-members">{{ clubInquiries.length }}</span>
                  }
                </button>
              }
            </div>

            <!-- ── ADMINS TAB ── -->
            @if (activeTab === 'admins') {
              @if (showAdminForm) {
                <div class="form-card">
                  @if (adminFormError) { <div class="form-alert form-alert-error">{{ adminFormError }}</div> }
                  @if (adminFormSuccess) { <div class="form-alert form-alert-success"><i class="fas fa-check-circle"></i> {{ adminFormSuccess }}</div> }
                  <form (ngSubmit)="createClubAdmin()" #adminFormRef="ngForm">
                    <div class="form-grid">
                      <label class="form-label">Full Name
                        <input class="form-input" type="text" [(ngModel)]="adminForm.name" name="name" required (ngModelChange)="onAdminNameChange($event)" placeholder="Admin full name" />
                      </label>
                      <label class="form-label">Username
                        <input class="form-input" type="text" [(ngModel)]="adminForm.username" name="username" required (ngModelChange)="onAdminUsernameChange()" placeholder="login-username" />
                      </label>
                      <label class="form-label">Password
                        <input class="form-input" type="password" [(ngModel)]="adminForm.password" name="password" required minlength="6" />
                      </label>
                      <label class="form-label">Email <span class="form-hint">optional</span>
                        <input class="form-input" type="email" [(ngModel)]="adminForm.email" name="email" placeholder="admin@email.com" />
                      </label>
                    </div>
                    <div class="form-actions">
                      <button type="submit" class="btn btn-primary" [disabled]="creatingAdmin || adminFormRef.invalid">
                        <i class="fas fa-user-plus"></i> {{ creatingAdmin ? 'Creating…' : 'Create Admin' }}
                      </button>
                      <button type="button" class="btn btn-outline" (click)="resetAdminForm()">Reset</button>
                    </div>
                  </form>
                </div>
              }

              <div class="list-card">
                @if (adminsLoading) {
                  <p class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading admins…</p>
                } @else if (adminsError) {
                  <p class="state-msg state-msg-error">{{ adminsError }}</p>
                } @else if (clubAdmins.length === 0) {
                  <p class="state-msg">No admins yet for this club.</p>
                } @else {
                  <div class="admin-grid">
                    @for (admin of clubAdmins; track admin._id) {
                      <div class="admin-card">
                        <div class="admin-avatar">{{ getInitials(admin.name) }}</div>
                        <div class="admin-info">
                          <div class="admin-name">{{ admin.name }}</div>
                          <div class="admin-username">&#64;{{ admin.username }}</div>
                          @if (admin.email) { <div class="admin-email">{{ admin.email }}</div> }
                        </div>
                        <div class="admin-badges">
                          <span class="badge badge-role">{{ admin.role }}</span>
                          <span class="badge" [class.badge-active]="admin.status === 'active'" [class.badge-inactive]="admin.status !== 'active'">{{ admin.status }}</span>
                          <button type="button" class="btn-mirror" (click)="loginAs(admin)" [disabled]="mirroringUserId === admin._id">
                            <i class="fas fa-user-secret"></i>
                            {{ mirroringUserId === admin._id ? 'Logging in…' : 'Login as' }}
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- ── PAYMENT APPROVALS TAB ── -->
            @if (activeTab === 'payments' && auth.isSuperAdmin()) {
              <div class="list-card">
                <div class="filter-row">
                  @for (f of paymentFilterOptions; track f) {
                    <button type="button" class="filter-btn" [class.filter-active]="chargeFilter === f" (click)="setChargeFilter(f)">{{ f | titlecase }}</button>
                  }
                </div>

                @if (chargesLoading) {
                  <p class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading approvals…</p>
                } @else if (chargesError) {
                  <p class="state-msg state-msg-error">{{ chargesError }}</p>
                } @else if (filteredCharges.length === 0) {
                  <p class="state-msg">No {{ chargeFilter }} payment approvals.</p>
                } @else {
                  <div class="item-list payment-approval-list">
                    @for (charge of filteredCharges; track charge._id) {
                      <div class="item-card payment-approval-row" [class.item-approved]="charge.approvalStatus === 'approved'" [class.item-rejected]="charge.approvalStatus === 'rejected'">
                        <div class="item-top payment-approval-main">
                          <span class="charge-amount payment-approval-amount">₱{{ charge.amount | number:'1.2-2' }}</span>
                          <span class="badge payment-approval-type" [class.badge-res]="charge.chargeType === 'reservation'" [class.badge-ses]="charge.chargeType === 'session'">{{ charge.chargeType }}</span>
                          @if (charge.paymentMethod) { <span class="badge badge-purple payment-approval-method">{{ charge.paymentMethod }}</span> }
                          <span class="item-meta payment-approval-player">{{ getPlayerName(charge) }}</span>
                          @if (charge.paidAt) { <span class="item-meta payment-approval-date">{{ formatDate(charge.paidAt) }}</span> }
                          @if (charge.approvalStatus === 'rejected' && charge.adminNote) {
                            <span class="item-reject-note payment-approval-note" [title]="charge.adminNote"><i class="fas fa-ban"></i> {{ charge.adminNote }}</span>
                          }
                          @if (charge.approvalStatus !== 'pending') {
                            <span class="item-resolved payment-approval-status" [class.resolved-ok]="charge.approvalStatus === 'approved'">
                            <i class="fas" [class.fa-check-circle]="charge.approvalStatus === 'approved'" [class.fa-times-circle]="charge.approvalStatus === 'rejected'"></i>
                            {{ charge.approvalStatus === 'approved' ? 'Approved' : 'Rejected' }}
                            </span>
                          }
                        </div>
                        @if (charge.approvalStatus === 'pending') {
                          <div class="item-actions payment-approval-actions">
                            <button type="button" class="btn btn-sm btn-approve" (click)="approveCharge(charge)" [disabled]="processingCharge.has(charge._id)">
                              <i class="fas fa-check"></i> {{ processingCharge.has(charge._id) ? 'Approving…' : 'Approve' }}
                            </button>
                            <button type="button" class="btn btn-sm btn-reject" (click)="openRejectChargeModal(charge)" [disabled]="processingCharge.has(charge._id)">
                              <i class="fas fa-times"></i> Reject
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- ── APP SERVICE FEES TAB ── -->
            @if (activeTab === 'appfees' && auth.isSuperAdmin()) {
              <div class="list-card">

                <!-- Convenience Fee Settings Card -->
                <div class="cfs-card">
                  <div class="cfs-header">
                    <div class="cfs-header-left">
                      <span class="cfs-icon"><i class="fas fa-percentage"></i></span>
                      <div>
                        <div class="cfs-title">Convenience Fee Settings</div>
                        <div class="cfs-subtitle">App service fee charged to this club</div>
                      </div>
                    </div>
                    <span class="cfs-current-badge">
                      @if (selectedClub?.convenienceFeeMode === 'monthly_flat') {
                        Monthly Flat — ₱{{ (selectedClub?.convenienceFeeMonthlyAmount ?? 0) | number:'1.0-2' }}/mo
                      } @else if (selectedClub?.convenienceFeeMode === 'club_absorbs') {
                        Club Absorbs {{ ((selectedClub?.convenienceFeeRate ?? 0.10) * 100) | number:'1.0-1' }}%
                      } @else {
                        Currently {{ ((selectedClub?.convenienceFeeRate ?? 0.10) * 100) | number:'1.0-1' }}%
                      }
                    </span>
                  </div>

                  <div class="cfs-body">
                    <div class="cfs-field">
                      <label class="cfs-field-label">Fee Mode</label>
                      <div class="cfs-mode-grid">
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="editConvenienceFeeMode === 'per_hour'" (click)="editConvenienceFeeMode = 'per_hour'">
                          <i class="fas fa-clock"></i>
                          <span class="cfs-mode-name">Per Hour</span>
                          <span class="cfs-mode-desc">Fee × duration hours</span>
                        </button>
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="editConvenienceFeeMode === 'per_transaction'" (click)="editConvenienceFeeMode = 'per_transaction'">
                          <i class="fas fa-receipt"></i>
                          <span class="cfs-mode-name">Per Booking</span>
                          <span class="cfs-mode-desc">Fixed, 1× hourly rate</span>
                        </button>
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="editConvenienceFeeMode === 'monthly_flat'" (click)="editConvenienceFeeMode = 'monthly_flat'">
                          <i class="fas fa-calendar-alt"></i>
                          <span class="cfs-mode-name">Monthly Flat</span>
                          <span class="cfs-mode-desc">Fixed monthly amount</span>
                        </button>
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="editConvenienceFeeMode === 'club_absorbs'" (click)="editConvenienceFeeMode = 'club_absorbs'">
                          <i class="fas fa-building"></i>
                          <span class="cfs-mode-name">Club Absorbs</span>
                          <span class="cfs-mode-desc">Club pays fee, player pays base only</span>
                        </button>
                      </div>
                    </div>

                    @if (editConvenienceFeeMode === 'monthly_flat') {
                      <div class="cfs-field">
                        <label class="cfs-field-label">Monthly Amount (₱)</label>
                        <div class="cfs-rate-row">
                          <input type="number" class="cfs-rate-input" [(ngModel)]="editConvenienceFeeMonthlyAmount" min="0" step="1" />
                          <span class="cfs-rate-hint">fixed pesos per month, billed manually</span>
                        </div>
                      </div>
                    } @else {
                      <div class="cfs-field">
                        <label class="cfs-field-label">Fee Rate</label>
                        <div class="cfs-rate-row">
                          <input type="number" class="cfs-rate-input" [(ngModel)]="editConvenienceFeeRate" min="0" max="100" step="0.1" />
                          <span class="cfs-pct">%</span>
                          <span class="cfs-rate-hint">{{ editConvenienceFeeMode === 'club_absorbs' ? 'club absorbs this % from court fee' : 'of total court fee per booking' }}</span>
                        </div>
                      </div>
                    }
                  </div>

                  <div class="cfs-footer">
                    @if (feeModeSaveMsg) {
                      <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ feeModeSaveMsg }}</span>
                    }
                    <button type="button" class="cfs-save-btn" (click)="saveConvenienceFeeMode()" [disabled]="savingFeeMode">
                      @if (savingFeeMode) {
                        <i class="fas fa-circle-notch fa-spin"></i> Saving…
                      } @else {
                        <i class="fas fa-save"></i> Save Settings
                      }
                    </button>
                  </div>
                </div>

                <!-- Hosted Play Convenience Fee Card -->
                <div class="cfs-card">
                  <div class="cfs-header">
                    <div class="cfs-header-left">
                      <span class="cfs-icon"><i class="fas fa-table-tennis"></i></span>
                      <div>
                        <div class="cfs-title">Hosted Play Convenience Fee</div>
                        <div class="cfs-subtitle">App service fee for Hosted Play, separate from the fee above</div>
                      </div>
                    </div>
                    <span class="cfs-current-badge">
                      @if (selectedClub?.hostedPlayConvenienceFeeMode === 'per_session') {
                        Per Session — ₱{{ (selectedClub?.hostedPlayConvenienceFeeAmount ?? 0) | number:'1.0-2' }}
                      } @else if (selectedClub?.hostedPlayConvenienceFeeMode === 'club_absorbs') {
                        Club Absorbs {{ ((selectedClub?.hostedPlayConvenienceFeeRate ?? 0.05) * 100) | number:'1.0-1' }}%
                      } @else {
                        Currently {{ ((selectedClub?.hostedPlayConvenienceFeeRate ?? 0.05) * 100) | number:'1.0-1' }}%
                      }
                    </span>
                  </div>

                  <div class="cfs-body">
                    <div class="cfs-field">
                      <label class="cfs-field-label">Fee Mode</label>
                      <div class="cfs-mode-grid">
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="editHostedPlayConvenienceFeeMode === 'per_join'" (click)="editHostedPlayConvenienceFeeMode = 'per_join'">
                          <i class="fas fa-user-plus"></i>
                          <span class="cfs-mode-name">Per Join</span>
                          <span class="cfs-mode-desc">Each player pays a fee when they join</span>
                        </button>
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="editHostedPlayConvenienceFeeMode === 'per_session'" (click)="editHostedPlayConvenienceFeeMode = 'per_session'">
                          <i class="fas fa-users"></i>
                          <span class="cfs-mode-name">Per Session</span>
                          <span class="cfs-mode-desc">Flat fee split evenly, billed after the session ends</span>
                        </button>
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="editHostedPlayConvenienceFeeMode === 'club_absorbs'" (click)="editHostedPlayConvenienceFeeMode = 'club_absorbs'">
                          <i class="fas fa-building"></i>
                          <span class="cfs-mode-name">Club Absorbs</span>
                          <span class="cfs-mode-desc">Club pays fee, player pays base only</span>
                        </button>
                      </div>
                    </div>

                    @if (editHostedPlayConvenienceFeeMode === 'per_session') {
                      <div class="cfs-field">
                        <label class="cfs-field-label">Session Amount (₱)</label>
                        <div class="cfs-rate-row">
                          <input type="number" class="cfs-rate-input" [(ngModel)]="editHostedPlayConvenienceFeeAmount" min="0" step="1" />
                          <span class="cfs-rate-hint">flat pesos per session, split evenly among members who played</span>
                        </div>
                      </div>
                    } @else {
                      <div class="cfs-field">
                        <label class="cfs-field-label">Fee Rate</label>
                        <div class="cfs-rate-row">
                          <input type="number" class="cfs-rate-input" [(ngModel)]="editHostedPlayConvenienceFeeRate" min="0" max="100" step="0.1" />
                          <span class="cfs-pct">%</span>
                          <span class="cfs-rate-hint">{{ editHostedPlayConvenienceFeeMode === 'club_absorbs' ? 'club absorbs this % from the session fee' : "of each player's session fee, charged at join" }}</span>
                        </div>
                      </div>
                    }
                  </div>

                  <div class="cfs-footer">
                    @if (hostedPlayFeeModeSaveMsg) {
                      <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ hostedPlayFeeModeSaveMsg }}</span>
                    }
                    <button type="button" class="cfs-save-btn" (click)="saveHostedPlayConvenienceFeeMode()" [disabled]="savingHostedPlayFeeMode">
                      @if (savingHostedPlayFeeMode) {
                        <i class="fas fa-circle-notch fa-spin"></i> Saving…
                      } @else {
                        <i class="fas fa-save"></i> Save Settings
                      }
                    </button>
                  </div>
                </div>

                @if (aspLoading) {
                  <p class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading data…</p>
                } @else if (aspError) {
                  <p class="state-msg state-msg-error">{{ aspError }}</p>
                } @else {

                  <!-- Bill Month card for monthly_flat clubs -->
                  @if (selectedClub?.convenienceFeeMode === 'monthly_flat') {
                    <div class="asp-bill-month-card">
                      <div class="asp-bill-month-left">
                        <div class="asp-bill-month-icon"><i class="fas fa-calendar-alt"></i></div>
                        <div>
                          <div class="asp-bill-month-title">Monthly Flat Plan</div>
                          <div class="asp-bill-month-amount">₱{{ (selectedClub?.convenienceFeeMonthlyAmount ?? 0) | number:'1.0-2' }} <span class="asp-bill-month-per">/ month</span></div>
                        </div>
                      </div>
                      <div class="asp-bill-month-right">
                        @if (billingMonthMsg) {
                          <span class="asp-bill-month-msg" [class.asp-bill-month-msg-error]="billingMonthMsg.includes('Failed')">
                            <i class="fas" [class.fa-check-circle]="!billingMonthMsg.includes('Failed')" [class.fa-exclamation-circle]="billingMonthMsg.includes('Failed')"></i>
                            {{ billingMonthMsg }}
                          </span>
                        }
                        <button type="button" class="asp-bill-btn" (click)="billMonth()" [disabled]="billingMonthLoading">
                          @if (billingMonthLoading) {
                            <i class="fas fa-circle-notch fa-spin"></i> Billing…
                          } @else {
                            <i class="fas fa-calendar-plus"></i> Bill Month
                          }
                        </button>
                      </div>
                    </div>
                  }

                  <!-- Summary -->
                  <div class="asp-summary">
                    <div class="asp-stat">
                      <span class="asp-lbl">Court Charges</span>
                      <span class="asp-val">₱{{ reservationTotal | number:'1.2-2' }}</span>
                    </div>
                    <div class="asp-stat">
                      <span class="asp-lbl">Open Play Sessions</span>
                      <span class="asp-val">{{ openPlayCharges.length }}</span>
                    </div>
                    <div class="asp-stat">
                      <span class="asp-lbl">Hosted Play Sessions</span>
                      <span class="asp-val">{{ hostedPlayCharges.length }}</span>
                    </div>
                    <div class="asp-stat asp-stat-due">
                      <span class="asp-lbl">Conv. Fees Due</span>
                      <span class="asp-val">₱{{ appServiceDue | number:'1.2-2' }}</span>
                    </div>
                    <div class="asp-stat asp-stat-paid">
                      <span class="asp-lbl">Paid to Dev</span>
                      <span class="asp-val">₱{{ aspTotalPaid | number:'1.2-2' }}</span>
                    </div>
                    @if (aspTotalWaived > 0) {
                      <div class="asp-stat asp-stat-waived">
                        <span class="asp-lbl">Waived</span>
                        <span class="asp-val">₱{{ aspTotalWaived | number:'1.2-2' }}</span>
                      </div>
                    }
                    <div class="asp-stat" [class.asp-stat-outstanding]="aspBalance > 0">
                      <span class="asp-lbl">Outstanding</span>
                      <span class="asp-val">₱{{ aspBalance | number:'1.2-2' }}</span>
                    </div>
                  </div>

                  <!-- Court charges breakdown -->
                  <div class="asp-section">
                    <div class="asp-section-title">
                      <i class="fas fa-table-tennis"></i> Court Reservation Charges
                      @if (reservationCharges.length > 0) { <span class="asp-count">{{ reservationCharges.length }}</span> }
                    </div>
                    @if (reservationCharges.length === 0) {
                      <p class="state-msg">No approved reservation charges yet.</p>
                    } @else {
                      <div class="asp-charge-list">
                        @for (c of reservationCharges; track c._id) {
                          <div class="asp-charge-row">
                            <span class="asp-player">{{ getPlayerName(c) }}</span>
                            <span class="asp-date">{{ formatDate(c.createdAt) }}</span>
                            <span class="asp-amount-val">₱{{ c.amount | number:'1.2-2' }}</span>
                            <span class="asp-fee-chip">Conv. Fee = ₱{{ (c.breakdown?.convenienceFee ?? 0) | number:'1.2-2' }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Open play charges breakdown -->
                  <div class="asp-section">
                    <div class="asp-section-title">
                      <i class="fas fa-users"></i> Open Play Session Charges
                      @if (openPlayCharges.length > 0) { <span class="asp-count">{{ openPlayCharges.length }}</span> }
                    </div>
                    @if (openPlayCharges.length === 0) {
                      <p class="state-msg">No open play session charges yet.</p>
                    } @else {
                      <div class="asp-charge-list">
                        @for (c of openPlayCharges; track c._id) {
                          <div class="asp-charge-row">
                            <span class="asp-player">{{ c.openPlaySessionId?.title ?? '—' }}</span>
                            <span class="asp-date">{{ c.openPlaySessionId?.sport ?? '' }} · {{ c.openPlaySessionId?.sessionDate | date:'MMM d, yyyy':'UTC' }}</span>
                            <span class="asp-date">{{ c.openPlaySessionId?.startTime }} – {{ c.openPlaySessionId?.endTime }}</span>
                            <span class="asp-fee-chip">Conv. Fee = ₱{{ (c.breakdown?.convenienceFee ?? 0) | number:'1.2-2' }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Hosted play charges breakdown -->
                  <div class="asp-section">
                    <div class="asp-section-title">
                      <i class="fas fa-dumbbell"></i> Hosted Play Charges
                      @if (hostedPlayCharges.length > 0) { <span class="asp-count">{{ hostedPlayCharges.length }}</span> }
                    </div>
                    @if (hostedPlayCharges.length === 0) {
                      <p class="state-msg">No hosted play charges yet.</p>
                    } @else {
                      <div class="asp-charge-list">
                        @for (c of hostedPlayCharges; track c._id) {
                          <div class="asp-charge-row">
                            <span class="asp-player">{{ getPlayerName(c) }}</span>
                            <span class="asp-date">{{ formatDate(c.createdAt) }}</span>
                            <span class="asp-amount-val">₱{{ c.amount | number:'1.2-2' }}</span>
                            <span class="asp-fee-chip">Conv. Fee = ₱{{ (c.breakdown?.convenienceFee ?? 0) | number:'1.2-2' }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Payments to developer -->
                  <div class="asp-section">
                    <div class="asp-section-title">
                      <i class="fas fa-paper-plane"></i> App Service History
                      @if (aspPayments.length > 0) { <span class="asp-count">{{ aspPayments.length }}</span> }
                    </div>
                    @if (aspPayments.length === 0) {
                      <p class="state-msg">No payments recorded yet.</p>
                    } @else {
                      <div class="asp-pay-list">
                        @for (p of aspPayments; track p._id) {
                          <div class="asp-pay-row" [class.asp-pay-row-waived]="p.type === 'waiver'" [class.asp-pay-row-billing]="p.type === 'billing'">
                            <div class="asp-pay-left">
                              <span class="asp-pay-amount" [class.asp-pay-amount-waived]="p.type === 'waiver'">
                                ₱{{ p.amount | number:'1.2-2' }}
                              </span>
                              @if (p.type === 'waiver') {
                                <span class="badge badge-waived"><i class="fas fa-hand-holding-usd"></i> Waived</span>
                              } @else if (p.type === 'billing') {
                                <span class="badge badge-billing"><i class="fas fa-calendar-alt"></i> Monthly Billing</span>
                              } @else {
                                <span class="badge badge-purple">{{ p.paymentMethod }}</span>
                              }
                              @if (p.note) { <span class="asp-note">{{ p.note }}</span> }
                              @if (p.paymentScreenshot) {
                                <a class="asp-screenshot-link" [href]="p.paymentScreenshot" target="_blank" rel="noopener noreferrer" (click)="$event.stopPropagation()">
                                  <i class="fas fa-image"></i> Screenshot
                                </a>
                              }
                            </div>
                            <div class="asp-pay-right">
                              <span>{{ p.type === 'waiver' ? 'Waived by' : p.type === 'billing' ? 'Billed by' : 'Paid by' }} {{ p.paidBy?.name ?? '—' }}</span>
                              <span>{{ formatDate(p.createdAt) }}</span>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>

                }
              </div>
            }

            <!-- ── EXTRA FEES TAB ── -->
            @if (activeTab === 'extrafees' && auth.isSuperAdmin()) {
              <div class="xfee-page">
                <div class="xfee-settings-grid">
                  <!-- Payment Settings card -->
                  <div class="cfs-card xfee-setting-card">
                    <div class="cfs-header">
                      <div class="cfs-header-left">
                        <span class="cfs-icon"><i class="fas fa-camera"></i></span>
                        <div>
                          <div class="cfs-title">Payment Proof</div>
                          <div class="cfs-subtitle">Guest screenshot requirement</div>
                        </div>
                      </div>
                      <span class="xfee-status-pill" [class.xfee-status-off]="!requireScreenshot">
                        {{ requireScreenshot ? 'Required' : 'Optional' }}
                      </span>
                    </div>
                    <div class="cfs-body xfee-setting-body">
                      <label class="xfee-switch-row">
                        <input type="checkbox" [(ngModel)]="requireScreenshot" />
                        <span class="xfee-switch-copy">
                          <span class="xfee-switch-title">Require payment screenshot</span>
                          <span class="xfee-switch-note">Applies when guests submit booking payments.</span>
                        </span>
                      </label>
                      <div class="cfs-actions xfee-actions">
                        <button type="button" class="cfs-save-btn" (click)="saveScreenshotSetting()" [disabled]="savingScreenshotSetting">
                          @if (savingScreenshotSetting) { <i class="fas fa-circle-notch fa-spin"></i> } Save
                        </button>
                        @if (screenshotSettingSaveMsg) {
                          <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ screenshotSettingSaveMsg }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="cfs-card xfee-setting-card">
                    <div class="cfs-header">
                      <div class="cfs-header-left">
                        <span class="cfs-icon"><i class="fas fa-bell"></i></span>
                        <div>
                          <div class="cfs-title">Balance Alert</div>
                          <div class="cfs-subtitle">Club admin login notice</div>
                        </div>
                      </div>
                      <span class="xfee-status-pill" [class.xfee-status-off]="!balanceAlertEnabled">
                        {{ balanceAlertEnabled ? 'Shown' : 'Hidden' }}
                      </span>
                    </div>
                    <div class="cfs-body xfee-setting-body">
                      <label class="xfee-switch-row">
                        <input type="checkbox" [(ngModel)]="balanceAlertEnabled" />
                        <span class="xfee-switch-copy">
                          <span class="xfee-switch-title">Show outstanding balance alert</span>
                          <span class="xfee-switch-note">Highlights unpaid app service balance after login.</span>
                        </span>
                      </label>
                      <div class="cfs-actions xfee-actions">
                        <button type="button" class="cfs-save-btn" (click)="saveBalanceAlertSetting()" [disabled]="savingBalanceAlert">
                          @if (savingBalanceAlert) { <i class="fas fa-circle-notch fa-spin"></i> } Save
                        </button>
                        @if (balanceAlertSaveMsg) {
                          <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ balanceAlertSaveMsg }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="cfs-card xfee-setting-card">
                    <div class="cfs-header">
                      <div class="cfs-header-left">
                        <span class="cfs-icon"><i class="fas fa-calendar-check"></i></span>
                        <div>
                          <div class="cfs-title">Booking Process</div>
                          <div class="cfs-subtitle">Reservation, per-game or hosted play model</div>
                        </div>
                      </div>
                      <span class="xfee-status-pill" [class.xfee-status-off]="bookingProcess !== 'reservation'">
                        {{ bookingProcess === 'reservation' ? 'Reservation' : (bookingProcess === 'per_game' ? 'Per Game' : 'Hosted Play') }}
                      </span>
                    </div>
                    <div class="cfs-body xfee-setting-body">
                      <div class="cfs-mode-grid">
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="bookingProcess === 'reservation'" (click)="bookingProcess = 'reservation'">
                          <i class="fas fa-calendar-check"></i>
                          <span class="cfs-mode-name">Reservation</span>
                          <span class="cfs-mode-desc">Pre-book courts by date & time</span>
                        </button>
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="bookingProcess === 'per_game'" (click)="bookingProcess = 'per_game'">
                          <i class="fas fa-play-circle"></i>
                          <span class="cfs-mode-name">Per Game</span>
                          <span class="cfs-mode-desc">Players join; admin records games</span>
                        </button>
                        <button type="button" class="cfs-mode-opt" [class.cfs-mode-opt-active]="bookingProcess === 'hosted_play'" (click)="bookingProcess = 'hosted_play'">
                          <i class="fas fa-calendar-check"></i>
                          <span class="cfs-mode-name">Hosted Play</span>
                          <span class="cfs-mode-desc">Admin schedules sessions; members join</span>
                        </button>
                      </div>
                      <div class="cfs-actions xfee-actions">
                        <button type="button" class="cfs-save-btn" (click)="saveBookingProcess()" [disabled]="savingBookingProcess">
                          @if (savingBookingProcess) { <i class="fas fa-circle-notch fa-spin"></i> } Save
                        </button>
                        @if (bookingProcessSaveMsg) {
                          <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ bookingProcessSaveMsg }}</span>
                        }
                      </div>

                      @if (bookingProcess === 'reservation') {
                        <div class="hpq-toggle-row">
                          <div class="hpq-toggle-copy">
                            <div class="hpq-toggle-title"><i class="fas fa-calendar-check"></i> Hosted Play Add-on</div>
                            <div class="hpq-toggle-desc">Lets this reservation club also schedule hosted play sessions that members and guests can join.</div>
                          </div>
                          <label class="hpq-switch">
                            <input type="checkbox" [(ngModel)]="hostedPlayAddonEnabled" />
                            <span class="hpq-slider"></span>
                          </label>
                        </div>
                        <div class="cfs-actions xfee-actions">
                          <button type="button" class="cfs-save-btn" (click)="saveHostedPlayAddon()" [disabled]="savingHostedPlayAddon">
                            @if (savingHostedPlayAddon) { <i class="fas fa-circle-notch fa-spin"></i> } Save Add-on Setting
                          </button>
                          @if (hostedPlayAddonSaveMsg) {
                            <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ hostedPlayAddonSaveMsg }}</span>
                          }
                        </div>
                      }

                      @if (bookingProcess === 'hosted_play' || (bookingProcess === 'reservation' && hostedPlayAddonEnabled)) {
                        <div class="hpq-toggle-row">
                          <div class="hpq-toggle-copy">
                            <div class="hpq-toggle-title"><i class="fas fa-list-ol"></i> Queue Management</div>
                            <div class="hpq-toggle-desc">Adds check-in, automatic court rotation and a live queue board for hosted play sessions.</div>
                          </div>
                          <label class="hpq-switch">
                            <input type="checkbox" [(ngModel)]="hostedPlayQueueEnabled" />
                            <span class="hpq-slider"></span>
                          </label>
                        </div>
                        <div class="cfs-actions xfee-actions">
                          <button type="button" class="cfs-save-btn" (click)="saveHostedPlayQueue()" [disabled]="savingHostedPlayQueue">
                            @if (savingHostedPlayQueue) { <i class="fas fa-circle-notch fa-spin"></i> } Save Queue Setting
                          </button>
                          @if (hostedPlayQueueSaveMsg) {
                            <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ hostedPlayQueueSaveMsg }}</span>
                          }
                        </div>
                        @if (hostedPlayQueueEnabled) {
                          <div class="hpq-fee-row">
                            <div class="hpq-fee-label">
                              <i class="fas fa-coins"></i> Queue Management Fee (per join)
                              <span class="hpq-fee-hint">Charged to the club per player who joins — tracked in Finance › App Service</span>
                            </div>
                            <div class="hpq-fee-input-row">
                              <span class="hpq-fee-prefix">₱</span>
                              <input type="number" class="hpq-fee-input" [(ngModel)]="editQueueManagementFee" min="0" step="1" placeholder="0" />
                              <button type="button" class="cfs-save-btn" (click)="saveQueueManagementFee()" [disabled]="savingQueueManagementFee">
                                @if (savingQueueManagementFee) { <i class="fas fa-circle-notch fa-spin"></i> } Save
                              </button>
                            </div>
                            @if (queueManagementFeeSaveMsg) {
                              <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ queueManagementFeeSaveMsg }}</span>
                            }
                          </div>
                        }

                        <div class="hpq-toggle-row">
                          <div class="hpq-toggle-copy">
                            <div class="hpq-toggle-title"><i class="fas fa-coins"></i> Hosted Play Credits</div>
                            <div class="hpq-toggle-desc">Lets members use app credit to cover Hosted Play join fees and cancellation refunds. Turn off if this club settles Hosted Play outside the app credit ledger.</div>
                          </div>
                          <label class="hpq-switch">
                            <input type="checkbox" [(ngModel)]="hostedPlayCreditsEnabled" />
                            <span class="hpq-slider"></span>
                          </label>
                        </div>
                        <div class="cfs-actions xfee-actions">
                          <button type="button" class="cfs-save-btn" (click)="saveHostedPlayCredits()" [disabled]="savingHostedPlayCredits">
                            @if (savingHostedPlayCredits) { <i class="fas fa-circle-notch fa-spin"></i> } Save Credits Setting
                          </button>
                          @if (hostedPlayCreditsSaveMsg) {
                            <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ hostedPlayCreditsSaveMsg }}</span>
                          }
                        </div>
                      }

                      <div class="hpq-fee-row">
                        <div class="hpq-fee-label">
                          <i class="fas fa-table-tennis-paddle-ball"></i> DUPR Club ID
                          <span class="hpq-fee-hint">This club's DUPR Club ID — for future DUPR API integration, not yet validated.</span>
                        </div>
                        <div class="hpq-fee-input-row">
                          <input type="text" class="hpq-fee-input dupr-club-input" [(ngModel)]="editDuprClubId" placeholder="e.g. ABC123" maxlength="64" />
                          <button type="button" class="cfs-save-btn" (click)="saveDuprClubId()" [disabled]="savingDuprClubId">
                            @if (savingDuprClubId) { <i class="fas fa-circle-notch fa-spin"></i> } Save
                          </button>
                        </div>
                        @if (duprClubIdSaveMsg) {
                          <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ duprClubIdSaveMsg }}</span>
                        }
                      </div>

                      <div class="hpq-toggle-row">
                        <div class="hpq-toggle-copy">
                          <div class="hpq-toggle-title"><i class="fas fa-table-tennis-paddle-ball"></i> DUPR Rating Sync</div>
                          <div class="hpq-toggle-desc">Submits this club's Hosted Play pickleball scores to DUPR for official ratings.</div>
                        </div>
                        <label class="hpq-switch">
                          <input type="checkbox" [(ngModel)]="duprAddonEnabled" />
                          <span class="hpq-slider"></span>
                        </label>
                      </div>
                      <div class="cfs-actions xfee-actions">
                        <button type="button" class="cfs-save-btn" (click)="saveDuprAddon()" [disabled]="savingDuprAddon">
                          @if (savingDuprAddon) { <i class="fas fa-circle-notch fa-spin"></i> } Save DUPR Setting
                        </button>
                        @if (duprAddonSaveMsg) {
                          <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ duprAddonSaveMsg }}</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div class="cfs-card xfee-fees-card">
                  <div class="cfs-header">
                    <div class="cfs-header-left">
                      <span class="cfs-icon"><i class="fas fa-tags"></i></span>
                      <div>
                        <div class="cfs-title">Additional Booking Fees</div>
                        <div class="cfs-subtitle">Fees shown at booking time</div>
                      </div>
                    </div>
                    <span class="xfee-count-chip">{{ editingExtraFees.length }} {{ editingExtraFees.length === 1 ? 'fee' : 'fees' }}</span>
                  </div>

                  <div class="cfs-body xfee-fees-body">
                    @if (editingExtraFees.length === 0) {
                      <div class="xfee-empty-state">
                        <i class="fas fa-receipt"></i>
                        <span>No additional fees configured yet.</span>
                      </div>
                    } @else {
                      <div class="xfee-list">
                        @for (fee of editingExtraFees; track $index) {
                          <div class="xfee-row">
                            <div class="xfee-info">
                              <span class="xfee-name">{{ fee.name }}</span>
                              <span class="xfee-amount">₱{{ fee.amount | number:'1.0-2' }}</span>
                              <span class="xfee-type-chip">{{ fee.type === 'per_person' ? 'Per Person' : 'Fixed' }}</span>
                            </div>
                            <div class="xfee-toggles">
                              <label class="xfee-toggle-label">
                                <input type="checkbox" [(ngModel)]="fee.isEnabled" />
                                <span>Enabled</span>
                              </label>
                              <label class="xfee-toggle-label">
                                <input type="checkbox" [(ngModel)]="fee.isOptional" />
                                <span>Optional</span>
                              </label>
                              <button type="button" class="icon-btn icon-btn-danger" (click)="removeExtraFee($index)" title="Remove fee">
                                <i class="fas fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <div class="xfee-add-form">
                      <div class="xfee-add-title"><i class="fas fa-plus-circle"></i> Add Fee</div>
                      <div class="xfee-add-fields">
                        <input type="text" class="form-input" placeholder="Fee name (e.g. Food Fee)" [(ngModel)]="newExtraFeeName" />
                        <input type="number" class="form-input xfee-amount-input" placeholder="Amount (₱)" [(ngModel)]="newExtraFeeAmount" min="0" step="1" />
                        <select class="form-input" [(ngModel)]="newExtraFeeType">
                          <option value="fixed">Fixed</option>
                          <option value="per_person">Per Person</option>
                        </select>
                        <label class="xfee-toggle-label">
                          <input type="checkbox" [(ngModel)]="newExtraFeeOptional" />
                          Optional
                        </label>
                        <button type="button" class="btn-sm btn-primary" (click)="addExtraFee()" [disabled]="!newExtraFeeName.trim()">
                          Add
                        </button>
                      </div>
                    </div>

                    <div class="cfs-footer xfee-footer">
                      @if (extraFeesSaveMsg) {
                        <span class="cfs-save-msg"><i class="fas fa-check-circle"></i> {{ extraFeesSaveMsg }}</span>
                      }
                      <button type="button" class="cfs-save-btn" (click)="saveExtraFees()" [disabled]="savingExtraFees">
                        @if (savingExtraFees) { <i class="fas fa-circle-notch fa-spin"></i> } Save Fees
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- ── MEMBERS TAB ── -->
            @if (activeTab === 'members' && auth.isSuperAdmin()) {
              <div class="list-card">
                <div class="filter-row">
                  @for (f of memberFilterOptions; track f) {
                    <button type="button" class="filter-btn" [class.filter-active]="memberStatusFilter === f" (click)="memberStatusFilter = f">
                      {{ f | titlecase }}
                      @if (f !== 'all' && memberCountByStatus(f) > 0) {
                        <span class="filter-count" [class.count-green]="f === 'active'">{{ memberCountByStatus(f) }}</span>
                      }
                    </button>
                  }
                </div>

                @if (membersLoading) {
                  <p class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading members…</p>
                } @else if (membersError) {
                  <p class="state-msg state-msg-error">{{ membersError }}</p>
                } @else if (filteredMembers.length === 0) {
                  <p class="state-msg">No {{ memberStatusFilter === 'all' ? '' : memberStatusFilter }} members found.</p>
                } @else {
                  <div class="members-header-row">
                    <span class="members-count-label">{{ filteredMembers.length }} {{ filteredMembers.length === 1 ? 'member' : 'members' }}</span>
                  </div>
                  <div class="admin-grid">
                    @for (member of filteredMembers; track member._id) {
                      <div class="admin-card member-card">
                        <div class="admin-avatar member-avatar">
                          @if (member.profileImage) {
                            <img [src]="member.profileImage" [alt]="member.name" class="member-club-logo" />
                          } @else {
                            <i class="fas fa-user"></i>
                          }
                        </div>
                        <div class="admin-info">
                          <div class="admin-name">{{ member.name }}</div>
                          <div class="admin-username">&#64;{{ member.username }}</div>
                          @if (member.email) { <div class="admin-email">{{ member.email }}</div> }
                          <div class="admin-email member-since">Since {{ formatDate(member.createdAt) }}</div>
                        </div>
                        <div class="admin-badges">
                          <span class="badge badge-role">{{ member.role }}</span>
                          <span class="badge" [class.badge-active]="member.status === 'active'" [class.badge-inactive]="member.status !== 'active'">{{ member.status }}</span>
                          <button type="button" class="btn-mirror" (click)="loginAs(member)" [disabled]="mirroringUserId === member._id">
                            <i class="fas fa-user-secret"></i>
                            {{ mirroringUserId === member._id ? 'Logging in…' : 'Login as' }}
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- ── CHAT TAB ── -->
            @if (activeTab === 'chat' && auth.isSuperAdmin()) {
              <div class="list-card">
                @if (chatLoading) {
                  <p class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading chats…</p>
                } @else if (chatError) {
                  <p class="state-msg state-msg-error">{{ chatError }}</p>
                } @else if (clubInquiries.length === 0) {
                  <p class="state-msg">No inquiries for this club yet.</p>
                } @else {
                  <div class="item-list">
                    @for (inq of clubInquiries; track inq._id) {
                      <div class="item-card" [class.item-approved]="inq.status === 'replied'" style="cursor:pointer" (click)="expandedChatId = expandedChatId === inq._id ? null : inq._id">
                        <div class="item-top">
                          <span class="badge" [class.badge-role]="inq.status === 'unread'" [class.badge-active]="inq.status === 'replied'" [class.badge-inactive]="inq.status === 'read'">
                            {{ inq.status }}
                          </span>
                          <span class="item-meta"><i class="fas fa-user"></i> {{ inq.senderName }}</span>
                          <span class="item-meta">{{ inq.senderEmail }}</span>
                          <span class="item-meta">{{ formatDate(inq.createdAt) }}</span>
                          <span class="item-meta"><i class="fas fa-comment"></i> {{ inq.messages.length }} msg{{ inq.messages.length !== 1 ? 's' : '' }}</span>
                          <i class="fas" [class.fa-chevron-down]="expandedChatId !== inq._id" [class.fa-chevron-up]="expandedChatId === inq._id" style="margin-left:auto;opacity:0.4;font-size:0.75rem"></i>
                        </div>
                        @if (expandedChatId === inq._id) {
                          <div class="chat-thread-view">
                            @for (msg of inq.messages; track msg.createdAt) {
                              <div class="chat-bubble-row" [class.chat-bubble-guest]="msg.sender === 'guest'" [class.chat-bubble-admin]="msg.sender === 'admin'">
                                <span class="chat-bubble-name">{{ msg.sender === 'guest' ? inq.senderName : msg.name }}</span>
                                <div class="chat-bubble-body">{{ msg.body }}</div>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }


          </section>
        }
      }
    </div>

    <!-- ── Delete club confirmation modal ── -->
    @if (deleteModal().club) {
      <div class="modal-backdrop" (click)="closeDeleteModal()">
        <div class="modal-card modal-card-delete" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title modal-title-danger"><i class="fas fa-trash"></i> Delete Club</span>
            <button type="button" class="modal-close" (click)="closeDeleteModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="delete-modal-body">
            <div class="delete-warn-icon"><i class="fas fa-triangle-exclamation"></i></div>
            <p class="delete-modal-msg">
              You are about to permanently delete
              <strong class="delete-club-name">{{ deleteModal().club!.name }}</strong>.
              This action cannot be undone.
            </p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-danger" (click)="confirmDelete()" [disabled]="deleteModal().deleting">
              <i class="fas" [class.fa-trash]="!deleteModal().deleting" [class.fa-circle-notch]="deleteModal().deleting" [class.fa-spin]="deleteModal().deleting"></i>
              {{ deleteModal().deleting ? 'Deleting…' : 'Yes, delete' }}
            </button>
            <button type="button" class="btn btn-outline" (click)="closeDeleteModal()">Cancel</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Suspend / unsuspend club confirmation modal ── -->
    @if (suspendModal().club) {
      <div class="modal-backdrop" (click)="closeSuspendModal()">
        <div class="modal-card modal-card-suspend" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title modal-title-suspend">
              <i class="fas fa-{{ suspendModal().club!.status === 'suspended' ? 'circle-check' : 'ban' }}"></i>
              {{ suspendModal().club!.status === 'suspended' ? 'Unsuspend' : 'Suspend' }} Club
            </span>
            <button type="button" class="modal-close" (click)="closeSuspendModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="delete-modal-body">
            <div class="suspend-warn-icon">
              <i class="fas fa-{{ suspendModal().club!.status === 'suspended' ? 'circle-check' : 'ban' }}"></i>
            </div>
            @if (suspendModal().club!.status === 'suspended') {
              <p class="delete-modal-msg">
                Unsuspend <strong class="delete-club-name">{{ suspendModal().club!.name }}</strong>?
                It will reappear in the registration list and be treated as active.
              </p>
            } @else {
              <p class="delete-modal-msg">
                Suspend <strong class="delete-club-name">{{ suspendModal().club!.name }}</strong>?
                It will be hidden from new registrations. Existing members are unaffected.
              </p>
            }
          </div>
          <div class="modal-actions">
            <button type="button"
              class="btn {{ suspendModal().club!.status === 'suspended' ? 'btn-teal' : 'btn-suspend-confirm' }}"
              (click)="confirmSuspend()" [disabled]="suspendModal().suspending">
              <i class="fas" [class.fa-circle-check]="!suspendModal().suspending && suspendModal().club!.status === 'suspended'"
                [class.fa-ban]="!suspendModal().suspending && suspendModal().club!.status !== 'suspended'"
                [class.fa-circle-notch]="suspendModal().suspending" [class.fa-spin]="suspendModal().suspending"></i>
              {{ suspendModal().suspending ? 'Saving…' : (suspendModal().club!.status === 'suspended' ? 'Yes, unsuspend' : 'Yes, suspend') }}
            </button>
            <button type="button" class="btn btn-outline" (click)="closeSuspendModal()">Cancel</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Reject charge payment modal ── -->
    @if (rejectChargeModal.show) {
      <div class="modal-backdrop" (click)="closeRejectChargeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title modal-title-danger"><i class="fas fa-times-circle"></i> Reject Payment</span>
            <button type="button" class="modal-close" (click)="closeRejectChargeModal()"><i class="fas fa-times"></i></button>
          </div>
          <p class="modal-desc">Optionally add a reason for rejection:</p>
          <textarea class="modal-textarea" [(ngModel)]="rejectChargeModal.note" name="rejectChargeNote" rows="3" placeholder="Rejection reason (optional)"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn btn-danger" (click)="confirmRejectCharge()" [disabled]="rejectChargeModal.submitting">
              {{ rejectChargeModal.submitting ? 'Rejecting…' : 'Confirm Reject' }}
            </button>
            <button type="button" class="btn btn-outline" (click)="closeRejectChargeModal()">Cancel</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Record app service payment modal ── -->
    @if (aspModal.show) {
      <div class="modal-backdrop" (click)="closeAspModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title"><i class="fas fa-paper-plane"></i> Record Payment to Developer</span>
            <button type="button" class="modal-close" (click)="closeAspModal()"><i class="fas fa-times"></i></button>
          </div>
          <p class="modal-desc">Outstanding balance: <strong>₱{{ aspBalance | number:'1.2-2' }}</strong></p>
          @if (aspModal.error) { <div class="form-alert form-alert-error">{{ aspModal.error }}</div> }
          <div class="modal-form">
            <label class="form-label">Amount (PHP)
              <input class="form-input" type="number" [(ngModel)]="aspModal.amount" name="aspAmount" min="0.01" step="0.01" />
            </label>
            <label class="form-label">Payment Method
              <select class="form-input" [(ngModel)]="aspModal.method" name="aspMethod">
                <option value="GCash">GCash</option>
                <option value="QRPh">QRPh</option>
              </select>
            </label>
            <label class="form-label">Note <span class="form-hint">optional</span>
              <input class="form-input" type="text" [(ngModel)]="aspModal.note" name="aspNote" placeholder="e.g. April 2025 app service" />
            </label>
            <div class="form-label">
              Payment Screenshot
              @if (aspScreenshot) {
                <div class="asp-proof-preview">
                  <img [src]="aspScreenshotPreviewUrl" alt="Payment screenshot preview" class="asp-proof-img" />
                  <button type="button" class="asp-proof-remove" (click)="removeAspScreenshot()">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              } @else {
                <label class="asp-proof-upload">
                  <input type="file" accept="image/*" (change)="onAspScreenshotChange($event)" />
                  <i class="fas fa-camera"></i>
                  <span>Attach screenshot</span>
                </label>
              }
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" (click)="confirmAspPayment()" [disabled]="aspModal.submitting || aspModal.amount <= 0 || !aspScreenshot">
              <i class="fas fa-check"></i> {{ aspModal.submitting ? 'Saving…' : 'Record Payment' }}
            </button>
            <button type="button" class="btn btn-outline" (click)="closeAspModal()">Cancel</button>
          </div>
        </div>
      </div>
    }

    @if (chatTarget) {
      <app-admin-chat-modal
        [recipientId]="chatTarget._id"
        [recipientName]="chatTarget.name"
        (closed)="chatTarget = null"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    /* ── Page ── */
    .clubs-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ── Hero ── */
    .hero-panel {
      background: linear-gradient(135deg, #f6efe4 0%, #efe2cf 100%);
      border: 1px solid rgba(184,137,66,0.2);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      box-shadow: 0 4px 16px rgba(159,115,56,0.12);
    }

    @media (max-width: 768px) {
      .hero-panel { flex-direction: column; align-items: stretch; }
    }

    .hero-kicker {
      margin: 0 0 0.2rem;
      font-size: 0.72rem;
      font-weight: 800;
      color: #b88942;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .hero-title {
      margin: 0 0 0.25rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.02em;
    }

    .hero-sub {
      margin: 0;
      font-size: 0.88rem;
      color: rgba(17,24,39,0.6);
    }

    .db-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: 0.5rem;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .db-local {
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #6ee7b7;
    }
    .db-atlas {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .count-chip {
      background: rgba(184,137,66,0.12);
      color: #b88942;
      border: 1px solid rgba(184,137,66,0.25);
      border-radius: 999px;
      padding: 0.4rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      white-space: nowrap;
    }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
      text-decoration: none;
      transition: all 0.15s ease;
      white-space: nowrap;
      font-family: inherit;
    }

    .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

    .btn-primary {
      background: #b88942;
      color: #ffffff;
      border-color: #b88942;
      box-shadow: 0 2px 8px rgba(184,137,66,0.3);
    }
    .btn-primary:hover:not(:disabled) { background: #9f7338; border-color: #9f7338; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(184,137,66,0.35); }

    .btn-purple {
      background: #7c3aed;
      color: #ffffff;
      border-color: #7c3aed;
      box-shadow: 0 2px 8px rgba(124,58,237,0.25);
    }
    .btn-purple:hover:not(:disabled) { background: #6d28d9; transform: translateY(-1px); }

    .btn-dev {
      background: rgba(139,92,246,0.16);
      color: #c4b5fd;
      border-color: rgba(139,92,246,0.36);
    }
    .btn-dev:hover:not(:disabled) { background: rgba(139,92,246,0.26); transform: translateY(-1px); }

    .btn-outline {
      background: #ffffff;
      color: #374151;
      border-color: rgba(55,65,81,0.25);
    }
    .btn-outline:hover:not(:disabled) { background: #f9fafb; border-color: rgba(55,65,81,0.4); transform: translateY(-1px); }

    .btn-teal {
      background: rgba(20,184,166,0.1);
      color: #0f766e;
      border-color: rgba(20,184,166,0.3);
    }
    .btn-teal:hover:not(:disabled) { background: rgba(20,184,166,0.18); transform: translateY(-1px); }

    .btn-message {
      background: rgba(159,115,56,0.08);
      color: #9f7338;
      border-color: rgba(159,115,56,0.3);
    }
    .btn-message:hover:not(:disabled) { background: #9f7338; color: #fff; transform: translateY(-1px); }

    .btn-danger {
      background: #fff3f3;
      color: #dc2626;
      border-color: rgba(220,38,38,0.3);
    }
    .btn-danger:hover:not(:disabled) { background: #fee2e2; transform: translateY(-1px); }

    .btn-suspend {
      background: #fff7ed;
      color: #c2410c;
      border-color: rgba(234,88,12,0.3);
    }
    .btn-suspend:hover:not(:disabled) { background: #ffedd5; transform: translateY(-1px); }

    .btn-unsuspend {
      background: rgba(20,184,166,0.08);
      color: #0f766e;
      border-color: rgba(20,184,166,0.3);
    }
    .btn-unsuspend:hover:not(:disabled) { background: rgba(20,184,166,0.16); transform: translateY(-1px); }

    .btn-copy {
      background: rgba(99,102,241,0.08);
      color: #4f46e5;
      border-color: rgba(99,102,241,0.25);
    }
    .btn-copy:hover:not(:disabled) { background: rgba(99,102,241,0.14); transform: translateY(-1px); }

    .btn-suspend-confirm {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid rgba(234,88,12,0.35);
      padding: 0.55rem 1.2rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: background 0.15s, transform 0.15s;
    }
    .btn-suspend-confirm:hover:not(:disabled) { background: #ffedd5; transform: translateY(-1px); }
    .btn-suspend-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

    .modal-card-suspend { border-top: 3px solid #f97316; }
    .modal-title-suspend { color: #c2410c; }
    .suspend-warn-icon {
      font-size: 2.5rem;
      color: #f97316;
      margin-bottom: 0.75rem;
    }

    .btn-approve {
      background: #f0fdf4;
      color: #166534;
      border-color: rgba(22,163,74,0.3);
    }
    .btn-approve:hover:not(:disabled) { background: #dcfce7; }

    .btn-reject {
      background: #fff3f3;
      color: #dc2626;
      border-color: rgba(220,38,38,0.25);
    }
    .btn-reject:hover:not(:disabled) { background: #fee2e2; }

    .btn-sm {
      padding: 0.38rem 0.75rem;
      font-size: 0.8rem;
      border-radius: 7px;
    }

    /* ── Skeleton ── */
    .cg-loader-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(8,20,12,0.96);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: cgFadeIn 0.2s ease-out;
    }
    @keyframes cgFadeIn { from { opacity: 0; } to { opacity: 1; } }

    .cg-loader-scene {
      position: relative;
      width: min(420px, 90vw);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .cg-loader-img {
      width: 100%;
      display: block;
      border-radius: 12px;
      animation: cgPulse 2.4s ease-in-out infinite;
    }
    @keyframes cgPulse {
      0%, 100% { filter: brightness(1)    drop-shadow(0 0  8px rgba(163,230,53,0.20)); }
      50%       { filter: brightness(1.08) drop-shadow(0 0 18px rgba(163,230,53,0.45)); }
    }

    .cg-loader-spin-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -54%);
      width: 54%;
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: #a3e635;
      border-right-color: rgba(163,230,53,0.3);
      animation: cgSpin 1.6s linear infinite;
      pointer-events: none;
    }
    @keyframes cgSpin { to { transform: translate(-50%, -54%) rotate(360deg); } }

    .cg-loader-ball-glow {
      position: absolute;
      bottom: 22%;
      left: 50%;
      transform: translateX(-50%);
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #a3e635;
      box-shadow: 0 0 8px 2px rgba(163,230,53,0.6);
      animation: cgBallPulse 1.6s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes cgBallPulse {
      0%, 100% { transform: translateX(-50%) scale(1);   opacity: 0.85; }
      50%       { transform: translateX(-50%) scale(1.4); opacity: 1; }
    }

    .cg-loader-bar {
      width: 55%;
      height: 3px;
      background: rgba(163,230,53,0.12);
      border-radius: 99px;
      overflow: hidden;
      margin-top: -14%;
    }
    .cg-loader-bar-fill {
      height: 100%;
      width: 40%;
      background: linear-gradient(90deg, transparent, #a3e635, transparent);
      border-radius: 99px;
      animation: cgShimmer 1.4s ease-in-out infinite;
    }
    @keyframes cgShimmer {
      0%   { transform: translateX(-150%); }
      100% { transform: translateX(350%); }
    }

    /* ── State cards ── */
    .state-card {
      background: #ffffff;
      border: 1px solid rgba(184,137,66,0.15);
      border-radius: 14px;
      padding: 2.5rem 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
    }

    .state-card i { font-size: 2rem; color: #b88942; }
    .state-card h3 { margin: 0; font-size: 1.1rem; color: #111827; }
    .state-card p { margin: 0; color: rgba(17,24,39,0.55); font-size: 0.88rem; }

    .state-error i, .state-error p { color: #dc2626; }

    /* ── Club grid ── */
    .clubs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .club-card {
      background: #ffffff;
      border: 1.5px solid rgba(184,137,66,0.15);
      border-radius: 14px;
      overflow: hidden;
      padding: 0 1rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: 0 2px 12px rgba(159,115,56,0.08);
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    }

    .club-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(159,115,56,0.14); border-color: rgba(184,137,66,0.35); }
    .club-card.selected { border-color: #b88942; box-shadow: 0 4px 20px rgba(184,137,66,0.22); }
    .club-card:focus-visible { outline: 2px solid #b88942; outline-offset: 2px; }

    .card-accent {
      height: 4px;
      margin: 0 -1rem;
      background: linear-gradient(90deg, #b88942, #c9a15d, #f59e0b);
    }

    .club-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .club-logo {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid rgba(184,137,66,0.2);
      flex-shrink: 0;
    }

    .club-logo-placeholder {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f6efe4, #e8d7bf);
      color: #b88942;
      font-weight: 800;
      font-size: 1rem;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .club-identity h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #111827;
      line-height: 1.2;
    }

    .club-id {
      margin: 0.15rem 0 0;
      font-size: 0.7rem;
      color: rgba(17,24,39,0.4);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
      font-family: monospace;
    }

    .club-booking-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.35rem;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      background: rgba(99,102,241,0.12);
      border: 1px solid rgba(99,102,241,0.28);
      color: #818cf8;
    }

    /* Pills */
    .club-pills { display: flex; flex-wrap: wrap; gap: 0.4rem; }

    .pill {
      border-radius: 999px;
      padding: 0.28rem 0.65rem;
      font-size: 0.73rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .pill-default { background: #f6f5f0; border: 1px solid rgba(17,24,39,0.1); color: rgba(17,24,39,0.65); }
    .pill-fee { background: rgba(184,137,66,0.1); border: 1px solid rgba(184,137,66,0.3); color: #b88942; font-weight: 700; }

    .pill-pending {
      background: #fff7ed;
      border: 1px solid rgba(234,88,12,0.3);
      color: #c2410c;
      font-weight: 700;
      animation: pulse-ring 2s ease-in-out infinite;
    }
    .pill-pending i { color: #ea580c; }
    @keyframes pulse-ring { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 0 3px rgba(234,88,12,0.12)} }

    .pill-suspended {
      background: #fff7ed;
      border: 1px solid rgba(234,88,12,0.35);
      color: #9a3412;
      font-weight: 700;
    }
    .pill-suspended i { color: #ea580c; }

    .pill-terms-ok {
      background: rgba(34,197,94,0.15);
      border: 1px solid rgba(34,197,94,0.25);
      color: #4ade80;
      font-weight: 600;
    }
    .pill-terms-pending {
      background: rgba(234,179,8,0.15);
      border: 1px solid rgba(234,179,8,0.25);
      color: #facc15;
      font-weight: 600;
    }

    /* Club actions */
    .club-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .club-actions .btn-sm {
      width: 34px;
      height: 34px;
      padding: 0;
      justify-content: center;
      flex-shrink: 0;
    }

    /* ── Detail panel ── */
    .detail-panel {
      background: #ffffff;
      border: 1px solid rgba(184,137,66,0.15);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(159,115,56,0.1);
    }

    .detail-header {
      padding: 1.1rem 1.25rem;
      border-bottom: 1px solid rgba(184,137,66,0.12);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      background: linear-gradient(135deg, #faf7f2, #ffffff);
    }

    .detail-sub {
      margin: 0.2rem 0 0;
      font-size: 0.82rem;
      color: rgba(17,24,39,0.55);
    }

    /* Tabs */
    .tabs-bar {
      display: flex;
      gap: 0;
      border-bottom: 1px solid rgba(184,137,66,0.12);
      padding: 0 1rem;
      overflow-x: auto;
    }

    .tab-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      padding: 0.75rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 700;
      color: rgba(17,24,39,0.5);
      cursor: pointer;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }

    .tab-btn:hover { color: #b88942; }

    .tab-active {
      color: #b88942;
      border-bottom-color: #b88942;
    }

    .tab-badge {
      background: #f97316;
      color: #fff;
      border-radius: 999px;
      padding: 0.06rem 0.42rem;
      font-size: 0.68rem;
      font-weight: 800;
      line-height: 1.4;
    }

    .tab-badge-amber { background: #d97706; }

    /* ── Form card ── */
    .form-card {
      margin: 1rem 1.25rem 0;
      background: #faf7f2;
      border: 1px solid rgba(184,137,66,0.18);
      border-radius: 12px;
      padding: 1rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }

    .form-label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #374151;
    }

    .form-hint {
      font-size: 0.7rem;
      font-weight: 500;
      color: rgba(55,65,81,0.5);
      text-transform: none;
    }

    .form-input {
      padding: 0.55rem 0.75rem;
      border: 1px solid rgba(55,65,81,0.2);
      border-radius: 8px;
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
      background: #ffffff;
      color: #111827;
    }

    .form-input:focus { border-color: #b88942; box-shadow: 0 0 0 3px rgba(184,137,66,0.12); }

    .form-actions {
      display: flex;
      gap: 0.6rem;
      margin-top: 0.85rem;
      flex-wrap: wrap;
    }

    .form-alert {
      border-radius: 8px;
      padding: 0.6rem 0.8rem;
      font-size: 0.82rem;
      margin-bottom: 0.65rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .form-alert-error { background: #fef2f2; border: 1px solid rgba(220,38,38,0.2); color: #dc2626; }
    .form-alert-success { background: #f0fdf4; border: 1px solid rgba(22,163,74,0.2); color: #166534; }

    /* ── List card ── */
    .list-card {
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .state-msg {
      color: rgba(17,24,39,0.5);
      font-size: 0.86rem;
      margin: 0;
      padding: 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .state-msg-error { color: #dc2626; }

    /* Admin grid */
    .admin-grid { display: flex; flex-direction: column; gap: 0.6rem; }

    .admin-card {
      border: 1px solid rgba(184,137,66,0.15);
      border-radius: 10px;
      padding: 0.75rem 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #faf7f2;
    }

    .admin-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f6efe4, #e8d7bf);
      color: #b88942;
      font-weight: 800;
      font-size: 0.82rem;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .member-avatar {
      font-size: 1rem;
      font-weight: 400;
      background: linear-gradient(135deg, #1b3028, #2d4f3c) !important;
      color: #a3e635 !important;
      border: 2px solid rgba(163,230,53,0.4) !important;
      overflow: hidden;
    }
    .member-club-logo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .admin-info { flex: 1; min-width: 0; }
    .admin-name { font-size: 0.9rem; font-weight: 700; color: #111827; }
    .admin-username { font-size: 0.78rem; color: rgba(17,24,39,0.55); }
    .admin-email { font-size: 0.75rem; color: rgba(17,24,39,0.45); }

    .admin-badges { display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end; }
    .btn-mirror {
      background: rgba(99,102,241,0.10);
      color: #818cf8;
      border: 1px solid rgba(99,102,241,0.28);
      border-radius: 6px;
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      cursor: pointer;
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      transition: background 0.15s;
    }
    .btn-mirror:hover:not(:disabled) { background: rgba(99,102,241,0.22); }
    .btn-mirror:disabled { opacity: 0.5; cursor: not-allowed; }

    .badge {
      border-radius: 999px;
      padding: 0.15rem 0.55rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: capitalize;
    }

    .badge-role { background: rgba(184,137,66,0.12); color: #b88942; }
    .badge-active { background: #f0fdf4; color: #166534; }
    .badge-inactive { background: #f1f5f9; color: #475569; }
    .badge-purple { background: #ede9fe; color: #5b21b6; }
    .badge-res { background: rgba(20,184,166,0.12); color: #0f766e; }
    .badge-ses { background: #eff6ff; color: #1d4ed8; }

    /* Filter row */
    .filter-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }

    .filter-btn {
      background: #f6f5f0;
      border: 1px solid rgba(17,24,39,0.12);
      border-radius: 999px;
      padding: 0.32rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      color: rgba(17,24,39,0.6);
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      transition: all 0.15s;
    }
    .filter-btn:hover { background: #efe2cf; color: #b88942; border-color: rgba(184,137,66,0.3); }
    .filter-active { background: rgba(184,137,66,0.12); color: #b88942; border-color: rgba(184,137,66,0.3); }

    .filter-count { background: #f97316; color: #fff; border-radius: 999px; padding: 0.04rem 0.38rem; font-size: 0.68rem; font-weight: 800; }
    .count-green { background: #16a34a; }
    .count-red { background: #b91c1c; }

    /* Item list */
    .item-list { display: flex; flex-direction: column; gap: 0.55rem; }

    .item-card {
      border: 1px solid rgba(17,24,39,0.1);
      border-radius: 10px;
      padding: 0.75rem 0.9rem;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .item-approved { border-color: rgba(22,163,74,0.2); background: #fafffe; }
    .item-rejected { border-color: rgba(220,38,38,0.15); background: #fffafa; }

    .item-top { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }

    .item-meta { font-size: 0.75rem; color: rgba(17,24,39,0.5); }

    .item-note { margin: 0; font-size: 0.8rem; color: rgba(17,24,39,0.6); font-style: italic; }

    .item-reject-note { margin: 0; font-size: 0.78rem; color: #dc2626; display: flex; align-items: center; gap: 0.3rem; }

    .item-resolved { margin: 0; font-size: 0.78rem; color: #dc2626; display: flex; align-items: center; gap: 0.3rem; }
    .resolved-ok { color: #166534; }

    .item-actions { display: flex; gap: 0.45rem; flex-wrap: wrap; }

    .charge-amount { font-weight: 800; font-size: 0.92rem; color: #111827; }

    .payment-approval-list { gap: 0.35rem; }

    .payment-approval-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.7rem;
      padding: 0.48rem 0.65rem;
      min-height: 44px;
    }

    .payment-approval-main {
      display: grid;
      grid-template-columns: 92px 104px 86px minmax(120px, 1fr) 88px auto auto;
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
      flex-wrap: nowrap;
    }

    .payment-approval-amount,
    .payment-approval-type,
    .payment-approval-method,
    .payment-approval-date,
    .payment-approval-status {
      white-space: nowrap;
    }

    .payment-approval-player,
    .payment-approval-note {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .payment-approval-note,
    .payment-approval-status {
      margin: 0;
      font-size: 0.74rem;
    }

    .payment-approval-actions {
      justify-content: flex-end;
      flex-wrap: nowrap;
      gap: 0.35rem;
    }

    .payment-approval-actions .btn-sm {
      min-height: 30px;
      padding: 0.34rem 0.62rem;
      white-space: nowrap;
    }

    /* Convenience Fee Settings Card */
    .cfs-card {
      border: 1px solid rgba(163,230,53,0.16); border-radius: 14px; overflow: hidden;
      background: rgba(163,230,53,0.03); margin-bottom: 1.25rem;
    }
    .cfs-header {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;
      padding: 1rem 1.1rem; border-bottom: 1px solid rgba(163,230,53,0.12);
      background: rgba(163,230,53,0.06);
    }
    .cfs-header-left { display: flex; align-items: center; gap: 0.75rem; }
    .cfs-icon {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: rgba(163,230,53,0.16); border: 1px solid rgba(163,230,53,0.28);
      display: flex; align-items: center; justify-content: center;
      color: var(--dm-accent); font-size: 1rem;
    }
    .cfs-title { font-size: 0.9rem; font-weight: 800; color: var(--dm-text); }
    .cfs-subtitle { font-size: 0.72rem; color: var(--dm-muted); margin-top: 0.1rem; }
    .cfs-current-badge {
      background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.26);
      color: var(--dm-accent); font-size: 0.75rem; font-weight: 700;
      padding: 0.25rem 0.7rem; border-radius: 999px;
    }
    .cfs-body { padding: 1.1rem; display: flex; flex-direction: column; gap: 1.1rem; }
    .cfs-field { display: flex; flex-direction: column; gap: 0.5rem; }
    .cfs-field-label {
      font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--dm-muted);
    }
    .cfs-rate-row { display: flex; align-items: center; gap: 0.55rem; }
    .cfs-rate-input {
      width: 80px; padding: 0.5rem 0.65rem; border-radius: 10px; text-align: center;
      border: 1px solid rgba(163,230,53,0.28); font-size: 1.2rem; font-weight: 800;
      background: rgba(163,230,53,0.08); color: var(--dm-accent);
      font-family: inherit; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .cfs-rate-input:focus { border-color: rgba(163,230,53,0.54); box-shadow: 0 0 0 3px rgba(163,230,53,0.14); }
    .cfs-rate-input::-webkit-inner-spin-button, .cfs-rate-input::-webkit-outer-spin-button { opacity: 1; }
    .cfs-pct { font-size: 1.2rem; font-weight: 800; color: var(--dm-accent); }
    .cfs-rate-hint { font-size: 0.75rem; color: var(--dm-muted); margin-left: 0.2rem; }
    .cfs-mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
    .cfs-mode-opt {
      display: flex; flex-direction: column; align-items: flex-start; gap: 0.2rem;
      padding: 0.85rem 0.9rem; border-radius: 10px; cursor: pointer;
      background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.1);
      transition: all 0.15s; font-family: inherit; text-align: left;
    }
    .cfs-mode-opt i { font-size: 1rem; color: rgba(255,255,255,0.35); margin-bottom: 0.2rem; transition: color 0.15s; }
    .cfs-mode-opt:hover { background: rgba(255,255,255,0.08); border-color: rgba(163,230,53,0.24); }
    .cfs-mode-opt:hover i { color: var(--dm-accent); }
    .cfs-mode-opt-active { background: rgba(163,230,53,0.12) !important; border-color: rgba(163,230,53,0.42) !important; }
    .cfs-mode-opt-active i { color: var(--dm-accent) !important; }
    .cfs-mode-name { font-size: 0.85rem; font-weight: 700; color: var(--dm-text); }
    .cfs-mode-opt-active .cfs-mode-name { color: var(--dm-accent); }
    .cfs-mode-desc { font-size: 0.72rem; color: var(--dm-muted); }
    .cfs-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;
      padding: 0.85rem 1.1rem; border-top: 1px solid rgba(163,230,53,0.1);
      background: rgba(163,230,53,0.02);
    }
    .cfs-save-msg { font-size: 0.8rem; font-weight: 700; color: var(--dm-accent); display: flex; align-items: center; gap: 0.35rem; margin-right: auto; }
    .cfs-save-btn {
      padding: 0.55rem 1.2rem; border-radius: 10px; font-size: 0.875rem; font-weight: 700;
      background: rgba(163,230,53,0.16); color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.32); cursor: pointer; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.45rem; transition: all 0.15s;
    }
    .cfs-save-btn:hover:not(:disabled) { background: rgba(163,230,53,0.26); transform: translateY(-1px); }
    .cfs-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Hosted Play Queue Management toggle */
    .hpq-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.9rem;padding:.85rem 1rem;border:1px solid rgba(163,230,53,.22);border-radius:12px;background:rgba(8,25,17,.4)}
    .hpq-toggle-copy{display:flex;flex-direction:column;gap:.2rem;min-width:0}
    .hpq-toggle-title{color:var(--dm-text);font-size:.9rem;font-weight:800;display:flex;align-items:center;gap:.45rem}
    .hpq-toggle-title i{color:var(--dm-accent)}
    .hpq-toggle-desc{color:var(--dm-muted);font-size:.78rem;line-height:1.4}
    .hpq-switch{position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0}
    .hpq-switch input{opacity:0;width:0;height:0}
    .hpq-slider{position:absolute;inset:0;cursor:pointer;background:rgba(255,255,255,.16);border-radius:999px;transition:.2s}
    .hpq-slider:before{content:"";position:absolute;height:20px;width:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
    .hpq-switch input:checked + .hpq-slider{background:var(--dm-accent)}
    .hpq-switch input:checked + .hpq-slider:before{transform:translateX(20px)}
    .hpq-fee-row{margin-top:.75rem;padding:.85rem 1rem;border:1px solid rgba(163,230,53,.15);border-radius:12px;background:rgba(8,25,17,.4);display:flex;flex-direction:column;gap:.5rem}
    .hpq-fee-label{font-size:.82rem;font-weight:700;color:rgba(255,255,255,.8);display:flex;flex-direction:column;gap:.18rem}
    .hpq-fee-label i{color:#a3e635;margin-right:.35rem}
    .hpq-fee-hint{font-size:.72rem;font-weight:400;color:rgba(255,255,255,.45)}
    .hpq-fee-input-row{display:flex;align-items:center;gap:.5rem}
    .hpq-fee-prefix{color:#a3e635;font-weight:900;font-size:.95rem}
    .hpq-fee-input{width:100px;padding:.45rem .65rem;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:.88rem;font-family:inherit}
    .hpq-fee-input:focus{outline:none;border-color:rgba(163,230,53,.4)}
    .dupr-club-input{width:180px}

    /* Extra (additional) fees tab */
    .xfee-page{display:flex;flex-direction:column;gap:1rem}
    .xfee-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
    .xfee-setting-card,.xfee-fees-card{margin-bottom:0;background:rgba(28,52,39,.86);border-color:rgba(163,230,53,.18)}

    .xfee-status-pill,
    .xfee-count-chip,
    .xfee-type-chip {
      display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:.22rem .7rem;border-radius:999px;
      background:rgba(163,230,53,.15);border:1px solid rgba(163,230,53,.3);color:var(--dm-accent);font-size:.74rem;font-weight:800;white-space:nowrap;
    }
    .xfee-status-off{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.13);color:var(--dm-muted)}
    .xfee-switch-row{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:.8rem;padding:.8rem;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(8,25,17,.36);cursor:pointer}
    .xfee-switch-row input{width:18px;height:18px;accent-color:var(--dm-accent)}
    .xfee-switch-copy{display:flex;flex-direction:column;min-width:0;gap:.15rem}
    .xfee-switch-title{color:var(--dm-text);font-size:.88rem;font-weight:800}
    .xfee-switch-note{color:var(--dm-muted);font-size:.76rem;line-height:1.35}
    .xfee-actions{display:flex;align-items:center;justify-content:flex-end;gap:.65rem}
    .xfee-fees-body{padding:0;gap:0}
    .xfee-list{display:flex;flex-direction:column;gap:.65rem;padding:1rem 1.1rem .2rem}
    .xfee-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:.75rem;min-height:62px;background:rgba(8,25,17,.34);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.65rem .75rem}
    .xfee-info{display:flex;align-items:center;gap:.62rem;min-width:0;flex-wrap:wrap}
    .xfee-name{min-width:80px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.94rem;font-weight:800;color:var(--dm-text)}
    .xfee-amount{color:var(--dm-accent);font-size:.94rem;font-weight:900;white-space:nowrap}
    .xfee-type-chip{min-height:24px;padding-inline:.58rem;font-size:.68rem}
    .xfee-toggles{display:flex;align-items:center;justify-content:flex-end;gap:.65rem;flex-shrink:0}
    .xfee-toggle-label{display:inline-flex;align-items:center;gap:.35rem;min-height:28px;font-size:.82rem;font-weight:700;color:rgba(255,255,255,.86);cursor:pointer;white-space:nowrap}
    .xfee-toggle-label input[type=checkbox]{width:16px;height:16px;accent-color:var(--dm-accent)}
    .icon-btn{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--dm-muted);cursor:pointer}
    .icon-btn-danger{color:#fecdd3;border-color:rgba(244,63,94,.32);background:rgba(244,63,94,.12)}
    .xfee-empty-state{display:flex;align-items:center;gap:.65rem;margin:1rem 1.1rem .2rem;min-height:64px;padding:.85rem 1rem;border:1px dashed rgba(163,230,53,.22);border-radius:12px;background:rgba(8,25,17,.28);color:var(--dm-muted);font-size:.86rem;font-weight:700}
    .xfee-add-form{margin:1rem 1.1rem;padding:.9rem;border:1px dashed rgba(163,230,53,.24);border-radius:12px;background:rgba(8,25,17,.28)}
    .xfee-add-title{display:flex;align-items:center;gap:.45rem;margin-bottom:.65rem;color:var(--dm-accent);font-size:.8rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
    .xfee-add-fields{display:grid;grid-template-columns:minmax(180px,1fr) 128px 144px auto auto;align-items:center;gap:.6rem}
    .xfee-add-fields .form-input{width:100%;min-width:0}

    @media (max-width: 900px) {
      .xfee-settings-grid {
        grid-template-columns: 1fr;
      }

      .xfee-add-fields {
        grid-template-columns: 1fr 1fr;
      }

      .xfee-add-fields .btn-sm {
        width: auto;
        justify-content: center;
      }
    }

    @media (max-width: 640px) {
      .xfee-row {
        grid-template-columns: 1fr;
        align-items: stretch;
      }

      .xfee-toggles,
      .xfee-actions,
      .xfee-footer {
        justify-content: flex-start;
        flex-wrap: wrap;
      }

      .xfee-add-fields {
        grid-template-columns: 1fr;
      }

      .xfee-name {
        max-width: 100%;
      }
    }

    /* App service fees */
    .asp-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.6rem;
    }
    @media (max-width: 768px) { .asp-summary { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .asp-summary { grid-template-columns: 1fr 1fr; } }

    .asp-stat {
      background: #f6f5f0;
      border: 1px solid rgba(17,24,39,0.1);
      border-radius: 10px;
      padding: 0.75rem;
    }
    .asp-stat-due { background: #fff7ed; border-color: rgba(234,88,12,0.2); }
    .asp-stat-paid { background: #f0fdf4; border-color: rgba(22,163,74,0.2); }
    .asp-stat-outstanding { background: #fef2f2; border-color: rgba(220,38,38,0.2); }

    .asp-lbl { display: block; font-size: 0.7rem; font-weight: 700; color: rgba(17,24,39,0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    .asp-val { display: block; font-size: 1.05rem; font-weight: 800; color: #111827; }

    /* Bill Month card */
    .asp-bill-month-card {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 0.75rem;
      padding: 1rem 1.1rem; margin-bottom: 0.75rem;
      background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
      border: 1.5px solid rgba(59,130,246,0.3); border-radius: 12px;
    }
    .asp-bill-month-left { display: flex; align-items: center; gap: 0.8rem; }
    .asp-bill-month-icon {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.2);
      display: flex; align-items: center; justify-content: center;
      color: #2563eb; font-size: 1.1rem;
    }
    .asp-bill-month-title { font-size: 0.72rem; font-weight: 700; color: rgba(29,78,216,0.7); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem; }
    .asp-bill-month-amount { font-size: 1.15rem; font-weight: 800; color: #1e3a8a; line-height: 1; }
    .asp-bill-month-per { font-size: 0.78rem; font-weight: 600; color: rgba(29,78,216,0.6); }
    .asp-bill-month-right { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
    .asp-bill-month-msg { font-size: 0.8rem; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 0.3rem; }
    .asp-bill-month-msg-error { color: #dc2626; }
    .asp-bill-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 1.2rem; border-radius: 10px;
      font-size: 0.875rem; font-weight: 700; cursor: pointer;
      border: 1.5px solid rgba(37,99,235,0.35);
      background: rgba(37,99,235,0.1); color: #1d4ed8;
      transition: all 0.15s;
    }
    .asp-bill-btn:hover:not(:disabled) { background: rgba(37,99,235,0.18); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(37,99,235,0.15); }
    .asp-bill-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Billing row in history */
    .asp-pay-row-billing { border-left: 3px solid rgba(59,130,246,0.4); }
    .badge-billing { background: rgba(59,130,246,0.12); color: #2563eb; border: 1px solid rgba(59,130,246,0.2); }

    .asp-section { display: flex; flex-direction: column; gap: 0.5rem; }

    .asp-section-title {
      font-size: 0.82rem;
      font-weight: 800;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border-bottom: 1px solid rgba(184,137,66,0.12);
      padding-bottom: 0.5rem;
    }

    .asp-count {
      background: rgba(184,137,66,0.12);
      color: #b88942;
      border-radius: 999px;
      padding: 0.06rem 0.44rem;
      font-size: 0.7rem;
      font-weight: 800;
    }

    .asp-charge-list { display: flex; flex-direction: column; gap: 0.4rem; }

    .asp-charge-row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      flex-wrap: wrap;
      padding: 0.5rem 0.65rem;
      background: #ffffff;
      border: 1px solid rgba(17,24,39,0.08);
      border-radius: 8px;
      font-size: 0.82rem;
    }

    .asp-player { flex: 1; min-width: 80px; font-weight: 600; color: #111827; }
    .asp-date { color: rgba(17,24,39,0.48); font-size: 0.75rem; }
    .asp-amount-val { font-weight: 700; color: #111827; }
    .asp-fee-chip { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.22); border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 800; }

    .asp-pay-list { display: flex; flex-direction: column; gap: 0.4rem; }

    .asp-pay-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      flex-wrap: wrap;
      padding: 0.5rem 0.65rem;
      background: #ffffff;
      border: 1px solid rgba(17,24,39,0.08);
      border-radius: 8px;
    }

    .asp-pay-left { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
    .asp-pay-amount { font-weight: 800; font-size: 0.92rem; color: #166534; }
    .asp-note { font-size: 0.78rem; color: rgba(17,24,39,0.55); font-style: italic; }
    .asp-screenshot-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #2563eb;
      text-decoration: none;
    }
    .asp-screenshot-link:hover { text-decoration: underline; }
    .asp-pay-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; font-size: 0.75rem; color: rgba(17,24,39,0.5); }

    /* ── Modal ── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10,18,22,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 500;
      padding: 1rem;
    }

    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 1.5rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 50px rgba(10,18,22,0.2);
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      animation: modalIn 0.2s ease-out;
    }

    @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: none; } }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .modal-title {
      font-size: 1rem;
      font-weight: 700;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .modal-title-danger { color: #dc2626; }

    .modal-close {
      background: #f3f4f6;
      border: none;
      color: #6b7280;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .modal-close:hover { background: #e5e7eb; }

    .modal-desc { margin: 0; font-size: 0.86rem; color: rgba(17,24,39,0.65); }

    .modal-textarea {
      border: 1px solid rgba(55,65,81,0.2);
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
      font-family: inherit;
      resize: vertical;
      width: 100%;
      box-sizing: border-box;
      outline: none;
    }
    .modal-textarea:focus { border-color: #b88942; box-shadow: 0 0 0 3px rgba(184,137,66,0.12); }

    .modal-form { display: flex; flex-direction: column; gap: 0.6rem; }

    .modal-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }

    .asp-proof-upload {
      min-height: 86px;
      border: 1px dashed rgba(163,230,53,0.36);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      color: var(--dm-accent);
      background: rgba(163,230,53,0.06);
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .asp-proof-upload input { display: none; }
    .asp-proof-preview {
      position: relative;
      border: 1px solid rgba(163,230,53,0.22);
      border-radius: 10px;
      overflow: hidden;
      background: rgba(255,255,255,0.04);
    }
    .asp-proof-img {
      width: 100%;
      max-height: 220px;
      object-fit: contain;
      display: block;
      background: rgba(0,0,0,0.18);
    }
    .asp-proof-remove {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(0,0,0,0.65);
      color: #fff;
      cursor: pointer;
    }

    /* ── Responsive ── */
    @media (max-width: 640px) {
      .clubs-grid { grid-template-columns: 1fr; }
      .club-actions { grid-template-columns: 1fr; }
      .btn-outline, .btn-danger, .btn-teal { width: 100%; }
      .hero-actions { width: 100%; }
      .count-chip, .btn-purple, .btn-primary { justify-content: center; width: 100%; }
      .asp-charge-row { flex-direction: column; align-items: flex-start; }
      .payment-approval-row {
        grid-template-columns: 1fr;
        align-items: stretch;
      }
      .payment-approval-main {
        display: flex;
        flex-wrap: wrap;
      }
      .payment-approval-actions {
        justify-content: flex-start;
      }
      .payment-approval-actions .btn-sm {
        width: auto;
      }
    }

    /* Dashboard theme overrides: align /admin/clubs with /player/dashboard */
    :host {
      display: block;
      margin: -1.5rem;
      width: calc(100% + 3rem);
      font-family: inherit;
      --dm-bg: #0c1a11;
      --dm-surface: #1b3028;
      --dm-surface-hover: #213830;
      --dm-text: #ffffff;
      --dm-muted: rgba(255,255,255,0.62);
      --dm-soft: rgba(255,255,255,0.42);
      --dm-border: rgba(255,255,255,0.1);
      --dm-accent: #a3e635;
      --dm-accent-deep: #84cc16;
      --dm-danger: #fb7185;
      --dm-warning: #f59e0b;
      --dm-shadow: 0 8px 24px rgba(0,0,0,0.34);
    }

    @media (min-width: 769px) {
      :host { margin: 0; width: 100%; }
    }

    .clubs-page {
      max-width: 980px;
      margin: 0 auto;
      min-height: calc(100vh - 60px);
      padding: 1.25rem 1rem 2rem;
      background: var(--dm-bg);
      color: var(--dm-text);
      gap: 1.1rem;
      position: relative;
      isolation: isolate;
      overflow: hidden;
    }

    .clubs-page::before { content: none; }

    .hero-panel,
    .detail-panel,
    .club-card,
    .state-card,
    .list-card,
    .form-card,
    .modal-card {
      background: var(--dm-surface);
      border-color: var(--dm-border);
      box-shadow: var(--dm-shadow);
      color: var(--dm-text);
    }

    .hero-panel {
      border-radius: 16px;
      padding: 1.1rem 1.15rem;
      background: var(--dm-surface);
      border: 1px solid rgba(255,255,255,0.04);
    }

    .hero-kicker,
    .count-chip,
    .tab-active,
    .tab-btn:hover,
    .asp-pay-amount {
      color: var(--dm-accent);
    }

    .hero-title,
    .club-identity h3,
    .admin-name,
    .charge-amount,
    .state-card h3,
    .modal-title {
      color: var(--dm-text);
    }

    .hero-sub,
    .detail-sub,
    .item-meta,
    .state-card p,
    .state-msg,
    .admin-username,
    .admin-email,
    .modal-desc,
    .asp-note,
    .asp-pay-right {
      color: var(--dm-muted);
    }
    .asp-lbl { color: rgba(255,255,255,0.80); letter-spacing: 0.07em; }
    .asp-date { color: rgba(255,255,255,0.70); }

    .count-chip {
      background: rgba(163,230,53,0.14);
      border-color: rgba(163,230,53,0.28);
    }

    .btn {
      border-radius: 10px;
      transition: background 0.2s, transform 0.15s, border-color 0.2s;
    }

    .btn:hover:not(:disabled) { transform: translateY(-1px); }

    .btn-primary,
    .btn-purple,
    .btn-approve {
      background: rgba(163,230,53,0.16);
      border-color: rgba(163,230,53,0.34);
      color: var(--dm-accent);
      box-shadow: none;
    }

    .btn-primary:hover:not(:disabled),
    .btn-purple:hover:not(:disabled),
    .btn-approve:hover:not(:disabled) {
      background: rgba(163,230,53,0.24);
      border-color: rgba(163,230,53,0.48);
      color: #d9f99d;
    }

    .btn-outline,
    .btn-teal {
      background: rgba(255,255,255,0.04);
      border-color: rgba(255,255,255,0.18);
      color: var(--dm-text);
    }

    .btn-outline:hover:not(:disabled),
    .btn-teal:hover:not(:disabled) {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.3);
    }

    .btn-danger,
    .btn-reject {
      background: rgba(244,63,94,0.15);
      border-color: rgba(244,63,94,0.38);
      color: #fecdd3;
    }

    .btn-danger:hover:not(:disabled),
    .btn-reject:hover:not(:disabled) {
      background: rgba(244,63,94,0.22);
      border-color: rgba(244,63,94,0.5);
    }

    .club-card {
      border-width: 1px;
      border-radius: 14px;
      background: var(--dm-surface);
    }

    .club-card:hover {
      border-color: rgba(163,230,53,0.4);
      box-shadow: 0 14px 30px rgba(0,0,0,0.36);
      transform: translateY(-3px);
    }

    .club-card.selected {
      border-color: rgba(163,230,53,0.62);
      box-shadow: 0 0 0 1px rgba(163,230,53,0.18), 0 16px 32px rgba(0,0,0,0.38);
    }

    .club-card:focus-visible {
      outline-color: var(--dm-accent);
    }

    .card-accent {
      background: linear-gradient(90deg, #a3e635, #14b8a6, #60a5fa);
    }

    .club-logo,
    .club-logo-placeholder,
    .admin-avatar {
      border-color: rgba(163,230,53,0.28);
    }

    .club-logo-placeholder,
    .admin-avatar {
      background: rgba(163,230,53,0.16);
      color: var(--dm-accent);
    }

    .club-id {
      color: var(--dm-soft);
    }

    .pill-default,
    .badge,
    .filter-btn,
    .asp-stat,
    .asp-charge-row,
    .asp-pay-row,
    .item-card,
    .admin-card,
    .form-card,
    .form-input,
    .modal-textarea {
      background: rgba(255,255,255,0.04);
      border-color: rgba(255,255,255,0.14);
      color: var(--dm-text);
    }

    .pill-pending,
    .tab-badge,
    .filter-count {
      background: rgba(249,115,22,0.2);
      color: #fdba74;
      border: 1px solid rgba(249,115,22,0.34);
    }

    .tabs-bar {
      border-bottom: none;
      background: transparent;
    }

    .clubs-menu-bar {
      position: sticky;
      top: 0.7rem;
      z-index: 5;
      margin: 0.45rem 0.85rem 0.2rem;
      padding: 0.5rem;
      border: 1px solid rgba(163,230,53,0.08);
      border-radius: 12px;
      background: var(--dm-surface);
      box-shadow: 0 6px 18px rgba(0,0,0,0.36);
      gap: 0.35rem;
      display: flex;
      align-items: center;
    }

    .tab-btn {
      color: rgba(255,255,255,0.55);
      border-bottom-width: 0;
      border-radius: 10px;
      border: 1px solid transparent;
      padding: 0.56rem 0.9rem;
      margin-right: 0.4rem;
      transition: color 0.12s, border-color 0.16s, background 0.16s, transform 0.12s;
      background: transparent;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    .clubs-menu-bar .tab-btn {
      border-bottom-color: transparent;
    }

    /* Strong override to exactly match the player dashboard pill */
    .clubs-page .clubs-menu-bar .tab-btn {
      background: rgba(163,230,53,0.15) !important;
      color: #a3e635 !important;
      border: 1px solid rgba(163,230,53,0.30) !important;
      border-radius: 20px !important;
      padding: 0.32rem 0.9rem !important;
      font-weight: 700 !important;
      letter-spacing: 0.3px !important;
    }

    .clubs-page .clubs-menu-bar .tab-btn:hover {
      background: rgba(163,230,53,0.25) !important;
      color: #eaffb8 !important;
    }

    .clubs-page .clubs-menu-bar .tab-btn.tab-active {
      background: rgba(163,230,53,0.22) !important;
      border-color: rgba(163,230,53,0.38) !important;
      color: var(--dm-accent-deep) !important;
      transform: translateY(-1px) !important;
    }

    .tab-active {
      background: linear-gradient(180deg, rgba(163,230,53,0.12), rgba(163,230,53,0.08));
      border-color: rgba(163,230,53,0.36);
      color: var(--dm-accent-deep);
      box-shadow: 0 2px 6px rgba(0,0,0,0.36) inset;
      transform: translateY(-1px);
    }

    .clubs-menu-bar .tab-btn:hover {
      background: rgba(255,255,255,0.07);
      color: var(--dm-text);
    }

    .form-label,
    .asp-player,
    .item-note {
      color: var(--dm-text);
    }
    .asp-section-title { color: var(--dm-accent); border-bottom-color: rgba(163,230,53,0.22); }

    .form-input::placeholder,
    .modal-textarea::placeholder {
      color: rgba(255,255,255,0.4);
    }

    .form-input:focus,
    .modal-textarea:focus {
      border-color: rgba(163,230,53,0.54);
      box-shadow: 0 0 0 3px rgba(163,230,53,0.18);
    }

    .state-error i,
    .state-msg-error,
    .item-reject-note,
    .item-resolved,
    .modal-title-danger {
      color: var(--dm-danger);
    }

    .resolved-ok,
    .badge-active {
      color: #86efac;
      background: rgba(34,197,94,0.14);
      border-color: rgba(34,197,94,0.3);
    }

    .badge-role,
    .badge-purple,
    .badge-res,
    .badge-ses,
    .filter-active,
    .asp-count,
    .asp-fee-chip {
      background: rgba(163,230,53,0.14);
      border: 1px solid rgba(163,230,53,0.28);
      color: var(--dm-accent);
    }

    .asp-stat { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.20); }
    .asp-val { color: var(--dm-text); }

    .asp-stat-due {
      background: rgba(245,158,11,0.22);
      border-color: rgba(245,158,11,0.42);
    }
    .asp-stat-due .asp-val { color: #fcd34d; }

    .asp-stat-paid {
      background: rgba(34,197,94,0.18);
      border-color: rgba(34,197,94,0.36);
    }
    .asp-stat-paid .asp-val { color: #86efac; }

    .asp-stat-outstanding {
      background: rgba(244,63,94,0.18);
      border-color: rgba(244,63,94,0.36);
    }
    .asp-stat-outstanding .asp-val { color: #fda4af; }

    .asp-stat-waived {
      background: rgba(139,92,246,0.18);
      border-color: rgba(139,92,246,0.36);
    }
    .asp-stat-waived .asp-val { color: #c4b5fd; }

    .asp-pay-row-waived { background: rgba(139,92,246,0.07) !important; border-color: rgba(139,92,246,0.2) !important; }
    .asp-pay-amount-waived { color: #c4b5fd !important; }
    .badge-waived { background: rgba(139,92,246,0.18); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.34); display: inline-flex; align-items: center; gap: 4px; }

    .asp-charge-row { border-left: 3px solid rgba(163,230,53,0.50); padding-left: 0.85rem; }
    .asp-amount-val { color: var(--dm-text); }
    .asp-pay-row { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }

    .detail-header {
      border-bottom-color: var(--dm-border);
      background: linear-gradient(160deg, #1e352d 0%, #1a2f27 100%);
    }

    .modal-backdrop {
      background: rgba(5, 14, 10, 0.7);
      backdrop-filter: blur(2px);
    }

    .modal-close {
      background: rgba(255,255,255,0.08);
      color: var(--dm-muted);
    }

    .modal-close:hover {
      background: rgba(255,255,255,0.15);
    }

    .modal-card-delete { max-width: 400px; }

    .delete-modal-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.85rem;
      padding: 0.5rem 0;
      text-align: center;
    }

    .delete-warn-icon {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(244,63,94,0.12);
      border: 1px solid rgba(244,63,94,0.28);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      color: #fb7185;
    }

    .delete-modal-msg {
      margin: 0;
      font-size: 0.9rem;
      color: var(--dm-muted);
      line-height: 1.55;
    }

    .delete-club-name {
      color: var(--dm-text);
      font-weight: 700;
    }

    /* Members tab */
    .member-card { align-items: flex-start; }
    .member-since { margin-top: 0.15rem; font-size: 0.72rem; }
    .members-header-row { display: flex; align-items: center; justify-content: flex-end; }
    .members-count-label { font-size: 0.78rem; font-weight: 700; color: var(--dm-muted); }
    .tab-badge-members { background: rgba(163,230,53,0.22); color: #a3e635; border: 1px solid rgba(163,230,53,0.4); }

    @media (min-width: 769px) {
      .clubs-page {
        padding: 2rem 2.5rem 2.3rem;
      }

      .clubs-menu-bar {
        top: 1rem;
        margin: 0.6rem 1.15rem 0.3rem;
      }
    }

    /* ── Notification bell ── */
    .btn-notif {
      position: relative;
      background: rgba(163,230,53,0.08);
      border: 1px solid rgba(163,230,53,0.22);
      color: var(--dm-accent);
      padding: 0.5rem 0.65rem;
      min-width: 38px;
    }
    .btn-notif:hover { background: rgba(163,230,53,0.16); }

    .notif-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #ef4444;
      color: #fff;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 800;
      min-width: 17px;
      height: 17px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      line-height: 1;
      border: 2px solid var(--dm-bg);
    }

    /* ── Notification panel ── */
    .notif-panel {
      position: absolute;
      top: 4.8rem;
      right: 1rem;
      z-index: 200;
      width: min(380px, calc(100vw - 2rem));
      max-height: 480px;
      background: var(--dm-surface);
      border: 1px solid rgba(163,230,53,0.2);
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: notifPanelIn 0.18s ease-out;
    }
    @keyframes notifPanelIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }

    .notif-panel-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(163,230,53,0.04);
      flex-shrink: 0;
    }

    .notif-panel-title {
      flex: 1;
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--dm-accent);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn-text {
      background: none;
      border: none;
      color: rgba(163,230,53,0.65);
      font-size: 0.73rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
      white-space: nowrap;
      text-decoration: underline;
    }
    .btn-text:hover { color: var(--dm-accent); }

    .notif-close {
      background: rgba(255,255,255,0.06);
      border: none;
      color: var(--dm-muted);
      width: 26px;
      height: 26px;
      border-radius: 7px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .notif-close:hover { background: rgba(255,255,255,0.12); color: var(--dm-text); }

    .notif-list { overflow-y: auto; flex: 1; }

    .notif-empty {
      text-align: center;
      color: var(--dm-muted);
      font-size: 0.85rem;
      padding: 2rem 1rem;
      margin: 0;
    }

    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: 0.7rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      cursor: pointer;
      transition: background 0.12s;
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: rgba(255,255,255,0.04); }
    .notif-unread { background: rgba(163,230,53,0.04); }
    .notif-unread:hover { background: rgba(163,230,53,0.09); }

    .notif-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(163,230,53,0.1);
      border: 1px solid rgba(163,230,53,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.82rem;
      color: var(--dm-accent);
      flex-shrink: 0;
    }

    .notif-content { flex: 1; min-width: 0; }
    .notif-title { margin: 0 0 0.12rem; font-size: 0.82rem; font-weight: 700; color: var(--dm-text); }
    .notif-body { margin: 0 0 0.18rem; font-size: 0.77rem; color: var(--dm-muted); line-height: 1.4; }
    .notif-time { margin: 0; font-size: 0.68rem; color: rgba(255,255,255,0.32); }

    .notif-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--dm-accent);
      flex-shrink: 0;
      margin-top: 0.3rem;
      box-shadow: 0 0 6px rgba(163,230,53,0.45);
    }

    /* NEW club badge pill */
    .pill-new {
      background: rgba(163,230,53,0.14);
      color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.32);
      font-weight: 800;
      letter-spacing: 0.06em;
    }

    @media (max-width: 768px) {
      .clubs-menu-bar {
        margin: 0.4rem 0.6rem 0.15rem;
        padding: 0.35rem;
        top: 0.5rem;
      }

      .clubs-menu-bar .tab-btn {
        padding: 0.56rem 0.7rem;
        font-size: 0.78rem;
      }
    }

    .chat-thread-view {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin-top: 0.85rem;
      padding-top: 0.85rem;
      border-top: 1px solid rgba(0,0,0,0.07);
    }
    .chat-bubble-row {
      display: flex;
      flex-direction: column;
      max-width: 80%;
    }
    .chat-bubble-guest { align-self: flex-end; align-items: flex-end; }
    .chat-bubble-admin { align-self: flex-start; align-items: flex-start; }
    .chat-bubble-name {
      font-size: 0.65rem;
      font-weight: 700;
      color: rgba(255,255,255,0.38);
      margin-bottom: 0.18rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .chat-bubble-body {
      padding: 0.5rem 0.8rem;
      border-radius: 12px;
      font-size: 0.85rem;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .chat-bubble-guest .chat-bubble-body {
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.28);
      color: #d4f7a0;
      border-bottom-right-radius: 3px;
    }
    .chat-bubble-admin .chat-bubble-body {
      background: rgba(96,165,250,0.12);
      border: 1px solid rgba(96,165,250,0.28);
      color: rgba(255,255,255,0.88);
      border-bottom-left-radius: 3px;
    }

    /* ============================================================
       MODERN REDESIGN LAYER — professional dark / lime dashboard
       Keeps the existing palette (dark green surfaces + lime accent),
       restructures layout, hero, cards, tabs, panels & modals.
       ============================================================ */

    /* Wider, more spacious workspace with soft ambient glow */
    .clubs-page {
      max-width: 1200px;
      gap: 1.4rem;
      background:
        radial-gradient(1100px 460px at 12% -8%, rgba(163,230,53,0.10), transparent 60%),
        radial-gradient(900px 420px at 100% 0%, rgba(20,184,166,0.07), transparent 55%),
        var(--dm-bg);
    }

    /* ── Hero ─────────────────────────────────────────────── */
    .hero-panel {
      position: relative;
      overflow: hidden;
      border-radius: 20px;
      padding: 1.5rem 1.65rem;
      background:
        radial-gradient(620px 220px at 0% 0%, rgba(163,230,53,0.15), transparent 70%),
        linear-gradient(135deg, #21392e 0%, #15261e 100%);
      border: 1px solid rgba(163,230,53,0.16);
      box-shadow: 0 18px 42px rgba(0,0,0,0.42);
    }
    .hero-panel::after {
      content: '';
      position: absolute;
      right: -70px; top: -70px;
      width: 240px; height: 240px;
      background: radial-gradient(circle, rgba(163,230,53,0.16), transparent 70%);
      pointer-events: none;
    }
    .hero-left {
      display: flex;
      align-items: center;
      gap: 1.05rem;
      position: relative;
      z-index: 1;
      min-width: 0;
    }
    .hero-badge {
      width: 58px; height: 58px;
      flex-shrink: 0;
      border-radius: 17px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.55rem;
      color: #0c1a11;
      background: linear-gradient(135deg, #a3e635, #84cc16);
      box-shadow: 0 10px 22px rgba(163,230,53,0.32), inset 0 1px 0 rgba(255,255,255,0.35);
    }
    .hero-text { min-width: 0; }
    .hero-kicker {
      letter-spacing: 0.14em;
      font-size: 0.68rem;
      color: var(--dm-accent);
    }
    .hero-title { font-size: 1.7rem; letter-spacing: -0.02em; }
    .hero-actions { position: relative; z-index: 1; gap: 0.5rem; }

    /* Solid lime primary CTA stands proud of the translucent toolbar */
    .hero-actions .btn-primary {
      background: linear-gradient(135deg, #a3e635, #84cc16);
      color: #0c1a11;
      border-color: transparent;
      box-shadow: 0 8px 18px rgba(163,230,53,0.3);
    }
    .hero-actions .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #b6ef5a, #8fd91a);
      color: #0c1a11;
      box-shadow: 0 10px 22px rgba(163,230,53,0.4);
    }

    .count-chip { border-radius: 12px; padding: 0.45rem 0.9rem; }

    /* ── Club grid & cards ───────────────────────────────── */
    .clubs-grid {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.1rem;
    }
    .club-card {
      border-radius: 18px;
      padding: 0 1.1rem 1.1rem;
      background:
        linear-gradient(180deg, rgba(163,230,53,0.05), transparent 40%),
        var(--dm-surface);
      border: 1px solid rgba(255,255,255,0.08);
      gap: 0.95rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .club-card:hover {
      transform: translateY(-4px);
      border-color: rgba(163,230,53,0.45);
      box-shadow: 0 20px 40px rgba(0,0,0,0.44), 0 0 0 1px rgba(163,230,53,0.16);
    }
    .club-card.selected {
      border-color: rgba(163,230,53,0.7);
      box-shadow: 0 0 0 1px rgba(163,230,53,0.3), 0 20px 40px rgba(0,0,0,0.46);
    }
    .card-accent { height: 5px; }
    .club-head { padding-top: 1rem; gap: 0.85rem; }
    .club-logo,
    .club-logo-placeholder {
      width: 56px; height: 56px;
      border-radius: 16px;
    }
    .club-logo-placeholder { font-size: 1.05rem; }
    .club-identity h3 { font-size: 1.06rem; font-weight: 800; letter-spacing: -0.01em; }

    .club-pills { gap: 0.45rem; }
    .pill { border-radius: 8px; padding: 0.3rem 0.7rem; font-size: 0.72rem; }

    .club-actions { gap: 0.55rem; }
    .club-actions .btn-sm { border-radius: 11px; }

    /* ── Tabs as segmented controls ──────────────────────── */
    .club-list-tabs-bar {
      display: inline-flex;
      gap: 0.25rem;
      padding: 0.32rem;
      border-radius: 14px;
      width: fit-content;
      background: var(--dm-surface);
      border: 1px solid rgba(255,255,255,0.07);
      box-shadow: 0 6px 18px rgba(0,0,0,0.3);
      overflow: visible;
    }
    .club-list-tabs-bar .tab-btn {
      border-radius: 10px;
      padding: 0.45rem 1.05rem;
    }
    .club-list-tabs-bar .tab-active {
      background: linear-gradient(135deg, #a3e635, #84cc16);
      color: #0c1a11;
      border-color: transparent;
      box-shadow: 0 6px 16px rgba(163,230,53,0.32);
    }

    .clubs-menu-bar {
      border-radius: 16px;
      padding: 0.4rem;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    .clubs-page .clubs-menu-bar .tab-btn {
      border-radius: 11px !important;
      padding: 0.5rem 1rem !important;
    }
    .clubs-page .clubs-menu-bar .tab-btn.tab-active {
      background: linear-gradient(135deg, #a3e635, #84cc16) !important;
      color: #0c1a11 !important;
      border-color: transparent !important;
      box-shadow: 0 6px 16px rgba(163,230,53,0.34) !important;
      transform: none !important;
    }
    .clubs-page .clubs-menu-bar .tab-btn.tab-active .tab-badge,
    .clubs-page .clubs-menu-bar .tab-btn.tab-active .tab-badge-members {
      background: rgba(12,26,17,0.22);
      color: #0c1a11;
      border-color: transparent;
    }

    /* ── Detail panel ────────────────────────────────────── */
    .detail-panel {
      border-radius: 20px;
      border: 1px solid rgba(163,230,53,0.12);
      box-shadow: 0 18px 42px rgba(0,0,0,0.42);
    }
    .detail-header {
      padding: 1.3rem 1.5rem;
      background: linear-gradient(135deg, #21392e 0%, #16271f 100%);
      border-bottom: 1px solid rgba(163,230,53,0.1);
    }

    /* ── Modals ──────────────────────────────────────────── */
    .modal-card {
      border-radius: 20px;
      border: 1px solid rgba(163,230,53,0.14);
      box-shadow: 0 30px 70px rgba(0,0,0,0.6);
    }
    .modal-backdrop {
      background: rgba(5,14,10,0.72);
      backdrop-filter: blur(4px);
    }

    /* ── Forms ───────────────────────────────────────────── */
    .form-card { border-radius: 14px; }
    .form-input,
    .modal-textarea { border-radius: 10px; padding: 0.62rem 0.8rem; }

    /* ── State cards ─────────────────────────────────────── */
    .state-card {
      border-radius: 18px;
      padding: 3rem 1.5rem;
      border: 1px dashed rgba(163,230,53,0.2);
      background: var(--dm-surface);
    }
    .state-card i { color: var(--dm-accent); }

    /* ── Admin/member rows ───────────────────────────────── */
    .admin-card { border-radius: 13px; padding: 0.85rem 1rem; }
    .admin-avatar { border-radius: 13px; }

    /* ── Stronger, more cinematic hero ───────────────────── */
    .hero-panel {
      padding: 1.9rem 1.9rem;
      border-radius: 24px;
      background:
        radial-gradient(680px 260px at 0% 0%, rgba(163,230,53,0.18), transparent 70%),
        radial-gradient(520px 260px at 100% 130%, rgba(20,184,166,0.13), transparent 72%),
        linear-gradient(135deg, #23402f 0%, #142420 100%);
      box-shadow: 0 22px 52px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .hero-badge { width: 64px; height: 64px; font-size: 1.7rem; border-radius: 19px; }
    .hero-badge-logo {
      background: transparent;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 10px 22px rgba(163,230,53,0.28);
    }
    .hero-badge-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: inherit;
    }
    .hero-title { font-size: 1.95rem; }

    /* ── Glass surfaces ──────────────────────────────────── */
    .club-card {
      background:
        linear-gradient(180deg, rgba(163,230,53,0.07), rgba(27,48,40,0.55));
      border: 1px solid rgba(255,255,255,0.1);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .detail-panel {
      background: linear-gradient(180deg, rgba(163,230,53,0.04), rgba(27,48,40,0.62));
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
    }
    .modal-card {
      background: linear-gradient(180deg, rgba(33,57,46,0.97), rgba(20,36,30,0.97));
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
    }

    /* ── KPI stat row ────────────────────────────────────── */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.9rem;
    }
    .kpi-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 1rem 1.1rem;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(27,48,40,0.5));
      border: 1px solid rgba(255,255,255,0.1);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      box-shadow: 0 10px 26px rgba(0,0,0,0.32);
      transition: transform 0.18s ease, border-color 0.18s ease;
    }
    .kpi-card:hover { transform: translateY(-3px); border-color: rgba(163,230,53,0.3); }
    .kpi-icon {
      width: 44px; height: 44px;
      border-radius: 13px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.15rem;
      flex-shrink: 0;
    }
    .kpi-meta { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
    .kpi-value { font-size: 1.45rem; font-weight: 800; color: var(--dm-text); letter-spacing: -0.02em; }
    .kpi-label { font-size: 0.7rem; font-weight: 700; color: var(--dm-muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .kpi-lime   .kpi-icon { background: rgba(163,230,53,0.16); color: #a3e635; }
    .kpi-green  .kpi-icon { background: rgba(34,197,94,0.16);  color: #4ade80; }
    .kpi-rose   .kpi-icon { background: rgba(244,63,94,0.16);  color: #fb7185; }
    .kpi-amber  .kpi-icon { background: rgba(234,179,8,0.16);  color: #facc15; }
    .kpi-orange .kpi-icon { background: rgba(249,115,22,0.16); color: #fb923c; }
    .kpi-lime { border-color: rgba(163,230,53,0.2); }

    /* ── List controls + view toggle ─────────────────────── */
    .list-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .view-toggle {
      display: inline-flex;
      gap: 0.2rem;
      padding: 0.28rem;
      border-radius: 12px;
      background: var(--dm-surface);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 6px 16px rgba(0,0,0,0.3);
    }
    .vt-btn {
      width: 38px; height: 32px;
      border: none; border-radius: 9px;
      background: transparent;
      color: var(--dm-muted);
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.9rem;
      transition: background 0.15s, color 0.15s;
    }
    .vt-btn:hover { color: var(--dm-text); background: rgba(255,255,255,0.06); }
    .vt-active {
      background: linear-gradient(135deg, #a3e635, #84cc16) !important;
      color: #0c1a11 !important;
      box-shadow: 0 4px 12px rgba(163,230,53,0.3);
    }

    /* ── List view layout ────────────────────────────────── */
    .clubs-list { grid-template-columns: 1fr; gap: 0.55rem; }
    .club-card--list {
      display: grid;
      grid-template-columns: minmax(220px, 1.1fr) minmax(0, 1.6fr) auto;
      align-items: center;
      gap: 1.25rem;
      padding: 0.7rem 1rem;
    }
    .club-card--list:hover { transform: none; }
    .club-card--list .card-accent { display: none; }

    /* Left: logo + identity */
    .club-card--list .club-head { padding-top: 0; gap: 0.7rem; min-width: 0; }
    .club-card--list .club-logo,
    .club-card--list .club-logo-placeholder { width: 44px; height: 44px; border-radius: 12px; }
    .club-card--list .club-identity h3 {
      font-size: 0.95rem;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .club-card--list .club-id { max-width: 160px; }

    /* Middle: metadata pills flow on a single tidy line */
    .club-card--list .club-pills {
      gap: 0.4rem;
      justify-content: flex-start;
      flex-wrap: wrap;
      max-height: 4.4rem;
      overflow: hidden;
    }
    .club-card--list .pill {
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Right: compact icon-only action toolbar */
    .club-card--list .club-actions {
      display: flex;
      flex-wrap: nowrap;
      justify-content: flex-end;
      gap: 0.4rem;
    }

    @media (max-width: 900px) {
      .club-card--list {
        grid-template-columns: 1fr;
        row-gap: 0.7rem;
        align-items: start;
      }
      .club-card--list .club-pills { max-height: none; }
      .club-card--list .club-actions { flex-wrap: wrap; justify-content: flex-start; }
    }

    @media (max-width: 768px) {
      .hero-panel { padding: 1.3rem 1.25rem; }
      .hero-badge { width: 50px; height: 50px; font-size: 1.3rem; border-radius: 15px; }
      .hero-title { font-size: 1.5rem; }
      .club-list-tabs-bar { display: flex; }
      .club-list-tabs-bar .tab-btn { flex: 1; justify-content: center; }
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
      .kpi-value { font-size: 1.25rem; }
    }

    /* ── App Reviews Panel ── */
    .reviews-panel {
      margin: 1.25rem 1.5rem;
      background: var(--surface, #1a1a2e);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      overflow: hidden;
    }

    .reviews-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.4rem;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .reviews-panel-header:hover { background: rgba(255,255,255,0.03); }

    .reviews-panel-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .reviews-panel-title .fas.fa-star { color: #f59e0b; }

    .reviews-panel-body {
      padding: 0 1.4rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .reviews-section {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 1.25rem;
    }

    .reviews-section-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: rgba(255,255,255,0.6);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0 0 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .reviews-section-desc {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.4);
      margin: 0 0 0.75rem;
      line-height: 1.55;
    }

    .reviews-link-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .reviews-link-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.55rem 0.8rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 8px;
      flex-wrap: wrap;
    }

    .reviews-link-club-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
      flex: 1;
      min-width: 120px;
    }

    .reviews-link-url {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.04);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-family: monospace;
      flex: 2;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reviews-input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 0.55rem 0.85rem;
      color: #fff;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.15s;
      box-sizing: border-box;
    }
    .reviews-input:focus { border-color: rgba(124,255,78,0.4); }
    .reviews-input::placeholder { color: rgba(255,255,255,0.25); }

    .reviews-textarea { resize: vertical; min-height: 70px; font-family: inherit; }

    .reviews-add-form {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .reviews-rating-row {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .reviews-label {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.5);
      margin-right: 0.3rem;
    }

    .star-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.4rem;
      color: rgba(255,255,255,0.2);
      padding: 0;
      line-height: 1;
      transition: color 0.12s, transform 0.1s;
    }
    .star-btn:hover { transform: scale(1.15); }
    .star-btn-filled { color: #f59e0b; }

    .reviews-save-msg {
      font-size: 0.8rem;
      color: #7cff4e;
      margin: 0.3rem 0 0;
    }

    .reviews-empty {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.3);
      margin: 0;
    }

    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .reviews-list-item {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 0.9rem 1rem;
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto auto;
      column-gap: 0.75rem;
      row-gap: 0.3rem;
    }
    .reviews-list-item-hidden { opacity: 0.45; }

    .reviews-list-stars {
      grid-column: 1;
      grid-row: 1;
      display: flex;
      gap: 1px;
      align-self: center;
    }
    .star-filled-sm { color: #f59e0b; font-size: 0.85rem; }
    .star-empty-sm  { color: rgba(255,255,255,0.15); font-size: 0.85rem; }

    .reviews-list-meta {
      grid-column: 2;
      grid-row: 1;
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
    }

    .reviews-list-name { font-size: 0.88rem; font-weight: 700; color: #fff; }
    .reviews-list-club { font-size: 0.78rem; color: rgba(255,255,255,0.38); }

    .reviews-list-text {
      grid-column: 1 / -1;
      grid-row: 2;
      font-size: 0.83rem;
      color: rgba(255,255,255,0.55);
      margin: 0;
      line-height: 1.55;
    }

    .reviews-list-actions {
      grid-column: 1 / -1;
      grid-row: 3;
      display: flex;
      gap: 0.5rem;
      margin-top: 0.4rem;
    }

    .btn-ghost-muted {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.4);
    }
    .btn-danger-ghost {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      color: #f87171;
    }
    .btn-danger-ghost:hover { background: rgba(239,68,68,0.16); }
  `],
})
export class AdminClubsComponent implements OnInit, OnDestroy {
  clubs: Club[] = [];
  selectedClub: Club | null = null;
  clubListTab: 'active' | 'suspended' = 'active';
  copiedClubId: string | null = null;
  showNotifications = false;
  viewMode: 'grid' | 'list' = 'grid';
  outstandingTotal = 0;

  get activeClubCount(): number {
    return this.clubs.filter(c => c.status !== 'suspended').length;
  }
  get suspendedClubCount(): number {
    return this.clubs.filter(c => c.status === 'suspended').length;
  }
  get tcPendingCount(): number {
    return this.clubs.filter(c => !c.adminTermsAccepted).length;
  }
  get visibleClubs(): Club[] {
    return this.clubListTab === 'suspended'
      ? this.clubs.filter(c => c.status === 'suspended')
      : this.clubs.filter(c => c.status !== 'suspended');
  }
  clubAdmins: AdminUser[] = [];
  loading = true;
  error = '';
  adminsLoading = false;
  adminsError = '';

  showAdminForm = false;
  creatingAdmin = false;
  adminFormError = '';
  adminFormSuccess = '';
  private readonly DEFAULT_ADMIN_PASSWORD = 'BaselineGearhub';
  private usernameManuallyEdited = false;
  adminForm = { name: '', username: '', password: this.DEFAULT_ADMIN_PASSWORD, email: '' };

  activeTab: 'admins' | 'payments' | 'appfees' | 'extrafees' | 'members' | 'chat' = 'admins';

  // ── Chat histories ──
  clubInquiries: Inquiry[] = [];
  chatLoading = false;
  chatError = '';
  expandedChatId: string | null = null;

  // ── Members ──
  clubMembers: AdminUser[] = [];
  membersLoading = false;
  membersError = '';
  memberStatusFilter: 'all' | 'active' | 'pending' = 'all';

  readonly memberFilterOptions: Array<'all' | 'active' | 'pending'> = ['all', 'active', 'pending'];

  get filteredMembers(): AdminUser[] {
    if (this.memberStatusFilter === 'all') return this.clubMembers;
    return this.clubMembers.filter(m => m.status === this.memberStatusFilter);
  }

  memberCountByStatus(status: string): number {
    return this.clubMembers.filter(m => m.status === status).length;
  }

  readonly deleteModal = signal<{ club: Club | null; deleting: boolean }>({ club: null, deleting: false });
  readonly suspendModal = signal<{ club: Club | null; suspending: boolean }>({ club: null, suspending: false });

  // ── Payment approvals ──
  allApprovalCharges: Charge[] = [];
  chargesLoading = false;
  chargesError = '';
  chargeFilter: 'pending' | 'approved' | 'rejected' = 'pending';
  readonly paymentFilterOptions: Array<'pending' | 'approved' | 'rejected'> = ['pending', 'approved', 'rejected'];
  processingCharge = new Set<string>();
  rejectChargeModal = { show: false, chargeId: '', note: '', submitting: false };

  get filteredCharges(): Charge[] {
    return this.allApprovalCharges.filter(c => c.approvalStatus === this.chargeFilter);
  }

  // ── App service fees ──
  approvedCharges: Charge[] = [];
  aspPayments: AppServicePayment[] = [];
  aspLoading = false;
  aspError = '';
  aspModal = { show: false, amount: 0, method: 'GCash' as 'GCash' | 'QRPh', note: '', submitting: false, error: '' };
  aspScreenshot: File | null = null;
  aspScreenshotPreviewUrl: string | null = null;

  editConvenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat' | 'club_absorbs' = 'per_hour';
  editConvenienceFeeRate = 10;
  editConvenienceFeeMonthlyAmount = 0;
  savingFeeMode = false;
  feeModeSaveMsg = '';

  editHostedPlayConvenienceFeeMode: 'per_join' | 'per_session' | 'club_absorbs' = 'per_join';
  editHostedPlayConvenienceFeeRate = 5;
  editHostedPlayConvenienceFeeAmount = 0;
  savingHostedPlayFeeMode = false;
  hostedPlayFeeModeSaveMsg = '';
  billingMonthLoading = false;
  billingMonthMsg = '';

  // ── Payment settings ──
  requireScreenshot = false;
  savingScreenshotSetting = false;
  screenshotSettingSaveMsg = '';
  balanceAlertEnabled = false;
  savingBalanceAlert = false;
  balanceAlertSaveMsg = '';
  bookingProcess: 'reservation' | 'per_game' | 'hosted_play' = 'reservation';
  savingBookingProcess = false;
  bookingProcessSaveMsg = '';
  hostedPlayAddonEnabled = false;
  savingHostedPlayAddon = false;
  hostedPlayAddonSaveMsg = '';
  hostedPlayQueueEnabled = false;
  savingHostedPlayQueue = false;
  hostedPlayQueueSaveMsg = '';
  editQueueManagementFee = 0;
  savingQueueManagementFee = false;
  queueManagementFeeSaveMsg = '';
  hostedPlayCreditsEnabled = true;
  savingHostedPlayCredits = false;
  hostedPlayCreditsSaveMsg = '';
  editDuprClubId = '';
  savingDuprClubId = false;
  duprClubIdSaveMsg = '';
  duprAddonEnabled = false;
  savingDuprAddon = false;
  duprAddonSaveMsg = '';

  // ── Additional (extra) fees ──
  editingExtraFees: AdditionalFee[] = [];
  newExtraFeeName = '';
  newExtraFeeAmount = 0;
  newExtraFeeType: 'fixed' | 'per_person' = 'fixed';
  newExtraFeeOptional = true;
  savingExtraFees = false;
  extraFeesSaveMsg = '';

  get reservationCharges(): Charge[] {
    return this.approvedCharges.filter(c =>
      c.chargeType === 'reservation' && c.reservationId?.status === 'confirmed'
    );
  }
  get openPlayCharges(): Charge[] {
    return this.approvedCharges.filter(c => c.chargeType === 'open_play_session');
  }
  get hostedPlayCharges(): Charge[] {
    return this.approvedCharges.filter(c => c.chargeType === 'hosted_play');
  }
  get reservationTotal(): number {
    return this.reservationCharges.reduce((sum, c) => sum + c.amount, 0);
  }
  get appServiceDue(): number {
    const hostedPlayFees = this.hostedPlayCharges.reduce((sum, c) => sum + (c.breakdown?.convenienceFee ?? 0), 0);
    const billingFees = this.aspPayments.filter(p => p.type === 'billing').reduce((sum, p) => sum + p.amount, 0);
    // Monthly flat replaces reservation/open-play per-transaction fees, but Hosted Play convenience
    // fees are billed independently of the plan, on top of the flat amount — mirrors backend /fee-info.
    if (this.selectedClub?.convenienceFeeMode === 'monthly_flat') {
      return (this.selectedClub.convenienceFeeMonthlyAmount ?? 0) + hostedPlayFees + billingFees;
    }
    const chargeFees = this.reservationCharges.reduce((sum, c) => sum + (c.breakdown?.convenienceFee ?? 0), 0)
      + this.openPlayCharges.reduce((sum, c) => sum + (c.breakdown?.convenienceFee ?? 0), 0)
      + hostedPlayFees;
    return chargeFees + billingFees;
  }
  get aspTotalPaid(): number {
    return this.aspPayments.filter(p => p.type === 'payment').reduce((sum, p) => sum + p.amount, 0);
  }
  get aspTotalWaived(): number {
    return this.aspPayments.filter(p => p.type === 'waiver').reduce((sum, p) => sum + p.amount, 0);
  }
  get aspBalance(): number {
    return Math.max(0, this.appServiceDue - this.aspTotalPaid - this.aspTotalWaived);
  }

  mirroringUserId: string | null = null;
  dbStatus = signal<{ db: string; dbHost: string; runtime: string } | null>(null);

  // ── App Reviews ──
  reviewsPanelOpen = false;
  reviewsList = signal<{ _id: string; reviewerName: string; clubName: string; rating: number; text: string; isVisible: boolean }[]>([]);
  reviewsLoading = signal(false);
  newReview = { reviewerName: '', clubName: '', rating: 5, text: '' };
  reviewsAdding = false;
  reviewsAddMsg = '';

  chatTarget: AdminUser | null = null;

  // ── Message unread tracking ──
  messageUnreadCount = 0;
  threadUnreadMap: Record<string, number> = {};  // userId → unread count
  clubAdminMap: Record<string, string> = {};     // clubId → primary admin userId
  private msgPollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private clubService: ClubService,
    private usersService: UsersService,
    private chargesService: ChargesService,
    private aspService: AppServicePaymentsService,
    readonly auth: AuthService,
    private inquiriesService: InquiriesService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    readonly notifService: NotificationService,
    private http: HttpClient,
    private adminMessages: AdminMessagesService,
    private sound: SoundService,
    private cloudinaryService: CloudinaryService,
  ) {}

  loadReviews() {
    this.reviewsLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/reviews`).subscribe({
      next: (r) => { this.reviewsList.set(r); this.reviewsLoading.set(false); },
      error: () => { this.reviewsLoading.set(false); },
    });
  }

  copyReviewLink(clubId: string, clubName: string, slug?: string) {
    const url = `${window.location.origin}/review/${slug || clubId}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copiedClubId = clubId;
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedClubId = null; this.cdr.detectChanges(); }, 2000);
    }).catch(() => {});
  }

  addReview() {
    if (!this.newReview.reviewerName.trim() || !this.newReview.clubName.trim() || !this.newReview.text.trim()) {
      this.reviewsAddMsg = 'Please fill in all fields.';
      return;
    }
    this.reviewsAdding = true;
    this.reviewsAddMsg = '';
    this.http.post<any>(`${environment.apiUrl}/reviews`, this.newReview).subscribe({
      next: (r) => {
        this.reviewsList.update(list => [r, ...list]);
        this.newReview = { reviewerName: '', clubName: '', rating: 5, text: '' };
        this.reviewsAdding = false;
        this.reviewsAddMsg = 'Review added!';
        setTimeout(() => { this.reviewsAddMsg = ''; this.cdr.detectChanges(); }, 2500);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.reviewsAdding = false;
        this.reviewsAddMsg = err?.error?.error ?? 'Failed to add review.';
        this.cdr.detectChanges();
      },
    });
  }

  toggleReviewVisibility(review: any) {
    this.http.patch<any>(`${environment.apiUrl}/reviews/${review._id}`, { isVisible: !review.isVisible }).subscribe({
      next: (updated) => {
        this.reviewsList.update(list => list.map(r => r._id === updated._id ? updated : r));
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  deleteReview(id: string) {
    if (!confirm('Delete this review?')) return;
    this.http.delete(`${environment.apiUrl}/reviews/${id}`).subscribe({
      next: () => {
        this.reviewsList.update(list => list.filter(r => r._id !== id));
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loginAs(user: AdminUser): void {
    if (this.mirroringUserId) return;
    this.mirroringUserId = user._id;
    this.auth.impersonateUser(user._id).subscribe({
      next: () => {
        this.mirroringUserId = null;
        this.cdr.detectChanges();
        this.router.navigate(['/player/dashboard']);
      },
      error: () => { this.mirroringUserId = null; this.cdr.detectChanges(); },
    });
  }

  ngOnInit() {
    this.loadClubs();
    if (this.auth.isSuperAdmin()) {
      this.notifService.load();
      this.aspService.getSummary().subscribe({
        next: (res) => { this.outstandingTotal = res.totals?.outstanding ?? 0; this.cdr.detectChanges(); },
        error: () => {},
      });
      this.loadReviews();
    }
    this.http.get<{ status: string; db: string; dbHost: string; runtime: string }>(`${environment.apiUrl}/health`).subscribe({
      next: (res) => this.dbStatus.set(res),
      error: () => {},
    });
    this.loadMessageData();
    this.msgPollInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.chatTarget) return;
      this.loadMessageData(true);
    }, 20_000);
  }

  ngOnDestroy() {
    if (this.msgPollInterval) clearInterval(this.msgPollInterval);
  }

  private loadMessageData(playSound = false) {
    this.usersService.getAdmins().subscribe({
      next: (admins) => {
        const map: Record<string, string> = {};
        for (const admin of admins) {
          if (admin.role === 'admin' && admin.clubId) {
            const clubId = typeof admin.clubId === 'object' ? (admin.clubId as any)._id : admin.clubId;
            if (clubId) map[clubId] = admin._id;
          }
        }
        this.clubAdminMap = map;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
    this.adminMessages.getThreads().subscribe({
      next: (threads) => {
        const map: Record<string, number> = {};
        let total = 0;
        for (const t of threads) {
          map[t.user._id] = t.unreadCount;
          total += t.unreadCount;
        }
        if (playSound && total > this.messageUnreadCount) this.sound.notification();
        this.messageUnreadCount = total;
        this.threadUnreadMap = map;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  getClubUnread(club: Club): number {
    const adminId = this.clubAdminMap[club._id];
    return adminId ? (this.threadUnreadMap[adminId] ?? 0) : 0;
  }

  // ── Club loading ──
  loadClubs() {
    this.loading = true;
    this.clubService.getClubs().subscribe({
      next: (clubs) => {
        this.clubs = clubs;
        if (clubs.length === 0) {
          this.selectedClub = null;
          this.clubAdmins = [];
        } else if (!this.selectedClub) {
          this.selectClub(clubs[0]);
        } else {
          const stillExists = clubs.find(c => c._id === this.selectedClub?._id);
          if (!stillExists) this.selectClub(clubs[0]);
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Failed to load clubs.'; this.loading = false; this.cdr.detectChanges(); },
    });
  }

  selectClub(club: Club) {
    this.selectedClub = club;
    this.showAdminForm = false;
    this.adminFormError = '';
    this.adminFormSuccess = '';
    this.resetAdminForm();
    this.activeTab = 'admins';
    this.allApprovalCharges = [];
    this.approvedCharges = [];
    this.aspPayments = [];
    this.clubMembers = [];
    this.chargeFilter = 'pending';
    this.memberStatusFilter = 'all';
    this.clubInquiries = [];
    this.expandedChatId = null;
    this.chatError = '';
    this.chargesError = '';
    this.aspError = '';
    this.membersError = '';
    this.editConvenienceFeeMode = club.convenienceFeeMode ?? 'per_hour';
    this.editConvenienceFeeRate = Math.round((club.convenienceFeeRate ?? 0.10) * 1000) / 10;
    this.editConvenienceFeeMonthlyAmount = club.convenienceFeeMonthlyAmount ?? 0;
    this.feeModeSaveMsg = '';
    this.editHostedPlayConvenienceFeeMode = club.hostedPlayConvenienceFeeMode ?? 'per_join';
    this.editHostedPlayConvenienceFeeRate = Math.round((club.hostedPlayConvenienceFeeRate ?? 0.05) * 1000) / 10;
    this.editHostedPlayConvenienceFeeAmount = club.hostedPlayConvenienceFeeAmount ?? 0;
    this.hostedPlayFeeModeSaveMsg = '';
    this.billingMonthMsg = '';
    this.requireScreenshot = club.requirePaymentScreenshot ?? false;
    this.screenshotSettingSaveMsg = '';
    this.balanceAlertEnabled = club.balanceAlertEnabled ?? false;
    this.balanceAlertSaveMsg = '';
    this.bookingProcess = club.bookingProcess ?? 'reservation';
    this.bookingProcessSaveMsg = '';
    this.hostedPlayAddonEnabled = club.hostedPlayEnabled ?? false;
    this.hostedPlayAddonSaveMsg = '';
    this.hostedPlayQueueEnabled = club.hostedPlayQueueEnabled ?? false;
    this.hostedPlayQueueSaveMsg = '';
    this.editQueueManagementFee = club.queueManagementFeePerPlayer ?? 0;
    this.queueManagementFeeSaveMsg = '';
    this.hostedPlayCreditsEnabled = club.hostedPlayCreditsEnabled ?? true;
    this.hostedPlayCreditsSaveMsg = '';
    this.editDuprClubId = club.duprClubId ?? '';
    this.duprClubIdSaveMsg = '';
    this.duprAddonEnabled = club.duprEnabled ?? false;
    this.duprAddonSaveMsg = '';
    this.editingExtraFees = (club.additionalFees ?? []).map(f => ({ ...f }));
    this.newExtraFeeName = '';
    this.newExtraFeeAmount = 0;
    this.newExtraFeeType = 'fixed';
    this.newExtraFeeOptional = true;
    this.extraFeesSaveMsg = '';

    this.loadClubAdmins();
  }

  setTab(tab: 'admins' | 'payments' | 'appfees' | 'extrafees' | 'members' | 'chat') {
    this.activeTab = tab;
    if (tab === 'payments') this.loadPaymentApprovals();
    if (tab === 'appfees') this.loadAppServiceData();
    if (tab === 'members') this.loadClubMembers();
    if (tab === 'chat') this.loadClubInquiries();
  }

  loadClubInquiries() {
    if (!this.selectedClub?._id) return;
    this.chatLoading = true;
    this.chatError = '';
    this.expandedChatId = null;
    this.inquiriesService.getInquiriesByClub(this.selectedClub._id).subscribe({
      next: (data) => { this.clubInquiries = data; this.chatLoading = false; this.cdr.detectChanges(); },
      error: () => { this.chatError = 'Failed to load chats.'; this.chatLoading = false; this.cdr.detectChanges(); },
    });
  }

  deleteClub(club: Club) {
    this.deleteModal.set({ club, deleting: false });
  }

  closeDeleteModal() {
    if (this.deleteModal().deleting) return;
    this.deleteModal.set({ club: null, deleting: false });
  }

  confirmDelete() {
    const club = this.deleteModal().club;
    if (!club) return;
    this.deleteModal.update(s => ({ ...s, deleting: true }));
    this.clubService.deleteClub(club._id).subscribe({
      next: () => {
        this.deleteModal.set({ club: null, deleting: false });
        this.loadClubs();
      },
      error: () => {
        this.deleteModal.update(s => ({ ...s, deleting: false }));
      },
    });
  }

  suspendClub(club: Club) {
    this.suspendModal.set({ club, suspending: false });
  }

  closeSuspendModal() {
    if (this.suspendModal().suspending) return;
    this.suspendModal.set({ club: null, suspending: false });
  }

  confirmSuspend() {
    const club = this.suspendModal().club;
    if (!club) return;
    const newStatus = club.status === 'suspended' ? 'active' : 'suspended';
    this.suspendModal.update(s => ({ ...s, suspending: true }));
    this.clubService.setStatus(club._id, newStatus).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? updated : c);
        if (this.selectedClub?._id === updated._id) this.selectedClub = { ...this.selectedClub, ...updated };
        this.suspendModal.set({ club: null, suspending: false });
      },
      error: () => {
        this.suspendModal.update(s => ({ ...s, suspending: false }));
      },
    });
  }

  // ── Admins ──
  loadClubAdmins() {
    if (!this.selectedClub?._id) { this.clubAdmins = []; return; }
    this.adminsLoading = true;
    this.adminsError = '';
    this.usersService.getAdmins(this.selectedClub._id).subscribe({
      next: (admins) => { this.clubAdmins = admins.filter(a => a.role === 'admin'); this.adminsLoading = false; this.cdr.detectChanges(); },
      error: (err) => { this.adminsLoading = false; this.adminsError = err?.error?.error || 'Failed to load club admins.'; this.cdr.detectChanges(); },
    });
  }

  private membersRequestId = 0;

  loadClubMembers() {
    if (!this.selectedClub?._id || !this.auth.isSuperAdmin()) return;
    const requestId = ++this.membersRequestId;
    this.membersLoading = true;
    this.membersError = '';
    this.usersService.getClubUsers(this.selectedClub._id).subscribe({
      next: (users) => {
        if (requestId !== this.membersRequestId) return;
        this.clubMembers = users.filter(u => u.role === 'player');
        this.membersLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        if (requestId !== this.membersRequestId) return;
        this.membersError = 'Failed to load members.';
        this.membersLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  createClubAdmin() {
    if (!this.selectedClub?._id) { this.adminFormError = 'Please select a club first.'; return; }
    this.creatingAdmin = true;
    this.adminFormError = '';
    this.adminFormSuccess = '';
    this.usersService.createAdmin({
      name: this.adminForm.name, username: this.adminForm.username,
      password: this.adminForm.password, clubId: this.selectedClub._id,
      email: this.adminForm.email || undefined,
    }).subscribe({
      next: () => { this.creatingAdmin = false; this.adminFormSuccess = `Admin "${this.adminForm.username}" created.`; this.resetAdminForm(); this.loadClubAdmins(); this.cdr.detectChanges(); },
      error: (err) => { this.creatingAdmin = false; this.adminFormError = err?.error?.error || 'Failed to create admin.'; this.cdr.detectChanges(); },
    });
  }

  resetAdminForm() {
    this.usernameManuallyEdited = false;
    this.adminForm = { name: '', username: '', password: this.DEFAULT_ADMIN_PASSWORD, email: '' };
  }

  onAdminNameChange(name: string) {
    if (this.usernameManuallyEdited) return;
    this.adminForm.username = this.generateUsername(name);
  }

  onAdminUsernameChange() { this.usernameManuallyEdited = true; }

  private generateUsername(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  }

  // ── Payment approvals ──
  loadPaymentApprovals() {
    if (!this.selectedClub?._id || !this.auth.isSuperAdmin()) return;
    this.chargesLoading = true;
    this.chargesError = '';
    this.chargesService.getAllApprovalCharges(this.selectedClub._id).subscribe({
      next: (charges) => { this.allApprovalCharges = charges; this.chargesLoading = false; this.cdr.detectChanges(); },
      error: () => { this.chargesError = 'Failed to load payment approvals.'; this.chargesLoading = false; this.cdr.detectChanges(); },
    });
  }

  setChargeFilter(filter: 'pending' | 'approved' | 'rejected') { this.chargeFilter = filter; }

  approveCharge(charge: Charge) {
    this.processingCharge = new Set(this.processingCharge).add(charge._id);
    this.chargesService.approvePayment(charge._id).subscribe({
      next: (res) => {
        const next = new Set(this.processingCharge); next.delete(charge._id); this.processingCharge = next;
        this.cdr.detectChanges();
        const idx = this.allApprovalCharges.findIndex(c => c._id === charge._id);
        if (idx !== -1) this.allApprovalCharges = [...this.allApprovalCharges.slice(0, idx), res.charge, ...this.allApprovalCharges.slice(idx + 1)];
      },
      error: () => { const next = new Set(this.processingCharge); next.delete(charge._id); this.processingCharge = next; this.cdr.detectChanges(); },
    });
  }

  openRejectChargeModal(charge: Charge) { this.rejectChargeModal = { show: true, chargeId: charge._id, note: '', submitting: false }; }
  closeRejectChargeModal() { this.rejectChargeModal = { show: false, chargeId: '', note: '', submitting: false }; }

  confirmRejectCharge() {
    if (!this.rejectChargeModal.chargeId) return;
    this.rejectChargeModal = { ...this.rejectChargeModal, submitting: true };
    this.chargesService.rejectPayment(this.rejectChargeModal.chargeId, this.rejectChargeModal.note || undefined).subscribe({
      next: (res) => {
        const idx = this.allApprovalCharges.findIndex(c => c._id === this.rejectChargeModal.chargeId);
        if (idx !== -1) this.allApprovalCharges = [...this.allApprovalCharges.slice(0, idx), res.charge, ...this.allApprovalCharges.slice(idx + 1)];
        this.closeRejectChargeModal();
        this.cdr.detectChanges();
      },
      error: () => { this.rejectChargeModal = { ...this.rejectChargeModal, submitting: false }; this.cdr.detectChanges(); },
    });
  }

  // ── App service fees ──
  loadAppServiceData() {
    if (!this.selectedClub?._id || !this.auth.isSuperAdmin()) return;
    this.aspLoading = true;
    this.aspError = '';
    const clubId = this.selectedClub._id;
    let chargesLoaded = false;
    let paymentsLoaded = false;
    const check = () => { if (chargesLoaded && paymentsLoaded) { this.aspLoading = false; this.cdr.detectChanges(); } };

    this.chargesService.getAllCharges(clubId).subscribe({
      next: (c) => { this.approvedCharges = c; chargesLoaded = true; check(); },
      error: () => { this.aspError = 'Failed to load charge data.'; this.aspLoading = false; this.cdr.detectChanges(); },
    });

    this.aspService.getAll(clubId).subscribe({
      next: (p) => { this.aspPayments = p; paymentsLoaded = true; check(); },
      error: () => { this.aspError = 'Failed to load payment data.'; this.aspLoading = false; this.cdr.detectChanges(); },
    });
  }

  saveConvenienceFeeMode() {
    if (!this.selectedClub?._id) return;
    this.savingFeeMode = true;
    this.feeModeSaveMsg = '';
    const rate = Math.max(0, Math.min(100, this.editConvenienceFeeRate)) / 100;
    const monthly = this.editConvenienceFeeMode === 'monthly_flat' ? Math.max(0, this.editConvenienceFeeMonthlyAmount) : undefined;
    this.clubService.patchConvenienceFee(this.selectedClub._id, rate, this.editConvenienceFeeMode, monthly).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, convenienceFeeRate: updated.convenienceFeeRate, convenienceFeeMode: updated.convenienceFeeMode, convenienceFeeMonthlyAmount: updated.convenienceFeeMonthlyAmount } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, convenienceFeeRate: updated.convenienceFeeRate, convenienceFeeMode: updated.convenienceFeeMode, convenienceFeeMonthlyAmount: updated.convenienceFeeMonthlyAmount };
        this.savingFeeMode = false;
        this.feeModeSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.feeModeSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingFeeMode = false; this.feeModeSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveHostedPlayConvenienceFeeMode() {
    if (!this.selectedClub?._id) return;
    this.savingHostedPlayFeeMode = true;
    this.hostedPlayFeeModeSaveMsg = '';
    const rate = Math.max(0, Math.min(100, this.editHostedPlayConvenienceFeeRate)) / 100;
    const amount = Math.max(0, this.editHostedPlayConvenienceFeeAmount);
    this.clubService.patchHostedPlayConvenienceFee(this.selectedClub._id, this.editHostedPlayConvenienceFeeMode, rate, amount).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, hostedPlayConvenienceFeeMode: updated.hostedPlayConvenienceFeeMode, hostedPlayConvenienceFeeRate: updated.hostedPlayConvenienceFeeRate, hostedPlayConvenienceFeeAmount: updated.hostedPlayConvenienceFeeAmount } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, hostedPlayConvenienceFeeMode: updated.hostedPlayConvenienceFeeMode, hostedPlayConvenienceFeeRate: updated.hostedPlayConvenienceFeeRate, hostedPlayConvenienceFeeAmount: updated.hostedPlayConvenienceFeeAmount };
        this.savingHostedPlayFeeMode = false;
        this.hostedPlayFeeModeSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.hostedPlayFeeModeSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingHostedPlayFeeMode = false; this.hostedPlayFeeModeSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  addExtraFee() {
    const name = this.newExtraFeeName.trim();
    if (!name) return;
    this.editingExtraFees = [
      ...this.editingExtraFees,
      { name, amount: Math.max(0, this.newExtraFeeAmount), type: this.newExtraFeeType, isEnabled: true, isOptional: this.newExtraFeeOptional },
    ];
    this.newExtraFeeName = '';
    this.newExtraFeeAmount = 0;
    this.newExtraFeeType = 'fixed';
    this.newExtraFeeOptional = true;
  }

  removeExtraFee(index: number) {
    this.editingExtraFees = this.editingExtraFees.filter((_, i) => i !== index);
  }

  saveScreenshotSetting() {
    if (!this.selectedClub?._id) return;
    this.savingScreenshotSetting = true;
    this.screenshotSettingSaveMsg = '';
    this.clubService.patchScreenshotSetting(this.selectedClub._id, this.requireScreenshot).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, requirePaymentScreenshot: updated.requirePaymentScreenshot } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, requirePaymentScreenshot: updated.requirePaymentScreenshot };
        this.savingScreenshotSetting = false;
        this.screenshotSettingSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.screenshotSettingSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingScreenshotSetting = false; this.screenshotSettingSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveBalanceAlertSetting() {
    if (!this.selectedClub?._id) return;
    this.savingBalanceAlert = true;
    this.balanceAlertSaveMsg = '';
    this.clubService.patchBalanceAlert(this.selectedClub._id, this.balanceAlertEnabled).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, balanceAlertEnabled: updated.balanceAlertEnabled } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, balanceAlertEnabled: updated.balanceAlertEnabled };
        this.savingBalanceAlert = false;
        this.balanceAlertSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.balanceAlertSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingBalanceAlert = false; this.balanceAlertSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveBookingProcess() {
    if (!this.selectedClub?._id) return;
    this.savingBookingProcess = true;
    this.bookingProcessSaveMsg = '';
    this.clubService.patchBookingProcess(this.selectedClub._id, this.bookingProcess).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, bookingProcess: updated.bookingProcess, hostedPlayEnabled: updated.hostedPlayEnabled } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, bookingProcess: updated.bookingProcess, hostedPlayEnabled: updated.hostedPlayEnabled };
        this.hostedPlayAddonEnabled = updated.hostedPlayEnabled ?? false;
        this.savingBookingProcess = false;
        this.bookingProcessSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.bookingProcessSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingBookingProcess = false; this.bookingProcessSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveHostedPlayAddon() {
    if (!this.selectedClub?._id) return;
    this.savingHostedPlayAddon = true;
    this.hostedPlayAddonSaveMsg = '';
    this.clubService.patchHostedPlayAddon(this.selectedClub._id, this.hostedPlayAddonEnabled).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, hostedPlayEnabled: updated.hostedPlayEnabled } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, hostedPlayEnabled: updated.hostedPlayEnabled };
        this.savingHostedPlayAddon = false;
        this.hostedPlayAddonSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.hostedPlayAddonSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingHostedPlayAddon = false; this.hostedPlayAddonSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveHostedPlayQueue() {
    if (!this.selectedClub?._id) return;
    this.savingHostedPlayQueue = true;
    this.hostedPlayQueueSaveMsg = '';
    this.clubService.patchHostedPlayQueue(this.selectedClub._id, this.hostedPlayQueueEnabled).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, hostedPlayQueueEnabled: updated.hostedPlayQueueEnabled } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, hostedPlayQueueEnabled: updated.hostedPlayQueueEnabled };
        this.savingHostedPlayQueue = false;
        this.hostedPlayQueueSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.hostedPlayQueueSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingHostedPlayQueue = false; this.hostedPlayQueueSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveHostedPlayCredits() {
    if (!this.selectedClub?._id) return;
    this.savingHostedPlayCredits = true;
    this.hostedPlayCreditsSaveMsg = '';
    this.clubService.patchHostedPlayCredits(this.selectedClub._id, this.hostedPlayCreditsEnabled).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, hostedPlayCreditsEnabled: updated.hostedPlayCreditsEnabled } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, hostedPlayCreditsEnabled: updated.hostedPlayCreditsEnabled };
        this.savingHostedPlayCredits = false;
        this.hostedPlayCreditsSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.hostedPlayCreditsSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingHostedPlayCredits = false; this.hostedPlayCreditsSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveQueueManagementFee() {
    if (!this.selectedClub?._id) return;
    this.savingQueueManagementFee = true;
    this.queueManagementFeeSaveMsg = '';
    this.clubService.patchQueueManagementFee(this.selectedClub._id, this.editQueueManagementFee).subscribe({
      next: (res) => {
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, queueManagementFeePerPlayer: res.queueManagementFeePerPlayer };
        this.savingQueueManagementFee = false;
        this.queueManagementFeeSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.queueManagementFeeSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingQueueManagementFee = false; this.queueManagementFeeSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveDuprClubId() {
    if (!this.selectedClub?._id) return;
    this.savingDuprClubId = true;
    this.duprClubIdSaveMsg = '';
    this.clubService.patchDuprClubId(this.selectedClub._id, this.editDuprClubId.trim() || null).subscribe({
      next: (res) => {
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, duprClubId: res.duprClubId };
        this.savingDuprClubId = false;
        this.duprClubIdSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.duprClubIdSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingDuprClubId = false; this.duprClubIdSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveDuprAddon() {
    if (!this.selectedClub?._id) return;
    this.savingDuprAddon = true;
    this.duprAddonSaveMsg = '';
    this.clubService.patchDuprAddon(this.selectedClub._id, this.duprAddonEnabled).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, duprEnabled: updated.duprEnabled } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, duprEnabled: updated.duprEnabled };
        this.savingDuprAddon = false;
        this.duprAddonSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.duprAddonSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingDuprAddon = false; this.duprAddonSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  saveExtraFees() {
    if (!this.selectedClub?._id) return;
    this.savingExtraFees = true;
    this.extraFeesSaveMsg = '';
    this.clubService.updateAdditionalFees(this.selectedClub._id, this.editingExtraFees).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, additionalFees: updated.additionalFees } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, additionalFees: updated.additionalFees };
        this.editingExtraFees = (updated.additionalFees ?? []).map(f => ({ ...f }));
        this.savingExtraFees = false;
        this.extraFeesSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.extraFeesSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingExtraFees = false; this.extraFeesSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  billMonth() {
    if (!this.selectedClub?._id) return;
    this.billingMonthLoading = true;
    this.billingMonthMsg = '';
    this.aspService.billMonth(this.selectedClub._id).subscribe({
      next: (res) => {
        this.aspPayments = [res.payment, ...this.aspPayments];
        this.billingMonthLoading = false;
        this.billingMonthMsg = 'Monthly billing recorded!';
        this.cdr.detectChanges();
        setTimeout(() => { this.billingMonthMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => { this.billingMonthLoading = false; this.billingMonthMsg = err?.error?.error || 'Failed to record billing.'; this.cdr.detectChanges(); },
    });
  }

  openAspModal() {
    this.aspModal = { show: true, amount: parseFloat(this.aspBalance.toFixed(2)), method: 'GCash', note: '', submitting: false, error: '' };
    this.aspScreenshot = null;
    this.aspScreenshotPreviewUrl = null;
  }
  closeAspModal() {
    this.aspModal = { show: false, amount: 0, method: 'GCash', note: '', submitting: false, error: '' };
    this.aspScreenshot = null;
    this.aspScreenshotPreviewUrl = null;
  }

  onAspScreenshotChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validationError = this.cloudinaryService.validateImage(file);
    if (validationError) {
      this.aspModal = { ...this.aspModal, error: validationError };
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    this.aspScreenshot = file;
    this.aspScreenshotPreviewUrl = URL.createObjectURL(file);
    this.aspModal = { ...this.aspModal, error: '' };
    this.cdr.detectChanges();
  }

  removeAspScreenshot() {
    this.aspScreenshot = null;
    this.aspScreenshotPreviewUrl = null;
    this.cdr.detectChanges();
  }

  async confirmAspPayment() {
    if (!this.selectedClub?._id || this.aspModal.amount <= 0) return;
    if (!this.aspScreenshot) {
      this.aspModal = { ...this.aspModal, error: 'Attach a payment screenshot.' };
      return;
    }
    this.aspModal = { ...this.aspModal, submitting: true, error: '' };

    let screenshotUrl: string;
    try {
      screenshotUrl = await this.cloudinaryService.uploadImage(this.aspScreenshot, 'developer-payment-screenshots');
    } catch {
      this.aspModal = { ...this.aspModal, submitting: false, error: 'Failed to upload payment screenshot. Please try again.' };
      this.cdr.detectChanges();
      return;
    }

    this.aspService.record({
      amount: this.aspModal.amount,
      paymentMethod: this.aspModal.method,
      note: this.aspModal.note || undefined,
      clubId: this.selectedClub._id,
      paymentScreenshot: screenshotUrl,
    }).subscribe({
      next: (res) => {
        const finish = (payment: AppServicePayment) => {
          this.aspPayments = [payment, ...this.aspPayments];
          this.closeAspModal();
          this.cdr.detectChanges();
        };
        if (!res.payment.paymentScreenshot) {
          this.aspService.attachScreenshot(res.payment._id, screenshotUrl).subscribe({
            next: ({ payment }) => finish(payment),
            error: () => {
              this.aspModal = { ...this.aspModal, submitting: false, error: 'Payment was recorded, but the screenshot was not saved. Please try again.' };
              this.cdr.detectChanges();
            },
          });
          return;
        }
        finish(res.payment);
      },
      error: (err) => { this.aspModal = { ...this.aspModal, submitting: false, error: err?.error?.error || 'Failed to record payment.' }; this.cdr.detectChanges(); },
    });
  }

  // ── Utilities ──
  getPlayerName(charge: Charge): string {
    if (!charge.playerId) return charge.guestName || 'Unknown';
    if (typeof charge.playerId === 'string') return charge.playerId;
    return charge.playerId.name || charge.guestName || 'Unknown';
  }

  getInitials(name: string) {
    return name.split(' ').filter(p => p.trim().length > 0).map(p => p.charAt(0)).slice(0, 2).join('');
  }

  copyBookingLink(club: { _id: string; slug?: string }) {
    const identifier = club.slug || club._id;
    const link = `${window.location.origin}/book/${identifier}`;
    navigator.clipboard.writeText(link).then(() => {
      this.copiedClubId = club._id;
      setTimeout(() => { this.copiedClubId = null; }, 2000);
    });
  }

  formatDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  isNewClub(club: Club): boolean {
    if (!club.createdAt) return false;
    return Date.now() - new Date(club.createdAt).getTime() < 24 * 60 * 60 * 1000;
  }

  messageClubAdmin(club: Club) {
    this.usersService.getAdmins(club._id).subscribe({
      next: (admins) => {
        const admin = admins.find(a => a.role === 'admin');
        if (admin) { this.chatTarget = admin; this.cdr.detectChanges(); }
      },
      error: () => {},
    });
  }
}
