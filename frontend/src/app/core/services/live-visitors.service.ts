import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

export interface LiveVisitor {
  _id?: string;
  sessionId: string;
  userId: string | null;
  username: string;
  role: 'player' | 'admin' | 'superadmin' | 'anonymous';
  currentPage: string;
  currentPageUrl: string;
  sessionStart: Date;
  lastActivity: Date;
}

@Injectable({
  providedIn: 'root',
})
export class LiveVisitorsService {
  private sessionId: string = '';
  private apiUrl = '/api/analytics';

  constructor(private http: HttpClient) {
    // Generate a unique session ID on service instantiation
    this.sessionId = this.generateSessionId();
    // Try to restore from localStorage if exists
    const stored = localStorage.getItem('sessionId');
    if (stored) {
      this.sessionId = stored;
    } else {
      localStorage.setItem('sessionId', this.sessionId);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Update the current user's live visitor record
   */
  updateLiveVisitor(
    userId: string | null,
    username: string,
    role: string,
    currentPage: string,
    currentPageUrl: string,
  ): Observable<any> {
    const payload = {
      sessionId: this.sessionId,
      userId: userId || null,
      username: username || 'Anonymous',
      role: role || 'anonymous',
      currentPage,
      currentPageUrl,
    };

    return this.http.post(`${this.apiUrl}/live-visitor`, payload).pipe(
      catchError((error) => {
        console.error('Error updating live visitor:', error);
        return of(null);
      }),
    );
  }

  /**
   * Get all current live visitors (superadmin only)
   */
  getLiveVisitors(): Observable<{
    visitors: LiveVisitor[];
    count: number;
    timestamp: Date;
  }> {
    return this.http
      .get<{
        visitors: LiveVisitor[];
        count: number;
        timestamp: Date;
      }>(`${this.apiUrl}/live-visitors`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching live visitors:', error);
          return of({ visitors: [], count: 0, timestamp: new Date() });
        }),
      );
  }

  /**
   * Get live visitors with polling every N seconds
   */
  getLiveVisitorsPolled(
    pollIntervalMs: number = 5000,
  ): Observable<{ visitors: LiveVisitor[]; count: number; timestamp: Date }> {
    return interval(pollIntervalMs).pipe(switchMap(() => this.getLiveVisitors()));
  }

  /**
   * Remove current user from live visitors (call on logout)
   */
  removeFromLiveVisitors(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/live-visitor/${this.sessionId}`).pipe(
      catchError((error) => {
        console.error('Error removing live visitor:', error);
        return of(null);
      }),
    );
  }

  /**
   * Delete all visitor history (superadmin only)
   */
  deleteAllVisits(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/clear-visitors`).pipe(
      catchError((error) => {
        console.error('Error clearing visitor history:', error);
        return of(null);
      }),
    );
  }

  /**
   * Clean up on destroy
   */
  cleanup(): void {
    this.removeFromLiveVisitors().subscribe();
  }
}
