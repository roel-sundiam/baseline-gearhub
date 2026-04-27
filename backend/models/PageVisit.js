const mongoose = require("mongoose");

const pageVisitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, required: true },
    role: {
      type: String,
      enum: ["player", "admin", "superadmin"],
      required: true,
    },
    pageName: { type: String, required: true }, // e.g., "player-dashboard", "member-directory"
    pageUrl: { type: String, required: true }, // e.g., "/player/dashboard"
    visitTime: { type: Date, default: () => new Date() },
    timeSpent: { type: Number, default: 0 }, // in seconds
  },
  { timestamps: true },
);

module.exports = mongoose.model("PageVisit", pageVisitSchema);
