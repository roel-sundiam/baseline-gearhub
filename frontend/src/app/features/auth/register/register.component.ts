import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { ClubService, Club } from '../../../core/services/club.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="court-bg">
        <div class="court-overlay"></div>
      </div>

      <div class="auth-card">
        <div class="auth-header">
          <div class="header-banner">
            <h1>Baseline Gearhub</h1>
          </div>
          <p class="header-sub">Create a Player Account</p>
        </div>

        @if (success) {
          <div class="alert alert-success">
            <strong>Registration successful!</strong><br />
            Your account is pending admin approval. You'll be able to log in once approved.
          </div>
          <p class="auth-footer"><a routerLink="/login">Back to Login</a></p>
        } @else {
          <form (ngSubmit)="onSubmit()" #f="ngForm">
            <div class="form-group">
              <label for="name">Full Name</label>
              <input
                id="name"
                type="text"
                [(ngModel)]="name"
                name="name"
                required
                placeholder="John Smith"
                (input)="onNameChange()"
                #nameField="ngModel"
                [class.input-invalid]="nameField.invalid && nameField.touched"
              />
              @if (nameField.invalid && nameField.touched) {
                <span class="field-error">Full name is required.</span>
              }
            </div>

            <div class="form-group">
              <label for="username">Username</label>
              <input
                id="username"
                type="text"
                [(ngModel)]="username"
                name="username"
                required
                placeholder="Auto-filled from full name"
                autocomplete="username"
                #usernameField="ngModel"
                [class.input-invalid]="usernameField.invalid && usernameField.touched"
              />
              @if (usernameField.invalid && usernameField.touched) {
                <span class="field-error">Username is required.</span>
              }
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input
                id="password"
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                minlength="6"
                placeholder="Minimum 6 characters"
                #passwordField="ngModel"
                [class.input-invalid]="passwordField.invalid && passwordField.touched"
              />
              @if (passwordField.touched) {
                @if (passwordField.errors?.['required']) {
                  <span class="field-error">Password is required.</span>
                } @else if (passwordField.errors?.['minlength']) {
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
                placeholder="you@example.com"
                email
                #emailField="ngModel"
                [class.input-invalid]="emailField.invalid && emailField.touched"
              />
              @if (emailField.invalid && emailField.touched) {
                <span class="field-error">Please enter a valid email address.</span>
              }
            </div>

            <div class="form-group">
              <label for="contact">Contact Number <span class="optional">(optional)</span></label>
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
                  <input type="radio" [(ngModel)]="gender" name="gender" value="Male" required />
                  <span>Male</span>
                </label>
                <label class="gender-option">
                  <input type="radio" [(ngModel)]="gender" name="gender" value="Female" required />
                  <span>Female</span>
                </label>
              </div>
              @if (!gender && f.submitted) {
                <span class="field-error">Please select a gender.</span>
              }
            </div>

            <div class="form-group">
              <label for="profileImage"
                >Profile Picture <span style="color: #dc2626;">(required)</span></label
              >
              <div class="image-upload-section">
                @if (profileImagePreview) {
                  <div class="image-preview">
                    <img [src]="profileImagePreview" alt="Profile preview" />
                    <button type="button" class="btn-remove-image" (click)="removeImage()">
                      ✕
                    </button>
                  </div>
                } @else {
                  <label class="image-input-label">
                    <input
                      id="profileImage"
                      type="file"
                      accept="image/*"
                      (change)="onImageSelected($event)"
                      class="image-input"
                    />
                    <div class="image-placeholder">
                      <span>📸</span>
                      <p>Click to upload a photo</p>
                      <small>JPEG, PNG, GIF, WebP • Max 5MB</small>
                    </div>
                  </label>
                }
              </div>
              @if (imageUploadError) {
                <span class="field-error">{{ imageUploadError }}</span>
              }
              @if (uploadingImage) {
                <span class="field-info">Uploading image...</span>
              }
              @if (!profileImage && f.submitted) {
                <span class="field-error">Profile picture is required.</span>
              }
            </div>

            <div class="form-group">
              <label>Club *</label>
              @if (loadingClubs) {
                <p class="field-info">Loading clubs...</p>
              } @else {
                <div class="club-search-wrap">
                  <div class="club-search-input-row" (click)="openClubDropdown()">
                    @if (selectedClubName) {
                      <span class="club-selected-val">{{ selectedClubName }}</span>
                    } @else {
                      <span class="club-placeholder">Search or select a club...</span>
                    }
                    <i class="fas fa-chevron-down club-caret" [class.open]="showClubDropdown"></i>
                  </div>
                  @if (showClubDropdown) {
                    <div class="club-dropdown">
                      <div class="club-search-box">
                        <i class="fas fa-search club-search-icon"></i>
                        <input
                          type="text"
                          class="club-search-field"
                          placeholder="Search clubs..."
                          [(ngModel)]="clubSearch"
                          name="clubSearchInput"
                          (ngModelChange)="onClubSearch()"
                          (click)="$event.stopPropagation()"
                          #clubSearchInput
                          autofocus
                        />
                      </div>
                      <div class="club-options">
                        @if (filteredClubs.length === 0) {
                          <div class="club-no-results">No clubs found</div>
                        }
                        @for (club of filteredClubs; track club._id) {
                          <button type="button" class="club-option" [class.selected]="clubId === club._id" (click)="selectClub(club)">
                            <span class="club-option-initials">{{ getClubInitials(club.name) }}</span>
                            <span class="club-option-name">{{ club.name }}</span>
                            @if (clubId === club._id) { <i class="fas fa-check club-option-check"></i> }
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
                @if (!clubId && formSubmitted) {
                  <span class="field-error">Please select a club.</span>
                }
              }
            </div>

            @if (errorMsg) {
              <div class="alert alert-error">{{ errorMsg }}</div>
            }

            <button
              type="submit"
              class="btn-primary btn-full"
              [disabled]="loading || uploadingImage || f.invalid || !profileImage || !clubId"
              (click)="formSubmitted = true"
            >
              {{
                loading
                  ? 'Registering...'
                  : uploadingImage
                    ? 'Uploading image...'
                    : 'Create Account'
              }}
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
        align-items: center;
        justify-content: center;
        padding: 1rem;
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
      .auth-card {
        position: relative;
        z-index: 1;
        background: #ffffff;
        border-radius: 20px;
        padding: 0;
        width: 100%;
        max-width: 480px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.55),
          0 0 1px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }
      .auth-header {
        text-align: center;
        margin-bottom: 0;
      }
      .header-banner {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        padding: 2rem 2rem 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .header-banner h1 {
        color: #ffffff;
        font-size: 1.75rem;
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.5px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      .header-sub {
        color: #b88942;
        font-size: 0.9rem;
        font-weight: 600;
        font-style: italic;
        margin: 0.85rem 0 0 0;
        padding: 0.4rem 1.25rem;
        background: #f8f1e4;
        border-top: 3px solid #c9a15d;
        width: 100%;
        box-sizing: border-box;
      }
      form {
        padding: 1.25rem 2rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .form-group label {
        font-size: 0.875rem;
        color: #111827;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .optional {
        color: #999;
        font-size: 0.8rem;
        font-weight: 400;
        text-transform: none;
      }
      .field-error {
        font-size: 0.78rem;
        color: #dc2626;
        font-weight: 500;
        margin-top: 0.15rem;
      }
      .input-invalid {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12) !important;
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
        text-transform: none;
        letter-spacing: 0;
      }
      .gender-option input[type='radio'] {
        accent-color: #b88942;
        width: 1rem;
        height: 1rem;
        cursor: pointer;
      }
      .image-upload-section {
        display: flex;
        justify-content: center;
      }
      .image-input {
        display: none;
      }
      .image-input-label {
        width: 100%;
        cursor: pointer;
      }
      .image-placeholder {
        border: 2px dashed #c9a15d;
        border-radius: 10px;
        padding: 2rem;
        text-align: center;
        background: #f9faf9;
        transition: all 0.3s;
      }
      .image-input-label:hover .image-placeholder {
        background: #f8f1e4;
        border-color: #9f7338;
      }
      .image-placeholder span {
        font-size: 2.5rem;
        display: block;
        margin-bottom: 0.5rem;
      }
      .image-placeholder p {
        color: #111827;
        font-weight: 600;
        margin: 0.5rem 0;
        font-size: 0.95rem;
      }
      .image-placeholder small {
        color: #6b7280;
        font-size: 0.8rem;
        display: block;
        margin-top: 0.35rem;
      }
      .image-preview {
        position: relative;
        display: inline-block;
      }
      .image-preview img {
        width: 120px;
        height: 120px;
        border-radius: 10px;
        object-fit: cover;
        border: 3px solid #c9a15d;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .btn-remove-image {
        position: absolute;
        top: -10px;
        right: -10px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #dc2626;
        color: white;
        border: none;
        font-weight: bold;
        cursor: pointer;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
      }
      .btn-remove-image:hover {
        background: #b91c1c;
        transform: scale(1.1);
      }
      .field-info {
        font-size: 0.78rem;
        color: #059669;
        font-weight: 500;
        margin-top: 0.35rem;
        display: block;
      }
      input:focus {
        outline: none;
        border-color: #c9a15d !important;
        box-shadow: 0 0 0 3px rgba(201, 161, 93, 0.15) !important;
      }
      .btn-primary {
        margin-top: 0.75rem;
        border-radius: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: #b88942;
        border-color: #b88942;
        box-shadow: 0 4px 12px rgba(184, 137, 66, 0.35);
      }
      .btn-primary:hover:not(:disabled) {
        background: #9f7338;
        border-color: #9f7338;
        box-shadow: 0 6px 16px rgba(184, 137, 66, 0.45);
      }
      .btn-primary:disabled {
        background: #9ca3af;
        border-color: #9ca3af;
        box-shadow: none;
        cursor: not-allowed;
        opacity: 1;
      }
      .club-search-wrap { position: relative; }
      .club-search-input-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.55rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px;
        background: #fff; cursor: pointer; min-height: 42px; transition: border-color 0.2s;
      }
      .club-search-input-row:hover { border-color: #c9a15d; }
      .club-selected-val { font-size: 0.95rem; color: #111827; font-weight: 500; }
      .club-placeholder { font-size: 0.95rem; color: #9ca3af; }
      .club-caret { color: #9ca3af; font-size: 0.75rem; transition: transform 0.2s; }
      .club-caret.open { transform: rotate(180deg); }
      .club-dropdown {
        position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
        background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden;
      }
      .club-search-box {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; border-bottom: 1px solid #f0f0f0; background: #fafafa;
      }
      .club-search-icon { color: #9ca3af; font-size: 0.8rem; flex-shrink: 0; }
      .club-search-field {
        flex: 1; border: none; outline: none; font-size: 0.875rem;
        background: transparent; color: #111827;
      }
      .club-options { max-height: 200px; overflow-y: auto; }
      .club-option {
        width: 100%; display: flex; align-items: center; gap: 10px;
        padding: 9px 12px; border: none; background: transparent;
        cursor: pointer; text-align: left; font-family: inherit; transition: background 0.12s;
      }
      .club-option:hover { background: #f8f1e4; }
      .club-option.selected { background: #fdf6ea; }
      .club-option-initials {
        width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
        background: linear-gradient(135deg, #c9a15d, #9f7338);
        color: #fff; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
        display: flex; align-items: center; justify-content: center;
      }
      .club-option-name { flex: 1; font-size: 0.875rem; color: #111827; font-weight: 500; }
      .club-option-check { color: #9f7338; font-size: 0.75rem; }
      .club-no-results { padding: 16px; text-align: center; font-size: 0.85rem; color: #9ca3af; }

      .auth-footer {
        text-align: center;
        padding: 0 2rem 1.5rem;
        font-size: 0.9rem;
        color: #6b7280;
      }
      .auth-footer a {
        color: #b88942;
        font-weight: 600;
        text-decoration: none;
      }
      .auth-footer a:hover {
        color: #9f7338;
      }
      .alert-success {
        margin: 1.5rem 2rem 0;
        padding: 1rem;
        background: #f8f1e4;
        border: 1px solid #c9a15d;
        border-radius: 8px;
        color: #9f7338;
        font-size: 0.9rem;
      }
      @media (max-width: 600px) {
        .header-banner {
          padding: 1.5rem 1.5rem 1.25rem;
        }
        .header-banner h1 {
          font-size: 1.5rem;
        }
        form {
          padding: 1rem 1.5rem;
        }
        .auth-footer {
          padding: 0 1.5rem 1.25rem;
        }
      }
    `,
  ],
})
export class RegisterComponent implements OnInit, OnDestroy {
  name = '';
  username = '';
  email = '';
  password = '';
  contactNumber = '';
  gender = '';
  clubId = '';
  clubs: Club[] = [];
  filteredClubs: Club[] = [];
  loadingClubs = true;
  loading = false;
  errorMsg = '';
  success = false;
  profileImage: string | null = null;
  profileImagePreview: string | null = null;
  uploadingImage = false;
  imageUploadError = '';
  formSubmitted = false;
  clubSearch = '';
  showClubDropdown = false;
  selectedClubName = '';

  constructor(
    private auth: AuthService,
    private cloudinary: CloudinaryService,
    private cdr: ChangeDetectorRef,
    private clubService: ClubService,
  ) {}

  ngOnInit() {
    this.clubService.getClubs().subscribe({
      next: (clubs) => {
        this.clubs = clubs;
        this.filteredClubs = clubs;
        this.loadingClubs = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingClubs = false;
        this.cdr.detectChanges();
      },
    });
    document.addEventListener('click', this.onDocClick);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.onDocClick);
  }

  private onDocClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.club-search-wrap')) {
      this.showClubDropdown = false;
      this.cdr.detectChanges();
    }
  };

  openClubDropdown() {
    this.showClubDropdown = true;
    this.clubSearch = '';
    this.filteredClubs = this.clubs;
  }

  onClubSearch() {
    const q = this.clubSearch.trim().toLowerCase();
    this.filteredClubs = q ? this.clubs.filter(c => c.name.toLowerCase().includes(q)) : this.clubs;
  }

  selectClub(club: Club) {
    this.clubId = club._id;
    this.selectedClubName = club.name;
    this.showClubDropdown = false;
    this.clubSearch = '';
    this.filteredClubs = this.clubs;
  }

  getClubInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  onNameChange() {
    this.username = this.name.trim().toLowerCase().replace(/\s+/g, '-');
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate image
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
      .catch((err) => {
        this.imageUploadError = 'Image upload failed. Please try again.';
        this.uploadingImage = false;
        this.profileImagePreview = null;
        this.cdr.detectChanges();
      });
  }

  removeImage() {
    this.profileImage = null;
    this.profileImagePreview = null;
    this.imageUploadError = '';
    const fileInput = document.getElementById('profileImage') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    this.cdr.detectChanges();
  }

  onSubmit() {
    if (!this.name || !this.username || !this.password) return;
    if (!this.profileImage) {
      this.errorMsg = 'Profile picture is required. Please upload an image.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.clubId) {
      this.errorMsg = 'Please select a club.';
      this.cdr.detectChanges();
      return;
    }
    this.loading = true;
    this.errorMsg = '';

    this.auth
      .register({
        name: this.name,
        username: this.username,
        email: this.email || undefined,
        password: this.password,
        contactNumber: this.contactNumber || undefined,
        gender: this.gender || undefined,
        profileImage: this.profileImage,
        clubId: this.clubId,
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

