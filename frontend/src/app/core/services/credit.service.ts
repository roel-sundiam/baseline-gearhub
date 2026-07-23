import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Charge } from './charges.service';

export interface CreditEntry {
  _id: string;
  clubId: string;
  playerId: string;
  type: 'grant' | 'redemption' | 'deduction';
  amount: number;
  reason?: string;
  chargeId?: { _id: string; amount: number; chargeType: string } | string;
  grantedBy?: { _id: string; name: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberBalance {
  _id: string;
  name: string;
  email?: string;
  username: string;
  balance: number;
}

@Injectable({ providedIn: 'root' })
export class CreditService {
  constructor(private http: HttpClient) {}

  // Player: own balance + history
  getMyCredit() {
    return this.http.get<{ balance: number; history: CreditEntry[] }>(`${environment.apiUrl}/credits/my`);
  }

  // Admin: club members with derived balances
  getMembersWithBalances(clubId?: string) {
    let params = new HttpParams();
    if (clubId) params = params.set('clubId', clubId);
    return this.http.get<MemberBalance[]>(`${environment.apiUrl}/credits/members`, { params });
  }

  // Admin: one member's full ledger
  getMemberHistory(playerId: string) {
    return this.http.get<{ player: { _id: string; name: string; email: string }; balance: number; history: CreditEntry[] }>(
      `${environment.apiUrl}/credits/history/${playerId}`
    );
  }

  // Admin: grant credit to a member
  grantCredit(playerId: string, amount: number, reason: string) {
    return this.http.post<{ message: string; credit: CreditEntry; newBalance: number }>(
      `${environment.apiUrl}/credits/grant`,
      { playerId, amount, reason }
    );
  }

  // Admin: deduct credit from a member
  deductCredit(playerId: string, amount: number, reason: string) {
    return this.http.post<{ message: string; credit: CreditEntry; newBalance: number }>(
      `${environment.apiUrl}/credits/deduct`,
      { playerId, amount, reason }
    );
  }

  // Player (or admin): apply available credit toward an owed charge
  applyCreditToCharge(chargeId: string) {
    return this.http.patch<{
      message: string;
      charge: Charge;
      creditApplied: number;
      remainingOwed: number;
      newBalance: number;
    }>(`${environment.apiUrl}/credits/apply/${chargeId}`, {});
  }
}
