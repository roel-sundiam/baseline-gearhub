const mongoose = require("mongoose");

const openPlayRatingSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sport: { type: String, enum: ["tennis", "pickleball"], required: true },
    rating: { type: Number, default: 3.5, min: 1.0, max: 7.0 },
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    matchesPlayed: { type: Number, default: 0, min: 0 },
    lastPlayedAt: { type: Date },
  },
  { timestamps: true },
);

openPlayRatingSchema.index({ clubId: 1, playerId: 1, sport: 1 }, { unique: true });

module.exports = mongoose.model("OpenPlayRating", openPlayRatingSchema);
