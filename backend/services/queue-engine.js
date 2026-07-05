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

// ── Strategy interface ───────────────────────────────────────────────────────
// A strategy = {
//   pickGroup(waiting, size, session) -> participants to send onto a free court
//   onFinish(courtPlayers, session)   -> { requeue: [...], keepOnCourt: [...] }
// }
const strategies = {
  fcfs: {
    pickGroup(waiting, size) {
      return waiting.slice(0, size);
    },
    onFinish(courtPlayers) {
      return { requeue: courtPlayers, keepOnCourt: [] };
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
    for (const p of group) {
      p.queueStatus = "playing";
      p.courtNumber = court;
      p.queueOrder = null;
      dirty.add(p);
    }
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
      p.queueOrder = null;
      if (wasPlaying && running) assignFreeCourts(session, participants, dirty);
    }
  }
  return { changed: [...dirty] };
}

function finishGame(session, participants, courtNumber) {
  const players = getCourtPlayers(participants, courtNumber);
  if (players.length === 0) return { error: "court_empty" };

  const dirty = new Set();
  const now = new Date();
  const { requeue } = strategyFor(session).onFinish(players, session);
  const requeueSet = new Set(requeue.map((p) => String(p._id)));

  for (const p of players) {
    p.gamesPlayed = (p.gamesPlayed || 0) + 1;
    p.lastGameEndedAt = now;
    dirty.add(p);
    if (requeueSet.has(String(p._id))) {
      enqueueToEnd(p, participants, dirty);
    }
    // keepOnCourt players retain their courtNumber (future winner-stays modes)
  }

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
  p.queueStatus = "paused";
  p.courtNumber = null;
  p.queueOrder = null;

  if (wasPlaying && session.queueStatus === "running") {
    // Pull the next waiting player to fill the vacant slot so the court stays at full strength.
    const next = getWaiting(participants)[0];
    if (next) {
      next.queueStatus = "playing";
      next.courtNumber = vacatedCourt;
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
  if (courtNumber < 1 || courtNumber > n) return { error: "invalid_court" };
  const dirty = new Set();
  for (const id of participantIds) {
    const p = find(participants, id);
    if (!p) continue;
    if (!["waiting", "paused", "done"].includes(p.queueStatus)) continue;
    p.queueStatus = "playing";
    p.courtNumber = courtNumber;
    p.queueOrder = null;
    dirty.add(p);
  }
  return { changed: [...dirty] };
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
    isWalkIn: !!p.isWalkIn,
    checkedIn: !!p.checkedIn,
    queueStatus: p.queueStatus,
    queueOrder: p.queueOrder ?? null,
    courtNumber: p.courtNumber ?? null,
    gamesPlayed: p.gamesPlayed || 0,
  };
}

function buildBoard(session, participants) {
  const n = session.numberOfCourts || 1;
  const size = session.playersPerCourt || 4;
  const courts = [];
  for (let c = 1; c <= n; c++) {
    courts.push({ courtNumber: c, players: getCourtPlayers(participants, c).map(toPublic) });
  }
  const waiting = getWaiting(participants);
  const paused = getPaused(participants);

  return {
    session: {
      _id: session._id,
      title: session.title,
      status: session.status,
      venue: session.venue,
      court: session.court,
      queueStatus: session.queueStatus,
      numberOfCourts: n,
      playersPerCourt: size,
    },
    courts,
    waiting: waiting.map(toPublic),
    paused: paused.map(toPublic),
    nextGroup: waiting.slice(0, size).map(toPublic),
    roster: participants.map(toPublic), // full roster for the check-in view
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
  appendAndAssign,
  assignFreeCourts,
  // projection
  buildBoard,
};
