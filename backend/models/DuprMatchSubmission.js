const mongoose = require("mongoose");

// Audit/state record for one HostedPlayMatch's submission to DUPR. See
// docs/DUPR_INTEGRATION_PLAN.md for the full state machine and retry design.
const duprMatchSubmissionSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    source: { type: String, enum: ["hosted_play"], required: true, default: "hosted_play" },
    sourceMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayMatch", required: true },
    // Sent to DUPR as the client match identifier for idempotent submission.
    idempotencyKey: { type: String, required: true },
    players: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        duprPlayerId: { type: String, required: true },
      },
    ],
    sport: { type: String, default: "pickleball" },
    team1Score: { type: Number, default: null },
    team2Score: { type: Number, default: null },
    matchDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending_submission", "submitted", "accepted", "rejected", "disputed", "failed"],
      default: "pending_submission",
    },
    duprMatchId: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    errorLog: [
      {
        at: { type: Date, default: Date.now },
        httpStatus: { type: Number, default: null },
        message: { type: String },
      },
    ],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dispute: {
      reason: { type: String, default: null },
      raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      raisedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

duprMatchSubmissionSchema.index({ source: 1, sourceMatchId: 1 }, { unique: true });
duprMatchSubmissionSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model("DuprMatchSubmission", duprMatchSubmissionSchema);
