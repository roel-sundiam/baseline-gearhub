const express = require("express");
const Inquiry = require("../models/Inquiry");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

// GET /api/inquiries — list for admin's club, newest first
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ clubId: req.user.clubId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(inquiries);
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
