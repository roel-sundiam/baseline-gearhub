"use strict";

const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const Charge = require("../models/Charge");
const { computePlayerFees } = require("./fees");
const { sendPushToUser } = require("./push");
const { refundCredit } = require("./credit");

const WAITLIST_CLAIM_WINDOW_MS = 30 * 60 * 1000; // paid: 30 min to claim an offered spot

// Fill freed spots on a Hosted Play session from its waitlist. Free sessions
// auto-confirm the next player in line; paid sessions "offer" the spot (push +
// claim window) so nobody is charged without consent. Safe to call after any
// spot frees. `session` is a live mongoose doc that this mutates + saves when it
// confirms a free player.
async function promoteFromWaitlist(session, club) {
  if (["cancelled", "completed"].includes(session.status)) return;
  const now = new Date();
  let sessionDirty = false;

  // Expire stale offers → send them back to the end of the waitlist.
  const stale = await HostedPlayParticipant.find({
    hostedPlayId: session._id, waitStatus: "offered", offerExpiresAt: { $lte: now },
  });
  for (const o of stale) {
    o.waitStatus = "waitlisted";
    o.offerExpiresAt = null;
    o.waitlistOrder = Date.now();
    await o.save();
  }

  // Expire stale direct-join holds → release the slot they reserved (they were
  // never on the waitlist, so this deletes rather than reverting to waitlisted).
  const staleHolds = await HostedPlayParticipant.find({
    hostedPlayId: session._id, waitStatus: "pending_payment", offerExpiresAt: { $lte: now },
  });
  for (const h of staleHolds) {
    await HostedPlayParticipant.deleteOne({ _id: h._id });
    session.currentPlayers = Math.max(0, session.currentPlayers - 1);
    sessionDirty = true;
    if (h.chargeId) {
      const droppedCharge = await Charge.findOneAndDelete({ _id: h.chargeId, status: "unpaid" });
      if (droppedCharge?.creditApplied > 0) {
        await refundCredit({
          clubId: session.clubId, playerId: h.memberId, amount: droppedCharge.creditApplied,
          chargeId: droppedCharge._id, grantedBy: session.createdBy, reason: "Credit returned — join hold expired",
        });
      }
    }
    if (h.memberId) {
      sendPushToUser(String(h.memberId), {
        title: "Your reserved spot expired",
        body: `Your hold on "${session.title}" expired before your payment was approved. Please rejoin if a spot is still open.`,
        url: "/player/hosted-play",
        tag: `hp-hold-expired-${session._id}`,
      });
    }
  }

  const openSpots = session.maxPlayers - session.currentPlayers;
  if (openSpots <= 0) {
    if (sessionDirty) {
      session.status = session.currentPlayers >= session.maxPlayers ? "full" : "open";
      await session.save();
    }
    return;
  }
  // Outstanding (non-expired) offers already reserve freed spots.
  const outstanding = await HostedPlayParticipant.countDocuments({
    hostedPlayId: session._id, waitStatus: "offered", offerExpiresAt: { $gt: now },
  });
  let slots = openSpots - outstanding;
  if (slots <= 0) {
    if (sessionDirty) {
      session.status = session.currentPlayers >= session.maxPlayers ? "full" : "open";
      await session.save();
    }
    return;
  }

  const isPaid = computePlayerFees(club, session.feePerPlayer).total > 0;

  while (slots > 0) {
    const next = await HostedPlayParticipant.findOne({
      hostedPlayId: session._id, waitStatus: "waitlisted",
    }).sort({ waitlistOrder: 1 });
    if (!next) break;

    if (isPaid) {
      next.waitStatus = "offered";
      next.offerExpiresAt = new Date(now.getTime() + WAITLIST_CLAIM_WINDOW_MS);
      await next.save();
      if (next.memberId) {
        sendPushToUser(String(next.memberId), {
          title: "A spot opened! 🎾",
          body: `Claim your spot in "${session.title}" before it goes to the next player.`,
          url: "/player/hosted-play",
          tag: `hp-offer-${session._id}`,
        });
      }
    } else {
      const charge = await Charge.create({
        clubId: session.clubId,
        playerId: next.memberId,
        hostedPlayId: session._id,
        amount: 0,
        breakdown: { hostedPlayFee: 0, convenienceFee: 0 },
        chargeType: "hosted_play",
        status: "unpaid",
        approvalStatus: "none",
      });
      next.waitStatus = "active";
      next.chargeId = charge._id;
      next.offerExpiresAt = null;
      await next.save();
      session.currentPlayers += 1;
      sessionDirty = true;
      if (next.memberId) {
        sendPushToUser(String(next.memberId), {
          title: "You're in! 🎾",
          body: `A spot opened in "${session.title}" and it's yours.`,
          url: "/player/hosted-play",
          tag: `hp-promoted-${session._id}`,
        });
      }
    }
    slots--;
  }

  if (sessionDirty) {
    session.status = session.currentPlayers >= session.maxPlayers ? "full" : "open";
    await session.save();
  }
}

module.exports = { promoteFromWaitlist, WAITLIST_CLAIM_WINDOW_MS };
