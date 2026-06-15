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
    convenienceFeeMode: { type: String, enum: ['per_transaction', 'per_hour', 'monthly_flat'], default: 'per_hour' },
    convenienceFeeMonthlyAmount: { type: Number, default: 0, min: 0 },
    additionalFees: [{
      name: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      type: { type: String, enum: ['fixed', 'per_person'], default: 'fixed' },
      isEnabled: { type: Boolean, default: true },
      isOptional: { type: Boolean, default: true },
    }],
    description: { type: String, trim: true },
    photos: { type: [String], default: [] },
    socialLinks: {
      facebook:  { type: String, trim: true },
      instagram: { type: String, trim: true },
      reclub:    { type: String, trim: true },
    },
    rating:       { type: Number, default: 0, min: 0, max: 5 },
    reviewCount:  { type: Number, default: 0, min: 0 },
    totalBookings:{ type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Club", clubSchema);
