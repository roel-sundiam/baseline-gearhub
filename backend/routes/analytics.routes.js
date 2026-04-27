const express = require("express");
const User = require("../models/User");
const Session = require("../models/Session");
const LoginHistory = require("../models/LoginHistory");
const PageVisit = require("../models/PageVisit");
const LiveVisitors = require("../models/LiveVisitors");
const auth = require("../middleware/auth");

const router = express.Router();

// Superadmin middleware
function superadminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access only" });
  }
  next();
}

// GET /api/analytics/summary - Get analytics overview
router.get("/summary", auth, superadminMiddleware, async (req, res) => {
  try {
    const totalPlayers = await User.countDocuments({ role: "player" });
    const totalAdmins = await User.countDocuments({
      role: { $in: ["admin", "superadmin"] },
    });
    const totalSessions = await Session.countDocuments();
    const activeUsers = await User.countDocuments({ status: "active" });
    const pendingUsers = await User.countDocuments({ status: "pending" });

    // Calculate total revenue and outstanding
    const sessions = await Session.find();
    let totalRevenue = 0;
    let totalOutstanding = 0;

    sessions.forEach((session) => {
      session.players.forEach((player) => {
        totalRevenue += player.charges.total;
        if (player.status === "unpaid") {
          totalOutstanding += player.charges.total;
        }
      });
    });

    const totalCollected = totalRevenue - totalOutstanding;

    res.json({
      summary: {
        totalPlayers,
        totalAdmins,
        totalSessions,
        activeUsers,
        pendingUsers,
        totalRevenue,
        totalCollected,
        totalOutstanding,
      },
    });
  } catch (err) {
    console.error("Analytics /summary error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// GET /api/analytics/login-history - Get recent logins
router.get("/login-history", auth, superadminMiddleware, async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const logins = await LoginHistory.find()
      .sort({ loginTime: -1 })
      .limit(parseInt(limit));

    res.json({ logins });
  } catch (err) {
    console.error("Analytics /login-history error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// POST /api/analytics/page-visit - Log a page visit (merge consecutive visits on refresh)
router.post("/page-visit", auth, async (req, res) => {
  try {
    const { pageName, pageUrl, timeSpent } = req.body;

    if (!pageName || !pageUrl) {
      return res
        .status(400)
        .json({ error: "pageName and pageUrl are required" });
    }

    // Check if this user visited the same page within the last 30 seconds
    // If so, update that record instead of creating a duplicate (handles page refreshes)
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const recentVisit = await PageVisit.findOne({
      userId: req.user.userId,
      pageName,
      pageUrl,
      visitTime: { $gte: thirtySecondsAgo },
    });

    if (recentVisit) {
      // Update existing record (merge refresh)
      recentVisit.timeSpent += timeSpent || 0;
      recentVisit.visitTime = new Date();
      await recentVisit.save();
      res.status(200).json({ message: "Page visit updated (merged refresh)", pageVisit: recentVisit });
    } else {
      // Create new record for different page or if 30s window passed
      const pageVisit = await PageVisit.create({
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        pageName,
        pageUrl,
        timeSpent: timeSpent || 0,
      });
      res.status(201).json({ message: "Page visit logged", pageVisit });
    }
  } catch (err) {
    console.error("Analytics /page-visit error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// GET /api/analytics/most-visited-pages - Get most visited pages
router.get(
  "/most-visited-pages",
  auth,
  superadminMiddleware,
  async (req, res) => {
    try {
      const pageStats = await PageVisit.aggregate([
        {
          $group: {
            _id: "$pageUrl",
            pageName: { $first: "$pageName" },
            visits: { $sum: 1 },
            totalTimeSpent: { $sum: "$timeSpent" },
            avgTimeSpent: { $avg: "$timeSpent" },
          },
        },
        { $sort: { visits: -1 } },
        { $limit: 10 },
      ]);

      res.json({ pages: pageStats });
    } catch (err) {
      console.error("Analytics /most-visited-pages error:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  },
);

// GET /api/analytics/recent-page-visits - Get recent page visits
router.get(
  "/recent-page-visits",
  auth,
  superadminMiddleware,
  async (req, res) => {
    try {
      const limit = req.query.limit || 100;
      const pageVisits = await PageVisit.find()
        .sort({ visitTime: -1 })
        .limit(parseInt(limit));

      res.json({ pageVisits });
    } catch (err) {
      console.error("Analytics /recent-page-visits error:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  },
);

// POST /api/analytics/live-visitor - Update or create live visitor record
router.post("/live-visitor", async (req, res) => {
  try {
    const { sessionId, userId, username, role, currentPage, currentPageUrl } =
      req.body;

    if (!sessionId || !username || !currentPage) {
      return res.status(400).json({
        error: "sessionId, username, and currentPage are required",
      });
    }

    // Update or create live visitor record
    const liveVisitor = await LiveVisitors.findOneAndUpdate(
      { sessionId },
      {
        userId: userId || null,
        username,
        role: role || "anonymous",
        currentPage,
        currentPageUrl: currentPageUrl || "",
        lastActivity: new Date(),
      },
      { upsert: true, new: true },
    );

    res.status(201).json({ message: "Live visitor updated", liveVisitor });
  } catch (err) {
    console.error("Analytics /live-visitor error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// GET /api/analytics/live-visitors - Get all current live visitors (includes anonymous)
router.get("/live-visitors", auth, superadminMiddleware, async (req, res) => {
  try {
    const limit = req.query.limit || 500;
    
    // Get all recent page visits from authenticated users
    const recentPageVisits = await PageVisit.find()
      .sort({ visitTime: -1 })
      .limit(parseInt(limit))
      .lean();

    // Transform PageVisits to match LiveVisitor interface
    const pageVisitorsData = recentPageVisits.map((visit) => ({
      _id: visit._id,
      sessionId: visit._id.toString(),
      userId: visit.userId || null,
      username: visit.username || 'Anonymous',
      role: visit.role || 'anonymous',
      currentPage: visit.pageName,
      currentPageUrl: visit.pageUrl,
      lastActivity: visit.visitTime,
      sessionStart: visit.visitTime,
      source: 'pageVisit',
    }));

    // Also get active anonymous/live sessions from LiveVisitors (includes anonymous users)
    const liveVisitors = await LiveVisitors.find()
      .sort({ lastActivity: -1 })
      .lean();

    // Transform LiveVisitors
    const liveVisitorsData = liveVisitors.map((visitor) => ({
      _id: visitor._id || visitor.sessionId,
      sessionId: visitor.sessionId,
      userId: visitor.userId || null,
      username: visitor.username || 'Anonymous',
      role: visitor.role || 'anonymous',
      currentPage: visitor.currentPage,
      currentPageUrl: visitor.currentPageUrl,
      lastActivity: visitor.lastActivity,
      sessionStart: visitor.sessionStart || visitor.lastActivity,
      source: 'liveVisitor',
    }));

    // Merge both arrays and deduplicate by username+currentPage combinations
    // Prioritize more recent activity
    const mergedMap = new Map();
    
    // Add live visitors first (more current)
    liveVisitorsData.forEach((v) => {
      const key = `${v.username}:${v.currentPage}`;
      mergedMap.set(key, v);
    });
    
    // Add page visits, but don't override existing entries for same user+page
    pageVisitorsData.forEach((v) => {
      const key = `${v.username}:${v.currentPage}`;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, v);
      }
    });

    // Convert map to array, sort by lastActivity, and limit
    const visitors = Array.from(mergedMap.values())
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, parseInt(limit));

    res.json({
      visitors,
      count: visitors.length,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Analytics /live-visitors error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// DELETE /api/analytics/live-visitor - Remove a live visitor record (on logout)
router.delete("/live-visitor/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await LiveVisitors.deleteOne({ sessionId });
    res.json({ message: "Live visitor removed" });
  } catch (err) {
    console.error("Analytics /live-visitor delete error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// DELETE /api/analytics/clear-visitors - Clear all visitor history (both page visits and live sessions)
router.delete("/clear-visitors", auth, superadminMiddleware, async (req, res) => {
  try {
    // Delete all page visits (authenticated user history)
    const pageVisitResult = await PageVisit.deleteMany({});
    
    // Also delete all live visitors (includes anonymous users and active sessions)
    const liveVisitorResult = await LiveVisitors.deleteMany({});
    
    res.json({
      message: "All visitor history cleared",
      pageVisitsDeleted: pageVisitResult.deletedCount,
      liveVisitorsDeleted: liveVisitorResult.deletedCount,
      totalDeleted: pageVisitResult.deletedCount + liveVisitorResult.deletedCount,
    });
  } catch (err) {
    console.error("Analytics /clear-visitors error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
