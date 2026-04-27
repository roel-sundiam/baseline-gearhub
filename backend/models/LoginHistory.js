const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema(
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
    loginTime: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LoginHistory", loginHistorySchema);
