const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["income", "expense"], required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: '' },
    date: { type: Date, required: true },
    currency: { type: String, enum: ['PHP', 'USD'], default: 'PHP' },
    exchangeRateToPhp: { type: Number, default: 1 },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);
