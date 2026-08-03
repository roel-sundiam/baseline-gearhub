import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AnnouncementContent {
  enabled: boolean;
  title: string;
  text: string;
  version: number;
  acceptedVersion: number | null;
  updatedAt?: string | null;
  updatedBy?: string;
}

export interface AnnouncementConfirmation {
  username: string;
  clubName: string | null;
  confirmedAt: string;
  announcementVersion: number;
  announcementTitle: string;
}

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/announcement`;

  getAnnouncement(): Observable<AnnouncementContent> {
    return this.http.get<AnnouncementContent>(this.base);
  }

  updateAnnouncement(title: string, text: string, enabled: boolean): Observable<AnnouncementContent> {
    return this.http.put<AnnouncementContent>(this.base, { title, text, enabled });
  }

  acceptAnnouncement(): Observable<{ version: number }> {
    return this.http.post<{ version: number }>(`${this.base}/accept`, {});
  }

  getConfirmations(version?: number): Observable<{ version: number; confirmations: AnnouncementConfirmation[] }> {
    const url = version != null ? `${this.base}/confirmations?version=${version}` : `${this.base}/confirmations`;
    return this.http.get<{ version: number; confirmations: AnnouncementConfirmation[] }>(url);
  }

  getConfirmationHistory(): Observable<{ confirmations: AnnouncementConfirmation[] }> {
    return this.http.get<{ confirmations: AnnouncementConfirmation[] }>(`${this.base}/confirmations?all=true`);
  }
}
