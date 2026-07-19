"use strict";

const Charge = require("../models/Charge");
const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const { computePlayerFees } = require("./fees");
const { getCreditBalance, redeemCredit } = require("./credit");

// Computes a member's fee breakdown and how much of it their account credit
// covers, without touching the database beyond the credit-balance read. Split
// out so callers can gate on `remaining` (e.g. require payment proof) before
// deciding whether to actually create the Charge via chargeMemberForSession.
async function computeMemberFeeAndCredit({ session, club, memberId, baseFee, useCredit }) {
  const { baseFee: fee, convenienceFee, total: amount, feeMode } = computePlayerFees(club, baseFee);
  const netSessionFee = feeMode === "club_absorbs" ? fee - convenienceFee : fee;
  const wantsCredit = useCredit !== false;
  const creditBalance = wantsCredit && amount > 0 ? await getCreditBalance(session.clubId, memberId) : 0;
  const creditApplied = Math.min(creditBalance, amount);
  const remaining = amount - creditApplied;
  return { amount, creditApplied, remaining, netSessionFee, convenienceFee, feeMode };
}

// Creates the Charge for a member's Hosted Play fee from an already-computed
// fee/credit breakdown, and redeems the credit applied. Shared by the immediate
// per-player join flow (paymentMethod/paymentScreenshot supplied synchronously
// by the joining player) and the post-completion split-fee billing flow below
// (no proof yet — the member pays later via PATCH /api/charges/:id/pay).
async function chargeMemberForSession({ session, memberId, breakdown, paymentMethod, paymentScreenshot }) {
  const { amount, creditApplied, remaining, netSessionFee, convenienceFee, feeMode } = breakdown;
  const hasPaymentProof = !!(paymentScreenshot && paymentMethod);

  const charge = await Charge.create({
    clubId: session.clubId,
    playerId: memberId,
    hostedPlayId: session._id,
    amount,
    breakdown: { hostedPlayFee: netSessionFee, convenienceFee, convenienceFeeMode: feeMode },
    chargeType: "hosted_play",
    status: remaining <= 0 && creditApplied > 0 ? "paid" : "unpaid",
    approvalStatus: remaining <= 0 ? (creditApplied > 0 ? "approved" : "none") : (hasPaymentProof ? "pending" : "none"),
    creditApplied,
    ...(remaining <= 0 && creditApplied > 0
      ? { paymentMethod: "Credit", paidAt: new Date() }
      : hasPaymentProof
        ? { paymentMethod, paymentScreenshot }
        : {}),
  });

  if (creditApplied > 0) {
    await redeemCredit({ clubId: session.clubId, playerId: memberId, amount: creditApplied, chargeId: charge._id, grantedBy: memberId });
  }

  return charge;
}

// Bills every member still on the roster their share of sessionFee, once, when
// a split_total session is marked completed. Guests are unaffected — they pay
// their own flat guestFeePerPlayer at their own join time, never here.
async function billSplitSessionFee(session, club) {
  const participants = await HostedPlayParticipant.find({
    hostedPlayId: session._id,
    memberId: { $ne: null },
    waitStatus: { $nin: ["waitlisted", "offered", "pending_payment"] },
  });
  if (participants.length === 0) return;

  const shareEach = parseFloat((Number(session.sessionFee || 0) / participants.length).toFixed(2));
  if (shareEach <= 0) return;

  for (const participant of participants) {
    const breakdown = await computeMemberFeeAndCredit({ session, club, memberId: participant.memberId, baseFee: shareEach });
    const charge = await chargeMemberForSession({ session, memberId: participant.memberId, breakdown });
    participant.chargeId = charge._id;
    await participant.save();
  }
}

// Bills every member still on the roster their share of the flat Hosted Play
// convenience fee, once, when a session is marked completed and the club is on
// per_session mode. Independent of feeSplitMode/billSplitSessionFee above, which
// only concerns the base session fee. Guests are excluded, same reasoning as
// billSplitSessionFee: no persistent account to bill after they leave.
async function settleHostedPlayConvenienceFee(session, club) {
  if (club.hostedPlayConvenienceFeeMode !== "per_session" || !(club.hostedPlayConvenienceFeeAmount > 0)) return;

  const participants = await HostedPlayParticipant.find({
    hostedPlayId: session._id,
    memberId: { $ne: null },
    waitStatus: { $nin: ["waitlisted", "offered", "pending_payment"] },
  });
  if (participants.length === 0) return;

  const shareEach = parseFloat((club.hostedPlayConvenienceFeeAmount / participants.length).toFixed(2));
  if (shareEach <= 0) return;

  for (const participant of participants) {
    const creditBalance = await getCreditBalance(session.clubId, participant.memberId);
    const creditApplied = Math.min(creditBalance, shareEach);
    const remaining = shareEach - creditApplied;

    const charge = await Charge.create({
      clubId: session.clubId,
      playerId: participant.memberId,
      hostedPlayId: session._id,
      amount: shareEach,
      breakdown: { convenienceFee: shareEach, convenienceFeeMode: "per_session" },
      chargeType: "hosted_play",
      status: remaining <= 0 && creditApplied > 0 ? "paid" : "unpaid",
      approvalStatus: remaining <= 0 && creditApplied > 0 ? "approved" : "none",
      creditApplied,
      ...(remaining <= 0 && creditApplied > 0 ? { paymentMethod: "Credit", paidAt: new Date() } : {}),
    });

    if (creditApplied > 0) {
      await redeemCredit({ clubId: session.clubId, playerId: participant.memberId, amount: creditApplied, chargeId: charge._id, grantedBy: participant.memberId });
    }
  }
}

module.exports = { computeMemberFeeAndCredit, chargeMemberForSession, billSplitSessionFee, settleHostedPlayConvenienceFee };
