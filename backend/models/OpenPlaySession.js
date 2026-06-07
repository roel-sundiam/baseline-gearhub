const mongoose = require("mongoose");

const openPlaySessionSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    sport: { type: String, enum: ["tennis", "pickleball"], required: true },
    title: { type: String, required: true, trim: true },
    sessionDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    maxPlayers: { type: Number, default: 16, min: 2 },
    maxMatches: { type: Number, default: 8, min: 1 },
    matchType: { type: String, enum: ["doubles", "singles"], default: "doubles" },
    courts: [{ type: Number }],
    status: { type: String, enum: ["open", "in_progress", "completed", "cancelled"], default: "open" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OpenPlaySession", openPlaySessionSchema);
