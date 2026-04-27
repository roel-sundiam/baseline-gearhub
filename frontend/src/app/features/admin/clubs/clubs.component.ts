import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClubService, Club } from '../../../core/services/club.service';
import { UsersService } from '../../../core/services/users.service';

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
              </div>

              <div class="club-actions">
                <button
                  type="button"
                  class="btn-admin"
                  (click)="$event.stopPropagation(); selectClub(club)"
                >
                  <i class="fas fa-user-cog"></i>
                  Admins
                </button>
                <a
                  [routerLink]="['/admin/clubs', club._id, 'edit']"
                  class="btn-outline"
                  (click)="$event.stopPropagation()"
                >
                  <i class="fas fa-pen"></i>
                  Edit
                </a>
                <button
                  type="button"
                  class="btn-danger"
                  (click)="$event.stopPropagation(); deleteClub(club)"
                >
                  <i class="fas fa-trash"></i>
                  Delete
                </button>
              </div>
            </article>
          }
        </section>

        @if (selectedClub) {
          <section class="admin-module">
            <header class="admin-module-header">
              <div>
                <p class="hero-kicker">Admin Module</p>
                <h3>{{ selectedClub.name }} Admins</h3>
                <p>View existing admins and add a new admin for this club.</p>
              </div>
              <button type="button" class="btn-create" (click)="showAdminForm = !showAdminForm">
                <i class="fas" [class.fa-plus]="!showAdminForm" [class.fa-times]="showAdminForm"></i>
                {{ showAdminForm ? 'Close Form' : 'Add Club Admin' }}
              </button>
            </header>

            @if (showAdminForm) {
              <section class="admin-form-card">
                @if (adminFormError) {
                  <div class="form-alert error">{{ adminFormError }}</div>
                }
                @if (adminFormSuccess) {
                  <div class="form-alert success">{{ adminFormSuccess }}</div>
                }

                <form (ngSubmit)="createClubAdmin()" #adminFormRef="ngForm">
                  <div class="admin-form-grid">
                    <label>
                      Full Name
                      <input
                        type="text"
                        [(ngModel)]="adminForm.name"
                        name="name"
                        required
                        (ngModelChange)="onAdminNameChange($event)"
                      />
                    </label>

                    <label>
                      Username
                      <input
                        type="text"
                        [(ngModel)]="adminForm.username"
                        name="username"
                        required
                        (ngModelChange)="onAdminUsernameChange()"
                      />
                    </label>

                    <label>
                      Password
                      <input
                        type="password"
                        [(ngModel)]="adminForm.password"
                        name="password"
                        required
                        minlength="6"
                      />
                    </label>

                    <label>
                      Email (optional)
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
                        @if (admin.email) {
                          <p>{{ admin.email }}</p>
                        }
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
          </section>
        }
      }
    </section>
  `,
  styles: [`
    :host {
      --ink: #102226;
      --teal-700: #16636f;
      --teal-600: #1d7b87;
      --teal-100: #dcf3f6;
      --sand: #f6f2e8;
      --card-bg: rgba(255, 255, 255, 0.94);
      --line: rgba(16, 34, 38, 0.11);
      --danger: #b22e2e;
      display: block;
      font-family: 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif;
    }

    .clubs-page {
      display: grid;
      gap: 1rem;
    }

    .hero-panel {
      background:
        radial-gradient(circle at top right, rgba(242, 183, 75, 0.34), transparent 42%),
        linear-gradient(140deg, var(--sand), #ffffff);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      box-shadow: 0 10px 30px rgba(7, 24, 28, 0.12);
    }

    .hero-kicker {
      margin: 0 0 0.2rem;
      color: var(--teal-700);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.74rem;
      font-weight: 800;
    }

    .hero-panel h2 {
      margin: 0;
      color: var(--ink);
      font-size: 1.45rem;
      letter-spacing: -0.02em;
    }

    .hero-subtitle {
      margin: 0.35rem 0 0;
      color: rgba(16, 34, 38, 0.72);
      font-size: 0.92rem;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .count-chip {
      background: var(--teal-100);
      color: var(--teal-700);
      border: 1px solid rgba(22, 99, 111, 0.18);
      border-radius: 999px;
      padding: 0.42rem 0.78rem;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
    }

    .btn-create,
    .btn-outline,
    .btn-danger {
      border-radius: 10px;
      padding: 0.56rem 0.9rem;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.86rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.38rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      border: 1px solid transparent;
      white-space: nowrap;
      font-family: inherit;
    }

    .btn-create {
      background: linear-gradient(145deg, var(--teal-600), #155860);
      color: #ffffff;
      box-shadow: 0 8px 16px rgba(21, 88, 96, 0.26);
    }

    .btn-create:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(21, 88, 96, 0.32);
    }

    .state-card {
      background: var(--card-bg);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 1rem;
      box-shadow: 0 8px 24px rgba(12, 22, 25, 0.1);
    }

    .state-empty,
    .state-error {
      text-align: center;
      padding: 2rem 1rem;
      display: grid;
      justify-items: center;
      gap: 0.55rem;
      color: var(--ink);
    }

    .state-empty i,
    .state-error i {
      font-size: 1.6rem;
    }

    .state-empty h3 {
      margin: 0;
      font-size: 1.16rem;
    }

    .state-empty p,
    .state-error p {
      margin: 0;
      color: rgba(16, 34, 38, 0.74);
    }

    .state-error i,
    .state-error p {
      color: var(--danger);
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.8rem;
    }

    .skeleton-item {
      height: 145px;
      border-radius: 14px;
      background: linear-gradient(110deg, #ecf2f4 8%, #f7fbfc 18%, #ecf2f4 33%);
      background-size: 200% 100%;
      animation: shimmer 1.1s linear infinite;
      border: 1px solid rgba(16, 34, 38, 0.06);
    }

    .clubs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 0.9rem;
    }

    .club-card {
      background: var(--card-bg);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      display: grid;
      gap: 0.9rem;
      padding: 0 0.95rem 0.95rem;
      box-shadow: 0 8px 20px rgba(9, 19, 22, 0.1);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
      cursor: pointer;
    }

    .club-card:focus-visible {
      outline: 2px solid #0f7481;
      outline-offset: 2px;
    }

    .club-card.active {
      border-color: rgba(15, 116, 129, 0.5);
      box-shadow: 0 12px 30px rgba(15, 116, 129, 0.18);
    }

    .club-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 28px rgba(9, 19, 22, 0.14);
    }

    .card-topline {
      height: 5px;
      margin: 0 -0.95rem;
      background: linear-gradient(90deg, #0f7481, #f2b74b);
    }

    .club-head {
      display: flex;
      gap: 0.72rem;
      align-items: center;
    }

    .club-logo,
    .club-logo-placeholder {
      width: 54px;
      height: 54px;
      border-radius: 12px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .club-logo {
      border: 1px solid rgba(16, 34, 38, 0.14);
      background: #ffffff;
    }

    .club-logo-placeholder {
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, #def4f7, #c0e4ea);
      color: #18545d;
      font-weight: 800;
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .club-identity h3 {
      margin: 0;
      color: var(--ink);
      font-size: 1.05rem;
      line-height: 1.2;
    }

    .club-identity p {
      margin: 0.2rem 0 0;
      font-size: 0.73rem;
      color: rgba(16, 34, 38, 0.56);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 170px;
    }

    .club-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .meta-pill {
      background: #f5f9fa;
      border: 1px solid rgba(16, 34, 38, 0.11);
      color: rgba(16, 34, 38, 0.8);
      border-radius: 999px;
      padding: 0.35rem 0.62rem;
      font-size: 0.76rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .coin-pill {
      background: #fffbeb;
      border-color: rgba(245, 158, 11, 0.3);
      color: #92400e;
      font-weight: 700;
    }
    .coin-pill i { color: #f59e0b; }

    .club-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.55rem;
    }

    .btn-admin {
      background: #e9f7fa;
      border: 1px solid rgba(15, 116, 129, 0.35);
      color: #0f5f69;
      border-radius: 10px;
      padding: 0.56rem 0.9rem;
      font-weight: 700;
      font-size: 0.86rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.38rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      font-family: inherit;
      white-space: nowrap;
    }

    .btn-admin:hover {
      background: #dff3f7;
      transform: translateY(-1px);
      box-shadow: 0 8px 16px rgba(15, 116, 129, 0.18);
    }

    .admin-module {
      background: var(--card-bg);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 0.9rem;
      box-shadow: 0 10px 28px rgba(9, 19, 22, 0.12);
      display: grid;
      gap: 0.8rem;
    }

    .admin-module-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      flex-wrap: wrap;
    }

    .admin-module-header h3 {
      margin: 0;
      color: var(--ink);
      font-size: 1.05rem;
    }

    .admin-module-header p {
      margin: 0.25rem 0 0;
      color: rgba(16, 34, 38, 0.72);
      font-size: 0.85rem;
    }

    .admin-form-card,
    .admin-list-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.92);
    }

    .admin-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
    }

    .admin-form-grid label {
      display: grid;
      gap: 0.3rem;
      color: var(--ink);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .admin-form-grid input {
      border: 1px solid rgba(16, 34, 38, 0.22);
      border-radius: 8px;
      padding: 0.5rem 0.6rem;
      font-size: 0.9rem;
      font-family: inherit;
    }

    .admin-form-grid input:focus {
      outline: 2px solid rgba(15, 116, 129, 0.2);
      border-color: #0f7481;
    }

    .admin-form-actions {
      margin-top: 0.75rem;
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
    }

    .form-alert {
      border-radius: 8px;
      padding: 0.55rem 0.65rem;
      font-size: 0.82rem;
      margin-bottom: 0.55rem;
    }

    .form-alert.error {
      color: #b22e2e;
      background: #fff1f1;
      border: 1px solid rgba(178, 46, 46, 0.25);
    }

    .form-alert.success {
      color: #136b2e;
      background: #f1fdf5;
      border: 1px solid rgba(19, 107, 46, 0.25);
    }

    .admins-state {
      margin: 0;
      color: rgba(16, 34, 38, 0.72);
      font-size: 0.9rem;
    }

    .admins-error {
      color: var(--danger);
    }

    .admin-list-grid {
      display: grid;
      gap: 0.6rem;
    }

    .admin-user-card {
      border: 1px solid rgba(16, 34, 38, 0.14);
      border-radius: 10px;
      padding: 0.6rem;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.6rem;
      background: #ffffff;
    }

    .admin-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d6edf1, #b2dce2);
      color: #18545d;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 0.8rem;
      text-transform: uppercase;
    }

    .admin-user-info h4 {
      margin: 0;
      font-size: 0.9rem;
      color: var(--ink);
    }

    .admin-user-info p {
      margin: 0.1rem 0 0;
      font-size: 0.78rem;
      color: rgba(16, 34, 38, 0.66);
      word-break: break-word;
    }

    .admin-user-meta {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      align-items: flex-end;
    }

    .btn-outline {
      background: #ffffff;
      border-color: rgba(16, 34, 38, 0.2);
      color: var(--ink);
    }

    .btn-outline:hover {
      background: #f2f8f9;
      transform: translateY(-1px);
    }

    .btn-danger {
      background: #fff3f3;
      border-color: rgba(178, 46, 46, 0.35);
      color: var(--danger);
    }

    .btn-danger:hover {
      background: #ffe8e8;
      transform: translateY(-1px);
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
      .clubs-page {
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
        gap: 0.5rem;
      }

      .count-chip,
      .btn-create {
        width: 100%;
        justify-content: center;
      }

      .clubs-grid {
        grid-template-columns: 1fr;
      }

      .club-card {
        padding: 0 0.8rem 0.8rem;
      }

      .card-topline {
        margin: 0 -0.8rem;
      }

      .club-actions {
        grid-template-columns: 1fr;
      }

      .btn-outline,
      .btn-danger,
      .btn-admin {
        width: 100%;
      }

      .admin-form-grid {
        grid-template-columns: 1fr;
      }

      .admin-user-card {
        grid-template-columns: 1fr;
        justify-items: start;
      }

      .admin-user-meta {
        flex-direction: row;
        align-items: center;
      }
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
  adminForm = {
    name: '',
    username: '',
    password: this.DEFAULT_ADMIN_PASSWORD,
    email: '',
  };

  constructor(
    private clubService: ClubService,
    private usersService: UsersService,
  ) {}

  ngOnInit() {
    this.loadClubs();
  }

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
          const stillExists = clubs.find((club) => club._id === this.selectedClub?._id);
          if (!stillExists) {
            this.selectClub(clubs[0]);
          }
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load clubs.';
        this.loading = false;
      },
    });
  }

  deleteClub(club: Club) {
    if (!confirm(`Delete "${club.name}"? This cannot be undone.`)) return;
    this.clubService.deleteClub(club._id).subscribe({
      next: () => this.loadClubs(),
      error: () => alert('Failed to delete club.'),
    });
  }

  selectClub(club: Club) {
    this.selectedClub = club;
    this.showAdminForm = false;
    this.adminFormError = '';
    this.adminFormSuccess = '';
    this.resetAdminForm();
    this.loadClubAdmins();
  }

  loadClubAdmins() {
    if (!this.selectedClub?._id) {
      this.clubAdmins = [];
      return;
    }

    this.adminsLoading = true;
    this.adminsError = '';
    this.usersService.getAdmins(this.selectedClub._id).subscribe({
      next: (admins) => {
        this.clubAdmins = admins.filter((admin) => admin.role === 'admin');
        this.adminsLoading = false;
      },
      error: (err) => {
        this.adminsLoading = false;
        this.adminsError = err?.error?.error || 'Failed to load club admins.';
      },
    });
  }

  createClubAdmin() {
    if (!this.selectedClub?._id) {
      this.adminFormError = 'Please select a club first.';
      return;
    }

    this.creatingAdmin = true;
    this.adminFormError = '';
    this.adminFormSuccess = '';

    this.usersService.createAdmin({
      name: this.adminForm.name,
      username: this.adminForm.username,
      password: this.adminForm.password,
      clubId: this.selectedClub._id,
      email: this.adminForm.email || undefined,
    }).subscribe({
      next: () => {
        this.creatingAdmin = false;
        this.adminFormSuccess = `Admin "${this.adminForm.username}" created successfully.`;
        this.resetAdminForm();
        this.loadClubAdmins();
      },
      error: (err) => {
        this.creatingAdmin = false;
        this.adminFormError = err?.error?.error || 'Failed to create admin.';
      },
    });
  }

  resetAdminForm() {
    this.usernameManuallyEdited = false;
    this.adminForm = {
      name: '',
      username: '',
      password: this.DEFAULT_ADMIN_PASSWORD,
      email: '',
    };
  }

  onAdminNameChange(name: string) {
    if (this.usernameManuallyEdited) return;
    this.adminForm.username = this.generateUsername(name);
  }

  onAdminUsernameChange() {
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

  getInitials(name: string) {
    return name
      .split(' ')
      .filter((part) => part.trim().length > 0)
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('');
  }

  formatDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
