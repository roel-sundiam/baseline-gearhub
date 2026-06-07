const express = require('express');
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const Notification = require('../models/Notification');

const router = express.Router();

// GET /api/notifications — recent notifications for the authenticated superadmin
router.get('/', auth, superadmin, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', auth, superadmin, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', auth, superadmin, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } },
      { new: true },
    );
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
