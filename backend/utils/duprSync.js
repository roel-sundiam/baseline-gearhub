const User = require("../models/User");
const Club = require("../models/Club");
const HostedPlayMatch = require("../models/HostedPlayMatch");
const DuprMatchSubmission = require("../models/DuprMatchSubmission");
const dupr = require("./dupr");

const MAX_ATTEMPTS = 5;

// A HostedPlayMatch team (team1/team2) as stored: array of participant snapshots
// {participantId, memberId, memberName, isWalkIn}. DUPR only supports 1-2 players
// per side (singles/doubles) - Hosted Play sessions with larger courtSlots can
// never submit, same as non-pickleball sessions.
async function resolveTeamPlayers(teamPlayers) {
  if (!teamPlayers?.length || teamPlayers.length > 2) {
    return { eligible: false, players: [], unlinkedIds: teamPlayers?.map((p) => p.participantId) || [] };
  }
  const memberIds = teamPlayers.filter((p) => p.memberId).map((p) => p.memberId);
  const users = memberIds.length
    ? await User.find({ _id: { $in: memberIds } }).select("duprLink")
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const players = [];
  const unlinkedIds = [];
  for (const p of teamPlayers) {
    const user = p.memberId ? byId.get(String(p.memberId)) : null;
    // BASIC_L1 gating (DUPR's User Gating checklist item, and also literally required
    // by the Match Upload API: "all players must have the BASIC_L1 entitlement").
    // Sourced only from the SSO postMessage payload at link time - there's no live
    // API to re-check it, so a player who loses the entitlement DUPR-side won't be
    // caught until they relink.
    if (!user?.duprLink?.verified || !user.duprLink.entitlements?.includes("BASIC_L1")) {
      unlinkedIds.push(p.memberId || p.participantId);
      continue;
    }
    players.push({ userId: p.memberId, duprPlayerId: user.duprLink.duprPlayerId });
  }
  return { eligible: unlinkedIds.length === 0, players, unlinkedIds };
}

// Club match submission additionally requires the recording admin's OWN DUPR
// account to hold DIRECTOR/ORGANIZER on the DUPR club matching club.duprClubId -
// confirmed live 2026-07-27 that this check uses our partner bearer token keyed
// by the admin's duprPlayerId, not the admin's per-user SSO token.
async function adminHasClubRole(recordedByUserId, duprClubId) {
  if (!recordedByUserId || !duprClubId) return false;
  const admin = await User.findById(recordedByUserId).select("duprLink");
  if (!admin?.duprLink?.verified) return false;
  const res = await dupr.getUserClubMemberships(admin.duprLink.duprPlayerId);
  if (!res.ok) return false;
  const membership = res.data?.membership?.find((m) => String(m.clubId) === String(duprClubId));
  return !!membership && ["DIRECTOR", "ORGANIZER"].includes(membership.role);
}

// ExternalMatchTeam is flat: { player1, player2, game1 } - confirmed against DUPR's
// real OpenAPI spec 2026-07-27. HostedPlayMatch only ever stores one score pair per
// game, so it maps to a single game1 (never game2-5).
function buildTeamPayload(players, score) {
  return {
    player1: players[0].duprPlayerId,
    ...(players[1] ? { player2: players[1].duprPlayerId } : {}),
    game1: score,
  };
}

function buildMatchPayload({ match, teamAPlayers, teamBPlayers, club, identifier, matchId }) {
  return {
    ...(matchId ? { matchId } : {}),
    matchDate: new Date(match.finishedAt).toISOString().slice(0, 10),
    format: teamAPlayers.length === 2 ? "DOUBLES" : "SINGLES",
    event: "CourtGo Hosted Play",
    identifier,
    teamA: buildTeamPayload(teamAPlayers, match.team1Score),
    teamB: buildTeamPayload(teamBPlayers, match.team2Score),
    matchSource: "CLUB",
    clubId: Number(club.duprClubId),
  };
}

// Checks whether a finished HostedPlayMatch is DUPR-eligible without submitting.
// Used by the finish/correction routes to decide whether to call enqueueAndSubmit,
// and to surface a reason to the admin when it's not eligible.
async function checkEligibility(match, club) {
  if (!dupr.isDuprConfigured() || !club?.duprEnabled) return { eligible: false, reason: "not_configured" };
  if (match.sport !== "pickleball") return { eligible: false, reason: "not_pickleball" };
  if (match.team1Score == null || match.team2Score == null) return { eligible: false, reason: "no_scores" };
  if (!club.duprClubId) return { eligible: false, reason: "no_dupr_club_id" };

  const [teamA, teamB, adminOk] = await Promise.all([
    resolveTeamPlayers(match.team1),
    resolveTeamPlayers(match.team2),
    adminHasClubRole(match.recordedBy, club.duprClubId),
  ]);

  if (!adminOk) return { eligible: false, reason: "admin_not_authorized" };
  if (!teamA.eligible || !teamB.eligible) {
    return { eligible: false, reason: "unlinked_players", unlinkedIds: [...teamA.unlinkedIds, ...teamB.unlinkedIds] };
  }
  return { eligible: true, teamAPlayers: teamA.players, teamBPlayers: teamB.players };
}

function isRetryableStatus(status) {
  return status === 0 || status === 429 || status >= 500;
}

// Attempts (or re-attempts) DUPR submission for an existing DuprMatchSubmission
// record. Never throws - always resolves, updating the record's state in place.
async function attemptSubmit(submission, payload) {
  submission.attempts += 1;
  // Whether DUPR already has this match is what determines create-vs-update, NOT the
  // current status - confirmed live 2026-07-27: resetting status back to
  // pending_submission (as resolveDispute/resubmitById do) while a duprMatchId already
  // exists must still call update, since DUPR rejects a create on an identifier that
  // was ever used before (409 "already exists"), even after we reset our own state.
  const isUpdate = !!submission.duprMatchId;
  const res = isUpdate ? await dupr.updateMatch(payload) : await dupr.submitMatch(payload);

  if (res.ok) {
    submission.status = "submitted";
    submission.duprMatchId = res.data?.result?.matchCode || submission.duprMatchId;
    submission.lastError = null;
    submission.nextAttemptAt = null;
  } else if (isRetryableStatus(res.status) && submission.attempts < MAX_ATTEMPTS) {
    submission.status = "pending_submission";
    submission.nextAttemptAt = new Date(Date.now() + Math.pow(2, submission.attempts) * 60000);
    submission.lastError = res.error;
  } else {
    submission.status = "failed";
    submission.nextAttemptAt = null;
    submission.lastError = res.error;
  }
  submission.errorLog.push({ at: new Date(), httpStatus: res.status, message: res.error || "ok" });
  await submission.save();
  return submission;
}

// Called right after a HostedPlayMatch is persisted with scores. Never throws into
// the caller - this must not fail the finish-game response.
async function enqueueAndSubmit(match, club) {
  try {
    const check = await checkEligibility(match, club);
    if (!check.eligible) return { eligible: false, reason: check.reason, unlinkedIds: check.unlinkedIds };

    const idempotencyKey = `courtgo:hosted_play:${match._id}`;
    let submission = await DuprMatchSubmission.findOne({ source: "hosted_play", sourceMatchId: match._id });
    if (!submission) {
      submission = await DuprMatchSubmission.create({
        clubId: match.clubId,
        source: "hosted_play",
        sourceMatchId: match._id,
        idempotencyKey,
        players: [...check.teamAPlayers, ...check.teamBPlayers],
        sport: "pickleball",
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        matchDate: match.finishedAt,
        submittedBy: match.recordedBy,
      });
    } else {
      // Keep the audit record's scores current across corrections - a "disputed" or
      // "failed" submission never auto-retries here (see checkTransition below), so
      // this only actually reattempts DUPR when status allows it.
      submission.team1Score = match.team1Score;
      submission.team2Score = match.team2Score;
    }

    if (submission.status === "disputed") {
      return { eligible: true, submission: { status: submission.status, lastError: "Frozen: under dispute" } };
    }

    const payload = buildMatchPayload({
      match, teamAPlayers: check.teamAPlayers, teamBPlayers: check.teamBPlayers, club,
      identifier: idempotencyKey, matchId: submission.duprMatchId ? Number(submission.duprMatchId) : undefined,
    });
    await attemptSubmit(submission, payload);
    return { eligible: true, submission: { status: submission.status, lastError: submission.lastError } };
  } catch (err) {
    console.error("duprSync.enqueueAndSubmit error:", err);
    return { eligible: false, reason: "internal_error" };
  }
}

// Manual retry of a failed/rejected submission (resets attempts for a fresh backoff
// window). Refuses on a disputed record - resolveDispute is the only way out of that
// state, so the freeze can't be bypassed accidentally.
async function resubmitById(submissionId, clubId) {
  const submission = await DuprMatchSubmission.findOne({ _id: submissionId, clubId });
  if (!submission) return { error: "not_found" };
  if (submission.status === "disputed") return { error: "disputed" };
  const match = await HostedPlayMatch.findById(submission.sourceMatchId);
  if (!match) return { error: "match_not_found" };
  const club = await Club.findById(clubId).select("duprEnabled duprClubId").lean();
  submission.attempts = 0;
  submission.nextAttemptAt = null;
  await submission.save();
  return { result: await enqueueAndSubmit(match, club) };
}

async function markDisputed(submissionId, clubId, reason, raisedBy) {
  const submission = await DuprMatchSubmission.findOne({ _id: submissionId, clubId });
  if (!submission) return { error: "not_found" };
  submission.status = "disputed";
  submission.dispute = { reason, raisedBy, raisedAt: new Date(), resolvedAt: null };
  await submission.save();
  return { submission };
}

// Corrected scores (optional) -> updates the underlying HostedPlayMatch, clears the
// dispute freeze, and resubmits (create if it never succeeded, update if DUPR already
// has this match under its matchCode).
async function resolveDispute(submissionId, clubId, { team1Score, team2Score } = {}) {
  const submission = await DuprMatchSubmission.findOne({ _id: submissionId, clubId, status: "disputed" });
  if (!submission) return { error: "not_found_or_not_disputed" };
  const match = await HostedPlayMatch.findById(submission.sourceMatchId);
  if (!match) return { error: "match_not_found" };

  if (team1Score != null && team2Score != null) {
    match.team1Score = team1Score;
    match.team2Score = team2Score;
    match.winnerTeam = team1Score === team2Score ? null : team1Score > team2Score ? 1 : 2;
    match.winnerSource = match.winnerTeam ? "scores" : null;
    await match.save();
  }

  submission.dispute.resolvedAt = new Date();
  submission.status = "pending_submission";
  submission.attempts = 0;
  submission.nextAttemptAt = null;
  await submission.save();

  const club = await Club.findById(clubId).select("duprEnabled duprClubId").lean();
  return { result: await enqueueAndSubmit(match, club) };
}

// Cron/sweep entry point: retries submissions whose backoff window has elapsed.
// Claims each record atomically (findOneAndUpdate pushing nextAttemptAt forward first)
// so concurrent invocations (e.g. an overlapping cron tick on a slow warm container)
// never double-process the same submission - same pattern as financeReportBilling.js.
async function processPendingSubmissions(limit = 20) {
  const results = [];
  for (let i = 0; i < limit; i++) {
    const claimed = await DuprMatchSubmission.findOneAndUpdate(
      { status: "pending_submission", nextAttemptAt: { $lte: new Date() } },
      { $set: { nextAttemptAt: new Date(Date.now() + 5 * 60000) } }, // provisional - attemptSubmit overwrites it
      { new: true, sort: { nextAttemptAt: 1 } },
    );
    if (!claimed) break;

    try {
      const match = await HostedPlayMatch.findById(claimed.sourceMatchId);
      const club = match ? await Club.findById(match.clubId).select("duprEnabled duprClubId").lean() : null;
      if (!match || !club) {
        claimed.status = "failed";
        claimed.lastError = "match_or_club_not_found";
        await claimed.save();
      } else {
        const check = await checkEligibility(match, club);
        if (!check.eligible) {
          // No longer eligible (e.g. a player unlinked since) - stop retrying rather
          // than burn attempts on a submission that can never succeed right now.
          claimed.nextAttemptAt = null;
          claimed.lastError = `no longer eligible: ${check.reason}`;
          await claimed.save();
        } else {
          const payload = buildMatchPayload({
            match, teamAPlayers: check.teamAPlayers, teamBPlayers: check.teamBPlayers, club,
            identifier: claimed.idempotencyKey, matchId: claimed.duprMatchId ? Number(claimed.duprMatchId) : undefined,
          });
          await attemptSubmit(claimed, payload);
        }
      }
    } catch (err) {
      console.error("duprSync.processPendingSubmissions error:", err);
    }
    results.push({ id: claimed._id, status: claimed.status });
  }
  return results;
}

module.exports = {
  checkEligibility,
  enqueueAndSubmit,
  attemptSubmit,
  buildMatchPayload,
  resubmitById,
  markDisputed,
  resolveDispute,
  processPendingSubmissions,
};
