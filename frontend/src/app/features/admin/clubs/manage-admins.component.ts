import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { ClubService, Club } from '../../../core/services/club.service';

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
  selector: 'app-manage-admins',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <h2>Club Admins</h2>
      <button class="btn-primary" (click)="showForm = !showForm">
        <i class="fas fa-plus"></i> Create Admin
      </button>
    </div>

    <!-- Create Admin Form -->
    @if (showForm) {
      <div class="form-card">
        <h3>New Club Admin</h3>
        @if (formError) { <div class="alert alert-error">{{ formError }}</div> }
        @if (formSuccess) { <div class="alert alert-success">{{ formSuccess }}</div> }

        <form (ngSubmit)="onCreate()" #f="ngForm">
          <div class="form-row">
            <div class="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                [(ngModel)]="form.name"
                name="name"
                required
                placeholder="Jane Smith"
                (ngModelChange)="onNameChange($event)"
              />
            </div>
            <div class="form-group">
              <label>Username *</label>
              <input
                type="text"
                [(ngModel)]="form.username"
                name="username"
                required
                placeholder="roel-sundiam"
                (ngModelChange)="onUsernameChange()"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Password *</label>
              <input
                type="password"
                [(ngModel)]="form.password"
                name="password"
                required
                minlength="6"
                placeholder="BaselineGearhub"
              />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="form.email" name="email" placeholder="jane@example.com" />
            </div>
          </div>
          <div class="form-group">
            <label>Assign to Club *</label>
            <select [(ngModel)]="form.clubId" name="clubId" required>
              <option value="" disabled>Select a club</option>
              @for (club of clubs; track club._id) {
                <option [value]="club._id">{{ club.name }}</option>
              }
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" [disabled]="creating || f.invalid">
              {{ creating ? 'Creating…' : 'Create Admin' }}
            </button>
            <button type="button" class="btn-cancel" (click)="cancelForm()">Cancel</button>
          </div>
        </form>
      </div>
    }

    <!-- Filter by Club -->
    <div class="filter-bar">
      <label>Filter by club:</label>
      <select [(ngModel)]="filterClubId" (ngModelChange)="loadAdmins()">
        <option value="">All Clubs</option>
        @for (club of clubs; track club._id) {
          <option [value]="club._id">{{ club.name }}</option>
        }
      </select>
    </div>

    <!-- Admin List -->
    @if (loading) {
      <div class="loading">Loading...</div>
    } @else if (admins.length === 0) {
      <div class="empty-state">No admin accounts found.</div>
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Club</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (user of admins; track user._id) {
              <tr>
                <td>{{ user.name }}</td>
                <td><code>{{ user.username }}</code></td>
                <td>{{ getClubName(user.clubId) }}</td>
                <td><span class="badge" [class.badge-super]="user.role === 'superadmin'">{{ user.role }}</span></td>
                <td><span class="badge badge-active">{{ user.status }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h2 { margin: 0; }
    .btn-primary {
      background: #9f7338; color: white; border: none; padding: 0.5rem 1rem;
      border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem;
    }
    .btn-primary:hover:not(:disabled) { background: #7d5a2a; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .btn-cancel {
      background: none; color: #6b7280; border: 1px solid #d1d5db;
      padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;
    }
    .btn-cancel:hover { background: #f3f4f6; }
    .form-card {
      background: white; border-radius: 8px; padding: 1.5rem;
      box-shadow: 0 1px 6px rgba(0,0,0,0.08); margin-bottom: 1.5rem;
    }
    .form-card h3 { margin: 0 0 1rem; font-size: 1rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.3rem; }
    .form-group input, .form-group select {
      width: 100%; padding: 0.5rem 0.7rem; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;
    }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #9f7338; }
    .form-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
    .alert-error { background: #fef2f2; color: #dc2626; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
    .alert-success { background: #f0fdf4; color: #16a34a; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
    .filter-bar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; }
    .filter-bar select { padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; }
    .loading, .empty-state { text-align: center; padding: 2rem; color: #6b7280; }
    .table-wrap { background: white; border-radius: 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.08); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; padding: 0.75rem 1rem; text-align: left; font-size: 0.8rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 0.75rem 1rem; border-top: 1px solid #f3f4f6; font-size: 0.9rem; }
    code { background: #f3f4f6; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.82rem; }
    .badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: #e5e7eb; color: #374151; }
    .badge-super { background: #fef3c7; color: #92400e; }
    .badge-active { background: #d1fae5; color: #065f46; }
    @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
  `],
})
export class ManageAdminsComponent implements OnInit {
  private readonly DEFAULT_ADMIN_PASSWORD = 'BaselineGearhub';
  private usernameManuallyEdited = false;

  admins: AdminUser[] = [];
  clubs: Club[] = [];
  loading = true;
  showForm = false;
  creating = false;
  formError = '';
  formSuccess = '';
  filterClubId = '';

  form = { name: '', username: '', password: this.DEFAULT_ADMIN_PASSWORD, email: '', clubId: '' };

  constructor(
    private usersService: UsersService,
    private clubService: ClubService,
  ) {}

  ngOnInit() {
    this.clubService.getClubs().subscribe({ next: (clubs) => { this.clubs = clubs; } });
    this.loadAdmins();
  }

  loadAdmins() {
    this.loading = true;
    this.usersService.getAdmins(this.filterClubId || undefined).subscribe({
      next: (admins) => { this.admins = admins; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  onCreate() {
    this.creating = true;
    this.formError = '';
    this.formSuccess = '';
    this.usersService.createAdmin({
      name: this.form.name,
      username: this.form.username,
      password: this.form.password,
      clubId: this.form.clubId,
      email: this.form.email || undefined,
    }).subscribe({
      next: () => {
        this.creating = false;
        this.formSuccess = `Admin "${this.form.username}" created successfully.`;
        this.usernameManuallyEdited = false;
        this.form = { name: '', username: '', password: this.DEFAULT_ADMIN_PASSWORD, email: '', clubId: '' };
        this.loadAdmins();
      },
      error: (err) => {
        this.creating = false;
        this.formError = err?.error?.error || 'Failed to create admin.';
      },
    });
  }

  cancelForm() {
    this.showForm = false;
    this.formError = '';
    this.formSuccess = '';
    this.usernameManuallyEdited = false;
    this.form = { name: '', username: '', password: this.DEFAULT_ADMIN_PASSWORD, email: '', clubId: '' };
  }

  onNameChange(name: string) {
    if (this.usernameManuallyEdited) return;
    this.form.username = this.generateUsername(name);
  }

  onUsernameChange() {
    this.usernameManuallyEdited = true;
  }

  private generateUsername(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  getClubName(clubId: any): string {
    if (!clubId) return '—';
    if (typeof clubId === 'object' && clubId.name) return clubId.name;
    const found = this.clubs.find(c => c._id === clubId);
    return found?.name ?? '—';
  }
}
