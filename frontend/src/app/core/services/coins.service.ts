import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CoinRequest {
  _id: string;
  clubId: any;
  requestedBy: { _id: string; name: string };
  coinsRequested: number;
  paymentMethod: 'GCash' | 'Cash' | 'Bank Transfer';
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: { _id: string; name: string };
  approvedAt?: string;
  rejectedNote?: string;
  createdAt: string;
}

export interface CoinTransaction {
  _id: string;
  userId?: { _id: string; name: string };
  type: 'debit' | 'credit';
  amount: number;
  action: 'reservation' | 'tournament-join' | 'page-view' | 'coin-request-approved';
  page?: string;
  balanceAfter: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CoinsService {
  private base = `${environment.apiUrl}/coins`;

  readonly coinBalance = signal<number>(0);

  constructor(private http: HttpClient) {}

  loadBalance(): Observable<{ coinBalance: number }> {
    return this.http.get<{ coinBalance: number }>(`${this.base}/balance`).pipe(
      tap(res => this.coinBalance.set(res.coinBalance))
    );
  }

  getTransactions(): Observable<CoinTransaction[]> {
    return this.http.get<CoinTransaction[]>(`${this.base}/transactions`);
  }

  requestCoins(coinsRequested: number, paymentMethod: string, note?: string): Observable<{ message: string; request: CoinRequest }> {
    return this.http.post<{ message: string; request: CoinRequest }>(`${this.base}/requests`, { coinsRequested, paymentMethod, note });
  }

  getMyRequests(): Observable<CoinRequest[]> {
    return this.http.get<CoinRequest[]>(`${this.base}/requests/my`);
  }

  getAllRequests(status?: string): Observable<CoinRequest[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<CoinRequest[]>(`${this.base}/requests${params}`);
  }

  approveRequest(id: string): Observable<{ message: string; request: CoinRequest; newBalance: number }> {
    return this.http.patch<{ message: string; request: CoinRequest; newBalance: number }>(`${this.base}/requests/${id}/approve`, {});
  }

  rejectRequest(id: string, rejectedNote?: string): Observable<{ message: string; request: CoinRequest }> {
    return this.http.patch<{ message: string; request: CoinRequest }>(`${this.base}/requests/${id}/reject`, { rejectedNote });
  }

  trackVisit(page: string): Observable<{ deducted: boolean; coinsDeducted?: number; coinBalance?: number; message?: string }> {
    return this.http.post<any>(`${this.base}/track-visit`, { page }).pipe(
      tap(res => { if (res.coinBalance !== undefined) this.coinBalance.set(res.coinBalance); })
    );
  }
}
