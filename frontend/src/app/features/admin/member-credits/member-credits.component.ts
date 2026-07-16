import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CreditService, MemberBalance, CreditEntry } from '../../../core/services/credit.service';

@Component({
  selector: 'app-member-credits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="page-card">

        <!-- Header -->
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <div class="header-center">
            <h2>Member Credits</h2>
          </div>
          <div class="header-stats">
            <div class="stat-pill">
              <span class="stat-num">{{ members.length }}</span>
              <span class="stat-lbl">Members</span>
            </div>
            <div class="stat-pill stat-pill-green">
              <span class="stat-num">{{ totalOutstandingCredit | currency:'PHP':'symbol':'1.0-0' }}</span>
              <span class="stat-lbl">Total Credit</span>
            </div>
          </div>
        </div>

        <div class="card-body">
          <!-- Search -->
          <div class="search-bar">
            <i class="fas fa-search search-icon"></i>
            <input type="text" placeholder="Search by name or email..." [(ngModel)]="searchQuery" (ngModelChange)="applySearch()" />
          </div>

          @if (loading) {
            <div class="loading"><i class="fas fa-circle-notch fa-spin"></i> Loading members...</div>
          } @else if (filteredMembers.length === 0) {
            <div class="empty-state">
              <div class="empty-icon"><i class="fas fa-search"></i></div>
              <p class="empty-title">No results</p>
              <p class="empty-sub">No members match "{{ searchQuery }}"</p>
            </div>
          } @else {
            <div class="table-wrap">
              <table class="members-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of filteredMembers; track member._id) {
                    <tr>
                      <td>
                        <div class="table-member">
                          <div class="table-avatar">{{ getInitials(member.name) }}</div>
                          <div>
                            <div class="table-name">{{ member.name }}</div>
                            <div class="table-email">{{ member.email }}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="balance-amount" [class.balance-zero]="member.balance <= 0">
                          {{ member.balance | currency:'PHP':'symbol' }}
                        </span>
                      </td>
                      <td class="col-actions">
                        <button class="action-btn btn-grant" (click)="openGrantModal(member)">
                          <i class="fas fa-plus"></i>
                          <span>Grant Credit</span>
                        </button>
                        <button class="action-btn btn-history" (click)="openHistoryModal(member)">
                          <i class="fas fa-history"></i>
                          <span>History</span>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="table-footer">{{ filteredMembers.length }} of {{ members.length }} members</div>
          }
        </div>
      </div>
    </div>

    <!-- Grant Credit Modal -->
    @if (grantModalMember) {
      <div class="modal-overlay" (click)="closeGrantModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Grant Credit</h3>
            <button class="modal-close" (click)="closeGrantModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="modal-member">
              <div class="table-avatar">{{ getInitials(grantModalMember.name) }}</div>
              <div>
                <div class="table-name">{{ grantModalMember.name }}</div>
                <div class="table-email">{{ grantModalMember.email }}</div>
              </div>
            </div>
            <label class="field-label">Amount (₱)</label>
            <input type="number" class="field-input" min="1" step="1" [(ngModel)]="grantAmount" placeholder="e.g. 850" />
            <label class="field-label">Reason</label>
            <textarea class="field-input" rows="3" [(ngModel)]="grantReason" placeholder="e.g. Refund for reservation cancelled due to weather"></textarea>
            @if (grantError) {
              <div class="modal-error">{{ grantError }}</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeGrantModal()">Cancel</button>
            <button class="btn-confirm" [disabled]="submittingGrant" (click)="submitGrant()">
              @if (submittingGrant) {
                <i class="fas fa-circle-notch fa-spin"></i>
              } @else {
                <span>Grant Credit</span>
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- History Modal -->
    @if (historyModalMember) {
      <div class="modal-overlay" (click)="closeHistoryModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Credit History — {{ historyModalMember.name }}</h3>
            <button class="modal-close" (click)="closeHistoryModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            @if (historyLoading) {
              <div class="loading"><i class="fas fa-circle-notch fa-spin"></i> Loading history...</div>
            } @else if (historyEntries.length === 0) {
              <div class="empty-state">
                <p class="empty-sub">No credit activity yet.</p>
              </div>
            } @else {
              <div class="history-list">
                @for (entry of historyEntries; track entry._id) {
                  <div class="history-item">
                    <div class="history-icon" [class.history-icon-grant]="entry.type === 'grant'">
                      <i class="fas" [class.fa-plus]="entry.type === 'grant'" [class.fa-minus]="entry.type === 'redemption'"></i>
                    </div>
                    <div class="history-info">
                      <div class="history-reason">{{ entry.reason || (entry.type === 'redemption' ? 'Applied to a charge' : '—') }}</div>
                      <div class="history-meta">{{ entry.createdAt | date:'MMM d, yyyy h:mm a' }}</div>
                    </div>
                    <div class="history-amount" [class.amount-negative]="entry.amount < 0">
                      {{ entry.amount > 0 ? '+' : '' }}{{ entry.amount | currency:'PHP':'symbol' }}
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .page-wrap {
      display: block;
      min-height: calc(100vh - 60px);
      padding: 1.5rem;
      background: var(--dm-bg);
    }
    .page-card {
      background: var(--dm-surface);
      border: 1px solid rgba(163,230,53,0.12);
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.32);
      max-width: 1080px;
      margin: 0 auto;
      overflow: hidden;
    }

    .card-header {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
      background: var(--dm-header);
    }
    .back-btn {
      background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.24);
      color: var(--dm-accent); font-size: 0.875rem; cursor: pointer; padding: 7px 14px;
      border-radius: 8px; transition: background 0.15s; white-space: nowrap; font-family: inherit;
    }
    .back-btn:hover { background: rgba(163,230,53,0.2); }
    .header-center { flex: 1; }
    .header-center h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #ffffff; }
    .header-stats { display: flex; gap: 10px; }
    .stat-pill {
      display: flex; flex-direction: column; align-items: center;
      background: rgba(163,230,53,0.08); border: 1px solid rgba(163,230,53,0.18);
      border-radius: 10px; padding: 6px 14px; min-width: 56px;
    }
    .stat-pill-green { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.22); }
    .stat-num { font-size: 1.1rem; font-weight: 800; color: #ffffff; line-height: 1; }
    .stat-lbl { font-size: 0.65rem; color: rgba(255,255,255,0.58); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }

    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 48px; color: rgba(255,255,255,0.6); font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 10px; }

    .empty-state { text-align: center; padding: 56px 20px; }
    .empty-icon { font-size: 3rem; margin-bottom: 12px; }
    .empty-icon i { color: rgba(163,230,53,0.35); }
    .empty-title { font-size: 1.1rem; font-weight: 700; color: #ffffff; margin: 0 0 4px; }
    .empty-sub { font-size: 0.875rem; color: rgba(255,255,255,0.6); margin: 0; }

    .search-bar { position: relative; margin-bottom: 18px; }
    .search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #aaa; font-size: 0.85rem; }
    .search-bar input {
      width: 100%; padding: 9px 12px 9px 36px; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; font-size: 0.875rem; box-sizing: border-box; font-family: inherit; background: rgba(255,255,255,0.04); color: #ffffff;
    }
    .search-bar input::placeholder { color: rgba(255,255,255,0.45); }
    .search-bar input:focus { outline: none; border-color: rgba(163,230,53,0.28); box-shadow: 0 0 0 3px rgba(163,230,53,0.12); }

    .table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); }
    .members-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .members-table th {
      background: rgba(255,255,255,0.04); padding: 11px 14px; text-align: left;
      font-size: 0.73rem; font-weight: 700; color: rgba(255,255,255,0.62);
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(184,137,66,0.15);
    }
    .members-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #ffffff; }
    .members-table tbody tr:last-child td { border-bottom: none; }
    .members-table tbody tr:hover { background: rgba(255,255,255,0.03); }

    .table-member { display: flex; align-items: center; gap: 12px; }
    .table-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(163,230,53,0.12); border: 1.5px solid rgba(163,230,53,0.24);
      color: var(--dm-accent); font-size: 0.78rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .table-name { font-weight: 600; color: #ffffff; font-size: 0.875rem; }
    .table-email { font-size: 0.75rem; color: rgba(255,255,255,0.56); margin-top: 1px; }

    .balance-amount { font-weight: 700; color: #86efac; }
    .balance-zero { color: rgba(255,255,255,0.4); font-weight: 500; }

    .col-actions { white-space: nowrap; display: flex; gap: 8px; }
    .action-btn {
      display: flex; align-items: center; gap: 6px; padding: 7px 13px;
      border: 1px solid transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600;
      cursor: pointer; transition: all 0.15s; font-family: inherit;
    }
    .btn-grant { background: rgba(163,230,53,0.16); border-color: rgba(163,230,53,0.28); color: var(--dm-accent); }
    .btn-grant:hover { background: rgba(163,230,53,0.24); }
    .btn-history { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.75); }
    .btn-history:hover { background: rgba(255,255,255,0.08); }

    .table-footer {
      text-align: right; font-size: 0.78rem; color: rgba(255,255,255,0.55);
      padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.06);
    }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal {
      background: var(--dm-surface); border: 1px solid rgba(163,230,53,0.16);
      border-radius: 14px; width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .modal-header h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #ffffff; }
    .modal-close { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 1rem; cursor: pointer; padding: 4px; }
    .modal-close:hover { color: #ffffff; }
    .modal-body { padding: 20px; }
    .modal-member { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .field-label { display: block; font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.7); margin: 14px 0 6px; }
    .field-label:first-of-type { margin-top: 0; }
    .field-input {
      width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; font-family: inherit;
      background: rgba(255,255,255,0.04); color: #ffffff; resize: vertical;
    }
    .field-input:focus { outline: none; border-color: rgba(163,230,53,0.28); box-shadow: 0 0 0 3px rgba(163,230,53,0.12); }
    .modal-error { color: #fca5a5; font-size: 0.82rem; margin-top: 10px; }
    .modal-footer { display: flex; gap: 10px; padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.08); }
    .btn-cancel, .btn-confirm {
      flex: 1; padding: 10px; border-radius: 8px; font-size: 0.875rem; font-weight: 700;
      cursor: pointer; border: 1px solid transparent; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-cancel { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.75); }
    .btn-cancel:hover { background: rgba(255,255,255,0.08); }
    .btn-confirm { background: var(--dm-accent); color: #0a0f0a; }
    .btn-confirm:hover:not(:disabled) { filter: brightness(1.08); }
    .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

    .history-list { display: flex; flex-direction: column; gap: 10px; }
    .history-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .history-item:last-child { border-bottom: none; }
    .history-icon {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      background: rgba(239,68,68,0.14); color: #fca5a5;
      display: flex; align-items: center; justify-content: center; font-size: 0.75rem;
    }
    .history-icon-grant { background: rgba(163,230,53,0.14); color: var(--dm-accent); }
    .history-info { flex: 1; min-width: 0; }
    .history-reason { font-size: 0.85rem; color: #ffffff; }
    .history-meta { font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 2px; }
    .history-amount { font-weight: 700; color: #86efac; white-space: nowrap; }
    .amount-negative { color: #fca5a5; }

    @media (max-width: 640px) {
      .card-header { flex-direction: column; align-items: flex-start; }
      .header-stats { width: 100%; }
      .col-actions { flex-direction: column; align-items: stretch; }
    }
  `]
})
export class MemberCreditsComponent implements OnInit {
  members: MemberBalance[] = [];
  filteredMembers: MemberBalance[] = [];
  loading = true;
  searchQuery = '';

  grantModalMember: MemberBalance | null = null;
  grantAmount: number | null = null;
  grantReason = '';
  grantError = '';
  submittingGrant = false;

  historyModalMember: MemberBalance | null = null;
  historyEntries: CreditEntry[] = [];
  historyLoading = false;

  get totalOutstandingCredit() {
    return this.members.reduce((sum, m) => sum + m.balance, 0);
  }

  constructor(
    private creditService: CreditService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadMembers();
  }

  loadMembers() {
    this.loading = true;
    this.creditService.getMembersWithBalances().subscribe({
      next: (members) => {
        this.members = members;
        this.applySearch();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applySearch() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredMembers = q
      ? this.members.filter(m => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      : this.members;
  }

  getInitials(name: string): string {
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  openGrantModal(member: MemberBalance) {
    this.grantModalMember = member;
    this.grantAmount = null;
    this.grantReason = '';
    this.grantError = '';
  }

  closeGrantModal() {
    this.grantModalMember = null;
  }

  submitGrant() {
    if (!this.grantModalMember) return;
    if (!this.grantAmount || this.grantAmount <= 0) {
      this.grantError = 'Enter a valid amount greater than ₱0.';
      return;
    }
    if (!this.grantReason.trim()) {
      this.grantError = 'A reason is required.';
      return;
    }

    this.grantError = '';
    this.submittingGrant = true;
    this.creditService.grantCredit(this.grantModalMember._id, this.grantAmount, this.grantReason.trim()).subscribe({
      next: ({ newBalance }) => {
        const member = this.members.find(m => m._id === this.grantModalMember!._id);
        if (member) member.balance = newBalance;
        this.applySearch();
        this.submittingGrant = false;
        this.closeGrantModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.grantError = err?.error?.error || 'Failed to grant credit. Please try again.';
        this.submittingGrant = false;
        this.cdr.detectChanges();
      },
    });
  }

  openHistoryModal(member: MemberBalance) {
    this.historyModalMember = member;
    this.historyEntries = [];
    this.historyLoading = true;
    this.creditService.getMemberHistory(member._id).subscribe({
      next: ({ history }) => {
        this.historyEntries = history;
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  closeHistoryModal() {
    this.historyModalMember = null;
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }
}
