import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ClubService, Club } from '../../../core/services/club.service';
import { MembershipService, Membership } from '../../../core/services/membership.service';

@Component({
  selector: 'app-join-club',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="jc-shell">
      <header class="jc-header">
        <button class="jc-back-btn" (click)="goBack()" aria-label="Back to dashboard">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="jc-header-title">My Clubs</span>
      </header>

      <div class="jc-body">
        @if (message()) {
          <div class="jc-banner success"><i class="fas fa-check-circle"></i> {{ message() }}</div>
        }
        @if (error()) {
          <div class="jc-banner error"><i class="fas fa-exclamation-circle"></i> {{ error() }}</div>
        }

        <section class="jc-section">
          <h2><i class="fas fa-id-card"></i> My memberships</h2>
          @if (loading()) {
            <div class="jc-state"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>
          } @else if (myMemberships().length === 0) {
            <div class="jc-state">No club memberships yet.</div>
          } @else {
            <div class="jc-list">
              @for (m of myMemberships(); track m.club?._id) {
                <div class="jc-card">
                  <div class="jc-club-logo">
                    @if (m.club?.logo) {
                      <img [src]="m.club!.logo" [alt]="m.club!.name" />
                    } @else {
                      <i class="fas fa-building"></i>
                    }
                  </div>
                  <div class="jc-club-main">
                    <div class="jc-club-name">
                      {{ m.club?.name }}
                      @if (m.isHomeClub) { <span class="jc-home-tag">Home club</span> }
                    </div>
                    @if (m.club?.location) {
                      <div class="jc-club-meta"><i class="fas fa-map-marker-alt"></i> {{ m.club?.location }}</div>
                    }
                  </div>
                  <span class="jc-status" [class]="'jc-status ' + m.status">{{ statusLabel(m.status) }}</span>
                </div>
              }
            </div>
          }
        </section>

        <section class="jc-section">
          <h2><i class="fas fa-plus-circle"></i> Join another club</h2>
          <p class="jc-hint">Use your existing account to register with another club. The club admin approves your request before you can book and play there.</p>
          @if (loading()) {
            <div class="jc-state"><i class="fas fa-circle-notch fa-spin"></i> Loading clubs...</div>
          } @else if (joinableClubs().length === 0) {
            <div class="jc-state">No other clubs are available to join right now.</div>
          } @else {
            <div class="jc-list">
              @for (club of joinableClubs(); track club._id) {
                <div class="jc-card">
                  <div class="jc-club-logo">
                    @if (club.logo) {
                      <img [src]="club.logo" [alt]="club.name" />
                    } @else {
                      <i class="fas fa-building"></i>
                    }
                  </div>
                  <div class="jc-club-main">
                    <div class="jc-club-name">{{ club.name }}</div>
                    @if (club.location) {
                      <div class="jc-club-meta"><i class="fas fa-map-marker-alt"></i> {{ club.location }}</div>
                    }
                  </div>
                  <button
                    class="jc-join-btn"
                    [disabled]="joiningClubId() === club._id"
                    (click)="requestJoin(club)"
                  >
                    @if (joiningClubId() === club._id) {
                      <i class="fas fa-circle-notch fa-spin"></i>
                    } @else {
                      {{ wasRejected(club._id) ? 'Request again' : 'Request to join' }}
                    }
                  </button>
                </div>
              }
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .jc-shell {
        min-height: 100vh;
        background: #10151c;
        color: #e8edf4;
      }
      .jc-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.9rem 1rem;
        background: #161d27;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        position: sticky;
        top: 0;
        z-index: 5;
      }
      .jc-back-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e8edf4;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        cursor: pointer;
      }
      .jc-back-btn:hover { background: rgba(255, 255, 255, 0.16); }
      .jc-header-title { font-weight: 700; font-size: 1.05rem; }
      .jc-body { max-width: 720px; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
      .jc-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 10px;
        padding: 0.7rem 0.9rem;
        margin-bottom: 1rem;
        font-size: 0.92rem;
      }
      .jc-banner.success { background: rgba(74, 222, 128, 0.12); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); }
      .jc-banner.error { background: rgba(248, 113, 113, 0.12); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }
      .jc-section { margin-bottom: 1.75rem; }
      .jc-section h2 {
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 0.6rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #c9a15d;
      }
      .jc-hint { color: #93a1b3; font-size: 0.87rem; margin: 0 0 0.8rem; }
      .jc-state { color: #93a1b3; font-size: 0.9rem; padding: 0.75rem 0.25rem; }
      .jc-list { display: flex; flex-direction: column; gap: 0.6rem; }
      .jc-card {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        background: #161d27;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 12px;
        padding: 0.75rem 0.9rem;
      }
      .jc-club-logo {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        color: #93a1b3;
      }
      .jc-club-logo img { width: 100%; height: 100%; object-fit: cover; }
      .jc-club-main { flex: 1; min-width: 0; }
      .jc-club-name {
        font-weight: 600;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .jc-home-tag {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #c9a15d;
        border: 1px solid rgba(201, 161, 93, 0.45);
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
      }
      .jc-club-meta {
        color: #93a1b3;
        font-size: 0.8rem;
        margin-top: 0.15rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .jc-status {
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 999px;
        padding: 0.25rem 0.7rem;
        text-transform: capitalize;
        flex-shrink: 0;
      }
      .jc-status.active { background: rgba(74, 222, 128, 0.14); color: #4ade80; }
      .jc-status.pending { background: rgba(250, 204, 21, 0.14); color: #facc15; }
      .jc-status.rejected { background: rgba(248, 113, 113, 0.14); color: #f87171; }
      .jc-status.deactivated { background: rgba(148, 163, 184, 0.14); color: #94a3b8; }
      .jc-join-btn {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 0.9rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
      }
      .jc-join-btn:disabled { opacity: 0.6; cursor: default; }
      .jc-join-btn:not(:disabled):hover { filter: brightness(1.08); }
    `,
  ],
})
export class JoinClubComponent implements OnInit {
  private clubService = inject(ClubService);
  private membershipService = inject(MembershipService);
  private router = inject(Router);

  protected loading = signal(true);
  protected clubs = signal<Club[]>([]);
  protected joiningClubId = signal<string | null>(null);
  protected message = signal('');
  protected error = signal('');

  protected myMemberships = computed(() =>
    this.membershipService.myMemberships().filter((m) => m.status !== 'rejected'),
  );

  // Clubs open for a join request: not suspended and no blocking membership.
  // A rejected membership may request again; deactivated may not.
  protected joinableClubs = computed(() => {
    const memberships = this.membershipService.myMemberships();
    const blocked = new Set(
      memberships
        .filter((m) => m.status !== 'rejected')
        .map((m) => m.club?._id)
        .filter((id): id is string => !!id),
    );
    return this.clubs().filter((c) => c.status !== 'suspended' && !blocked.has(c._id));
  });

  ngOnInit() {
    this.clubService.getClubs().subscribe({
      next: (clubs) => this.clubs.set(clubs),
      error: () => {},
    });
    this.membershipService.loadMine().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  statusLabel(status: Membership['status']): string {
    return status === 'pending' ? 'Pending approval' : status;
  }

  wasRejected(clubId: string): boolean {
    return this.membershipService
      .myMemberships()
      .some((m) => m.club?._id === clubId && m.status === 'rejected');
  }

  requestJoin(club: Club) {
    this.message.set('');
    this.error.set('');
    this.joiningClubId.set(club._id);
    this.membershipService.joinClub(club._id).subscribe({
      next: () => {
        this.joiningClubId.set(null);
        this.message.set(`Request sent to ${club.name} — pending club admin approval.`);
        this.membershipService.loadMine().subscribe();
      },
      error: (err) => {
        this.joiningClubId.set(null);
        this.error.set(err?.error?.error || 'Could not send the join request. Please try again.');
      },
    });
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
