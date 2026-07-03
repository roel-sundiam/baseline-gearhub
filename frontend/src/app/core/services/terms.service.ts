import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TermsContent {
  adminTermsText: string;
  guestTermsText: string;
  termsVersion: number;
  termsUpdatedAt: string | null;
  termsUpdatedBy: string;
}

export interface ClubSummary {
  _id: string;
  name: string;
  guestTermsText?: string | null;
  guestTermsNotification?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TermsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/terms`;
  private clubsBase = `${environment.apiUrl}/clubs`;

  getTerms(): Observable<TermsContent> {
    return this.http.get<TermsContent>(this.base);
  }

  updateAdminTerms(adminTermsText: string): Observable<TermsContent> {
    return this.http.put<TermsContent>(this.base, { adminTermsText });
  }

  getClubs(): Observable<ClubSummary[]> {
    return this.http.get<ClubSummary[]>(this.clubsBase);
  }

  updateClubGuestTerms(clubId: string, guestTermsText: string, guestTermsNotification: string): Observable<{ guestTermsText: string | null; guestTermsNotification: string | null }> {
    return this.http.patch<{ guestTermsText: string | null; guestTermsNotification: string | null }>(
      `${this.clubsBase}/${clubId}/guest-terms`,
      { guestTermsText, guestTermsNotification },
    );
  }
}
