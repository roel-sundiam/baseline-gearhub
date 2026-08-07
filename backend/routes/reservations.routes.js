const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Reservation = require("../models/Reservation");
const Charge = require("../models/Charge");
const Rates = require("../models/Rates");
const Club = require("../models/Club");
const User = require("../models/User");
const { sendPushToClubAdmins } = require("../utils/push");
const { sendReservationConfirmationEmail } = require("../utils/email");
const { ownsClub } = require("../utils/scope");
const OpenPlaySession = require("../models/OpenPlaySession");
const WEEKEND_DAYS = new Set([0, 5, 6]); // Sunday=0, Friday=5, Saturday=6
const LIGHT_SLOTS = new Set(['5am','6pm','7pm','8pm','9pm','10pm','11pm','12am']);

function computeLightHours(timeSlot, durationHours) {
  const startH = slotToHour(timeSlot);
  let count = 0;
  for (let i = 0; i < durationHours; i++) {
    if (LIGHT_SLOTS.has(hourToSlot(startH + i))) count++;
  }
  return count;
}

function buildSlots(openingHour, closingHour) {
  const slots = new Set();
  for (let h = openingHour; h <= closingHour; h++) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const period = h < 12 ? 'am' : 'pm';
    slots.add(`${h12}${period}`);
  }
  return slots;
}

function slotToHour(slot) {
  const m = slot.match(/^(\d+)(am|pm)$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  return m[2] === 'am' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}

function hourToSlot(h) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? 'am' : 'pm'}`;
}

function expandSlots(startSlot, durationHours) {
  const startH = slotToHour(startSlot);
  const slots = [];
  for (let i = 0; i < durationHours; i++) slots.push(hourToSlot(startH + i));
  return slots;
}

function timeRangeToSlots(startTime, endTime) {
  const startH = parseInt(startTime.split(':')[0], 10);
  const endH = parseInt(endTime.split(':')[0], 10);
  const slots = [];
  for (let h = startH; h < endH; h++) slots.push(hourToSlot(h));
  return slots;
}

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
    if (!Number.isInteger(courtNum) || courtNum < 1) {
      return res.status(400).json({ error: "court must be a positive integer" });
    }
    const club = await Club.findById(clubId).select('courtCount').lean();
    const courtCount = club?.courtCount ?? 2;
    if (courtNum > courtCount) {
      return res.status(400).json({ error: `court must be between 1 and ${courtCount}` });
    }
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const [booked, pending, openPlaySessions] = await Promise.all([
      Reservation.find({
        clubId, court: courtNum,
        date: { $gte: start, $lte: end },
        status: "confirmed",
      }).select("timeSlot durationHours -_id"),
      Reservation.find({
        clubId, court: courtNum,
        date: { $gte: start, $lte: end },
        status: "pending_payment",
      }).select("timeSlot durationHours -_id"),
      OpenPlaySession.find({
        clubId,
        courts: courtNum,
        sessionDate: { $gte: start, $lte: end },
        status: { $ne: "cancelled" },
      }).select("startTime endTime -_id"),
    ]);

    const openPlaySlots = openPlaySessions.flatMap((s) => timeRangeToSlots(s.startTime, s.endTime));

    res.json({
      bookedSlots: [...booked.flatMap((r) => expandSlots(r.timeSlot, r.durationHours ?? 1)), ...openPlaySlots],
      pendingSlots: pending.flatMap((r) => expandSlots(r.timeSlot, r.durationHours ?? 1)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/reservations/schedule — all confirmed reservations visible to any player
router.get("/schedule", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const reservations = (await Reservation.find({ clubId, status: "confirmed" })
      .populate("player", "name")
      .populate("players", "name")
      .sort({ date: 1, court: 1 })
      .lean())
      .sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        const courtDiff = a.court - b.court;
        if (courtDiff !== 0) return courtDiff;
        return slotToHour(a.timeSlot) - slotToHour(b.timeSlot);
      });
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
      .sort({ date: -1 })
      .lean();
    const sorted = reservations.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return slotToHour(a.timeSlot) - slotToHour(b.timeSlot);
    });
    res.json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/reservations — all reservations (admin)
router.get("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const { date, court, status, startDate, endDate } = req.query;
    const filter = clubId ? { clubId } : {};
    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    if (court) {
      const courtNum = Number(court);
      if (Number.isInteger(courtNum) && courtNum >= 1) filter.court = courtNum;
    }
    const validStatuses = ['confirmed', 'pending_payment', 'cancelled'];
    if (status && validStatuses.includes(status)) filter.status = status;
    let suspendedIds = [];
    if (!clubId) {
      suspendedIds = await Club.find({ status: 'suspended' }).distinct('_id');
      if (suspendedIds.length) filter.clubId = { $nin: suspendedIds };
    }
    const reservations = (await Reservation.find(filter)
      .populate("player", "name email")
      .populate("players", "name email")
      .populate("clubId", "name")
      .sort({ date: -1, court: 1 })
      .lean())
      .sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        const courtDiff = a.court - b.court;
        if (courtDiff !== 0) return courtDiff;
        return slotToHour(a.timeSlot) - slotToHour(b.timeSlot);
      });

    // When no date/court filter, append orphaned charges (reservation deleted, charge survives)
    const hasDateFilter = !!(date || startDate || endDate);
    const hasCourtFilter = !!court;
    const statusExcludesConfirmed = status && status !== 'confirmed';
    if (!hasDateFilter && !hasCourtFilter && !statusExcludesConfirmed) {
      const orphanFilter = { chargeType: 'reservation', approvalStatus: 'approved' };
      if (clubId) {
        orphanFilter.clubId = clubId;
      } else if (suspendedIds.length) {
        orphanFilter.clubId = { $nin: suspendedIds };
      }
      const orphanedCharges = await Charge.find(orphanFilter)
        .populate('reservationId', '_id')
        .populate('playerId', 'name email')
        .populate('clubId', 'name')
        .lean();
      const ghosts = orphanedCharges
        .filter(c => !c.reservationId)
        .map(c => ({
          _id: c._id,
          _orphaned: true,
          player: c.playerId || null,
          guestInfo: c.guestName ? { name: c.guestName, email: '' } : undefined,
          clubId: c.clubId,
          status: 'confirmed',
          date: null,
          court: null,
          timeSlot: null,
          durationHours: null,
          hasLights: false,
          players: [],
          createdAt: c.createdAt,
        }));
      return res.json([...reservations, ...ghosts]);
    }

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
      selectedExtraFeeNames = [],
      coachingRequested = false,
      coachingPax = 0,
    } = req.body;
    const durationHours = Math.max(1, Math.min(12, Math.floor(Number(req.body.durationHours) || 1)));
    if (!court || !date || !timeSlot) {
      return res.status(400).json({ error: "court, date, and timeSlot are required" });
    }
    const courtNum = Number(court);
    if (!Number.isInteger(courtNum) || courtNum < 1) {
      return res.status(400).json({ error: "court must be a positive integer" });
    }
    const clubDoc = await Club.findById(clubId).select('name courtCount openingHour closingHour convenienceFeeRate convenienceFeeMode additionalFees emailConfirmationsEnabled').lean();
    const courtCount = clubDoc?.courtCount ?? 2;
    if (courtNum > courtCount) {
      return res.status(400).json({ error: `court must be between 1 and ${courtCount}` });
    }
    const closingHour = clubDoc?.closingHour ?? 22;
    const allowedSlots = buildSlots(clubDoc?.openingHour ?? 5, closingHour);
    if (!allowedSlots.has(timeSlot)) {
      return res.status(400).json({ error: `timeSlot is outside this club's operating hours` });
    }
    if (slotToHour(timeSlot) + durationHours - 1 > closingHour) {
      return res.status(400).json({ error: `Booking duration exceeds closing hour` });
    }

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (parsedDate < today) {
      return res.status(400).json({ error: "Cannot book a past date" });
    }

    const existingForDay = await Reservation.find({
      clubId, court: courtNum, date: parsedDate,
      status: { $in: ["confirmed", "pending_payment"] },
    }).select("timeSlot durationHours").lean();

    const newStart = slotToHour(timeSlot);
    const newEnd = newStart + durationHours;
    const conflict = existingForDay.some(r => {
      const rStart = slotToHour(r.timeSlot);
      const rEnd = rStart + (r.durationHours ?? 1);
      return rStart < newEnd && rEnd > newStart;
    });
    if (conflict) return res.status(409).json({ error: "One or more of those slots is already booked" });

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
      guestFeeThreshold: Number(rawRates?.reservationGuestFeeThreshold ?? 0),
      rentalBalls50Rate: Number(rawRates?.rentalBalls50Rate ?? 0),
      rentalBalls100Rate: Number(rawRates?.rentalBalls100Rate ?? 0),
      rentalBallMachineRate: Number(rawRates?.rentalBallMachineRate ?? 0),
      rentalRacketRate: Number(rawRates?.rentalRacketRate ?? 0),
      coachingRate1Pax: Number(rawRates?.coachingRate1Pax ?? 0),
      coachingRate2Pax: Number(rawRates?.coachingRate2Pax ?? 0),
      coachingRate3to6Pax: Number(rawRates?.coachingRate3to6Pax ?? 0),
      coachingMinHours: Number(rawRates?.coachingMinHours ?? 2),
      coachingMaxPax: Number(rawRates?.coachingMaxPax ?? 6),
    };
    const coachingEnabled = Boolean(rawRates?.coachingEnabled);

    const sanitizedRentals = {
      balls50: Math.max(0, Math.floor(Number(rentals.balls50) || 0)),
      balls100: Math.max(0, Math.floor(Number(rentals.balls100) || 0)),
      ballMachine: Boolean(rentals.ballMachine),
      rackets: Math.max(0, Math.floor(Number(rentals.rackets) || 0)),
    };
    const rentalFeePerHour =
      sanitizedRentals.balls50 * ratesUsed.rentalBalls50Rate +
      sanitizedRentals.balls100 * ratesUsed.rentalBalls100Rate +
      (sanitizedRentals.ballMachine ? ratesUsed.rentalBallMachineRate : 0) +
      sanitizedRentals.rackets * ratesUsed.rentalRacketRate;

    const dayOfWeek = parsedDate.getUTCDay();
    const isWeekend = WEEKEND_DAYS.has(dayOfWeek);

    let hourlyRate;
    if (isHoliday) {
      hourlyRate = ratesUsed.holidayRate;
    } else if (isWeekend) {
      hourlyRate = ratesUsed.weekendRate;
    } else {
      hourlyRate = ratesUsed.weekdayRate;
    }

    const sanitizedGuestCount = Math.max(0, Math.floor(Number(guestCount) || 0));
    const baseCourtFee = hourlyRate * durationHours;
    const lightHours = lightsRequested ? computeLightHours(timeSlot, durationHours) : 0;
    const lightsFee = lightHours * ratesUsed.lightsRate;
    const ballBoyFee = ballBoy ? ratesUsed.ballBoyRate * durationHours : 0;
    const rentalFee = rentalFeePerHour * durationHours;
    const chargeableGuests = Math.max(0, sanitizedGuestCount - ratesUsed.guestFeeThreshold);
    const guestTotalFee = chargeableGuests * ratesUsed.guestFee;
    const courtFee = baseCourtFee + lightsFee + ballBoyFee + guestTotalFee + rentalFee;
    const feeRate = typeof clubDoc?.convenienceFeeRate === 'number' ? clubDoc.convenienceFeeRate : 0.10;
    const feeMode = clubDoc?.convenienceFeeMode ?? 'per_hour';
    let convenienceFee = 0;
    if (feeMode !== 'monthly_flat' && feeMode !== 'club_absorbs') {
      const convenienceFeeBase = feeMode === 'per_transaction' ? hourlyRate : courtFee;
      convenienceFee = parseFloat((convenienceFeeBase * feeRate).toFixed(2));
    } else if (feeMode === 'club_absorbs') {
      // Fee is calculated for record-keeping but not charged to the player
      convenienceFee = parseFloat((courtFee * feeRate).toFixed(2));
    }

    const selectedNames = Array.isArray(selectedExtraFeeNames) ? selectedExtraFeeNames : [];
    const appliedExtraFees = (clubDoc?.additionalFees ?? [])
      .filter(f => f.isEnabled && (!f.isOptional || selectedNames.includes(f.name)))
      .map(f => ({
        name: f.name,
        amount: parseFloat((f.type === 'per_person' ? f.amount * sanitizedGuestCount : f.amount).toFixed(2)),
      }));
    const extraFeeTotal = parseFloat(appliedExtraFees.reduce((sum, f) => sum + f.amount, 0).toFixed(2));

    const wantsCoaching = coachingEnabled && Boolean(coachingRequested);
    if (wantsCoaching && durationHours < ratesUsed.coachingMinHours) {
      return res.status(400).json({ error: `Coaching sessions require a minimum of ${ratesUsed.coachingMinHours} hours` });
    }
    const sanitizedCoachingPax = wantsCoaching
      ? Math.min(ratesUsed.coachingMaxPax, Math.max(1, Math.floor(Number(coachingPax) || 1)))
      : 0;
    const coachingTierRate = sanitizedCoachingPax <= 1
      ? ratesUsed.coachingRate1Pax
      : sanitizedCoachingPax === 2
        ? ratesUsed.coachingRate2Pax
        : ratesUsed.coachingRate3to6Pax;
    const coachingFee = wantsCoaching
      ? parseFloat((coachingTierRate * sanitizedCoachingPax * durationHours).toFixed(2))
      : 0;

    // club_absorbs: player pays court fee only; convenience fee is recorded but not added to totalAmount
    const totalAmount = feeMode === 'club_absorbs'
      ? courtFee + extraFeeTotal + coachingFee
      : courtFee + convenienceFee + extraFeeTotal + coachingFee;

    const reservation = await Reservation.create({
      clubId,
      court: courtNum,
      date: parsedDate,
      timeSlot,
      durationHours,
      player: req.user.userId,
      players: additionalPlayers,
      lightsRequested: Boolean(lightsRequested),
      isHoliday: Boolean(isHoliday),
      ballBoy: Boolean(ballBoy),
      guestCount: sanitizedGuestCount,
      coachingRequested: wantsCoaching,
      coachingPax: sanitizedCoachingPax,
      rentals: sanitizedRentals,
      courtFee,
      convenienceFee,
      convenienceFeeRate: feeRate,
      ratesUsed,
    });

    const charge = await Charge.create({
      clubId,
      playerId: req.user.userId,
      reservationId: reservation._id,
      amount: totalAmount,
      breakdown: {
        withoutLightFee: baseCourtFee,
        lightFee: lightsFee,
        ballBoyFee,
        guestFee: guestTotalFee,
        rentalFee,
        convenienceFee,
        extraFees: appliedExtraFees,
        extraFeeTotal,
        coachingFee,
      },
      chargeType: "reservation",
    });

    const dateLabel = parsedDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    sendPushToClubAdmins(clubId, {
      title: 'New Court Reservation',
      body: `Court ${courtNum} booked for ${dateLabel} at ${timeSlot}${durationHours > 1 ? ` (${durationHours} hrs)` : ''}`,
      url: '/admin/reservations',
      tag: 'new-reservation',
    }, { clubName: clubDoc?.name }).catch(() => {});

    if (clubDoc?.emailConfirmationsEnabled) {
      User.find({ _id: { $in: [req.user.userId, ...additionalPlayers] } }).select('email').lean()
        .then((bookedUsers) => {
          const recipients = [
            ...bookedUsers.map((u) => u.email),
            reservation.guestInfo?.email,
          ];
          return sendReservationConfirmationEmail(reservation, charge, { clubName: clubDoc?.name, recipients });
        })
        .catch(() => {});
    }

    res.status(201).json({ reservation, charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/reservations/:id — edit a reservation (owner for confirmed+future; admin for any)
router.patch("/:id", auth, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });

    const isAdmin = (req.user.role === "admin" || req.user.role === "superadmin") && ownsClub(req, reservation.clubId);
    const isOwner = reservation.player && reservation.player.toString() === req.user.userId;

    if (!isAdmin && !isOwner)
      return res.status(403).json({ error: "Access denied" });
    if (!isAdmin && reservation.status !== "confirmed")
      return res.status(400).json({ error: "Only confirmed reservations can be edited" });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!isAdmin && reservation.date < today)
      return res.status(400).json({ error: "Cannot edit past reservations" });

    const {
      court, date, timeSlot, players = [],
      lightsRequested = false, ballBoy = false, isHoliday = false,
      guestCount = 0, rentals = {},
      guestInfo, adminNote,
    } = req.body;
    const durationHours = Math.max(1, Math.min(12, Math.floor(Number(req.body.durationHours) || 1)));

    const courtNum = Number(court);
    if (!Number.isInteger(courtNum) || courtNum < 1)
      return res.status(400).json({ error: "court must be a positive integer" });
    const editClub = await Club.findById(reservation.clubId).select('courtCount closingHour convenienceFeeRate convenienceFeeMode').lean();
    const editCourtCount = editClub?.courtCount ?? 2;
    if (courtNum > editCourtCount)
      return res.status(400).json({ error: `court must be between 1 and ${editCourtCount}` });

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);
    if (parsedDate < today)
      return res.status(400).json({ error: "Cannot edit to a past date" });

    const editClosingHour = editClub?.closingHour ?? 22;
    if (slotToHour(timeSlot) + durationHours - 1 > editClosingHour)
      return res.status(400).json({ error: "Booking duration exceeds closing hour" });

    const coreChanged =
      courtNum !== reservation.court ||
      parsedDate.getTime() !== reservation.date.getTime() ||
      timeSlot !== reservation.timeSlot ||
      durationHours !== (reservation.durationHours ?? 1);

    if (coreChanged) {
      const existingForDay = await Reservation.find({
        _id: { $ne: reservation._id },
        clubId: reservation.clubId,
        court: courtNum,
        date: parsedDate,
        status: { $in: ["confirmed", "pending_payment"] },
      }).select("timeSlot durationHours").lean();

      const newStart = slotToHour(timeSlot);
      const newEnd = newStart + durationHours;
      const conflict = existingForDay.some(r => {
        const rStart = slotToHour(r.timeSlot);
        const rEnd = rStart + (r.durationHours ?? 1);
        return rStart < newEnd && rEnd > newStart;
      });
      if (conflict) return res.status(409).json({ error: "One or more of those slots is already booked" });
    }

    const rawRates = await Rates.findOne({ clubId: reservation.clubId }).lean();
    const ratesUsed = {
      weekdayRate:          Number(rawRates?.reservationWeekdayRate ?? 0),
      weekendRate:          Number(rawRates?.reservationWeekendRate ?? 0),
      holidayRate:          Number(rawRates?.reservationHolidayRate ?? 0),
      lightsRate:           Number(rawRates?.lightRate ?? 0),
      ballBoyRate:          Number(rawRates?.ballBoyRate ?? 0),
      guestFee:             Number(rawRates?.reservationGuestFee ?? 0),
      rentalBalls50Rate:    Number(rawRates?.rentalBalls50Rate ?? 0),
      rentalBalls100Rate:   Number(rawRates?.rentalBalls100Rate ?? 0),
      rentalBallMachineRate:Number(rawRates?.rentalBallMachineRate ?? 0),
      rentalRacketRate:     Number(rawRates?.rentalRacketRate ?? 0),
    };

    const sanitizedRentals = {
      balls50:     Math.max(0, Math.floor(Number(rentals.balls50)  || 0)),
      balls100:    Math.max(0, Math.floor(Number(rentals.balls100) || 0)),
      ballMachine: Boolean(rentals.ballMachine),
      rackets:     Math.max(0, Math.floor(Number(rentals.rackets)  || 0)),
    };
    const sanitizedGuestCount = Math.max(0, Math.floor(Number(guestCount) || 0));

    const dayOfWeek = parsedDate.getUTCDay();
    const isWeekend = WEEKEND_DAYS.has(dayOfWeek);
    const hourlyRate = Boolean(isHoliday) ? ratesUsed.holidayRate
      : isWeekend ? ratesUsed.weekendRate : ratesUsed.weekdayRate;

    const baseCourtFee = hourlyRate * durationHours;
    const lightHoursEdit = Boolean(lightsRequested) ? computeLightHours(timeSlot, durationHours) : 0;
    const lightsFee    = lightHoursEdit * ratesUsed.lightsRate;
    const ballBoyFee   = Boolean(ballBoy) ? ratesUsed.ballBoyRate * durationHours : 0;
    const guestTotalFee = sanitizedGuestCount * ratesUsed.guestFee;
    const rentalFeePerHour =
      sanitizedRentals.balls50   * ratesUsed.rentalBalls50Rate +
      sanitizedRentals.balls100  * ratesUsed.rentalBalls100Rate +
      (sanitizedRentals.ballMachine ? ratesUsed.rentalBallMachineRate : 0) +
      sanitizedRentals.rackets   * ratesUsed.rentalRacketRate;
    const rentalFee = rentalFeePerHour * durationHours;
    const courtFee = baseCourtFee + lightsFee + ballBoyFee + guestTotalFee + rentalFee;
    const editFeeRate = typeof editClub?.convenienceFeeRate === 'number' ? editClub.convenienceFeeRate : 0.10;
    const editFeeMode = editClub?.convenienceFeeMode ?? 'per_hour';
    let editConvenienceFee = 0;
    if (editFeeMode !== 'monthly_flat' && editFeeMode !== 'club_absorbs') {
      const editConvFeeBase = editFeeMode === 'per_transaction' ? hourlyRate : courtFee;
      editConvenienceFee = parseFloat((editConvFeeBase * editFeeRate).toFixed(2));
    } else if (editFeeMode === 'club_absorbs') {
      editConvenienceFee = parseFloat((courtFee * editFeeRate).toFixed(2));
    }
    const editTotalAmount = editFeeMode === 'club_absorbs'
      ? courtFee
      : courtFee + editConvenienceFee;

    const additionalPlayers = [...new Set(
      (Array.isArray(players) ? players : []).map(String)
        .filter((id) => id && id !== String(req.user.userId)),
    )];

    reservation.court           = courtNum;
    reservation.date            = parsedDate;
    reservation.timeSlot        = timeSlot;
    reservation.durationHours   = durationHours;
    reservation.players         = additionalPlayers;
    reservation.lightsRequested = Boolean(lightsRequested);
    reservation.isHoliday       = Boolean(isHoliday);
    reservation.ballBoy         = Boolean(ballBoy);
    reservation.guestCount      = sanitizedGuestCount;
    reservation.rentals         = sanitizedRentals;
    reservation.courtFee        = courtFee;
    reservation.convenienceFee  = editConvenienceFee;
    reservation.convenienceFeeRate = editFeeRate;
    reservation.ratesUsed       = ratesUsed;
    if (isAdmin && guestInfo && reservation.guestInfo) {
      if (guestInfo.name  !== undefined) reservation.guestInfo.name  = guestInfo.name;
      if (guestInfo.email !== undefined) reservation.guestInfo.email = guestInfo.email;
      if (guestInfo.phone !== undefined) reservation.guestInfo.phone = guestInfo.phone;
    }
    if (isAdmin && adminNote !== undefined) reservation.adminNote = adminNote;
    await reservation.save();

    const charge = await Charge.findOne({ reservationId: reservation._id });
    if (charge) {
      charge.amount = editTotalAmount;
      charge.breakdown = { withoutLightFee: baseCourtFee, lightFee: lightsFee, ballBoyFee, guestFee: guestTotalFee, rentalFee, convenienceFee: editConvenienceFee };
      await charge.save();
    }

    await reservation.populate("player", "name email");
    await reservation.populate("players", "name email");
    res.json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/reservations/:id/cancel — cancel (owner or admin)
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });

    const isOwner = reservation.player != null && reservation.player.toString() === req.user.userId;
    const isAdmin = (req.user.role === "admin" || req.user.role === "superadmin") && ownsClub(req, reservation.clubId);
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
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    if (!ownsClub(req, reservation.clubId)) return res.status(403).json({ error: "Access denied" });

    const approvedCharge = await Charge.findOne({ reservationId: reservation._id, approvalStatus: "approved" });
    if (approvedCharge && reservation.status !== "cancelled") {
      return res.status(400).json({ error: "Cannot delete a reservation with an approved payment. Cancel it instead." });
    }

    await Charge.deleteMany({ reservationId: reservation._id });
    await Reservation.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
