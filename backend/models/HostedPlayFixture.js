const mongoose = require("mongoose");

// Snapshot of a pair at schedule-generation time, so fixtures render without
// populating pairs/participants and survive later pair edits or deletion.
const fixturePairSnapshotSchema = new mongoose.Schema(
  {
    pairId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayPair", required: true },
    pairLabel: { type: String, trim: true, default: "" },
    players: {
      type: [
        {
          participantId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", required: true },
          memberId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          memberName: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },
  },
  { _id: false },
);

// One row per scheduled match in a fixed_doubles_rotation round-robin. Unlike
// HostedPlayMatch (created only when a game finishes), fixtures exist for the
// whole lifecycle scheduled -> in_progress -> completed, since the full
// schedule is generated upfront.
const hostedPlayFixtureSchema = new mongoose.Schema(
  {
    hostedPlayId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlay", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },

    matchNumber: { type: Number, required: true }, // final chronological play order, 1..N*(N-1)/2
    roundNumber: { type: Number, required: true }, // circle-method round index — bye bookkeeping only

    pair1Id: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayPair", required: true },
    pair2Id: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayPair", required: true },
    pair1Snapshot: { type: fixturePairSnapshotSchema, required: true },
    pair2Snapshot: { type: fixturePairSnapshotSchema, required: true },

    courtNumber: { type: Number, required: true },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    actualStart: { type: Date, default: null },
    actualEnd: { type: Date, default: null },

    status: { type: String, enum: ["scheduled", "in_progress", "completed"], default: "scheduled" },

    // Also doubles as the in-progress score while the umpire live-scoring page
    // (side-out point-by-point, pickleball) is driving this match — null means
    // "not started via the umpire page yet" (organizer manual entry doesn't
    // touch these until Record Score is submitted, going straight to final).
    pair1Score: { type: Number, default: null, min: 0 },
    pair2Score: { type: Number, default: null, min: 0 },
    winnerPairId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayPair", default: null },
    // tapped = admin picked the winning side; scores = derived from score comparison.
    winnerSource: { type: String, enum: ["tapped", "scores", null], default: null },

    // ── Umpire live scoring (pickleball, anonymous per-court token access) ──
    // Mirrors HostedPlay.liveScores' side-out state machine, scoped to this one
    // fixture instead of a court-keyed array, since a fixture already models
    // "the match currently on this court." Cleared back to null at finish.
    servingPair: { type: Number, enum: [1, 2, null], default: null },
    serverNumber: { type: Number, enum: [1, 2, null], default: null },
    servingParticipantId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", default: null },
    pair1RightParticipantId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", default: null },
    pair2RightParticipantId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", default: null },
    previousLiveState: {
      type: new mongoose.Schema(
        {
          pair1Score: Number,
          pair2Score: Number,
          servingPair: { type: Number, enum: [1, 2, null] },
          serverNumber: { type: Number, enum: [1, 2, null] },
          servingParticipantId: { type: mongoose.Schema.Types.ObjectId, default: null },
          pair1RightParticipantId: { type: mongoose.Schema.Types.ObjectId, default: null },
          pair2RightParticipantId: { type: mongoose.Schema.Types.ObjectId, default: null },
        },
        { _id: false },
      ),
      default: null,
    },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    scoreEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    scoreEnteredAt: { type: Date, default: null },

    // Mirrored club-history row created at finish time (see finishCourtAndRecordMatch's
    // pattern) — lets fixed-doubles games show up in the existing club-wide match
    // history/standings with no changes to those read paths.
    matchRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayMatch", default: null },

    // HostedPlay.fixedDoubles.scheduleGenerationBatch at the time this fixture
    // was created — lets a stale poll response be told apart from the current schedule.
    generationBatch: { type: Number, required: true },
  },
  { timestamps: true },
);

hostedPlayFixtureSchema.index({ hostedPlayId: 1, matchNumber: 1 });
hostedPlayFixtureSchema.index({ hostedPlayId: 1, status: 1 });
hostedPlayFixtureSchema.index({ hostedPlayId: 1, courtNumber: 1, scheduledStart: 1 });

module.exports = mongoose.model("HostedPlayFixture", hostedPlayFixtureSchema);
