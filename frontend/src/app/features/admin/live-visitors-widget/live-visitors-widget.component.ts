import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveVisitorsService, LiveVisitor } from '../../../core/services/live-visitors.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-live-visitors-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="live-visitors-widget" *ngIf="isSuperAdmin">
      <!-- Toggle Button -->
      <button class="widget-toggle" (click)="toggleWidget()" [class.collapsed]="!isExpanded">
        <span class="visitor-count">{{ visitorCount }}</span>
        <span class="icon">👥</span>
      </button>

      <!-- Expanded Widget -->
      <div class="widget-panel" *ngIf="isExpanded">
        <div class="widget-header">
          <h3>🔴 Live Visitors</h3>
          <div class="header-actions">
            <button class="clear-btn" (click)="clearVisitors()" title="Clear data">🗑️</button>
            <button class="close-btn" (click)="toggleWidget()">−</button>
          </div>
        </div>

        <div class="widget-content">
          <div *ngIf="allVisitorsHistory.length === 0" class="no-visitors">No visitor records yet</div>

          <div *ngFor="let visitor of allVisitorsHistory" class="visitor-item">
            <span class="visitor-name">{{ visitor.username }}</span>
            <span class="visitor-role" [class]="'role-' + visitor.role">{{ visitor.role }}</span>
            <span class="page-icon">📄</span>
            <span class="page-name">{{ visitor.currentPage }}</span>
            <span class="time-ago">{{ formatTimeAgo(visitor.lastActivity) }}</span>
          </div>
        </div>

        <div class="widget-footer">
          <small>Updated: {{ lastUpdateTime | date: 'HH:mm:ss' }}</small>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* ── Root ── */
      .live-visitors-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* ── FAB toggle button ── */
      .widget-toggle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: #6ee7b7;
        color: #065f46;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 18px rgba(52, 211, 153, 0.4), 0 0 0 2px rgba(52,211,153,0.25);
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
      }

      .widget-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 22px rgba(52, 211, 153, 0.55), 0 0 0 2px rgba(52,211,153,0.45);
      }

      .icon { font-size: 22px; line-height: 1; }

      .visitor-count {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ef4444;
        color: #ffffff;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        padding: 0 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        border: 2px solid #ffffff;
        line-height: 1;
      }

      /* ── Panel ── */
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)   scale(1);    }
      }

      .widget-panel {
        position: absolute;
        bottom: 68px;
        right: 0;
        width: 340px;
        background: #ffffff;
        border: 1px solid rgba(163, 230, 53, 0.25);
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
        display: flex;
        flex-direction: column;
        max-height: 480px;
        overflow: hidden;
        animation: slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      /* ── Header ── */
      .widget-header {
        background: #6ee7b7;
        border-bottom: 1px solid #34d399;
        padding: 12px 14px 11px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 16px 16px 0 0;
        flex-shrink: 0;
      }

      .widget-header h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: #065f46;
        letter-spacing: 0.01em;
        flex: 1;
      }

      .header-actions { display: flex; gap: 5px; }

      .clear-btn,
      .close-btn {
        background: rgba(6, 95, 70, 0.1);
        border: 1px solid rgba(6, 95, 70, 0.2);
        color: #065f46;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: background 0.15s;
        line-height: 1;
      }

      .clear-btn:hover,
      .close-btn:hover { background: rgba(6, 95, 70, 0.18); }

      .close-btn { font-size: 18px; padding: 2px 7px; }

      /* ── Content ── */
      .widget-content {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
        scrollbar-width: thin;
        scrollbar-color: rgba(163,230,53,0.2) transparent;
      }

      .widget-content::-webkit-scrollbar { width: 4px; }
      .widget-content::-webkit-scrollbar-track { background: transparent; }
      .widget-content::-webkit-scrollbar-thumb { background: rgba(163,230,53,0.25); border-radius: 4px; }

      .no-visitors {
        padding: 28px 16px;
        text-align: center;
        color: #9ca3af;
        font-size: 12.5px;
      }

      /* ── Visitor row ── */
      .visitor-item {
        padding: 7px 14px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        transition: background 0.15s;
      }

      .visitor-item:last-child { border-bottom: none; }

      .visitor-item:hover { background: #f9fdf5; }

      .visitor-name {
        font-weight: 700;
        color: #111f16;
        min-width: 90px;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-shrink: 0;
      }

      .visitor-role {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 700;
        flex-shrink: 0;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .role-anonymous { background: #f3f4f6; color: #6b7280; }
      .role-player    { background: #ecfccb; color: #3f6212; }
      .role-admin     { background: #dbeafe; color: #1d4ed8; }
      .role-superadmin{ background: #fce7f3; color: #9d174d; }

      .page-icon { font-size: 11px; flex-shrink: 0; opacity: 0.4; }

      .page-name {
        color: #6b7280;
        min-width: 60px;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }

      .time-ago {
        color: #9ca3af;
        font-size: 10.5px;
        flex-shrink: 0;
        min-width: 32px;
        text-align: right;
      }

      /* ── Footer ── */
      .widget-footer {
        background: #a7f3d0;
        border-top: 1px solid #34d399;
        padding: 6px 14px;
        text-align: center;
        border-radius: 0 0 16px 16px;
        flex-shrink: 0;
      }

      .widget-footer small {
        font-size: 10.5px;
        color: #065f46;
        letter-spacing: 0.02em;
      }

      /* ── Mobile ── */
      @media (max-width: 600px) {
        .live-visitors-widget { bottom: 10px; right: 10px; }
        .widget-toggle { width: 50px; height: 50px; }
        .icon { font-size: 19px; }
        .widget-panel { width: 300px; bottom: 62px; }
      }
    `,
  ],
})
export class LiveVisitorsWidgetComponent implements OnInit, OnDestroy {
  isSuperAdmin = false;
  isExpanded = false;
  allVisitorsHistory: LiveVisitor[] = []; // All accumulated visits from backend
  visitorCount = 0;
  lastUpdateTime = new Date();
  private destroy$ = new Subject<void>();
  private previousCount = 0;
  private audioContext: AudioContext | null = null;

  constructor(
    private liveVisitorsService: LiveVisitorsService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Check if user is superadmin
    this.isSuperAdmin = this.authService.isSuperAdmin();

    if (this.isSuperAdmin) {
      // Start polling for live visitors (backend returns accumulated page visits)
      this.liveVisitorsService
        .getLiveVisitorsPolled(5000)
        .pipe(takeUntil(this.destroy$))
        .subscribe((data: { visitors: LiveVisitor[]; count: number; timestamp: Date }) => {
          this.allVisitorsHistory = data.visitors.filter(v => v.role !== 'superadmin');
          this.visitorCount = this.allVisitorsHistory.length;

          // Only sound when non-superadmin count increases
          if (this.visitorCount > this.previousCount) {
            this.playNotificationSound();
          }
          this.previousCount = this.visitorCount;
          this.lastUpdateTime = new Date(data.timestamp);
          this.cdr.markForCheck();
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.liveVisitorsService.cleanup();
  }

  toggleWidget(): void {
    this.isExpanded = !this.isExpanded;
  }

  clearVisitors(): void {
    // Call backend to delete all visitor records
    this.liveVisitorsService.deleteAllVisits().subscribe({
      next: () => {
        console.log('Visitor history cleared from backend');
        this.allVisitorsHistory = [];
        this.visitorCount = 0;
        this.previousCount = 0;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error clearing visitor history:', error);
      },
    });
  }

  /**
   * Play a notification sound (beep) when a new visitor arrives
   */
  private playNotificationSound(): void {
    try {
      // Create audio context if not exists
      if (!this.audioContext) {
        this.audioContext = new (window as any).AudioContext() || new (window as any).webkitAudioContext();
      }

      const context = this.audioContext!; // Non-null assertion (we just created it above)
      const now = context.currentTime;

      // Create oscillator for beep sound
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Set sound parameters
      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      // Create envelope (attack, hold, release)
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      // Play the beep
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch (err) {
      console.warn('Could not play notification sound:', err);
    }
  }

  formatTimeAgo(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    }
    const hours = Math.floor(seconds / 3600);
    return `${hours}h`;
  }
}
