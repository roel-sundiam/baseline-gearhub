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
      .live-visitors-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .widget-toggle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        position: relative;
      }

      .widget-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
      }

      .visitor-count {
        font-size: 12px;
        position: absolute;
        top: 8px;
        right: 8px;
        background: #ff4757;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }

      .widget-panel {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.16);
        display: flex;
        flex-direction: column;
        max-height: 500px;
        overflow: hidden;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .widget-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 12px 12px 0 0;
      }

      .widget-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        flex: 1;
      }

      .header-actions {
        display: flex;
        gap: 6px;
      }

      .clear-btn,
      .close-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .clear-btn:hover,
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .close-btn {
        font-size: 20px;
        padding: 0 4px;
      }

      .widget-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }

      .no-visitors {
        padding: 20px;
        text-align: center;
        color: #999;
        font-size: 13px;
      }

      .visitor-item {
        padding: 8px 12px;
        border-bottom: 1px solid #f0f0f0;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
      }

      .visitor-item:hover {
        background: #f8f9fa;
      }

      .visitor-name {
        font-weight: 600;
        color: #333;
        min-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .visitor-role {
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 2px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .page-icon {
        font-size: 12px;
        flex-shrink: 0;
      }

      .page-name {
        color: #666;
        min-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .time-ago {
        color: #999;
        font-size: 11px;
        flex-shrink: 0;
        min-width: 50px;
        text-align: right;
      }

      .role-anonymous {
        background: #e8e8e8;
        color: #666;
      }

      .role-player {
        background: #d4edda;
        color: #155724;
      }

      .role-admin {
        background: #cfe2ff;
        color: #084298;
      }

      .role-superadmin {
        background: #f8d7da;
        color: #842029;
      }

      .widget-footer {
        background: #f8f9fa;
        border-top: 1px solid #f0f0f0;
        padding: 6px 12px;
        text-align: center;
        color: #999;
      }

      .widget-footer small {
        font-size: 11px;
      }

      @media (max-width: 600px) {
        .live-visitors-widget {
          bottom: 10px;
          right: 10px;
        }

        .widget-toggle {
          width: 50px;
          height: 50px;
          font-size: 18px;
        }

        .widget-panel {
          width: 280px;
          bottom: 70px;
        }
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
          // Play sound if new visits arrived
          if (data.count > this.previousCount) {
            this.playNotificationSound();
          }
          this.previousCount = data.count;

          this.allVisitorsHistory = data.visitors; // Get all accumulated visits
          this.visitorCount = data.count;
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
