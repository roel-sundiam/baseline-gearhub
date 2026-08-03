const mongoose = require("mongoose");

const announcementConfirmationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, required: true },
    // Snapshotted at confirmation time (not derived via userId.clubId at query
    // time) so a later club change/switch doesn't misattribute historical rows.
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    announcementVersion: { type: Number, required: true },
    // Snapshotted at confirmation time, same reasoning as clubId — AppSettings
    // only holds the current title, and it gets overwritten on every republish.
    announcementTitle: { type: String, default: "" },
    confirmedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AnnouncementConfirmation", announcementConfirmationSchema);
