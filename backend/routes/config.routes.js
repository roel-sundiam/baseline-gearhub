const express = require("express");
const router = express.Router();
const AppSettings = require("../models/AppSettings");
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

// GET /api/config/announcement — any authenticated user; club admins poll this on dashboard load
router.get("/announcement", auth, async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { _id: "global" },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      enabled: settings.announcementEnabled,
      title: settings.announcementTitle,
      text: settings.announcementText,
      version: settings.announcementVersion,
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
