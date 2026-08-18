const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const OpenPlaySession = require("../models/OpenPlaySession");
const OpenPlaySessionPlayer = require("../models/OpenPlaySessionPlayer");
const OpenPlayMatch = require("../models/OpenPlayMatch");
const OpenPlayRating = require("../models/OpenPlayRating");
const Club = require("../models/Club");
const User = require("../models/User");
const Charge = require("../models/Charge");
const Rates = require("../models/Rates");
const { computeCourtFee } = require("../utils/pricing");

// ── Shared helper: attach player names to match documents ─────────────────────

async function attachPlayerNames(matches) {
  if (!matches.length) return matches;
  const ids = [...new Set(
    matches.flatMap(m => [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2].filter(Boolean).map(String))
  )];
  const users = await User.find({ _id: { $in: ids } }).select("name").lean();
  const userMap = Object.fromEntries(users.map(u => [String(u._id), u]));
  return matches.map(m => ({
    ...m,
    team1Player1: m.team1Player1 ? (userMap[String(m.team1Player1)] ?? null) : null,
    team1Player2: m.team1Player2 ? (userMap[String(m.team1Player2)] ?? null) : null,
    team2Player1: m.team2Player1 ? (userMap[String(m.team2Player1)] ?? null) : null,
    team2Player2: m.team2Player2 ? (userMap[String(m.team2Player2)] ?? null) : null,
  }));
}

// ── Rating helper ─────────────────────────────────────────────────────────────

function calcNewRating(current, matchesPlayed, teamAvg, opponentAvg, won, scoreDiff) {
  const K = matchesPlayed < 5 ? 16 : 32;
  const expected = 1 / (1 + Math.pow(10, (opponentAvg - teamAvg) / 0.5));
  const margin = Math.min(Math.abs(scoreDiff) / 10, 1);
  const change = K * ((won ? 1 : 0) - expected) * margin * 0.5;
  const clamped = Math.max(-0.5, Math.min(0.5, change));
  return Math.min(7.0, Math.max(1.0, current + clamped));
}

async function upsertRating(clubId, playerId, sport, won, teamAvg, opponentAvg, scoreDiff) {
  if (!playerId) return;
  let rec = await OpenPlayRating.findOne({ clubId, playerId, sport });
  if (!rec) {
    rec = new OpenPlayRating({ clubId, playerId, sport });
  }
  rec.rating = calcNewRating(rec.rating, rec.matchesPlayed, teamAvg, opponentAvg, won, scoreDiff);
  rec.matchesPlayed += 1;
  if (won) rec.wins += 1;
  else rec.losses += 1;
  rec.lastPlayedAt = new Date();
  await rec.save();
}

async function getRatingSnapshot(clubId, playerId, sport) {
  const rec = await OpenPlayRating.findOne({ clubId, playerId, sport }).lean();
  return rec ? rec.rating : 3.5;
}

// ── Match generation algorithm ────────────────────────────────────────────────

function pairKey(a, b) { return String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`; }

function balanceCourts(players, maxMatches) {
  const isDoubles = players.length >= 4;
  const perMatch = isDoubles ? 4 : 2;
  if (players.length < perMatch) return [];

  const matches = [];
  const playCounts = {};
  const lastPlayed = {};
  const pairCounts = {};

  players.forEach(p => {
    playCounts[p.playerId] = 0;
    lastPlayed[p.playerId] = -1;
  });

  function getPairCount(a, b) { return pairCounts[pairKey(a, b)] || 0; }
  function incPairCount(a, b) {
    const k = pairKey(a, b);
    pairCounts[k] = (pairCounts[k] || 0) + 1;
  }

  for (let round = 0; round < maxMatches; round++) {
    const pool = [...players].sort((a, b) => {
      if (playCounts[a.playerId] !== playCounts[b.playerId])
        return playCounts[a.playerId] - playCounts[b.playerId];
      if (lastPlayed[a.playerId] !== lastPlayed[b.playerId])
        return lastPlayed[a.playerId] - lastPlayed[b.playerId];
      return b.ratingSnapshot - a.ratingSnapshot;
    });

    const sel = pool.slice(0, perMatch);

    if (isDoubles) {
      const [p0, p1, p2, p3] = sel;
      const options = [
        { t1: [p0, p1], t2: [p2, p3] },
        { t1: [p0, p2], t2: [p1, p3] },
        { t1: [p0, p3], t2: [p1, p2] },
      ];

      const scored = options.map(opt => {
        const partnerReps =
          getPairCount(opt.t1[0].playerId, opt.t1[1].playerId) +
          getPairCount(opt.t2[0].playerId, opt.t2[1].playerId);
        const ratingDiff = Math.abs(
          (opt.t1[0].ratingSnapshot + opt.t1[1].ratingSnapshot) -
          (opt.t2[0].ratingSnapshot + opt.t2[1].ratingSnapshot)
        );
        return { opt, score: partnerReps * 100 + ratingDiff };
      });

      scored.sort((a, b) => a.score - b.score);
      const best = scored[0].opt;

      matches.push({
        court: "Court 1",
        team1Player1: best.t1[0].playerId,
        team1Player2: best.t1[1].playerId,
        team2Player1: best.t2[0].playerId,
        team2Player2: best.t2[1].playerId,
      });

      incPairCount(best.t1[0].playerId, best.t1[1].playerId);
      incPairCount(best.t2[0].playerId, best.t2[1].playerId);
    } else {
      const [p0, p1] = sel;
      matches.push({
        court: "Court 1",
        team1Player1: p0.playerId,
        team1Player2: null,
        team2Player1: p1.playerId,
        team2Player2: null,
      });
      incPairCount(p0.playerId, p1.playerId);
    }

    sel.forEach(p => {
      playCounts[p.playerId]++;
      lastPlayed[p.playerId] = round;
    });
  }

  return matches;
}

// ── Player endpoints (auth required, any role) ───────────────────────────────

// GET /api/open-play/player/sessions?sport=tennis
// Lists ALL open sessions across all clubs
router.get("/player/sessions", auth, async (req, res) => {
  try {
    const { sport } = req.query;
    const filter = { status: "open" };
    if (sport) filter.sport = sport;
    const sessions = await OpenPlaySession.find(filter).sort({ sessionDate: 1 }).lean();

    const sessionIds = sessions.map(s => s._id);
    const clubIds = [...new Set(sessions.map(s => String(s.clubId)))];

    const [counts, myEntries, clubs] = await Promise.all([
      OpenPlaySessionPlayer.aggregate([
        { $match: { sessionId: { $in: sessionIds } } },
        { $group: { _id: "$sessionId", count: { $sum: 1 } } },
      ]),
      OpenPlaySessionPlayer.find({ sessionId: { $in: sessionIds }, playerId: req.user.userId }).select("sessionId").lean(),
      Club.find({ _id: { $in: clubIds } }).select("name location logo").lean(),
    ]);

    const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.count]));
    const joinedSet = new Set(myEntries.map(e => String(e.sessionId)));
    const clubMap = Object.fromEntries(clubs.map(c => [String(c._id), c]));

    res.json(sessions.map(s => ({
      ...s,
      club: clubMap[String(s.clubId)] || null,
      registeredCount: countMap[String(s._id)] || 0,
      joined: joinedSet.has(String(s._id)),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/open-play/player/sessions/:id/join
router.post("/player/sessions/:id/join", auth, async (req, res) => {
  try {
    const playerId = req.user.userId;
    const session = await OpenPlaySession.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "open") return res.status(400).json({ error: "This session is no longer open for registration" });

    const count = await OpenPlaySessionPlayer.countDocuments({ sessionId: session._id });
    if (count >= session.maxPlayers) return res.status(400).json({ error: "This session is full" });

    const already = await OpenPlaySessionPlayer.findOne({ sessionId: session._id, playerId }).lean();
    if (already) return res.status(400).json({ error: "You are already registered for this session" });

    const ratingSnapshot = await getRatingSnapshot(session.clubId, playerId, session.sport);

    await OpenPlaySessionPlayer.create({
      sessionId: session._id,
      clubId: session.clubId,
      playerId,
      ratingSnapshot,
      checkedIn: true,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/open-play/player/sessions/:id/join
router.delete("/player/sessions/:id/join", auth, async (req, res) => {
  try {
    const session = await OpenPlaySession.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "open") return res.status(400).json({ error: "You can only unjoin sessions that are still open" });

    const result = await OpenPlaySessionPlayer.findOneAndDelete({ sessionId: session._id, playerId: req.user.userId });
    if (!result) return res.status(404).json({ error: "You are not registered for this session" });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/open-play/player/my-sessions
// All sessions the logged-in player has joined (any club)
router.get("/player/my-sessions", auth, async (req, res) => {
  try {
    const entries = await OpenPlaySessionPlayer.find({ playerId: req.user.userId })
      .select("sessionId")
      .lean();
    const sessionIds = entries.map(e => e.sessionId);
    const sessions = await OpenPlaySession.find({ _id: { $in: sessionIds } }).sort({ sessionDate: -1 }).lean();
    const clubIds = [...new Set(sessions.map(s => String(s.clubId)))];
    const clubs = await Club.find({ _id: { $in: clubIds } }).select("name location logo").lean();
    const clubMap = Object.fromEntries(clubs.map(c => [String(c._id), c]));
    res.json(sessions.map(s => ({ ...s, club: clubMap[String(s.clubId)] || null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/open-play/player/sessions/:id  — full session detail (any authenticated player)
router.get("/player/sessions/:id", auth, async (req, res) => {
  try {
    const session = await OpenPlaySession.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const club = await Club.findById(session.clubId).select("name location logo").lean();

    const [rawPlayers, rawMatches] = await Promise.all([
      OpenPlaySessionPlayer.find({ sessionId: session._id }).sort({ createdAt: 1 }).lean(),
      OpenPlayMatch.find({ sessionId: session._id }).sort({ createdAt: 1 }).lean(),
    ]);

    // Resolve player names explicitly
    const playerUserIds = rawPlayers.map(p => p.playerId).filter(Boolean).map(String);
    const matchUserIds = [...new Set(
      rawMatches.flatMap(m => [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2].filter(Boolean).map(String))
    )];
    const allIds = [...new Set([...playerUserIds, ...matchUserIds])];
    const users = await User.find({ _id: { $in: allIds } }).select("name").lean();
    const userMap = Object.fromEntries(users.map(u => [String(u._id), u]));

    const players = rawPlayers.map(p => ({
      ...p,
      playerId: p.playerId ? (userMap[String(p.playerId)] ?? null) : null,
    }));
    const matches = await attachPlayerNames(rawMatches);

    const myEntry = players.find(p => String(p.playerId?._id) === String(req.user.userId));

    res.json({
      ...session,
      club: club || null,
      players: players.map(p => ({
        _id: p._id,
        name: p.playerId?.name ?? p.guestName ?? "Guest",
        ratingSnapshot: p.ratingSnapshot,
        checkedIn: p.checkedIn,
        isMe: String(p.playerId?._id) === String(req.user.userId),
      })),
      matches,
      myEntry: myEntry ? { checkedIn: myEntry.checkedIn } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/open-play/player/leaderboard?sport=tennis  (any logged-in player can see)
router.get("/player/leaderboard", auth, async (req, res) => {
  try {
    const { sport } = req.query;
    if (!sport) return res.status(400).json({ error: "sport query param required" });
    const ratings = await OpenPlayRating.find({ clubId: req.user.clubId, sport })
      .populate("playerId", "name")
      .sort({ rating: -1 })
      .limit(50)
      .lean();
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ──────────────────────────────────────────────────────────────────

// GET /api/open-play/sessions?sport=tennis
router.get("/sessions", auth, admin, async (req, res) => {
  try {
    const { sport } = req.query;
    const filter = { clubId: req.user.clubId };
    if (sport) filter.sport = sport;
    const sessions = await OpenPlaySession.find(filter).sort({ sessionDate: -1 }).lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/open-play/sessions
router.post("/sessions", auth, admin, async (req, res) => {
  try {
    const { sport, title, sessionDate, startTime, endTime, maxPlayers, maxMatches, matchType, courts } = req.body;
    if (!sport || !title || !sessionDate || !startTime || !endTime) {
      return res.status(400).json({ error: "sport, title, sessionDate, startTime, endTime are required" });
    }
    const session = await OpenPlaySession.create({
      clubId: req.user.clubId,
      sport,
      title,
      sessionDate,
      startTime,
      endTime,
      maxPlayers: maxPlayers || 16,
      maxMatches: maxMatches || 8,
      matchType: matchType || "doubles",
      courts: Array.isArray(courts) ? courts.map(Number).filter(n => n > 0) : [],
    });

    const [club, rates] = await Promise.all([
      Club.findById(req.user.clubId).select("convenienceFeeRate convenienceFeeMode").lean(),
      Rates.findOne({ clubId: req.user.clubId }).lean(),
    ]);
    const sessionDay = new Date(sessionDate).getUTCDay();
    const sessionHours = Math.max(0, parseInt(endTime.split(":")[0], 10) - parseInt(startTime.split(":")[0], 10));
    const pricingModel = rates?.pricingModel === "tiered" ? "tiered" : "flat";
    const { courtFee: baseCourtFee } = computeCourtFee(
      pricingModel,
      { startHour: parseInt(startTime.split(":")[0], 10), dayOfWeek: sessionDay, isHoliday: false, durationHours: sessionHours },
      rates ?? {},
    );
    const feeMode = club?.convenienceFeeMode ?? 'per_hour';
    const feeRate = typeof club?.convenienceFeeRate === "number" ? club.convenienceFeeRate : 0.10;
    const fee = (feeMode === 'monthly_flat' || feeMode === 'club_absorbs')
      ? 0
      : parseFloat((baseCourtFee * feeRate).toFixed(2));

    await Charge.create({
      openPlaySessionId: session._id,
      amount: fee,
      breakdown: { convenienceFee: fee },
      chargeType: "open_play_session",
      status: "unpaid",
      approvalStatus: "none",
      clubId: req.user.clubId,
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/open-play/sessions/:id
router.put("/sessions/:id", auth, admin, async (req, res) => {
  try {
    const { title, sessionDate, startTime, endTime, maxPlayers, maxMatches, matchType, courts } = req.body;
    const update = { title, sessionDate, startTime, endTime, maxPlayers, maxMatches, matchType };
    if (Array.isArray(courts)) update.courts = courts.map(Number).filter(n => n > 0);
    const session = await OpenPlaySession.findOneAndUpdate(
      { _id: req.params.id, clubId: req.user.clubId },
      update,
      { new: true, runValidators: true },
    );
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/open-play/sessions/:id/status
router.patch("/sessions/:id/status", auth, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["open", "in_progress", "completed", "cancelled"];
    if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const session = await OpenPlaySession.findOneAndUpdate(
      { _id: req.params.id, clubId: req.user.clubId },
      { status },
      { new: true },
    );
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (status === "cancelled") {
      await Charge.deleteOne({ openPlaySessionId: session._id, chargeType: "open_play_session", status: "unpaid" });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/open-play/sessions/:id
router.delete("/sessions/:id", auth, admin, async (req, res) => {
  try {
    const session = await OpenPlaySession.findOneAndDelete({ _id: req.params.id, clubId: req.user.clubId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    await Promise.all([
      OpenPlaySessionPlayer.deleteMany({ sessionId: session._id }),
      OpenPlayMatch.deleteMany({ sessionId: session._id }),
      Charge.deleteOne({ openPlaySessionId: session._id, chargeType: "open_play_session", status: "unpaid" }),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Session Players ───────────────────────────────────────────────────────────

// GET /api/open-play/sessions/:id/players
router.get("/sessions/:id/players", auth, admin, async (req, res) => {
  try {
    const session = await OpenPlaySession.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const players = await OpenPlaySessionPlayer.find({ sessionId: session._id }).lean();
    const uids = players.map(p => p.playerId).filter(Boolean).map(String);
    const users = await User.find({ _id: { $in: uids } }).select("name username email").lean();
    const uMap = Object.fromEntries(users.map(u => [String(u._id), u]));
    res.json(players.map(p => ({ ...p, playerId: p.playerId ? (uMap[String(p.playerId)] ?? null) : null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/open-play/sessions/:id/players
router.post("/sessions/:id/players", auth, admin, async (req, res) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    const session = await OpenPlaySession.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "open") return res.status(400).json({ error: "Session is not open for registration" });

    const count = await OpenPlaySessionPlayer.countDocuments({ sessionId: session._id });
    if (count >= session.maxPlayers) return res.status(400).json({ error: "Session is full" });

    const already = await OpenPlaySessionPlayer.findOne({ sessionId: session._id, playerId }).lean();
    if (already) return res.status(400).json({ error: "Player is already registered" });

    const ratingSnapshot = await getRatingSnapshot(session.clubId, playerId, session.sport);

    const entry = await OpenPlaySessionPlayer.create({
      sessionId: session._id,
      clubId: session.clubId,
      playerId,
      ratingSnapshot,
      checkedIn: true,
    });
    const user = await User.findById(playerId).select("name username email").lean();
    res.status(201).json({ ...entry.toObject(), playerId: user ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/open-play/sessions/:id/players/:entryId
router.delete("/sessions/:id/players/:entryId", auth, admin, async (req, res) => {
  try {
    const removed = await OpenPlaySessionPlayer.findOneAndDelete({ _id: req.params.entryId, clubId: req.user.clubId });
    if (!removed) return res.status(404).json({ error: "Player entry not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/open-play/sessions/:id/players/:entryId/checkin
router.patch("/sessions/:id/players/:entryId/checkin", auth, admin, async (req, res) => {
  try {
    const { checkedIn } = req.body;
    const entry = await OpenPlaySessionPlayer.findOneAndUpdate(
      { _id: req.params.entryId, clubId: req.user.clubId },
      { checkedIn: checkedIn !== undefined ? checkedIn : true },
      { new: true, lean: true },
    );
    if (!entry) return res.status(404).json({ error: "Player entry not found" });
    const user = entry.playerId ? await User.findById(entry.playerId).select("name username email").lean() : null;
    res.json({ ...entry, playerId: user ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Match Generation ──────────────────────────────────────────────────────────

// POST /api/open-play/sessions/:id/generate-matches
router.post("/sessions/:id/generate-matches", auth, admin, async (req, res) => {
  try {
    const session = await OpenPlaySession.findOne({ _id: req.params.id, clubId: req.user.clubId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });

    const sessionPlayers = await OpenPlaySessionPlayer.find({ sessionId: session._id, checkedIn: true }).lean();
    if (sessionPlayers.length < 2) {
      return res.status(400).json({ error: "Need at least 2 checked-in players to generate matches" });
    }

    await OpenPlayMatch.deleteMany({ sessionId: session._id });

    const playerInput = sessionPlayers.map(p => ({
      playerId: p.playerId || p._id,
      ratingSnapshot: p.ratingSnapshot || 3.5,
    }));

    const matchData = balanceCourts(playerInput, session.maxMatches || 8);

    const inserts = matchData.map(m => ({
      sessionId: session._id,
      clubId: session.clubId,
      court: m.court,
      team1Player1: m.team1Player1,
      team1Player2: m.team1Player2 || undefined,
      team2Player1: m.team2Player1,
      team2Player2: m.team2Player2 || undefined,
    }));

    const created = await OpenPlayMatch.insertMany(inserts);
    res.status(201).json(await attachPlayerNames(created.map(m => m.toObject())));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/open-play/sessions/:id/matches
router.get("/sessions/:id/matches", auth, admin, async (req, res) => {
  try {
    const matches = await OpenPlayMatch.find({ sessionId: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json(await attachPlayerNames(matches));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/open-play/matches/:matchId  — edit match player assignments
router.patch("/matches/:matchId", auth, admin, async (req, res) => {
  try {
    const { team1Player1, team1Player2, team2Player1, team2Player2 } = req.body;
    if (!team1Player1 || !team2Player1) {
      return res.status(400).json({ error: "team1Player1 and team2Player1 are required" });
    }
    const match = await OpenPlayMatch.findOneAndUpdate(
      { _id: req.params.matchId, clubId: req.user.clubId },
      {
        team1Player1,
        team1Player2: team1Player2 || null,
        team2Player1,
        team2Player2: team2Player2 || null,
      },
      { new: true, lean: true },
    );
    if (!match) return res.status(404).json({ error: "Match not found" });
    const [withNames] = await attachPlayerNames([match]);
    res.json(withNames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/open-play/matches/:matchId/score
router.patch("/matches/:matchId/score", auth, admin, async (req, res) => {
  try {
    const { team1Score, team2Score } = req.body;
    if (team1Score === undefined || team2Score === undefined) {
      return res.status(400).json({ error: "team1Score and team2Score required" });
    }
    if (team1Score === team2Score) {
      return res.status(400).json({ error: "Scores cannot be tied" });
    }

    const match = await OpenPlayMatch.findOne({ _id: req.params.matchId, clubId: req.user.clubId }).lean();
    if (!match) return res.status(404).json({ error: "Match not found" });

    const session = await OpenPlaySession.findById(match.sessionId).select("sport").lean();
    const sport = session?.sport || "tennis";

    const [r11, r12, r21, r22] = await Promise.all([
      OpenPlayRating.findOne({ clubId: match.clubId, playerId: match.team1Player1, sport }).lean(),
      match.team1Player2 ? OpenPlayRating.findOne({ clubId: match.clubId, playerId: match.team1Player2, sport }).lean() : null,
      OpenPlayRating.findOne({ clubId: match.clubId, playerId: match.team2Player1, sport }).lean(),
      match.team2Player2 ? OpenPlayRating.findOne({ clubId: match.clubId, playerId: match.team2Player2, sport }).lean() : null,
    ]);

    const t1Avg = ((r11?.rating || 3.5) + (r12?.rating || 3.5)) / (match.team1Player2 ? 2 : 1);
    const t2Avg = ((r21?.rating || 3.5) + (r22?.rating || 3.5)) / (match.team2Player2 ? 2 : 1);
    const t1Won = team1Score > team2Score;
    const scoreDiff = Math.abs(team1Score - team2Score);

    await Promise.all([
      upsertRating(match.clubId, match.team1Player1, sport, t1Won, t1Avg, t2Avg, scoreDiff),
      match.team1Player2 ? upsertRating(match.clubId, match.team1Player2, sport, t1Won, t1Avg, t2Avg, scoreDiff) : null,
      upsertRating(match.clubId, match.team2Player1, sport, !t1Won, t2Avg, t1Avg, scoreDiff),
      match.team2Player2 ? upsertRating(match.clubId, match.team2Player2, sport, !t1Won, t2Avg, t1Avg, scoreDiff) : null,
    ].filter(Boolean));

    const updated = await OpenPlayMatch.findByIdAndUpdate(
      req.params.matchId,
      { team1Score, team2Score, status: "completed" },
      { new: true, lean: true },
    );

    const [withNames] = await attachPlayerNames([updated]);
    res.json(withNames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Leaderboard ───────────────────────────────────────────────────────────────

// GET /api/open-play/leaderboard?sport=tennis
router.get("/leaderboard", auth, admin, async (req, res) => {
  try {
    const { sport } = req.query;
    if (!sport) return res.status(400).json({ error: "sport query param required" });

    const ratings = await OpenPlayRating.find({ clubId: req.user.clubId, sport })
      .populate("playerId", "name username")
      .sort({ rating: -1 })
      .limit(50)
      .lean();
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
