import { Component, inject, effect, signal, isDevMode } from '@angular/core';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { PageTrackingService } from './core/services/page-tracking.service';
import { LiveVisitorsWidgetComponent } from './features/admin/live-visitors-widget/live-visitors-widget.component';
import { AuthService } from './core/services/auth.service';
import { SwUpdateService } from './core/services/sw-update.service';
import { SoundService } from './core/services/sound.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, LiveVisitorsWidgetComponent],
  template: `
    <div class="court-bg">
      <div class="court-overlay"></div>
    </div>
    @if (!isAuthRoute()) {
      <app-navbar />
    }
    <main class="main-content" [class.full-bleed]="isAuthRoute()">
      <router-outlet />
    </main>

    <!-- Global navigation loader -->
    @if (navigating()) {
      <div class="cg-loader-overlay">
        <div class="cg-loader-scene">
          <img src="/CGLoader.png" alt="Loading" class="cg-loader-img" />
          <div class="cg-loader-spin-ring"></div>
          <div class="cg-loader-ball-glow"></div>
          <div class="cg-loader-bar"><div class="cg-loader-bar-fill"></div></div>
        </div>
      </div>
    }
    <!-- Live Visitors Widget (superadmin only) -->
    @if (auth.isSuperAdmin()) {
      <app-live-visitors-widget></app-live-visitors-widget>
    }

    <!-- PWA update banner -->
    @if (swUpdate.updateAvailable()) {
      <div class="update-banner">
        <div class="update-content">
          <i class="fas fa-circle-up"></i>
          <span>A new version of CourtGo is available.</span>
        </div>
        <div class="update-actions">
          <button class="update-btn-refresh" (click)="swUpdate.activateUpdate()">
            <i class="fas fa-rotate-right"></i> Refresh now
          </button>
          <button class="update-btn-later" (click)="swUpdate.updateAvailable.set(false)">
            Later
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .court-bg {
        position: fixed;
        inset: 0;
        background: url('/tennis-court-surface.png') center center / cover no-repeat;
        z-index: -1;
      }
      .court-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 18, 0, 0.35);
      }
      .main-content {
        min-height: calc(100vh - 60px);
        padding: 1.5rem;
        max-width: 1100px;
        margin: 0 auto;
        transition:
          max-width 0.2s,
          padding 0.2s;
      }
      .main-content.full-bleed {
        max-width: 100vw;
        margin: 0;
        padding: 0;
      }

      .update-banner {
        position: fixed;
        bottom: 1.25rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        background: #1b3028;
        border: 1px solid rgba(163,230,53,0.35);
        border-radius: 14px;
        padding: 0.85rem 1.1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-width: 300px;
        max-width: calc(100vw - 2rem);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(163,230,53,0.08) inset;
        animation: bannerSlide 0.3s cubic-bezier(0.16,1,0.3,1);
        flex-wrap: wrap;
      }
      @keyframes bannerSlide {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      .update-content {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.88rem;
        font-weight: 600;
        color: #ffffff;
      }
      .update-content i { color: #a3e635; font-size: 1rem; }
      .update-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
      }
      .update-btn-refresh {
        background: rgba(163,230,53,0.18);
        color: #a3e635;
        border: 1px solid rgba(163,230,53,0.4);
        border-radius: 8px;
        padding: 0.42rem 0.85rem;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        transition: background 0.15s;
      }
      .update-btn-refresh:hover { background: rgba(163,230,53,0.28); }
      .update-btn-later {
        background: transparent;
        color: rgba(255,255,255,0.5);
        border: none;
        font-size: 0.8rem;
        cursor: pointer;
        font-family: inherit;
        padding: 0.4rem 0.5rem;
        border-radius: 6px;
        transition: color 0.15s;
      }
      .update-btn-later:hover { color: rgba(255,255,255,0.8); }

      /* ── Global nav loader ── */
      .cg-loader-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: rgba(8, 20, 12, 0.96);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: cgFadeIn 0.2s ease-out;
      }
      @keyframes cgFadeIn { from { opacity: 0 } to { opacity: 1 } }
      .cg-loader-scene {
        position: relative;
        width: min(420px, 90vw);
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .cg-loader-img {
        width: 100%;
        display: block;
        border-radius: 12px;
        animation: cgPulse 2.4s ease-in-out infinite;
      }
      @keyframes cgPulse {
        0%, 100% { filter: brightness(1) drop-shadow(0 0 8px rgba(163,230,53,0.2)); }
        50%       { filter: brightness(1.08) drop-shadow(0 0 18px rgba(163,230,53,0.45)); }
      }
      .cg-loader-spin-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -54%);
        width: 54%;
        aspect-ratio: 1;
        border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: #a3e635;
        border-right-color: rgba(163,230,53,0.3);
        animation: cgSpin 1.6s linear infinite;
        pointer-events: none;
      }
      @keyframes cgSpin { to { transform: translate(-50%, -54%) rotate(360deg); } }
      .cg-loader-ball-glow {
        position: absolute;
        bottom: 22%;
        left: 50%;
        transform: translateX(-50%);
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #a3e635;
        animation: cgBallPulse 1.6s ease-in-out infinite;
        box-shadow: 0 0 8px 2px rgba(163,230,53,0.6);
        pointer-events: none;
      }
      @keyframes cgBallPulse {
        0%, 100% { transform: translateX(-50%) scale(1);   opacity: 0.85; }
        50%       { transform: translateX(-50%) scale(1.4); opacity: 1; }
      }
      .cg-loader-bar {
        width: 55%;
        height: 3px;
        background: rgba(163,230,53,0.12);
        border-radius: 99px;
        overflow: hidden;
        margin-top: -14%;
      }
      .cg-loader-bar-fill {
        height: 100%;
        width: 40%;
        background: linear-gradient(90deg, transparent, #a3e635, transparent);
        border-radius: 99px;
        animation: cgShimmer 1.4s ease-in-out infinite;
      }
      @keyframes cgShimmer {
        0%   { transform: translateX(-150%); }
        100% { transform: translateX(350%); }
      }
    `,
  ],
})
export class App {
  private router = inject(Router);
  private pageTracking = inject(PageTrackingService);
  protected auth = inject(AuthService);
  protected swUpdate = inject(SwUpdateService);
  private sound = inject(SoundService);
  protected navigating = signal(false);

  constructor() {
    effect(() => {
      if (this.swUpdate.updateAvailable()) this.sound.notification();
    });

    this.router.events.subscribe(e => {
      if (e instanceof NavigationStart) this.navigating.set(true);
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.navigating.set(false);
    });

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else CapApp.exitApp();
      });
    }
  }

  isAuthRoute(): boolean {
    const url = this.router.url;
    return url.includes('/login') || url.includes('/register') || url.startsWith('/book/');
  }
}
