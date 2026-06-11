const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const Club = require("../models/Club");

const router = express.Router();

// GET /api/clubs — list all clubs (public, needed for login/register selectors)
router.get("/", async (req, res) => {
  try {
    const clubs = await Club.find().sort({ name: 1 }).lean();
    res.json(clubs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/clubs/:id — get a single club
router.get("/:id", async (req, res) => {
  try {
    const club = await Club.findById(req.params.id).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({
      ...club,
      paymentAccounts: club.paymentAccounts instanceof Map ? Object.fromEntries(club.paymentAccounts) : (club.paymentAccounts ?? {}),
      paymentQrCodes: club.paymentQrCodes instanceof Map ? Object.fromEntries(club.paymentQrCodes) : (club.paymentQrCodes ?? {}),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/clubs — create a club (admin only)
router.post("/", auth, admin, async (req, res) => {
  try {
    const { name, location, mobile, email, logo, courtCount, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount } = req.body;
    if (!name) return res.status(400).json({ error: "Club name is required" });
    const club = await Club.create({ name, location, mobile, email, logo, courtCount, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount });
    res.status(201).json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/clubs/:id — update a club (admin only)
router.put("/:id", auth, admin, async (req, res) => {
  try {
    const { name, location, mobile, email, logo, courtCount, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount } = req.body;
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { name, location, mobile, email, logo, courtCount, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount },
      { new: true, runValidators: true },
    );
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/status — suspend or unsuspend a club (admin only)
router.patch("/:id/status", auth, admin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status))
      return res.status(400).json({ error: "Invalid status" });
    const club = await Club.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/convenience-fee — set per-club convenience fee rate and mode (superadmin only)
router.patch("/:id/convenience-fee", auth, superadmin, async (req, res) => {
  try {
    const update = {};
    if (req.body.convenienceFeeRate !== undefined) {
      const rate = Number(req.body.convenienceFeeRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return res.status(400).json({ error: "convenienceFeeRate must be a number between 0 and 1" });
      }
      update.convenienceFeeRate = rate;
    }
    if (req.body.convenienceFeeMode !== undefined) {
      if (!["per_transaction", "per_hour", "monthly_flat"].includes(req.body.convenienceFeeMode)) {
        return res.status(400).json({ error: "convenienceFeeMode must be 'per_transaction', 'per_hour', or 'monthly_flat'" });
      }
      update.convenienceFeeMode = req.body.convenienceFeeMode;
    }
    if (req.body.convenienceFeeMonthlyAmount !== undefined) {
      const monthly = Number(req.body.convenienceFeeMonthlyAmount);
      if (isNaN(monthly) || monthly < 0) {
        return res.status(400).json({ error: "convenienceFeeMonthlyAmount must be a non-negative number" });
      }
      update.convenienceFeeMonthlyAmount = monthly;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No valid fields provided" });
    }
    const club = await Club.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/clubs/:id — delete a club (admin only)
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const club = await Club.findByIdAndDelete(req.params.id);
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({ message: "Club deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
