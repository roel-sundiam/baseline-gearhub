import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DuprLinkState {
  duprPlayerId: string;
  fullName: string | null;
  doubles: number | null;
  singles: number | null;
  linkedAt: string | null;
  lastSyncedAt: string | null;
}

export interface DuprStatus {
  configured: boolean;
  clubEnabled: boolean;
  myLink: DuprLinkState | null;
}

export interface DuprSsoCallbackPayload {
  userToken: string;
  refreshToken: string;
  id: string;
  duprId: string;
  stats?: { fullName?: string; email?: string; doubles?: number; singles?: number };
}

@Injectable({ providedIn: 'root' })
export class DuprService {
  constructor(private http: HttpClient) {}

  getStatus() {
    return this.http.get<DuprStatus>(`${environment.apiUrl}/dupr/status`);
  }

  getSsoConfig() {
    return this.http.get<{ iframeUrl: string }>(`${environment.apiUrl}/dupr/sso-config`);
  }

  submitSsoCallback(payload: DuprSsoCallbackPayload) {
    return this.http.post<{ myLink: DuprLinkState }>(`${environment.apiUrl}/dupr/link/sso-callback`, payload);
  }

  unlink() {
    return this.http.delete<{ ok: boolean }>(`${environment.apiUrl}/dupr/link`);
  }
}
