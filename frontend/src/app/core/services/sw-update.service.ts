import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  readonly updateAvailable = signal(false);
  private reg: ServiceWorkerRegistration | null = null;

  constructor() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(reg => {
      this.reg = reg;

      // Already a waiting worker (e.g. user revisited after deployment)
      if (reg.waiting && navigator.serviceWorker.controller) {
        this.updateAvailable.set(true);
      }

      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            this.reg = reg;
            this.updateAvailable.set(true);
          }
        });
      });

      // Check for updates when user returns to the tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });

      // Poll every 5 minutes for long-running open tabs
      setInterval(() => reg.update(), 5 * 60 * 1000);
    });

    // New SW activated after skipWaiting → reload to apply update
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  activateUpdate(): void {
    this.reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
}
