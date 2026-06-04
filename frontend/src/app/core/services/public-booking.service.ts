import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PublicRates {
  lightRate: number;
  ballBoyRate: number;
  reservationWeekdayRate: number;
  reservationWeekendRate: number;
  reservationHolidayRate: number;
  reservationGuestFee: number;
  rentalBalls50Rate: number;
  rentalBalls100Rate: number;
  rentalBallMachineRate: number;
  rentalRacketRate: number;
}

export interface GuestInfo {
  name: string;
  email: string;
  phone?: string;
}

export interface GuestBookingPayload {
  court: number;
  date: string;
  timeSlot: string;
  durationHours?: number;
  lightsRequested?: boolean;
  ballBoy?: boolean;
  isHoliday?: boolean;
  guestCount?: number;
  rentals?: { balls50?: number; balls100?: number; ballMachine?: boolean; rackets?: number };
  guestInfo: GuestInfo;
}

export interface GuestBookingResult {
  reservation: {
    _id: string;
    court: number;
    date: string;
    timeSlot: string;
    durationHours?: number;
    courtFee: number;
    status: string;
    guestInfo: GuestInfo;
  };
  charge: { _id: string; amount: number };
}

@Injectable({ providedIn: 'root' })
export class PublicBookingService {
  private base = `${environment.apiUrl}/public`;

  constructor(private http: HttpClient) {}

  getClubs() {
    return this.http.get<Array<{ _id: string; name: string; slug?: string; location?: string; logo?: string }>>(
      `${this.base}/clubs`
    );
  }

  getClub(clubId: string) {
    return this.http.get<{
      _id: string; name: string; slug?: string; location?: string; logo?: string; status: string;
      courtCount?: number; openingHour?: number; closingHour?: number;
      paymentMethods?: string[]; paymentAccounts?: Record<string, string>; paymentQrCodes?: Record<string, string>;
      convenienceFeeRate?: number; convenienceFeeMode?: 'per_transaction' | 'per_hour';
      mobile?: string; email?: string;
      description?: string; photos?: string[];
      socialLinks?: { facebook?: string; instagram?: string; reclub?: string };
      rating?: number; reviewCount?: number; totalBookings?: number;
    }>(`${this.base}/${clubId}`);
  }

  getOpenPlaySessions(clubId: string) {
    return this.http.get<{
      _id: string; title: string; sport: string;
      sessionDate: string; startTime: string; endTime: string;
      matchType: string; maxPlayers: number; joinedPlayers: number;
    }[]>(`${this.base}/${clubId}/open-play`);
  }

  getSlots(clubId: string, date: string) {
    return this.http.get<{ time: string; slot: string; available: number; total: number }[]>(
      `${this.base}/${clubId}/slots?date=${date}`
    );
  }

  getRates(clubId: string) {
    return this.http.get<PublicRates>(`${this.base}/${clubId}/rates`);
  }

  getAvailability(clubId: string, court: number, date: string) {
    const params = new HttpParams().set('court', court).set('date', date);
    return this.http.get<{ bookedSlots: string[] }>(`${this.base}/${clubId}/availability`, { params });
  }

  createGuestBooking(clubId: string, payload: GuestBookingPayload) {
    return this.http.post<GuestBookingResult>(`${this.base}/${clubId}/reserve`, payload);
  }

  submitInquiry(clubId: string, payload: { senderName: string; senderEmail: string; message: string }) {
    return this.http.post<any>(`${this.base}/${clubId}/inquiries`, payload);
  }

  pollInquiry(clubId: string, inquiryId: string) {
    return this.http.get<any>(`${this.base}/${clubId}/inquiries/${inquiryId}`);
  }

  sendFollowup(clubId: string, inquiryId: string, body: string) {
    return this.http.post<any>(`${this.base}/${clubId}/inquiries/${inquiryId}/message`, { body });
  }
}
