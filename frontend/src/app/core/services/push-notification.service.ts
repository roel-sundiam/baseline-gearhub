import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/push`;

  readonly isSubscribed = signal(false);
  readonly statusMsg = signal('');

  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  get isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
  }

  async init(): Promise<void> {
    if (!this.isSupported) {
      console.warn('[Push] Not supported on this browser');
      this.statusMsg.set('Not supported');
      return;
    }

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn('[Push] Permission not granted:', permission);
      this.statusMsg.set('Permission denied');
      return;
    }

    try {
      const { key } = await firstValueFrom(this.http.get<{ key: string | null }>(`${this.base}/vapid-public-key`));
      if (!key) {
        console.warn('[Push] No VAPID public key configured on server');
        this.statusMsg.set('Server not configured');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      console.log('[Push] Existing browser subscription:', sub?.endpoint ?? 'none');

      const { subscribed: backendSubscribed } = await firstValueFrom(
        this.http.get<{ subscribed: boolean }>(`${this.base}/status`)
      );
      console.log('[Push] Backend subscribed:', backendSubscribed);

      const storedVapidKey = localStorage.getItem('push_vapid_key');
      const vapidKeyChanged = storedVapidKey !== null && storedVapidKey !== key;

      if (backendSubscribed && sub && !vapidKeyChanged) {
        this.isSubscribed.set(true);
        this.statusMsg.set('Active');
        return;
      }

      if (sub && (!backendSubscribed || vapidKeyChanged)) {
        if (vapidKeyChanged) console.log('[Push] VAPID key changed — forcing re-subscription');
        else console.log('[Push] Stale browser subscription — unsubscribing and re-subscribing fresh');
        await sub.unsubscribe();
        sub = null;
        if (vapidKeyChanged) {
          await firstValueFrom(this.http.delete(`${this.base}/unsubscribe-all`)).catch(() => {});
        }
      }

      if (!sub) {
        console.log('[Push] Creating new push subscription...');
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(key),
        });
        console.log('[Push] Subscription created:', sub.endpoint);
      }

      await firstValueFrom(this.http.post(`${this.base}/subscribe`, { subscription: sub.toJSON() }));
      localStorage.setItem('push_vapid_key', key);
      console.log('[Push] Subscription saved to backend');
      this.isSubscribed.set(true);
      this.statusMsg.set('Active');
    } catch (err) {
      console.warn('[Push] Subscription failed:', err);
      this.statusMsg.set('Failed: ' + ((err as any)?.message ?? 'unknown error'));
      this.isSubscribed.set(false);
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
