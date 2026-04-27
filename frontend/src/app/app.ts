import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { PageTrackingService } from './core/services/page-tracking.service';
import { LiveVisitorsWidgetComponent } from './features/admin/live-visitors-widget/live-visitors-widget.component';
import { AuthService } from './core/services/auth.service';

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
    <!-- Live Visitors Widget (superadmin only) -->
    @if (auth.isSuperAdmin()) {
      <app-live-visitors-widget></app-live-visitors-widget>
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
    `,
  ],
})
export class App {
  private router = inject(Router);
  private pageTracking = inject(PageTrackingService); // Initialize page tracking
  protected auth = inject(AuthService);

  isAuthRoute(): boolean {
    const url = this.router.url;
    return url.includes('/login') || url.includes('/register');
  }
}
