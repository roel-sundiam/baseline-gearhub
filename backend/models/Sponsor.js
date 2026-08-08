const mongoose = require('mongoose');

const sponsorSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true },
    logoUrl: { type: String, required: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    promoText: { type: String, trim: true, maxlength: 150 },
    link: { type: String, required: true, trim: true },
    tierDays: { type: Number, enum: [7, 30, 90], required: true },
    price: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'active', 'rejected'], default: 'draft' },
    paymentVerified: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sponsor', sponsorSchema);
