const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const HostedPlay = require("../models/HostedPlay");
const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const HostedPlayMatch = require("../models/HostedPlayMatch");
const User = require("../models/User");
const Club = require("../models/Club");
const Charge = require("../models/Charge");
const AppServicePayment = require("../models/AppServicePayment");
const queue = require("../services/queue-engine");
const { sendPushToClubAdmins, sendPushToUser } = require("../utils/push");
const { computePlayerFees } = require("../utils/fees");
const { resolveGuestFee, countGuests } = require("../utils/guests");
const { ownsClub } = require("../utils/scope");
const { getCreditBalance, redeemCredit, refundCredit } = require("../utils/credit");
const { computeMemberFeeAndCredit, chargeMemberForSession, billSplitSessionFee, settleHostedPlayConvenienceFee } = require("../utils/hosted-play-billing");

// Participants that occupy a real spot (excludes waitlist/offer holders). Used
// to scope every queue read so the engine never sees waitlisted players.
const ACTIVE_PARTICIPANT = { waitStatus: { $nin: ["waitlisted", "offered", "pending_payment"] } };

const { promoteFromWaitlist } = require("../utils/waitlist");

// Skill-band gating: ordered tiers so a session can require e.g. intermediate+.
const SKILL_ORDER = {
  beginner: 1,
  novice: 2,
  lower_intermediate: 3,
  intermediate: 4,
  upper_intermediate: 5,
  advanced: 6,
  expert_elite: 7,
  professional: 8,
};
const SKILL_LABELS = {
  beginner: "Beginner",
  novice: "Novice",
  lower_intermediate: "Lower Intermediate",
  intermediate: "Intermediate",
  upper_intermediate: "Upper Intermediate",
  advanced: "Advanced",
  expert_elite: "Expert / Elite",
  professional: "Professional",
};
function skillBandError(session, level) {
  const { minSkillLevel: min, maxSkillLevel: max } = session;
  if (!min && !max) return null; // open to all levels
  if (!level) return "This session is limited by skill level — set your level in your profile first.";
  const o = SKILL_ORDER[level];
  if (min && o < SKILL_ORDER[min]) return `This session is for ${SKILL_LABELS[min]} level and up.`;
  if (max && o > SKILL_ORDER[max]) return `This session is capped at ${SKILL_LABELS[max]} level.`;
  return null;
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
      Club.findById(clubId).select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode").lean(),
    ]);

    const sessionIds = sessions.map((s) => s._id);
    const [myEntries, myPendingCharges] = await Promise.all([
      HostedPlayParticipant.find({
        hostedPlayId: { $in: sessionIds },
        memberId: req.user.userId,
      }).select("hostedPlayId waitStatus").lean(),
      Charge.find({
        hostedPlayId: { $in: sessionIds },
        playerId: req.user.userId,
        approvalStatus: "pending",
      }).select("hostedPlayId").lean(),
    ]);
    // My relationship to each session: active | waitlisted | offered.
    const statusBySession = new Map(myEntries.map((e) => [String(e.hostedPlayId), e.waitStatus ?? "active"]));
    const pendingSet = new Set(myPendingCharges.map((c) => String(c.hostedPlayId)));

    res.json(sessions.map((s) => {
      // Split Session Fee sessions aren't billed until completion, so this is
      // only an estimate — it shrinks/grows as members join/leave beforehand.
      const isSplitTotal = s.feeSplitMode === "split_total";
      const baseFee = isSplitTotal ? parseFloat((Number(s.sessionFee || 0) / Math.max(1, s.currentPlayers)).toFixed(2)) : s.feePerPlayer;
      const fees = computePlayerFees(club, baseFee);
      const myStatus = statusBySession.get(String(s._id));
      const joined = myStatus === "active";
      return {
        ...s,
        joined,
        waitlisted: myStatus === "waitlisted",
        offered: myStatus === "offered",
        pendingApproval: !joined && pendingSet.has(String(s._id)),
        feePerPlayer: fees.baseFee,
        convenienceFeePerPlayer: fees.convenienceFee,
        convenienceFeeMode: fees.feeMode,
        totalPerPlayer: fees.total,
        estimatedFee: isSplitTotal,
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

    const [participants, club, myEntry] = await Promise.all([
      HostedPlayParticipant.find({ hostedPlayId: session._id, ...ACTIVE_PARTICIPANT }).sort({ createdAt: 1 }).lean(),
      Club.findById(session.clubId).select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode").lean(),
      HostedPlayParticipant.findOne({ hostedPlayId: session._id, memberId: req.user.userId })
        .select("waitStatus waitlistOrder offerExpiresAt").lean(),
    ]);
    // Split Session Fee sessions aren't billed until completion, so this is only
    // an estimate — it shrinks/grows as members join/leave beforehand.
    const isSplitTotal = session.feeSplitMode === "split_total";
    const baseFee = isSplitTotal
      ? parseFloat((Number(session.sessionFee || 0) / Math.max(1, session.currentPlayers)).toFixed(2))
      : session.feePerPlayer;
    const fees = computePlayerFees(club, baseFee);

    // If I'm waitlisted, my position = how many waitlisters are ahead of me (inclusive).
    let waitlistPosition = null;
    if (myEntry?.waitStatus === "waitlisted") {
      waitlistPosition = await HostedPlayParticipant.countDocuments({
        hostedPlayId: session._id, waitStatus: "waitlisted",
        waitlistOrder: { $lte: myEntry.waitlistOrder ?? 0 },
      });
    }

    res.json({
      ...session,
      feePerPlayer: fees.baseFee,
      convenienceFeePerPlayer: fees.convenienceFee,
      convenienceFeeMode: fees.feeMode,
      totalPerPlayer: fees.total,
      estimatedFee: isSplitTotal,
      participants: participants.map((p) => ({
        _id: p._id,
        memberName: p.memberName,
        dateJoined: p.createdAt,
        isMe: String(p.memberId) === String(req.user.userId),
      })),
      joined: (myEntry?.waitStatus ?? (myEntry ? "active" : null)) === "active",
      waitlistStatus: myEntry?.waitStatus === "waitlisted" || myEntry?.waitStatus === "offered" ? myEntry.waitStatus : null,
      waitlistPosition,
      offerExpiresAt: myEntry?.waitStatus === "offered" ? myEntry.offerExpiresAt : null,
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
    if (!["open", "full"].includes(session.status)) {
      return res.status(400).json({ error: "This session is no longer open for joining" });
    }

    // Block duplicates first — a member can be active, waitlisted, or holding an offer.
    const already = await HostedPlayParticipant.findOne({
      hostedPlayId: session._id,
      memberId,
    }).lean();
    if (already) {
      if (already.waitStatus === "waitlisted") return res.status(400).json({ error: "You're already on the waitlist for this session" });
      if (already.waitStatus === "offered") return res.status(400).json({ error: "A spot has been offered to you — please claim it" });
      if (already.waitStatus === "pending_payment") return res.status(400).json({ error: "You already have a payment pending approval for this session" });
      return res.status(400).json({ error: "You have already joined this session" });
    }

    // Skill band gate — applies to confirmed joins and waitlisting alike.
    // .lean() skips the schema default, so fall back to it here for players
    // who've never touched their profile (matches User.skillLevel default).
    const me = await User.findById(memberId).select("skillLevel").lean();
    const bandErr = skillBandError(session, me?.skillLevel || "novice");
    if (bandErr) return res.status(403).json({ error: bandErr });

    // Session full → offer the waitlist (if the club allows it) instead of rejecting.
    if (session.currentPlayers >= session.maxPlayers) {
      const wlClub = await Club.findById(session.clubId).select("hostedPlayWaitlistEnabled").lean();
      if (!wlClub?.hostedPlayWaitlistEnabled) {
        return res.status(400).json({ error: "This session is full" });
      }
      const wlUser = await User.findById(memberId).select("name").lean();
      await HostedPlayParticipant.create({
        hostedPlayId: session._id,
        clubId: session.clubId,
        memberId,
        memberName: wlUser?.name ?? "Member",
        waitStatus: "waitlisted",
        waitlistOrder: Date.now(),
      });
      const waitlistPosition = await HostedPlayParticipant.countDocuments({
        hostedPlayId: session._id, waitStatus: "waitlisted",
      });
      sendPushToClubAdmins(session.clubId, {
        title: "Hosted Play waitlist",
        body: `${wlUser?.name ?? "A member"} joined the waitlist for "${session.title}".`,
      });
      return res.status(201).json({ success: true, status: "waitlisted", waitlistPosition });
    }

    // Split Session Fee sessions bill members once, after the session is marked
    // complete (see billSplitSessionFee) — joining itself is free, no Charge yet.
    if (session.feeSplitMode === "split_total") {
      const splitUser = await User.findById(memberId).select("name").lean();
      await HostedPlayParticipant.create({
        hostedPlayId: session._id,
        clubId: session.clubId,
        memberId,
        memberName: splitUser?.name ?? "Member",
      });
      session.currentPlayers += 1;
      if (session.currentPlayers >= session.maxPlayers) session.status = "full";
      await session.save();
      sendPushToClubAdmins(session.clubId, {
        title: "Hosted Play join",
        body: `${splitUser?.name ?? "A member"} joined "${session.title}".`,
      });
      return res.status(201).json({
        success: true,
        currentPlayers: session.currentPlayers,
        status: session.status,
        billedLater: true,
      });
    }

    const { paymentMethod, paymentScreenshot, useCredit } = req.body;
    const validMemberMethods = ["GCash", "Bank Transfer", "GoTyme"];
    if (paymentScreenshot && !String(paymentScreenshot).startsWith("https://")) {
      return res.status(400).json({ error: "paymentScreenshot must be a secure HTTPS URL" });
    }
    if (paymentMethod && !validMemberMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid paymentMethod" });
    }

    const [user, club] = await Promise.all([
      User.findById(memberId).select("name").lean(),
      Club.findById(session.clubId).select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode").lean(),
    ]);

    const hasPaymentProof = !!(paymentScreenshot && paymentMethod);
    const breakdown = await computeMemberFeeAndCredit({ session, club, memberId, baseFee: session.feePerPlayer, useCredit });
    const { creditApplied, remaining } = breakdown;

    if (remaining > 0 && !hasPaymentProof) {
      return res.status(400).json({ error: "Payment is required to join this session", remaining, creditApplied });
    }

    if (remaining > 0 && hasPaymentProof) {
      const pendingCharge = await Charge.findOne({
        hostedPlayId: session._id,
        playerId: memberId,
        approvalStatus: "pending",
      }).lean();
      if (pendingCharge) return res.status(400).json({ error: "You already have a pending payment for this session awaiting approval" });
    }

    const charge = await chargeMemberForSession({ session, memberId, breakdown, paymentMethod, paymentScreenshot });

    if (remaining <= 0) {
      // Fully covered (free session, or credit covered it) — join the player immediately.
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
      return res.status(201).json({ success: true, currentPlayers: session.currentPlayers, status: session.status, chargeId: charge._id, creditApplied });
    }

    // Still owes a remainder — reserve the slot now, held pending admin approval.
    await HostedPlayParticipant.create({
      hostedPlayId: session._id,
      clubId: session.clubId,
      memberId,
      memberName: user?.name ?? "Member",
      chargeId: charge._id,
      waitStatus: "pending_payment",
      offerExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    session.currentPlayers += 1;
    if (session.currentPlayers >= session.maxPlayers) session.status = "full";
    await session.save();

    sendPushToClubAdmins(session.clubId, {
      title: "Hosted Play payment pending",
      body: `${user?.name ?? "A member"} submitted payment for "${session.title}". Please review and approve.`,
    });

    res.status(201).json({
      success: true,
      status: "pending_approval",
      chargeId: charge._id,
      creditApplied,
      remaining,
      currentPlayers: session.currentPlayers,
      sessionStatus: session.status,
    });
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

    // Remove the associated charge only if it has not been paid yet, refunding any
    // credit that was already applied toward it (partial-credit + pending remainder).
    if (removed.chargeId) {
      const droppedCharge = await Charge.findOneAndDelete({ _id: removed.chargeId, status: "unpaid" });
      if (droppedCharge?.creditApplied > 0) {
        await refundCredit({
          clubId: session.clubId,
          playerId: req.user.userId,
          amount: droppedCharge.creditApplied,
          chargeId: droppedCharge._id,
          grantedBy: req.user.userId,
          reason: "Credit returned — join cancelled",
        });
      }
    }

    // Leaving the waitlist frees no real spot; only a reserved player's exit does.
    const wasReserved = ["active", "pending_payment"].includes(removed.waitStatus ?? "active");
    if (wasReserved) {
      session.currentPlayers = Math.max(0, session.currentPlayers - 1);
      if (session.status === "full") session.status = "open";
      await session.save();
      const club = await Club.findById(session.clubId)
        .select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode").lean();
      await promoteFromWaitlist(session, club); // may re-fill / offer the freed spot
    }

    res.json({ success: true, currentPlayers: session.currentPlayers, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/player/sessions/:id/claim — claim an offered waitlist spot (paid session)
router.post("/player/sessions/:id/claim", auth, async (req, res) => {
  try {
    const memberId = req.user.userId;
    const session = await HostedPlay.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const participant = await HostedPlayParticipant.findOne({
      hostedPlayId: session._id, memberId, waitStatus: "offered",
    });
    if (!participant) return res.status(404).json({ error: "You don't have a spot offer for this session" });

    if (participant.offerExpiresAt && participant.offerExpiresAt.getTime() <= Date.now()) {
      // Offer lapsed — send them to the back of the line and pass the spot along.
      participant.waitStatus = "waitlisted";
      participant.offerExpiresAt = null;
      participant.waitlistOrder = Date.now();
      await participant.save();
      const lapsedClub = await Club.findById(session.clubId)
        .select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode").lean();
      await promoteFromWaitlist(session, lapsedClub);
      return res.status(410).json({ error: "Your spot offer has expired" });
    }

    const { paymentMethod, paymentScreenshot, useCredit } = req.body;
    const validMemberMethods = ["GCash", "Bank Transfer", "GoTyme"];
    if (paymentScreenshot && !String(paymentScreenshot).startsWith("https://")) {
      return res.status(400).json({ error: "paymentScreenshot must be a secure HTTPS URL" });
    }
    if (paymentMethod && !validMemberMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid paymentMethod" });
    }

    const [user, club] = await Promise.all([
      User.findById(memberId).select("name").lean(),
      Club.findById(session.clubId).select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode").lean(),
    ]);
    const { baseFee, convenienceFee, total: amount, feeMode } = computePlayerFees(club, session.feePerPlayer);
    const netSessionFee = feeMode === "club_absorbs" ? baseFee - convenienceFee : baseFee;

    // Apply account credit toward the session fee unless the player opted to pay
    // through the club's payment methods instead (useCredit: false).
    const wantsCredit = useCredit !== false;
    const creditBalance = wantsCredit && amount > 0 ? await getCreditBalance(session.clubId, memberId) : 0;
    const creditApplied = Math.min(creditBalance, amount);
    const remaining = amount - creditApplied;

    if (remaining > 0 && (!paymentMethod || !paymentScreenshot)) {
      return res.status(400).json({ error: "Payment method and proof are required to claim this spot", remaining, creditApplied });
    }

    const charge = await Charge.create({
      clubId: session.clubId,
      playerId: memberId,
      hostedPlayId: session._id,
      amount,
      breakdown: { hostedPlayFee: netSessionFee, convenienceFee, convenienceFeeMode: feeMode },
      chargeType: "hosted_play",
      status: remaining <= 0 ? "paid" : "unpaid",
      approvalStatus: remaining <= 0 ? "approved" : "pending",
      creditApplied,
      ...(remaining <= 0 ? { paymentMethod: "Credit", paidAt: new Date() } : { paymentMethod, paymentScreenshot }),
    });

    if (creditApplied > 0) {
      await redeemCredit({ clubId: session.clubId, playerId: memberId, amount: creditApplied, chargeId: charge._id, grantedBy: memberId });
    }

    if (remaining <= 0) {
      // Fully covered by credit — activate the held spot immediately.
      participant.waitStatus = "active";
      participant.offerExpiresAt = null;
      participant.chargeId = charge._id;
      await participant.save();
      session.currentPlayers += 1;
      if (session.currentPlayers >= session.maxPlayers) session.status = "full";
      await session.save();
      sendPushToClubAdmins(session.clubId, {
        title: "Hosted Play join",
        body: `${user?.name ?? "A member"} claimed their spot for "${session.title}".`,
      });
      return res.status(201).json({ success: true, status: "active", chargeId: charge._id, creditApplied });
    }

    // Hold the offered spot while the remaining payment awaits approval. Approval flips this
    // participant to "active" (charges route); rejection reverts it to the waitlist.
    participant.chargeId = charge._id;
    participant.offerExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await participant.save();

    sendPushToClubAdmins(session.clubId, {
      title: "Hosted Play payment pending",
      body: `${user?.name ?? "A member"} claimed a waitlist spot for "${session.title}". Please review and approve.`,
    });
    res.status(201).json({ success: true, status: "pending_approval", chargeId: charge._id, creditApplied, remaining });
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
    const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id, ...ACTIVE_PARTICIPANT })
      .sort({ createdAt: 1 }).lean();
    await decorateProfileImages(participants);
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

// Blank/null → null (no guest-specific setting); otherwise a clamped number.
function normalizeGuestFee(value) {
  if (value === undefined || value === null || value === "") return null;
  return Math.max(0, Number(value) || 0);
}
function normalizeMaxGuests(value) {
  if (value === undefined || value === null || value === "") return null;
  return Math.max(0, Math.floor(Number(value) || 0));
}

const VALID_SCORE_TARGETS = [11, 15, 21];
// Pickleball-only config; any other sport is stored as unset regardless of input.
function normalizeScoreTarget(sport, value) {
  if (sport !== "pickleball" || value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return VALID_SCORE_TARGETS.includes(num) ? num : null;
}

// POST /api/hosted-play/sessions
router.post("/sessions", auth, admin, async (req, res) => {
  try {
    const {
      title, sport, date, startTime, endTime, venue, court, address,
      feePerPlayer, sessionFee, guestFeePerPlayer, maxPlayers, maxGuests, description,
      numberOfCourts, playersPerCourt, queueMode,
      minSkillLevel, maxSkillLevel, scoreTarget, winByTwo,
    } = req.body;

    if (!title || !sport || !date || !startTime || !endTime || !venue || !maxPlayers) {
      return res.status(400).json({
        error: "title, sport, date, startTime, endTime, venue and maxPlayers are required",
      });
    }
    if (scoreTarget !== undefined && scoreTarget !== null && scoreTarget !== "" && !VALID_SCORE_TARGETS.includes(Number(scoreTarget))) {
      return res.status(400).json({ error: "scoreTarget must be 11, 15, or 21" });
    }

    const normMaxGuests = normalizeMaxGuests(maxGuests);
    if (normMaxGuests !== null && normMaxGuests > Number(maxPlayers)) {
      return res.status(400).json({ error: "Max guests cannot exceed maximum players" });
    }

    const club = await Club.findById(req.user.clubId).select("hostedPlayQueueEnabled queueManagementFeePerPlayer hostedPlayFeeSplitMode").lean();

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
      feeSplitMode: club?.hostedPlayFeeSplitMode ?? "per_player",
      feePerPlayer: Math.max(0, Number(feePerPlayer ?? 0) || 0),
      sessionFee: Math.max(0, Number(sessionFee ?? 0) || 0),
      guestFeePerPlayer: normalizeGuestFee(guestFeePerPlayer),
      maxPlayers: Number(maxPlayers),
      maxGuests: normMaxGuests,
      description,
      numberOfCourts: Math.max(1, Number(numberOfCourts ?? 1) || 1),
      queueManagementEnabled: !!club?.hostedPlayQueueEnabled,
      ...(playersPerCourt !== undefined ? { playersPerCourt: Math.max(1, Number(playersPerCourt) || 4) } : {}),
      ...(queueMode !== undefined ? { queueMode } : {}),
      ...(minSkillLevel ? { minSkillLevel } : {}),
      ...(maxSkillLevel ? { maxSkillLevel } : {}),
      scoreTarget: normalizeScoreTarget(sport, scoreTarget),
      ...(winByTwo !== undefined ? { winByTwo: !!winByTwo } : {}),
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
      feePerPlayer, sessionFee, guestFeePerPlayer, maxPlayers, maxGuests, description,
      numberOfCourts, playersPerCourt, queueMode,
      minSkillLevel, maxSkillLevel, scoreTarget, winByTwo,
    } = req.body;
    if (scoreTarget !== undefined && scoreTarget !== null && scoreTarget !== "" && !VALID_SCORE_TARGETS.includes(Number(scoreTarget))) {
      return res.status(400).json({ error: "scoreTarget must be 11, 15, or 21" });
    }

    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (maxGuests !== undefined) {
      const normMaxGuests = normalizeMaxGuests(maxGuests);
      const effectiveMaxPlayers = maxPlayers !== undefined ? Number(maxPlayers) : session.maxPlayers;
      if (normMaxGuests !== null && normMaxGuests > effectiveMaxPlayers) {
        return res.status(400).json({ error: "Max guests cannot exceed maximum players" });
      }
      session.maxGuests = normMaxGuests;
    }
    if (guestFeePerPlayer !== undefined) session.guestFeePerPlayer = normalizeGuestFee(guestFeePerPlayer);

    if (numberOfCourts !== undefined) session.numberOfCourts = Math.max(1, Number(numberOfCourts) || 1);
    if (playersPerCourt !== undefined) session.playersPerCourt = Math.max(1, Number(playersPerCourt) || 4);
    if (queueMode !== undefined) session.queueMode = queueMode;
    if (minSkillLevel !== undefined) session.minSkillLevel = minSkillLevel || null;
    if (maxSkillLevel !== undefined) session.maxSkillLevel = maxSkillLevel || null;
    if (title !== undefined) session.title = title;
    if (sport !== undefined) session.sport = sport;
    // Scoring config only applies to pickleball — force-clear on any sport
    // that isn't pickleball so stale values don't resurface if it's switched back.
    if (session.sport !== "pickleball") {
      session.scoreTarget = null;
    } else if (scoreTarget !== undefined) {
      session.scoreTarget = normalizeScoreTarget(session.sport, scoreTarget);
    }
    if (winByTwo !== undefined) session.winByTwo = !!winByTwo;
    if (date !== undefined) session.date = date;
    if (startTime !== undefined) session.startTime = startTime;
    if (endTime !== undefined) session.endTime = endTime;
    if (venue !== undefined) session.venue = venue;
    if (court !== undefined) session.court = court;
    if (address !== undefined) session.address = address;
    if (feePerPlayer !== undefined) session.feePerPlayer = Math.max(0, Number(feePerPlayer) || 0);
    if (sessionFee !== undefined) session.sessionFee = Math.max(0, Number(sessionFee) || 0);
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
    const valid = ["open", "full", "closed", "cancelled", "completed"];
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

    const wasCompleted = session.status === "completed";

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

    // Split Session Fee sessions bill their joined members exactly once, the
    // first time they're marked completed. Same for per_session convenience fee.
    if (status === "completed" && !wasCompleted) {
      const club = await Club.findById(session.clubId)
        .select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayConvenienceFeeAmount")
        .lean();
      if (session.feeSplitMode === "split_total") await billSplitSessionFee(session, club);
      await settleHostedPlayConvenienceFee(session, club);
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

    const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id, ...ACTIVE_PARTICIPANT })
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
  "courtNumber", "courtSlot", "gamesPlayed", "wins", "losses", "courtStreak",
  "enteredQueueAt", "lastGameEndedAt",
];

// Decorate members with their profile image so boards can show real avatars
// (display-only — never persisted back; see QUEUE_FIELDS).
async function decorateProfileImages(participants) {
  const memberIds = [...new Set(participants.filter((p) => p.memberId).map((p) => String(p.memberId)))];
  if (!memberIds.length) return;
  const users = await User.find({ _id: { $in: memberIds } }).select("profileImage").lean();
  const imageById = new Map(users.map((u) => [String(u._id), u.profileImage || null]));
  for (const p of participants) {
    if (p.memberId) p.profileImage = imageById.get(String(p.memberId)) ?? null;
  }
}

// Shared tail of loadQueueContext/loadUmpireContext once session+club are
// resolved and Queue Management is confirmed enabled.
async function loadParticipantsContext(session, club) {
  const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id, ...ACTIVE_PARTICIPANT })
    .sort({ createdAt: 1 })
    .lean();
  await decorateProfileImages(participants);
  const prev = snapshotQueue(session, participants);
  return { session, participants, club, prev };
}

// Load the session (scoped to club), verify Queue Management is enabled, and
// return { session, participants } — or send an error response and return null.
async function loadQueueContext(req, res) {
  const [session, club] = await Promise.all([
    HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean(),
    Club.findById(req.user.clubId).select("hostedPlayQueueEnabled hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayConvenienceFeeAmount").lean(),
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
  return loadParticipantsContext(session, club);
}

// Anonymous, per-court token equivalent of loadQueueContext for the umpire
// scoring page — no req.user, no club scoping; access is proven solely by a
// token matching the SPECIFIC court in the URL. A token minted for one court
// simply has no matching entry when looked up under another court's number,
// which is what actually prevents one link from scoring more than one court.
async function loadUmpireContext(req, res) {
  const session = await HostedPlay.findById(req.params.sessionId).lean();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }
  const courtNumber = Number(req.params.n);
  const token = req.query.t;
  const entry = (session.courtUmpireTokens || []).find((c) => c.courtNumber === courtNumber);
  if (!token || !entry || entry.token !== token) {
    res.status(403).json({ error: "invalid_token" });
    return null;
  }
  if (["cancelled", "completed"].includes(session.status) || session.queueStatus === "ended") {
    res.status(409).json({ error: "session_ended" });
    return null;
  }
  const club = await Club.findById(session.clubId)
    .select("hostedPlayQueueEnabled hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayConvenienceFeeAmount logo courts")
    .lean();
  const queueAllowed = session.queueManagementEnabled ?? !!club?.hostedPlayQueueEnabled;
  if (!queueAllowed) {
    res.status(403).json({ error: "Queue Management is not enabled for this session" });
    return null;
  }
  return loadParticipantsContext(session, club);
}

// Snapshot the pre-mutation queue state so applyAndRespond can diff transitions
// (a player entering "playing" or the next group) and fire pushes. Captured
// BEFORE the engine mutates the participant objects in place.
function snapshotQueue(session, participants) {
  const size = session.playersPerCourt || 4;
  return {
    status: new Map(participants.map((p) => [String(p._id), p.queueStatus])),
    nextGroupIds: new Set(queue.getWaiting(participants).slice(0, size).map((p) => String(p._id))),
  };
}

// Push "you're up" / "on deck" alerts to members whose state advanced. Only
// fires while the queue is running; walk-ins (no memberId) are skipped.
// Fire-and-forget — never blocks or fails the response.
function notifyQueueTransitions(session, participants, changed, board, prev) {
  if (!prev || session.queueStatus !== "running") return;
  const liveUrl = `/player/hosted-play/${session._id}/live`;
  const notified = new Set();

  // "You're up" — transitioned into playing on a court.
  for (const p of changed) {
    if (!p.memberId || p.isWalkIn || p.queueStatus !== "playing") continue;
    if (prev.status.get(String(p._id)) === "playing") continue; // already on court
    notified.add(String(p._id));
    sendPushToUser(String(p.memberId), {
      title: "You're up! 🎾",
      body: `Head to Court ${p.courtNumber} — ${session.title}`,
      url: liveUrl,
      tag: `hp-up-${session._id}`,
    });
  }

  // "On deck" — newly entered the next group (and not already pinged above).
  for (const p of board.nextGroup) {
    if (!p.memberId || p.isWalkIn) continue;
    const pid = String(p._id);
    if (notified.has(pid) || prev.nextGroupIds.has(pid)) continue;
    sendPushToUser(String(p.memberId), {
      title: "You're on deck ⏳",
      body: `Get ready — you're next up at ${session.title}`,
      url: liveUrl,
      tag: `hp-deck-${session._id}`,
    });
  }
}

// Match the session's venue/court name against the club's courts (same logic
// the admin/player boards already do client-side via ClubService) and return
// that court's logo, falling back to the club's own logo, else null. Safe to
// call with a club doc that never selected `logo`/`courts` — just resolves null.
function resolveVenueLogo(club, session) {
  const venue = (session.venue || "").trim().toLowerCase();
  const court = (session.court || "").trim().toLowerCase();
  const match = (club?.courts || []).find((c) => {
    const name = (c.name || "").trim().toLowerCase();
    return name === venue || (!!court && name === court);
  });
  return match?.logo || club?.logo || null;
}

// Copy per-player fee figures (member + guest) and the resolved venue logo
// onto the board's session for UI display.
function decorateBoardFees(board, club, session) {
  // Split Session Fee sessions aren't billed until completion, so this is only
  // an estimate — it shrinks/grows as members join/leave beforehand.
  const isSplitTotal = session.feeSplitMode === "split_total";
  const baseFee = isSplitTotal
    ? parseFloat((Number(session.sessionFee || 0) / Math.max(1, session.currentPlayers)).toFixed(2))
    : session.feePerPlayer;
  const fees = computePlayerFees(club, baseFee);
  board.session.feePerPlayer = fees.baseFee;
  board.session.convenienceFeePerPlayer = fees.convenienceFee;
  board.session.convenienceFeeMode = fees.feeMode;
  board.session.totalPerPlayer = fees.total;
  board.session.estimatedFee = isSplitTotal;
  const guestFees = computePlayerFees(club, resolveGuestFee(session));
  board.session.guestFeePerPlayer = guestFees.baseFee;
  board.session.guestConvenienceFeePerPlayer = guestFees.convenienceFee;
  board.session.guestTotalPerPlayer = guestFees.total;
  board.session.venueLogo = resolveVenueLogo(club, session);
}

// Persist an engine result (changed participants + optional session update),
// apply the session update in memory, and respond with the fresh board.
async function applyAndRespond(res, session, participants, result, club = null, prev = null, extra = null) {
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
    decorateBoardFees(board, club, session);
  }
  notifyQueueTransitions(session, participants, changed, board, prev);
  return res.json(extra ? { ...board, ...extra } : board);
}

// GET /api/hosted-play/sessions/:id/queue — live board (polling target)
router.get("/sessions/:id/queue", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const board = queue.buildBoard(ctx.session, ctx.participants);
    decorateBoardFees(board, ctx.club, ctx.session);
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
    await applyAndRespond(res, ctx.session, ctx.participants, queue.startQueue(ctx.session, ctx.participants), ctx.club, ctx.prev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/queue/end
router.post("/sessions/:id/queue/end", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const wasCompleted = ctx.session.status === "completed";
    const result = queue.endQueue(ctx.session, ctx.participants);
    // Split Session Fee sessions bill their joined members exactly once, the
    // first time they're marked completed (here, or via PATCH /sessions/:id/status).
    // Same for per_session convenience fee.
    if (result?.sessionUpdate?.status === "completed" && !wasCompleted) {
      if (ctx.session.feeSplitMode === "split_total") await billSplitSessionFee(ctx.session, ctx.club);
      await settleHostedPlayConvenienceFee(ctx.session, ctx.club);
    }
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club, ctx.prev);
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
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club, ctx.prev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/generate-qr — admin generates/regenerates a QR token
router.post("/sessions/:id/generate-qr", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!ownsClub(req, session.clubId)) return res.status(403).json({ error: "Access denied" });

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

// POST /api/hosted-play/sessions/:id/courts/:n/generate-umpire-link — admin
// generates/regenerates the anonymous, token-only link an umpire uses to enter
// live scores for ONE specific court, without logging in. Regenerating only
// invalidates that court's previous link — other courts' links are untouched.
router.post("/sessions/:id/courts/:n/generate-umpire-link", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!ownsClub(req, session.clubId)) return res.status(403).json({ error: "Access denied" });

    const courtNumber = Number(req.params.n);
    if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > (session.numberOfCourts || 1)) {
      return res.status(400).json({ error: "Invalid court" });
    }

    const token = randomUUID();
    const courtUmpireTokens = (session.courtUmpireTokens || []).filter((c) => c.courtNumber !== courtNumber);
    courtUmpireTokens.push({ courtNumber, token, generatedAt: new Date() });
    await HostedPlay.findByIdAndUpdate(session._id, { courtUmpireTokens });

    const appUrl = process.env.APP_URL || "https://courtgo.club";
    const url = `${appUrl}/umpire/${session._id}/courts/${courtNumber}?t=${token}`;
    res.json({ token, url });
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
    if (!participant || (participant.waitStatus ?? "active") !== "active") {
      return res.status(404).json({ error: "not_a_participant" }); // waitlisted/offered/pending_payment aren't in yet
    }
    if (participant.checkedIn) return res.status(409).json({ error: "already_checked_in" });

    const club = await Club.findById(session.clubId)
      .select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode numberOfCourts")
      .lean();
    const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id, ...ACTIVE_PARTICIPANT })
      .sort({ createdAt: 1 })
      .lean();

    const prev = snapshotQueue(session, participants);
    const result = queue.setCheckIn(session, participants, String(participant._id), true);
    if (result.error === "not_found") return res.status(404).json({ error: "Participant not found" });
    await applyAndRespond(res, session, participants, result, club, prev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/walkins — add a walk-in player.
// Guest walk-in ({ name }): guest fee collected as cash on the spot.
// Member walk-in ({ memberId }): member fee, credit applied first, remainder
// saved as an unpaid charge the member settles from their Payments page.
router.post("/sessions/:id/walkins", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;

    if (req.body.memberId) {
      return await addMemberWalkIn(req, res, ctx);
    }

    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Walk-in name is required" });

    // Walk-ins are guests: enforce the session's guest cap.
    if (ctx.session.maxGuests != null) {
      const guests = await countGuests(ctx.session._id);
      if (guests >= ctx.session.maxGuests) {
        return res.status(400).json({ error: "Guest spots for this session are full", code: "guest_spots_full" });
      }
    }

    // Create a cash charge for the walk-in if the session has a fee
    const { baseFee, convenienceFee, total: amount, feeMode } = computePlayerFees(ctx.club, resolveGuestFee(ctx.session));
    let chargeId;
    if (amount > 0) {
      const charge = await Charge.create({
        clubId: ctx.session.clubId,
        guestName: name,
        hostedPlayId: ctx.session._id,
        amount,
        breakdown: { hostedPlayFee: baseFee, convenienceFee, convenienceFeeMode: feeMode },
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
    await applyAndRespond(res, ctx.session, ctx.participants, queue.appendAndAssign(ctx.session, ctx.participants, walkIn._id), ctx.club, ctx.prev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Member walk-in: link the participant to a club member's account. Occupies a
// member slot (maxPlayers), never the guest cap. Skill-band and guest checks
// are deliberately skipped — the admin is seating a player standing at the desk.
async function addMemberWalkIn(req, res, ctx) {
  const memberId = String(req.body.memberId);
  const user = await User.findById(memberId).select("name clubId").lean();
  if (!user) return res.status(404).json({ error: "Member not found" });
  if (String(user.clubId) !== String(ctx.session.clubId)) {
    return res.status(400).json({ error: "Member does not belong to this club" });
  }

  const existing = await HostedPlayParticipant.findOne({ hostedPlayId: ctx.session._id, memberId }).lean();
  if (existing) {
    if (existing.waitStatus === "waitlisted") return res.status(400).json({ error: "This member is on the waitlist — promote them instead" });
    if (existing.waitStatus === "offered") return res.status(400).json({ error: "This member has a pending spot offer" });
    if (existing.waitStatus === "pending_payment") return res.status(400).json({ error: "This member has a payment awaiting approval for this session" });
    if (existing.queueStatus !== "done") return res.status(400).json({ error: "This member is already in this session" });

    // Previously removed from the queue — re-enqueue in place. Already paid and
    // already counted in currentPlayers (removal decrements neither).
    await HostedPlayParticipant.updateOne({ _id: existing._id }, { $set: { checkedIn: true, checkedInAt: new Date() } });
    const row = ctx.participants.find((p) => String(p._id) === String(existing._id));
    if (row) {
      row.checkedIn = true;
      row.checkedInAt = new Date();
    }
    return applyAndRespond(res, ctx.session, ctx.participants, queue.appendAndAssign(ctx.session, ctx.participants, existing._id), ctx.club, ctx.prev);
  }

  // No maxPlayers check: like guest walk-ins, an admin add is a deliberate
  // override — the player is standing at the desk. currentPlayers still
  // increments below so split-fee estimates and reports stay accurate.

  // Split Session Fee sessions bill members once at completion (billSplitSessionFee);
  // otherwise charge the member fee now — credit first, remainder left unpaid for
  // the member to settle from their Payments page.
  let chargeId;
  if (ctx.session.feeSplitMode !== "split_total") {
    const breakdown = await computeMemberFeeAndCredit({ session: ctx.session, club: ctx.club, memberId, baseFee: ctx.session.feePerPlayer });
    if (breakdown.amount > 0) {
      const charge = await chargeMemberForSession({ session: ctx.session, memberId, breakdown });
      chargeId = charge._id;
    }
  }

  const walkIn = await HostedPlayParticipant.create({
    hostedPlayId: ctx.session._id,
    clubId: ctx.session.clubId,
    memberId,
    isWalkIn: true,
    memberName: user.name,
    chargeId: chargeId ?? undefined,
    checkedIn: true,
    checkedInAt: new Date(),
    queueStatus: "not_checked_in",
  });

  ctx.session.currentPlayers += 1;
  const update = { $inc: { currentPlayers: 1 } };
  if (ctx.session.currentPlayers >= ctx.session.maxPlayers && ctx.session.status === "open") {
    update.$set = { status: "full" };
    ctx.session.status = "full";
  }
  await HostedPlay.updateOne({ _id: ctx.session._id }, update);

  ctx.participants.push(walkIn.toObject());
  return applyAndRespond(res, ctx.session, ctx.participants, queue.appendAndAssign(ctx.session, ctx.participants, walkIn._id), ctx.club, ctx.prev);
}

// ── Match records (per finished game, optional scores) ────────────────────────

// Server mirror of the frontend splitCourtTeams helper (hosted-play.service.ts):
// low courtSlot half = team 1 ("Team A"), high half = team 2; array-order
// fallback for participants that predate slot tracking.
function splitTeamsBySlot(players, playersPerCourt) {
  const half = Math.ceil((playersPerCourt || 4) / 2);
  const hasSlots = players.length > 0 && players.every((p) => typeof p.courtSlot === "number");
  if (hasSlots) {
    const sorted = [...players].sort((a, b) => (a.courtSlot ?? 0) - (b.courtSlot ?? 0));
    return { team1: sorted.filter((p) => p.courtSlot <= half), team2: sorted.filter((p) => p.courtSlot > half) };
  }
  return { team1: players.slice(0, half), team2: players.slice(half) };
}

// Optional score pair from a request body. Returns null when neither score is
// provided, { team1Score, team2Score } when both are valid, or { error }.
// Ties are allowed (no winner derived from them).
function parseMatchScores(body) {
  const given = (v) => v !== undefined && v !== null && v !== "";
  const has1 = given(body.team1Score);
  const has2 = given(body.team2Score);
  if (!has1 && !has2) return null;
  if (!has1 || !has2) return { error: "Enter both scores or neither" };
  const team1Score = Number(body.team1Score);
  const team2Score = Number(body.team2Score);
  if (!Number.isInteger(team1Score) || !Number.isInteger(team2Score) || team1Score < 0 || team2Score < 0) {
    return { error: "Scores must be non-negative whole numbers" };
  }
  return { team1Score, team2Score };
}

// Winner resolution at finish time. A tapped winner (admin picked the side) is
// authoritative; otherwise unequal scores decide. Tapped winner + scores that
// don't back it up is an input error surfaced as { error }.
function deriveWinnerTeam(team1, team2, winnerSet, scores) {
  if (winnerSet.size && team1.length && team2.length) {
    const allIn = (team) => team.every((p) => winnerSet.has(String(p.participantId)));
    const t1Won = allIn(team1);
    const t2Won = allIn(team2);
    if (t1Won !== t2Won) {
      const winnerTeam = t1Won ? 1 : 2;
      if (scores) {
        const winnerScore = winnerTeam === 1 ? scores.team1Score : scores.team2Score;
        const loserScore = winnerTeam === 1 ? scores.team2Score : scores.team1Score;
        if (winnerScore <= loserScore) return { error: "Scores contradict the selected winner" };
      }
      return { winnerTeam, winnerSource: "tapped" };
    }
  }
  if (scores && scores.team1Score !== scores.team2Score) {
    return { winnerTeam: scores.team1Score > scores.team2Score ? 1 : 2, winnerSource: "scores" };
  }
  return { winnerTeam: null, winnerSource: null };
}

// Snapshot a court's players into embedded HostedPlayMatch player records.
// Must run BEFORE queue.finishGame — finishGame nulls courtNumber/courtSlot
// on players it requeues.
function snapshotCourtTeams(participants, courtNumber, playersPerCourt) {
  const courtPlayers = queue.getCourtPlayers(participants, courtNumber);
  const { team1, team2 } = splitTeamsBySlot(courtPlayers, playersPerCourt || 4);
  const toSnapshot = (p) => ({
    participantId: p._id,
    memberId: p.memberId ?? null,
    memberName: p.memberName ?? "",
    isWalkIn: !!p.isWalkIn,
  });
  return { team1Players: team1.map(toSnapshot), team2Players: team2.map(toSnapshot) };
}

// Run the queue engine's finishGame and, on success, record a HostedPlayMatch
// from the pre-snapshotted teams. Shared by the admin finish route (tapped
// winner is authoritative) and the anonymous umpire finish route (winner is
// derived purely from the live score) — each resolves its own winner before
// calling this.
async function finishCourtAndRecordMatch(ctx, courtNumber, teams, { winnerIds = [], scores = null, winnerTeam = null, winnerSource = null, recordedBy = null }) {
  const result = queue.finishGame(ctx.session, ctx.participants, courtNumber, winnerIds);

  // Record the match only when the finish itself succeeded. A failed insert
  // must never fail the finish — court rotation is the primary flow.
  let match = null;
  if (!result?.error) {
    try {
      match = await HostedPlayMatch.create({
        sessionId: ctx.session._id,
        clubId: ctx.session.clubId,
        sport: ctx.session.sport,
        queueMode: ctx.session.queueMode,
        courtNumber,
        team1: teams.team1Players,
        team2: teams.team2Players,
        team1Score: scores?.team1Score ?? null,
        team2Score: scores?.team2Score ?? null,
        winnerTeam,
        winnerSource,
        finishedAt: new Date(),
        recordedBy,
        scoreEnteredBy: scores ? recordedBy : null,
        scoreEnteredAt: scores ? new Date() : null,
      });
    } catch (e) {
      console.error("hosted-play: failed to record match", e);
    }
  }
  return { result, match };
}

// POST /api/hosted-play/sessions/:id/courts/:n/finish
router.post("/sessions/:id/courts/:n/finish", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);
    const winnerIds = Array.isArray(req.body.winnerIds) ? req.body.winnerIds : [];

    const scores = parseMatchScores(req.body);
    if (scores?.error) return res.status(400).json({ error: scores.error });

    // Snapshot the court BEFORE finishGame — re-queue nulls courtNumber/courtSlot.
    const teams = snapshotCourtTeams(ctx.participants, courtNumber, ctx.session.playersPerCourt);

    const winnerSet = new Set(winnerIds.map(String));
    const derived = deriveWinnerTeam(teams.team1Players, teams.team2Players, winnerSet, scores);
    if (derived.error) return res.status(400).json({ error: derived.error });

    const { result, match } = await finishCourtAndRecordMatch(ctx, courtNumber, teams, {
      winnerIds, scores, winnerTeam: derived.winnerTeam, winnerSource: derived.winnerSource, recordedBy: req.user.userId,
    });
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club, ctx.prev,
      match ? { lastMatch: match.toObject() } : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Umpire Live Scoring — anonymous, per-court token access (no login) ──────

// GET /api/hosted-play/umpire/:sessionId/courts/:n/board?t=<courtToken>
router.get("/umpire/:sessionId/courts/:n/board", async (req, res) => {
  try {
    const ctx = await loadUmpireContext(req, res);
    if (!ctx) return;
    const board = queue.buildBoard(ctx.session, ctx.participants);
    decorateBoardFees(board, ctx.club, ctx.session);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Persist a court's updated liveScores entry and respond with the fresh board.
// Shared by start-serve/rally-won/undo — the only three ways a liveScores
// entry changes outside of finish (which clears it entirely).
async function saveLiveScoreAndRespond(res, ctx, courtNumber, updatedEntry) {
  const liveScores = ctx.session.liveScores || [];
  ctx.session.liveScores = [...liveScores.filter((s) => s.courtNumber !== courtNumber), updatedEntry];
  await HostedPlay.updateOne({ _id: ctx.session._id }, { $set: { liveScores: ctx.session.liveScores } });
  const board = queue.buildBoard(ctx.session, ctx.participants);
  decorateBoardFees(board, ctx.club, ctx.session);
  res.json(board);
}

// A team's players as snapshotCourtTeams returns them (participantId is p._id).
function teamPlayers(teams, team) {
  return team === 1 ? teams.team1Players : teams.team2Players;
}

// POST /api/hosted-play/umpire/:sessionId/courts/:n/start-serve?t=<courtToken>
// Body: { team: 1 | 2, playerId }. Picks who serves first for a fresh game on
// this court — team and player in one call. Only allowed before any point has
// been played, so a wrong pick can be corrected freely up until scoring starts.
router.post("/umpire/:sessionId/courts/:n/start-serve", async (req, res) => {
  try {
    const ctx = await loadUmpireContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);
    const team = Number(req.body.team);
    const playerId = req.body.playerId ? String(req.body.playerId) : "";
    if (![1, 2].includes(team)) {
      return res.status(400).json({ error: "Invalid team" });
    }
    if (queue.getCourtPlayers(ctx.participants, courtNumber).length === 0) {
      return res.status(400).json({ error: "Court is empty" });
    }

    const existing = (ctx.session.liveScores || []).find((s) => s.courtNumber === courtNumber);
    if (existing && (existing.team1Score > 0 || existing.team2Score > 0)) {
      return res.status(400).json({ error: "Scoring has already started for this game" });
    }

    // Doubles' opening turn only gets one server (the official "0-0-2" handicap);
    // a singles side has no partner to skip, so it just starts at server 1.
    const teams = snapshotCourtTeams(ctx.participants, courtNumber, ctx.session.playersPerCourt);
    const chosenTeam = teamPlayers(teams, team);
    if (!chosenTeam.some((p) => String(p.participantId) === playerId)) {
      return res.status(400).json({ error: "That player is not on this team" });
    }

    // The chosen first server is, by rule, the right-side player for their
    // team (labeled server "2" only due to the opening handicap above — they
    // physically start on the right). Recording it here is what lets THIS
    // team's later side-outs resolve their server automatically. A fresh game
    // means fresh positions for both teams, so the other team's is cleared.
    await saveLiveScoreAndRespond(res, ctx, courtNumber, {
      courtNumber,
      team1Score: 0,
      team2Score: 0,
      servingTeam: team,
      serverNumber: chosenTeam.length >= 2 ? 2 : 1,
      servingPlayerId: playerId,
      team1RightPlayerId: team === 1 ? playerId : null,
      team2RightPlayerId: team === 2 ? playerId : null,
      previousState: null,
      updatedAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/umpire/:sessionId/courts/:n/set-server?t=<courtToken>
// Body: { playerId }. Resolves who's serving for the current serving team —
// either their first-ever side-out this game (the app can't derive that on
// its own yet), or a manual correction/override at any later point, since
// real casual play doesn't always follow textbook court positioning. Doesn't
// touch scores. Whatever is picked here becomes the recorded court position
// for that team going forward, so it's what future side-outs derive from.
router.post("/umpire/:sessionId/courts/:n/set-server", async (req, res) => {
  try {
    const ctx = await loadUmpireContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);
    const playerId = req.body.playerId ? String(req.body.playerId) : "";

    const existing = (ctx.session.liveScores || []).find((s) => s.courtNumber === courtNumber);
    if (!existing || !existing.servingTeam) {
      return res.status(400).json({ error: "Choose who serves first" });
    }

    const teams = snapshotCourtTeams(ctx.participants, courtNumber, ctx.session.playersPerCourt);
    const servingTeamPlayers = teamPlayers(teams, existing.servingTeam);
    if (!servingTeamPlayers.some((p) => String(p.participantId) === playerId)) {
      return res.status(400).json({ error: "That player is not on the serving team" });
    }

    const previousState = {
      team1Score: existing.team1Score,
      team2Score: existing.team2Score,
      servingTeam: existing.servingTeam,
      serverNumber: existing.serverNumber,
      servingPlayerId: existing.servingPlayerId,
      team1RightPlayerId: existing.team1RightPlayerId,
      team2RightPlayerId: existing.team2RightPlayerId,
    };

    // The right-side player is whoever's server-1-equivalent right now: if
    // this is for server 1, they ARE the right-side player; if it's for
    // server 2, their partner (who never moved) is the one on the right —
    // server 2 just continues from wherever server 1 left off, unchanged.
    let rightPlayerId = playerId;
    if (existing.serverNumber === 2) {
      const partner = servingTeamPlayers.find((p) => String(p.participantId) !== playerId);
      rightPlayerId = partner ? partner.participantId : playerId;
    }
    const rightPlayerField = existing.servingTeam === 1 ? "team1RightPlayerId" : "team2RightPlayerId";

    await saveLiveScoreAndRespond(res, ctx, courtNumber, {
      courtNumber,
      team1Score: existing.team1Score,
      team2Score: existing.team2Score,
      servingTeam: existing.servingTeam,
      serverNumber: existing.serverNumber,
      servingPlayerId: playerId,
      team1RightPlayerId: existing.team1RightPlayerId,
      team2RightPlayerId: existing.team2RightPlayerId,
      [rightPlayerField]: rightPlayerId,
      previousState,
      updatedAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/umpire/:sessionId/courts/:n/rally-won?t=<courtToken>
// Body: { team: 1 | 2 } — the team that just won the rally. The umpire always
// taps this same pair of buttons regardless of who's serving; whether that's a
// point or a side-out (and whether the serve just rotates to the server's
// partner or passes to the other team) is derived here, not chosen by the umpire.
router.post("/umpire/:sessionId/courts/:n/rally-won", async (req, res) => {
  try {
    const ctx = await loadUmpireContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);
    const team = Number(req.body.team);
    if (![1, 2].includes(team)) {
      return res.status(400).json({ error: "Invalid team" });
    }

    const existing = (ctx.session.liveScores || []).find((s) => s.courtNumber === courtNumber);
    if (!existing || !existing.servingTeam) {
      return res.status(400).json({ error: "Choose who serves first" });
    }
    if (!existing.servingPlayerId) {
      return res.status(400).json({ error: "Choose who's serving" });
    }

    const previousState = {
      team1Score: existing.team1Score,
      team2Score: existing.team2Score,
      servingTeam: existing.servingTeam,
      serverNumber: existing.serverNumber,
      servingPlayerId: existing.servingPlayerId,
      team1RightPlayerId: existing.team1RightPlayerId,
      team2RightPlayerId: existing.team2RightPlayerId,
    };
    let { team1Score, team2Score, servingTeam, serverNumber, servingPlayerId, team1RightPlayerId, team2RightPlayerId } = existing;
    const teams = snapshotCourtTeams(ctx.participants, courtNumber, ctx.session.playersPerCourt);

    if (team === servingTeam) {
      // Server won the rally — a point. Server keeps serving, but the pair
      // swaps court sides, so the right-side record flips to the partner.
      if (servingTeam === 1) team1Score += 1; else team2Score += 1;
      const servingTeamPlayers = teamPlayers(teams, servingTeam);
      const partner = servingTeamPlayers.find((p) => String(p.participantId) !== String(servingPlayerId));
      const newRightPlayerId = partner ? partner.participantId : servingPlayerId;
      if (servingTeam === 1) team1RightPlayerId = newRightPlayerId; else team2RightPlayerId = newRightPlayerId;
    } else {
      // Receiver won the rally — no score change. The serve rotates to the
      // server's partner (doubles, still on server 1), or is a full side-out.
      const servingTeamPlayers = teamPlayers(teams, servingTeam);
      if (servingTeamPlayers.length >= 2 && serverNumber === 1) {
        // Partner rotation is unambiguous — a doubles team only has two
        // players, so "whoever isn't currently serving" is the only answer.
        // No position change: server 2 just continues from wherever server 1
        // already was.
        serverNumber = 2;
        const partner = servingTeamPlayers.find((p) => String(p.participantId) !== String(servingPlayerId));
        servingPlayerId = partner ? partner.participantId : servingPlayerId;
      } else {
        // Full side-out. Positions don't change — server numbers are just
        // reassigned based on wherever the new serving team already is:
        // whoever's on the right becomes server 1. Once that's known for this
        // team (from an earlier turn), it resolves automatically; only a
        // team's very first side-out of the game needs the umpire to pick it.
        servingTeam = team;
        serverNumber = 1;
        const winningTeamPlayers = teamPlayers(teams, team);
        const knownRightPlayerId = team === 1 ? team1RightPlayerId : team2RightPlayerId;
        if (winningTeamPlayers.length === 1) {
          servingPlayerId = winningTeamPlayers[0].participantId;
        } else if (knownRightPlayerId) {
          servingPlayerId = knownRightPlayerId;
        } else {
          servingPlayerId = null;
        }
      }
    }

    await saveLiveScoreAndRespond(res, ctx, courtNumber, {
      courtNumber, team1Score, team2Score, servingTeam, serverNumber, servingPlayerId,
      team1RightPlayerId, team2RightPlayerId, previousState, updatedAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/umpire/:sessionId/courts/:n/undo?t=<courtToken>
// Reverts the last rally-won call (or start-serve pick) for this court.
// Single level only — matches the page's otherwise-simple interaction model.
router.post("/umpire/:sessionId/courts/:n/undo", async (req, res) => {
  try {
    const ctx = await loadUmpireContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);

    const existing = (ctx.session.liveScores || []).find((s) => s.courtNumber === courtNumber);
    if (!existing || !existing.previousState) {
      return res.status(400).json({ error: "Nothing to undo" });
    }

    await saveLiveScoreAndRespond(res, ctx, courtNumber, {
      courtNumber,
      team1Score: existing.previousState.team1Score,
      team2Score: existing.previousState.team2Score,
      servingTeam: existing.previousState.servingTeam,
      serverNumber: existing.previousState.serverNumber,
      servingPlayerId: existing.previousState.servingPlayerId ?? null,
      team1RightPlayerId: existing.previousState.team1RightPlayerId ?? null,
      team2RightPlayerId: existing.previousState.team2RightPlayerId ?? null,
      previousState: null,
      updatedAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/umpire/:sessionId/courts/:n/finish?t=<courtToken>
// The winner is always derived from the live score (winnerSource: "scores")
// — there's no tap-a-winner step for the umpire, unlike the admin finish route.
router.post("/umpire/:sessionId/courts/:n/finish", async (req, res) => {
  try {
    const ctx = await loadUmpireContext(req, res);
    if (!ctx) return;
    const courtNumber = Number(req.params.n);

    const live = (ctx.session.liveScores || []).find((s) => s.courtNumber === courtNumber);
    if (!live || (live.team1Score === 0 && live.team2Score === 0)) {
      return res.status(400).json({ error: "No score recorded yet" });
    }
    if (live.team1Score === live.team2Score) {
      return res.status(400).json({ error: "Scores are tied — enter the final point before finishing" });
    }

    const winnerTeam = live.team1Score > live.team2Score ? 1 : 2;
    const teams = snapshotCourtTeams(ctx.participants, courtNumber, ctx.session.playersPerCourt);
    const winnerIds = (winnerTeam === 1 ? teams.team1Players : teams.team2Players).map((p) => String(p.participantId));

    const { result, match } = await finishCourtAndRecordMatch(ctx, courtNumber, teams, {
      winnerIds,
      scores: { team1Score: live.team1Score, team2Score: live.team2Score },
      winnerTeam,
      winnerSource: "scores",
      recordedBy: ctx.session.createdBy,
    });

    if (!result?.error) {
      ctx.session.liveScores = (ctx.session.liveScores || []).filter((s) => s.courtNumber !== courtNumber);
      await HostedPlay.updateOne({ _id: ctx.session._id }, { $pull: { liveScores: { courtNumber } } });
    }
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club, ctx.prev,
      match ? { lastMatch: match.toObject() } : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/courts/rearrange — tap-to-swap board edits.
// Body: { participantId, targetParticipantId } to swap two players' positions,
// or { participantId, courtNumber, courtSlot } to move onto an open slot.
router.post("/sessions/:id/courts/rearrange", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
    const { participantId, targetParticipantId, courtNumber, courtSlot } = req.body;
    const result = targetParticipantId
      ? queue.swapPlayers(ctx.session, ctx.participants, participantId, targetParticipantId)
      : queue.movePlayerToSlot(ctx.session, ctx.participants, participantId, Number(courtNumber), Number(courtSlot));
    if (result.error) {
      const messages = {
        not_found: "Participant not found",
        same_player: "Pick two different players",
        not_movable: "Only playing or waiting players can be moved",
        both_waiting: "Use the queue arrows to reorder waiting players",
        invalid_court: "Invalid court",
        invalid_slot: "Invalid slot",
        slot_taken: "That slot is already taken",
      };
      return res.status(result.error === "not_found" ? 404 : 400).json({ error: messages[result.error] || result.error });
    }
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club, ctx.prev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hosted-play/sessions/:id/matches — recorded games, newest first.
// Player names come from the embedded snapshots (guests included) — no populate.
router.get("/sessions/:id/matches", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).select("_id").lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    const matches = await HostedPlayMatch.find({ sessionId: session._id }).sort({ finishedAt: -1 }).lean();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hosted-play/matches, /api/hosted-play/player/matches — club-wide,
// all-time match history (every finished game across every session), newest
// first. Guests are included as-is (name snapshots) — this is a raw list, not
// a standings view.
async function listClubMatchHistory(req, res, clubId) {
  try {
    if (!clubId) return res.status(400).json({ error: "You are not assigned to a club" });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = { clubId };
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;

    const [matches, total] = await Promise.all([
      HostedPlayMatch.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      HostedPlayMatch.countDocuments(filter),
    ]);

    const sessionIds = [...new Set(matches.map((m) => String(m.sessionId)))];
    const sessions = await HostedPlay.find({ _id: { $in: sessionIds } }).select("title date venue sport").lean();
    const sessionMap = new Map(sessions.map((s) => [String(s._id), s]));

    res.json({
      matches: matches.map((m) => ({ ...m, session: sessionMap.get(String(m.sessionId)) || null })),
      total,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
router.get("/matches", auth, admin, (req, res) => listClubMatchHistory(req, res, req.user.clubId));
router.get("/player/matches", auth, (req, res) => listClubMatchHistory(req, res, req.query.clubId || req.user.clubId));

// GET /api/hosted-play/standings, /api/hosted-play/player/standings —
// club-wide, all-time win/loss standings. Only matches with a decided winner
// count. Guests (no memberId) never get their own row and are excluded from
// pairing stats for the side they were on, but a member paired with a guest
// still gets individual credit for that game.
async function computeStandings(clubId) {
  const clubObjectId = new mongoose.Types.ObjectId(clubId);
  const individuals = await HostedPlayMatch.aggregate([
    { $match: { clubId: clubObjectId, winnerTeam: { $in: [1, 2] } } },
    {
      $project: {
        winnerTeam: 1,
        players: {
          $concatArrays: [
            { $map: { input: "$team1", as: "p", in: { memberId: "$$p.memberId", memberName: "$$p.memberName", team: 1 } } },
            { $map: { input: "$team2", as: "p", in: { memberId: "$$p.memberId", memberName: "$$p.memberName", team: 2 } } },
          ],
        },
      },
    },
    { $unwind: "$players" },
    { $match: { "players.memberId": { $ne: null } } },
    {
      $group: {
        _id: "$players.memberId",
        memberName: { $last: "$players.memberName" },
        wins: { $sum: { $cond: [{ $eq: ["$players.team", "$winnerTeam"] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $eq: ["$players.team", "$winnerTeam"] }, 0, 1] } },
      },
    },
    { $addFields: { gamesPlayed: { $add: ["$wins", "$losses"] } } },
    { $addFields: { winPct: { $cond: [{ $eq: ["$gamesPlayed", 0] }, 0, { $divide: ["$wins", "$gamesPlayed"] }] } } },
    { $sort: { wins: -1, winPct: -1, gamesPlayed: -1 } },
    { $project: { _id: 0, memberId: "$_id", memberName: 1, wins: 1, losses: 1, gamesPlayed: 1, winPct: 1 } },
  ]);

  // Pairing stats are built in JS rather than via a Mongo aggregation
  // ($sortArray) to avoid depending on a specific MongoDB server version —
  // this dataset (decided matches for one club) is small enough that this is
  // cheap and keeps the grouping logic easy to follow.
  const decidedMatches = await HostedPlayMatch.find({ clubId, winnerTeam: { $in: [1, 2] } })
    .select("team1 team2 winnerTeam")
    .lean();

  const pairingMap = new Map();
  for (const match of decidedMatches) {
    const sides = [
      { players: match.team1, won: match.winnerTeam === 1 },
      { players: match.team2, won: match.winnerTeam === 2 },
    ];
    for (const side of sides) {
      if (!side.players || side.players.length < 2) continue;
      if (side.players.some((p) => !p.memberId)) continue; // any guest on this side excludes it

      const sortedIds = side.players.map((p) => String(p.memberId)).sort();
      const key = sortedIds.join("|");
      if (!pairingMap.has(key)) {
        pairingMap.set(key, {
          memberIds: sortedIds,
          players: side.players.map((p) => ({ memberId: p.memberId, memberName: p.memberName })),
          wins: 0,
          losses: 0,
        });
      }
      const entry = pairingMap.get(key);
      entry.players = side.players.map((p) => ({ memberId: p.memberId, memberName: p.memberName }));
      if (side.won) entry.wins += 1;
      else entry.losses += 1;
    }
  }

  const pairings = [...pairingMap.values()]
    .map((entry) => {
      const gamesPlayed = entry.wins + entry.losses;
      return { ...entry, gamesPlayed, winPct: gamesPlayed === 0 ? 0 : entry.wins / gamesPlayed };
    })
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || b.gamesPlayed - a.gamesPlayed);

  return { individuals, pairings };
}
router.get("/standings", auth, admin, async (req, res) => {
  try {
    res.json(await computeStandings(req.user.clubId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/player/standings", auth, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "You are not assigned to a club" });
    res.json(await computeStandings(clubId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/hosted-play/matches/:matchId/score — add/correct scores after the
// fact. Never retro-adjusts participant wins/losses — those were settled by the
// queue engine at finish time; scores are record-keeping only.
router.patch("/matches/:matchId/score", auth, admin, async (req, res) => {
  try {
    const match = await HostedPlayMatch.findOne({ _id: req.params.matchId, clubId: req.user.clubId });
    if (!match) return res.status(404).json({ error: "Match not found" });

    // Both explicitly null clears the scores (and a score-derived winner).
    if (req.body.team1Score === null && req.body.team2Score === null) {
      match.team1Score = null;
      match.team2Score = null;
      if (match.winnerSource === "scores") {
        match.winnerTeam = null;
        match.winnerSource = null;
      }
    } else {
      const scores = parseMatchScores(req.body);
      if (!scores || scores.error) return res.status(400).json({ error: scores?.error || "Both scores are required" });

      if (match.winnerSource === "tapped") {
        // The tapped winner is authoritative — scores must agree.
        const winnerScore = match.winnerTeam === 1 ? scores.team1Score : scores.team2Score;
        const loserScore = match.winnerTeam === 1 ? scores.team2Score : scores.team1Score;
        if (winnerScore <= loserScore) return res.status(400).json({ error: "Scores contradict the recorded winner" });
      } else {
        match.winnerTeam = scores.team1Score === scores.team2Score ? null : scores.team1Score > scores.team2Score ? 1 : 2;
        match.winnerSource = match.winnerTeam ? "scores" : null;
      }
      match.team1Score = scores.team1Score;
      match.team2Score = scores.team2Score;
    }
    match.scoreEnteredBy = req.user.userId;
    match.scoreEnteredAt = new Date();
    await match.save();
    res.json(match.toObject());
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
    await applyAndRespond(res, ctx.session, ctx.participants, queue.manualAssign(ctx.session, ctx.participants, ids, courtNumber), ctx.club, ctx.prev);
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
      await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club, ctx.prev);
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
    await applyAndRespond(res, ctx.session, ctx.participants, result, ctx.club, ctx.prev);
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
    await applyAndRespond(res, ctx.session, ctx.participants, queue.reorderQueue(ctx.session, ctx.participants, ids), ctx.club, ctx.prev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
