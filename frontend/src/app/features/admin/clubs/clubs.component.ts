import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClubService, Club } from '../../../core/services/club.service';
import { UsersService } from '../../../core/services/users.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AppServicePaymentsService, AppServicePayment } from '../../../core/services/app-service-payments.service';
import { AuthService } from '../../../core/services/auth.service';
import { InquiriesService, Inquiry } from '../../../core/services/inquiries.service';

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
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="clubs-page">

      <!-- ── Hero ── -->
      <header class="hero-panel">
        <div class="hero-left">
          <p class="hero-kicker"><i class="fas fa-shield-alt"></i> Superadmin Workspace</p>
          <h2 class="hero-title">Club Portfolio</h2>
          <p class="hero-sub">Manage clubs, admins, payments, and app service fees.</p>
        </div>
        <div class="hero-actions">
          <span class="count-chip">
            <i class="fas fa-shield-alt"></i>
            {{ clubs.length }} {{ clubs.length === 1 ? 'Club' : 'Clubs' }}
          </span>
          <a routerLink="/player/dashboard" class="btn btn-purple">
            <i class="fas fa-user"></i> Player Dashboard
          </a>
          <a routerLink="/admin/dev-finance" class="btn btn-dev">
            <i class="fas fa-code"></i> Dev Finance
          </a>
          <a routerLink="/admin/clubs/new" class="btn btn-primary">
            <i class="fas fa-plus"></i> New Club
          </a>
        </div>
      </header>

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
        <!-- ── List tabs ── -->
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

        @if (visibleClubs.length === 0) {
          <div class="state-card state-empty">
            <i class="fas fa-ban"></i>
            <p>No {{ clubListTab }} clubs.</p>
          </div>
        } @else {
        <div class="clubs-grid">
          @for (club of visibleClubs; track club._id) {
            <article
              class="club-card"
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
                </div>
              </div>

              <div class="club-pills">
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
                  <i class="fas fa-percentage"></i>
                  {{ ((club.convenienceFeeRate ?? 0.10) * 100) | number:'1.0-1' }}%
                  · {{ club.convenienceFeeMode === 'per_transaction' ? 'per txn' : 'per hr' }}
                </span>
                @if (club.status === 'suspended') {
                  <span class="pill pill-suspended">
                    <i class="fas fa-ban"></i> Suspended
                  </span>
                }
              </div>

              <div class="club-actions">
                <button type="button" class="btn btn-sm btn-primary" (click)="$event.stopPropagation(); selectClub(club)">
                  <i class="fas fa-user-cog"></i> Admins
                </button>
                <a [routerLink]="['/admin/clubs', club._id, 'edit']" class="btn btn-sm btn-outline" (click)="$event.stopPropagation()">
                  <i class="fas fa-pen"></i> Edit
                </a>
                <button type="button" class="btn btn-sm btn-copy" (click)="$event.stopPropagation(); copyBookingLink(club)">
                  <i class="fas" [class.fa-copy]="copiedClubId !== club._id" [class.fa-check]="copiedClubId === club._id"></i>
                  {{ copiedClubId === club._id ? 'Copied!' : 'Copy Link' }}
                </button>
                <button type="button" class="btn btn-sm btn-danger" (click)="$event.stopPropagation(); deleteClub(club)">
                  <i class="fas fa-trash"></i> Delete
                </button>
                @if (club.status === 'suspended') {
                  <button type="button" class="btn btn-sm btn-unsuspend" (click)="$event.stopPropagation(); suspendClub(club)">
                    <i class="fas fa-circle-check"></i> Unsuspend
                  </button>
                } @else {
                  <button type="button" class="btn btn-sm btn-suspend" (click)="$event.stopPropagation(); suspendClub(club)">
                    <i class="fas fa-ban"></i> Suspend
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
                  <div class="item-list">
                    @for (charge of filteredCharges; track charge._id) {
                      <div class="item-card" [class.item-approved]="charge.approvalStatus === 'approved'" [class.item-rejected]="charge.approvalStatus === 'rejected'">
                        <div class="item-top">
                          <span class="charge-amount">₱{{ charge.amount | number:'1.2-2' }}</span>
                          <span class="badge" [class.badge-res]="charge.chargeType === 'reservation'" [class.badge-ses]="charge.chargeType === 'session'">{{ charge.chargeType }}</span>
                          @if (charge.paymentMethod) { <span class="badge badge-purple">{{ charge.paymentMethod }}</span> }
                          <span class="item-meta">{{ getPlayerName(charge) }}</span>
                          @if (charge.paidAt) { <span class="item-meta">{{ formatDate(charge.paidAt) }}</span> }
                        </div>
                        @if (charge.approvalStatus === 'rejected' && charge.adminNote) {
                          <p class="item-reject-note"><i class="fas fa-ban"></i> {{ charge.adminNote }}</p>
                        }
                        @if (charge.approvalStatus !== 'pending') {
                          <p class="item-resolved" [class.resolved-ok]="charge.approvalStatus === 'approved'">
                            <i class="fas" [class.fa-check-circle]="charge.approvalStatus === 'approved'" [class.fa-times-circle]="charge.approvalStatus === 'rejected'"></i>
                            {{ charge.approvalStatus === 'approved' ? 'Approved' : 'Rejected' }}
                          </p>
                        }
                        @if (charge.approvalStatus === 'pending') {
                          <div class="item-actions">
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
                        <div class="cfs-subtitle">Charged to players on every booking</div>
                      </div>
                    </div>
                    <span class="cfs-current-badge">
                      Currently {{ ((selectedClub?.convenienceFeeRate ?? 0.10) * 100) | number:'1.0-1' }}%
                    </span>
                  </div>

                  <div class="cfs-body">
                    <div class="cfs-field">
                      <label class="cfs-field-label">Fee Rate</label>
                      <div class="cfs-rate-row">
                        <input type="number" class="cfs-rate-input" [(ngModel)]="editConvenienceFeeRate" min="0" max="100" step="0.1" />
                        <span class="cfs-pct">%</span>
                        <span class="cfs-rate-hint">of total court fee per booking</span>
                      </div>
                    </div>

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
                      </div>
                    </div>
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

                @if (aspLoading) {
                  <p class="state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading data…</p>
                } @else if (aspError) {
                  <p class="state-msg state-msg-error">{{ aspError }}</p>
                } @else {

                  <!-- Summary -->
                  <div class="asp-summary">
                    <div class="asp-stat">
                      <span class="asp-lbl">Court Charges</span>
                      <span class="asp-val">₱{{ reservationTotal | number:'1.2-2' }}</span>
                    </div>
                    <div class="asp-stat asp-stat-due">
                      <span class="asp-lbl">10% Due to Dev</span>
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
                          <div class="asp-pay-row" [class.asp-pay-row-waived]="p.type === 'waiver'">
                            <div class="asp-pay-left">
                              <span class="asp-pay-amount" [class.asp-pay-amount-waived]="p.type === 'waiver'">
                                ₱{{ p.amount | number:'1.2-2' }}
                              </span>
                              @if (p.type === 'waiver') {
                                <span class="badge badge-waived"><i class="fas fa-hand-holding-usd"></i> Waived</span>
                              } @else {
                                <span class="badge badge-purple">{{ p.paymentMethod }}</span>
                              }
                              @if (p.note) { <span class="asp-note">{{ p.note }}</span> }
                            </div>
                            <div class="asp-pay-right">
                              <span>{{ p.type === 'waiver' ? 'Waived by' : 'Paid by' }} {{ p.paidBy?.name ?? '—' }}</span>
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
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" (click)="confirmAspPayment()" [disabled]="aspModal.submitting || aspModal.amount <= 0">
              <i class="fas fa-check"></i> {{ aspModal.submitting ? 'Saving…' : 'Record Payment' }}
            </button>
            <button type="button" class="btn btn-outline" (click)="closeAspModal()">Cancel</button>
          </div>
        </div>
      </div>
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

    /* Club actions */
    .club-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
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

    /* ── Responsive ── */
    @media (max-width: 640px) {
      .clubs-grid { grid-template-columns: 1fr; }
      .club-actions { grid-template-columns: 1fr; }
      .btn-outline, .btn-danger, .btn-teal { width: 100%; }
      .hero-actions { width: 100%; }
      .count-chip, .btn-purple, .btn-primary { justify-content: center; width: 100%; }
      .asp-charge-row { flex-direction: column; align-items: flex-start; }
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
  `],
})
export class AdminClubsComponent implements OnInit {
  clubs: Club[] = [];
  selectedClub: Club | null = null;
  clubListTab: 'active' | 'suspended' = 'active';
  copiedClubId: string | null = null;

  get activeClubCount(): number {
    return this.clubs.filter(c => c.status !== 'suspended').length;
  }
  get suspendedClubCount(): number {
    return this.clubs.filter(c => c.status === 'suspended').length;
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

  activeTab: 'admins' | 'payments' | 'appfees' | 'members' | 'chat' = 'admins';

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

  editConvenienceFeeMode: 'per_transaction' | 'per_hour' = 'per_hour';
  editConvenienceFeeRate = 10;
  savingFeeMode = false;
  feeModeSaveMsg = '';

  get reservationCharges(): Charge[] {
    return this.approvedCharges.filter(c =>
      c.chargeType === 'reservation' && c.reservationId?.status === 'confirmed'
    );
  }
  get reservationTotal(): number {
    return this.reservationCharges.reduce((sum, c) => sum + c.amount, 0);
  }
  get appServiceDue(): number {
    return this.reservationCharges.reduce((sum, c) => sum + (c.breakdown?.convenienceFee ?? 0), 0);
  }
  get aspTotalPaid(): number {
    return this.aspPayments.filter(p => p.type !== 'waiver').reduce((sum, p) => sum + p.amount, 0);
  }
  get aspTotalWaived(): number {
    return this.aspPayments.filter(p => p.type === 'waiver').reduce((sum, p) => sum + p.amount, 0);
  }
  get aspBalance(): number {
    return Math.max(0, this.appServiceDue - this.aspTotalPaid - this.aspTotalWaived);
  }

  mirroringUserId: string | null = null;

  constructor(
    private clubService: ClubService,
    private usersService: UsersService,
    private chargesService: ChargesService,
    private aspService: AppServicePaymentsService,
    readonly auth: AuthService,
    private inquiriesService: InquiriesService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

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
    this.feeModeSaveMsg = '';

    this.loadClubAdmins();
  }

  setTab(tab: 'admins' | 'payments' | 'appfees' | 'members' | 'chat') {
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

  loadClubMembers() {
    if (!this.selectedClub?._id || !this.auth.isSuperAdmin()) return;
    this.membersLoading = true;
    this.membersError = '';
    this.usersService.getClubUsers(this.selectedClub._id).subscribe({
      next: (users) => {
        this.clubMembers = users.filter(u => u.role === 'player');
        this.cdr.detectChanges();
        this.membersLoading = false;
      },
      error: () => { this.membersError = 'Failed to load members.'; this.membersLoading = false; this.cdr.detectChanges(); },
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

    this.chargesService.getApprovedCharges(clubId).subscribe({
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
    this.clubService.patchConvenienceFee(this.selectedClub._id, rate, this.editConvenienceFeeMode).subscribe({
      next: (updated) => {
        this.clubs = this.clubs.map(c => c._id === updated._id ? { ...c, convenienceFeeRate: updated.convenienceFeeRate, convenienceFeeMode: updated.convenienceFeeMode } : c);
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, convenienceFeeRate: updated.convenienceFeeRate, convenienceFeeMode: updated.convenienceFeeMode };
        this.savingFeeMode = false;
        this.feeModeSaveMsg = 'Saved!';
        this.cdr.detectChanges();
        setTimeout(() => { this.feeModeSaveMsg = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: () => { this.savingFeeMode = false; this.feeModeSaveMsg = 'Failed to save.'; this.cdr.detectChanges(); },
    });
  }

  openAspModal() {
    this.aspModal = { show: true, amount: parseFloat(this.aspBalance.toFixed(2)), method: 'GCash', note: '', submitting: false, error: '' };
  }
  closeAspModal() { this.aspModal = { show: false, amount: 0, method: 'GCash', note: '', submitting: false, error: '' }; }

  confirmAspPayment() {
    if (!this.selectedClub?._id || this.aspModal.amount <= 0) return;
    this.aspModal = { ...this.aspModal, submitting: true, error: '' };
    this.aspService.record(this.aspModal.amount, this.aspModal.method, this.aspModal.note || undefined, this.selectedClub._id).subscribe({
      next: (res) => {
        this.aspPayments = [res.payment, ...this.aspPayments];
        this.closeAspModal();
        this.cdr.detectChanges();
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
}
