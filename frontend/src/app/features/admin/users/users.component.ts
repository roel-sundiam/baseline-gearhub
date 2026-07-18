import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { UsersService, User } from '../../../core/services/users.service';
import { MembershipService } from '../../../core/services/membership.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="page-card">

        <!-- Header -->
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <div class="header-center">
            <h2>Member Management</h2>
          </div>
          <div class="header-stats">
            <div class="stat-pill">
              <span class="stat-num">{{ allUsers.length }}</span>
              <span class="stat-lbl">Total</span>
            </div>
            <div class="stat-pill stat-pill-amber">
              <span class="stat-num">{{ pendingUsers.length }}</span>
              <span class="stat-lbl">Pending</span>
            </div>
            <div class="stat-pill stat-pill-green">
              <span class="stat-num">{{ activeCount }}</span>
              <span class="stat-lbl">Active</span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab === 'pending'" (click)="activeTab = 'pending'">
            <i class="fas fa-user-clock"></i> Pending Approval
            @if (pendingUsers.length > 0) {
              <span class="tab-badge">{{ pendingUsers.length }}</span>
            }
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'all'" (click)="activeTab = 'all'">
            <i class="fas fa-users"></i> All Members
          </button>
        </div>

        <div class="card-body">
          @if (loading) {
            <div class="loading"><i class="fas fa-circle-notch fa-spin"></i> Loading members...</div>
          } @else if (activeTab === 'pending') {

            @if (pendingUsers.length === 0) {
              <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-user-check"></i></div>
                <p class="empty-title">All caught up!</p>
                <p class="empty-sub">No members waiting for approval.</p>
              </div>
            } @else {
              <div class="members-grid">
                @for (user of pendingUsers; track user._id) {
                  <div class="member-card pending-card">
                    <div class="member-avatar">{{ getInitials(user.name) }}</div>
                    <div class="member-info">
                      <div class="member-name">
                        {{ user.name }}
                        @if (user.isJoinRequest) {
                          <span class="join-request-tag" title="Existing member of another club requesting to join">
                            <i class="fas fa-right-to-bracket"></i> Joining from another club
                          </span>
                        }
                      </div>
                      <div class="member-email"><i class="fas fa-envelope"></i> {{ user.email }}</div>
                      @if (user.contactNumber) {
                        <div class="member-meta"><i class="fas fa-phone"></i> {{ user.contactNumber }}</div>
                      }
                      @if (user.isJoinRequest) {
                        <div class="member-meta"><i class="fas fa-calendar-alt"></i> Requested {{ (user.membershipJoinedAt || user.createdAt) | date:'MMM d, yyyy' }}</div>
                      } @else {
                        <div class="member-meta"><i class="fas fa-calendar-alt"></i> Registered {{ user.createdAt | date:'MMM d, yyyy' }}</div>
                      }
                    </div>
                    <div class="member-actions">
                      <button class="action-btn btn-approve" (click)="approve(user)" [disabled]="processing === user._id" title="Approve member">
                        @if (processing === user._id) {
                          <i class="fas fa-circle-notch fa-spin"></i>
                        } @else {
                          <i class="fas fa-check"></i>
                        }
                        <span>Approve</span>
                      </button>
                      <button class="action-btn btn-reject" (click)="reject(user)" [disabled]="processing === user._id" title="Reject member">
                        <i class="fas fa-times"></i>
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

          } @else {

            <!-- Search -->
            <div class="search-bar">
              <i class="fas fa-search search-icon"></i>
              <input type="text" placeholder="Search by name or email..." [(ngModel)]="searchQuery" (ngModelChange)="applySearch()" />
            </div>

            @if (filteredUsers.length === 0) {
              <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-search"></i></div>
                <p class="empty-title">No results</p>
                <p class="empty-sub">No members match "{{ searchQuery }}"</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="members-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Contact</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Registered</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (user of filteredUsers; track user._id) {
                      <tr>
                        <td>
                          <div class="table-member">
                            <div class="table-avatar">
                              @if (user.profileImage) {
                                <img [src]="user.profileImage" [alt]="user.name" class="avatar-img" />
                              } @else {
                                {{ getInitials(user.name) }}
                              }
                            </div>
                            <div>
                              <div class="table-name">{{ user.name }}</div>
                              <div class="table-email">{{ user.email }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="col-contact">{{ user.contactNumber || '—' }}</td>
                        <td><span class="role-badge role-{{ user.role }}">{{ user.role }}</span></td>
                        <td><span class="status-badge status-{{ user.status }}">{{ user.status }}</span></td>
                        <td class="col-date">{{ user.createdAt | date:'MMM d, yyyy' }}</td>
                        <td class="col-actions">
                          @if (user.role === 'player' && user.status === 'active') {
                            <button class="action-btn btn-deactivate" (click)="deactivate(user)" [disabled]="processing === user._id">
                              @if (processing === user._id) {
                                <i class="fas fa-circle-notch fa-spin"></i>
                              } @else {
                                <i class="fas fa-ban"></i>
                              }
                              <span>Deactivate</span>
                            </button>
                          } @else if (user.role === 'player' && user.status === 'deactivated') {
                            <button class="action-btn btn-reactivate" (click)="reactivate(user)" [disabled]="processing === user._id">
                              @if (processing === user._id) {
                                <i class="fas fa-circle-notch fa-spin"></i>
                              } @else {
                                <i class="fas fa-check-circle"></i>
                              }
                              <span>Reactivate</span>
                            </button>
                          } @else {
                            <span class="col-no-action">—</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="table-footer">{{ filteredUsers.length }} of {{ allUsers.length }} members</div>
            }

          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .page-wrap {
      display: block;
      min-height: calc(100vh - 60px);
      padding: 1.5rem;
      background: var(--dm-bg);
    }
    .page-card {
      background: var(--dm-surface);
      border: 1px solid rgba(163,230,53,0.12);
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.32);
      max-width: 1080px;
      margin: 0 auto;
      overflow: hidden;
    }

    /* Header */
    .card-header {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--dm-header);
    }
    .back-btn {
      background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.24);
      color: var(--dm-accent); font-size: 0.875rem; cursor: pointer; padding: 7px 14px;
      border-radius: 8px; transition: background 0.15s; white-space: nowrap; font-family: inherit;
    }
    .back-btn:hover { background: rgba(163,230,53,0.2); }
    .header-center { flex: 1; }
    .header-center h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #ffffff; }
    .header-stats { display: flex; gap: 10px; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      background: rgba(163,230,53,0.08); border: 1px solid rgba(163,230,53,0.18);
      border-radius: 10px; padding: 6px 14px; min-width: 56px;
    }
    .stat-pill-amber { background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.28); }
    .stat-pill-green { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.22); }
    .stat-num { font-size: 1.1rem; font-weight: 800; color: #ffffff; line-height: 1; }
    .stat-lbl { font-size: 0.65rem; color: rgba(255,255,255,0.58); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }

    /* Tabs */
    .tab-bar { display: flex; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 24px; background: rgba(255,255,255,0.02); }
    .tab-btn {
      background: none; border: none; padding: 14px 20px; font-size: 0.875rem;
      font-weight: 600; color: rgba(255,255,255,0.58); cursor: pointer; display: flex; align-items: center;
      gap: 7px; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s;
      font-family: inherit;
    }
    .tab-btn i { font-size: 0.85rem; }
    .tab-btn:hover { color: var(--dm-accent); }
    .tab-btn.active { color: var(--dm-accent); border-bottom-color: var(--dm-accent); }
    .tab-badge {
      background: rgba(163,230,53,0.16); color: var(--dm-accent); font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }

    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 48px; color: rgba(255,255,255,0.6); font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 10px; }

    /* Empty state */
    .empty-state { text-align: center; padding: 56px 20px; }
    .empty-icon { font-size: 3rem; margin-bottom: 12px; }
    .empty-icon i { color: rgba(163,230,53,0.35); }
    .empty-title { font-size: 1.1rem; font-weight: 700; color: #ffffff; margin: 0 0 4px; }
    .empty-sub { font-size: 0.875rem; color: rgba(255,255,255,0.6); margin: 0; }

    /* Pending member cards */
    .members-grid { display: flex; flex-direction: column; gap: 12px; }
    .member-card {
      display: flex; align-items: center; gap: 16px; padding: 16px 20px;
      border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);
      transition: box-shadow 0.15s;
    }
    .member-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
    .pending-card { border-left: 4px solid #f59e0b; background: rgba(245,158,11,0.08); }
    .join-request-tag {
      display: inline-flex; align-items: center; gap: 4px;
      margin-left: 8px; padding: 2px 8px; border-radius: 999px;
      font-size: 0.68rem; font-weight: 700;
      color: #60a5fa; border: 1px solid rgba(96,165,250,0.4); background: rgba(96,165,250,0.1);
    }
    .member-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(163,230,53,0.12); border: 2px solid rgba(163,230,53,0.24);
      color: var(--dm-accent); font-size: 1rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .member-info { flex: 1; min-width: 0; }
    .member-name { font-size: 0.95rem; font-weight: 700; color: #ffffff; }
    .member-email { font-size: 0.8rem; color: var(--dm-accent); margin-top: 3px; display: flex; align-items: center; gap: 5px; }
    .member-meta { font-size: 0.78rem; color: rgba(255,255,255,0.58); margin-top: 3px; display: flex; align-items: center; gap: 5px; }
    .member-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .action-btn {
      display: flex; align-items: center; gap: 6px; padding: 8px 16px;
      border: 1px solid transparent; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; transition: all 0.15s; font-family: inherit;
    }
    .btn-approve { background: rgba(163,230,53,0.16); border-color: rgba(163,230,53,0.28); color: var(--dm-accent); }
    .btn-approve:hover:not(:disabled) { background: rgba(163,230,53,0.24); border-color: rgba(163,230,53,0.38); }
    .btn-reject { background: rgba(255,255,255,0.02); color: #fb7185; border-color: rgba(251,113,133,0.3); }
    .btn-reject:hover:not(:disabled) { background: rgba(251,113,133,0.1); }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Search */
    .search-bar { position: relative; margin-bottom: 18px; }
    .search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #aaa; font-size: 0.85rem; }
    .search-bar input {
      width: 100%; padding: 9px 12px 9px 36px; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; font-size: 0.875rem; box-sizing: border-box; font-family: inherit; background: rgba(255,255,255,0.04); color: #ffffff;
    }
    .search-bar input::placeholder { color: rgba(255,255,255,0.45); }
    .search-bar input:focus { outline: none; border-color: rgba(163,230,53,0.28); box-shadow: 0 0 0 3px rgba(163,230,53,0.12); }

    /* Table */
    .table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); }
    .members-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .members-table th {
      background: rgba(255,255,255,0.04); padding: 11px 14px; text-align: left;
      font-size: 0.73rem; font-weight: 700; color: rgba(255,255,255,0.62);
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(184,137,66,0.15);
    }
    .members-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #ffffff; }
    .members-table tbody tr:last-child td { border-bottom: none; }
    .members-table tbody tr:hover { background: rgba(255,255,255,0.03); }

    .table-member { display: flex; align-items: center; gap: 12px; }
    .table-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(163,230,53,0.12); border: 1.5px solid rgba(163,230,53,0.24);
      color: var(--dm-accent); font-size: 0.78rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .table-name { font-weight: 600; color: #ffffff; font-size: 0.875rem; }
    .table-email { font-size: 0.75rem; color: rgba(255,255,255,0.56); margin-top: 1px; }
    .col-contact { color: rgba(255,255,255,0.72); font-size: 0.82rem; }
    .col-date { color: rgba(255,255,255,0.62); font-size: 0.8rem; white-space: nowrap; }

    .role-badge, .status-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .role-admin { background: rgba(59,130,246,0.16); color: #93c5fd; }
    .role-superadmin { background: rgba(139,92,246,0.16); color: #c4b5fd; }
    .role-player { background: rgba(163,230,53,0.12); color: var(--dm-accent); }
    .status-active { background: rgba(34,197,94,0.12); color: #86efac; }
    .status-pending { background: rgba(245,158,11,0.16); color: #fcd34d; }
    .status-rejected { background: rgba(239,68,68,0.14); color: #fca5a5; }
    .status-deactivated { background: rgba(100,116,139,0.18); color: #94a3b8; }

    .col-actions { white-space: nowrap; }
    .col-no-action { color: rgba(255,255,255,0.3); font-size: 0.85rem; }
    .btn-deactivate { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.28); color: #fca5a5; font-size: 0.78rem; padding: 6px 12px; }
    .btn-deactivate:hover:not(:disabled) { background: rgba(239,68,68,0.18); }
    .btn-reactivate { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.28); color: #86efac; font-size: 0.78rem; padding: 6px 12px; }
    .btn-reactivate:hover:not(:disabled) { background: rgba(34,197,94,0.18); }

    .table-footer {
      text-align: right; font-size: 0.78rem; color: rgba(255,255,255,0.55);
      padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.06);
    }

    @media (max-width: 640px) {
      .card-header { flex-direction: column; align-items: flex-start; }
      .header-stats { width: 100%; }
      .member-card { flex-direction: column; align-items: flex-start; }
      .member-actions { width: 100%; }
      .action-btn { flex: 1; justify-content: center; }
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  activeTab: 'pending' | 'all' = 'pending';
  pendingUsers: User[] = [];
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  loading = true;
  processing: string | null = null;
  searchQuery = '';

  get activeCount() {
    return this.allUsers.filter(u => u.status === 'active').length;
  }

  constructor(
    private usersService: UsersService,
    private membershipService: MembershipService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    forkJoin({
      pending: this.usersService.getPendingUsers(),
      all: this.usersService.getAllUsers(),
    }).subscribe({
      next: ({ pending, all }) => {
        this.pendingUsers = pending;
        this.allUsers = all;
        this.filteredUsers = all;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applySearch() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredUsers = q
      ? this.allUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : this.allUsers;
  }

  getInitials(name: string): string {
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  // Join requests from members of other clubs are approved/rejected on their
  // ClubMembership doc; home-club registrations use the legacy user endpoints.
  approve(user: User) {
    this.processing = user._id;
    const req: Observable<unknown> = user.membershipId
      ? this.membershipService.approveMembership(user.membershipId)
      : this.usersService.approveUser(user._id);
    req.subscribe({
      next: () => { this.processing = null; this.loadData(); },
      error: () => { this.processing = null; this.cdr.detectChanges(); },
    });
  }

  reject(user: User) {
    this.processing = user._id;
    const req: Observable<unknown> = user.membershipId
      ? this.membershipService.rejectMembership(user.membershipId)
      : this.usersService.rejectUser(user._id);
    req.subscribe({
      next: () => { this.processing = null; this.loadData(); },
      error: () => { this.processing = null; this.cdr.detectChanges(); },
    });
  }

  deactivate(user: User) {
    this.processing = user._id;
    this.usersService.deactivateUser(user._id).subscribe({
      next: () => { this.processing = null; this.loadData(); },
      error: () => { this.processing = null; this.cdr.detectChanges(); },
    });
  }

  reactivate(user: User) {
    this.processing = user._id;
    this.usersService.reactivateUser(user._id).subscribe({
      next: () => { this.processing = null; this.loadData(); },
      error: () => { this.processing = null; this.cdr.detectChanges(); },
    });
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}


