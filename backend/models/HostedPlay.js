const mongoose = require("mongoose");

const hostedPlaySchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    title: { type: String, required: true, trim: true },
    sport: { type: String, enum: ["tennis", "pickleball"], required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    court: { type: String, trim: true },
    address: { type: String, trim: true },
    feePerPlayer: { type: Number, default: 0, min: 0 },
    maxPlayers: { type: Number, required: true, min: 2 },
    currentPlayers: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["open", "full", "closed", "cancelled", "completed"],
      default: "open",
    },
    description: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // ── Queue Management (only used when the club has hostedPlayQueueEnabled) ──
    numberOfCourts: { type: Number, default: 1, min: 1 },
    playersPerCourt: { type: Number, default: 4, min: 1 }, // future-proof; V1 keeps 4
    queueMode: {
      type: String,
      enum: ["fcfs", "winner_stays", "king_of_court", "skill_rotation"],
      default: "fcfs",
    },
    queueStatus: {
      type: String,
      enum: ["not_started", "running", "paused", "ended"],
      default: "not_started",
    },
    queueStartedAt: { type: Date },
    queueEndedAt: { type: Date },
    summary: {
      totalParticipants: { type: Number },
      totalCheckedIn: { type: Number },
      totalGamesPlayed: { type: Number },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HostedPlay", hostedPlaySchema);
