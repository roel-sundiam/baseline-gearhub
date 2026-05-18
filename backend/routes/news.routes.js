const express = require('express');
const router = express.Router();
const ClubNews = require('../models/ClubNews');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

// GET /api/news — list for club (pinned first, newest first)
router.get('/', auth, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    if (!clubId) return res.status(400).json({ error: 'clubId required' });

    const items = await ClubNews.find({ clubId })
      .populate('createdBy', 'name')
      .sort({ pinned: -1, createdAt: -1 })
      .lean();

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/news — create
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { title, body, type, pinned } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    if (!body?.trim()) return res.status(400).json({ error: 'body is required' });

    const item = await ClubNews.create({
      clubId: req.user.clubId,
      title: title.trim(),
      body: body.trim(),
      type: type || 'news',
      pinned: !!pinned,
      createdBy: req.user.id,
    });

    const populated = await item.populate('createdBy', 'name');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/news/:id — update
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { title, body, type, pinned } = req.body;
    const item = await ClubNews.findOneAndUpdate(
      { _id: req.params.id, clubId: req.user.clubId },
      {
        ...(title && { title: title.trim() }),
        ...(body && { body: body.trim() }),
        ...(type && { type }),
        ...(pinned !== undefined && { pinned: !!pinned }),
      },
      { new: true }
    ).populate('createdBy', 'name');

    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/news/:id/pin — toggle pin
router.patch('/:id/pin', auth, adminOnly, async (req, res) => {
  try {
    const item = await ClubNews.findOne({ _id: req.params.id, clubId: req.user.clubId });
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.pinned = !item.pinned;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/news/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const item = await ClubNews.findOneAndDelete({ _id: req.params.id, clubId: req.user.clubId });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
