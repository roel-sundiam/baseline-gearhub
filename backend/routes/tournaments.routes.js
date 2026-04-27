const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Tournament = require("../models/Tournament");
const Club = require("../models/Club");
const CoinTransaction = require("../models/CoinTransaction");
const TOURNAMENT_JOIN_COIN_COST = 3;

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRoundName(round, totalRounds) {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semifinal";
  if (round === totalRounds - 2) return "Quarterfinal";
  if (round === totalRounds - 3) return "Round of 16";
  return `Round ${round}`;
}

function generateBracket(entries, totalRounds) {
  const bracketSize = Math.pow(2, totalRounds);
  const padded = [...entries];
  while (padded.length < bracketSize) padded.push(null); // byes

  const matches = [];

  // Round 1 – seed matches
  for (let i = 0; i < bracketSize / 2; i++) {
    const e1 = padded[i * 2];
    const e2 = padded[i * 2 + 1];
    let winner = null;
    let status = "upcoming";
    if (e1 && !e2) { winner = 1; status = "completed"; }
    if (!e1 && e2) { winner = 2; status = "completed"; }

    matches.push({
      round: 1,
      roundName: getRoundName(1, totalRounds),
      position: i,
      slot1Players: e1 ? e1.map((p) => p.toString()) : [],
      slot2Players: e2 ? e2.map((p) => p.toString()) : [],
      winner,
      status,
      score: "",
    });
  }

  // Subsequent rounds – empty TBD slots
  for (let r = 2; r <= totalRounds; r++) {
    const count = bracketSize / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      matches.push({
        round: r,
        roundName: getRoundName(r, totalRounds),
        position: i,
        slot1Players: [],
        slot2Players: [],
        winner: null,
        status: "upcoming",
        score: "",
      });
    }
  }

  // Auto-advance bye winners in round 1 to round 2
  for (const m of matches.filter((m) => m.round === 1 && m.winner !== null)) {
    const winnerPlayers = m.winner === 1 ? m.slot1Players : m.slot2Players;
    const nextMatch = matches.find((nm) => nm.round === 2 && nm.position === Math.floor(m.position / 2));
    if (nextMatch) {
      if (m.position % 2 === 0) nextMatch.slot1Players = winnerPlayers;
      else nextMatch.slot2Players = winnerPlayers;
    }
  }

  return matches;
}

function populateOpts() {
  return [
    { path: "participants", select: "name profileImage" },
    { path: "matches.slot1Players", select: "name profileImage" },
    { path: "matches.slot2Players", select: "name profileImage" },
  ];
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/tournaments – list (unpublished hidden from players)
router.get("/", auth, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    const clubFilter = clubId ? { clubId } : {};
    const filter = isAdmin ? clubFilter : { ...clubFilter, published: true };
    const tournaments = await Tournament.find(filter)
      .populate("participants", "name profileImage")
      .sort({ createdAt: -1 })
      .lean();
    res.json(tournaments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/tournaments/rankings – aggregated player leaderboard
router.get("/rankings", auth, async (req, res) => {
  try {
    const POINTS = {
      singles: { champion: 100, runnerUp: 70, semiFinal: 40, quarterFinal: 20, participation: 10 },
      doubles: { champion: 80, runnerUp: 50, semiFinal: 30, quarterFinal: 15, participation: 5 },
    };

    const clubId = req.query.clubId || req.user.clubId;
    const clubFilter = clubId ? { clubId } : {};
    const tournaments = await Tournament.find({ ...clubFilter, status: { $in: ["active", "completed"] } })
      .populate("participants", "name profileImage gender")
      .populate("matches.slot1Players", "name profileImage gender")
      .populate("matches.slot2Players", "name profileImage gender")
      .lean();

    const inferWinner = (m) => {
      if (m.winner != null) return m.winner;
      if (!m.score) return null;
      const parts = m.score.split(" - ");
      if (parts.length !== 2) return null;
      const sum = (s) => s.split(",").reduce((acc, v) => acc + (parseFloat(v.trim()) || 0), 0);
      const s1 = sum(parts[0]), s2 = sum(parts[1]);
      if (s1 > s2) return 1;
      if (s2 > s1) return 2;
      return null;
    };

    const map = {}; // playerId -> { name, profileImage, points, tournamentsPlayed }

    const ensure = (player) => {
      if (!player || !player._id) return;
      const id = player._id.toString();
      if (!map[id]) map[id] = { name: player.name, profileImage: player.profileImage, gender: player.gender, points: 0, tournamentsPlayed: 0 };
    };

    const addPts = (players, pts) => {
      for (const p of players || []) {
        if (!p || !p._id) continue;
        ensure(p);
        map[p._id.toString()].points += pts;
      }
    };

    for (const t of tournaments) {
      if (!t.matches.length) continue;
      const pts = POINTS[t.type];
      const totalRounds = Math.max(...t.matches.map((m) => m.round));

      // Participation baseline for all enrolled players
      const allPlayers = t.type === "singles"
        ? t.participants
        : t.matches.flatMap((m) => [...(m.slot1Players || []), ...(m.slot2Players || [])]);

      const seen = new Set();
      for (const p of allPlayers) {
        if (!p || !p._id) continue;
        const id = p._id.toString();
        if (!seen.has(id)) {
          seen.add(id);
          ensure(p);
          map[id].points += pts.participation;
          map[id].tournamentsPlayed += 1;
        }
      }

      if (totalRounds > 0) {
        // Bracket tournament: award points by round placement
        const finalMatch = t.matches.find((m) => m.round === totalRounds && m.position === 0);

        if (totalRounds >= 3) {
          for (const m of t.matches.filter((m) => m.round === totalRounds - 2)) {
            const w = inferWinner(m); if (!w) continue;
            addPts(w === 1 ? m.slot2Players : m.slot1Players, pts.quarterFinal - pts.participation);
          }
        }
        if (totalRounds >= 2) {
          for (const m of t.matches.filter((m) => m.round === totalRounds - 1)) {
            const w = inferWinner(m); if (!w) continue;
            addPts(w === 1 ? m.slot2Players : m.slot1Players, pts.semiFinal - pts.participation);
          }
        }
        if (finalMatch) {
          const w = inferWinner(finalMatch);
          if (w) {
            addPts(w === 1 ? finalMatch.slot1Players : finalMatch.slot2Players, pts.champion - pts.participation);
            addPts(w === 1 ? finalMatch.slot2Players : finalMatch.slot1Players, pts.runnerUp - pts.participation);
          }
        }
      } else {
        // Custom matches (round=0): rank by win count per player
        const winMap = {};
        for (const m of t.matches) {
          const w = inferWinner(m); if (!w) continue;
          const winners = w === 1 ? m.slot1Players : m.slot2Players;
          const losers  = w === 1 ? m.slot2Players : m.slot1Players;
          for (const p of [...(winners || []), ...(losers || [])]) {
            if (!p?._id) continue;
            const id = p._id.toString();
            if (!winMap[id]) winMap[id] = { player: p, wins: 0 };
          }
          for (const p of winners || []) {
            if (p?._id) winMap[p._id.toString()].wins++;
          }
        }
        const ranked = Object.values(winMap).sort((a, b) => b.wins - a.wins);
        const winLevels = [...new Set(ranked.map(r => r.wins))];
        const bonuses = [pts.champion, pts.runnerUp, pts.semiFinal, pts.quarterFinal];
        winLevels.forEach((wins, idx) => {
          if (idx >= bonuses.length) return;
          ranked.filter(r => r.wins === wins).forEach(r => {
            addPts([r.player], bonuses[idx] - pts.participation);
          });
        });
      }
    }

    const rankings = Object.entries(map)
      .map(([id, d]) => ({ playerId: id, ...d }))
      .sort((a, b) => b.points - a.points);

    res.json(rankings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments – create (admin)
router.post("/", auth, admin, async (req, res) => {
  try {
    const { name, type } = req.body;
    const clubId = req.body.clubId || req.user.clubId;
    if (!name || !type) return res.status(400).json({ error: "name and type are required" });
    const tournament = await Tournament.create({ name, type, clubId });
    res.status(201).json(tournament);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/tournaments/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    if (!tournament) return res.status(404).json({ error: "Not found" });
    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    if (!tournament.published && !isAdmin) return res.status(403).json({ error: "Access denied" });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/tournaments/:id – update name (admin)
router.patch("/:id", auth, admin, async (req, res) => {
  try {
    const { name } = req.body;
    const update = {};
    if (name) update.name = name;
    const tournament = await Tournament.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate(...populateOpts());
    if (!tournament) return res.status(404).json({ error: "Not found" });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/tournaments/:id (admin)
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments/:id/participants – add single player (singles) (admin)
router.post("/:id/participants", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    if (tournament.status === "completed") return res.status(400).json({ error: "Cannot modify a completed tournament" });
    if (tournament.type !== "singles") return res.status(400).json({ error: "Use /teams for doubles" });

    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    const alreadyIn = tournament.participants.some((p) => p.toString() === playerId);
    if (!alreadyIn) {
      const clubId = tournament.clubId;
      const club = await Club.findById(clubId);
      if (!club || club.coinBalance < TOURNAMENT_JOIN_COIN_COST) {
        return res.status(402).json({ error: "Insufficient coins to add a tournament participant", coinBalance: club?.coinBalance ?? 0 });
      }
      tournament.participants.push(playerId);
      await tournament.save();

      club.coinBalance -= TOURNAMENT_JOIN_COIN_COST;
      await club.save();
      await CoinTransaction.create({
        clubId,
        userId: playerId,
        type: "debit",
        amount: TOURNAMENT_JOIN_COIN_COST,
        action: "tournament-join",
        relatedId: tournament._id,
        balanceAfter: club.coinBalance,
      });
    } else {
      await tournament.save();
    }

    const updated = await Tournament.findById(tournament._id).populate("participants", "name profileImage").lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/tournaments/:id/participants/:pid (admin)
router.delete("/:id/participants/:pid", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    if (tournament.status === "completed") return res.status(400).json({ error: "Cannot modify a completed tournament" });

    tournament.participants = tournament.participants.filter((p) => p.toString() !== req.params.pid);
    await tournament.save();
    const updated = await Tournament.findById(tournament._id).populate("participants", "name profileImage").lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments/:id/teams – add doubles team (admin)
router.post("/:id/teams", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    if (tournament.status === "completed") return res.status(400).json({ error: "Cannot modify a completed tournament" });
    if (tournament.type !== "doubles") return res.status(400).json({ error: "Use /participants for singles" });

    const { player1Id, player2Id } = req.body;
    if (!player1Id || !player2Id) return res.status(400).json({ error: "player1Id and player2Id required" });

    tournament.teams.push([player1Id, player2Id]);
    if (!tournament.participants.some((p) => p.toString() === player1Id)) tournament.participants.push(player1Id);
    if (!tournament.participants.some((p) => p.toString() === player2Id)) tournament.participants.push(player2Id);

    await tournament.save();
    const updated = await Tournament.findById(tournament._id).populate("participants", "name profileImage").lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/tournaments/:id/teams/:teamIndex (admin)
router.delete("/:id/teams/:teamIndex", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    if (tournament.status === "completed") return res.status(400).json({ error: "Cannot modify a completed tournament" });

    const idx = parseInt(req.params.teamIndex, 10);
    if (idx < 0 || idx >= tournament.teams.length) return res.status(400).json({ error: "Invalid team index" });

    const removedPlayers = tournament.teams[idx].map((p) => p.toString());
    tournament.teams.splice(idx, 1);

    // Remove players from participants if they're not in any remaining team
    const remaining = new Set(tournament.teams.flat().map((p) => p.toString()));
    tournament.participants = tournament.participants.filter((p) => remaining.has(p.toString()));
    await tournament.save();

    // Atomically remove round-0 matches that contain any of the deleted players
    await Tournament.updateOne(
      { _id: req.params.id },
      { $pull: { matches: { round: 0, $or: [
        { slot1Players: { $in: removedPlayers } },
        { slot2Players: { $in: removedPlayers } }
      ] } } }
    );
    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments/:id/generate-bracket (admin)
router.post("/:id/generate-bracket", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    if (tournament.status !== "draft") return res.status(400).json({ error: "Bracket already generated" });

    const entries =
      tournament.type === "singles"
        ? tournament.participants.map((p) => [p])
        : tournament.teams;

    if (entries.length < 2) return res.status(400).json({ error: "Need at least 2 participants/teams" });

    const totalRounds = Math.ceil(Math.log2(entries.length));
    tournament.matches = generateBracket(entries, totalRounds);
    tournament.status = "active";

    await tournament.save();
    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments/:id/matches – add a custom match (admin)
router.post("/:id/matches", auth, admin, async (req, res) => {
  try {
    const { roundName, slot1Players, slot2Players, scheduledDate, timeSlot } = req.body;
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });

    const position = tournament.matches.filter((m) => m.round === 0).length;
    tournament.matches.push({
      round: 0,
      roundName: (roundName || "Custom").trim(),
      position,
      slot1Players: slot1Players || [],
      slot2Players: slot2Players || [],
      scheduledDate: scheduledDate || null,
      timeSlot: timeSlot || "",
      status: "upcoming",
    });

    await tournament.save();
    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.status(201).json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/tournaments/:id/matches/:matchId – update score/winner (admin)
router.patch("/:id/matches/:matchId", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });

    const match = tournament.matches.id(req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });

    const { score, winner, status, scheduledDate, timeSlot, roundName } = req.body;
    if (score !== undefined) match.score = score;
    if (status !== undefined) match.status = status;
    if (scheduledDate !== undefined) match.scheduledDate = scheduledDate || null;
    if (timeSlot !== undefined) match.timeSlot = timeSlot;
    if (roundName !== undefined && roundName.trim()) match.roundName = roundName.trim();

    if (winner !== undefined && winner !== null && winner !== match.winner) {
      match.winner = winner;
      match.status = "completed";

      // Advance winner to next round
      const totalRounds = Math.max(...tournament.matches.map((m) => m.round));
      if (match.round < totalRounds) {
        const nextRound = match.round + 1;
        const nextPos = Math.floor(match.position / 2);
        const nextMatch = tournament.matches.find((m) => m.round === nextRound && m.position === nextPos);
        if (nextMatch) {
          const winnerIds = (winner === 1 ? match.slot1Players : match.slot2Players).map((p) =>
            p._id ? p._id.toString() : p.toString(),
          );
          if (match.position % 2 === 0) nextMatch.slot1Players = winnerIds;
          else nextMatch.slot2Players = winnerIds;
        }
      }
    }

    await tournament.save();
    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/tournaments/:id/matches/:matchId (admin)
router.delete("/:id/matches/:matchId", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    const match = tournament.matches.id(req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    match.deleteOne();
    await tournament.save();
    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments/:id/matches/swap
// Swaps a specific slot between two matches
// Body: { matchId1, slot1 (1|2), matchId2, slot2 (1|2) }
router.post("/:id/matches/swap", auth, admin, async (req, res) => {
  try {
    const { matchId1, slot1, matchId2, slot2 } = req.body;
    if (!matchId1 || !slot1 || !matchId2 || !slot2) {
      return res.status(400).json({ error: "matchId1, slot1, matchId2, slot2 are required" });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });

    const m1 = tournament.matches.id(matchId1);
    const m2 = tournament.matches.id(matchId2);
    if (!m1 || !m2) return res.status(404).json({ error: "Match not found" });
    if (m1.status !== "upcoming" || m2.status !== "upcoming") {
      return res.status(400).json({ error: "Can only swap upcoming matches" });
    }

    const getSlot = (m, s) => (s === 1 ? m.slot1Players : m.slot2Players).map((p) => p.toString());
    const setSlot = (m, s, val) => { if (s === 1) m.slot1Players = val; else m.slot2Players = val; };

    const a = getSlot(m1, slot1);
    const b = getSlot(m2, slot2);
    setSlot(m1, slot1, b);
    setSlot(m2, slot2, a);

    await tournament.save();
    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/tournaments/:id/rounds/:round/name – rename all matches in a round (admin)
router.patch("/:id/rounds/:round/name", auth, admin, async (req, res) => {
  try {
    const { roundName } = req.body;
    if (!roundName || !roundName.trim()) return res.status(400).json({ error: "roundName is required" });

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });

    const round = parseInt(req.params.round, 10);
    tournament.matches
      .filter((m) => m.round === round)
      .forEach((m) => { m.roundName = roundName.trim(); });

    await tournament.save();
    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments/:id/random-matches – auto-generate random pairings (admin)
router.post("/:id/random-matches", auth, admin, async (req, res) => {
  try {
    // Step 1: load doc and splice out round-0 matches from back to front
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    if (tournament.status === "completed") return res.status(400).json({ error: "Cannot modify a completed tournament" });

    // Wipe ALL matches for a clean slate
    tournament.matches = [];
    await tournament.save();

    const shuffle = (arr) => arr.map((v) => ({ v, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.v);

    let entries = [];
    if (tournament.type === "doubles") {
      if (!tournament.teams || tournament.teams.length < 2)
        return res.status(400).json({ error: "Need at least 2 teams to generate matches" });
      entries = shuffle(tournament.teams.map((t) => t.map((p) => p.toString())));
    } else {
      if (tournament.participants.length < 2)
        return res.status(400).json({ error: "Need at least 2 players to generate matches" });
      entries = shuffle(tournament.participants.map((p) => [p.toString()]));
    }

    // Step 3: build new match objects
    const newMatches = [];
    let gameNum = 1;
    for (let i = 0; i + 1 < entries.length; i += 2) {
      newMatches.push({
        round: 0,
        roundName: `Game ${gameNum}`,
        position: gameNum - 1,
        slot1Players: entries[i],
        slot2Players: entries[i + 1],
        status: "upcoming",
      });
      gameNum++;
    }

    newMatches.forEach((m) => tournament.matches.push(m));
    if (newMatches.length) await tournament.save();

    const updated = await Tournament.findById(req.params.id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/tournaments/:id/publish – toggle published (admin)
router.patch("/:id/publish", auth, admin, async (req, res) => {
  try {
    const { published } = req.body;
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { published: !!published },
      { new: true }
    )
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    if (!tournament) return res.status(404).json({ error: "Not found" });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tournaments/:id/complete – finalize tournament (admin)
router.post("/:id/complete", auth, admin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found" });
    if (tournament.status === "completed") return res.status(400).json({ error: "Already completed" });

    tournament.status = "completed";
    await tournament.save();

    const updated = await Tournament.findById(tournament._id)
      .populate("participants", "name profileImage")
      .populate("matches.slot1Players", "name profileImage")
      .populate("matches.slot2Players", "name profileImage")
      .lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
