import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppServicePayment {
  _id: string;
  amount: number;
  type?: 'payment' | 'waiver' | 'billing';
  paymentMethod?: 'GCash' | 'QRPh';
  note?: string;
  paidBy: { _id: string; name: string; email: string };
  clubId?: { _id: string; name: string } | string;
  createdAt: string;
}

export interface ClubServiceSummary {
  clubId: string;
  clubName: string;
  convenienceFeeRate: number;
  convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat';
  convenienceFeeMonthlyAmount: number;
  totalCourtFees: number;
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

  getAll(clubId?: string) {
    const params = clubId ? new HttpParams().set('clubId', clubId) : undefined;
    return this.http.get<AppServicePayment[]>(`${environment.apiUrl}/app-service-payments`, { params });
  }

  record(amount: number, paymentMethod: 'GCash' | 'QRPh', note?: string, clubId?: string) {
    return this.http.post<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments`,
      { amount, paymentMethod, note, ...(clubId ? { clubId } : {}) }
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

  getFeeInfo(): Observable<{ convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat'; convenienceFeeMonthlyAmount: number }> {
    return this.http.get<{ convenienceFeeMode: 'per_transaction' | 'per_hour' | 'monthly_flat'; convenienceFeeMonthlyAmount: number }>(
      `${environment.apiUrl}/app-service-payments/fee-info`,
    );
  }

  billMonth(clubId: string): Observable<{ message: string; payment: AppServicePayment }> {
    return this.http.post<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments/bill-month`,
      { clubId },
    );
  }
}
