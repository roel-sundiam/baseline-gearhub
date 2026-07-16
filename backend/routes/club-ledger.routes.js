const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Club = require("../models/Club");
const Charge = require("../models/Charge");
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

    // Charge income is recognized on paidAt (createdAt fallback for legacy docs)
    // and excludes the platform convenience fee, which is remitted to CourtGo.
    const chargeIncomeExpr = { $subtract: ["$amount", { $ifNull: ["$breakdown.convenienceFee", 0] }] };
    const chargePipeline = [
      { $match: { clubId: clubObjId, status: "paid" } },
      { $addFields: { incomeDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
      ...(hasRange ? [{ $match: { incomeDate: dateFilter } }] : []),
      {
        $facet: {
          byCategory: [
            {
              $group: {
                _id: null,
                courtFee: { $sum: { $ifNull: ["$breakdown.withoutLightFee", 0] } },
                lightFee: { $sum: { $ifNull: ["$breakdown.lightFee", 0] } },
                ballBoyFee: { $sum: { $ifNull: ["$breakdown.ballBoyFee", 0] } },
                guestFee: { $sum: { $ifNull: ["$breakdown.guestFee", 0] } },
                rentalFee: { $sum: { $ifNull: ["$breakdown.rentalFee", 0] } },
                coachingFee: { $sum: { $ifNull: ["$breakdown.coachingFee", 0] } },
                gameFee: { $sum: { $ifNull: ["$breakdown.gameFee", 0] } },
                hostedPlayFee: { $sum: { $ifNull: ["$breakdown.hostedPlayFee", 0] } },
                extraFeeTotal: { $sum: { $ifNull: ["$breakdown.extraFeeTotal", 0] } },
                convenienceFeesExcluded: { $sum: { $ifNull: ["$breakdown.convenienceFee", 0] } },
                total: { $sum: chargeIncomeExpr },
              },
            },
          ],
          byMonth: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$incomeDate" } },
                income: { $sum: chargeIncomeExpr },
              },
            },
          ],
        },
      },
    ];

    const manualMatch = { clubId: clubObjId, ...(hasRange ? { date: dateFilter } : {}) };

    const [[chargeResult], manualByCategory, manualByMonth] = await Promise.all([
      Charge.aggregate(chargePipeline),
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
    ]);

    const catTotals = chargeResult.byCategory[0] ?? {};
    const chargeCategoryKeys = [
      "courtFee", "lightFee", "ballBoyFee", "guestFee", "rentalFee",
      "coachingFee", "gameFee", "hostedPlayFee", "extraFeeTotal",
    ];
    const chargeByCategory = chargeCategoryKeys
      .map((key) => ({ category: key, total: round2(catTotals[key]) }))
      .filter((row) => row.total !== 0);
    const chargeTotal = round2(catTotals.total);

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
    for (const r of chargeResult.byMonth) {
      if (r._id) monthRow(r._id).chargeIncome = round2(r.income);
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
        convenienceFeesExcluded: round2(catTotals.convenienceFeesExcluded),
      },
      manualIncome: { total: manualIncomeTotal, byCategory: manualIncomeByCategory },
      expenses: { total: expensesTotal, byCategory: expensesByCategory },
      byMonth,
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
