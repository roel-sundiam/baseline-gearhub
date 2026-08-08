const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Club = require("../models/Club");
const Reservation = require("../models/Reservation");
const Charge = require("../models/Charge");
const { ensureAdvancedAnalyticsBilling } = require("../utils/advancedAnalyticsBilling");
const {
  round2,
  dateRangeFilter,
  reservationRevenueMatch,
  otherChargeMatch,
  buildReservationIncomePipeline,
  buildOtherChargeIncomePipeline,
  buildReservationTrendPipeline,
  buildOtherChargeTrendPipeline,
  buildCourtPerformancePipeline,
  daysInclusive,
  previousPeriodRange,
  pctChange,
} = require("../utils/clubRevenue");

const router = express.Router();

// Gates every read-only analytics endpoint. Club admins view their own club, and only when
// the Advanced Analytics add-on is enabled. Superadmin has full oversight access to every
// club's analytics via ?clubId=, bypassing the gate — same pattern as club-ledger.routes.js's
// resolveReportClub. There are no mutating endpoints on this router, so no separate
// write-gating middleware is needed.
async function resolveAnalyticsClub(req, res, next) {
  try {
    const isSuperadmin = req.user.role === "superadmin";
    const clubId = isSuperadmin ? req.query.clubId : req.user.clubId;
    if (!clubId) {
      return res.status(400).json({ error: isSuperadmin ? "clubId is required" : "No club associated with this user" });
    }
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (!isSuperadmin && !club.advancedAnalyticsEnabled) {
      return res.status(403).json({ error: "advanced_analytics_locked" });
    }
    req.club = club;
    req.targetClubId = clubId;
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}

function parseGranularity(raw) {
  return ["day", "week", "month"].includes(raw) ? raw : "day";
}

// Merge two {period, bookings, revenue}[] series (reservation-sourced + other-charge-sourced)
// into one, keyed by period.
function mergeTrend(a, b) {
  const rows = new Map();
  const add = (arr) => {
    for (const r of arr ?? []) {
      const row = rows.get(r.period) ?? { period: r.period, bookings: 0, revenue: 0 };
      row.bookings += r.bookings;
      row.revenue = round2(row.revenue + r.revenue);
      rows.set(r.period, row);
    }
  };
  add(a);
  add(b);
  return [...rows.values()].sort((x, y) => x.period.localeCompare(y.period));
}

async function sumCourtHours(match) {
  const [result] = await Reservation.aggregate([
    { $match: match },
    { $group: { _id: null, hours: { $sum: { $ifNull: ["$durationHours", 1] } } } },
  ]);
  return result?.hours ?? 0;
}

async function countActiveCustomers(match) {
  const players = await Reservation.distinct("player", { ...match, player: { $ne: null } });
  return players.length;
}

// GET /api/club-analytics/overview — KPI cards, booking/revenue trend, court performance (Phase 1)
router.get("/overview", auth, admin, resolveAnalyticsClub, async (req, res) => {
  try {
    await ensureAdvancedAnalyticsBilling(req.club, req.user.userId);

    const { from, to } = req.query;
    const granularity = parseGranularity(req.query.granularity);
    const dateFilter = dateRangeFilter(from, to);
    const hasRange = Object.keys(dateFilter).length > 0;
    const clubObjId = new mongoose.Types.ObjectId(req.targetClubId);

    const { prevFrom, prevTo } = previousPeriodRange(from, to);
    const prevDateFilter = dateRangeFilter(prevFrom, prevTo);
    const hasPrevRange = Object.keys(prevDateFilter).length > 0;

    const curResMatch = reservationRevenueMatch(clubObjId, dateFilter, hasRange);
    const prevResMatch = reservationRevenueMatch(clubObjId, prevDateFilter, hasPrevRange);
    const curOtherMatch = otherChargeMatch(clubObjId);
    const prevOtherMatch = otherChargeMatch(clubObjId);

    const [
      [curResResult],
      [prevResResult],
      [curOtherResult],
      [prevOtherResult],
      curBookingTrend,
      curRevenueTrendOther,
      courtPerformance,
      prevBookedHours,
      curActiveCustomers,
      prevActiveCustomers,
    ] = await Promise.all([
      Reservation.aggregate(buildReservationIncomePipeline(curResMatch)),
      Reservation.aggregate(buildReservationIncomePipeline(prevResMatch)),
      Charge.aggregate(buildOtherChargeIncomePipeline(curOtherMatch, dateFilter, hasRange)),
      Charge.aggregate(buildOtherChargeIncomePipeline(prevOtherMatch, prevDateFilter, hasPrevRange)),
      Reservation.aggregate(buildReservationTrendPipeline(curResMatch, granularity)),
      Charge.aggregate(buildOtherChargeTrendPipeline(curOtherMatch, dateFilter, hasRange, granularity)),
      Reservation.aggregate(buildCourtPerformancePipeline(curResMatch)),
      sumCourtHours(prevResMatch),
      countActiveCustomers(curResMatch),
      countActiveCustomers(prevResMatch),
    ]);

    const curResCat = curResResult?.byCategory?.[0] ?? {};
    const prevResCat = prevResResult?.byCategory?.[0] ?? {};
    const curOtherCat = curOtherResult?.byCategory?.[0] ?? {};
    const prevOtherCat = prevOtherResult?.byCategory?.[0] ?? {};

    // Bookings/revenue combine the Reservation flow with the other booking types (per_game,
    // hosted_play, open_play, session) that charge through the same Charge collection — a club
    // running exclusively in one of those non-reservation modes would otherwise show a
    // permanently empty headline KPI.
    const curTotalBookings = (curResCat.bookingCount ?? 0) + (curOtherCat.chargeCount ?? 0);
    const prevTotalBookings = (prevResCat.bookingCount ?? 0) + (prevOtherCat.chargeCount ?? 0);
    const curTotalRevenue = (curResCat.total ?? 0) + (curOtherCat.total ?? 0);
    const prevTotalRevenue = (prevResCat.total ?? 0) + (prevOtherCat.total ?? 0);

    // Court Utilization % = booked hours / available hours, where available hours only counts
    // the club's configured daily operating window (single club-wide open/close pair — there's
    // no per-day-of-week schedule in this app today) across every court and every day in range.
    // courtCount (not courts.length) is the source of truth for how many courts a club has —
    // the courts[] subdocument array is optional/display-only and empty for most real clubs
    // (matches the courtCount ?? 2 convention used throughout public.routes.js/reservations.routes.js).
    const dailyWindowHours = (req.club.closingHour ?? 0) - (req.club.openingHour ?? 0);
    const courtCount = req.club.courtCount ?? 2;
    const days = daysInclusive(from, to);
    const curBookedHours = courtPerformance.reduce((s, r) => s + (r.hours ?? 0), 0);
    const availableHoursCur = dailyWindowHours > 0 && courtCount > 0 ? dailyWindowHours * courtCount * days : 0;
    const availableHoursPrev = dailyWindowHours > 0 && courtCount > 0 ? dailyWindowHours * courtCount * days : 0;
    const curUtilizationPct = availableHoursCur > 0 ? round2((curBookedHours / availableHoursCur) * 100) : null;
    const prevUtilizationPct = availableHoursPrev > 0 ? round2((prevBookedHours / availableHoursPrev) * 100) : null;

    const availableHoursPerCourt = dailyWindowHours > 0 ? dailyWindowHours * days : 0;
    // courts[].name is optional display metadata — most clubs never populate it, so fall back
    // to "Court N" (courtCount is the authoritative count, see above).
    const courtMap = new Map((req.club.courts ?? []).map((c, i) => [i + 1, c.name]));
    const courtPerformanceOut = courtPerformance.map((r) => ({
      court: r.court,
      courtName: courtMap.get(r.court) ?? `Court ${r.court}`,
      bookings: r.bookings,
      revenue: r.revenue,
      hours: r.hours,
      avgDurationHours: r.avgDurationHours,
      utilizationPct: availableHoursPerCourt > 0 ? round2((r.hours / availableHoursPerCourt) * 100) : null,
    }));

    const mergedTrend = mergeTrend(curBookingTrend, curRevenueTrendOther);
    const bookingTrend = mergedTrend.map((r) => ({ period: r.period, bookings: r.bookings }));
    const revenueTrend = mergedTrend.map((r) => ({ period: r.period, revenue: r.revenue }));

    res.json({
      range: { from: from ?? null, to: to ?? null, days },
      kpis: {
        totalBookings: pctChange(curTotalBookings, prevTotalBookings),
        totalRevenue: pctChange(curTotalRevenue, prevTotalRevenue),
        courtUtilizationPct:
          curUtilizationPct === null
            ? { current: null, previous: prevUtilizationPct, pctChange: null, hasPreviousData: false }
            : pctChange(curUtilizationPct, prevUtilizationPct ?? 0),
        activeCustomers: pctChange(curActiveCustomers, prevActiveCustomers),
      },
      bookingTrend,
      revenueTrend,
      courtPerformance: courtPerformanceOut,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Matches Reservation.js's timeSlot enum order exactly — index === hour-of-day (0-23), so
// $indexOfArray against this array converts a timeSlot string straight to an hour number.
const TIME_SLOTS = [
  "12am", "1am", "2am", "3am", "4am", "5am", "6am", "7am", "8am", "9am", "10am", "11am",
  "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm", "10pm", "11pm",
];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BOOKING_TYPE_LABELS = { reservation: "Reservation", per_game: "Per Game", hosted_play: "Hosted Play" };

// GET /api/club-analytics/engagement — peak times, day-of-week, customers, booking types,
// cancellations, payment methods (Phase 2)
router.get("/engagement", auth, admin, resolveAnalyticsClub, async (req, res) => {
  try {
    await ensureAdvancedAnalyticsBilling(req.club, req.user.userId);

    const { from, to } = req.query;
    const dateFilter = dateRangeFilter(from, to);
    const hasRange = Object.keys(dateFilter).length > 0;
    const clubObjId = new mongoose.Types.ObjectId(req.targetClubId);
    const resMatch = reservationRevenueMatch(clubObjId, dateFilter, hasRange);

    const [
      byHourRows,
      byDayRows,
      firstBookingRows,
      topCustomerRows,
      [reservationBreakdown],
      [perGameBreakdown],
      [hostedPlayBreakdown],
      cancelledAgg,
      totalBookingsInRange,
      paymentMethodRows,
    ] = await Promise.all([
      Reservation.aggregate([
        { $match: resMatch },
        { $addFields: { hour: { $indexOfArray: [TIME_SLOTS, "$timeSlot"] } } },
        { $group: { _id: "$hour", bookings: { $sum: 1 } } },
        { $project: { _id: 0, hour: "$_id", bookings: 1 } },
        { $sort: { hour: 1 } },
      ]),
      Reservation.aggregate([
        { $match: resMatch },
        { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
        { $unwind: "$charges" },
        { $addFields: { dayOfWeek: { $dayOfWeek: "$date" } } },
        { $group: { _id: "$dayOfWeek", bookings: { $sum: 1 }, revenue: { $sum: "$charges.amount" } } },
        { $project: { _id: 0, dayOfWeek: "$_id", bookings: 1, revenue: { $round: ["$revenue", 2] } } },
        { $sort: { dayOfWeek: 1 } },
      ]),
      // All-time first-confirmed-booking date per player — needed to classify new vs. returning
      // within the selected range regardless of when their history began.
      Reservation.aggregate([
        { $match: { clubId: clubObjId, status: "confirmed", player: { $ne: null } } },
        { $group: { _id: "$player", firstDate: { $min: "$date" } } },
      ]),
      Reservation.aggregate([
        { $match: { ...resMatch, player: { $ne: null } } },
        { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
        { $unwind: "$charges" },
        { $group: { _id: "$player", bookings: { $sum: 1 }, revenue: { $sum: "$charges.amount" } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $project: { _id: 0, name: "$user.name", email: "$user.email", bookings: 1, revenue: { $round: ["$revenue", 2] } } },
      ]),
      Reservation.aggregate(buildReservationIncomePipeline(resMatch)),
      Charge.aggregate(buildOtherChargeIncomePipeline(otherChargeMatch(clubObjId, "per_game"), dateFilter, hasRange)),
      Charge.aggregate(buildOtherChargeIncomePipeline(otherChargeMatch(clubObjId, "hosted_play"), dateFilter, hasRange)),
      Reservation.aggregate([
        { $match: { clubId: clubObjId, status: "cancelled", ...(hasRange ? { date: dateFilter } : {}) } },
        { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
        { $unwind: { path: "$charges", preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, count: { $sum: 1 }, revenueAffected: { $sum: { $ifNull: ["$charges.amount", 0] } } } },
      ]),
      Reservation.countDocuments({ clubId: clubObjId, ...(hasRange ? { date: dateFilter } : {}) }),
      Charge.aggregate([
        {
          $match: {
            clubId: clubObjId,
            status: "paid",
            chargeType: { $in: ["reservation", "per_game", "hosted_play"] },
          },
        },
        { $addFields: { incomeDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
        // Reservation charges are dated by the booking's court date, not payment date — join
        // back to Reservation so the date-range filter below can apply the right date field
        // per charge type in a single pass.
        { $lookup: { from: "reservations", localField: "reservationId", foreignField: "_id", as: "res" } },
        { $unwind: { path: "$res", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { chargeType: { $ne: "reservation" }, ...(hasRange ? { incomeDate: dateFilter } : {}) },
              { chargeType: "reservation", "res.status": "confirmed", ...(hasRange ? { "res.date": dateFilter } : {}) },
            ],
          },
        },
        { $group: { _id: "$paymentMethod", transactions: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $project: { _id: 0, method: { $ifNull: ["$_id", "Unspecified"] }, transactions: 1, amount: { $round: ["$amount", 2] } } },
        { $sort: { amount: -1 } },
      ]),
    ]);

    // Peak times: fill in every hour (0-23) so the frontend can render a full 24-slot chart
    // without gap-detection logic, but only the hours with actual bookings carry a nonzero value.
    const byHourMap = new Map(byHourRows.map((r) => [r.hour, r.bookings]));
    const peakByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, bookings: byHourMap.get(hour) ?? 0 }));
    const bookingsByDay = byDayRows.map((r) => ({ day: DAY_NAMES[r.dayOfWeek - 1], bookings: r.bookings, revenue: r.revenue }));

    // New vs. returning: a player is "new" if their earliest-ever confirmed booking falls
    // inside the selected range; otherwise they were already a customer before this period.
    const rangeStart = from ? new Date(from) : null;
    let newCustomers = 0;
    let returningCustomers = 0;
    const activeInRange = new Set(
      (await Reservation.distinct("player", { ...resMatch, player: { $ne: null } })).map((id) => id.toString()),
    );
    for (const row of firstBookingRows) {
      const id = row._id?.toString();
      if (!id || !activeInRange.has(id)) continue;
      if (rangeStart && new Date(row.firstDate) >= rangeStart) newCustomers++;
      else returningCustomers++;
    }
    const totalActiveCustomers = activeInRange.size;
    const totalReservationBookings = reservationBreakdown?.byCategory?.[0]?.bookingCount ?? 0;
    const avgBookingsPerCustomer = totalActiveCustomers > 0 ? round2(totalReservationBookings / totalActiveCustomers) : null;

    const resCat = reservationBreakdown?.byCategory?.[0] ?? {};
    const perGameCat = perGameBreakdown?.byCategory?.[0] ?? {};
    const hostedPlayCat = hostedPlayBreakdown?.byCategory?.[0] ?? {};
    const bookingTypeRaw = [
      { type: "reservation", bookings: resCat.bookingCount ?? 0, revenue: resCat.total ?? 0 },
      { type: "per_game", bookings: perGameCat.chargeCount ?? 0, revenue: perGameCat.total ?? 0 },
      { type: "hosted_play", bookings: hostedPlayCat.chargeCount ?? 0, revenue: hostedPlayCat.total ?? 0 },
    ].filter((r) => r.bookings > 0);
    const bookingTypeRevenueSum = bookingTypeRaw.reduce((s, r) => s + r.revenue, 0);
    const bookingTypeBreakdown = bookingTypeRaw.map((r) => ({
      type: r.type,
      label: BOOKING_TYPE_LABELS[r.type],
      bookings: r.bookings,
      revenue: round2(r.revenue),
      pct: bookingTypeRevenueSum > 0 ? round2((r.revenue / bookingTypeRevenueSum) * 100) : 0,
    }));

    // Omit the section only when there's no booking data at all to compute a rate from — a
    // club with bookings but zero cancellations still gets a real (and reassuring) "0%" row,
    // since Reservation.status always carries a "cancelled" value regardless of booking type.
    const cancelled = cancelledAgg?.[0] ?? { count: 0, revenueAffected: 0 };
    const cancellationOverview =
      totalBookingsInRange === 0
        ? null
        : {
            count: cancelled.count,
            rate: round2((cancelled.count / totalBookingsInRange) * 100),
            revenueAffected: round2(cancelled.revenueAffected),
          };

    res.json({
      peakTimes: { byHour: peakByHour, byDayOfWeek: bookingsByDay },
      customerActivity: {
        totalActiveCustomers,
        newCustomers,
        returningCustomers,
        avgBookingsPerCustomer,
        topCustomers: topCustomerRows,
      },
      bookingTypeBreakdown,
      cancellationOverview,
      paymentMethodBreakdown: paymentMethodRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

function hourToSlot(h) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? "am" : "pm"}`;
}

// Adds durationHours to a timeSlot string using the same wall-clock math Reservation.js uses
// (pre-validate hook), so a booking's displayed end time always matches its stored duration.
function addHoursToSlot(timeSlot, durationHours) {
  const startHour = TIME_SLOTS.indexOf(timeSlot);
  if (startHour < 0) return null;
  return hourToSlot((startHour + (durationHours ?? 1)) % 24);
}

const CUSTOMER_NAME_EXPR = {
  $cond: [
    { $ifNull: ["$user.name", false] },
    "$user.name",
    { $ifNull: ["$guestInfo.name", "Guest"] },
  ],
};

function parseReportFilters(query) {
  const { from, to, court, bookingType, status, paymentStatus, paymentMethod } = query;
  return {
    from,
    to,
    court: court ? Number(court) : null,
    bookingType: ["reservation", "per_game", "hosted_play"].includes(bookingType) ? bookingType : null,
    status: ["confirmed", "pending_payment", "cancelled"].includes(status) ? status : null,
    paymentStatus: ["paid", "unpaid"].includes(paymentStatus) ? paymentStatus : null,
    paymentMethod: paymentMethod || null,
  };
}

// GET /api/club-analytics/reports/bookings — every reservation (any status), broadened with
// per_game/hosted_play charges when requested. Not revenue-scoped — shows unpaid/cancelled too.
router.get("/reports/bookings", auth, admin, resolveAnalyticsClub, async (req, res) => {
  try {
    await ensureAdvancedAnalyticsBilling(req.club, req.user.userId);
    const f = parseReportFilters(req.query);
    const dateFilter = dateRangeFilter(f.from, f.to);
    const hasRange = Object.keys(dateFilter).length > 0;
    const clubObjId = new mongoose.Types.ObjectId(req.targetClubId);
    const courtMap = new Map((req.club.courts ?? []).map((c, i) => [i + 1, c.name]));

    const rows = [];
    let revenueTotal = 0;

    if (!f.bookingType || f.bookingType === "reservation") {
      const match = {
        clubId: clubObjId,
        ...(hasRange ? { date: dateFilter } : {}),
        ...(f.court ? { court: f.court } : {}),
        ...(f.status ? { status: f.status } : {}),
      };
      const resRows = await Reservation.aggregate([
        { $match: match },
        { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
        { $unwind: { path: "$charges", preserveNullAndEmptyArrays: true } },
        ...(f.paymentStatus ? [{ $match: { "charges.status": f.paymentStatus } }] : []),
        ...(f.paymentMethod ? [{ $match: { "charges.paymentMethod": f.paymentMethod } }] : []),
        { $lookup: { from: "users", localField: "player", foreignField: "_id", as: "user" } },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            date: "$date",
            timeSlot: "$timeSlot",
            durationHours: { $ifNull: ["$durationHours", 1] },
            court: "$court",
            customer: CUSTOMER_NAME_EXPR,
            status: "$status",
            amount: { $ifNull: ["$charges.amount", 0] },
            paymentStatus: "$charges.status",
            paymentMethod: "$charges.paymentMethod",
          },
        },
        { $sort: { date: -1, timeSlot: -1 } },
      ]);
      for (const r of resRows) {
        rows.push({
          bookingDate: r.date,
          customer: r.customer,
          court: courtMap.get(r.court) ?? `Court ${r.court}`,
          bookingType: "Reservation",
          startTime: r.timeSlot,
          endTime: addHoursToSlot(r.timeSlot, r.durationHours),
          durationHours: r.durationHours,
          amount: round2(r.amount),
          paymentStatus: r.paymentStatus ?? null,
          bookingStatus: r.status,
        });
        revenueTotal += r.amount ?? 0;
      }
    }

    // Per Game / Hosted Play have no court/time-slot concept in this schema, and no dedicated
    // "booking status" field — surface what the data actually has rather than inventing values.
    if (!f.court && !f.status) {
      const otherTypes = f.bookingType ? [f.bookingType] : ["per_game", "hosted_play"];
      for (const type of otherTypes.filter((t) => t !== "reservation")) {
        const match = {
          clubId: clubObjId,
          chargeType: type,
          ...(f.paymentStatus ? { status: f.paymentStatus } : {}),
          ...(f.paymentMethod ? { paymentMethod: f.paymentMethod } : {}),
        };
        const otherRows = await Charge.aggregate([
          { $match: match },
          { $addFields: { incomeDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
          ...(hasRange ? [{ $match: { incomeDate: dateFilter } }] : []),
          { $lookup: { from: "users", localField: "playerId", foreignField: "_id", as: "user" } },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              date: "$incomeDate",
              customer: {
                $cond: [{ $ifNull: ["$user.name", false] }, "$user.name", { $ifNull: ["$guestName", "Guest"] }],
              },
              amount: 1,
              paymentStatus: "$status",
              paymentMethod: "$paymentMethod",
            },
          },
          { $sort: { date: -1 } },
        ]);
        for (const r of otherRows) {
          rows.push({
            bookingDate: r.date,
            customer: r.customer,
            court: null,
            bookingType: BOOKING_TYPE_LABELS[type],
            startTime: null,
            endTime: null,
            durationHours: null,
            amount: round2(r.amount),
            paymentStatus: r.paymentStatus,
            bookingStatus: null,
          });
          revenueTotal += r.amount ?? 0;
        }
      }
    }

    rows.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));
    res.json({ rows, totals: { count: rows.length, revenue: round2(revenueTotal) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/club-analytics/reports/revenue — revenue-recognized rows only, sourced from the
// exact same match rules as Financial Statement so this report's totals always reconcile.
router.get("/reports/revenue", auth, admin, resolveAnalyticsClub, async (req, res) => {
  try {
    await ensureAdvancedAnalyticsBilling(req.club, req.user.userId);
    const f = parseReportFilters(req.query);
    const dateFilter = dateRangeFilter(f.from, f.to);
    const hasRange = Object.keys(dateFilter).length > 0;
    const clubObjId = new mongoose.Types.ObjectId(req.targetClubId);
    const courtMap = new Map((req.club.courts ?? []).map((c, i) => [i + 1, c.name]));

    const rows = [];

    if ((!f.bookingType || f.bookingType === "reservation") && f.paymentStatus !== "unpaid") {
      const match = reservationRevenueMatch(clubObjId, dateFilter, hasRange, f.court ? { court: f.court } : {});
      const resRows = await Reservation.aggregate([
        { $match: match },
        { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
        { $unwind: "$charges" },
        ...(f.paymentStatus ? [{ $match: { "charges.status": f.paymentStatus } }] : []),
        ...(f.paymentMethod ? [{ $match: { "charges.paymentMethod": f.paymentMethod } }] : []),
        { $lookup: { from: "users", localField: "player", foreignField: "_id", as: "user" } },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            date: "$date",
            customer: CUSTOMER_NAME_EXPR,
            court: "$court",
            amount: "$charges.amount",
            paymentMethod: "$charges.paymentMethod",
            paymentStatus: "$charges.status",
          },
        },
      ]);
      for (const r of resRows) {
        rows.push({
          date: r.date,
          bookingType: "Reservation",
          customer: r.customer,
          court: courtMap.get(r.court) ?? `Court ${r.court}`,
          amount: round2(r.amount),
          paymentMethod: r.paymentMethod ?? null,
          paymentStatus: r.paymentStatus,
        });
      }
    }

    if (!f.court && f.paymentStatus !== "unpaid") {
      const otherTypes = f.bookingType ? [f.bookingType] : ["per_game", "hosted_play"];
      for (const type of otherTypes.filter((t) => t !== "reservation")) {
        const match = otherChargeMatch(clubObjId, type, f.paymentMethod ? { paymentMethod: f.paymentMethod } : {});
        const otherRows = await Charge.aggregate([
          { $match: match },
          { $addFields: { incomeDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
          ...(hasRange ? [{ $match: { incomeDate: dateFilter } }] : []),
          { $lookup: { from: "users", localField: "playerId", foreignField: "_id", as: "user" } },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              date: "$incomeDate",
              customer: {
                $cond: [{ $ifNull: ["$user.name", false] }, "$user.name", { $ifNull: ["$guestName", "Guest"] }],
              },
              amount: { $subtract: ["$amount", { $ifNull: ["$breakdown.convenienceFee", 0] }] },
              paymentMethod: "$paymentMethod",
            },
          },
        ]);
        for (const r of otherRows) {
          rows.push({
            date: r.date,
            bookingType: BOOKING_TYPE_LABELS[type],
            customer: r.customer,
            court: null,
            amount: round2(r.amount),
            paymentMethod: r.paymentMethod ?? null,
            paymentStatus: "paid",
          });
        }
      }
    }

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    const revenue = round2(rows.reduce((s, r) => s + r.amount, 0));
    res.json({ rows, totals: { count: rows.length, revenue } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/club-analytics/reports/court-utilization
router.get("/reports/court-utilization", auth, admin, resolveAnalyticsClub, async (req, res) => {
  try {
    await ensureAdvancedAnalyticsBilling(req.club, req.user.userId);
    const f = parseReportFilters(req.query);
    const dateFilter = dateRangeFilter(f.from, f.to);
    const hasRange = Object.keys(dateFilter).length > 0;
    const clubObjId = new mongoose.Types.ObjectId(req.targetClubId);
    const match = reservationRevenueMatch(clubObjId, dateFilter, hasRange, f.court ? { court: f.court } : {});

    const courtPerformance = await Reservation.aggregate(buildCourtPerformancePipeline(match));

    const dailyWindowHours = (req.club.closingHour ?? 0) - (req.club.openingHour ?? 0);
    const days = daysInclusive(f.from, f.to);
    const availableHoursPerCourt = dailyWindowHours > 0 ? dailyWindowHours * days : 0;
    const courtMap = new Map((req.club.courts ?? []).map((c, i) => [i + 1, c.name]));

    const rows = courtPerformance.map((r) => ({
      court: courtMap.get(r.court) ?? `Court ${r.court}`,
      availableHours: round2(availableHoursPerCourt),
      bookedHours: round2(r.hours),
      utilizationPct: availableHoursPerCourt > 0 ? round2((r.hours / availableHoursPerCourt) * 100) : null,
    }));

    const totalBooked = round2(rows.reduce((s, r) => s + r.bookedHours, 0));
    const totalAvailable = round2(rows.reduce((s, r) => s + r.availableHours, 0));
    res.json({
      rows,
      totals: {
        bookedHours: totalBooked,
        availableHours: totalAvailable,
        utilizationPct: totalAvailable > 0 ? round2((totalBooked / totalAvailable) * 100) : null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/club-analytics/reports/customers — every customer with a booking in range (no top-10 cap)
router.get("/reports/customers", auth, admin, resolveAnalyticsClub, async (req, res) => {
  try {
    await ensureAdvancedAnalyticsBilling(req.club, req.user.userId);
    const f = parseReportFilters(req.query);
    const dateFilter = dateRangeFilter(f.from, f.to);
    const hasRange = Object.keys(dateFilter).length > 0;
    const clubObjId = new mongoose.Types.ObjectId(req.targetClubId);
    const match = reservationRevenueMatch(clubObjId, dateFilter, hasRange, f.court ? { court: f.court } : {});

    const rows = await Reservation.aggregate([
      { $match: { ...match, player: { $ne: null } } },
      { $lookup: { from: "charges", localField: "_id", foreignField: "reservationId", as: "charges" } },
      { $unwind: "$charges" },
      {
        $group: {
          _id: "$player",
          bookings: { $sum: 1 },
          revenue: { $sum: "$charges.amount" },
          lastBooking: { $max: "$date" },
        },
      },
      { $sort: { revenue: -1 } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          customer: "$user.name",
          email: "$user.email",
          bookings: 1,
          revenue: { $round: ["$revenue", 2] },
          lastBooking: 1,
        },
      },
    ]);

    res.json({
      rows,
      totals: {
        customers: rows.length,
        bookings: rows.reduce((s, r) => s + r.bookings, 0),
        revenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
