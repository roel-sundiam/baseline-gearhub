const mongoose = require('mongoose');

const clubNewsSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    type: { type: String, enum: ['news', 'announcement', 'event'], default: 'news' },
    pinned: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClubNews', clubNewsSchema);
