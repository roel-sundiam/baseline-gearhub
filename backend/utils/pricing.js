const WEEKEND_DAYS = new Set([0, 5, 6]); // Sunday=0, Friday=5, Saturday=6

function tierForHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h < 17) return "daytime";
  if (h >= 17) return "evening";
  return "overnight";
}

function getTierRateForHour(hour, rates) {
  const tier = tierForHour(hour);
  if (tier === "daytime") return Number(rates.daytimeRate ?? rates.reservationDaytimeRate ?? 0);
  if (tier === "evening") return Number(rates.eveningRate ?? rates.reservationEveningRate ?? 0);
  return Number(rates.overnightRate ?? rates.reservationOvernightRate ?? 0);
}

function computeTieredCourtFee(startHour, durationHours, rates) {
  let total = 0;
  for (let i = 0; i < durationHours; i++) total += getTierRateForHour(startHour + i, rates);
  return total;
}

function computeFlatCourtFee({ dayOfWeek, isHoliday, durationHours }, rates) {
  const isWeekend = WEEKEND_DAYS.has(dayOfWeek);
  const hourlyRate = isHoliday
    ? Number(rates.holidayRate ?? rates.reservationHolidayRate ?? 0)
    : isWeekend
      ? Number(rates.weekendRate ?? rates.reservationWeekendRate ?? 0)
      : Number(rates.weekdayRate ?? rates.reservationWeekdayRate ?? 0);
  return { courtFee: hourlyRate * durationHours, effectiveHourlyRate: hourlyRate };
}

// Single entry point every call site uses. Returns { courtFee, effectiveHourlyRate }.
// effectiveHourlyRate feeds the `per_transaction` convenience-fee base (a real scalar
// rate for flat clubs; an hour-weighted average for tiered clubs).
function computeCourtFee(pricingModel, { startHour, dayOfWeek, isHoliday, durationHours }, rates) {
  if (pricingModel === "tiered") {
    const courtFee = computeTieredCourtFee(startHour, durationHours, rates);
    return { courtFee, effectiveHourlyRate: durationHours > 0 ? courtFee / durationHours : 0 };
  }
  return computeFlatCourtFee({ dayOfWeek, isHoliday, durationHours }, rates);
}

module.exports = {
  tierForHour,
  getTierRateForHour,
  computeTieredCourtFee,
  computeFlatCourtFee,
  computeCourtFee,
  WEEKEND_DAYS,
};
