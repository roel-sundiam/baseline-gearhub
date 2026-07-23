import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { HostedPlayService, FixedDoublesBoard, HostedPlayPair } from '../../../../core/services/hosted-play.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UsersService, User } from '../../../../core/services/users.service';

@Component({
  selector: 'app-player-hosted-play-schedule-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-head">
        <button class="back-btn" (click)="goBack()"><i class="fas fa-arrow-left"></i> Hosted Play</button>
        <div class="head-copy">
          <span class="kicker">Fixed Doubles Rotation</span>
          <h2>{{ board?.session?.title || 'Teams & Schedule' }}</h2>
        </div>
      </header>

      @if (loading) {
        <div class="state"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
      } @else {
        @if (error) { <div class="alert"><i class="fas fa-exclamation-triangle"></i> {{ error }}</div> }

        <section class="panel">
          <div class="panel-head"><h3>Your Team</h3></div>

          @if (myPair && myPair.status === 'confirmed') {
            <div class="my-pair"><i class="fas fa-user-group"></i> You're paired with <strong>{{ partnerName() }}</strong></div>
          } @else if (invitedToMe) {
            <div class="invite-card">
              <p><strong>{{ inviterNameGuess() }}</strong> invited you to team up for this session.</p>
              <div class="invite-actions">
                <button class="primary-action" [disabled]="busy" (click)="respond(true)"><i class="fas fa-check"></i> Accept</button>
                <button class="secondary-action" [disabled]="busy" (click)="respond(false)">Decline</button>
              </div>
            </div>
          } @else if (mySentInvitePending) {
            <div class="invite-card">
              <p><i class="fas fa-hourglass-half"></i> Invite sent — waiting for your partner to accept.</p>
              <button class="secondary-action" [disabled]="busy" (click)="cancelMyInvite()">Cancel invite</button>
            </div>
          } @else {
            <div class="find-partner">
              <p>Join with a partner — invite them and you'll be a fixed team for the whole session.</p>
              <input type="text" [(ngModel)]="partnerFilter" placeholder="Search club members…" (ngModelChange)="filterMembers()" />
              @if (filteredMembers.length > 0) {
                <div class="member-list">
                  @for (m of filteredMembers; track m._id) {
                    <button class="member-row" [disabled]="busy" (click)="invite(m)">
                      {{ m.name }}
                    </button>
                  }
                </div>
              }
            </div>
          }
        </section>

        @if (hasSchedule()) {
          <section class="panel">
            <div class="panel-head"><h3>Live Match Queue</h3></div>
            @if ((board?.currentMatches?.length || 0) > 0) {
              <h4 class="section-label">Current</h4>
              <div class="match-list">@for (f of board!.currentMatches; track f._id) { <ng-container *ngTemplateOutlet="matchRow; context: { f }"></ng-container> }</div>
            }
            @if ((board?.nextMatches?.length || 0) > 0) {
              <h4 class="section-label">Next</h4>
              <div class="match-list">@for (f of board!.nextMatches; track f._id) { <ng-container *ngTemplateOutlet="matchRow; context: { f }"></ng-container> }</div>
            }
            @if ((board?.upcomingMatches?.length || 0) > 0) {
              <h4 class="section-label">Upcoming</h4>
              <div class="match-list">@for (f of board!.upcomingMatches; track f._id) { <ng-container *ngTemplateOutlet="matchRow; context: { f }"></ng-container> }</div>
            }
            @if ((board?.completedMatches?.length || 0) > 0) {
              <h4 class="section-label">Completed</h4>
              <div class="match-list">@for (f of board!.completedMatches; track f._id) { <ng-container *ngTemplateOutlet="matchRow; context: { f }"></ng-container> }</div>
            }
          </section>

          <section class="panel">
            <div class="panel-head"><h3>Standings</h3></div>
            <div class="standings-table">
              <div class="standings-head">
                <span>#</span><span class="col-pair">Pair</span><span>W</span><span>L</span><span>Win%</span><span>Diff</span>
              </div>
              @for (s of board?.standings || []; track s.pairId) {
                <div class="standings-row">
                  <span>{{ s.rank }}</span>
                  <span class="col-pair">{{ s.pairLabel || 'Pair' }}</span>
                  <span>{{ s.wins }}</span>
                  <span>{{ s.losses }}</span>
                  <span>{{ (s.winPct * 100) | number: '1.0-0' }}%</span>
                  <span [class.pos]="s.pointDiff > 0" [class.neg]="s.pointDiff < 0">{{ s.pointDiff > 0 ? '+' : '' }}{{ s.pointDiff }}</span>
                </div>
              }
            </div>
          </section>
        } @else {
          <section class="panel"><p class="empty">The schedule hasn't been generated yet — check back once registration closes.</p></section>
        }
      }
    </div>

    <ng-template #matchRow let-f="f">
      <div class="match-row" [class.completed]="f.status === 'completed'" [class.in-progress]="f.status === 'in_progress'">
        <span class="match-meta">#{{ f.matchNumber }} · Court {{ f.courtNumber }} · {{ f.scheduledStart | date: 'shortTime' }}</span>
        <span class="match-teams">
          <span [class.winner]="f.winnerPairId === f.pair1Id">{{ pairName(f.pair1) }}</span>
          <span class="vs">@if (f.pair1Score !== null && f.pair2Score !== null) { {{ f.pair1Score }}–{{ f.pair2Score }} } @else { vs }</span>
          <span [class.winner]="f.winnerPairId === f.pair2Id">{{ pairName(f.pair2) }}</span>
        </span>
        <span class="status-pill" [ngClass]="f.status">{{ f.status === 'in_progress' ? 'In Progress' : f.status === 'completed' ? 'Completed' : 'Waiting' }}</span>
      </div>
    </ng-template>
  `,
  styles: [`
    .page { max-width: 720px; margin: 0 auto; padding: 20px 16px 60px; display: flex; flex-direction: column; gap: 16px; }
    .page-head { display: flex; align-items: center; gap: 16px; }
    .back-btn { border: none; background: none; color: var(--text-muted, #666); cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
    .head-copy h2 { margin: 2px 0 0; font-size: 1.2rem; }
    .kicker { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent, #2563eb); }
    .state { padding: 40px; text-align: center; color: var(--text-muted, #666); }
    .alert { background: #fee2e2; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; }
    .panel { border: 1px solid var(--border, #e5e7eb); border-radius: 12px; padding: 14px 16px; background: var(--surface, #fff); }
    .panel-head h3 { margin: 0 0 10px; font-size: 1rem; }
    .empty { color: var(--text-muted, #888); font-size: 0.9rem; }
    .my-pair { display: flex; align-items: center; gap: 8px; color: #166534; }
    .invite-card { display: flex; flex-direction: column; gap: 10px; }
    .invite-actions { display: flex; gap: 8px; }
    .primary-action, .secondary-action { border-radius: 8px; padding: 8px 14px; font-size: 0.85rem; cursor: pointer; }
    .primary-action { border: none; background: var(--accent, #2563eb); color: #fff; }
    .secondary-action { border: 1px solid var(--border, #ddd); background: var(--surface, #fff); }
    .find-partner input { width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border, #ddd); margin: 8px 0; box-sizing: border-box; }
    .member-list { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
    .member-row { text-align: left; border: 1px solid var(--border, #eee); background: var(--surface, #fff); border-radius: 8px; padding: 8px 10px; cursor: pointer; }
    .member-row:hover { background: var(--chip-bg, #f1f5f9); }
    .section-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #888); margin: 12px 0 6px; }
    .match-list { display: flex; flex-direction: column; gap: 6px; }
    .match-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px; border: 1px solid var(--border, #eee); border-radius: 8px; font-size: 0.85rem; }
    .match-meta { color: var(--text-muted, #888); font-size: 0.75rem; flex-basis: 100%; }
    .match-teams { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .match-teams .winner { color: #16a34a; }
    .vs { color: var(--text-muted, #999); font-weight: normal; }
    .status-pill { margin-left: auto; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; background: #e5e7eb; }
    .status-pill.in_progress { background: #fde68a; color: #92400e; }
    .status-pill.completed { background: #bbf7d0; color: #166534; }
    .standings-table { display: flex; flex-direction: column; font-size: 0.85rem; }
    .standings-head, .standings-row { display: grid; grid-template-columns: 24px 1fr 28px 28px 48px 48px; gap: 4px; padding: 6px 4px; align-items: center; }
    .standings-head { color: var(--text-muted, #888); font-size: 0.72rem; text-transform: uppercase; border-bottom: 1px solid var(--border, #eee); }
    .standings-row { border-bottom: 1px solid var(--border, #f3f4f6); }
    .col-pair { font-weight: 600; }
    .pos { color: #16a34a; }
    .neg { color: #dc2626; }
  `],
})
export class PlayerHostedPlayScheduleBoardComponent implements OnInit, OnDestroy {
  id = '';
  board: FixedDoublesBoard | null = null;
  loading = true;
  busy = false;
  error = '';

  myParticipantId: string | null = null;
  myPair: HostedPlayPair | null = null;
  invitedToMe = false;
  mySentInvitePending = false;

  directoryMembers: User[] = [];
  filteredMembers: User[] = [];
  partnerFilter = '';

  private pollSub?: Subscription;

  constructor(
    private hp: HostedPlayService,
    private auth: AuthService,
    private users: UsersService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.hp.getSession(this.id).subscribe({
      next: (s: any) => {
        this.myParticipantId = (s.participants || []).find((p: any) => p.isMe)?._id || null;
        this.deriveMyPairState();
        this.cdr.detectChanges();
      },
      error: () => {},
    });
    this.users.getDirectoryMembers().subscribe({
      next: (members) => {
        const myId = this.auth.user()?.id;
        this.directoryMembers = members.filter(m => m._id !== myId);
        this.filterMembers();
        this.cdr.detectChanges();
      },
      error: () => {},
    });

    const onBoard = (b: FixedDoublesBoard) => {
      this.board = b;
      this.loading = false;
      this.deriveMyPairState();
      this.cdr.detectChanges();
    };
    const onError = (err: any) => { this.error = err?.error?.error || 'Unable to load schedule.'; this.loading = false; this.cdr.detectChanges(); };
    this.hp.getPlayerFixedDoublesBoard(this.id).subscribe({ next: onBoard, error: onError });
    this.pollSub = this.hp.pollPlayerFixedDoublesBoard(this.id, 6000).subscribe({ next: onBoard, error: onError });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  private deriveMyPairState() {
    const myUserId = this.auth.user()?.id;
    const pairs = this.board?.pairs || [];
    this.myPair = pairs.find(p =>
      (this.myParticipantId && (p.participantAId === this.myParticipantId || p.participantBId === this.myParticipantId)),
    ) || null;
    this.invitedToMe = pairs.some(p => p.inviteStatus === 'pending' && p.invitedMemberId === myUserId);
    this.mySentInvitePending = !!(
      this.myPair && this.myPair.status === 'pending_partner' && this.myPair.inviteStatus === 'pending'
      && this.myPair.participantAId === this.myParticipantId
    );
    if (this.invitedToMe && !this.myPair) {
      this.myPair = pairs.find(p => p.inviteStatus === 'pending' && p.invitedMemberId === myUserId) || null;
    }
  }

  hasSchedule(): boolean {
    const b = this.board;
    if (!b) return false;
    return (b.currentMatches.length + b.nextMatches.length + b.upcomingMatches.length + b.completedMatches.length) > 0;
  }

  pairName(snapshot: { pairLabel: string; players: { memberName: string }[] } | undefined): string {
    if (!snapshot) return '—';
    return snapshot.players.map(p => p.memberName).filter(Boolean).join(' & ') || snapshot.pairLabel || 'Pair';
  }

  partnerName(): string {
    if (!this.myPair || !this.board) return '';
    const allMatches = [
      ...this.board.currentMatches, ...this.board.nextMatches,
      ...this.board.upcomingMatches, ...this.board.completedMatches,
    ];
    const match = allMatches.find(f => f.pair1Id === this.myPair!._id || f.pair2Id === this.myPair!._id);
    const snapshot = match ? (match.pair1Id === this.myPair!._id ? match.pair1 : match.pair2) : null;
    const partner = snapshot?.players.find(p => p.participantId !== this.myParticipantId);
    return partner?.memberName || this.myPair.pairLabel || 'your partner';
  }

  inviterNameGuess(): string {
    return 'A member';
  }

  filterMembers() {
    const q = this.partnerFilter.trim().toLowerCase();
    this.filteredMembers = !q ? this.directoryMembers.slice(0, 20) : this.directoryMembers.filter(m => m.name.toLowerCase().includes(q)).slice(0, 20);
  }

  invite(m: User) {
    this.busy = true;
    this.error = '';
    this.hp.invitePartner(this.id, m._id).subscribe({
      next: () => { this.busy = false; this.reload(); },
      error: (err) => { this.error = err?.error?.error || 'Unable to send invite.'; this.busy = false; this.cdr.detectChanges(); },
    });
  }

  respond(accept: boolean) {
    if (!this.myPair) return;
    this.busy = true;
    this.error = '';
    this.hp.respondToInvite(this.id, this.myPair._id, accept).subscribe({
      next: () => { this.busy = false; this.reload(); },
      error: (err) => { this.error = err?.error?.error || 'Unable to respond to invite.'; this.busy = false; this.cdr.detectChanges(); },
    });
  }

  cancelMyInvite() {
    if (!this.myPair) return;
    this.busy = true;
    this.hp.cancelInvite(this.id, this.myPair._id).subscribe({
      next: () => { this.busy = false; this.reload(); },
      error: (err) => { this.error = err?.error?.error || 'Unable to cancel invite.'; this.busy = false; this.cdr.detectChanges(); },
    });
  }

  private reload() {
    this.hp.getPlayerFixedDoublesBoard(this.id).subscribe({
      next: (b) => { this.board = b; this.deriveMyPairState(); this.cdr.detectChanges(); },
    });
  }

  goBack() { this.router.navigate(['/player/hosted-play']); }
}
