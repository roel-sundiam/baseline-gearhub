const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    logo: { type: String, default: null },
    coinBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Club", clubSchema);
