import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="bg-layer">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="grid-overlay"></div>
      </div>

      <header class="rv-nav">
        <img src="/CourtGo.png" alt="CourtGo" class="rv-nav-logo" />
      </header>

      <div class="card-wrap">

        @if (state() === 'loading') {
          <div class="loader-scene">
            <img src="/CGLoader.png" alt="Loading" class="loader-img" />
          </div>
        } @else if (state() === 'not-found') {
          <div class="result-card">
            <div class="result-icon result-icon-error">✕</div>
            <h2>Club Not Found</h2>
            <p>This review link is invalid or the club no longer exists.</p>
          </div>
        } @else if (state() === 'done') {
          <div class="result-card">
            <div class="result-icon result-icon-success">✓</div>
            <h2>Thank you, {{ submittedName() }}!</h2>
            <p>Your review for <strong>{{ clubName() }}</strong> has been submitted. It will appear on the CourtGo landing page once approved.</p>
          </div>
        } @else {
          <div class="form-card">
            <div class="form-header">
              <p class="form-kicker">App Review</p>
              <h1 class="form-title">{{ clubName() }}</h1>
              <p class="form-sub">Share your experience with CourtGo. Your review helps other clubs discover the platform.</p>
            </div>

            <form class="form-body" (ngSubmit)="submit()">

              <label class="field-label">Rating</label>
              <div class="star-picker">
                @for (star of [1,2,3,4,5]; track star) {
                  <button
                    type="button"
                    class="star-btn"
                    [class.star-active]="star <= form.rating"
                    (click)="form.rating = star"
                    [attr.aria-label]="star + ' star' + (star > 1 ? 's' : '')"
                  >★</button>
                }
                <span class="star-label">{{ ratingLabel() }}</span>
              </div>

              <label class="field-label" for="rtext">Your Review</label>
              <textarea
                id="rtext"
                class="field-input field-textarea"
                [(ngModel)]="form.text"
                name="text"
                placeholder="Tell us how CourtGo has helped your club manage courts, bookings, and members…"
                rows="5"
                required
              ></textarea>

              @if (errorMsg()) {
                <p class="field-error">{{ errorMsg() }}</p>
              }

              <button type="submit" class="btn-submit" [disabled]="submitting()">
                @if (submitting()) {
                  <span class="spinner"></span> Submitting…
                } @else {
                  Submit Review
                }
              </button>
            </form>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page {
      min-height: 100vh;
      background: #0a1610;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      position: relative;
      overflow: hidden;
    }

    .bg-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; }

    .orb {
      position: absolute; border-radius: 50%; filter: blur(40px);
      animation: floatOrb ease-in-out infinite alternate;
    }
    .orb-1 {
      width: 480px; height: 480px; top: -160px; left: -160px;
      background: radial-gradient(circle, rgba(124,255,78,0.15) 0%, transparent 70%);
      animation-duration: 13s;
    }
    .orb-2 {
      width: 280px; height: 280px; bottom: -80px; right: -80px;
      background: radial-gradient(circle, rgba(124,255,78,0.10) 0%, transparent 70%);
      animation-duration: 10s; animation-delay: -5s;
    }
    @keyframes floatOrb {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-36px) scale(1.06); }
    }

    .grid-overlay {
      position: absolute; inset: 0;
      background-image:
        repeating-linear-gradient(0deg,  rgba(124,255,78,0.028) 0, rgba(124,255,78,0.028) 1px, transparent 1px, transparent 80px),
        repeating-linear-gradient(90deg, rgba(124,255,78,0.028) 0, rgba(124,255,78,0.028) 1px, transparent 1px, transparent 80px);
    }

    /* ── Top nav ── */
    .rv-nav {
      position: fixed; top: 0; left: 0; right: 0;
      z-index: 10;
      display: flex; align-items: center;
      padding: 1rem 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(10,22,16,0.8);
      backdrop-filter: blur(10px);
    }
    .rv-nav-logo { height: 30px; width: auto; }

    .card-wrap {
      position: relative; z-index: 1;
      width: 100%; max-width: 500px;
      margin-top: 64px;
    }

    /* ── Loader ── */
    .loader-scene {
      display: flex; justify-content: center; align-items: center;
      padding: 4rem 0;
    }
    .loader-img { width: 64px; animation: pulse 1.4s ease-in-out infinite alternate; }
    @keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }

    /* ── Result card ── */
    .result-card {
      text-align: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 3rem 2rem;
    }

    .result-icon {
      width: 72px; height: 72px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 2rem; font-weight: 700;
      margin: 0 auto 1.5rem;
    }
    .result-icon-success {
      background: rgba(124,255,78,0.12);
      border: 2px solid rgba(124,255,78,0.4);
      color: #7cff4e;
    }
    .result-icon-error {
      background: rgba(239,68,68,0.12);
      border: 2px solid rgba(239,68,68,0.35);
      color: #f87171;
    }

    .result-card h2 { font-size: 1.4rem; font-weight: 800; margin: 0 0 0.75rem; }
    .result-card p { font-size: 0.9rem; color: rgba(255,255,255,0.5); line-height: 1.6; margin: 0; }
    .result-card strong { color: rgba(255,255,255,0.8); }

    /* ── Form card ── */
    .form-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 2.5rem 2rem;
    }

    .form-header { margin-bottom: 2rem; }
    .form-kicker {
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: #7cff4e; margin: 0 0 0.4rem;
    }
    .form-title { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.6rem; letter-spacing: -0.02em; }
    .form-sub { font-size: 0.85rem; color: rgba(255,255,255,0.42); line-height: 1.6; margin: 0; }

    .form-body { display: flex; flex-direction: column; gap: 0.5rem; }

    .field-label {
      font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.55);
      text-transform: uppercase; letter-spacing: 0.07em;
      margin-top: 0.75rem;
    }

    .field-input {
      width: 100%; box-sizing: border-box;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.11);
      border-radius: 10px;
      padding: 0.7rem 0.95rem;
      color: #fff; font-size: 0.9rem;
      outline: none; transition: border-color 0.15s;
      font-family: inherit;
    }
    .field-input:focus { border-color: rgba(124,255,78,0.45); }
    .field-input::placeholder { color: rgba(255,255,255,0.2); }

    .field-textarea { resize: vertical; min-height: 120px; line-height: 1.55; }

    /* ── Star picker ── */
    .star-picker {
      display: flex; align-items: center; gap: 0.2rem;
      margin-bottom: 0.25rem;
    }

    .star-btn {
      background: none; border: none; cursor: pointer;
      font-size: 2.2rem; color: rgba(255,255,255,0.15);
      padding: 0 0.1rem; line-height: 1;
      transition: color 0.12s, transform 0.1s;
    }
    .star-btn:hover { transform: scale(1.15); color: rgba(124,255,78,0.5); }
    .star-active { color: #7cff4e; filter: drop-shadow(0 0 5px rgba(124,255,78,0.6)); }

    .star-label {
      font-size: 0.8rem; color: rgba(255,255,255,0.35);
      margin-left: 0.5rem; min-width: 4rem;
    }

    .field-error {
      font-size: 0.82rem; color: #f87171; margin: 0.25rem 0 0;
    }

    .btn-submit {
      margin-top: 1.25rem;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.9rem;
      background: #7cff4e; color: #081209;
      font-weight: 700; font-size: 0.95rem;
      border: none; border-radius: 10px; cursor: pointer;
      letter-spacing: 0.01em;
      transition: background 0.15s, box-shadow 0.15s, transform 0.12s;
      box-shadow: 0 0 22px rgba(124,255,78,0.35), 0 4px 14px rgba(0,0,0,0.3);
    }
    .btn-submit:hover:not(:disabled) {
      background: #8fff5e;
      box-shadow: 0 0 36px rgba(124,255,78,0.55), 0 4px 18px rgba(0,0,0,0.3);
      transform: translateY(-1px);
    }
    .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

    .spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(8,18,9,0.3);
      border-top-color: #081209;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 540px) {
      .form-card { padding: 2rem 1.25rem; border-radius: 14px; }
      .result-card { padding: 2.5rem 1.25rem; border-radius: 14px; }
    }
  `],
})
export class ReviewFormComponent {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  state = signal<'loading' | 'form' | 'done' | 'not-found'>('loading');
  clubName = signal('');
  submittedName = signal('');
  submitting = signal(false);
  errorMsg = signal('');

  form = { reviewerName: '', rating: 5, text: '' };

  private readonly labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  ratingLabel() { return this.labels[this.form.rating] ?? ''; }

  constructor() {
    const clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
    this.http.get<{ name: string; status: string }>(`${environment.apiUrl}/public/${clubId}`)
      .subscribe({
        next: (club) => {
          if (club.status === 'suspended') { this.state.set('not-found'); return; }
          this.clubName.set(club.name);
          this.form.reviewerName = club.name;
          this.state.set('form');
        },
        error: () => this.state.set('not-found'),
      });
  }

  submit() {
    this.errorMsg.set('');
    if (!this.form.text.trim()) { this.errorMsg.set('Please write your review.'); return; }

    const clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
    this.submitting.set(true);
    this.http.post(`${environment.apiUrl}/public/review/${clubId}`, this.form).subscribe({
      next: () => {
        this.submittedName.set(this.form.reviewerName.trim());
        this.submitting.set(false);
        this.state.set('done');
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Submission failed. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
