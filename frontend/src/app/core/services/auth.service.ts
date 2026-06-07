import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ClubService } from './club.service';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'player' | 'superadmin';
  profileImage?: string | null;
  clubId?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'pv_tennis_token';
  private readonly USER_KEY = 'pv_tennis_user';
  private readonly BACKUP_TOKEN_KEY = 'pv_tennis_superadmin_backup_token';
  private readonly BACKUP_USER_KEY  = 'pv_tennis_superadmin_backup_user';
  private readonly BACKUP_CLUB_KEY  = 'pv_tennis_superadmin_backup_club';

  private clubService = inject(ClubService);

  private _user = signal<AuthUser | null>(this.loadUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly isAdmin = computed(
    () => this._user()?.role === 'admin' || this._user()?.role === 'superadmin',
  );
  readonly isSuperAdmin = computed(() => this._user()?.role === 'superadmin');

  private _isImpersonating = signal<boolean>(!!localStorage.getItem('pv_tennis_superadmin_backup_token'));
  readonly isImpersonating = this._isImpersonating.asReadonly();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  register(data: {
    name: string;
    username: string;
    email?: string;
    password: string;
    contactNumber?: string;
    gender?: string;
    profileImage?: string;
    clubId: string;
  }) {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/register`, data);
  }

  registerClub(data: {
    clubName: string;
    adminName: string;
    adminUsername: string;
    adminPassword: string;
    location?: string;
    logo?: string;
    email?: string;
    contactNumber?: string;
    description?: string;
    photos?: string[];
  }) {
    return this.http.post<{ message: string; clubId: string; adminId: string }>(
      `${environment.apiUrl}/auth/register-club`,
      data,
    );
  }

  login(username: string, password: string) {
    return this.http
      .post<{
        token: string;
        user: AuthUser;
      }>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap((res) => {
          try {
            localStorage.setItem(this.TOKEN_KEY, res.token);
            localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          } catch {
            // Safari private mode / storage quota exceeded — auth continues in-memory
          }
          this._user.set(res.user);
        }),
      );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.BACKUP_TOKEN_KEY);
    localStorage.removeItem(this.BACKUP_USER_KEY);
    localStorage.removeItem(this.BACKUP_CLUB_KEY);
    this._user.set(null);
    this._isImpersonating.set(false);
    this.router.navigate(['/player-login']);
  }

  impersonate(token: string, user: AuthUser): void {
    try {
      localStorage.setItem(this.BACKUP_TOKEN_KEY, localStorage.getItem(this.TOKEN_KEY) ?? '');
      localStorage.setItem(this.BACKUP_USER_KEY, localStorage.getItem(this.USER_KEY) ?? '');
      localStorage.setItem(this.BACKUP_CLUB_KEY, this.clubService.getSelectedClubId() ?? '');
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch {}
    this._user.set(user);
    this._isImpersonating.set(true);
    if (user.clubId) {
      this.clubService.setSelectedClubId(user.clubId);
    } else {
      this.clubService.clearSelectedClub();
    }
  }

  exitImpersonation(): void {
    try {
      const backupToken = localStorage.getItem(this.BACKUP_TOKEN_KEY);
      const backupUser  = localStorage.getItem(this.BACKUP_USER_KEY);
      const backupClub  = localStorage.getItem(this.BACKUP_CLUB_KEY);
      if (backupToken) localStorage.setItem(this.TOKEN_KEY, backupToken);
      if (backupUser)  localStorage.setItem(this.USER_KEY, backupUser);
      localStorage.removeItem(this.BACKUP_TOKEN_KEY);
      localStorage.removeItem(this.BACKUP_USER_KEY);
      localStorage.removeItem(this.BACKUP_CLUB_KEY);
      this._user.set(backupUser ? JSON.parse(backupUser) : null);
      if (backupClub) {
        this.clubService.setSelectedClubId(backupClub);
      } else {
        this.clubService.clearSelectedClub();
      }
    } catch {}
    this._isImpersonating.set(false);
    this.router.navigate(['/admin/clubs']);
  }

  impersonateUser(userId: string) {
    return this.http
      .post<{ token: string; user: AuthUser }>(`${environment.apiUrl}/auth/impersonate/${userId}`, {})
      .pipe(tap((res) => this.impersonate(res.token, res.user)));
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): AuthUser | null {
    return this._user();
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
