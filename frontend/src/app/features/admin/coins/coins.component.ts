import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CoinsService, CoinRequest, CoinTransaction } from '../../../core/services/coins.service';
import { AuthService } from '../../../core/services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-coins',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="court-bg"><div class="court-overlay"></div></div>
      <div class="page-card">
        <div class="card-header">
          <button class="back-btn" (click)="goBack()">← Back</button>
          <h2><i class="fas fa-coins"></i> Coins</h2>
          <div class="balance-pill">
            <i class="fas fa-coins coin-icon"></i>
            <span class="balance-val">{{ coinsService.coinBalance() }}</span>
            <span class="balance-lbl">coins</span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab === 'requests'" (click)="activeTab = 'requests'">
            My Requests
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'transactions'" (click)="activeTab = 'transactions'">
            Transactions
          </button>
          @if (auth.isSuperAdmin()) {
            <button class="tab-btn tab-btn-super" [class.active]="activeTab === 'approvals'" (click)="activeTab = 'approvals'">
              <span class="super-dot"></span> Approvals
              @if (pendingCount > 0) { <span class="badge-pending">{{ pendingCount }}</span> }
            </button>
          }
        </div>

        <div class="card-body">
          @if (loading) {
            <div class="loading">Loading...</div>
          } @else if (activeTab === 'requests') {

            <!-- Request form -->
            <div class="request-form-card">
              <h4 class="section-title"><i class="fas fa-plus-circle"></i> Request Coins</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Coins</label>
                  <input type="number" min="1" [(ngModel)]="reqCoins" placeholder="e.g. 100" />
                </div>
                <div class="form-group">
                  <label>Payment Method</label>
                  <select [(ngModel)]="reqMethod">
                    <option value="GCash">GCash</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div class="form-group form-group-wide">
                  <label>Note <span class="optional">(optional)</span></label>
                  <input type="text" [(ngModel)]="reqNote" placeholder="e.g. April top-up" />
                </div>
              </div>
              @if (reqError) { <div class="msg-error">{{ reqError }}</div> }
              @if (reqSuccess) { <div class="msg-success">{{ reqSuccess }}</div> }
              <button class="btn-submit" (click)="submitRequest()" [disabled]="submitting || !reqCoins || reqCoins < 1">
                @if (submitting) { <i class="fas fa-circle-notch fa-spin"></i> Submitting... }
                @else { <i class="fas fa-paper-plane"></i> Submit Request }
              </button>
            </div>

            <!-- My requests list -->
            <h4 class="section-title mt"><i class="fas fa-history"></i> Request History</h4>
            @if (myRequests.length === 0) {
              <div class="empty-state"><span>🪙</span><p>No coin requests yet.</p></div>
            } @else {
              <div class="requests-list">
                @for (r of myRequests; track r._id) {
                  <div class="request-card">
                    <div class="req-left">
                      <div class="req-coins"><i class="fas fa-coins"></i> {{ r.coinsRequested }} coins</div>
                      <div class="req-meta">
                        <span class="method-badge" [ngClass]="methodClass(r.paymentMethod)">{{ r.paymentMethod }}</span>
                        <span class="req-date">{{ r.createdAt | date: 'MMM d, yyyy' : 'UTC' }}</span>
                      </div>
                      @if (r.note) { <div class="req-note">📝 {{ r.note }}</div> }
                      @if (r.status === 'rejected' && r.rejectedNote) {
                        <div class="req-rejected-note">❌ {{ r.rejectedNote }}</div>
                      }
                    </div>
                    <span class="status-chip chip-{{ r.status }}">{{ r.status }}</span>
                  </div>
                }
              </div>
            }

          } @else if (activeTab === 'transactions') {

            <div class="transactions-summary">
              <div class="summary-item highlight-blue">
                <div class="summary-value">{{ coinsService.coinBalance() }}</div>
                <div class="summary-label">Current Balance</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ totalDebited }}</div>
                <div class="summary-label">Total Spent</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ totalCredited }}</div>
                <div class="summary-label">Total Received</div>
              </div>
            </div>

            @if (transactions.length === 0) {
              <div class="empty-state"><span>📋</span><p>No transactions yet.</p></div>
            } @else {
              <div class="table-wrap">
                <table class="coins-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Action</th>
                      <th>Member</th>
                      <th class="col-amount">Coins</th>
                      <th class="col-amount">Balance After</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of transactions; track t._id) {
                      <tr>
                        <td class="col-date">{{ t.createdAt | date: 'MMM d, yyyy' : 'UTC' }}</td>
                        <td>
                          <span class="action-badge action-{{ t.action }}">{{ actionLabel(t) }}</span>
                        </td>
                        <td class="col-member">{{ t.userId?.name || '—' }}</td>
                        <td class="col-amount">
                          <span [class.debit-val]="t.type === 'debit'" [class.credit-val]="t.type === 'credit'">
                            {{ t.type === 'debit' ? '-' : '+' }}{{ t.amount }}
                          </span>
                        </td>
                        <td class="col-amount col-balance">{{ t.balanceAfter }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

          } @else if (activeTab === 'approvals' && auth.isSuperAdmin()) {

            <!-- Superadmin: all pending requests -->
            <div class="filter-row">
              <button class="filter-btn" [class.active]="approvalFilter === 'pending'" (click)="approvalFilter = 'pending'; loadApprovals()">Pending</button>
              <button class="filter-btn" [class.active]="approvalFilter === 'approved'" (click)="approvalFilter = 'approved'; loadApprovals()">Approved</button>
              <button class="filter-btn" [class.active]="approvalFilter === 'rejected'" (click)="approvalFilter = 'rejected'; loadApprovals()">Rejected</button>
            </div>

            @if (approvalsLoading) {
              <div class="loading">Loading...</div>
            } @else if (allRequests.length === 0) {
              <div class="empty-state"><span>✅</span><p>No {{ approvalFilter }} requests.</p></div>
            } @else {
              <div class="requests-list">
                @for (r of allRequests; track r._id) {
                  <div class="request-card approval-card">
                    <div class="req-left">
                      <div class="req-club">{{ r.clubId?.name || 'Unknown Club' }}</div>
                      <div class="req-coins"><i class="fas fa-coins"></i> {{ r.coinsRequested }} coins</div>
                      <div class="req-meta">
                        <span class="method-badge" [ngClass]="methodClass(r.paymentMethod)">{{ r.paymentMethod }}</span>
                        <span class="req-by">by {{ r.requestedBy?.name }}</span>
                        <span class="req-date">{{ r.createdAt | date: 'MMM d, yyyy' : 'UTC' }}</span>
                      </div>
                      @if (r.note) { <div class="req-note">📝 {{ r.note }}</div> }
                      @if (r.status === 'rejected' && r.rejectedNote) {
                        <div class="req-rejected-note">❌ {{ r.rejectedNote }}</div>
                      }
                      @if (r.status !== 'pending' && r.approvedBy) {
                        <div class="req-acted-by">{{ r.status === 'approved' ? '✅' : '❌' }} {{ r.approvedBy?.name }}</div>
                      }
                    </div>
                    <div class="req-right">
                      <span class="status-chip chip-{{ r.status }}">{{ r.status }}</span>
                      @if (r.status === 'pending') {
                        <div class="approval-actions">
                          <button class="btn-approve" (click)="approve(r)" [disabled]="actionInProgress === r._id">
                            <i class="fas fa-check"></i>
                          </button>
                          <button class="btn-reject" (click)="openReject(r)" [disabled]="actionInProgress === r._id">
                            <i class="fas fa-times"></i>
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }

          }
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    @if (showRejectModal) {
      <div class="modal-backdrop" (click)="closeRejectModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Reject Request</h3>
            <button class="modal-close" (click)="closeRejectModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="modal-field">
              <label>Reason <span class="optional">(optional)</span></label>
              <input type="text" [(ngModel)]="rejectNote" placeholder="e.g. Payment not received" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel-pay" (click)="closeRejectModal()">Cancel</button>
            <button class="btn-reject-confirm" (click)="confirmReject()">Confirm Reject</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-wrap {
      position: relative; min-height: 100vh; padding: 20px;
      background: linear-gradient(135deg, #9f7338 0%, #c9a15d 100%);
    }
    .court-bg {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: url('/tennis-court-surface.png') center/cover no-repeat; z-index: 0;
    }
    .court-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); }
    .page-card {
      position: relative; z-index: 1; background: white; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 900px; margin: 0 auto; overflow: hidden;
    }
    .card-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; border-bottom: 1px solid #eee;
    }
    .card-header h2 { margin: 0; font-size: 22px; color: #333; flex: 1; display: flex; align-items: center; gap: 8px; }
    .card-header h2 i { color: #f59e0b; }
    .back-btn { background: none; border: none; font-size: 15px; cursor: pointer; padding: 8px 12px; border-radius: 4px; }
    .back-btn:hover { background: #f0f0f0; }
    .balance-pill {
      display: flex; align-items: center; gap: 6px;
      background: #1d4ed8; color: white; border-radius: 20px; padding: 6px 16px;
      font-weight: 700;
    }
    .coin-icon { color: #fcd34d; }
    .balance-val { font-size: 1.1rem; }
    .balance-lbl { font-size: 0.75rem; opacity: 0.85; }

    .tab-bar { display: flex; border-bottom: 2px solid #e9ecef; padding: 0 24px; }
    .tab-btn {
      background: none; border: none; padding: 14px 20px;
      font-size: 0.9rem; font-weight: 600; color: #888; cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s;
      display: flex; align-items: center; gap: 6px;
    }
    .tab-btn:hover { color: #9f7338; }
    .tab-btn.active { color: #9f7338; border-bottom-color: #9f7338; }
    .tab-btn-super { color: #7c3aed; }
    .tab-btn-super:hover { color: #7c3aed; }
    .tab-btn-super.active { color: #7c3aed; border-bottom-color: #7c3aed; }
    .super-dot { width: 7px; height: 7px; border-radius: 50%; background: #7c3aed; }
    .badge-pending {
      background: #dc2626; color: white; font-size: 0.65rem; font-weight: 700;
      padding: 2px 6px; border-radius: 10px;
    }

    .card-body { padding: 24px; }
    .loading { text-align: center; padding: 40px; color: #999; }

    .section-title {
      font-size: 0.85rem; font-weight: 700; color: #555; text-transform: uppercase;
      letter-spacing: 0.5px; margin: 0 0 14px; display: flex; align-items: center; gap: 7px;
    }
    .section-title.mt { margin-top: 28px; }
    .section-title i { color: #9f7338; }

    .request-form-card {
      background: #f8f1e4; border: 1px solid #e6d2ad; border-radius: 10px; padding: 18px 20px;
    }
    .form-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group label { font-size: 0.75rem; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.4px; }
    .form-group .optional { font-weight: 400; color: #999; text-transform: none; letter-spacing: 0; font-size: 0.75rem; }
    .form-group input, .form-group select {
      padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px;
      font-size: 0.9rem; background: white; min-width: 130px;
    }
    .form-group-wide { flex: 1; min-width: 200px; }
    .form-group-wide input { width: 100%; box-sizing: border-box; }
    .btn-submit {
      padding: 9px 20px; background: #9f7338; color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 7px; transition: background 0.15s;
    }
    .btn-submit:hover:not(:disabled) { background: #7a5626; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .msg-error { color: #dc2626; font-size: 0.82rem; margin-bottom: 10px; }
    .msg-success { color: #15803d; font-size: 0.82rem; margin-bottom: 10px; }

    .transactions-summary {
      display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
      padding: 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
    }
    .summary-item { flex: 1; min-width: 100px; text-align: center; padding: 8px 12px; border-radius: 8px; }
    .summary-item.highlight-blue { background: #1d4ed8; }
    .summary-item.highlight-blue .summary-value { color: #fff; font-size: 1.3rem; }
    .summary-item.highlight-blue .summary-label { color: rgba(255,255,255,0.8); }
    .summary-value { font-size: 1.1rem; font-weight: 700; color: #1a1a1a; }
    .summary-label { font-size: 0.72rem; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }

    .requests-list { display: flex; flex-direction: column; gap: 10px; }
    .request-card {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
      padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 10px; background: white;
    }
    .approval-card { border-color: #ddd; }
    .req-left { flex: 1; min-width: 0; }
    .req-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
    .req-club { font-size: 0.78rem; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .req-coins { font-size: 1rem; font-weight: 700; color: #1a1a1a; display: flex; align-items: center; gap: 6px; }
    .req-coins i { color: #f59e0b; }
    .req-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
    .req-by { font-size: 0.78rem; color: #64748b; }
    .req-date { font-size: 0.78rem; color: #94a3b8; }
    .req-note { font-size: 0.78rem; color: #64748b; font-style: italic; margin-top: 4px; }
    .req-rejected-note { font-size: 0.78rem; color: #dc2626; margin-top: 4px; }
    .req-acted-by { font-size: 0.78rem; color: #64748b; margin-top: 4px; }
    .approval-actions { display: flex; gap: 6px; }
    .btn-approve {
      width: 32px; height: 32px; border-radius: 50%; background: #15803d; color: white;
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 0.875rem; transition: background 0.15s;
    }
    .btn-approve:hover:not(:disabled) { background: #166534; }
    .btn-reject {
      width: 32px; height: 32px; border-radius: 50%; background: #dc2626; color: white;
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 0.875rem; transition: background 0.15s;
    }
    .btn-reject:hover:not(:disabled) { background: #991b1b; }
    .btn-approve:disabled, .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

    .filter-row { display: flex; gap: 8px; margin-bottom: 16px; }
    .filter-btn {
      padding: 6px 16px; border-radius: 20px; border: 1.5px solid #e2e8f0;
      background: white; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer;
      transition: all 0.15s;
    }
    .filter-btn:hover { border-color: #9f7338; color: #9f7338; }
    .filter-btn.active { background: #9f7338; color: white; border-color: #9f7338; }

    .empty-state { text-align: center; padding: 48px 20px; color: #999; }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }

    .table-wrap { overflow-x: auto; }
    .coins-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .coins-table th {
      background: #f8f9fa; padding: 10px 12px; text-align: left;
      font-size: 0.75rem; font-weight: 700; color: #555;
      text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e9ecef;
    }
    .coins-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #333; }
    .coins-table tbody tr:hover { background: #fafff9; }
    .col-amount { text-align: right; font-weight: 700; }
    .col-date { color: #555; font-size: 0.82rem; white-space: nowrap; }
    .col-member { font-weight: 600; color: #1a1a1a; }
    .col-balance { color: #1d4ed8; }
    .debit-val { color: #dc2626; }
    .credit-val { color: #15803d; }

    .status-chip { padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize; }
    .chip-pending { background: #fef3c7; color: #92400e; }
    .chip-approved { background: #dcfce7; color: #166534; }
    .chip-rejected { background: #fee2e2; color: #991b1b; }

    .action-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
    .action-reservation { background: #dbeafe; color: #1e40af; }
    .action-tournament-join { background: #ede9fe; color: #5b21b6; }
    .action-page-view { background: #f1f5f9; color: #475569; }
    .action-coin-request-approved { background: #dcfce7; color: #166534; }

    .method-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
    .method-gcash { background: #ede9fe; color: #5b21b6; }
    .method-cash { background: #f2e4c9; color: #7a5626; }
    .method-bank-transfer { background: #e0f2fe; color: #0369a1; }

    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .modal { background: white; border-radius: 14px; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #eee; }
    .modal-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #1a1a1a; }
    .modal-close { background: none; border: none; font-size: 1rem; color: #888; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
    .modal-close:hover { background: #f0f0f0; }
    .modal-body { padding: 20px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field label { font-size: 0.8rem; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 0.4px; }
    .modal-field input { padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; background: white; width: 100%; box-sizing: border-box; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid #eee; background: #f9fafb; }
    .btn-cancel-pay { padding: 9px 16px; background: white; color: #555; border: 1px solid #ddd; border-radius: 8px; font-size: 0.875rem; cursor: pointer; }
    .btn-cancel-pay:hover { background: #f0f0f0; }
    .btn-reject-confirm { padding: 9px 20px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
    .btn-reject-confirm:hover { background: #991b1b; }

    @media (max-width: 640px) {
      .form-row { flex-direction: column; }
      .card-header { flex-wrap: wrap; }
    }
  `],
})
export class AdminCoinsComponent implements OnInit {
  activeTab: 'requests' | 'transactions' | 'approvals' = 'requests';
  loading = true;
  approvalsLoading = false;

  myRequests: CoinRequest[] = [];
  allRequests: CoinRequest[] = [];
  transactions: CoinTransaction[] = [];

  reqCoins: number | null = null;
  reqMethod: 'GCash' | 'Cash' | 'Bank Transfer' = 'GCash';
  reqNote = '';
  submitting = false;
  reqError = '';
  reqSuccess = '';

  approvalFilter: 'pending' | 'approved' | 'rejected' = 'pending';
  actionInProgress: string | null = null;

  showRejectModal = false;
  rejectNote = '';
  rejectTarget: CoinRequest | null = null;

  get pendingCount(): number {
    return this.allRequests.filter(r => r.status === 'pending').length;
  }

  get totalDebited(): number {
    return this.transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  }

  get totalCredited(): number {
    return this.transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  }

  constructor(
    public coinsService: CoinsService,
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (this.auth.isSuperAdmin()) {
      forkJoin({
        balance: this.coinsService.loadBalance(),
        requests: this.coinsService.getAllRequests('pending'),
        transactions: this.coinsService.getTransactions(),
      }).subscribe({
        next: (res) => {
          this.allRequests = res.requests;
          this.transactions = res.transactions;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); },
      });
    } else {
      forkJoin({
        balance: this.coinsService.loadBalance(),
        myRequests: this.coinsService.getMyRequests(),
        transactions: this.coinsService.getTransactions(),
      }).subscribe({
        next: (res) => {
          this.myRequests = res.myRequests;
          this.transactions = res.transactions;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); },
      });
    }
  }

  submitRequest() {
    if (!this.reqCoins || this.reqCoins < 1) return;
    this.submitting = true;
    this.reqError = '';
    this.reqSuccess = '';
    this.coinsService.requestCoins(this.reqCoins, this.reqMethod, this.reqNote || undefined).subscribe({
      next: ({ request }) => {
        this.myRequests = [request, ...this.myRequests];
        this.reqCoins = null;
        this.reqNote = '';
        this.reqSuccess = 'Request submitted successfully!';
        this.submitting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.reqError = err.error?.error || 'Failed to submit request.';
        this.submitting = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadApprovals() {
    this.approvalsLoading = true;
    this.coinsService.getAllRequests(this.approvalFilter).subscribe({
      next: (requests) => {
        this.allRequests = requests;
        this.approvalsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.approvalsLoading = false; this.cdr.detectChanges(); },
    });
  }

  approve(r: CoinRequest) {
    this.actionInProgress = r._id;
    this.coinsService.approveRequest(r._id).subscribe({
      next: ({ request, newBalance }) => {
        this.allRequests = this.allRequests.map(x => x._id === r._id ? request : x);
        this.coinsService.coinBalance.set(newBalance);
        this.actionInProgress = null;
        this.cdr.detectChanges();
      },
      error: () => { this.actionInProgress = null; this.cdr.detectChanges(); },
    });
  }

  openReject(r: CoinRequest) {
    this.rejectTarget = r;
    this.rejectNote = '';
    this.showRejectModal = true;
  }

  closeRejectModal() {
    this.showRejectModal = false;
    this.rejectTarget = null;
  }

  confirmReject() {
    if (!this.rejectTarget) return;
    this.actionInProgress = this.rejectTarget._id;
    this.coinsService.rejectRequest(this.rejectTarget._id, this.rejectNote || undefined).subscribe({
      next: ({ request }) => {
        this.allRequests = this.allRequests.map(x => x._id === request._id ? request : x);
        this.actionInProgress = null;
        this.showRejectModal = false;
        this.rejectTarget = null;
        this.cdr.detectChanges();
      },
      error: () => { this.actionInProgress = null; this.cdr.detectChanges(); },
    });
  }

  actionLabel(t: CoinTransaction): string {
    if (t.action === 'reservation') return 'Reservation';
    if (t.action === 'tournament-join') return 'Tournament Join';
    if (t.action === 'page-view') return `Page: ${t.page}`;
    if (t.action === 'coin-request-approved') return 'Coins Loaded';
    return t.action;
  }

  methodClass(method: string) {
    return {
      'method-gcash': method === 'GCash',
      'method-cash': method === 'Cash',
      'method-bank-transfer': method === 'Bank Transfer',
    };
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }
}
