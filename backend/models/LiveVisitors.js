const mongoose = require("mongoose");

const liveVisitorsSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      default: null,
    },
    username: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["player", "admin", "superadmin", "anonymous"],
      default: "anonymous",
    },
    currentPage: {
      type: String,
      required: true,
    },
    currentPageUrl: {
      type: String,
      default: "",
    },
    sessionStart: {
      type: Date,
      default: Date.now,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// TTL index - automatically remove documents after 30 minutes of inactivity
liveVisitorsSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 1800 });

module.exports = mongoose.model("LiveVisitors", liveVisitorsSchema);
