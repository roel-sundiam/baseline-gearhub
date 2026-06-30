import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnalyticsService,
  AnalyticsSummary,
  LoginRecord,
  PageVisitRecord,
  MostVisitedPage,
  TrendsResponse,
} from '../../../core/services/analytics.service';
import {
  LiveVisitorsService,
  LiveVisitor,
} from '../../../core/services/live-visitors.service';
import { forkJoin, Subscription, timeout } from 'rxjs';

interface TrendCard {
  label: string;
  value: number;
  isCurrency: boolean;
  pct: number | null;
  dir: 'up' | 'down' | 'flat';
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h2>📊 Site Analytics</h2>
      <div class="header-controls">
        @if (lastUpdated()) {
          <span class="last-updated">Updated {{ lastUpdated() | date: 'shortTime' }}</span>
        }
        <button class="refresh-btn" (click)="refresh()" [disabled]="refreshing()">
          {{ refreshing() ? 'Refreshing…' : '↻ Refresh' }}
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="loading">Loading analytics...</div>
    } @else if (errorMsg()) {
      <div class="alert alert-error">{{ errorMsg() }}</div>
    } @else {
      <!-- Summary Stats -->
      <div class="stats-grid">
        <div class="stat-card stat-users">
          <div class="stat-value">{{ summary().totalPlayers }}</div>
          <div class="stat-label">Players</div>
          <div class="stat-meta">Active: {{ summary().activeUsers }}</div>
        </div>

        <div class="stat-card stat-admins">
          <div class="stat-value">{{ summary().totalAdmins }}</div>
          <div class="stat-label">Staff</div>
          <div class="stat-meta">Administrators</div>
        </div>

        <div class="stat-card stat-sessions">
          <div class="stat-value">{{ summary().totalSessions }}</div>
          <div class="stat-label">Sessions</div>
          <div class="stat-meta">Court bookings</div>
        </div>

        <div class="stat-card stat-revenue">
          <div class="stat-value">
            {{ summary().totalRevenue | currency: 'PHP' : 'symbol' : '1.0-0' }}
          </div>
          <div class="stat-label">Total Revenue</div>
          <div class="stat-meta">All time</div>
        </div>

        <div class="stat-card stat-collected">
          <div class="stat-value">
            {{ summary().totalCollected | currency: 'PHP' : 'symbol' : '1.0-0' }}
          </div>
          <div class="stat-label">Collected</div>
          <div class="stat-meta">Paid charges</div>
        </div>

        <div class="stat-card stat-outstanding">
          <div class="stat-value">
            {{ summary().totalOutstanding | currency: 'PHP' : 'symbol' : '1.0-0' }}
          </div>
          <div class="stat-label">Outstanding</div>
          <div class="stat-meta">Unpaid charges</div>
        </div>

        <div class="stat-card stat-pending">
          <div class="stat-value">{{ summary().pendingUsers }}</div>
          <div class="stat-label">Pending</div>
          <div class="stat-meta">Awaiting approval</div>
        </div>

        <div class="stat-card stat-conversion">
          <div class="stat-value">{{ getConversionRate() }}%</div>
          <div class="stat-label">Approval Rate</div>
          <div class="stat-meta">Active / total</div>
        </div>
      </div>

      <!-- Live Visitors -->
      <div class="live-section">
        <div class="live-header">
          <h3>
            <span class="live-dot"></span> Live Visitors
            <span class="live-count">{{ liveVisitors().length }}</span>
          </h3>
          <span class="live-hint">Auto-refreshes every 10s</span>
        </div>
        @if (liveVisitors().length === 0) {
          <div class="empty-state">No active visitors right now</div>
        } @else {
          <div class="live-table">
            <div class="table-header">
              <div class="col-user">User</div>
              <div class="col-role">Role</div>
              <div class="col-page">Current Page</div>
              <div class="col-time">Last Activity</div>
            </div>
            @for (v of liveVisitors(); track v.sessionId) {
              <div class="table-row">
                <div class="col-user">{{ v.username }}</div>
                <div class="col-role">
                  <span class="role-badge" [class]="'role-' + v.role">{{ v.role }}</span>
                </div>
                <div class="col-page">{{ v.currentPage }}</div>
                <div class="col-time">{{ timeAgo(v.lastActivity) }}</div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Trends -->
      <div class="trends-section">
        <div class="trends-header">
          <h3>Trends</h3>
          <div class="range-toggle">
            @for (r of ranges; track r) {
              <button
                class="range-btn"
                [class.active]="range() === r"
                (click)="setRange(r)"
              >
                {{ r }}d
              </button>
            }
          </div>
        </div>
        @if (trends()) {
          <div class="trends-grid">
            @for (card of trendCards(); track card.label) {
              <div class="trend-card">
                <div class="trend-label">{{ card.label }}</div>
                <div class="trend-value">
                  @if (card.isCurrency) {
                    {{ card.value | currency: 'PHP' : 'symbol' : '1.0-0' }}
                  } @else {
                    {{ card.value }}
                  }
                </div>
                <div class="trend-delta" [class]="'delta-' + card.dir">
                  @if (card.pct === null) {
                    <span>— no prior data</span>
                  } @else {
                    <span>{{ card.dir === 'up' ? '▲' : card.dir === 'down' ? '▼' : '–' }}
                      {{ card.pct }}%</span>
                    <span class="trend-meta">vs prev {{ range() }}d</span>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">No trend data</div>
        }
      </div>

      <!-- Insights Section -->
      <div class="insights-section">
        <h3>Key Insights</h3>
        <div class="insights-grid">
          <div class="insight-card">
            <div class="insight-icon">👥</div>
            <div class="insight-text">
              <div class="insight-title">Player Engagement</div>
              <div class="insight-value">
                {{ summary().activeUsers }} of {{ summary().totalPlayers }} players approved
              </div>
            </div>
          </div>
          <div class="insight-card">
            <div class="insight-icon">💰</div>
            <div class="insight-text">
              <div class="insight-title">Collection Rate</div>
              <div class="insight-value">{{ getCollectionRate() }}% of revenue collected</div>
            </div>
          </div>
          <div class="insight-card">
            <div class="insight-icon">📈</div>
            <div class="insight-text">
              <div class="insight-title">Average per Session</div>
              <div class="insight-value">{{ getAveragePerSession() | currency: 'PHP' : 'symbol' }} per session</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Logins -->
      <div class="logins-section">
        <div class="section-head">
          <h3>Recent User Activity</h3>
          @if (logins().length > 0) {
            <button class="export-btn" (click)="exportLogins()">⬇ Export CSV</button>
          }
        </div>
        @if (logins().length === 0) {
          <div class="empty-state">No login history</div>
        } @else {
          <div class="login-table">
            <div class="table-header">
              <div class="col-username">User</div>
              <div class="col-club">Club</div>
              <div class="col-role">Role</div>
              <div class="col-time">Login Time</div>
            </div>
            @for (login of logins(); track login._id) {
              <div class="table-row">
                <div class="col-username">{{ login.username }}</div>
                <div class="col-club">{{ login.clubName ?? '—' }}</div>
                <div class="col-role">
                  <span class="role-badge" [class]="'role-' + login.role">{{ login.role }}</span>
                </div>
                <div class="col-time">{{ login.loginTime | date: 'short' }}</div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Most Visited Pages -->
      <div class="pages-section">
        <h3>📄 Most Visited Pages</h3>
        @if (mostVisitedPages().length === 0) {
          <div class="empty-state">No page visits recorded</div>
        } @else {
          <div class="pages-grid">
            @for (page of mostVisitedPages(); track page._id) {
              <div class="page-card">
                <div class="page-name">{{ page.pageName }}</div>
                <div class="page-stats">
                  <div class="stat">
                    <span class="stat-label">Visits:</span>
                    <span class="stat-value">{{ page.visits }}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Avg Time:</span>
                    <span class="stat-value">{{ formatTime(page.avgTimeSpent) }}</span>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Recent Page Visits -->
      <div class="page-visits-section">
        <div class="section-head">
          <h3>🔍 Recent Page Visits</h3>
          @if (recentPageVisits().length > 0) {
            <button class="export-btn" (click)="exportPageVisits()">⬇ Export CSV</button>
          }
        </div>
        @if (recentPageVisits().length === 0) {
          <div class="empty-state">No page visits recorded</div>
        } @else {
          <div class="visits-table">
            <div class="table-header">
              <div class="col-user">User</div>
              <div class="col-club">Club</div>
              <div class="col-page">Page</div>
              <div class="col-duration">Duration</div>
              <div class="col-time">Time</div>
            </div>
            @for (visit of recentPageVisits(); track visit._id) {
              <div class="table-row">
                <div class="col-user">{{ visit.username }}</div>
                <div class="col-club">{{ visit.clubName ?? '—' }}</div>
                <div class="col-page">{{ visit.pageName }}</div>
                <div class="col-duration">{{ formatTime(visit.timeSpent) }}</div>
                <div class="col-time">{{ visit.visitTime | date: 'short' }}</div>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .page-header {
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .page-header h2 {
        color: var(--dm-accent);
        font-size: 1.8rem;
        font-weight: 800;
      }
      .header-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .last-updated {
        color: rgba(255,255,255,0.5);
        font-size: 0.82rem;
      }
      .refresh-btn {
        background: rgba(163,230,53,0.12);
        color: var(--dm-accent);
        border: 1px solid rgba(163,230,53,0.24);
        border-radius: 8px;
        padding: 0.5rem 0.9rem;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .refresh-btn:hover:not(:disabled) {
        background: rgba(163,230,53,0.2);
      }
      .refresh-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .loading {
        color: rgba(255,255,255,0.62);
        padding: 2rem 0;
        text-align: center;
      }

      .alert {
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
      }
      .alert-error {
        background: rgba(239,68,68,0.12);
        color: #fca5a5;
        border: 1px solid rgba(239,68,68,0.2);
      }

      /* Stats Grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .stat-card {
        background: var(--dm-surface);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.24);
        border-left: 4px solid transparent;
        transition: all 0.2s;
      }

      .stat-card:hover {
        box-shadow: 0 4px 16px rgba(0,0,0,0.32);
        transform: translateY(-2px);
      }

      .stat-users {
        border-left-color: #93c5fd;
      }
      .stat-admins {
        border-left-color: #c4b5fd;
      }
      .stat-sessions {
        border-left-color: var(--dm-accent);
      }
      .stat-revenue {
        border-left-color: #fcd34d;
      }
      .stat-collected {
        border-left-color: #67e8f9;
      }
      .stat-outstanding {
        border-left-color: #fca5a5;
      }
      .stat-pending {
        border-left-color: #f472b6;
      }
      .stat-conversion {
        border-left-color: #5eead4;
      }

      .stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 0.25rem;
      }
      .stat-label {
        color: rgba(255,255,255,0.72);
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
      }
      .stat-meta {
        color: rgba(255,255,255,0.5);
        font-size: 0.8rem;
      }

      /* Live Visitors */
      .live-section {
        background: var(--dm-surface);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.24);
        margin-bottom: 2rem;
        border: 1px solid rgba(163,230,53,0.12);
      }
      .live-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .live-header h3 {
        color: var(--dm-accent);
        font-size: 1.1rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .live-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 0 0 rgba(74,222,128,0.7);
        animation: live-pulse 1.8s infinite;
      }
      @keyframes live-pulse {
        0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.55); }
        70% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
        100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
      }
      .live-count {
        background: rgba(74,222,128,0.16);
        color: #4ade80;
        border-radius: 20px;
        padding: 0.1rem 0.65rem;
        font-size: 0.9rem;
        font-weight: 700;
      }
      .live-hint {
        color: rgba(255,255,255,0.4);
        font-size: 0.78rem;
      }
      .live-table {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        overflow: hidden;
      }
      .live-table .table-header,
      .live-table .table-row {
        grid-template-columns: 1fr 0.8fr 1.2fr 1fr;
      }

      /* Trends */
      .trends-section {
        margin-bottom: 2rem;
      }
      .trends-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .trends-header h3 {
        color: var(--dm-accent);
        font-size: 1.1rem;
        font-weight: 700;
      }
      .range-toggle {
        display: inline-flex;
        background: var(--dm-surface);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        overflow: hidden;
      }
      .range-btn {
        background: transparent;
        color: rgba(255,255,255,0.62);
        border: none;
        padding: 0.45rem 0.9rem;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.15s;
      }
      .range-btn:hover {
        color: #ffffff;
      }
      .range-btn.active {
        background: rgba(163,230,53,0.16);
        color: var(--dm-accent);
      }
      .trends-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
      }
      .trend-card {
        background: var(--dm-surface);
        border-radius: 12px;
        padding: 1.25rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.24);
        border: 1px solid rgba(255,255,255,0.06);
      }
      .trend-label {
        color: rgba(255,255,255,0.72);
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 0.4rem;
      }
      .trend-value {
        font-size: 1.7rem;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 0.4rem;
      }
      .trend-delta {
        font-size: 0.82rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .trend-meta {
        color: rgba(255,255,255,0.4);
        font-weight: 500;
      }
      .delta-up { color: #4ade80; }
      .delta-down { color: #fca5a5; }
      .delta-flat { color: rgba(255,255,255,0.5); }

      /* Insights Section */
      .insights-section {
        margin-bottom: 2rem;
      }
      .insights-section h3 {
        color: var(--dm-accent);
        margin-bottom: 1rem;
        font-size: 1.1rem;
        font-weight: 700;
      }
      .insights-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
      }
      .insight-card {
        background: rgba(163,230,53,0.08);
        border-radius: 12px;
        padding: 1.5rem;
        display: flex;
        gap: 1rem;
        border: 1px solid rgba(163,230,53,0.12);
      }
      .insight-icon {
        font-size: 2rem;
        min-width: 60px;
        text-align: center;
      }
      .insight-text {
        flex: 1;
      }
      .insight-title {
        color: rgba(255,255,255,0.72);
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .insight-value {
        color: #ffffff;
        font-size: 1.1rem;
        font-weight: 700;
      }

      /* Section heads with export */
      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        gap: 1rem;
      }
      .section-head h3 {
        margin-bottom: 0;
      }
      .export-btn {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.8);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        padding: 0.4rem 0.8rem;
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }
      .export-btn:hover {
        background: rgba(255,255,255,0.12);
        color: #ffffff;
      }

      /* Logins Section */
      .logins-section {
        background: var(--dm-surface);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.24);
        border: 1px solid rgba(163,230,53,0.12);
      }
      .logins-section h3 {
        color: var(--dm-accent);
        margin-bottom: 1rem;
        font-size: 1.1rem;
        font-weight: 700;
      }

      .empty-state {
        color: rgba(255,255,255,0.5);
        text-align: center;
        padding: 2rem;
      }

      .login-table {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        overflow: hidden;
      }

      .table-header {
        background: rgba(255,255,255,0.04);
        display: grid;
        grid-template-columns: 1fr 1fr 0.8fr 1.2fr;
        gap: 1rem;
        padding: 1rem;
        font-size: 0.9rem;
        font-weight: 600;
        color: rgba(255,255,255,0.62);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }

      .table-row {
        display: grid;
        grid-template-columns: 1fr 1fr 0.8fr 1.2fr;
        gap: 1rem;
        padding: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        align-items: center;
        font-size: 0.9rem;
      }

      .table-row:last-child {
        border-bottom: none;
      }

      .table-row:hover {
        background: rgba(255,255,255,0.02);
      }

      .col-username {
        font-weight: 600;
        color: #ffffff;
      }

      .col-club {
        color: var(--dm-accent);
        font-size: 0.85rem;
        font-weight: 600;
      }

      .role-badge {
        display: inline-block;
        padding: 0.35rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .role-player {
        background: rgba(163,230,53,0.12);
        color: var(--dm-accent);
      }

      .role-admin {
        background: rgba(139,92,246,0.14);
        color: #c4b5fd;
      }

      .role-superadmin {
        background: rgba(168,85,247,0.14);
        color: #d8b4fe;
      }

      .role-anonymous {
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.6);
      }

      .col-time {
        color: rgba(255,255,255,0.62);
      }

      /* Pages Section */
      .pages-section {
        background: var(--dm-surface);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.24);
        margin: 2rem 0;
        border: 1px solid rgba(163,230,53,0.12);
      }
      .pages-section h3 {
        color: var(--dm-accent);
        margin-bottom: 1rem;
        font-size: 1.1rem;
      }
      .pages-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }
      .page-card {
        background: rgba(163,230,53,0.08);
        border-radius: 10px;
        padding: 1.25rem;
        border: 1px solid rgba(163,230,53,0.12);
      }
      .page-name {
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 0.75rem;
        font-size: 0.95rem;
      }
      .page-stats {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .page-stats .stat {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
      }
      .page-stats .stat-label {
        color: rgba(255,255,255,0.72);
      }
      .page-stats .stat-value {
        font-weight: 600;
        color: var(--dm-accent);
      }

      /* Page Visits Section */
      .page-visits-section {
        background: var(--dm-surface);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.24);
        border: 1px solid rgba(163,230,53,0.12);
      }
      .page-visits-section h3 {
        color: var(--dm-accent);
        margin-bottom: 1rem;
        font-size: 1.1rem;
      }
      .visits-table {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        overflow: hidden;
      }
      .visits-table .table-header {
        background: rgba(255,255,255,0.04);
        display: grid;
        grid-template-columns: 0.8fr 0.9fr 1fr 0.7fr 1fr;
        gap: 1rem;
        padding: 1rem;
        font-size: 0.9rem;
        font-weight: 600;
        color: rgba(255,255,255,0.62);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .visits-table .table-row {
        display: grid;
        grid-template-columns: 0.8fr 0.9fr 1fr 0.7fr 1fr;
        gap: 1rem;
        padding: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        align-items: center;
        font-size: 0.9rem;
      }
      .visits-table .col-club {
        color: var(--dm-accent);
        font-size: 0.85rem;
        font-weight: 600;
      }
      .visits-table .table-row:last-child {
        border-bottom: none;
      }
      .visits-table .table-row:hover {
        background: rgba(255,255,255,0.02);
      }
      .visits-table .col-user {
        font-weight: 600;
        color: #ffffff;
      }
      .visits-table .col-page {
        color: #ffffff;
      }
      .visits-table .col-duration {
        color: #c4b5fd;
        font-weight: 600;
      }
      .visits-table .col-time {
        color: rgba(255,255,255,0.62);
      }

      @media (max-width: 768px) {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .insights-grid {
          grid-template-columns: 1fr;
        }
        .table-header,
        .table-row {
          grid-template-columns: 1fr 0.8fr;
          gap: 0.75rem;
        }
        .col-club,
        .col-time {
          display: none;
        }
        .live-table .table-header,
        .live-table .table-row {
          grid-template-columns: 1fr 1fr;
        }
        .live-table .col-page {
          display: none;
        }
        .visits-table .table-header,
        .visits-table .table-row {
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .visits-table .col-club,
        .visits-table .col-duration,
        .visits-table .col-time {
          display: none;
        }
        .pages-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  loading = signal(true);
  refreshing = signal(false);
  errorMsg = signal('');
  lastUpdated = signal<Date | null>(null);

  summary = signal<AnalyticsSummary>({
    totalPlayers: 0,
    totalAdmins: 0,
    totalSessions: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalRevenue: 0,
    totalCollected: 0,
    totalOutstanding: 0,
  });
  logins = signal<LoginRecord[]>([]);
  mostVisitedPages = signal<MostVisitedPage[]>([]);
  recentPageVisits = signal<PageVisitRecord[]>([]);

  liveVisitors = signal<LiveVisitor[]>([]);
  trends = signal<TrendsResponse | null>(null);
  range = signal<number>(30);
  ranges = [7, 30, 90];

  private liveSub?: Subscription;

  trendCards = computed<TrendCard[]>(() => {
    const t = this.trends();
    if (!t) return [];
    const make = (
      label: string,
      curr: number,
      prev: number,
      isCurrency = false,
    ): TrendCard => ({
      label,
      value: curr,
      isCurrency,
      pct: this.pctChange(curr, prev),
      dir: curr > prev ? 'up' : curr < prev ? 'down' : 'flat',
    });
    return [
      make('New Players', t.current.newPlayers, t.previous.newPlayers),
      make('New Sessions', t.current.newSessions, t.previous.newSessions),
      make('Period Revenue', t.current.periodRevenue, t.previous.periodRevenue, true),
      make('Logins', t.current.logins, t.previous.logins),
      make('Page Visits', t.current.pageVisits, t.previous.pageVisits),
    ];
  });

  constructor(
    private analyticsService: AnalyticsService,
    private liveVisitorsService: LiveVisitorsService,
  ) {}

  ngOnInit() {
    this.load();
    this.loadTrends();
    this.liveSub = this.liveVisitorsService
      .getLiveVisitorsPolled(10000)
      .subscribe((res) => this.liveVisitors.set(res.visitors));
  }

  ngOnDestroy() {
    this.liveSub?.unsubscribe();
  }

  private load() {
    forkJoin({
      summary: this.analyticsService.getSummary(),
      logins: this.analyticsService.getLoginHistory(30),
      mostVisited: this.analyticsService.getMostVisitedPages(),
      recentVisits: this.analyticsService.getRecentPageVisits(50),
    })
      .pipe(timeout(8000))
      .subscribe({
        next: ({ summary, logins, mostVisited, recentVisits }) => {
          this.summary.set(summary.summary);
          this.logins.set(logins.logins);
          this.mostVisitedPages.set(mostVisited.pages);
          this.recentPageVisits.set(recentVisits.pageVisits);
          this.loading.set(false);
          this.refreshing.set(false);
          this.lastUpdated.set(new Date());
        },
        error: (err) => {
          console.error('Analytics error', err);
          this.loading.set(false);
          this.refreshing.set(false);
          if (err.name === 'TimeoutError') {
            this.errorMsg.set('Request timed out. Is the backend running?');
          } else if (err.status === 403) {
            this.errorMsg.set('Superadmin access required.');
          } else {
            this.errorMsg.set(`Error: ${err.status || err.message}`);
          }
        },
      });
  }

  private loadTrends() {
    this.analyticsService.getTrends(this.range()).subscribe({
      next: (res) => this.trends.set(res),
      error: (err) => console.error('Trends error', err),
    });
  }

  refresh() {
    this.refreshing.set(true);
    this.load();
    this.loadTrends();
  }

  setRange(days: number) {
    if (this.range() === days) return;
    this.range.set(days);
    this.loadTrends();
  }

  pctChange(curr: number, prev: number): number | null {
    if (prev === 0) return curr === 0 ? 0 : null;
    return Math.round(((curr - prev) / prev) * 100);
  }

  getConversionRate(): number {
    const s = this.summary();
    if (s.totalPlayers === 0) return 0;
    return Math.round((s.activeUsers / s.totalPlayers) * 100);
  }

  getCollectionRate(): number {
    const s = this.summary();
    if (s.totalRevenue === 0) return 0;
    return Math.round((s.totalCollected / s.totalRevenue) * 100);
  }

  getAveragePerSession(): number {
    const s = this.summary();
    if (s.totalSessions === 0) return 0;
    return s.totalRevenue / s.totalSessions;
  }

  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  }

  timeAgo(date: Date | string): string {
    const then = new Date(date).getTime();
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 10) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  }

  exportLogins() {
    this.exportCsv(
      this.logins(),
      [
        { key: 'username', label: 'User' },
        { key: 'clubName', label: 'Club' },
        { key: 'role', label: 'Role' },
        { key: 'loginTime', label: 'Login Time' },
      ],
      'recent-user-activity',
    );
  }

  exportPageVisits() {
    this.exportCsv(
      this.recentPageVisits(),
      [
        { key: 'username', label: 'User' },
        { key: 'clubName', label: 'Club' },
        { key: 'pageName', label: 'Page' },
        { key: 'timeSpent', label: 'Duration (s)' },
        { key: 'visitTime', label: 'Time' },
      ],
      'recent-page-visits',
    );
  }

  private exportCsv(
    rows: Record<string, any>[],
    columns: { key: string; label: string }[],
    filename: string,
  ) {
    const escape = (val: any) => {
      const s = val === null || val === undefined ? '' : String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => escape(c.label)).join(',');
    const body = rows
      .map((row) => columns.map((c) => escape(row[c.key])).join(','))
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
