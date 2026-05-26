import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Club {
  _id: string;
  name: string;
  location?: string;
  logo?: string | null;
  createdAt?: string;
  status?: 'active' | 'suspended';
}

@Injectable({ providedIn: 'root' })
export class ClubService {
  private readonly CLUB_KEY = 'activeClubId';

  private _selectedClubId = signal<string | null>(this.loadClubId());

  private loadClubId(): string | null {
    try { return localStorage.getItem(this.CLUB_KEY); } catch { return null; }
  }
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

  setStatus(id: string, status: 'active' | 'suspended') {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/status`, { status });
  }

  setSelectedClubId(id: string) {
    try { localStorage.setItem(this.CLUB_KEY, id); } catch { /* Safari restricted storage */ }
    this._selectedClubId.set(id);
  }

  getSelectedClubId(): string | null {
    return this._selectedClubId();
  }

  clearSelectedClub() {
    try { localStorage.removeItem(this.CLUB_KEY); } catch { /* Safari restricted storage */ }
    this._selectedClubId.set(null);
  }
}
