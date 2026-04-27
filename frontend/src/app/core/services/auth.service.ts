import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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

  private _user = signal<AuthUser | null>(this.loadUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly isAdmin = computed(
    () => this._user()?.role === 'admin' || this._user()?.role === 'superadmin',
  );
  readonly isSuperAdmin = computed(() => this._user()?.role === 'superadmin');

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

  login(username: string, password: string) {
    return this.http
      .post<{
        token: string;
        user: AuthUser;
      }>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          this._user.set(res.user);
        }),
      );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
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
