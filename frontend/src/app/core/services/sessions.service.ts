import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PlayerEntry {
  playerId: string;
  name: string;
  gamesWithoutLight: number;
  gamesWithLight: number;
  ballBoyUsed?: boolean;
  charges: { withoutLightFee: number; lightFee: number; ballBoyFee: number; total: number };
  status: 'unpaid' | 'paid';
  paymentMethod?: PaymentMethod;
  paidAt?: string;
}

export interface TrainingEntry {
  trainerCoach: string;
  withoutLights: number;
  withLights: number;
  startTime: string;
  endTime: string;
  totalFee: number;
}

export type PaymentMethod = 'GCash' | 'Cash' | 'Bank Transfer';

export interface Session {
  _id: string;
  date: string;
  startTime: string;
  endTime?: string;
  ballBoyUsed: boolean;
  ratesUsed: {
    withoutLightRate: number;
    lightRate: number;
    training2WithoutLightRate: number;
    training2LightRate: number;
    ballBoyRate: number;
  };
  players: PlayerEntry[];
  trainings: TrainingEntry[];
  courtSessions: {
    courtLabel: string;
    startTime: string;
    endTime: string;
    withLights: boolean;
    fee: number;
  }[];
  totalAmount: number;
  createdAt: string;
}

export interface Charge {
  _id: string;
  playerId: string;
  sessionId: { _id: string; date: string; startTime: string; ballBoyUsed: boolean };
  amount: number;
  breakdown: { withoutLightFee: number; lightFee: number; ballBoyFee: number };
  status: 'unpaid' | 'paid';
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  createdAt: string;
}

export interface NewSessionPayload {
  date: string;
  startTime: string;
  endTime?: string;
  ballBoyUsed: boolean;
  players: {
    playerId: string;
    gamesWithoutLight: number;
    gamesWithLight: number;
    ballBoyUsed?: boolean;
    paymentMethod?: PaymentMethod;
    paid?: boolean;
  }[];
  trainings?: {
    trainerCoach: string;
    withoutLights: number;
    withLights: number;
    startTime: string;
    endTime: string;
  }[];
  courtSessions: {
    courtLabel: string;
    startTime: string;
    endTime: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class SessionsService {
  constructor(private http: HttpClient) {}

  createSession(payload: NewSessionPayload) {
    return this.http.post<Session>(`${environment.apiUrl}/sessions`, payload);
  }

  getSessions() {
    return this.http.get<Session[]>(`${environment.apiUrl}/sessions`);
  }

  getSession(id: string) {
    return this.http.get<Session>(`${environment.apiUrl}/sessions/${id}`);
  }

  markPlayerPaid(sessionId: string, playerId: string, payload: { paymentMethod: PaymentMethod }) {
    return this.http.put<Charge>(
      `${environment.apiUrl}/sessions/${sessionId}/players/${playerId}/pay`,
      payload,
    );
  }

  getMyCharges() {
    return this.http.get<Charge[]>(`${environment.apiUrl}/sessions/player/my-charges`);
  }
}
