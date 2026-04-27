const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Charge = require("../models/Charge");
const Session = require("../models/Session");

const router = express.Router();

// GET /api/charges/my - get player's own charges
router.get("/my", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    console.log("Fetching charges for user:", req.user.userId);
    const charges = await Charge.find({ clubId, playerId: req.user.userId })
      .populate("reservationId", "date court timeSlot")
      .populate("sessionId", "date startTime ballBoyUsed")
      .sort({ createdAt: -1 })
      .lean();
    console.log("Found charges:", charges.length);
    res.json(charges);
  } catch (err) {
    console.error("Error fetching charges:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// GET /api/charges/pending-approval - list charges with approval workflow (admin only)
// ?status=pending (default) | approved | rejected | all
router.get("/pending-approval", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const cf = clubId ? { clubId } : {};
    const { status } = req.query;
    let filter;
    if (!status || status === "pending") {
      filter = { ...cf, approvalStatus: "pending" };
    } else if (status === "approved") {
      filter = { ...cf, approvalStatus: "approved" };
    } else if (status === "rejected") {
      filter = { ...cf, approvalStatus: "rejected" };
    } else {
      // "all" — return every charge that has entered the approval workflow
      filter = { ...cf, approvalStatus: { $ne: "none" } };
    }

    const charges = await Charge.find(filter)
      .populate("playerId", "name email username")
      .populate("reservationId", "date court timeSlot")
      .populate("sessionId", "date startTime ballBoyUsed")
      .sort({ paidAt: -1 })
      .lean();
    res.json(charges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/charges/:id/approve - admin approves a pending payment
router.patch("/:id/approve", auth, admin, async (req, res) => {
  try {
    const charge = await Charge.findById(req.params.id);
    if (!charge) return res.status(404).json({ error: "Charge not found" });

    if (charge.approvalStatus !== "pending") {
      return res.status(400).json({ error: "Charge is not pending approval" });
    }

    charge.status = "paid";
    charge.approvalStatus = "approved";
    await charge.save();

    // Sync session embedded player entry if applicable
    if (charge.sessionId) {
      await Session.updateOne(
        { _id: charge.sessionId, "players.playerId": charge.playerId },
        {
          $set: {
            "players.$.status": "paid",
            "players.$.approvalStatus": "approved",
            "players.$.paymentMethod": charge.paymentMethod,
            "players.$.paidAt": charge.paidAt,
          },
        },
      );
    }

    res.json({ message: "Payment approved", charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/charges/:id/reject - admin rejects a pending payment
router.patch("/:id/reject", auth, admin, async (req, res) => {
  try {
    const { adminNote } = req.body;
    const charge = await Charge.findById(req.params.id);
    if (!charge) return res.status(404).json({ error: "Charge not found" });

    if (charge.approvalStatus !== "pending") {
      return res.status(400).json({ error: "Charge is not pending approval" });
    }

    charge.status = "unpaid";
    charge.approvalStatus = "rejected";
    charge.paymentMethod = undefined;
    charge.paidAt = undefined;
    if (adminNote) charge.adminNote = adminNote;
    await charge.save();

    // Sync session embedded player entry if applicable
    if (charge.sessionId) {
      await Session.updateOne(
        { _id: charge.sessionId, "players.playerId": charge.playerId },
        {
          $set: {
            "players.$.status": "unpaid",
            "players.$.approvalStatus": "rejected",
          },
          $unset: {
            "players.$.paymentMethod": "",
            "players.$.paidAt": "",
          },
        },
      );
    }

    res.json({ message: "Payment rejected", charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/charges/:id - get single charge (player owner or admin)
router.get("/:id", auth, async (req, res) => {
  try {
    const charge = await Charge.findById(req.params.id)
      .populate("playerId", "name email")
      .populate("reservationId", "date court timeSlot")
      .populate("sessionId", "date startTime endTime ballBoyUsed");

    if (!charge) {
      return res.status(404).json({ error: "Charge not found" });
    }

    const isOwner = charge.playerId._id.toString() === req.user.userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(charge);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/charges/:id/pay - player logs a payment (enters pending approval)
router.patch("/:id/pay", auth, async (req, res) => {
  try {
    console.log("PATCH /charges/:id/pay received");
    console.log("Charge ID:", req.params.id);
    console.log("User ID:", req.user.userId);
    console.log("Request body:", req.body);

    const { paymentMethod } = req.body;

    if (!paymentMethod || !["GCash", "Cash", "Bank Transfer"].includes(paymentMethod)) {
      console.error("Invalid payment method:", paymentMethod);
      return res.status(400).json({ error: "Valid paymentMethod required (GCash, Cash, Bank Transfer)" });
    }

    const charge = await Charge.findById(req.params.id);
    console.log("Charge found:", charge ? "yes" : "no");

    if (!charge) {
      return res.status(404).json({ error: "Charge not found" });
    }

    const isOwner = charge.playerId.toString() === req.user.userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

    console.log("Is owner:", isOwner, "Is admin:", isAdmin);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Block if already paid (legacy: approvalStatus "none", or newly approved)
    if (charge.status === "paid") {
      return res.status(400).json({ error: "Charge already paid" });
    }

    // Record payment details — stays unpaid until admin approves
    charge.paymentMethod = paymentMethod;
    charge.paidAt = new Date();
    charge.approvalStatus = "pending";
    charge.adminNote = undefined;

    await charge.save();
    console.log("Charge saved successfully:", charge._id);

    res.json({ message: "Payment submitted for approval", charge });
  } catch (err) {
    console.error("Error in PATCH /charges/:id/pay:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// GET /api/charges - list all charges (admin)
router.get("/", auth, admin, async (req, res) => {
  try {
    const { playerId, status, approvalStatus } = req.query;
    const clubId = req.query.clubId || req.user.clubId;
    const filter = clubId ? { clubId } : {};

    if (playerId) filter.playerId = playerId;
    if (status && ["paid", "unpaid"].includes(status)) filter.status = status;
    if (approvalStatus && ["none", "pending", "approved", "rejected"].includes(approvalStatus)) {
      filter.approvalStatus = approvalStatus;
    }

    const charges = await Charge.find(filter)
      .populate("playerId", "name email username")
      .populate("reservationId", "date court timeSlot")
      .populate("sessionId", "date startTime ballBoyUsed")
      .sort({ createdAt: -1 })
      .lean();

    res.json(charges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
