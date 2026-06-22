import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Rates {
  _id: string;
  withoutLightRate: number;
  lightRate: number;
  training2WithoutLightRate: number;
  training2LightRate: number;
  ballBoyRate: number;
  reservationWeekdayRate: number;
  reservationWeekendRate: number;
  reservationHolidayRate: number;
  reservationGuestFee: number;
  reservationGuestFeeThreshold: number;
  exclusiveEventEnabled: boolean;
  exclusiveEventRate: number;
  exclusiveEventIncludedPax: number;
  exclusiveEventExcessPaxFee: number;
  exclusiveEventMaxPax: number;
  exclusiveEventPolicies: string[];
  rentalBalls50Rate: number;
  rentalBalls100Rate: number;
  rentalBallMachineRate: number;
  rentalRacketRate: number;
  coachingEnabled: boolean;
  coachingMinHours: number;
  coachingMaxPax: number;
  coachingRate1Pax: number;
  coachingRate2Pax: number;
  coachingRate3to6Pax: number;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class RatesService {
  constructor(private http: HttpClient) {}

  getRates() {
    return this.http.get<Rates>(`${environment.apiUrl}/rates`);
  }

  updateRates(data: {
    withoutLightRate: number;
    lightRate: number;
    training2WithoutLightRate: number;
    training2LightRate: number;
    ballBoyRate: number;
    reservationWeekdayRate: number;
    reservationWeekendRate: number;
    reservationHolidayRate: number;
    reservationGuestFee: number;
    reservationGuestFeeThreshold: number;
    exclusiveEventEnabled: boolean;
    exclusiveEventRate: number;
    exclusiveEventIncludedPax: number;
    exclusiveEventExcessPaxFee: number;
    exclusiveEventMaxPax: number;
    exclusiveEventPolicies: string[];
    rentalBalls50Rate: number;
    rentalBalls100Rate: number;
    rentalBallMachineRate: number;
    rentalRacketRate: number;
    coachingEnabled: boolean;
    coachingMinHours: number;
    coachingMaxPax: number;
    coachingRate1Pax: number;
    coachingRate2Pax: number;
    coachingRate3to6Pax: number;
  }) {
    return this.http.put<Rates>(`${environment.apiUrl}/rates`, data);
  }
}
