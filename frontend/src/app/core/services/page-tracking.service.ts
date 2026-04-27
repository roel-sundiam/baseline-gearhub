import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { LiveVisitorsService } from './live-visitors.service';
import { AnalyticsTrackService } from './analytics-track.service';
import { environment } from '../../../environments/environment';

export interface PageVisitRecord {
  _id: string;
  userId: string;
  username: string;
  role: string;
  pageName: string;
  pageUrl: string;
  visitTime: string;
  timeSpent: number;
}

@Injectable({ providedIn: 'root' })
export class PageTrackingService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private liveVisitors = inject(LiveVisitorsService);
  private analyticsTrack = inject(AnalyticsTrackService);

  private currentPageStartTime: number | null = null;
  private currentPageName: string | null = null;
  private currentPageUrl: string | null = null;

  constructor() {
    this.initializeTracking();
  }

  private initializeTracking() {
    // Initialize current page immediately
    const currentUrl = this.router.url;
    this.currentPageName = this.getPageNameFromUrl(currentUrl);
    this.currentPageUrl = currentUrl;
    this.currentPageStartTime = Date.now();
    
    // Update live visitor on initialization
    this.updateLiveVisitor(currentUrl, this.currentPageName);

    // Track route changes
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Log previous page if exists (only for authenticated users)
        if (
          this.currentPageName &&
          this.currentPageUrl &&
          this.currentPageStartTime &&
          this.auth.isLoggedIn()
        ) {
          const timeSpent = Math.round((Date.now() - this.currentPageStartTime) / 1000);
          this.logPageVisit(this.currentPageName, this.currentPageUrl, timeSpent);
        }

        // Start tracking new page
        this.currentPageUrl = event.urlAfterRedirects;
        this.currentPageName = this.getPageNameFromUrl(event.urlAfterRedirects);
        this.currentPageStartTime = Date.now();

        // Send page view to analytics dashboard
        const user = this.auth.getUser();
        this.analyticsTrack.trackPageView(event.urlAfterRedirects, user?.username);

        // Update live visitors for all users (authenticated and anonymous)
        this.updateLiveVisitor(event.urlAfterRedirects, this.currentPageName);
      });
  }

  private getPageNameFromUrl(url: string): string {
    // Extract meaningful page name from URL
    const parts = url.split('/').filter((p) => p);

    if (url.includes('/player/dashboard')) return 'player-dashboard';
    if (url.includes('/player/directory')) return 'member-directory';
    if (url.includes('/player/profile/edit')) return 'profile-edit';
    if (url.includes('/admin/dashboard')) return 'admin-dashboard';
    if (url.includes('/admin/analytics')) return 'site-analytics';
    if (url.includes('/admin/users')) return 'manage-users';
    if (url.includes('/admin/rates')) return 'manage-rates';
    if (url.includes('/admin/sessions'))
      return url.includes('/new') ? 'record-session' : 'manage-sessions';
    if (url.includes('/login')) return 'login';
    if (url.includes('/register')) return 'register';

    return parts[parts.length - 1] || 'unknown';
  }

  private logPageVisit(pageName: string, pageUrl: string, timeSpent: number) {
    this.http
      .post(`${environment.apiUrl}/analytics/page-visit`, {
        pageName,
        pageUrl,
        timeSpent,
      })
      .subscribe({
        next: () => console.log('✓ Page visit logged:', pageName),
        error: (err) => console.error('Failed to log page visit:', err),
      });
  }

  /**
   * Update live visitor status (called on every page navigation)
   * Supports both authenticated and anonymous users
   */
  private updateLiveVisitor(pageUrl: string, pageName: string) {
    const user = this.auth.getUser();
    const userId = user?.id || null;
    const username = user?.username || 'Anonymous';
    const role = user?.role || 'anonymous';

    this.liveVisitors
      .updateLiveVisitor(userId, username, role, pageName, pageUrl)
      .subscribe({
        next: () => console.log('✓ Live visitor updated:', username, pageName),
        error: (err) => console.error('Failed to update live visitor:', err),
      });
  }

  // Public methods for analytics service
  getMostVisitedPages() {
    return this.http.get<{ pages: any[] }>(`${environment.apiUrl}/analytics/most-visited-pages`);
  }

  getRecentPageVisits(limit = 100) {
    return this.http.get<{ pageVisits: PageVisitRecord[] }>(
      `${environment.apiUrl}/analytics/recent-page-visits?limit=${limit}`,
    );
  }
}
