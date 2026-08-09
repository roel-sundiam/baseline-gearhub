const mongoose = require("mongoose");

const hostedPlayParticipantSchema = new mongoose.Schema(
  {
    hostedPlayId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlay", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    // Not required: walk-in players added by an admin have no linked user account.
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    memberName: { type: String, trim: true },
    chargeId: { type: mongoose.Schema.Types.ObjectId, ref: "Charge" },
    // Set when this participant came from a Reclub Participant Import (see ReclubImportRecord).
    reclubImportId: { type: mongoose.Schema.Types.ObjectId, ref: "ReclubImportRecord" },

    // ── Guest (public walk-in) contact info ──
    guestEmail: { type: String, trim: true, lowercase: true },
    guestPhone: { type: String, trim: true },

    // ── Waitlist state (pre-session) ──
    // active          = confirmed participant, counts toward currentPlayers (default)
    // waitlisted      = full session; waiting in line, no charge, not counted
    // offered         = a freed spot was offered to them; claim window open (paid) /
    //                   awaiting admin approval after claim
    // pending_payment = joined directly and reserved a real slot (counts toward
    //                   currentPlayers), but payment proof is awaiting admin approval;
    //                   offerExpiresAt holds the auto-release deadline
    waitStatus: { type: String, enum: ["active", "waitlisted", "offered", "pending_payment"], default: "active" },
    waitlistOrder: { type: Number, default: null }, // FIFO among waitlisted (join timestamp)
    offerExpiresAt: { type: Date, default: null },  // claim window deadline while "offered"

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
    courtSlot: { type: Number, default: null }, // 1..playersPerCourt; low half = Team A, high half = Team B
    gamesPlayed: { type: Number, default: 0, min: 0 },
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    courtStreak: { type: Number, default: 0, min: 0 }, // consecutive wins held on court (king_of_court cap)
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
