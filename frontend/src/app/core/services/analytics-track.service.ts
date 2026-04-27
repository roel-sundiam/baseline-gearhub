import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

function resolveAppId(): string {
  const host = window.location.hostname;
  if (host.includes('tenisu')) return 'tenisuapp';
  return 'pvtennisclub';
}
const APP_ID = resolveAppId();

@Injectable({ providedIn: 'root' })
export class AnalyticsTrackService {
  private readonly endpoint = environment.analyticsTrackUrl;

  trackPageView(page: string, userId?: string): void {
    this.send({ event: 'page_view', appId: APP_ID, page, userId });
  }

  trackLogin(userId: string): void {
    this.send({ event: 'login', appId: APP_ID, userId });
  }

  private send(payload: object): void {
    if (!this.endpoint) return;
    try {
      fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
        credentials: 'omit',
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Tracking must never interrupt the user
    }
  }
}
