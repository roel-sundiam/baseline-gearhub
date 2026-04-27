const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const LoginHistory = require("../models/LoginHistory");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
      contactNumber,
      gender,
      profileImage,
      clubId,
    } = req.body;

    if (!name || !username || !password) {
      return res
        .status(400)
        .json({ error: "Name, username, and password are required" });
    }

    if (!clubId) {
      return res.status(400).json({ error: "Club selection is required" });
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
      passwordHash,
      contactNumber,
      gender,
      profileImage: profileImage || null,
      role: "player",
      status: "pending",
      clubId,
    });

    res.status(201).json({
      message: "Your account is pending admin approval",
      userId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (user.status === "pending") {
      return res.status(403).json({ error: "Account pending admin approval" });
    }
    if (user.status === "rejected") {
      return res.status(403).json({ error: "Account has been rejected" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        name: user.name,
        username: user.username,
        clubId: user.clubId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Record login in history
    await LoginHistory.create({
      userId: user._id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage || null,
        clubId: user.clubId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
