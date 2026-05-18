const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["guest", "admin"], required: true },
  name: { type: String, required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const inquirySchema = new mongoose.Schema({
  clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
  senderName: { type: String, required: true, trim: true },
  senderEmail: { type: String, required: true, trim: true },
  status: { type: String, enum: ["unread", "read", "replied"], default: "unread" },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Inquiry", inquirySchema);
