const mongoose = require("mongoose");

// One document per user x club relationship. A player's "home" club is still
// User.clubId; memberships let the same account belong to additional clubs,
// each with its own approval status. Player accounts only - admins and
// superadmins are never multi-club.
const clubMembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "deactivated"],
      default: "pending",
    },
    joinedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

clubMembershipSchema.index({ userId: 1, clubId: 1 }, { unique: true });
clubMembershipSchema.index({ clubId: 1, status: 1 });

module.exports = mongoose.model("ClubMembership", clubMembershipSchema);
