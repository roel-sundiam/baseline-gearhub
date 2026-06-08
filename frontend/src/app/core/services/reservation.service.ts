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
  court: number;
  date: string;
  timeSlot: string;
  durationHours?: number;
  hasLights: boolean;
  player: ReservationPlayer | string | null;
  players: ReservationPlayer[];
  status: 'confirmed' | 'cancelled' | 'pending_payment';
  guestInfo?: { name: string; email: string; phone?: string };
  createdAt: string;
  lightsRequested?: boolean;
  ballBoy?: boolean;
  isHoliday?: boolean;
  guestCount?: number;
  rentals?: { balls50: number; balls100: number; ballMachine: boolean; rackets: number };
  courtFee?: number;
  clubId?: { _id: string; name: string } | string;
}

export interface AvailabilityResult {
  bookedSlots: string[];
  pendingSlots: string[];
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private base = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient) {}

  getAvailability(court: number, date: string) {
    const params = new HttpParams().set('court', court).set('date', date);
    return this.http.get<AvailabilityResult>(`${this.base}/availability`, { params });
  }

  create(payload: {
    court: number; date: string; timeSlot: string; durationHours?: number; players?: string[];
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

  getAll(filters?: { date?: string; court?: string; status?: string; startDate?: string; endDate?: string; clubId?: string }) {
    let params = new HttpParams();
    if (filters?.date) params = params.set('date', filters.date);
    if (filters?.court) params = params.set('court', filters.court);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.clubId) params = params.set('clubId', filters.clubId);
    return this.http.get<Reservation[]>(this.base, { params });
  }

  update(id: string, payload: {
    court: number; date: string; timeSlot: string; durationHours?: number; players?: string[];
    lightsRequested?: boolean; ballBoy?: boolean; isHoliday?: boolean; guestCount?: number;
    rentals?: { balls50?: number; balls100?: number; ballMachine?: boolean; rackets?: number };
    guestInfo?: { name?: string; email?: string; phone?: string };
  }) {
    return this.http.patch<Reservation>(`${this.base}/${id}`, payload);
  }

  cancel(id: string) {
    return this.http.patch<Reservation>(`${this.base}/${id}/cancel`, {});
  }

  delete(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
