"use strict";

/**
 * Hosted Play queue engine — pure functions, no DB access.
 *
 * Each operation receives an in-memory snapshot `{ session, participants }`
 * (plain objects, e.g. from `.lean()`), mutates the participant objects in
 * place, and returns `{ changed, sessionUpdate }` where:
 *   - `changed` is the list of participant objects that were modified
 *   - `sessionUpdate` (optional) is a `$set` payload for the HostedPlay doc
 * The route layer is responsible for persisting the result.
 *
 * Participants are the single source of truth: a player is in exactly one
 * state (not_checked_in | waiting | playing | paused | done). "Courts" are
 * derived by grouping `playing` participants by `courtNumber`.
 *
 * Queue modes are pluggable via `strategies`. V1 ships `fcfs`; future modes
 * (winner_stays, king_of_court, skill_rotation) only implement the same
 * strategy interface — no engine refactor required.
 */

const STEP = 1000; // gap between queue positions so reorder/append never renumbers everyone
const KING_STREAK_CAP = 3; // king_of_court: winners must abdicate after this many consecutive holds

// ── Strategy interface ───────────────────────────────────────────────────────
// A strategy = {
//   needsWinner?: boolean                      whether onFinish requires winnerSet
//   pickGroup(waiting, size, session)          -> participants to send onto a free court
//   onFinish(courtPlayers, session, winnerSet) -> { requeue: [...], keepOnCourt: [...] }
// }
const strategies = {
  // First-come-first-served: everyone rotates off after each game (fairness by games played).
  fcfs: {
    pickGroup(waiting, size) {
      return waiting.slice(0, size);
    },
    onFinish(courtPlayers) {
      return { requeue: courtPlayers, keepOnCourt: [] };
    },
  },

  // Challenge court: the winning side stays on, losers go to the back of the line.
  winner_stays: {
    needsWinner: true,
    pickGroup(waiting, size) {
      return waiting.slice(0, size);
    },
    onFinish(courtPlayers, session, winnerSet) {
      const winners = courtPlayers.filter((p) => winnerSet.has(String(p._id)));
      const losers = courtPlayers.filter((p) => !winnerSet.has(String(p._id)));
      return { requeue: losers, keepOnCourt: winners };
    },
  },

  // King of the court: winners defend the court, but must abdicate after a capped
  // streak of consecutive holds so no group dominates all night.
  king_of_court: {
    needsWinner: true,
    pickGroup(waiting, size) {
      return waiting.slice(0, size);
    },
    onFinish(courtPlayers, session, winnerSet) {
      const cap = session.kingStreakCap || KING_STREAK_CAP;
      const winners = courtPlayers.filter((p) => winnerSet.has(String(p._id)));
      const losers = courtPlayers.filter((p) => !winnerSet.has(String(p._id)));
      const staying = winners.filter((p) => (p.courtStreak || 0) + 1 < cap);
      const abdicating = winners.filter((p) => (p.courtStreak || 0) + 1 >= cap);
      return { requeue: [...losers, ...abdicating], keepOnCourt: staying };
    },
  },
};

function strategyFor(session) {
  return strategies[session.queueMode] || strategies.fcfs;
}

// ── Selectors (read-only) ────────────────────────────────────────────────────
function byOrder(a, b) {
  const gamesDiff = (a.gamesPlayed || 0) - (b.gamesPlayed || 0);
  if (gamesDiff !== 0) return gamesDiff;
  return (a.queueOrder ?? Infinity) - (b.queueOrder ?? Infinity);
}

function getWaiting(participants) {
  return participants.filter((p) => p.queueStatus === "waiting").sort(byOrder);
}

function getPlaying(participants) {
  return participants.filter((p) => p.queueStatus === "playing");
}

function getPaused(participants) {
  return participants.filter((p) => p.queueStatus === "paused");
}

function getCourtPlayers(participants, courtNumber) {
  return participants.filter(
    (p) => p.queueStatus === "playing" && p.courtNumber === courtNumber,
  );
}

// Lowest unoccupied slot (1..size) on a court — slot position determines team
// (low half = Team A, high half = Team B) for board display purposes.
function nextFreeSlot(participants, courtNumber, size) {
  const taken = new Set(getCourtPlayers(participants, courtNumber).map((p) => p.courtSlot));
  for (let s = 1; s <= size; s++) if (!taken.has(s)) return s;
  return null;
}

// Courts with zero playing participants (auto-assign targets).
function getFreeCourts(participants, session) {
  const n = session.numberOfCourts || 1;
  const occupied = new Set(getPlaying(participants).map((p) => p.courtNumber));
  const free = [];
  for (let c = 1; c <= n; c++) if (!occupied.has(c)) free.push(c);
  return free;
}

function maxWaitingOrder(participants) {
  return participants
    .filter((p) => p.queueStatus === "waiting" && typeof p.queueOrder === "number")
    .reduce((m, p) => Math.max(m, p.queueOrder), 0);
}

function find(participants, id) {
  return participants.find((p) => String(p._id) === String(id));
}

// ── Internal mutators (mutate participant + record in `dirty`) ───────────────
function enqueueToEnd(participant, participants, dirty) {
  participant.queueStatus = "waiting";
  participant.courtNumber = null;
  participant.courtSlot = null;
  participant.queueOrder = maxWaitingOrder(participants) + STEP;
  participant.enteredQueueAt = new Date();
  dirty.add(participant);
}

// Top up courts that already have players but are short of playersPerCourt.
// Pulls one waiting player per open slot, in queue order.
function fillPartialCourts(session, participants, dirty) {
  const size = session.playersPerCourt || 4;
  const n = session.numberOfCourts || 1;
  for (let c = 1; c <= n; c++) {
    const playing = getCourtPlayers(participants, c);
    const slots = size - playing.length;
    if (slots <= 0 || playing.length === 0) continue; // full or empty — skip
    for (let s = 0; s < slots; s++) {
      const next = getWaiting(participants)[0]; // recompute after each fill
      if (!next) break;
      next.queueStatus = "playing";
      next.courtNumber = c;
      next.courtSlot = nextFreeSlot(participants, c, size);
      next.queueOrder = null;
      dirty.add(next);
    }
  }
}

// Fill every free court with a full group, if enough players are waiting.
// All-or-nothing: a court is only assigned when >= playersPerCourt are waiting.
function assignFreeCourts(session, participants, dirty) {
  const size = session.playersPerCourt || 4;
  const strat = strategyFor(session);
  const freeCourts = getFreeCourts(participants, session);

  for (const court of freeCourts) {
    const waiting = getWaiting(participants); // recompute — previous iterations consumed players
    if (waiting.length < size) break; // groups are fixed-size; later courts can't fill either
    const group = strat.pickGroup(waiting, size, session);
    group.forEach((p, i) => {
      p.queueStatus = "playing";
      p.courtNumber = court;
      p.courtSlot = i + 1; // slot order = pick order: low half Team A, high half Team B
      p.queueOrder = null;
      dirty.add(p);
    });
  }
}

// ── Operations (return { changed, sessionUpdate? }) ──────────────────────────
function startQueue(session, participants) {
  const dirty = new Set();
  const toSeed = participants
    .filter((p) => p.checkedIn && p.queueStatus === "not_checked_in")
    .sort(
      (a, b) =>
        new Date(a.checkedInAt || a.createdAt || 0) -
        new Date(b.checkedInAt || b.createdAt || 0),
    );

  let order = maxWaitingOrder(participants);
  for (const p of toSeed) {
    order += STEP;
    p.queueStatus = "waiting";
    p.queueOrder = order;
    p.enteredQueueAt = new Date();
    dirty.add(p);
  }

  assignFreeCourts(session, participants, dirty);
  return {
    changed: [...dirty],
    sessionUpdate: { queueStatus: "running", queueStartedAt: new Date() },
  };
}

function endQueue(session, participants) {
  const dirty = new Set();
  for (const p of participants) {
    if (["waiting", "playing", "paused"].includes(p.queueStatus)) {
      p.queueStatus = "done";
      p.courtNumber = null;
      p.queueOrder = null;
      dirty.add(p);
    }
  }
  const summary = {
    totalParticipants: participants.length,
    totalCheckedIn: participants.filter((p) => p.checkedIn).length,
    totalGamesPlayed: participants.reduce((s, p) => s + (p.gamesPlayed || 0), 0),
  };
  return {
    changed: [...dirty],
    sessionUpdate: {
      queueStatus: "ended",
      queueEndedAt: new Date(),
      status: "completed",
      summary,
    },
  };
}

function setCheckIn(session, participants, participantId, checkedIn) {
  const p = find(participants, participantId);
  if (!p) return { error: "not_found" };
  const dirty = new Set([p]);
  const running = session.queueStatus === "running";

  p.checkedIn = !!checkedIn;
  if (checkedIn) {
    p.checkedInAt = new Date();
    if (running && p.queueStatus === "not_checked_in") {
      enqueueToEnd(p, participants, dirty);
      assignFreeCourts(session, participants, dirty);
    }
  } else {
    // Checking a player out — pull them from the queue/court entirely.
    if (p.queueStatus !== "not_checked_in" && p.queueStatus !== "done") {
      const wasPlaying = p.queueStatus === "playing";
      p.queueStatus = "not_checked_in";
      p.courtNumber = null;
      p.courtSlot = null;
      p.queueOrder = null;
      if (wasPlaying && running) assignFreeCourts(session, participants, dirty);
    }
  }
  return { changed: [...dirty] };
}

function finishGame(session, participants, courtNumber, winnerIds = []) {
  const players = getCourtPlayers(participants, courtNumber);
  if (players.length === 0) return { error: "court_empty" };

  const strat = strategyFor(session);
  const winnerSet = new Set((winnerIds || []).map(String));
  const onCourt = new Set(players.map((p) => String(p._id)));
  if (strat.needsWinner) {
    if (winnerSet.size === 0) return { error: "winner_required" };
    for (const id of winnerSet) if (!onCourt.has(id)) return { error: "invalid_winner" };
  }

  const dirty = new Set();
  const now = new Date();
  const { requeue, keepOnCourt = [] } = strat.onFinish(players, session, winnerSet);
  const requeueSet = new Set(requeue.map((p) => String(p._id)));

  for (const p of players) {
    p.gamesPlayed = (p.gamesPlayed || 0) + 1;
    p.lastGameEndedAt = now;
    // Record win/loss + court streak whenever a winner was tapped (any mode).
    if (winnerSet.size) {
      if (winnerSet.has(String(p._id))) {
        p.wins = (p.wins || 0) + 1;
        p.courtStreak = (p.courtStreak || 0) + 1;
      } else {
        p.losses = (p.losses || 0) + 1;
        p.courtStreak = 0;
      }
    }
    dirty.add(p);
    if (requeueSet.has(String(p._id))) {
      p.courtStreak = 0; // streak resets when a player leaves the court
      enqueueToEnd(p, participants, dirty);
    }
    // keepOnCourt players retain their courtNumber (winner_stays / king_of_court)
  }

  // Top up courts where winners stayed, then fill any fully-empty courts.
  fillPartialCourts(session, participants, dirty);
  assignFreeCourts(session, participants, dirty);
  return { changed: [...dirty] };
}

function pausePlayer(session, participants, participantId) {
  const p = find(participants, participantId);
  if (!p) return { error: "not_found" };
  if (!["waiting", "playing"].includes(p.queueStatus)) {
    return { error: "not_pausable" };
  }
  const dirty = new Set([p]);
  const wasPlaying = p.queueStatus === "playing";
  const vacatedCourt = p.courtNumber;
  const vacatedSlot = p.courtSlot; // preserved so the replacement keeps the same team position
  p.queueStatus = "paused";
  p.courtNumber = null;
  p.courtSlot = null;
  p.queueOrder = null;

  if (wasPlaying && session.queueStatus === "running") {
    // Pull the next waiting player to fill the vacant slot so the court stays at full strength.
    const next = getWaiting(participants)[0];
    if (next) {
      next.queueStatus = "playing";
      next.courtNumber = vacatedCourt;
      next.courtSlot = vacatedSlot;
      next.queueOrder = null;
      dirty.add(next);
    }
    // If nobody is waiting the court continues short — admin can use manual assign.
  }
  return { changed: [...dirty] };
}

function resumePlayer(session, participants, participantId) {
  const p = find(participants, participantId);
  if (!p) return { error: "not_found" };
  if (p.queueStatus !== "paused") return { error: "not_paused" };
  const dirty = new Set();
  enqueueToEnd(p, participants, dirty);
  if (session.queueStatus === "running") {
    fillPartialCourts(session, participants, dirty); // top up short courts first
    assignFreeCourts(session, participants, dirty);  // then fill any fully empty courts
  }
  return { changed: [...dirty] };
}

function skipPlayer(session, participants, participantId) {
  const p = find(participants, participantId);
  if (!p) return { error: "not_found" };
  if (p.queueStatus !== "waiting") return { error: "not_waiting" };
  const dirty = new Set();
  enqueueToEnd(p, participants, dirty); // send to the back of the line
  return { changed: [...dirty] };
}

function removePlayer(session, participants, participantId) {
  const p = find(participants, participantId);
  if (!p) return { error: "not_found" };
  const dirty = new Set([p]);
  const wasPlaying = p.queueStatus === "playing";
  p.queueStatus = "done";
  p.courtNumber = null;
  p.courtSlot = null;
  p.queueOrder = null;
  if (wasPlaying && session.queueStatus === "running") {
    assignFreeCourts(session, participants, dirty);
  }
  return { changed: [...dirty] };
}

function reorderQueue(session, participants, orderedIds) {
  const dirty = new Set();
  let order = 0;
  for (const id of orderedIds) {
    const p = find(participants, id);
    if (!p || p.queueStatus !== "waiting") continue; // playing/paused untouched
    order += STEP;
    p.queueOrder = order;
    dirty.add(p);
  }
  return { changed: [...dirty] };
}

function manualAssign(session, participants, participantIds, courtNumber) {
  const n = session.numberOfCourts || 1;
  const size = session.playersPerCourt || 4;
  if (courtNumber < 1 || courtNumber > n) return { error: "invalid_court" };
  const dirty = new Set();
  for (const id of participantIds) {
    const p = find(participants, id);
    if (!p) continue;
    if (!["waiting", "paused", "done"].includes(p.queueStatus)) continue;
    p.queueStatus = "playing";
    p.courtNumber = courtNumber;
    p.courtSlot = nextFreeSlot(participants, courtNumber, size);
    p.queueOrder = null;
    dirty.add(p);
  }
  return { changed: [...dirty] };
}

// Admin board rearrange: the two players exchange their exact queue positions
// (court + slot, or waiting spot). Covers team changes on one court, moving a
// player between courts, and subbing a waiting player onto a court. Never
// touches game counters and never auto-fills — the admin is arranging
// deliberately. Two waiting players is a reorder, not a swap.
function swapPlayers(session, participants, aId, bId) {
  const a = find(participants, aId);
  const b = find(participants, bId);
  if (!a || !b) return { error: "not_found" };
  if (String(a._id) === String(b._id)) return { error: "same_player" };
  const movable = ["playing", "waiting"];
  if (!movable.includes(a.queueStatus) || !movable.includes(b.queueStatus)) return { error: "not_movable" };
  if (a.queueStatus === "waiting" && b.queueStatus === "waiting") return { error: "both_waiting" };
  const pos = (p) => ({
    queueStatus: p.queueStatus,
    courtNumber: p.courtNumber,
    courtSlot: p.courtSlot,
    queueOrder: p.queueOrder,
  });
  const posA = pos(a);
  Object.assign(a, pos(b));
  Object.assign(b, posA);
  return { changed: [a, b] };
}

// Move a playing or waiting player onto a specific open slot (short court or
// empty court). The vacated slot stays open — no auto-fill (see swapPlayers).
function movePlayerToSlot(session, participants, participantId, courtNumber, courtSlot) {
  const n = session.numberOfCourts || 1;
  const size = session.playersPerCourt || 4;
  const p = find(participants, participantId);
  if (!p) return { error: "not_found" };
  if (!["playing", "waiting"].includes(p.queueStatus)) return { error: "not_movable" };
  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > n) return { error: "invalid_court" };
  if (!Number.isInteger(courtSlot) || courtSlot < 1 || courtSlot > size) return { error: "invalid_slot" };
  const taken = getCourtPlayers(participants, courtNumber)
    .some((q) => q.courtSlot === courtSlot && String(q._id) !== String(p._id));
  if (taken) return { error: "slot_taken" };
  p.queueStatus = "playing";
  p.courtNumber = courtNumber;
  p.courtSlot = courtSlot;
  p.queueOrder = null;
  return { changed: [p] };
}

// Append a freshly-created participant (e.g. a walk-in) to the queue and fill
// any free court. The route creates the participant doc first, then passes the
// full participant list (including the new one) here.
function appendAndAssign(session, participants, participantId) {
  const p = find(participants, participantId);
  if (!p) return { error: "not_found" };
  const dirty = new Set();
  enqueueToEnd(p, participants, dirty);
  if (session.queueStatus === "running") {
    assignFreeCourts(session, participants, dirty);
  }
  return { changed: [...dirty] };
}

// ── Board projection (read-only) ─────────────────────────────────────────────
function toPublic(p) {
  return {
    _id: p._id,
    memberId: p.memberId ?? null,
    memberName: p.memberName || "Member",
    profileImage: p.profileImage ?? null,
    duprRating: p.duprRating ?? null,
    isWalkIn: !!p.isWalkIn,
    checkedIn: !!p.checkedIn,
    queueStatus: p.queueStatus,
    queueOrder: p.queueOrder ?? null,
    courtNumber: p.courtNumber ?? null,
    courtSlot: p.courtSlot ?? null,
    gamesPlayed: p.gamesPlayed || 0,
    wins: p.wins || 0,
    losses: p.losses || 0,
  };
}

function buildBoard(session, participants) {
  const n = session.numberOfCourts || 1;
  const size = session.playersPerCourt || 4;
  const liveScores = session.liveScores || [];
  const courts = [];
  for (let c = 1; c <= n; c++) {
    const live = liveScores.find((s) => s.courtNumber === c);
    courts.push({
      courtNumber: c,
      players: getCourtPlayers(participants, c).map(toPublic),
      liveScore: live ? {
        team1Score: live.team1Score,
        team2Score: live.team2Score,
        servingTeam: live.servingTeam ?? null,
        serverNumber: live.serverNumber ?? null,
        servingPlayerId: live.servingPlayerId ? String(live.servingPlayerId) : null,
        canUndo: !!live.previousState,
      } : null,
    });
  }
  const waiting = getWaiting(participants);
  const paused = getPaused(participants);

  // Standings — everyone who has played, ranked by wins, then fewest losses, then games.
  const leaderboard = participants
    .filter((p) => (p.gamesPlayed || 0) > 0 || p.wins || p.losses)
    .map(toPublic)
    .sort(
      (a, b) =>
        (b.wins - a.wins) ||
        (a.losses - b.losses) ||
        (b.gamesPlayed - a.gamesPlayed) ||
        String(a.memberName).localeCompare(String(b.memberName)),
    );

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
      queueStatus: session.queueStatus,
      queueMode: session.queueMode || "fcfs",
      numberOfCourts: n,
      playersPerCourt: size,
      sport: session.sport,
      scoreTarget: session.scoreTarget ?? null,
      winByTwo: session.winByTwo !== undefined ? !!session.winByTwo : true,
    },
    courts,
    waiting: waiting.map(toPublic),
    paused: paused.map(toPublic),
    nextGroup: waiting.slice(0, size).map(toPublic),
    roster: participants.map(toPublic), // full roster for the check-in view
    leaderboard,
    counts: {
      checkedIn: participants.filter((p) => p.checkedIn).length,
      waiting: waiting.length,
      playing: getPlaying(participants).length,
      paused: paused.length,
      activeGames: courts.filter((c) => c.players.length > 0).length,
    },
  };
}

module.exports = {
  STEP,
  strategies,
  // selectors
  getWaiting,
  getPlaying,
  getPaused,
  getCourtPlayers,
  getFreeCourts,
  // operations
  startQueue,
  endQueue,
  setCheckIn,
  finishGame,
  pausePlayer,
  resumePlayer,
  skipPlayer,
  removePlayer,
  reorderQueue,
  manualAssign,
  swapPlayers,
  movePlayerToSlot,
  appendAndAssign,
  assignFreeCourts,
  // projection
  buildBoard,
};
