import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClubLedgerEntry {
  _id: string;
  clubId: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  date: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface ClubLedgerEntryPayload {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  date: string;
  notes?: string;
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface FinanceReportMonthRow {
  month: string;
  chargeIncome: number;
  manualIncome: number;
  income: number;
  expenses: number;
  net: number;
}

export interface ClubFinanceReport {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  chargeIncome: { total: number; byCategory: CategoryTotal[]; convenienceFeesExcluded: number };
  manualIncome: { total: number; byCategory: CategoryTotal[] };
  expenses: { total: number; byCategory: CategoryTotal[] };
  byMonth: FinanceReportMonthRow[];
}

@Injectable({ providedIn: 'root' })
export class ClubLedgerService {
  constructor(private http: HttpClient) {}

  list(filters: { from?: string; to?: string; type?: 'income' | 'expense'; clubId?: string } = {}): Observable<ClubLedgerEntry[]> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.clubId) params = params.set('clubId', filters.clubId);
    return this.http.get<ClubLedgerEntry[]>(`${environment.apiUrl}/club-ledger`, { params });
  }

  create(payload: ClubLedgerEntryPayload): Observable<ClubLedgerEntry> {
    return this.http.post<ClubLedgerEntry>(`${environment.apiUrl}/club-ledger`, payload);
  }

  update(id: string, payload: ClubLedgerEntryPayload): Observable<ClubLedgerEntry> {
    return this.http.put<ClubLedgerEntry>(`${environment.apiUrl}/club-ledger/${id}`, payload);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${environment.apiUrl}/club-ledger/${id}`);
  }

  getReport(from?: string, to?: string, clubId?: string): Observable<ClubFinanceReport> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (clubId) params = params.set('clubId', clubId);
    return this.http.get<ClubFinanceReport>(`${environment.apiUrl}/club-ledger/report`, { params });
  }

  getGlobalFee(): Observable<{ financeReportMonthlyFee: number }> {
    return this.http.get<{ financeReportMonthlyFee: number }>(`${environment.apiUrl}/config/finance-report-fee`);
  }

  setGlobalFee(amount: number): Observable<{ financeReportMonthlyFee: number }> {
    return this.http.put<{ financeReportMonthlyFee: number }>(`${environment.apiUrl}/config/finance-report-fee`, { amount });
  }
}
