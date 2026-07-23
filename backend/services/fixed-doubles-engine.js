"use strict";

/**
 * Fixed Doubles Rotation engine — pure functions, no DB access.
 *
 * Unlike queue-engine.js (dynamic pull-from-waiting-pool rotation), this
 * format generates a complete round-robin schedule upfront: every pair plays
 * every other pair exactly once, partners never change, and the schedule
 * (court + start/end time per match) is fixed at generation time. This is a
 * structurally different implementation of the same five format concerns
 * (registration rules, match generation, court assignment, rotation logic,
 * standings calculation) that queue-engine.js's strategies implement for the
 * live-queue formats — see hosted-play-format-registry.js.
 */

// ── Schedule generation ──────────────────────────────────────────────────────

// Standard circle/polygon method. Works for any pair count >= 2; odd counts
// get a phantom BYE slot so every real pair sits out exactly one round.
function generateRoundRobin(pairIds) {
  const ids = pairIds.map((id) => String(id));
  const hasBye = ids.length % 2 !== 0;
  const slots = hasBye ? [...ids, null] : [...ids];
  const n = slots.length; // always even
  const rounds = [];

  let arr = [...slots];
  for (let r = 0; r < n - 1; r++) {
    const matchups = [];
    let byePairId = null;
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === null) byePairId = b;
      else if (b === null) byePairId = a;
      else matchups.push({ pair1Id: a, pair2Id: b });
    }
    rounds.push({ roundNumber: r + 1, matchups, byePairId });

    // Rotate everything except index 0 by one position.
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }
  return { rounds };
}

const MIN_MATCH_DURATION_MINUTES = 5;

// Auto-fits match duration to the session's time window instead of requiring
// the organizer to guess one: divide the window by however many sequential
// "rounds of court usage" the full round-robin needs. Clamped to a sane
// minimum — mapScheduleToCourtsAndTimes still reports an overrun warning if
// the window is too tight even at that minimum (not enough time, not a bug).
function computeMatchDuration({ pairCount, numberOfCourts, sessionStart, sessionEnd, restBetweenMatchesMinutes = 0 }) {
  const totalMatches = (pairCount * (pairCount - 1)) / 2;
  const courts = Math.max(1, numberOfCourts || 1);
  const roundsNeeded = Math.ceil(totalMatches / courts);
  const totalWindowMinutes = (new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 60000;
  const perSlot = totalWindowMinutes / roundsNeeded;
  return Math.max(MIN_MATCH_DURATION_MINUTES, Math.floor(perSlot - restBetweenMatchesMinutes));
}

// Maps generated rounds onto real courts/times. Processes matches in round
// order, greedily assigning each to whichever court is earliest available —
// but a match can never start before BOTH its pairs are free (tracked via
// pairAvailableAt), so no pair is ever double-booked across courts even when
// court counts don't evenly divide matches-per-round (e.g. with byes).
function mapScheduleToCourtsAndTimes({
  rounds,
  numberOfCourts,
  matchDurationMinutes,
  restBetweenMatchesMinutes = 0,
  sessionStart,
  sessionEnd,
}) {
  const start = new Date(sessionStart);
  const courtAvailableAt = {};
  for (let c = 1; c <= numberOfCourts; c++) courtAvailableAt[c] = start;
  const pairAvailableAt = new Map();
  const availableFor = (pairId) => pairAvailableAt.get(String(pairId)) || start;

  const fixtures = [];
  for (const round of rounds) {
    for (const matchup of round.matchups) {
      const pairReadyAt = new Date(
        Math.max(availableFor(matchup.pair1Id).getTime(), availableFor(matchup.pair2Id).getTime()),
      );

      let bestCourt = 1;
      let bestStart = null;
      for (let c = 1; c <= numberOfCourts; c++) {
        const candidate = new Date(Math.max(courtAvailableAt[c].getTime(), pairReadyAt.getTime()));
        if (bestStart === null || candidate < bestStart) {
          bestStart = candidate;
          bestCourt = c;
        }
      }
      const scheduledStart = bestStart;
      const scheduledEnd = new Date(scheduledStart.getTime() + matchDurationMinutes * 60000);

      fixtures.push({
        roundNumber: round.roundNumber,
        pair1Id: matchup.pair1Id,
        pair2Id: matchup.pair2Id,
        courtNumber: bestCourt,
        scheduledStart,
        scheduledEnd,
      });

      courtAvailableAt[bestCourt] = scheduledEnd;
      const pairNextAvailable = new Date(scheduledEnd.getTime() + restBetweenMatchesMinutes * 60000);
      pairAvailableAt.set(String(matchup.pair1Id), pairNextAvailable);
      pairAvailableAt.set(String(matchup.pair2Id), pairNextAvailable);
    }
  }

  // Final play order reflects real scheduled time, not raw round order.
  fixtures.sort((a, b) => a.scheduledStart - b.scheduledStart || a.courtNumber - b.courtNumber);
  fixtures.forEach((f, i) => {
    f.matchNumber = i + 1;
  });

  const warnings = [];
  if (sessionEnd) {
    const end = new Date(sessionEnd);
    const last = fixtures.reduce((max, f) => (f.scheduledEnd > max ? f.scheduledEnd : max), start);
    if (last > end) {
      const overMinutes = Math.round((last.getTime() - end.getTime()) / 60000);
      warnings.push(`Schedule extends ${overMinutes} minute${overMinutes === 1 ? "" : "s"} past the configured end time.`);
    }
  }

  return { fixtures, warnings };
}

// ── Lock / lifecycle ─────────────────────────────────────────────────────────

// Teams, players, and the schedule freeze the moment any fixture leaves
// "scheduled" — i.e. once the first match starts.
function isLocked(fixtures) {
  return fixtures.some((f) => f.status !== "scheduled");
}

// Winner resolution at finish time. Scores are required (unlike the live-queue
// finish flow) since standings need real Points For/Against. A tapped winner
// is authoritative; a tie with no tapped winner is rejected.
function deriveFixtureWinner({ pair1Score, pair2Score, winnerPairId, pair1Id, pair2Id }) {
  if (!Number.isInteger(pair1Score) || !Number.isInteger(pair2Score) || pair1Score < 0 || pair2Score < 0) {
    return { error: "Both scores are required and must be non-negative whole numbers" };
  }
  if (winnerPairId) {
    const winId = String(winnerPairId);
    if (winId !== String(pair1Id) && winId !== String(pair2Id)) {
      return { error: "Winner must be one of the two pairs in this match" };
    }
    const winnerScore = winId === String(pair1Id) ? pair1Score : pair2Score;
    const loserScore = winId === String(pair1Id) ? pair2Score : pair1Score;
    if (winnerScore <= loserScore) return { error: "Scores contradict the selected winner" };
    return { winnerPairId: winId, winnerSource: "tapped" };
  }
  if (pair1Score === pair2Score) {
    return { error: "Scores are tied — select a winner" };
  }
  return { winnerPairId: pair1Score > pair2Score ? String(pair1Id) : String(pair2Id), winnerSource: "scores" };
}

// ── Umpire live scoring (pickleball side-out) ────────────────────────────────
// Same state machine as the live-queue umpire routes' inline logic, scoped to
// one fixture's pair1/pair2 snapshot instead of a court-keyed session array.
// Pure — callers apply the returned patch to the fixture doc and save it.

function fixturePairPlayers(fixture, pair) {
  const snapshot = pair === 1 ? fixture.pair1Snapshot : fixture.pair2Snapshot;
  return snapshot?.players || [];
}

function snapshotLiveState(fixture) {
  return {
    pair1Score: fixture.pair1Score,
    pair2Score: fixture.pair2Score,
    servingPair: fixture.servingPair,
    serverNumber: fixture.serverNumber,
    servingParticipantId: fixture.servingParticipantId,
    pair1RightParticipantId: fixture.pair1RightParticipantId,
    pair2RightParticipantId: fixture.pair2RightParticipantId,
  };
}

// Picks who serves first for a fresh game on this fixture. Only allowed
// before any point has been played (mirrors start-serve for live-queue).
function startFixtureServe({ fixture, pair, participantId }) {
  if (![1, 2].includes(pair)) return { error: "Invalid team" };
  if ((fixture.pair1Score || 0) > 0 || (fixture.pair2Score || 0) > 0) {
    return { error: "Scoring has already started for this game" };
  }
  const chosen = fixturePairPlayers(fixture, pair);
  if (!chosen.some((p) => String(p.participantId) === String(participantId))) {
    return { error: "That player is not on this team" };
  }
  return {
    pair1Score: 0,
    pair2Score: 0,
    servingPair: pair,
    serverNumber: chosen.length >= 2 ? 2 : 1,
    servingParticipantId: participantId,
    pair1RightParticipantId: pair === 1 ? participantId : null,
    pair2RightParticipantId: pair === 2 ? participantId : null,
    previousLiveState: null,
  };
}

// Resolves who's serving for the current serving pair — first side-out of the
// game, or a manual correction. Doesn't touch scores.
function setFixtureServer({ fixture, participantId }) {
  if (!fixture.servingPair) return { error: "Choose who serves first" };
  const servingPlayers = fixturePairPlayers(fixture, fixture.servingPair);
  if (!servingPlayers.some((p) => String(p.participantId) === String(participantId))) {
    return { error: "That player is not on the serving team" };
  }
  const previousLiveState = snapshotLiveState(fixture);
  let rightParticipantId = participantId;
  if (fixture.serverNumber === 2) {
    const partner = servingPlayers.find((p) => String(p.participantId) !== String(participantId));
    rightParticipantId = partner ? partner.participantId : participantId;
  }
  const rightField = fixture.servingPair === 1 ? "pair1RightParticipantId" : "pair2RightParticipantId";
  return {
    servingParticipantId: participantId,
    [rightField]: rightParticipantId,
    previousLiveState,
  };
}

// The pair that just won the rally. Whether that's a point or a side-out (and
// whether serve just rotates to the server's partner or passes across) is
// derived here — the umpire always taps the same two buttons.
function fixtureRallyWon({ fixture, pair }) {
  if (![1, 2].includes(pair)) return { error: "Invalid team" };
  if (!fixture.servingPair) return { error: "Choose who serves first" };
  if (!fixture.servingParticipantId) return { error: "Choose who's serving" };

  const previousLiveState = snapshotLiveState(fixture);
  let pair1Score = fixture.pair1Score || 0;
  let pair2Score = fixture.pair2Score || 0;
  let servingPair = fixture.servingPair;
  let serverNumber = fixture.serverNumber;
  let servingParticipantId = fixture.servingParticipantId;
  let pair1RightParticipantId = fixture.pair1RightParticipantId;
  let pair2RightParticipantId = fixture.pair2RightParticipantId;

  if (pair === servingPair) {
    // Server won — a point. Server keeps serving; the pair swaps sides, so
    // the right-side record flips to the partner.
    if (servingPair === 1) pair1Score += 1; else pair2Score += 1;
    const servingPlayers = fixturePairPlayers(fixture, servingPair);
    const partner = servingPlayers.find((p) => String(p.participantId) !== String(servingParticipantId));
    const newRight = partner ? partner.participantId : servingParticipantId;
    if (servingPair === 1) pair1RightParticipantId = newRight; else pair2RightParticipantId = newRight;
  } else {
    // Receiver won — no score change. Serve rotates to the server's partner
    // (still that pair, server 2), or is a full side-out.
    const servingPlayers = fixturePairPlayers(fixture, servingPair);
    if (servingPlayers.length >= 2 && serverNumber === 1) {
      serverNumber = 2;
      const partner = servingPlayers.find((p) => String(p.participantId) !== String(servingParticipantId));
      servingParticipantId = partner ? partner.participantId : servingParticipantId;
    } else {
      // Full side-out. Positions don't change — whoever's on the right for
      // the new serving pair becomes server 1, resolved automatically once
      // known from an earlier turn; only that pair's first side-out needs
      // the umpire to pick it (via set-server).
      servingPair = pair;
      serverNumber = 1;
      const winningPlayers = fixturePairPlayers(fixture, pair);
      const knownRight = pair === 1 ? pair1RightParticipantId : pair2RightParticipantId;
      if (winningPlayers.length === 1) {
        servingParticipantId = winningPlayers[0].participantId;
      } else if (knownRight) {
        servingParticipantId = knownRight;
      } else {
        servingParticipantId = null;
      }
    }
  }

  return { pair1Score, pair2Score, servingPair, serverNumber, servingParticipantId, pair1RightParticipantId, pair2RightParticipantId, previousLiveState };
}

// Reverts the last rally-won call (or start-serve pick). Single level only.
function undoFixtureLiveState(fixture) {
  if (!fixture.previousLiveState) return { error: "Nothing to undo" };
  const prev = fixture.previousLiveState;
  return {
    pair1Score: prev.pair1Score,
    pair2Score: prev.pair2Score,
    servingPair: prev.servingPair,
    serverNumber: prev.serverNumber,
    servingParticipantId: prev.servingParticipantId ?? null,
    pair1RightParticipantId: prev.pair1RightParticipantId ?? null,
    pair2RightParticipantId: prev.pair2RightParticipantId ?? null,
    previousLiveState: null,
  };
}

// ── Standings (session-scoped, recomputed fresh on every board read) ────────

function computeStandings(pairs, completedFixtures) {
  const stats = new Map();
  const ensure = (pair) => {
    const key = String(pair._id ?? pair);
    if (!stats.has(key)) {
      stats.set(key, {
        pairId: key,
        pairLabel: pair.pairLabel || "",
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }
    return stats.get(key);
  };
  for (const pair of pairs) ensure(pair);

  // headToHead[a][b] = winner pairId string, for pairs that have played directly.
  const headToHead = new Map();
  const recordH2H = (aId, bId, winnerId) => {
    const aKey = String(aId);
    const bKey = String(bId);
    if (!headToHead.has(aKey)) headToHead.set(aKey, new Map());
    if (!headToHead.has(bKey)) headToHead.set(bKey, new Map());
    headToHead.get(aKey).set(bKey, winnerId);
    headToHead.get(bKey).set(aKey, winnerId);
  };

  for (const f of completedFixtures) {
    if (f.pair1Score == null || f.pair2Score == null || !f.winnerPairId) continue;
    const s1 = ensure({ _id: f.pair1Id });
    const s2 = ensure({ _id: f.pair2Id });
    s1.pointsFor += f.pair1Score;
    s1.pointsAgainst += f.pair2Score;
    s2.pointsFor += f.pair2Score;
    s2.pointsAgainst += f.pair1Score;
    const winnerId = String(f.winnerPairId);
    if (winnerId === String(f.pair1Id)) {
      s1.wins += 1;
      s2.losses += 1;
    } else {
      s2.wins += 1;
      s1.losses += 1;
    }
    recordH2H(f.pair1Id, f.pair2Id, winnerId);
  }

  const rows = [...stats.values()].map((s) => {
    const gamesPlayed = s.wins + s.losses;
    return {
      ...s,
      winPct: gamesPlayed > 0 ? s.wins / gamesPlayed : 0,
      pointDiff: s.pointsFor - s.pointsAgainst,
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const h2h = headToHead.get(a.pairId)?.get(b.pairId);
    if (h2h === a.pairId) return -1;
    if (h2h === b.pairId) return 1;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return 0;
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

// ── Board projection (read-only) ─────────────────────────────────────────────

function toPublicPair(pair) {
  return {
    _id: String(pair._id),
    pairLabel: pair.pairLabel || "",
    status: pair.status,
    source: pair.source,
    inviteStatus: pair.inviteStatus,
    participantAId: pair.participantAId ? String(pair.participantAId) : null,
    participantBId: pair.participantBId ? String(pair.participantBId) : null,
    invitedMemberId: pair.invitedMemberId ? String(pair.invitedMemberId) : null,
  };
}

function toPublicFixture(f) {
  return {
    _id: String(f._id),
    matchNumber: f.matchNumber,
    roundNumber: f.roundNumber,
    courtNumber: f.courtNumber,
    scheduledStart: f.scheduledStart,
    scheduledEnd: f.scheduledEnd,
    actualStart: f.actualStart ?? null,
    actualEnd: f.actualEnd ?? null,
    status: f.status,
    pair1: f.pair1Snapshot,
    pair2: f.pair2Snapshot,
    pair1Id: String(f.pair1Id),
    pair2Id: String(f.pair2Id),
    pair1Score: f.pair1Score ?? null,
    pair2Score: f.pair2Score ?? null,
    winnerPairId: f.winnerPairId ? String(f.winnerPairId) : null,
    // Umpire live-scoring side-out state (pickleball) — present while a match
    // is in_progress and someone has picked a first server; null otherwise.
    servingPair: f.servingPair ?? null,
    serverNumber: f.serverNumber ?? null,
    servingParticipantId: f.servingParticipantId ? String(f.servingParticipantId) : null,
  };
}

// Live Match Queue read model: current/next/upcoming/completed per court, plus
// standings and who's on a bye this round.
function buildBoard(session, pairs, fixtures) {
  const confirmedPairs = pairs.filter((p) => p.status === "confirmed");
  const sorted = [...fixtures].sort((a, b) => a.matchNumber - b.matchNumber);
  const completed = sorted.filter((f) => f.status === "completed");
  const notCompleted = sorted.filter((f) => f.status !== "completed");

  const byCourt = new Map();
  for (const f of notCompleted) {
    if (!byCourt.has(f.courtNumber)) byCourt.set(f.courtNumber, []);
    byCourt.get(f.courtNumber).push(f);
  }

  const currentMatches = [];
  const nextMatches = [];
  const seenIds = new Set();
  for (const [, list] of byCourt) {
    list.sort((a, b) => a.matchNumber - b.matchNumber);
    const current = list.find((f) => f.status === "in_progress") || list[0];
    if (current) {
      currentMatches.push(current);
      seenIds.add(String(current._id));
    }
    const next = list.find((f) => String(f._id) !== String(current?._id));
    if (next) {
      nextMatches.push(next);
      seenIds.add(String(next._id));
    }
  }
  const upcomingMatches = notCompleted.filter((f) => !seenIds.has(String(f._id)));

  // Prefer real player names over the generic "Pair N" label everywhere a pair
  // is displayed — sourced from any fixture's snapshot (every confirmed pair
  // has one once a schedule exists, whether or not they've played yet).
  const pairDisplayNameById = new Map();
  for (const f of sorted) {
    for (const [id, snapshot] of [[f.pair1Id, f.pair1Snapshot], [f.pair2Id, f.pair2Snapshot]]) {
      const key = String(id);
      if (!pairDisplayNameById.has(key)) {
        const names = (snapshot.players || []).map((p) => p.memberName).filter(Boolean).join(" & ");
        if (names) pairDisplayNameById.set(key, names);
      }
    }
  }
  const activeRound = notCompleted.length > 0 ? Math.min(...notCompleted.map((f) => f.roundNumber)) : null;
  const byesThisRound = [];
  if (activeRound != null) {
    const playingPairIds = new Set(
      sorted.filter((f) => f.roundNumber === activeRound).flatMap((f) => [String(f.pair1Id), String(f.pair2Id)]),
    );
    for (const pair of confirmedPairs) {
      if (!playingPairIds.has(String(pair._id))) byesThisRound.push({ roundNumber: activeRound, pairId: String(pair._id) });
    }
  }

  return {
    session: {
      _id: session._id,
      title: session.title,
      status: session.status,
      venue: session.venue,
      court: session.court,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      queueMode: session.queueMode,
      numberOfCourts: session.numberOfCourts || 1,
      sport: session.sport,
      fixedDoubles: session.fixedDoubles || null,
    },
    pairs: pairs.map(toPublicPair),
    currentMatches: currentMatches.map(toPublicFixture),
    nextMatches: nextMatches.map(toPublicFixture),
    upcomingMatches: upcomingMatches.map(toPublicFixture),
    completedMatches: completed.map(toPublicFixture),
    standings: computeStandings(confirmedPairs, completed).map((s) => ({
      ...s,
      pairLabel: pairDisplayNameById.get(s.pairId) || s.pairLabel,
    })),
    byesThisRound,
    locked: isLocked(fixtures),
  };
}

module.exports = {
  generateRoundRobin,
  computeMatchDuration,
  mapScheduleToCourtsAndTimes,
  isLocked,
  deriveFixtureWinner,
  computeStandings,
  buildBoard,
  // umpire live scoring
  startFixtureServe,
  setFixtureServer,
  fixtureRallyWon,
  undoFixtureLiveState,
};
