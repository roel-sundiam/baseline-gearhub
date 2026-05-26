const express = require("express");
const Inquiry = require("../models/Inquiry");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

// Backwards-compat: old docs used message:String + replies:[]. Synthesize messages[] if empty.
function normalizeInquiry(inq) {
  if (inq.messages && inq.messages.length > 0) return inq;
  const msgs = [];
  if (inq.message) {
    msgs.push({ sender: "guest", name: inq.senderName, body: inq.message, createdAt: inq.createdAt });
  }
  if (Array.isArray(inq.replies)) {
    for (const r of inq.replies) {
      msgs.push({ sender: "admin", name: r.adminName || "Admin", body: r.body, createdAt: r.createdAt });
    }
  }
  return { ...inq, messages: msgs };
}

// GET /api/inquiries — list for admin's own club, or any club for superadmin (?clubId=)
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === "superadmin";
    const clubId = (isSuperAdmin && req.query.clubId) ? req.query.clubId : req.user.clubId;
    const inquiries = await Inquiry.find({ clubId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(inquiries.map(normalizeInquiry));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/inquiries/:id/read — mark as read
router.patch("/:id/read", auth, adminOnly, async (req, res) => {
  try {
    const inquiry = await Inquiry.findOneAndUpdate(
      { _id: req.params.id, clubId: req.user.clubId },
      { status: "read" },
      { new: true }
    );
    if (!inquiry) return res.status(404).json({ error: "Not found" });
    res.json(inquiry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/inquiries/:id/reply — add admin reply to messages thread
router.post("/:id/reply", auth, adminOnly, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: "body is required" });

    const inquiry = await Inquiry.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!inquiry) return res.status(404).json({ error: "Not found" });

    inquiry.messages.push({ sender: "admin", name: req.user.name, body: body.trim() });
    inquiry.status = "replied";
    await inquiry.save();

    res.json(inquiry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/inquiries/:id
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const inquiry = await Inquiry.findOneAndDelete({ _id: req.params.id, clubId: req.user.clubId });
    if (!inquiry) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
