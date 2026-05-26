import { Component, OnInit, OnDestroy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';

interface Member {
  _id: string;
  name: string;
  email: string;
  contactNumber?: string;
  gender?: string;
  createdAt: string;
  profileImage?: string;
}

@Component({
  selector: 'app-member-directory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dm-shell">
      <!-- Mobile header -->
      <header class="dm-header">
        <button class="dm-back-btn" (click)="navigateTo('/player/dashboard')">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">Members</span>
        @if (!loading) {
          <span class="dm-header-count">{{ filteredMembers.length }}</span>
        }
      </header>

      <!-- Search bar -->
      <div class="dm-search-bar">
        <i class="fas fa-search dm-search-icon"></i>
        <input
          type="text"
          class="dm-search-input"
          placeholder="Search members by name…"
          [(ngModel)]="searchQuery"
          (input)="filterMembers()"
        />
        @if (searchQuery) {
          <button class="dm-search-clear" (click)="searchQuery = ''; filterMembers()">
            <i class="fas fa-times"></i>
          </button>
        }
      </div>

      <div class="dm-body">
        @if (loading) {
          <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading members…</div>
        } @else if (filteredMembers.length === 0) {
          <div class="dm-empty">
            <i class="fas fa-user-friends"></i>
            <p>{{ searchQuery ? 'No members match your search.' : 'No members yet.' }}</p>
          </div>
        } @else {
          <div class="dm-section-label">
            {{ filteredMembers.length }} member{{ filteredMembers.length !== 1 ? 's' : '' }}
            @if (searchQuery) { matching "{{ searchQuery }}" }
          </div>

          <div class="dm-members-grid">
            @for (member of filteredMembers; track member._id) {
              <div class="dm-member-card">
                <div class="dm-member-avatar">
                  @if (member.profileImage) {
                    <img [src]="member.profileImage" [alt]="member.name" class="dm-avatar-img" />
                  } @else {
                    <span class="dm-avatar-initials">{{ member.name | slice: 0 : 1 }}</span>
                  }
                </div>
                <div class="dm-member-name">{{ member.name }}</div>
                @if (member.gender) {
                  <div class="dm-member-meta">{{ member.gender }}</div>
                }
                @if (member.contactNumber) {
                  <div class="dm-member-meta">{{ member.contactNumber }}</div>
                }
              </div>
            }
          </div>
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
        <button class="dm-nav-item" (click)="navigateTo('/player/profile/edit')">
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
        max-width: 900px;
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

    .dm-header-count {
      font-size: 0.78rem;
      font-weight: 700;
      color: rgba(255,255,255,0.45);
    }

    /* Search */
    .dm-search-bar {
      background: #111f16;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-shrink: 0;
    }

    .dm-search-icon { color: rgba(255,255,255,0.35); font-size: 0.85rem; }

    .dm-search-input {
      flex: 1;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 0.5rem 0.8rem;
      color: #ffffff;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .dm-search-input:focus { border-color: rgba(163,230,53,0.4); }
    .dm-search-input::placeholder { color: rgba(255,255,255,0.28); }

    .dm-search-clear {
      background: none;
      border: none;
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      padding: 0.3rem;
      font-size: 0.8rem;
    }

    /* Body */
    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 769px) {
      .dm-body {
        overflow-y: visible;
        padding: 2rem 2.5rem 2rem;
        display: block;
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

    .dm-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.35);
    }
    .dm-empty i { font-size: 2rem; display: block; margin-bottom: 0.75rem; opacity: 0.3; }
    .dm-empty p { margin: 0; font-size: 0.88rem; }

    .dm-section-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: rgba(255,255,255,0.40);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.75rem;
    }

    /* Members grid */
    .dm-members-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.7rem;
    }
    @media (min-width: 480px) {
      .dm-members-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (min-width: 769px) {
      .dm-members-grid { grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
    }

    .dm-member-card {
      background: #1b3028;
      border-radius: 14px;
      padding: 1rem 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.4rem;
      transition: background 0.2s, transform 0.15s;
    }
    .dm-member-card:hover { background: #213830; transform: translateY(-2px); }

    .dm-member-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(163,230,53,0.15);
      border: 2px solid rgba(163,230,53,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-bottom: 0.25rem;
    }

    .dm-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

    .dm-avatar-initials {
      font-size: 1.2rem;
      font-weight: 800;
      color: #a3e635;
      text-transform: uppercase;
    }

    .dm-member-name {
      font-size: 0.82rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }

    .dm-member-meta {
      font-size: 0.67rem;
      color: rgba(255,255,255,0.42);
    }

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
export class MemberDirectoryComponent implements OnInit, OnDestroy {
  members: Member[] = [];
  filteredMembers: Member[] = [];
  searchQuery = '';
  loading = true;

  constructor(
    private usersService: UsersService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.renderer.addClass(document.documentElement, 'dark-player-page');
    this.renderer.addClass(document.body, 'dark-player-page');
    this.loadMembers();
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.documentElement, 'dark-player-page');
    this.renderer.removeClass(document.body, 'dark-player-page');
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  loadMembers() {
    this.usersService.getDirectoryMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.filteredMembers = members;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading members:', err);
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  filterMembers() {
    const query = this.searchQuery.toLowerCase();
    this.filteredMembers = this.members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) || member.email?.toLowerCase().includes(query),
    );
  }

  connectMember(name: string) {
    alert(`Connect request sent to ${name}!`);
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
