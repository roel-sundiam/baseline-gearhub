const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const Club = require("../models/Club");
const CoinRequest = require("../models/CoinRequest");
const CoinTransaction = require("../models/CoinTransaction");

const router = express.Router();

const COIN_COSTS = {
  reservation: 5,
  "tournament-join": 3,
  "member-directory": 1,
  "tournament-list": 1,
  "tournament-detail": 1,
};

// GET /api/coins/balance
router.get("/balance", auth, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const club = await Club.findById(clubId).select("coinBalance").lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({ coinBalance: club.coinBalance ?? 0 });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/coins/transactions (admin)
router.get("/transactions", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const transactions = await CoinTransaction.find(clubId ? { clubId } : {})
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(transactions);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/coins/requests (admin)
router.post("/requests", auth, admin, async (req, res) => {
  try {
    const clubId = req.body.clubId || req.user.clubId;
    const { coinsRequested, paymentMethod, note } = req.body;
    if (!coinsRequested || coinsRequested < 1) {
      return res.status(400).json({ error: "coinsRequested must be at least 1" });
    }
    if (!["GCash", "Cash", "Bank Transfer"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Valid paymentMethod required" });
    }
    const request = await CoinRequest.create({
      clubId,
      requestedBy: req.user.userId,
      coinsRequested: Math.floor(coinsRequested),
      paymentMethod,
      note: note || undefined,
    });
    await request.populate("requestedBy", "name");
    res.status(201).json({ message: "Coin request submitted", request });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/coins/requests/my (admin)
router.get("/requests/my", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const requests = await CoinRequest.find(clubId ? { clubId } : {})
      .populate("requestedBy", "name")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(requests);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/coins/requests (superadmin)
router.get("/requests", auth, superadmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) filter.status = status;
    const requests = await CoinRequest.find(filter)
      .populate("requestedBy", "name")
      .populate("approvedBy", "name")
      .populate("clubId", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(requests);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/coins/requests/:id/approve (superadmin)
router.patch("/requests/:id/approve", auth, superadmin, async (req, res) => {
  try {
    const request = await CoinRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Request is not pending" });

    request.status = "approved";
    request.approvedBy = req.user.userId;
    request.approvedAt = new Date();
    await request.save();

    const club = await Club.findByIdAndUpdate(
      request.clubId,
      { $inc: { coinBalance: request.coinsRequested } },
      { new: true }
    );

    await CoinTransaction.create({
      clubId: request.clubId,
      userId: request.requestedBy,
      type: "credit",
      amount: request.coinsRequested,
      action: "coin-request-approved",
      relatedId: request._id,
      balanceAfter: club.coinBalance,
    });

    await request.populate("requestedBy approvedBy", "name");
    res.json({ message: "Request approved", request, newBalance: club.coinBalance });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/coins/requests/:id/reject (superadmin)
router.patch("/requests/:id/reject", auth, superadmin, async (req, res) => {
  try {
    const request = await CoinRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Request is not pending" });

    request.status = "rejected";
    request.approvedBy = req.user.userId;
    request.rejectedNote = req.body.rejectedNote || undefined;
    await request.save();

    await request.populate("requestedBy approvedBy", "name");
    res.json({ message: "Request rejected", request });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/coins/track-visit — deduct 1 coin for first page visit today
router.post("/track-visit", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const { page } = req.body;
    const validPages = ["member-directory", "tournament-list", "tournament-detail"];
    if (!validPages.includes(page)) return res.status(400).json({ error: "Invalid page" });

    const cost = COIN_COSTS[page];

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const alreadyVisited = await CoinTransaction.findOne({
      clubId,
      userId: req.user.userId,
      action: "page-view",
      page,
      createdAt: { $gte: today, $lt: tomorrow },
    });

    if (alreadyVisited) {
      return res.json({ deducted: false, message: "Already visited today" });
    }

    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.coinBalance < cost) {
      return res.status(402).json({ error: "Insufficient coins", coinBalance: club.coinBalance });
    }

    club.coinBalance -= cost;
    await club.save();

    await CoinTransaction.create({
      clubId,
      userId: req.user.userId,
      type: "debit",
      amount: cost,
      action: "page-view",
      page,
      balanceAfter: club.coinBalance,
    });

    res.json({ deducted: true, coinsDeducted: cost, coinBalance: club.coinBalance });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = { router, COIN_COSTS };
