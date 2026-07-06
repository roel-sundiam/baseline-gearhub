import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FeeReportSummary {
  totalFees: number;
  txCount: number;
  avgFee: number;
}

export interface FeeReportMonthRow {
  month: string;
  fees: number;
  count: number;
}

export interface FeeReportDayRow {
  day: string;
  fees: number;
  count: number;
}

export interface FeeReportClubRow {
  clubId: string;
  clubName: string;
  feeMode: 'per_transaction' | 'per_hour' | 'monthly_flat';
  feeRate: number;
  fees: number;
  count: number;
}

export interface FeeReportTransaction {
  date: string;
  clubName: string;
  playerName: string;
  amount: number;
  convenienceFee: number;
  chargeType?: string;
}

export interface FeeReport {
  summary: FeeReportSummary;
  byMonth: FeeReportMonthRow[];
  byDay: FeeReportDayRow[];
  byClub: FeeReportClubRow[];
  transactions: FeeReportTransaction[];
}

export interface AppServicePayment {
  _id: string;
  amount: number;
  type?: 'payment' | 'waiver' | 'billing';
  paymentMethod?: 'GCash' | 'QRPh';
  paymentScreenshot?: string | null;
  note?: string;
  paidBy: { _id: string; name: string; email: string };
  clubId?: { _id: string; name: string } | string;
  createdAt: string;
}

export interface RecordAppServicePaymentPayload {
  amount: number;
  paymentMethod: 'GCash' | 'QRPh';
  note?: string;
  clubId?: string;
  paymentScreenshot?: string;
}

export interface ClubServiceSummary {
  clubId: string;
  clubName: string;
  convenienceFeeRate: number;
  convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat';
  convenienceFeeMonthlyAmount: number;
  totalCourtFees: number;
  totalHostedPlaySessionFees: number;
  feesOwed: number;
  totalPaid: number;
  totalWaived: number;
  balance: number;
}

export interface ServiceSummaryTotals {
  feesOwed: number;
  totalPaid: number;
  totalWaived: number;
  outstanding: number;
}

@Injectable({ providedIn: 'root' })
export class AppServicePaymentsService {
  constructor(private http: HttpClient) {}

  getAll(clubId?: string, startDate?: string, endDate?: string) {
    let params = new HttpParams();
    if (clubId) params = params.set('clubId', clubId);
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<AppServicePayment[]>(`${environment.apiUrl}/app-service-payments`, { params });
  }

  record(payload: RecordAppServicePaymentPayload) {
    return this.http.post<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments`,
      payload
    );
  }

  attachScreenshot(id: string, paymentScreenshot: string) {
    return this.http.patch<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments/${id}/screenshot`,
      { paymentScreenshot },
    );
  }

  getSummary(): Observable<{ clubs: ClubServiceSummary[]; totals: ServiceSummaryTotals }> {
    return this.http.get<{ clubs: ClubServiceSummary[]; totals: ServiceSummaryTotals }>(
      `${environment.apiUrl}/app-service-payments/summary`,
    );
  }

  waive(clubId: string, amount: number, note?: string): Observable<{ message: string; payment: AppServicePayment }> {
    return this.http.post<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments/waive`,
      { clubId, amount, ...(note ? { note } : {}) },
    );
  }

  getFeeInfo(): Observable<{ convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat'; convenienceFeeMonthlyAmount: number; balanceAlertEnabled: boolean; balance: number }> {
    return this.http.get<{ convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat'; convenienceFeeMonthlyAmount: number; balanceAlertEnabled: boolean; balance: number }>(
      `${environment.apiUrl}/app-service-payments/fee-info`,
    );
  }

  billMonth(clubId: string): Observable<{ message: string; payment: AppServicePayment }> {
    return this.http.post<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments/bill-month`,
      { clubId },
    );
  }

  getFeeReport(params: { startDate?: string; endDate?: string; clubId?: string }): Observable<FeeReport> {
    let httpParams = new HttpParams();
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
    if (params.clubId) httpParams = httpParams.set('clubId', params.clubId);
    return this.http.get<FeeReport>(`${environment.apiUrl}/app-service-payments/report`, { params: httpParams });
  }
}
