import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ClubService } from '../../../core/services/club.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';

@Component({
  selector: 'app-club-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="cf-shell">
      <div class="cf-wrap">

        <div class="cf-header">
          <a routerLink="/admin/clubs" class="cf-back">
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

            <div class="cf-actions">
              <button type="submit" class="cf-btn-primary" [disabled]="saving || uploading || f.invalid">
                <i class="fas" [class.fa-floppy-disk]="!saving" [class.fa-circle-notch]="saving" [class.fa-spin]="saving"></i>
                {{ saving ? 'Saving…' : (editId ? 'Save Changes' : 'Create Club') }}
              </button>
              <a routerLink="/admin/clubs" class="cf-btn-cancel">Cancel</a>
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

    @media (max-width: 480px) {
      .cf-card { padding: 1.25rem 1rem; }
      .cf-btn-primary, .cf-btn-cancel { width: 100%; justify-content: center; }
    }
  `],
})
export class ClubFormComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  name = '';
  location = '';
  logo = '';
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
  ) {}

  ngOnInit() {
    this.editId = this.route.snapshot.paramMap.get('id');
    if (this.editId) {
      this.clubService.getClub(this.editId).subscribe({
        next: (club) => {
          this.name = club.name;
          this.location = club.location ?? '';
          this.logo = club.logo ?? '';
        },
        error: () => {
          this.error = 'Failed to load club data.';
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
    if (validationError) { this.uploadError = validationError; return; }
    this.uploadError = '';
    this.uploading = true;
    try {
      this.logo = await this.cloudinary.uploadImage(file);
    } catch {
      this.uploadError = 'Upload failed. Please try again.';
    } finally {
      this.uploading = false;
      if (this.fileInput) this.fileInput.nativeElement.value = '';
    }
  }

  removeLogo() {
    this.logo = '';
    this.uploadError = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  onSubmit() {
    this.saving = true;
    this.error = '';
    const data = { name: this.name, location: this.location || undefined, logo: this.logo || undefined };
    const request = this.editId
      ? this.clubService.updateClub(this.editId, data)
      : this.clubService.createClub(data);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/admin/clubs']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error || 'Failed to save club.';
      },
    });
  }
}
