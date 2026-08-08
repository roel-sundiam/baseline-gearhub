const express = require('express');
const router = express.Router();
const Sponsor = require('../models/Sponsor');
const SponsorInquiry = require('../models/SponsorInquiry');
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');

const MAX_ACTIVE_SPONSORS = 5;

// GET /api/sponsors — currently live sponsors, visible to any logged-in member
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const items = await Sponsor.find({
      status: 'active',
      paymentVerified: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select('businessName logoUrl description promoText link endDate')
      .sort({ startDate: 1 })
      .lean();

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sponsors/admin — full list for admin management
router.get('/admin', auth, superadmin, async (req, res) => {
  try {
    const items = await Sponsor.find({})
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sponsors — create
router.post('/', auth, superadmin, async (req, res) => {
  try {
    const { businessName, logoUrl, description, promoText, link, tierDays, price, startDate, endDate } = req.body;

    if (!businessName?.trim()) return res.status(400).json({ error: 'businessName is required' });
    if (!logoUrl?.trim()) return res.status(400).json({ error: 'logoUrl is required' });
    if (!description?.trim()) return res.status(400).json({ error: 'description is required' });
    if (!link?.trim()) return res.status(400).json({ error: 'link is required' });
    if (![7, 30, 90].includes(Number(tierDays))) return res.status(400).json({ error: 'tierDays must be 7, 30, or 90' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });
    if (new Date(endDate) <= new Date(startDate)) return res.status(400).json({ error: 'endDate must be after startDate' });

    const item = await Sponsor.create({
      businessName: businessName.trim(),
      logoUrl: logoUrl.trim(),
      description: description.trim(),
      promoText: promoText?.trim() || '',
      link: link.trim(),
      tierDays: Number(tierDays),
      price: Number(price) || 0,
      startDate,
      endDate,
      createdBy: req.user.id,
    });

    const populated = await item.populate('createdBy', 'name');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sponsors/:id — update
router.put('/:id', auth, superadmin, async (req, res) => {
  try {
    const { businessName, logoUrl, description, promoText, link, tierDays, price, startDate, endDate } = req.body;

    const item = await Sponsor.findByIdAndUpdate(
      req.params.id,
      {
        ...(businessName && { businessName: businessName.trim() }),
        ...(logoUrl && { logoUrl: logoUrl.trim() }),
        ...(description && { description: description.trim() }),
        ...(promoText !== undefined && { promoText: promoText.trim() }),
        ...(link && { link: link.trim() }),
        ...(tierDays && { tierDays: Number(tierDays) }),
        ...(price !== undefined && { price: Number(price) }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      },
      { new: true }
    ).populate('createdBy', 'name');

    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sponsors/:id/verify-payment — toggle payment verified
router.patch('/:id/verify-payment', auth, superadmin, async (req, res) => {
  try {
    const item = await Sponsor.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    item.paymentVerified = !item.paymentVerified;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sponsors/:id/status — move between draft / active / rejected
router.patch('/:id/status', auth, superadmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'active', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const item = await Sponsor.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (status === 'active') {
      if (!item.paymentVerified) {
        return res.status(400).json({ error: 'Cannot activate a sponsor before payment is verified' });
      }
      const now = new Date();
      const activeCount = await Sponsor.countDocuments({
        _id: { $ne: item._id },
        status: 'active',
        endDate: { $gte: now },
      });
      if (activeCount >= MAX_ACTIVE_SPONSORS) {
        return res.status(400).json({ error: `Maximum of ${MAX_ACTIVE_SPONSORS} active sponsors reached` });
      }
    }

    item.status = status;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sponsors/:id
router.delete('/:id', auth, superadmin, async (req, res) => {
  try {
    const item = await Sponsor.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sponsors/inquiries — businesses that applied to become a sponsor
router.get('/inquiries', auth, superadmin, async (req, res) => {
  try {
    const items = await SponsorInquiry.find({}).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sponsors/inquiries/:id/status — mark reviewed / archived
router.patch('/inquiries/:id/status', auth, superadmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'reviewed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const item = await SponsorInquiry.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sponsors/inquiries/:id
router.delete('/inquiries/:id', auth, superadmin, async (req, res) => {
  try {
    const item = await SponsorInquiry.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
