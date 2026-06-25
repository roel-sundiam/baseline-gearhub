import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChargesService, Charge } from '../../../core/services/charges.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationService, Reservation, ReservationPlayer, AvailabilityResult } from '../../../core/services/reservation.service';
import { ClubService } from '../../../core/services/club.service';
import { TournamentService, Tournament } from '../../../core/services/tournament.service';
import { NewsService, ClubNews } from '../../../core/services/news.service';
import { AdminMessagesService } from '../../../core/services/admin-messages.service';
import { AdminChatModalComponent } from '../../../shared/components/admin-chat-modal/admin-chat-modal.component';
import { SoundService } from '../../../core/services/sound.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-player-dashboard',
  standalone: true,
  imports: [CommonModule, AdminChatModalComponent],
  template: `
    <div class="dm-shell">

      <!-- Header (mobile only) -->
      <header class="dm-header">
        <div class="dm-header-left">
          <div class="dm-club-avatar">
            @if (clubLogo) {
              <img [src]="clubLogo" alt="Club logo" class="dm-club-avatar-img" />
            } @else {
              <span class="dm-club-avatar-initials">{{ clubInitials }}</span>
            }
          </div>
          <div class="dm-club-text">
            <span class="dm-club-name">
              <span class="dm-club-accent">{{ clubNameFirst }}</span>@if (clubNameLast) {<span class="dm-club-word"> {{ clubNameLast }}</span>}
            </span>
            <span class="dm-greeting-sub">{{ greeting }}, {{ firstName }}! 👋</span>
          </div>
        </div>
        <button class="dm-bell-btn" title="Notifications">
          <i class="far fa-bell"></i>
        </button>
      </header>

      <!-- Scrollable body -->
      <div class="dm-body">

        <!-- Greeting (desktop only) -->
        <div class="dm-greeting">
          <div class="dm-greeting-top">
            <div class="dm-club-avatar dm-club-avatar-lg">
              @if (clubLogo) {
                <img [src]="clubLogo" alt="Club logo" class="dm-club-avatar-img" />
              } @else {
                <span class="dm-club-avatar-initials">{{ clubInitials }}</span>
              }
            </div>
            <div>
              <div class="dm-greeting-club">
                <span class="dm-club-accent">{{ clubNameFirst }}</span>@if (clubNameLast) {<span class="dm-club-word"> {{ clubNameLast }}</span>}
              </div>
              <h2 class="dm-greeting-text">{{ greeting }}, {{ firstName }}! 👋</h2>
            </div>
          </div>
          @if (auth.isAdmin()) {
            <button class="dm-admin-pill" (click)="navigateTo('/admin/dashboard')">
              <i class="fas fa-shield-alt"></i> Admin Panel
            </button>
          }
        </div>

        <!-- Book a Court hero card -->
        <div class="dm-hero-card" (click)="navigateTo('/player/reserve')">
          <div class="dm-hero-text">
            <div class="dm-hero-icon"><i class="fas fa-calendar-alt"></i></div>
            <h3 class="dm-hero-title">Book a Court</h3>
            <p class="dm-hero-hours">{{ operatingHours }}</p>
            <p class="dm-hero-desc">Find and book your preferred time.</p>
            <button class="dm-hero-cta">Book Now</button>
          </div>
          <div class="dm-hero-image">
            <img src="/racketball.png" alt="Racketball" />
          </div>
        </div>

        <!-- Upcoming Booking -->
        <div class="dm-section">
          <h4 class="dm-section-label">Upcoming Booking</h4>
          @if (loading) {
            <div class="dm-card dm-booking-skeleton">Loading...</div>
          } @else if (nextReservation) {
            <div class="dm-card dm-booking-card">
              <div class="dm-booking-top">
                <span class="dm-booking-date">{{ nextReservation.date | date: 'EEEE, MMMM d' : 'UTC' }}</span>
                <button class="dm-view-booking" (click)="$event.stopPropagation(); navigateTo('/player/reservations')">
                  View Booking
                </button>
              </div>
              <div class="dm-booking-time">{{ formatTimeSlot(nextReservation.timeSlot) }}</div>
              <div class="dm-booking-court">Court {{ nextReservation.court }}</div>
            </div>
          } @else {
            <div class="dm-card dm-booking-empty">
              <span>No upcoming bookings</span>
              <button class="dm-view-booking" (click)="navigateTo('/player/reserve')">Book Now</button>
            </div>
          }
        </div>

        <!-- Player Action Cards -->
        <div class="dm-section">
          <h4 class="dm-section-label">Quick Actions</h4>
          <div class="dm-card-grid">
            <button class="dm-action-card" (click)="navigateTo('/player/reserve')">
              <div class="dm-ac-icon dm-ac-lime"><i class="fas fa-calendar-alt"></i></div>
              <span class="dm-ac-title">Reserve Court</span>
              <span class="dm-ac-sub">Book a game</span>
            </button>
            <button class="dm-action-card" (click)="navigateTo('/player/reservations')">
              <div class="dm-ac-icon dm-ac-teal"><i class="fas fa-calendar-check"></i></div>
              <span class="dm-ac-title">My Reservations</span>
              <span class="dm-ac-sub">View bookings</span>
            </button>
            <button class="dm-action-card" (click)="navigateTo('/payments')">
              <div class="dm-ac-icon dm-ac-amber"><i class="far fa-credit-card"></i></div>
              <span class="dm-ac-title">Payments</span>
              <span class="dm-ac-sub">{{ outstanding > 0 ? 'Balance due' : 'All paid' }}</span>
              @if (outstanding > 0) { <span class="dm-ac-badge">!</span> }
            </button>
            <button class="dm-action-card" (click)="navigateTo('/player/directory')">
              <div class="dm-ac-icon dm-ac-blue"><i class="fas fa-user-friends"></i></div>
              <span class="dm-ac-title">Members</span>
              <span class="dm-ac-sub">Club community</span>
            </button>
            <!-- Tournaments & Rankings hidden until feature is ready
            <button class="dm-action-card" (click)="navigateTo('/player/tournaments')">
              <div class="dm-ac-icon dm-ac-yellow"><i class="fas fa-trophy"></i></div>
              <span class="dm-ac-title">Tournaments</span>
              <span class="dm-ac-sub">Compete & win</span>
            </button>
            <button class="dm-action-card" (click)="navigateTo('/player/tournaments?tab=rankings')">
              <div class="dm-ac-icon dm-ac-purple"><i class="fas fa-medal"></i></div>
              <span class="dm-ac-title">Rankings</span>
              <span class="dm-ac-sub">Leaderboard</span>
            </button>
            -->
            <button class="dm-action-card" (click)="navigateTo('/player/payment-approvals')">
              <div class="dm-ac-icon dm-ac-rose"><i class="fas fa-clipboard-check"></i></div>
              <span class="dm-ac-title">Approvals</span>
              <span class="dm-ac-sub">My requests</span>
            </button>
            <button class="dm-action-card" (click)="navigateTo('/player/open-play')">
              <div class="dm-ac-icon dm-ac-lime"><i class="fas fa-table-tennis-paddle-ball"></i></div>
              <span class="dm-ac-title">Open Play</span>
              <span class="dm-ac-sub">Join a session</span>
            </button>
            <button class="dm-action-card" (click)="navigateTo('/player/rules')">
              <div class="dm-ac-icon dm-ac-orange"><i class="fas fa-gavel"></i></div>
              <span class="dm-ac-title">Rules</span>
              <span class="dm-ac-sub">Club guidelines</span>
            </button>
            <button class="dm-action-card" (click)="toggleAvailability()">
              <div class="dm-ac-icon dm-ac-teal"><i class="fas fa-th"></i></div>
              <span class="dm-ac-title">Court Schedule</span>
              <span class="dm-ac-sub">Check availability</span>
            </button>
          </div>
        </div>

        <!-- Court Availability (toggled by Quick Action) -->
        @if (showAvailability) {
          <div class="dm-section">
            <div class="av-header">
              <h4 class="dm-section-label" style="margin:0">Court Availability</h4>
              <input
                type="date"
                class="av-date-input"
                [value]="availabilityDate"
                (change)="availabilityDate = $any($event.target).value; loadAvailability()"
              />
            </div>

            @if (availabilityLoading) {
              <div class="dm-card av-loading">Loading availability…</div>
            } @else if (courtCount === 0) {
              <div class="dm-card av-loading">Club data not loaded.</div>
            } @else {
              <div class="av-table-wrap">
                <div class="av-row av-header-row">
                  <div class="av-cell av-cell-time">⏱ TIME</div>
                  @for (n of courtNumbers; track n) {
                    <div class="av-cell av-cell-court">⊞ COURT {{ n }}</div>
                  }
                </div>
                @for (slot of availabilitySlots; track slot) {
                  <div class="av-row">
                    <div class="av-cell av-cell-time av-time-label">{{ formatSlotShort(slot) }}</div>
                    @for (n of courtNumbers; track n) {
                      <div class="av-cell av-cell-status"
                           [class.av-booked]="isBooked(n, slot)"
                           [class.av-pending]="!isBooked(n, slot) && isPending(n, slot)"
                           [class.av-open]="!isBooked(n, slot) && !isPending(n, slot)">
                        @if (isBooked(n, slot)) {
                          <span class="av-icon">🔒</span>
                          <span class="av-status-text">BOOKED</span>
                        } @else if (isPending(n, slot)) {
                          <span class="av-icon">⏳</span>
                          <span class="av-status-text">PENDING</span>
                        } @else {
                          <span class="av-icon">✓</span>
                          <span class="av-status-text">OPEN</span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Admin Cards -->
        @if (auth.isAdmin()) {
          <div class="dm-section">
            <h4 class="dm-section-label">Admin</h4>
            <div class="dm-card-grid">
              <button class="dm-action-card" (click)="navigateTo('/admin/users')">
                <div class="dm-ac-icon dm-ac-sky"><i class="fas fa-users-cog"></i></div>
                <span class="dm-ac-title">Members</span>
                <span class="dm-ac-sub">Manage users</span>
              </button>
              <button class="dm-action-card" (click)="navigateTo('/admin/finance')">
                <div class="dm-ac-icon dm-ac-green"><i class="fas fa-coins"></i></div>
                <span class="dm-ac-title">Finance</span>
                <span class="dm-ac-sub">Payments report</span>
              </button>
              <!-- Tournaments hidden until feature is ready
              <button class="dm-action-card" (click)="navigateTo('/admin/tournaments')">
                <div class="dm-ac-icon dm-ac-yellow"><i class="fas fa-trophy"></i></div>
                <span class="dm-ac-title">Tournaments</span>
                <span class="dm-ac-sub">Manage events</span>
              </button>
              -->
              <button class="dm-action-card" (click)="navigateTo('/admin/dashboard')">
                <div class="dm-ac-icon dm-ac-purple"><i class="fas fa-cogs"></i></div>
                <span class="dm-ac-title">Dashboard</span>
                <span class="dm-ac-sub">Admin panel</span>
              </button>
              <button class="dm-action-card" (click)="navigateTo('/admin/news')">
                <div class="dm-ac-icon dm-ac-orange"><i class="fas fa-newspaper"></i></div>
                <span class="dm-ac-title">Club News</span>
                <span class="dm-ac-sub">Posts & updates</span>
              </button>
              @if (auth.isSuperAdmin()) {
                <button class="dm-action-card" (click)="navigateTo('/admin/analytics')">
                  <div class="dm-ac-icon dm-ac-rose"><i class="fas fa-chart-bar"></i></div>
                  <span class="dm-ac-title">Analytics</span>
                  <span class="dm-ac-sub">Site metrics</span>
                </button>
                <button class="dm-action-card" (click)="navigateTo('/admin/clubs')">
                  <div class="dm-ac-icon dm-ac-teal"><i class="fas fa-shield-alt"></i></div>
                  <span class="dm-ac-title">Clubs</span>
                  <span class="dm-ac-sub">Manage clubs</span>
                </button>
              }
              @if (auth.user()?.clubId) {
                <button class="dm-action-card" (click)="navigateTo('/admin/award-generator')">
                  <div class="dm-ac-icon dm-ac-amber"><i class="fas fa-award"></i></div>
                  <span class="dm-ac-title">Award Generator</span>
                  <span class="dm-ac-sub">Create plaques</span>
                </button>
                <button class="dm-action-card" (click)="copyPublicLink()">
                  <div class="dm-ac-icon" [class]="copiedPublicLink ? 'dm-ac-lime' : 'dm-ac-indigo'">
                    <i class="fas" [class.fa-check]="copiedPublicLink" [class.fa-share-nodes]="!copiedPublicLink"></i>
                  </div>
                  <span class="dm-ac-title">{{ copiedPublicLink ? 'Copied!' : 'Share Club' }}</span>
                  <span class="dm-ac-sub">{{ copiedPublicLink ? 'Link copied' : 'Copy public link' }}</span>
                </button>
              }
            </div>
          </div>
        }

        <!-- Club News -->
        <div class="dm-section">
          <h4 class="dm-section-label">Club News</h4>
          @if (newsItems.length > 0) {
            @for (item of newsItems; track item._id) {
              <div class="dm-news-card dm-news-card-post" [class.dm-news-card-pinned]="item.pinned">
                <div class="dm-news-content">
                  <div class="dm-news-badges">
                    <span class="dm-news-type dm-news-type-{{ item.type }}">{{ item.type | titlecase }}</span>
                    @if (item.pinned) {
                      <span class="dm-news-pin"><i class="fas fa-thumbtack"></i></span>
                    }
                  </div>
                  <p class="dm-news-text">{{ item.title }}</p>
                  <span class="dm-news-meta">{{ item.body | slice:0:120 }}{{ item.body.length > 120 ? '...' : '' }}</span>
                </div>
                <div class="dm-news-thumb dm-news-thumb-{{ item.type }}">
                  @if (item.type === 'announcement') { <i class="fas fa-bullhorn"></i> }
                  @else if (item.type === 'event') { <i class="fas fa-calendar-star"></i> }
                  @else { <i class="fas fa-newspaper"></i> }
                </div>
              </div>
            }
          } @else if (nextTournament) {
            <div class="dm-news-card" (click)="navigateTo('/player/tournaments')">
              <div class="dm-news-content">
                <p class="dm-news-text">{{ nextTournament.name }}</p>
                <span class="dm-news-meta">
                  {{ nextTournament.type | titlecase }} &bull; {{ nextTournament.status | titlecase }}
                </span>
              </div>
              <div class="dm-news-thumb">
                <i class="fas fa-trophy"></i>
              </div>
            </div>
          } @else {
            <div class="dm-news-card">
              <div class="dm-news-content">
                <p class="dm-news-text">Stay tuned for upcoming club events and tournaments!</p>
              </div>
              <div class="dm-news-thumb dm-news-thumb-alt">
                <i class="fas fa-newspaper"></i>
              </div>
            </div>
          }
        </div>

        <div class="dm-bottom-spacer"></div>
      </div>

      <!-- Bottom navigation (mobile only) -->
      <nav class="dm-bottom-nav">
        <button class="dm-nav-item" [class.dm-nav-active]="activeTab === 'home'"
                (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-home"></i>
          <span>Home</span>
        </button>
        <button class="dm-nav-item" [class.dm-nav-active]="activeTab === 'courts'"
                (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i>
          <span>Courts</span>
        </button>
        <button class="dm-nav-item" [class.dm-nav-active]="activeTab === 'bookings'"
                (click)="navigateTo('/player/reservations')">
          <i class="far fa-calendar-check"></i>
          <span>Bookings</span>
        </button>
        <button class="dm-nav-item" [class.dm-nav-active]="activeTab === 'rankings'"
                (click)="navigateTo('/player/tournaments?tab=rankings')">
          <i class="fas fa-trophy"></i>
          <span>Rankings</span>
        </button>
        <button class="dm-nav-item" [class.dm-nav-active]="activeTab === 'profile'"
                (click)="navigateTo('/player/profile/edit')">
          <i class="far fa-user"></i>
          <span>Profile</span>
        </button>
      </nav>

      <!-- Floating support chat (club admins only) -->
      @if (auth.isAdmin() && !auth.isSuperAdmin()) {
        <button class="dm-chat-fab" (click)="toggleSupportChat()" [title]="supportChatOpen ? 'Close chat' : 'Message support'">
          @if (supportChatOpen) {
            <i class="fas fa-times"></i>
          } @else {
            <i class="fas fa-comments"></i>
            @if (messageUnreadCount > 0) {
              <span class="dm-chat-badge">{{ messageUnreadCount }}</span>
            }
          }
        </button>

        @if (supportChatOpen) {
          <app-admin-chat-modal
            [recipientId]="supportContactId"
            [recipientName]="supportContactName"
            (closed)="closeSupportChat()"
          />
        }
      }

    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin: -1.5rem;
      width: calc(100% + 3rem);
    }
    @media (min-width: 769px) {
      :host { margin: 0; width: 100%; }
    }

    /* ── Shell ── */
    .dm-shell {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      max-width: 480px;
      margin: 0 auto;
      background: #0c1a11;
      position: relative;
      font-family: inherit;
    }

    /* ── Header (mobile) ── */
    .dm-header {
      background: #0c1a11;
      padding: 1rem 1.25rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .dm-header-left {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.65rem;
    }
    .dm-club-text {
      display: flex;
      flex-direction: column;
      gap: 0.08rem;
    }
    .dm-club-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 2px solid rgba(163,230,53,0.45);
      background: rgba(163,230,53,0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .dm-club-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
    .dm-club-avatar-initials {
      font-size: 0.72rem;
      font-weight: 800;
      color: #a3e635;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .dm-club-name {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: -0.3px;
      line-height: 1;
    }
    .dm-club-accent { color: #a3e635; }
    .dm-club-word   { color: #ffffff; }
    .dm-greeting-sub {
      color: rgba(255,255,255,0.5);
      font-size: 0.78rem;
      font-weight: 500;
    }
    .dm-bell-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.7);
      font-size: 1rem;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .dm-bell-btn:hover {
      background: rgba(255,255,255,0.14);
    }

    /* ── Scrollable body ── */
    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.1rem 1rem 0;
      -webkit-overflow-scrolling: touch;
      background: #0c1a11;
    }
    .dm-bottom-spacer { height: 80px; }

    /* ── Greeting (desktop only) ── */
    .dm-greeting { display: none; }

    /* ── Hero Card ── */
    .dm-hero-card {
      background: #1b3028;
      border-radius: 16px;
      display: flex;
      overflow: hidden;
      margin-bottom: 1.1rem;
      cursor: pointer;
      min-height: 158px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .dm-hero-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .dm-hero-text {
      padding: 1.2rem 1.1rem;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.18rem;
    }
    .dm-hero-icon {
      color: #a3e635;
      font-size: 1rem;
      margin-bottom: 0.15rem;
    }
    .dm-hero-title {
      color: #ffffff;
      font-size: 1.15rem;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.2px;
    }
    .dm-hero-hours {
      color: #a3e635;
      font-size: 0.78rem;
      font-weight: 700;
      margin: 0;
    }
    .dm-hero-desc {
      color: rgba(255,255,255,0.55);
      font-size: 0.75rem;
      margin: 0.1rem 0 0.55rem 0;
      line-height: 1.45;
    }
    .dm-hero-cta {
      display: inline-block;
      background: #a3e635;
      color: #0a1f00;
      border: none;
      border-radius: 20px;
      padding: 0.4rem 1.05rem;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;
      align-self: flex-start;
      transition: background 0.2s;
      letter-spacing: 0.2px;
    }
    .dm-hero-cta:hover { background: #b8f040; }
    .dm-hero-image {
      width: 40%;
      flex-shrink: 0;
      overflow: hidden;
    }
    .dm-hero-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }

    /* ── Section label ── */
    .dm-section { margin-bottom: 1.1rem; }
    .dm-section-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: rgba(255,255,255,0.4);
      margin: 0 0 0.5rem 0;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    /* ── Cards (dark) ── */
    .dm-card {
      background: #1b3028;
      border-radius: 12px;
      padding: 0.95rem 1rem;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    }
    .dm-booking-skeleton {
      color: rgba(255,255,255,0.35);
      font-size: 0.85rem;
    }

    /* Booking card */
    .dm-booking-card {
      display: flex;
      flex-direction: column;
      gap: 0.22rem;
    }
    .dm-booking-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.05rem;
    }
    .dm-booking-date {
      font-size: 0.88rem;
      font-weight: 700;
      color: #ffffff;
    }
    .dm-booking-time {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.65);
      font-weight: 500;
    }
    .dm-booking-court {
      font-size: 0.78rem;
      color: #a3e635;
      font-weight: 600;
    }
    .dm-view-booking {
      color: #a3e635;
      font-size: 0.8rem;
      font-weight: 700;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      white-space: nowrap;
      transition: opacity 0.2s;
    }
    .dm-view-booking:hover { opacity: 0.75; }
    .dm-booking-empty {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: rgba(255,255,255,0.35);
      font-size: 0.85rem;
    }

    /* ── Action Card Grid ── */
    .dm-card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.7rem;
    }
    .dm-action-card {
      background: #1b3028;
      border-radius: 14px;
      padding: 0.95rem 0.9rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.22rem;
      cursor: pointer;
      border: none;
      text-align: left;
      transition: background 0.2s, transform 0.15s;
      position: relative;
      font-family: inherit;
      min-height: 100px;
    }
    .dm-action-card:hover { background: #213830; transform: translateY(-1px); }
    .dm-action-card:active { transform: translateY(0); }
    .dm-ac-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      margin-bottom: 0.1rem;
      flex-shrink: 0;
    }
    .dm-ac-lime   { background: rgba(163,230,53,0.14);  color: #a3e635; }
    .dm-ac-teal   { background: rgba(20,184,166,0.14);  color: #14b8a6; }
    .dm-ac-amber  { background: rgba(245,158,11,0.14);  color: #f59e0b; }
    .dm-ac-blue   { background: rgba(59,130,246,0.14);  color: #60a5fa; }
    .dm-ac-yellow { background: rgba(234,179,8,0.14);   color: #eab308; }
    .dm-ac-purple { background: rgba(139,92,246,0.14);  color: #a78bfa; }
    .dm-ac-rose   { background: rgba(244,63,94,0.14);   color: #fb7185; }
    .dm-ac-orange { background: rgba(249,115,22,0.14);  color: #fb923c; }
    .dm-ac-sky    { background: rgba(14,165,233,0.14);  color: #38bdf8; }
    .dm-ac-green  { background: rgba(34,197,94,0.14);   color: #4ade80; }
    .dm-ac-indigo { background: rgba(99,102,241,0.14);  color: #818cf8; }
    .dm-ac-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }
    .dm-ac-sub {
      font-size: 0.67rem;
      color: rgba(255,255,255,0.42);
      line-height: 1.3;
    }
    .dm-ac-badge {
      position: absolute;
      top: 0.55rem;
      right: 0.55rem;
      background: #ef4444;
      color: #fff;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      font-size: 0.62rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    /* ── Club News ── */
    .dm-news-card {
      background: #1b3028;
      border-radius: 12px;
      padding: 0.9rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: background 0.2s;
    }
    .dm-news-card:hover { background: #203828; }
    .dm-news-content { flex: 1; min-width: 0; }
    .dm-news-text {
      font-size: 0.85rem;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 0.2rem 0;
      line-height: 1.4;
    }
    .dm-news-meta {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.4);
    }
    .dm-news-thumb {
      width: 56px;
      height: 56px;
      flex-shrink: 0;
      border-radius: 10px;
      background: rgba(163,230,53,0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #a3e635;
      font-size: 1.3rem;
    }
    .dm-news-thumb-alt {
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.4);
    }
    .dm-news-card-post { cursor: default; }
    .dm-news-card-post:hover { background: #1b3028; }
    .dm-news-card-pinned {
      border: 1px solid rgba(163,230,53,0.25);
      background: rgba(163,230,53,0.05);
    }
    .dm-news-badges {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.25rem;
    }
    .dm-news-type {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .dm-news-type-news { background: rgba(56,189,248,0.15); color: #38bdf8; }
    .dm-news-type-announcement { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .dm-news-type-event { background: rgba(163,230,53,0.15); color: #a3e635; }
    .dm-news-pin { color: #a3e635; font-size: 0.7rem; }
    .dm-news-thumb-news { background: rgba(56,189,248,0.12); color: #38bdf8; }
    .dm-news-thumb-announcement { background: rgba(251,191,36,0.12); color: #fbbf24; }
    .dm-news-thumb-event { background: rgba(163,230,53,0.12); color: #a3e635; }

    /* ── Bottom Navigation ── */
    .dm-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: #111f16;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: stretch;
      height: 62px;
      z-index: 200;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }
    .dm-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.18rem;
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(255,255,255,0.35);
      font-size: 0.6rem;
      font-weight: 600;
      transition: color 0.2s;
      padding: 0;
    }
    .dm-nav-item i { font-size: 1.1rem; }
    .dm-nav-item.dm-nav-active { color: #a3e635; }

    /* ── Desktop override ── */
    @media (min-width: 769px) {
      .dm-shell {
        max-width: 900px;
        height: auto;
        min-height: calc(100vh - 60px);
      }
      .dm-header { display: none; }
      .dm-greeting {
        display: block;
        margin-bottom: 1.5rem;
      }
      .dm-greeting-top {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }
      .dm-club-avatar-lg {
        width: 52px;
        height: 52px;
        flex-shrink: 0;
      }
      .dm-club-avatar-lg .dm-club-avatar-initials {
        font-size: 0.9rem;
      }
      .dm-greeting-club {
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.3px;
        margin-bottom: 0.25rem;
      }
      .dm-greeting-text {
        font-size: 1.6rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
      }
      .dm-admin-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: rgba(163,230,53,0.15);
        color: #a3e635;
        border: 1px solid rgba(163,230,53,0.3);
        border-radius: 20px;
        padding: 0.3rem 0.85rem;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        letter-spacing: 0.3px;
        transition: background 0.2s;
      }
      .dm-admin-pill:hover { background: rgba(163,230,53,0.25); }
      .dm-body {
        overflow-y: visible;
        padding: 2rem 2.5rem 2rem;
        display: block;
      }
      .dm-hero-card { min-height: 200px; margin-bottom: 1.5rem; }
      .dm-hero-title { font-size: 1.4rem; }
      .dm-hero-desc { font-size: 0.86rem; }
      .dm-hero-cta { font-size: 0.88rem; padding: 0.5rem 1.2rem; }
      .dm-card-grid { grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
      .dm-action-card { min-height: 110px; }
      .dm-bottom-nav { display: none; }
      .dm-bottom-spacer { display: none; }
      .dm-section-label { font-size: 0.82rem; }
      .dm-booking-date { font-size: 0.95rem; }
      .dm-booking-time { font-size: 0.85rem; }
      .av-cell { padding: 0.6rem 0.5rem; font-size: 0.72rem; }
      .av-cell-time { padding-left: 1rem; }
      .av-status-text { font-size: 0.65rem; }
    }

    /* ── Court Availability ── */
    .av-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.55rem; }
    .av-date-input { background:#1b3028; border:1px solid rgba(163,230,53,0.25); border-radius:8px; color:#a3e635; font-size:0.78rem; font-weight:600; padding:0.3rem 0.6rem; cursor:pointer; font-family:inherit; outline:none; }
    .av-date-input::-webkit-calendar-picker-indicator { filter:invert(1) sepia(1) saturate(5) hue-rotate(50deg); cursor:pointer; }
    .av-loading { color:rgba(255,255,255,0.35); font-size:0.85rem; text-align:center; padding:1rem; }
    .av-table-wrap { background:#1b3028; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.3); overflow-x:auto; }
    .av-row { display:flex; border-bottom:1px solid rgba(255,255,255,0.05); }
    .av-row:last-child { border-bottom:none; }
    .av-header-row { background:#213830; border-bottom:1px solid rgba(255,255,255,0.1); }
    .av-cell { flex:1; padding:0.55rem 0.4rem; font-size:0.68rem; font-weight:700; text-align:center; display:flex; align-items:center; justify-content:center; gap:0.25rem; min-width:0; }
    .av-cell-time { flex:1.5; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.04em; justify-content:flex-start; padding-left:0.75rem; }
    .av-time-label { color:rgba(255,255,255,0.8); font-size:0.67rem; font-weight:600; text-transform:none; letter-spacing:0; }
    .av-cell-court { color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.04em; font-size:0.65rem; }
    .av-cell-status { flex-direction:column; gap:0.1rem; font-size:0.62rem; font-weight:800; letter-spacing:0.04em; }
    .av-booked { background:rgba(192,57,43,0.18); color:#e74c3c; }
    .av-pending { background:rgba(245,158,11,0.15); color:#f59e0b; }
    .av-open { color:#4ade80; }
    .av-icon { font-size:0.75rem; line-height:1; }
    .av-status-text { font-size:0.58rem; }

    /* ── Support chat FAB ── */
    .dm-chat-fab {
      position: fixed;
      bottom: 76px;
      right: 16px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #9f7338;
      color: #fff;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      z-index: 200;
      transition: background 0.18s, transform 0.18s;
    }
    .dm-chat-fab:hover { background: #7d5a2a; transform: scale(1.07); }
    .dm-chat-badge {
      position: absolute;
      top: -3px;
      right: -3px;
      background: #ef4444;
      color: #fff;
      font-size: 0.62rem;
      font-weight: 700;
      min-width: 17px;
      height: 17px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      border: 2px solid #0c1a11;
    }
    @media (min-width: 769px) {
      .dm-chat-fab { bottom: 24px; right: 24px; }
    }
  `],
})
export class PlayerDashboardComponent implements OnInit, OnDestroy {
  charges: Charge[] = [];
  loading = true;
  outstanding = 0;
  copiedPublicLink = false;
  clubSlug = '';
  clubName = 'Baseline Club';
  clubLogo = '';
  nextReservation: Reservation | null = null;
  nextTournament: Tournament | null = null;
  newsItems: ClubNews[] = [];

  availabilityDate    = '';
  availabilitySlots   : string[] = [];
  bookedByCourtMap    = new Map<number, Set<string>>();
  pendingByCourtMap   = new Map<number, Set<string>>();
  availabilityLoading = false;
  showAvailability    = false;
  courtCount          = 0;
  openingHour         = 5;
  closingHour         = 22;
  courtNumbers        : number[] = [];

  get pendingApprovalCharges(): Charge[] {
    return this.charges.filter((c) => c.approvalStatus === 'pending');
  }
  get rejectedCharges(): Charge[] {
    return this.charges.filter((c) => c.approvalStatus === 'rejected');
  }

  get clubInitials(): string {
    return this.clubName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  get clubNameFirst(): string {
    const parts = this.clubName.trim().split(' ');
    return parts.length > 1 ? parts.slice(0, -1).join(' ') : this.clubName;
  }
  get clubNameLast(): string {
    const parts = this.clubName.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  get greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  get firstName(): string {
    return this.auth.user()?.name?.split(' ')[0] ?? 'Player';
  }
  get operatingHours(): string {
    const fmt = (h: number) => {
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:00 ${h < 12 ? 'AM' : 'PM'}`;
    };
    return `${fmt(this.openingHour)} – ${fmt(this.closingHour)}`;
  }

  get activeTab(): string {
    const url = this.router.url;
    if (url.includes('/player/reserve')) return 'courts';
    if (url.includes('/player/reservations')) return 'bookings';
    if (url.includes('/player/tournaments')) return 'rankings';
    if (url.includes('/player/profile')) return 'profile';
    return 'home';
  }

  private buildAvailabilitySlots(): void {
    const slots: string[] = [];
    for (let h = this.openingHour; h < this.closingHour; h++) {
      const h12 = h % 12 === 0 ? 12 : h % 12;
      slots.push(`${h12}${h < 12 ? 'am' : 'pm'}`);
    }
    this.availabilitySlots = slots;
    this.courtNumbers = Array.from({ length: this.courtCount }, (_, i) => i + 1);
  }

  toggleAvailability(): void {
    this.showAvailability = !this.showAvailability;
    if (this.showAvailability && this.bookedByCourtMap.size === 0) {
      this.loadAvailability();
    }
  }

  loadAvailability(): void {
    if (!this.availabilityDate || this.courtCount === 0) return;
    this.availabilityLoading = true;
    this.cdr.detectChanges();
    forkJoin(
      this.courtNumbers.map(n => this.reservationService.getAvailability(n, this.availabilityDate))
    ).subscribe({
      next: (results) => {
        const booked  = new Map<number, Set<string>>();
        const pending = new Map<number, Set<string>>();
        this.courtNumbers.forEach((n, idx) => {
          booked.set(n,  new Set(results[idx]?.bookedSlots  ?? []));
          pending.set(n, new Set(results[idx]?.pendingSlots ?? []));
        });
        this.bookedByCourtMap  = booked;
        this.pendingByCourtMap = pending;
        this.availabilityLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.availabilityLoading = false; this.cdr.detectChanges(); },
    });
  }

  formatSlotShort(slot: string): string {
    const match = slot.match(/^(\d{1,2})(am|pm)$/i);
    if (!match) return slot;
    const hour = parseInt(match[1], 10);
    const isPm = match[2].toLowerCase() === 'pm';
    const hour24 = isPm ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
    const next24 = hour24 + 1;
    const nextH12 = next24 % 12 === 0 ? 12 : next24 % 12;
    const nextPeriod = next24 < 12 ? 'AM' : 'PM';
    return `${hour}${match[2].toUpperCase()}–${nextH12}${nextPeriod}`;
  }

  isBooked(court: number, slot: string): boolean {
    return this.bookedByCourtMap.get(court)?.has(slot) ?? false;
  }

  isPending(court: number, slot: string): boolean {
    return this.pendingByCourtMap.get(court)?.has(slot) ?? false;
  }

  // ── Support chat FAB ──
  supportChatOpen = false;
  supportContactId = '';
  supportContactName = 'CourtGo Support';
  messageUnreadCount = 0;
  private msgPollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    public auth: AuthService,
    private chargesService: ChargesService,
    private reservationService: ReservationService,
    private clubService: ClubService,
    private tournamentService: TournamentService,
    private newsService: NewsService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private renderer: Renderer2,
    private adminMessages: AdminMessagesService,
    private sound: SoundService,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');

    if (this.auth.isAdmin() && !this.auth.isSuperAdmin()) {
      this.adminMessages.getUnreadCount().subscribe({
        next: ({ count }) => { this.messageUnreadCount = count; this.cdr.detectChanges(); },
        error: () => {},
      });
      this.msgPollInterval = setInterval(() => {
        if (this.supportChatOpen) return;
        this.adminMessages.getUnreadCount().subscribe({
          next: ({ count }) => {
            if (count > this.messageUnreadCount) this.sound.notification();
            this.messageUnreadCount = count;
            this.cdr.detectChanges();
          },
          error: () => {},
        });
      }, 20_000);
    }

    this.chargesService.getMyCharges().subscribe({
      next: (charges) => {
        this.charges = charges;
        this.outstanding = charges
          .filter((c) => c.status === 'unpaid')
          .reduce((sum, c) => sum + c.amount, 0);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });

    this.reservationService.getMy().subscribe({
      next: (res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.nextReservation = res
          .filter((r) => r.status === 'confirmed' && new Date(r.date) >= today)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });

    this.availabilityDate = new Date().toISOString().slice(0, 10);

    const clubId = this.auth.user()?.clubId;
    if (clubId) {
      this.clubService.getClub(clubId).subscribe({
        next: (club) => {
          this.clubName    = club.name;
          this.clubSlug    = club.slug ?? '';
          this.clubLogo    = club.logo ?? '';
          this.courtCount  = club.courtCount  ?? 2;
          this.openingHour = club.openingHour ?? 5;
          this.closingHour = club.closingHour ?? 22;
          this.buildAvailabilitySlots();
          this.cdr.detectChanges();
        },
        error: () => {},
      });
    }

    this.tournamentService.getAll().subscribe({
      next: (ts) => {
        this.nextTournament = ts.find((t) => t.published && t.status !== 'completed') ?? null;
        this.cdr.detectChanges();
      },
      error: () => {},
    });

    this.newsService.getNews().subscribe({
      next: (items) => {
        this.newsItems = items;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
    if (this.msgPollInterval) clearInterval(this.msgPollInterval);
  }

  copyPublicLink() {
    const identifier = this.clubSlug || this.auth.user()?.clubId;
    if (!identifier) return;
    const link = `${window.location.origin}/book/${identifier}`;
    navigator.clipboard.writeText(link).then(() => {
      this.copiedPublicLink = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedPublicLink = false; this.cdr.detectChanges(); }, 2500);
    });
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

  formatTimeSlot(timeSlot: string): string {
    const match = timeSlot.match(/^(\d{1,2})(am|pm)$/i);
    if (!match) return timeSlot;
    const hour = parseInt(match[1], 10);
    const meridiem = match[2].toLowerCase();
    let startHour24: number;
    if (meridiem === 'am') {
      startHour24 = hour === 12 ? 0 : hour;
    } else {
      startHour24 = hour === 12 ? 12 : hour + 12;
    }
    const endHour24 = startHour24 + 1;
    const startMeridiem = startHour24 < 12 ? 'AM' : 'PM';
    const endMeridiem = endHour24 < 12 ? 'AM' : 'PM';
    const startDisplay = startHour24 % 12 === 0 ? 12 : startHour24 % 12;
    const endDisplay = endHour24 % 12 === 0 ? 12 : endHour24 % 12;
    return `${startDisplay}:00 ${startMeridiem} – ${endDisplay}:00 ${endMeridiem}`;
  }

  isPlayerObject(player: string | ReservationPlayer | any): player is ReservationPlayer {
    return player && typeof player === 'object' && 'name' in player;
  }

  toggleSupportChat() {
    if (this.supportChatOpen) {
      this.closeSupportChat();
      return;
    }
    if (this.supportContactId) {
      this.supportChatOpen = true;
      this.cdr.detectChanges();
      return;
    }
    this.adminMessages.getSupportContact().subscribe({
      next: (contact) => {
        this.supportContactId = contact._id;
        this.supportContactName = contact.name;
        this.supportChatOpen = true;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  closeSupportChat() {
    this.supportChatOpen = false;
    this.adminMessages.getUnreadCount().subscribe({
      next: ({ count }) => { this.messageUnreadCount = count; this.cdr.detectChanges(); },
      error: () => {},
    });
  }
}
