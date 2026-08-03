const AppSettings = require("../models/AppSettings");
const AppServicePayment = require("../models/AppServicePayment");
const User = require("../models/User");
const ClubMembership = require("../models/ClubMembership");

async function getGlobalSettings() {
  return AppSettings.findOneAndUpdate(
    { _id: "global" },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

async function getEffectiveMemberActivationFee() {
  const settings = await getGlobalSettings();
  return settings.memberActivationFee ?? 0;
}

async function getMemberFreeTierCount() {
  const settings = await getGlobalSettings();
  return settings.memberFreeTierCount ?? 0;
}

// Count of this club's currently approved members — same union as
// activeClubPlayersFilter in users.routes.js (home User.status:"active" plus
// any ClubMembership.status:"active" for this club), duplicated here since a
// util shouldn't import from a routes file.
async function countApprovedMembers(clubId) {
  const memberIds = await ClubMembership.find({ clubId, status: "active" }).distinct("userId");
  return User.countDocuments({
    role: "player",
    $or: [
      { clubId, status: "active" },
      { _id: { $in: memberIds } },
    ],
  });
}

// One-time ₱ fee for the (freeTierCount + 1)th and later approved member of a
// club, deduped per user via billingKey ("member_activation:<userId>") so a
// member is never charged twice even if re-approved after deactivation.
async function ensureMemberActivationFee(clubId, userId, actorUserId) {
  const settings = await getGlobalSettings();
  const fee = settings.memberActivationFee ?? 0;
  if (!(fee > 0)) return;

  const billingKey = `member_activation:${userId}`;
  const exists = await AppServicePayment.exists({ clubId, billingKey });
  if (exists) return;

  const freeTierCount = settings.memberFreeTierCount ?? 0;
  const count = await countApprovedMembers(clubId);
  if (count <= freeTierCount) return;

  try {
    await AppServicePayment.create({
      clubId,
      amount: parseFloat(fee.toFixed(2)),
      type: "billing",
      note: `Member activation fee — approved member #${count}`,
      billingKey,
      paidBy: actorUserId,
    });
  } catch (err) {
    // Concurrent approvals can race; the partial unique index makes it safe.
    if (err?.code !== 11000) throw err;
  }
}

module.exports = {
  getEffectiveMemberActivationFee,
  getMemberFreeTierCount,
  countApprovedMembers,
  ensureMemberActivationFee,
};
