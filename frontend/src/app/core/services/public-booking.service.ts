import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PublicRates {
  lightRate: number;
  ballBoyRate: number;
  reservationWeekdayRate: number;
  reservationWeekendRate: number;
  reservationHolidayRate: number;
  pricingModel: 'flat' | 'tiered';
  reservationDaytimeRate: number;
  reservationEveningRate: number;
  reservationOvernightRate: number;
  reservationGuestFee: number;
  reservationGuestFeeThreshold: number;
  exclusiveEventEnabled: boolean;
  exclusiveEventRate: number;
  exclusiveEventIncludedPax: number;
  exclusiveEventExcessPaxFee: number;
  exclusiveEventMaxPax: number;
  exclusiveEventPolicies: string[];
  rentalBalls50Rate: number;
  rentalBalls100Rate: number;
  rentalBallMachineRate: number;
  rentalRacketRate: number;
  coachingEnabled: boolean;
  coachingMinHours: number;
  coachingMaxPax: number;
  coachingRate1Pax: number;
  coachingRate2Pax: number;
  coachingRate3to6Pax: number;
  perGameFee: number;
  perGameGuestFee: number;
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
  selectedExtraFeeNames?: string[];
  bookingType?: 'standard' | 'exclusive_event';
  coachingRequested?: boolean;
  coachingPax?: number;
  paymentScreenshot?: string;
  supportAmount?: number;
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
  charge: { _id: string; amount: number; breakdown?: { supportAmount?: number } };
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
      convenienceFeeRate?: number; convenienceFeeMode?: 'per_transaction' | 'per_hour' | 'monthly_flat' | 'club_absorbs';
      additionalFees?: { name: string; amount: number; type: 'fixed' | 'per_person'; isEnabled: boolean; isOptional: boolean }[];
      requirePaymentScreenshot?: boolean;
      mobile?: string; email?: string;
      description?: string; photos?: string[];
      socialLinks?: { facebook?: string; instagram?: string; reclub?: string };
      rating?: number; reviewCount?: number; totalBookings?: number;
      bookingProcess?: 'reservation' | 'per_game' | 'hosted_play';
      hostedPlayEnabled?: boolean;
      guestTermsText?: string;
      guestTermsNotification?: string;
    }>(`${this.base}/${clubId}`);
  }

  getHostedPlaySessions(clubId: string) {
    return this.http.get<{
      _id: string; title: string; sport: 'tennis' | 'pickleball';
      date: string; startTime: string; endTime: string;
      venue: string; court?: string; feePerPlayer: number;
      guestFeePerPlayer: number; maxGuests: number | null; currentGuests: number;
      maxPlayers: number; currentPlayers: number; status: 'open' | 'full';
      venueLogo?: string | null;
    }[]>(`${this.base}/${clubId}/hosted-play`);
  }

  getOpenPlaySessions(clubId: string) {
    return this.http.get<{
      _id: string; title: string; sport: string;
      sessionDate: string; startTime: string; endTime: string;
      matchType: string; maxPlayers: number; joinedPlayers: number;
    }[]>(`${this.base}/${clubId}/open-play`);
  }

  getAllOpenPlaySessions() {
    return this.http.get<{
      _id: string; title: string; sport: string;
      sessionDate: string; startTime: string; endTime: string;
      matchType: string; maxPlayers: number; joinedPlayers: number;
      club: { _id: string; name: string; slug?: string; location?: string; logo?: string };
    }[]>(`${this.base}/open-play`);
  }

  getAllHostedPlaySessions() {
    return this.http.get<{
      _id: string; title: string; sport: 'tennis' | 'pickleball';
      date: string; startTime: string; endTime: string;
      venue: string; court?: string; feePerPlayer: number;
      guestFeePerPlayer: number;
      maxPlayers: number; currentPlayers: number; status: 'open' | 'full';
      venueLogo?: string | null;
      club: { _id: string; name: string; slug?: string; location?: string; logo?: string };
    }[]>(`${this.base}/hosted-play`);
  }

  registerForOpenPlay(sessionId: string, payload: { guestName: string; guestEmail: string; guestPhone?: string }) {
    return this.http.post<{ success: boolean; joinedPlayers: number }>(
      `${this.base}/open-play/${sessionId}/register`,
      payload
    );
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

  getAllCourtAvailability(clubId: string, date: string) {
    return this.http.get<Record<string, string[]>>(
      `${this.base}/${clubId}/all-availability`,
      { params: { date } }
    );
  }

  createGuestBooking(clubId: string, payload: GuestBookingPayload) {
    return this.http.post<GuestBookingResult>(`${this.base}/${clubId}/reserve`, payload);
  }

  joinHostedPlayAsGuest(clubId: string, sessionId: string, payload: {
    name: string; email: string; phone?: string;
    paymentMethod?: string; paymentScreenshot?: string;
  }) {
    return this.http.post<{
      success: boolean; currentPlayers?: number;
      status: 'open' | 'full' | 'pending_approval'; chargeId?: string;
    }>(`${this.base}/${clubId}/hosted-play/${sessionId}/guest-join`, payload);
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
