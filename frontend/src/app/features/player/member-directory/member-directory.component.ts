import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { CoinsService } from '../../../core/services/coins.service';

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
    <div class="directory-container">
      <div class="court-bg">
        <div class="court-overlay"></div>
      </div>

      <div class="page-card">
        <div class="directory-header">
          <h1>Member Directory</h1>
          <p class="subtitle">Connect with other tennis enthusiasts</p>
        </div>

        <div class="directory-content">
          <div class="search-section">
            <input
              type="text"
              placeholder="Search members by name..."
              class="search-input"
              [(ngModel)]="searchQuery"
              (input)="filterMembers()"
            />
            <span class="search-icon">🔍</span>
          </div>

          @if (loading) {
            <div class="loading">Loading members...</div>
          } @else if (filteredMembers.length === 0) {
            <div class="empty-state">
              <span>🎾</span>
              <p>No members found</p>
            </div>
          } @else {
            <div class="members-grid">
              @for (member of filteredMembers; track member._id) {
                <div class="member-card">
                  <div class="member-avatar">
                    @if (member.profileImage) {
                      <img [src]="member.profileImage" [alt]="member.name" class="profile-image" />
                    } @else {
                      <span class="initials">{{ member.name | slice: 0 : 1 }}</span>
                    }
                  </div>
                  <div class="member-info">
                    <h3>{{ member.name }}</h3>
                    @if (member.email) {
                      <p class="member-email">{{ member.email }}</p>
                    }
                    @if (member.contactNumber) {
                      <p class="member-phone">{{ member.contactNumber }}</p>
                    }
                    @if (member.gender) {
                      <p class="member-gender">{{ member.gender }}</p>
                    }
                    <button class="btn-connect" (click)="connectMember(member.name)">
                      Connect
                    </button>
                  </div>
                </div>
              }
            </div>
            <div class="members-count">
              Showing {{ filteredMembers.length }} of {{ members.length }} members
            </div>
          }
        </div>

        <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: auto;
      }
      .directory-container {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        margin: 0;
        min-height: calc(100vh - 60px);
      }
      .court-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: url('/tennis-court-surface.png') center center / cover no-repeat;
        z-index: 0;
      }
      .court-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 18, 0, 0.35);
        z-index: 0;
      }
      .page-card {
        position: relative;
        z-index: 1;
        background: #fff;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
      }
      .directory-header {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        padding: 2rem;
        text-align: center;
        color: white;
      }
      .directory-header h1 {
        font-size: 2rem;
        color: #fff;
        font-weight: 800;
        margin: 0 0 0.5rem 0;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      .subtitle {
        color: rgba(255, 255, 255, 0.88);
        font-size: 1rem;
        margin: 0;
        font-style: italic;
      }
      .directory-content {
        padding: 2rem;
      }
      .search-section {
        position: relative;
        margin-bottom: 2rem;
      }
      .search-input {
        width: 100%;
        padding: 0.75rem 1rem 0.75rem 2.5rem;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        font-size: 1rem;
        transition: all 0.3s;
      }
      .search-input:focus {
        outline: none;
        border-color: #9f7338;
        box-shadow: 0 0 0 3px rgba(159, 115, 56, 0.1);
      }
      .search-icon {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 1.2rem;
      }
      .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
      }
      .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #999;
      }
      .empty-state span {
        font-size: 3rem;
        display: block;
        margin-bottom: 0.5rem;
      }
      .members-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }
      .member-card {
        background: white;
        border: 2px solid #f0f0f0;
        border-radius: 15px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }
      .member-card:hover {
        border-color: #9f7338;
        box-shadow: 0 8px 20px rgba(159, 115, 56, 0.15);
        transform: translateY(-4px);
      }
      .member-avatar {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 1rem;
        overflow: hidden;
        border: 3px solid #f8f1e4;
      }
      .profile-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .initials {
        font-size: 1.5rem;
        font-weight: 700;
      }
      .member-info h3 {
        font-size: 1.1rem;
        color: #1a1a1a;
        margin: 0 0 0.5rem 0;
        font-weight: 700;
      }
      .member-email {
        color: #666;
        font-size: 0.85rem;
        margin: 0.25rem 0;
        word-break: break-all;
      }
      .member-phone {
        color: #888;
        font-size: 0.85rem;
        margin: 0.25rem 0;
      }
      .member-gender {
        color: #888;
        font-size: 0.8rem;
        margin: 0.25rem 0;
        font-style: italic;
      }
      .btn-connect {
        background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 1rem;
        transition: all 0.3s;
        font-size: 0.9rem;
      }
      .btn-connect:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(159, 115, 56, 0.3);
      }
      .members-count {
        text-align: center;
        color: #999;
        font-size: 0.9rem;
        margin-top: 1rem;
      }
      .btn-back {
        display: block;
        margin: 2rem auto;
        background: rgba(159, 115, 56, 0.1);
        color: #9f7338;
        border: 2px solid #9f7338;
        padding: 0.7rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        font-size: 0.95rem;
      }
      .btn-back:hover {
        background: #9f7338;
        color: white;
      }

      @media (max-width: 768px) {
        :host {
          display: block;
          width: 100%;
          min-height: 100%;
        }
        .directory-container {
          position: relative;
          width: 100%;
          min-height: auto;
          align-items: flex-start;
          padding: 1rem;
          padding-top: 1.5rem;
        }
        .page-card {
          max-width: 100%;
          margin-bottom: 2rem;
        }
        .directory-header {
          padding: 1.5rem;
        }
        .directory-header h1 {
          font-size: 1.5rem;
        }
        .directory-content {
          padding: 1.25rem;
        }
        .members-grid {
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.75rem;
        }
      }

      @media (max-width: 480px) {
        .directory-header h1 {
          font-size: 1.3rem;
        }
        .members-grid {
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .member-card {
          padding: 0.75rem;
          border-radius: 12px;
        }
        .member-avatar {
          width: 45px;
          height: 45px;
          font-size: 1.2rem;
          margin-bottom: 0.5rem;
        }
        .member-info h3 {
          font-size: 0.9rem;
          margin: 0 0 0.25rem 0;
        }
        .member-email {
          font-size: 0.75rem;
        }
        .member-phone {
          display: none;
        }
        .member-gender {
          display: none;
        }
        .btn-connect {
          padding: 0.35rem 0.75rem;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }
        .directory-content {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class MemberDirectoryComponent implements OnInit {
  members: Member[] = [];
  filteredMembers: Member[] = [];
  searchQuery = '';
  loading = true;

  constructor(
    private usersService: UsersService,
    private coinsService: CoinsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.coinsService.trackVisit('member-directory').subscribe({ error: () => {} });
    this.loadMembers();
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

