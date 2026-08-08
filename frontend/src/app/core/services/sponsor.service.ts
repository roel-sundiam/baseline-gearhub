import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Sponsor {
  _id: string;
  businessName: string;
  logoUrl: string;
  description: string;
  promoText?: string;
  link: string;
  tierDays: 7 | 30 | 90;
  price: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'rejected';
  paymentVerified: boolean;
  createdBy?: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export type SponsorInput = {
  businessName: string;
  logoUrl: string;
  description: string;
  promoText?: string;
  link: string;
  tierDays: number;
  price: number;
  startDate: string;
  endDate: string;
};

export interface SponsorInquiry {
  _id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  message: string;
  status: 'new' | 'reviewed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type SponsorInquiryInput = {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  message: string;
};

@Injectable({ providedIn: 'root' })
export class SponsorService {
  private base = `${environment.apiUrl}/sponsors`;

  constructor(private http: HttpClient) {}

  submitInquiry(data: SponsorInquiryInput) {
    return this.http.post<{ success: true }>(`${environment.apiUrl}/public/partner-inquiries`, data);
  }

  getInquiries() {
    return this.http.get<SponsorInquiry[]>(`${this.base}/inquiries`);
  }

  setInquiryStatus(id: string, status: SponsorInquiry['status']) {
    return this.http.patch<SponsorInquiry>(`${this.base}/inquiries/${id}/status`, { status });
  }

  deleteInquiry(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/inquiries/${id}`);
  }

  getActiveSponsors() {
    return this.http.get<Sponsor[]>(this.base);
  }

  getAllForAdmin() {
    return this.http.get<Sponsor[]>(`${this.base}/admin`);
  }

  create(data: SponsorInput) {
    return this.http.post<Sponsor>(this.base, data);
  }

  update(id: string, data: Partial<SponsorInput>) {
    return this.http.put<Sponsor>(`${this.base}/${id}`, data);
  }

  toggleVerifyPayment(id: string) {
    return this.http.patch<Sponsor>(`${this.base}/${id}/verify-payment`, {});
  }

  setStatus(id: string, status: 'draft' | 'active' | 'rejected') {
    return this.http.patch<Sponsor>(`${this.base}/${id}/status`, { status });
  }

  delete(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
