const express = require('express');
const auth = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');

const router = express.Router();

router.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

router.get('/status', auth, async (req, res) => {
  try {
    const count = await PushSubscription.countDocuments({ userId: req.user.userId });
    res.json({ subscribed: count > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/subscribe', auth, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  try {
    await PushSubscription.findOneAndUpdate(
      { userId: req.user.userId, endpoint: subscription.endpoint },
      { userId: req.user.userId, subscription, endpoint: subscription.endpoint },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/unsubscribe', auth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  try {
    await PushSubscription.deleteMany({ userId: req.user.userId, endpoint });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
