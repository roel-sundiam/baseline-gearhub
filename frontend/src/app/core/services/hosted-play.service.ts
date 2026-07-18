import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type HostedPlayStatus = 'open' | 'full' | 'closed' | 'cancelled';
export type SkillLevel =
  | 'beginner'
  | 'novice'
  | 'lower_intermediate'
  | 'intermediate'
  | 'upper_intermediate'
  | 'advanced'
  | 'expert_elite'
  | 'professional';

export interface HostedPlayJoinPayload {
  paymentMethod?: string;
  paymentScreenshot?: string;
  // Whether to apply available account credit toward the fee. Defaults to true server-side
  // when omitted; pass false when the player chooses to pay via the club's payment methods instead.
  useCredit?: boolean;
}

export interface HostedPlaySession {
  _id: string;
  clubId: string;
  title: string;
  sport: 'tennis' | 'pickleball' | 'badminton' | 'squash' | 'table_tennis' | 'padel';
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  court?: string;
  address?: string;
  feePerPlayer: number;
  // Billing model, fixed at session creation from the club's setting.
  // split_total ignores feePerPlayer/totalPerPlayer as fixed charges — those
  // become live estimates (see estimatedFee) until the session completes.
  feeSplitMode?: 'per_player' | 'split_total';
  sessionFee?: number;
  guestFeePerPlayer?: number | null;
  maxPlayers: number;
  maxGuests?: number | null;
  currentPlayers: number;
  status: HostedPlayStatus | 'completed';
  description?: string;
  createdBy?: string;
  createdAt?: string;
  // Queue management config
  queueManagementEnabled?: boolean;
  numberOfCourts?: number;
  playersPerCourt?: number;
  queueMode?: string;
  queueStatus?: QueueStatus;
  // Optional skill band
  minSkillLevel?: SkillLevel | null;
  maxSkillLevel?: SkillLevel | null;
  // Member-facing extras
  joined?: boolean;
  pendingApproval?: boolean;
  // Waitlist state (when the session is/was full)
  waitlisted?: boolean;                 // list view: I'm on the waitlist
  offered?: boolean;                    // list view: a spot has been offered to me
  waitlistStatus?: 'waitlisted' | 'offered' | null; // detail view
  waitlistPosition?: number | null;     // my place in line (detail view)
  offerExpiresAt?: string | null;       // claim deadline when offered (detail view)
  participants?: HostedPlayParticipant[];
  convenienceFeePerPlayer?: number;
  convenienceFeeMode?: 'per_transaction' | 'per_hour' | 'monthly_flat' | 'club_absorbs';
  queueManagementFeePerPlayer?: number;
  totalPerPlayer?: number;
  // True when feeSplitMode is split_total: feePerPlayer/convenienceFeePerPlayer/
  // totalPerPlayer above are a live estimate (sessionFee / current headcount),
  // not a fixed charge — the actual bill is set once the session completes.
  estimatedFee?: boolean;
  billedLater?: boolean;
}

export type QueueStatus = 'not_started' | 'running' | 'paused' | 'ended';
export type ParticipantQueueStatus =
  'not_checked_in' | 'waiting' | 'playing' | 'paused' | 'done';

export interface QueuePlayer {
  _id: string;
  memberId?: string | null;
  memberName: string;
  profileImage?: string | null;
  isWalkIn: boolean;
  checkedIn: boolean;
  queueStatus: ParticipantQueueStatus;
  queueOrder: number | null;
  courtNumber: number | null;
  courtSlot?: number | null;
  gamesPlayed: number;
  wins?: number;
  losses?: number;
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
    date?: string;
    startTime?: string;
    endTime?: string;
    queueStatus: QueueStatus;
    queueMode?: string;
    numberOfCourts: number;
    playersPerCourt: number;
    feePerPlayer?: number;
    convenienceFeePerPlayer?: number;
    totalPerPlayer?: number;
    guestFeePerPlayer?: number;
    guestConvenienceFeePerPlayer?: number;
    guestTotalPerPlayer?: number;
    estimatedFee?: boolean;
  };
  courts: QueueCourt[];
  waiting: QueuePlayer[];
  paused: QueuePlayer[];
  nextGroup: QueuePlayer[];
  roster: QueuePlayer[];
  leaderboard?: QueuePlayer[];
  counts: {
    checkedIn: number;
    waiting: number;
    playing: number;
    paused: number;
    activeGames: number;
  };
}

// Splits a court's players into Team A / Team B for display (e.g. "Team A vs Team B"
// on the admin board, TV display, and player live board). Low half of courtSlot
// (1..ceil(size/2)) is Team A, the rest is Team B. Falls back to array order for
// legacy/mid-flight participants that predate slot tracking (courtSlot missing).
export function splitCourtTeams(players: QueuePlayer[], playersPerCourt: number): { teamA: QueuePlayer[]; teamB: QueuePlayer[] } {
  const half = Math.ceil((playersPerCourt || 4) / 2);
  const hasSlots = players.length > 0 && players.every(p => typeof p.courtSlot === 'number');
  if (hasSlots) {
    const sorted = [...players].sort((a, b) => (a.courtSlot ?? 0) - (b.courtSlot ?? 0));
    return {
      teamA: sorted.filter(p => (p.courtSlot ?? 0) <= half),
      teamB: sorted.filter(p => (p.courtSlot ?? 0) > half),
    };
  }
  return { teamA: players.slice(0, half), teamB: players.slice(half) };
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
  sport: 'tennis' | 'pickleball' | 'badminton' | 'squash' | 'table_tennis' | 'padel';
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  court?: string;
  address?: string;
  feePerPlayer: number;
  sessionFee?: number;
  guestFeePerPlayer?: number | null;
  maxPlayers: number;
  maxGuests?: number | null;
  description?: string;
  numberOfCourts?: number;
  playersPerCourt?: number;
  queueMode?: string;
  minSkillLevel?: SkillLevel | null;
  maxSkillLevel?: SkillLevel | null;
}

@Injectable({ providedIn: 'root' })
export class HostedPlayService {
  private base = `${environment.apiUrl}/hosted-play`;

  constructor(private http: HttpClient) {}

  // ── Member ──
  listOpen() {
    return this.http.get<HostedPlaySession[]>(`${this.base}/player/sessions`);
  }

  // Player's self-declared skill tier (stored on their user profile).
  getSkillLevel(userId: string) {
    return this.http.get<{ skillLevel: SkillLevel | null; duprRating?: number | null; duprId?: string | null }>(`${environment.apiUrl}/users/${userId}/profile`);
  }
  setSkillLevel(userId: string, skillLevel: SkillLevel | null) {
    return this.http.put<{ skillLevel: SkillLevel | null }>(`${environment.apiUrl}/users/${userId}/profile`, { skillLevel });
  }

  // Player's self-reported DUPR doubles rating (2.000-8.000) and DUPR ID (free text),
  // stored on their user profile. Phase 0: no DUPR API verification.
  getDuprProfile(userId: string) {
    return this.http.get<{ duprRating: number | null; duprId: string | null }>(`${environment.apiUrl}/users/${userId}/profile`);
  }
  setDuprProfile(userId: string, data: { duprRating?: number | null; duprId?: string | null }) {
    return this.http.put<{ duprRating: number | null; duprId: string | null }>(`${environment.apiUrl}/users/${userId}/profile`, data);
  }

  getSession(id: string) {
    return this.http.get<HostedPlaySession>(`${this.base}/player/sessions/${id}`);
  }

  join(id: string, payment?: HostedPlayJoinPayload) {
    return this.http.post<{ success: boolean; currentPlayers?: number; sessionStatus?: HostedPlayStatus; status: HostedPlayStatus | 'pending_approval' | 'waitlisted'; chargeId?: string; waitlistPosition?: number; creditApplied?: number; remaining?: number }>(
      `${this.base}/player/sessions/${id}/join`, payment ?? {});
  }

  // Claim a waitlist spot that was offered to me. If account credit fully covers the fee
  // no payment proof is required (status resolves to 'active' immediately); otherwise
  // paymentMethod + paymentScreenshot are required for the remainder.
  claim(id: string, payment?: HostedPlayJoinPayload) {
    return this.http.post<{ success: boolean; status: 'pending_approval' | 'active'; chargeId?: string; creditApplied?: number; remaining?: number }>(
      `${this.base}/player/sessions/${id}/claim`, payment ?? {});
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

  setStatus(id: string, status: HostedPlayStatus | 'completed') {
    return this.http.patch<HostedPlaySession>(`${this.base}/sessions/${id}/status`, { status });
  }

  remove(id: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${id}`);
  }

  getParticipants(id: string) {
    return this.http.get<HostedPlayParticipant[]>(`${this.base}/sessions/${id}/participants`);
  }

  enableQueue(id: string) {
    return this.http.post<HostedPlaySession>(`${this.base}/sessions/${id}/enable-queue`, {});
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

  addWalkIn(id: string, data: { name?: string; memberId?: string }) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/walkins`, data);
  }

  finishCourt(id: string, courtNumber: number, winnerIds: string[] = []) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/courts/${courtNumber}/finish`, { winnerIds });
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

  // ── QR Self-Check-In ──
  generateQr(sessionId: string) {
    return this.http.post<{ qrToken: string; url: string }>(
      `${this.base}/sessions/${sessionId}/generate-qr`, {});
  }

  selfCheckIn(sessionId: string, token: string) {
    return this.http.post<QueueBoard>(
      `${this.base}/sessions/${sessionId}/self-check-in`, { token });
  }
}
