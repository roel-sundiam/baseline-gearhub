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

module.exports = router;
