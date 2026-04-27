const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Reservation = require("../models/Reservation");
const Charge = require("../models/Charge");
const Rates = require("../models/Rates");
const Club = require("../models/Club");
const CoinTransaction = require("../models/CoinTransaction");
const RESERVATION_COIN_COST = 5;

const WEEKEND_DAYS = new Set([0, 5, 6]); // Sunday=0, Friday=5, Saturday=6

const router = express.Router();

// GET /api/reservations/availability?court=1&date=2026-04-20
router.get("/availability", auth, async (req, res) => {
  try {
    const { court, date } = req.query;
    const clubId = req.user.clubId;
    if (!court || !date) {
      return res.status(400).json({ error: "court and date are required" });
    }
    const courtNum = Number(court);
    if (courtNum !== 1 && courtNum !== 2) {
      return res.status(400).json({ error: "court must be 1 or 2" });
    }
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const booked = await Reservation.find({
      clubId,
      court: courtNum,
      date: { $gte: start, $lte: end },
      status: "confirmed",
    }).select("timeSlot -_id");

    res.json({ bookedSlots: booked.map((r) => r.timeSlot) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/reservations/schedule — all confirmed reservations visible to any player
router.get("/schedule", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const reservations = await Reservation.find({ clubId, status: "confirmed" })
      .populate("player", "name")
      .populate("players", "name")
      .sort({ date: 1, court: 1, timeSlot: 1 })
      .lean();
    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/reservations/my — player's own reservations
router.get("/my", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const reservations = await Reservation.find({
      clubId,
      $or: [
        { player: req.user.userId },
        { players: req.user.userId },
      ],
    })
      .populate("player", "name email")
      .populate("players", "name email")
      .sort({ date: -1, timeSlot: 1 })
      .lean();
    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/reservations — all reservations (admin)
router.get("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const { date, court } = req.query;
    const filter = clubId ? { clubId } : {};
    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    if (court) {
      const courtNum = Number(court);
      if (courtNum === 1 || courtNum === 2) filter.court = courtNum;
    }
    const reservations = await Reservation.find(filter)
      .populate("player", "name email")
      .populate("players", "name email")
      .sort({ date: -1, court: 1, timeSlot: 1 })
      .lean();
    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/reservations — book a slot (player)
router.post("/", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const {
      court, date, timeSlot, players = [],
      lightsRequested = false, ballBoy = false, isHoliday = false,
      guestCount = 0,
      rentals = {},
    } = req.body;
    if (!court || !date || !timeSlot) {
      return res.status(400).json({ error: "court, date, and timeSlot are required" });
    }
    const courtNum = Number(court);
    if (courtNum !== 1 && courtNum !== 2) {
      return res.status(400).json({ error: "court must be 1 or 2" });
    }

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (parsedDate < today) {
      return res.status(400).json({ error: "Cannot book a past date" });
    }

    const additionalPlayers = [...new Set(
      (Array.isArray(players) ? players : [])
        .map(String)
        .filter((id) => id && id !== String(req.user.userId)),
    )];

    const rawRates = await Rates.findOne({ clubId }).lean();
    const ratesUsed = {
      weekdayRate: Number(rawRates?.reservationWeekdayRate ?? 0),
      weekendRate: Number(rawRates?.reservationWeekendRate ?? 0),
      holidayRate: Number(rawRates?.reservationHolidayRate ?? 0),
      lightsRate: Number(rawRates?.lightRate ?? 0),
      ballBoyRate: Number(rawRates?.ballBoyRate ?? 0),
      guestFee: Number(rawRates?.reservationGuestFee ?? 0),
      rentalBalls50Rate: Number(rawRates?.rentalBalls50Rate ?? 0),
      rentalBalls100Rate: Number(rawRates?.rentalBalls100Rate ?? 0),
      rentalBallMachineRate: Number(rawRates?.rentalBallMachineRate ?? 0),
      rentalRacketRate: Number(rawRates?.rentalRacketRate ?? 0),
    };

    const sanitizedRentals = {
      balls50: Math.max(0, Math.floor(Number(rentals.balls50) || 0)),
      balls100: Math.max(0, Math.floor(Number(rentals.balls100) || 0)),
      ballMachine: Boolean(rentals.ballMachine),
      rackets: Math.max(0, Math.floor(Number(rentals.rackets) || 0)),
    };
    const rentalFee =
      sanitizedRentals.balls50 * ratesUsed.rentalBalls50Rate +
      sanitizedRentals.balls100 * ratesUsed.rentalBalls100Rate +
      (sanitizedRentals.ballMachine ? ratesUsed.rentalBallMachineRate : 0) +
      sanitizedRentals.rackets * ratesUsed.rentalRacketRate;

    const dayOfWeek = parsedDate.getUTCDay();
    const isWeekend = WEEKEND_DAYS.has(dayOfWeek);

    let baseCourtFee;
    if (isHoliday) {
      baseCourtFee = ratesUsed.holidayRate;
    } else if (isWeekend) {
      baseCourtFee = ratesUsed.weekendRate;
    } else {
      baseCourtFee = ratesUsed.weekdayRate;
    }

    const sanitizedGuestCount = Math.max(0, Math.floor(Number(guestCount) || 0));
    const lightsFee = lightsRequested ? ratesUsed.lightsRate : 0;
    const ballBoyFee = ballBoy ? ratesUsed.ballBoyRate : 0;
    const guestTotalFee = sanitizedGuestCount * ratesUsed.guestFee;
    const courtFee = baseCourtFee + lightsFee + ballBoyFee + guestTotalFee + rentalFee;

    const club = await Club.findById(clubId);
    if (!club || club.coinBalance < RESERVATION_COIN_COST) {
      return res.status(402).json({ error: "Insufficient coins to make a reservation", coinBalance: club?.coinBalance ?? 0 });
    }

    const reservation = await Reservation.create({
      clubId,
      court: courtNum,
      date: parsedDate,
      timeSlot,
      player: req.user.userId,
      players: additionalPlayers,
      lightsRequested: Boolean(lightsRequested),
      isHoliday: Boolean(isHoliday),
      ballBoy: Boolean(ballBoy),
      guestCount: sanitizedGuestCount,
      rentals: sanitizedRentals,
      courtFee,
      ratesUsed,
    });

    const charge = await Charge.create({
      clubId,
      playerId: req.user.userId,
      reservationId: reservation._id,
      amount: courtFee,
      breakdown: {
        withoutLightFee: baseCourtFee,
        lightFee: lightsFee,
        ballBoyFee,
        guestFee: guestTotalFee,
        rentalFee,
      },
      chargeType: "reservation",
    });

    club.coinBalance -= RESERVATION_COIN_COST;
    await club.save();
    await CoinTransaction.create({
      clubId,
      userId: req.user.userId,
      type: "debit",
      amount: RESERVATION_COIN_COST,
      action: "reservation",
      relatedId: reservation._id,
      balanceAfter: club.coinBalance,
    });

    res.status(201).json({ reservation, charge });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That slot is already booked" });
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/reservations/:id/cancel — cancel (owner or admin)
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });

    const isOwner = reservation.player.toString() === req.user.userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Access denied" });

    reservation.status = "cancelled";
    await reservation.save();

    const charge = await Charge.findOne({ reservationId: reservation._id });
    if (charge && charge.status === "unpaid") {
      await Charge.deleteOne({ _id: charge._id });
    }

    res.json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/reservations/:id — hard delete (admin)
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
