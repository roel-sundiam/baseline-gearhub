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
  // Fixed Doubles Rotation config — only meaningful when queueMode === 'fixed_doubles_rotation'
  fixedDoubles?: FixedDoublesConfig;
  // Optional skill band
  minSkillLevel?: SkillLevel | null;
  maxSkillLevel?: SkillLevel | null;
  // Optional pickleball scoring config (pickleball sessions only; null = free-form scoring)
  scoreTarget?: 11 | 15 | 21 | null;
  winByTwo?: boolean;
  // DUPR Premium Event gating (pickleball + DUPR-enabled clubs only) — only players
  // whose linked DUPR account carries PREMIUM_L1 may register/participate.
  premiumEvent?: boolean;
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

export interface HostedPlayRefundRow {
  participantId: string;
  chargeId: string;
  playerId: string | null;
  isGuest: boolean;
  name: string;
  amountPaid: number;
  convenienceFee: number;
  suggestedRefund: number;
  creditApplied: number;
  paymentMethod?: string;
}

export interface HostedPlayRefundPreview {
  session: { _id: string; title: string; status: string };
  creditsEnabled: boolean;
  rows: HostedPlayRefundRow[];
}

export type QueueStatus = 'not_started' | 'running' | 'paused' | 'ended';
export type ParticipantQueueStatus =
  'not_checked_in' | 'waiting' | 'playing' | 'paused' | 'done';

export interface QueuePlayer {
  _id: string;
  memberId?: string | null;
  memberName: string;
  profileImage?: string | null;
  duprRating?: number | null;
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

// ── Reclub Participant Import ──
export interface ReclubMatchSuggestion {
  userId: string;
  name: string;
  score: number; // 0..1
  alreadyJoined: boolean;
}

export interface ReclubImportPreviewRow {
  rawName: string;
  suggestions: ReclubMatchSuggestion[];
  bestMatch: ReclubMatchSuggestion | null;
  alreadyImportedAsGuest: boolean;
}

export interface ReclubImportConfirmRow {
  rawName: string;
  finalName: string;
  memberId?: string | null;
  isGuest: boolean;
}

export interface QueueCourt {
  courtNumber: number;
  players: QueuePlayer[];
  /** In-progress side-out score kept by the umpire scoring page; null once no game is being scored. */
  liveScore?: {
    team1Score: number;
    team2Score: number;
    /** Which team is currently serving; null until the umpire picks who serves first. */
    servingTeam: 1 | 2 | null;
    /** Which of the serving team's players is up (2 players only); null for singles or before serve starts. */
    serverNumber: 1 | 2 | null;
    /** The specific player currently serving; null while servingTeam is set means a side-out just happened and nobody has confirmed who's serving yet. */
    servingPlayerId: string | null;
    /** Whether the last rally-won/start-serve/set-server call can be undone. */
    canUndo: boolean;
  } | null;
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
    sport?: string;
    scoreTarget?: 11 | 15 | 21 | null;
    winByTwo?: boolean;
    feePerPlayer?: number;
    convenienceFeePerPlayer?: number;
    totalPerPlayer?: number;
    guestFeePerPlayer?: number;
    guestConvenienceFeePerPlayer?: number;
    guestTotalPerPlayer?: number;
    estimatedFee?: boolean;
    /** Resolved venue/court logo URL, when the club has one configured; null/absent otherwise. */
    venueLogo?: string | null;
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
  /** Attached by the finish response only (never by polls) so the UI can offer "Add score". */
  lastMatch?: HostedPlayMatch;
}

export interface MatchPlayer {
  participantId: string;
  memberId?: string | null;
  memberName: string;
  isWalkIn?: boolean;
}

export interface HostedPlayMatch {
  _id: string;
  sessionId: string;
  courtNumber: number;
  team1: MatchPlayer[];
  team2: MatchPlayer[];
  team1Score: number | null;
  team2Score: number | null;
  winnerTeam: 1 | 2 | null;
  winnerSource?: 'tapped' | 'scores' | null;
  finishedAt: string;
}

export interface HostedPlayMatchHistoryItem extends HostedPlayMatch {
  session: { _id: string; title: string; date: string; venue: string; sport: string } | null;
}

export interface MatchHistoryPage {
  matches: HostedPlayMatchHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface IndividualStanding {
  memberId: string;
  memberName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
}

export interface PairingStanding {
  memberIds: string[];
  players: { memberId: string; memberName: string }[];
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
}

export interface HostedPlayStandings {
  individuals: IndividualStanding[];
  pairings: PairingStanding[];
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

export interface HostedPlayWaitlistEntry {
  _id: string;
  memberName?: string;
  waitStatus: 'waitlisted' | 'offered';
  position: number;
  offerExpiresAt?: string | null;
  createdAt?: string;
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
  fixedDoubles?: FixedDoublesConfig;
  minSkillLevel?: SkillLevel | null;
  maxSkillLevel?: SkillLevel | null;
  scoreTarget?: 11 | 15 | 21 | null;
  winByTwo?: boolean;
  premiumEvent?: boolean;
}

// ── Fixed Doubles Rotation ────────────────────────────────────────────────────
// Structurally different from the live-queue formats above: pairs register
// upfront and a full round-robin schedule is generated once, rather than
// players rotating dynamically through open courts. See
// hosted-play-format-registry.js (backend) for the shared "five concerns"
// framing this and the live-queue formats both implement.

/** Which engine renders/manages a given queueMode — drives which admin/player component to show. */
export const HOSTED_PLAY_FORMAT_KIND: Record<string, 'live-queue' | 'fixed-schedule'> = {
  fcfs: 'live-queue',
  winner_stays: 'live-queue',
  king_of_court: 'live-queue',
  skill_rotation: 'live-queue',
  fixed_doubles_rotation: 'fixed-schedule',
};

export interface FixedDoublesConfig {
  pairCount?: number | null;
  matchDurationMinutes?: number | null;
  restBetweenMatchesMinutes?: number | null;
  scheduleGeneratedAt?: string | null;
  scheduleGenerationBatch?: number;
  pairsUpdatedAt?: string | null;
}

export type PairStatus = 'pending_partner' | 'confirmed' | 'withdrawn';

export interface HostedPlayPair {
  _id: string;
  hostedPlayId: string;
  pairLabel: string;
  status: PairStatus;
  source: 'player_invite' | 'organizer_assigned';
  inviteStatus: 'none' | 'pending' | 'accepted' | 'declined';
  participantAId: string | null;
  participantBId: string | null;
  invitedMemberId?: string | null;
  createdAt?: string;
}

export type FixtureStatus = 'scheduled' | 'in_progress' | 'completed';

export interface FixturePairSnapshot {
  pairId: string;
  pairLabel: string;
  players: { participantId: string; memberId: string | null; memberName: string }[];
}

export interface FixedDoublesFixture {
  _id: string;
  matchNumber: number;
  roundNumber: number;
  courtNumber: number;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: FixtureStatus;
  pair1: FixturePairSnapshot;
  pair2: FixturePairSnapshot;
  pair1Id: string;
  pair2Id: string;
  pair1Score: number | null;
  pair2Score: number | null;
  winnerPairId: string | null;
  /** Umpire live-scoring side-out state (pickleball) — set while in_progress once a first server is picked. */
  servingPair?: 1 | 2 | null;
  serverNumber?: 1 | 2 | null;
  servingParticipantId?: string | null;
}

export interface FixedDoublesStanding {
  rank: number;
  pairId: string;
  pairLabel: string;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export interface FixedDoublesBoard {
  session: {
    _id: string;
    title: string;
    status: string;
    venue?: string;
    court?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    queueMode?: string;
    numberOfCourts: number;
    sport?: string;
    fixedDoubles?: FixedDoublesConfig | null;
    feePerPlayer?: number;
    convenienceFeePerPlayer?: number;
    totalPerPlayer?: number;
    venueLogo?: string | null;
  };
  pairs: HostedPlayPair[];
  currentMatches: FixedDoublesFixture[];
  nextMatches: FixedDoublesFixture[];
  upcomingMatches: FixedDoublesFixture[];
  completedMatches: FixedDoublesFixture[];
  standings: FixedDoublesStanding[];
  byesThisRound: { roundNumber: number; pairId: string }[];
  locked: boolean;
  warnings?: string[];
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

  getRefundPreview(id: string) {
    return this.http.get<HostedPlayRefundPreview>(`${this.base}/sessions/${id}/refund-preview`);
  }

  cancelWithRefunds(id: string, refunds: { chargeId: string; playerId: string; amount: number }[]) {
    return this.http.post<{ session: HostedPlaySession; refunded: unknown[] }>(
      `${this.base}/sessions/${id}/cancel-with-refunds`, { refunds });
  }

  remove(id: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${id}`);
  }

  getParticipants(id: string) {
    return this.http.get<HostedPlayParticipant[]>(`${this.base}/sessions/${id}/participants`);
  }

  getWaitlist(id: string) {
    return this.http.get<HostedPlayWaitlistEntry[]>(`${this.base}/sessions/${id}/waitlist`);
  }

  promoteFromWaitlist(id: string, participantId: string) {
    return this.http.post<{ success: boolean; currentPlayers: number; status: string }>(
      `${this.base}/sessions/${id}/waitlist/${participantId}/promote`, {},
    );
  }

  removeFromWaitlist(id: string, participantId: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${id}/waitlist/${participantId}`);
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

  // ── Reclub Participant Import ──
  previewImport(id: string, rawNames: string[], method: 'paste' | 'screenshot') {
    return this.http.post<{ results: ReclubImportPreviewRow[] }>(
      `${this.base}/sessions/${id}/import-participants/preview`, { rawNames, method });
  }

  confirmImport(id: string, method: 'paste' | 'screenshot', participants: ReclubImportConfirmRow[]) {
    return this.http.post<QueueBoard & { imported: number; skipped: number }>(
      `${this.base}/sessions/${id}/import-participants/confirm`, { method, participants });
  }

  finishCourt(id: string, courtNumber: number, winnerIds: string[] = [], scores?: { team1Score: number; team2Score: number }) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/courts/${courtNumber}/finish`, { winnerIds, ...(scores ?? {}) });
  }

  listMatches(id: string) {
    return this.http.get<HostedPlayMatch[]>(`${this.base}/sessions/${id}/matches`);
  }

  updateMatchScore(matchId: string, team1Score: number, team2Score: number) {
    return this.http.patch<HostedPlayMatch>(`${this.base}/matches/${matchId}/score`, { team1Score, team2Score });
  }

  deleteMatch(matchId: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/matches/${matchId}`);
  }

  // ── Match History & Standings (club-wide, all-time) ──
  listMatchHistory(params: { page?: number; limit?: number; sessionId?: string } = {}) {
    return this.http.get<MatchHistoryPage>(`${this.base}/matches`, { params: params as Record<string, string | number> });
  }

  listPlayerMatchHistory(params: { page?: number; limit?: number; sessionId?: string } = {}) {
    return this.http.get<MatchHistoryPage>(`${this.base}/player/matches`, { params: params as Record<string, string | number> });
  }

  getStandings() {
    return this.http.get<HostedPlayStandings>(`${this.base}/standings`);
  }

  getPlayerStandings() {
    return this.http.get<HostedPlayStandings>(`${this.base}/player/standings`);
  }

  assignCourt(id: string, courtNumber: number, participantIds: string[]) {
    return this.http.post<QueueBoard>(
      `${this.base}/sessions/${id}/courts/${courtNumber}/assign`, { participantIds });
  }

  /** Swap two players' positions, or move one player onto an open court slot. */
  rearrange(id: string, body: { participantId: string; targetParticipantId?: string; courtNumber?: number; courtSlot?: number }) {
    return this.http.post<QueueBoard>(`${this.base}/sessions/${id}/courts/rearrange`, body);
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

  // No-login "find your name" check-in — for participants with no CourtGo
  // account (e.g. Reclub imports). Same qrToken as selfCheckIn above.
  searchParticipants(sessionId: string, q: string, token: string) {
    return this.http.get<{ results: { _id: string; memberName: string; checkedIn: boolean }[] }>(
      `${this.base}/sessions/${sessionId}/participants/search`, { params: { q, t: token } });
  }

  anonymousCheckIn(sessionId: string, participantId: string, token: string) {
    return this.http.post<QueueBoard>(
      `${this.base}/sessions/${sessionId}/participants/${participantId}/anonymous-check-in`, { token });
  }

  // ── Umpire Live Scoring (anonymous, per-court token — no login) ──
  generateUmpireLink(sessionId: string, courtNumber: number) {
    return this.http.post<{ token: string; url: string }>(
      `${this.base}/sessions/${sessionId}/courts/${courtNumber}/generate-umpire-link`, {});
  }

  getUmpireBoard(sessionId: string, courtNumber: number, token: string) {
    return this.http.get<QueueBoard>(`${this.base}/umpire/${sessionId}/courts/${courtNumber}/board`, { params: { t: token } });
  }

  startServe(sessionId: string, courtNumber: number, token: string, team: 1 | 2, playerId: string) {
    return this.http.post<QueueBoard>(
      `${this.base}/umpire/${sessionId}/courts/${courtNumber}/start-serve`, { team, playerId }, { params: { t: token } });
  }

  setServer(sessionId: string, courtNumber: number, token: string, playerId: string) {
    return this.http.post<QueueBoard>(
      `${this.base}/umpire/${sessionId}/courts/${courtNumber}/set-server`, { playerId }, { params: { t: token } });
  }

  rallyWon(sessionId: string, courtNumber: number, token: string, team: 1 | 2) {
    return this.http.post<QueueBoard>(
      `${this.base}/umpire/${sessionId}/courts/${courtNumber}/rally-won`, { team }, { params: { t: token } });
  }

  undoLastAction(sessionId: string, courtNumber: number, token: string) {
    return this.http.post<QueueBoard>(
      `${this.base}/umpire/${sessionId}/courts/${courtNumber}/undo`, {}, { params: { t: token } });
  }

  finishUmpireCourt(sessionId: string, courtNumber: number, token: string) {
    return this.http.post<QueueBoard>(
      `${this.base}/umpire/${sessionId}/courts/${courtNumber}/finish`, {}, { params: { t: token } });
  }

  // ── Fixed Doubles Rotation — pairs/registration ──
  listPairs(id: string) {
    return this.http.get<HostedPlayPair[]>(`${this.base}/sessions/${id}/pairs`);
  }

  listPlayerPairs(id: string) {
    return this.http.get<HostedPlayPair[]>(`${this.base}/player/sessions/${id}/pairs`);
  }

  /** Method 2: organizer manually pairs two already-registered participants. */
  organizerAssignPair(id: string, participantAId: string, participantBId: string, pairLabel?: string) {
    return this.http.post<HostedPlayPair>(`${this.base}/sessions/${id}/pairs`, { participantAId, participantBId, pairLabel });
  }

  /** Method 1 step 1: invite a partner by member id. */
  invitePartner(id: string, partnerMemberId: string) {
    return this.http.post<HostedPlayPair>(`${this.base}/sessions/${id}/pairs/invite`, { partnerMemberId });
  }

  /** Invitee accepts/declines; accepting may require payment like a normal join. */
  respondToInvite(id: string, pairId: string, accept: boolean, payment?: HostedPlayJoinPayload) {
    return this.http.post<HostedPlayPair>(`${this.base}/sessions/${id}/pairs/${pairId}/respond`, { accept, ...(payment ?? {}) });
  }

  cancelInvite(id: string, pairId: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${id}/pairs/${pairId}/invite`);
  }

  updatePair(id: string, pairId: string, body: { participantAId?: string; participantBId?: string; pairLabel?: string }) {
    return this.http.patch<HostedPlayPair>(`${this.base}/sessions/${id}/pairs/${pairId}`, body);
  }

  swapPairPlayers(id: string, body: { pairAId: string; slotA: 'A' | 'B'; pairBId: string; slotB: 'A' | 'B' }) {
    return this.http.post<{ pairA: HostedPlayPair; pairB: HostedPlayPair }>(`${this.base}/sessions/${id}/pairs/swap-players`, body);
  }

  withdrawPair(id: string, pairId: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${id}/pairs/${pairId}`);
  }

  // ── Fixed Doubles Rotation — schedule / live match queue ──
  generateFixedDoublesSchedule(id: string) {
    return this.http.post<FixedDoublesBoard>(`${this.base}/sessions/${id}/fixed-doubles/generate-schedule`, {});
  }

  getFixedDoublesBoard(id: string) {
    return this.http.get<FixedDoublesBoard>(`${this.base}/sessions/${id}/fixed-doubles/board`);
  }

  getPlayerFixedDoublesBoard(id: string) {
    return this.http.get<FixedDoublesBoard>(`${this.base}/player/sessions/${id}/fixed-doubles/board`);
  }

  pollFixedDoublesBoard(id: string, ms = 5000) {
    return interval(ms).pipe(switchMap(() => this.getFixedDoublesBoard(id)));
  }

  pollPlayerFixedDoublesBoard(id: string, ms = 6000) {
    return interval(ms).pipe(switchMap(() => this.getPlayerFixedDoublesBoard(id)));
  }

  startFixture(id: string, fixtureId: string) {
    return this.http.post<FixedDoublesBoard>(`${this.base}/sessions/${id}/fixed-doubles/matches/${fixtureId}/start`, {});
  }

  finishFixture(id: string, fixtureId: string, pair1Score: number, pair2Score: number, winnerPairId?: string) {
    return this.http.post<FixedDoublesBoard>(`${this.base}/sessions/${id}/fixed-doubles/matches/${fixtureId}/finish`, { pair1Score, pair2Score, winnerPairId });
  }

  updateFixtureScore(id: string, fixtureId: string, pair1Score: number, pair2Score: number, winnerPairId?: string) {
    return this.http.patch<FixedDoublesBoard>(`${this.base}/sessions/${id}/fixed-doubles/matches/${fixtureId}/score`, { pair1Score, pair2Score, winnerPairId });
  }

  /** Swaps two not-yet-completed matches' court + time slot. Not blocked by the roster lock. */
  swapFixtures(id: string, fixtureAId: string, fixtureBId: string) {
    return this.http.post<FixedDoublesBoard>(`${this.base}/sessions/${id}/fixed-doubles/matches/swap`, { fixtureAId, fixtureBId });
  }
}
