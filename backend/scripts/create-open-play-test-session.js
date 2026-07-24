// One-off script: create an Open Play test session for SheServes Tennis Club
// with 8 joined/checked-in players, preferring players who have never joined
// an Open Play session at this club before.
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Club = require("../models/Club");
const User = require("../models/User");
const OpenPlaySession = require("../models/OpenPlaySession");
const OpenPlaySessionPlayer = require("../models/OpenPlaySessionPlayer");
const OpenPlayRating = require("../models/OpenPlayRating");

async function getRatingSnapshot(clubId, playerId, sport) {
  const rec = await OpenPlayRating.findOne({ clubId, playerId, sport }).lean();
  return rec ? rec.rating : 3.5;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const club = await Club.findOne({ name: /she\s*serves/i });
  if (!club) throw new Error("Could not find the SheServes club");
  console.log(`Club: ${club.name} (${club._id})`);

  // Players from this club who have never had an OpenPlaySessionPlayer entry
  // at this club (i.e. never joined an Open Play session here before).
  const everJoinedIds = await OpenPlaySessionPlayer.find({ clubId: club._id })
    .distinct("playerId");
  const everJoinedSet = new Set(everJoinedIds.map(String));

  const candidates = await User.find({ clubId: club._id, role: "player", status: "active" })
    .sort({ name: 1 })
    .select("_id name")
    .lean();
  const freshPlayers = candidates.filter((p) => !everJoinedSet.has(String(p._id)));
  if (freshPlayers.length < 8) {
    throw new Error(`Only ${freshPlayers.length} players with no prior Open Play history at this club — need 8`);
  }
  const players = freshPlayers.slice(0, 8);
  console.log("Players (no prior Open Play history at this club):", players.map((p) => p.name).join(", "));

  // Session date: tomorrow, 5-7pm.
  const sessionDate = new Date();
  sessionDate.setDate(sessionDate.getDate() + 1);
  sessionDate.setHours(0, 0, 0, 0);

  const session = await OpenPlaySession.create({
    clubId: club._id,
    sport: "tennis",
    title: "Open Play Round Robin Test",
    sessionDate,
    startTime: "17:00",
    endTime: "19:00",
    maxPlayers: 8,
    maxMatches: 8,
    matchType: "doubles",
    courts: [1],
    status: "open",
  });
  console.log(`Session created: ${session._id}`);

  for (const p of players) {
    const ratingSnapshot = await getRatingSnapshot(club._id, p._id, session.sport);
    await OpenPlaySessionPlayer.create({
      sessionId: session._id,
      clubId: club._id,
      playerId: p._id,
      ratingSnapshot,
      checkedIn: true,
    });
    console.log(`Joined: ${p.name} (rating ${ratingSnapshot})`);
  }

  console.log(`\nDone. Session id: ${session._id}`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
