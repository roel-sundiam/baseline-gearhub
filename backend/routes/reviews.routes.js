const express = require("express");
const auth = require("../middleware/auth");
const superadmin = require("../middleware/superadmin");
const AppReview = require("../models/AppReview");

const router = express.Router();

router.use(auth, superadmin);

// GET /api/reviews
router.get("/", async (req, res) => {
  try {
    const reviews = await AppReview.find().sort({ createdAt: -1 }).lean();
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/reviews/:id — toggle visibility or update fields
router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["reviewerName", "clubName", "rating", "text", "isVisible"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const review = await AppReview.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/reviews/:id
router.delete("/:id", async (req, res) => {
  try {
    const review = await AppReview.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
