const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Club = require("../models/Club");
const Charge = require("../models/Charge");
const Reservation = require("../models/Reservation");
const ClubLedgerEntry = require("../models/ClubLedgerEntry");
const { ownsClub } = require("../utils/scope");
const { ensureFinanceReportBilling } = require("../utils/financeReportBilling");

const router = express.Router();

const round2 = (n) => parseFloat((n ?? 0).toFixed(2));

// Gates POST/PUT/DELETE on an active Finance Report subscription for the caller's own club.
// Only club admins manage their own club's manual entries — superadmin oversight is read-only
// (see resolveReportClub below), so this always resolves to req.user.clubId.
async function requireFinanceReport(req, res, next) {
  try {
    if (!req.user.clubId) {
      return res.status(400).json({ error: "No club associated with this user" });
    }
    const club = await Club.findById(req.user.clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (!club.financeReportEnabled) {
      return res.status(403).json({ error: "finance_report_locked" });
    }
    req.club = club;
    req.targetClubId = req.user.clubId;
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}

// Gates the read-only GET routes (list entries, report). Club admins view their own club
// (subscription required). Superadmin has full oversight access to every club's Finance
// Report via ?clubId=..., regardless of that club's subscription status.
async function resolveReportClub(req, res, next) {
  try {
    const isSuperadmin = req.user.role === "superadmin";
    const clubId = isSuperadmin ? req.query.clubId : req.user.clubId;
    if (!clubId) {
      return res.status(400).json({ error: isSuperadmin ? "clubId is required" : "No club associated with this user" });
    }
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (!isSuperadmin && !club.financeReportEnabled) {
      return res.status(403).json({ error: "finance_report_locked" });
    }
    req.club = club;
    req.targetClubId = clubId;
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}

function parseEntryBody(body) {
  const { type, category, amount, description, date, notes } = body;
  if (!["income", "expense"].includes(type)) return { error: "type must be income or expense" };
  if (!category || !String(category).trim()) return { error: "category is required" };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Valid amount required" };
  const entryDate = new Date(date);
  if (isNaN(entryDate.getTime())) return { error: "Valid date required" };
  return {
    fields: {
      type,
      category: String(category).trim(),
      amount: amt,
      description: description || "",
      date: entryDate,
      notes,
    },
  };
}

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

// POST /api/club-ledger — create a manual income/expense entry
router.post("/", auth, admin, requireFinanceReport, async (req, res) => {
  try {
    const parsed = parseEntryBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const entry = new ClubLedgerEntry({
      ...parsed.fields,
      clubId: req.user.clubId,
      createdBy: req.user.userId,
    });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/club-ledger — list entries with optional filters (own club; superadmin may pass ?clubId=)
router.get("/", auth, admin, resolveReportClub, async (req, res) => {
  try {
    const { from, to, type } = req.query;
    const filter = { clubId: req.targetClubId };
    const dateFilter = dateRangeFilter(from, to);
    if (Object.keys(dateFilter).length) filter.date = dateFilter;
    if (type) filter.type = type;

    const entries = await ClubLedgerEntry.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/club-ledger/report — income & expenses report (own club; superadmin may pass ?clubId=
// to view any club's report, regardless of that club's subscription status)
router.get("/report", auth, admin, resolveReportClub, async (req, res) => {
  try {
    await ensureFinanceReportBilling(req.club, req.user.userId);

    const { from, to } = req.query;
    const dateFilter = dateRangeFilter(from, to);
    const hasRange = Object.keys(dateFilter).length > 0;
    const clubObjId = new mongoose.Types.ObjectId(req.targetClubId);
    const reservationMatch = { clubId: clubObjId, status: "confirmed", ...(hasRange ? { date: dateFilter } : {}) };

    // Reservation income is recognized by the reservation's court date (not payment date),
    // for confirmed reservations only — matching the Bookings tab on /admin/finance. It
    // includes charges regardless of paid/unpaid status and does not net out the convenience
    // fee, so the two pages tally for the same date range.
    const reservationIncomePipeline = [
      { $match: reservationMatch },
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

    // Non-reservation charges (open play, per-game, hosted play, session) have no Bookings-tab
    // equivalent to reconcile against, so they keep the original cash-basis definition: paid
    // only, keyed by payment date, net of the convenience fee (remitted to CourtGo).
    const otherChargeIncomeExpr = { $subtract: ["$amount", { $ifNull: ["$breakdown.convenienceFee", 0] }] };
    const otherChargePipeline = [
      { $match: { clubId: clubObjId, chargeType: { $ne: "reservation" }, status: "paid" } },
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

    const manualMatch = { clubId: clubObjId, ...(hasRange ? { date: dateFilter } : {}) };

    const [[reservationResult], [otherResult], manualByCategory, manualByMonth, [hoursResult]] = await Promise.all([
      Reservation.aggregate(reservationIncomePipeline),
      Charge.aggregate(otherChargePipeline),
      ClubLedgerEntry.aggregate([
        { $match: manualMatch },
        { $group: { _id: { category: "$category", type: "$type" }, total: { $sum: "$amount" } } },
        { $project: { _id: 0, category: "$_id.category", type: "$_id.type", total: 1 } },
        { $sort: { type: 1, category: 1 } },
      ]),
      ClubLedgerEntry.aggregate([
        { $match: manualMatch },
        {
          $group: {
            _id: { month: { $dateToString: { format: "%Y-%m", date: "$date" } }, type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),
      Reservation.aggregate([
        { $match: reservationMatch },
        { $group: { _id: null, totalHours: { $sum: { $ifNull: ["$durationHours", 1] } } } },
      ]),
    ]);

    const resTotals = reservationResult.byCategory[0] ?? {};
    const otherTotals = otherResult.byCategory[0] ?? {};
    const chargeCategoryKeys = [
      { key: "courtFee", source: resTotals },
      { key: "lightFee", source: resTotals },
      { key: "ballBoyFee", source: resTotals },
      { key: "guestFee", source: resTotals },
      { key: "rentalRacketFee", source: resTotals },
      { key: "rentalBalls50Fee", source: resTotals },
      { key: "rentalBalls100Fee", source: resTotals },
      { key: "rentalBallMachineFee", source: resTotals },
      { key: "coachingFee", source: resTotals },
      { key: "gameFee", source: otherTotals },
      { key: "hostedPlayFee", source: otherTotals },
      { key: "extraFeeTotal", source: resTotals },
    ];
    const chargeByCategory = chargeCategoryKeys
      .map(({ key, source }) => ({ category: key, total: round2(source[key]) }))
      .filter((row) => row.total !== 0);
    const chargeTotal = round2((resTotals.total ?? 0) + (otherTotals.total ?? 0));

    // Break out each of the club's currently-configured Additional Booking Fees (set up by the
    // superadmin on the club) as its own named row — even if it wasn't charged in this period,
    // so admins can see it's an applicable fee for this club. Any charged extra fee whose name
    // no longer matches a configured fee (renamed/removed since) falls into a catch-all "Other".
    const configuredByKey = new Map();
    for (const fee of req.club.additionalFees ?? []) {
      const name = (fee.name ?? "").trim();
      if (name) configuredByKey.set(name.toLowerCase(), name);
    }
    const chargedByKey = new Map((reservationResult.extraFeesByName ?? []).map((row) => [row._id, row.total]));

    const additionalFees = [...configuredByKey.entries()]
      .map(([key, name]) => ({ name, total: round2(chargedByKey.get(key) ?? 0) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    let otherFeeTotal = 0;
    for (const [key, total] of chargedByKey.entries()) {
      if (!configuredByKey.has(key)) otherFeeTotal += total;
    }

    // Give each booking row the same per-club additional-fee breakdown as the summary above,
    // so the Bookings Detail export has one column per fee this club has actually configured.
    const bookings = (reservationResult.bookings ?? []).map((b) => {
      const rowExtraByKey = new Map();
      for (const ef of b.extraFees ?? []) {
        const key = (ef.name ?? "").trim().toLowerCase();
        if (!key) continue;
        rowExtraByKey.set(key, (rowExtraByKey.get(key) ?? 0) + (ef.amount ?? 0));
      }
      const rowAdditionalFees = additionalFees.map(({ name }) => ({
        name,
        total: round2(rowExtraByKey.get(name.toLowerCase()) ?? 0),
      }));
      let rowOtherFee = 0;
      for (const [key, total] of rowExtraByKey.entries()) {
        if (!configuredByKey.has(key)) rowOtherFee += total;
      }
      const { extraFees, ...rest } = b;
      return { ...rest, additionalFees: rowAdditionalFees, otherFee: round2(rowOtherFee) };
    });

    const manualIncomeByCategory = manualByCategory
      .filter((r) => r.type === "income")
      .map((r) => ({ category: r.category, total: round2(r.total) }));
    const expensesByCategory = manualByCategory
      .filter((r) => r.type === "expense")
      .map((r) => ({ category: r.category, total: round2(r.total) }));
    const manualIncomeTotal = round2(manualIncomeByCategory.reduce((s, r) => s + r.total, 0));
    const expensesTotal = round2(expensesByCategory.reduce((s, r) => s + r.total, 0));

    // Merge charge income + manual entries into one month-keyed trend.
    const months = {};
    const monthRow = (month) => (months[month] ??= { month, chargeIncome: 0, manualIncome: 0, expenses: 0 });
    for (const r of reservationResult.byMonth) {
      if (r._id) monthRow(r._id).chargeIncome = round2(monthRow(r._id).chargeIncome + r.income);
    }
    for (const r of otherResult.byMonth) {
      if (r._id) monthRow(r._id).chargeIncome = round2(monthRow(r._id).chargeIncome + r.income);
    }
    for (const r of manualByMonth) {
      const row = monthRow(r._id.month);
      if (r._id.type === "income") row.manualIncome = round2(r.total);
      else row.expenses = round2(r.total);
    }
    const byMonth = Object.values(months)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => {
        const income = round2(row.chargeIncome + row.manualIncome);
        return { ...row, income, net: round2(income - row.expenses) };
      });

    const totalIncome = round2(chargeTotal + manualIncomeTotal);

    res.json({
      totalIncome,
      totalExpenses: expensesTotal,
      net: round2(totalIncome - expensesTotal),
      chargeIncome: {
        total: chargeTotal,
        byCategory: chargeByCategory,
        convenienceFeesExcluded: round2(otherTotals.convenienceFeesExcluded),
      },
      manualIncome: { total: manualIncomeTotal, byCategory: manualIncomeByCategory },
      expenses: { total: expensesTotal, byCategory: expensesByCategory },
      byMonth,
      hoursAndFees: {
        totalHours: round2(hoursResult?.totalHours ?? 0),
        excessPersonFee: round2(resTotals.guestFee),
        coachingFee: round2(resTotals.coachingFee),
        additionalFees,
        otherFee: round2(otherFeeTotal),
      },
      bookings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/club-ledger/:id — update entry
router.put("/:id", auth, admin, requireFinanceReport, async (req, res) => {
  try {
    const entry = await ClubLedgerEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (!ownsClub(req, entry.clubId)) return res.status(403).json({ error: "Access denied" });

    const parsed = parseEntryBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    Object.assign(entry, parsed.fields);
    await entry.save();
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/club-ledger/:id — delete entry
router.delete("/:id", auth, admin, requireFinanceReport, async (req, res) => {
  try {
    const entry = await ClubLedgerEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (!ownsClub(req, entry.clubId)) return res.status(403).json({ error: "Access denied" });

    await entry.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
