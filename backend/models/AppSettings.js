const mongoose = require("mongoose");

const appSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "global" },
    reviewFormUrl: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);
