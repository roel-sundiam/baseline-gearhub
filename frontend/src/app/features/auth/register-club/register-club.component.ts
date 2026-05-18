import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';

@Component({
  selector: 'app-register-club',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="court-bg"><div class="court-overlay"></div></div>

      <div class="auth-card">
        <div class="auth-header">
          <div class="header-banner">
            <img src="/CourtGo.png" alt="CourtGo" class="hero-logo" />
          </div>
          <p class="header-sub">Register Your Club</p>
        </div>

        @if (success) {
          <div style="padding: 2rem;">
            <div class="alert alert-success">
              <strong>Club registered!</strong><br />
              You can now log in with your admin credentials and start using the platform with 100 trial coins.
            </div>
            <p class="auth-footer"><a routerLink="/login">Go to Login</a></p>
          </div>
        } @else {
          <form (ngSubmit)="onSubmit()" #f="ngForm">

            <div class="section-label">Club Information</div>

            <div class="form-group">
              <label for="clubName">Club Name *</label>
              <input
                id="clubName"
                type="text"
                [(ngModel)]="clubName"
                name="clubName"
                required
                placeholder="e.g. Baseline Tennis Club"
                #clubNameField="ngModel"
                [class.input-invalid]="clubNameField.invalid && clubNameField.touched"
              />
              @if (clubNameField.invalid && clubNameField.touched) {
                <span class="field-error">Club name is required.</span>
              }
            </div>

            <div class="form-group">
              <label for="location">Location <span class="optional">(optional)</span></label>
              <input
                id="location"
                type="text"
                [(ngModel)]="location"
                name="location"
                placeholder="e.g. Manila, Philippines"
              />
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
                    <input
                      id="clubLogo"
                      type="file"
                      accept="image/*"
                      (change)="onLogoSelected($event)"
                      class="image-input"
                    />
                    <div class="image-placeholder">
                      <span>🏟️</span>
                      <p>Click to upload a logo</p>
                      <small>JPEG, PNG, GIF, WebP • Max 5MB</small>
                    </div>
                  </label>
                }
              </div>
              @if (logoUploadError) {
                <span class="field-error">{{ logoUploadError }}</span>
              }
              @if (uploadingLogo) {
                <span class="field-info">Uploading logo...</span>
              }
              @if (!logo && formSubmitted) {
                <span class="field-error">Club logo is required.</span>
              }
            </div>

            <div class="section-label">Admin Account</div>

            <div class="form-group">
              <label for="adminName">Full Name *</label>
              <input
                id="adminName"
                type="text"
                [(ngModel)]="adminName"
                name="adminName"
                required
                placeholder="Your full name"
                (input)="onAdminNameChange()"
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
                id="adminUsername"
                type="text"
                [(ngModel)]="adminUsername"
                name="adminUsername"
                required
                placeholder="Auto-filled from full name"
                autocomplete="username"
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
                id="adminPassword"
                type="password"
                [(ngModel)]="adminPassword"
                name="adminPassword"
                required
                minlength="6"
                placeholder="Minimum 6 characters"
                autocomplete="new-password"
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
                id="email"
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="admin@yourclub.com"
                email
                #emailField="ngModel"
                [class.input-invalid]="emailField.invalid && emailField.touched"
              />
              @if (emailField.invalid && emailField.touched) {
                <span class="field-error">Please enter a valid email address.</span>
              }
            </div>

            <div class="form-group">
              <label for="contactNumber">Contact Number <span class="optional">(optional)</span></label>
              <input
                id="contactNumber"
                type="tel"
                [(ngModel)]="contactNumber"
                name="contactNumber"
                placeholder="+63 912 345 6789"
              />
            </div>

            @if (errorMsg) {
              <div class="alert alert-error">{{ errorMsg }}</div>
            }

            <button
              type="submit"
              class="btn-primary btn-full"
              [disabled]="loading || uploadingLogo"
              (click)="formSubmitted = true"
            >
              {{ loading ? 'Registering...' : uploadingLogo ? 'Uploading logo...' : 'Register Club' }}
            </button>
          </form>

          <p class="auth-footer">Already have an account? <a routerLink="/login">Sign in</a></p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .auth-container {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 2rem 1rem;
        margin: 0;
        overflow-y: auto;
        background: var(--dm-bg);
      }
      .court-bg { position: absolute; inset: 0; background: none; }
      .court-overlay { position: absolute; inset: 0; background: none; }
      .auth-card {
        position: relative;
        z-index: 1;
        background: var(--dm-surface);
        border-radius: 20px;
        padding: 0;
        width: 100%;
        max-width: 480px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.1);
        border: 1px solid rgba(163,230,53,0.12);
        overflow: visible;
        align-self: flex-start;
      }
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
      input {
        padding: 0.75rem 1rem;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        font-size: 0.95rem;
        background: rgba(255,255,255,0.04);
        color: #ffffff;
        font-family: inherit;
      }
      input::placeholder { color: rgba(255,255,255,0.4); }
      input:focus {
        outline: none;
        border-color: rgba(163,230,53,0.28) !important;
        box-shadow: 0 0 0 3px rgba(163,230,53,0.12) !important;
      }
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
        top: 4px;
        right: 4px;
        background: rgba(0,0,0,0.6);
        color: #fff;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        font-size: 0.75rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
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
      .alert-error {
        background: rgba(239,68,68,0.12);
        color: #fca5a5;
        border: 1px solid rgba(239,68,68,0.2);
      }
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
      .auth-footer a {
        color: var(--dm-accent);
        font-weight: 600;
        text-decoration: none;
        transition: color 0.2s;
      }
      .auth-footer a:hover { color: rgba(163,230,53,0.9); }
      @media (max-width: 600px) {
        .header-banner { padding: 1.5rem 1.5rem 1.25rem; }
        form { padding: 1.25rem 1.5rem; }
        .auth-footer { padding: 0 1.5rem 1.25rem; }
        .auth-container { padding: 1rem; }
      }
    `,
  ],
})
export class RegisterClubComponent {
  private auth = inject(AuthService);
  private cloudinary = inject(CloudinaryService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  clubName = '';
  location = '';
  logo: string | null = null;
  logoPreview: string | null = null;
  uploadingLogo = false;
  logoUploadError = '';

  adminName = '';
  adminUsername = '';
  adminPassword = '';
  email = '';
  contactNumber = '';

  loading = false;
  errorMsg = '';
  success = false;
  formSubmitted = false;

  onAdminNameChange() {
    this.adminUsername = this.adminName.trim().toLowerCase().replace(/\s+/g, '-');
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
    if (!this.clubName || !this.adminName || !this.adminUsername || !this.adminPassword) return;
    if (!this.logo) return;
    this.loading = true;
    this.errorMsg = '';

    this.auth
      .registerClub({
        clubName: this.clubName,
        adminName: this.adminName,
        adminUsername: this.adminUsername,
        adminPassword: this.adminPassword,
        location: this.location || undefined,
        logo: this.logo || undefined,
        email: this.email || undefined,
        contactNumber: this.contactNumber || undefined,
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
