import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ClubService } from '../../../core/services/club.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { AuthService } from '../../../core/services/auth.service';
import { RatesService, Rates } from '../../../core/services/rates.service';

@Component({
  selector: 'app-club-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="cf-shell">

      <!-- ── Left branding panel ── -->
      <div class="cf-left">
        <img src="/CourtGo.png" alt="CourtGo" class="cf-left-logo" />
        <p class="cf-left-eyebrow">Club Management</p>
        <h1 class="cf-left-title">{{ editId ? 'Edit your club.' : 'Add a new club.' }}</h1>
        <p class="cf-left-tagline">Update your club profile, booking setup, courts, and payment options.</p>
        <nav class="cf-left-steps">
          <div class="cf-ls" [class.cf-ls-active]="currentStep === 1" [class.cf-ls-done]="currentStep > 1">
            <span class="cf-ls-num">{{ currentStep > 1 ? '✓' : '1' }}</span><span>Club Information</span>
          </div>
          <div class="cf-ls" [class.cf-ls-active]="currentStep === 2" [class.cf-ls-done]="currentStep > 2">
            <span class="cf-ls-num">{{ currentStep > 2 ? '✓' : '2' }}</span><span>Booking Process</span>
          </div>
          <div class="cf-ls"
            [class.cf-ls-active]="currentStep === 3 && bookingProcess !== 'hosted_play'"
            [class.cf-ls-done]="currentStep > 3 && bookingProcess !== 'hosted_play'"
            [class.cf-ls-skip]="bookingProcess === 'hosted_play'">
            <span class="cf-ls-num">{{ (currentStep > 3 && bookingProcess !== 'hosted_play') ? '✓' : '3' }}</span><span>Courts &amp; Hours</span>
          </div>
          <div class="cf-ls" [class.cf-ls-active]="currentStep === 4">
            <span class="cf-ls-num">4</span><span>Payment Methods</span>
          </div>
        </nav>
      </div>

      <!-- ── Right panel ── -->
      <div class="cf-right">
        <div class="cf-card">

          <a [routerLink]="backRoute" class="cf-back-btn">&#8592; Back</a>

          <!-- Mobile header -->
          <div class="cf-mobile-header">
            <div class="cf-header-banner">
              <img src="/CourtGo.png" alt="CourtGo" class="cf-hero-logo" />
              <div class="cf-mobile-brand">
                <span>Club Management</span>
                <strong>{{ editId ? 'Edit Club' : 'New Club' }}</strong>
              </div>
            </div>
          </div>

          @if (error) {
            <div class="cf-alert cf-alert-error" style="margin: 0 2rem 0.75rem;"><i class="fas fa-exclamation-triangle"></i> {{ error }}</div>
          }
          @if (success) {
            <div class="cf-alert cf-alert-success" style="margin: 0 2rem 0.75rem;"><i class="fas fa-check-circle"></i> {{ success }}</div>
          }

          <!-- Step dots (mobile only) -->
          <div class="cf-step-dots">
            <div class="cf-step-dot" [class.active]="currentStep === 1" [class.done]="currentStep > 1">1</div>
            <div class="cf-step-line"></div>
            <div class="cf-step-dot" [class.active]="currentStep === 2" [class.done]="currentStep > 2">2</div>
            <div class="cf-step-line"></div>
            <div class="cf-step-dot"
              [class.active]="currentStep === 3 && bookingProcess !== 'hosted_play'"
              [class.done]="currentStep > 3 && bookingProcess !== 'hosted_play'"
              [class.skipped]="bookingProcess === 'hosted_play' && currentStep > 2">3</div>
            <div class="cf-step-line"></div>
            <div class="cf-step-dot" [class.active]="currentStep === 4">4</div>
          </div>
          <p class="cf-mobile-step-label">Step {{ currentStep }} of 4</p>

          <form (ngSubmit)="onSubmit()" #f="ngForm">

            <!-- ══ Step 1: Club Information ══ -->
            @if (currentStep === 1) {
              <div class="cf-section-label">Club Information</div>

              <div class="cf-group">
                <label class="cf-label" for="name">Club Name <span class="cf-required">*</span></label>
                <input id="name" type="text" class="cf-input" [(ngModel)]="name" name="name"
                  required placeholder="e.g. Baseline Tennis Club"
                  #nameField="ngModel"
                  [class.cf-input-invalid]="nameField.invalid && (nameField.touched || step1Attempted)" />
                @if (nameField.invalid && (nameField.touched || step1Attempted)) {
                  <span class="cf-field-error">Club name is required.</span>
                }
              </div>

              <div class="cf-group">
                <label class="cf-label" for="location">Location <span class="cf-optional">optional</span></label>
                <input id="location" type="text" class="cf-input" [(ngModel)]="location" name="location"
                  placeholder="e.g. Manila, Philippines" />
              </div>

              <div class="cf-group">
                <label class="cf-label" for="mobile">Mobile Number <span class="cf-optional">optional</span></label>
                <input id="mobile" type="tel" class="cf-input" [(ngModel)]="mobile" name="mobile"
                  placeholder="e.g. 09171234567" />
              </div>

              <div class="cf-group">
                <label class="cf-label" for="clubEmail">Email <span class="cf-optional">optional</span></label>
                <input id="clubEmail" type="email" class="cf-input" [(ngModel)]="email" name="clubEmail"
                  placeholder="e.g. club@example.com" />
              </div>

              <div class="cf-group">
                <label class="cf-label" for="description">About the Club <span class="cf-optional">optional</span></label>
                <textarea id="description" class="cf-input cf-textarea" [(ngModel)]="description" name="description"
                  placeholder="Short description shown on the public booking page…" rows="3"></textarea>
              </div>

              <!-- Logo -->
              <div class="cf-group">
                <label class="cf-label">Club Logo <span class="cf-optional">optional</span></label>
                <div class="cf-upload-zone"
                  [class.cf-upload-zone-has]="logo"
                  [class.cf-upload-zone-drag]="isDragging"
                  (click)="fileInput.click()"
                  (dragover)="$event.preventDefault(); isDragging = true"
                  (dragleave)="isDragging = false"
                  (drop)="onDrop($event)">
                  @if (uploading) {
                    <div class="cf-upload-state">
                      <i class="fas fa-circle-notch fa-spin cf-upload-spinner"></i>
                      <span>Uploading…</span>
                    </div>
                  } @else if (logo) {
                    <img [src]="logo" alt="Club logo" class="cf-logo-preview-img" />
                    <div class="cf-upload-overlay"><i class="fas fa-camera"></i> Change</div>
                  } @else {
                    <div class="cf-upload-state">
                      <div class="cf-upload-icon"><i class="fas fa-image"></i></div>
                      <span class="cf-upload-hint">Click or drag &amp; drop to upload</span>
                      <span class="cf-upload-sub">PNG, JPG, WebP · max 5 MB</span>
                    </div>
                  }
                </div>
                @if (uploadError) { <span class="cf-field-error">{{ uploadError }}</span> }
                @if (logo) {
                  <button type="button" class="cf-remove-logo" (click)="removeLogo()">
                    <i class="fas fa-trash"></i> Remove logo
                  </button>
                }
                <input #fileInput type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                  style="display:none" (change)="onFileSelected($event)" />
              </div>

              <!-- Court Photos -->
              <div class="cf-group">
                <label class="cf-label">Court Photos <span class="cf-optional">optional · up to 4</span></label>
                <div class="cf-photos-grid"
                     [class.cf-photos-dragging]="isDraggingPhotos"
                     (dragover)="onPhotosDragOver($event)"
                     (dragleave)="onPhotosDragLeave()"
                     (drop)="onPhotosDrop($event)">
                  @for (url of photos; track url; let i = $index) {
                    <div class="cf-photo-thumb">
                      <img [src]="url" alt="Court photo" class="cf-photo-img" />
                      <button type="button" class="cf-photo-remove" (click)="removePhoto(i)">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  }
                  @if (photos.length < 4) {
                    <label class="cf-photo-add" [class.cf-photo-add-uploading]="uploadingPhotoCount > 0">
                      @if (uploadingPhotoCount > 0) {
                        <i class="fas fa-circle-notch fa-spin"></i>
                        <span class="cf-photo-add-count">{{ uploadingPhotoCount }}</span>
                      } @else {
                        <i class="fas fa-plus"></i>
                      }
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple style="display:none"
                        (change)="onPhotoSelected($event)" [disabled]="uploadingPhotoCount > 0" />
                    </label>
                  }
                </div>
                <p class="cf-photos-hint">Drag &amp; drop up to 4 images, or click <strong>+</strong> to browse</p>
              </div>

              <!-- Social Links -->
              <div class="cf-group">
                <label class="cf-label">Social Media Links <span class="cf-optional">optional</span></label>
                <div class="cf-social-inputs">
                  <div class="cf-social-row">
                    <span class="cf-social-icon cf-social-fb"><i class="fab fa-facebook"></i></span>
                    <input class="cf-input" type="url" [(ngModel)]="socialFacebook" name="socialFacebook"
                      placeholder="https://facebook.com/yourpage" />
                  </div>
                  <div class="cf-social-row">
                    <span class="cf-social-icon cf-social-ig"><i class="fab fa-instagram"></i></span>
                    <input class="cf-input" type="url" [(ngModel)]="socialInstagram" name="socialInstagram"
                      placeholder="https://instagram.com/yourhandle" />
                  </div>
                  <div class="cf-social-row">
                    <span class="cf-social-icon cf-social-rc"><i class="fas fa-link"></i></span>
                    <input class="cf-input" type="url" [(ngModel)]="socialReclub" name="socialReclub"
                      placeholder="https://reclub.co/clubs/yourclub" />
                  </div>
                </div>
              </div>

              <div class="cf-step-nav">
                <button type="button" class="cf-btn-primary cf-btn-full"
                  [disabled]="uploading || uploadingPhotoCount > 0"
                  (click)="nextStep()">Next →</button>
              </div>
            }

            <!-- ══ Step 2: Booking Process ══ -->
            @if (currentStep === 2) {
              <div class="cf-section-label">Booking Process</div>
              <p class="cf-photos-hint" style="margin: 0 0 1rem;">How will players book courts at your club?</p>

              <div class="cf-booking-cards">
                <div class="cf-booking-card" [class.cf-bc-selected]="bookingProcess === 'reservation'" (click)="bookingProcess = 'reservation'">
                  <div class="cf-bc-title">Reservation</div>
                  <div class="cf-bc-desc">Players book a specific court and time slot in advance.</div>
                </div>
                <div class="cf-booking-card" [class.cf-bc-selected]="bookingProcess === 'per_game'" (click)="bookingProcess = 'per_game'">
                  <div class="cf-bc-title">Per Game</div>
                  <div class="cf-bc-desc">Players join open sessions and pay per game played.</div>
                </div>
                <div class="cf-booking-card" [class.cf-bc-selected]="bookingProcess === 'hosted_play'" (click)="bookingProcess = 'hosted_play'">
                  <div class="cf-bc-title">Hosted Play</div>
                  <div class="cf-bc-desc">Admin-run sessions with queue management and court rotation.</div>
                </div>
              </div>

              @if (bookingProcess === 'reservation' || bookingProcess === 'per_game') {
                <div class="cf-group" style="margin-top: 1.25rem;">
                  <label class="cf-label">Court Fee per Hour <span class="cf-optional">optional</span></label>
                  <div class="cf-rate-wrap">
                    <span class="cf-rate-prefix">₱</span>
                    <input class="cf-input cf-rate-input" type="number" [(ngModel)]="courtFeePerHour" name="courtFeePerHour"
                      min="0" step="0.01" placeholder="0.00" />
                  </div>
                  @if (bookingProcess === 'reservation') {
                    <p class="cf-photos-hint" style="margin-top: 0.4rem;">Applied to all time slots — weekdays, weekends, and holidays.</p>
                  }
                </div>
              }

              <div class="cf-step-nav" style="margin-top: 1.5rem;">
                <button type="button" class="cf-btn-secondary" (click)="prevStep()">&#8592; Back</button>
                <button type="button" class="cf-btn-primary cf-btn-full" (click)="nextStep()">Next →</button>
              </div>
            }

            <!-- ══ Step 3: Courts & Hours ══ -->
            @if (currentStep === 3) {
              <div class="cf-section-label">Courts &amp; Hours</div>

              <div class="cf-group">
                <label class="cf-label" for="courtCount">Number of Courts <span class="cf-required">*</span></label>
                <input id="courtCount" type="number" class="cf-input" [(ngModel)]="courtCount"
                  name="courtCount" required min="1" max="20"
                  #courtCountField="ngModel"
                  [class.cf-input-invalid]="(courtCountField.invalid || courtCount < 1 || courtCount > 20) && (courtCountField.touched || step3Attempted)" />
                @if ((courtCountField.invalid || courtCount < 1 || courtCount > 20) && (courtCountField.touched || step3Attempted)) {
                  <span class="cf-field-error">Must be between 1 and 20.</span>
                }
              </div>

              <div class="cf-group">
                <label class="cf-label">Operating Hours</label>
                <div class="cf-hours-row">
                  <div class="cf-hours-col">
                    <label class="cf-sublabel">Opens</label>
                    <select class="cf-input" [(ngModel)]="openingHour" name="openingHour">
                      @for (opt of hourOptions; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                  </div>
                  <span class="cf-hours-sep">to</span>
                  <div class="cf-hours-col">
                    <label class="cf-sublabel">Closes (last slot starts at)</label>
                    <select class="cf-input" [(ngModel)]="closingHour" name="closingHour">
                      @for (opt of hourOptions; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                  </div>
                </div>
              </div>

              <div class="cf-step-nav" style="margin-top: 1.5rem;">
                <button type="button" class="cf-btn-secondary" (click)="prevStep()">&#8592; Back</button>
                <button type="button" class="cf-btn-primary cf-btn-full" (click)="nextStep()">Next →</button>
              </div>
            }

            <!-- ══ Step 4: Payment Methods ══ -->
            @if (currentStep === 4) {
              <div class="cf-section-label">Payment Methods <span class="cf-optional" style="text-transform: none; letter-spacing: 0; font-size: 0.8rem;">(optional)</span></div>

              <div class="cf-pm-list">
                @for (method of availablePaymentMethods; track method) {
                  <div class="cf-pm-row">
                    <label class="cf-pm-check-label">
                      <input type="checkbox" class="cf-pm-checkbox"
                        [checked]="paymentMethods.includes(method)"
                        (change)="togglePaymentMethod(method, $any($event.target).checked)" />
                      <span class="cf-pm-name">{{ method }}</span>
                    </label>
                    @if (paymentMethods.includes(method) && method !== 'Cash') {
                      <input type="text" class="cf-input cf-pm-account-input"
                        [placeholder]="method + ' account / number (optional)'"
                        [value]="paymentAccounts[method] || ''"
                        (input)="setPaymentAccount(method, $any($event.target).value)" />
                      <div class="cf-pm-qr-row">
                        @if (paymentQrCodes[method]) {
                          <img [src]="paymentQrCodes[method]" alt="QR Code" class="cf-pm-qr-preview" />
                          <button type="button" class="cf-pm-qr-remove" (click)="removeQrCode(method)">
                            <i class="fas fa-trash"></i> Remove QR
                          </button>
                        } @else {
                          <label class="cf-pm-qr-upload">
                            <i class="fas {{ uploadingQr === method ? 'fa-circle-notch fa-spin' : 'fa-qrcode' }}"></i>
                            {{ uploadingQr === method ? 'Uploading…' : 'Upload QR Code' }}
                            <input type="file" accept="image/*" style="display:none"
                              (change)="onQrFileSelected(method, $event)"
                              [disabled]="uploadingQr === method" />
                          </label>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="cf-step-nav" style="margin-top: 1.5rem;">
                <button type="button" class="cf-btn-secondary" (click)="prevStep()">&#8592; Back</button>
                <button type="submit" class="cf-btn-primary cf-btn-full" [disabled]="saving">
                  <i class="fas" [class.fa-floppy-disk]="!saving" [class.fa-circle-notch]="saving" [class.fa-spin]="saving"></i>
                  {{ saving ? 'Saving…' : (editId ? 'Save Changes' : 'Create Club') }}
                </button>
              </div>
            }

          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ── Shell ── */
    :host { display: block; }
    .cf-shell {
      display: flex;
      min-height: 100vh;
      background: linear-gradient(135deg, rgba(25,58,43,0.22), transparent 46%), #07140e;
    }

    /* ── Left panel (desktop only) ── */
    .cf-left { display: none; }
    @media (min-width: 900px) {
      .cf-left {
        display: flex;
        flex-direction: column;
        width: clamp(310px, 22vw, 360px);
        flex-shrink: 0;
        background: linear-gradient(180deg, rgba(163,230,53,0.06), transparent 34%), #0a1b12;
        border-right: 1px solid rgba(163,230,53,0.1);
        padding: clamp(2rem, 5vh, 4rem) clamp(1.75rem, 2.5vw, 3rem);
        position: sticky;
        top: 0;
        height: 100vh;
        overflow: hidden;
        justify-content: flex-start;
      }
    }
    .cf-left-logo { height: 36px; width: auto; align-self: flex-start; margin-bottom: clamp(2.75rem, 8vh, 5rem); }
    .cf-left-eyebrow {
      margin: 0 0 0.75rem;
      color: #a3e635;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 1.4px;
      text-transform: uppercase;
    }
    .cf-left-title {
      font-size: clamp(2rem, 2.5vw, 2.35rem);
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.5rem;
      line-height: 1.08;
      max-width: 290px;
    }
    .cf-left-tagline {
      font-size: 0.88rem;
      color: rgba(255,255,255,0.52);
      margin: 0 0 2.25rem;
      line-height: 1.5;
      max-width: 300px;
    }
    .cf-left-steps { display: flex; flex-direction: column; gap: 0; }
    .cf-ls {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.45rem 0.65rem;
      border-radius: 7px;
      font-size: 0.88rem;
      font-weight: 500;
      min-height: 48px;
      color: rgba(255,255,255,0.3);
      transition: all 0.2s;
    }
    .cf-ls-active { color: #ffffff; background: rgba(163,230,53,0.09); }
    .cf-ls-done { color: rgba(163,230,53,0.6); }
    .cf-ls-skip { opacity: 0.22; pointer-events: none; }
    .cf-ls-num {
      width: 24px; height: 24px;
      border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.72rem; font-weight: 700;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .cf-ls-active .cf-ls-num { border-color: #a3e635; color: #a3e635; background: rgba(163,230,53,0.1); }
    .cf-ls-done .cf-ls-num { border-color: rgba(163,230,53,0.5); color: rgba(163,230,53,0.7); background: rgba(163,230,53,0.1); font-size: 0.65rem; }

    /* ── Right panel ── */
    .cf-right {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      padding: 0;
      overflow-y: auto;
      min-height: 100vh;
    }
    @media (min-width: 900px) {
      .cf-right {
        padding: clamp(2rem, 5vh, 4rem) clamp(2.5rem, 6vw, 7rem);
      }
    }

    /* ── Card ── */
    .cf-card {
      position: relative;
      width: 100%;
      background: transparent;
    }
    @media (min-width: 900px) {
      .cf-card { max-width: 760px; }
    }

    /* ── Back button ── */
    .cf-back-btn {
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
      text-decoration: none;
      transition: color 0.15s;
      min-height: 40px;
      border-radius: 6px;
    }
    .cf-back-btn:hover { color: #a3e635; }
    @media (min-width: 900px) {
      .cf-back-btn { padding-top: 0; padding-left: 0; margin-bottom: 0.25rem; }
    }

    /* ── Mobile header ── */
    .cf-mobile-header { display: block; }
    @media (min-width: 900px) { .cf-mobile-header { display: none; } }
    .cf-header-banner {
      background: #0a1b12;
      padding: 0 1rem 0 3.8rem;
      min-height: 70px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .cf-hero-logo { height: 28px; width: auto; order: 2; }
    .cf-mobile-brand {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15rem;
    }
    .cf-mobile-brand span { color: #a3e635; font-size: 0.62rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
    .cf-mobile-brand strong { color: #fff; font-size: 0.95rem; }

    /* ── Step dots (mobile only) ── */
    .cf-step-dots { display: none; }
    @media (max-width: 899px) {
      .cf-step-dots {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.25rem 1.25rem 0;
      }
    }
    .cf-step-dot {
      width: 28px; height: 28px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 700;
      border: 2px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.35);
      transition: all 0.2s;
    }
    .cf-step-dot.active { border-color: #a3e635; color: #a3e635; background: rgba(163,230,53,0.1); }
    .cf-step-dot.done { border-color: rgba(163,230,53,0.4); background: rgba(163,230,53,0.15); color: rgba(163,230,53,0.7); }
    .cf-step-dot.skipped { opacity: 0.2; }
    .cf-step-line { flex: 1; max-width: 32px; height: 1px; background: rgba(255,255,255,0.1); }

    .cf-mobile-step-label { display: none; }
    @media (max-width: 899px) {
      .cf-mobile-step-label {
        display: block;
        margin: 0.65rem 0 0;
        text-align: center;
        color: rgba(255,255,255,0.42);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
    }

    /* ── Alerts ── */
    .cf-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .cf-alert-error  { background: rgba(244,63,94,0.14);  border: 1px solid rgba(244,63,94,0.3);  color: #fecdd3; }
    .cf-alert-success { background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.28); color: #d9f99d; }

    /* ── Form ── */
    form { padding: 1.5rem 2rem; }
    @media (min-width: 900px) {
      form { padding: 1rem 0 2rem; }
      .cf-section-label {
        color: #fff;
        font-size: 1.55rem;
        text-transform: none;
        letter-spacing: 0;
        border-bottom: 0;
        margin-bottom: 1.25rem;
      }
    }
    @media (max-width: 899px) {
      form { max-width: 640px; margin: 0 auto; padding: 1.35rem 1.25rem 2rem; }
      .cf-section-label {
        margin: 0 0 1.1rem;
        padding-bottom: 0.85rem;
        color: #fff;
        font-size: 1.25rem;
        text-transform: none;
        letter-spacing: 0;
      }
    }

    .cf-section-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #a3e635;
      padding: 0 0 0.75rem;
      margin-bottom: 0.25rem;
      border-bottom: 1px solid rgba(163,230,53,0.12);
      margin-top: 0.5rem;
    }
    .cf-section-label:first-of-type { margin-top: 0; }

    .cf-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; margin-top: 1rem; }
    .cf-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: rgba(255,255,255,0.76);
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .cf-required { color: #a3e635; font-size: 0.9em; }
    .cf-optional { font-size: 0.78em; font-weight: 400; color: rgba(255,255,255,0.35); text-transform: none; letter-spacing: 0; }

    .cf-input {
      width: 100%;
      padding: 0.75rem 1rem;
      min-height: 48px;
      background: #14291e;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 7px;
      font-size: 0.92rem;
      color: #ffffff;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;
    }
    .cf-input::placeholder { color: rgba(255,255,255,0.5); }
    .cf-input:focus { border-color: rgba(163,230,53,0.5); box-shadow: 0 0 0 3px rgba(163,230,53,0.1); }
    .cf-input-invalid { border-color: rgba(244,63,94,0.5) !important; }
    .cf-input-invalid:focus { box-shadow: 0 0 0 3px rgba(244,63,94,0.1) !important; }
    .cf-field-error { color: #fca5a5; font-size: 0.78rem; margin-top: 0.2rem; }

    select.cf-input { cursor: pointer; }
    select.cf-input option { background: #1e2a1e; color: #ffffff; }

    .cf-textarea { resize: vertical; min-height: 80px; }

    /* ── Logo upload ── */
    .cf-upload-zone {
      position: relative;
      width: 110px; height: 110px;
      border-radius: 14px;
      border: 2px dashed rgba(255,255,255,0.15);
      background: #14291e;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      transition: border-color 0.18s, background 0.18s;
    }
    .cf-upload-zone:hover,
    .cf-upload-zone-drag { border-color: rgba(163,230,53,0.5); background: rgba(163,230,53,0.06); }
    .cf-upload-zone-has { border-style: solid; border-color: rgba(163,230,53,0.3); }
    .cf-upload-state { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.5rem; text-align: center; }
    .cf-upload-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.25); display: flex; align-items: center; justify-content: center; color: #a3e635; font-size: 0.9rem; }
    .cf-upload-hint { font-size: 0.72rem; color: rgba(255,255,255,0.55); font-weight: 500; line-height: 1.3; }
    .cf-upload-sub { font-size: 0.65rem; color: rgba(255,255,255,0.3); }
    .cf-upload-spinner { font-size: 1.4rem; color: #a3e635; }
    .cf-logo-preview-img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
    .cf-upload-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 600; color: #fff; opacity: 0; border-radius: 12px; transition: opacity 0.18s; }
    .cf-upload-zone:hover .cf-upload-overlay { opacity: 1; }
    .cf-remove-logo { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.5rem; background: none; border: none; color: rgba(244,63,94,0.7); font-size: 0.78rem; cursor: pointer; font-family: inherit; padding: 0; transition: color 0.15s; }
    .cf-remove-logo:hover { color: #fb7185; }

    /* ── Photos grid ── */
    .cf-photos-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.35rem; }
    .cf-photo-thumb { position: relative; width: 80px; height: 80px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
    .cf-photo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cf-photo-remove { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; background: rgba(0,0,0,0.7); border: none; border-radius: 50%; color: #fff; font-size: 0.6rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .cf-photo-add { width: 80px; height: 80px; border-radius: 10px; border: 1px dashed rgba(163,230,53,0.3); background: rgba(163,230,53,0.04); display: flex; align-items: center; justify-content: center; color: #a3e635; font-size: 1.1rem; cursor: pointer; transition: background 0.15s; flex-direction: column; gap: 0.2rem; }
    .cf-photo-add:hover { background: rgba(163,230,53,0.1); }
    .cf-photo-add-uploading { opacity: 0.6; cursor: wait; }
    .cf-photo-add-count { font-size: 0.6rem; color: rgba(163,230,53,0.7); }
    .cf-photos-dragging { outline: 2px dashed #a3e635; outline-offset: 4px; background: rgba(163,230,53,0.04); border-radius: 12px; }
    .cf-photos-hint { font-size: 0.72rem; color: rgba(255,255,255,0.35); margin: 0.4rem 0 0; }

    /* ── Social links ── */
    .cf-social-inputs { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.4rem; }
    .cf-social-row { display: flex; align-items: center; gap: 0.5rem; }
    .cf-social-row .cf-input { margin-top: 0; min-height: 40px; }
    .cf-social-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0; }
    .cf-social-fb { background: rgba(24,119,242,0.15); color: #4a90d9; border: 1px solid rgba(24,119,242,0.25); }
    .cf-social-ig { background: rgba(228,64,95,0.12); color: #e4405f; border: 1px solid rgba(228,64,95,0.2); }
    .cf-social-rc { background: rgba(163,230,53,0.1); color: #a3e635; border: 1px solid rgba(163,230,53,0.2); }

    /* ── Hours ── */
    .cf-sublabel { display: block; font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.4); margin-bottom: 0.3rem; }
    .cf-hours-row { display: flex; align-items: flex-end; gap: 0.75rem; }
    .cf-hours-col { flex: 1; }
    .cf-hours-sep { padding-bottom: 0.7rem; color: rgba(255,255,255,0.45); font-size: 0.85rem; font-weight: 500; flex-shrink: 0; }

    /* ── Booking Process cards ── */
    .cf-booking-cards { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 0.35rem; }
    @media (min-width: 620px) {
      .cf-booking-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; }
    }
    .cf-booking-card {
      border: 1.5px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 1rem;
      cursor: pointer;
      transition: border-color 0.18s, background 0.18s;
      background: rgba(255,255,255,0.02);
      min-height: 100px;
    }
    .cf-booking-card:hover { border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.04); }
    .cf-bc-selected { border-color: #83bd24 !important; background: rgba(163,230,53,0.08) !important; box-shadow: inset 0 0 0 1px #83bd24; }
    .cf-bc-title { font-weight: 700; font-size: 0.88rem; color: #fff; margin-bottom: 0.2rem; }
    .cf-bc-desc { font-size: 0.78rem; color: rgba(255,255,255,0.42); line-height: 1.4; }

    /* ── Rate input ── */
    .cf-rate-wrap { position: relative; display: flex; align-items: center; }
    .cf-rate-prefix { position: absolute; left: 0.8rem; font-size: 0.9rem; font-weight: 700; color: rgba(163,230,53,0.7); pointer-events: none; z-index: 1; }
    .cf-rate-input { padding-left: 1.8rem; }

    /* ── Payment methods ── */
    .cf-pm-list { display: flex; flex-direction: column; gap: 0.65rem; margin-top: 0.75rem; }
    .cf-pm-row { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.9rem 1rem; border: 1px solid rgba(255,255,255,0.09); border-radius: 7px; background: rgba(255,255,255,0.025); }
    .cf-pm-check-label { display: inline-flex; align-items: center; gap: 0.55rem; cursor: pointer; user-select: none; }
    .cf-pm-checkbox { width: 16px; height: 16px; accent-color: #a3e635; cursor: pointer; flex-shrink: 0; }
    .cf-pm-name { font-size: 0.9rem; color: #ffffff; font-weight: 500; }
    .cf-pm-account-input { font-size: 0.85rem; margin-top: 0; min-height: 40px; }
    .cf-pm-qr-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.4rem; flex-wrap: wrap; }
    .cf-pm-qr-preview { width: 80px; height: 80px; object-fit: contain; border-radius: 8px; background: #fff; padding: 4px; border: 1px solid rgba(255,255,255,0.1); }
    .cf-pm-qr-upload { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.42rem 0.85rem; background: rgba(163,230,53,0.08); border: 1px dashed rgba(163,230,53,0.35); border-radius: 8px; color: #a3e635; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .cf-pm-qr-upload:hover { background: rgba(163,230,53,0.15); }
    .cf-pm-qr-remove { display: inline-flex; align-items: center; gap: 0.35rem; background: none; border: none; color: rgba(244,63,94,0.7); font-size: 0.78rem; cursor: pointer; font-family: inherit; padding: 0; transition: color 0.15s; }
    .cf-pm-qr-remove:hover { color: #fb7185; }

    /* ── Step nav ── */
    .cf-step-nav { display: flex; gap: 0.75rem; margin-top: 0.75rem; }
    .cf-btn-primary {
      min-height: 48px;
      border-radius: 7px;
      font-weight: 800;
      background: #a3e635;
      color: #102009;
      border: 1px solid #a3e635;
      cursor: pointer;
      padding: 0.75rem 1.5rem;
      font-size: 0.95rem;
      font-family: inherit;
      width: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .cf-btn-primary:hover:not(:disabled) { background: #b5ef50; border-color: #b5ef50; box-shadow: 0 8px 24px rgba(163,230,53,0.16); }
    .cf-btn-primary:disabled { opacity: 0.5; cursor: default; }
    .cf-btn-full { width: 100%; }
    .cf-btn-secondary {
      flex: 0 0 auto;
      min-height: 48px;
      border-radius: 7px;
      font-weight: 600;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      padding: 0.75rem 1.25rem;
      font-family: inherit;
      font-size: 0.95rem;
      transition: background 0.15s, color 0.15s;
    }
    .cf-btn-secondary:hover { background: rgba(255,255,255,0.09); color: #fff; }

    /* ── Mobile overrides ── */
    @media (max-width: 899px) {
      .cf-right { padding: 0; }
      .cf-card { min-height: 100vh; background: #0b1b12; }
      .cf-back-btn {
        position: absolute;
        z-index: 2;
        top: 13px; left: 12px;
        padding: 0 0.65rem;
        color: rgba(255,255,255,0.72);
      }
    }
    @media (max-width: 600px) {
      form { padding: 1.25rem 1rem 2rem; }
      .cf-hours-row { flex-direction: column; align-items: stretch; gap: 0.5rem; }
      .cf-hours-sep { padding: 0; }
      .cf-step-nav { position: sticky; bottom: 0; z-index: 3; padding: 0.75rem 0; background: #0b1b12; }
      .cf-btn-secondary { padding-inline: 1rem; }
      .cf-booking-cards { grid-template-columns: 1fr; }
      .cf-booking-card { min-height: 0; }
    }
  `],
})
export class ClubFormComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly availablePaymentMethods = ['Cash', 'GCash', 'Bank Transfer', 'GoTyme'];
  readonly hourOptions = Array.from({ length: 24 }, (_, h) => {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const period = h < 12 ? 'AM' : 'PM';
    return { value: h, label: `${h12}:00 ${period}` };
  });

  name = '';
  location = '';
  mobile = '';
  email = '';
  logo = '';
  bookingProcess: 'reservation' | 'per_game' | 'hosted_play' = 'reservation';
  courtFeePerHour = 0;
  private loadedRates: Rates | null = null;
  courtCount = 2;
  openingHour = 5;
  closingHour = 22;
  paymentMethods: string[] = [];
  paymentAccounts: Record<string, string> = {};
  paymentQrCodes: Record<string, string> = {};
  description = '';
  photos: string[] = [];
  socialFacebook = '';
  socialInstagram = '';
  socialReclub = '';
  uploadingQr: string | null = null;
  uploadingPhotoCount = 0;
  isDraggingPhotos = false;
  saving = false;
  uploading = false;
  uploadError = '';
  isDragging = false;
  error = '';
  success = '';
  editId: string | null = null;

  currentStep = 1;
  step1Attempted = false;
  step3Attempted = false;

  constructor(
    private clubService: ClubService,
    private cloudinary: CloudinaryService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private ratesService: RatesService,
  ) {}

  get backRoute() {
    return this.auth.isSuperAdmin() ? '/admin/clubs' : '/player/dashboard';
  }

  ngOnInit() {
    this.editId = this.route.snapshot.paramMap.get('id');
    if (this.editId) {
      this.clubService.getClub(this.editId).subscribe({
        next: (club: any) => {
          this.name = club.name;
          this.location = club.location ?? '';
          this.mobile = club.mobile ?? '';
          this.email = club.email ?? '';
          this.logo = club.logo ?? '';
          this.bookingProcess = club.bookingProcess ?? 'reservation';
          this.courtCount = club.courtCount ?? 2;
          this.openingHour = club.openingHour ?? 5;
          this.closingHour = club.closingHour ?? 22;
          this.paymentMethods = club.paymentMethods ?? [];
          this.paymentAccounts = club.paymentAccounts ?? {};
          this.paymentQrCodes = club.paymentQrCodes ?? {};
          this.description = club.description ?? '';
          this.photos = club.photos ?? [];
          this.socialFacebook = club.socialLinks?.facebook ?? '';
          this.socialInstagram = club.socialLinks?.instagram ?? '';
          this.socialReclub = club.socialLinks?.reclub ?? '';
          this.cdr.detectChanges();

          this.ratesService.getRates(this.editId!).subscribe({
            next: (rates) => {
              this.loadedRates = rates;
              this.courtFeePerHour = this.bookingProcess === 'per_game'
                ? (rates.perGameFee ?? 0)
                : (rates.reservationWeekdayRate ?? 0);
              this.cdr.detectChanges();
            },
          });
        },
        error: () => {
          this.error = 'Failed to load club data.';
          this.cdr.detectChanges();
        },
      });
    }
  }

  nextStep() {
    if (this.currentStep === 1) {
      this.step1Attempted = true;
      if (!this.name.trim()) return;
    }
    if (this.currentStep === 3) {
      this.step3Attempted = true;
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

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadFile(file);
  }

  private async uploadFile(file: File) {
    const validationError = this.cloudinary.validateImage(file);
    if (validationError) { this.uploadError = validationError; this.cdr.detectChanges(); return; }
    this.uploadError = '';
    this.uploading = true;
    this.cdr.detectChanges();
    try {
      this.logo = await this.cloudinary.uploadImage(file);
    } catch {
      this.uploadError = 'Upload failed. Please try again.';
    } finally {
      this.uploading = false;
      if (this.fileInput) this.fileInput.nativeElement.value = '';
      this.cdr.detectChanges();
    }
  }

  removeLogo() {
    this.logo = '';
    this.uploadError = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  togglePaymentMethod(method: string, checked: boolean) {
    if (checked) {
      if (!this.paymentMethods.includes(method)) {
        this.paymentMethods = [...this.paymentMethods, method];
      }
    } else {
      this.paymentMethods = this.paymentMethods.filter(m => m !== method);
      const updated = { ...this.paymentAccounts };
      delete updated[method];
      this.paymentAccounts = updated;
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
    if (validationError) { this.uploadError = validationError; this.cdr.detectChanges(); return; }
    this.uploadingQr = method;
    this.cdr.detectChanges();
    try {
      const url = await this.cloudinary.uploadImage(file);
      this.paymentQrCodes = { ...this.paymentQrCodes, [method]: url };
    } catch {
      this.uploadError = 'QR upload failed. Please try again.';
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
    if (valid.length === 0) { this.uploadError = 'No valid images selected (max 5 MB each, JPG/PNG/WebP).'; this.cdr.detectChanges(); return; }
    this.uploadError = '';
    this.uploadingPhotoCount = valid.length;
    this.cdr.detectChanges();
    const results = await Promise.allSettled(valid.map(f => this.cloudinary.uploadImage(f)));
    const urls: string[] = [];
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') urls.push(r.value); else failed++;
    }
    if (urls.length) this.photos = [...this.photos, ...urls];
    if (failed) this.uploadError = `${failed} photo(s) failed to upload.`;
    this.uploadingPhotoCount = 0;
    this.cdr.detectChanges();
  }

  removePhoto(index: number) {
    this.photos = this.photos.filter((_, i) => i !== index);
  }

  onSubmit() {
    this.saving = true;
    this.error = '';
    const socialLinks: Record<string, string> = {};
    if (this.socialFacebook.trim()) socialLinks['facebook'] = this.socialFacebook.trim();
    if (this.socialInstagram.trim()) socialLinks['instagram'] = this.socialInstagram.trim();
    if (this.socialReclub.trim()) socialLinks['reclub'] = this.socialReclub.trim();
    const data: any = {
      name: this.name,
      location: this.location || undefined,
      mobile: this.mobile || undefined,
      email: this.email || undefined,
      logo: this.logo || undefined,
      bookingProcess: this.bookingProcess,
      courtCount: this.courtCount,
      openingHour: this.openingHour,
      closingHour: this.closingHour,
      paymentMethods: this.paymentMethods,
      paymentAccounts: this.paymentAccounts,
      paymentQrCodes: this.paymentQrCodes,
      description: this.description || undefined,
      photos: this.photos,
      socialLinks,
    };
    const request = this.editId
      ? this.clubService.updateClub(this.editId, data)
      : this.clubService.createClub(data);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.saveRatesIfNeeded();
        this.success = this.editId ? 'Club updated successfully!' : 'Club created successfully!';
        this.cdr.detectChanges();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          this.router.navigate([this.auth.isSuperAdmin() ? '/admin/clubs' : '/player/dashboard']);
        }, 2000);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error || 'Failed to save club.';
        this.cdr.detectChanges();
      },
    });
  }

  private saveRatesIfNeeded() {
    if (!this.editId || !this.loadedRates) return;
    if (this.bookingProcess !== 'reservation' && this.bookingProcess !== 'per_game') return;
    const r = this.loadedRates;
    const n = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const payload = {
      withoutLightRate: n(r.withoutLightRate),
      lightRate: n(r.lightRate),
      training2WithoutLightRate: n(r.training2WithoutLightRate),
      training2LightRate: n(r.training2LightRate),
      ballBoyRate: n(r.ballBoyRate),
      reservationWeekdayRate: this.bookingProcess === 'reservation' ? this.courtFeePerHour : n(r.reservationWeekdayRate),
      reservationWeekendRate: this.bookingProcess === 'reservation' ? this.courtFeePerHour : n(r.reservationWeekendRate),
      reservationHolidayRate: this.bookingProcess === 'reservation' ? this.courtFeePerHour : n(r.reservationHolidayRate),
      reservationGuestFee: n(r.reservationGuestFee),
      reservationGuestFeeThreshold: n((r as any).reservationGuestFeeThreshold),
      perGameFee: this.bookingProcess === 'per_game' ? this.courtFeePerHour : n(r.perGameFee),
      perGameGuestFee: n(r.perGameGuestFee),
      exclusiveEventEnabled: !!r.exclusiveEventEnabled,
      exclusiveEventRate: n(r.exclusiveEventRate),
      exclusiveEventIncludedPax: n(r.exclusiveEventIncludedPax),
      exclusiveEventExcessPaxFee: n(r.exclusiveEventExcessPaxFee),
      exclusiveEventMaxPax: n(r.exclusiveEventMaxPax),
      exclusiveEventPolicies: Array.isArray(r.exclusiveEventPolicies) ? r.exclusiveEventPolicies : [],
      rentalBalls50Rate: n(r.rentalBalls50Rate),
      rentalBalls100Rate: n(r.rentalBalls100Rate),
      rentalBallMachineRate: n(r.rentalBallMachineRate),
      rentalRacketRate: n(r.rentalRacketRate),
      coachingEnabled: !!r.coachingEnabled,
      coachingMinHours: n(r.coachingMinHours) || 2,
      coachingMaxPax: n(r.coachingMaxPax) || 6,
      coachingRate1Pax: n(r.coachingRate1Pax),
      coachingRate2Pax: n(r.coachingRate2Pax),
      coachingRate3to6Pax: n(r.coachingRate3to6Pax),
    };
    this.ratesService.updateRates(payload, this.editId).subscribe();
  }
}
