"use strict";

/**
 * Every Hosted Play format owns five concerns: registration rules, match
 * generation, court assignment, rotation logic, and standings calculation.
 * Two structurally different engines implement that contract:
 *
 *  - "live-queue": players rotate individually through courts as games finish
 *    (backend/services/queue-engine.js — pluggable strategies keyed by queueMode).
 *  - "fixed-schedule": a complete match schedule is generated upfront for fixed
 *    teams (backend/services/fixed-doubles-engine.js). No dynamic "rotation" —
 *    partners are static — but real upfront registration rules (pairing).
 *
 * Routes use this map only to decide which engine/board logic to invoke for a
 * given session — it's the "common interface" expressed as metadata-driven
 * routing rather than a forced shared class hierarchy that would produce
 * no-op methods on one side or the other.
 */
const FORMATS = {
  fcfs: { engine: "live-queue" },
  winner_stays: { engine: "live-queue" },
  winner_priority: { engine: "live-queue" },
  king_of_court: { engine: "live-queue" },
  skill_rotation: { engine: "live-queue", implemented: false }, // reserved, falls back to fcfs
  fixed_doubles_rotation: { engine: "fixed-schedule" },
};

function formatFor(queueMode) {
  return FORMATS[queueMode] || FORMATS.fcfs;
}

module.exports = { FORMATS, formatFor };
