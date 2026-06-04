import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ClubService } from '../../../core/services/club.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-club-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="cf-shell">
      <div class="cf-wrap">

        <div class="cf-header">
          <a [routerLink]="backRoute" class="cf-back">
            <i class="fas fa-arrow-left"></i>
          </a>
          <div class="cf-title-block">
            <p class="cf-kicker"><i class="fas fa-shield-alt"></i> Club Management</p>
            <h2 class="cf-title">{{ editId ? 'Edit Club' : 'New Club' }}</h2>
          </div>
        </div>

        @if (error) {
          <div class="cf-alert cf-alert-error"><i class="fas fa-exclamation-triangle"></i> {{ error }}</div>
        }
        @if (success) {
          <div class="cf-alert cf-alert-success"><i class="fas fa-check-circle"></i> {{ success }}</div>
        }

        <div class="cf-card">
          <form (ngSubmit)="onSubmit()" #f="ngForm">

            <div class="cf-group">
              <label class="cf-label" for="name">Club Name <span class="cf-required">*</span></label>
              <input
                id="name" type="text" class="cf-input" [(ngModel)]="name" name="name"
                required placeholder="e.g. Baseline Tennis Club"
                #nameField="ngModel"
                [class.cf-input-invalid]="nameField.invalid && nameField.touched"
              />
              @if (nameField.invalid && nameField.touched) {
                <span class="cf-field-error"><i class="fas fa-circle-exclamation"></i> Club name is required.</span>
              }
            </div>

            <div class="cf-group">
              <label class="cf-label" for="location">Location <span class="cf-optional">optional</span></label>
              <input
                id="location" type="text" class="cf-input" [(ngModel)]="location" name="location"
                placeholder="e.g. Manila, Philippines"
              />
            </div>

            <div class="cf-group">
              <label class="cf-label" for="mobile">Mobile Number <span class="cf-optional">optional</span></label>
              <input
                id="mobile" type="tel" class="cf-input" [(ngModel)]="mobile" name="mobile"
                placeholder="e.g. 09171234567"
              />
            </div>

            <div class="cf-group">
              <label class="cf-label" for="clubEmail">Email <span class="cf-optional">optional</span></label>
              <input
                id="clubEmail" type="email" class="cf-input" [(ngModel)]="email" name="clubEmail"
                placeholder="e.g. club@example.com"
              />
            </div>

            <div class="cf-group">
              <label class="cf-label" for="description">About the Club <span class="cf-optional">optional</span></label>
              <textarea
                id="description" class="cf-input cf-textarea" [(ngModel)]="description" name="description"
                placeholder="Short description shown on the public booking page…" rows="3"
              ></textarea>
            </div>

            <div class="cf-group">
              <label class="cf-label" for="courtCount">Number of Courts <span class="cf-required">*</span></label>
              <input
                id="courtCount" type="number" class="cf-input" [(ngModel)]="courtCount"
                name="courtCount" required min="1" max="20"
                #courtCountField="ngModel"
                [class.cf-input-invalid]="courtCountField.invalid && courtCountField.touched"
              />
              @if (courtCountField.invalid && courtCountField.touched) {
                <span class="cf-field-error"><i class="fas fa-circle-exclamation"></i> Must be between 1 and 20.</span>
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

            <!-- Logo upload -->
            <div class="cf-group">
              <label class="cf-label">Club Logo <span class="cf-optional">optional</span></label>

              <div
                class="cf-upload-zone"
                [class.cf-upload-zone-has]="logo"
                [class.cf-upload-zone-drag]="isDragging"
                (click)="fileInput.click()"
                (dragover)="$event.preventDefault(); isDragging = true"
                (dragleave)="isDragging = false"
                (drop)="onDrop($event)"
              >
                @if (uploading) {
                  <div class="cf-upload-state">
                    <i class="fas fa-circle-notch fa-spin cf-upload-spinner"></i>
                    <span>Uploading…</span>
                  </div>
                } @else if (logo) {
                  <img [src]="logo" alt="Club logo" class="cf-logo-preview-img" />
                  <div class="cf-upload-overlay">
                    <i class="fas fa-camera"></i> Change
                  </div>
                } @else {
                  <div class="cf-upload-state">
                    <div class="cf-upload-icon"><i class="fas fa-image"></i></div>
                    <span class="cf-upload-hint">Click or drag &amp; drop to upload</span>
                    <span class="cf-upload-sub">PNG, JPG, WebP · max 5 MB</span>
                  </div>
                }
              </div>

              @if (uploadError) {
                <span class="cf-field-error"><i class="fas fa-circle-exclamation"></i> {{ uploadError }}</span>
              }

              @if (logo) {
                <button type="button" class="cf-remove-logo" (click)="removeLogo()">
                  <i class="fas fa-trash"></i> Remove logo
                </button>
              }

              <input
                #fileInput type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                style="display:none"
                (change)="onFileSelected($event)"
              />
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
              <p class="cf-photos-hint">Drag &amp; drop up to 4 images here, or click <strong>+</strong> to browse</p>
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

            <!-- Rating -->
            <div class="cf-group">
              <label class="cf-label">Rating &amp; Reviews <span class="cf-optional">shown on public page</span></label>
              <div class="cf-rating-row">
                <div class="cf-rating-col">
                  <label class="cf-sublabel">Rating (0–5)</label>
                  <input class="cf-input" type="number" [(ngModel)]="rating" name="rating"
                    min="0" max="5" step="0.1" placeholder="e.g. 4.8" />
                </div>
                <div class="cf-rating-col">
                  <label class="cf-sublabel">Review count</label>
                  <input class="cf-input" type="number" [(ngModel)]="reviewCount" name="reviewCount"
                    min="0" placeholder="e.g. 126" />
                </div>
              </div>
            </div>

            <!-- Payment Methods -->
            <div class="cf-group">
              <label class="cf-label">Payment Methods <span class="cf-optional">optional</span></label>
              <div class="cf-pm-list">
                @for (method of availablePaymentMethods; track method) {
                  <div class="cf-pm-row">
                    <label class="cf-pm-check-label">
                      <input
                        type="checkbox"
                        class="cf-pm-checkbox"
                        [checked]="paymentMethods.includes(method)"
                        (change)="togglePaymentMethod(method, $any($event.target).checked)"
                      />
                      <span class="cf-pm-name">{{ method }}</span>
                    </label>
                    @if (paymentMethods.includes(method)) {
                      <input
                        type="text"
                        class="cf-input cf-pm-account-input"
                        [placeholder]="method + ' account / number (optional)'"
                        [value]="paymentAccounts[method] || ''"
                        (input)="setPaymentAccount(method, $any($event.target).value)"
                      />
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
                            <input
                              type="file"
                              accept="image/*"
                              style="display:none"
                              (change)="onQrFileSelected(method, $event)"
                              [disabled]="uploadingQr === method"
                            />
                          </label>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="cf-actions">
              <button type="submit" class="cf-btn-primary" [disabled]="saving || uploading || f.invalid">
                <i class="fas" [class.fa-floppy-disk]="!saving" [class.fa-circle-notch]="saving" [class.fa-spin]="saving"></i>
                {{ saving ? 'Saving…' : (editId ? 'Save Changes' : 'Create Club') }}
              </button>
              <a [routerLink]="backRoute" class="cf-btn-cancel">Cancel</a>
            </div>

          </form>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --dm-bg: #0c1a11;
      --dm-surface: #1b3028;
      --dm-border: rgba(255,255,255,0.1);
      --dm-text: #ffffff;
      --dm-muted: rgba(255,255,255,0.62);
      --dm-accent: #a3e635;
    }

    .cf-shell {
      min-height: calc(100vh - 60px);
      background: var(--dm-bg);
      padding: 1.5rem 1rem 3rem;
    }

    .cf-wrap {
      max-width: 520px;
      margin: 0 auto;
    }

    .cf-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.75rem;
    }

    .cf-back {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--dm-border);
      color: var(--dm-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .cf-back:hover { background: rgba(255,255,255,0.12); color: var(--dm-text); }

    .cf-kicker {
      margin: 0 0 0.15rem;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--dm-accent);
    }

    .cf-title {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--dm-text);
    }

    .cf-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 500;
      margin-bottom: 1rem;
    }
    .cf-alert-error  { background: rgba(244,63,94,0.14);  border: 1px solid rgba(244,63,94,0.3);  color: #fecdd3; }
    .cf-alert-success { background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.28); color: #d9f99d; }

    .cf-card {
      background: var(--dm-surface);
      border: 1px solid var(--dm-border);
      border-radius: 18px;
      padding: 1.75rem 1.5rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.34);
    }

    .cf-group { margin-bottom: 1.25rem; }

    .cf-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.83rem;
      font-weight: 600;
      color: var(--dm-muted);
      margin-bottom: 0.45rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .cf-required { color: var(--dm-accent); font-size: 0.9em; }
    .cf-optional { font-size: 0.78em; font-weight: 400; color: rgba(255,255,255,0.35); text-transform: none; letter-spacing: 0; }

    .cf-input {
      width: 100%;
      padding: 0.65rem 0.85rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--dm-border);
      border-radius: 10px;
      font-size: 0.92rem;
      color: var(--dm-text);
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;
    }
    .cf-input::placeholder { color: rgba(255,255,255,0.28); }
    .cf-input:focus {
      border-color: rgba(163,230,53,0.5);
      box-shadow: 0 0 0 3px rgba(163,230,53,0.1);
    }
    .cf-input-invalid { border-color: rgba(244,63,94,0.5) !important; }
    .cf-input-invalid:focus { box-shadow: 0 0 0 3px rgba(244,63,94,0.1) !important; }

    .cf-field-error {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #fca5a5;
      font-size: 0.78rem;
      margin-top: 0.35rem;
    }

    .cf-hours-row {
      display: flex;
      align-items: flex-end;
      gap: 0.75rem;
    }
    .cf-hours-col { flex: 1; }
    .cf-hours-sep {
      padding-bottom: 0.7rem;
      color: var(--dm-muted);
      font-size: 0.85rem;
      font-weight: 500;
      flex-shrink: 0;
    }
    .cf-sublabel {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: rgba(255,255,255,0.4);
      margin-bottom: 0.3rem;
    }
    select.cf-input { cursor: pointer; }
    select.cf-input option { background: #1e2a1e; color: var(--dm-text); }

    .cf-upload-zone {
      position: relative;
      width: 110px;
      height: 110px;
      border-radius: 14px;
      border: 2px dashed var(--dm-border);
      background: rgba(255,255,255,0.04);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: border-color 0.18s, background 0.18s;
    }
    .cf-upload-zone:hover,
    .cf-upload-zone-drag { border-color: rgba(163,230,53,0.5); background: rgba(163,230,53,0.06); }
    .cf-upload-zone-has { border-style: solid; border-color: rgba(163,230,53,0.3); }

    .cf-upload-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      padding: 0.5rem;
      text-align: center;
    }
    .cf-upload-icon {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.25);
      display: flex; align-items: center; justify-content: center;
      color: var(--dm-accent);
      font-size: 0.9rem;
    }
    .cf-upload-hint { font-size: 0.72rem; color: var(--dm-muted); font-weight: 500; line-height: 1.3; }
    .cf-upload-sub  { font-size: 0.65rem; color: rgba(255,255,255,0.3); }
    .cf-upload-spinner { font-size: 1.4rem; color: var(--dm-accent); }

    .cf-logo-preview-img {
      width: 100%; height: 100%;
      object-fit: cover;
      border-radius: 12px;
    }
    .cf-upload-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: #ffffff;
      opacity: 0;
      border-radius: 12px;
      transition: opacity 0.18s;
    }
    .cf-upload-zone:hover .cf-upload-overlay { opacity: 1; }

    .cf-remove-logo {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: 0.5rem;
      background: none;
      border: none;
      color: rgba(244,63,94,0.7);
      font-size: 0.78rem;
      cursor: pointer;
      font-family: inherit;
      padding: 0;
      transition: color 0.15s;
    }
    .cf-remove-logo:hover { color: #fb7185; }

    .cf-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.75rem;
      flex-wrap: wrap;
    }

    .cf-btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(163,230,53,0.16);
      color: var(--dm-accent);
      border: 1px solid rgba(163,230,53,0.36);
      padding: 0.62rem 1.25rem;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
    }
    .cf-btn-primary:hover:not(:disabled) {
      background: rgba(163,230,53,0.26);
      border-color: rgba(163,230,53,0.52);
    }
    .cf-btn-primary:disabled { opacity: 0.5; cursor: default; }

    .cf-btn-cancel {
      display: inline-flex;
      align-items: center;
      padding: 0.62rem 1.1rem;
      background: rgba(255,255,255,0.05);
      color: var(--dm-muted);
      border: 1px solid var(--dm-border);
      border-radius: 10px;
      font-size: 0.9rem;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .cf-btn-cancel:hover { background: rgba(255,255,255,0.1); color: var(--dm-text); }

    .cf-pm-list { display: flex; flex-direction: column; gap: 0.65rem; }

    .cf-pm-row { display: flex; flex-direction: column; gap: 0.4rem; }

    .cf-pm-check-label {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      cursor: pointer;
      user-select: none;
    }

    .cf-pm-checkbox {
      width: 16px;
      height: 16px;
      accent-color: #a3e635;
      cursor: pointer;
      flex-shrink: 0;
    }

    .cf-pm-name {
      font-size: 0.9rem;
      color: var(--dm-text);
      font-weight: 500;
    }

    .cf-pm-account-input {
      margin-top: 0;
      font-size: 0.85rem;
    }

    .cf-pm-qr-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.4rem;
      flex-wrap: wrap;
    }

    .cf-pm-qr-preview {
      width: 80px;
      height: 80px;
      object-fit: contain;
      border-radius: 8px;
      background: #fff;
      padding: 4px;
      border: 1px solid var(--dm-border);
    }

    .cf-pm-qr-upload {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.42rem 0.85rem;
      background: rgba(163,230,53,0.08);
      border: 1px dashed rgba(163,230,53,0.35);
      border-radius: 8px;
      color: var(--dm-accent);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .cf-pm-qr-upload:hover { background: rgba(163,230,53,0.15); }

    .cf-pm-qr-remove {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: none;
      border: none;
      color: rgba(244,63,94,0.7);
      font-size: 0.78rem;
      cursor: pointer;
      font-family: inherit;
      padding: 0;
      transition: color 0.15s;
    }
    .cf-pm-qr-remove:hover { color: #fb7185; }

    /* Photos grid */
    .cf-textarea { resize: vertical; min-height: 70px; }

    .cf-photos-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-top: 0.5rem;
    }
    .cf-photo-thumb {
      position: relative;
      width: 80px; height: 80px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .cf-photo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cf-photo-remove {
      position: absolute;
      top: 3px; right: 3px;
      width: 20px; height: 20px;
      background: rgba(0,0,0,0.7);
      border: none;
      border-radius: 50%;
      color: #fff;
      font-size: 0.6rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .cf-photo-add {
      width: 80px; height: 80px;
      border-radius: 10px;
      border: 1px dashed rgba(163,230,53,0.3);
      background: rgba(163,230,53,0.04);
      display: flex; align-items: center; justify-content: center;
      color: #a3e635;
      font-size: 1.1rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .cf-photo-add:hover { background: rgba(163,230,53,0.1); }
    .cf-photo-add-uploading { opacity: 0.6; cursor: wait; }
    .cf-photo-add-count { font-size: 0.65rem; color: rgba(163,230,53,0.7); margin-top: 2px; }
    .cf-photos-dragging { outline: 2px dashed #a3e635; outline-offset: 4px; background: rgba(163,230,53,0.04); border-radius: 12px; }
    .cf-photos-hint { font-size: 0.72rem; color: rgba(255,255,255,0.3); margin: 0.4rem 0 0; }

    /* Social links */
    .cf-social-inputs { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.4rem; }
    .cf-social-row { display: flex; align-items: center; gap: 0.5rem; }
    .cf-social-icon {
      width: 34px; height: 34px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.95rem;
      flex-shrink: 0;
    }
    .cf-social-fb { background: rgba(24,119,242,0.15); color: #4a90d9; border: 1px solid rgba(24,119,242,0.25); }
    .cf-social-ig { background: rgba(228,64,95,0.12); color: #e4405f; border: 1px solid rgba(228,64,95,0.2); }
    .cf-social-rc { background: rgba(163,230,53,0.1); color: #a3e635; border: 1px solid rgba(163,230,53,0.2); }

    /* Rating row */
    .cf-rating-row { display: flex; gap: 1rem; }
    .cf-rating-col { flex: 1; }

    @media (max-width: 480px) {
      .cf-card { padding: 1.25rem 1rem; }
      .cf-btn-primary, .cf-btn-cancel { width: 100%; justify-content: center; }
    }
  `],
})
export class ClubFormComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly availablePaymentMethods = ['GCash', 'Cash', 'Bank Transfer', 'GoTyme'];
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
  rating = 0;
  reviewCount = 0;
  uploadingQr: string | null = null;
  uploadingPhoto = false;
  uploadingPhotoCount = 0;
  isDraggingPhotos = false;
  saving = false;
  uploading = false;
  uploadError = '';
  isDragging = false;
  error = '';
  success = '';
  editId: string | null = null;

  constructor(
    private clubService: ClubService,
    private cloudinary: CloudinaryService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
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
          this.courtCount = club.courtCount ?? 2;
          this.openingHour = club.openingHour ?? 5;
          this.closingHour = club.closingHour ?? 22;
          this.paymentMethods = club.paymentMethods ?? [];
          this.paymentAccounts = club.paymentAccounts ?? {};
          this.paymentQrCodes = club.paymentQrCodes ?? {};
          this.description = (club as any).description ?? '';
          this.photos = (club as any).photos ?? [];
          this.socialFacebook = (club as any).socialLinks?.facebook ?? '';
          this.socialInstagram = (club as any).socialLinks?.instagram ?? '';
          this.socialReclub = (club as any).socialLinks?.reclub ?? '';
          this.rating = (club as any).rating ?? 0;
          this.reviewCount = (club as any).reviewCount ?? 0;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Failed to load club data.';
          this.cdr.detectChanges();
        },
      });
    }
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
      courtCount: this.courtCount,
      openingHour: this.openingHour,
      closingHour: this.closingHour,
      paymentMethods: this.paymentMethods,
      paymentAccounts: this.paymentAccounts,
      paymentQrCodes: this.paymentQrCodes,
      description: this.description || undefined,
      photos: this.photos,
      socialLinks,
      rating: this.rating,
      reviewCount: this.reviewCount,
    };
    const request = this.editId
      ? this.clubService.updateClub(this.editId, data)
      : this.clubService.createClub(data);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate([this.auth.isSuperAdmin() ? '/admin/clubs' : '/player/dashboard']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error || 'Failed to save club.';
        this.cdr.detectChanges();
      },
    });
  }
}
