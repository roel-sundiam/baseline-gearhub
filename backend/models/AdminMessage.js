const mongoose = require('mongoose');

const adminMessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

adminMessageSchema.index({ from: 1, to: 1, createdAt: 1 });
adminMessageSchema.index({ to: 1, read: 1 });

module.exports = mongoose.model('AdminMessage', adminMessageSchema);
