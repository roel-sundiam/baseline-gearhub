import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Court {
  _id?: string;
  name: string;
  address?: string;
  logo?: string;
}

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
  sport?: 'tennis' | 'pickleball' | 'badminton' | 'squash' | 'table_tennis' | 'padel';
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
  convenienceFeeMode?: 'per_transaction' | 'per_hour' | 'monthly_flat' | 'club_absorbs';
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
  balanceAlertEnabled?: boolean;
  bookingProcess?: 'reservation' | 'per_game' | 'hosted_play';
  hostedPlayEnabled?: boolean;
  hostedPlayQueueEnabled?: boolean;
  hostedPlayCreditsEnabled?: boolean;
  queueManagementFeePerPlayer?: number;
  hostedPlayFeeSplitMode?: 'per_player' | 'split_total';
  hostedPlayConvenienceFeeMode?: 'per_join' | 'per_session' | 'club_absorbs';
  hostedPlayConvenienceFeeRate?: number;
  hostedPlayConvenienceFeeAmount?: number;
  financeReportEnabled?: boolean;
  financeReportSubscribedAt?: string | null;
  financeReportFeeOverride?: number | null;
  emailConfirmationsEnabled?: boolean;
  emailConfirmationsSubscribedAt?: string | null;
  emailConfirmationsFeeOverride?: number | null;
  duprClubId?: string | null;
  duprEnabled?: boolean;
  courts?: Court[];
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

  createClub(data: { name: string; sport?: 'tennis' | 'pickleball' | 'badminton' | 'squash' | 'table_tennis' | 'padel'; location?: string; logo?: string; courtCount?: number; paymentMethods?: string[]; paymentAccounts?: Record<string, string>; paymentQrCodes?: Record<string, string> }) {
    return this.http.post<Club>(`${environment.apiUrl}/clubs`, data);
  }

  updateClub(id: string, data: { name?: string; sport?: 'tennis' | 'pickleball' | 'badminton' | 'squash' | 'table_tennis' | 'padel'; location?: string; logo?: string; courtCount?: number; paymentMethods?: string[]; paymentAccounts?: Record<string, string>; paymentQrCodes?: Record<string, string> }) {
    return this.http.put<Club>(`${environment.apiUrl}/clubs/${id}`, data);
  }

  deleteClub(id: string) {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/clubs/${id}`);
  }

  setStatus(id: string, status: 'active' | 'suspended') {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/status`, { status });
  }

  patchConvenienceFee(id: string, convenienceFeeRate: number, convenienceFeeMode?: 'per_transaction' | 'per_hour' | 'monthly_flat' | 'club_absorbs', convenienceFeeMonthlyAmount?: number) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/convenience-fee`, { convenienceFeeRate, convenienceFeeMode, ...(convenienceFeeMonthlyAmount !== undefined ? { convenienceFeeMonthlyAmount } : {}) });
  }

  patchHostedPlayConvenienceFee(id: string, hostedPlayConvenienceFeeMode?: 'per_join' | 'per_session' | 'club_absorbs', hostedPlayConvenienceFeeRate?: number, hostedPlayConvenienceFeeAmount?: number) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/hosted-play-convenience-fee`, {
      ...(hostedPlayConvenienceFeeMode !== undefined ? { hostedPlayConvenienceFeeMode } : {}),
      ...(hostedPlayConvenienceFeeRate !== undefined ? { hostedPlayConvenienceFeeRate } : {}),
      ...(hostedPlayConvenienceFeeAmount !== undefined ? { hostedPlayConvenienceFeeAmount } : {}),
    });
  }

  updateAdditionalFees(id: string, additionalFees: AdditionalFee[]) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/additional-fees`, { additionalFees });
  }

  patchScreenshotSetting(id: string, requirePaymentScreenshot: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/screenshot-setting`, { requirePaymentScreenshot });
  }

  patchBalanceAlert(id: string, balanceAlertEnabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/balance-alert`, { balanceAlertEnabled });
  }

  patchBookingQrCode(id: string, bookingQrCode: string | null) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/booking-qr`, { bookingQrCode });
  }

  patchBookingProcess(id: string, bookingProcess: 'reservation' | 'per_game' | 'hosted_play') {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/booking-process`, { bookingProcess });
  }

  patchHostedPlayAddon(id: string, enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/hosted-play-addon`, { enabled });
  }

  patchMyHostedPlayAddon(enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/me/hosted-play-addon`, { enabled });
  }

  patchMyFinanceReportAddon(enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/me/finance-report-addon`, { enabled });
  }

  patchFinanceReportFee(id: string, override: number | null) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/finance-report-fee`, { override });
  }

  patchMyEmailConfirmationsAddon(enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/me/email-confirmations-addon`, { enabled });
  }

  patchEmailConfirmationsFee(id: string, override: number | null) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/email-confirmations-fee`, { override });
  }

  patchHostedPlayQueue(id: string, enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/hosted-play-queue`, { enabled });
  }

  patchMyHostedPlayQueue(enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/me/hosted-play-queue`, { enabled });
  }

  patchHostedPlayCredits(id: string, enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/hosted-play-credits`, { enabled });
  }

  patchMyHostedPlayCredits(enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/me/hosted-play-credits`, { enabled });
  }

  patchMyHostedPlayFeeSplitMode(mode: 'per_player' | 'split_total') {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/me/hosted-play-fee-split-mode`, { mode });
  }

  patchQueueManagementFee(id: string, fee: number) {
    return this.http.patch<{ queueManagementFeePerPlayer: number }>(`${environment.apiUrl}/clubs/${id}/queue-management-fee`, { fee });
  }

  patchDuprClubId(id: string, duprClubId: string | null) {
    return this.http.patch<{ duprClubId: string | null }>(`${environment.apiUrl}/clubs/${id}/dupr-club-id`, { duprClubId });
  }

  patchDuprAddon(id: string, enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/${id}/dupr-addon`, { enabled });
  }

  patchMyDuprAddon(enabled: boolean) {
    return this.http.patch<Club>(`${environment.apiUrl}/clubs/me/dupr-addon`, { enabled });
  }

  patchMyDuprClubId(duprClubId: string | null) {
    return this.http.patch<{ duprClubId: string | null }>(`${environment.apiUrl}/clubs/me/dupr-club-id`, { duprClubId });
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
