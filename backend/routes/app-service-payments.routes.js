const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const AppServicePayment = require("../models/AppServicePayment");
const Charge = require("../models/Charge");
const Club = require("../models/Club");

const router = express.Router();

// GET /api/app-service-payments/report — convenience fee analytics with date range (superadmin only)
router.get("/report", auth, superadmin, async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const { startDate, endDate } = req.query;
    const rawClubId = req.query.clubId;

    // Charge uses timestamps:true — the date field is createdAt, not date
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const initialMatch = { chargeType: "reservation" };
    if (Object.keys(dateFilter).length) initialMatch.createdAt = dateFilter;
    if (rawClubId && mongoose.Types.ObjectId.isValid(rawClubId)) {
      initialMatch.clubId = new mongoose.Types.ObjectId(rawClubId);
    }

    const confirmedFilter = {
      $or: [
        { "res.status": "confirmed" },
        { res: { $exists: false }, approvalStatus: "approved" },
      ],
    };

    const basePipeline = [
      { $match: initialMatch },
      { $lookup: { from: "reservations", localField: "reservationId", foreignField: "_id", as: "res" } },
      { $unwind: { path: "$res", preserveNullAndEmptyArrays: true } },
      { $match: confirmedFilter },
    ];

    const [facetResult, txDocs, allClubs] = await Promise.all([
      Charge.aggregate([
        ...basePipeline,
        {
          $facet: {
            summary: [
              { $group: { _id: null, totalFees: { $sum: "$breakdown.convenienceFee" }, txCount: { $sum: 1 } } },
            ],
            byMonth: [
              { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, fees: { $sum: "$breakdown.convenienceFee" }, count: { $sum: 1 } } },
              { $sort: { _id: -1 } },
            ],
            byDay: [
              { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, fees: { $sum: "$breakdown.convenienceFee" }, count: { $sum: 1 } } },
              { $sort: { _id: -1 } },
            ],
            byClub: [
              { $group: { _id: "$clubId", fees: { $sum: "$breakdown.convenienceFee" }, count: { $sum: 1 } } },
            ],
          },
        },
      ]),
      // Player name comes from playerId on Charge directly; guestName for guest bookings
      Charge.aggregate([
        ...basePipeline,
        { $lookup: { from: "users", localField: "playerId", foreignField: "_id", as: "playerDoc" } },
        { $unwind: { path: "$playerDoc", preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        { $limit: 500 },
        {
          $project: {
            date: "$createdAt",
            clubId: 1,
            amount: 1,
            convenienceFee: "$breakdown.convenienceFee",
            playerName: {
              $cond: [
                { $ifNull: ["$playerDoc.name", false] },
                "$playerDoc.name",
                {
                  $cond: [
                    { $ifNull: ["$guestName", false] },
                    { $concat: ["$guestName", " (Guest)"] },
                    "Unknown",
                  ],
                },
              ],
            },
          },
        },
      ]),
      Club.find({ status: { $ne: "suspended" } }, "_id name convenienceFeeRate convenienceFeeMode").lean(),
    ]);

    const [result] = facetResult;
    // clubMap only contains non-suspended clubs; byClub entries for suspended clubs are excluded below
    const clubMap = Object.fromEntries(allClubs.map((c) => [c._id.toString(), c]));

    const totalFees = result.summary[0]?.totalFees ?? 0;
    const txCount = result.summary[0]?.txCount ?? 0;

    res.json({
      summary: {
        totalFees: parseFloat(totalFees.toFixed(2)),
        txCount,
        avgFee: txCount > 0 ? parseFloat((totalFees / txCount).toFixed(2)) : 0,
      },
      byMonth: result.byMonth.filter((r) => r._id).map((r) => ({ month: r._id, fees: parseFloat(r.fees.toFixed(2)), count: r.count })),
      byDay: result.byDay.filter((r) => r._id).map((r) => ({ day: r._id, fees: parseFloat(r.fees.toFixed(2)), count: r.count })),
      byClub: result.byClub
        .filter((r) => r._id && clubMap[r._id.toString()])
        .map((r) => {
          const club = clubMap[r._id.toString()];
          return {
            clubId: r._id,
            clubName: club.name,
            feeMode: club.convenienceFeeMode ?? "per_hour",
            feeRate: club.convenienceFeeRate ?? 0.1,
            fees: parseFloat(r.fees.toFixed(2)),
            count: r.count,
          };
        })
        .sort((a, b) => b.fees - a.fees),
      transactions: txDocs.map((t) => ({
        date: t.date,
        clubName: clubMap[t.clubId?.toString()]?.name ?? "Unknown",
        playerName: t.playerName,
        amount: t.amount,
        convenienceFee: t.convenienceFee ?? 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/app-service-payments/summary — cross-club overview (superadmin only)
router.get("/summary", auth, superadmin, async (req, res) => {
  try {
    const [clubs, chargeAgg, openPlayAgg, paymentAgg, waiverAgg, billingAgg] = await Promise.all([
      Club.find({ status: { $ne: "suspended" } }, "_id name convenienceFeeRate convenienceFeeMode convenienceFeeMonthlyAmount").lean(),
      Charge.aggregate([
        { $match: { chargeType: "reservation" } },
        { $lookup: { from: "reservations", localField: "reservationId", foreignField: "_id", as: "reservation" } },
        { $unwind: { path: "$reservation", preserveNullAndEmptyArrays: true } },
        { $match: { $or: [
          { "reservation.status": "confirmed" },
          { "reservation": { $exists: false }, approvalStatus: "approved" },
        ]}},
        {
          $group: {
            _id: "$clubId",
            totalCourtFees: { $sum: "$amount" },
            totalConvenienceFees: { $sum: "$breakdown.convenienceFee" },
          },
        },
      ]),
      Charge.aggregate([
        { $match: { chargeType: "open_play_session" } },
        { $group: { _id: "$clubId", totalOpenPlayFees: { $sum: "$breakdown.convenienceFee" } } },
      ]),
      AppServicePayment.aggregate([
        { $match: { type: "payment" } },
        { $group: { _id: "$clubId", totalPaid: { $sum: "$amount" } } },
      ]),
      AppServicePayment.aggregate([
        { $match: { type: "waiver" } },
        { $group: { _id: "$clubId", totalWaived: { $sum: "$amount" } } },
      ]),
      AppServicePayment.aggregate([
        { $match: { type: "billing" } },
        { $group: { _id: "$clubId", totalBilled: { $sum: "$amount" } } },
      ]),
    ]);

    const chargeMap = Object.fromEntries(chargeAgg.map((r) => [r._id.toString(), { totalCourtFees: r.totalCourtFees, totalConvenienceFees: r.totalConvenienceFees }]));
    const openPlayMap = Object.fromEntries(openPlayAgg.map((r) => [r._id.toString(), r.totalOpenPlayFees]));
    const paymentMap = Object.fromEntries(paymentAgg.map((r) => [r._id.toString(), r.totalPaid]));
    const waiverMap = Object.fromEntries(waiverAgg.map((r) => [r._id.toString(), r.totalWaived]));
    const billingMap = Object.fromEntries(billingAgg.map((r) => [r._id.toString(), r.totalBilled]));

    const clubData = clubs.map((club) => {
      const id = club._id.toString();
      const chargeData = chargeMap[id] || { totalCourtFees: 0, totalConvenienceFees: 0 };
      const totalCourtFees = chargeData.totalCourtFees;
      const convenienceFeeRate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.10;
      const convenienceFeeMode = club.convenienceFeeMode ?? 'per_hour';
      const convenienceFeeMonthlyAmount = club.convenienceFeeMonthlyAmount ?? 0;
      const feesOwed = convenienceFeeMode === 'monthly_flat'
        ? parseFloat((convenienceFeeMonthlyAmount).toFixed(2))
        : parseFloat((chargeData.totalConvenienceFees + (openPlayMap[id] ?? 0) + (billingMap[id] ?? 0)).toFixed(2));
      const totalPaid = paymentMap[id] || 0;
      const totalWaived = waiverMap[id] || 0;
      const balance = convenienceFeeMode === 'monthly_flat'
        ? parseFloat(Math.max(0, feesOwed - totalPaid).toFixed(2))
        : parseFloat((feesOwed - totalPaid - totalWaived).toFixed(2));
      return { clubId: id, clubName: club.name, convenienceFeeRate, convenienceFeeMode, convenienceFeeMonthlyAmount, totalCourtFees, feesOwed, totalPaid, totalWaived, balance };
    });

    clubData.sort((a, b) => b.balance - a.balance);

    const totals = clubData.reduce(
      (acc, c) => {
        acc.feesOwed = parseFloat((acc.feesOwed + c.feesOwed).toFixed(2));
        acc.totalPaid = parseFloat((acc.totalPaid + c.totalPaid).toFixed(2));
        acc.totalWaived = parseFloat((acc.totalWaived + c.totalWaived).toFixed(2));
        acc.outstanding = parseFloat((acc.outstanding + Math.max(0, c.balance)).toFixed(2));
        return acc;
      },
      { feesOwed: 0, totalPaid: 0, totalWaived: 0, outstanding: 0 },
    );

    res.json({ clubs: clubData, totals });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/app-service-payments/waive — waive outstanding balance for a club (superadmin only)
router.post("/waive", auth, superadmin, async (req, res) => {
  try {
    const { clubId, amount, note } = req.body;
    if (!clubId) return res.status(400).json({ error: "clubId is required" });
    if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount required" });

    const payment = await AppServicePayment.create({
      clubId,
      amount,
      type: "waiver",
      note: note || undefined,
      paidBy: req.user.userId,
    });
    await payment.populate("paidBy", "name email");
    res.status(201).json({ message: "Balance waived", payment });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/app-service-payments/bill-month — bill a monthly flat fee club for one month (superadmin only)
router.post("/bill-month", auth, superadmin, async (req, res) => {
  try {
    const { clubId } = req.body;
    if (!clubId) return res.status(400).json({ error: "clubId is required" });
    const club = await Club.findById(clubId).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.convenienceFeeMode !== "monthly_flat") {
      return res.status(400).json({ error: "Club is not on monthly flat billing" });
    }
    const amount = club.convenienceFeeMonthlyAmount ?? 0;
    if (amount <= 0) return res.status(400).json({ error: "Club monthly fee amount is not set" });
    const payment = await AppServicePayment.create({
      clubId,
      amount,
      type: "billing",
      paidBy: req.user.userId,
    });
    await payment.populate("paidBy", "name email");
    res.status(201).json({ message: "Monthly billing recorded", payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/app-service-payments/fee-info — get this club's convenience fee settings (admin only)
router.get("/fee-info", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this user" });
    const club = await Club.findById(clubId).select("convenienceFeeMode convenienceFeeMonthlyAmount").lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({
      convenienceFeeMode: club.convenienceFeeMode ?? 'per_hour',
      convenienceFeeMonthlyAmount: club.convenienceFeeMonthlyAmount ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/app-service-payments — list all (admin only)
router.get("/", auth, admin, async (req, res) => {
  try {
    const raw = req.query.clubId;
    const clubId = (Array.isArray(raw) ? raw[0] : raw) || req.user.clubId;
    const payments = await AppServicePayment.find(clubId ? { clubId } : {})
      .populate("paidBy", "name email")
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/app-service-payments — record a payment (admin only)
router.post("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.body.clubId || req.user.clubId;
    const { amount, paymentMethod, note } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount required" });
    }
    if (!["GCash", "QRPh"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Valid paymentMethod required" });
    }
    const payment = await AppServicePayment.create({
      clubId,
      amount,
      paymentMethod,
      note: note || undefined,
      paidBy: req.user.userId,
    });
    await payment.populate("paidBy", "name email");
    res.status(201).json({ message: "Payment recorded", payment });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
