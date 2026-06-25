const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const AdminMessage = require('../models/AdminMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushToUser } = require('../utils/push');

const router = express.Router();

// POST / — send a message to another admin/superadmin
router.post('/', auth, adminMiddleware, async (req, res) => {
  try {
    const { toId, body } = req.body;
    if (!toId || !body?.trim()) {
      return res.status(400).json({ error: 'toId and body are required' });
    }

    const recipient = await User.findById(toId).lean();
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    const msg = await AdminMessage.create({ from: req.user.userId, to: toId, body: body.trim() });

    const populated = await AdminMessage.findById(msg._id)
      .populate('from', 'name role')
      .populate('to', 'name role')
      .lean();

    const sender = await User.findById(req.user.userId).select('name').lean();
    const notifTitle = `Message from ${sender?.name ?? 'Support'}`;
    const preview = body.trim().slice(0, 120);

    await Notification.create({
      userId: toId,
      type: 'admin_message',
      title: notifTitle,
      body: preview,
      data: { messageId: msg._id.toString(), senderId: req.user.userId },
    });
    await sendPushToUser(toId, { title: notifTitle, body: preview, data: { type: 'admin_message' } });

    res.status(201).json(populated);
  } catch (err) {
    console.error('admin-messages POST error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /conversation/:userId — full thread between me and another user
router.get('/conversation/:userId', auth, adminMiddleware, async (req, res) => {
  try {
    const me = req.user.userId;
    const other = req.params.userId;
    const messages = await AdminMessage.find({
      $or: [
        { from: me, to: other },
        { from: other, to: me },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('from', 'name role')
      .populate('to', 'name role')
      .lean();
    res.json(messages);
  } catch (err) {
    console.error('admin-messages GET conversation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /unread-count — messages sent TO me that are unread
router.get('/unread-count', auth, adminMiddleware, async (req, res) => {
  try {
    const count = await AdminMessage.countDocuments({ to: req.user.userId, read: false });
    res.json({ count });
  } catch (err) {
    console.error('admin-messages GET unread-count error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /read/:userId — mark all messages FROM userId TO me as read
router.patch('/read/:userId', auth, adminMiddleware, async (req, res) => {
  try {
    await AdminMessage.updateMany(
      { from: req.params.userId, to: req.user.userId, read: false },
      { $set: { read: true } },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('admin-messages PATCH read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /threads — conversation list with unread counts (for inbox views)
router.get('/threads', auth, adminMiddleware, async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.user.userId);
    const messages = await AdminMessage.find({ $or: [{ from: me }, { to: me }] })
      .sort({ createdAt: -1 })
      .populate('from', 'name role')
      .populate('to', 'name role')
      .lean();

    const threadMap = new Map();
    for (const msg of messages) {
      const other = msg.from._id.toString() === req.user.userId ? msg.to : msg.from;
      const key = other._id.toString();
      if (!threadMap.has(key)) {
        threadMap.set(key, { user: other, lastMessage: msg, unreadCount: 0 });
      }
      if (msg.to._id.toString() === req.user.userId && !msg.read) {
        threadMap.get(key).unreadCount++;
      }
    }

    res.json(Array.from(threadMap.values()));
  } catch (err) {
    console.error('admin-messages GET threads error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /support-contact — returns a superadmin for club admins to initiate chat
router.get('/support-contact', auth, adminMiddleware, async (req, res) => {
  try {
    const sa = await User.findOne({ role: 'superadmin', status: 'active' }).select('_id name').lean();
    if (!sa) return res.status(404).json({ error: 'No support contact available' });
    res.json(sa);
  } catch (err) {
    console.error('admin-messages GET support-contact error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
