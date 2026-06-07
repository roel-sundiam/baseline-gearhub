const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const AppServicePayment = require("../models/AppServicePayment");
const Charge = require("../models/Charge");
const Club = require("../models/Club");

const router = express.Router();

// GET /api/app-service-payments/summary — cross-club overview (superadmin only)
router.get("/summary", auth, superadmin, async (req, res) => {
  try {
    const [clubs, chargeAgg, openPlayAgg, paymentAgg, waiverAgg] = await Promise.all([
      Club.find({ status: { $ne: "suspended" } }, "_id name convenienceFeeRate").lean(),
      Charge.aggregate([
        { $match: { chargeType: "reservation" } },
        { $lookup: { from: "reservations", localField: "reservationId", foreignField: "_id", as: "reservation" } },
        { $unwind: "$reservation" },
        { $match: { "reservation.status": "confirmed" } },
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
        { $match: { type: { $ne: "waiver" } } },
        { $group: { _id: "$clubId", totalPaid: { $sum: "$amount" } } },
      ]),
      AppServicePayment.aggregate([
        { $match: { type: "waiver" } },
        { $group: { _id: "$clubId", totalWaived: { $sum: "$amount" } } },
      ]),
    ]);

    const chargeMap = Object.fromEntries(chargeAgg.map((r) => [r._id.toString(), { totalCourtFees: r.totalCourtFees, totalConvenienceFees: r.totalConvenienceFees }]));
    const openPlayMap = Object.fromEntries(openPlayAgg.map((r) => [r._id.toString(), r.totalOpenPlayFees]));
    const paymentMap = Object.fromEntries(paymentAgg.map((r) => [r._id.toString(), r.totalPaid]));
    const waiverMap = Object.fromEntries(waiverAgg.map((r) => [r._id.toString(), r.totalWaived]));

    const clubData = clubs.map((club) => {
      const id = club._id.toString();
      const chargeData = chargeMap[id] || { totalCourtFees: 0, totalConvenienceFees: 0 };
      const totalCourtFees = chargeData.totalCourtFees;
      const feesOwed = parseFloat((chargeData.totalConvenienceFees + (openPlayMap[id] ?? 0)).toFixed(2));
      const convenienceFeeRate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.10;
      const totalPaid = paymentMap[id] || 0;
      const totalWaived = waiverMap[id] || 0;
      const balance = parseFloat((feesOwed - totalPaid - totalWaived).toFixed(2));
      return { clubId: id, clubName: club.name, convenienceFeeRate, totalCourtFees, feesOwed, totalPaid, totalWaived, balance };
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
