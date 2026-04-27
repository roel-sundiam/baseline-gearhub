import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AnalyticsSummary {
  totalPlayers: number;
  totalAdmins: number;
  totalSessions: number;
  activeUsers: number;
  pendingUsers: number;
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
}

export interface LoginRecord {
  _id: string;
  userId: string;
  username: string;
  role: string;
  loginTime: string;
}

export interface PageVisitRecord {
  _id: string;
  userId: string;
  username: string;
  role: string;
  pageName: string;
  pageUrl: string;
  visitTime: string;
  timeSpent: number;
}

export interface MostVisitedPage {
  _id: string;
  pageName: string;
  visits: number;
  totalTimeSpent: number;
  avgTimeSpent: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private http: HttpClient) {}

  getSummary() {
    return this.http.get<{ summary: AnalyticsSummary }>(`${environment.apiUrl}/analytics/summary`);
  }

  getLoginHistory(limit = 50) {
    return this.http.get<{ logins: LoginRecord[] }>(
      `${environment.apiUrl}/analytics/login-history?limit=${limit}`,
    );
  }

  getMostVisitedPages() {
    return this.http.get<{ pages: MostVisitedPage[] }>(
      `${environment.apiUrl}/analytics/most-visited-pages`,
    );
  }

  getRecentPageVisits(limit = 100) {
    return this.http.get<{ pageVisits: PageVisitRecord[] }>(
      `${environment.apiUrl}/analytics/recent-page-visits?limit=${limit}`,
    );
  }
}
