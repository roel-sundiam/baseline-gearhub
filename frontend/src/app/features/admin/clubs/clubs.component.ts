import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClubService, Club } from '../../../core/services/club.service';
import { UsersService } from '../../../core/services/users.service';
import { CoinsService, CoinRequest } from '../../../core/services/coins.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AppServicePaymentsService, AppServicePayment } from '../../../core/services/app-service-payments.service';
import { AuthService } from '../../../core/services/auth.service';

interface AdminUser {
  _id: string;
  name: string;
  username: string;
  email?: string;
  role: string;
  status: string;
  clubId?: { _id: string; name: string } | string;
  createdAt: string;
}

@Component({
  selector: 'app-admin-clubs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="clubs-page">
      <header class="hero-panel">
        <div>
          <p class="hero-kicker">Superadmin Workspace</p>
          <h2>Club Portfolio</h2>
          <p class="hero-subtitle">Manage clubs, update details, and keep your network organized.</p>
        </div>
        <div class="hero-actions">
          <span class="count-chip">
            <i class="fas fa-shield-alt"></i>
            {{ clubs.length }} {{ clubs.length === 1 ? 'Club' : 'Clubs' }}
          </span>
          <a routerLink="/player/dashboard" class="btn-player">
            <i class="fas fa-user"></i>
            Player Dashboard
          </a>
          <a routerLink="/admin/clubs/new" class="btn-create">
            <i class="fas fa-plus"></i>
            New Club
          </a>
        </div>
      </header>

      @if (loading) {
        <section class="state-card">
          <div class="skeleton-grid">
            @for (item of [1, 2, 3]; track item) {
              <div class="skeleton-item"></div>
            }
          </div>
        </section>
      } @else if (error) {
        <section class="state-card state-error">
          <i class="fas fa-triangle-exclamation"></i>
          <p>{{ error }}</p>
          <button type="button" class="btn-outline" (click)="loadClubs()">Try Again</button>
        </section>
      } @else if (clubs.length === 0) {
        <section class="state-card state-empty">
          <i class="fas fa-shield-alt"></i>
          <h3>No clubs yet</h3>
          <p>Create your first club to get started.</p>
          <a routerLink="/admin/clubs/new" class="btn-create">Create Club</a>
        </section>
      } @else {
        <section class="clubs-grid">
          @for (club of clubs; track club._id) {
            <article
              class="club-card"
              [class.active]="selectedClub?._id === club._id"
              (click)="selectClub(club)"
              role="button"
              tabindex="0"
              (keydown.enter)="selectClub(club)"
              (keydown.space)="selectClub(club); $event.preventDefault()"
            >
              <div class="card-topline"></div>
              <div class="club-head">
                @if (club.logo) {
                  <img [src]="club.logo" [alt]="club.name" class="club-logo" />
                } @else {
                  <div class="club-logo-placeholder">{{ getInitials(club.name) }}</div>
                }
                <div class="club-identity">
                  <h3>{{ club.name }}</h3>
                  <p>Club ID: {{ club._id }}</p>
                </div>
              </div>

              <div class="club-meta">
                <span class="meta-pill">
                  <i class="fas fa-location-dot"></i>
                  {{ club.location || 'Location not set' }}
                </span>
                @if (club.createdAt) {
                  <span class="meta-pill">
                    <i class="fas fa-calendar-days"></i>
                    Added {{ formatDate(club.createdAt) }}
                  </span>
                }
                <span class="meta-pill coin-pill">
                  <i class="fas fa-coins"></i>
                  {{ club.coinBalance ?? 0 }} coins
                </span>
                @if (auth.isSuperAdmin() && (pendingCounts[club._id] ?? 0) > 0) {
                  <span class="meta-pill pending-pill">
                    <i class="fas fa-clock"></i>
                    {{ pendingCounts[club._id] }} pending
                  </span>
                }
              </div>

              <div class="club-actions">
                <button type="button" class="btn-admin" (click)="$event.stopPropagation(); selectClub(club)">
                  <i class="fas fa-user-cog"></i> Admins
                </button>
                <a [routerLink]="['/admin/clubs', club._id, 'edit']" class="btn-outline" (click)="$event.stopPropagation()">
                  <i class="fas fa-pen"></i> Edit
                </a>
                <button type="button" class="btn-danger" (click)="$event.stopPropagation(); deleteClub(club)">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </article>
          }
        </section>

        @if (selectedClub) {
          <section class="admin-module">
            <header class="admin-module-header">
              <div>
                <p class="hero-kicker">Club Module</p>
                <h3>{{ selectedClub.name }}</h3>
                <p>Manage admins, payments, and app service fees for this club.</p>
              </div>
              @if (activeTab === 'admins') {
                <button type="button" class="btn-create" (click)="showAdminForm = !showAdminForm">
                  <i class="fas" [class.fa-plus]="!showAdminForm" [class.fa-times]="showAdminForm"></i>
                  {{ showAdminForm ? 'Close Form' : 'Add Club Admin' }}
                </button>
              }
              @if (activeTab === 'appfees' && aspBalance > 0 && !aspLoading) {
                <button type="button" class="btn-create" (click)="openAspModal()">
                  <i class="fas fa-paper-plane"></i> Record Payment
                </button>
              }
            </header>

            <!-- Tabs -->
            <div class="module-tabs">
              <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'admins'" (click)="setTab('admins')">
                <i class="fas fa-user-cog"></i> Admins
              </button>
              @if (auth.isSuperAdmin()) {
                <button type="button" class="tab-btn" [class.tab-active]="activeTab === 'coins'" (click)="setTab('coins')">
                  <i class="fas fa-coins"></i> Coin Requests
                  @if ((pendingCounts[selectedClub._id] ?? 0) > 0) {
                    <span class="tab-badge">{{ pendingCounts[selectedClub._id] }}</span>
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
              }
            </div>

            <!-- ── ADMINS TAB ── -->
            @if (activeTab === 'admins') {
              @if (showAdminForm) {
                <section class="admin-form-card">
                  @if (adminFormError) { <div class="form-alert error">{{ adminFormError }}</div> }
                  @if (adminFormSuccess) { <div class="form-alert success">{{ adminFormSuccess }}</div> }
                  <form (ngSubmit)="createClubAdmin()" #adminFormRef="ngForm">
                    <div class="admin-form-grid">
                      <label>Full Name
                        <input type="text" [(ngModel)]="adminForm.name" name="name" required (ngModelChange)="onAdminNameChange($event)" />
                      </label>
                      <label>Username
                        <input type="text" [(ngModel)]="adminForm.username" name="username" required (ngModelChange)="onAdminUsernameChange()" />
                      </label>
                      <label>Password
                        <input type="password" [(ngModel)]="adminForm.password" name="password" required minlength="6" />
                      </label>
                      <label>Email (optional)
                        <input type="email" [(ngModel)]="adminForm.email" name="email" />
                      </label>
                    </div>
                    <div class="admin-form-actions">
                      <button type="submit" class="btn-create" [disabled]="creatingAdmin || adminFormRef.invalid">
                        {{ creatingAdmin ? 'Creating...' : 'Create Admin' }}
                      </button>
                      <button type="button" class="btn-outline" (click)="resetAdminForm()">Reset</button>
                    </div>
                  </form>
                </section>
              }
              <section class="admin-list-card">
                @if (adminsLoading) {
                  <p class="admins-state">Loading club admins...</p>
                } @else if (adminsError) {
                  <div class="admins-state admins-error">{{ adminsError }}</div>
                } @else if (clubAdmins.length === 0) {
                  <p class="admins-state">No admins yet for this club.</p>
                } @else {
                  <div class="admin-list-grid">
                    @for (admin of clubAdmins; track admin._id) {
                      <article class="admin-user-card">
                        <div class="admin-avatar">{{ getInitials(admin.name) }}</div>
                        <div class="admin-user-info">
                          <h4>{{ admin.name }}</h4>
                          <p>&#64;{{ admin.username }}</p>
                          @if (admin.email) { <p>{{ admin.email }}</p> }
                        </div>
                        <div class="admin-user-meta">
                          <span class="meta-pill">{{ admin.role }}</span>
                          <span class="meta-pill">{{ admin.status }}</span>
                        </div>
                      </article>
                    }
                  </div>
                }
              </section>
            }

            <!-- ── COIN REQUESTS TAB ── -->
            @if (activeTab === 'coins' && auth.isSuperAdmin()) {
              <section class="module-card">
                <div class="filter-row">
                  @for (f of coinFilterOptions; track f) {
                    <button type="button" class="filter-btn" [class.filter-active]="coinReqFilter === f" (click)="setCoinFilter(f)">
                      {{ f | titlecase }}
                      @if (coinReqCountByStatus(f) > 0) {
                        <span class="filter-count" [class.filter-count-amber]="f === 'approved'" [class.filter-count-red]="f === 'rejected'">
                          {{ coinReqCountByStatus(f) }}
                        </span>
                      }
                    </button>
                  }
                </div>
                @if (coinReqLoading) {
                  <p class="req-state">Loading requests...</p>
                } @else if (coinReqError) {
                  <p class="req-state req-error">{{ coinReqError }}</p>
                } @else if (filteredCoinRequests.length === 0) {
                  <p class="req-state">No {{ coinReqFilter }} coin requests.</p>
                } @else {
                  <div class="item-list">
                    @for (req of filteredCoinRequests; track req._id) {
                      <article class="item-card">
                        <div class="item-main">
                          <span class="coins-amount"><i class="fas fa-coins"></i> {{ req.coinsRequested }} coins</span>
                          <span class="badge-purple">{{ req.paymentMethod }}</span>
                        </div>
                        <div class="item-meta">
                          <span>by {{ req.requestedBy?.name ?? '—' }}</span>
                          <span>{{ formatDate(req.createdAt) }}</span>
                        </div>
                        @if (req.note) { <p class="item-note">"{{ req.note }}"</p> }
                        @if (req.status === 'rejected' && req.rejectedNote) {
                          <p class="item-reject-note"><i class="fas fa-ban"></i> {{ req.rejectedNote }}</p>
                        }
                        @if (req.status !== 'pending') {
                          <p class="item-resolved" [class.item-resolved-ok]="req.status === 'approved'">
                            <i class="fas" [class.fa-check-circle]="req.status === 'approved'" [class.fa-times-circle]="req.status === 'rejected'"></i>
                            {{ req.status === 'approved' ? 'Approved' : 'Rejected' }} by {{ req.approvedBy?.name ?? '—' }}
                          </p>
                        }
                        @if (req.status === 'pending') {
                          <div class="item-actions">
                            <button type="button" class="btn-approve" (click)="approveRequest(req)" [disabled]="processingReq.has(req._id)">
                              <i class="fas fa-check"></i> {{ processingReq.has(req._id) ? 'Approving...' : 'Approve' }}
                            </button>
                            <button type="button" class="btn-reject-sm" (click)="openRejectModal(req)" [disabled]="processingReq.has(req._id)">
                              <i class="fas fa-times"></i> Reject
                            </button>
                          </div>
                        }
                      </article>
                    }
                  </div>
                }
              </section>
            }

            <!-- ── PAYMENT APPROVALS TAB ── -->
            @if (activeTab === 'payments' && auth.isSuperAdmin()) {
              <section class="module-card">
                <div class="filter-row">
                  @for (f of paymentFilterOptions; track f) {
                    <button type="button" class="filter-btn" [class.filter-active]="chargeFilter === f" (click)="setChargeFilter(f)">
                      {{ f | titlecase }}
                    </button>
                  }
                </div>
                @if (chargesLoading) {
                  <p class="req-state">Loading payment approvals...</p>
                } @else if (chargesError) {
                  <p class="req-state req-error">{{ chargesError }}</p>
                } @else if (filteredCharges.length === 0) {
                  <p class="req-state">No {{ chargeFilter }} payment approvals.</p>
                } @else {
                  <div class="item-list">
                    @for (charge of filteredCharges; track charge._id) {
                      <article class="item-card">
                        <div class="item-main">
                          <span class="charge-amount">₱{{ charge.amount | number:'1.2-2' }}</span>
                          <span class="badge-type" [class.badge-res]="charge.chargeType === 'reservation'" [class.badge-ses]="charge.chargeType === 'session'">
                            {{ charge.chargeType }}
                          </span>
                          @if (charge.paymentMethod) {
                            <span class="badge-purple">{{ charge.paymentMethod }}</span>
                          }
                        </div>
                        <div class="item-meta">
                          <span>{{ getPlayerName(charge) }}</span>
                          @if (charge.paidAt) { <span>{{ formatDate(charge.paidAt) }}</span> }
                        </div>
                        @if (charge.approvalStatus === 'rejected' && charge.adminNote) {
                          <p class="item-reject-note"><i class="fas fa-ban"></i> {{ charge.adminNote }}</p>
                        }
                        @if (charge.approvalStatus !== 'pending') {
                          <p class="item-resolved" [class.item-resolved-ok]="charge.approvalStatus === 'approved'">
                            <i class="fas" [class.fa-check-circle]="charge.approvalStatus === 'approved'" [class.fa-times-circle]="charge.approvalStatus === 'rejected'"></i>
                            {{ charge.approvalStatus === 'approved' ? 'Approved' : 'Rejected' }}
                          </p>
                        }
                        @if (charge.approvalStatus === 'pending') {
                          <div class="item-actions">
                            <button type="button" class="btn-approve" (click)="approveCharge(charge)" [disabled]="processingCharge.has(charge._id)">
                              <i class="fas fa-check"></i> {{ processingCharge.has(charge._id) ? 'Approving...' : 'Approve' }}
                            </button>
                            <button type="button" class="btn-reject-sm" (click)="openRejectChargeModal(charge)" [disabled]="processingCharge.has(charge._id)">
                              <i class="fas fa-times"></i> Reject
                            </button>
                          </div>
                        }
                      </article>
                    }
                  </div>
                }
              </section>
            }

            <!-- ── APP SERVICE FEES TAB ── -->
            @if (activeTab === 'appfees' && auth.isSuperAdmin()) {
              <section class="module-card">
                @if (aspLoading) {
                  <p class="req-state">Loading app service data...</p>
                } @else if (aspError) {
                  <p class="req-state req-error">{{ aspError }}</p>
                } @else {
                  <!-- Summary row -->
                  <div class="asp-summary">
                    <div class="asp-stat">
                      <span class="asp-label">Court Charges</span>
                      <span class="asp-val">₱{{ reservationTotal | number:'1.2-2' }}</span>
                    </div>
                    <div class="asp-stat asp-stat-due">
                      <span class="asp-label">10% Due to Dev</span>
                      <span class="asp-val">₱{{ appServiceDue | number:'1.2-2' }}</span>
                    </div>
                    <div class="asp-stat asp-stat-paid">
                      <span class="asp-label">Paid to Dev</span>
                      <span class="asp-val">₱{{ aspTotalPaid | number:'1.2-2' }}</span>
                    </div>
                    <div class="asp-stat" [class.asp-stat-outstanding]="aspBalance > 0">
                      <span class="asp-label">Outstanding</span>
                      <span class="asp-val">₱{{ aspBalance | number:'1.2-2' }}</span>
                    </div>
                  </div>

                  <!-- Court charges breakdown -->
                  @if (reservationCharges.length > 0) {
                    <div class="asp-subsection">
                      <h5 class="asp-sub-title">
                        <i class="fas fa-tennis-ball"></i>
                        Court Reservation Charges
                        <span class="asp-sub-count">{{ reservationCharges.length }}</span>
                      </h5>
                      <div class="asp-charge-list">
                        @for (c of reservationCharges; track c._id) {
                          <div class="asp-charge-row">
                            <span class="asp-player">{{ getPlayerName(c) }}</span>
                            <span class="asp-date">{{ formatDate(c.createdAt) }}</span>
                            <span class="asp-court-fee">₱{{ c.amount | number:'1.2-2' }}</span>
                            <span class="asp-fee-chip">10% = ₱{{ (c.amount * 0.10) | number:'1.2-2' }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  } @else {
                    <p class="req-state">No approved reservation charges yet.</p>
                  }

                  <!-- Payments to developer -->
                  <div class="asp-subsection">
                    <h5 class="asp-sub-title">
                      <i class="fas fa-paper-plane"></i>
                      Payments to Developer
                      @if (aspPayments.length > 0) {
                        <span class="asp-sub-count">{{ aspPayments.length }}</span>
                      }
                    </h5>
                    @if (aspPayments.length === 0) {
                      <p class="req-state">No payments recorded yet.</p>
                    } @else {
                      <div class="asp-payment-list">
                        @for (p of aspPayments; track p._id) {
                          <div class="asp-payment-row">
                            <div class="asp-payment-left">
                              <span class="asp-payment-amount">₱{{ p.amount | number:'1.2-2' }}</span>
                              <span class="badge-purple">{{ p.paymentMethod }}</span>
                              @if (p.note) { <span class="asp-note">{{ p.note }}</span> }
                            </div>
                            <div class="asp-payment-right">
                              <span>by {{ p.paidBy?.name ?? '—' }}</span>
                              <span>{{ formatDate(p.createdAt) }}</span>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </section>
            }
          </section>
        }
      }
    </section>

    <!-- ── Reject coin request modal ── -->
    @if (rejectModal.show) {
      <div class="modal-backdrop" (click)="closeRejectModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h4><i class="fas fa-times-circle"></i> Reject Coin Request</h4>
          <p>Optionally add a reason:</p>
          <textarea [(ngModel)]="rejectModal.note" name="rejectNote" rows="3" placeholder="Rejection reason (optional)"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn-danger" (click)="confirmReject()" [disabled]="rejectModal.submitting">
              {{ rejectModal.submitting ? 'Rejecting...' : 'Confirm Reject' }}
            </button>
            <button type="button" class="btn-outline" (click)="closeRejectModal()">Cancel</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Reject charge payment modal ── -->
    @if (rejectChargeModal.show) {
      <div class="modal-backdrop" (click)="closeRejectChargeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h4><i class="fas fa-times-circle"></i> Reject Payment</h4>
          <p>Optionally add a reason for rejection:</p>
          <textarea [(ngModel)]="rejectChargeModal.note" name="rejectChargeNote" rows="3" placeholder="Rejection reason (optional)"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn-danger" (click)="confirmRejectCharge()" [disabled]="rejectChargeModal.submitting">
              {{ rejectChargeModal.submitting ? 'Rejecting...' : 'Confirm Reject' }}
            </button>
            <button type="button" class="btn-outline" (click)="closeRejectChargeModal()">Cancel</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Record app service payment modal ── -->
    @if (aspModal.show) {
      <div class="modal-backdrop" (click)="closeAspModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h4><i class="fas fa-paper-plane"></i> Record Payment to Developer</h4>
          <p>Outstanding balance: <strong>₱{{ aspBalance | number:'1.2-2' }}</strong></p>
          @if (aspModal.error) { <div class="form-alert error">{{ aspModal.error }}</div> }
          <div class="asp-modal-form">
            <label>Amount (PHP)
              <input type="number" [(ngModel)]="aspModal.amount" name="aspAmount" min="0.01" step="0.01" />
            </label>
            <label>Payment Method
              <select [(ngModel)]="aspModal.method" name="aspMethod">
                <option value="GCash">GCash</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </label>
            <label>Note (optional)
              <input type="text" [(ngModel)]="aspModal.note" name="aspNote" placeholder="e.g. April 2025 app service" />
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-create" (click)="confirmAspPayment()" [disabled]="aspModal.submitting || aspModal.amount <= 0">
              {{ aspModal.submitting ? 'Saving...' : 'Record Payment' }}
            </button>
            <button type="button" class="btn-outline" (click)="closeAspModal()">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      --ink: #102226;
      --teal-700: #16636f;
      --teal-600: #1d7b87;
      --teal-100: #dcf3f6;
      --sand: #f6f2e8;
      --card-bg: rgba(255,255,255,0.94);
      --line: rgba(16,34,38,0.11);
      --danger: #b22e2e;
      display: block;
      font-family: 'Manrope','Segoe UI','Helvetica Neue',sans-serif;
    }

    .clubs-page { display: grid; gap: 1rem; }

    /* ── Hero ── */
    .hero-panel {
      background: radial-gradient(circle at top right, rgba(242,183,75,0.34), transparent 42%),
                  linear-gradient(140deg, var(--sand), #fff);
      border: 1px solid var(--line); border-radius: 18px;
      padding: 1rem 1.25rem;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      box-shadow: 0 10px 30px rgba(7,24,28,0.12);
    }
    .hero-kicker { margin: 0 0 0.2rem; color: var(--teal-700); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.74rem; font-weight: 800; }
    .hero-panel h2 { margin: 0; color: var(--ink); font-size: 1.45rem; letter-spacing: -0.02em; }
    .hero-subtitle { margin: 0.35rem 0 0; color: rgba(16,34,38,0.72); font-size: 0.92rem; }
    .hero-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; justify-content: flex-end; }
    .count-chip { background: var(--teal-100); color: var(--teal-700); border: 1px solid rgba(22,99,111,0.18); border-radius: 999px; padding: 0.42rem 0.78rem; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; }

    /* ── Buttons ── */
    .btn-create, .btn-outline, .btn-danger, .btn-player {
      border-radius: 10px; padding: 0.56rem 0.9rem; text-decoration: none;
      font-weight: 700; font-size: 0.86rem; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; gap: 0.38rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      border: 1px solid transparent; white-space: nowrap; font-family: inherit;
    }
    .btn-create { background: linear-gradient(145deg, var(--teal-600), #155860); color: #fff; box-shadow: 0 8px 16px rgba(21,88,96,0.26); }
    .btn-create:hover { transform: translateY(-1px); box-shadow: 0 10px 18px rgba(21,88,96,0.32); }
    .btn-player { background: linear-gradient(145deg, #7c3aed, #5b21b6); color: #fff; box-shadow: 0 8px 16px rgba(91,33,182,0.26); }
    .btn-player:hover { transform: translateY(-1px); box-shadow: 0 10px 18px rgba(91,33,182,0.32); }
    .btn-outline { background: #fff; border-color: rgba(16,34,38,0.2); color: var(--ink); }
    .btn-outline:hover { background: #f2f8f9; transform: translateY(-1px); }
    .btn-danger { background: #fff3f3; border-color: rgba(178,46,46,0.35); color: var(--danger); }
    .btn-danger:hover:not(:disabled) { background: #ffe8e8; transform: translateY(-1px); }
    .btn-danger:disabled { opacity: 0.55; cursor: not-allowed; }

    /* ── State cards ── */
    .state-card { background: var(--card-bg); border: 1px solid var(--line); border-radius: 16px; padding: 1rem; box-shadow: 0 8px 24px rgba(12,22,25,0.1); }
    .state-empty, .state-error { text-align: center; padding: 2rem 1rem; display: grid; justify-items: center; gap: 0.55rem; color: var(--ink); }
    .state-empty i, .state-error i { font-size: 1.6rem; }
    .state-empty h3 { margin: 0; font-size: 1.16rem; }
    .state-empty p, .state-error p { margin: 0; color: rgba(16,34,38,0.74); }
    .state-error i, .state-error p { color: var(--danger); }

    /* ── Skeleton ── */
    .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 0.8rem; }
    .skeleton-item { height: 145px; border-radius: 14px; background: linear-gradient(110deg,#ecf2f4 8%,#f7fbfc 18%,#ecf2f4 33%); background-size: 200% 100%; animation: shimmer 1.1s linear infinite; border: 1px solid rgba(16,34,38,0.06); }

    /* ── Club grid ── */
    .clubs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap: 0.9rem; }

    .club-card {
      background: var(--card-bg); border: 1px solid var(--line); border-radius: 16px;
      overflow: hidden; display: grid; gap: 0.9rem; padding: 0 0.95rem 0.95rem;
      box-shadow: 0 8px 20px rgba(9,19,22,0.1);
      transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: pointer;
    }
    .club-card:focus-visible { outline: 2px solid #0f7481; outline-offset: 2px; }
    .club-card.active { border-color: rgba(15,116,129,0.5); box-shadow: 0 12px 30px rgba(15,116,129,0.18); }
    .club-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(9,19,22,0.14); }

    .card-topline { height: 5px; margin: 0 -0.95rem; background: linear-gradient(90deg,#0f7481,#f2b74b); }

    .club-head { display: flex; gap: 0.72rem; align-items: center; }
    .club-logo, .club-logo-placeholder { width: 54px; height: 54px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
    .club-logo { border: 1px solid rgba(16,34,38,0.14); background: #fff; }
    .club-logo-placeholder { display: grid; place-items: center; background: linear-gradient(145deg,#def4f7,#c0e4ea); color: #18545d; font-weight: 800; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .club-identity h3 { margin: 0; color: var(--ink); font-size: 1.05rem; line-height: 1.2; }
    .club-identity p { margin: 0.2rem 0 0; font-size: 0.73rem; color: rgba(16,34,38,0.56); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }

    .club-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .meta-pill { background: #f5f9fa; border: 1px solid rgba(16,34,38,0.11); color: rgba(16,34,38,0.8); border-radius: 999px; padding: 0.35rem 0.62rem; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 0.35rem; }
    .coin-pill { background: #fffbeb; border-color: rgba(245,158,11,0.3); color: #92400e; font-weight: 700; }
    .coin-pill i { color: #f59e0b; }
    .pending-pill { background: #fff7ed; border-color: rgba(234,88,12,0.3); color: #c2410c; font-weight: 700; animation: pulse-pill 2s ease-in-out infinite; }
    .pending-pill i { color: #ea580c; }
    @keyframes pulse-pill { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 0 3px rgba(234,88,12,0.15)} }

    .club-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.55rem; }
    .btn-admin { background: #e9f7fa; border: 1px solid rgba(15,116,129,0.35); color: #0f5f69; border-radius: 10px; padding: 0.56rem 0.9rem; font-weight: 700; font-size: 0.86rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.38rem; transition: transform 0.15s, box-shadow 0.15s, background 0.15s; font-family: inherit; white-space: nowrap; }
    .btn-admin:hover { background: #dff3f7; transform: translateY(-1px); box-shadow: 0 8px 16px rgba(15,116,129,0.18); }

    /* ── Admin module ── */
    .admin-module { background: var(--card-bg); border: 1px solid var(--line); border-radius: 16px; padding: 0.9rem; box-shadow: 0 10px 28px rgba(9,19,22,0.12); display: grid; gap: 0.8rem; }
    .admin-module-header { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; flex-wrap: wrap; }
    .admin-module-header h3 { margin: 0; color: var(--ink); font-size: 1.05rem; }
    .admin-module-header p { margin: 0.25rem 0 0; color: rgba(16,34,38,0.72); font-size: 0.85rem; }

    /* ── Tabs ── */
    .module-tabs { display: flex; gap: 0.45rem; border-bottom: 1px solid var(--line); padding-bottom: 0.65rem; flex-wrap: wrap; }
    .tab-btn { background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 0.42rem 0.78rem; font-size: 0.83rem; font-weight: 700; cursor: pointer; font-family: inherit; color: rgba(16,34,38,0.6); display: inline-flex; align-items: center; gap: 0.38rem; transition: background 0.15s, color 0.15s, border-color 0.15s; }
    .tab-btn:hover { background: #f0f7f9; color: var(--teal-700); }
    .tab-active { background: var(--teal-100); color: var(--teal-700); border-color: rgba(22,99,111,0.22); }
    .tab-badge { background: #f97316; color: #fff; border-radius: 999px; padding: 0.08rem 0.44rem; font-size: 0.72rem; font-weight: 800; line-height: 1.4; }
    .tab-badge-amber { background: #d97706; }

    /* ── Module card (shared tab content wrapper) ── */
    .module-card { border: 1px solid var(--line); border-radius: 12px; padding: 0.75rem; background: rgba(255,255,255,0.92); display: grid; gap: 0.55rem; }

    /* ── Admin form / list ── */
    .admin-form-card, .admin-list-card { border: 1px solid var(--line); border-radius: 12px; padding: 0.75rem; background: rgba(255,255,255,0.92); }
    .admin-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0.7rem; }
    .admin-form-grid label { display: grid; gap: 0.3rem; color: var(--ink); font-size: 0.82rem; font-weight: 700; }
    .admin-form-grid input { border: 1px solid rgba(16,34,38,0.22); border-radius: 8px; padding: 0.5rem 0.6rem; font-size: 0.9rem; font-family: inherit; }
    .admin-form-grid input:focus { outline: 2px solid rgba(15,116,129,0.2); border-color: #0f7481; }
    .admin-form-actions { margin-top: 0.75rem; display: flex; gap: 0.55rem; flex-wrap: wrap; }
    .form-alert { border-radius: 8px; padding: 0.55rem 0.65rem; font-size: 0.82rem; margin-bottom: 0.55rem; }
    .form-alert.error { color: #b22e2e; background: #fff1f1; border: 1px solid rgba(178,46,46,0.25); }
    .form-alert.success { color: #136b2e; background: #f1fdf5; border: 1px solid rgba(19,107,46,0.25); }
    .admins-state { margin: 0; color: rgba(16,34,38,0.72); font-size: 0.9rem; }
    .admins-error { color: var(--danger); }
    .admin-list-grid { display: grid; gap: 0.6rem; }
    .admin-user-card { border: 1px solid rgba(16,34,38,0.14); border-radius: 10px; padding: 0.6rem; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.6rem; background: #fff; }
    .admin-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg,#d6edf1,#b2dce2); color: #18545d; display: grid; place-items: center; font-weight: 800; font-size: 0.8rem; text-transform: uppercase; }
    .admin-user-info h4 { margin: 0; font-size: 0.9rem; color: var(--ink); }
    .admin-user-info p { margin: 0.1rem 0 0; font-size: 0.78rem; color: rgba(16,34,38,0.66); word-break: break-word; }
    .admin-user-meta { display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-end; }

    /* ── Shared item list (coins + payments) ── */
    .filter-row { display: flex; gap: 0.42rem; flex-wrap: wrap; }
    .filter-btn { background: #f5f9fa; border: 1px solid var(--line); border-radius: 999px; padding: 0.34rem 0.72rem; font-size: 0.79rem; font-weight: 700; cursor: pointer; font-family: inherit; color: rgba(16,34,38,0.7); display: inline-flex; align-items: center; gap: 0.32rem; transition: background 0.15s, color 0.15s, border-color 0.15s; }
    .filter-btn:hover { background: #eef5f7; color: var(--teal-700); }
    .filter-active { background: var(--teal-100); color: var(--teal-700); border-color: rgba(22,99,111,0.25); }
    .filter-count { background: #f97316; color: #fff; border-radius: 999px; padding: 0.08rem 0.38rem; font-size: 0.7rem; font-weight: 800; line-height: 1.4; }
    .filter-count-amber { background: #16a34a; }
    .filter-count-red { background: #b91c1c; }

    .req-state { color: rgba(16,34,38,0.6); font-size: 0.86rem; margin: 0; padding: 0.5rem 0; }
    .req-error { color: var(--danger); }

    .item-list { display: grid; gap: 0.5rem; }
    .item-card { border: 1px solid rgba(16,34,38,0.12); border-radius: 10px; padding: 0.65rem 0.75rem; background: #fff; display: grid; gap: 0.35rem; }
    .item-main { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
    .item-meta { display: flex; gap: 0.55rem; font-size: 0.77rem; color: rgba(16,34,38,0.58); flex-wrap: wrap; }
    .item-note { margin: 0; font-size: 0.8rem; color: rgba(16,34,38,0.68); font-style: italic; }
    .item-reject-note { margin: 0; font-size: 0.79rem; color: #b22e2e; display: flex; align-items: center; gap: 0.3rem; }
    .item-resolved { margin: 0; font-size: 0.79rem; color: #b22e2e; display: flex; align-items: center; gap: 0.3rem; }
    .item-resolved-ok { color: #166534; }
    .item-actions { display: flex; gap: 0.48rem; flex-wrap: wrap; margin-top: 0.1rem; }

    /* Badges */
    .coins-amount { font-weight: 800; font-size: 0.95rem; color: #92400e; display: inline-flex; align-items: center; gap: 0.3rem; }
    .coins-amount i { color: #f59e0b; }
    .charge-amount { font-weight: 800; font-size: 0.95rem; color: var(--ink); }
    .badge-purple { background: #ede9fe; color: #5b21b6; border-radius: 999px; padding: 0.18rem 0.54rem; font-size: 0.75rem; font-weight: 700; }
    .badge-type { border-radius: 999px; padding: 0.18rem 0.54rem; font-size: 0.75rem; font-weight: 700; text-transform: capitalize; }
    .badge-res { background: #dcf3f6; color: #16636f; }
    .badge-ses { background: #eff6ff; color: #1d4ed8; }

    /* Action buttons */
    .btn-approve { background: #f0fdf4; border: 1px solid rgba(22,163,74,0.35); color: #166534; border-radius: 8px; padding: 0.36rem 0.72rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.32rem; transition: background 0.15s; }
    .btn-approve:hover:not(:disabled) { background: #dcfce7; }
    .btn-approve:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-reject-sm { background: #fff3f3; border: 1px solid rgba(178,46,46,0.3); color: var(--danger); border-radius: 8px; padding: 0.36rem 0.72rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.32rem; transition: background 0.15s; }
    .btn-reject-sm:hover:not(:disabled) { background: #ffe8e8; }
    .btn-reject-sm:disabled { opacity: 0.55; cursor: not-allowed; }

    /* ── App Service Fees ── */
    .asp-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.55rem; }
    .asp-stat { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 0.65rem 0.75rem; display: grid; gap: 0.15rem; }
    .asp-stat-due { background: #fff7ed; border-color: rgba(234,88,12,0.22); }
    .asp-stat-paid { background: #f0fdf4; border-color: rgba(22,163,74,0.22); }
    .asp-stat-outstanding { background: #fff1f0; border-color: rgba(178,46,46,0.25); }
    .asp-label { font-size: 0.73rem; font-weight: 700; color: rgba(16,34,38,0.58); text-transform: uppercase; letter-spacing: 0.06em; }
    .asp-val { font-size: 1rem; font-weight: 800; color: var(--ink); }

    .asp-subsection { display: grid; gap: 0.45rem; }
    .asp-sub-title { margin: 0; font-size: 0.83rem; font-weight: 800; color: var(--ink); display: flex; align-items: center; gap: 0.4rem; border-bottom: 1px solid var(--line); padding-bottom: 0.4rem; }
    .asp-sub-count { background: var(--teal-100); color: var(--teal-700); border-radius: 999px; padding: 0.08rem 0.44rem; font-size: 0.72rem; font-weight: 800; }

    .asp-charge-list { display: grid; gap: 0.35rem; }
    .asp-charge-row { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; padding: 0.45rem 0.55rem; background: #fff; border: 1px solid rgba(16,34,38,0.1); border-radius: 8px; font-size: 0.82rem; }
    .asp-player { flex: 1; min-width: 100px; font-weight: 600; color: var(--ink); }
    .asp-date { color: rgba(16,34,38,0.55); font-size: 0.76rem; }
    .asp-court-fee { font-weight: 700; color: var(--ink); }
    .asp-fee-chip { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.25); border-radius: 999px; padding: 0.12rem 0.5rem; font-size: 0.74rem; font-weight: 800; }

    .asp-payment-list { display: grid; gap: 0.35rem; }
    .asp-payment-row { display: flex; align-items: center; justify-content: space-between; gap: 0.55rem; flex-wrap: wrap; padding: 0.45rem 0.55rem; background: #fff; border: 1px solid rgba(16,34,38,0.1); border-radius: 8px; }
    .asp-payment-left { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
    .asp-payment-amount { font-weight: 800; font-size: 0.95rem; color: #166534; }
    .asp-note { font-size: 0.78rem; color: rgba(16,34,38,0.6); font-style: italic; }
    .asp-payment-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; font-size: 0.76rem; color: rgba(16,34,38,0.58); }

    /* ── Modal ── */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(10,20,23,0.52); display: grid; place-items: center; z-index: 50; padding: 1rem; }
    .modal-card { background: #fff; border-radius: 16px; padding: 1.25rem; width: 100%; max-width: 400px; box-shadow: 0 20px 50px rgba(10,20,23,0.22); display: grid; gap: 0.65rem; }
    .modal-card h4 { margin: 0; font-size: 1rem; color: var(--danger); display: flex; align-items: center; gap: 0.4rem; }
    .modal-card p { margin: 0; font-size: 0.86rem; color: rgba(16,34,38,0.72); }
    .modal-card textarea { border: 1px solid rgba(16,34,38,0.22); border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.9rem; font-family: inherit; resize: vertical; width: 100%; box-sizing: border-box; }
    .modal-card textarea:focus, .modal-card input:focus, .modal-card select:focus { outline: 2px solid rgba(15,116,129,0.2); border-color: #0f7481; }
    .modal-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; }

    .asp-modal-form { display: grid; gap: 0.55rem; }
    .asp-modal-form label { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 700; color: var(--ink); }
    .asp-modal-form input, .asp-modal-form select { border: 1px solid rgba(16,34,38,0.22); border-radius: 8px; padding: 0.5rem 0.6rem; font-size: 0.9rem; font-family: inherit; width: 100%; box-sizing: border-box; }

    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    @media (max-width: 860px) {
      .hero-panel { flex-direction: column; align-items: stretch; }
      .hero-actions { justify-content: flex-start; }
      .asp-summary { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 640px) {
      .clubs-page { gap: 0.85rem; }
      .hero-panel { padding: 0.85rem; }
      .hero-panel h2 { font-size: 1.2rem; }
      .hero-subtitle { font-size: 0.84rem; }
      .hero-actions { width: 100%; gap: 0.5rem; }
      .count-chip, .btn-create, .btn-player { width: 100%; justify-content: center; }
      .clubs-grid { grid-template-columns: 1fr; }
      .club-card { padding: 0 0.8rem 0.8rem; }
      .card-topline { margin: 0 -0.8rem; }
      .club-actions { grid-template-columns: 1fr; }
      .btn-outline, .btn-danger, .btn-admin { width: 100%; }
      .admin-form-grid { grid-template-columns: 1fr; }
      .admin-user-card { grid-template-columns: 1fr; justify-items: start; }
      .admin-user-meta { flex-direction: row; align-items: center; }
      .asp-summary { grid-template-columns: repeat(2, 1fr); }
      .asp-charge-row { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class AdminClubsComponent implements OnInit {
  clubs: Club[] = [];
  selectedClub: Club | null = null;
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

  activeTab: 'admins' | 'coins' | 'payments' | 'appfees' = 'admins';

  // ── Coin requests ──
  allClubRequests: CoinRequest[] = [];
  coinReqLoading = false;
  coinReqError = '';
  coinReqFilter: 'pending' | 'approved' | 'rejected' = 'pending';
  readonly coinFilterOptions: Array<'pending' | 'approved' | 'rejected'> = ['pending', 'approved', 'rejected'];
  pendingCounts: Record<string, number> = {};
  processingReq = new Set<string>();
  rejectModal = { show: false, requestId: '', note: '', submitting: false };

  get filteredCoinRequests(): CoinRequest[] {
    return this.allClubRequests.filter(r => r.status === this.coinReqFilter);
  }

  coinReqCountByStatus(status: string): number {
    return this.allClubRequests.filter(r => r.status === status).length;
  }

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
  aspModal = { show: false, amount: 0, method: 'GCash' as 'GCash' | 'Cash' | 'Bank Transfer', note: '', submitting: false, error: '' };

  get reservationCharges(): Charge[] {
    return this.approvedCharges.filter(c => c.chargeType === 'reservation');
  }
  get reservationTotal(): number {
    return this.reservationCharges.reduce((sum, c) => sum + c.amount, 0);
  }
  get appServiceDue(): number {
    return this.reservationTotal * 0.10;
  }
  get aspTotalPaid(): number {
    return this.aspPayments.reduce((sum, p) => sum + p.amount, 0);
  }
  get aspBalance(): number {
    return Math.max(0, this.appServiceDue - this.aspTotalPaid);
  }

  constructor(
    private clubService: ClubService,
    private usersService: UsersService,
    private coinsService: CoinsService,
    private chargesService: ChargesService,
    private aspService: AppServicePaymentsService,
    readonly auth: AuthService,
  ) {}

  ngOnInit() {
    this.loadClubs();
    this.loadPendingCounts();
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
      },
      error: () => { this.error = 'Failed to load clubs.'; this.loading = false; },
    });
  }

  selectClub(club: Club) {
    this.selectedClub = club;
    this.showAdminForm = false;
    this.adminFormError = '';
    this.adminFormSuccess = '';
    this.resetAdminForm();
    this.activeTab = 'admins';
    this.allClubRequests = [];
    this.allApprovalCharges = [];
    this.approvedCharges = [];
    this.aspPayments = [];
    this.coinReqFilter = 'pending';
    this.chargeFilter = 'pending';
    this.coinReqError = '';
    this.chargesError = '';
    this.aspError = '';
    this.loadClubAdmins();
  }

  setTab(tab: 'admins' | 'coins' | 'payments' | 'appfees') {
    this.activeTab = tab;
    if (tab === 'coins') this.loadClubCoinRequests();
    if (tab === 'payments') this.loadPaymentApprovals();
    if (tab === 'appfees') this.loadAppServiceData();
  }

  deleteClub(club: Club) {
    if (!confirm(`Delete "${club.name}"? This cannot be undone.`)) return;
    this.clubService.deleteClub(club._id).subscribe({
      next: () => this.loadClubs(),
      error: () => alert('Failed to delete club.'),
    });
  }

  // ── Admins ──
  loadClubAdmins() {
    if (!this.selectedClub?._id) { this.clubAdmins = []; return; }
    this.adminsLoading = true;
    this.adminsError = '';
    this.usersService.getAdmins(this.selectedClub._id).subscribe({
      next: (admins) => { this.clubAdmins = admins.filter(a => a.role === 'admin'); this.adminsLoading = false; },
      error: (err) => { this.adminsLoading = false; this.adminsError = err?.error?.error || 'Failed to load club admins.'; },
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
      next: () => { this.creatingAdmin = false; this.adminFormSuccess = `Admin "${this.adminForm.username}" created.`; this.resetAdminForm(); this.loadClubAdmins(); },
      error: (err) => { this.creatingAdmin = false; this.adminFormError = err?.error?.error || 'Failed to create admin.'; },
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

  // ── Coin requests ──
  loadPendingCounts() {
    if (!this.auth.isSuperAdmin()) return;
    this.coinsService.getAllRequests('pending').subscribe({
      next: (requests) => {
        const counts: Record<string, number> = {};
        for (const r of requests) {
          const id = typeof r.clubId === 'string' ? r.clubId : r.clubId?._id;
          if (id) counts[id] = (counts[id] ?? 0) + 1;
        }
        this.pendingCounts = counts;
      },
      error: () => {},
    });
  }

  loadClubCoinRequests() {
    if (!this.selectedClub?._id || !this.auth.isSuperAdmin()) return;
    this.coinReqLoading = true;
    this.coinReqError = '';
    this.coinsService.getAllRequests().subscribe({
      next: (requests) => {
        this.allClubRequests = requests.filter(r => {
          const id = typeof r.clubId === 'string' ? r.clubId : r.clubId?._id;
          return id === this.selectedClub!._id;
        });
        this.coinReqLoading = false;
      },
      error: () => { this.coinReqError = 'Failed to load coin requests.'; this.coinReqLoading = false; },
    });
  }

  setCoinFilter(filter: 'pending' | 'approved' | 'rejected') { this.coinReqFilter = filter; }

  approveRequest(req: CoinRequest) {
    this.processingReq = new Set(this.processingReq).add(req._id);
    this.coinsService.approveRequest(req._id).subscribe({
      next: (res) => {
        const next = new Set(this.processingReq); next.delete(req._id); this.processingReq = next;
        const idx = this.allClubRequests.findIndex(r => r._id === req._id);
        if (idx !== -1) this.allClubRequests = [...this.allClubRequests.slice(0, idx), res.request, ...this.allClubRequests.slice(idx + 1)];
        const club = this.clubs.find(c => c._id === (typeof req.clubId === 'string' ? req.clubId : req.clubId?._id));
        if (club) club.coinBalance = res.newBalance;
        if (this.selectedClub) this.selectedClub = { ...this.selectedClub, coinBalance: res.newBalance };
        this.loadPendingCounts();
      },
      error: () => { const next = new Set(this.processingReq); next.delete(req._id); this.processingReq = next; },
    });
  }

  openRejectModal(req: CoinRequest) { this.rejectModal = { show: true, requestId: req._id, note: '', submitting: false }; }
  closeRejectModal() { this.rejectModal = { show: false, requestId: '', note: '', submitting: false }; }

  confirmReject() {
    if (!this.rejectModal.requestId) return;
    this.rejectModal = { ...this.rejectModal, submitting: true };
    this.coinsService.rejectRequest(this.rejectModal.requestId, this.rejectModal.note || undefined).subscribe({
      next: (res) => {
        const idx = this.allClubRequests.findIndex(r => r._id === this.rejectModal.requestId);
        if (idx !== -1) this.allClubRequests = [...this.allClubRequests.slice(0, idx), res.request, ...this.allClubRequests.slice(idx + 1)];
        this.loadPendingCounts();
        this.closeRejectModal();
      },
      error: () => { this.rejectModal = { ...this.rejectModal, submitting: false }; },
    });
  }

  // ── Payment approvals ──
  loadPaymentApprovals() {
    if (!this.selectedClub?._id || !this.auth.isSuperAdmin()) return;
    this.chargesLoading = true;
    this.chargesError = '';
    this.chargesService.getAllApprovalCharges(this.selectedClub._id).subscribe({
      next: (charges) => { this.allApprovalCharges = charges; this.chargesLoading = false; },
      error: () => { this.chargesError = 'Failed to load payment approvals.'; this.chargesLoading = false; },
    });
  }

  setChargeFilter(filter: 'pending' | 'approved' | 'rejected') { this.chargeFilter = filter; }

  approveCharge(charge: Charge) {
    this.processingCharge = new Set(this.processingCharge).add(charge._id);
    this.chargesService.approvePayment(charge._id).subscribe({
      next: (res) => {
        const next = new Set(this.processingCharge); next.delete(charge._id); this.processingCharge = next;
        const idx = this.allApprovalCharges.findIndex(c => c._id === charge._id);
        if (idx !== -1) this.allApprovalCharges = [...this.allApprovalCharges.slice(0, idx), res.charge, ...this.allApprovalCharges.slice(idx + 1)];
      },
      error: () => { const next = new Set(this.processingCharge); next.delete(charge._id); this.processingCharge = next; },
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
      },
      error: () => { this.rejectChargeModal = { ...this.rejectChargeModal, submitting: false }; },
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
    const check = () => { if (chargesLoaded && paymentsLoaded) this.aspLoading = false; };

    this.chargesService.getApprovedCharges(clubId).subscribe({
      next: (c) => { this.approvedCharges = c; chargesLoaded = true; check(); },
      error: () => { this.aspError = 'Failed to load charge data.'; this.aspLoading = false; },
    });

    this.aspService.getAll(clubId).subscribe({
      next: (p) => { this.aspPayments = p; paymentsLoaded = true; check(); },
      error: () => { this.aspError = 'Failed to load payment data.'; this.aspLoading = false; },
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
      },
      error: (err) => { this.aspModal = { ...this.aspModal, submitting: false, error: err?.error?.error || 'Failed to record payment.' }; },
    });
  }

  // ── Utilities ──
  getPlayerName(charge: Charge): string {
    if (!charge.playerId) return 'Unknown';
    if (typeof charge.playerId === 'string') return charge.playerId;
    return charge.playerId.name || 'Unknown';
  }

  getInitials(name: string) {
    return name.split(' ').filter(p => p.trim().length > 0).map(p => p.charAt(0)).slice(0, 2).join('');
  }

  formatDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
