import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ReservationPlayer {
  _id: string;
  name: string;
  email: string;
}

export interface Reservation {
  _id: string;
  court: 1 | 2;
  date: string;
  timeSlot: string;
  hasLights: boolean;
  player: ReservationPlayer | string;
  players: ReservationPlayer[];
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface AvailabilityResult {
  bookedSlots: string[];
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private base = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient) {}

  getAvailability(court: 1 | 2, date: string) {
    const params = new HttpParams().set('court', court).set('date', date);
    return this.http.get<AvailabilityResult>(`${this.base}/availability`, { params });
  }

  create(payload: {
    court: 1 | 2; date: string; timeSlot: string; players?: string[];
    lightsRequested?: boolean; ballBoy?: boolean; isHoliday?: boolean; guestCount?: number;
    rentals?: { balls50?: number; balls100?: number; ballMachine?: boolean; rackets?: number };
  }) {
    return this.http.post<Reservation>(this.base, payload);
  }

  getMy() {
    return this.http.get<Reservation[]>(`${this.base}/my`);
  }

  getSchedule() {
    return this.http.get<Reservation[]>(`${this.base}/schedule`);
  }

  getAll(filters?: { date?: string; court?: string }) {
    let params = new HttpParams();
    if (filters?.date) params = params.set('date', filters.date);
    if (filters?.court) params = params.set('court', filters.court);
    return this.http.get<Reservation[]>(this.base, { params });
  }

  cancel(id: string) {
    return this.http.patch<Reservation>(`${this.base}/${id}/cancel`, {});
  }

  delete(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
