const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const Club = require("../models/Club");
const User = require("../models/User");
const { ownsClub } = require("../utils/scope");
const { ensureFinanceReportBilling } = require("../utils/financeReportBilling");
const { isDuprConfigured } = require("../utils/dupr");

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
    const { name, sport, location, mobile, email, logo, courtCount, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount } = req.body;
    if (!name) return res.status(400).json({ error: "Club name is required" });
    if (sport !== undefined && !['tennis', 'pickleball', 'badminton', 'squash', 'table_tennis', 'padel'].includes(sport)) {
      return res.status(400).json({ error: "Invalid sport" });
    }
    const club = await Club.create({ name, sport, location, mobile, email, logo, courtCount, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount });
    res.status(201).json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/clubs/:id — update a club (admin only)
router.put("/:id", auth, admin, async (req, res) => {
  try {
    if (!ownsClub(req, req.params.id)) return res.status(403).json({ error: "You can only manage your own club" });
    const { name, sport, location, mobile, email, logo, courtCount, courts, openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount } = req.body;
    if (sport !== undefined && !['tennis', 'pickleball', 'badminton', 'squash', 'table_tennis', 'padel'].includes(sport)) {
      return res.status(400).json({ error: "Invalid sport" });
    }
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { name, ...(sport !== undefined ? { sport } : {}), location, mobile, email, logo, courtCount, ...(courts !== undefined ? { courts } : {}), openingHour, closingHour, paymentMethods, paymentAccounts, paymentQrCodes, description, photos, socialLinks, rating, reviewCount },
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
    if (!ownsClub(req, req.params.id)) return res.status(403).json({ error: "You can only manage your own club" });
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

// PATCH /api/clubs/:id/hosted-play-convenience-fee — set Hosted Play's own app convenience fee, independent of the club-wide convenience fee above (superadmin only)
router.patch("/:id/hosted-play-convenience-fee", auth, superadmin, async (req, res) => {
  try {
    const update = {};
    if (req.body.hostedPlayConvenienceFeeMode !== undefined) {
      if (!["per_join", "per_session", "club_absorbs"].includes(req.body.hostedPlayConvenienceFeeMode)) {
        return res.status(400).json({ error: "hostedPlayConvenienceFeeMode must be 'per_join', 'per_session', or 'club_absorbs'" });
      }
      update.hostedPlayConvenienceFeeMode = req.body.hostedPlayConvenienceFeeMode;
    }
    if (req.body.hostedPlayConvenienceFeeRate !== undefined) {
      const rate = Number(req.body.hostedPlayConvenienceFeeRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return res.status(400).json({ error: "hostedPlayConvenienceFeeRate must be a number between 0 and 1" });
      }
      update.hostedPlayConvenienceFeeRate = rate;
    }
    if (req.body.hostedPlayConvenienceFeeAmount !== undefined) {
      const amount = Number(req.body.hostedPlayConvenienceFeeAmount);
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({ error: "hostedPlayConvenienceFeeAmount must be a non-negative number" });
      }
      update.hostedPlayConvenienceFeeAmount = amount;
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
    const update = { bookingProcess };
    if (bookingProcess !== "reservation") update.hostedPlayEnabled = false;
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/me/hosted-play-addon — club admin self-toggle Hosted Play add-on (reservation mode only)
router.patch("/me/hosted-play-addon", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this account" });
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.bookingProcess !== "reservation") {
      return res.status(400).json({ error: "Hosted Play add-on is only available for reservation-mode clubs" });
    }
    club.hostedPlayEnabled = !!req.body.enabled;
    await club.save();
    res.json(club.toObject());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/hosted-play-addon — enable/disable Hosted Play add-on (superadmin only)
router.patch("/:id/hosted-play-addon", auth, superadmin, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.bookingProcess !== "reservation") {
      return res.status(400).json({ error: "Hosted Play add-on is only available for reservation-mode clubs" });
    }
    club.hostedPlayEnabled = !!req.body.enabled;
    await club.save();
    res.json(club.toObject());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/me/finance-report-addon — club admin self-subscribe/cancel the Finance Report add-on
router.patch("/me/finance-report-addon", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this account" });
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });

    const enabled = !!req.body.enabled;
    club.financeReportEnabled = enabled;
    if (enabled) {
      // Reset the accrual start on every (re)subscribe; gap months are never billed.
      club.financeReportSubscribedAt = new Date();
    }
    await club.save();
    if (enabled) {
      // Bill the current month immediately (deduped by billingKey on resubscribe).
      await ensureFinanceReportBilling(club, req.user.userId);
    }
    res.json(club.toObject());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/finance-report-fee — set per-club Finance Report fee override (superadmin only)
router.patch("/:id/finance-report-fee", auth, superadmin, async (req, res) => {
  try {
    const { override } = req.body;
    if (override !== null) {
      const amount = Number(override);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: "override must be null or a non-negative number" });
      }
    }
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { financeReportFeeOverride: override === null ? null : Number(override) },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/me/hosted-play-queue — club admin self-toggle Queue Management
router.patch("/me/hosted-play-queue", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this account" });
    const { enabled } = req.body;
    const club = await Club.findByIdAndUpdate(
      clubId,
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

// PATCH /api/clubs/me/hosted-play-credits — club admin self-toggle Hosted Play credit usage
router.patch("/me/hosted-play-credits", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this account" });
    const { enabled } = req.body;
    const club = await Club.findByIdAndUpdate(
      clubId,
      { hostedPlayCreditsEnabled: !!enabled },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/hosted-play-credits — enable/disable Hosted Play credit usage (superadmin only)
router.patch("/:id/hosted-play-credits", auth, superadmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { hostedPlayCreditsEnabled: !!enabled },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/me/hosted-play-fee-split-mode — club admin self-toggle billing model
router.patch("/me/hosted-play-fee-split-mode", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this account" });
    const { mode } = req.body;
    if (!["per_player", "split_total"].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'per_player' or 'split_total'" });
    }
    const club = await Club.findByIdAndUpdate(
      clubId,
      { hostedPlayFeeSplitMode: mode },
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

// PATCH /api/clubs/:id/dupr-club-id — set this club's DUPR Club ID (superadmin only)
router.patch("/:id/dupr-club-id", auth, superadmin, async (req, res) => {
  try {
    const raw = req.body.duprClubId;
    const duprClubId = raw === null || raw === undefined || raw === "" ? null : String(raw).trim().slice(0, 64);
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { duprClubId },
      { new: true },
    ).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({ duprClubId: club.duprClubId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/me/dupr-club-id — club admin self-service entry of their own DUPR Club ID
router.patch("/me/dupr-club-id", auth, admin, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this account" });
    const raw = req.body.duprClubId;
    const duprClubId = raw === null || raw === undefined || raw === "" ? null : String(raw).trim().slice(0, 64);
    const club = await Club.findByIdAndUpdate(clubId, { duprClubId }, { new: true }).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({ duprClubId: club.duprClubId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/me/dupr-addon — club admin self-toggle the DUPR add-on
router.patch("/me/dupr-addon", auth, admin, async (req, res) => {
  try {
    if (!isDuprConfigured()) return res.status(409).json({ error: "DUPR is not configured on this platform" });
    const clubId = req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "No club associated with this account" });
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    club.duprEnabled = !!req.body.enabled;
    await club.save();
    res.json(club.toObject());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/dupr-addon — enable/disable the DUPR add-on (superadmin only)
router.patch("/:id/dupr-addon", auth, superadmin, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ error: "Club not found" });
    club.duprEnabled = !!req.body.enabled;
    await club.save();
    res.json(club.toObject());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/clubs/:id/booking-qr — set or clear the booking QR code (admin only)
router.patch("/:id/booking-qr", auth, admin, async (req, res) => {
  try {
    if (!ownsClub(req, req.params.id)) return res.status(403).json({ error: "You can only manage your own club" });
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
    if (!ownsClub(req, req.params.id)) return res.status(403).json({ error: "You can only manage your own club" });
    const club = await Club.findByIdAndDelete(req.params.id);
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({ message: "Club deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
