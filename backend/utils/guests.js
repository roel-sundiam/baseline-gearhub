"use strict";

const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const Charge = require("../models/Charge");

// Guest fee: null/undefined guestFeePerPlayer means guests pay the member fee.
function resolveGuestFee(session) {
  return session.guestFeePerPlayer ?? session.feePerPlayer ?? 0;
}

// Committed guest spots for a session. Derived (not a counter) because paid
// public guest-joins create only a pending Charge — the participant appears at
// approval — so the pending charge must hold the spot in the meantime.
async function countGuests(hostedPlayId) {
  const [participants, pendingCharges] = await Promise.all([
    // memberId: null matches missing too — covers walk-ins and free guests.
    // $nin (not $in) so docs predating waitStatus still count as committed.
    HostedPlayParticipant.countDocuments({
      hostedPlayId,
      memberId: null,
      waitStatus: { $nin: ["waitlisted", "offered"] },
    }),
    Charge.countDocuments({
      hostedPlayId,
      chargeType: "hosted_play",
      approvalStatus: "pending",
      playerId: null,
    }),
  ]);
  return participants + pendingCharges;
}

// Batch form of countGuests for listing endpoints: Map of sessionId → guest count.
async function countGuestsBySession(hostedPlayIds) {
  const [participants, pendingCharges] = await Promise.all([
    HostedPlayParticipant.aggregate([
      { $match: { hostedPlayId: { $in: hostedPlayIds }, memberId: null, waitStatus: { $nin: ["waitlisted", "offered"] } } },
      { $group: { _id: "$hostedPlayId", n: { $sum: 1 } } },
    ]),
    Charge.aggregate([
      { $match: { hostedPlayId: { $in: hostedPlayIds }, chargeType: "hosted_play", approvalStatus: "pending", playerId: null } },
      { $group: { _id: "$hostedPlayId", n: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map();
  for (const row of [...participants, ...pendingCharges]) {
    const key = row._id.toString();
    counts.set(key, (counts.get(key) ?? 0) + row.n);
  }
  return counts;
}

module.exports = { resolveGuestFee, countGuests, countGuestsBySession };
