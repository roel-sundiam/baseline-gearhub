import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AdminMessageUser {
  _id: string;
  name: string;
  role: string;
}

export interface AdminMessage {
  _id: string;
  from: AdminMessageUser;
  to: AdminMessageUser;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface MessageThread {
  user: AdminMessageUser;
  lastMessage: AdminMessage;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class AdminMessagesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin-messages`;

  getConversation(userId: string) {
    return this.http.get<AdminMessage[]>(`${this.base}/conversation/${userId}`);
  }

  send(toId: string, body: string) {
    return this.http.post<AdminMessage>(this.base, { toId, body });
  }

  getUnreadCount() {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`);
  }

  markRead(userId: string) {
    return this.http.patch<{ ok: boolean }>(`${this.base}/read/${userId}`, {});
  }

  getThreads() {
    return this.http.get<MessageThread[]>(`${this.base}/threads`);
  }

  getSupportContact() {
    return this.http.get<{ _id: string; name: string }>(`${this.base}/support-contact`);
  }
}
