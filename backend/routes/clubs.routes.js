const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const Club = require("../models/Club");
const User = require("../models/User");

const router = express.Router();

// GET /api/clubs — list all clubs (public, needed for login/register selectors)
router.get("/", async (req, res) => {
  try {
    const clubs = await Club.find().sort({ name: 1 }).lean();
    const admins = await User.find(
      { role: "admin", clubId: { $in: clubs.map((c) => c._id) } },
      "clubId termsAcceptedAt",
    ).lean();
    const termsMap = {};
    admins.forEach((a) => { termsMap[a.clubId.toString()] = !!a.termsAcceptedAt; });
    res.json(clubs.map((c) => ({ ...c, adminTermsAccepted: termsMap[c._id.toString()] ?? false })));
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
    const { name, location, mobile, email, logo, courtCount, courts, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount } = req.body;
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { name, location, mobile, email, logo, courtCount, ...(courts !== undefined ? { courts } : {}), openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount },
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
      if (!["per_transaction", "per_hour", "monthly_flat", "club_absorbs"].includes(req.body.convenienceFeeMode)) {
        return res.status(400).json({ error: "convenienceFeeMode must be 'per_transaction', 'per_hour', 'monthly_flat', or 'club_absorbs'" });
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

// PATCH /api/clubs/:id/additional-fees — replace per-club additional fees list (superadmin only)
router.patch("/:id/additional-fees", auth, superadmin, async (req, res) => {
  try {
    const { additionalFees } = req.body;
    if (!Array.isArray(additionalFees)) {
      return res.status(400).json({ error: "additionalFees must be an array" });
    }
    for (const fee of additionalFees) {
      if (!fee.name || typeof fee.name !== 'string' || fee.name.trim() === '') {
        return res.status(400).json({ error: "Each fee must have a non-empty name" });
      }
      if (typeof fee.amount !== 'number' || fee.amount < 0) {
        return res.status(400).json({ error: "Each fee amount must be a non-negative number" });
      }
      if (fee.type && !['fixed', 'per_person'].includes(fee.type)) {
        return res.status(400).json({ error: "Fee type must be 'fixed' or 'per_person'" });
      }
    }
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { additionalFees },
      { new: true, runValidators: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/screenshot-setting — toggle payment screenshot required/optional (superadmin only)
router.patch("/:id/screenshot-setting", auth, superadmin, async (req, res) => {
  try {
    const { requirePaymentScreenshot } = req.body;
    if (typeof requirePaymentScreenshot !== 'boolean') {
      return res.status(400).json({ error: "requirePaymentScreenshot must be a boolean" });
    }
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { requirePaymentScreenshot },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/balance-alert — toggle outstanding balance alert on club admin login (superadmin only)
router.patch("/:id/balance-alert", auth, superadmin, async (req, res) => {
  try {
    const { balanceAlertEnabled } = req.body;
    if (typeof balanceAlertEnabled !== 'boolean') {
      return res.status(400).json({ error: "balanceAlertEnabled must be a boolean" });
    }
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { balanceAlertEnabled },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/booking-process — switch booking workflow (superadmin only)
router.patch("/:id/booking-process", auth, superadmin, async (req, res) => {
  try {
    const { bookingProcess } = req.body;
    if (!["reservation", "per_game", "hosted_play"].includes(bookingProcess)) {
      return res.status(400).json({ error: "bookingProcess must be 'reservation', 'per_game' or 'hosted_play'" });
    }
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { bookingProcess },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/hosted-play-queue — enable/disable Queue Management (superadmin only)
router.patch("/:id/hosted-play-queue", auth, superadmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { hostedPlayQueueEnabled: !!enabled },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/queue-management-fee — set Queue Management fee per player (superadmin only)
router.patch("/:id/queue-management-fee", auth, superadmin, async (req, res) => {
  try {
    const fee = Math.max(0, Number(req.body.fee) || 0);
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { queueManagementFeePerPlayer: fee },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({ queueManagementFeePerPlayer: club.queueManagementFeePerPlayer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/booking-qr — set or clear the booking QR code (admin only)
router.patch("/:id/booking-qr", auth, admin, async (req, res) => {
  try {
    const { bookingQrCode } = req.body;
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { bookingQrCode: bookingQrCode ?? null },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/guest-terms — set per-club guest T&C text and/or notification (superadmin or club's own admin)
router.patch("/:id/guest-terms", auth, admin, async (req, res) => {
  try {
    const { guestTermsText, guestTermsNotification } = req.body;
    if (typeof guestTermsText !== "string" && guestTermsNotification === undefined) {
      return res.status(400).json({ error: "guestTermsText or guestTermsNotification must be provided" });
    }
    if (req.user.role !== "superadmin") {
      const club = await Club.findById(req.params.id, "_id clubId").lean();
      if (!club) return res.status(404).json({ error: "Club not found" });
      if (String(req.user.clubId) !== String(req.params.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    const update = {};
    if (typeof guestTermsText === "string") update.guestTermsText = guestTermsText || null;
    if (guestTermsNotification !== undefined) update.guestTermsNotification = guestTermsNotification || null;
    const updated = await Club.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Club not found" });
    res.json({ guestTermsText: updated.guestTermsText, guestTermsNotification: updated.guestTermsNotification });
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
