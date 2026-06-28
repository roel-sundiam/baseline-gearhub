const express = require("express");
const auth = require("../middleware/auth");
const superadmin = require("../middleware/superadmin");
const LedgerEntry = require("../models/LedgerEntry");

const router = express.Router();

async function fetchUsdToPhpRate(dateStr) {
  // dateStr format: YYYY-MM-DD
  // Frankfurter returns the closest available rate on or before the given date
  const url = `https://api.frankfurter.app/${dateStr}?from=USD&to=PHP`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
  const data = await res.json();
  const rate = data?.rates?.PHP;
  if (!rate) throw new Error("PHP rate not found in response");
  return rate;
}

function toDateStr(date) {
  return date.toISOString().substring(0, 10);
}

// POST /api/ledger — create entry
router.post("/", auth, superadmin, async (req, res) => {
  try {
    const { type, category, amount, description, date, notes, currency = "PHP" } = req.body;
    const entryDate = new Date(date);

    let exchangeRateToPhp = 1;
    if (currency === "USD") {
      exchangeRateToPhp = await fetchUsdToPhpRate(toDateStr(entryDate));
    }

    const entry = new LedgerEntry({
      type,
      category,
      amount,
      description,
      date: entryDate,
      notes,
      currency,
      exchangeRateToPhp,
      createdBy: req.user.userId,
    });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/ledger — list entries with optional filters
router.get("/", auth, superadmin, async (req, res) => {
  try {
    const { from, to, type, category } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setUTCHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    if (type) filter.type = type;
    if (category) filter.category = category;

    const entries = await LedgerEntry.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ledger/report — summary + category breakdown, all amounts converted to PHP
router.get("/report", auth, superadmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const match = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    // phpAmount = amount * exchangeRateToPhp (1 for PHP entries)
    const phpAmount = { $multiply: ["$amount", "$exchangeRateToPhp"] };

    const [breakdown, totals] = await Promise.all([
      LedgerEntry.aggregate([
        { $match: match },
        {
          $group: {
            _id: { category: "$category", type: "$type" },
            total: { $sum: phpAmount },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id.category",
            type: "$_id.type",
            total: 1,
          },
        },
        { $sort: { type: 1, category: 1 } },
      ]),
      LedgerEntry.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$type",
            total: { $sum: phpAmount },
          },
        },
      ]),
    ]);

    const totalIncome = totals.find((t) => t._id === "income")?.total ?? 0;
    const totalExpenses = totals.find((t) => t._id === "expense")?.total ?? 0;

    res.json({
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      byCategory: breakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ledger/:id — update entry (re-fetches rate if currency/date changed)
router.put("/:id", auth, superadmin, async (req, res) => {
  try {
    const { type, category, amount, description, date, notes, currency = "PHP" } = req.body;
    const entryDate = new Date(date);

    let exchangeRateToPhp = 1;
    if (currency === "USD") {
      exchangeRateToPhp = await fetchUsdToPhpRate(toDateStr(entryDate));
    }

    const entry = await LedgerEntry.findByIdAndUpdate(
      req.params.id,
      { type, category, amount, description, date: entryDate, notes, currency, exchangeRateToPhp },
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/ledger/:id — delete entry
router.delete("/:id", auth, superadmin, async (req, res) => {
  try {
    const entry = await LedgerEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
