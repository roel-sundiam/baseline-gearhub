import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type Sport = 'tennis' | 'pickleball';
export type SessionStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type MatchStatus = 'pending' | 'completed';

export interface OpenPlaySession {
  _id: string;
  clubId: string;
  club?: { _id: string; name: string; location?: string; logo?: string | null } | null;
  sport: Sport;
  title: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  maxPlayers: number;
  maxMatches: number;
  matchType: 'doubles' | 'singles';
  courts: number[];
  status: SessionStatus;
  createdAt: string;
  registeredCount?: number;
  joined?: boolean;
}

export interface OpenPlaySessionPlayer {
  _id: string;
  sessionId: string;
  playerId: { _id: string; name: string; username: string; email: string } | null;
  guestName?: string;
  guestEmail?: string;
  ratingSnapshot: number;
  checkedIn: boolean;
  createdAt: string;
}

export interface OpenPlayMatch {
  _id: string;
  sessionId: string;
  court: string;
  team1Player1: { _id: string; name: string } | null;
  team1Player2: { _id: string; name: string } | null;
  team2Player1: { _id: string; name: string } | null;
  team2Player2: { _id: string; name: string } | null;
  team1Score?: number;
  team2Score?: number;
  status: MatchStatus;
}

export interface OpenPlayRating {
  _id: string;
  playerId: { _id: string; name: string; username: string };
  sport: Sport;
  rating: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

@Injectable({ providedIn: 'root' })
export class OpenPlayService {
  private base = `${environment.apiUrl}/open-play`;

  constructor(private http: HttpClient) {}

  // ── Admin: Sessions ─────────────────────────────────────────────────────────

  getSessions(sport?: Sport) {
    let params = new HttpParams();
    if (sport) params = params.set('sport', sport);
    return this.http.get<OpenPlaySession[]>(`${this.base}/sessions`, { params });
  }

  createSession(payload: {
    sport: Sport; title: string; sessionDate: string;
    startTime: string; endTime: string;
    maxPlayers?: number; maxMatches?: number; matchType?: 'doubles' | 'singles';
    courts?: number[];
  }) {
    return this.http.post<OpenPlaySession>(`${this.base}/sessions`, payload);
  }

  updateSession(id: string, payload: Partial<{
    title: string; sessionDate: string; startTime: string; endTime: string;
    maxPlayers: number; maxMatches: number; matchType: 'doubles' | 'singles';
    courts: number[];
  }>) {
    return this.http.put<OpenPlaySession>(`${this.base}/sessions/${id}`, payload);
  }

  patchSessionStatus(id: string, status: SessionStatus) {
    return this.http.patch<OpenPlaySession>(`${this.base}/sessions/${id}/status`, { status });
  }

  deleteSession(id: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${id}`);
  }

  // ── Admin: Players ──────────────────────────────────────────────────────────

  getSessionPlayers(sessionId: string) {
    return this.http.get<OpenPlaySessionPlayer[]>(`${this.base}/sessions/${sessionId}/players`);
  }

  addPlayer(sessionId: string, playerId: string) {
    return this.http.post<OpenPlaySessionPlayer>(`${this.base}/sessions/${sessionId}/players`, { playerId });
  }

  removePlayer(sessionId: string, entryId: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/sessions/${sessionId}/players/${entryId}`);
  }

  toggleCheckin(sessionId: string, entryId: string, checkedIn: boolean) {
    return this.http.patch<OpenPlaySessionPlayer>(`${this.base}/sessions/${sessionId}/players/${entryId}/checkin`, { checkedIn });
  }

  // ── Admin: Matches ──────────────────────────────────────────────────────────

  generateMatches(sessionId: string) {
    return this.http.post<OpenPlayMatch[]>(`${this.base}/sessions/${sessionId}/generate-matches`, {});
  }

  getMatches(sessionId: string) {
    return this.http.get<OpenPlayMatch[]>(`${this.base}/sessions/${sessionId}/matches`);
  }

  editMatch(matchId: string, payload: {
    team1Player1: string; team1Player2?: string | null;
    team2Player1: string; team2Player2?: string | null;
  }) {
    return this.http.patch<OpenPlayMatch>(`${this.base}/matches/${matchId}`, payload);
  }

  submitScore(matchId: string, team1Score: number, team2Score: number) {
    return this.http.patch<OpenPlayMatch>(`${this.base}/matches/${matchId}/score`, { team1Score, team2Score });
  }

  // ── Admin: Leaderboard ──────────────────────────────────────────────────────

  getLeaderboard(sport: Sport) {
    const params = new HttpParams().set('sport', sport);
    return this.http.get<OpenPlayRating[]>(`${this.base}/leaderboard`, { params });
  }

  // ── Player (authenticated) ───────────────────────────────────────────────────

  getPlayerSessionDetail(id: string) {
    return this.http.get<OpenPlaySession & {
      club: { _id: string; name: string; location?: string; logo?: string | null } | null;
      players: { _id: string; name: string; ratingSnapshot: number; checkedIn: boolean; isMe: boolean }[];
      matches: OpenPlayMatch[];
      myEntry: { checkedIn: boolean } | null;
    }>(`${this.base}/player/sessions/${id}`);
  }

  getPlayerSessions(sport?: Sport) {
    let params = new HttpParams();
    if (sport) params = params.set('sport', sport);
    return this.http.get<OpenPlaySession[]>(`${this.base}/player/sessions`, { params });
  }

  joinSession(sessionId: string) {
    return this.http.post<{ success: boolean }>(`${this.base}/player/sessions/${sessionId}/join`, {});
  }

  unjoinSession(sessionId: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/player/sessions/${sessionId}/join`);
  }

  getMySessions() {
    return this.http.get<OpenPlaySession[]>(`${this.base}/player/my-sessions`);
  }

  getPlayerLeaderboard(sport: Sport) {
    const params = new HttpParams().set('sport', sport);
    return this.http.get<OpenPlayRating[]>(`${this.base}/player/leaderboard`, { params });
  }
}
