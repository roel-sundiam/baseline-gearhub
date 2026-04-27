const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["player", "admin", "superadmin"],
      default: "player",
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected"],
      default: "pending",
    },
    contactNumber: { type: String, trim: true },
    gender: { type: String, enum: ["Male", "Female"] },
    profileImage: { type: String, default: null },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
