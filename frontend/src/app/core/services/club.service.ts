import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Club {
  _id: string;
  name: string;
  location?: string;
  logo?: string | null;
  createdAt?: string;
  coinBalance?: number;
}

@Injectable({ providedIn: 'root' })
export class ClubService {
  private readonly CLUB_KEY = 'activeClubId';

  private _selectedClubId = signal<string | null>(localStorage.getItem(this.CLUB_KEY));
  readonly selectedClubId = this._selectedClubId.asReadonly();

  constructor(private http: HttpClient) {}

  getClubs() {
    return this.http.get<Club[]>(`${environment.apiUrl}/clubs`);
  }

  getClub(id: string) {
    return this.http.get<Club>(`${environment.apiUrl}/clubs/${id}`);
  }

  createClub(data: { name: string; location?: string; logo?: string }) {
    return this.http.post<Club>(`${environment.apiUrl}/clubs`, data);
  }

  updateClub(id: string, data: { name?: string; location?: string; logo?: string }) {
    return this.http.put<Club>(`${environment.apiUrl}/clubs/${id}`, data);
  }

  deleteClub(id: string) {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/clubs/${id}`);
  }

  setSelectedClubId(id: string) {
    localStorage.setItem(this.CLUB_KEY, id);
    this._selectedClubId.set(id);
  }

  getSelectedClubId(): string | null {
    return this._selectedClubId();
  }

  clearSelectedClub() {
    localStorage.removeItem(this.CLUB_KEY);
    this._selectedClubId.set(null);
  }
}
