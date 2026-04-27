const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Rates = require("../models/Rates");

const router = express.Router();

// GET /api/rates
router.get("/", auth, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "clubId is required" });

    const defaults = {
      withoutLightRate: 0, lightRate: 0,
      training2WithoutLightRate: 0, training2LightRate: 0,
      ballBoyRate: 0,
      reservationWeekdayRate: 0, reservationWeekendRate: 0, reservationHolidayRate: 0,
      reservationGuestFee: 0,
      rentalBalls50Rate: 0, rentalBalls100Rate: 0, rentalBallMachineRate: 0, rentalRacketRate: 0,
    };

    const rates = await Rates.findOneAndUpdate(
      { clubId },
      { $setOnInsert: { clubId, ...defaults } },
      { new: true, upsert: true },
    );

    res.json(rates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/rates (admin only)
router.put("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    if (!clubId) return res.status(400).json({ error: "clubId is required" });

    const withoutLightRate = Number(req.body.withoutLightRate);
    const lightRate = Number(req.body.lightRate);
    const training2WithoutLightRate = Number(req.body.training2WithoutLightRate);
    const training2LightRate = Number(req.body.training2LightRate);
    const ballBoyRate = Number(req.body.ballBoyRate);
    const reservationWeekdayRate = Number(req.body.reservationWeekdayRate ?? 0);
    const reservationWeekendRate = Number(req.body.reservationWeekendRate ?? 0);
    const reservationHolidayRate = Number(req.body.reservationHolidayRate ?? 0);
    const reservationGuestFee = Number(req.body.reservationGuestFee ?? 0);
    const rentalBalls50Rate = Number(req.body.rentalBalls50Rate ?? 0);
    const rentalBalls100Rate = Number(req.body.rentalBalls100Rate ?? 0);
    const rentalBallMachineRate = Number(req.body.rentalBallMachineRate ?? 0);
    const rentalRacketRate = Number(req.body.rentalRacketRate ?? 0);

    const allRates = [
      withoutLightRate, lightRate,
      training2WithoutLightRate, training2LightRate,
      ballBoyRate,
      reservationWeekdayRate, reservationWeekendRate, reservationHolidayRate,
      reservationGuestFee,
      rentalBalls50Rate, rentalBalls100Rate, rentalBallMachineRate, rentalRacketRate,
    ];

    if (allRates.some((r) => !Number.isFinite(r))) {
      return res.status(400).json({ error: "All rate fields are required and must be numbers" });
    }
    if (allRates.some((r) => r < 0)) {
      return res.status(400).json({ error: "Rates must be non-negative" });
    }

    const rates = await Rates.findOneAndUpdate(
      { clubId },
      {
        clubId,
        withoutLightRate, lightRate,
        training2WithoutLightRate, training2LightRate,
        ballBoyRate,
        reservationWeekdayRate, reservationWeekendRate, reservationHolidayRate,
        reservationGuestFee,
        rentalBalls50Rate, rentalBalls100Rate, rentalBallMachineRate, rentalRacketRate,
        updatedAt: new Date(),
      },
      { new: true, upsert: true },
    );

    res.json(rates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
