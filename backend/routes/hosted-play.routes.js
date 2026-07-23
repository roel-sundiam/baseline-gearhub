const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const HostedPlay = require("../models/HostedPlay");
const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const HostedPlayMatch = require("../models/HostedPlayMatch");
const HostedPlayPair = require("../models/HostedPlayPair");
const HostedPlayFixture = require("../models/HostedPlayFixture");
const User = require("../models/User");
const Club = require("../models/Club");
const Charge = require("../models/Charge");
const AppServicePayment = require("../models/AppServicePayment");
const queue = require("../services/queue-engine");
const fixedDoubles = require("../services/fixed-doubles-engine");
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
    const result = await joinSessionAsParticipant({ session, memberId, paymentMethod, paymentScreenshot, useCredit });
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, remaining: result.remaining, creditApplied: result.creditApplied });
    }

    if (!result.pendingApproval) {
      return res.status(201).json({
        success: true,
        currentPlayers: session.currentPlayers,
        status: session.status,
        chargeId: result.charge._id,
        creditApplied: result.creditApplied,
      });
    }

    res.status(201).json({
      success: true,
      status: "pending_approval",
      chargeId: result.charge._id,
      creditApplied: result.creditApplied,
      remaining: result.remaining,
      currentPlayers: session.currentPlayers,
      sessionStatus: session.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payment + participant-creation core of a member join, shared by the direct
// join route above and the fixed-doubles partner-invite-accept flow below —
// both need a member to go through the identical fee/credit/proof rules.
// Caller is responsible for pre-checks (duplicate join, skill band, capacity/
// waitlist) — this only handles "charge them and create the participant."
async function joinSessionAsParticipant({ session, memberId, paymentMethod, paymentScreenshot, useCredit }) {
  const validMemberMethods = ["GCash", "Bank Transfer", "GoTyme"];
  if (paymentScreenshot && !String(paymentScreenshot).startsWith("https://")) {
    return { error: "paymentScreenshot must be a secure HTTPS URL", status: 400 };
  }
  if (paymentMethod && !validMemberMethods.includes(paymentMethod)) {
    return { error: "Invalid paymentMethod", status: 400 };
  }

  const [user, club] = await Promise.all([
    User.findById(memberId).select("name").lean(),
    Club.findById(session.clubId).select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayCreditsEnabled").lean(),
  ]);

  const hasPaymentProof = !!(paymentScreenshot && paymentMethod);
  const breakdown = await computeMemberFeeAndCredit({ session, club, memberId, baseFee: session.feePerPlayer, useCredit });
  const { creditApplied, remaining } = breakdown;

  if (remaining > 0 && !hasPaymentProof) {
    return { error: "Payment is required to join this session", status: 400, remaining, creditApplied };
  }

  if (remaining > 0 && hasPaymentProof) {
    const pendingCharge = await Charge.findOne({
      hostedPlayId: session._id,
      playerId: memberId,
      approvalStatus: "pending",
    }).lean();
    if (pendingCharge) return { error: "You already have a pending payment for this session awaiting approval", status: 400 };
  }

  const charge = await chargeMemberForSession({ session, memberId, breakdown, paymentMethod, paymentScreenshot });
  const pendingApproval = remaining > 0;

  const participant = await HostedPlayParticipant.create({
    hostedPlayId: session._id,
    clubId: session.clubId,
    memberId,
    memberName: user?.name ?? "Member",
    chargeId: charge._id,
    ...(pendingApproval
      ? { waitStatus: "pending_payment", offerExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
      : {}),
  });

  session.currentPlayers += 1;
  if (session.currentPlayers >= session.maxPlayers) session.status = "full";
  await session.save();

  sendPushToClubAdmins(session.clubId, pendingApproval
    ? { title: "Hosted Play payment pending", body: `${user?.name ?? "A member"} submitted payment for "${session.title}". Please review and approve.` }
    : { title: "Hosted Play join", body: `${user?.name ?? "A member"} joined "${session.title}".` });

  return { participant, charge, creditApplied, remaining, pendingApproval };
}

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

// Only meaningful when queueMode === "fixed_doubles_rotation". Returns
// { fixedDoubles } on success or { error } — maxPlayers must exactly cover
// pairCount pairs (2 players each) since this format has no individual seats.
// matchDurationMinutes is NOT collected here — it's auto-computed at schedule
// generation time from the session's start/end window and the actual number
// of confirmed pairs (see fixedDoubles.computeMatchDuration), since the real
// pair count is only known then, not at session creation.
function normalizeFixedDoubles(queueMode, input, maxPlayers) {
  if (queueMode !== "fixed_doubles_rotation") return { fixedDoubles: undefined };
  const pairCount = Number(input?.pairCount);
  if (!Number.isInteger(pairCount) || pairCount < 2) {
    return { error: "Number of pairs must be at least 2" };
  }
  if (Number(maxPlayers) !== pairCount * 2) {
    return { error: "Maximum players must equal number of pairs × 2 for Fixed Doubles Rotation" };
  }
  const restBetweenMatchesMinutes = Math.max(0, Number(input?.restBetweenMatchesMinutes ?? 0) || 0);
  return { fixedDoubles: { pairCount, restBetweenMatchesMinutes } };
}

// POST /api/hosted-play/sessions
router.post("/sessions", auth, admin, async (req, res) => {
  try {
    const {
      title, sport, date, startTime, endTime, venue, court, address,
      feePerPlayer, sessionFee, guestFeePerPlayer, maxPlayers, maxGuests, description,
      numberOfCourts, playersPerCourt, queueMode, fixedDoubles: fixedDoublesInput,
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
    const normFixedDoubles = normalizeFixedDoubles(queueMode, fixedDoublesInput, maxPlayers);
    if (normFixedDoubles.error) return res.status(400).json({ error: normFixedDoubles.error });

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
      ...(normFixedDoubles.fixedDoubles ? { fixedDoubles: normFixedDoubles.fixedDoubles } : {}),
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
      numberOfCourts, playersPerCourt, queueMode, fixedDoubles: fixedDoublesInput,
      minSkillLevel, maxSkillLevel, scoreTarget, winByTwo,
    } = req.body;
    if (scoreTarget !== undefined && scoreTarget !== null && scoreTarget !== "" && !VALID_SCORE_TARGETS.includes(Number(scoreTarget))) {
      return res.status(400).json({ error: "scoreTarget must be 11, 15, or 21" });
    }

    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const effectiveQueueMode = queueMode !== undefined ? queueMode : session.queueMode;
    if (effectiveQueueMode === "fixed_doubles_rotation" && (fixedDoublesInput !== undefined || queueMode !== undefined)) {
      const effectiveMaxPlayers = maxPlayers !== undefined ? Number(maxPlayers) : session.maxPlayers;
      const normFixedDoubles = normalizeFixedDoubles(
        effectiveQueueMode,
        fixedDoublesInput || session.fixedDoubles,
        effectiveMaxPlayers,
      );
      if (normFixedDoubles.error) return res.status(400).json({ error: normFixedDoubles.error });
      if (normFixedDoubles.fixedDoubles) session.fixedDoubles = normFixedDoubles.fixedDoubles;
    }

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

// GET /api/hosted-play/sessions/:id/refund-preview — paid participants + amounts
// for the admin "Cancel Session" refund modal, read-only.
router.get("/sessions/:id/refund-preview", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const [participants, club] = await Promise.all([
      HostedPlayParticipant.find({ hostedPlayId: session._id, chargeId: { $ne: null } })
        .populate({ path: "chargeId", match: { status: "paid" } })
        .populate("memberId", "name email")
        .lean(),
      Club.findById(session.clubId).select("hostedPlayCreditsEnabled").lean(),
    ]);

    const rows = participants
      .filter((p) => p.chargeId)
      .map((p) => {
        const charge = p.chargeId;
        const convenienceFee = charge.breakdown?.convenienceFee || 0;
        return {
          participantId: p._id,
          chargeId: charge._id,
          playerId: p.memberId ? p.memberId._id : null,
          isGuest: !p.memberId,
          name: p.memberId?.name || p.memberName || p.guestEmail || "Guest",
          amountPaid: charge.amount,
          convenienceFee,
          suggestedRefund: Math.max(0, charge.amount - convenienceFee),
          creditApplied: charge.creditApplied,
          paymentMethod: charge.paymentMethod,
        };
      });

    res.json({
      session: { _id: session._id, title: session.title, status: session.status },
      creditsEnabled: club?.hostedPlayCreditsEnabled !== false,
      rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/cancel-with-refunds — cancel a session,
// granting each paid participant admin-reviewed credit back and waiving any
// still-unpaid charges. Refund amounts are never trusted verbatim from the
// client: charges are re-fetched by id/status and each amount is clamped to
// what was actually paid.
router.post("/sessions/:id/cancel-with-refunds", auth, admin, async (req, res) => {
  try {
    const { refunds } = req.body;
    if (!Array.isArray(refunds)) return res.status(400).json({ error: "refunds must be an array" });

    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "cancelled") return res.status(400).json({ error: "Session already cancelled" });
    if (session.status === "completed") return res.status(400).json({ error: "Cannot cancel a completed session" });

    const club = await Club.findById(session.clubId).select("hostedPlayCreditsEnabled").lean();
    const creditsEnabled = club?.hostedPlayCreditsEnabled !== false;
    if (!creditsEnabled && refunds.length > 0) {
      return res.status(400).json({ error: "Hosted Play credits are disabled for this club" });
    }

    for (const r of refunds) {
      if (!r.chargeId || !r.playerId) return res.status(400).json({ error: "chargeId and playerId are required per refund row" });
      if (!(Number(r.amount) >= 0)) return res.status(400).json({ error: "refund amount must be a non-negative number" });
    }

    const chargeIds = refunds.map((r) => r.chargeId);
    const charges = await Charge.find({
      _id: { $in: chargeIds }, hostedPlayId: session._id, chargeType: "hosted_play", status: "paid",
    });
    const chargeById = new Map(charges.map((c) => [String(c._id), c]));

    const grantedBy = req.user.userId;
    const refunded = [];
    for (const r of refunds) {
      const charge = chargeById.get(String(r.chargeId));
      if (!charge) continue;
      const amount = Math.min(Number(r.amount), charge.amount);
      if (amount > 0) {
        await refundCredit({
          clubId: session.clubId,
          playerId: r.playerId,
          amount,
          chargeId: charge._id,
          grantedBy,
          reason: `Hosted Play cancelled: ${session.title}`,
        });
      }
      refunded.push({ chargeId: charge._id, playerId: r.playerId, amount });
    }

    await Charge.deleteMany({ hostedPlayId: session._id, chargeType: "hosted_play", status: "unpaid" });

    session.status = "cancelled";
    await session.save();

    for (const r of refunded) {
      if (r.amount > 0) {
        sendPushToUser(r.playerId, {
          title: "Session Cancelled — Credit Issued",
          body: `${session.title} was cancelled. ₱${r.amount.toLocaleString()} was added to your account credit.`,
          url: "/player/payments",
          tag: "hosted-play-cancel-refund",
        }).catch(() => {});
      }
    }

    res.json({ session, refunded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/hosted-play/sessions/:id/status — manual close / reopen / complete.
// Cancellation goes through POST /sessions/:id/cancel-with-refunds instead, so
// paid participants are never silently left un-refunded.
router.patch("/sessions/:id/status", auth, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["open", "full", "closed", "cancelled", "completed"];
    if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });
    if (status === "cancelled") {
      return res.status(400).json({ error: "Use POST /sessions/:id/cancel-with-refunds to cancel a session" });
    }

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

    // Split Session Fee sessions bill their joined members exactly once, the
    // first time they're marked completed. Same for per_session convenience fee.
    if (status === "completed" && !wasCompleted) {
      const club = await Club.findById(session.clubId)
        .select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayConvenienceFeeAmount hostedPlayCreditsEnabled")
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

// GET /api/hosted-play/sessions/:id/waitlist — pre-session waitlist (waitlisted + offered).
// Scoped separately from /participants: the live queue is deliberately blind to these
// (see ACTIVE_PARTICIPANT), so this is the only place an admin can see who's waiting.
router.get("/sessions/:id/waitlist", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const entries = await HostedPlayParticipant.find({
      hostedPlayId: session._id,
      waitStatus: { $in: ["waitlisted", "offered"] },
    }).sort({ waitlistOrder: 1 }).lean();

    res.json(entries.map((e, i) => ({
      _id: e._id,
      memberName: e.memberName,
      waitStatus: e.waitStatus,
      position: i + 1,
      offerExpiresAt: e.offerExpiresAt ?? null,
      createdAt: e.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/waitlist/:pid/promote — admin manually moves a
// waitlisted/offered member straight into the session, bypassing the claim window.
// Mirrors joinSessionAsParticipant's billing so a promoted member is charged the same
// way a direct join would be.
router.post("/sessions/:id/waitlist/:pid/promote", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (["cancelled", "completed"].includes(session.status)) {
      return res.status(400).json({ error: "This session can no longer be changed" });
    }

    const participant = await HostedPlayParticipant.findOne({ _id: req.params.pid, hostedPlayId: session._id });
    if (!participant) return res.status(404).json({ error: "Waitlist entry not found" });
    if (!["waitlisted", "offered"].includes(participant.waitStatus)) {
      return res.status(400).json({ error: "This member is not on the waitlist" });
    }

    if (session.feeSplitMode === "split_total") {
      // Split Session Fee sessions bill everyone once at completion — no charge now.
      participant.waitStatus = "active";
      participant.offerExpiresAt = null;
      await participant.save();
    } else {
      const club = await Club.findById(session.clubId)
        .select("hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayCreditsEnabled").lean();
      const breakdown = await computeMemberFeeAndCredit({
        session, club, memberId: participant.memberId, baseFee: session.feePerPlayer,
      });
      if (breakdown.amount > 0) {
        const charge = await chargeMemberForSession({ session, memberId: participant.memberId, breakdown });
        participant.chargeId = charge._id;
      }
      participant.waitStatus = "active";
      participant.offerExpiresAt = null;
      await participant.save();
    }

    session.currentPlayers += 1;
    if (session.currentPlayers >= session.maxPlayers) session.status = "full";
    await session.save();

    if (participant.memberId) {
      sendPushToUser(String(participant.memberId), {
        title: "You're in! 🎾",
        body: `An admin moved you off the waitlist into "${session.title}".`,
        url: "/player/hosted-play",
        tag: `hp-promoted-${session._id}`,
      });
    }

    res.json({ success: true, currentPlayers: session.currentPlayers, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hosted-play/sessions/:id/waitlist/:pid — admin declines a waitlisted/offered
// member. Frees no real spot since they never occupied one.
router.delete("/sessions/:id/waitlist/:pid", auth, admin, async (req, res) => {
  try {
    const session = await HostedPlay.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const removed = await HostedPlayParticipant.findOneAndDelete({
      _id: req.params.pid,
      hostedPlayId: session._id,
      waitStatus: { $in: ["waitlisted", "offered"] },
    });
    if (!removed) return res.status(404).json({ error: "Waitlist entry not found" });

    res.json({ success: true });
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
    Club.findById(req.user.clubId).select("hostedPlayQueueEnabled hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayConvenienceFeeAmount hostedPlayCreditsEnabled").lean(),
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

  if (session.queueMode === "fixed_doubles_rotation") {
    const fixture = await findCurrentFixtureForCourt(session._id, courtNumber);
    return { session, club, courtNumber, kind: "fixed-schedule", fixture };
  }
  return { ...(await loadParticipantsContext(session, club)), kind: "live-queue", courtNumber };
}

// The match "currently on" a given court for umpire purposes: whichever
// fixture is in_progress there, else the earliest still-scheduled one. null
// when nothing is queued up for that court (matches "Court is empty").
async function findCurrentFixtureForCourt(hostedPlayId, courtNumber) {
  const inProgress = await HostedPlayFixture.findOne({ hostedPlayId, courtNumber, status: "in_progress" });
  if (inProgress) return inProgress;
  return HostedPlayFixture.findOne({ hostedPlayId, courtNumber, status: "scheduled" }).sort({ matchNumber: 1 });
}

// Synthesizes a QueueBoard-shaped response for a fixed-doubles fixture so the
// SAME anonymous umpire scoring page (built for the live-queue formats) works
// unchanged: one court, four players (courtSlot 1-2 = pair1, 3-4 = pair2),
// liveScore null until start-serve is called (mirrors "no liveScores entry
// yet" for that court in the live-queue system).
function toPublicUmpirePlayer(p, courtNumber, courtSlot) {
  return {
    _id: String(p.participantId),
    memberId: p.memberId ? String(p.memberId) : null,
    memberName: p.memberName || "Member",
    profileImage: null,
    isWalkIn: false,
    checkedIn: true,
    queueStatus: "playing",
    queueOrder: null,
    courtNumber,
    courtSlot,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
  };
}

function buildFixedDoublesUmpireBoard(session, club, courtNumber, fixture) {
  const players = fixture
    ? [
        ...(fixture.pair1Snapshot.players || []).map((p, i) => toPublicUmpirePlayer(p, courtNumber, i + 1)),
        ...(fixture.pair2Snapshot.players || []).map((p, i) => toPublicUmpirePlayer(p, courtNumber, i + 3)),
      ]
    : [];
  const board = {
    session: {
      _id: session._id,
      title: session.title,
      status: session.status,
      venue: session.venue,
      court: session.court,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      queueStatus: session.queueStatus,
      queueMode: session.queueMode,
      numberOfCourts: session.numberOfCourts || 1,
      playersPerCourt: 4,
      sport: session.sport,
      scoreTarget: session.scoreTarget ?? null,
      winByTwo: session.winByTwo !== undefined ? !!session.winByTwo : true,
    },
    courts: [{
      courtNumber,
      players,
      liveScore: fixture?.servingPair ? {
        team1Score: fixture.pair1Score ?? 0,
        team2Score: fixture.pair2Score ?? 0,
        servingTeam: fixture.servingPair,
        serverNumber: fixture.serverNumber ?? null,
        servingPlayerId: fixture.servingParticipantId ? String(fixture.servingParticipantId) : null,
        canUndo: !!fixture.previousLiveState,
      } : null,
    }],
    waiting: [],
    paused: [],
    nextGroup: [],
    roster: [],
    counts: { checkedIn: 0, waiting: 0, playing: players.length ? 1 : 0, paused: 0, activeGames: players.length ? 1 : 0 },
  };
  decorateBoardFees(board, club, session);
  return board;
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
    if (ctx.kind === "fixed-schedule") {
      return res.json(buildFixedDoublesUmpireBoard(ctx.session, ctx.club, ctx.courtNumber, ctx.fixture));
    }
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
    const team = Number(req.body.team);
    const playerId = req.body.playerId ? String(req.body.playerId) : "";
    if (ctx.kind === "fixed-schedule") {
      if (!ctx.fixture) return res.status(400).json({ error: "Court is empty" });
      const patch = fixedDoubles.startFixtureServe({ fixture: ctx.fixture, pair: team, participantId: playerId });
      if (patch.error) return res.status(400).json({ error: patch.error });
      Object.assign(ctx.fixture, patch);
      if (ctx.fixture.status === "scheduled") {
        ctx.fixture.status = "in_progress";
        ctx.fixture.actualStart = new Date();
      }
      await ctx.fixture.save();
      return res.json(buildFixedDoublesUmpireBoard(ctx.session, ctx.club, ctx.courtNumber, ctx.fixture));
    }

    const courtNumber = Number(req.params.n);
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
    const playerId = req.body.playerId ? String(req.body.playerId) : "";
    if (ctx.kind === "fixed-schedule") {
      if (!ctx.fixture) return res.status(400).json({ error: "Court is empty" });
      const patch = fixedDoubles.setFixtureServer({ fixture: ctx.fixture, participantId: playerId });
      if (patch.error) return res.status(400).json({ error: patch.error });
      Object.assign(ctx.fixture, patch);
      await ctx.fixture.save();
      return res.json(buildFixedDoublesUmpireBoard(ctx.session, ctx.club, ctx.courtNumber, ctx.fixture));
    }

    const courtNumber = Number(req.params.n);
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
    const team = Number(req.body.team);
    if (![1, 2].includes(team)) {
      return res.status(400).json({ error: "Invalid team" });
    }
    if (ctx.kind === "fixed-schedule") {
      if (!ctx.fixture) return res.status(400).json({ error: "Court is empty" });
      const patch = fixedDoubles.fixtureRallyWon({ fixture: ctx.fixture, pair: team });
      if (patch.error) return res.status(400).json({ error: patch.error });
      Object.assign(ctx.fixture, patch);
      await ctx.fixture.save();
      return res.json(buildFixedDoublesUmpireBoard(ctx.session, ctx.club, ctx.courtNumber, ctx.fixture));
    }

    const courtNumber = Number(req.params.n);
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
    if (ctx.kind === "fixed-schedule") {
      if (!ctx.fixture) return res.status(400).json({ error: "Court is empty" });
      const patch = fixedDoubles.undoFixtureLiveState(ctx.fixture);
      if (patch.error) return res.status(400).json({ error: patch.error });
      Object.assign(ctx.fixture, patch);
      await ctx.fixture.save();
      return res.json(buildFixedDoublesUmpireBoard(ctx.session, ctx.club, ctx.courtNumber, ctx.fixture));
    }

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
    if (ctx.kind === "fixed-schedule") {
      if (!ctx.fixture) return res.status(400).json({ error: "Court is empty" });
      const pair1Score = ctx.fixture.pair1Score || 0;
      const pair2Score = ctx.fixture.pair2Score || 0;
      if (!ctx.fixture.servingPair || (pair1Score === 0 && pair2Score === 0)) {
        return res.status(400).json({ error: "No score recorded yet" });
      }
      if (pair1Score === pair2Score) {
        return res.status(400).json({ error: "Scores are tied — enter the final point before finishing" });
      }
      const winnerPairId = pair1Score > pair2Score ? String(ctx.fixture.pair1Id) : String(ctx.fixture.pair2Id);
      await finishFixtureAndRecordMatch(ctx.session, ctx.fixture, {
        pair1Score, pair2Score, winnerPairId, winnerSource: "scores", recordedBy: ctx.session.createdBy,
      });
      // The court may already have a next scheduled match lined up.
      const next = await findCurrentFixtureForCourt(ctx.session._id, ctx.courtNumber);
      return res.json(buildFixedDoublesUmpireBoard(ctx.session, ctx.club, ctx.courtNumber, next));
    }

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
// Mutates `match`'s team1Score/team2Score/winnerTeam/winnerSource in place per
// the correction rules; returns {} on success or {error}. Caller saves.
function correctMatchScore(match, body) {
  // Both explicitly null clears the scores (and a score-derived winner).
  if (body.team1Score === null && body.team2Score === null) {
    match.team1Score = null;
    match.team2Score = null;
    if (match.winnerSource === "scores") {
      match.winnerTeam = null;
      match.winnerSource = null;
    }
    return {};
  }
  const scores = parseMatchScores(body);
  if (!scores || scores.error) return { error: scores?.error || "Both scores are required" };

  if (match.winnerSource === "tapped") {
    // The tapped winner is authoritative — scores must agree.
    const winnerScore = match.winnerTeam === 1 ? scores.team1Score : scores.team2Score;
    const loserScore = match.winnerTeam === 1 ? scores.team2Score : scores.team1Score;
    if (winnerScore <= loserScore) return { error: "Scores contradict the recorded winner" };
  } else {
    match.winnerTeam = scores.team1Score === scores.team2Score ? null : scores.team1Score > scores.team2Score ? 1 : 2;
    match.winnerSource = match.winnerTeam ? "scores" : null;
  }
  match.team1Score = scores.team1Score;
  match.team2Score = scores.team2Score;
  return {};
}

router.patch("/matches/:matchId/score", auth, admin, async (req, res) => {
  try {
    const match = await HostedPlayMatch.findOne({ _id: req.params.matchId, clubId: req.user.clubId });
    if (!match) return res.status(404).json({ error: "Match not found" });

    const result = correctMatchScore(match, req.body);
    if (result.error) return res.status(400).json({ error: result.error });

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

// ── Fixed Doubles Rotation (admin + player; requires club.hostedPlayQueueEnabled) ──
// Structurally separate from queue-engine.js: a complete round-robin schedule
// is generated upfront for fixed pairs, rather than players dynamically
// rotating through open courts. See services/fixed-doubles-engine.js and
// services/hosted-play-format-registry.js for the architecture note.

// Load a session scoped to clubId and confirm it's using this format and the
// club has Queue Management enabled (same gate the other formats use).
// Returns a full mongoose document (not .lean()) so callers can session.save().
async function loadFixedDoublesSession(sessionId, clubId) {
  const [session, club] = await Promise.all([
    HostedPlay.findOne({ _id: sessionId, clubId }),
    Club.findById(clubId)
      .select("hostedPlayQueueEnabled hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode hostedPlayConvenienceFeeAmount logo courts")
      .lean(),
  ]);
  if (!session) return { error: "Session not found", status: 404 };
  if (session.queueMode !== "fixed_doubles_rotation") {
    return { error: "This session is not using Fixed Doubles Rotation", status: 400 };
  }
  const allowed = session.queueManagementEnabled ?? !!club?.hostedPlayQueueEnabled;
  if (!allowed) return { error: "Queue Management is not enabled for this session", status: 403 };
  return { session, club };
}

function combineDateTime(date, timeStr) {
  const d = new Date(date);
  const [h, m] = String(timeStr || "0:0").split(":").map(Number);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

async function findExistingPairForParticipant(hostedPlayId, participantId, excludePairId = null) {
  return HostedPlayPair.findOne({
    hostedPlayId,
    status: { $in: ["pending_partner", "confirmed"] },
    ...(excludePairId ? { _id: { $ne: excludePairId } } : {}),
    $or: [{ participantAId: participantId }, { participantBId: participantId }],
  }).lean();
}

function countActivePairs(hostedPlayId) {
  return HostedPlayPair.countDocuments({ hostedPlayId, status: { $in: ["pending_partner", "confirmed"] } });
}

async function respondFixedDoublesBoard(res, session, club, extra = null) {
  const pairs = await HostedPlayPair.find({ hostedPlayId: session._id, status: { $ne: "withdrawn" } })
    .sort({ createdAt: 1 })
    .lean();
  const fixtures = await HostedPlayFixture.find({ hostedPlayId: session._id }).lean();
  const board = fixedDoubles.buildBoard(session, pairs, fixtures);
  if (club) decorateBoardFees(board, club, session);
  res.json(extra ? { ...board, ...extra } : board);
}

// Marks a fixture completed and mirrors it into HostedPlayMatch (club-wide
// history/standings). Shared by the admin "Record Score" route (tapped/typed
// scores) and the anonymous umpire finish route (winner always score-derived) —
// each resolves its own winner before calling this. Saves the fixture.
async function finishFixtureAndRecordMatch(session, fixture, { pair1Score, pair2Score, winnerPairId, winnerSource, recordedBy }) {
  fixture.status = "completed";
  fixture.actualStart = fixture.actualStart || fixture.scheduledStart;
  fixture.actualEnd = new Date();
  fixture.pair1Score = pair1Score;
  fixture.pair2Score = pair2Score;
  fixture.winnerPairId = winnerPairId;
  fixture.winnerSource = winnerSource;
  fixture.recordedBy = recordedBy;
  fixture.scoreEnteredBy = recordedBy;
  fixture.scoreEnteredAt = new Date();
  // Clear umpire live-scoring transient state now that the match is over.
  fixture.servingPair = null;
  fixture.serverNumber = null;
  fixture.servingParticipantId = null;
  fixture.pair1RightParticipantId = null;
  fixture.pair2RightParticipantId = null;
  fixture.previousLiveState = null;

  const toMatchPlayers = (snapshot) => (snapshot.players || []).map((pl) => ({
    participantId: pl.participantId,
    memberId: pl.memberId ?? null,
    memberName: pl.memberName ?? "",
    isWalkIn: false,
  }));
  try {
    const match = await HostedPlayMatch.create({
      sessionId: session._id,
      clubId: session.clubId,
      sport: session.sport,
      queueMode: session.queueMode,
      courtNumber: fixture.courtNumber,
      team1: toMatchPlayers(fixture.pair1Snapshot),
      team2: toMatchPlayers(fixture.pair2Snapshot),
      team1Score: pair1Score,
      team2Score: pair2Score,
      winnerTeam: String(winnerPairId) === String(fixture.pair1Id) ? 1 : 2,
      winnerSource,
      finishedAt: new Date(),
      recordedBy,
      scoreEnteredBy: recordedBy,
      scoreEnteredAt: new Date(),
    });
    fixture.matchRecordId = match._id;
  } catch (e) {
    console.error("hosted-play: failed to record fixed-doubles match", e);
  }

  await fixture.save();
}

// ── Pairs / registration ─────────────────────────────────────────────────────

// GET /api/hosted-play/sessions/:id/pairs (admin) / player/sessions/:id/pairs
async function listPairs(req, res, clubId) {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    const pairs = await HostedPlayPair.find({ hostedPlayId: ctx.session._id, status: { $ne: "withdrawn" } })
      .sort({ createdAt: 1 })
      .lean();
    res.json(pairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
router.get("/sessions/:id/pairs", auth, admin, (req, res) => listPairs(req, res, req.user.clubId));
router.get("/player/sessions/:id/pairs", auth, (req, res) => listPairs(req, res, req.user.clubId));

// POST /api/hosted-play/sessions/:id/pairs — Method 2: organizer manually
// pairs two already-registered/walked-in participants.
router.post("/sessions/:id/pairs", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const { participantAId, participantBId, pairLabel } = req.body;
    if (!participantAId || !participantBId) return res.status(400).json({ error: "Both players are required" });
    if (String(participantAId) === String(participantBId)) return res.status(400).json({ error: "Choose two different players" });

    const participants = await HostedPlayParticipant.find({
      _id: { $in: [participantAId, participantBId] },
      hostedPlayId: ctx.session._id,
      ...ACTIVE_PARTICIPANT,
    }).lean();
    if (participants.length !== 2) return res.status(400).json({ error: "Both players must be active participants in this session" });

    for (const pid of [participantAId, participantBId]) {
      if (await findExistingPairForParticipant(ctx.session._id, pid)) {
        return res.status(400).json({ error: "One of these players is already paired or has a pending invite" });
      }
    }

    const activeCount = await countActivePairs(ctx.session._id);
    if (ctx.session.fixedDoubles?.pairCount && activeCount >= ctx.session.fixedDoubles.pairCount) {
      return res.status(400).json({ error: "All pair spots are filled for this session" });
    }

    const pair = await HostedPlayPair.create({
      hostedPlayId: ctx.session._id,
      clubId: ctx.session.clubId,
      pairLabel: (pairLabel || `Pair ${activeCount + 1}`).trim(),
      participantAId,
      participantBId,
      status: "confirmed",
      source: "organizer_assigned",
    });
    res.status(201).json(pair.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/pairs/invite — Method 1 step 1
router.post("/sessions/:id/pairs/invite", auth, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!["open", "full"].includes(ctx.session.status)) {
      return res.status(400).json({ error: "This session is no longer open for registration" });
    }

    const partnerMemberId = req.body.partnerMemberId;
    if (!partnerMemberId) return res.status(400).json({ error: "partnerMemberId is required" });
    if (String(partnerMemberId) === String(req.user.userId)) return res.status(400).json({ error: "You can't invite yourself" });

    const requesterParticipant = await HostedPlayParticipant.findOne({
      hostedPlayId: ctx.session._id,
      memberId: req.user.userId,
      ...ACTIVE_PARTICIPANT,
    }).lean();
    if (!requesterParticipant) return res.status(400).json({ error: "Join the session before inviting a partner" });
    if (await findExistingPairForParticipant(ctx.session._id, requesterParticipant._id)) {
      return res.status(400).json({ error: "You're already paired or have a pending invite" });
    }

    const partnerParticipant = await HostedPlayParticipant.findOne({
      hostedPlayId: ctx.session._id,
      memberId: partnerMemberId,
      ...ACTIVE_PARTICIPANT,
    }).lean();
    if (partnerParticipant && (await findExistingPairForParticipant(ctx.session._id, partnerParticipant._id))) {
      return res.status(400).json({ error: "That player is already paired or has a pending invite" });
    }

    const activeCount = await countActivePairs(ctx.session._id);
    if (ctx.session.fixedDoubles?.pairCount && activeCount >= ctx.session.fixedDoubles.pairCount) {
      return res.status(400).json({ error: "All pair spots are filled for this session" });
    }

    const pair = await HostedPlayPair.create({
      hostedPlayId: ctx.session._id,
      clubId: ctx.session.clubId,
      participantAId: requesterParticipant._id,
      invitedMemberId: partnerMemberId,
      inviteStatus: "pending",
      invitedAt: new Date(),
      status: "pending_partner",
      source: "player_invite",
    });

    const inviter = await User.findById(req.user.userId).select("name").lean();
    sendPushToUser(String(partnerMemberId), {
      title: "Doubles partner invite 🎾",
      body: `${inviter?.name ?? "A member"} invited you to team up for "${ctx.session.title}".`,
      url: `/player/hosted-play/${ctx.session._id}`,
      tag: `hp-pair-invite-${pair._id}`,
    });

    res.status(201).json(pair.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/pairs/:pairId/respond — invitee accepts/declines
router.post("/sessions/:id/pairs/:pairId/respond", auth, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const pair = await HostedPlayPair.findOne({ _id: req.params.pairId, hostedPlayId: ctx.session._id });
    if (!pair) return res.status(404).json({ error: "Invite not found" });
    if (String(pair.invitedMemberId) !== String(req.user.userId)) return res.status(403).json({ error: "This invite is not yours to respond to" });
    if (pair.inviteStatus !== "pending") return res.status(400).json({ error: "This invite is no longer pending" });

    if (!req.body.accept) {
      pair.inviteStatus = "declined";
      pair.status = "withdrawn";
      pair.inviteRespondedAt = new Date();
      await pair.save();
      return res.json(pair.toObject());
    }

    let participant = await HostedPlayParticipant.findOne({
      hostedPlayId: ctx.session._id,
      memberId: req.user.userId,
      ...ACTIVE_PARTICIPANT,
    }).lean();

    if (!participant) {
      if (ctx.session.currentPlayers >= ctx.session.maxPlayers) {
        return res.status(400).json({ error: "This session is full — no spots left for a partner" });
      }
      const me = await User.findById(req.user.userId).select("skillLevel").lean();
      const bandErr = skillBandError(ctx.session, me?.skillLevel || "novice");
      if (bandErr) return res.status(403).json({ error: bandErr });

      const { paymentMethod, paymentScreenshot, useCredit } = req.body;
      const result = await joinSessionAsParticipant({ session: ctx.session, memberId: req.user.userId, paymentMethod, paymentScreenshot, useCredit });
      if (result.error) {
        return res.status(result.status || 400).json({ error: result.error, remaining: result.remaining, creditApplied: result.creditApplied });
      }
      participant = result.participant.toObject();
    }

    pair.participantBId = participant._id;
    pair.inviteStatus = "accepted";
    pair.inviteRespondedAt = new Date();
    pair.status = "confirmed";
    await pair.save();
    res.json(pair.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hosted-play/sessions/:id/pairs/:pairId/invite — inviter cancels a pending invite
router.delete("/sessions/:id/pairs/:pairId/invite", auth, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const pair = await HostedPlayPair.findOne({ _id: req.params.pairId, hostedPlayId: ctx.session._id });
    if (!pair) return res.status(404).json({ error: "Invite not found" });
    const inviterParticipant = await HostedPlayParticipant.findById(pair.participantAId).select("memberId").lean();
    if (!inviterParticipant || String(inviterParticipant.memberId) !== String(req.user.userId)) {
      return res.status(403).json({ error: "This invite is not yours to cancel" });
    }
    if (pair.inviteStatus !== "pending") return res.status(400).json({ error: "This invite is no longer pending" });

    await HostedPlayPair.deleteOne({ _id: pair._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/hosted-play/sessions/:id/pairs/:pairId — Edit Teams (admin, pre-lock only)
router.patch("/sessions/:id/pairs/:pairId", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const fixtures = await HostedPlayFixture.find({ hostedPlayId: ctx.session._id }).select("status").lean();
    if (fixtures.length && fixedDoubles.isLocked(fixtures)) {
      return res.status(409).json({ error: "Teams are locked — a match has already started" });
    }

    const pair = await HostedPlayPair.findOne({ _id: req.params.pairId, hostedPlayId: ctx.session._id });
    if (!pair) return res.status(404).json({ error: "Pair not found" });

    const { participantAId, participantBId, pairLabel } = req.body;
    for (const [field, value] of [["participantAId", participantAId], ["participantBId", participantBId]]) {
      if (value === undefined) continue;
      const p = await HostedPlayParticipant.findOne({ _id: value, hostedPlayId: ctx.session._id, ...ACTIVE_PARTICIPANT }).lean();
      if (!p) return res.status(400).json({ error: "Selected player is not an active participant in this session" });
      if (await findExistingPairForParticipant(ctx.session._id, value, pair._id)) {
        return res.status(400).json({ error: "Selected player is already paired elsewhere" });
      }
      pair[field] = value;
    }
    if (pairLabel !== undefined) pair.pairLabel = String(pairLabel).trim();
    if (pair.participantAId && pair.participantBId) pair.status = "confirmed";
    await pair.save();

    ctx.session.fixedDoubles.pairsUpdatedAt = new Date();
    await ctx.session.save();
    res.json(pair.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/pairs/swap-players — Swap Players (admin, pre-lock only)
router.post("/sessions/:id/pairs/swap-players", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const fixtures = await HostedPlayFixture.find({ hostedPlayId: ctx.session._id }).select("status").lean();
    if (fixtures.length && fixedDoubles.isLocked(fixtures)) {
      return res.status(409).json({ error: "Teams are locked — a match has already started" });
    }

    const { pairAId, slotA, pairBId, slotB } = req.body;
    if (!pairAId || !pairBId || String(pairAId) === String(pairBId)) {
      return res.status(400).json({ error: "Choose two different pairs" });
    }
    const [pairA, pairB] = await Promise.all([
      HostedPlayPair.findOne({ _id: pairAId, hostedPlayId: ctx.session._id }),
      HostedPlayPair.findOne({ _id: pairBId, hostedPlayId: ctx.session._id }),
    ]);
    if (!pairA || !pairB) return res.status(404).json({ error: "Pair not found" });

    const fieldA = slotA === "B" ? "participantBId" : "participantAId";
    const fieldB = slotB === "B" ? "participantBId" : "participantAId";
    const tmp = pairA[fieldA];
    pairA[fieldA] = pairB[fieldB];
    pairB[fieldB] = tmp;
    await Promise.all([pairA.save(), pairB.save()]);

    ctx.session.fixedDoubles.pairsUpdatedAt = new Date();
    await ctx.session.save();
    res.json({ pairA: pairA.toObject(), pairB: pairB.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hosted-play/sessions/:id/pairs/:pairId — withdraw a pair (admin, pre-lock only)
router.delete("/sessions/:id/pairs/:pairId", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const fixtures = await HostedPlayFixture.find({ hostedPlayId: ctx.session._id }).select("status").lean();
    if (fixtures.length && fixedDoubles.isLocked(fixtures)) {
      return res.status(409).json({ error: "Teams are locked — a match has already started" });
    }

    const pair = await HostedPlayPair.findOneAndUpdate(
      { _id: req.params.pairId, hostedPlayId: ctx.session._id },
      { $set: { status: "withdrawn" } },
      { new: true },
    );
    if (!pair) return res.status(404).json({ error: "Pair not found" });

    ctx.session.fixedDoubles.pairsUpdatedAt = new Date();
    await ctx.session.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Schedule / live match queue ──────────────────────────────────────────────

// POST /api/hosted-play/sessions/:id/fixed-doubles/generate-schedule — Generate & Regenerate
router.post("/sessions/:id/fixed-doubles/generate-schedule", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const existingFixtures = await HostedPlayFixture.find({ hostedPlayId: ctx.session._id }).select("status").lean();
    if (existingFixtures.length && fixedDoubles.isLocked(existingFixtures)) {
      return res.status(409).json({ error: "Schedule is locked — a match has already started" });
    }

    const pairs = await HostedPlayPair.find({ hostedPlayId: ctx.session._id, status: "confirmed" }).lean();
    if (pairs.length < 2) return res.status(400).json({ error: "At least 2 confirmed pairs are required to generate a schedule" });

    const participantIds = pairs.flatMap((p) => [p.participantAId, p.participantBId]);
    const participants = await HostedPlayParticipant.find({ _id: { $in: participantIds } }).select("memberId memberName").lean();
    const participantsById = new Map(participants.map((p) => [String(p._id), p]));
    const pairsById = new Map(pairs.map((p) => [String(p._id), p]));
    const buildSnapshot = (pairId) => {
      const pair = pairsById.get(String(pairId));
      const players = [pair.participantAId, pair.participantBId].filter(Boolean).map((pid) => {
        const part = participantsById.get(String(pid));
        return { participantId: pid, memberId: part?.memberId ?? null, memberName: part?.memberName ?? "" };
      });
      return { pairId: pair._id, pairLabel: pair.pairLabel || "", players };
    };

    const { rounds } = fixedDoubles.generateRoundRobin(pairs.map((p) => p._id));
    const sessionStart = combineDateTime(ctx.session.date, ctx.session.startTime);
    const sessionEnd = combineDateTime(ctx.session.date, ctx.session.endTime);
    const numberOfCourts = ctx.session.numberOfCourts || 1;
    const restBetweenMatchesMinutes = ctx.session.fixedDoubles.restBetweenMatchesMinutes || 0;
    // Auto-fit the match duration to the session's actual time window and the
    // real confirmed pair count — not a value the organizer had to guess.
    const matchDurationMinutes = fixedDoubles.computeMatchDuration({
      pairCount: pairs.length, numberOfCourts, sessionStart, sessionEnd, restBetweenMatchesMinutes,
    });
    const { fixtures: mapped, warnings } = fixedDoubles.mapScheduleToCourtsAndTimes({
      rounds,
      numberOfCourts,
      matchDurationMinutes,
      restBetweenMatchesMinutes,
      sessionStart,
      sessionEnd,
    });

    ctx.session.fixedDoubles.matchDurationMinutes = matchDurationMinutes;
    const batch = (ctx.session.fixedDoubles.scheduleGenerationBatch || 0) + 1;
    await HostedPlayFixture.deleteMany({ hostedPlayId: ctx.session._id });
    await HostedPlayFixture.insertMany(
      mapped.map((f) => ({
        hostedPlayId: ctx.session._id,
        clubId: ctx.session.clubId,
        matchNumber: f.matchNumber,
        roundNumber: f.roundNumber,
        pair1Id: f.pair1Id,
        pair2Id: f.pair2Id,
        pair1Snapshot: buildSnapshot(f.pair1Id),
        pair2Snapshot: buildSnapshot(f.pair2Id),
        courtNumber: f.courtNumber,
        scheduledStart: f.scheduledStart,
        scheduledEnd: f.scheduledEnd,
        generationBatch: batch,
      })),
    );

    ctx.session.fixedDoubles.scheduleGeneratedAt = new Date();
    ctx.session.fixedDoubles.scheduleGenerationBatch = batch;
    await ctx.session.save();

    await respondFixedDoublesBoard(res, ctx.session, ctx.club, { warnings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hosted-play/sessions/:id/fixed-doubles/board (admin) / player/.../board
async function getFixedDoublesBoard(req, res, clubId) {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    await respondFixedDoublesBoard(res, ctx.session, ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
router.get("/sessions/:id/fixed-doubles/board", auth, admin, (req, res) => getFixedDoublesBoard(req, res, req.user.clubId));
router.get("/player/sessions/:id/fixed-doubles/board", auth, (req, res) => getFixedDoublesBoard(req, res, req.user.clubId));

// POST /api/hosted-play/sessions/:id/fixed-doubles/matches/:fixtureId/start
router.post("/sessions/:id/fixed-doubles/matches/:fixtureId/start", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const fixture = await HostedPlayFixture.findOne({ _id: req.params.fixtureId, hostedPlayId: ctx.session._id });
    if (!fixture) return res.status(404).json({ error: "Match not found" });
    if (fixture.status !== "scheduled") return res.status(400).json({ error: "This match has already started or finished" });

    fixture.status = "in_progress";
    fixture.actualStart = new Date();
    await fixture.save();

    await respondFixedDoublesBoard(res, ctx.session, ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/fixed-doubles/matches/:fixtureId/finish — Record Scores
router.post("/sessions/:id/fixed-doubles/matches/:fixtureId/finish", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const fixture = await HostedPlayFixture.findOne({ _id: req.params.fixtureId, hostedPlayId: ctx.session._id });
    if (!fixture) return res.status(404).json({ error: "Match not found" });
    if (fixture.status === "completed") return res.status(400).json({ error: "This match has already been recorded" });

    const pair1Score = Number(req.body.pair1Score);
    const pair2Score = Number(req.body.pair2Score);
    const derived = fixedDoubles.deriveFixtureWinner({
      pair1Score, pair2Score, winnerPairId: req.body.winnerPairId || null,
      pair1Id: fixture.pair1Id, pair2Id: fixture.pair2Id,
    });
    if (derived.error) return res.status(400).json({ error: derived.error });

    await finishFixtureAndRecordMatch(ctx.session, fixture, {
      pair1Score, pair2Score, winnerPairId: derived.winnerPairId, winnerSource: derived.winnerSource, recordedBy: req.user.userId,
    });
    await respondFixedDoublesBoard(res, ctx.session, ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/hosted-play/sessions/:id/fixed-doubles/matches/:fixtureId/score — Edit Scores (post-hoc)
router.patch("/sessions/:id/fixed-doubles/matches/:fixtureId/score", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const fixture = await HostedPlayFixture.findOne({ _id: req.params.fixtureId, hostedPlayId: ctx.session._id });
    if (!fixture) return res.status(404).json({ error: "Match not found" });
    if (fixture.status !== "completed") return res.status(400).json({ error: "Only completed matches can have their score corrected" });

    const pair1Score = Number(req.body.pair1Score);
    const pair2Score = Number(req.body.pair2Score);
    const tappedWinnerPairId = req.body.winnerPairId || (fixture.winnerSource === "tapped" ? fixture.winnerPairId : null);
    const derived = fixedDoubles.deriveFixtureWinner({
      pair1Score, pair2Score, winnerPairId: tappedWinnerPairId,
      pair1Id: fixture.pair1Id, pair2Id: fixture.pair2Id,
    });
    if (derived.error) return res.status(400).json({ error: derived.error });

    fixture.pair1Score = pair1Score;
    fixture.pair2Score = pair2Score;
    fixture.winnerPairId = derived.winnerPairId;
    fixture.winnerSource = derived.winnerSource;
    fixture.scoreEnteredBy = req.user.userId;
    fixture.scoreEnteredAt = new Date();
    await fixture.save();

    // Keep the mirrored club-history row in sync via the same correction rules.
    if (fixture.matchRecordId) {
      const match = await HostedPlayMatch.findById(fixture.matchRecordId);
      if (match) {
        const result = correctMatchScore(match, { team1Score: pair1Score, team2Score: pair2Score });
        if (!result.error) {
          match.scoreEnteredBy = req.user.userId;
          match.scoreEnteredAt = new Date();
          await match.save();
        }
      }
    }

    await respondFixedDoublesBoard(res, ctx.session, ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hosted-play/sessions/:id/fixed-doubles/matches/swap — Swap two
// matches' court + time slot (the pairs stay in their own fixtures; only
// which slot each one occupies changes). Unlike pairs/regenerate, this is
// NOT blocked by the roster lock — it's meant to be usable throughout the
// event. Only the two matches being swapped must not be completed yet;
// finished results are never touched.
router.post("/sessions/:id/fixed-doubles/matches/swap", auth, admin, async (req, res) => {
  try {
    const ctx = await loadFixedDoublesSession(req.params.id, req.user.clubId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const { fixtureAId, fixtureBId } = req.body;
    if (!fixtureAId || !fixtureBId || String(fixtureAId) === String(fixtureBId)) {
      return res.status(400).json({ error: "Choose two different matches" });
    }
    const [fixtureA, fixtureB] = await Promise.all([
      HostedPlayFixture.findOne({ _id: fixtureAId, hostedPlayId: ctx.session._id }),
      HostedPlayFixture.findOne({ _id: fixtureBId, hostedPlayId: ctx.session._id }),
    ]);
    if (!fixtureA || !fixtureB) return res.status(404).json({ error: "Match not found" });
    if (fixtureA.status === "completed" || fixtureB.status === "completed") {
      return res.status(400).json({ error: "Completed matches can't be swapped" });
    }

    // Proposed new slots after the swap.
    const newA = { courtNumber: fixtureB.courtNumber, scheduledStart: fixtureB.scheduledStart, scheduledEnd: fixtureB.scheduledEnd };
    const newB = { courtNumber: fixtureA.courtNumber, scheduledStart: fixtureA.scheduledStart, scheduledEnd: fixtureA.scheduledEnd };

    // Guard against double-booking a pair: swapping only touches these two
    // fixtures, so the only new conflict a swap can introduce is a pair now
    // overlapping in time with some OTHER (untouched) fixture it's also in.
    const others = await HostedPlayFixture.find({
      hostedPlayId: ctx.session._id,
      _id: { $nin: [fixtureA._id, fixtureB._id] },
      status: { $ne: "completed" },
    }).select("pair1Id pair2Id scheduledStart scheduledEnd").lean();

    const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
    const conflictFor = (pairId, slot) => others.find((f) =>
      (String(f.pair1Id) === String(pairId) || String(f.pair2Id) === String(pairId))
      && overlaps(new Date(slot.scheduledStart), new Date(slot.scheduledEnd), new Date(f.scheduledStart), new Date(f.scheduledEnd)),
    );
    const conflict = conflictFor(fixtureA.pair1Id, newA) || conflictFor(fixtureA.pair2Id, newA)
      || conflictFor(fixtureB.pair1Id, newB) || conflictFor(fixtureB.pair2Id, newB);
    if (conflict) {
      return res.status(400).json({ error: "That swap would double-book a pair — they already have another match at that time" });
    }

    fixtureA.courtNumber = newA.courtNumber;
    fixtureA.scheduledStart = newA.scheduledStart;
    fixtureA.scheduledEnd = newA.scheduledEnd;
    fixtureB.courtNumber = newB.courtNumber;
    fixtureB.scheduledStart = newB.scheduledStart;
    fixtureB.scheduledEnd = newB.scheduledEnd;
    await Promise.all([fixtureA.save(), fixtureB.save()]);

    // Match order ("Match N") reflects real scheduled time — renumber
    // everyone so it stays consistent with the new slots.
    const all = await HostedPlayFixture.find({ hostedPlayId: ctx.session._id })
      .select("_id scheduledStart courtNumber matchNumber").lean();
    const originalNumberById = new Map(all.map((f) => [String(f._id), f.matchNumber]));
    all.sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart) || a.courtNumber - b.courtNumber);
    const renumbers = all
      .map((f, i) => ({ _id: f._id, matchNumber: i + 1 }))
      .filter((f) => originalNumberById.get(String(f._id)) !== f.matchNumber);
    if (renumbers.length) {
      await HostedPlayFixture.bulkWrite(renumbers.map((f) => ({
        updateOne: { filter: { _id: f._id }, update: { $set: { matchNumber: f.matchNumber } } },
      })));
    }

    await respondFixedDoublesBoard(res, ctx.session, ctx.club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
