import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TrendGranularity = 'day' | 'week' | 'month';

export interface KpiComparison {
  current: number | null;
  previous: number | null;
  pctChange: number | null;
  hasPreviousData: boolean;
}

export interface TrendPoint {
  period: string;
}

export interface BookingTrendPoint extends TrendPoint {
  bookings: number;
}

export interface RevenueTrendPoint extends TrendPoint {
  revenue: number;
}

export interface CourtPerformanceRow {
  court: number;
  courtName: string;
  bookings: number;
  revenue: number;
  hours: number;
  avgDurationHours: number;
  utilizationPct: number | null;
}

export interface AnalyticsOverview {
  range: { from: string | null; to: string | null; days: number };
  kpis: {
    totalBookings: KpiComparison;
    totalRevenue: KpiComparison;
    courtUtilizationPct: KpiComparison;
    activeCustomers: KpiComparison;
  };
  bookingTrend: BookingTrendPoint[];
  revenueTrend: RevenueTrendPoint[];
  courtPerformance: CourtPerformanceRow[];
}

export interface PeakHourRow {
  hour: number;
  bookings: number;
}

export interface DayOfWeekRow {
  day: string;
  bookings: number;
  revenue: number;
}

export interface TopCustomerRow {
  name: string;
  email: string;
  bookings: number;
  revenue: number;
}

export interface CustomerActivity {
  totalActiveCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  avgBookingsPerCustomer: number | null;
  topCustomers: TopCustomerRow[];
}

export interface BookingTypeRow {
  type: 'reservation' | 'per_game' | 'hosted_play';
  label: string;
  bookings: number;
  revenue: number;
  pct: number;
}

export interface CancellationOverview {
  count: number;
  rate: number;
  revenueAffected: number;
}

export interface PaymentMethodRow {
  method: string;
  transactions: number;
  amount: number;
}

export interface AnalyticsEngagement {
  peakTimes: { byHour: PeakHourRow[]; byDayOfWeek: DayOfWeekRow[] };
  customerActivity: CustomerActivity;
  bookingTypeBreakdown: BookingTypeRow[];
  cancellationOverview: CancellationOverview | null;
  paymentMethodBreakdown: PaymentMethodRow[];
}

export interface ReportFilters {
  from: string;
  to: string;
  court?: number | null;
  bookingType?: 'reservation' | 'per_game' | 'hosted_play' | null;
  status?: 'confirmed' | 'pending_payment' | 'cancelled' | null;
  paymentStatus?: 'paid' | 'unpaid' | null;
  paymentMethod?: string | null;
  clubId?: string;
}

export interface BookingReportRow {
  bookingDate: string;
  customer: string;
  court: string | null;
  bookingType: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  amount: number;
  paymentStatus: string | null;
  bookingStatus: string | null;
}

export interface RevenueReportRow {
  date: string;
  bookingType: string;
  customer: string;
  court: string | null;
  amount: number;
  paymentMethod: string | null;
  paymentStatus: string;
}

export interface CourtUtilizationReportRow {
  court: string;
  availableHours: number;
  bookedHours: number;
  utilizationPct: number | null;
}

export interface CustomerReportRow {
  customer: string;
  email: string;
  bookings: number;
  revenue: number;
  lastBooking: string;
}

export interface BookingReportResponse { rows: BookingReportRow[]; totals: { count: number; revenue: number } }
export interface RevenueReportResponse { rows: RevenueReportRow[]; totals: { count: number; revenue: number } }
export interface CourtUtilizationReportResponse { rows: CourtUtilizationReportRow[]; totals: { bookedHours: number; availableHours: number; utilizationPct: number | null } }
export interface CustomerReportResponse { rows: CustomerReportRow[]; totals: { customers: number; bookings: number; revenue: number } }

@Injectable({ providedIn: 'root' })
export class ClubAnalyticsService {
  constructor(private http: HttpClient) {}

  getOverview(from: string, to: string, granularity: TrendGranularity, clubId?: string): Observable<AnalyticsOverview> {
    let params = new HttpParams().set('from', from).set('to', to).set('granularity', granularity);
    if (clubId) params = params.set('clubId', clubId);
    return this.http.get<AnalyticsOverview>(`${environment.apiUrl}/club-analytics/overview`, { params });
  }

  getEngagement(from: string, to: string, clubId?: string): Observable<AnalyticsEngagement> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (clubId) params = params.set('clubId', clubId);
    return this.http.get<AnalyticsEngagement>(`${environment.apiUrl}/club-analytics/engagement`, { params });
  }

  private buildFilterParams(f: ReportFilters): HttpParams {
    let params = new HttpParams().set('from', f.from).set('to', f.to);
    if (f.court) params = params.set('court', String(f.court));
    if (f.bookingType) params = params.set('bookingType', f.bookingType);
    if (f.status) params = params.set('status', f.status);
    if (f.paymentStatus) params = params.set('paymentStatus', f.paymentStatus);
    if (f.paymentMethod) params = params.set('paymentMethod', f.paymentMethod);
    if (f.clubId) params = params.set('clubId', f.clubId);
    return params;
  }

  getBookingReport(f: ReportFilters): Observable<BookingReportResponse> {
    return this.http.get<BookingReportResponse>(`${environment.apiUrl}/club-analytics/reports/bookings`, { params: this.buildFilterParams(f) });
  }

  getRevenueReport(f: ReportFilters): Observable<RevenueReportResponse> {
    return this.http.get<RevenueReportResponse>(`${environment.apiUrl}/club-analytics/reports/revenue`, { params: this.buildFilterParams(f) });
  }

  getCourtUtilizationReport(f: ReportFilters): Observable<CourtUtilizationReportResponse> {
    return this.http.get<CourtUtilizationReportResponse>(`${environment.apiUrl}/club-analytics/reports/court-utilization`, { params: this.buildFilterParams(f) });
  }

  getCustomerReport(f: ReportFilters): Observable<CustomerReportResponse> {
    return this.http.get<CustomerReportResponse>(`${environment.apiUrl}/club-analytics/reports/customers`, { params: this.buildFilterParams(f) });
  }
}
