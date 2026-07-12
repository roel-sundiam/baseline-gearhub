// Multi-tenant club-scoping helpers.
// Superadmin is exempt (may act across all clubs); club admins and players are
// limited to their own club. Use these on any admin route that loads or mutates
// a record by :id so the caller cannot reach another club's data.

function isSuper(req) {
  return !!req.user && req.user.role === "superadmin";
}

// True if the caller may act on a record belonging to `clubId`.
function ownsClub(req, clubId) {
  return isSuper(req) || (clubId != null && String(req.user.clubId) === String(clubId));
}

// A Mongoose filter fragment that limits a query to the caller's club
// (empty object for superadmin, so their queries are unrestricted).
function clubFilter(req) {
  return isSuper(req) ? {} : { clubId: req.user.clubId };
}

module.exports = { ownsClub, clubFilter };
