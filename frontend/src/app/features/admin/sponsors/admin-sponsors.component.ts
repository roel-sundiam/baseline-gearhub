import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { SponsorService, Sponsor } from '../../../core/services/sponsor.service';

type SponsorFilter = 'all' | 'live' | 'active' | 'draft' | 'rejected';

@Component({
  selector: 'app-admin-sponsors',
  imports: [FormsModule, CurrencyPipe, DatePipe, TitleCasePipe],
  template: `
    <div class="as-page">
      <header class="as-header">
        <div class="as-header-left">
          <button class="as-back" (click)="router.navigate(['/admin/dashboard'])">
            <i class="fas fa-arrow-left"></i>
          </button>
          <div class="as-header-copy">
            <span class="as-kicker"><i class="fas fa-sparkles"></i> Partnership workspace</span>
            <h1 class="as-title">Sponsored Partners</h1>
            <p class="as-subtitle">Manage partner campaigns, payment approval, publishing, and placement dates.</p>
          </div>
        </div>
        <div class="as-header-actions">
          <button class="as-inquiries-btn" (click)="router.navigate(['/admin/sponsor-inquiries'])">
            <i class="fas fa-inbox"></i> Inquiries
          </button>
          <button class="as-new-btn" (click)="openForm()">
            <i class="fas fa-plus"></i> New Sponsor
          </button>
        </div>
      </header>

      @if (!loading() && items().length > 0) {
        <section class="as-kpi-grid" aria-label="Sponsor overview">
          <div class="as-kpi as-kpi--lime">
            <span class="as-kpi-icon"><i class="fas fa-handshake"></i></span>
            <div><strong>{{ items().length }}</strong><span>Total partners</span></div>
          </div>
          <div class="as-kpi as-kpi--teal">
            <span class="as-kpi-icon"><i class="fas fa-tower-broadcast"></i></span>
            <div><strong>{{ liveCount() }}</strong><span>Live campaigns</span></div>
          </div>
          <div class="as-kpi as-kpi--amber">
            <span class="as-kpi-icon"><i class="fas fa-money-check-dollar"></i></span>
            <div><strong>{{ unverifiedCount() }}</strong><span>Payment review</span></div>
          </div>
          <div class="as-kpi as-kpi--blue">
            <span class="as-kpi-icon"><i class="fas fa-peso-sign"></i></span>
            <div><strong>{{ verifiedValue() | currency:'PHP':'symbol':'1.0-0' }}</strong><span>Verified value</span></div>
          </div>
        </section>
      }

      <!-- Create / Edit form -->
      @if (formOpen()) {
        <div class="as-form-card">
          <div class="as-form-head">
            <span class="as-form-icon"><i class="fas {{ editId() ? 'fa-pen' : 'fa-plus' }}"></i></span>
            <div>
              <h3 class="as-form-title">{{ editId() ? 'Edit Sponsor' : 'Create a sponsor' }}</h3>
              <p>{{ editId() ? 'Update campaign information and placement dates.' : 'Add a new paid partner placement to the member experience.' }}</p>
            </div>
            <button type="button" class="as-form-close" (click)="closeForm()" aria-label="Close form"><i class="fas fa-times"></i></button>
          </div>
          <div class="as-form-grid">
            <div class="as-field">
              <label>Business Name <span class="as-req">*</span></label>
              <input [(ngModel)]="form.businessName" placeholder="e.g. Baseline Sports Shop" class="as-input" />
            </div>
            <div class="as-field">
              <label>Link <span class="as-req">*</span></label>
              <input [(ngModel)]="form.link" placeholder="https://..." class="as-input" />
            </div>
            <div class="as-field as-field-full">
              <label>Logo <span class="as-req">*</span></label>
              <div class="as-logo-row" [class.as-logo-row--ready]="!!form.logoUrl">
                @if (form.logoUrl) {
                  <img [src]="form.logoUrl" alt="Logo preview" class="as-logo-preview" />
                } @else {
                  <span class="as-logo-placeholder"><i class="fas fa-image"></i></span>
                }
                <div class="as-upload-copy">
                  <strong>{{ selectedLogoName() || (form.logoUrl ? 'Logo ready' : 'Upload a sponsor logo') }}</strong>
                  <span>{{ uploadingLogo() ? 'Uploading securely…' : 'PNG, JPG or WebP · recommended square image' }}</span>
                </div>
                <input id="sponsor-logo-upload" type="file" accept="image/*" (change)="onLogoSelected($event)" class="as-file-native" />
                <label for="sponsor-logo-upload" class="as-upload-btn" [class.as-upload-btn--busy]="uploadingLogo()">
                  <i class="fas {{ uploadingLogo() ? 'fa-circle-notch fa-spin' : (form.logoUrl ? 'fa-arrows-rotate' : 'fa-cloud-arrow-up') }}"></i>
                  {{ uploadingLogo() ? 'Uploading' : (form.logoUrl ? 'Replace' : 'Choose image') }}
                </label>
              </div>
            </div>
            <div class="as-field as-field-full">
              <label>Description <span class="as-req">*</span></label>
              <textarea [(ngModel)]="form.description" rows="3" maxlength="300" placeholder="What the business offers members" class="as-input as-textarea"></textarea>
            </div>
            <div class="as-field as-field-full">
              <label>Promo Text</label>
              <input [(ngModel)]="form.promoText" maxlength="150" placeholder="e.g. 10% off for CourtGo members" class="as-input" />
            </div>
            <div class="as-field">
              <label>Duration</label>
              <select [(ngModel)]="form.tierDays" class="as-input">
                <option [ngValue]="7">7 days</option>
                <option [ngValue]="30">30 days</option>
                <option [ngValue]="90">90 days</option>
              </select>
            </div>
            <div class="as-field">
              <label>Price (PHP)</label>
              <input type="number" min="0" [(ngModel)]="form.price" class="as-input" />
            </div>
            <div class="as-field">
              <label>Start Date <span class="as-req">*</span></label>
              <input type="date" [(ngModel)]="form.startDate" class="as-input" />
            </div>
            <div class="as-field">
              <label>End Date <span class="as-req">*</span></label>
              <input type="date" [(ngModel)]="form.endDate" class="as-input" />
            </div>
          </div>
          @if (formError()) {
            <p class="as-error">{{ formError() }}</p>
          }
          <div class="as-form-actions">
            <button class="as-save-btn" [disabled]="saving() || uploadingLogo()" (click)="save()">
              @if (saving()) { <i class="fas fa-circle-notch fa-spin"></i> Saving... }
              @else { <i class="fas fa-check"></i> {{ editId() ? 'Save Changes' : 'Create Sponsor' }} }
            </button>
            <button class="as-cancel-btn" (click)="closeForm()">Cancel</button>
          </div>
        </div>
      }

      <!-- Sponsors list -->
      @if (loading()) {
        <div class="as-loading">
          <div class="as-spinner"></div>
          <span>Loading sponsors...</span>
        </div>
      } @else if (items().length === 0) {
        <div class="as-empty">
          <span class="as-empty-icon"><i class="fas fa-handshake"></i></span>
          <h3>Build your partner portfolio</h3>
          <p>Create the first sponsored placement for your members.</p>
          <button class="as-new-btn" (click)="openForm()"><i class="fas fa-plus"></i> New Sponsor</button>
        </div>
      } @else {
        <div class="as-list-toolbar">
          <div>
            <span class="as-list-eyebrow">Portfolio</span>
            <h2>Partner campaigns</h2>
          </div>
          <div class="as-filter-tabs" aria-label="Filter sponsors">
            @for (filter of filters; track filter.value) {
              <button type="button" [class.as-filter-active]="statusFilter() === filter.value" (click)="statusFilter.set(filter.value)">
                {{ filter.label }} <span>{{ filterCount(filter.value) }}</span>
              </button>
            }
          </div>
        </div>

        @if (filteredItems().length === 0) {
          <div class="as-filter-empty"><i class="fas fa-filter-circle-xmark"></i> No sponsors match this filter.</div>
        }
        <div class="as-list">
          @for (item of filteredItems(); track item._id) {
            <article class="as-card" [class.as-card-live]="isLive(item)">
              <div class="as-card-top">
                <img [src]="item.logoUrl" alt="" class="as-card-logo" />
                <div class="as-card-top-info">
                  <h3 class="as-card-title">{{ item.businessName }}</h3>
                  <div class="as-card-badges">
                    <span class="as-status-badge as-status-{{ item.status }}">{{ item.status | titlecase }}</span>
                    <span class="as-pay-badge" [class.as-pay-verified]="item.paymentVerified">
                      <i class="fas" [class.fa-check-circle]="item.paymentVerified" [class.fa-times-circle]="!item.paymentVerified"></i>
                      {{ item.paymentVerified ? 'Payment Verified' : 'Payment Unverified' }}
                    </span>
                    @if (isLive(item)) { <span class="as-live-badge"><i class="fas fa-circle"></i> Live</span> }
                  </div>
                </div>
                <a class="as-card-link" [href]="item.link" target="_blank" rel="noopener noreferrer" title="Open sponsor link">
                  <i class="fas fa-arrow-up-right-from-square"></i>
                </a>
              </div>
              <p class="as-card-body">{{ item.description }}</p>
              @if (item.promoText) { <p class="as-card-promo"><i class="fas fa-tag"></i> {{ item.promoText }}</p> }
              <div class="as-card-metrics">
                <div><span>Campaign</span><strong>{{ item.startDate | date:'MMM d' }} – {{ item.endDate | date:'MMM d, y' }}</strong></div>
                <div><span>Duration</span><strong>{{ item.tierDays }} days</strong></div>
                <div><span>Value</span><strong>{{ item.price | currency:'PHP':'symbol':'1.0-0' }}</strong></div>
              </div>
              <div class="as-card-actions">
                <button class="as-action-btn as-edit-btn" (click)="openEdit(item)">
                  <i class="fas fa-pen"></i> Edit
                </button>
                <button class="as-action-btn as-verify-btn" (click)="toggleVerify(item)">
                  <i class="fas fa-money-check-alt"></i> {{ item.paymentVerified ? 'Unverify Payment' : 'Verify Payment' }}
                </button>
                @if (item.status !== 'active') {
                  <button class="as-action-btn as-activate-btn" (click)="setStatus(item, 'active')">
                    <i class="fas fa-play"></i> Activate
                  </button>
                }
                @if (item.status !== 'rejected') {
                  <button class="as-action-btn as-reject-btn" (click)="setStatus(item, 'rejected')">
                    <i class="fas fa-ban"></i> Reject
                  </button>
                }
                @if (item.status !== 'draft') {
                  <button class="as-action-btn as-draft-btn" (click)="setStatus(item, 'draft')">
                    <i class="fas fa-pause"></i> Set to Draft
                  </button>
                }
                <button class="as-action-btn as-delete-btn" (click)="confirmDelete(item)">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
              @if (rowError() && rowErrorId() === item._id) {
                <p class="as-error">{{ rowError() }}</p>
              }
            </article>
          }
        </div>
      }

      <!-- Delete confirm modal -->
      @if (deleteTarget()) {
        <div class="as-modal-backdrop" (click)="deleteTarget.set(null)">
          <div class="as-modal" (click)="$event.stopPropagation()">
            <p class="as-modal-msg">Delete "<strong>{{ deleteTarget()!.businessName }}</strong>"?</p>
            <p class="as-modal-sub">This cannot be undone.</p>
            <div class="as-modal-actions">
              <button class="as-delete-confirm-btn" [disabled]="deleting()" (click)="doDelete()">
                @if (deleting()) { Deleting... } @else { Delete }
              </button>
              <button class="as-cancel-btn" (click)="deleteTarget.set(null)">Cancel</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .as-page { max-width: 820px; margin: 0 auto; padding-bottom: 2rem; }
    .as-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
    .as-header-left { display: flex; align-items: center; gap: 0.85rem; }
    .as-back {
      background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: #fff;
      width: 36px; height: 36px; border-radius: 10px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0;
      transition: background 0.15s;
    }
    .as-back:hover { background: rgba(255,255,255,0.13); }
    .as-title { font-size: 1.2rem; font-weight: 700; color: #fff; margin: 0 0 0.1rem; }
    .as-title i { color: #a3e635; margin-right: 0.4rem; }
    .as-subtitle { font-size: 0.77rem; color: rgba(255,255,255,0.4); margin: 0; }
    .as-new-btn {
      background: rgba(163,230,53,0.15); color: #a3e635; border: 1px solid rgba(163,230,53,0.4);
      border-radius: 10px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 700; cursor: pointer;
      font-family: inherit; white-space: nowrap; display: flex; align-items: center; gap: 0.4rem;
      transition: background 0.15s;
    }
    .as-new-btn:hover { background: rgba(163,230,53,0.25); }

    .as-form-card {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(163,230,53,0.2);
      border-radius: 14px; padding: 1.25rem; margin-bottom: 1.25rem;
    }
    .as-form-title { font-size: 1rem; font-weight: 700; color: #a3e635; margin: 0 0 1rem; }
    .as-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    .as-field { display: flex; flex-direction: column; gap: 0.35rem; }
    .as-field label { font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600; }
    .as-req { color: #a3e635; }
    .as-field-full { grid-column: 1 / -1; }
    .as-input {
      background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; color: #fff; padding: 0.55rem 0.75rem; font-size: 0.88rem;
      font-family: inherit; outline: none; transition: border-color 0.15s;
    }
    .as-input:focus { border-color: rgba(163,230,53,0.5); }
    .as-textarea { resize: vertical; min-height: 70px; }
    select.as-input option { background: #1a2e1a; }
    .as-logo-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .as-logo-preview { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.15); }
    .as-file-input { color: rgba(255,255,255,0.6); font-size: 0.82rem; }
    .as-uploading { font-size: 0.8rem; color: #a3e635; display: flex; align-items: center; gap: 0.35rem; }
    .as-error { color: #f87171; font-size: 0.82rem; margin: 0.5rem 0 0; }
    .as-form-actions { display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; }
    .as-save-btn {
      background: #a3e635; color: #0c1a11; border: none; border-radius: 9px;
      padding: 0.55rem 1.25rem; font-size: 0.88rem; font-weight: 700; cursor: pointer;
      font-family: inherit; display: flex; align-items: center; gap: 0.4rem; transition: opacity 0.15s;
    }
    .as-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .as-cancel-btn {
      background: transparent; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 9px; padding: 0.55rem 1rem; font-size: 0.85rem; cursor: pointer;
      font-family: inherit; transition: color 0.15s;
    }
    .as-cancel-btn:hover { color: rgba(255,255,255,0.8); }

    .as-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem 0; color: rgba(255,255,255,0.5); font-size: 0.9rem; }
    .as-spinner { width: 28px; height: 28px; border: 2px solid rgba(163,230,53,0.2); border-top-color: #a3e635; border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .as-empty { text-align: center; padding: 3rem 1rem; color: rgba(255,255,255,0.35); }
    .as-empty i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; color: rgba(163,230,53,0.3); }
    .as-empty p { margin: 0; font-size: 0.9rem; }

    .as-list { display: flex; flex-direction: column; gap: 0.85rem; }
    .as-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 1rem 1.1rem; }
    .as-card-top { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.5rem; }
    .as-card-logo { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.12); }
    .as-card-top-info { flex: 1; min-width: 0; }
    .as-card-title { font-size: 0.97rem; font-weight: 700; color: #fff; margin: 0 0 0.35rem; }
    .as-card-badges { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .as-status-badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em; }
    .as-status-draft { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
    .as-status-active { background: rgba(163,230,53,0.15); color: #a3e635; }
    .as-status-rejected { background: rgba(248,113,113,0.15); color: #f87171; }
    .as-pay-badge { font-size: 0.72rem; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 0.3rem; }
    .as-pay-verified { color: #a3e635; }
    .as-live-badge { font-size: 0.7rem; color: #38bdf8; display: flex; align-items: center; gap: 0.25rem; }
    .as-card-body { font-size: 0.85rem; color: rgba(255,255,255,0.65); margin: 0 0 0.35rem; line-height: 1.5; white-space: pre-wrap; }
    .as-card-promo { font-size: 0.8rem; color: #fbbf24; margin: 0 0 0.35rem; display: flex; align-items: center; gap: 0.3rem; }
    .as-card-meta { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin: 0 0 0.65rem; }
    .as-card-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .as-action-btn {
      font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.7rem; border-radius: 7px; cursor: pointer;
      font-family: inherit; display: flex; align-items: center; gap: 0.3rem; border: 1px solid transparent; transition: background 0.15s;
    }
    .as-edit-btn { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.12); }
    .as-edit-btn:hover { background: rgba(255,255,255,0.13); }
    .as-verify-btn { background: rgba(56,189,248,0.09); color: #38bdf8; border-color: rgba(56,189,248,0.2); }
    .as-verify-btn:hover { background: rgba(56,189,248,0.18); }
    .as-activate-btn { background: rgba(163,230,53,0.09); color: #a3e635; border-color: rgba(163,230,53,0.2); }
    .as-activate-btn:hover { background: rgba(163,230,53,0.18); }
    .as-reject-btn, .as-delete-btn { background: rgba(248,113,113,0.08); color: #f87171; border-color: rgba(248,113,113,0.2); }
    .as-reject-btn:hover, .as-delete-btn:hover { background: rgba(248,113,113,0.16); }
    .as-draft-btn { background: rgba(251,191,36,0.08); color: #fbbf24; border-color: rgba(251,191,36,0.2); }
    .as-draft-btn:hover { background: rgba(251,191,36,0.16); }

    .as-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 500; display: flex; align-items: center; justify-content: center; }
    .as-modal { background: #1a2e1a; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 1.5rem; max-width: 360px; width: calc(100% - 2rem); }
    .as-modal-msg { font-size: 0.95rem; color: #fff; margin: 0 0 0.25rem; }
    .as-modal-sub { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin: 0 0 1.25rem; }
    .as-modal-actions { display: flex; gap: 0.75rem; }
    .as-delete-confirm-btn {
      background: #f87171; color: #fff; border: none; border-radius: 9px; padding: 0.55rem 1.25rem;
      font-size: 0.88rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.15s;
    }
    .as-delete-confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 520px) {
      .as-form-grid { grid-template-columns: 1fr; }
      .as-field-full { grid-column: 1; }
      .as-header { flex-direction: column; }
    }

    /* Modern sponsor operations workspace */
    :host { display: block; background: #0c1a11; min-height: calc(100vh - 60px); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .as-page { max-width: 1200px; margin: 0 auto; padding: 1.25rem 1rem 2.5rem; color: #fff; }

    .as-header {
      position: relative; overflow: hidden; align-items: center; min-height: 128px; box-sizing: border-box;
      margin: 0 0 1rem; padding: 1.35rem 1.5rem; border: 1px solid rgba(163,230,53,0.14); border-radius: 20px;
      background: radial-gradient(520px 220px at 0% 0%, rgba(163,230,53,0.14), transparent 72%), linear-gradient(125deg, #1d3729, #13271e);
      box-shadow: 0 14px 36px rgba(0,0,0,0.28);
    }
    .as-header::after { content: ''; position: absolute; width: 220px; height: 220px; right: -65px; top: -115px; border: 32px solid rgba(163,230,53,0.045); border-radius: 50%; pointer-events: none; }
    .as-header-left, .as-new-btn { position: relative; z-index: 1; }
    .as-header-left { gap: 1rem; }
    .as-back { width: 42px; height: 42px; border-radius: 12px; color: #a3e635; background: rgba(163,230,53,0.09); border-color: rgba(163,230,53,0.19); }
    .as-back:hover { background: rgba(163,230,53,0.16); }
    .as-header-copy { display: grid; gap: 0.18rem; }
    .as-kicker { color: #a3e635; font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; }
    .as-kicker i { margin-right: 0.3rem; }
    .as-title { margin: 0; color: #fff; font-size: clamp(1.55rem, 3vw, 2rem); font-weight: 800; letter-spacing: -0.03em; }
    .as-subtitle { max-width: 570px; margin-top: 0.18rem; color: rgba(255,255,255,0.52); font-size: 0.8rem; line-height: 1.45; }
    .as-new-btn { min-height: 42px; padding: 0 1rem; border: 0; border-radius: 12px; color: #102015; background: linear-gradient(135deg, #b4ee43, #8bd315); box-shadow: 0 8px 20px rgba(163,230,53,0.2); }
    .as-new-btn:hover { background: linear-gradient(135deg, #c1f461, #9add28); }
    .as-header-actions { position: relative; z-index: 1; display: flex; align-items: center; gap: 0.6rem; }
    .as-inquiries-btn {
      display: inline-flex; align-items: center; gap: 0.4rem; min-height: 42px; padding: 0 1rem;
      border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; color: rgba(255,255,255,0.75);
      background: rgba(255,255,255,0.05); cursor: pointer; font-family: inherit; font-size: 0.85rem; font-weight: 700;
      transition: background 0.15s;
    }
    .as-inquiries-btn:hover { background: rgba(255,255,255,0.1); }

    .as-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .as-kpi { --kpi: 163,230,53; display: flex; align-items: center; gap: 0.72rem; min-width: 0; padding: 0.9rem; border: 1px solid rgba(255,255,255,0.075); border-radius: 15px; background: #1b3028; box-shadow: 0 7px 20px rgba(0,0,0,0.18); }
    .as-kpi--teal { --kpi: 45,212,191; }
    .as-kpi--amber { --kpi: 251,191,36; }
    .as-kpi--blue { --kpi: 96,165,250; }
    .as-kpi-icon { width: 34px; height: 34px; flex: 0 0 34px; display: grid; place-items: center; border-radius: 10px; color: rgb(var(--kpi)); background: rgba(var(--kpi),0.11); font-size: 0.78rem; }
    .as-kpi > div { display: grid; min-width: 0; }
    .as-kpi strong { color: #fff; font-size: 1.08rem; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .as-kpi span:not(.as-kpi-icon) { color: rgba(255,255,255,0.42); font-size: 0.61rem; font-weight: 750; text-transform: uppercase; letter-spacing: 0.055em; }

    .as-form-card { padding: 0; overflow: hidden; border: 1px solid rgba(163,230,53,0.17); border-radius: 18px; background: #1b3028; box-shadow: 0 12px 32px rgba(0,0,0,0.25); }
    .as-form-head { display: flex; align-items: center; gap: 0.7rem; padding: 1rem 1.15rem; border-bottom: 1px solid rgba(255,255,255,0.075); background: #162b21; }
    .as-form-icon { width: 36px; height: 36px; flex: 0 0 36px; display: grid; place-items: center; border-radius: 10px; color: #a3e635; background: rgba(163,230,53,0.1); }
    .as-form-head > div { flex: 1; min-width: 0; }
    .as-form-title { margin: 0; color: #fff; font-size: 0.95rem; }
    .as-form-head p { margin: 0.15rem 0 0; color: rgba(255,255,255,0.43); font-size: 0.69rem; }
    .as-form-close { width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 9px; color: rgba(255,255,255,0.45); background: transparent; cursor: pointer; }
    .as-form-close:hover { color: #fff; background: rgba(255,255,255,0.06); }
    .as-form-grid { padding: 1.15rem; gap: 0.9rem 1rem; }
    .as-field label { color: rgba(255,255,255,0.56); font-size: 0.71rem; font-weight: 750; }
    .as-input { min-height: 40px; box-sizing: border-box; padding: 0.6rem 0.75rem; border-radius: 10px; color: #fff; background: #12251c; border-color: rgba(255,255,255,0.11); color-scheme: dark; }
    .as-input:focus { border-color: rgba(163,230,53,0.55); box-shadow: 0 0 0 3px rgba(163,230,53,0.09); }
    .as-textarea { min-height: 88px; }
    .as-logo-row { position: relative; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 0.8rem; min-height: 76px; padding: 0.65rem; border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; background: rgba(255,255,255,0.025); box-sizing: border-box; transition: border-color 0.16s, background 0.16s; }
    .as-logo-row:hover { border-color: rgba(163,230,53,0.3); background: rgba(163,230,53,0.025); }
    .as-logo-row--ready { border-style: solid; border-color: rgba(163,230,53,0.16); }
    .as-logo-preview, .as-logo-placeholder { width: 54px; height: 54px; border-radius: 11px; box-sizing: border-box; }
    .as-logo-preview { object-fit: cover; background: #fff; border: 1px solid rgba(255,255,255,0.14); }
    .as-logo-placeholder { display: grid; place-items: center; color: rgba(163,230,53,0.55); background: rgba(163,230,53,0.08); border: 1px solid rgba(163,230,53,0.13); font-size: 1rem; }
    .as-upload-copy { display: grid; gap: 0.2rem; min-width: 0; }
    .as-upload-copy strong { overflow: hidden; color: rgba(255,255,255,0.82); font-size: 0.76rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
    .as-upload-copy span { color: rgba(255,255,255,0.38); font-size: 0.64rem; }
    .as-file-native { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    .as-logo-row .as-upload-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.42rem; min-height: 36px; padding: 0 0.78rem; border: 1px solid rgba(163,230,53,0.22); border-radius: 10px; color: #d9f99d; background: rgba(163,230,53,0.09); font-size: 0.69rem; font-weight: 800; cursor: pointer; white-space: nowrap; transition: background 0.15s, border-color 0.15s, transform 0.15s; }
    .as-logo-row .as-upload-btn:hover { background: rgba(163,230,53,0.16); border-color: rgba(163,230,53,0.36); transform: translateY(-1px); }
    .as-file-native:focus-visible + .as-upload-btn { outline: 3px solid rgba(163,230,53,0.16); outline-offset: 2px; }
    .as-logo-row .as-upload-btn--busy { opacity: 0.65; pointer-events: none; }
    .as-form-card > .as-error { margin-inline: 1.15rem; }
    .as-form-actions { justify-content: flex-end; margin: 0; padding: 0.9rem 1.15rem; border-top: 1px solid rgba(255,255,255,0.075); background: rgba(0,0,0,0.08); }
    .as-save-btn, .as-cancel-btn { min-height: 38px; border-radius: 10px; }

    .as-list-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin: 1.25rem 0 0.75rem; }
    .as-list-eyebrow { color: #a3e635; font-size: 0.61rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .as-list-toolbar h2 { margin: 0.15rem 0 0; color: #fff; font-size: 1.08rem; }
    .as-filter-tabs { display: inline-flex; gap: 0.15rem; padding: 0.25rem; overflow-x: auto; border: 1px solid rgba(255,255,255,0.075); border-radius: 11px; background: #14271e; scrollbar-width: none; }
    .as-filter-tabs::-webkit-scrollbar { display: none; }
    .as-filter-tabs button { display: inline-flex; align-items: center; gap: 0.35rem; min-height: 32px; padding: 0 0.62rem; border: 0; border-radius: 8px; color: rgba(255,255,255,0.45); background: transparent; font-family: inherit; font-size: 0.67rem; font-weight: 700; white-space: nowrap; cursor: pointer; }
    .as-filter-tabs button span { min-width: 17px; height: 17px; display: grid; place-items: center; border-radius: 99px; color: rgba(255,255,255,0.48); background: rgba(255,255,255,0.06); font-size: 0.57rem; }
    .as-filter-tabs button:hover { color: #fff; }
    .as-filter-tabs .as-filter-active { color: #d9f99d; background: #244033; box-shadow: 0 2px 7px rgba(0,0,0,0.2); }
    .as-filter-tabs .as-filter-active span { color: #102015; background: #a3e635; }

    .as-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0.9rem; }
    .as-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 1rem; border-radius: 17px; background: #1b3028; border-color: rgba(255,255,255,0.075); box-shadow: 0 8px 24px rgba(0,0,0,0.19); transition: transform 0.16s, border-color 0.16s, background 0.16s; }
    .as-card:hover { transform: translateY(-2px); background: #1e352b; border-color: rgba(163,230,53,0.13); }
    .as-card-live { border-color: rgba(45,212,191,0.2); }
    .as-card-live::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; border-radius: 17px 0 0 17px; background: #2dd4bf; }
    .as-card-top { align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    .as-card-logo { width: 52px; height: 52px; border-radius: 12px; background: #fff; }
    .as-card-title { margin-bottom: 0.38rem; font-size: 1rem; }
    .as-card-link { width: 34px; height: 34px; flex: 0 0 34px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; color: rgba(255,255,255,0.43); text-decoration: none; }
    .as-card-link:hover { color: #a3e635; background: rgba(163,230,53,0.08); }
    .as-card-body { min-height: 2.55rem; margin-bottom: 0.65rem; color: rgba(255,255,255,0.58); font-size: 0.78rem; }
    .as-card-promo { width: fit-content; margin-bottom: 0.7rem; padding: 0.38rem 0.58rem; border-radius: 8px; color: #fcd34d; background: rgba(251,191,36,0.08); }
    .as-card-metrics { display: grid; grid-template-columns: 1.45fr 0.75fr 0.8fr; gap: 0.4rem; margin-top: auto; padding: 0.65rem; border-radius: 11px; background: rgba(0,0,0,0.12); }
    .as-card-metrics > div { display: grid; gap: 0.15rem; min-width: 0; }
    .as-card-metrics span { color: rgba(255,255,255,0.34); font-size: 0.56rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    .as-card-metrics strong { color: rgba(255,255,255,0.76); font-size: 0.68rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .as-card-actions { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.065); gap: 0.35rem; }
    .as-action-btn { min-height: 32px; padding: 0 0.58rem; border-radius: 8px; font-size: 0.66rem; }
    .as-filter-empty, .as-loading, .as-empty { border: 1px dashed rgba(163,230,53,0.16); border-radius: 17px; background: #162a20; }
    .as-filter-empty { padding: 1.5rem; margin-bottom: 0.8rem; color: rgba(255,255,255,0.45); text-align: center; font-size: 0.78rem; }
    .as-filter-empty i { color: #a3e635; margin-right: 0.4rem; }
    .as-empty { display: grid; justify-items: center; gap: 0.55rem; }
    .as-empty-icon { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 15px; color: #a3e635; background: rgba(163,230,53,0.1); font-size: 1.2rem; }
    .as-empty i { margin: 0; color: inherit; font-size: inherit; }
    .as-empty h3 { margin: 0; color: #fff; font-size: 1rem; }
    .as-empty p { color: rgba(255,255,255,0.42); }
    .as-empty .as-new-btn { margin-top: 0.4rem; }
    .as-modal-backdrop { background: rgba(3,12,7,0.72); backdrop-filter: blur(3px); }
    .as-modal { border-radius: 17px; background: #1b3028; box-shadow: 0 20px 55px rgba(0,0,0,0.45); }

    @media (max-width: 900px) {
      .as-kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .as-list { grid-template-columns: 1fr; }
    }
    @media (max-width: 680px) {
      .as-page { padding: 0.75rem 0.7rem 2rem; }
      .as-header { min-height: 116px; padding: 1rem; border-radius: 17px; flex-direction: row; }
      .as-header-left { gap: 0.7rem; min-width: 0; }
      .as-back { width: 38px; height: 38px; flex: 0 0 38px; }
      .as-title { font-size: 1.4rem; }
      .as-subtitle { display: none; }
      .as-new-btn, .as-inquiries-btn { min-width: 42px; width: 42px; padding: 0; justify-content: center; font-size: 0; }
      .as-new-btn i, .as-inquiries-btn i { font-size: 0.8rem; }
      .as-list-toolbar { align-items: stretch; flex-direction: column; }
      .as-filter-tabs { width: 100%; box-sizing: border-box; }
      .as-form-grid { grid-template-columns: 1fr; }
      .as-field-full { grid-column: 1; }
    }
    @media (max-width: 430px) {
      .as-kpi-grid { grid-template-columns: 1fr; }
      .as-card-metrics { grid-template-columns: 1fr 1fr; }
      .as-card-metrics > div:first-child { grid-column: 1 / -1; }
      .as-card-actions .as-action-btn { flex: 1 1 calc(50% - 0.35rem); justify-content: center; }
      .as-form-actions { display: grid; grid-template-columns: 1fr 1fr; }
      .as-save-btn, .as-cancel-btn { justify-content: center; }
      .as-logo-row { grid-template-columns: auto minmax(0,1fr); }
      .as-logo-row .as-upload-btn { grid-column: 1 / -1; width: 100%; box-sizing: border-box; }
    }
  `],
})
export class AdminSponsorsComponent implements OnInit {
  protected router = inject(Router);
  private auth = inject(AuthService);
  private sponsorService = inject(SponsorService);
  private cloudinary = inject(CloudinaryService);

  items = signal<Sponsor[]>([]);
  statusFilter = signal<SponsorFilter>('all');
  readonly filters: { value: SponsorFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'live', label: 'Live' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'rejected', label: 'Rejected' },
  ];
  liveCount = computed(() => this.items().filter(item => this.isLive(item)).length);
  unverifiedCount = computed(() => this.items().filter(item => !item.paymentVerified).length);
  verifiedValue = computed(() => this.items().filter(item => item.paymentVerified).reduce((total, item) => total + item.price, 0));
  filteredItems = computed(() => {
    const filter = this.statusFilter();
    if (filter === 'all') return this.items();
    if (filter === 'live') return this.items().filter(item => this.isLive(item));
    return this.items().filter(item => item.status === filter);
  });
  loading = signal(true);
  formOpen = signal(false);
  saving = signal(false);
  uploadingLogo = signal(false);
  selectedLogoName = signal('');
  editId = signal<string | null>(null);
  formError = signal('');
  rowError = signal('');
  rowErrorId = signal<string | null>(null);
  deleteTarget = signal<Sponsor | null>(null);
  deleting = signal(false);

  form = this.emptyForm();

  ngOnInit() {
    if (!this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.load();
  }

  private emptyForm() {
    return { businessName: '', logoUrl: '', description: '', promoText: '', link: '', tierDays: 30, price: 0, startDate: '', endDate: '' };
  }

  private load() {
    this.loading.set(true);
    this.sponsorService.getAllForAdmin().subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  isLive(item: Sponsor): boolean {
    if (item.status !== 'active') return false;
    const now = Date.now();
    return new Date(item.startDate).getTime() <= now && new Date(item.endDate).getTime() >= now;
  }

  filterCount(filter: SponsorFilter): number {
    if (filter === 'all') return this.items().length;
    if (filter === 'live') return this.liveCount();
    return this.items().filter(item => item.status === filter).length;
  }

  openForm() {
    this.editId.set(null);
    this.form = this.emptyForm();
    this.formError.set('');
    this.selectedLogoName.set('');
    this.formOpen.set(true);
  }

  openEdit(item: Sponsor) {
    this.editId.set(item._id);
    this.form = {
      businessName: item.businessName,
      logoUrl: item.logoUrl,
      description: item.description,
      promoText: item.promoText || '',
      link: item.link,
      tierDays: item.tierDays,
      price: item.price,
      startDate: item.startDate.slice(0, 10),
      endDate: item.endDate.slice(0, 10),
    };
    this.formError.set('');
    this.selectedLogoName.set('');
    this.formOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() {
    this.formOpen.set(false);
    this.editId.set(null);
    this.formError.set('');
    this.selectedLogoName.set('');
  }

  async onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.selectedLogoName.set(file.name);

    const validationError = this.cloudinary.validateImage(file);
    if (validationError) {
      this.formError.set(validationError);
      this.selectedLogoName.set('');
      return;
    }

    this.uploadingLogo.set(true);
    try {
      this.form.logoUrl = await this.cloudinary.uploadImage(file, 'sponsor-logos');
    } catch {
      this.formError.set('Logo upload failed. Please try again.');
    } finally {
      this.uploadingLogo.set(false);
    }
  }

  save() {
    if (!this.form.businessName.trim()) { this.formError.set('Business name is required.'); return; }
    if (!this.form.logoUrl.trim()) { this.formError.set('Logo is required.'); return; }
    if (!this.form.description.trim()) { this.formError.set('Description is required.'); return; }
    if (!this.form.link.trim()) { this.formError.set('Link is required.'); return; }
    if (!this.form.startDate || !this.form.endDate) { this.formError.set('Start and end dates are required.'); return; }
    if (new Date(this.form.endDate) <= new Date(this.form.startDate)) { this.formError.set('End date must be after start date.'); return; }

    this.formError.set('');
    this.saving.set(true);

    const obs = this.editId()
      ? this.sponsorService.update(this.editId()!, this.form)
      : this.sponsorService.create(this.form);

    obs.subscribe({
      next: (saved) => {
        if (this.editId()) {
          this.items.update(list => list.map(i => i._id === saved._id ? saved : i));
        } else {
          this.items.update(list => [saved, ...list]);
        }
        this.saving.set(false);
        this.closeForm();
      },
      error: () => {
        this.formError.set('Failed to save. Please try again.');
        this.saving.set(false);
      },
    });
  }

  toggleVerify(item: Sponsor) {
    this.sponsorService.toggleVerifyPayment(item._id).subscribe({
      next: (updated) => this.items.update(list => list.map(i => i._id === updated._id ? updated : i)),
      error: () => {},
    });
  }

  setStatus(item: Sponsor, status: 'draft' | 'active' | 'rejected') {
    this.rowError.set('');
    this.rowErrorId.set(null);
    this.sponsorService.setStatus(item._id, status).subscribe({
      next: (updated) => this.items.update(list => list.map(i => i._id === updated._id ? updated : i)),
      error: (err) => {
        this.rowError.set(err?.error?.error || 'Failed to update status.');
        this.rowErrorId.set(item._id);
      },
    });
  }

  confirmDelete(item: Sponsor) {
    this.deleteTarget.set(item);
  }

  doDelete() {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.sponsorService.delete(target._id).subscribe({
      next: () => {
        this.items.update(list => list.filter(i => i._id !== target._id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }
}
