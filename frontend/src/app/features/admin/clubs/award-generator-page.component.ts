import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClubService, Club } from '../../../core/services/club.service';
import { AwardGeneratorComponent } from './award-generator.component';

@Component({
  selector: 'app-award-generator-page',
  standalone: true,
  imports: [CommonModule, AwardGeneratorComponent],
  template: `
    <div class="agp-wrap">

      <div class="agp-header">
        <button class="agp-back" (click)="back()" title="Back to dashboard">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="agp-header-text">
          <h2 class="agp-title"><i class="fas fa-award"></i> Award Generator</h2>
          <p class="agp-subtitle">Create printable tennis award plaques for your club</p>
        </div>
      </div>

      @if (loading) {
        <div class="agp-state">
          <i class="fas fa-circle-notch fa-spin"></i> Loading club data…
        </div>
      } @else if (club) {
        <app-award-generator [club]="club" />
      } @else {
        <div class="agp-state agp-state-error">
          <i class="fas fa-triangle-exclamation"></i> Could not load club data. Please try again.
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; }

    .agp-wrap {
      min-height: 100%;
    }

    .agp-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.5rem 1.1rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }

    .agp-back {
      background: rgba(255,255,255,0.07);
      border: none;
      color: rgba(255,255,255,0.65);
      width: 34px;
      height: 34px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.88rem;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .agp-back:hover { background: rgba(255,255,255,0.13); }

    .agp-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.2px;
    }
    .agp-title i { color: var(--dm-accent, #a3e635); margin-right: 7px; }

    .agp-subtitle {
      margin: 2px 0 0;
      font-size: 0.72rem;
      color: rgba(255,255,255,0.4);
    }

    .agp-state {
      padding: 3.5rem 2rem;
      text-align: center;
      color: rgba(255,255,255,0.4);
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .agp-state-error { color: #f87171; }
  `],
})
export class AwardGeneratorPageComponent implements OnInit {
  club: Club | null = null;
  loading = true;

  constructor(
    private auth: AuthService,
    private clubService: ClubService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const clubId = this.auth.user()?.clubId;
    if (!clubId) {
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }
    this.clubService.getClub(clubId as string).subscribe({
      next: (club) => {
        this.club = club;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  back(): void {
    this.router.navigate(['/player/dashboard']);
  }
}
