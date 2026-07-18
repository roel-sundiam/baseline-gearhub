const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const User = require("../models/User");
const Club = require("../models/Club");
const ClubMembership = require("../models/ClubMembership");
const Notification = require("../models/Notification");
const { ownsClub } = require("../utils/scope");
const { sendPushToUser } = require("../utils/push");

const router = express.Router();

async function notifyClubAdmins(clubId, title, body, data = {}) {
  try {
    const admins = await User.find({ role: "admin", clubId }, "_id").lean();
    await Promise.all(admins.map(async (a) => {
      await Notification.create({ userId: a._id, type: data.type || "info", title, body, data });
      await sendPushToUser(a._id, { title, body, data });
    }));
  } catch (err) {
    console.error("notifyClubAdmins error:", err.message);
  }
}

// GET /api/memberships/mine — the caller's club memberships, home club included
router.get("/mine", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("clubId status role").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const memberships = await ClubMembership.find({ userId: user._id })
      .populate("clubId", "name logo location status")
      .sort({ joinedAt: 1 })
      .lean();

    // Legacy accounts may predate the backfill: surface the home club as a
    // virtual membership so the UI always sees it.
    const hasHome = user.clubId && memberships.some(
      (m) => m.clubId && String(m.clubId._id) === String(user.clubId),
    );
    if (user.clubId && !hasHome) {
      const homeClub = await Club.findById(user.clubId).select("name logo location status").lean();
      if (homeClub) {
        memberships.unshift({
          _id: null,
          userId: user._id,
          clubId: homeClub,
          status: user.status,
          joinedAt: null,
          approvedAt: null,
        });
      }
    }

    res.json(memberships.map((m) => ({
      _id: m._id,
      club: m.clubId,
      status: m.status,
      isHomeClub: !!m.clubId && String(m.clubId._id) === String(user.clubId),
      joinedAt: m.joinedAt,
      approvedAt: m.approvedAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/memberships/join — request to join another club (players only)
router.post("/join", auth, async (req, res) => {
  try {
    if (req.user.role !== "player") {
      return res.status(403).json({ error: "Only players can join additional clubs" });
    }
    const { clubId } = req.body;
    if (!clubId) return res.status(400).json({ error: "clubId is required" });

    const user = await User.findById(req.user.userId).select("name clubId").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const club = await Club.findById(clubId).select("name status").lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") {
      return res.status(403).json({ error: "This club is currently suspended" });
    }
    if (user.clubId && String(user.clubId) === String(clubId)) {
      return res.status(409).json({ error: "You are already a member of this club" });
    }

    const existing = await ClubMembership.findOne({ userId: user._id, clubId });
    if (existing) {
      if (existing.status === "rejected") {
        existing.status = "pending";
        existing.joinedAt = new Date();
        existing.approvedAt = null;
        await existing.save();
        await notifyClubAdmins(clubId, "New member request", `${user.name} requested to join ${club.name}`, { type: "member_request" });
        return res.status(201).json({ message: "Join request sent — pending club admin approval", membershipId: existing._id });
      }
      if (existing.status === "deactivated") {
        return res.status(403).json({ error: "Your membership at this club was deactivated. Please contact the club admin." });
      }
      return res.status(409).json({
        error: existing.status === "pending"
          ? "You already have a pending request for this club"
          : "You are already a member of this club",
      });
    }

    const membership = await ClubMembership.create({ userId: user._id, clubId, status: "pending" });
    await notifyClubAdmins(clubId, "New member request", `${user.name} requested to join ${club.name}`, { type: "member_request" });
    res.status(201).json({ message: "Join request sent — pending club admin approval", membershipId: membership._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Approve/reject share the same lookup + club-ownership guard.
async function loadGuardedMembership(req, res) {
  const membership = await ClubMembership.findById(req.params.id);
  if (!membership) {
    res.status(404).json({ error: "Membership not found" });
    return null;
  }
  if (!ownsClub(req, membership.clubId)) {
    res.status(403).json({ error: "You can only manage your own club's members" });
    return null;
  }
  return membership;
}

// Keep the legacy User.status in sync when the membership being changed is the
// user's home club — login gating still reads User.status.
async function syncHomeStatus(membership, status) {
  const user = await User.findById(membership.userId).select("clubId");
  if (user && user.clubId && String(user.clubId) === String(membership.clubId)) {
    user.status = status;
    await user.save();
  }
}

// PUT /api/memberships/:id/approve (admin)
router.put("/:id/approve", auth, admin, async (req, res) => {
  try {
    const membership = await loadGuardedMembership(req, res);
    if (!membership) return;

    membership.status = "active";
    membership.approvedAt = new Date();
    await membership.save();
    await syncHomeStatus(membership, "active");

    const club = await Club.findById(membership.clubId).select("name").lean();
    try {
      await Notification.create({
        userId: membership.userId,
        type: "member_request",
        title: "Membership approved",
        body: `Your request to join ${club?.name || "the club"} was approved`,
      });
      await sendPushToUser(membership.userId, {
        title: "Membership approved",
        body: `Your request to join ${club?.name || "the club"} was approved`,
      });
    } catch (err) {
      console.error("membership approve notify error:", err.message);
    }
    res.json(membership.toObject({ versionKey: false }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/memberships/:id/reject (admin)
router.put("/:id/reject", auth, admin, async (req, res) => {
  try {
    const membership = await loadGuardedMembership(req, res);
    if (!membership) return;

    membership.status = "rejected";
    membership.approvedAt = null;
    await membership.save();
    await syncHomeStatus(membership, "rejected");
    res.json(membership.toObject({ versionKey: false }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
