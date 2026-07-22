const mongoose = require("mongoose");

// Snapshot of a player at finish time. participantId is the source of truth;
// memberId/memberName/isWalkIn are denormalized so match rows render without
// populating participants and survive participant deletion. memberId is null
// for guest walk-ins.
const matchPlayerSchema = new mongoose.Schema(
  {
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    memberName: { type: String, trim: true, default: "" },
    isWalkIn: { type: Boolean, default: false },
  },
  { _id: false },
);

// One record per finished Hosted Play queue game. Scores are optional: null
// scores mean the game was recorded winner-only (or with no outcome at all in
// fcfs mode) and can be filled in later via PATCH /matches/:matchId/score.
const hostedPlayMatchSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlay", required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    sport: { type: String },
    queueMode: { type: String },
    courtNumber: { type: Number, required: true },
    // Team 1 = low courtSlot half ("Team A"), team 2 = high half ("Team B");
    // arrays because playersPerCourt is configurable per session.
    team1: { type: [matchPlayerSchema], required: true },
    team2: { type: [matchPlayerSchema], default: [] },
    team1Score: { type: Number, default: null, min: 0 },
    team2Score: { type: Number, default: null, min: 0 },
    winnerTeam: { type: Number, enum: [1, 2, null], default: null },
    // tapped = admin picked the winning side at finish (authoritative; later
    // score edits must agree). scores = derived from score comparison
    // (re-derived whenever scores are corrected).
    winnerSource: { type: String, enum: ["tapped", "scores", null], default: null },
    finishedAt: { type: Date, required: true, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    scoreEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    scoreEnteredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Recorded-games panel (per session, newest first) and club-scoped reads.
hostedPlayMatchSchema.index({ sessionId: 1, finishedAt: -1 });
hostedPlayMatchSchema.index({ clubId: 1, createdAt: -1 });

module.exports = mongoose.model("HostedPlayMatch", hostedPlayMatchSchema);
