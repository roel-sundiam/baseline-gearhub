const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
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
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/clubs — create a club (admin only)
router.post("/", auth, admin, async (req, res) => {
  try {
    const { name, location, logo } = req.body;
    if (!name) return res.status(400).json({ error: "Club name is required" });
    const club = await Club.create({ name, location, logo });
    res.status(201).json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/clubs/:id — update a club (admin only)
router.put("/:id", auth, admin, async (req, res) => {
  try {
    const { name, location, logo } = req.body;
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { name, location, logo },
      { new: true, runValidators: true },
    );
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
