const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const GameJoin = require("../models/GameJoin");
const Charge = require("../models/Charge");
const Rates = require("../models/Rates");
const Club = require("../models/Club");
const { sendPushToClubAdmins, sendPushToUser } = require("../utils/push");
const { ownsClub } = require("../utils/scope");

const router = express.Router();

// POST /api/per-game/join — player joins the club's live game pool
router.post("/join", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const playerId = req.user.userId;
    if (!clubId) return res.status(400).json({ error: "You are not assigned to a club" });

    const guestCount = Math.max(0, Number(req.body.guestCount ?? 0) || 0);
    const playDate = req.body.playDate ? new Date(req.body.playDate) : new Date();

    // Block duplicate joins for the same play date
    const dayStart = new Date(playDate.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const dayEnd = new Date(playDate.toISOString().slice(0, 10) + 'T23:59:59.999Z');
    const existing = await GameJoin.findOne({ clubId, playerId, status: "joined", playDate: { $gte: dayStart, $lte: dayEnd } }).lean();
    if (existing) return res.status(400).json({ error: "You have already joined for this date" });
    const entry = await GameJoin.create({ clubId, playerId, status: "joined", playDate, guestCount });

    sendPushToClubAdmins(clubId, {
      title: "Player joined",
      body: "A player tapped Join and is ready to play.",
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/per-game/:id/guests — player updates guest count on their own joined entry
router.patch("/:id/guests", auth, async (req, res) => {
  try {
    const guestCount = Math.max(0, Number(req.body.guestCount ?? 0) || 0);
    const entry = await GameJoin.findOne({ _id: req.params.id, playerId: req.user.userId, status: "joined" });
    if (!entry) return res.status(404).json({ error: "Active join not found" });
    entry.guestCount = guestCount;
    await entry.save();
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/per-game/join — player cancels their own active join
router.delete("/join", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const playerId = req.user.userId;

    const entry = await GameJoin.findOneAndUpdate(
      { clubId, playerId, status: "joined" },
      { status: "cancelled" },
      { new: true },
    );
    if (!entry) return res.status(404).json({ error: "No active join found" });

    res.json({ message: "Join cancelled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/per-game/my-status — player's active join/recorded entry for a given date (defaults to today)
router.get("/my-status", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const playerId = req.user.userId;
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
    const entry = await GameJoin.findOne({
      clubId,
      playerId,
      status: { $in: ["joined", "recorded"] },
      playDate: { $gte: dayStart, $lte: dayEnd },
    }).lean();
    res.json(entry || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/per-game/playing — list today's joined+recorded players visible to any club member
router.get("/playing", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated" });
    const todayStart = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const todayEnd = new Date(new Date().toISOString().slice(0, 10) + 'T23:59:59.999Z');
    const entries = await GameJoin.find({
      clubId,
      status: { $in: ["joined", "recorded"] },
      playDate: { $gte: todayStart, $lte: todayEnd },
    })
      .populate("playerId", "name")
      .sort({ createdAt: 1 })
      .lean();
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/per-game/joined — list players currently joined (admin), optionally filtered by date
router.get("/joined", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "clubId is required" });

    const filter = { clubId, status: { $in: ["joined", "recorded"] } };

    if (req.query.date) {
      const start = new Date(req.query.date + 'T00:00:00.000Z');
      const end = new Date(req.query.date + 'T23:59:59.999Z');
      filter.playDate = { $gte: start, $lte: end };
    }

    const entries = await GameJoin.find(filter)
      .populate("playerId", "name username email")
      .sort({ playDate: 1, createdAt: 1 });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/per-game/:id/record — admin records games played and creates the charge
router.post("/:id/record", auth, admin, async (req, res) => {
  try {
    const gamesPlayed = Number(req.body.gamesPlayed);
    const guestCount = Number(req.body.guestCount ?? 0);
    const paymentMethod = req.body.paymentMethod;

    if (!Number.isFinite(gamesPlayed) || gamesPlayed < 0) {
      return res.status(400).json({ error: "gamesPlayed must be a non-negative number" });
    }
    if (!Number.isFinite(guestCount) || guestCount < 0) {
      return res.status(400).json({ error: "guestCount must be a non-negative number" });
    }

    const entry = await GameJoin.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Join entry not found" });
    if (!ownsClub(req, entry.clubId)) return res.status(403).json({ error: "Access denied" });
    if (entry.status !== "joined") {
      return res.status(400).json({ error: "This player has already been recorded" });
    }

    const [rates, club] = await Promise.all([
      Rates.findOne({ clubId: entry.clubId }).lean(),
      Club.findById(entry.clubId).lean(),
    ]);

    const perGameFee = rates?.perGameFee ?? 0;
    const perGameGuestFee = rates?.perGameGuestFee ?? 0;

    const gameFee = parseFloat((gamesPlayed * perGameFee).toFixed(2));
    const guestFee = parseFloat((guestCount * perGameGuestFee).toFixed(2));
    const subtotal = gameFee + guestFee;

    // Convenience fee: charged once per transaction (not per game), same as reservations.
    const feeRate = typeof club?.convenienceFeeRate === "number" ? club.convenienceFeeRate : 0.10;
    const feeMode = club?.convenienceFeeMode ?? "per_hour";
    const convenienceFee = (feeMode === "monthly_flat" || feeMode === "club_absorbs")
      ? 0
      : parseFloat((subtotal * feeRate).toFixed(2));

    const amount = feeMode === "club_absorbs"
      ? parseFloat(subtotal.toFixed(2))
      : parseFloat((subtotal + convenienceFee).toFixed(2));

    const charge = await Charge.create({
      clubId: entry.clubId,
      playerId: entry.playerId,
      gameJoinId: entry._id,
      amount,
      breakdown: { gameFee, guestFee, convenienceFee },
      chargeType: "per_game",
      status: paymentMethod ? "paid" : "unpaid",
      approvalStatus: paymentMethod ? "approved" : "none",
      paymentMethod: paymentMethod || undefined,
      paidAt: paymentMethod ? new Date() : undefined,
    });

    entry.status = "recorded";
    entry.gamesPlayed = gamesPlayed;
    entry.guestCount = guestCount;
    entry.chargeId = charge._id;
    entry.recordedBy = req.user.userId;
    entry.recordedAt = new Date();
    await entry.save();

    sendPushToUser(entry.playerId, {
      title: "Games recorded",
      body: `You played ${gamesPlayed} game(s). Total due: ₱${amount.toFixed(2)}.`,
    });

    res.status(201).json({ entry, charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/per-game/:id/record — admin updates an already-recorded entry and its charge
router.put("/:id/record", auth, admin, async (req, res) => {
  try {
    const gamesPlayed = Number(req.body.gamesPlayed);
    const guestCount = Number(req.body.guestCount ?? 0);
    const paymentMethod = req.body.paymentMethod;

    if (!Number.isFinite(gamesPlayed) || gamesPlayed < 0) {
      return res.status(400).json({ error: "gamesPlayed must be a non-negative number" });
    }
    if (!Number.isFinite(guestCount) || guestCount < 0) {
      return res.status(400).json({ error: "guestCount must be a non-negative number" });
    }

    const entry = await GameJoin.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Join entry not found" });
    if (!ownsClub(req, entry.clubId)) return res.status(403).json({ error: "Access denied" });
    if (entry.status !== "recorded") {
      return res.status(400).json({ error: "Entry has not been recorded yet" });
    }

    const [rates, club] = await Promise.all([
      Rates.findOne({ clubId: entry.clubId }).lean(),
      Club.findById(entry.clubId).lean(),
    ]);

    const perGameFee = rates?.perGameFee ?? 0;
    const perGameGuestFee = rates?.perGameGuestFee ?? 0;
    const gameFee = parseFloat((gamesPlayed * perGameFee).toFixed(2));
    const guestFee = parseFloat((guestCount * perGameGuestFee).toFixed(2));
    const subtotal = gameFee + guestFee;
    const feeRate = typeof club?.convenienceFeeRate === "number" ? club.convenienceFeeRate : 0.10;
    const feeMode = club?.convenienceFeeMode ?? "per_hour";
    const convenienceFee = (feeMode === "monthly_flat" || feeMode === "club_absorbs")
      ? 0
      : parseFloat((subtotal * feeRate).toFixed(2));
    const amount = feeMode === "club_absorbs"
      ? parseFloat(subtotal.toFixed(2))
      : parseFloat((subtotal + convenienceFee).toFixed(2));

    const charge = await Charge.findByIdAndUpdate(
      entry.chargeId,
      {
        amount,
        breakdown: { gameFee, guestFee, convenienceFee },
        ...(paymentMethod
          ? { paymentMethod, status: "paid", approvalStatus: "approved", paidAt: new Date() }
          : {}),
      },
      { new: true },
    );

    entry.gamesPlayed = gamesPlayed;
    entry.guestCount = guestCount;
    entry.recordedBy = req.user.userId;
    entry.recordedAt = new Date();
    await entry.save();

    sendPushToUser(entry.playerId, {
      title: "Games updated",
      body: `Your game record was updated. ${gamesPlayed} game(s). Total: ₱${amount.toFixed(2)}.`,
    });

    res.json({ entry, charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
