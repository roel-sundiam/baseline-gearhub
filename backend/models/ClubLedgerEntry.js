const mongoose = require("mongoose");

// Per-club income/expense ledger for the Finance Report add-on.
// Separate from LedgerEntry, which is the platform operator's (superadmin) books.
const clubLedgerEntrySchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: '' },
    date: { type: Date, required: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

clubLedgerEntrySchema.index({ clubId: 1, date: -1 });

module.exports = mongoose.model("ClubLedgerEntry", clubLedgerEntrySchema);
