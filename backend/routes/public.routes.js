const express = require("express");
const Reservation = require("../models/Reservation");
const Charge = require("../models/Charge");
const Rates = require("../models/Rates");
const Club = require("../models/Club");
const CoinTransaction = require("../models/CoinTransaction");
const Inquiry = require("../models/Inquiry");

const RESERVATION_COIN_COST = 5;
const WEEKEND_DAYS = new Set([0, 5, 6]); // Sunday=0, Friday=5, Saturday=6

const router = express.Router();

// GET /api/public/:clubId/availability?court=1&date=YYYY-MM-DD
router.get("/:clubId/availability", async (req, res) => {
  try {
    const { clubId } = req.params;
    const { court, date } = req.query;

    const club = await Club.findById(clubId).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });

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
      status: { $in: ["confirmed", "pending_payment"] },
    }).select("timeSlot -_id");

    res.json({ bookedSlots: booked.map((r) => r.timeSlot) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId/rates
router.get("/:clubId/rates", async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await Club.findById(clubId).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });

    const rates = await Rates.findOne({ clubId }).lean();
    if (!rates) return res.json({});

    res.json({
      lightRate: rates.lightRate,
      ballBoyRate: rates.ballBoyRate,
      reservationWeekdayRate: rates.reservationWeekdayRate,
      reservationWeekendRate: rates.reservationWeekendRate,
      reservationHolidayRate: rates.reservationHolidayRate,
      reservationGuestFee: rates.reservationGuestFee,
      rentalBalls50Rate: rates.rentalBalls50Rate,
      rentalBalls100Rate: rates.rentalBalls100Rate,
      rentalBallMachineRate: rates.rentalBallMachineRate,
      rentalRacketRate: rates.rentalRacketRate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/public/:clubId/reserve
router.post("/:clubId/reserve", async (req, res) => {
  try {
    const { clubId } = req.params;
    const {
      court, date, timeSlot,
      lightsRequested = false, ballBoy = false, isHoliday = false,
      guestCount = 0,
      rentals = {},
      guestInfo = {},
    } = req.body;

    if (!guestInfo.name || !guestInfo.email) {
      return res.status(400).json({ error: "guestInfo.name and guestInfo.email are required" });
    }
    if (!court || !date || !timeSlot) {
      return res.status(400).json({ error: "court, date, and timeSlot are required" });
    }
    const courtNum = Number(court);
    if (courtNum !== 1 && courtNum !== 2) {
      return res.status(400).json({ error: "court must be 1 or 2" });
    }

    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (parsedDate < today) {
      return res.status(400).json({ error: "Cannot book a past date" });
    }

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

    if (club.coinBalance < RESERVATION_COIN_COST) {
      return res.status(402).json({ error: "Club has insufficient coins to accept bookings", coinBalance: club.coinBalance });
    }

    const reservation = await Reservation.create({
      clubId,
      court: courtNum,
      date: parsedDate,
      timeSlot,
      player: null,
      players: [],
      guestInfo: {
        name: guestInfo.name.trim(),
        email: guestInfo.email.trim(),
        phone: guestInfo.phone ? guestInfo.phone.trim() : undefined,
      },
      lightsRequested: Boolean(lightsRequested),
      isHoliday: Boolean(isHoliday),
      ballBoy: Boolean(ballBoy),
      guestCount: sanitizedGuestCount,
      rentals: sanitizedRentals,
      courtFee,
      ratesUsed,
      status: "pending_payment",
    });

    const charge = await Charge.create({
      clubId,
      playerId: null,
      guestName: guestInfo.name.trim(),
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
      approvalStatus: "pending",
    });

    club.coinBalance -= RESERVATION_COIN_COST;
    await club.save();
    await CoinTransaction.create({
      clubId,
      userId: null,
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

// POST /api/public/:clubId/inquiries — start chat inquiry (no auth required)
router.post("/:clubId/inquiries", async (req, res) => {
  try {
    const { clubId } = req.params;
    const { senderName, senderEmail, message } = req.body;

    if (!senderName?.trim()) return res.status(400).json({ error: "senderName is required" });
    if (!senderEmail?.trim()) return res.status(400).json({ error: "senderEmail is required" });
    if (!message?.trim()) return res.status(400).json({ error: "message is required" });

    const club = await Club.findById(clubId).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });

    const inquiry = await Inquiry.create({
      clubId,
      senderName: senderName.trim(),
      senderEmail: senderEmail.trim(),
      messages: [{ sender: "guest", name: senderName.trim(), body: message.trim() }],
    });

    res.status(201).json(inquiry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId/inquiries/:inquiryId — poll for new messages (no auth)
router.get("/:clubId/inquiries/:inquiryId", async (req, res) => {
  try {
    const { clubId, inquiryId } = req.params;
    const inquiry = await Inquiry.findOne({ _id: inquiryId, clubId }).lean();
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    res.json(inquiry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/public/:clubId/inquiries/:inquiryId/message — guest sends a follow-up (no auth)
router.post("/:clubId/inquiries/:inquiryId/message", async (req, res) => {
  try {
    const { clubId, inquiryId } = req.params;
    const { body } = req.body;

    if (!body?.trim()) return res.status(400).json({ error: "body is required" });

    const inquiry = await Inquiry.findOne({ _id: inquiryId, clubId });
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

    inquiry.messages.push({ sender: "guest", name: inquiry.senderName, body: body.trim() });
    if (inquiry.status === "read") inquiry.status = "unread";
    await inquiry.save();

    res.json(inquiry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
