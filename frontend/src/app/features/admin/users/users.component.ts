import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UsersService, User } from '../../../core/services/users.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
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
                      <div class="member-name">{{ user.name }}</div>
                      <div class="member-email"><i class="fas fa-envelope"></i> {{ user.email }}</div>
                      @if (user.contactNumber) {
                        <div class="member-meta"><i class="fas fa-phone"></i> {{ user.contactNumber }}</div>
                      }
                      <div class="member-meta"><i class="fas fa-calendar-alt"></i> Registered {{ user.createdAt | date:'MMM d, yyyy' }}</div>
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
    .page-wrap {
      position: relative; min-height: 100vh; padding: 20px;
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
    }
    .court-bg {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: url('/tennis-court-surface.png') center/cover no-repeat; z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); }
    .page-card {
      position: relative; z-index: 1; background: white; border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18); max-width: 960px; margin: 0 auto; overflow: hidden;
    }

    /* Header */
    .card-header {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 18px 24px; border-bottom: 1px solid #eee;
      background: linear-gradient(135deg, #9f7338 0%, #3d7a2a 100%);
    }
    .back-btn {
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
      color: white; font-size: 0.875rem; cursor: pointer; padding: 7px 14px;
      border-radius: 8px; transition: background 0.15s; white-space: nowrap;
    }
    .back-btn:hover { background: rgba(255,255,255,0.25); }
    .header-center { flex: 1; }
    .header-center h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #fff; }
    .header-stats { display: flex; gap: 10px; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      background: rgba(255,255,255,0.15); border-radius: 10px;
      padding: 6px 14px; min-width: 56px;
    }
    .stat-pill-amber { background: rgba(245,158,11,0.35); }
    .stat-pill-green { background: rgba(201,161,93,0.25); }
    .stat-num { font-size: 1.1rem; font-weight: 800; color: #fff; line-height: 1; }
    .stat-lbl { font-size: 0.65rem; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }

    /* Tabs */
    .tab-bar { display: flex; border-bottom: 2px solid #e9ecef; padding: 0 24px; background: #fafafa; }
    .tab-btn {
      background: none; border: none; padding: 14px 20px; font-size: 0.875rem;
      font-weight: 600; color: #888; cursor: pointer; display: flex; align-items: center;
      gap: 7px; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s;
    }
    .tab-btn i { font-size: 0.85rem; }
    .tab-btn:hover { color: #9f7338; }
    .tab-btn.active { color: #9f7338; border-bottom-color: #9f7338; }
    .tab-badge {
      background: #f59e0b; color: #fff; font-size: 0.7rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }

    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 48px; color: #999; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 10px; }

    /* Empty state */
    .empty-state { text-align: center; padding: 56px 20px; }
    .empty-icon { font-size: 3rem; color: #f4ead6; margin-bottom: 12px; }
    .empty-icon i { color: #e6d2ad; }
    .empty-title { font-size: 1.1rem; font-weight: 700; color: #1a1a1a; margin: 0 0 4px; }
    .empty-sub { font-size: 0.875rem; color: #999; margin: 0; }

    /* Pending member cards */
    .members-grid { display: flex; flex-direction: column; gap: 12px; }
    .member-card {
      display: flex; align-items: center; gap: 16px; padding: 16px 20px;
      border-radius: 12px; border: 1px solid #e9ecef; background: white;
      transition: box-shadow 0.15s;
    }
    .member-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .pending-card { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .member-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: linear-gradient(135deg, #9f7338, #c9a15d);
      color: white; font-size: 1rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .member-info { flex: 1; min-width: 0; }
    .member-name { font-size: 0.95rem; font-weight: 700; color: #1a1a1a; }
    .member-email { font-size: 0.8rem; color: #9f7338; margin-top: 3px; display: flex; align-items: center; gap: 5px; }
    .member-meta { font-size: 0.78rem; color: #666; margin-top: 3px; display: flex; align-items: center; gap: 5px; }
    .member-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .action-btn {
      display: flex; align-items: center; gap: 6px; padding: 8px 16px;
      border: none; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-approve { background: #9f7338; color: white; }
    .btn-approve:hover:not(:disabled) { background: #245516; }
    .btn-reject { background: white; color: #ef4444; border: 1px solid #ef4444; }
    .btn-reject:hover:not(:disabled) { background: #ef4444; color: white; }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Search */
    .search-bar {
      position: relative; margin-bottom: 18px;
    }
    .search-icon {
      position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
      color: #aaa; font-size: 0.85rem;
    }
    .search-bar input {
      width: 100%; padding: 9px 12px 9px 36px; border: 1px solid #ddd;
      border-radius: 8px; font-size: 0.875rem; box-sizing: border-box;
    }
    .search-bar input:focus { outline: none; border-color: #9f7338; box-shadow: 0 0 0 3px rgba(159,115,56,0.1); }

    /* Table */
    .table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #e9ecef; }
    .members-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .members-table th {
      background: #f8faf8; padding: 11px 14px; text-align: left;
      font-size: 0.73rem; font-weight: 700; color: #555;
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e9ecef;
    }
    .members-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; }
    .members-table tbody tr:last-child td { border-bottom: none; }
    .members-table tbody tr:hover { background: #f9fdf9; }

    .table-member { display: flex; align-items: center; gap: 12px; }
    .table-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #9f7338, #c9a15d);
      color: white; font-size: 0.78rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .table-name { font-weight: 600; color: #1a1a1a; font-size: 0.875rem; }
    .table-email { font-size: 0.75rem; color: #888; margin-top: 1px; }
    .col-contact { color: #555; font-size: 0.82rem; }
    .col-date { color: #777; font-size: 0.8rem; white-space: nowrap; }

    .role-badge, .status-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
    }
    .role-admin { background: #dbeafe; color: #1e40af; }
    .role-superadmin { background: #ede9fe; color: #5b21b6; }
    .role-player { background: #f4ead6; color: #7a5626; }
    .status-active { background: #f4ead6; color: #7a5626; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-rejected { background: #fee2e2; color: #991b1b; }

    .table-footer {
      text-align: right; font-size: 0.78rem; color: #999;
      padding: 10px 14px; border-top: 1px solid #f0f0f0;
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

  approve(user: User) {
    this.processing = user._id;
    this.usersService.approveUser(user._id).subscribe({
      next: () => { this.processing = null; this.loadData(); },
      error: () => { this.processing = null; this.cdr.detectChanges(); },
    });
  }

  reject(user: User) {
    this.processing = user._id;
    this.usersService.rejectUser(user._id).subscribe({
      next: () => { this.processing = null; this.loadData(); },
      error: () => { this.processing = null; this.cdr.detectChanges(); },
    });
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}


