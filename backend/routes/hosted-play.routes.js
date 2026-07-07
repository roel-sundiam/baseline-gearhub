const express = require("express");
const router = express.Router();
const { randomUUID } = require("crypto");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const HostedPlay = require("../models/HostedPlay");
const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const User = require("../models/User");
const Club = require("../models/Club");
const Charge = require("../models/Charge");
const AppServicePayment = require("../models/AppServicePayment");
const queue = require("../services/queue-engine");
const { sendPushToClubAdmins, sendPushToUser } = require("../utils/push");
const { computePlayerFees } = require("../utils/fees");

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
    const [myEntries, myPendingCharges] = await Promise.all([
      HostedPlayParticipant.find({
        hostedPlayId: { $in: sessionIds },
        memberId: req.user.userId,
      }).select("hostedPlayId").lean(),
      Charge.find({
        hostedPlayId: { $in: sessionIds },
        playerId: req.user.userId,
        approvalStatus: "pending",
      }).select("hostedPlayId").lean(),
    ]);
    const joinedSet = new Set(myEntries.map((e) => String(e.hostedPlayId)));
    const pendingSet = new Set(myPendingCharges.map((c) => String(c.hostedPlayId)));

    res.json(sessions.map((s) => {
      const fees = computePlayerFees(club, s.feePerPlayer);
      const joined = joinedSet.has(String(s._id));
      return {
        ...s,
        joined,
        pendingApproval: !joined && pendingSet.has(String(s._id)),
        convenienceFeePerPlayer: fees.convenienceFee,
        convenienceFeeMode: fees.feeMode,
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
      convenienceFeeMode: fees.feeMode,
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

    const { paymentMethod, paymentScreenshot } = req.body;
    const validMemberMethods = ["GCash", "Bank Transfer", "GoTyme"];
    if (paymentScreenshot && !String(paymentScreenshot).startsWith("https://")) {
      return res.status(400).json({ error: "paymentScreenshot must be a secure HTTPS URL" });
    }
    if (paymentMethod && !validMemberMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid paymentMethod" });
    }
    const hasPaymentProof = !!(paymentScreenshot && paymentMethod);

    if (hasPaymentProof) {
      const pendingCharge = await Charge.findOne({
        hostedPlayId: session._id,
        playerId: memberId,
        approvalStatus: "pending",
      }).lean();
      if (pendingCharge) return res.status(400).json({ error: "You already have a pending payment for this session awaiting approval" });
    }

    const [user, club] = await Promise.all([
      User.findById(memberId).select("name").lean(),
      Club.findById(session.clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
    ]);

    const { baseFee, convenienceFee, total: amount, feeMode } = computePlayerFees(club, session.feePerPlayer);
    const netSessionFee = feeMode === 'club_absorbs' ? baseFee - convenienceFee : baseFee;

    const charge = await Charge.create({
      clubId: session.clubId,
      playerId: memberId,
      hostedPlayId: session._id,
      amount,
      breakdown: { hostedPlayFee: netSessionFee, convenienceFee, convenienceFeeMode: feeMode },
      chargeType: "hosted_play",
      status: "unpaid",
      approvalStatus: hasPaymentProof ? "pending" : "none",
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(paymentScreenshot ? { paymentScreenshot } : {}),
    });

    if (!hasPaymentProof) {
      // Free session — join the player immediately
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
      return res.status(201).json({ success: true, currentPlayers: session.currentPlayers, status: session.status, chargeId: charge._id });
    }

    // Paid session — player is not joined until admin approves the payment
    sendPushToClubAdmins(session.clubId, {
      title: "Hosted Play payment pending",
      body: `${user?.name ?? "A member"} submitted payment for "${session.title}". Please review and approve.`,
    });

    res.status(201).json({ success: true, status: "pending_approval", chargeId: charge._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hosted-play/player/sessions/:id/join — cancel before the event starts
router.delete("/player/sessions/:id/join", auth, async (req, res) => {
  try {
    const session = await HostedPlay.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "closed" || session.status === "cancelled" || session.status === "completed") {
      return res.status(400).json({ error: "This session can no longer be changed" });
    }
    if (session.queueStatus === "running") {
      return res.status(400).json({ error: "The queue has started — please see the club admin to leave" });
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

// GET /api/hosted-play/player/sessions/:id/queue — live board for players (read-only)
router.get("/player/sessions/:id/queue", auth, async (req, res) => {
  try {
    const [session, club] = await Promise.all([
      HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean(),
      Club.findById(req.user.clubId).select("hostedPlayQueueEnabled").lean(),
    ]);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!(session.queueManagementEnabled ?? club?.hostedPlayQueueEnabled)) return res.status(403).json({ error: "Queue not enabled for this session" });
    const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id })
      .sort({ createdAt: 1 }).lean();
    res.json(queue.buildBoard(session, participants));
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
      feePerPlayer, maxPlayers, description, numberOfCourts, playersPerCourt, queueMode,
    } = req.body;

    if (!title || !sport || !date || !startTime || !endTime || !venue || !maxPlayers) {
      return res.status(400).json({
        error: "title, sport, date, startTime, endTime, venue and maxPlayers are required",
      });
    }

    const club = await Club.findById(req.user.clubId).select("hostedPlayQueueEnabled queueManagementFeePerPlayer").lean();

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
      numberOfCourts: Math.max(1, Number(numberOfCourts ?? 1) || 1),
      queueManagementEnabled: !!club?.hostedPlayQueueEnabled,
      ...(playersPerCourt !== undefined ? { playersPerCourt: Math.max(1, Number(playersPerCourt) || 4) } : {}),
      ...(queueMode !== undefined ? { queueMode } : {}),
    });

    // Auto-bill the club the Queue Management fee when a session is created with queue enabled
    if (club?.hostedPlayQueueEnabled && club.queueManagementFeePerPlayer > 0) {
      await AppServicePayment.create({
        clubId: req.user.clubId,
        amount: parseFloat((Number(club.queueManagementFeePerPlayer) || 0).toFixed(2)),
        type: "billing",
        note: `Queue Management fee — ${title}`,
        paidBy: req.user.userId,
      });
    }

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
      feePerPlayer, maxPlayers, description, numberOfCourts, playersPerCourt, queueMode,
    } = req.body;

    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (numberOfCourts !== undefined) session.numberOfCourts = Math.max(1, Number(numberOfCourts) || 1);
    if (playersPerCourt !== undefined) session.playersPerCourt = Math.max(1, Number(playersPerCourt) || 4);
    if (queueMode !== undefined) session.queueMode = queueMode;
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

// POST /api/hosted-play/sessions/:id/enable-queue — retroactively enable Queue Management
router.post("/sessions/:id/enable-queue", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.queueManagementEnabled) return res.status(400).json({ error: "Queue Management is already enabled for this session" });
    if (session.status === "cancelled" || session.status === "completed") {
      return res.status(400).json({ error: "Cannot enable Queue Management on a session that has ended" });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (session.date && session.date.toISOString().slice(0, 10) < today) {
      return res.status(400).json({ error: "Cannot enable Queue Management on a past session" });
    }

    session.queueManagementEnabled = true;
    await session.save();

    const club = await Club.findById(req.user.clubId).select("queueManagementFeePerPlayer").lean();
    if (club?.queueManagementFeePerPlayer > 0) {
      await AppServicePayment.create({
        clubId: req.user.clubId,
        amount: parseFloat((Number(club.queueManagementFeePerPlayer) || 0).toFixed(2)),
        type: "billing",
        note: `Queue Management fee — ${session.title}`,
        paidBy: req.user.userId,
      });
    }

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

    // When reopening a completed session, reset queue state
    if (status === "open" && session.status === "completed") {
      session.queueStatus = "not_started";
      session.queueEndedAt = null;
      session.queueStartedAt = null;
      session.summary = null;
    }

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

// ── Queue Management (admin + auth; requires club.hostedPlayQueueEnabled) ─────

const QUEUE_FIELDS = [
  "checkedIn", "checkedInAt", "queueStatus", "queueOrder",
  "courtNumber", "gamesPlayed", "enteredQueueAt", "lastGameEndedAt",
];

// Load the session (scoped to club), verify Queue Management is enabled, and
// return { session, participants } — or send an error response and return null.
async function loadQueueContext(req, res) {
  const [session, club] = await Promise.all([
    HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean(),
    Club.findById(req.user.clubId).select("hostedPlayQueueEnabled convenienceFeeRate convenienceFeeMode").lean(),
  ]);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }
  const queueAllowed = session.queueManagementEnabled ?? !!club?.hostedPlayQueueEnabled;
  if (!queueAllowed) {
    res.status(403).json({ error: "Queue Management is not enabled for this session" });
    return null;
  }
  const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id })
    .sort({ createdAt: 1 })
    .lean();
  return { session, participants, club };
}

// Persist an engine result (changed participants + optional session update),
// apply the session update in memory, and respond with the fresh board.
async function applyAndRespond(res, session, participants, result, club = null) {
  if (result?.error) {
    return res.status(400).json({ error: result.error });
  }
  const changed = result?.changed ?? [];
  if (changed.length) {
    await HostedPlayParticipant.bulkWrite(
      changed.map((p) => ({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: Object.fromEntries(QUEUE_FIELDS.map((f) => [f, p[f] ?? null])) },
        },
      })),
    );
  }
  if (result?.sessionUpdate) {
    await HostedPlay.updateOne({ _id: session._id }, { $set: result.sessionUpdate });
    Object.assign(session, result.sessionUpdate);
  }
  const board = queue.buildBoard(session, participants);
  if (club) {
    const fees = computePlayerFees(club, session.feePerPlayer);
    board.session.feePerPlayer = fees.baseFee;
    board.session.convenienceFeePerPlayer = fees.convenienceFee;
    board.session.convenienceFeeMode = fees.feeMode;
    board.session.totalPerPlayer = fees.total;
  }
  return res.json(board);
}

// GET /api/hosted-play/sessions/:id/queue — live board (polling target)
router.get("/sessions/:id/queue", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const board = queue.buildBoard(ctx.session, ctx.participants);
    const fees = computePlayerFees(ctx.club, ctx.session.feePerPlayer);
    board.session.feePerPlayer = fees.baseFee;
    board.session.convenienceFeePerPlayer = fees.convenienceFee;
    board.session.convenienceFeeMode = fees.feeMode;
    board.session.totalPerPlayer = fees.total;
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/queue/start
router.post("/sessions/:id/queue/start", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    if (ctx.session.queueStatus === "running") {
      return res.status(400).json({ error: "The queue is already running" });
    }
    await applyAndRespond(res, ctx.session, ctx.participants, queue.startQueue(ctx.session, ctx.participants), ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/queue/end
router.post("/sessions/:id/queue/end", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    await applyAndRespond(res, ctx.session, ctx.participants, queue.endQueue(ctx.session, ctx.participants), ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/hosted-play/sessions/:id/participants/:pid/check-in
router.patch("/sessions/:id/participants/:pid/check-in", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const result = queue.setCheckIn(ctx.session, ctx.participants, req.params.pid, !!req.body.checkedIn);
    if (result.error === "not_found") return res.status(404).json({ error: "Participant not found" });
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/generate-qr — admin generates/regenerates a QR token
router.post("/sessions/:id/generate-qr", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const qrToken = randomUUID();
    await HostedPlay.findByIdAndUpdate(session._id, {
      qrToken,
      qrTokenGeneratedAt: new Date(),
    });

    const appUrl = process.env.APP_URL || "https://courtgo.club";
    const url = `${appUrl}/player/hosted-play/check-in?s=${session._id}&t=${qrToken}`;
    res.json({ qrToken, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/self-check-in — player self-check-in via QR
router.post("/sessions/:id/self-check-in", auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    const session = await HostedPlay.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (session.qrToken !== token) return res.status(403).json({ error: "invalid_qr" });
    if (["cancelled", "completed"].includes(session.status)) {
      return res.status(409).json({ error: "session_ended" });
    }

    const participant = await HostedPlayParticipant.findOne({
      hostedPlayId: session._id,
      memberId: req.user.userId,
    }).lean();
    if (!participant) return res.status(404).json({ error: "not_a_participant" });
    if (participant.checkedIn) return res.status(409).json({ error: "already_checked_in" });

    const club = await Club.findById(session.clubId)
      .select("convenienceFeeRate convenienceFeeMode numberOfCourts")
      .lean();
    const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id })
      .sort({ createdAt: 1 })
      .lean();

    const result = queue.setCheckIn(session, participants, String(participant._id), true);
    if (result.error === "not_found") return res.status(404).json({ error: "Participant not found" });
    await applyAndRespond(res, session, participants, result, club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/walkins — add a walk-in player and record cash charge
router.post("/sessions/:id/walkins", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Walk-in name is required" });

    // Create a cash charge for the walk-in if the session has a fee
    const { baseFee, convenienceFee, total: amount } = computePlayerFees(ctx.club, ctx.session.feePerPlayer);
    let chargeId;
    if (amount > 0) {
      const charge = await Charge.create({
        clubId: ctx.session.clubId,
        guestName: name,
        hostedPlayId: ctx.session._id,
        amount,
        breakdown: { hostedPlayFee: baseFee, convenienceFee },
        chargeType: "hosted_play",
        status: "paid",
        paymentMethod: "Cash",
        approvalStatus: "approved",
      });
      chargeId = charge._id;
    }

    const walkIn = await HostedPlayParticipant.create({
      hostedPlayId: ctx.session._id,
      clubId: ctx.session.clubId,
      isWalkIn: true,
      memberName: name,
      chargeId: chargeId ?? undefined,
      checkedIn: true,
      checkedInAt: new Date(),
      queueStatus: "not_checked_in",
    });
    ctx.participants.push(walkIn.toObject());
    await applyAndRespond(res, ctx.session, ctx.participants, queue.appendAndAssign(ctx.session, ctx.participants, walkIn._id), ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/courts/:n/finish
router.post("/sessions/:id/courts/:n/finish", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);
    await applyAndRespond(res, ctx.session, ctx.participants, queue.finishGame(ctx.session, ctx.participants, courtNumber), ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/courts/:n/assign — manual assignment
router.post("/sessions/:id/courts/:n/assign", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);
    const ids = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];
    await applyAndRespond(res, ctx.session, ctx.participants, queue.manualAssign(ctx.session, ctx.participants, ids, courtNumber), ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/participants/:pid/(skip|pause|resume)
for (const action of ["skip", "pause", "resume"]) {
  router.post(`/sessions/:id/participants/:pid/${action}`, auth, admin, async (req, res) => {
    try {
      const ctx = await loadQueueContext(req, res);
      if (!ctx) return;
      const fn = { skip: queue.skipPlayer, pause: queue.pausePlayer, resume: queue.resumePlayer }[action];
      const result = fn(ctx.session, ctx.participants, req.params.pid);
      if (result.error === "not_found") return res.status(404).json({ error: "Participant not found" });
      await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// DELETE /api/hosted-play/sessions/:id/participants/:pid/queue — remove from play
router.delete("/sessions/:id/participants/:pid/queue", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const result = queue.removePlayer(ctx.session, ctx.participants, req.params.pid);
    if (result.error === "not_found") return res.status(404).json({ error: "Participant not found" });
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hosted-play/sessions/:id/queue/order — manual reorder (waiting only)
router.put("/sessions/:id/queue/order", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const ids = Array.isArray(req.body.orderedParticipantIds) ? req.body.orderedParticipantIds : [];
    await applyAndRespond(res, ctx.session, ctx.participants, queue.reorderQueue(ctx.session, ctx.participants, ids), ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
