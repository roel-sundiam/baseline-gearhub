import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UsersService } from '../../../core/services/users.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { CoinsService } from '../../../core/services/coins.service';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dm-shell">
      <!-- Mobile header -->
      <header class="dm-header">
        <button class="dm-back-btn" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">Edit Profile</span>
        <div style="width:34px"></div>
      </header>

      <div class="dm-body">
        @if (loading) {
          <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading profile…</div>
        } @else {
          <form (ngSubmit)="onSubmit()" #f="ngForm">

            <!-- Avatar section -->
            <div class="dm-section">
              <div class="dm-section-label">Profile Picture</div>
              <div class="dm-avatar-section">
                <div class="dm-avatar-wrap">
                  @if (profileImagePreview || profileImage) {
                    <img [src]="profileImagePreview || profileImage" alt="Profile" class="dm-avatar-img" />
                  } @else {
                    <span class="dm-avatar-initials">{{ getInitials() }}</span>
                  }
                </div>
                <div class="dm-avatar-actions">
                  <button type="button" class="dm-upload-btn" (click)="triggerImageUpload()">
                    <i class="fas fa-camera"></i>
                    {{ (profileImagePreview || profileImage) ? 'Change Photo' : 'Upload Photo' }}
                  </button>
                  @if (uploadingImage) {
                    <span class="dm-upload-status"><i class="fas fa-circle-notch fa-spin"></i> Uploading…</span>
                  }
                  @if (imageUploadError) {
                    <span class="dm-field-error">{{ imageUploadError }}</span>
                  }
                </div>
              </div>
              <input #imageInput type="file" accept="image/*" (change)="onImageSelected($event)" class="dm-hidden-input" />
            </div>

            <!-- Personal info -->
            <div class="dm-section">
              <div class="dm-section-label">Personal Information</div>
              <div class="dm-card">

                <div class="dm-form-group">
                  <label class="dm-form-label">Full Name</label>
                  <input
                    class="dm-input"
                    id="name"
                    type="text"
                    [(ngModel)]="name"
                    name="name"
                    required
                    #nameField="ngModel"
                    [class.dm-input-invalid]="nameField.invalid && nameField.touched"
                    placeholder="Your full name"
                  />
                  @if (nameField.invalid && nameField.touched) {
                    <span class="dm-field-error">Full name is required.</span>
                  }
                </div>

                <div class="dm-divider"></div>

                <div class="dm-form-group">
                  <label class="dm-form-label">Email <span class="dm-form-hint">Cannot be changed</span></label>
                  <input class="dm-input dm-input-disabled" id="email" type="email" [(ngModel)]="email" name="email" email disabled />
                </div>

                <div class="dm-divider"></div>

                <div class="dm-form-group">
                  <label class="dm-form-label">Contact Number <span class="dm-form-hint">Optional</span></label>
                  <input
                    class="dm-input"
                    id="contact"
                    type="tel"
                    [(ngModel)]="contactNumber"
                    name="contactNumber"
                    placeholder="+1 555 000 0000"
                  />
                </div>

                <div class="dm-divider"></div>

                <div class="dm-form-group">
                  <label class="dm-form-label">Gender</label>
                  <div class="dm-gender-group">
                    <label class="dm-gender-option" [class.selected]="gender === 'Male'">
                      <input type="radio" [(ngModel)]="gender" name="gender" value="Male" />
                      <span>Male</span>
                    </label>
                    <label class="dm-gender-option" [class.selected]="gender === 'Female'">
                      <input type="radio" [(ngModel)]="gender" name="gender" value="Female" />
                      <span>Female</span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            <!-- Password change -->
            <div class="dm-section">
              <div class="dm-section-label">Change Password <span class="dm-section-hint">Leave blank to keep current</span></div>
              <div class="dm-card">

                <div class="dm-form-group">
                  <label class="dm-form-label">Current Password</label>
                  <input
                    class="dm-input"
                    id="currentPassword"
                    type="password"
                    [(ngModel)]="currentPassword"
                    name="currentPassword"
                    placeholder="Enter current password"
                  />
                </div>

                <div class="dm-divider"></div>

                <div class="dm-form-group">
                  <label class="dm-form-label">New Password</label>
                  <input
                    class="dm-input"
                    id="newPassword"
                    type="password"
                    [(ngModel)]="newPassword"
                    name="newPassword"
                    placeholder="Min 6 characters"
                    minlength="6"
                    #newPasswordField="ngModel"
                    [class.dm-input-invalid]="newPasswordField.invalid && newPasswordField.touched"
                  />
                  @if (newPasswordField.touched && newPasswordField.errors?.['minlength']) {
                    <span class="dm-field-error">Password must be at least 6 characters.</span>
                  }
                </div>

                <div class="dm-divider"></div>

                <div class="dm-form-group">
                  <label class="dm-form-label">Confirm New Password</label>
                  <input
                    class="dm-input"
                    id="confirmPassword"
                    type="password"
                    [(ngModel)]="confirmPassword"
                    name="confirmPassword"
                    placeholder="Confirm new password"
                    #confirmPasswordField="ngModel"
                    [class.dm-input-invalid]="passwordMismatch && confirmPasswordField.touched"
                  />
                  @if (passwordMismatch && confirmPasswordField.touched) {
                    <span class="dm-field-error">Passwords do not match.</span>
                  }
                </div>

              </div>
            </div>

            @if (errorMsg) {
              <div class="dm-alert dm-alert-error">{{ errorMsg }}</div>
            }
            @if (successMsg) {
              <div class="dm-alert dm-alert-success"><i class="fas fa-check-circle"></i> {{ successMsg }}</div>
            }

            <!-- Actions -->
            <div class="dm-form-actions">
              <button type="button" class="dm-btn-cancel" (click)="navigateTo('/player/dashboard')">Cancel</button>
              <button type="submit" class="dm-btn-save" [disabled]="submitting || f.invalid">
                @if (submitting) { <i class="fas fa-circle-notch fa-spin"></i> Saving… }
                @else { Save Changes }
              </button>
            </div>

          </form>
        }
        <div class="dm-bottom-spacer"></div>
      </div>

      <!-- Bottom Nav -->
      <nav class="dm-bottom-nav">
        <button class="dm-nav-item" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-home"></i><span>Home</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reserve')">
          <i class="fas fa-table-tennis"></i><span>Courts</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/reservations')">
          <i class="far fa-calendar-check"></i><span>Bookings</span>
        </button>
        <button class="dm-nav-item" (click)="navigateTo('/player/tournaments')">
          <i class="fas fa-medal"></i><span>Rankings</span>
        </button>
        <button class="dm-nav-item dm-nav-active" (click)="navigateTo('/player/profile/edit')">
          <i class="far fa-user"></i><span>Profile</span>
        </button>
      </nav>
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

    .dm-shell {
      background: #0c1a11;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      max-width: 480px;
      margin: 0 auto;
      position: relative;
    }
    @media (min-width: 769px) {
      .dm-shell {
        max-width: 640px;
        height: auto;
        min-height: calc(100vh - 60px);
      }
    }

    /* Header */
    .dm-header {
      background: #111f16;
      padding: 1rem 1rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    @media (min-width: 769px) { .dm-header { display: none; } }

    .dm-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      color: rgba(255,255,255,0.7);
      width: 34px; height: 34px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dm-back-btn:hover { background: rgba(255,255,255,0.14); }

    .dm-header-title {
      flex: 1;
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }

    /* Body */
    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.1rem 1rem 0;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 769px) {
      .dm-body {
        overflow-y: visible;
        padding: 2rem 2.5rem 2rem;
      }
    }

    .dm-state-msg {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.40);
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    /* Sections */
    .dm-section {
      margin-bottom: 1.1rem;
    }

    .dm-section-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: rgba(255,255,255,0.40);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dm-section-hint {
      font-size: 0.68rem;
      font-weight: 500;
      color: rgba(255,255,255,0.28);
      text-transform: none;
      letter-spacing: 0;
    }

    /* Avatar */
    .dm-avatar-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #1b3028;
      border-radius: 12px;
      padding: 1rem;
    }

    .dm-avatar-wrap {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(163,230,53,0.15);
      border: 2px solid rgba(163,230,53,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .dm-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .dm-avatar-initials {
      font-size: 1.5rem;
      font-weight: 800;
      color: #a3e635;
      text-transform: uppercase;
    }

    .dm-avatar-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dm-upload-btn {
      background: rgba(163,230,53,0.15);
      color: #a3e635;
      border: 1px solid rgba(163,230,53,0.3);
      border-radius: 20px;
      padding: 0.4rem 1rem;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: background 0.2s;
      font-family: inherit;
    }
    .dm-upload-btn:hover { background: rgba(163,230,53,0.25); }

    .dm-upload-status {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.55);
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .dm-hidden-input { display: none; }

    /* Card */
    .dm-card {
      background: #1b3028;
      border-radius: 12px;
      overflow: hidden;
    }

    .dm-divider {
      height: 1px;
      background: rgba(255,255,255,0.07);
    }

    /* Form groups */
    .dm-form-group {
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dm-form-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: rgba(255,255,255,0.50);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dm-form-hint {
      font-size: 0.65rem;
      font-weight: 500;
      color: rgba(255,255,255,0.28);
      text-transform: none;
      letter-spacing: 0;
    }

    .dm-input {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 0.65rem 0.9rem;
      color: #ffffff;
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
      width: 100%;
      box-sizing: border-box;
    }

    .dm-input:focus { border-color: rgba(163,230,53,0.5); }
    .dm-input::placeholder { color: rgba(255,255,255,0.25); }

    .dm-input-disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .dm-input-invalid { border-color: rgba(239,68,68,0.5) !important; }

    .dm-field-error {
      font-size: 0.72rem;
      color: #ef4444;
      font-weight: 500;
    }

    .dm-gender-group {
      display: flex;
      gap: 0.75rem;
    }

    .dm-gender-option {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 600;
      color: rgba(255,255,255,0.55);
      transition: all 0.2s;
    }

    .dm-gender-option input { display: none; }

    .dm-gender-option.selected {
      border-color: rgba(163,230,53,0.4);
      background: rgba(163,230,53,0.1);
      color: #a3e635;
    }

    /* Alerts */
    .dm-alert {
      padding: 0.85rem 1rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dm-alert-error {
      background: rgba(239,68,68,0.15);
      border: 1px solid rgba(239,68,68,0.25);
      color: #ef4444;
    }

    .dm-alert-success {
      background: rgba(163,230,53,0.12);
      border: 1px solid rgba(163,230,53,0.25);
      color: #a3e635;
    }

    /* Actions */
    .dm-form-actions {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.1rem;
    }

    .dm-btn-cancel {
      flex: 1;
      padding: 0.75rem;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.65);
      border: none;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s;
    }
    .dm-btn-cancel:hover { background: rgba(255,255,255,0.13); }

    .dm-btn-save {
      flex: 2;
      padding: 0.75rem;
      background: #a3e635;
      color: #0a1f00;
      border: none;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }
    .dm-btn-save:hover:not(:disabled) { background: #b8f040; }
    .dm-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

    .dm-bottom-spacer { height: 80px; }
    @media (min-width: 769px) { .dm-bottom-spacer { display: none; } }

    /* Bottom nav */
    .dm-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: #111f16;
      border-top: 1px solid rgba(255,255,255,0.08);
      height: 62px;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: space-around;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }
    @media (min-width: 769px) { .dm-bottom-nav { display: none; } }

    .dm-nav-item {
      background: none;
      border: none;
      color: rgba(255,255,255,0.35);
      font-size: 0.6rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.4rem 0.75rem;
      transition: color 0.2s;
      font-family: inherit;
    }
    .dm-nav-item i { font-size: 1.1rem; }
    .dm-nav-item.dm-nav-active { color: #a3e635; }
  `],
})
export class ProfileEditComponent implements OnInit, OnDestroy {
  name = '';
  email = '';
  contactNumber = '';
  gender = '';
  profileImage: string | null = null;
  profileImagePreview: string | null = null;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  loading = false;
  submitting = false;
  uploadingImage = false;
  imageUploadError = '';
  errorMsg = '';
  successMsg = '';

  get passwordMismatch(): boolean {
    if (!this.newPassword || !this.confirmPassword) return false;
    return this.newPassword !== this.confirmPassword;
  }

  constructor(
    private auth: AuthService,
    private users: UsersService,
    private cloudinary: CloudinaryService,
    private coinsService: CoinsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.coinsService.trackVisit('profile-edit').subscribe({ error: () => {} });
    this.loadUserProfile();
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  loadUserProfile() {
    const user = this.auth.user();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.loading = true;
    this.users.getUserProfile(user.id).subscribe({
      next: (profile) => {
        this.name = profile.name;
        this.email = profile.email || '';
        this.contactNumber = profile.contactNumber || '';
        this.gender = profile.gender || '';
        this.profileImage = profile.profileImage || null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Failed to load profile. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  triggerImageUpload() {
    const fileInput = document.querySelector('.dm-hidden-input') as HTMLInputElement;
    fileInput?.click();
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const error = this.cloudinary.validateImage(file);
    if (error) {
      this.imageUploadError = error;
      this.cdr.detectChanges();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.profileImagePreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
    this.uploadingImage = true;
    this.imageUploadError = '';
    this.cdr.detectChanges();
    this.cloudinary.uploadImage(file)
      .then((url) => {
        this.profileImage = url;
        this.uploadingImage = false;
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.imageUploadError = 'Image upload failed. Please try again.';
        this.uploadingImage = false;
        this.profileImagePreview = null;
        this.cdr.detectChanges();
      });
  }

  getInitials(): string {
    const parts = this.name.split(' ');
    return parts.map((p) => p.charAt(0).toUpperCase()).slice(0, 2).join('');
  }

  onSubmit() {
    if (!this.name) return;
    if (this.newPassword) {
      if (!this.currentPassword) {
        this.errorMsg = 'Please enter your current password to change it.';
        this.cdr.detectChanges();
        return;
      }
      if (this.newPassword !== this.confirmPassword) {
        this.errorMsg = 'New passwords do not match.';
        this.cdr.detectChanges();
        return;
      }
      if (this.newPassword.length < 6) {
        this.errorMsg = 'New password must be at least 6 characters.';
        this.cdr.detectChanges();
        return;
      }
    }
    this.submitting = true;
    this.errorMsg = '';
    this.successMsg = '';
    const user = this.auth.user();
    if (!user) return;
    this.users.updateProfile(user.id, {
      name: this.name,
      contactNumber: this.contactNumber || undefined,
      gender: this.gender || undefined,
      profileImage: this.profileImage || undefined,
    }).subscribe({
      next: () => {
        if (this.newPassword) {
          this.users.changePassword(user.id, {
            currentPassword: this.currentPassword,
            newPassword: this.newPassword,
          }).subscribe({
            next: () => {
              this.submitting = false;
              this.successMsg = 'Profile and password updated successfully!';
              this.clearPasswordFields();
              this.cdr.detectChanges();
              setTimeout(() => this.router.navigate(['/player/dashboard']), 1500);
            },
            error: (err) => {
              this.submitting = false;
              this.errorMsg = err.error?.error || 'Failed to update password. Please try again.';
              this.cdr.detectChanges();
            },
          });
        } else {
          this.submitting = false;
          this.successMsg = 'Profile updated successfully!';
          this.cdr.detectChanges();
          setTimeout(() => this.router.navigate(['/player/dashboard']), 1500);
        }
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg = err.error?.error || 'Failed to update profile. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  clearPasswordFields() {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
