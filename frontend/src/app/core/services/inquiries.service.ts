import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface InquiryMessage {
  sender: 'guest' | 'admin';
  name: string;
  body: string;
  createdAt: string;
}

export interface Inquiry {
  _id: string;
  clubId: string;
  senderName: string;
  senderEmail: string;
  status: 'unread' | 'read' | 'replied';
  messages: InquiryMessage[];
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class InquiriesService {
  private base = `${environment.apiUrl}/inquiries`;

  constructor(private http: HttpClient) {}

  getInquiries() {
    return this.http.get<Inquiry[]>(this.base);
  }

  getInquiriesByClub(clubId: string) {
    return this.http.get<Inquiry[]>(`${this.base}?clubId=${clubId}`);
  }

  markRead(id: string) {
    return this.http.patch<Inquiry>(`${this.base}/${id}/read`, {});
  }

  reply(id: string, body: string) {
    return this.http.post<Inquiry>(`${this.base}/${id}/reply`, { body });
  }

  deleteInquiry(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
