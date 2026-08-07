const express = require("express");
const router = express.Router();
const AppSettings = require("../models/AppSettings");
const User = require("../models/User");
const AnnouncementConfirmation = require("../models/AnnouncementConfirmation");
const auth = require("../middleware/auth");
const superadmin = require("../middleware/superadmin");

// GET /api/config/terms — public; seeds defaults on first call
router.get("/terms", async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      adminTermsText: settings.adminTermsText,
      guestTermsText: settings.guestTermsText,
      termsVersion: settings.termsVersion,
      termsUpdatedAt: settings.termsUpdatedAt,
      termsUpdatedBy: settings.termsUpdatedBy,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/config/terms — superadmin only; updates admin T&C (global) and optionally the global guest T&C default
router.put("/terms", auth, superadmin, async (req, res) => {
  try {
    const { adminTermsText, guestTermsText } = req.body;
    if (!adminTermsText || typeof adminTermsText !== "string") {
      return res.status(400).json({ error: "adminTermsText is required" });
    }
    const setFields = {
      adminTermsText,
      termsUpdatedAt: new Date(),
      termsUpdatedBy: req.user.username || req.user.userId,
    };
    if (guestTermsText && typeof guestTermsText === "string") {
      setFields.guestTermsText = guestTermsText;
    }
    const updated = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      { $set: setFields, $inc: { termsVersion: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      adminTermsText: updated.adminTermsText,
      guestTermsText: updated.guestTermsText,
      termsVersion: updated.termsVersion,
      termsUpdatedAt: updated.termsUpdatedAt,
      termsUpdatedBy: updated.termsUpdatedBy,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/config/finance-report-fee — global default Finance Report add-on price (superadmin only)
router.get("/finance-report-fee", auth, superadmin, async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ financeReportMonthlyFee: settings.financeReportMonthlyFee ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/config/finance-report-fee — update the global default price (superadmin only)
router.put("/finance-report-fee", auth, superadmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number" });
    }
    const updated = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      { $set: { financeReportMonthlyFee: amount } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ financeReportMonthlyFee: updated.financeReportMonthlyFee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/config/email-confirmations-fee — global default Email Confirmations add-on price (superadmin only)
router.get("/email-confirmations-fee", auth, superadmin, async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ emailConfirmationsMonthlyFee: settings.emailConfirmationsMonthlyFee ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/config/email-confirmations-fee — update the global default price (superadmin only)
router.put("/email-confirmations-fee", auth, superadmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number" });
    }
    const updated = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      { $set: { emailConfirmationsMonthlyFee: amount } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ emailConfirmationsMonthlyFee: updated.emailConfirmationsMonthlyFee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/config/member-activation-fee — global one-time member activation fee + free tier (superadmin only)
router.get("/member-activation-fee", auth, superadmin, async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      memberActivationFee: settings.memberActivationFee ?? 0,
      memberFreeTierCount: settings.memberFreeTierCount ?? 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/config/member-activation-fee — update the global fee/free-tier (superadmin only)
router.put("/member-activation-fee", auth, superadmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const freeTierCount = Number(req.body.freeTierCount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number" });
    }
    if (!Number.isFinite(freeTierCount) || freeTierCount < 0) {
      return res.status(400).json({ error: "freeTierCount must be a non-negative number" });
    }
    const updated = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      { $set: { memberActivationFee: amount, memberFreeTierCount: freeTierCount } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      memberActivationFee: updated.memberActivationFee,
      memberFreeTierCount: updated.memberFreeTierCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/config/announcement — any authenticated user; club admins poll this on dashboard load
router.get("/announcement", auth, async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    const requester = await User.findById(req.user.userId, "announcementAcceptedVersion").lean();
    res.json({
      enabled: settings.announcementEnabled,
      title: settings.announcementTitle,
      text: settings.announcementText,
      version: settings.announcementVersion,
      acceptedVersion: requester?.announcementAcceptedVersion ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/config/announcement/accept — admin only; records that this admin has
// confirmed the currently-published announcement version
router.post("/announcement/accept", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const settings = await AppSettings.findOne({ _id: "global" }, "announcementVersion announcementTitle").lean();
    const version = settings?.announcementVersion ?? 0;
    await User.findByIdAndUpdate(req.user.userId, { announcementAcceptedVersion: version });
    await AnnouncementConfirmation.create({
      userId: req.user.userId,
      username: req.user.username,
      clubId: req.user.clubId,
      announcementVersion: version,
      announcementTitle: settings?.announcementTitle || "",
    });
    res.json({ version });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/config/announcement/confirmations — superadmin only; who confirmed
// which version, and when. Defaults to the currently-published version;
// ?all=true returns confirmations across every past version (history view).
router.get("/announcement/confirmations", auth, superadmin, async (req, res) => {
  try {
    const all = req.query.all === "true";
    let version = null;
    let query = {};
    if (!all) {
      version = parseInt(req.query.version, 10);
      if (!Number.isFinite(version)) {
        const settings = await AppSettings.findOne({ _id: "global" }, "announcementVersion").lean();
        version = settings?.announcementVersion ?? 0;
      }
      query = { announcementVersion: version };
    }
    const confirmations = await AnnouncementConfirmation.find(query)
      .sort({ announcementVersion: -1, confirmedAt: -1 })
      .populate("clubId", "name")
      .lean();
    res.json({
      version,
      confirmations: confirmations.map((c) => ({
        username: c.username,
        clubName: c.clubId?.name ?? null,
        confirmedAt: c.confirmedAt,
        announcementVersion: c.announcementVersion,
        announcementTitle: c.announcementTitle || "",
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/config/announcement — superadmin only; publishing always bumps the version
router.put("/announcement", auth, superadmin, async (req, res) => {
  try {
    const { title, text, enabled } = req.body;
    if (enabled && (!text || typeof text !== "string")) {
      return res.status(400).json({ error: "text is required when enabled" });
    }
    const updated = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      {
        $set: {
          announcementTitle: typeof title === "string" ? title : "",
          announcementText: typeof text === "string" ? text : "",
          announcementEnabled: !!enabled,
          announcementUpdatedAt: new Date(),
          announcementUpdatedBy: req.user.username || req.user.userId,
        },
        $inc: { announcementVersion: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      enabled: updated.announcementEnabled,
      title: updated.announcementTitle,
      text: updated.announcementText,
      version: updated.announcementVersion,
      updatedAt: updated.announcementUpdatedAt,
      updatedBy: updated.announcementUpdatedBy,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
