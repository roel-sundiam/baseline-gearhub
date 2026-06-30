const mongoose = require("mongoose");

const gameJoinSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    playDate: { type: Date },
    status: { type: String, enum: ["joined", "recorded", "cancelled"], default: "joined" },
    gamesPlayed: { type: Number, default: 0, min: 0 },
    guestCount: { type: Number, default: 0, min: 0 },
    chargeId: { type: mongoose.Schema.Types.ObjectId, ref: "Charge" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recordedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("GameJoin", gameJoinSchema);
