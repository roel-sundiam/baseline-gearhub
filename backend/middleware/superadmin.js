module.exports = function superadminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  next();
};
