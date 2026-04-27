import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UsersService } from '../../../core/services/users.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-container">
      <div class="court-bg">
        <div class="court-overlay"></div>
      </div>

      <div class="profile-card">
        <div class="profile-header">
          <h1>Edit Profile</h1>
          <button type="button" class="btn-back" (click)="goBack()">
            <i class="fas fa-arrow-left"></i> Back
          </button>
        </div>

        @if (loading) {
          <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i> Loading profile...
          </div>
        } @else {
          <form (ngSubmit)="onSubmit()" #f="ngForm">
            <!-- Profile Picture Section -->
            <div class="form-section">
              <h3>Profile Picture</h3>
              <div class="avatar-section">
                @if (profileImagePreview || profileImage) {
                  <div class="avatar-display">
                    <img [src]="profileImagePreview || profileImage" alt="Profile" />
                    <button type="button" class="btn-change-image" (click)="triggerImageUpload()">
                      <i class="fas fa-camera"></i> Change
                    </button>
                  </div>
                } @else {
                  <div class="avatar-placeholder">
                    <span>{{ getInitials() }}</span>
                    <button type="button" class="btn-upload-image" (click)="triggerImageUpload()">
                      <i class="fas fa-upload"></i> Upload Photo
                    </button>
                  </div>
                }
                <input
                  #imageInput
                  type="file"
                  accept="image/*"
                  (change)="onImageSelected($event)"
                  class="image-input-hidden"
                />
              </div>
              @if (imageUploadError) {
                <span class="field-error">{{ imageUploadError }}</span>
              }
              @if (uploadingImage) {
                <span class="field-info">
                  <i class="fas fa-spinner fa-spin"></i> Uploading image...
                </span>
              }
            </div>

            <!-- Personal Info Section -->
            <div class="form-section">
              <h3>Personal Information</h3>

              <div class="form-group">
                <label for="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  [(ngModel)]="name"
                  name="name"
                  required
                  #nameField="ngModel"
                  [class.input-invalid]="nameField.invalid && nameField.touched"
                />
                @if (nameField.invalid && nameField.touched) {
                  <span class="field-error">Full name is required.</span>
                }
              </div>

              <div class="form-group">
                <label for="email">Email</label>
                <input id="email" type="email" [(ngModel)]="email" name="email" email disabled />
                <small class="text-muted">Cannot be changed</small>
              </div>

              <div class="form-group">
                <label for="contact">Contact Number</label>
                <input
                  id="contact"
                  type="tel"
                  [(ngModel)]="contactNumber"
                  name="contactNumber"
                  placeholder="+1 555 000 0000"
                />
              </div>

              <div class="form-group">
                <label>Gender</label>
                <div class="gender-group">
                  <label class="gender-option">
                    <input type="radio" [(ngModel)]="gender" name="gender" value="Male" />
                    <span>Male</span>
                  </label>
                  <label class="gender-option">
                    <input type="radio" [(ngModel)]="gender" name="gender" value="Female" />
                    <span>Female</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Change Password Section -->
            <div class="form-section">
              <h3>Change Password</h3>

              <div class="form-group">
                <label for="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  [(ngModel)]="currentPassword"
                  name="currentPassword"
                  placeholder="Enter your current password"
                  #currentPasswordField="ngModel"
                />
              </div>

              <div class="form-group">
                <label for="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  [(ngModel)]="newPassword"
                  name="newPassword"
                  placeholder="Enter new password (min 6 characters)"
                  minlength="6"
                  #newPasswordField="ngModel"
                  [class.input-invalid]="newPasswordField.invalid && newPasswordField.touched"
                />
                @if (newPasswordField.touched) {
                  @if (newPasswordField.errors?.['minlength']) {
                    <span class="field-error">Password must be at least 6 characters.</span>
                  }
                }
              </div>

              <div class="form-group">
                <label for="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  #confirmPasswordField="ngModel"
                  [class.input-invalid]="passwordMismatch && confirmPasswordField.touched"
                />
                @if (passwordMismatch && confirmPasswordField.touched) {
                  <span class="field-error">Passwords do not match.</span>
                }
              </div>

              <small class="text-muted">Leave blank to keep your current password</small>
            </div>

            @if (errorMsg) {
              <div class="alert alert-error">{{ errorMsg }}</div>
            }
            @if (successMsg) {
              <div class="alert alert-success">{{ successMsg }}</div>
            }

            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="goBack()">Cancel</button>
              <button type="submit" class="btn-save" [disabled]="submitting || f.invalid">
                {{ submitting ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .profile-container {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
        margin: 0;
        overflow: hidden;
      }
      .court-bg {
        position: absolute;
        inset: 0;
        background: url('/tennis-court-surface.png') center center / cover no-repeat;
      }
      .court-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 18, 0, 0.35);
      }
      .profile-card {
        position: relative;
        z-index: 1;
        background: #ffffff;
        border-radius: 20px;
        padding: 2rem;
        width: 100%;
        max-width: 600px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .profile-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #f8f1e4;
      }
      .profile-header h1 {
        font-size: 1.75rem;
        color: #111827;
        margin: 0;
        font-weight: 700;
      }
      .btn-back {
        background: #e5e7eb;
        color: #374151;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .btn-back:hover {
        background: #d1d5db;
      }
      .loading-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 3rem;
        color: #b88942;
        font-size: 1.1rem;
        font-weight: 600;
      }
      .form-section {
        margin-bottom: 2rem;
      }
      .form-section h3 {
        color: #1f2937;
        font-size: 1rem;
        font-weight: 700;
        margin-bottom: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .avatar-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      .avatar-display {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }
      .avatar-display img {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        object-fit: cover;
        border: 4px solid #c9a15d;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .avatar-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 2rem;
        background: #f9faf9;
        border: 2px dashed #c9a15d;
        border-radius: 12px;
        width: 150px;
        height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-placeholder span {
        font-size: 3rem;
        font-weight: 700;
        color: #b88942;
      }
      .btn-change-image,
      .btn-upload-image {
        background: #b88942;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
      }
      .btn-change-image:hover,
      .btn-upload-image:hover {
        background: #9f7338;
      }
      .image-input-hidden {
        display: none;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
      }
      .form-group label {
        font-size: 0.9rem;
        color: #111827;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .form-group input {
        padding: 0.75rem 1rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 1rem;
        transition: all 0.2s;
      }
      .form-group input:focus {
        outline: none;
        border-color: #c9a15d;
        box-shadow: 0 0 0 3px rgba(201, 161, 93, 0.15);
      }
      .form-group input:disabled {
        background: #f3f4f6;
        color: #9ca3af;
        cursor: not-allowed;
      }
      .input-invalid {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12) !important;
      }
      .text-muted {
        font-size: 0.8rem;
        color: #6b7280;
        font-weight: 400;
      }
      .gender-group {
        display: flex;
        gap: 1rem;
      }
      .gender-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.95rem;
        color: #111827;
        font-weight: 500;
      }
      .gender-option input[type='radio'] {
        accent-color: #b88942;
        width: 1rem;
        height: 1rem;
        cursor: pointer;
      }
      .field-error {
        font-size: 0.78rem;
        color: #dc2626;
        font-weight: 500;
        margin-top: 0.15rem;
      }
      .field-info {
        font-size: 0.78rem;
        color: #059669;
        font-weight: 500;
        margin-top: 0.35rem;
        display: block;
      }
      .alert-error {
        padding: 1rem;
        background: #fee2e2;
        border: 1px solid #fca5a5;
        border-radius: 8px;
        color: #991b1b;
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }
      .alert-success {
        padding: 1rem;
        background: #f8f1e4;
        border: 1px solid #c9a15d;
        border-radius: 8px;
        color: #9f7338;
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }
      .form-actions {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
      }
      .btn-cancel,
      .btn-save {
        flex: 1;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-cancel {
        background: #e5e7eb;
        color: #374151;
      }
      .btn-cancel:hover {
        background: #d1d5db;
      }
      .btn-save {
        background: #b88942;
        color: white;
      }
      .btn-save:hover:not(:disabled) {
        background: #9f7338;
      }
      .btn-save:disabled {
        background: #9ca3af;
        cursor: not-allowed;
        opacity: 0.7;
      }

      @media (max-width: 600px) {
        .profile-card {
          padding: 1.5rem;
        }
        .profile-header {
          flex-direction: column;
          gap: 1rem;
          align-items: flex-start;
        }
        .profile-header h1 {
          font-size: 1.5rem;
        }
        .form-actions {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ProfileEditComponent implements OnInit {
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
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadUserProfile();
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
    const fileInput = document.querySelector('.image-input-hidden') as HTMLInputElement;
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

    // Show preview
    const reader = new FileReader();
    reader.onload = () => {
      this.profileImagePreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    this.uploadingImage = true;
    this.imageUploadError = '';
    this.cdr.detectChanges();

    this.cloudinary
      .uploadImage(file)
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
    return parts
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  onSubmit() {
    if (!this.name) return;

    // Validate password if provided
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

    // First, update profile info
    this.users
      .updateProfile(user.id, {
        name: this.name,
        contactNumber: this.contactNumber || undefined,
        gender: this.gender || undefined,
        profileImage: this.profileImage || undefined,
      })
      .subscribe({
        next: () => {
          // If password change is requested, update password
          if (this.newPassword) {
            this.users
              .changePassword(user.id, {
                currentPassword: this.currentPassword,
                newPassword: this.newPassword,
              })
              .subscribe({
                next: () => {
                  this.submitting = false;
                  this.successMsg = 'Profile and password updated successfully!';
                  this.clearPasswordFields();
                  this.cdr.detectChanges();
                  setTimeout(() => this.router.navigate(['/player/dashboard']), 1500);
                },
                error: (err) => {
                  this.submitting = false;
                  this.errorMsg =
                    err.error?.error || 'Failed to update password. Please try again.';
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

