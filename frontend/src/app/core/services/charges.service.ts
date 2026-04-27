import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Charge {
  _id: string;
  playerId: string | { _id: string; name: string; email: string; username: string };
  reservationId?: { _id: string; date: string; court: number; timeSlot: string };
  sessionId?: { _id: string; date: string; startTime: string; ballBoyUsed: boolean };
  amount: number;
  breakdown: { withoutLightFee: number; lightFee: number; ballBoyFee: number };
  chargeType: 'reservation' | 'session';
  status: 'unpaid' | 'paid';
  approvalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  paymentMethod?: 'GCash' | 'Cash' | 'Bank Transfer';
  paidAt?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ChargesService {
  constructor(private http: HttpClient) {}

  // Get player's charges
  getMyCharges() {
    console.log('ChargesService: Calling GET /api/charges/my');
    return this.http.get<Charge[]>(`${environment.apiUrl}/charges/my`).pipe(
      tap(charges => console.log('ChargesService: Received charges:', charges)),
      catchError(err => {
        console.error('ChargesService: Error fetching charges:', err);
        throw err;
      })
    );
  }

  // Get single charge
  getCharge(id: string) {
    return this.http.get<Charge>(`${environment.apiUrl}/charges/${id}`);
  }

  // Mark charge as paid
  markAsPaid(id: string, paymentMethod: 'GCash' | 'Cash' | 'Bank Transfer') {
    console.log(`ChargesService: Calling PATCH /api/charges/${id}/pay with method:`, paymentMethod);
    return this.http.patch<{ message: string; charge: Charge }>(
      `${environment.apiUrl}/charges/${id}/pay`,
      { paymentMethod }
    ).pipe(
      tap(res => console.log('ChargesService: Payment response received:', res)),
      catchError(err => {
        console.error('ChargesService: Payment error:', err);
        throw err;
      })
    );
  }

  // Get charges pending admin approval
  getPendingApprovals() {
    return this.http.get<Charge[]>(`${environment.apiUrl}/charges/pending-approval`);
  }

  // Get all charges that have entered the approval workflow (pending + approved + rejected)
  getAllApprovalCharges() {
    return this.http.get<Charge[]>(`${environment.apiUrl}/charges/pending-approval?status=all`);
  }

  // Get all approved charges (for Finance page)
  getApprovedCharges() {
    return this.http.get<Charge[]>(`${environment.apiUrl}/charges/pending-approval?status=approved`);
  }

  // Admin: approve a payment
  approvePayment(id: string) {
    return this.http.patch<{ message: string; charge: Charge }>(
      `${environment.apiUrl}/charges/${id}/approve`,
      {}
    );
  }

  // Admin: reject a payment
  rejectPayment(id: string, adminNote?: string) {
    return this.http.patch<{ message: string; charge: Charge }>(
      `${environment.apiUrl}/charges/${id}/reject`,
      { adminNote }
    );
  }

  // Calculate totals from charges array
  // Legacy charges (paid before approval system) have approvalStatus "none" — treat as paid.
  calculateTotals(charges: Charge[]) {
    const paid = charges.filter((c) => c.status === 'paid');
    const unpaid = charges.filter((c) => c.status === 'unpaid');
    const pending = charges.filter((c) => c.approvalStatus === 'pending');

    return {
      totalCharges: charges.length,
      totalUnsettled: unpaid.reduce((sum, c) => sum + c.amount, 0),
      totalPaid: paid.reduce((sum, c) => sum + c.amount, 0),
      totalOutstanding: unpaid.reduce((sum, c) => sum + c.amount, 0),
      unpaidCount: unpaid.length,
      paidCount: paid.length,
      pendingCount: pending.length,
    };
  }
}
