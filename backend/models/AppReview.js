const mongoose = require("mongoose");

const appReviewSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    reviewerName: { type: String, required: true, trim: true },
    clubName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true },
    isVisible: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AppReview", appReviewSchema);
