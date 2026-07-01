import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type HostedPlayStatus = 'open' | 'full' | 'closed' | 'cancelled';

export interface HostedPlaySession {
  _id: string;
  clubId: string;
  title: string;
  sport: 'tennis' | 'pickleball';
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  court?: string;
  address?: string;
  feePerPlayer: number;
  maxPlayers: number;
  currentPlayers: number;
  status: HostedPlayStatus;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  // Member-facing extras
  joined?: boolean;
  participants?: HostedPlayParticipant[];
  convenienceFeePerPlayer?: number;
  totalPerPlayer?: number;
}

export interface HostedPlayParticipant {
  _id: string;
  hostedPlayId?: string;
  memberId?: string;
  memberName?: string;
  dateJoined?: string;
  createdAt?: string;
  isMe?: boolean;
}

export interface HostedPlayInput {
  title: string;
  sport: 'tennis' | 'pickleball';
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  court?: string;
  address?: string;
  feePerPlayer: number;
  maxPlayers: number;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class HostedPlayService {
  private base = `${environment.apiUrl}/hosted-play`;

  constructor(private http: HttpClient) {}

  // ── Member ──
  listOpen() {
    return this.http.get<HostedPlaySession[]>(`${this.base}/player/sessions`);
  }

  getSession(id: string) {
    return this.http.get<HostedPlaySession>(`${this.base}/player/sessions/${id}`);
  }

  join(id: string) {
    return this.http.post<{ success: boolean; currentPlayers: number; status: HostedPlayStatus }>(
      `${this.base}/player/sessions/${id}/join`, {});
  }

  cancelJoin(id: string) {
    return this.http.delete<{ success: boolean; currentPlayers: number; status: HostedPlayStatus }>(
      `${this.base}/player/sessions/${id}/join`);
  }

  // ── Admin ──
  listAll() {
    return this.http.get<HostedPlaySession[]>(`${this.base}/sessions`);
  }

  create(body: HostedPlayInput) {
    return this.http.post<HostedPlaySession>(`${this.base}/sessions`, body);
  }

  update(id: string, body: Partial<HostedPlayInput>) {
    return this.http.put<HostedPlaySession>(`${this.base}/sessions/${id}`, body);
  }

  setStatus(id: string, status: HostedPlayStatus) {
    return this.http.patch<HostedPlaySession>(`${this.base}/sessions/${id}/status`, { status });
  }

  remove(id: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${id}`);
  }

  getParticipants(id: string) {
    return this.http.get<HostedPlayParticipant[]>(`${this.base}/sessions/${id}/participants`);
  }
}
