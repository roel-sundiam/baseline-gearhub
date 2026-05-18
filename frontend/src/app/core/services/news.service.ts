import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ClubNews {
  _id: string;
  clubId: string;
  title: string;
  body: string;
  type: 'news' | 'announcement' | 'event';
  pinned: boolean;
  createdBy?: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private base = `${environment.apiUrl}/news`;

  constructor(private http: HttpClient) {}

  getNews() {
    return this.http.get<ClubNews[]>(this.base);
  }

  create(data: { title: string; body: string; type: string; pinned: boolean }) {
    return this.http.post<ClubNews>(this.base, data);
  }

  update(id: string, data: { title?: string; body?: string; type?: string; pinned?: boolean }) {
    return this.http.put<ClubNews>(`${this.base}/${id}`, data);
  }

  togglePin(id: string) {
    return this.http.patch<ClubNews>(`${this.base}/${id}/pin`, {});
  }

  delete(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
