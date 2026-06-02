import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/push`;

  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async init(): Promise<void> {
    if (!this.isSupported) return;

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') return;

    try {
      const { key } = await firstValueFrom(this.http.get<{ key: string | null }>(`${this.base}/vapid-public-key`));
      if (!key) return;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(key),
        });
      }
      await firstValueFrom(this.http.post(`${this.base}/subscribe`, { subscription: sub.toJSON() }));
    } catch (err) {
      console.warn('Push subscription failed:', err);
    }
  }

  private urlBase64ToUint8Array(base64: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      output[i] = raw.charCodeAt(i);
    }
    return output.buffer as ArrayBuffer;
  }
}
