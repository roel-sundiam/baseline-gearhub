import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DuprLinkState {
  duprPlayerId: string;
  fullName: string | null;
  doubles: number | null;
  singles: number | null;
  entitlements: string[];
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
  subscriptions?: Array<{ status: string; displayName: string; entitlements?: Record<string, string[]> }>;
}

export type DuprSubmissionStatus = 'pending_submission' | 'submitted' | 'accepted' | 'rejected' | 'disputed' | 'failed';

export interface DuprMatchSubmission {
  _id: string;
  sourceMatchId: string;
  status: DuprSubmissionStatus;
  lastError: string | null;
  attempts: number;
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

  getSubmissionsForSession(sessionId: string) {
    return this.http.get<DuprMatchSubmission[]>(`${environment.apiUrl}/dupr/submissions`, { params: { sessionId } });
  }

  resubmit(submissionId: string) {
    return this.http.post(`${environment.apiUrl}/dupr/submissions/${submissionId}/resubmit`, {});
  }

  dispute(submissionId: string, reason: string) {
    return this.http.post<DuprMatchSubmission>(`${environment.apiUrl}/dupr/submissions/${submissionId}/dispute`, { reason });
  }

  resolve(submissionId: string, team1Score?: number, team2Score?: number) {
    return this.http.post(`${environment.apiUrl}/dupr/submissions/${submissionId}/resolve`, { team1Score, team2Score });
  }
}
