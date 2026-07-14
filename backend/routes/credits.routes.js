const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Credit = require("../models/Credit");
const Charge = require("../models/Charge");
const User = require("../models/User");
const { sendPushToUser } = require("../utils/push");
const { ownsClub } = require("../utils/scope");
const { syncChargePaidSideEffects } = require("./charges.routes");
const { getCreditBalance: getBalance, redeemCredit } = require("../utils/credit");

const router = express.Router();

// GET /api/credits/my - player's own balance + history
router.get("/my", auth, async (req, res) => {
  try {
    const playerId = req.user.userId;
    const clubId = req.user.clubId;
    const [balance, history] = await Promise.all([
      getBalance(clubId, playerId),
      Credit.find({ clubId, playerId })
        .populate("chargeId", "amount chargeType")
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    res.json({ balance, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/credits/members - admin: club members with derived balances
router.get("/members", auth, admin, async (req, res) => {
  try {
    const rawClubId = req.query.clubId;
    const clubId = Array.isArray(rawClubId) ? rawClubId[0] : rawClubId || req.user.clubId;
    if (!ownsClub(req, clubId)) return res.status(403).json({ error: "Access denied" });

    const [members, balances] = await Promise.all([
      User.find({ clubId, role: "player" }).select("name email username").sort({ name: 1 }).lean(),
      Credit.aggregate([
        { $match: { clubId: new mongoose.Types.ObjectId(clubId) } },
        { $group: { _id: "$playerId", balance: { $sum: "$amount" } } },
      ]),
    ]);

    const balanceByPlayer = new Map(balances.map((b) => [String(b._id), b.balance]));
    const result = members.map((m) => ({
      ...m,
      balance: balanceByPlayer.get(String(m._id)) || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/credits/history/:playerId - admin: one member's full ledger
router.get("/history/:playerId", auth, admin, async (req, res) => {
  try {
    const player = await User.findById(req.params.playerId).select("clubId name email").lean();
    if (!player) return res.status(404).json({ error: "Member not found" });
    if (!ownsClub(req, player.clubId)) return res.status(403).json({ error: "Access denied" });

    const [balance, history] = await Promise.all([
      getBalance(player.clubId, player._id),
      Credit.find({ clubId: player.clubId, playerId: player._id })
        .populate("grantedBy", "name")
        .populate("chargeId", "amount chargeType")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({ player: { _id: player._id, name: player.name, email: player.email }, balance, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/credits/grant - admin grants credit to a member
router.post("/grant", auth, admin, async (req, res) => {
  try {
    const { playerId, amount, reason } = req.body;

    if (!playerId || !(amount > 0)) {
      return res.status(400).json({ error: "playerId and a positive amount are required" });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: "reason is required" });
    }

    const player = await User.findById(playerId).select("clubId role name").lean();
    if (!player || player.role !== "player") {
      return res.status(404).json({ error: "Member not found" });
    }
    if (!ownsClub(req, player.clubId)) return res.status(403).json({ error: "Access denied" });

    const credit = await Credit.create({
      clubId: player.clubId,
      playerId: player._id,
      type: "grant",
      amount,
      reason: String(reason).trim(),
      grantedBy: req.user.userId,
    });

    const newBalance = await getBalance(player.clubId, player._id);

    sendPushToUser(player._id, {
      title: "Credit Granted",
      body: `₱${Number(amount).toLocaleString()} credit was added to your account: ${credit.reason}`,
      url: "/player/payments",
      tag: "credit-granted",
    }).catch(() => {});

    res.json({ message: "Credit granted", credit, newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/credits/apply/:chargeId - player (or admin) applies available credit to an owed charge
router.patch("/apply/:chargeId", auth, async (req, res) => {
  try {
    const charge = await Charge.findById(req.params.chargeId);
    if (!charge) return res.status(404).json({ error: "Charge not found" });

    if (!charge.playerId) {
      return res.status(400).json({ error: "Guest charges cannot redeem credit" });
    }

    const isOwner = charge.playerId.toString() === req.user.userId;
    const isAdmin = (req.user.role === "admin" || req.user.role === "superadmin") && ownsClub(req, charge.clubId);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Access denied" });

    if (charge.status === "paid") {
      return res.status(400).json({ error: "Charge already paid" });
    }

    const remaining = charge.amount - (charge.creditApplied || 0);
    if (remaining <= 0) {
      return res.status(400).json({ error: "Charge already fully covered" });
    }

    const balance = await getBalance(charge.clubId, charge.playerId);
    if (balance <= 0) {
      return res.status(400).json({ error: "No credit balance available" });
    }

    const applyAmount = Math.min(balance, remaining);

    await redeemCredit({
      clubId: charge.clubId,
      playerId: charge.playerId,
      amount: applyAmount,
      chargeId: charge._id,
      grantedBy: req.user.userId,
    });

    charge.creditApplied = (charge.creditApplied || 0) + applyAmount;

    const fullyCovered = applyAmount === remaining;
    if (fullyCovered) {
      charge.paymentMethod = "Credit";
      charge.status = "paid";
      charge.approvalStatus = "approved";
      charge.paidAt = new Date();
    }

    await charge.save();

    if (fullyCovered) {
      await syncChargePaidSideEffects(charge);
    }

    const newBalance = balance - applyAmount;

    res.json({
      message: fullyCovered ? "Charge paid with credit" : "Credit applied",
      charge,
      creditApplied: applyAmount,
      remainingOwed: remaining - applyAmount,
      newBalance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
