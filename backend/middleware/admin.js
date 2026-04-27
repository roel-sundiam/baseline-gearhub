module.exports = function adminMiddleware(req, res, next) {
  if (
    !req.user ||
    (req.user.role !== "admin" && req.user.role !== "superadmin")
  ) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};
