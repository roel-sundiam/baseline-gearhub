import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TournamentPlayer {
  _id: string;
  name: string;
  profileImage?: string;
}

export interface TournamentMatch {
  _id: string;
  round: number;
  roundName: string;
  position: number;
  slot1Players: TournamentPlayer[];
  slot2Players: TournamentPlayer[];
  scheduledDate?: string;
  timeSlot?: string;
  score?: string;
  winner?: number | null; // 1 or 2
  status: 'upcoming' | 'ongoing' | 'completed';
}

export interface Tournament {
  _id: string;
  name: string;
  type: 'singles' | 'doubles';
  status: 'draft' | 'active' | 'completed';
  published: boolean;
  participants: TournamentPlayer[];
  teams: string[][];
  matches: TournamentMatch[];
  createdAt: string;
}

export interface RankingEntry {
  playerId: string;
  name: string;
  profileImage?: string;
  gender?: string;
  points: number;
  tournamentsPlayed: number;
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private base = `${environment.apiUrl}/tournaments`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Tournament[]> {
    return this.http.get<Tournament[]>(this.base);
  }

  getById(id: string): Observable<Tournament> {
    return this.http.get<Tournament>(`${this.base}/${id}`);
  }

  getRankings(): Observable<RankingEntry[]> {
    return this.http.get<RankingEntry[]>(`${this.base}/rankings`);
  }

  create(payload: { name: string; type: string }): Observable<Tournament> {
    return this.http.post<Tournament>(this.base, payload);
  }

  update(id: string, payload: { name?: string }): Observable<Tournament> {
    return this.http.patch<Tournament>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }

  addParticipant(id: string, playerId: string): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.base}/${id}/participants`, { playerId });
  }

  removeParticipant(id: string, playerId: string): Observable<Tournament> {
    return this.http.delete<Tournament>(`${this.base}/${id}/participants/${playerId}`);
  }

  addTeam(id: string, player1Id: string, player2Id: string): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.base}/${id}/teams`, { player1Id, player2Id });
  }

  removeTeam(id: string, teamIndex: number): Observable<Tournament> {
    return this.http.delete<Tournament>(`${this.base}/${id}/teams/${teamIndex}`);
  }

  generateBracket(id: string): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.base}/${id}/generate-bracket`, {});
  }

  updateMatch(id: string, matchId: string, payload: {
    score?: string;
    winner?: number | null;
    status?: string;
    scheduledDate?: string | null;
    timeSlot?: string;
    roundName?: string;
  }): Observable<Tournament> {
    return this.http.patch<Tournament>(`${this.base}/${id}/matches/${matchId}`, payload);
  }

  swapSlots(id: string, matchId1: string, slot1: number, matchId2: string, slot2: number): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.base}/${id}/matches/swap`, { matchId1, slot1, matchId2, slot2 });
  }

  deleteMatch(id: string, matchId: string): Observable<Tournament> {
    return this.http.delete<Tournament>(`${this.base}/${id}/matches/${matchId}`);
  }

  addMatch(id: string, payload: {
    roundName: string;
    slot1Players?: string[];
    slot2Players?: string[];
    scheduledDate?: string;
    timeSlot?: string;
  }): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.base}/${id}/matches`, payload);
  }

  renameRound(id: string, round: number, roundName: string): Observable<Tournament> {
    return this.http.patch<Tournament>(`${this.base}/${id}/rounds/${round}/name`, { roundName });
  }

  setPublished(id: string, published: boolean): Observable<Tournament> {
    return this.http.patch<Tournament>(`${this.base}/${id}/publish`, { published });
  }

  generateRandomMatches(id: string): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.base}/${id}/random-matches`, {});
  }

  completeTournament(id: string): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.base}/${id}/complete`, {});
  }
}
