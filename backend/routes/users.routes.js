const express = require("express");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const User = require("../models/User");

const router = express.Router();

// POST /api/users/create-admin — superadmin creates a club admin account
router.post("/create-admin", auth, superadmin, async (req, res) => {
  try {
    const { name, username, password, clubId, email, contactNumber } = req.body;

    if (!name || !username || !password || !clubId) {
      return res.status(400).json({ error: "name, username, password, and clubId are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ error: "Username already taken" });
    }
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(409).json({ error: "Email already registered" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      username,
      email: email || undefined,
      contactNumber: contactNumber || undefined,
      passwordHash,
      role: "admin",
      status: "active",
      clubId,
    });

    res.status(201).json({ message: "Admin account created", userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/admins — list all admin/superadmin users (superadmin only)
router.get("/admins", auth, superadmin, async (req, res) => {
  try {
    const { clubId } = req.query;
    const filter = { role: { $in: ["admin", "superadmin"] } };
    if (clubId) filter.clubId = clubId;
    const users = await User.find(filter)
      .select("-passwordHash")
      .populate("clubId", "name")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/directory/members — list active players for member directory
router.get("/directory/members", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const users = await User.find({ clubId, status: "active", role: "player" })
      .select("_id name email contactNumber gender profileImage createdAt")
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/pending — list pending users (admin)
router.get("/pending", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const filter = { status: "pending", ...(clubId ? { clubId } : {}) };
    const users = await User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users — list all users (admin)
router.get("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const users = await User.find(clubId ? { clubId } : {})
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/active-players — list active players
router.get("/active-players", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const users = await User.find({ clubId, status: "active", role: "player" })
      .select("_id name email")
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/users/:id/approve (admin)
router.put("/:id/approve", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active" },
      { new: true },
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/users/:id/reject (admin)
router.put("/:id/reject", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true },
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/:id/profile — get user's profile (authenticated)
router.get("/:id/profile", auth, async (req, res) => {
  try {
    // Users can only view their own profile (unless admin)
    if (req.user.userId !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/users/:id/profile — update user's profile (authenticated)
router.put("/:id/profile", auth, async (req, res) => {
  try {
    // Users can only update their own profile (unless admin)
    if (req.user.userId !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, contactNumber, gender, profileImage } = req.body;

    const update = {};
    if (name) update.name = name;
    if (contactNumber) update.contactNumber = contactNumber;
    if (gender) update.gender = gender;
    if (profileImage !== undefined) update.profileImage = profileImage;

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/users/:id/change-password — change user's password (authenticated)
router.put("/:id/change-password", auth, async (req, res) => {
  try {
    // Users can only change their own password (unless admin changing their own)
    if (req.user.userId !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = newHash;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
