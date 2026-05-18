const jwt = require('jsonwebtoken');
const Club = require('../models/Club');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (decoded.clubId && decoded.role !== 'superadmin') {
      const club = await Club.findById(decoded.clubId).lean();
      if (club?.status === 'suspended') {
        return res.status(403).json({ error: 'club_suspended' });
      }
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
