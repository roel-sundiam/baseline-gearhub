export type PricingModel = 'flat' | 'tiered';

export function tierForHour(hour: number): 'daytime' | 'evening' | 'overnight' {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h < 17) return 'daytime';
  if (h >= 17) return 'evening';
  return 'overnight';
}

export interface CourtFeeRates {
  weekdayRate: number;
  weekendRate: number;
  holidayRate: number;
  daytimeRate: number;
  eveningRate: number;
  overnightRate: number;
}

export interface CourtFeeContext {
  startHour: number;
  dayOfWeek: number;
  isHoliday: boolean;
  durationHours: number;
}

export interface CourtFeeResult {
  courtFee: number;
  effectiveHourlyRate: number;
}

const WEEKEND_DAYS = new Set([0, 5, 6]); // Sunday=0, Friday=5, Saturday=6

export function computeCourtFee(
  pricingModel: PricingModel,
  ctx: CourtFeeContext,
  rates: CourtFeeRates,
): CourtFeeResult {
  if (pricingModel === 'tiered') {
    let courtFee = 0;
    for (let i = 0; i < ctx.durationHours; i++) {
      const tier = tierForHour(ctx.startHour + i);
      courtFee += tier === 'daytime' ? rates.daytimeRate : tier === 'evening' ? rates.eveningRate : rates.overnightRate;
    }
    return { courtFee, effectiveHourlyRate: ctx.durationHours > 0 ? courtFee / ctx.durationHours : 0 };
  }
  const isWeekend = WEEKEND_DAYS.has(ctx.dayOfWeek);
  const hourlyRate = ctx.isHoliday ? rates.holidayRate : isWeekend ? rates.weekendRate : rates.weekdayRate;
  return { courtFee: hourlyRate * ctx.durationHours, effectiveHourlyRate: hourlyRate };
}
