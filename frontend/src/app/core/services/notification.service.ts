import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  load() {
    this.http.get<AppNotification[]>(`${environment.apiUrl}/notifications`).subscribe({
      next: (data) => this.notifications.set(data),
      error: () => {},
    });
  }

  markRead(id: string) {
    this.notifications.update(ns => ns.map(n => n._id === id ? { ...n, read: true } : n));
    this.http.patch<AppNotification>(`${environment.apiUrl}/notifications/${id}/read`, {}).subscribe({
      error: () => this.load(),
    });
  }

  markAllRead() {
    this.notifications.update(ns => ns.map(n => ({ ...n, read: true })));
    this.http.patch(`${environment.apiUrl}/notifications/read-all`, {}).subscribe({
      error: () => this.load(),
    });
  }
}
