// One-off script: create a Fixed Doubles Rotation test session for SheServes
// Tennis Club — 8 players, 4 confirmed pairs, schedule generated — so the
// live board / Teams & Schedule flow can be exercised end-to-end.
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Club = require("../models/Club");
const User = require("../models/User");
const HostedPlay = require("../models/HostedPlay");
const HostedPlayParticipant = require("../models/HostedPlayParticipant");
const HostedPlayPair = require("../models/HostedPlayPair");
const HostedPlayFixture = require("../models/HostedPlayFixture");
const fixedDoubles = require("../services/fixed-doubles-engine");

function combineDateTime(date, timeStr) {
  const d = new Date(date);
  const [h, m] = String(timeStr || "0:0").split(":").map(Number);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const club = await Club.findOne({ name: /she\s*serves/i });
  if (!club) throw new Error("Could not find the SheServes club");
  console.log(`Club: ${club.name} (${club._id})`);

  const admin = await User.findOne({ clubId: club._id, role: "admin" }).lean();
  if (!admin) throw new Error("Could not find an admin user for this club");

  const players = await User.find({ clubId: club._id, role: "player", status: "active" })
    .sort({ name: 1 })
    .select("_id name")
    .limit(8)
    .lean();
  if (players.length < 8) throw new Error(`Only found ${players.length} active players — need 8`);
  console.log("Players:", players.map((p) => p.name).join(", "));

  // Session date: tomorrow, 6-8pm.
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);

  const session = await HostedPlay.create({
    clubId: club._id,
    createdBy: admin._id,
    title: "Fixed Doubles Rotation Test",
    sport: "tennis",
    date,
    startTime: "18:00",
    endTime: "20:00",
    venue: "Rich Town 2 Tennis Court",
    feePerPlayer: 0,
    maxPlayers: 8,
    currentPlayers: 8,
    status: "full",
    description: "Test session — 4 fixed doubles pairs, round-robin schedule.",
    numberOfCourts: 2,
    queueManagementEnabled: !!club.hostedPlayQueueEnabled,
    queueMode: "fixed_doubles_rotation",
    fixedDoubles: { pairCount: 4, restBetweenMatchesMinutes: 0 },
  });
  console.log(`Session created: ${session._id}`);

  const participants = await HostedPlayParticipant.insertMany(
    players.map((p) => ({
      hostedPlayId: session._id,
      clubId: club._id,
      memberId: p._id,
      memberName: p.name,
    })),
  );

  const pairs = [];
  for (let i = 0; i < 4; i++) {
    const a = participants[i * 2];
    const b = participants[i * 2 + 1];
    const pair = await HostedPlayPair.create({
      hostedPlayId: session._id,
      clubId: club._id,
      pairLabel: `Pair ${i + 1}`,
      participantAId: a._id,
      participantBId: b._id,
      status: "confirmed",
      source: "organizer_assigned",
    });
    pairs.push(pair);
    console.log(`Pair ${i + 1}: ${a.memberName} & ${b.memberName}`);
  }

  // Generate the round-robin schedule the same way the admin "Generate Schedule"
  // endpoint does (POST /sessions/:id/fixed-doubles/generate-schedule).
  const participantsById = new Map(participants.map((p) => [String(p._id), p]));
  const pairsById = new Map(pairs.map((p) => [String(p._id), p]));
  const buildSnapshot = (pairId) => {
    const pair = pairsById.get(String(pairId));
    const playersSnap = [pair.participantAId, pair.participantBId].map((pid) => {
      const part = participantsById.get(String(pid));
      return { participantId: pid, memberId: part.memberId, memberName: part.memberName };
    });
    return { pairId: pair._id, pairLabel: pair.pairLabel || "", players: playersSnap };
  };

  const { rounds } = fixedDoubles.generateRoundRobin(pairs.map((p) => p._id));
  const sessionStart = combineDateTime(session.date, session.startTime);
  const sessionEnd = combineDateTime(session.date, session.endTime);
  const matchDurationMinutes = fixedDoubles.computeMatchDuration({
    pairCount: pairs.length,
    numberOfCourts: session.numberOfCourts,
    sessionStart,
    sessionEnd,
    restBetweenMatchesMinutes: 0,
  });
  const { fixtures: mapped, warnings } = fixedDoubles.mapScheduleToCourtsAndTimes({
    rounds,
    numberOfCourts: session.numberOfCourts,
    matchDurationMinutes,
    restBetweenMatchesMinutes: 0,
    sessionStart,
    sessionEnd,
  });

  session.fixedDoubles.matchDurationMinutes = matchDurationMinutes;
  session.fixedDoubles.scheduleGeneratedAt = new Date();
  session.fixedDoubles.scheduleGenerationBatch = 1;
  await session.save();

  await HostedPlayFixture.insertMany(
    mapped.map((f) => ({
      hostedPlayId: session._id,
      clubId: club._id,
      matchNumber: f.matchNumber,
      roundNumber: f.roundNumber,
      pair1Id: f.pair1Id,
      pair2Id: f.pair2Id,
      pair1Snapshot: buildSnapshot(f.pair1Id),
      pair2Snapshot: buildSnapshot(f.pair2Id),
      courtNumber: f.courtNumber,
      scheduledStart: f.scheduledStart,
      scheduledEnd: f.scheduledEnd,
      generationBatch: 1,
    })),
  );

  console.log(`Schedule generated: ${mapped.length} matches, ${matchDurationMinutes} min each.`);
  if (warnings.length) console.log("Warnings:", warnings.join(" "));
  console.log(`\nDone. Session id: ${session._id}`);

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
