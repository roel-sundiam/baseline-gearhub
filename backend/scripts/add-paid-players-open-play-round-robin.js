// One-off script: add 8 joined+paid players (and pair them into 4 confirmed
// teams) to the existing "Open Play Round Robin" Hosted Play session at
// SheServes Tennis Club (Fixed Doubles Rotation format, pickleball, fee per
// player). Prefers players who have never joined an Open Play session at
// this club, per the earlier request.
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Club = require("../models/Club");
const User = require("../models/User");
const HostedPlay = require("../models/HostedPlay");
const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const HostedPlayPair = require("../models/HostedPlayPair");
const OpenPlaySessionPlayer = require("../models/OpenPlaySessionPlayer");
const Charge = require("../models/Charge");
const { computePlayerFees } = require("../utils/fees");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const club = await Club.findOne({ name: /she\s*serves/i }).select(
    "hostedPlayConvenienceFeeRate hostedPlayConvenienceFeeMode",
  );
  if (!club) throw new Error("Could not find the SheServes club");

  const session = await HostedPlay.findOne({ clubId: club._id, title: /open play round robin/i });
  if (!session) throw new Error('Could not find the "Open Play Round Robin" session');
  console.log(`Session: ${session.title} (${session._id}) — ${session.currentPlayers}/${session.maxPlayers} joined`);

  const alreadyIn = await HostedPlayParticipant.find({ hostedPlayId: session._id }).distinct("memberId");
  const alreadyInSet = new Set(alreadyIn.map(String));

  const everJoinedOpenPlayIds = await OpenPlaySessionPlayer.find({ clubId: club._id }).distinct("playerId");
  const everJoinedSet = new Set(everJoinedOpenPlayIds.map(String));

  const candidates = await User.find({ clubId: club._id, role: "player", status: "active" })
    .sort({ name: 1 })
    .select("_id name")
    .lean();
  const freshPlayers = candidates.filter((p) => !everJoinedSet.has(String(p._id)) && !alreadyInSet.has(String(p._id)));
  const need = session.maxPlayers - session.currentPlayers;
  if (freshPlayers.length < need) {
    throw new Error(`Only ${freshPlayers.length} eligible players with no prior Open Play history — need ${need}`);
  }
  const players = freshPlayers.slice(0, need);
  console.log("Players (no prior Open Play history at this club):", players.map((p) => p.name).join(", "));

  const fees = computePlayerFees(club, session.feePerPlayer);
  const netSessionFee = fees.feeMode === "club_absorbs" ? fees.baseFee - fees.convenienceFee : fees.baseFee;

  const participants = [];
  for (const p of players) {
    const charge = await Charge.create({
      clubId: club._id,
      playerId: p._id,
      hostedPlayId: session._id,
      amount: fees.total,
      breakdown: { hostedPlayFee: netSessionFee, convenienceFee: fees.convenienceFee, convenienceFeeMode: fees.feeMode },
      chargeType: "hosted_play",
      status: "paid",
      approvalStatus: "approved",
      paymentMethod: "GCash",
      paidAt: new Date(),
    });

    const participant = await HostedPlayParticipant.create({
      hostedPlayId: session._id,
      clubId: club._id,
      memberId: p._id,
      memberName: p.name,
      chargeId: charge._id,
    });
    participants.push(participant);
    console.log(`Joined & paid: ${p.name} (₱${fees.total})`);
  }

  session.currentPlayers += participants.length;
  if (session.currentPlayers >= session.maxPlayers) session.status = "full";
  await session.save();

  // Pair into 4 confirmed teams (Fixed Doubles Rotation requires exactly pairCount pairs).
  const existingPairedIds = new Set(
    (await HostedPlayPair.find({ hostedPlayId: session._id, status: { $ne: "withdrawn" } }).lean())
      .flatMap((pr) => [pr.participantAId, pr.participantBId].filter(Boolean).map(String)),
  );
  const unpaired = participants.filter((pt) => !existingPairedIds.has(String(pt._id)));
  const existingPairCount = await HostedPlayPair.countDocuments({ hostedPlayId: session._id, status: "confirmed" });
  for (let i = 0; i + 1 < unpaired.length; i += 2) {
    const a = unpaired[i];
    const b = unpaired[i + 1];
    const pair = await HostedPlayPair.create({
      hostedPlayId: session._id,
      clubId: club._id,
      pairLabel: `Pair ${existingPairCount + i / 2 + 1}`,
      participantAId: a._id,
      participantBId: b._id,
      status: "confirmed",
      source: "organizer_assigned",
    });
    console.log(`${pair.pairLabel}: ${a.memberName} & ${b.memberName}`);
  }

  console.log(`\nDone. Session now ${session.currentPlayers}/${session.maxPlayers}, status: ${session.status}`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
