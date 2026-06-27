import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { ClubService, Club } from '../../../core/services/club.service';
import { AdminChatModalComponent } from '../../../shared/components/admin-chat-modal/admin-chat-modal.component';

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
  imports: [CommonModule, FormsModule, RouterLink, AdminChatModalComponent],
  template: `
    <div class="shell">

      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <p class="kicker"><i class="fas fa-user-shield"></i> Superadmin</p>
          <h2 class="title">Club Admins</h2>
          <p class="subtitle">Manage admin accounts and send messages</p>
        </div>
        <button class="btn-create" (click)="showForm = !showForm">
          <i class="fas fa-plus"></i> Create Admin
        </button>
      </div>

      <!-- Create Admin Form -->
      @if (showForm) {
        <div class="form-card">
          <h3 class="form-title">New Club Admin</h3>
          @if (formError) { <div class="alert alert-error"><i class="fas fa-exclamation-triangle"></i> {{ formError }}</div> }
          @if (formSuccess) { <div class="alert alert-success"><i class="fas fa-check-circle"></i> {{ formSuccess }}</div> }

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
                  placeholder="jane-smith"
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
                  placeholder="••••••••"
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
              <button type="submit" class="btn-submit" [disabled]="creating || f.invalid">
                {{ creating ? 'Creating…' : 'Create Admin' }}
              </button>
              <button type="button" class="btn-cancel" (click)="cancelForm()">Cancel</button>
            </div>
          </form>
        </div>
      }

      <!-- Filter bar -->
      <div class="toolbar">
        <label class="filter-label">Filter by club</label>
        <select class="filter-select" [(ngModel)]="filterClubId" (ngModelChange)="loadAdmins()">
          <option value="">All Clubs</option>
          @for (club of clubs; track club._id) {
            <option [value]="club._id">{{ club.name }}</option>
          }
        </select>
      </div>

      <!-- Admin list -->
      @if (loading) {
        <div class="state-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else if (admins.length === 0) {
        <div class="state-empty">
          <i class="fas fa-user-slash state-empty-icon"></i>
          <p>No admin accounts found.</p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="admins-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Club</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (user of admins; track user._id) {
                <tr>
                  <td class="cell-name">{{ user.name }}</td>
                  <td><code class="username-code">{{ user.username }}</code></td>
                  <td class="cell-club">{{ getClubName(user.clubId) }}</td>
                  <td>
                    <span class="badge" [class.badge-super]="user.role === 'superadmin'" [class.badge-admin]="user.role !== 'superadmin'">
                      {{ user.role }}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-active">{{ user.status }}</span>
                  </td>
                  <td class="cell-actions">
                    @if (user.role !== 'superadmin') {
                      <button class="btn-message" (click)="openChat(user)">
                        <i class="fas fa-comment-dots"></i> Message
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

    </div>

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
      --bg: #0c1a11;
      --surface: #1b3028;
      --surface-hover: #213830;
      --border: rgba(255,255,255,0.08);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.5);
      --accent: #a3e635;
    }

    .shell {
      min-height: calc(100vh - 60px);
      background: var(--bg);
      padding: 1.5rem 1rem 4rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.75rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .kicker {
      margin: 0 0 .2rem;
      font-size: .72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--accent);
    }
    .title {
      margin: 0 0 .25rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
    }
    .subtitle {
      margin: 0;
      font-size: .88rem;
      color: var(--muted);
    }
    .btn-create {
      padding: .55rem 1.1rem;
      background: var(--accent);
      color: #0c1a11;
      border: none;
      border-radius: 9px;
      font-weight: 700;
      font-size: .88rem;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      transition: opacity .15s;
      white-space: nowrap;
      align-self: center;
    }
    .btn-create:hover { opacity: .85; }

    /* ── Create Form ── */
    .form-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 1.75rem;
    }
    .form-title {
      margin: 0 0 1.25rem;
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .35rem; }
    .form-group label {
      font-size: .8rem;
      font-weight: 600;
      color: var(--muted);
    }
    .form-group input,
    .form-group select {
      padding: .55rem .8rem;
      background: rgba(255,255,255,.05);
      border: 1px solid var(--border);
      border-radius: 9px;
      color: var(--text);
      font-size: .9rem;
      font-family: inherit;
      outline: none;
      transition: border-color .15s;
      width: 100%;
      box-sizing: border-box;
      color-scheme: dark;
    }
    .form-group input:focus,
    .form-group select:focus { border-color: var(--accent); }
    .form-group select option { background: #1b3028; }
    .form-actions { display: flex; gap: .75rem; margin-top: .25rem; }
    .btn-submit {
      padding: .55rem 1.2rem;
      background: var(--accent);
      color: #0c1a11;
      border: none;
      border-radius: 9px;
      font-weight: 700;
      font-size: .9rem;
      font-family: inherit;
      cursor: pointer;
      transition: opacity .15s;
    }
    .btn-submit:hover:not(:disabled) { opacity: .85; }
    .btn-submit:disabled { opacity: .4; cursor: not-allowed; }
    .btn-cancel {
      padding: .55rem 1.1rem;
      background: rgba(255,255,255,.06);
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 9px;
      font-weight: 600;
      font-size: .9rem;
      font-family: inherit;
      cursor: pointer;
      transition: all .15s;
    }
    .btn-cancel:hover { background: rgba(255,255,255,.1); color: var(--text); }

    .alert {
      padding: .7rem 1rem;
      border-radius: 9px;
      font-size: .86rem;
      display: flex;
      align-items: center;
      gap: .45rem;
      margin-bottom: 1rem;
    }
    .alert-error { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25); color: #fca5a5; }
    .alert-success { background: rgba(163,230,53,.08); border: 1px solid rgba(163,230,53,.2); color: var(--accent); }

    /* ── Toolbar ── */
    .toolbar {
      display: flex;
      align-items: center;
      gap: .75rem;
      margin-bottom: 1.25rem;
    }
    .filter-label {
      font-size: .8rem;
      font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
    }
    .filter-select {
      padding: .45rem .75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 9px;
      color: var(--text);
      font-size: .88rem;
      font-family: inherit;
      outline: none;
      transition: border-color .15s;
      color-scheme: dark;
    }
    .filter-select:focus { border-color: var(--accent); }
    .filter-select option { background: #1b3028; }

    /* ── States ── */
    .state-loading {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: 3rem 0;
      color: var(--muted);
      font-size: .9rem;
    }
    .state-empty {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--muted);
    }
    .state-empty-icon {
      font-size: 2.5rem;
      color: var(--accent);
      opacity: .3;
      display: block;
      margin-bottom: .75rem;
    }
    .state-empty p { font-size: .92rem; margin: 0; }

    /* ── Table ── */
    .table-wrap {
      overflow-x: auto;
      border-radius: 14px;
      border: 1px solid var(--border);
    }
    .admins-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
    .admins-table th {
      background: var(--surface);
      color: var(--accent);
      text-align: left;
      padding: .75rem 1rem;
      font-size: .72rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .admins-table td {
      padding: .75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      vertical-align: middle;
    }
    .admins-table tbody tr:last-child td { border-bottom: none; }
    .admins-table tbody tr { transition: background .12s; }
    .admins-table tbody tr:hover td { background: var(--surface-hover); }

    .cell-name { font-weight: 600; }
    .cell-club { color: var(--muted); font-size: .85rem; }
    .username-code {
      background: rgba(163,230,53,.08);
      color: var(--accent);
      padding: .15rem .5rem;
      border-radius: 6px;
      font-size: .8rem;
      font-family: monospace;
    }
    .cell-actions { display: flex; gap: .4rem; }

    .badge {
      display: inline-block;
      padding: .2rem .65rem;
      border-radius: 8px;
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      white-space: nowrap;
    }
    .badge-super { background: rgba(251,191,36,.12); color: #fcd34d; }
    .badge-admin { background: rgba(163,230,53,.1); color: var(--accent); }
    .badge-active { background: rgba(163,230,53,.1); color: var(--accent); }

    .btn-message {
      padding: .3rem .75rem;
      border: 1px solid rgba(163,230,53,.3);
      border-radius: 7px;
      background: transparent;
      color: var(--accent);
      font-size: .78rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      transition: all .15s;
    }
    .btn-message:hover { background: rgba(163,230,53,.1); border-color: var(--accent); }

    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
      .header { flex-direction: column; align-items: flex-start; }
    }
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
  chatTarget: AdminUser | null = null;

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

  openChat(user: AdminUser) {
    this.chatTarget = user;
  }
}
