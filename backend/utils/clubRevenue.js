// Shared club revenue calculation, extracted from club-ledger.routes.js so the Financial
// Statement and Advanced Analytics & Reports features can never compute two different
// answers for the same question. buildReservationIncomePipeline/buildOtherChargeIncomePipeline
// are moved here verbatim (same stages, same field names) — Finance Report's /report output
// is unchanged by this extraction. Everything below `--- Analytics additions ---` is new,
// built from the identical match/lookup basis so trend and per-court figures always
// reconcile with the totals above.

const round2 = (n) => parseFloat((n ?? 0).toFixed(2));

function dateRangeFilter(from, to) {
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return filter;
}

function reservationRevenueMatch(clubObjId, dateFilter, hasRange, extra = {}) {
  return { clubId: clubObjId, status: "confirmed", ...(hasRange ? { date: dateFilter } : {}), ...extra };
}

// chargeTypeFilter: omit for "every non-reservation type" (the Finance Report rule), or pass
// a specific type (e.g. "per_game", "hosted_play") to isolate one booking type's revenue.
function otherChargeMatch(clubObjId, chargeTypeFilter, extra = {}) {
  return {
    clubId: clubObjId,
    chargeType: chargeTypeFilter ?? { $ne: "reservation" },
    status: "paid",
    ...extra,
  };
}

// Non-reservation charges are recognized net of the convenience fee (remitted to CourtGo,
// not club revenue) — same rule club-ledger.routes.js has always used.
const otherChargeIncomeExpr = { $subtract: ["$amount", { $ifNull: ["$breakdown.convenienceFee", 0] }] };

// Reservation income is recognized by the reservation's court date (not payment date), for
// confirmed reservations only, regardless of paid/unpaid status, not netted of the convenience
// fee — matches the Bookings tab so Finance Report's two views tally.
function buildReservationIncomePipeline(match) {
  return [
    { $match: match },
    // Split the combined rentalFee (charges.breakdown.rentalFee) back into its four priced
    // equipment types, recomputed the same way reservations.routes.js derives it at booking
    // time: count/flag * rate-snapshotted-at-booking * durationHours. Summed together these
    // equal charges.breakdown.rentalFee, so the two views always reconcile.
    {
      $addFields: {
        rentalRacketFee: {
          $multiply: [
            { $ifNull: ["$rentals.rackets", 0] },
            { $ifNull: ["$ratesUsed.rentalRacketRate", 0] },
            { $ifNull: ["$durationHours", 1] },
          ],
        },
        rentalBalls50Fee: {
          $multiply: [
            { $ifNull: ["$rentals.balls50", 0] },
            { $ifNull: ["$ratesUsed.rentalBalls50Rate", 0] },
            { $ifNull: ["$durationHours", 1] },
          ],
        },
        rentalBalls100Fee: {
          $multiply: [
            { $ifNull: ["$rentals.balls100", 0] },
            { $ifNull: ["$ratesUsed.rentalBalls100Rate", 0] },
            { $ifNull: ["$durationHours", 1] },
          ],
        },
        rentalBallMachineFee: {
          $multiply: [
            { $cond: [{ $eq: ["$rentals.ballMachine", true] }, 1, 0] },
            { $ifNull: ["$ratesUsed.rentalBallMachineRate", 0] },
            { $ifNull: ["$durationHours", 1] },
          ],
        },
      },
    },
    { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
    { $unwind: "$charges" },
    {
      $facet: {
        byCategory: [
          {
            $group: {
              _id: null,
              courtFee: { $sum: { $ifNull: ["$charges.breakdown.withoutLightFee", 0] } },
              lightFee: { $sum: { $ifNull: ["$charges.breakdown.lightFee", 0] } },
              ballBoyFee: { $sum: { $ifNull: ["$charges.breakdown.ballBoyFee", 0] } },
              guestFee: { $sum: { $ifNull: ["$charges.breakdown.guestFee", 0] } },
              rentalRacketFee: { $sum: "$rentalRacketFee" },
              rentalBalls50Fee: { $sum: "$rentalBalls50Fee" },
              rentalBalls100Fee: { $sum: "$rentalBalls100Fee" },
              rentalBallMachineFee: { $sum: "$rentalBallMachineFee" },
              coachingFee: { $sum: { $ifNull: ["$charges.breakdown.coachingFee", 0] } },
              extraFeeTotal: { $sum: { $ifNull: ["$charges.breakdown.extraFeeTotal", 0] } },
              total: { $sum: "$charges.amount" },
              bookingCount: { $sum: 1 },
            },
          },
        ],
        byMonth: [
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
              income: { $sum: "$charges.amount" },
            },
          },
        ],
        extraFeesByName: [
          { $unwind: "$charges.breakdown.extraFees" },
          {
            $group: {
              _id: { $toLower: { $trim: { input: "$charges.breakdown.extraFees.name" } } },
              total: { $sum: "$charges.breakdown.extraFees.amount" },
            },
          },
        ],
        bookings: [
          {
            $project: {
              _id: 0,
              date: "$date",
              timeSlot: "$timeSlot",
              durationHours: { $ifNull: ["$durationHours", 1] },
              amount: "$charges.amount",
              chargeStatus: "$charges.status",
              paymentMethod: "$charges.paymentMethod",
              courtFee: { $ifNull: ["$charges.breakdown.withoutLightFee", 0] },
              lightFee: { $ifNull: ["$charges.breakdown.lightFee", 0] },
              ballBoyFee: { $ifNull: ["$charges.breakdown.ballBoyFee", 0] },
              guestFee: { $ifNull: ["$charges.breakdown.guestFee", 0] },
              rentalFee: { $ifNull: ["$charges.breakdown.rentalFee", 0] },
              coachingFee: { $ifNull: ["$charges.breakdown.coachingFee", 0] },
              extraFees: { $ifNull: ["$charges.breakdown.extraFees", []] },
            },
          },
          { $sort: { date: 1, timeSlot: 1 } },
        ],
      },
    },
  ];
}

// Non-reservation charges (open play, per-game, hosted play, session) have no Bookings-tab
// equivalent to reconcile against, so they keep the original cash-basis definition: paid
// only, keyed by payment date, net of the convenience fee (remitted to CourtGo).
function buildOtherChargeIncomePipeline(match, dateFilter, hasRange) {
  return [
    { $match: match },
    { $addFields: { incomeDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
    ...(hasRange ? [{ $match: { incomeDate: dateFilter } }] : []),
    {
      $facet: {
        byCategory: [
          {
            $group: {
              _id: null,
              gameFee: { $sum: { $ifNull: ["$breakdown.gameFee", 0] } },
              hostedPlayFee: { $sum: { $ifNull: ["$breakdown.hostedPlayFee", 0] } },
              convenienceFeesExcluded: { $sum: { $ifNull: ["$breakdown.convenienceFee", 0] } },
              total: { $sum: otherChargeIncomeExpr },
              chargeCount: { $sum: 1 },
            },
          },
        ],
        byMonth: [
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$incomeDate" } },
              income: { $sum: otherChargeIncomeExpr },
            },
          },
        ],
      },
    },
  ];
}

// --- Analytics additions --- (not used by Finance Report)

const PERIOD_FORMATS = {
  day: "%Y-%m-%d",
  week: "%G-W%V", // ISO week-year + ISO week number
  month: "%Y-%m",
};

function buildReservationTrendPipeline(match, granularity) {
  const format = PERIOD_FORMATS[granularity] ?? PERIOD_FORMATS.day;
  return [
    { $match: match },
    { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
    { $unwind: "$charges" },
    {
      $group: {
        _id: { $dateToString: { format, date: "$date" } },
        bookings: { $sum: 1 },
        revenue: { $sum: "$charges.amount" },
      },
    },
    { $project: { _id: 0, period: "$_id", bookings: 1, revenue: { $round: ["$revenue", 2] } } },
    { $sort: { period: 1 } },
  ];
}

function buildOtherChargeTrendPipeline(match, dateFilter, hasRange, granularity) {
  const format = PERIOD_FORMATS[granularity] ?? PERIOD_FORMATS.day;
  return [
    { $match: match },
    { $addFields: { incomeDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
    ...(hasRange ? [{ $match: { incomeDate: dateFilter } }] : []),
    {
      $group: {
        _id: { $dateToString: { format, date: "$incomeDate" } },
        bookings: { $sum: 1 },
        revenue: { $sum: otherChargeIncomeExpr },
      },
    },
    { $project: { _id: 0, period: "$_id", bookings: 1, revenue: { $round: ["$revenue", 2] } } },
    { $sort: { period: 1 } },
  ];
}

function buildCourtPerformancePipeline(match) {
  return [
    { $match: match },
    { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
    { $unwind: "$charges" },
    {
      $group: {
        _id: "$court",
        bookings: { $sum: 1 },
        revenue: { $sum: "$charges.amount" },
        hours: { $sum: { $ifNull: ["$durationHours", 1] } },
        avgDurationHours: { $avg: { $ifNull: ["$durationHours", 1] } },
      },
    },
    {
      $project: {
        _id: 0,
        court: "$_id",
        bookings: 1,
        revenue: { $round: ["$revenue", 2] },
        hours: { $round: ["$hours", 2] },
        avgDurationHours: { $round: ["$avgDurationHours", 2] },
      },
    },
    { $sort: { court: 1 } },
  ];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Inclusive day count between two ISO date strings (e.g. "2026-08-01".."2026-08-07" => 7).
function daysInclusive(from, to) {
  if (!from || !to) return 0;
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  return Math.round((toDate - fromDate) / MS_PER_DAY) + 1;
}

// Given ISO date strings, returns an equal-length window immediately preceding [from, to].
function previousPeriodRange(from, to) {
  if (!from || !to) return { prevFrom: undefined, prevTo: undefined };
  const days = daysInclusive(from, to);
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const prevToDate = new Date(fromDate.getTime() - MS_PER_DAY);
  const prevFromDate = new Date(prevToDate.getTime() - (days - 1) * MS_PER_DAY);
  const toIso = (d) => d.toISOString().slice(0, 10);
  return { prevFrom: toIso(prevFromDate), prevTo: toIso(prevToDate) };
}

// Never divides by zero and never claims "no change" when there's no baseline to compare
// against — pctChange is null whenever previous === 0, and the frontend renders "No prior
// data" in that case instead of a percentage badge.
function pctChange(current, previous) {
  const cur = current ?? 0;
  const prev = previous ?? 0;
  return {
    current: round2(cur),
    previous: round2(prev),
    pctChange: prev > 0 ? round2(((cur - prev) / prev) * 100) : null,
    hasPreviousData: prev > 0,
  };
}

module.exports = {
  round2,
  dateRangeFilter,
  reservationRevenueMatch,
  otherChargeMatch,
  otherChargeIncomeExpr,
  buildReservationIncomePipeline,
  buildOtherChargeIncomePipeline,
  buildReservationTrendPipeline,
  buildOtherChargeTrendPipeline,
  buildCourtPerformancePipeline,
  daysInclusive,
  previousPeriodRange,
  pctChange,
};
