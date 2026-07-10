const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Club = require("../models/Club");
const Rates = require("../models/Rates");
const LoginHistory = require("../models/LoginHistory");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");
const superadminMiddleware = require("../middleware/superadmin");
const { sendPushToUser } = require("../utils/push");
const AppSettings = require("../models/AppSettings");

async function notifySuperadmins(title, body, data = {}) {
  try {
    const superadmins = await User.find({ role: "superadmin" }, "_id").lean();
    await Promise.all(superadmins.map(async (sa) => {
      await Notification.create({ userId: sa._id, type: data.type || "info", title, body, data });
      await sendPushToUser(sa._id, { title, body, data });
    }));
  } catch (err) {
    console.error("notifySuperadmins error:", err.message);
  }
}

const router = express.Router();

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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

    if (user.role !== "superadmin") {
      if (user.status === "pending") {
        return res.status(403).json({ error: "Account pending admin approval" });
      }
      if (user.status === "rejected") {
        return res.status(403).json({ error: "Account has been rejected" });
      }
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (user.clubId && user.role !== "superadmin") {
      const club = await Club.findById(user.clubId).lean();
      if (club?.status === "suspended") {
        return res.status(403).json({ error: "Your club has been suspended. Please contact support." });
      }
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
        termsAccepted: !!user.termsAcceptedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/accept-terms
router.post("/accept-terms", authMiddleware, async (req, res) => {
  try {
    const settings = await AppSettings.findOne({ _id: "global" }, "termsVersion").lean();
    const version = settings?.termsVersion ?? 1;
    await User.findByIdAndUpdate(req.user.userId, {
      termsAcceptedAt: new Date(),
      termsAcceptedVersion: version,
    });
    res.json({ message: "Terms accepted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/register-club
router.post("/register-club", async (req, res) => {
  try {
    const {
      clubName,
      adminName,
      adminUsername,
      adminPassword,
      location,
      logo,
      email,
      contactNumber,
      description,
      photos,
      bookingProcess,
      courtCount,
      openingHour,
      closingHour,
      paymentMethods,
      paymentAccounts,
      paymentQrCodes,
      socialLinks,
      reservationWeekdayRate,
      reservationWeekendRate,
      reservationHolidayRate,
      perGameFee,
    } = req.body;

    if (!clubName || !adminName || !adminUsername || !adminPassword || !logo) {
      return res.status(400).json({
        error: "Club name, logo, admin name, username, and password are required",
      });
    }

    const existingUsername = await User.findOne({ username: adminUsername });
    if (existingUsername) {
      return res.status(409).json({ error: "Username already taken" });
    }

    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(409).json({ error: "Email already registered" });
      }
    }

    let slug = generateSlug(clubName);
    const slugExists = await Club.findOne({ slug }).lean();
    if (slugExists) slug = slug + '-' + Math.random().toString(36).slice(2, 6);

    const club = await Club.create({
      name: clubName,
      slug,
      location: location || undefined,
      logo: logo || null,
      status: "active",
      email: email || undefined,
      mobile: contactNumber || undefined,
      description: description || undefined,
      photos: Array.isArray(photos) ? photos.slice(0, 4) : [],
      bookingProcess: bookingProcess || 'reservation',
      courtCount: courtCount ? Number(courtCount) : 2,
      openingHour: openingHour !== undefined ? Number(openingHour) : 5,
      closingHour: closingHour !== undefined ? Number(closingHour) : 22,
      paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [],
      paymentAccounts: paymentAccounts && typeof paymentAccounts === 'object' ? paymentAccounts : {},
      paymentQrCodes: paymentQrCodes && typeof paymentQrCodes === 'object' ? paymentQrCodes : {},
      socialLinks: socialLinks && typeof socialLinks === 'object' ? socialLinks : {},
      convenienceFeeMode: 'per_hour',
      convenienceFeeRate: 0.05,
    });

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await User.create({
      name: adminName,
      username: adminUsername,
      email: email || undefined,
      passwordHash,
      contactNumber: contactNumber || undefined,
      role: "admin",
      status: "active",
      clubId: club._id,
    });

    res.status(201).json({
      message: "Club registered successfully. You can now log in.",
      clubId: club._id,
      adminId: admin._id,
    });

    if (bookingProcess === 'reservation' && (reservationWeekdayRate || reservationWeekendRate || reservationHolidayRate)) {
      await Rates.findOneAndUpdate(
        { clubId: club._id },
        {
          $set: {
            reservationWeekdayRate: Number(reservationWeekdayRate) || 0,
            reservationWeekendRate: Number(reservationWeekendRate) || 0,
            reservationHolidayRate: Number(reservationHolidayRate) || 0,
          },
          $setOnInsert: { clubId: club._id },
        },
        { upsert: true },
      );
    }
    if (bookingProcess === 'per_game' && perGameFee) {
      await Rates.findOneAndUpdate(
        { clubId: club._id },
        {
          $set: { perGameFee: Number(perGameFee) || 0 },
          $setOnInsert: { clubId: club._id },
        },
        { upsert: true },
      );
    }

    notifySuperadmins(
      "New Club Registered",
      `${clubName} has joined Baseline Gearhub.`,
      { type: "club_registered", clubId: club._id.toString(), clubName },
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/impersonate/:userId  (superadmin only)
router.post('/impersonate/:userId', authMiddleware, superadminMiddleware, async (req, res) => {
  try {
    const target = await User.findById(req.params.userId).lean();
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'superadmin') return res.status(400).json({ error: 'Cannot impersonate another superadmin' });

    const token = jwt.sign(
      { userId: target._id, role: target.role, name: target.name, username: target.username, clubId: target.clubId },
      process.env.JWT_SECRET,
      { expiresIn: '2h' },
    );
    res.json({
      token,
      user: {
        id: target._id,
        name: target.name,
        username: target.username,
        role: target.role,
        profileImage: target.profileImage || null,
        clubId: target.clubId,
        termsAccepted: !!target.termsAcceptedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
