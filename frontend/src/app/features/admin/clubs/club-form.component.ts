import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ClubService } from '../../../core/services/club.service';

@Component({
  selector: 'app-club-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <h2>{{ editId ? 'Edit Club' : 'New Club' }}</h2>
      <a routerLink="/admin/clubs" class="btn-back">
        <i class="fas fa-arrow-left"></i> Back
      </a>
    </div>

    @if (error) {
      <div class="alert alert-error">{{ error }}</div>
    }
    @if (success) {
      <div class="alert alert-success">{{ success }}</div>
    }

    <div class="form-card">
      <form (ngSubmit)="onSubmit()" #f="ngForm">
        <div class="form-group">
          <label for="name">Club Name *</label>
          <input
            id="name" type="text" [(ngModel)]="name" name="name"
            required placeholder="e.g. Baseline Tennis Club"
            #nameField="ngModel"
            [class.input-invalid]="nameField.invalid && nameField.touched"
          />
          @if (nameField.invalid && nameField.touched) {
            <span class="field-error">Club name is required.</span>
          }
        </div>

        <div class="form-group">
          <label for="location">Location</label>
          <input
            id="location" type="text" [(ngModel)]="location" name="location"
            placeholder="e.g. Manila, Philippines"
          />
        </div>

        <div class="form-group">
          <label for="logo">Logo URL</label>
          <input
            id="logo" type="url" [(ngModel)]="logo" name="logo"
            placeholder="https://example.com/logo.png"
          />
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary" [disabled]="saving || f.invalid">
            {{ saving ? 'Saving…' : (editId ? 'Save Changes' : 'Create Club') }}
          </button>
          <a routerLink="/admin/clubs" class="btn-cancel">Cancel</a>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h2 { margin: 0; }
    .btn-back {
      color: #6b7280; text-decoration: none;
      display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem;
    }
    .btn-back:hover { color: #374151; }
    .alert-error { background: #fef2f2; color: #dc2626; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; }
    .alert-success { background: #f0fdf4; color: #16a34a; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; }
    .form-card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 6px rgba(0,0,0,0.08); max-width: 480px; }
    .form-group { margin-bottom: 1.1rem; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 0.35rem; font-size: 0.9rem; }
    .form-group input {
      width: 100%; padding: 0.55rem 0.75rem; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;
    }
    .form-group input:focus { outline: none; border-color: #9f7338; }
    .input-invalid { border-color: #dc2626 !important; }
    .field-error { color: #dc2626; font-size: 0.8rem; }
    .form-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
    .btn-primary {
      background: #9f7338; color: white; border: none; padding: 0.6rem 1.2rem;
      border-radius: 6px; cursor: pointer; font-size: 0.9rem;
    }
    .btn-primary:hover:not(:disabled) { background: #7d5a2a; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .btn-cancel {
      color: #6b7280; text-decoration: none; padding: 0.6rem 1rem;
      border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;
    }
    .btn-cancel:hover { background: #f3f4f6; }
  `],
})
export class ClubFormComponent implements OnInit {
  name = '';
  location = '';
  logo = '';
  saving = false;
  error = '';
  success = '';
  editId: string | null = null;

  constructor(
    private clubService: ClubService,
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
