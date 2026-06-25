import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AdditionalFee {
  _id?: string;
  name: string;
  amount: number;
  type: 'fixed' | 'per_person';
  isEnabled: boolean;
  isOptional: boolean;
}

export interface Club {
  _id: string;
  name: string;
  slug?: string;
  location?: string;
  mobile?: string;
  email?: string;
  logo?: string | null;
  createdAt?: string;
  status?: 'active' | 'suspended';
  courtCount?: number;
  openingHour?: number;
  closingHour?: number;
  paymentMethods?: string[];
  paymentAccounts?: Record<string, string>;
  paymentQrCodes?: Record<string, string>;
  convenienceFeeRate?: number;
  convenienceFeeMode?: 'per_transaction' | 'per_hour' | 'monthly_flat';
  convenienceFeeMonthlyAmount?: number;
  additionalFees?: AdditionalFee[];
  description?: string;
  bookingQrCode?: string | null;
  photos?: string[];
  socialLinks?: { facebook?: string; instagram?: string; reclub?: string };
  rating?: number;
  reviewCount?: number;
  totalBookings?: number;
  adminTermsAccepted?: boolean;
  requirePaymentScreenshot?: boolean;
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

  createClub(data: { name: string; location?: string; logo?: string; courtCount?: number; paymentMethods?: string[]; paymentAccounts?: Record<string, string>; paymentQrCodes?: Record<string, string> }) {
    return this.http.post<Club>(`${environment.apiUrl}/clubs`, data);
  }

  updateClub(id: string, data: { name?: string; location?: string; logo?: string; courtCount?: number; paymentMethods?: string[]; paymentAccounts?: Record<string, string>; paymentQrCodes?: Record<string, string> }) {
    return this.http.put<Club>(`${environment.apiUrl}/clubs/${id}`, data);
  }

  deleteClub(id: string) {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/clubs/${id}`);
  }

  setStatus(id: string, status: 'active' | 'suspended') {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/status`, { status });
  }

  patchConvenienceFee(id: string, convenienceFeeRate: number, convenienceFeeMode?: 'per_transaction' | 'per_hour' | 'monthly_flat', convenienceFeeMonthlyAmount?: number) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/convenience-fee`, { convenienceFeeRate, convenienceFeeMode, ...(convenienceFeeMonthlyAmount !== undefined ? { convenienceFeeMonthlyAmount } : {}) });
  }

  updateAdditionalFees(id: string, additionalFees: AdditionalFee[]) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/additional-fees`, { additionalFees });
  }

  patchScreenshotSetting(id: string, requirePaymentScreenshot: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/screenshot-setting`, { requirePaymentScreenshot });
  }

  patchBookingQrCode(id: string, bookingQrCode: string | null) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/booking-qr`, { bookingQrCode });
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
