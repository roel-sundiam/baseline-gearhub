import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PublicBookingService } from '../../../core/services/public-booking.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { environment } from '../../../../environments/environment';

interface PublicSponsor {
  _id: string;
  businessName: string;
  logoUrl: string;
  description: string;
  promoText?: string;
  link: string;
}

@Component({
  selector: 'app-guest-book',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink],
  styleUrls: ['./guest-book-modern.scss'],
  template: `
    <div class="lp-shell">
      <!-- Top bar -->
      <div class="lp-topbar">
        <div class="lp-topbar-inner">
          <a routerLink="/book" class="lp-brand" aria-label="Browse clubs on CourtGo">
            <img src="/CourtGo.png" alt="CourtGo" class="lp-courtgo-logo" />
            <span class="lp-brand-divider" aria-hidden="true"></span>
            <span class="lp-brand-copy">Club booking</span>
          </a>
          <button type="button" class="lp-topbar-btn" (click)="goToLogin()">
            <i class="fas fa-user" aria-hidden="true"></i>
            <span>Login / Register</span>
          </button>
        </div>
      </div>

      @if (clubError) {
        <div class="lp-center">
          <div class="lp-error-icon"><i class="fas fa-exclamation-circle"></i></div>
          <p class="lp-error-msg">{{ clubError }}</p>
        </div>
      } @else {

        <!-- Hero Banner -->
        <div class="lp-hero-banner">
          @if (clubPhotos[0]) {
            <img class="lp-hero-img" [src]="clubPhotos[0]" [alt]="clubName + ' venue'" />
          }
          <div class="lp-hero-content">
            <span class="lp-hero-kicker">
              <i class="fas fa-circle-check" aria-hidden="true"></i>
              Official club page
            </span>
            <h2>Your next game starts here.</h2>
            <p>Discover the venue, check availability, and get on court in just a few steps.</p>
          </div>
        </div>

        <!-- Club Info Row -->
        <div class="lp-club-row">
          <div class="lp-club-row-inner">
            <div class="lp-club-left">
              @if (clubLogo) {
                <img class="lp-club-logo-img" [src]="clubLogo" [alt]="clubName" />
              } @else {
                <div class="lp-club-logo-placeholder"><i class="fas fa-table-tennis"></i></div>
              }
              <div class="lp-club-meta">
                <span class="lp-club-eyebrow">Welcome to</span>
                <h1 class="lp-club-name">{{ clubName || '&nbsp;' }}</h1>
                @if (clubLocation) {
                  <div class="lp-club-location">
                    <i class="fas fa-map-marker-alt" aria-hidden="true"></i> {{ clubLocation }}
                  </div>
                }
                <div class="lp-social-proof">
                  @if (clubRating > 0) {
                    <span class="lp-proof-item">
                      <i class="fas fa-star lp-proof-star"></i>
                      <strong>{{ clubRating }}</strong>
                      @if (clubReviewCount > 0) {
                        <span class="lp-proof-muted">({{ clubReviewCount }} reviews)</span>
                      }
                    </span>
                    <span class="lp-proof-sep">·</span>
                  }
                  @if (clubTotalBookings > 0) {
                    <span class="lp-proof-item">
                      <i class="fas fa-users"></i>
                      <strong>{{ clubTotalBookings }}+</strong>
                      <span class="lp-proof-muted">players booked</span>
                    </span>
                  }
                  <span class="lp-proof-item lp-proof-hours">
                    <i class="far fa-clock" aria-hidden="true"></i>
                    <span>{{ formatHour(openingHour) }}–{{ formatHour(closingHour) }} daily</span>
                  </span>
                </div>
              </div>
            </div>

            @if (!clubSuspended) {
              <div class="lp-club-right">
                <button type="button" class="lp-cta lp-cta-member" (click)="goToLogin()">
                  <div class="lp-cta-left">
                    <div class="lp-cta-icon lp-cta-icon-member"><i class="fas fa-user-circle"></i></div>
                    <div>
                      <div class="lp-cta-title">Member Login</div>
                      <div class="lp-cta-sub">Sign in to your club account</div>
                    </div>
                  </div>
                </button>
                @if (!isPerGame && !isHostedPlay) {
                  <button type="button" class="lp-cta lp-cta-guest" (click)="goToReserve()">
                    <div class="lp-cta-left">
                      <div class="lp-cta-icon lp-cta-icon-guest"><i class="fas fa-calendar-plus"></i></div>
                      <div>
                        <div class="lp-cta-title">Book as Guest</div>
                        <div class="lp-cta-sub">No account needed — walk-in booking</div>
                      </div>
                    </div>
                  </button>
                }
                @if (isPerGame) {
                  <a routerLink="/register" class="lp-cta lp-cta-guest" style="text-decoration:none">
                    <div class="lp-cta-left">
                      <div class="lp-cta-icon lp-cta-icon-guest"><i class="fas fa-user-plus"></i></div>
                      <div>
                        <div class="lp-cta-title">Register to Play</div>
                        <div class="lp-cta-sub">Create an account to join per-game sessions</div>
                      </div>
                    </div>
                  </a>
                }
              </div>
            }
          </div>
        </div>

        @if (clubSuspended) {
          <div class="lp-body">
            <div class="lp-suspended">
              <i class="fas fa-ban"></i>
              <p>This club is currently unavailable for bookings.</p>
            </div>
          </div>
        } @else {
          <div class="lp-body">

            <!-- Per Game Info Card -->
            @if (isPerGame) {
              <div class="lp-card lp-pg-card">
                <div class="lp-section-label"><i class="fas fa-table-tennis"></i> Per Game Play</div>
                <p class="lp-card-desc" style="margin-bottom:1.1rem">No court reservation needed — just show up and play. Pay per game at the club.</p>
                <div class="lp-pg-steps">
                  <div class="lp-pg-step">
                    <div class="lp-pg-step-num">1</div>
                    <div>
                      <div class="lp-pg-step-title">Register or Login</div>
                      <div class="lp-pg-step-sub">Create your player account</div>
                    </div>
                  </div>
                  <div class="lp-pg-step">
                    <div class="lp-pg-step-num">2</div>
                    <div>
                      <div class="lp-pg-step-title">Tap Join</div>
                      <div class="lp-pg-step-sub">Check in when you arrive at the club</div>
                    </div>
                  </div>
                  <div class="lp-pg-step">
                    <div class="lp-pg-step-num">3</div>
                    <div>
                      <div class="lp-pg-step-title">Play &amp; Pay</div>
                      <div class="lp-pg-step-sub">Games are recorded and billed per game</div>
                    </div>
                  </div>
                </div>
                <div class="lp-pg-actions">
                  <a routerLink="/register" class="lp-pg-btn-primary">
                    <i class="fas fa-user-plus"></i> Register as Player
                  </a>
                  <button class="lp-pg-btn-secondary" (click)="goToLogin()">
                    <i class="fas fa-sign-in-alt"></i> Login
                  </button>
                </div>
              </div>
            }

            <!-- Time Slots Preview -->
            @if (!isHostedPlay && !isPerGame) {
            <div class="lp-card lp-slots-card">
              <div class="lp-slots-header">
                <div class="lp-slots-header-left">
                  <div class="lp-section-label"><i class="far fa-clock"></i> Book a Court Online</div>
                  <p class="lp-card-desc">Reserve your court in minutes — members and guests welcome. Choose a time slot, submit your booking, and pay at the club.</p>
                </div>
                <div class="lp-slots-header-right">
                  <div class="lp-popular-label"><i class="far fa-clock"></i> Popular times today</div>
                  <div class="lp-slots-row">
                    @for (slot of popularSlots; track slot.time) {
                      <div class="lp-slot-chip">
                        <div class="lp-slot-time">{{ slot.time }}</div>
                        <div class="lp-slot-courts">{{ slot.available }} court{{ slot.available !== 1 ? 's' : '' }}</div>
                      </div>
                    }
                    @if (popularSlots.length === 0) {
                      <span class="lp-slots-empty">No availability data yet</span>
                    }
                  </div>
                  <div class="lp-view-btn-row">
                    <button class="lp-view-btn" (click)="goToReserve()">
                      <i class="far fa-calendar-alt"></i> View All Slots
                    </button>
                  </div>
                </div>
              </div>
            </div>
            }

            <!-- Hosted Play Sessions -->
            @if (showHostedPlaySessions) {
              <div class="lp-card lp-op-card">
                <div class="lp-op-toggle" style="cursor:default">
                  <div class="lp-op-toggle-left">
                    <div class="lp-op-icon"><i class="fas fa-calendar-check"></i></div>
                    <div>
                      <div class="lp-section-label" style="margin:0">Hosted Play Sessions</div>
                      <div class="lp-op-toggle-sub">Club-organized sessions — join and play</div>
                    </div>
                  </div>
                </div>
                <div class="lp-op-body">
                  @if (hostedPlaySessions.length > 0) {
                    <div class="lp-op-list">
                      @for (s of hostedPlaySessions; track s._id) {
                        <div class="lp-op-row">
                          <div class="lp-op-sport">
                            @if (s.venueLogo) {
                              <img [src]="s.venueLogo" [alt]="s.venue" class="lp-op-venue-logo" />
                            } @else {
                              <i [class]="s.sport === 'pickleball' ? 'fas fa-table-tennis' : 'fas fa-circle-dot'"></i>
                            }
                          </div>
                          <div class="lp-op-info">
                            <div class="lp-op-title">{{ s.title }}</div>
                            <div class="lp-op-meta">
                              <span><i class="far fa-calendar"></i> {{ s.date | date:'EEE, MMM d' : 'UTC' }}</span>
                              <span><i class="far fa-clock"></i> {{ s.startTime }} – {{ s.endTime }}</span>
                              <span><i class="fas fa-location-dot"></i> {{ s.venue }}</span>
                              @if (s.guestFeePerPlayer > 0) {
                                <span class="lp-op-type">₱{{ s.guestFeePerPlayer | number }}/player</span>
                              }
                              @if (s.maxGuests != null) {
                                <span class="lp-op-type">{{ guestSpotsLeft(s) }} guest {{ guestSpotsLeft(s) === 1 ? 'spot' : 'spots' }} left</span>
                              }
                            </div>
                          </div>
                          <div class="lp-op-right">
                            <div class="lp-op-spots">{{ s.currentPlayers }}/{{ s.maxPlayers }}</div>
                            @if (guestJoinConfirmed().get(s._id) === 'joined') {
                              <div class="lp-op-joined-badge"><i class="fas fa-check-circle"></i> Joined</div>
                            } @else if (guestJoinConfirmed().get(s._id) === 'pending') {
                              <div class="lp-op-pending-badge"><i class="fas fa-clock"></i> Pending</div>
                            } @else if (s.status === 'full') {
                              <div class="lp-op-type">Full</div>
                            } @else if (s.maxGuests != null && s.currentGuests >= s.maxGuests) {
                              <div class="lp-op-type">Guest spots full</div>
                            } @else if (s.premiumEvent) {
                              <div class="lp-op-type" title="Premium Event — only DUPR+ linked club members may join">Members only (DUPR+)</div>
                            } @else {
                              <button class="lp-op-join-btn"
                                (click)="openGuestJoinForm(s._id)"
                                [disabled]="guestJoinSubmitting()">
                                Join as Guest
                              </button>
                            }
                          </div>
                        </div>

                        <!-- Inline guest join form -->
                        @if (activeJoinSessionId() === s._id) {
                          <div class="lp-guest-join-form">
                            <div class="lp-gjf-header">
                              <span><i class="fas fa-user-plus"></i> Join as Guest — {{ s.title }}</span>
                              <button class="lp-gjf-close" (click)="closeGuestJoinForm()" [disabled]="guestJoinSubmitting()">
                                <i class="fas fa-times"></i>
                              </button>
                            </div>
                            <div class="lp-gjf-body">
                              <input class="lp-inq-input" type="text" placeholder="Your name *"
                                autocomplete="name"
                                [value]="guestJoinName()"
                                (input)="guestJoinName.set($any($event.target).value)" />
                              <input class="lp-inq-input" type="email" placeholder="Email address *"
                                autocomplete="email"
                                [value]="guestJoinEmail()"
                                (input)="guestJoinEmail.set($any($event.target).value)" />
                              <input class="lp-inq-input" type="tel" placeholder="Phone number (optional)"
                                autocomplete="tel"
                                [value]="guestJoinPhone()"
                                (input)="guestJoinPhone.set($any($event.target).value)" />

                              @if (activeSessionIsPaid()) {
                                <div class="lp-gjf-fee-note">
                                  <i class="fas fa-coins"></i>
                                  Session fee: <strong>₱{{ s.guestFeePerPlayer | number }}</strong>
                                </div>

                                @if (paymentMethods.length > 0) {
                                  <div class="lp-gjf-methods">
                                    @for (method of paymentMethods; track method) {
                                      <button class="lp-gjf-method-btn"
                                        [class.active]="guestJoinPaymentMethod() === method"
                                        (click)="guestJoinPaymentMethod.set(method)">
                                        {{ method }}
                                      </button>
                                    }
                                  </div>
                                }

                                @if (paymentQrCodes[guestJoinPaymentMethod()]) {
                                  <img [src]="paymentQrCodes[guestJoinPaymentMethod()]" alt="Payment QR" class="lp-gjf-qr" />
                                }
                                @if (paymentAccounts[guestJoinPaymentMethod()]) {
                                  <div class="lp-gjf-account">{{ paymentAccounts[guestJoinPaymentMethod()] }}</div>
                                }

                                @if (guestJoinScreenshotPreview()) {
                                  <div class="lp-gjf-preview">
                                    <img [src]="guestJoinScreenshotPreview()!" alt="Payment screenshot" class="lp-gjf-preview-img" />
                                    @if (!guestJoinUploadingScreenshot()) {
                                      <button class="lp-gjf-preview-remove" (click)="clearGuestJoinScreenshot()">
                                        <i class="fas fa-times"></i>
                                      </button>
                                    }
                                  </div>
                                } @else {
                                  <label class="lp-gjf-upload" [class.uploading]="guestJoinUploadingScreenshot()">
                                    <i class="fas fa-camera"></i>
                                    {{ guestJoinUploadingScreenshot() ? 'Uploading…' : 'Attach payment screenshot *' }}
                                    <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none"
                                      [disabled]="guestJoinUploadingScreenshot()"
                                      (change)="onGuestJoinScreenshot($event)" />
                                  </label>
                                }

                                <p class="lp-gjf-disclaimer">
                                  <i class="fas fa-circle-info"></i>
                                  You will be confirmed after the club admin reviews your payment.
                                </p>
                              }

                              @if (guestJoinError()) {
                                <p class="lp-gjf-error"><i class="fas fa-exclamation-triangle"></i> {{ guestJoinError() }}</p>
                              }

                              <button class="lp-gjf-submit"
                                [disabled]="guestJoinSubmitting() || guestJoinUploadingScreenshot() || (activeSessionIsPaid() && !guestJoinScreenshotUrl())"
                                (click)="submitGuestJoin(s)">
                                @if (guestJoinSubmitting()) {
                                  <i class="fas fa-circle-notch fa-spin"></i> Joining…
                                } @else {
                                  <i class="fas fa-user-plus"></i>
                                  {{ activeSessionIsPaid() ? 'Submit &amp; Await Approval' : 'Join Now' }}
                                }
                              </button>
                            </div>
                          </div>
                        }
                      }
                    </div>
                  } @else {
                    <div class="lp-op-empty">
                      <i class="fas fa-calendar-xmark lp-op-empty-icon"></i>
                      <p class="lp-op-empty-title">No Hosted Play Sessions</p>
                      <p class="lp-op-empty-desc">There are no upcoming hosted play sessions scheduled right now. Check back later for new sessions!</p>
                    </div>
                  }

                  <div class="lp-op-register">
                    <p class="lp-op-register-note">
                      <i class="fas fa-user-circle"></i>
                      Members: <a routerLink="/register" class="lp-op-register-link">Register</a> or
                      <button class="lp-op-register-login" (click)="goToLogin()">Log in</button> for full access
                    </p>
                  </div>
                </div>
              </div>
            }

            <!-- Open Play -->
            @if (!isHostedPlay && !isPerGame) {
            <div class="lp-card lp-op-card">
              <button class="lp-op-toggle" (click)="showOpenPlay = !showOpenPlay">
                <div class="lp-op-toggle-left">
                  <div class="lp-op-icon"><i class="fas fa-table-tennis"></i></div>
                  <div>
                    <div class="lp-section-label" style="margin:0">Open Play Sessions</div>
                    <div class="lp-op-toggle-sub">Drop in and play with the community</div>
                  </div>
                </div>
                <i class="fas lp-op-chevron" [class.fa-chevron-down]="!showOpenPlay" [class.fa-chevron-up]="showOpenPlay"></i>
              </button>

              @if (showOpenPlay) {
                <div class="lp-op-body">
                  @if (openPlaySessions.length > 0) {
                    <div class="lp-op-list">
                      @for (s of openPlaySessions; track s._id) {
                        <div class="lp-op-row">
                          <div class="lp-op-sport">
                            <i [class]="s.sport === 'pickleball' ? 'fas fa-table-tennis' : 'fas fa-circle-dot'"></i>
                          </div>
                          <div class="lp-op-info">
                            <div class="lp-op-title">{{ s.title }}</div>
                            <div class="lp-op-meta">
                              <span><i class="far fa-calendar"></i> {{ s.sessionDate | date:'EEE, MMM d' }}</span>
                              <span><i class="far fa-clock"></i> {{ s.startTime }} – {{ s.endTime }}</span>
                              <span class="lp-op-type">{{ s.matchType }}</span>
                            </div>
                          </div>
                          <div class="lp-op-right">
                            <div class="lp-op-spots">{{ s.joinedPlayers }}/{{ s.maxPlayers }}</div>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="lp-op-empty">
                      <i class="fas fa-calendar-xmark lp-op-empty-icon"></i>
                      <p class="lp-op-empty-title">No Open Play Sessions</p>
                      <p class="lp-op-empty-desc">There are no upcoming open play sessions scheduled at this venue. Check back later for new sessions!</p>
                    </div>
                  }

                  <div class="lp-op-register">
                    <p class="lp-op-register-note"><i class="fas fa-user-plus"></i> To join a session you need a player account</p>
                    <a routerLink="/register" class="lp-op-join">Register as Player</a>
                  </div>
                </div>
              }
            </div>
            }

            <!-- About the Club -->
            <div class="lp-card lp-about-card">
              <div class="lp-section-label"><i class="fas fa-table-tennis"></i> About the Club</div>
              <div class="lp-about-row">
                <p class="lp-about-desc">
                  {{ clubDescription || (clubName + ' is a premier tennis destination in ' + (clubLocation || 'our area') + '. We offer well-maintained courts, friendly staff, and a welcoming environment for players of all levels.') }}
                </p>
                <div class="lp-photos-grid">
                  @if (clubPhotos.length > 0) {
                    @for (photo of clubPhotos.slice(0, 4); track photo) {
                      <div class="lp-photo-tile lp-photo-tile-clickable" (click)="openLightbox(photo)">
                        <img [src]="photo" alt="Court photo" class="lp-photo-img" />
                        <div class="lp-photo-zoom"><i class="fas fa-expand"></i></div>
                      </div>
                    }
                  } @else {
                    @for (p of fallbackPhotoPlaceholders; track p) {
                      <div class="lp-photo-tile"><i class="fas fa-table-tennis lp-photo-icon"></i></div>
                    }
                  }
                </div>
              </div>
            </div>

            <!-- Partners -->
            <div class="lp-card lp-partners-card">
              <div class="lp-section-label"><i class="fas fa-handshake"></i> Our Partners</div>
              <p class="lp-card-desc" style="margin-bottom:0.9rem">Local businesses supporting the CourtGo community.</p>
              @if (sponsors.length > 0) {
                <div class="lp-partners-grid">
                  @for (sponsor of sponsors; track sponsor._id) {
                    <div class="lp-partner-tile">
                      <img [src]="sponsor.logoUrl" [alt]="sponsor.businessName" class="lp-partner-logo" />
                      <div class="lp-partner-info">
                        <span class="lp-partner-badge">Sponsored</span>
                        <div class="lp-partner-name">{{ sponsor.businessName }}</div>
                        <p class="lp-partner-desc">{{ sponsor.description }}</p>
                        @if (sponsor.promoText) { <p class="lp-partner-promo">{{ sponsor.promoText }}</p> }
                        <a [href]="sponsor.link" target="_blank" rel="noopener" class="lp-partner-link">
                          Visit <i class="fas fa-arrow-up-right-from-square"></i>
                        </a>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <p class="lp-partners-empty">Be the first local business featured here.</p>
              }
              <a routerLink="/partner-with-us" class="lp-partners-cta">
                Become a Partner <i class="fas fa-arrow-up-right-from-square"></i>
              </a>
            </div>

            <!-- Lightbox -->
            @if (lightboxPhoto) {
              <div class="lp-lightbox" (click)="closeLightbox()">
                <button class="lp-lightbox-close" (click)="closeLightbox()"><i class="fas fa-times"></i></button>
                <img [src]="lightboxPhoto" alt="Court photo" class="lp-lightbox-img" (click)="$event.stopPropagation()" />
              </div>
            }

            <!-- Features / Highlights -->
            <div class="lp-features-grid">
              @for (feat of features; track feat.title) {
                <div class="lp-feature-card">
                  <div class="lp-feat-icon"><i [class]="'fas ' + feat.icon"></i></div>
                  <div class="lp-feat-title">{{ feat.title }}</div>
                  <div class="lp-feat-desc">{{ feat.desc }}</div>
                </div>
              }
            </div>

            <!-- Pricing -->
            @if (ratesLoaded) {
              <div class="lp-card lp-pricing-card">
                <div class="lp-section-label"><i class="fas fa-coins"></i> Pricing</div>
                @if (isHostedPlay) {
                  <p class="lp-card-desc">Each hosted play session sets its own fee per player — see the fee on each session above. A small service fee is added at checkout.</p>
                } @else if (isPerGame) {
                  <div class="lp-pricing-grid">
                    <div class="lp-price-tile">
                      <div class="lp-price-label">Game Fee</div>
                      <div class="lp-price-amount">₱{{ perGameFee | number }}</div>
                      <div class="lp-price-unit">/ player / game</div>
                    </div>
                    @if (perGameGuestFee > 0) {
                      <div class="lp-price-tile">
                        <div class="lp-price-label">Guest Fee</div>
                        <div class="lp-price-amount">₱{{ perGameGuestFee | number }}</div>
                        <div class="lp-price-unit">/ guest / game</div>
                      </div>
                    }
                  </div>
                } @else if (pricingModel === 'tiered') {
                  <div class="lp-pricing-grid">
                    <div class="lp-price-tile">
                      <div class="lp-price-label">Daytime (6AM – 5PM)</div>
                      <div class="lp-price-amount">₱{{ daytimeRate | number }}</div>
                      <div class="lp-price-unit">/ hour</div>
                    </div>
                    <div class="lp-price-tile">
                      <div class="lp-price-label">Evening (5PM – 12AM)</div>
                      <div class="lp-price-amount">₱{{ eveningRate | number }}</div>
                      <div class="lp-price-unit">/ hour</div>
                    </div>
                    <div class="lp-price-tile">
                      <div class="lp-price-label">Overnight (12AM – 6AM)</div>
                      <div class="lp-price-amount">₱{{ overnightRate | number }}</div>
                      <div class="lp-price-unit">/ hour</div>
                    </div>
                  </div>
                } @else {
                  <div class="lp-pricing-grid">
                    <div class="lp-price-tile">
                      <div class="lp-price-label">Weekday (6AM – 5PM)</div>
                      <div class="lp-price-amount">₱{{ weekdayRate | number }}</div>
                      <div class="lp-price-unit">/ hour</div>
                    </div>
                    <div class="lp-price-tile">
                      <div class="lp-price-label">Weekday (5PM – 10PM)</div>
                      <div class="lp-price-amount">₱{{ weekdayRate | number }}</div>
                      <div class="lp-price-unit">/ hour</div>
                    </div>
                    <div class="lp-price-tile">
                      <div class="lp-price-label">Weekend (All Day)</div>
                      <div class="lp-price-amount">₱{{ weekendRate | number }}</div>
                      <div class="lp-price-unit">/ hour</div>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Contact & Information -->
            <div class="lp-card lp-info-card">
              <div class="lp-section-label"><i class="fas fa-address-card"></i> Contact & Information</div>
              <div class="lp-info-grid">
                <div class="lp-info-col">
                  <div class="lp-info-col-title">Contact Information</div>
                  @if (clubMobile) {
                    <div class="lp-info-row"><i class="fas fa-phone"></i> {{ clubMobile }}</div>
                  }
                  @if (clubEmail) {
                    <div class="lp-info-row"><i class="fas fa-envelope"></i> {{ clubEmail }}</div>
                  }
                  @if (!clubMobile && !clubEmail) {
                    <div class="lp-info-row lp-info-empty">Contact details not listed</div>
                  }
                </div>
                <div class="lp-info-col">
                  <div class="lp-info-col-title"><i class="far fa-clock"></i> Operating Hours</div>
                  <div class="lp-hours-list">
                    @for (day of days; track day) {
                      <div class="lp-hours-row">
                        <span class="lp-hours-day">{{ day }}</span>
                        <span class="lp-hours-time">{{ formatHour(openingHour) }} to {{ formatHour(closingHour) }}</span>
                      </div>
                    }
                  </div>
                </div>
                <div class="lp-info-col">
                  <div class="lp-info-col-title">Social Media</div>
                  @if (clubSocialLinks.facebook) {
                    <a [href]="clubSocialLinks.facebook" target="_blank" rel="noopener noreferrer"
                       class="lp-social-btn lp-social-fb">
                      <i class="fab fa-facebook"></i> Facebook
                    </a>
                  }
                  @if (clubSocialLinks.instagram) {
                    <a [href]="clubSocialLinks.instagram" target="_blank" rel="noopener noreferrer"
                       class="lp-social-btn lp-social-ig">
                      <i class="fab fa-instagram"></i> Instagram
                    </a>
                  }
                  @if (clubSocialLinks.reclub) {
                    <a [href]="clubSocialLinks.reclub" target="_blank" rel="noopener noreferrer"
                       class="lp-social-btn lp-social-reclub">
                      <img src="/reclub.png" class="lp-social-sm-icon" alt="Reclub" /> Reclub
                    </a>
                  }
                  @if (!clubSocialLinks.facebook && !clubSocialLinks.instagram && !clubSocialLinks.reclub) {
                    <span class="lp-info-empty">No social links added</span>
                  }
                </div>
              </div>
            </div>

            <!-- Chat -->
            <div class="lp-card lp-chat-card">
              <div class="lp-chat-header">
                <div>
                  <div class="lp-section-label"><i class="fas fa-comment-dots"></i> Chat with Us</div>
                  <p class="lp-card-desc">
                    @if (!chatOpen) { Send a message — the club admin will reply here. }
                    @else { Live chat active · replies appear automatically }
                  </p>
                </div>
              </div>

              @if (!chatOpen) {
                <form class="lp-inq-form" (ngSubmit)="submitInquiry()">
                  <div class="lp-inq-row">
                    <input class="lp-inq-input" type="text" placeholder="Your name"
                      [(ngModel)]="inquiry.senderName" name="senderName" required />
                    <input class="lp-inq-input" type="email" placeholder="Your email"
                      [(ngModel)]="inquiry.senderEmail" name="senderEmail" required />
                  </div>
                  <textarea class="lp-inq-input lp-inq-textarea" placeholder="Your message..."
                    [(ngModel)]="inquiry.message" name="message" rows="3" required></textarea>
                  @if (inquiryError) { <p class="lp-inq-error">{{ inquiryError }}</p> }
                  <button class="lp-inq-btn" type="submit" [disabled]="inquirySubmitting">
                    @if (inquirySubmitting) { <i class="fas fa-spinner fa-spin"></i> Starting chat... }
                    @else { <i class="fas fa-comment-dots"></i> Start Chat }
                  </button>
                </form>
              } @else {
                <div class="lp-chat-thread" #chatThread>
                  @for (msg of chatMessages; track msg.createdAt) {
                    <div class="lp-chat-msg"
                         [class.lp-chat-guest]="msg.sender === 'guest'"
                         [class.lp-chat-admin]="msg.sender === 'admin'">
                      <span class="lp-chat-name">{{ msg.sender === 'guest' ? 'You' : msg.name }}</span>
                      <div class="lp-chat-bubble">{{ msg.body }}</div>
                    </div>
                  }
                  @if (chatMessages.length === 0) {
                    <p class="lp-chat-waiting">Waiting for admin to join...</p>
                  }
                </div>
                <form class="lp-chat-input-row" (ngSubmit)="sendFollowup()">
                  <input class="lp-chat-input" type="text" placeholder="Type a message..."
                    [(ngModel)]="followupText" name="followup" autocomplete="off" />
                  <button class="lp-chat-send" type="submit" [disabled]="followupSending">
                    <i class="fas fa-paper-plane"></i>
                  </button>
                </form>
              }
            </div>

          </div>
        }

        <div class="lp-footer">© 2025 CourtGo. All rights reserved.</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #0c1a11; }

    .lp-shell {
      min-height: 100vh;
      background: #0c1a11;
      display: flex;
      flex-direction: column;
    }

    /* ── Top bar ── */
    .lp-topbar {
      padding: 0.75rem 2.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .lp-courtgo-logo { height: 30px; width: auto; display: block; filter: brightness(0.9); }
    .lp-topbar-btn {
      padding: 0.45rem 1rem;
      background: rgba(163,230,53,0.06);
      border: 1px solid rgba(163,230,53,0.22);
      border-radius: 8px;
      color: rgba(255,255,255,0.7);
      font-size: 0.8rem;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s;
    }
    .lp-topbar-btn:hover { background: rgba(163,230,53,0.13); color: #fff; }
    .lp-topbar-btn i { color: #a3e635; font-size: 0.75rem; }

    /* ── Hero Banner ── */
    .lp-hero-banner {
      width: 100%;
      background: #0c1a11;
      position: relative;
      overflow: hidden;
    }

    .lp-hero-img {
      width: 100%;
      height: auto;
      display: block;
    }
    .lp-hero-banner::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
    }
    .lp-hero-banner::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 100px;
      background: linear-gradient(transparent, #0c1a11);
    }

    /* ── Club Info Row ── */
    .lp-club-row {
      background: #0c1a11;
      padding: 1.25rem 2.5rem 1.4rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .lp-club-row-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
      max-width: 1280px;
      margin: 0 auto;
    }
    .lp-club-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      min-width: 0;
    }
    .lp-club-logo-img {
      width: 72px; height: 72px;
      border-radius: 18px;
      object-fit: cover;
      border: 2px solid rgba(163,230,53,0.25);
      flex-shrink: 0;
    }
    .lp-club-logo-placeholder {
      width: 72px; height: 72px;
      border-radius: 18px;
      background: linear-gradient(135deg, #1f4d2e 0%, #0f2d18 100%);
      border: 2px solid rgba(163,230,53,0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.7rem;
      color: rgba(163,230,53,0.55);
      flex-shrink: 0;
    }
    .lp-club-meta { min-width: 0; }
    .lp-club-name {
      font-size: 1.4rem;
      font-weight: 900;
      color: #ffffff;
      margin: 0 0 0.28rem;
      line-height: 1.2;
    }
    .lp-club-location {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.38);
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-bottom: 0.5rem;
    }
    .lp-club-location i { color: #a3e635; font-size: 0.7rem; }

    /* Social proof */
    .lp-social-proof {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .lp-proof-item {
      display: flex;
      align-items: center;
      gap: 0.22rem;
      font-size: 0.77rem;
      color: rgba(255,255,255,0.6);
    }
    .lp-proof-item i { font-size: 0.68rem; color: rgba(255,255,255,0.3); }
    .lp-proof-star { color: #f59e0b !important; }
    .lp-proof-item strong { color: #ffffff; }
    .lp-proof-muted { color: rgba(255,255,255,0.32); }
    .lp-proof-sep { color: rgba(255,255,255,0.18); font-size: 0.8rem; }

    /* Club right — CTAs */
    .lp-club-right {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      min-width: 230px;
    }
    .lp-cta {
      width: 100%;
      display: flex;
      align-items: center;
      padding: 0.85rem 1rem;
      border-radius: 12px;
      border: 1px solid;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.18s;
      text-align: left;
    }
    .lp-cta-left { display: flex; align-items: center; gap: 0.75rem; width: 100%; }
    .lp-cta-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
    }
    .lp-cta-title { font-size: 0.88rem; font-weight: 800; margin-bottom: 0.1rem; }
    .lp-cta-sub { font-size: 0.71rem; font-weight: 500; }

    .lp-cta-member { background: #1b3028; border-color: rgba(255,255,255,0.1); }
    .lp-cta-member:hover { border-color: rgba(255,255,255,0.2); background: #1f3a2e; }
    .lp-cta-member .lp-cta-icon-member { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.65); }
    .lp-cta-member .lp-cta-title { color: #ffffff; }
    .lp-cta-member .lp-cta-sub { color: rgba(255,255,255,0.38); }

    .lp-cta-guest { background: rgba(163,230,53,0.09); border-color: rgba(163,230,53,0.32); }
    .lp-cta-guest:hover { background: rgba(163,230,53,0.15); border-color: rgba(163,230,53,0.5); }
    .lp-cta-guest .lp-cta-icon-guest { background: rgba(163,230,53,0.14); color: #a3e635; }
    .lp-cta-guest .lp-cta-title { color: #a3e635; }
    .lp-cta-guest .lp-cta-sub { color: rgba(163,230,53,0.52); }

    /* ── Body ── */
    .lp-body {
      padding: 1.5rem 2.5rem;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      max-width: 1280px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
    }

    /* Shared card */
    .lp-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 1.3rem 1.4rem;
    }
    .lp-section-label {
      font-size: 0.63rem;
      font-weight: 700;
      color: #a3e635;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      display: flex;
      align-items: center;
      gap: 0.32rem;
      margin-bottom: 0.3rem;
    }
    .lp-card-desc {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.42);
      margin: 0;
      line-height: 1.55;
    }

    /* ── Time Slots ── */
    .lp-slots-header {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
    }
    .lp-slots-header-left { flex: 0 0 auto; max-width: 280px; }
    .lp-slots-header-right { flex: 1; }
    .lp-popular-label {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.38);
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-bottom: 0.55rem;
    }
    .lp-slots-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .lp-slot-chip {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 0.5rem 0.8rem;
      text-align: center;
      min-width: 72px;
    }
    .lp-slot-time { font-size: 0.82rem; font-weight: 700; color: #ffffff; margin-bottom: 0.12rem; }
    .lp-slot-courts { font-size: 0.68rem; color: rgba(255,255,255,0.38); }
    .lp-view-btn-row { display: flex; justify-content: flex-end; }
    .lp-view-btn {
      padding: 0.52rem 1rem;
      background: rgba(163,230,53,0.08);
      border: 1px solid rgba(163,230,53,0.28);
      border-radius: 9px;
      color: #a3e635;
      font-size: 0.78rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.38rem;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .lp-view-btn:hover { background: rgba(163,230,53,0.15); }

    /* ── Open Play ── */
    .lp-op-card { padding: 0; overflow: hidden; }
    .lp-op-toggle {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 1.1rem 1.4rem; background: none; border: none; cursor: pointer;
      font-family: inherit; text-align: left; gap: 1rem;
    }
    .lp-op-toggle:hover { background: rgba(255,255,255,0.02); }
    .lp-op-toggle-left { display: flex; align-items: center; gap: 0.85rem; }
    .lp-op-icon {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: rgba(163,230,53,0.1); color: #a3e635;
      display: flex; align-items: center; justify-content: center; font-size: 1rem;
    }
    .lp-op-toggle-sub { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin-top: 0.15rem; }
    .lp-op-chevron { font-size: 0.78rem; color: rgba(255,255,255,0.35); flex-shrink: 0; transition: transform 0.2s; }
    .lp-op-body { padding: 0 1.4rem 1.2rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem; }
    .lp-op-list { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
    .lp-op-row {
      display: flex; align-items: center; gap: 0.85rem;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px; padding: 0.85rem 1rem;
    }
    .lp-op-sport {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: rgba(163,230,53,0.1); color: #a3e635;
      display: flex; align-items: center; justify-content: center; font-size: 1rem;
      overflow: hidden;
    }
    .lp-op-venue-logo { width: 36px; height: 36px; object-fit: cover; display: block; }
    .lp-op-info { flex: 1; min-width: 0; }
    .lp-op-title { font-size: 0.88rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem; }
    .lp-op-meta { display: flex; flex-wrap: wrap; gap: 0.6rem; font-size: 0.74rem; color: rgba(255,255,255,0.45); }
    .lp-op-meta i { margin-right: 0.2rem; }
    .lp-op-type {
      background: rgba(255,255,255,0.07); border-radius: 4px;
      padding: 0.1rem 0.4rem; font-size: 0.68rem; text-transform: capitalize; color: rgba(255,255,255,0.5);
    }
    .lp-op-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; flex-shrink: 0; }
    .lp-op-spots { font-size: 0.75rem; color: rgba(255,255,255,0.38); white-space: nowrap; }
    .lp-op-empty {
      text-align: center; padding: 1.5rem 1rem; margin-bottom: 1rem;
      background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px;
    }
    .lp-op-empty-icon { font-size: 1.8rem; color: rgba(255,255,255,0.15); display: block; margin-bottom: 0.6rem; }
    .lp-op-empty-title { font-size: 0.9rem; font-weight: 700; color: rgba(255,255,255,0.55); margin: 0 0 0.4rem; }
    .lp-op-empty-desc { font-size: 0.78rem; color: rgba(255,255,255,0.32); margin: 0; line-height: 1.55; }
    .lp-op-register {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
      padding-top: 0.85rem; border-top: 1px solid rgba(255,255,255,0.06);
    }
    .lp-op-register-note { font-size: 0.78rem; color: rgba(255,255,255,0.38); margin: 0; display: flex; align-items: center; gap: 0.4rem; }
    .lp-op-register-note i { color: #a3e635; }
    .lp-op-join {
      display: inline-block; padding: 0.42rem 1rem;
      background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.3);
      border-radius: 8px; color: #a3e635;
      font-size: 0.78rem; font-weight: 700; text-decoration: none;
      white-space: nowrap; transition: background 0.15s;
    }
    .lp-op-join:hover { background: rgba(163,230,53,0.22); }

    /* ── About ── */
    .lp-about-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      margin: 0.8rem 0 0.9rem;
      align-items: start;
    }
    .lp-about-desc {
      font-size: 0.83rem;
      color: rgba(255,255,255,0.48);
      line-height: 1.65;
      margin: 0;
    }
    .lp-photos-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.45rem;
    }
    .lp-photo-tile {
      aspect-ratio: 4/3;
      background: linear-gradient(135deg, #1a3d24 0%, #0f2518 100%);
      border: 1px solid rgba(163,230,53,0.09);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lp-photo-icon { font-size: 1.4rem; color: rgba(163,230,53,0.18); }
    .lp-photo-img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; display: block; }
    .lp-photo-tile-clickable { cursor: pointer; position: relative; overflow: hidden; }
    .lp-photo-tile-clickable:hover .lp-photo-img { transform: scale(1.05); transition: transform 0.25s ease; }
    .lp-photo-zoom {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0);
      color: #fff; font-size: 1.1rem;
      opacity: 0; transition: opacity 0.2s, background 0.2s;
      border-radius: 10px;
    }
    .lp-photo-tile-clickable:hover .lp-photo-zoom { opacity: 1; background: rgba(0,0,0,0.35); }
    .lp-lightbox {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.88);
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem;
      cursor: zoom-out;
    }
    .lp-lightbox-img {
      max-width: 100%; max-height: 90vh;
      border-radius: 12px;
      object-fit: contain;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      cursor: default;
    }
    .lp-lightbox-close {
      position: absolute; top: 1rem; right: 1rem;
      width: 40px; height: 40px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      color: #fff; font-size: 1rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .lp-lightbox-close:hover { background: rgba(255,255,255,0.25); }
    .lp-slots-empty { font-size: 0.78rem; color: rgba(255,255,255,0.28); font-style: italic; padding: 0.25rem 0; }
    .lp-social-ig { background: rgba(228,64,95,0.09); border-color: rgba(228,64,95,0.2); }

    /* ── Partners ── */
    .lp-partners-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.75rem;
    }
    .lp-partner-tile {
      display: flex;
      gap: 0.75rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 0.9rem;
    }
    .lp-partner-logo {
      width: 42px; height: 42px;
      border-radius: 10px;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .lp-partner-info { min-width: 0; }
    .lp-partner-badge {
      display: inline-block; font-size: 0.6rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06);
      padding: 0.12rem 0.45rem; border-radius: 100px; margin-bottom: 0.3rem;
    }
    .lp-partner-name { font-size: 0.87rem; font-weight: 700; color: #fff; margin-bottom: 0.3rem; }
    .lp-partner-desc { font-size: 0.78rem; color: rgba(255,255,255,0.45); line-height: 1.55; margin: 0 0 0.35rem; }
    .lp-partner-promo { font-size: 0.76rem; color: #fbbf24; margin: 0 0 0.5rem; }
    .lp-partner-link {
      display: inline-flex; align-items: center; gap: 0.32rem;
      font-size: 0.75rem; font-weight: 700; color: #a3e635;
      text-decoration: none; padding: 0.32rem 0.7rem; border-radius: 100px;
      border: 1px solid rgba(163,230,53,0.3);
      transition: background 0.15s;
    }
    .lp-partner-link:hover { background: rgba(163,230,53,0.1); }
    .lp-partners-empty { font-size: 0.82rem; color: rgba(255,255,255,0.3); font-style: italic; margin: 0 0 0.9rem; }
    .lp-partners-cta {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.8rem; font-weight: 700; color: #a3e635; text-decoration: none;
      border: 1px solid rgba(163,230,53,0.3); border-radius: 100px;
      padding: 0.45rem 1rem; transition: background 0.15s;
    }
    .lp-partners-cta:hover { background: rgba(163,230,53,0.1); }

    /* ── Features ── */
    .lp-features-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.7rem;
    }
    .lp-feature-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      padding: 1.1rem;
    }
    .lp-feat-icon {
      width: 38px; height: 38px;
      background: rgba(163,230,53,0.1);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.95rem;
      color: #a3e635;
      margin-bottom: 0.65rem;
    }
    .lp-feat-title { font-size: 0.84rem; font-weight: 700; color: #ffffff; margin-bottom: 0.32rem; }
    .lp-feat-desc { font-size: 0.75rem; color: rgba(255,255,255,0.38); line-height: 1.5; }

    /* ── Pricing ── */
    .lp-pricing-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.7rem;
      margin-top: 0.8rem;
    }
    .lp-price-tile {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 1rem 1.1rem;
    }
    .lp-price-label { font-size: 0.76rem; color: rgba(255,255,255,0.48); margin-bottom: 0.38rem; }
    .lp-price-amount { font-size: 1.35rem; font-weight: 900; color: #a3e635; line-height: 1; }
    .lp-price-unit { font-size: 0.7rem; color: rgba(255,255,255,0.32); margin-top: 0.18rem; }
    .lp-price-tile-policy {
      background: rgba(163,230,53,0.04);
      border-color: rgba(163,230,53,0.14);
    }
    .lp-price-policy-label { font-size: 0.76rem; font-weight: 700; color: #a3e635; margin-bottom: 0.38rem; }
    .lp-price-policy-text { font-size: 0.76rem; color: rgba(255,255,255,0.42); margin: 0; line-height: 1.5; }

    /* ── Contact / Info ── */
    .lp-info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      margin-top: 0.85rem;
    }
    .lp-info-col-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.7rem;
      display: flex;
      align-items: center;
      gap: 0.32rem;
    }
    .lp-info-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.79rem;
      color: rgba(255,255,255,0.55);
      margin-bottom: 0.38rem;
    }
    .lp-info-row i { color: rgba(255,255,255,0.28); font-size: 0.73rem; width: 14px; text-align: center; }
    .lp-info-empty { color: rgba(255,255,255,0.25); font-style: italic; }
    .lp-hours-list { display: flex; flex-direction: column; gap: 0.22rem; }
    .lp-hours-row { display: flex; justify-content: space-between; font-size: 0.77rem; }
    .lp-hours-day { color: rgba(255,255,255,0.45); }
    .lp-hours-time { color: rgba(255,255,255,0.65); }
    .lp-social-btn {
      display: flex;
      align-items: center;
      gap: 0.48rem;
      padding: 0.52rem 0.9rem;
      border-radius: 9px;
      font-size: 0.79rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.15s;
      margin-bottom: 0.45rem;
      border: 1px solid rgba(255,255,255,0.13);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.65);
    }
    .lp-social-btn:hover { opacity: 0.8; }
    .lp-social-btn i { font-size: 0.95rem; }
    .lp-social-sm-icon { width: 18px; height: 18px; object-fit: contain; border-radius: 3px; }
    .lp-social-fb { background: rgba(24,119,242,0.09); border-color: rgba(24,119,242,0.22); }
    .lp-social-reclub { background: rgba(250,190,0,0.07); border-color: rgba(250,190,0,0.18); }

    /* ── Chat ── */
    .lp-chat-header { margin-bottom: 1rem; }
    .lp-inq-form { display: flex; flex-direction: column; gap: 0.6rem; }
    .lp-inq-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
    .lp-inq-input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #ffffff;
      font-family: inherit;
      font-size: 0.88rem;
      padding: 0.7rem 0.85rem;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.18s;
    }
    .lp-inq-input::placeholder { color: rgba(255,255,255,0.28); }
    .lp-inq-input:focus { border-color: rgba(163,230,53,0.45); }
    .lp-inq-textarea { resize: none; }
    .lp-inq-error { font-size: 0.8rem; color: #f87171; margin: 0; }
    .lp-inq-btn {
      width: 100%;
      padding: 0.78rem;
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.35);
      border-radius: 10px;
      color: #a3e635;
      font-size: 0.9rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.18s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .lp-inq-btn:hover:not(:disabled) { background: rgba(163,230,53,0.2); }
    .lp-inq-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .lp-chat-thread {
      max-height: 280px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      margin-bottom: 0.85rem;
      padding-right: 2px;
    }
    .lp-chat-msg { display: flex; flex-direction: column; max-width: 72%; }
    .lp-chat-guest { align-self: flex-end; align-items: flex-end; }
    .lp-chat-admin { align-self: flex-start; align-items: flex-start; }
    .lp-chat-name {
      font-size: 0.65rem; font-weight: 700;
      color: rgba(255,255,255,0.32);
      margin-bottom: 0.2rem;
      text-transform: uppercase; letter-spacing: 0.6px;
    }
    .lp-chat-bubble {
      padding: 0.6rem 0.85rem;
      border-radius: 14px;
      font-size: 0.87rem;
      line-height: 1.5;
      word-break: break-word;
    }
    .lp-chat-guest .lp-chat-bubble {
      background: rgba(163,230,53,0.14);
      border: 1px solid rgba(163,230,53,0.25);
      color: #e8ffc3;
      border-bottom-right-radius: 4px;
    }
    .lp-chat-admin .lp-chat-bubble {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.85);
      border-bottom-left-radius: 4px;
    }
    .lp-chat-waiting {
      font-size: 0.8rem; color: rgba(255,255,255,0.28);
      text-align: center; padding: 1.5rem 0 0.5rem;
      margin: 0; font-style: italic;
    }
    .lp-chat-input-row {
      display: flex; gap: 0.5rem;
      border-top: 1px solid rgba(255,255,255,0.07);
      padding-top: 0.85rem;
    }
    .lp-chat-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #fff; font-family: inherit; font-size: 0.87rem;
      padding: 0.6rem 0.8rem; outline: none; transition: border-color 0.18s;
    }
    .lp-chat-input::placeholder { color: rgba(255,255,255,0.25); }
    .lp-chat-input:focus { border-color: rgba(163,230,53,0.4); }
    .lp-chat-send {
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.3);
      border-radius: 10px; color: #a3e635; font-size: 0.95rem;
      width: 40px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.15s;
    }
    .lp-chat-send:hover:not(:disabled) { background: rgba(163,230,53,0.22); }
    .lp-chat-send:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── States ── */
    .lp-suspended { text-align: center; padding: 2.5rem 1rem; color: #ef4444; }
    .lp-suspended i { font-size: 2rem; margin-bottom: 0.75rem; display: block; }
    .lp-suspended p { font-size: 0.9rem; font-weight: 600; margin: 0; }
    .lp-center {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 3rem 1.5rem;
    }
    .lp-error-icon { font-size: 2.5rem; color: #ef4444; margin-bottom: 1rem; }
    .lp-error-msg { font-size: 0.9rem; font-weight: 600; color: #ef4444; text-align: center; margin: 0; }

    /* ── Per Game Card ── */
    .lp-pg-steps {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.2rem;
    }
    .lp-pg-step {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 0.8rem 1rem;
    }
    .lp-pg-step-num {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: rgba(163,230,53,0.14);
      color: #a3e635;
      font-size: 0.85rem;
      font-weight: 900;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .lp-pg-step-title { font-size: 0.87rem; font-weight: 700; color: #ffffff; margin-bottom: 0.1rem; }
    .lp-pg-step-sub { font-size: 0.74rem; color: rgba(255,255,255,0.38); }
    .lp-pg-actions {
      display: flex;
      gap: 0.65rem;
      flex-wrap: wrap;
    }
    .lp-pg-btn-primary {
      flex: 1;
      min-width: 140px;
      display: flex; align-items: center; justify-content: center;
      gap: 0.45rem;
      padding: 0.72rem 1rem;
      background: #a3e635;
      color: #0c1a11;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 800;
      font-family: inherit;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .lp-pg-btn-primary:hover { opacity: 0.88; }
    .lp-pg-btn-secondary {
      flex: 1;
      min-width: 120px;
      display: flex; align-items: center; justify-content: center;
      gap: 0.45rem;
      padding: 0.72rem 1rem;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      color: rgba(255,255,255,0.7);
      font-size: 0.88rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
    }
    .lp-pg-btn-secondary:hover { background: rgba(255,255,255,0.1); }

    /* ── Footer ── */
    .lp-footer {
      padding: 2rem 2.5rem 1.5rem;
      text-align: center;
      font-size: 0.73rem;
      color: rgba(255,255,255,0.16);
      margin-top: auto;
    }

    /* ── Guest Join ── */
    .lp-op-join-btn {
      padding: 0.42rem 0.85rem;
      background: rgba(163,230,53,0.13);
      border: 1px solid rgba(163,230,53,0.35);
      border-radius: 8px;
      color: #a3e635;
      font-size: 0.78rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .lp-op-join-btn:hover:not(:disabled) { background: rgba(163,230,53,0.22); }
    .lp-op-join-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .lp-op-joined-badge { font-size: 0.75rem; color: #a3e635; font-weight: 700; display: flex; align-items: center; gap: 0.3rem; }
    .lp-op-pending-badge { font-size: 0.75rem; color: #fbbf24; font-weight: 700; display: flex; align-items: center; gap: 0.3rem; }
    .lp-op-register-link { color: #a3e635; text-decoration: underline; }
    .lp-op-register-link:hover { opacity: 0.8; }
    .lp-op-register-login {
      background: none; border: none; color: #a3e635;
      font-size: inherit; cursor: pointer; text-decoration: underline; padding: 0; font-family: inherit;
    }
    .lp-op-register-login:hover { opacity: 0.8; }
    .lp-guest-join-form {
      background: rgba(163,230,53,0.04);
      border: 1px solid rgba(163,230,53,0.18);
      border-radius: 12px;
      margin: 0.4rem 0 0.5rem;
      overflow: hidden;
    }
    .lp-gjf-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.7rem 1rem;
      background: rgba(163,230,53,0.07);
      font-size: 0.83rem; font-weight: 700; color: #a3e635;
    }
    .lp-gjf-close {
      background: none; border: none; color: rgba(255,255,255,0.4);
      cursor: pointer; font-size: 0.85rem; padding: 0.2rem 0.4rem;
    }
    .lp-gjf-close:disabled { opacity: 0.4; cursor: not-allowed; }
    .lp-gjf-body {
      padding: 0.9rem 1rem;
      display: flex; flex-direction: column; gap: 0.6rem;
    }
    .lp-gjf-fee-note {
      font-size: 0.82rem; color: rgba(255,255,255,0.65);
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 0.55rem 0.8rem; display: flex; align-items: center; gap: 0.4rem;
    }
    .lp-gjf-fee-note i { color: #fbbf24; }
    .lp-gjf-methods { display: flex; gap: 0.45rem; flex-wrap: wrap; }
    .lp-gjf-method-btn {
      flex: 1 1 0; min-width: 70px;
      padding: 0.55rem 0.5rem;
      border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
      background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);
      font-size: 0.8rem; font-weight: 700; font-family: inherit; cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .lp-gjf-method-btn.active { border-color: #a3e635; background: rgba(163,230,53,0.1); color: #a3e635; }
    .lp-gjf-qr { width: 140px; height: 140px; object-fit: contain; border-radius: 8px; background: #fff; padding: 5px; align-self: center; }
    .lp-gjf-account { font-size: 0.85rem; font-weight: 700; color: #fff; text-align: center; }
    .lp-gjf-upload {
      display: flex; flex-direction: column; align-items: center; gap: 0.45rem;
      padding: 1rem; border: 2px dashed rgba(255,255,255,0.14); border-radius: 10px;
      background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.5);
      font-size: 0.83rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s;
    }
    .lp-gjf-upload i { font-size: 1.2rem; color: #a3e635; }
    .lp-gjf-upload.uploading { opacity: 0.6; cursor: not-allowed; }
    .lp-gjf-preview { position: relative; border-radius: 10px; overflow: hidden; max-height: 160px; }
    .lp-gjf-preview-img { width: 100%; max-height: 160px; object-fit: cover; display: block; }
    .lp-gjf-preview-remove {
      position: absolute; top: 0.4rem; right: 0.4rem;
      background: rgba(0,0,0,0.6); color: #fff; border: none;
      border-radius: 50%; width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.75rem;
    }
    .lp-gjf-disclaimer {
      font-size: 0.76rem; color: #fbbf24; padding: 0.5rem 0.7rem;
      background: rgba(251,191,36,0.07); border: 1px solid rgba(251,191,36,0.18);
      border-radius: 8px; display: flex; align-items: flex-start; gap: 0.35rem; line-height: 1.45; margin: 0;
    }
    .lp-gjf-error { font-size: 0.8rem; color: #f87171; margin: 0; display: flex; align-items: center; gap: 0.35rem; }
    .lp-gjf-submit {
      width: 100%; padding: 0.78rem; border: none; border-radius: 10px;
      background: #a3e635; color: #0c1a11;
      font-size: 0.9rem; font-weight: 900; font-family: inherit;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: opacity 0.15s;
    }
    .lp-gjf-submit:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Responsive ── */
    @media (min-width: 768px) {
      .lp-features-grid { grid-template-columns: repeat(4, 1fr); }
      .lp-pricing-grid  { grid-template-columns: repeat(4, 1fr); }
      .lp-info-grid     { grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 767px) {
      .lp-club-row { padding: 1rem; }
      .lp-club-row-inner { flex-direction: column; align-items: flex-start; }
      .lp-club-right { min-width: 0; width: 100%; }
      .lp-body { padding: 1rem; gap: 0.9rem; }
      .lp-topbar { padding: 0.75rem 1rem; }
      .lp-slots-header { flex-direction: column; }
      .lp-slots-header-left { max-width: 100%; }
      .lp-about-row { grid-template-columns: 1fr; }
      .lp-features-grid { grid-template-columns: repeat(2, 1fr); }
      .lp-pricing-grid  { grid-template-columns: repeat(2, 1fr); }
      .lp-info-grid     { grid-template-columns: 1fr; }
      .lp-inq-row       { grid-template-columns: 1fr; }
      .lp-hero-img      { max-height: 280px; object-fit: cover; object-position: center; }
    }
  `],
})
export class GuestBookComponent implements OnInit, OnDestroy {
  clubId = '';
  clubName = '';
  clubLocation = '';
  clubLogo: string | null = null;
  clubError = '';
  clubSuspended = false;
  isPerGame = false;
  isHostedPlay = false;
  hostedPlayAddon = false;
  get showHostedPlaySessions() { return this.isHostedPlay || this.hostedPlayAddon; }
  hostedPlaySessions: {
    _id: string; title: string; sport: 'tennis' | 'pickleball';
    date: string; startTime: string; endTime: string;
    venue: string; court?: string; feePerPlayer: number;
    guestFeePerPlayer: number; maxGuests: number | null; currentGuests: number;
    maxPlayers: number; currentPlayers: number; status: 'open' | 'full';
    venueLogo?: string | null;
    premiumEvent?: boolean;
  }[] = [];
  clubMobile = '';
  clubEmail = '';
  clubDescription = '';
  clubPhotos: string[] = [];
  clubSocialLinks: { facebook?: string; instagram?: string; reclub?: string } = {};
  clubRating = 0;
  clubReviewCount = 0;
  clubTotalBookings = 0;
  openingHour = 6;
  closingHour = 22;
  weekdayRate = 0;
  weekendRate = 0;
  pricingModel: 'flat' | 'tiered' = 'flat';
  daytimeRate = 0;
  eveningRate = 0;
  overnightRate = 0;
  perGameFee = 0;
  perGameGuestFee = 0;
  ratesLoaded = false;
  popularSlots: { time: string; available: number }[] = [];

  readonly days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  readonly features = [
    { icon: 'fa-table-tennis', title: 'Well-Maintained Courts', desc: 'Our courts are cleaned regularly for the best playing experience.' },
    { icon: 'fa-moon', title: 'Night Play Available', desc: 'Play anytime with our powerful lights for night matches.' },
    { icon: 'fa-users', title: 'Friendly Environment', desc: 'All skill levels welcome. Join a community that loves the game.' },
    { icon: 'fa-trophy', title: 'Events & Tournaments', desc: 'Join our regular events and tournaments throughout the year.' },
  ];
  readonly fallbackPhotoPlaceholders = [1, 2, 3, 4];
  sponsors: PublicSponsor[] = [];
  lightboxPhoto: string | null = null;
  showOpenPlay = false;
  openPlaySessions: { _id: string; title: string; sport: string; sessionDate: string; startTime: string; endTime: string; matchType: string; maxPlayers: number; joinedPlayers: number }[] = [];

  // Payment info (populated from getClub)
  paymentMethods: string[] = [];
  paymentAccounts: Record<string, string> = {};
  paymentQrCodes: Record<string, string> = {};

  // ── Guest Join state (signal-based) ──
  activeJoinSessionId = signal<string | null>(null);
  guestJoinName = signal('');
  guestJoinEmail = signal('');
  guestJoinPhone = signal('');
  guestJoinPaymentMethod = signal('GCash');
  guestJoinScreenshotUrl = signal<string | null>(null);
  guestJoinScreenshotPreview = signal<string | null>(null);
  guestJoinUploadingScreenshot = signal(false);
  guestJoinSubmitting = signal(false);
  guestJoinError = signal('');
  guestJoinConfirmed = signal<Map<string, 'joined' | 'pending'>>(new Map());
  activeSessionIsPaid = computed(() => {
    const id = this.activeJoinSessionId();
    const s = this.hostedPlaySessions.find(x => x._id === id);
    return (s?.guestFeePerPlayer ?? s?.feePerPlayer ?? 0) > 0;
  });

  guestSpotsLeft(s: { maxGuests: number | null; currentGuests: number }): number {
    if (s.maxGuests == null) return 0;
    return Math.max(0, s.maxGuests - s.currentGuests);
  }

  // Chat state
  inquiry = { senderName: '', senderEmail: '', message: '' };
  inquirySubmitting = false;
  inquiryError = '';
  chatOpen = false;
  chatInquiryId = '';
  chatMessages: { sender: 'guest' | 'admin'; name: string; body: string; createdAt: string }[] = [];
  followupText = '';
  followupSending = false;
  private pollTimer: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicBookingService: PublicBookingService,
    private cloudinary: CloudinaryService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');

    this.clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
    if (!this.clubId) {
      this.clubError = 'Invalid booking link.';
      return;
    }

    this.http.get<PublicSponsor[]>(`${environment.apiUrl}/public/sponsors`).subscribe({
      next: (s) => { this.sponsors = s; this.cdr.detectChanges(); },
      error: () => {},
    });

    this.publicBookingService.getClub(this.clubId).subscribe({
      next: (club) => {
        this.clubName = club.name;
        this.clubLocation = club.location ?? '';
        this.clubLogo = club.logo ?? null;
        this.clubMobile = club.mobile ?? '';
        this.clubEmail = club.email ?? '';
        this.clubDescription = club.description ?? '';
        this.clubPhotos = club.photos ?? [];
        this.clubSocialLinks = club.socialLinks ?? {};
        this.clubRating = club.rating ?? 0;
        this.clubReviewCount = club.reviewCount ?? 0;
        this.clubTotalBookings = club.totalBookings ?? 0;
        this.openingHour = club.openingHour ?? 6;
        this.closingHour = club.closingHour ?? 22;
        if (club.status === 'suspended') this.clubSuspended = true;
        this.isPerGame = club.bookingProcess === 'per_game';
        this.isHostedPlay = club.bookingProcess === 'hosted_play';
        this.hostedPlayAddon = club.bookingProcess === 'reservation' && !!club.hostedPlayEnabled;
        this.paymentMethods = (club.paymentMethods ?? []).filter(m => m !== 'Cash');
        this.paymentAccounts = club.paymentAccounts ?? {};
        this.paymentQrCodes = club.paymentQrCodes ?? {};
        if (this.paymentMethods.length > 0) {
          this.guestJoinPaymentMethod.set(this.paymentMethods[0]);
        }
        if (this.showHostedPlaySessions) {
          this.publicBookingService.getHostedPlaySessions(this.clubId).subscribe({
            next: (sessions) => { this.hostedPlaySessions = sessions; this.cdr.detectChanges(); },
            error: () => {},
          });
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.clubError = 'Club not found. Please check your booking link.';
        this.cdr.detectChanges();
      },
    });

    this.publicBookingService.getRates(this.clubId).subscribe({
      next: (rates) => {
        this.weekdayRate = rates.reservationWeekdayRate;
        this.weekendRate = rates.reservationWeekendRate;
        this.pricingModel = rates.pricingModel === 'tiered' ? 'tiered' : 'flat';
        this.daytimeRate = rates.reservationDaytimeRate ?? 0;
        this.eveningRate = rates.reservationEveningRate ?? 0;
        this.overnightRate = rates.reservationOvernightRate ?? 0;
        this.perGameFee = rates.perGameFee ?? 0;
        this.perGameGuestFee = rates.perGameGuestFee ?? 0;
        this.ratesLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {},
    });

    this.publicBookingService.getOpenPlaySessions(this.clubId).subscribe({
      next: (sessions) => { this.openPlaySessions = sessions; this.cdr.detectChanges(); },
      error: () => {},
    });

    const today = new Date().toISOString().slice(0, 10);
    this.publicBookingService.getSlots(this.clubId, today).subscribe({
      next: (slots) => {
        const available = slots.filter(s => s.available > 0);
        if (available.length <= 5) {
          this.popularSlots = available.map(s => ({ time: s.time, available: s.available }));
        } else {
          // Pick 5 slots spread evenly across the day (0%, 25%, 50%, 75%, 100%)
          const picks = [0, 0.25, 0.5, 0.75, 1]
            .map(f => Math.round(f * (available.length - 1)))
            .filter((v, i, a) => a.indexOf(v) === i);
          this.popularSlots = picks.map(i => ({ time: available[i].time, available: available[i].available }));
        }
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
    this.stopPolling();
  }

  openLightbox(photo: string) { this.lightboxPhoto = photo; this.cdr.detectChanges(); }
  closeLightbox() { this.lightboxPhoto = null; this.cdr.detectChanges(); }

  formatHour(h: number): string {
    if (h === 0) return '12am';
    if (h === 12) return '12pm';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  }

  goToLogin() { this.router.navigate(['/player-login']); }
  goToReserve() { this.router.navigate(['/book', this.clubId, 'reserve']); }

  submitInquiry() {
    const { senderName, senderEmail, message } = this.inquiry;
    if (!senderName.trim() || !senderEmail.trim() || !message.trim()) {
      this.inquiryError = 'Please fill in all fields.';
      this.cdr.detectChanges();
      return;
    }
    this.inquirySubmitting = true;
    this.inquiryError = '';
    this.cdr.detectChanges();

    this.publicBookingService
      .submitInquiry(this.clubId, { senderName: senderName.trim(), senderEmail: senderEmail.trim(), message: message.trim() })
      .subscribe({
        next: (inq: any) => {
          this.chatInquiryId = inq._id;
          this.chatMessages = inq.messages ?? [];
          this.chatOpen = true;
          this.inquirySubmitting = false;
          this.cdr.detectChanges();
          this.startPolling();
        },
        error: () => {
          this.inquiryError = 'Failed to send message. Please try again.';
          this.inquirySubmitting = false;
          this.cdr.detectChanges();
        },
      });
  }

  sendFollowup() {
    const text = this.followupText.trim();
    if (!text || this.followupSending) return;
    this.followupSending = true;
    this.cdr.detectChanges();

    this.publicBookingService.sendFollowup(this.clubId, this.chatInquiryId, text).subscribe({
      next: (inq: any) => {
        this.chatMessages = inq.messages ?? [];
        this.followupText = '';
        this.followupSending = false;
        this.cdr.detectChanges();
      },
      error: () => { this.followupSending = false; this.cdr.detectChanges(); },
    });
  }

  private startPolling() {
    this.pollTimer = setInterval(() => {
      this.publicBookingService.pollInquiry(this.clubId, this.chatInquiryId).subscribe({
        next: (inq: any) => {
          this.chatMessages = inq.messages ?? [];
          this.cdr.detectChanges();
        },
        error: () => {},
      });
    }, 4000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  openGuestJoinForm(sessionId: string) {
    this.activeJoinSessionId.set(sessionId);
    this.guestJoinName.set('');
    this.guestJoinEmail.set('');
    this.guestJoinPhone.set('');
    if (this.paymentMethods.length > 0) this.guestJoinPaymentMethod.set(this.paymentMethods[0]);
    this.guestJoinScreenshotUrl.set(null);
    this.guestJoinScreenshotPreview.set(null);
    this.guestJoinUploadingScreenshot.set(false);
    this.guestJoinSubmitting.set(false);
    this.guestJoinError.set('');
  }

  closeGuestJoinForm() {
    if (this.guestJoinSubmitting()) return;
    this.activeJoinSessionId.set(null);
    this.guestJoinError.set('');
  }

  clearGuestJoinScreenshot() {
    this.guestJoinScreenshotUrl.set(null);
    this.guestJoinScreenshotPreview.set(null);
  }

  async onGuestJoinScreenshot(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const err = this.cloudinary.validateImage(file);
    if (err) { this.guestJoinError.set(err); return; }

    this.guestJoinUploadingScreenshot.set(true);
    this.guestJoinError.set('');
    this.guestJoinScreenshotPreview.set(URL.createObjectURL(file));
    try {
      const url = await this.cloudinary.uploadImage(file, `payment-screenshots/${this.clubId}`);
      this.guestJoinScreenshotUrl.set(url);
    } catch {
      this.guestJoinError.set('Failed to upload screenshot. Please try again.');
      this.guestJoinScreenshotUrl.set(null);
      this.guestJoinScreenshotPreview.set(null);
    } finally {
      this.guestJoinUploadingScreenshot.set(false);
      this.cdr.detectChanges();
    }
  }

  submitGuestJoin(session: { _id: string; feePerPlayer: number; guestFeePerPlayer?: number | null; title: string }) {
    const name = this.guestJoinName().trim();
    const email = this.guestJoinEmail().trim();
    const phone = this.guestJoinPhone().trim();
    const guestFee = session.guestFeePerPlayer ?? session.feePerPlayer ?? 0;

    if (!name) { this.guestJoinError.set('Name is required.'); return; }
    if (!email || !email.includes('@')) { this.guestJoinError.set('A valid email address is required.'); return; }
    if (guestFee > 0 && !this.guestJoinScreenshotUrl()) {
      this.guestJoinError.set('Please attach your payment screenshot.');
      return;
    }

    this.guestJoinSubmitting.set(true);
    this.guestJoinError.set('');

    const payload: { name: string; email: string; phone?: string; paymentMethod?: string; paymentScreenshot?: string } = {
      name, email,
      ...(phone ? { phone } : {}),
      ...(guestFee > 0 ? {
        paymentMethod: this.guestJoinPaymentMethod(),
        paymentScreenshot: this.guestJoinScreenshotUrl()!,
      } : {}),
    };

    this.publicBookingService.joinHostedPlayAsGuest(this.clubId, session._id, payload).subscribe({
      next: (result) => {
        const map = new Map(this.guestJoinConfirmed());
        map.set(session._id, result.status === 'pending_approval' ? 'pending' : 'joined');
        this.guestJoinConfirmed.set(map);
        if (result.status !== 'pending_approval' && result.currentPlayers !== undefined) {
          const s = this.hostedPlaySessions.find(x => x._id === session._id);
          if (s) {
            s.currentPlayers = result.currentPlayers;
            s.status = result.status as 'open' | 'full';
          }
        }
        this.activeJoinSessionId.set(null);
        this.guestJoinSubmitting.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guestJoinError.set(err?.error?.error ?? 'Something went wrong. Please try again.');
        this.guestJoinSubmitting.set(false);
        this.cdr.detectChanges();
      },
    });
  }
}
