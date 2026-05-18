import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
    const params = clubId ? new HttpParams().set('clubId', clubId) : undefined;
    return this.http.get<AppServicePayment[]>(`${environment.apiUrl}/app-service-payments`, { params });
  }

  record(amount: number, paymentMethod: 'GCash' | 'Cash' | 'Bank Transfer', note?: string, clubId?: string) {
    return this.http.post<{ message: string; payment: AppServicePayment }>(
      `${environment.apiUrl}/app-service-payments`,
      { amount, paymentMethod, note, ...(clubId ? { clubId } : {}) }
    );
  }
}
