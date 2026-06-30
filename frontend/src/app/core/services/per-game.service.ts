import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface GameJoin {
  _id: string;
  clubId: string;
  playerId: { _id: string; name: string; username?: string; email?: string } | string;
  status: 'joined' | 'recorded' | 'cancelled';
  playDate?: string;  // set by backend to today on join
  gamesPlayed: number;
  guestCount: number;
  chargeId?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class PerGameService {
  constructor(private http: HttpClient) {}

  join(guestCount = 0, playDate?: string) {
    return this.http.post<GameJoin>(`${environment.apiUrl}/per-game/join`, { guestCount, playDate });
  }

  updateGuests(id: string, guestCount: number) {
    return this.http.patch<GameJoin>(`${environment.apiUrl}/per-game/${id}/guests`, { guestCount });
  }

  cancelJoin() {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/per-game/join`);
  }

  myStatus(date?: string) {
    const params: Record<string, string> = date ? { date } : {};
    return this.http.get<GameJoin | null>(`${environment.apiUrl}/per-game/my-status`, { params });
  }

  getPlaying() {
    return this.http.get<GameJoin[]>(`${environment.apiUrl}/per-game/playing`);
  }

  getJoined(clubId?: string, date?: string) {
    const params: Record<string, string> = {};
    if (clubId) params['clubId'] = clubId;
    if (date) params['date'] = date;
    return this.http.get<GameJoin[]>(`${environment.apiUrl}/per-game/joined`, { params });
  }

  record(id: string, body: { gamesPlayed: number; guestCount: number; paymentMethod?: string }) {
    return this.http.post<{ entry: GameJoin; charge: any }>(`${environment.apiUrl}/per-game/${id}/record`, body);
  }

  updateRecord(id: string, body: { gamesPlayed: number; guestCount: number; paymentMethod?: string }) {
    return this.http.put<{ entry: GameJoin; charge: any }>(`${environment.apiUrl}/per-game/${id}/record`, body);
  }
}
