const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, sparse: true, unique: true },
    location: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true },
    logo: { type: String, default: null },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    courtCount: { type: Number, default: 2, min: 1, max: 20 },
    openingHour: { type: Number, default: 5, min: 0, max: 23 },
    closingHour: { type: Number, default: 22, min: 0, max: 23 },
    paymentMethods: { type: [String], default: [] },
    paymentAccounts: { type: Map, of: String, default: {} },
    paymentQrCodes: { type: Map, of: String, default: {} },
    convenienceFeeRate: { type: Number, default: 0.10, min: 0, max: 1 },
    convenienceFeeMode: { type: String, enum: ['per_transaction', 'per_hour'], default: 'per_hour' },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Club", clubSchema);
