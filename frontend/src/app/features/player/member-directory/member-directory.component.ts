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
      <header class="dm-header">
        <button class="dm-back-btn" (click)="navigateTo('/player/dashboard')" aria-label="Back to dashboard">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="dm-header-title">Member Directory</span>
        @if (!loading) {
          <span class="dm-header-count">{{ filteredMembers.length }}</span>
        }
      </header>

      <div class="dm-body">
        <section class="dm-hero">
          <button class="dm-hero-back" (click)="navigateTo('/player/dashboard')" aria-label="Back to dashboard">
            <i class="fas fa-arrow-left"></i>
          </button>
          <div class="dm-hero-copy">
            <span class="dm-eyebrow"><i class="fas fa-address-book"></i> Club community</span>
            <h1>Member Directory</h1>
            <p>Find club members, check contact details, and keep your tennis and pickleball circle close.</p>
          </div>
          <div class="dm-stats" aria-label="Directory summary">
            <div class="dm-stat">
              <strong>{{ members.length }}</strong>
              <span>Total members</span>
            </div>
            <div class="dm-stat">
              <strong>{{ membersWithContacts() }}</strong>
              <span>With contact</span>
            </div>
            <div class="dm-stat">
              <strong>{{ filteredMembers.length }}</strong>
              <span>Showing</span>
            </div>
          </div>
        </section>

        <section class="dm-toolbar">
          <div class="dm-search-bar">
            <i class="fas fa-search dm-search-icon"></i>
            <input
              type="text"
              class="dm-search-input"
              placeholder="Search by name or email"
              [(ngModel)]="searchQuery"
              (input)="filterMembers()"
            />
            @if (searchQuery) {
              <button class="dm-search-clear" (click)="searchQuery = ''; filterMembers()" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
            }
          </div>
        </section>

        @if (loading) {
          <div class="dm-state-msg"><i class="fas fa-circle-notch fa-spin"></i> Loading members...</div>
        } @else if (filteredMembers.length === 0) {
          <div class="dm-empty">
            <div class="dm-empty-icon"><i class="fas fa-user-friends"></i></div>
            <h2>{{ searchQuery ? 'No matches found' : 'No members yet' }}</h2>
            <p>{{ searchQuery ? 'Try searching a different name or email.' : 'Approved members will appear here once they join the club.' }}</p>
          </div>
        } @else {
          <div class="dm-list-head">
            <div>
              <span class="dm-section-label">Directory</span>
              <h2>{{ filteredMembers.length }} member{{ filteredMembers.length !== 1 ? 's' : '' }}</h2>
            </div>
            @if (searchQuery) {
              <span class="dm-search-chip">Matching "{{ searchQuery }}"</span>
            }
          </div>

          <div class="dm-members-grid">
            @for (member of filteredMembers; track member._id) {
              <div class="dm-member-card">
                <div class="dm-card-top">
                  <div class="dm-member-avatar">
                    @if (member.profileImage) {
                      <img [src]="member.profileImage" [alt]="member.name" class="dm-avatar-img" />
                    } @else {
                      <span class="dm-avatar-initials">{{ initials(member.name) }}</span>
                    }
                  </div>
                  @if (member.gender) {
                    <span class="dm-gender-pill">{{ member.gender }}</span>
                  }
                </div>
                <div class="dm-member-main">
                  <div class="dm-member-name">{{ member.name }}</div>
                  <div class="dm-member-meta"><i class="fas fa-envelope"></i> {{ member.email }}</div>
                  @if (member.contactNumber) {
                    <div class="dm-member-meta"><i class="fas fa-phone"></i> {{ member.contactNumber }}</div>
                  } @else {
                    <div class="dm-member-meta muted"><i class="fas fa-phone-slash"></i> No contact number</div>
                  }
                </div>
              </div>
            }
          </div>
        }
        <div class="dm-bottom-spacer"></div>
      </div>

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
      background:
        radial-gradient(circle at top left, rgba(163,230,53,.12), transparent 24rem),
        linear-gradient(180deg, #0b1b12 0%, #07130d 34rem);
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      max-width: 480px;
      margin: 0 auto;
      position: relative;
      color: #fff;
    }
    @media (min-width: 769px) {
      .dm-shell {
        max-width: 1180px;
        height: auto;
        min-height: calc(100vh - 60px);
        padding: 0 1rem 2rem;
      }
    }

    .dm-header {
      background: rgba(7,19,13,.96);
      backdrop-filter: blur(10px);
      padding: 1rem 1rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    @media (min-width: 769px) { .dm-header { display: none; } }

    .dm-back-btn,
    .dm-hero-back {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.78);
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      flex-shrink: 0;
    }
    .dm-back-btn { width: 34px; height: 34px; border-radius: 10px; }
    .dm-back-btn:hover,
    .dm-hero-back:hover { background: rgba(255,255,255,0.14); color: #fff; }

    .dm-header-title {
      flex: 1;
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
    }
    .dm-header-count {
      font-size: 0.78rem;
      font-weight: 800;
      color: rgba(255,255,255,0.45);
    }

    .dm-body {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 769px) {
      .dm-body {
        overflow-y: visible;
        padding: 0;
      }
    }

    .dm-hero { display: none; }
    @media (min-width: 769px) {
      .dm-hero {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) auto;
        align-items: end;
        gap: 1rem;
        margin: 1.25rem 0 1rem;
        padding: 1.25rem;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 8px;
        background:
          linear-gradient(135deg, rgba(25,53,42,.95), rgba(9,27,17,.96)),
          url('/tennis-court-surface.png') center / cover;
        box-shadow: 0 18px 50px rgba(0,0,0,.32);
        overflow: hidden;
        position: relative;
      }
      .dm-hero::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(7,19,13,.14), rgba(7,19,13,.72));
        pointer-events: none;
      }
      .dm-hero > * { position: relative; z-index: 1; }
    }

    .dm-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      color: #a3e635;
      font-size: .74rem;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .dm-hero h1 {
      margin: .45rem 0 .45rem;
      color: #fff;
      font-size: clamp(2rem, 4vw, 3.3rem);
      line-height: 1;
      letter-spacing: 0;
    }
    .dm-hero p {
      margin: 0;
      max-width: 650px;
      color: rgba(255,255,255,.72);
      line-height: 1.5;
      font-size: .95rem;
    }
    .dm-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(104px, 1fr));
      gap: .65rem;
      min-width: 360px;
    }
    .dm-stat {
      min-height: 82px;
      padding: .75rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.06);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: .2rem;
    }
    .dm-stat strong { color: #a3e635; font-size: 1.45rem; line-height: 1; }
    .dm-stat span { color: rgba(255,255,255,.62); font-size: .74rem; font-weight: 800; }

    .dm-toolbar {
      background: rgba(17,31,22,.96);
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    @media (min-width: 769px) {
      .dm-toolbar {
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 8px;
        background: rgba(18,37,29,.94);
        margin-bottom: 1rem;
        box-shadow: 0 12px 32px rgba(0,0,0,.18);
      }
    }

    .dm-search-bar {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .dm-search-icon { color: rgba(255,255,255,0.35); font-size: 0.85rem; }
    .dm-search-input {
      flex: 1;
      min-height: 42px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 0.6rem 0.8rem;
      color: #ffffff;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .dm-search-input:focus {
      border-color: rgba(163,230,53,0.4);
      box-shadow: 0 0 0 3px rgba(163,230,53,.09);
    }
    .dm-search-input::placeholder { color: rgba(255,255,255,0.28); }
    .dm-search-clear {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.08);
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
    }

    .dm-state-msg {
      text-align: center;
      padding: 3rem 1rem;
      min-height: 260px;
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
      color: rgba(255,255,255,0.45);
      min-height: 300px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .dm-empty-icon {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: rgba(163,230,53,.1);
      color: #a3e635;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: .75rem;
      font-size: 1.55rem;
    }
    .dm-empty h2 { margin: 0 0 .35rem; color: #fff; font-size: 1.1rem; }
    .dm-empty p { margin: 0; font-size: 0.88rem; max-width: 320px; line-height: 1.45; }

    .dm-list-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1rem .75rem;
    }
    @media (min-width: 769px) {
      .dm-list-head { padding: 0 0 .85rem; }
    }
    .dm-section-label {
      display: block;
      font-size: 0.72rem;
      font-weight: 900;
      color: #a3e635;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 0.15rem;
    }
    .dm-list-head h2 {
      margin: 0;
      color: #fff;
      font-size: 1.1rem;
      line-height: 1.2;
    }
    .dm-search-chip {
      color: rgba(255,255,255,.62);
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 999px;
      padding: .35rem .65rem;
      font-size: .74rem;
      font-weight: 800;
      max-width: 50%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dm-members-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.7rem;
      padding: 0 1rem 1rem;
    }
    @media (min-width: 480px) {
      .dm-members-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (min-width: 769px) {
      .dm-members-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.85rem;
        padding: 0;
      }
    }

    .dm-member-card {
      background: rgba(18,37,29,.94);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      min-width: 0;
      box-shadow: 0 12px 32px rgba(0,0,0,.18);
      transition: border-color 0.2s, transform 0.15s, background 0.2s;
    }
    .dm-member-card:hover {
      border-color: rgba(163,230,53,.32);
      background: rgba(21,45,35,.96);
      transform: translateY(-2px);
    }
    .dm-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: .65rem;
    }
    .dm-member-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(163,230,53,0.15);
      border: 2px solid rgba(163,230,53,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .dm-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .dm-avatar-initials {
      font-size: .95rem;
      font-weight: 900;
      color: #a3e635;
      text-transform: uppercase;
    }
    .dm-gender-pill {
      color: rgba(255,255,255,.72);
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 999px;
      padding: .28rem .55rem;
      font-size: .68rem;
      font-weight: 800;
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dm-member-main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: .35rem;
    }
    .dm-member-name {
      font-size: 0.95rem;
      font-weight: 900;
      color: #ffffff;
      line-height: 1.22;
      overflow-wrap: anywhere;
    }
    .dm-member-meta {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: .4rem;
      font-size: 0.76rem;
      color: rgba(255,255,255,0.55);
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dm-member-meta i {
      width: 14px;
      color: rgba(163,230,53,.7);
      flex: 0 0 14px;
      text-align: center;
      font-size: .72rem;
    }
    .dm-member-meta.muted { color: rgba(255,255,255,.34); }

    .dm-bottom-spacer { height: 80px; }
    @media (min-width: 769px) { .dm-bottom-spacer { display: none; } }

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

    @media (max-width: 420px) {
      .dm-members-grid { grid-template-columns: 1fr; }
      .dm-list-head { align-items: flex-start; flex-direction: column; gap: .5rem; }
      .dm-search-chip { max-width: 100%; }
    }
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

  initials(name: string): string {
    return name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  membersWithContacts(): number {
    return this.members.filter(member => !!member.contactNumber).length;
  }

  connectMember(name: string) {
    alert(`Connect request sent to ${name}!`);
  }

  goBack() {
    this.router.navigate(['/player/dashboard']);
  }
}
