const mongoose = require('mongoose');

const sponsorInquirySchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['new', 'reviewed', 'archived'], default: 'new' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SponsorInquiry', sponsorInquirySchema);
