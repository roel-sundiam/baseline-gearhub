import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type HostedPlayStatus = 'open' | 'full' | 'closed' | 'cancelled';

export interface HostedPlayJoinPayload {
  paymentMethod?: string;
  paymentScreenshot?: string;
}

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
  status: HostedPlayStatus | 'completed';
  description?: string;
  createdBy?: string;
  createdAt?: string;
  // Queue management config
  numberOfCourts?: number;
  playersPerCourt?: number;
  queueMode?: string;
  queueStatus?: QueueStatus;
  // Member-facing extras
  joined?: boolean;
  participants?: HostedPlayParticipant[];
  convenienceFeePerPlayer?: number;
  convenienceFeeMode?: 'per_transaction' | 'per_hour' | 'monthly_flat' | 'club_absorbs';
  queueManagementFeePerPlayer?: number;
  totalPerPlayer?: number;
}

export type QueueStatus = 'not_started' | 'running' | 'paused' | 'ended';
export type ParticipantQueueStatus =
  'not_checked_in' | 'waiting' | 'playing' | 'paused' | 'done';

export interface QueuePlayer {
  _id: string;
  memberId?: string | null;
  memberName: string;
  isWalkIn: boolean;
  checkedIn: boolean;
  queueStatus: ParticipantQueueStatus;
  queueOrder: number | null;
  courtNumber: number | null;
  gamesPlayed: number;
}

export interface QueueCourt {
  courtNumber: number;
  players: QueuePlayer[];
}

export interface QueueBoard {
  session: {
    _id: string;
    title: string;
    status: string;
    venue?: string;
    court?: string;
    queueStatus: QueueStatus;
    numberOfCourts: number;
    playersPerCourt: number;
    feePerPlayer?: number;
    convenienceFeePerPlayer?: number;
    totalPerPlayer?: number;
  };
  courts: QueueCourt[];
  waiting: QueuePlayer[];
  paused: QueuePlayer[];
  nextGroup: QueuePlayer[];
  roster: QueuePlayer[];
  counts: {
    checkedIn: number;
    waiting: number;
    playing: number;
    paused: number;
    activeGames: number;
  };
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
  numberOfCourts?: number;
  playersPerCourt?: number;
  queueMode?: string;
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

  join(id: string, payment?: HostedPlayJoinPayload) {
    return this.http.post<{ success: boolean; currentPlayers: number; status: HostedPlayStatus; chargeId?: string }>(
      `${this.base}/player/sessions/${id}/join`, payment ?? {});
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

  // ── Queue — player view (read-only) ──
  getPlayerQueue(id: string) {
    return this.http.get<QueueBoard>(`${this.base}/player/sessions/${id}/queue`);
  }

  pollPlayerQueue(id: string, ms = 5000) {
    return interval(ms).pipe(switchMap(() => this.getPlayerQueue(id)));
  }

  // ── Queue Management (admin) ──
  getQueue(id: string) {
    return this.http.get<QueueBoard>(`${this.base}/sessions/${id}/queue`);
  }

  /** Poll the live board every `ms` while subscribed. */
  pollQueue(id: string, ms = 5000) {
    return interval(ms).pipe(switchMap(() => this.getQueue(id)));
  }

  startQueue(id: string) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/queue/start`, {});
  }

  endQueue(id: string) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/queue/end`, {});
  }

  checkIn(id: string, participantId: string, checkedIn: boolean) {
    return this.http.patch<QueueBoard>(
      `${this.base}/sessions/${id}/participants/${participantId}/check-in`, { checkedIn });
  }

  addWalkIn(id: string, name: string) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/walkins`, { name });
  }

  finishCourt(id: string, courtNumber: number) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/courts/${courtNumber}/finish`, {});
  }

  assignCourt(id: string, courtNumber: number, participantIds: string[]) {
    return this.http.post<QueueBoard>(
      `${this.base}/sessions/${id}/courts/${courtNumber}/assign`, { participantIds });
  }

  skipPlayer(id: string, participantId: string) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/participants/${participantId}/skip`, {});
  }

  pausePlayer(id: string, participantId: string) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/participants/${participantId}/pause`, {});
  }

  resumePlayer(id: string, participantId: string) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/participants/${participantId}/resume`, {});
  }

  removeFromQueue(id: string, participantId: string) {
    return this.http.delete<QueueBoard>(`${this.base}/sessions/${id}/participants/${participantId}/queue`);
  }

  reorderQueue(id: string, orderedParticipantIds: string[]) {
    return this.http.put<QueueBoard>(`${this.base}/sessions/${id}/queue/order`, { orderedParticipantIds });
  }
}
