import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface MembershipClub {
  _id: string;
  name: string;
  logo?: string | null;
  location?: string;
  status?: 'active' | 'suspended';
}

export interface Membership {
  _id: string | null;
  club: MembershipClub | null;
  status: 'pending' | 'active' | 'rejected' | 'deactivated';
  isHomeClub: boolean;
  joinedAt?: string | null;
  approvedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MembershipService {
  private http = inject(HttpClient);

  private _myMemberships = signal<Membership[]>([]);
  readonly myMemberships = this._myMemberships.asReadonly();

  /** Clubs the member can switch into: active membership, club not suspended. */
  readonly switchableClubs = computed(() =>
    this._myMemberships()
      .filter((m) => m.status === 'active' && m.club && m.club.status !== 'suspended')
      .map((m) => m.club!),
  );

  loadMine() {
    return this.http
      .get<Membership[]>(`${environment.apiUrl}/memberships/mine`)
      .pipe(tap((memberships) => this._myMemberships.set(memberships)));
  }

  joinClub(clubId: string) {
    return this.http.post<{ message: string; membershipId: string }>(
      `${environment.apiUrl}/memberships/join`,
      { clubId },
    );
  }

  approveMembership(id: string) {
    return this.http.put<Membership>(`${environment.apiUrl}/memberships/${id}/approve`, {});
  }

  rejectMembership(id: string) {
    return this.http.put<Membership>(`${environment.apiUrl}/memberships/${id}/reject`, {});
  }
}
