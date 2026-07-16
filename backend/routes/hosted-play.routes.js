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
const { resolveGuestFee, countGuests } = require("../utils/guests");
const { ownsClub } = require("../utils/scope");
const { getCreditBalance, redeemCredit, refundCredit } = require("../utils/credit");
const { computeMemberFeeAndCredit, chargeMemberForSession, billSplitSessionFee } = require("../utils/hosted-play-billing");

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
      Club.findById(clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
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
      Club.findById(session.clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
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
      Club.findById(session.clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
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
        .select("convenienceFeeRate convenienceFeeMode").lean();
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
        .select("convenienceFeeRate convenienceFeeMode").lean();
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
      Club.findById(session.clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
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

// POST /api/hosted-play/sessions
router.post("/sessions", auth, admin, async (req, res) => {
  try {
    const {
      title, sport, date, startTime, endTime, venue, court, address,
      feePerPlayer, sessionFee, guestFeePerPlayer, maxPlayers, maxGuests, description,
      numberOfCourts, playersPerCourt, queueMode,
      minSkillLevel, maxSkillLevel,
    } = req.body;

    if (!title || !sport || !date || !startTime || !endTime || !venue || !maxPlayers) {
      return res.status(400).json({
        error: "title, sport, date, startTime, endTime, venue and maxPlayers are required",
      });
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
      minSkillLevel, maxSkillLevel,
    } = req.body;

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
    // first time they're marked completed.
    if (status === "completed" && !wasCompleted && session.feeSplitMode === "split_total") {
      const club = await Club.findById(session.clubId).select("convenienceFeeRate convenienceFeeMode").lean();
      await billSplitSessionFee(session, club);
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
  const participants = await HostedPlayParticipant.find({ hostedPlayId: session._id, ...ACTIVE_PARTICIPANT })
    .sort({ createdAt: 1 })
    .lean();
  const prev = snapshotQueue(session, participants);
  return { session, participants, club, prev };
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

// Copy per-player fee figures (member + guest) onto the board's session for UI quotes.
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
}

// Persist an engine result (changed participants + optional session update),
// apply the session update in memory, and respond with the fresh board.
async function applyAndRespond(res, session, participants, result, club = null, prev = null) {
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
  return res.json(board);
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
    if (result?.sessionUpdate?.status === "completed" && !wasCompleted && ctx.session.feeSplitMode === "split_total") {
      await billSplitSessionFee(ctx.session, ctx.club);
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
      .select("convenienceFeeRate convenienceFeeMode numberOfCourts")
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

// POST /api/hosted-play/sessions/:id/walkins — add a walk-in player and record cash charge
router.post("/sessions/:id/walkins", auth, admin, async (req, res) => {
  try {
    const ctx = await loadQueueContext(req, res);
    if (!ctx) return;
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
    const { baseFee, convenienceFee, total: amount } = computePlayerFees(ctx.club, resolveGuestFee(ctx.session));
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
    await applyAndRespond(res, ctx.session, ctx.participants, queue.appendAndAssign(ctx.session, ctx.participants, walkIn._id), ctx.club, ctx.prev);
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
    const winnerIds = Array.isArray(req.body.winnerIds) ? req.body.winnerIds : [];
    await applyAndRespond(res, ctx.session, ctx.participants, queue.finishGame(ctx.session, ctx.participants, courtNumber, winnerIds), ctx.club, ctx.prev);
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
