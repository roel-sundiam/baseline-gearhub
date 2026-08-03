const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const AppServicePayment = require("../models/AppServicePayment");
const Charge = require("../models/Charge");
const Club = require("../models/Club");
const { ensureFinanceReportBilling, getEffectiveFinanceReportFee } = require("../utils/financeReportBilling");
const { getEffectiveMemberActivationFee, getMemberFreeTierCount, countApprovedMembers } = require("../utils/memberActivationBilling");

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

    const initialMatch = { chargeType: { $in: ["reservation", "open_play_session", "per_game", "hosted_play"] } };
    if (Object.keys(dateFilter).length) initialMatch.createdAt = dateFilter;
    if (rawClubId && mongoose.Types.ObjectId.isValid(rawClubId)) {
      initialMatch.clubId = new mongoose.Types.ObjectId(rawClubId);
    }

    const confirmedFilter = {
      $or: [
        { chargeType: { $in: ["open_play_session", "per_game"] } },
        { chargeType: "hosted_play", approvalStatus: { $ne: "rejected" } },
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
            _id: 1,
            date: "$createdAt",
            clubId: 1,
            amount: 1,
            chargeType: 1,
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
        _id: t._id.toString(),
        date: t.date,
        clubName: clubMap[t.clubId?.toString()]?.name ?? "Unknown",
        playerName: t.playerName,
        amount: t.amount,
        convenienceFee: t.convenienceFee ?? 0,
        chargeType: t.chargeType ?? "reservation",
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
    // Accrue any pending Finance Report add-on billing before aggregating owed amounts
    const financeReportClubs = await Club.find(
      { financeReportEnabled: true, status: { $ne: "suspended" } },
      "_id financeReportEnabled financeReportSubscribedAt financeReportFeeOverride",
    ).lean();
    await Promise.all(financeReportClubs.map((c) => ensureFinanceReportBilling(c, req.user.userId)));

    const [clubs, chargeAgg, openPlayAgg, perGameAgg, hostedPlayAgg, paymentAgg, waiverAgg, billingAgg, defaultFinanceReportFee] = await Promise.all([
      Club.find({ status: { $ne: "suspended" } }, "_id name convenienceFeeRate convenienceFeeMode convenienceFeeMonthlyAmount financeReportEnabled financeReportSubscribedAt financeReportFeeOverride").lean(),
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
      Charge.aggregate([
        { $match: { chargeType: "per_game" } },
        { $group: { _id: "$clubId", totalPerGameFees: { $sum: "$breakdown.convenienceFee" } } },
      ]),
      Charge.aggregate([
        { $match: { chargeType: "hosted_play", approvalStatus: { $ne: "rejected" } } },
        {
          $group: {
            _id: "$clubId",
            totalHostedPlayFees: { $sum: "$breakdown.convenienceFee" },
            totalHostedPlaySessionFees: {
              $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, "$amount", 0] },
            },
          },
        },
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
        {
          $group: {
            _id: "$clubId",
            totalBilled: { $sum: "$amount" },
            // Finance Report billing docs are tagged with billingKey "finance_report:YYYY-MM" —
            // segregate them out so they aren't mislabeled as a "convenience fee".
            totalFinanceReportBilled: {
              $sum: {
                $cond: [
                  { $regexMatch: { input: { $ifNull: ["$billingKey", ""] }, regex: /^finance_report:/ } },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]),
      getEffectiveFinanceReportFee(null),
    ]);

    const chargeMap = Object.fromEntries(chargeAgg.map((r) => [r._id.toString(), { totalCourtFees: r.totalCourtFees, totalConvenienceFees: r.totalConvenienceFees }]));
    const openPlayMap = Object.fromEntries(openPlayAgg.map((r) => [r._id.toString(), r.totalOpenPlayFees]));
    const perGameMap = Object.fromEntries(perGameAgg.map((r) => [r._id.toString(), r.totalPerGameFees]));
    const hostedPlayMap = Object.fromEntries(hostedPlayAgg.map((r) => [r._id.toString(), { convFee: r.totalHostedPlayFees, sessionFees: r.totalHostedPlaySessionFees }]));
    const paymentMap = Object.fromEntries(paymentAgg.map((r) => [r._id.toString(), r.totalPaid]));
    const waiverMap = Object.fromEntries(waiverAgg.map((r) => [r._id.toString(), r.totalWaived]));
    const billingMap = Object.fromEntries(billingAgg.map((r) => [r._id.toString(), r.totalBilled]));
    const financeReportBilledMap = Object.fromEntries(billingAgg.map((r) => [r._id.toString(), r.totalFinanceReportBilled]));

    const clubData = clubs.map((club) => {
      const id = club._id.toString();
      const chargeData = chargeMap[id] || { totalCourtFees: 0, totalConvenienceFees: 0 };
      const totalCourtFees = chargeData.totalCourtFees;
      const convenienceFeeRate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.10;
      const convenienceFeeMode = club.convenienceFeeMode ?? 'per_hour';
      const convenienceFeeMonthlyAmount = club.convenienceFeeMonthlyAmount ?? 0;
      const hostedPlayData = hostedPlayMap[id] ?? { convFee: 0, sessionFees: 0 };
      // monthly_flat clubs also owe their billing entries (queue management, finance report add-on)
      // plus Hosted Play convenience fees, which are billed per transaction independently of the plan
      const feesOwed = convenienceFeeMode === 'monthly_flat'
        ? parseFloat((convenienceFeeMonthlyAmount + hostedPlayData.convFee + (billingMap[id] ?? 0)).toFixed(2))
        : parseFloat((chargeData.totalConvenienceFees + (openPlayMap[id] ?? 0) + (perGameMap[id] ?? 0) + hostedPlayData.convFee + (billingMap[id] ?? 0)).toFixed(2));
      const totalPaid = paymentMap[id] || 0;
      const totalWaived = waiverMap[id] || 0;
      const totalHostedPlaySessionFees = parseFloat((hostedPlayData.sessionFees ?? 0).toFixed(2));
      const balance = convenienceFeeMode === 'monthly_flat'
        ? parseFloat(Math.max(0, feesOwed - totalPaid - totalWaived).toFixed(2))
        : parseFloat((feesOwed - totalPaid - totalWaived).toFixed(2));
      const financeReportMonthlyFee = typeof club.financeReportFeeOverride === 'number'
        ? club.financeReportFeeOverride
        : defaultFinanceReportFee;
      // feesOwed/balance stay the grand total (what the club must actually settle); this is just
      // the true convenience-fee portion, with the Finance Report add-on billing pulled out.
      const financeReportFeesBilled = parseFloat((financeReportBilledMap[id] ?? 0).toFixed(2));
      const convenienceFeesOwed = parseFloat((feesOwed - financeReportFeesBilled).toFixed(2));
      return {
        clubId: id, clubName: club.name, convenienceFeeRate, convenienceFeeMode, convenienceFeeMonthlyAmount,
        totalCourtFees, totalHostedPlaySessionFees, feesOwed, totalPaid, totalWaived, balance,
        convenienceFeesOwed, financeReportFeesBilled,
        financeReportEnabled: !!club.financeReportEnabled,
        financeReportSubscribedAt: club.financeReportSubscribedAt ?? null,
        financeReportFeeOverride: club.financeReportFeeOverride ?? null,
        financeReportMonthlyFee,
      };
    });

    clubData.sort((a, b) => b.balance - a.balance);

    const totals = clubData.reduce(
      (acc, c) => {
        acc.feesOwed = parseFloat((acc.feesOwed + c.feesOwed).toFixed(2));
        acc.totalPaid = parseFloat((acc.totalPaid + c.totalPaid).toFixed(2));
        acc.totalWaived = parseFloat((acc.totalWaived + c.totalWaived).toFixed(2));
        acc.outstanding = parseFloat((acc.outstanding + Math.max(0, c.balance)).toFixed(2));
        acc.convenienceFeesOwed = parseFloat((acc.convenienceFeesOwed + c.convenienceFeesOwed).toFixed(2));
        acc.financeReportFeesBilled = parseFloat((acc.financeReportFeesBilled + c.financeReportFeesBilled).toFixed(2));
        return acc;
      },
      { feesOwed: 0, totalPaid: 0, totalWaived: 0, outstanding: 0, convenienceFeesOwed: 0, financeReportFeesBilled: 0 },
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

// GET /api/app-service-payments/fee-info — get this club's fee settings + balance alert state (admin only)
router.get("/fee-info", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this user" });
    const mongoose = require("mongoose");
    const clubObjId = new mongoose.Types.ObjectId(clubId);

    // Accrue any pending Finance Report add-on billing before computing the balance
    const clubForBilling = await Club.findById(clubId)
      .select("financeReportEnabled financeReportSubscribedAt financeReportFeeOverride")
      .lean();
    if (!clubForBilling) return res.status(404).json({ error: "Club not found" });
    await ensureFinanceReportBilling(clubForBilling, req.user.userId);
    const financeReportMonthlyFee = await getEffectiveFinanceReportFee(clubForBilling);
    const memberActivationFee = await getEffectiveMemberActivationFee();
    const memberFreeTierCount = await getMemberFreeTierCount();
    const approvedMemberCount = await countApprovedMembers(clubId);

    const [club, chargeAgg, paymentAgg, waiverAgg, billingAgg] = await Promise.all([
      Club.findById(clubId).select("convenienceFeeMode convenienceFeeMonthlyAmount balanceAlertEnabled").lean(),
      // Only confirmed reservation charges + all open_play_session / per_game / hosted_play charges
      Charge.aggregate([
        { $match: { chargeType: { $in: ["reservation", "open_play_session", "per_game", "hosted_play"] }, clubId: clubObjId } },
        { $lookup: { from: "reservations", localField: "reservationId", foreignField: "_id", as: "reservation" } },
        { $unwind: { path: "$reservation", preserveNullAndEmptyArrays: true } },
        { $match: { $or: [
          { chargeType: "open_play_session" },
          { chargeType: "per_game" },
          { chargeType: "hosted_play", approvalStatus: { $ne: "rejected" } },
          { "reservation.status": "confirmed" },
          { "reservation": { $exists: false }, approvalStatus: "approved" },
        ]}},
        { $group: {
          _id: null,
          totalConvenienceFees: { $sum: "$breakdown.convenienceFee" },
          hostedPlayConvenienceFees: {
            $sum: { $cond: [{ $eq: ["$chargeType", "hosted_play"] }, "$breakdown.convenienceFee", 0] },
          },
        } },
      ]),
      AppServicePayment.aggregate([
        { $match: { type: "payment", clubId: clubObjId } },
        { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
      ]),
      AppServicePayment.aggregate([
        { $match: { type: "waiver", clubId: clubObjId } },
        { $group: { _id: null, totalWaived: { $sum: "$amount" } } },
      ]),
      AppServicePayment.aggregate([
        { $match: { type: "billing", clubId: clubObjId } },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: "$amount" },
            totalFinanceReportBilled: {
              $sum: {
                $cond: [
                  { $regexMatch: { input: { $ifNull: ["$billingKey", ""] }, regex: /^finance_report:/ } },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    if (!club) return res.status(404).json({ error: "Club not found" });

    const convenienceFeeMode = club.convenienceFeeMode ?? 'per_hour';
    const convenienceFeeMonthlyAmount = club.convenienceFeeMonthlyAmount ?? 0;
    const totalConvenienceFees = chargeAgg[0]?.totalConvenienceFees ?? 0;
    const hostedPlayConvenienceFees = chargeAgg[0]?.hostedPlayConvenienceFees ?? 0;
    const totalBilled = billingAgg[0]?.totalBilled ?? 0;
    const totalFinanceReportBilled = billingAgg[0]?.totalFinanceReportBilled ?? 0;
    const totalPaid = paymentAgg[0]?.totalPaid ?? 0;
    const totalWaived = waiverAgg[0]?.totalWaived ?? 0;

    // Monthly flat replaces reservation/open-play/per-game per-transaction fees, but Hosted Play
    // convenience fees are billed per transaction independently of the plan, on top of the flat amount.
    const feesOwed = convenienceFeeMode === 'monthly_flat'
      ? convenienceFeeMonthlyAmount + hostedPlayConvenienceFees + totalBilled
      : totalConvenienceFees + totalBilled;
    const balance = parseFloat(Math.max(0, feesOwed - totalPaid - totalWaived).toFixed(2));
    // feesOwed/balance stay the grand total (what's actually owed); this is just the true
    // convenience-fee portion, with the Finance Report add-on billing pulled out.
    const convenienceFeesOwed = parseFloat((feesOwed - totalFinanceReportBilled).toFixed(2));

    res.json({
      convenienceFeeMode,
      convenienceFeeMonthlyAmount,
      balanceAlertEnabled: club.balanceAlertEnabled ?? false,
      balance,
      convenienceFeesOwed,
      financeReportFeesBilled: parseFloat(totalFinanceReportBilled.toFixed(2)),
      financeReportEnabled: !!clubForBilling.financeReportEnabled,
      financeReportSubscribedAt: clubForBilling.financeReportSubscribedAt ?? null,
      // Effective price, returned even when unsubscribed so the paywall can show it
      financeReportMonthlyFee,
      memberActivationFee,
      memberFreeTierCount,
      approvedMemberCount,
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
    const filter = clubId ? { clubId } : {};
    const dateFilter = {};
    if (req.query.startDate) dateFilter.$gte = new Date(req.query.startDate);
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;

    const payments = await AppServicePayment.find(filter)
      .populate("paidBy", "name email")
      .populate("clubId", "name")
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
    const { amount, paymentMethod, note, paymentScreenshot } = req.body;
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
      paymentScreenshot: typeof paymentScreenshot === "string" && paymentScreenshot.startsWith("https://")
        ? paymentScreenshot
        : null,
      note: note || undefined,
      paidBy: req.user.userId,
    });
    await payment.populate("paidBy", "name email");
    res.status(201).json({ message: "Payment recorded", payment });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/app-service-payments/charges/:id/clear-convenience-fee — zero out conv. fee (superadmin only)
router.patch("/charges/:id/clear-convenience-fee", auth, superadmin, async (req, res) => {
  try {
    const charge = await Charge.findById(req.params.id);
    if (!charge) return res.status(404).json({ error: "Charge not found" });
    const convFee = charge.breakdown?.convenienceFee ?? 0;
    if (convFee <= 0) return res.status(400).json({ error: "No convenience fee to remove" });
    charge.amount = Math.max(0, parseFloat((charge.amount - convFee).toFixed(2)));
    charge.breakdown.convenienceFee = 0;
    await charge.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/app-service-payments/:id/screenshot — attach/replace developer payment proof
router.patch("/:id/screenshot", auth, admin, async (req, res) => {
  try {
    const { paymentScreenshot } = req.body;
    if (typeof paymentScreenshot !== "string" || !paymentScreenshot.startsWith("https://")) {
      return res.status(400).json({ error: "Valid paymentScreenshot URL required" });
    }

    const payment = await AppServicePayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    const isSuperadmin = req.user.role === "superadmin";
    const sameClub = req.user.clubId && payment.clubId?.toString() === req.user.clubId;
    if (!isSuperadmin && !sameClub) {
      return res.status(403).json({ error: "Access denied" });
    }

    payment.paymentScreenshot = paymentScreenshot;
    await payment.save();
    await payment.populate("paidBy", "name email");
    await payment.populate("clubId", "name");

    res.json({ message: "Payment screenshot saved", payment });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/app-service-payments/:id — delete a billing entry (superadmin only)
router.delete("/:id", auth, superadmin, async (req, res) => {
  try {
    const payment = await AppServicePayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.type !== "billing") return res.status(400).json({ error: "Only billing entries can be deleted" });
    await payment.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
