const mongoose = require("mongoose");

const openPlayMatchSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "OpenPlaySession", required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    team1Player1: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    team1Player2: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    team2Player1: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    team2Player2: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    team1Score: { type: Number },
    team2Score: { type: Number },
    court: { type: String, default: "Court 1" },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OpenPlayMatch", openPlayMatchSchema);
