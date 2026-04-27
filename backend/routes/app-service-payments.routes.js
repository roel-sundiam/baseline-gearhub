const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const AppServicePayment = require("../models/AppServicePayment");

const router = express.Router();

// GET /api/app-service-payments — list all (admin only)
router.get("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const payments = await AppServicePayment.find(clubId ? { clubId } : {})
      .populate("paidBy", "name email")
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/app-service-payments — record a payment (admin only)
router.post("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.body.clubId || req.user.clubId;
    const { amount, paymentMethod, note } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount required" });
    }
    if (!["GCash", "Cash", "Bank Transfer"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Valid paymentMethod required" });
    }
    const payment = await AppServicePayment.create({
      clubId,
      amount,
      paymentMethod,
      note: note || undefined,
      paidBy: req.user.userId,
    });
    await payment.populate("paidBy", "name email");
    res.status(201).json({ message: "Payment recorded", payment });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
