import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  contactNumber?: string;
  profileImage?: string;
  duprRating?: number | null;
  createdAt: string;
  // Present on members whose home is another club: their relationship to the
  // viewing club lives in a ClubMembership doc, managed via /memberships APIs.
  membershipId?: string;
  isJoinRequest?: boolean;
  membershipJoinedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private http: HttpClient) {}

  getPendingUsers() {
    return this.http.get<User[]>(`${environment.apiUrl}/users/pending`);
  }

  getAllUsers() {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  getActivePlayers() {
    return this.http.get<{ _id: string; name: string; email: string }[]>(
      `${environment.apiUrl}/users/active-players`,
    );
  }

  getDirectoryMembers() {
    return this.http.get<User[]>(`${environment.apiUrl}/users/directory/members`);
  }

  approveUser(id: string) {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}/approve`, {});
  }

  rejectUser(id: string) {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}/reject`, {});
  }

  deactivateUser(id: string) {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}/deactivate`, {});
  }

  reactivateUser(id: string) {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}/reactivate`, {});
  }

  getUserProfile(id: string) {
    return this.http.get<any>(`${environment.apiUrl}/users/${id}/profile`);
  }

  updateProfile(
    id: string,
    data: { name?: string; contactNumber?: string; gender?: string; profileImage?: string },
  ) {
    return this.http.put<any>(`${environment.apiUrl}/users/${id}/profile`, data);
  }

  changePassword(id: string, data: { currentPassword: string; newPassword: string }) {
    return this.http.put<any>(`${environment.apiUrl}/users/${id}/change-password`, data);
  }

  getAdmins(clubId?: string) {
    const params: Record<string, string> = {};
    if (clubId) params['clubId'] = clubId;
    return this.http.get<any[]>(`${environment.apiUrl}/users/admins`, { params });
  }

  getClubUsers(clubId: string) {
    return this.http.get<any[]>(`${environment.apiUrl}/users`, { params: { clubId } });
  }

  createAdmin(data: { name: string; username: string; password: string; clubId: string; email?: string; contactNumber?: string }) {
    return this.http.post<{ message: string; userId: string }>(`${environment.apiUrl}/users/create-admin`, data);
  }

  resetPassword(id: string, newPassword: string) {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/users/${id}/reset-password`, { newPassword });
  }
}
