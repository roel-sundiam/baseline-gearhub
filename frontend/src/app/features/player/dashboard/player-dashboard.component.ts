import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SessionsService } from '../../../core/services/sessions.service';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationService, Reservation, ReservationPlayer } from '../../../core/services/reservation.service';

@Component({
  selector: 'app-player-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="court-bg">
        <div class="court-overlay"></div>
      </div>

      <!-- Page card -->
      <div class="page-card">
        <div class="card-header">
          <div>
            <h2>Welcome to Your Dashboard</h2>
            <span class="welcome">{{ auth.user()?.name }}</span>
          </div>
          <div class="balance-summary" [class.all-clear]="outstanding === 0">
            <span class="balance-icon">{{ outstanding > 0 ? '⚠️' : '✅' }}</span>
            <div>
              <div class="balance-amount">
                {{ outstanding > 0 ? (outstanding | currency: 'PHP' : 'symbol') : 'All Paid' }}
              </div>
              <div class="balance-label">{{ outstanding > 0 ? 'Outstanding' : 'Balance' }}</div>
            </div>
          </div>
        </div>

        <div class="card-body">
          @if (loading) {
            <div class="loading">Loading your dashboard...</div>
          } @else {
            <!-- Quick Actions Grid -->
            <div class="grid-section">
              <h3 class="grid-title">Quick Actions</h3>
              <div class="action-grid">
                <!-- Reserve Court Card -->
                <div class="action-card reserve-court" (click)="navigateTo('/player/reserve')">
                  <div class="card-badge reserve-badge">Available</div>
                  <div class="card-icon-container">
                    <i class="fas fa-border-all card-icon"></i>
                  </div>
                  <h4>Reserve Court</h4>
                  <p>Book your next game</p>
                  <div class="card-footer">
                    <span class="card-meta">Open now →</span>
                  </div>
                </div>

                <!-- My Reservations Card -->
                <div class="action-card reservations" (click)="navigateTo('/player/reservations')">
                  <div class="card-badge reservations-badge">View</div>
                  <div class="card-icon-container">
                    <i class="fas fa-calendar-check card-icon"></i>
                  </div>
                  <h4>My Reservations</h4>
                  <p>View your bookings</p>
                  <div class="card-footer">
                    <span class="card-meta">Active 2 →</span>
                  </div>
                </div>

                <!-- Payments Card -->
                <div class="action-card payments" (click)="navigateTo('/payments')">
                  <div class="card-badge payments-badge">
                    {{ outstanding > 0 ? 'Due' : 'Paid' }}
                  </div>
                  <div class="card-icon-container">
                    <i class="fas fa-credit-card card-icon"></i>
                  </div>
                  <h4>Payments</h4>
                  <p>Manage payments</p>
                  <div class="card-footer">
                    <span class="card-meta">{{
                      outstanding > 0 ? 'Review →' : 'All clear →'
                    }}</span>
                  </div>
                </div>

                <!-- Member Directory Card -->
                <div class="action-card directory" (click)="navigateTo('/player/directory')">
                  <div class="card-badge directory-badge">Connect</div>
                  <div class="card-icon-container">
                    <i class="fas fa-users card-icon"></i>
                  </div>
                  <h4>Member Directory</h4>
                  <p>Connect with members</p>
                  <div class="card-footer">
                    <span class="card-meta">580 members →</span>
                  </div>
                </div>

                <!-- Rules & Regulations Card -->
                <div class="action-card rules" (click)="navigateTo('/rules')">
                  <div class="card-badge rules-badge">Guidelines</div>
                  <div class="card-icon-container">
                    <i class="fas fa-gavel card-icon"></i>
                  </div>
                  <h4>Rules & Regulations</h4>
                  <p>Club guidelines</p>
                  <div class="card-footer">
                    <span class="card-meta">Read →</span>
                  </div>
                </div>

                <!-- Tournaments Card -->
                <div class="action-card tournaments" (click)="navigateTo('/player/tournaments')">
                  <div class="card-badge tournaments-badge">Live</div>
                  <div class="card-icon-container">
                    <div style="font-size: 2.5rem;">🏆</div>
                  </div>
                  <h4>Tournaments</h4>
                  <p>Compete &amp; win</p>
                  <div class="card-footer">
                    <span class="card-meta">View →</span>
                  </div>
                </div>

                <div class="action-card rankings" (click)="navigateTo('/player/tournaments?tab=rankings')">
                  <div class="card-badge rankings-badge">Overall</div>
                  <div class="card-icon-container">
                    <div style="font-size: 2.5rem;">🏅</div>
                  </div>
                  <h4>Rankings</h4>
                  <p>Men's &amp; Women's standings</p>
                  <div class="card-footer">
                    <span class="card-meta">View leaderboard →</span>
                  </div>
                </div>

              </div>
            </div>

            <!-- Club Management Section (admin/superadmin only) -->
            @if (auth.isAdmin()) {
              <div class="grid-section">
                <div class="admin-section-heading">
                  <div class="admin-section-title-row">
                    <i class="fas fa-shield-alt admin-section-icon"></i>
                    <h3 class="grid-title" style="margin:0">Club Management</h3>
                  </div>
                  <span class="admin-section-badge">{{ auth.isSuperAdmin() ? 'Super Admin' : 'Admin' }}</span>
                </div>
                <div class="action-grid">

                  <!-- Member Management -->
                  <div class="action-card member-mgmt" (click)="navigateTo('/admin/users')">
                    <div class="card-badge member-mgmt-badge">Manage</div>
                    <div class="card-icon-container">
                      <i class="fas fa-users-cog card-icon"></i>
                    </div>
                    <h4>Member Management</h4>
                    <p>Manage club members</p>
                    <div class="card-footer">
                      <span class="card-meta">View members →</span>
                    </div>
                  </div>

                  <!-- Payment Approvals -->
                  <div class="action-card payment-approvals" (click)="navigateTo('/player/payment-approvals')">
                    <div class="card-badge approvals-badge">Manage</div>
                    <div class="card-icon-container">
                      <i class="fas fa-clipboard-check card-icon"></i>
                    </div>
                    <h4>Payment Approvals</h4>
                    <p>Approve payments</p>
                    <div class="card-footer">
                      <span class="card-meta">Review →</span>
                    </div>
                  </div>

                  <!-- Finance -->
                  <div class="action-card finance" (click)="navigateTo('/admin/finance')">
                    <div class="card-badge finance-badge">Admin</div>
                    <div class="card-icon-container">
                      <i class="fas fa-coins card-icon"></i>
                    </div>
                    <h4>Finance</h4>
                    <p>Approved payments</p>
                    <div class="card-footer">
                      <span class="card-meta">View report →</span>
                    </div>
                  </div>

                  <!-- Tournaments Management -->
                  <div class="action-card admin-tournaments" (click)="navigateTo('/admin/tournaments')">
                    <div class="card-badge tournaments-admin-badge">Admin</div>
                    <div class="card-icon-container">
                      <div style="font-size: 2.5rem;">🏆</div>
                    </div>
                    <h4>Tournaments</h4>
                    <p>Manage tournaments</p>
                    <div class="card-footer">
                      <span class="card-meta">Manage →</span>
                    </div>
                  </div>

                  <!-- Admin Dashboard -->
                  @if (auth.isAdmin()) {
                    <div class="action-card admin-dashboard" (click)="navigateTo('/admin/dashboard')">
                      <div class="card-badge admin-badge">Admin</div>
                      <div class="card-icon-container">
                        <i class="fas fa-cogs card-icon"></i>
                      </div>
                      <h4>Admin Dashboard</h4>
                      <p>Manage club</p>
                      <div class="card-footer">
                        <span class="card-meta">Manage →</span>
                      </div>
                    </div>
                  }

                  <!-- Site Analytics (superadmin only) -->
                  @if (auth.isSuperAdmin()) {
                    <div class="action-card analytics" (click)="navigateTo('/admin/analytics')">
                      <div class="card-badge analytics-badge">Analytics</div>
                      <div class="card-icon-container">
                        <div style="font-size: 2.5rem;">📊</div>
                      </div>
                      <h4>Site Analytics</h4>
                      <p>View site metrics</p>
                      <div class="card-footer">
                        <span class="card-meta">Analytics →</span>
                      </div>
                    </div>
                  }

                </div>
              </div>
            }

            <!-- Court Schedule Calendar -->
            <div class="grid-section">
              <h3 class="grid-title">Court Schedule</h3>
              <div class="calendar-container">
                <div class="calendar-header">
                  <button class="calendar-nav-btn" (click)="prevMonth()">‹</button>
                  <h4 class="calendar-title">{{ currentMonth | date: 'MMMM yyyy' }}</h4>
                  <button class="calendar-nav-btn" (click)="nextMonth()">›</button>
                </div>
                <div class="calendar-weekdays">
                  <div class="weekday" *ngFor="let day of weekdays">{{ day }}</div>
                </div>
                <div class="calendar-grid">
                  <div
                    *ngFor="let day of calendarDays"
                    class="calendar-day"
                    [class.other-month]="!day.currentMonth"
                    [class.today]="day.isToday"
                    [class.has-event]="day.hasEvent"
                    [class.selected]="isDateSelected(day)"
                    (click)="selectDay(day)"
                  >
                    <span class="day-number">{{ day.date }}</span>
                    <div class="day-indicators">
                      @if (day.reservationCount > 0) {
                        <div class="indicator-badge reservation-badge" title="Reservations: {{ day.reservationCount }}">
                          {{ day.reservationCount }}
                        </div>
                      }
                      @if (day.chargeCount > 0) {
                        <div class="indicator-badge session-badge" title="Sessions: {{ day.chargeCount }}">
                          {{ day.chargeCount }}
                        </div>
                      }
                    </div>
                  </div>
                </div>
                
                <!-- Calendar Legend -->
                <div class="calendar-legend">
                  <div class="legend-item">
                    <div class="legend-badge reservation-badge">R</div>
                    <span>Reservations</span>
                  </div>
                  <div class="legend-item">
                    <div class="legend-badge session-badge">S</div>
                    <span>Sessions</span>
                  </div>
                </div>

                <!-- Selected Day Reservations -->
                @if (selectedDate) {
                  <div class="selected-day-section">
                    <div class="selected-day-header">
                      <h4 class="selected-day-title">
                        {{ selectedDate | date: 'EEEE, MMMM d, yyyy' }}
                      </h4>
                      <button class="clear-selection-btn" (click)="selectedDate = null" title="Clear selection">
                        ✕
                      </button>
                    </div>

                    @if (getSelectedDayReservations().length === 0) {
                      <div class="empty-reservations">
                        <p>No reservations on this day</p>
                      </div>
                    } @else {
                      <div class="courts-container">
                        <!-- Court 1 Section -->
                        @if (getReservationsByCourtForSelectedDay().court1.length > 0) {
                          <div class="court-section">
                            <div class="court-section-header">
                              <h4 class="court-title">Court 1</h4>
                              <span class="court-count">{{ getReservationsByCourtForSelectedDay().court1.length }}</span>
                            </div>
                            <div class="reservations-list">
                              @for (reservation of getReservationsByCourtForSelectedDay().court1; track reservation._id) {
                                <div class="reservation-card">
                                  <div class="reservation-header">
                                    <div class="reservation-time">
                                      <span class="time-label">🕐</span>
                                      <span class="time-value">{{ formatTimeSlot(reservation.timeSlot) }}</span>
                                    </div>
                                    @if (reservation.hasLights) {
                                      <span class="lights-badge">💡 Lights</span>
                                    }
                                  </div>
                                  <div class="players-info">
                                    @if (reservation.players && reservation.players.length > 0) {
                                      <span class="players-label">👥 Players:</span>
                                    } @else if (isPlayerObject(reservation.player)) {
                                      <span class="players-label">👤 Reserver:</span>
                                    }
                                    <span class="players-list">
                                      @if (isPlayerObject(reservation.player)) {
                                        <span class="player-name reserver">{{ reservation.player.name }}</span>
                                        @if (reservation.players && reservation.players.length > 0) {
                                          <span class="separator">,</span>
                                        }
                                      }
                                      @if (reservation.players && reservation.players.length > 0) {
                                        @for (player of reservation.players; track player._id; let last = $last) {
                                          <span class="player-name">{{ player.name }}</span>
                                          @if (!last) {
                                            <span class="separator">,</span>
                                          }
                                        }
                                      }
                                    </span>
                                  </div>
                                  <div class="reservation-status">
                                    <span class="status-badge" [class.confirmed]="reservation.status === 'confirmed'">
                                      {{ reservation.status | titlecase }}
                                    </span>
                                  </div>
                                </div>
                              }
                            </div>
                          </div>
                        }

                        <!-- Court 2 Section -->
                        @if (getReservationsByCourtForSelectedDay().court2.length > 0) {
                          <div class="court-section">
                            <div class="court-section-header">
                              <h4 class="court-title">Court 2</h4>
                              <span class="court-count">{{ getReservationsByCourtForSelectedDay().court2.length }}</span>
                            </div>
                            <div class="reservations-list">
                              @for (reservation of getReservationsByCourtForSelectedDay().court2; track reservation._id) {
                                <div class="reservation-card">
                                  <div class="reservation-header">
                                    <div class="reservation-time">
                                      <span class="time-label">🕐</span>
                                      <span class="time-value">{{ formatTimeSlot(reservation.timeSlot) }}</span>
                                    </div>
                                    @if (reservation.hasLights) {
                                      <span class="lights-badge">💡 Lights</span>
                                    }
                                  </div>
                                  <div class="players-info">
                                    @if (reservation.players && reservation.players.length > 0) {
                                      <span class="players-label">👥 Players:</span>
                                    } @else if (isPlayerObject(reservation.player)) {
                                      <span class="players-label">👤 Reserver:</span>
                                    }
                                    <span class="players-list">
                                      @if (isPlayerObject(reservation.player)) {
                                        <span class="player-name reserver">{{ reservation.player.name }}</span>
                                        @if (reservation.players && reservation.players.length > 0) {
                                          <span class="separator">,</span>
                                        }
                                      }
                                      @if (reservation.players && reservation.players.length > 0) {
                                        @for (player of reservation.players; track player._id; let last = $last) {
                                          <span class="player-name">{{ player.name }}</span>
                                          @if (!last) {
                                            <span class="separator">,</span>
                                          }
                                        }
                                      }
                                    </span>
                                  </div>
                                  <div class="reservation-status">
                                    <span class="status-badge" [class.confirmed]="reservation.status === 'confirmed'">
                                      {{ reservation.status | titlecase }}
                                    </span>
                                  </div>
                                </div>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: auto;
      }
      .dashboard-container {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        margin: 0;
        min-height: calc(100vh - 60px);
        background: linear-gradient(135deg, rgba(0, 18, 0, 0.15), rgba(0, 18, 0, 0.05));
      }
      .court-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: url('/tennis-court-surface.png') center center / cover no-repeat;
        z-index: 0;
      }
      .court-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 18, 0, 0.35);
        z-index: 0;
      }
      .page-card {
        position: relative;
        z-index: 1;
        background: #fff;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
      }
      .card-header {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        padding: 1.5rem 2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1.5rem;
      }
      .card-header > div:first-child h2 {
        color: #fff;
        font-size: 1.6rem;
        font-weight: 800;
        margin: 0;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      .welcome {
        color: rgba(255, 255, 255, 0.88);
        font-size: 0.9rem;
        font-style: italic;
        display: block;
        margin-top: 0.3rem;
      }
      .balance-summary {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: rgba(255, 255, 255, 0.15);
        padding: 0.75rem 1rem;
        border-radius: 10px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .balance-summary.all-clear {
        background: rgba(209, 250, 229, 0.15);
        border-color: rgba(209, 250, 229, 0.3);
      }
      .balance-icon {
        font-size: 1.5rem;
      }
      .balance-amount {
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
        margin: 0;
      }
      .balance-label {
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.75rem;
        margin: 0;
      }
      .card-body {
        padding: 2rem;
      }

      .loading {
        color: #666;
        padding: 2rem 0;
        text-align: center;
      }

      .grid-section {
        margin-bottom: 2.5rem;
      }
      .admin-section-heading {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
        padding: 12px 16px;
        background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(109,40,217,0.05));
        border-radius: 10px; border-left: 4px solid #7c3aed;
      }
      .admin-section-title-row { display: flex; align-items: center; gap: 0.6rem; }
      .admin-section-icon { color: #7c3aed; font-size: 1rem; }
      .admin-section-badge {
        font-size: 0.7rem; font-weight: 700; padding: 4px 10px;
        background: #7c3aed; color: #fff; border-radius: 20px; letter-spacing: 0.4px;
        text-transform: uppercase;
      }
      .grid-title {
        color: #9f7338;
        font-size: 1.1rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin: 0 0 1.5rem 0;
        display: flex;
        align-items: center;
      }
      .grid-title::before {
        content: '';
        width: 4px;
        height: 20px;
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        border-radius: 2px;
        margin-right: 0.8rem;
      }

      .action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .action-card {
        position: relative;
        background: rgba(255, 255, 255, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 16px;
        padding: 1.5rem 1.25rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.08),
          inset 0 1px 1px rgba(255, 255, 255, 0.6),
          inset 0 -1px 1px rgba(0, 0, 0, 0.05);
      }
      .action-card::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.6s;
        pointer-events: none;
      }
      .action-card:hover::before {
        opacity: 1;
      }
      .action-card:hover {
        transform: translateY(-8px) scale(1.02);
        background: rgba(255, 255, 255, 0.95);
        border-color: rgba(255, 255, 255, 0.8);
        box-shadow:
          0 20px 48px rgba(0, 0, 0, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8),
          inset 0 -1px 1px rgba(0, 0, 0, 0.08);
      }
      .action-card.reserve-court {
        border: 1px solid rgba(255, 193, 7, 0.3);
      }
      .action-card.reserve-court:hover {
        background: linear-gradient(135deg, rgba(255, 243, 199, 0.9), rgba(255, 235, 154, 0.9));
        border-color: rgba(255, 193, 7, 0.6);
        box-shadow:
          0 20px 48px rgba(255, 193, 7, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }
      .action-card.reservations {
        border: 1px solid rgba(59, 130, 246, 0.3);
      }
      .action-card.reservations:hover {
        background: linear-gradient(135deg, rgba(219, 234, 254, 0.9), rgba(191, 219, 254, 0.9));
        border-color: rgba(59, 130, 246, 0.6);
        box-shadow:
          0 20px 48px rgba(59, 130, 246, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }
      .action-card.payments {
        border: 1px solid rgba(201, 161, 93, 0.3);
      }
      .action-card.payments:hover {
        background: linear-gradient(135deg, rgba(209, 250, 229, 0.9), rgba(167, 243, 208, 0.9));
        border-color: rgba(201, 161, 93, 0.6);
        box-shadow:
          0 20px 48px rgba(201, 161, 93, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }
      .action-card.directory {
        border: 1px solid rgba(168, 85, 247, 0.3);
      }
      .action-card.directory:hover {
        background: linear-gradient(135deg, rgba(233, 213, 255, 0.9), rgba(216, 180, 254, 0.9));
        border-color: rgba(168, 85, 247, 0.6);
        box-shadow:
          0 20px 48px rgba(168, 85, 247, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }
      .action-card.rules {
        border: 1px solid rgba(249, 115, 22, 0.3);
      }
      .action-card.rules:hover {
        background: linear-gradient(135deg, rgba(254, 215, 170, 0.9), rgba(253, 186, 116, 0.9));
        border-color: rgba(249, 115, 22, 0.6);
        box-shadow:
          0 20px 48px rgba(249, 115, 22, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }

      /* Member Management Card */
      .action-card.member-mgmt {
        border: 1px solid rgba(14, 165, 233, 0.3);
      }
      .action-card.member-mgmt:hover {
        background: linear-gradient(135deg, rgba(224, 242, 254, 0.9), rgba(186, 230, 253, 0.9));
        border-color: rgba(14, 165, 233, 0.6);
        box-shadow: 0 20px 48px rgba(14, 165, 233, 0.15), inset 0 1px 1px rgba(255,255,255,0.8);
      }
      .action-card.member-mgmt .card-icon { color: #0ea5e9; }
      .action-card.member-mgmt:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(14, 165, 233, 0.4));
      }
      .member-mgmt-badge {
        background: rgba(14, 165, 233, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
      }

      /* Payment Approvals Card */
      .action-card.payment-approvals {
        border: 1px solid rgba(245, 158, 11, 0.3);
      }
      .action-card.payment-approvals:hover {
        background: linear-gradient(135deg, rgba(255, 251, 235, 0.9), rgba(254, 243, 199, 0.9));
        border-color: rgba(245, 158, 11, 0.6);
        box-shadow:
          0 20px 48px rgba(245, 158, 11, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }
      .action-card.payment-approvals .card-icon { color: #f59e0b; }
      .action-card.payment-approvals:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(245, 158, 11, 0.4));
      }
      .approvals-badge {
        background: rgba(245, 158, 11, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
      }
      .approvals-badge-rejected {
        background: rgba(239, 68, 68, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      }
      .approvals-badge-clear {
        background: rgba(201, 161, 93, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(201, 161, 93, 0.3);
      }

      /* Finance Card */
      .action-card.finance {
        border: 1px solid rgba(184, 137, 66, 0.3);
      }
      .action-card.finance:hover {
        background: linear-gradient(135deg, rgba(209, 250, 229, 0.9), rgba(167, 243, 208, 0.9));
        border-color: rgba(184, 137, 66, 0.6);
        box-shadow: 0 20px 48px rgba(184, 137, 66, 0.15), inset 0 1px 1px rgba(255,255,255,0.8);
      }
      .action-card.finance .card-icon { color: #b88942; }
      .action-card.finance:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(184, 137, 66, 0.4));
      }
      .finance-badge {
        background: rgba(184, 137, 66, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(184, 137, 66, 0.3);
      }

      /* Admin Dashboard Card */
      .action-card.admin-dashboard {
        border: 1px solid rgba(139, 92, 246, 0.3);
      }
      .action-card.admin-dashboard:hover {
        background: linear-gradient(135deg, rgba(233, 213, 255, 0.9), rgba(216, 180, 254, 0.9));
        border-color: rgba(139, 92, 246, 0.6);
        box-shadow:
          0 20px 48px rgba(139, 92, 246, 0.15),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }

      /* Site Analytics Card */
      .action-card.analytics {
        border: 1px solid rgba(139, 92, 246, 0.3);
      }
      .action-card.analytics:hover {
        background: linear-gradient(135deg, rgba(217, 119, 255, 0.9), rgba(167, 139, 250, 0.9));
        border-color: rgba(139, 92, 246, 0.8);
        box-shadow:
          0 20px 48px rgba(139, 92, 246, 0.2),
          inset 0 1px 1px rgba(255, 255, 255, 0.8);
      }

      .card-badge {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        padding: 0.35rem 0.75rem;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        opacity: 0;
        transform: scale(0.8);
        transition: all 0.4s;
      }
      .action-card:hover .card-badge {
        opacity: 1;
        transform: scale(1);
      }
      .reserve-badge {
        background: rgba(255, 193, 7, 0.9);
        color: #8b6a00;
        box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
      }
      .reservations-badge {
        background: rgba(59, 130, 246, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      }
      .payments-badge {
        background: rgba(201, 161, 93, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(201, 161, 93, 0.3);
      }
      .directory-badge {
        background: rgba(168, 85, 247, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3);
      }
      .rules-badge {
        background: rgba(249, 115, 22, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
      }
      .admin-badge {
        background: rgba(139, 92, 246, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
      }
      .analytics-badge {
        background: rgba(168, 85, 247, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3);
      }

      /* Tournaments Card */
      .action-card.tournaments {
        border: 1px solid rgba(20, 184, 166, 0.3);
        cursor: pointer;
      }
      .tournaments-badge {
        background: rgba(20, 184, 166, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(20, 184, 166, 0.3);
      }
      .action-card.rankings {
        border: 1px solid rgba(217, 119, 6, 0.3);
        cursor: pointer;
      }
      .rankings-badge {
        background: rgba(217, 119, 6, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(217, 119, 6, 0.3);
      }
      .tournaments-admin-badge {
        background: rgba(245, 158, 11, 0.9);
        color: #fff;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
      }

      .card-icon-container {
        width: 70px;
        height: 70px;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.9) 0%,
          rgba(240, 245, 250, 0.8) 100%
        );
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.75rem;
        box-shadow:
          0 8px 16px rgba(0, 0, 0, 0.08),
          0 -4px 8px rgba(255, 255, 255, 0.8) inset,
          0 4px 8px rgba(0, 0, 0, 0.06) inset;
        transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        perspective: 1000px;
      }
      .card-icon-container::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.6), transparent);
        pointer-events: none;
      }
      .action-card:hover .card-icon-container {
        transform: scale(1.2) rotateX(10deg) rotateY(-10deg) rotateZ(5deg);
        box-shadow:
          0 16px 32px rgba(0, 0, 0, 0.15),
          0 -6px 12px rgba(255, 255, 255, 0.9) inset,
          0 6px 12px rgba(0, 0, 0, 0.08) inset,
          0 0 20px rgba(159, 115, 56, 0.2);
      }
      .card-icon {
        font-size: 2.5rem;
        display: flex !important;
        align-items: center;
        justify-content: center;
        transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-weight: 600;
        position: relative;
        z-index: 1;
        line-height: 1;
      }
      .action-card.reserve-court .card-icon {
        color: #f59e0b;
      }
      .action-card.reservations .card-icon {
        color: #9f7338;
      }
      .action-card.payments .card-icon {
        color: #c9a15d;
      }
      .action-card.directory .card-icon {
        color: #a855f7;
      }
      .action-card.rules .card-icon {
        color: #f97316;
      }
      .action-card.admin-dashboard .card-icon {
        color: #8b5cf6;
      }
      .action-card.reserve-court:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(245, 158, 11, 0.4));
      }
      .action-card.reservations:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(59, 130, 246, 0.4));
      }
      .action-card.payments:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(201, 161, 93, 0.4));
      }
      .action-card.directory:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(168, 85, 247, 0.4));
      }
      .action-card.rules:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(249, 115, 22, 0.4));
      }
      .action-card.admin-dashboard:hover .card-icon {
        transform: scale(1.3) rotateZ(-8deg);
        filter: drop-shadow(0 4px 8px rgba(139, 92, 246, 0.4));
      }
      .action-card h4 {
        font-size: 0.95rem;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0.5rem 0 0.25rem 0;
        transition: color 0.3s;
      }
      .action-card:hover h4 {
        color: #9f7338;
      }
      .action-card p {
        font-size: 0.75rem;
        color: #666;
        margin: 0 0 0.75rem 0;
        font-weight: 500;
        transition: color 0.3s;
      }
      .action-card:hover p {
        color: #555;
      }
      .card-footer {
        width: 100%;
        border-top: 1px solid rgba(0, 0, 0, 0.06);
        padding-top: 0.75rem;
        margin-top: auto;
      }
      .card-meta {
        font-size: 0.78rem;
        color: #9f7338;
        font-weight: 600;
        opacity: 0;
        display: inline-block;
        transform: translateY(5px);
        transition: all 0.3s;
      }
      .action-card:hover .card-meta {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 768px) {
        :host {
          display: block;
          width: 100%;
          min-height: 100%;
        }
        .dashboard-container {
          position: relative;
          width: 100%;
          min-height: auto;
          align-items: flex-start;
          padding: 1rem;
          padding-top: 1.5rem;
        }
        .page-card {
          max-width: 100%;
          margin-bottom: 2rem;
        }
        .card-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.25rem;
        }
        .card-header > div:first-child h2 {
          font-size: 1.3rem;
        }
        .balance-summary {
          width: 100%;
          justify-content: space-between;
        }
        .card-body {
          padding: 1.25rem;
        }
        .action-grid {
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.75rem;
        }
        .action-card {
          padding: 1.25rem 0.75rem;
          border-radius: 12px;
        }
        .card-icon-container {
          width: 60px;
          height: 60px;
        }
        .card-icon {
          font-size: 2.2rem;
        }
        .action-card h4 {
          font-size: 0.85rem;
        }
        .action-card p {
          font-size: 0.7rem;
        }
        .card-badge {
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.65rem;
        }
        .card-footer {
          padding-top: 0.5rem;
        }
        .card-meta {
          font-size: 0.7rem;
        }
      }

      @media (max-width: 480px) {
        .card-header > div:first-child h2 {
          font-size: 1.1rem;
        }
        .action-grid {
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .action-card {
          padding: 0.85rem 0.5rem;
          border-radius: 10px;
        }
        .card-icon-container {
          width: 50px;
          height: 50px;
          margin-bottom: 0.4rem;
        }
        .card-icon {
          font-size: 1.8rem;
        }
        .action-card h4 {
          font-size: 0.75rem;
          margin: 0.3rem 0 0.1rem 0;
        }
        .action-card p {
          display: none;
        }
        .card-badge {
          display: none;
        }
        .card-footer {
          padding-top: 0.4rem;
          border-top: none;
        }
        .card-meta {
          font-size: 0.6rem;
          opacity: 1;
          transform: translateY(0);
        }
      }

      .calendar-container {
        background: rgba(255, 255, 255, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.08),
          inset 0 1px 1px rgba(255, 255, 255, 0.6),
          inset 0 -1px 1px rgba(0, 0, 0, 0.05);
      }
      .calendar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
        gap: 1rem;
      }
      .calendar-nav-btn {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        font-size: 1.2rem;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(159, 115, 56, 0.2);
      }
      .calendar-nav-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(159, 115, 56, 0.3);
      }
      .calendar-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #9f7338;
        margin: 0;
        text-transform: capitalize;
        flex: 1;
        text-align: center;
      }
      .calendar-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      .weekday {
        text-align: center;
        font-weight: 700;
        color: #9f7338;
        font-size: 0.85rem;
        padding: 0.5rem 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.5rem;
      }
      .calendar-day {
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        background: #f9faf9;
        border-radius: 10px;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all 0.3s;
        position: relative;
        font-weight: 600;
        color: #1a1a1a;
        font-size: 0.95rem;
        padding: 0.4rem;
      }
      .day-number {
        flex-shrink: 0;
      }
      .day-indicators {
        display: flex;
        gap: 0.3rem;
        justify-content: center;
        flex-wrap: wrap;
        width: 100%;
      }
      .indicator-badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
        min-width: 18px;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .indicator-badge.reservation-badge {
        background: #f2e4c9;
        color: #9f7338;
        border: 1px solid #e6d2ad;
      }
      .indicator-badge.session-badge {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #f59e0b;
      }
      .calendar-day.other-month {
        color: #ccc;
        background: #fafafa;
      }
      .calendar-day.today {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        color: white;
        font-weight: 700;
        box-shadow: 0 4px 12px rgba(159, 115, 56, 0.3);
      }
      .calendar-day.today .indicator-badge.reservation-badge {
        background: rgba(255, 255, 255, 0.3);
        color: rgba(255, 255, 255, 0.95);
        border-color: rgba(255, 255, 255, 0.5);
      }
      .calendar-day.today .indicator-badge.session-badge {
        background: rgba(255, 255, 255, 0.3);
        color: rgba(255, 255, 255, 0.95);
        border-color: rgba(255, 255, 255, 0.5);
      }
      .calendar-day.has-event:not(.today) {
        background: linear-gradient(135deg, rgba(184, 137, 66, 0.1), rgba(159, 115, 56, 0.1));
        border-color: rgba(159, 115, 56, 0.3);
      }
      .calendar-day:hover:not(.other-month) {
        transform: scale(1.08);
        background: linear-gradient(135deg, rgba(184, 137, 66, 0.15), rgba(159, 115, 56, 0.15));
        border-color: rgba(159, 115, 56, 0.5);
        box-shadow: 0 4px 12px rgba(159, 115, 56, 0.15);
      }
      .event-dot {
        width: 5px;
        height: 5px;
        background: #b88942;
        border-radius: 50%;
        position: absolute;
        bottom: 4px;
      }
      .calendar-day.today .event-dot {
        background: rgba(255, 255, 255, 0.8);
      }


      .calendar-legend {
        display: flex;
        gap: 2rem;
        justify-content: center;
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        font-size: 0.9rem;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      .legend-badge {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        font-size: 0.65rem;
        font-weight: 700;
        padding: 0.2rem 0.4rem;
      }

      .calendar-day.selected {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        color: white;
        font-weight: 700;
        border-color: #c9a15d;
        box-shadow: 0 4px 12px rgba(159, 115, 56, 0.4);
      }

      .selected-day-section {
        margin-top: 2.5rem;
        padding: 0;
        background: transparent;
        border-radius: 0;
        border: none;
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .selected-day-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 2rem;
        padding: 0;
        border-bottom: none;
      }

      .selected-day-title {
        color: #0f172a;
        font-size: 1.75rem;
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.5px;
      }

      .clear-selection-btn {
        background: rgba(159, 115, 56, 0.1);
        border: none;
        color: #9f7338;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .clear-selection-btn:hover {
        background: rgba(159, 115, 56, 0.2);
        transform: scale(1.05);
      }

      .empty-reservations {
        padding: 4rem 2rem;
        text-align: center;
        color: #94a3b8;
        font-style: italic;
        background: linear-gradient(135deg, rgba(159, 115, 56, 0.05), rgba(201, 161, 93, 0.05));
        border-radius: 16px;
        border: 2px dashed rgba(159, 115, 56, 0.1);
      }

      .courts-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 2rem;
        margin-bottom: 2rem;
      }

      .court-section {
        background: white;
        border-radius: 16px;
        padding: 1.75rem;
        border: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }

      .court-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #9f7338, #c9a15d);
      }

      .court-section:hover {
        box-shadow: 0 8px 24px rgba(159, 115, 56, 0.12);
        transform: translateY(-2px);
      }

      .court-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
        padding: 0;
        border-bottom: none;
      }

      .court-title {
        color: #0f172a;
        font-size: 1.3rem;
        font-weight: 700;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        letter-spacing: -0.3px;
      }

      .court-title::before {
        content: '🏐';
        font-size: 1.5rem;
      }

      .court-count {
        background: linear-gradient(135deg, #9f7338, #c9a15d);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 700;
        border: none;
        min-width: 40px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(159, 115, 56, 0.3);
      }

      .reservations-list {
        display: grid;
        gap: 1.25rem;
      }

      .reservation-card {
        background: linear-gradient(135deg, #f8fafc, #f0f4f8);
        border-radius: 12px;
        padding: 1.25rem;
        border: 1px solid rgba(159, 115, 56, 0.1);
        transition: all 0.3s ease;
        cursor: pointer;
        position: relative;
      }

      .reservation-card:hover {
        background: linear-gradient(135deg, #fff, #f5fafc);
        box-shadow: 0 4px 12px rgba(159, 115, 56, 0.15);
        border-color: rgba(159, 115, 56, 0.3);
        transform: translateX(4px);
      }

      .reservation-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .reservation-time {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 700;
        color: #0f172a;
        font-size: 1.05rem;
      }

      .time-label {
        font-size: 1.3rem;
      }

      .time-value {
        color: #9f7338;
        font-weight: 800;
      }

      .court-info {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .court-badge {
        background: linear-gradient(135deg, #f2e4c9, #e6d2ad);
        color: #9f7338;
        padding: 0.4rem 0.9rem;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        border: none;
      }

      .lights-badge {
        background: linear-gradient(135deg, #fef08a, #fde047);
        color: #854d0e;
        padding: 0.4rem 0.9rem;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        border: none;
      }

      .players-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
        font-size: 0.95rem;
        flex-wrap: wrap;
        padding: 0.75rem;
        background: rgba(159, 115, 56, 0.05);
        border-radius: 8px;
      }

      .players-label {
        color: #9f7338;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.5px;
      }

      .players-list {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .player-name {
        color: #1e293b;
        font-weight: 500;
        font-size: 0.95rem;
      }

      .player-name.reserver {
        background: linear-gradient(135deg, #9f7338, #c9a15d);
        color: white;
        padding: 0.35rem 0.75rem;
        border-radius: 6px;
        border: none;
        font-weight: 700;
        box-shadow: 0 2px 6px rgba(159, 115, 56, 0.3);
      }

      .separator {
        color: #cbd5e1;
        margin: 0 0.25rem;
      }

      .reservation-status {
        display: flex;
        justify-content: flex-end;
      }

      .status-badge {
        background: #e2e8f0;
        color: #475569;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: capitalize;
        letter-spacing: 0.3px;
      }

      .status-badge.confirmed {
        background: linear-gradient(135deg, #f2e4c9, #e6d2ad);
        color: #9f7338;
        border: none;
        box-shadow: 0 2px 6px rgba(159, 115, 56, 0.2);
      }

      @media (max-width: 768px) {
        .selected-day-title {
          font-size: 1.5rem;
        }

        .courts-container {
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        .court-section {
          padding: 1.5rem;
        }

        .court-title {
          font-size: 1.1rem;
        }

        .reservation-header {
          flex-direction: column;
          gap: 0.75rem;
        }

        .reservation-time {
          font-size: 0.95rem;
        }

        .players-info {
          flex-direction: column;
          align-items: flex-start;
        }

        .calendar-container {
          padding: 1rem;
        }
        .calendar-header {
          margin-bottom: 1rem;
        }
        .calendar-nav-btn {
          width: 36px;
          height: 36px;
          font-size: 1rem;
        }
        .calendar-title {
          font-size: 1rem;
        }
        .calendar-day {
          font-size: 0.85rem;
        }
      }

      @media (max-width: 480px) {
        .selected-day-title {
          font-size: 1.25rem;
        }

        .selected-day-header {
          margin-bottom: 1.5rem;
        }

        .court-section {
          padding: 1.25rem;
          margin: 0 -1.5rem;
          border-radius: 12px;
        }

        .court-title {
          font-size: 1rem;
        }

        .court-count {
          padding: 0.4rem 0.8rem;
          font-size: 0.8rem;
        }

        .reservation-card {
          padding: 1rem;
        }

        .reservation-time {
          font-size: 0.9rem;
        }

        .reservation-header {
          margin-bottom: 0.75rem;
        }

        .players-info {
          padding: 0.5rem;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .player-name {
          font-size: 0.85rem;
        }

        .player-name.reserver {
          padding: 0.3rem 0.6rem;
        }

        .calendar-container {
          padding: 0.75rem;
        }
        .calendar-nav-btn {
          width: 30px;
          height: 30px;
          font-size: 0.9rem;
        }
        .calendar-title {
          font-size: 0.9rem;
        }
        .calendar-day {
          font-size: 0.7rem;
        }
      }
    `,
  ],
})
export class PlayerDashboardComponent implements OnInit {
  charges: Charge[] = [];
  reservations: Reservation[] = [];
  loading = true;
  outstanding = 0;

  get pendingApprovalCharges(): Charge[] {
    return this.charges.filter((c) => c.approvalStatus === 'pending');
  }
  get rejectedCharges(): Charge[] {
    return this.charges.filter((c) => c.approvalStatus === 'rejected');
  }
  currentMonth = new Date();
  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calendarDays: any[] = [];
  selectedDate: Date | null = new Date();

  constructor(
    public auth: AuthService,
    private sessionsService: SessionsService,
    private chargesService: ChargesService,
    private reservationService: ReservationService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit() {
    this.generateCalendar();
    
    // Load charges and reservations in parallel
    this.chargesService.getMyCharges().subscribe({
      next: (charges) => {
        console.log('Dashboard: Loaded charges:', charges);
        this.charges = charges;
        // unpaid covers both genuinely unpaid and pending-approval (which stays unpaid until approved)
        this.outstanding = charges
          .filter((c) => c.status === 'unpaid')
          .reduce((sum, c) => sum + c.amount, 0);
        this.generateCalendar();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });

    // Load ALL club reservations (not just personal ones) for shared calendar view
    this.reservationService.getSchedule().subscribe({
      next: (reservations) => {
        console.log('Dashboard: All club reservations from schedule:', reservations);
        this.reservations = reservations;
        console.log('Dashboard: this.reservations is now:', this.reservations);
        this.generateCalendar();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Dashboard: Error loading schedule:', err);
        // Continue even if reservations fail to load
        this.cdr.detectChanges();
      },
    });
  }

  generateCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const today = new Date();

    console.log(`Dashboard Calendar: Generating for ${year}-${month + 1}, days: ${daysInMonth}`);
    console.log(`Dashboard: Reservations available to filter:`, this.reservations);

    this.calendarDays = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      this.calendarDays.push({
        date: prevMonthLastDay - i,
        currentMonth: false,
        isToday: false,
        hasEvent: false,
        reservationCount: 0,
        chargeCount: 0,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const isToday =
        i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      
      // Check for charges (sessions or reservations)
      const chargeCount = this.charges.filter((c) => {
        let chargeDate: Date | null = null;
        
        if (c.chargeType === 'session' && c.sessionId) {
          chargeDate = new Date(c.sessionId.date);
        } else if (c.chargeType === 'reservation' && c.reservationId) {
          chargeDate = new Date(c.reservationId.date);
        }
        
        if (!chargeDate) return false;
        
        return (
          chargeDate.getDate() === i &&
          chargeDate.getMonth() === month &&
          chargeDate.getFullYear() === year
        );
      }).length;

      // Check for reservations
      const reservationCount = this.reservations.filter((r) => {
        const reservationDate = new Date(r.date);
        const matches =
          reservationDate.getDate() === i &&
          reservationDate.getMonth() === month &&
          reservationDate.getFullYear() === year;
        
        if (matches) {
          console.log(`Dashboard: Found reservation on day ${i}: `, r);
        }
        
        return matches;
      }).length;

      const hasEvent = chargeCount > 0 || reservationCount > 0;

      this.calendarDays.push({
        date: i,
        currentMonth: true,
        isToday,
        hasEvent,
        reservationCount,
        chargeCount,
      });
    }
  }

  prevMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1);
    this.generateCalendar();
  }

  navigateTo(route: string) {
    const [path, query] = route.split('?');
    if (query) {
      const queryParams = Object.fromEntries(new URLSearchParams(query));
      this.router.navigate([path], { queryParams });
    } else {
      this.router.navigate([path]);
    }
  }

  selectDay(day: any) {
    if (!day.currentMonth) return; // Only select days in current month
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    this.selectedDate = new Date(year, month, day.date);
  }

  getSelectedDayReservations(): Reservation[] {
    if (!this.selectedDate) return [];
    return this.reservations.filter((r) => {
      const reservationDate = new Date(r.date);
      return (
        reservationDate.getDate() === this.selectedDate!.getDate() &&
        reservationDate.getMonth() === this.selectedDate!.getMonth() &&
        reservationDate.getFullYear() === this.selectedDate!.getFullYear()
      );
    });
  }

  isDateSelected(day: any): boolean {
    if (!this.selectedDate || !day.currentMonth) return false;
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    return (
      day.date === this.selectedDate.getDate() &&
      month === this.selectedDate.getMonth() &&
      year === this.selectedDate.getFullYear()
    );
  }

  formatTimeSlot(timeSlot: string): string {
    // Convert "6am" or "6pm" to "6:00 AM - 7:00 AM" format
    const match = timeSlot.match(/^(\d{1,2})(am|pm)$/i);
    if (!match) return timeSlot;

    const hour = parseInt(match[1], 10);
    const meridiem = match[2].toLowerCase();

    // Convert to 24-hour format for calculation
    let startHour24: number;
    if (meridiem === 'am') {
      startHour24 = hour === 12 ? 0 : hour;
    } else {
      startHour24 = hour === 12 ? 12 : hour + 12;
    }
    let endHour24 = startHour24 + 1;

    // Convert back to 12-hour format for display
    const startMeridiem = startHour24 < 12 ? 'AM' : 'PM';
    const endMeridiem = endHour24 < 12 ? 'AM' : 'PM';

    const startDisplay = startHour24 % 12 === 0 ? 12 : startHour24 % 12;
    const endDisplay = endHour24 % 12 === 0 ? 12 : endHour24 % 12;

    return `${startDisplay}:00 ${startMeridiem} - ${endDisplay}:00 ${endMeridiem}`;
  }

  isPlayerObject(player: string | ReservationPlayer | any): player is ReservationPlayer {
    return player && typeof player === 'object' && 'name' in player;
  }

  getReservationsByCourtForSelectedDay() {
    const reservations = this.getSelectedDayReservations();
    const court1 = reservations.filter((r) => r.court === 1);
    const court2 = reservations.filter((r) => r.court === 2);
    return { court1, court2 };
  }
}


