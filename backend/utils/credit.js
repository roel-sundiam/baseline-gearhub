const mongoose = require("mongoose");
const Credit = require("../models/Credit");

// $match does not auto-cast strings to ObjectId the way .find() does, so cast explicitly.
async function getCreditBalance(clubId, playerId) {
  const [result] = await Credit.aggregate([
    {
      $match: {
        clubId: new mongoose.Types.ObjectId(clubId),
        playerId: new mongoose.Types.ObjectId(playerId),
      },
    },
    { $group: { _id: null, balance: { $sum: "$amount" } } },
  ]);
  return result ? result.balance : 0;
}

async function redeemCredit({ clubId, playerId, amount, chargeId, grantedBy }) {
  if (!(amount > 0)) return;
  await Credit.create({ clubId, playerId, type: "redemption", amount: -amount, chargeId, grantedBy });
}

// Returns credit previously applied to a charge to the player's balance
// (e.g. when the remainder payment on a partially-credited charge is rejected).
async function refundCredit({ clubId, playerId, amount, chargeId, grantedBy, reason }) {
  if (!(amount > 0)) return;
  await Credit.create({ clubId, playerId, type: "grant", amount, chargeId, grantedBy, reason });
}

module.exports = { getCreditBalance, redeemCredit, refundCredit };
