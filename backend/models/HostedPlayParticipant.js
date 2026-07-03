const mongoose = require("mongoose");

const hostedPlayParticipantSchema = new mongoose.Schema(
  {
    hostedPlayId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlay", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    // Not required: walk-in players added by an admin have no linked user account.
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    memberName: { type: String, trim: true },
    chargeId: { type: mongoose.Schema.Types.ObjectId, ref: "Charge" },

    // ── Queue Management state ──
    isWalkIn: { type: Boolean, default: false },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },
    queueStatus: {
      type: String,
      enum: ["not_checked_in", "waiting", "playing", "paused", "done"],
      default: "not_checked_in",
    },
    queueOrder: { type: Number, default: null }, // gap strategy (steps of 1000); null when not waiting
    courtNumber: { type: Number, default: null }, // 1..numberOfCourts when playing; else null
    gamesPlayed: { type: Number, default: 0, min: 0 },
    enteredQueueAt: { type: Date },
    lastGameEndedAt: { type: Date },
  },
  { timestamps: true },
);

// A participant is either a real member or an admin-added walk-in.
hostedPlayParticipantSchema.pre("validate", function (next) {
  if (!this.memberId && !this.isWalkIn) {
    return next(new Error("A participant requires memberId or must be a walk-in"));
  }
  next();
});

// Fast board reads and next-player selection.
hostedPlayParticipantSchema.index({ hostedPlayId: 1, queueStatus: 1, queueOrder: 1 });

module.exports = mongoose.model("HostedPlayParticipant", hostedPlayParticipantSchema);
