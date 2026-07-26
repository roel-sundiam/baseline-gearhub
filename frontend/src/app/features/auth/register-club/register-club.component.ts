import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';

@Component({
  selector: 'app-register-club',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="rc-shell">

      <div class="rc-left">
        <img src="/CourtGo.png" alt="CourtGo" class="rc-left-logo" />
        <p class="rc-left-eyebrow">Club onboarding</p>
        <h1 class="rc-left-title">Bring your courts online.</h1>
        <p class="rc-left-tagline">Create a polished club profile, configure bookings, and welcome players in a few simple steps.</p>
        @if (!success) {
          <nav class="rc-left-steps">
            <div class="rc-ls" [class.rc-ls-active]="currentStep === 1" [class.rc-ls-done]="currentStep > 1">
              <span class="rc-ls-num">{{ currentStep > 1 ? '✓' : '1' }}</span><span>Club Information</span>
            </div>
            <div class="rc-ls" [class.rc-ls-active]="currentStep === 2" [class.rc-ls-done]="currentStep > 2">
              <span class="rc-ls-num">{{ currentStep > 2 ? '✓' : '2' }}</span><span>Booking Process</span>
            </div>
            <div class="rc-ls"
              [class.rc-ls-active]="currentStep === 3 && bookingProcess !== 'hosted_play'"
              [class.rc-ls-done]="currentStep > 3 && bookingProcess !== 'hosted_play'"
              [class.rc-ls-skip]="bookingProcess === 'hosted_play'">
              <span class="rc-ls-num">{{ (currentStep > 3 && bookingProcess !== 'hosted_play') ? '✓' : '3' }}</span><span>Courts &amp; Hours</span>
            </div>
            <div class="rc-ls" [class.rc-ls-active]="currentStep === 4" [class.rc-ls-done]="currentStep > 4">
              <span class="rc-ls-num">{{ currentStep > 4 ? '✓' : '4' }}</span><span>Payment Methods</span>
            </div>
            <div class="rc-ls" [class.rc-ls-active]="currentStep === 5">
              <span class="rc-ls-num">5</span><span>Admin Account</span>
            </div>
          </nav>
        }
      </div>

      <div class="rc-right">
        <div class="auth-card">
          <button class="back-btn" (click)="goBack()" type="button">&#8592; Back</button>
          <div class="auth-header">
            <div class="header-banner">
              <img src="/CourtGo.png" alt="CourtGo" class="hero-logo" />
              <div class="mobile-brand-copy">
                <span>Club onboarding</span>
                <strong>Register your club</strong>
              </div>
            </div>
          </div>

          @if (success) {
            <div style="padding: 2rem;">
              <div class="alert alert-success">
                <strong>Club registered!</strong><br />
                You can now log in with your admin credentials and start using the platform.
              </div>
              <p class="auth-footer"><a routerLink="/player-login">Go to Login</a></p>
            </div>
          } @else {
            <div class="step-indicator">
              <div class="step-dot" [class.active]="currentStep === 1" [class.done]="currentStep > 1">1</div>
              <div class="step-line"></div>
              <div class="step-dot" [class.active]="currentStep === 2" [class.done]="currentStep > 2">2</div>
              <div class="step-line"></div>
              <div class="step-dot"
                [class.active]="currentStep === 3 && bookingProcess !== 'hosted_play'"
                [class.done]="currentStep > 3 && bookingProcess !== 'hosted_play'"
                [class.skipped]="bookingProcess === 'hosted_play' && currentStep > 2">3</div>
              <div class="step-line"></div>
              <div class="step-dot" [class.active]="currentStep === 4" [class.done]="currentStep > 4">4</div>
              <div class="step-line"></div>
              <div class="step-dot" [class.active]="currentStep === 5">5</div>
            </div>
            <p class="mobile-step-label">Step {{ currentStep }} of 5</p>

            <form (ngSubmit)="onSubmit()" #f="ngForm">

              @if (currentStep === 1) {
                <div class="section-label">Club Information</div>

                <p class="rc-sport-chip">
                  Registering a <strong>{{ sportLabel }}</strong> club ·
                  <a routerLink="/register-club">change</a>
                </p>

                <div class="form-group">
                  <label for="clubName">Club Name *</label>
                  <input
                    id="clubName" type="text" [(ngModel)]="clubName" name="clubName" required
                    placeholder="e.g. Baseline Tennis Club" #clubNameField="ngModel"
                    [class.input-invalid]="clubNameField.invalid && (clubNameField.touched || step1Attempted)"
                  />
                  @if (clubNameField.invalid && (clubNameField.touched || step1Attempted)) {
                    <span class="field-error">Club name is required.</span>
                  }
                </div>

                <div class="form-group">
                  <label for="location">Location *</label>
                  <input
                    id="location" type="text" [(ngModel)]="location" name="location" required
                    placeholder="e.g. Manila, Philippines" #locationField="ngModel"
                    [class.input-invalid]="locationField.invalid && (locationField.touched || step1Attempted)"
                  />
                  @if (locationField.invalid && (locationField.touched || step1Attempted)) {
                    <span class="field-error">Location is required.</span>
                  }
                </div>

                <div class="form-group">
                  <label for="clubLogo">Club Logo <span style="color: #dc2626;">(required)</span></label>
                  <div class="image-upload-section">
                    @if (logoPreview) {
                      <div class="image-preview">
                        <img [src]="logoPreview" alt="Logo preview" />
                        <button type="button" class="btn-remove-image" (click)="removeLogo()">✕</button>
                      </div>
                    } @else {
                      <label class="image-input-label">
                        <input id="clubLogo" type="file" accept="image/*" (change)="onLogoSelected($event)" class="image-input" />
                        <div class="image-placeholder">
                          <span>🏟️</span>
                          <p>Click to upload a logo</p>
                          <small>JPEG, PNG, GIF, WebP • Max 5MB</small>
                        </div>
                      </label>
                    }
                  </div>
                  @if (logoUploadError) { <span class="field-error">{{ logoUploadError }}</span> }
                  @if (uploadingLogo) { <span class="field-info">Uploading logo...</span> }
                  @if (!logo && step1Attempted) { <span class="field-error">Club logo is required.</span> }
                </div>

                <div class="form-group">
                  <label for="description">About Your Club <span class="optional">(optional)</span></label>
                  <textarea
                    id="description" [(ngModel)]="description" name="description"
                    placeholder="Briefly describe your club — courts, vibe, what makes you unique…"
                    rows="3" class="rc-textarea"
                  ></textarea>
                </div>

                <div class="form-group">
                  <label>Court Photos <span class="optional">(optional · up to 4)</span></label>
                  <div class="rc-photos-grid"
                       [class.rc-photos-dragging]="isDraggingPhotos"
                       (dragover)="onPhotosDragOver($event)"
                       (dragleave)="onPhotosDragLeave()"
                       (drop)="onPhotosDrop($event)">
                    @for (url of photos; track url; let i = $index) {
                      <div class="rc-photo-thumb">
                        <img [src]="url" alt="Court photo" class="rc-photo-img" />
                        <button type="button" class="btn-remove-image rc-photo-remove" (click)="removePhoto(i)">✕</button>
                      </div>
                    }
                    @if (photos.length < 4) {
                      <label class="rc-photo-add" [class.rc-photo-add-busy]="uploadingPhotoCount > 0">
                        @if (uploadingPhotoCount > 0) {
                          <span class="rc-photo-spinner">⏳</span>
                          <span class="rc-photo-count">{{ uploadingPhotoCount }}</span>
                        } @else {
                          <span class="rc-photo-plus">＋</span>
                        }
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="image-input"
                          (change)="onPhotoSelected($event)" [disabled]="uploadingPhotoCount > 0" />
                      </label>
                    }
                  </div>
                  <p class="rc-photos-hint">Drag &amp; drop up to 4 images, or click <strong>＋</strong> to browse</p>
                  @if (photoUploadError) { <span class="field-error">{{ photoUploadError }}</span> }
                </div>

                <div class="form-group">
                  <label>Social Media Links <span class="optional">(optional)</span></label>
                  <div class="rc-social-inputs">
                    <div class="rc-social-row">
                      <span class="rc-social-badge rc-social-fb">fb</span>
                      <input type="url" [(ngModel)]="socialFacebook" name="socialFacebook"
                        placeholder="https://facebook.com/yourpage" />
                    </div>
                    <div class="rc-social-row">
                      <span class="rc-social-badge rc-social-ig">ig</span>
                      <input type="url" [(ngModel)]="socialInstagram" name="socialInstagram"
                        placeholder="https://instagram.com/yourhandle" />
                    </div>
                    <div class="rc-social-row">
                      <span class="rc-social-badge rc-social-rc">rc</span>
                      <input type="url" [(ngModel)]="socialReclub" name="socialReclub"
                        placeholder="https://reclub.co/clubs/yourclub" />
                    </div>
                  </div>
                </div>

                <div class="step-nav">
                  <button type="button" class="btn-primary btn-full"
                    [disabled]="uploadingLogo || uploadingPhotoCount > 0"
                    (click)="nextStep()">
                    {{ uploadingLogo ? 'Uploading logo...' : uploadingPhotoCount > 0 ? 'Uploading photos...' : 'Next →' }}
                  </button>
                </div>
              }

              @if (currentStep === 2) {
                <div class="section-label">Booking Process</div>
                <p class="rc-photos-hint" style="margin: 0 0 1rem;">How will players book courts at your club?</p>

                <div class="booking-cards">
                  <div class="booking-card" [class.selected]="bookingProcess === 'reservation'" (click)="bookingProcess = 'reservation'">
                    <div class="booking-card-title">Reservation</div>
                    <div class="booking-card-desc">Players book a specific court and time slot in advance.</div>
                  </div>
                  <div class="booking-card" [class.selected]="bookingProcess === 'per_game'" (click)="bookingProcess = 'per_game'">
                    <div class="booking-card-title">Per Game</div>
                    <div class="booking-card-desc">Players join open sessions and pay per game played.</div>
                  </div>
                  <div class="booking-card" [class.selected]="bookingProcess === 'hosted_play'" (click)="bookingProcess = 'hosted_play'">
                    <div class="booking-card-title">Hosted Play</div>
                    <div class="booking-card-desc">Admin-run sessions with queue management and court rotation.</div>
                  </div>
                </div>

                @if (bookingProcess === 'reservation' || bookingProcess === 'per_game') {
                  <div class="form-group" style="margin-top: 1.25rem;">
                    <label>Court Fee per Hour <span class="optional">(optional)</span></label>
                    <div class="rc-rate-input-wrap">
                      <span class="rc-rate-prefix">₱</span>
                      @if (bookingProcess === 'reservation') {
                        <input type="number" [(ngModel)]="reservationWeekdayRate" name="reservationWeekdayRate"
                          min="0" step="0.01" placeholder="0.00" />
                      } @else {
                        <input type="number" [(ngModel)]="perGameFee" name="perGameFee"
                          min="0" step="0.01" placeholder="0.00" />
                      }
                    </div>
                    @if (bookingProcess === 'reservation') {
                      <p class="rc-photos-hint" style="margin-top: 0.4rem;">Applied to all time slots — weekdays, weekends, and holidays.</p>
                    }
                  </div>
                }

                <div class="step-nav" style="margin-top: 1.5rem;">
                  <button type="button" class="btn-secondary" (click)="prevStep()">&#8592; Back</button>
                  <button type="button" class="btn-primary btn-full" (click)="nextStep()">Next →</button>
                </div>
              }

              @if (currentStep === 3) {
                <div class="section-label">Courts &amp; Hours</div>

                <div class="form-group">
                  <label for="courtCount">Number of Courts *</label>
                  <input
                    id="courtCount" type="number" [(ngModel)]="courtCount" name="courtCount"
                    required min="1" max="20" placeholder="e.g. 4"
                    #courtCountField="ngModel"
                    [class.input-invalid]="(courtCountField.invalid || courtCount < 1 || courtCount > 20) && (courtCountField.touched || step2Attempted)"
                  />
                  @if ((courtCountField.invalid || courtCount < 1 || courtCount > 20) && (courtCountField.touched || step2Attempted)) {
                    <span class="field-error">Must be between 1 and 20.</span>
                  }
                </div>

                <div class="form-group">
                  <label>Operating Hours</label>
                  <div class="rc-hours-row">
                    <div class="rc-hours-col">
                      <span class="rc-sublabel">Opens</span>
                      <select [(ngModel)]="openingHour" name="openingHour">
                        @for (opt of hourOptions; track opt.value) {
                          <option [value]="opt.value">{{ opt.label }}</option>
                        }
                      </select>
                    </div>
                    <span class="rc-hours-sep">to</span>
                    <div class="rc-hours-col">
                      <span class="rc-sublabel">Closes (last slot starts at)</span>
                      <select [(ngModel)]="closingHour" name="closingHour">
                        @for (opt of hourOptions; track opt.value) {
                          <option [value]="opt.value">{{ opt.label }}</option>
                        }
                      </select>
                    </div>
                  </div>
                </div>

                <div class="step-nav" style="margin-top: 1.5rem;">
                  <button type="button" class="btn-secondary" (click)="prevStep()">&#8592; Back</button>
                  <button type="button" class="btn-primary btn-full" (click)="nextStep()">Next →</button>
                </div>
              }

              @if (currentStep === 4) {
                <div class="section-label">Payment Methods <span class="optional">(optional)</span></div>

                <div class="rc-pm-list">
                  @for (method of availablePaymentMethods; track method) {
                    <div class="rc-pm-row">
                      <label class="rc-pm-check-label">
                        <input type="checkbox" class="rc-pm-checkbox"
                          [checked]="paymentMethods.includes(method)"
                          (change)="togglePaymentMethod(method, $any($event.target).checked)" />
                        <span class="rc-pm-name">{{ method }}</span>
                      </label>
                      @if (paymentMethods.includes(method) && method !== 'Cash') {
                        <input type="text"
                          [placeholder]="method + ' account / number (optional)'"
                          [value]="paymentAccounts[method] || ''"
                          (input)="setPaymentAccount(method, $any($event.target).value)"
                          class="rc-pm-account-input"
                        />
                        <div class="rc-pm-qr-row">
                          @if (paymentQrCodes[method]) {
                            <img [src]="paymentQrCodes[method]" alt="QR Code" class="rc-pm-qr-preview" />
                            <button type="button" class="rc-pm-qr-remove" (click)="removeQrCode(method)">✕ Remove QR</button>
                          } @else {
                            <label class="rc-pm-qr-upload">
                              {{ uploadingQr === method ? '⏳ Uploading...' : '📋 Upload QR Code' }}
                              <input type="file" accept="image/*" class="image-input"
                                (change)="onQrFileSelected(method, $event)"
                                [disabled]="uploadingQr === method" />
                            </label>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>

                <div class="step-nav" style="margin-top: 1.5rem;">
                  <button type="button" class="btn-secondary" (click)="prevStep()">&#8592; Back</button>
                  <button type="button" class="btn-primary btn-full" (click)="nextStep()">Next →</button>
                </div>
              }

              @if (currentStep === 5) {
                <div class="section-label">Admin Account</div>

                <div class="form-group">
                  <label for="adminName">Full Name *</label>
                  <input
                    id="adminName" type="text" [(ngModel)]="adminName" name="adminName" required
                    placeholder="Your full name" (input)="onAdminNameChange()"
                    #adminNameField="ngModel"
                    [class.input-invalid]="adminNameField.invalid && adminNameField.touched"
                  />
                  @if (adminNameField.invalid && adminNameField.touched) {
                    <span class="field-error">Full name is required.</span>
                  }
                </div>

                <div class="form-group">
                  <label for="adminUsername">Username *</label>
                  <input
                    id="adminUsername" type="text" [(ngModel)]="adminUsername" name="adminUsername" required
                    placeholder="Auto-filled from full name" autocomplete="username"
                    #adminUsernameField="ngModel"
                    [class.input-invalid]="adminUsernameField.invalid && adminUsernameField.touched"
                  />
                  @if (adminUsernameField.invalid && adminUsernameField.touched) {
                    <span class="field-error">Username is required.</span>
                  }
                </div>

                <div class="form-group">
                  <label for="adminPassword">Password *</label>
                  <input
                    id="adminPassword" type="password" [(ngModel)]="adminPassword" name="adminPassword"
                    required minlength="6" placeholder="Minimum 6 characters" autocomplete="new-password"
                    #adminPasswordField="ngModel"
                    [class.input-invalid]="adminPasswordField.invalid && adminPasswordField.touched"
                  />
                  @if (adminPasswordField.touched) {
                    @if (adminPasswordField.errors?.['required']) {
                      <span class="field-error">Password is required.</span>
                    } @else if (adminPasswordField.errors?.['minlength']) {
                      <span class="field-error">Password must be at least 6 characters.</span>
                    }
                  }
                </div>

                <div class="form-group">
                  <label for="email">Email <span class="optional">(optional)</span></label>
                  <input
                    id="email" type="email" [(ngModel)]="email" name="email"
                    placeholder="admin@yourclub.com" email #emailField="ngModel"
                    [class.input-invalid]="emailField.invalid && emailField.touched"
                  />
                  @if (emailField.invalid && emailField.touched) {
                    <span class="field-error">Please enter a valid email address.</span>
                  }
                </div>

                <div class="form-group">
                  <label for="contactNumber">Contact Number *</label>
                  <input
                    id="contactNumber" type="tel" [(ngModel)]="contactNumber" name="contactNumber" required
                    placeholder="+63 912 345 6789" #contactNumberField="ngModel"
                    [class.input-invalid]="contactNumberField.invalid && contactNumberField.touched"
                  />
                  @if (contactNumberField.invalid && contactNumberField.touched) {
                    <span class="field-error">Contact number is required.</span>
                  }
                </div>

                @if (errorMsg) {
                  <div class="alert alert-error">{{ errorMsg }}</div>
                }

                <div class="step-nav">
                  <button type="button" class="btn-secondary" (click)="prevStep()">&#8592; Back</button>
                  <button type="submit" class="btn-primary btn-full" [disabled]="loading" (click)="formSubmitted = true">
                    {{ loading ? 'Registering...' : 'Register Club' }}
                  </button>
                </div>
              }

            </form>

            <p class="auth-footer">Already have an account? <a routerLink="/player-login">Sign in</a></p>
          }
        </div>
      </div>

    </div>
  `,
  styles: [
    `
      /* ── Shell ── */
      :host { display: block; }
      .rc-shell {
        display: flex;
        min-height: 100vh;
        background: var(--dm-bg);
      }

      /* ── Left branding panel (desktop only) ── */
      .rc-left {
        display: none;
      }
      @media (min-width: 900px) {
        .rc-left {
          display: flex;
          flex-direction: column;
          justify-content: center;
          width: 380px;
          flex-shrink: 0;
          background: var(--dm-header, #0f1f13);
          border-right: 1px solid rgba(163,230,53,0.1);
          padding: 3rem 2.5rem;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
        }
      }
      .rc-left-logo {
        height: 36px;
        width: auto;
        margin-bottom: 2rem;
      }
      .rc-left-title {
        font-size: 1.5rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 0.5rem;
        line-height: 1.2;
      }
      .rc-left-tagline {
        font-size: 0.88rem;
        color: rgba(255,255,255,0.45);
        margin: 0 0 2.5rem;
        line-height: 1.5;
      }
      .rc-left-steps {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
      .rc-ls {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.65rem 0.75rem;
        border-radius: 10px;
        font-size: 0.88rem;
        font-weight: 500;
        color: rgba(255,255,255,0.3);
        transition: all 0.2s;
      }
      .rc-ls-active {
        color: #ffffff;
        background: rgba(163,230,53,0.08);
      }
      .rc-ls-done { color: rgba(163,230,53,0.6); }
      .rc-ls-num {
        width: 24px; height: 24px;
        border-radius: 50%;
        border: 1.5px solid rgba(255,255,255,0.15);
        display: flex; align-items: center; justify-content: center;
        font-size: 0.72rem; font-weight: 700;
        flex-shrink: 0;
        transition: all 0.2s;
      }
      .rc-ls-active .rc-ls-num {
        border-color: var(--dm-accent, #a3e635);
        color: var(--dm-accent, #a3e635);
        background: rgba(163,230,53,0.1);
      }
      .rc-ls-done .rc-ls-num {
        border-color: rgba(163,230,53,0.5);
        color: rgba(163,230,53,0.7);
        background: rgba(163,230,53,0.1);
        font-size: 0.65rem;
      }
      .rc-ls-skip { opacity: 0.22; pointer-events: none; }

      /* ── Right panel ── */
      .rc-right {
        flex: 1;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 2rem 1rem;
        overflow-y: auto;
        min-height: 100vh;
      }
      @media (min-width: 900px) {
        .rc-right {
          padding: 2.5rem 4rem;
          align-items: flex-start;
        }
      }

      /* ── Card ── */
      .auth-card {
        position: relative;
        background: var(--dm-surface);
        border-radius: 20px;
        padding: 0;
        width: 100%;
        max-width: 480px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.1);
        border: 1px solid rgba(163,230,53,0.12);
        align-self: flex-start;
      }
      @media (min-width: 900px) {
        .auth-card {
          max-width: none;
          border: none;
          box-shadow: none;
          background: transparent;
          border-radius: 0;
          align-self: flex-start;
        }
        .auth-header { display: none; }
        .back-btn { padding-top: 0; padding-left: 0; margin-bottom: 0.25rem; }
        form { padding: 0.5rem 0 2rem; }
      }
      .back-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.45);
        font-size: 0.85rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        padding: 0.75rem 1.5rem 0;
        transition: color 0.15s;
      }
      .back-btn:hover { color: #a3e635; }

      /* ── Mobile header ── */
      .auth-header { text-align: center; margin-bottom: 0; border-radius: 20px 20px 0 0; overflow: hidden; }
      .header-banner {
        background: var(--dm-header);
        padding: 2rem 2rem 1.5rem;
        position: relative;
        min-height: 84px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .hero-logo { position: absolute; top: 16px; right: 20px; height: 34px; width: auto; }
      .header-sub {
        color: var(--dm-accent);
        font-size: 0.9rem;
        font-weight: 600;
        font-style: italic;
        margin: 0.85rem 0 0 0;
        padding: 0.4rem 1.25rem;
        background: rgba(163,230,53,0.08);
        border-top: 3px solid var(--dm-accent);
        width: 100%;
        box-sizing: border-box;
      }

      form { padding: 1.5rem 2rem; }
      .section-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--dm-accent);
        padding: 0 0 0.75rem 0;
        margin-bottom: 0.25rem;
        border-bottom: 1px solid rgba(163,230,53,0.12);
        margin-top: 0.5rem;
      }
      .section-label:first-of-type { margin-top: 0; }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
        margin-top: 1rem;
      }
      .form-group label {
        font-size: 0.875rem;
        color: rgba(255,255,255,0.8);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .optional { font-weight: 400; text-transform: none; color: rgba(255,255,255,0.45); font-size: 0.8rem; }
      input, select {
        padding: 0.75rem 1rem;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        font-size: 0.95rem;
        background: rgba(255,255,255,0.04);
        color: #ffffff;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
      }
      input::placeholder { color: rgba(255,255,255,0.4); }
      input:focus, select:focus {
        outline: none;
        border-color: rgba(163,230,53,0.28) !important;
        box-shadow: 0 0 0 3px rgba(163,230,53,0.12) !important;
      }
      select { cursor: pointer; appearance: auto; }
      select option { background: #1b2a1b; color: #ffffff; }
      .input-invalid { border-color: rgba(239,68,68,0.5) !important; }
      .field-error { font-size: 0.8rem; color: #fca5a5; }
      .field-info { font-size: 0.8rem; color: rgba(163,230,53,0.7); }
      .image-upload-section { margin-top: 0.25rem; }
      .image-preview {
        position: relative;
        display: inline-block;
        border-radius: 10px;
        overflow: hidden;
        border: 2px solid rgba(163,230,53,0.3);
      }
      .image-preview img { display: block; width: 120px; height: 120px; object-fit: cover; }
      .btn-remove-image {
        position: absolute;
        top: 4px; right: 4px;
        background: rgba(0,0,0,0.6);
        color: #fff;
        border: none;
        border-radius: 50%;
        width: 24px; height: 24px;
        font-size: 0.75rem;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .image-input-label { cursor: pointer; display: block; }
      .image-input { display: none; }
      .image-placeholder {
        border: 2px dashed rgba(163,230,53,0.25);
        border-radius: 10px;
        padding: 1.5rem;
        text-align: center;
        color: rgba(255,255,255,0.5);
        transition: border-color 0.2s;
      }
      .image-placeholder:hover { border-color: rgba(163,230,53,0.5); }
      .image-placeholder span { font-size: 2rem; }
      .image-placeholder p { margin: 0.5rem 0 0.25rem; font-size: 0.9rem; }
      .image-placeholder small { font-size: 0.75rem; }
      .alert {
        padding: 0.875rem 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
      }
      .alert-error { background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
      .alert-success {
        background: rgba(163,230,53,0.1);
        color: #a3e635;
        border: 1px solid rgba(163,230,53,0.25);
        line-height: 1.6;
      }
      .btn-primary {
        margin-top: 0.75rem;
        border-radius: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: rgba(163,230,53,0.16);
        color: var(--dm-accent);
        border: 1px solid rgba(163,230,53,0.28);
        box-shadow: 0 4px 12px rgba(163,230,53,0.12);
        cursor: pointer;
        padding: 0.75rem 1.5rem;
        font-size: 0.95rem;
        width: auto;
      }
      .btn-primary:hover:not(:disabled) {
        background: rgba(163,230,53,0.24);
        border-color: rgba(163,230,53,0.4);
        box-shadow: 0 6px 16px rgba(163,230,53,0.2);
      }
      .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      .btn-full { width: 100%; }
      .auth-footer {
        text-align: center;
        padding: 0 2rem 1.5rem;
        font-size: 0.9rem;
        color: rgba(255,255,255,0.6);
      }
      .auth-footer a { color: var(--dm-accent); font-weight: 600; text-decoration: none; transition: color 0.2s; }
      .auth-footer a:hover { color: rgba(163,230,53,0.9); }
      .rc-textarea {
        padding: 0.75rem 1rem;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        font-size: 0.95rem;
        background: rgba(255,255,255,0.04);
        color: #ffffff;
        font-family: inherit;
        resize: vertical;
        min-height: 72px;
        width: 100%;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .rc-textarea::placeholder { color: rgba(255,255,255,0.4); }
      .rc-textarea:focus {
        border-color: rgba(163,230,53,0.28) !important;
        box-shadow: 0 0 0 3px rgba(163,230,53,0.12) !important;
      }
      .rc-photos-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.35rem; }
      .rc-photo-thumb {
        position: relative; width: 80px; height: 80px;
        border-radius: 10px; overflow: hidden;
        border: 1px solid rgba(163,230,53,0.25);
      }
      .rc-photo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .rc-photo-remove { position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; padding: 0; border-radius: 50%; font-size: 0.65rem; }
      .rc-photo-add {
        width: 80px; height: 80px; border-radius: 10px;
        border: 2px dashed rgba(163,230,53,0.25); background: rgba(163,230,53,0.04);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: border-color 0.2s, background 0.2s;
        flex-direction: column; gap: 0.2rem;
      }
      .rc-photo-add:hover { border-color: rgba(163,230,53,0.5); background: rgba(163,230,53,0.08); }
      .rc-photo-add-busy { opacity: 0.6; cursor: wait; }
      .rc-photo-plus { font-size: 1.4rem; color: rgba(163,230,53,0.6); line-height: 1; }
      .rc-photo-spinner { font-size: 1rem; }
      .rc-photo-count { font-size: 0.6rem; color: rgba(163,230,53,0.7); }
      .rc-photos-dragging { outline: 2px dashed rgba(163,230,53,0.6); outline-offset: 4px; background: rgba(163,230,53,0.05); border-radius: 12px; }
      .rc-photos-hint { font-size: 0.72rem; color: rgba(255,255,255,0.3); margin: 0.4rem 0 0; }
      /* Social */
      .rc-social-inputs { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.4rem; }
      .rc-social-row { display: flex; align-items: center; gap: 0.5rem; }
      .rc-social-row input { margin-top: 0; }
      .rc-social-badge {
        width: 34px; height: 34px; flex-shrink: 0; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; text-transform: lowercase;
      }
      .rc-social-fb { background: rgba(24,119,242,0.15); color: #4a90d9; border: 1px solid rgba(24,119,242,0.25); }
      .rc-social-ig { background: rgba(228,64,95,0.12); color: #e4405f; border: 1px solid rgba(228,64,95,0.2); }
      .rc-social-rc { background: rgba(163,230,53,0.1); color: #a3e635; border: 1px solid rgba(163,230,53,0.2); }
      /* Courts & Hours */
      .rc-hours-row { display: flex; align-items: flex-end; gap: 0.75rem; }
      .rc-hours-col { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
      .rc-hours-sep { padding-bottom: 0.8rem; color: rgba(255,255,255,0.45); font-size: 0.85rem; font-weight: 500; flex-shrink: 0; }
      .rc-sublabel { font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.4); }
      /* Mobile step dots — hidden on desktop, shown only on mobile */
      .step-indicator { display: none; }
      @media (max-width: 899px) {
        .step-indicator { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 1rem 2rem 0; }
      }
      .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; border: 2px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.35); transition: all 0.2s; }
      .step-dot.active { border-color: var(--dm-accent); color: var(--dm-accent); background: rgba(163,230,53,0.1); }
      .step-dot.done { border-color: rgba(163,230,53,0.4); background: rgba(163,230,53,0.15); color: rgba(163,230,53,0.7); }
      .step-dot.skipped { opacity: 0.2; }
      .step-line { flex: 1; max-width: 32px; height: 1px; background: rgba(255,255,255,0.1); }
      /* Booking Process cards */
      .rc-sport-chip { font-size: 0.82rem; color: rgba(255,255,255,0.5); margin: 0 0 1.1rem; }
      .rc-sport-chip strong { color: #fff; }
      .rc-sport-chip a { color: var(--dm-accent, #a3e635); text-decoration: none; }
      .rc-sport-chip a:hover { text-decoration: underline; }
      .booking-cards { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.75rem; }
      .booking-card { border: 1.5px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1rem 1.25rem; cursor: pointer; transition: all 0.18s; background: rgba(255,255,255,0.02); }
      .booking-card:hover { border-color: rgba(163,230,53,0.3); background: rgba(163,230,53,0.04); }
      .booking-card.selected { border-color: rgba(163,230,53,0.55); background: rgba(163,230,53,0.08); }
      .booking-card-title { font-weight: 700; font-size: 0.9rem; color: #fff; margin-bottom: 0.2rem; }
      .booking-card-desc { font-size: 0.8rem; color: rgba(255,255,255,0.45); line-height: 1.4; }
      /* Payment methods */
      .rc-pm-list { display: flex; flex-direction: column; gap: 0.9rem; margin-top: 0.75rem; }
      .rc-pm-row { display: flex; flex-direction: column; gap: 0.4rem; }
      .rc-pm-check-label { display: inline-flex; align-items: center; gap: 0.55rem; cursor: pointer; user-select: none; }
      .rc-pm-checkbox { width: 16px; height: 16px; accent-color: #a3e635; cursor: pointer; flex-shrink: 0; }
      .rc-pm-name { font-size: 0.9rem; color: #fff; font-weight: 500; }
      .rc-pm-account-input { font-size: 0.85rem; margin-top: 0; }
      .rc-pm-qr-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
      .rc-pm-qr-preview { width: 80px; height: 80px; object-fit: contain; border-radius: 8px; background: #fff; padding: 4px; border: 1px solid rgba(255,255,255,0.1); }
      .rc-pm-qr-upload {
        display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.42rem 0.85rem;
        background: rgba(163,230,53,0.08); border: 1px dashed rgba(163,230,53,0.35);
        border-radius: 8px; color: var(--dm-accent); font-size: 0.82rem; font-weight: 600;
        cursor: pointer; transition: background 0.15s;
      }
      .rc-pm-qr-upload:hover { background: rgba(163,230,53,0.15); }
      .rc-pm-qr-remove { background: none; border: none; color: rgba(239,68,68,0.7); font-size: 0.78rem; cursor: pointer; font-family: inherit; padding: 0; transition: color 0.15s; }
      .rc-pm-qr-remove:hover { color: #fb7185; }
      /* Reservation rates */
      .rc-rates-block { margin-top: 0.25rem; }
      .rc-rate-row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem; }
      .rc-rate-col { flex: 1; min-width: 100px; display: flex; flex-direction: column; gap: 0.35rem; }
      .rc-rate-input-wrap { position: relative; display: flex; align-items: center; }
      .rc-rate-prefix {
        position: absolute; left: 0.75rem;
        font-size: 0.9rem; font-weight: 600;
        color: rgba(163,230,53,0.7);
        pointer-events: none;
        z-index: 1;
      }
      .rc-rate-input-wrap input { padding-left: 1.75rem; }
      /* Nav buttons */
      .step-nav { display: flex; gap: 0.75rem; margin-top: 0.75rem; }
      .btn-secondary {
        flex: 0 0 auto; padding: 0.75rem 1.25rem; border-radius: 10px; font-weight: 600;
        border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.6); cursor: pointer; font-family: inherit; font-size: 0.95rem;
        margin-top: 0.75rem;
      }
      .btn-secondary:hover { background: rgba(255,255,255,0.09); color: #fff; }
      @media (max-width: 600px) {
        .header-banner { padding: 1.5rem 1.5rem 1.25rem; }
        form { padding: 1.25rem 1.5rem; }
        .auth-footer { padding: 0 1.5rem 1.25rem; }
        .rc-right { padding: 1rem; }
      }

      /* Modern registration workspace */
      .rc-shell {
        background: linear-gradient(135deg, rgba(25,58,43,0.22), transparent 46%), #07140e;
      }
      .rc-left-eyebrow {
        margin: 0 0 0.75rem;
        color: #a3e635;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 1.4px;
        text-transform: uppercase;
      }
      .mobile-brand-copy, .mobile-step-label { display: none; }
      @media (min-width: 900px) {
        .rc-left {
          width: clamp(310px, 22vw, 360px);
          justify-content: flex-start;
          padding: clamp(2rem, 5vh, 4rem) clamp(1.75rem, 2.5vw, 3rem);
          background: linear-gradient(180deg, rgba(163,230,53,0.06), transparent 34%), #0a1b12;
        }
        .rc-left-logo {
          height: 36px;
          width: auto;
          align-self: flex-start;
          margin-bottom: clamp(2.75rem, 8vh, 5rem);
        }
        .rc-left-title { max-width: 290px; font-size: clamp(2rem, 2.5vw, 2.55rem); line-height: 1.08; }
        .rc-left-tagline { max-width: 315px; margin-bottom: 2.25rem; font-size: 0.94rem; color: rgba(255,255,255,0.58); }
        .rc-left-steps { gap: 0; }
        .rc-ls { min-height: 48px; padding: 0.45rem 0.65rem; border-radius: 7px; }
        .rc-ls-active { background: rgba(163,230,53,0.09); }
        .rc-right {
          justify-content: flex-start;
          padding: clamp(2rem, 5vh, 4rem) clamp(2.5rem, 6vw, 7rem);
        }
        .auth-card { max-width: 760px; }
        form { padding-top: 1rem; }
        .section-label {
          color: #fff;
          font-size: 1.55rem;
          text-transform: none;
          letter-spacing: 0;
          border-bottom: 0;
          margin-bottom: 1.25rem;
        }
      }
      .back-btn { min-height: 40px; border-radius: 6px; }
      .form-group label {
        color: rgba(255,255,255,0.76);
        font-size: 0.78rem;
        letter-spacing: 0.3px;
      }
      input, select, .rc-textarea {
        min-height: 48px;
        border-radius: 7px;
        border-color: rgba(255,255,255,0.15);
        background: #14291e;
      }
      input::placeholder, .rc-textarea::placeholder { color: rgba(255,255,255,0.5); }
      .image-placeholder {
        min-height: 138px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 7px;
        background: rgba(255,255,255,0.018);
      }
      .image-placeholder span {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(163,230,53,0.12);
        color: #a3e635;
        font-size: 0;
      }
      .image-placeholder span::before {
        content: '+';
        font-size: 1.5rem;
        font-weight: 500;
        line-height: 1;
      }
      .image-placeholder p { color: rgba(255,255,255,0.78); font-weight: 700; }
      .image-placeholder small,
      .rc-photos-hint,
      .rc-sublabel { color: rgba(255,255,255,0.52); }
      .booking-cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .booking-card { min-height: 118px; border-radius: 7px; padding: 1rem; }
      .booking-card.selected {
        border-color: #83bd24;
        box-shadow: inset 0 0 0 1px #83bd24;
      }
      .rc-pm-row {
        padding: 0.9rem 1rem;
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 7px;
        background: rgba(255,255,255,0.025);
      }
      .btn-primary, .btn-secondary {
        min-height: 48px;
        border-radius: 7px;
        text-transform: none;
        letter-spacing: 0;
      }
      .btn-primary {
        background: #a3e635;
        color: #102009;
        border-color: #a3e635;
        box-shadow: none;
        font-weight: 800;
      }
      .btn-primary:hover:not(:disabled) {
        background: #b5ef50;
        border-color: #b5ef50;
        box-shadow: 0 8px 24px rgba(163,230,53,0.16);
      }
      @media (max-width: 899px) {
        .rc-right { padding: 0; }
        .auth-card {
          min-height: 100vh;
          max-width: none;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          background: #0b1b12;
        }
        .back-btn {
          position: absolute;
          z-index: 2;
          top: 15px;
          left: 12px;
          width: 40px;
          height: 40px;
          min-height: 40px;
          padding: 0;
          justify-content: center;
          overflow: hidden;
          font-size: 0;
          color: rgba(255,255,255,0.72);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .back-btn::before {
          content: '\\2190';
          font-size: 1.2rem;
          line-height: 1;
        }
        .auth-header { border-radius: 0; }
        .header-banner {
          min-height: 70px;
          padding: 0 1rem 0 3.8rem;
          flex-direction: row;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .hero-logo {
          position: static;
          width: auto;
          max-width: 150px;
          height: 28px;
          object-fit: contain;
          order: 2;
        }
        .mobile-brand-copy {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.15rem;
        }
        .mobile-brand-copy span {
          color: #a3e635;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .mobile-brand-copy strong { color: #fff; font-size: 0.95rem; }
        .step-indicator { padding: 1.25rem 1.25rem 0; }
        .mobile-step-label {
          display: block;
          margin: 0.65rem 0 0;
          text-align: center;
          color: rgba(255,255,255,0.42);
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        form { max-width: 640px; margin: 0 auto; padding: 1.35rem 1.25rem 2rem; }
        .section-label {
          margin: 0 0 1.1rem;
          padding-bottom: 0.85rem;
          color: #fff;
          font-size: 1.25rem;
          text-transform: none;
          letter-spacing: 0;
        }
        .auth-footer { margin-bottom: 0; }
      }
      @media (max-width: 600px) {
        .header-banner { padding: 0 0.9rem 0 3.65rem; }
        .hero-logo { max-width: 122px; height: 24px; }
        form { padding: 1.25rem 1rem 2rem; }
        .booking-cards { grid-template-columns: 1fr; }
        .booking-card { min-height: 0; }
        .rc-hours-row { align-items: stretch; flex-direction: column; gap: 0.5rem; }
        .rc-hours-sep { padding: 0; }
        .step-nav { position: sticky; bottom: 0; z-index: 3; padding: 0.75rem 0; background: #0b1b12; }
        .btn-secondary { padding-inline: 1rem; }
      }
      @media (max-width: 420px) {
        .header-banner { min-height: 64px; }
        .mobile-brand-copy span { display: none; }
        .mobile-brand-copy strong { font-size: 0.82rem; }
        .hero-logo { max-width: 105px; height: 22px; }
      }
    `,
  ],
})
export class RegisterClubComponent {
  private auth = inject(AuthService);
  private cloudinary = inject(CloudinaryService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private loc = inject(Location);
  private cdr = inject(ChangeDetectorRef);

  static readonly SPORT_LABELS: Record<string, string> = {
    tennis: 'Tennis',
    pickleball: 'Pickleball',
    badminton: 'Badminton',
    squash: 'Squash',
    table_tennis: 'Table Tennis',
    padel: 'Padel',
  };

  sport: 'tennis' | 'pickleball' | 'badminton' | 'squash' | 'table_tennis' | 'padel' = 'tennis';
  sportLabel = 'Tennis';

  constructor() {
    const param = this.route.snapshot.paramMap.get('sport');
    if (param && param in RegisterClubComponent.SPORT_LABELS) {
      this.sport = param as typeof this.sport;
      this.sportLabel = RegisterClubComponent.SPORT_LABELS[param];
    } else {
      this.router.navigate(['/register-club']);
    }
  }

  goBack() {
    if ((history.state?.navigationId ?? 1) > 1) {
      this.loc.back();
    } else {
      this.router.navigate(['/book']);
    }
  }

  // Club Info
  clubName = '';
  location = '';
  logo: string | null = null;
  logoPreview: string | null = null;
  uploadingLogo = false;
  logoUploadError = '';
  description = '';
  photos: string[] = [];
  uploadingPhotoCount = 0;
  isDraggingPhotos = false;
  photoUploadError = '';
  socialFacebook = '';
  socialInstagram = '';
  socialReclub = '';

  // Courts & Hours
  courtCount = 2;
  openingHour = 5;
  closingHour = 22;
  readonly hourOptions = Array.from({ length: 24 }, (_, h) => {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const period = h < 12 ? 'AM' : 'PM';
    return { value: h, label: `${h12}:00 ${period}` };
  });

  // Payments
  readonly availablePaymentMethods = ['Cash', 'GCash', 'Bank Transfer', 'GoTyme'];
  paymentMethods: string[] = [];
  paymentAccounts: Record<string, string> = {};
  paymentQrCodes: Record<string, string> = {};
  uploadingQr: string | null = null;

  // Admin Account
  adminName = '';
  adminUsername = '';
  adminPassword = '';
  email = '';
  contactNumber = '';

  // Form state
  loading = false;
  errorMsg = '';
  success = false;
  formSubmitted = false;
  currentStep = 1;
  step1Attempted = false;
  step2Attempted = false;
  bookingProcess: 'reservation' | 'per_game' | 'hosted_play' = 'reservation';
  reservationWeekdayRate = 0;
  perGameFee = 0;

  nextStep() {
    if (this.currentStep === 1) {
      this.step1Attempted = true;
      if (!this.clubName || !this.location || !this.logo) return;
    }
    if (this.currentStep === 3) {
      this.step2Attempted = true;
      if (!this.courtCount || this.courtCount < 1 || this.courtCount > 20) return;
    }
    if (this.currentStep === 2 && this.bookingProcess === 'hosted_play') {
      this.currentStep = 4;
      this.cdr.detectChanges();
      return;
    }
    this.currentStep++;
    this.cdr.detectChanges();
  }

  prevStep() {
    if (this.currentStep === 4 && this.bookingProcess === 'hosted_play') {
      this.currentStep = 2;
    } else {
      this.currentStep--;
    }
    this.cdr.detectChanges();
  }

  onAdminNameChange() {
    this.adminUsername = this.adminName.trim().toLowerCase().replace(/\s+/g, '-');
  }

  togglePaymentMethod(method: string, checked: boolean) {
    if (checked) {
      if (!this.paymentMethods.includes(method)) {
        this.paymentMethods = [...this.paymentMethods, method];
      }
    } else {
      this.paymentMethods = this.paymentMethods.filter(m => m !== method);
      const updatedAccounts = { ...this.paymentAccounts };
      delete updatedAccounts[method];
      this.paymentAccounts = updatedAccounts;
      const updatedQr = { ...this.paymentQrCodes };
      delete updatedQr[method];
      this.paymentQrCodes = updatedQr;
    }
  }

  setPaymentAccount(method: string, value: string) {
    this.paymentAccounts = { ...this.paymentAccounts, [method]: value };
  }

  async onQrFileSelected(method: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const validationError = this.cloudinary.validateImage(file);
    if (validationError) {
      this.photoUploadError = validationError;
      this.cdr.detectChanges();
      return;
    }
    this.uploadingQr = method;
    this.cdr.detectChanges();
    try {
      const url = await this.cloudinary.uploadImage(file);
      this.paymentQrCodes = { ...this.paymentQrCodes, [method]: url };
    } catch {
      this.photoUploadError = 'QR upload failed. Please try again.';
    } finally {
      this.uploadingQr = null;
      this.cdr.detectChanges();
    }
  }

  removeQrCode(method: string) {
    const updated = { ...this.paymentQrCodes };
    delete updated[method];
    this.paymentQrCodes = updated;
  }

  onPhotosDragOver(event: DragEvent) {
    event.preventDefault();
    if (this.photos.length < 4) this.isDraggingPhotos = true;
  }

  onPhotosDragLeave() { this.isDraggingPhotos = false; }

  async onPhotosDrop(event: DragEvent) {
    event.preventDefault();
    this.isDraggingPhotos = false;
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    await this.uploadPhotoBatch(files);
  }

  async onPhotoSelected(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    (event.target as HTMLInputElement).value = '';
    await this.uploadPhotoBatch(files);
  }

  private async uploadPhotoBatch(files: File[]) {
    const slots = 4 - this.photos.length;
    if (slots <= 0 || files.length === 0) return;
    const batch = files.slice(0, slots);
    const valid = batch.filter(f => !this.cloudinary.validateImage(f));
    if (valid.length === 0) { this.photoUploadError = 'No valid images (max 5 MB each, JPG/PNG/WebP).'; this.cdr.detectChanges(); return; }
    this.photoUploadError = '';
    this.uploadingPhotoCount = valid.length;
    this.cdr.detectChanges();
    const results = await Promise.allSettled(valid.map(f => this.cloudinary.uploadImage(f)));
    const urls: string[] = [];
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') urls.push(r.value); else failed++;
    }
    if (urls.length) this.photos = [...this.photos, ...urls];
    if (failed) this.photoUploadError = `${failed} photo(s) failed to upload.`;
    this.uploadingPhotoCount = 0;
    this.cdr.detectChanges();
  }

  removePhoto(index: number) {
    this.photos = this.photos.filter((_, i) => i !== index);
    this.cdr.detectChanges();
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const error = this.cloudinary.validateImage(file);
    if (error) {
      this.logoUploadError = error;
      this.cdr.detectChanges();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);

    this.uploadingLogo = true;
    this.logoUploadError = '';
    this.cdr.detectChanges();

    this.cloudinary
      .uploadImage(file)
      .then((url) => {
        this.logo = url;
        this.uploadingLogo = false;
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.logoUploadError = 'Logo upload failed. Please try again.';
        this.uploadingLogo = false;
        this.logoPreview = null;
        this.cdr.detectChanges();
      });
  }

  removeLogo() {
    this.logo = null;
    this.logoPreview = null;
    this.logoUploadError = '';
    const fileInput = document.getElementById('clubLogo') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    this.cdr.detectChanges();
  }

  onSubmit() {
    if (!this.clubName || !this.location || !this.adminName || !this.adminUsername || !this.adminPassword || !this.contactNumber) return;
    if (!this.logo) return;
    this.loading = true;
    this.errorMsg = '';

    const socialLinks: Record<string, string> = {};
    if (this.socialFacebook.trim()) socialLinks['facebook'] = this.socialFacebook.trim();
    if (this.socialInstagram.trim()) socialLinks['instagram'] = this.socialInstagram.trim();
    if (this.socialReclub.trim()) socialLinks['reclub'] = this.socialReclub.trim();

    this.auth
      .registerClub({
        clubName: this.clubName,
        sport: this.sport,
        adminName: this.adminName,
        adminUsername: this.adminUsername,
        adminPassword: this.adminPassword,
        location: this.location,
        logo: this.logo || undefined,
        email: this.email || undefined,
        contactNumber: this.contactNumber || undefined,
        description: this.description || undefined,
        photos: this.photos.length > 0 ? this.photos : undefined,
        bookingProcess: this.bookingProcess,
        courtCount: this.courtCount,
        openingHour: this.openingHour,
        closingHour: this.closingHour,
        paymentMethods: this.paymentMethods.length > 0 ? this.paymentMethods : undefined,
        paymentAccounts: Object.keys(this.paymentAccounts).length > 0 ? this.paymentAccounts : undefined,
        paymentQrCodes: Object.keys(this.paymentQrCodes).length > 0 ? this.paymentQrCodes : undefined,
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
        reservationWeekdayRate: this.bookingProcess === 'reservation' ? this.reservationWeekdayRate : undefined,
        reservationWeekendRate: this.bookingProcess === 'reservation' ? this.reservationWeekdayRate : undefined,
        reservationHolidayRate: this.bookingProcess === 'reservation' ? this.reservationWeekdayRate : undefined,
        perGameFee: this.bookingProcess === 'per_game' ? this.perGameFee : undefined,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = err.error?.error || 'Registration failed. Please try again.';
          this.cdr.detectChanges();
        },
      });
  }
}
