const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const HostedPlay = require("../models/HostedPlay");
const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const User = require("../models/User");
const Club = require("../models/Club");
const Charge = require("../models/Charge");
const { sendPushToClubAdmins, sendPushToUser } = require("../utils/push");

// Per-player fee breakdown: base fee + convenience fee (skipped for monthly-flat clubs).
// `club` only needs convenienceFeeRate / convenienceFeeMode.
function computePlayerFees(club, feePerPlayer) {
  const baseFee = Math.max(0, Number(feePerPlayer) || 0);
  const feeRate = typeof club?.convenienceFeeRate === "number" ? club.convenienceFeeRate : 0.10;
  const feeMode = club?.convenienceFeeMode ?? "per_hour";
  const convenienceFee = feeMode === "monthly_flat" ? 0 : parseFloat((baseFee * feeRate).toFixed(2));
  const total = parseFloat((baseFee + convenienceFee).toFixed(2));
  return { baseFee, convenienceFee, total };
}

// ── Member endpoints (auth required, any role) ───────────────────────────────

// GET /api/hosted-play/player/sessions
// List this club's open/full sessions with join state for the current member
router.get("/player/sessions", auth, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "You are not assigned to a club" });

    const [sessions, club] = await Promise.all([
      HostedPlay.find({ clubId, status: { $in: ["open", "full"] } })
        .sort({ date: 1, startTime: 1 })
        .lean(),
      Club.findById(clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
    ]);

    const sessionIds = sessions.map((s) => s._id);
    const myEntries = await HostedPlayParticipant.find({
      hostedPlayId: { $in: sessionIds },
      memberId: req.user.userId,
    }).select("hostedPlayId").lean();
    const joinedSet = new Set(myEntries.map((e) => String(e.hostedPlayId)));

    res.json(sessions.map((s) => {
      const fees = computePlayerFees(club, s.feePerPlayer);
      return {
        ...s,
        joined: joinedSet.has(String(s._id)),
        convenienceFeePerPlayer: fees.convenienceFee,
        totalPerPlayer: fees.total,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hosted-play/player/sessions/:id — full detail + participants
router.get("/player/sessions/:id", auth, async (req, res) => {
  try {
    const session = await HostedPlay.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const [participants, club] = await Promise.all([
      HostedPlayParticipant.find({ hostedPlayId: session._id }).sort({ createdAt: 1 }).lean(),
      Club.findById(session.clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
    ]);
    const fees = computePlayerFees(club, session.feePerPlayer);

    res.json({
      ...session,
      convenienceFeePerPlayer: fees.convenienceFee,
      totalPerPlayer: fees.total,
      participants: participants.map((p) => ({
        _id: p._id,
        memberName: p.memberName,
        dateJoined: p.createdAt,
        isMe: String(p.memberId) === String(req.user.userId),
      })),
      joined: participants.some((p) => String(p.memberId) === String(req.user.userId)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/player/sessions/:id/join
router.post("/player/sessions/:id/join", auth, async (req, res) => {
  try {
    const memberId = req.user.userId;
    const session = await HostedPlay.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "open") {
      return res.status(400).json({ error: "This session is no longer open for joining" });
    }
    if (session.currentPlayers >= session.maxPlayers) {
      return res.status(400).json({ error: "This session is full" });
    }

    const already = await HostedPlayParticipant.findOne({
      hostedPlayId: session._id,
      memberId,
    }).lean();
    if (already) return res.status(400).json({ error: "You have already joined this session" });

    const [user, club] = await Promise.all([
      User.findById(memberId).select("name").lean(),
      Club.findById(session.clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
    ]);

    const { baseFee, convenienceFee, total: amount } = computePlayerFees(club, session.feePerPlayer);

    const charge = await Charge.create({
      clubId: session.clubId,
      playerId: memberId,
      hostedPlayId: session._id,
      amount,
      breakdown: { hostedPlayFee: baseFee, convenienceFee },
      chargeType: "hosted_play",
      status: "unpaid",
      approvalStatus: "none",
    });

    await HostedPlayParticipant.create({
      hostedPlayId: session._id,
      clubId: session.clubId,
      memberId,
      memberName: user?.name ?? "Member",
      chargeId: charge._id,
    });

    session.currentPlayers += 1;
    if (session.currentPlayers >= session.maxPlayers) session.status = "full";
    await session.save();

    sendPushToClubAdmins(session.clubId, {
      title: "Hosted Play join",
      body: `${user?.name ?? "A member"} joined "${session.title}".`,
    });

    res.status(201).json({ success: true, currentPlayers: session.currentPlayers, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hosted-play/player/sessions/:id/join — cancel before the event starts
router.delete("/player/sessions/:id/join", auth, async (req, res) => {
  try {
    const session = await HostedPlay.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "closed" || session.status === "cancelled") {
      return res.status(400).json({ error: "This session can no longer be changed" });
    }

    const start = new Date(session.date);
    const [h, m] = String(session.startTime).split(":").map(Number);
    if (!Number.isNaN(h)) start.setHours(h, m || 0, 0, 0);
    if (start.getTime() <= Date.now()) {
      return res.status(400).json({ error: "You can only cancel before the event starts" });
    }

    const removed = await HostedPlayParticipant.findOneAndDelete({
      hostedPlayId: session._id,
      memberId: req.user.userId,
    });
    if (!removed) return res.status(404).json({ error: "You have not joined this session" });

    // Remove the associated charge only if it has not been paid yet.
    if (removed.chargeId) {
      await Charge.deleteOne({ _id: removed.chargeId, status: "unpaid" });
    }

    session.currentPlayers = Math.max(0, session.currentPlayers - 1);
    if (session.status === "full") session.status = "open";
    await session.save();

    res.json({ success: true, currentPlayers: session.currentPlayers, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin endpoints (auth + admin) ───────────────────────────────────────────

// GET /api/hosted-play/sessions — all of the club's sessions
router.get("/sessions", auth, admin, async (req, res) => {
  try {
    const sessions = await HostedPlay.find({ clubId: req.user.clubId })
      .sort({ date: -1, startTime: -1 })
      .lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions
router.post("/sessions", auth, admin, async (req, res) => {
  try {
    const {
      title, sport, date, startTime, endTime, venue, court, address,
      feePerPlayer, maxPlayers, description,
    } = req.body;

    if (!title || !sport || !date || !startTime || !endTime || !venue || !maxPlayers) {
      return res.status(400).json({
        error: "title, sport, date, startTime, endTime, venue and maxPlayers are required",
      });
    }

    const session = await HostedPlay.create({
      clubId: req.user.clubId,
      createdBy: req.user.userId,
      title,
      sport,
      date,
      startTime,
      endTime,
      venue,
      court,
      address,
      feePerPlayer: Math.max(0, Number(feePerPlayer ?? 0) || 0),
      maxPlayers: Number(maxPlayers),
      description,
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hosted-play/sessions/:id — edit (scoped to club)
router.put("/sessions/:id", auth, admin, async (req, res) => {
  try {
    const {
      title, sport, date, startTime, endTime, venue, court, address,
      feePerPlayer, maxPlayers, description,
    } = req.body;

    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (title !== undefined) session.title = title;
    if (sport !== undefined) session.sport = sport;
    if (date !== undefined) session.date = date;
    if (startTime !== undefined) session.startTime = startTime;
    if (endTime !== undefined) session.endTime = endTime;
    if (venue !== undefined) session.venue = venue;
    if (court !== undefined) session.court = court;
    if (address !== undefined) session.address = address;
    if (feePerPlayer !== undefined) session.feePerPlayer = Math.max(0, Number(feePerPlayer) || 0);
    if (description !== undefined) session.description = description;
    if (maxPlayers !== undefined) {
      session.maxPlayers = Number(maxPlayers);
      // Re-evaluate full/open after a cap change (only while session is active)
      if (session.status === "open" || session.status === "full") {
        session.status = session.currentPlayers >= session.maxPlayers ? "full" : "open";
      }
    }

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/hosted-play/sessions/:id/status — manual close / cancel / reopen
router.patch("/sessions/:id/status", auth, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["open", "full", "closed", "cancelled"];
    if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // When reopening, respect the cap
    if (status === "open" && session.currentPlayers >= session.maxPlayers) {
      session.status = "full";
    } else {
      session.status = status;
    }
    await session.save();

    // A cancelled session shouldn't leave members owing the fee.
    if (status === "cancelled") {
      await Charge.deleteMany({ hostedPlayId: session._id, chargeType: "hosted_play", status: "unpaid" });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hosted-play/sessions/:id — delete session + its participants
router.delete("/sessions/:id", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOneAndDelete({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    await Promise.all([
      HostedPlayParticipant.deleteMany({ hostedPlayId: session._id }),
      Charge.deleteMany({ hostedPlayId: session._id, chargeType: "hosted_play", status: "unpaid" }),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hosted-play/sessions/:id/participants — roster
router.get("/sessions/:id/participants", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id })
      .sort({ createdAt: 1 })
      .lean();
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
