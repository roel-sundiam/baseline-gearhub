import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AppServicePayment {
  _id: string;
  amount: number;
  paymentMethod: 'GCash' | 'Cash' | 'Bank Transfer';
  note?: string;
  paidBy: { _id: string; name: string; email: string };
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AppServicePaymentsService {
  constructor(private http: HttpClient) {}

  getAll(clubId?: string) {
    const q = clubId ? `?clubId=${encodeURIComponent(clubId)}` : '';
    return this.http.get<AppServicePayment[]>(`${environment.apiUrl}/app-service-payments${q}`);
  }

  record(amount: number, paymentMethod: 'GCash' | 'Cash' | 'Bank Transfer', note?: string, clubId?: string) {
    return this.http.post<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments`,
      { amount, paymentMethod, note, ...(clubId ? { clubId } : {}) }
    );
  }
}
