import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AnnouncementContent {
  enabled: boolean;
  title: string;
  text: string;
  version: number;
  updatedAt?: string | null;
  updatedBy?: string;
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
}
