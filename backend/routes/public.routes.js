const express = require("express");
const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const Charge = require("../models/Charge");
const Rates = require("../models/Rates");
const Club = require("../models/Club");
const Inquiry = require("../models/Inquiry");
const OpenPlaySession = require("../models/OpenPlaySession");
const OpenPlaySessionPlayer = require("../models/OpenPlaySessionPlayer");
const { sendPushToClubAdmins } = require("../utils/push");
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

// Resolve club by ObjectId OR readable slug
async function findClub(identifier, lean = true) {
  const q = mongoose.isValidObjectId(identifier)
    ? Club.findById(identifier)
    : Club.findOne({ slug: identifier });
  return lean ? q.lean() : q;
}

// GET /api/public/clubs — list all active clubs
router.get("/clubs", async (req, res) => {
  try {
    const clubs = await Club.find({ status: "active" })
      .select("name slug location logo photos rating reviewCount courtCount openingHour closingHour")
      .lean();
    res.json(clubs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/open-play — all upcoming open sessions across all active clubs
router.get("/open-play", async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const activeClubs = await Club.find({ status: "active" }).select("_id name slug location logo").lean();
    const activeClubIds = activeClubs.map(c => c._id.toString());
    const clubMap = Object.fromEntries(activeClubs.map(c => [c._id.toString(), c]));

    const sessions = await OpenPlaySession.find({
      clubId: { $in: activeClubIds },
      status: "open",
      sessionDate: { $gte: today },
    }).sort({ sessionDate: 1, startTime: 1 }).lean();

    const sessionIds = sessions.map(s => s._id);
    const playerCounts = await OpenPlaySessionPlayer.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $group: { _id: "$sessionId", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    for (const p of playerCounts) countMap[p._id.toString()] = p.count;

    res.json(sessions.map(s => {
      const club = clubMap[s.clubId.toString()] ?? {};
      return {
        _id: s._id,
        title: s.title,
        sport: s.sport,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        matchType: s.matchType,
        maxPlayers: s.maxPlayers,
        joinedPlayers: countMap[s._id.toString()] ?? 0,
        club: {
          _id: club._id,
          name: club.name,
          slug: club.slug,
          location: club.location,
          logo: club.logo,
        },
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/public/open-play/:sessionId/register — guest self-registration
router.post("/open-play/:sessionId/register", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { guestName, guestEmail, guestPhone } = req.body;

    if (!guestName?.trim()) return res.status(400).json({ error: "Name is required" });
    if (!guestEmail?.trim()) return res.status(400).json({ error: "Email is required" });

    const session = await OpenPlaySession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "open") return res.status(400).json({ error: "Session is no longer open" });

    const joinedCount = await OpenPlaySessionPlayer.countDocuments({ sessionId });
    if (joinedCount >= session.maxPlayers) return res.status(400).json({ error: "Session is full" });

    const alreadyJoined = await OpenPlaySessionPlayer.findOne({
      sessionId,
      guestEmail: guestEmail.trim().toLowerCase(),
    });
    if (alreadyJoined) return res.status(400).json({ error: "This email is already registered for this session" });

    await OpenPlaySessionPlayer.create({
      sessionId,
      clubId: session.clubId,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim().toLowerCase(),
      guestPhone: guestPhone?.trim() || undefined,
    });

    res.json({ success: true, joinedPlayers: joinedCount + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId/all-availability?date=YYYY-MM-DD — booked slots for ALL courts
router.get("/:clubId/all-availability", async (req, res) => {
  try {
    const { clubId } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date is required" });

    const club = await findClub(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });
    const resolvedClubId = club._id.toString();
    const courtCount = club.courtCount ?? 2;

    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const [reservations, openPlaySessions] = await Promise.all([
      Reservation.find({
        clubId: resolvedClubId,
        date: { $gte: start, $lte: end },
        status: { $in: ["confirmed", "pending_payment"] },
      }).select("court timeSlot durationHours -_id").lean(),
      OpenPlaySession.find({
        clubId: resolvedClubId,
        sessionDate: { $gte: start, $lte: end },
        status: { $ne: "cancelled" },
      }).select("courts startTime endTime -_id").lean(),
    ]);

    const result = {};
    for (let c = 1; c <= courtCount; c++) {
      const bookedFromRes = reservations
        .filter((r) => r.court === c)
        .flatMap((r) => expandSlots(r.timeSlot, r.durationHours ?? 1));
      const bookedFromOP = openPlaySessions
        .filter((s) => Array.isArray(s.courts) ? s.courts.includes(c) : true)
        .flatMap((s) => timeRangeToSlots(s.startTime, s.endTime));
      result[c] = [...new Set([...bookedFromRes, ...bookedFromOP])];
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId — basic club info (accepts ObjectId or slug)
router.get("/:clubId", async (req, res) => {
  try {
    const club = await findClub(req.params.clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json({
      _id: club._id,
      name: club.name,
      slug: club.slug,
      location: club.location,
      logo: club.logo,
      status: club.status,
      courtCount: club.courtCount ?? 2,
      openingHour: club.openingHour ?? 5,
      closingHour: club.closingHour ?? 22,
      paymentMethods: club.paymentMethods ?? [],
      paymentAccounts: club.paymentAccounts instanceof Map ? Object.fromEntries(club.paymentAccounts) : (club.paymentAccounts ?? {}),
      paymentQrCodes: club.paymentQrCodes instanceof Map ? Object.fromEntries(club.paymentQrCodes) : (club.paymentQrCodes ?? {}),
      convenienceFeeRate: typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.05,
      convenienceFeeMode: club.convenienceFeeMode ?? 'per_hour',
      additionalFees: (club.additionalFees ?? []).filter(f => f.isEnabled),
      requirePaymentScreenshot: club.requirePaymentScreenshot ?? false,
      mobile: club.mobile,
      email: club.email,
      description: club.description,
      photos: club.photos ?? [],
      socialLinks: club.socialLinks ?? {},
      rating: club.rating ?? 0,
      reviewCount: club.reviewCount ?? 0,
      totalBookings: club.totalBookings ?? 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId/slots?date=YYYY-MM-DD — per-hour availability across all courts
router.get("/:clubId/slots", async (req, res) => {
  try {
    const { clubId } = req.params;
    const club = await findClub(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });
    const resolvedClubId = club._id.toString();

    const courtCount = club.courtCount ?? 2;
    const openingHour = club.openingHour ?? 5;
    const closingHour = club.closingHour ?? 22;

    const queryDate = req.query.date ? new Date(req.query.date) : new Date();
    queryDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(queryDate);
    endDate.setUTCHours(23, 59, 59, 999);

    const reservations = await Reservation.find({
      clubId: resolvedClubId,
      date: { $gte: queryDate, $lte: endDate },
      status: { $in: ["confirmed", "pending_payment"] },
    }).select("timeSlot durationHours -_id").lean();

    const bookedCount = {};
    for (const r of reservations) {
      for (const slot of expandSlots(r.timeSlot, r.durationHours ?? 1)) {
        bookedCount[slot] = (bookedCount[slot] || 0) + 1;
      }
    }

    const result = [];
    for (let h = openingHour; h <= closingHour; h++) {
      const slot = hourToSlot(h);
      const booked = bookedCount[slot] || 0;
      const available = Math.max(0, courtCount - booked);
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const period = h < 12 ? 'AM' : 'PM';
      result.push({ time: `${h12}:00 ${period}`, slot, available, total: courtCount });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId/availability?court=1&date=YYYY-MM-DD
router.get("/:clubId/availability", async (req, res) => {
  try {
    const { clubId } = req.params;
    const { court, date } = req.query;

    const club = await findClub(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });
    const resolvedClubId = club._id.toString();

    if (!court || !date) {
      return res.status(400).json({ error: "court and date are required" });
    }
    const courtNum = Number(court);
    const courtCount = club.courtCount ?? 2;
    if (!Number.isInteger(courtNum) || courtNum < 1 || courtNum > courtCount) {
      return res.status(400).json({ error: `court must be between 1 and ${courtCount}` });
    }

    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const [booked, openPlaySessions] = await Promise.all([
      Reservation.find({
        clubId: resolvedClubId,
        court: courtNum,
        date: { $gte: start, $lte: end },
        status: { $in: ["confirmed", "pending_payment"] },
      }).select("timeSlot durationHours -_id"),
      OpenPlaySession.find({
        clubId: resolvedClubId,
        courts: courtNum,
        sessionDate: { $gte: start, $lte: end },
        status: { $ne: "cancelled" },
      }).select("startTime endTime -_id"),
    ]);

    const openPlaySlots = openPlaySessions.flatMap((s) => timeRangeToSlots(s.startTime, s.endTime));

    res.json({ bookedSlots: [...booked.flatMap((r) => expandSlots(r.timeSlot, r.durationHours ?? 1)), ...openPlaySlots] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId/rates
router.get("/:clubId/rates", async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await findClub(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });
    const resolvedClubId = club._id.toString();

    const rates = await Rates.findOne({ clubId: resolvedClubId }).lean();
    if (!rates) return res.json({});

    res.json({
      lightRate: rates.lightRate,
      ballBoyRate: rates.ballBoyRate,
      reservationWeekdayRate: rates.reservationWeekdayRate,
      reservationWeekendRate: rates.reservationWeekendRate,
      reservationHolidayRate: rates.reservationHolidayRate,
      reservationGuestFee: rates.reservationGuestFee,
      reservationGuestFeeThreshold: rates.reservationGuestFeeThreshold ?? 0,
      exclusiveEventEnabled: rates.exclusiveEventEnabled ?? false,
      exclusiveEventRate: rates.exclusiveEventRate ?? 0,
      exclusiveEventIncludedPax: rates.exclusiveEventIncludedPax ?? 0,
      exclusiveEventExcessPaxFee: rates.exclusiveEventExcessPaxFee ?? 0,
      exclusiveEventMaxPax: rates.exclusiveEventMaxPax ?? 0,
      exclusiveEventPolicies: rates.exclusiveEventPolicies ?? [],
      rentalBalls50Rate: rates.rentalBalls50Rate,
      rentalBalls100Rate: rates.rentalBalls100Rate,
      rentalBallMachineRate: rates.rentalBallMachineRate,
      rentalRacketRate: rates.rentalRacketRate,
      coachingEnabled: rates.coachingEnabled ?? false,
      coachingMinHours: rates.coachingMinHours ?? 2,
      coachingMaxPax: rates.coachingMaxPax ?? 6,
      coachingRate1Pax: rates.coachingRate1Pax ?? 0,
      coachingRate2Pax: rates.coachingRate2Pax ?? 0,
      coachingRate3to6Pax: rates.coachingRate3to6Pax ?? 0,
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
      selectedExtraFeeNames = [],
      bookingType = 'standard',
      coachingRequested = false,
      coachingPax = 0,
      paymentScreenshot = null,
    } = req.body;
    const durationHours = Math.max(1, Math.min(12, Math.floor(Number(req.body.durationHours) || 1)));

    if (!guestInfo.name || !guestInfo.email) {
      return res.status(400).json({ error: "guestInfo.name and guestInfo.email are required" });
    }
    if (!court || !date || !timeSlot) {
      return res.status(400).json({ error: "court, date, and timeSlot are required" });
    }
    const courtNum = Number(court);
    if (!Number.isInteger(courtNum) || courtNum < 1) {
      return res.status(400).json({ error: "court must be a positive integer" });
    }

    const club = await findClub(clubId, false);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.status === "suspended") return res.status(403).json({ error: "club_suspended" });
    const resolvedClubId = club._id.toString();
    const publicCourtCount = club.courtCount ?? 2;
    const autoPaymentMethod = (club.paymentMethods?.length === 1) ? club.paymentMethods[0] : undefined;
    if (courtNum > publicCourtCount) {
      return res.status(400).json({ error: `court must be between 1 and ${publicCourtCount}` });
    }
    const publicClosingHour = club.closingHour ?? 22;
    const allowedSlots = buildSlots(club.openingHour ?? 5, publicClosingHour);
    if (!allowedSlots.has(timeSlot)) {
      return res.status(400).json({ error: `timeSlot is outside this club's operating hours` });
    }
    if (slotToHour(timeSlot) + durationHours - 1 > publicClosingHour) {
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
      clubId: resolvedClubId, court: courtNum, date: parsedDate,
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

    const rawRates = await Rates.findOne({ clubId: resolvedClubId }).lean();
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
    const isExclusiveEvent = bookingType === 'exclusive_event' && (rawRates?.exclusiveEventEnabled ?? false);

    if (isExclusiveEvent) {
      const maxPax = Number(rawRates?.exclusiveEventMaxPax ?? 0);
      if (maxPax > 0 && sanitizedGuestCount > maxPax) {
        return res.status(400).json({ error: `Maximum capacity for this event is ${maxPax} pax` });
      }
    }

    let baseCourtFee, guestTotalFee;
    if (isExclusiveEvent) {
      const eventRate = Number(rawRates?.exclusiveEventRate ?? 0);
      const includedPax = Number(rawRates?.exclusiveEventIncludedPax ?? 0);
      const excessFee = Number(rawRates?.exclusiveEventExcessPaxFee ?? 0);
      baseCourtFee = eventRate * durationHours;
      guestTotalFee = Math.max(0, sanitizedGuestCount - includedPax) * excessFee;
    } else {
      baseCourtFee = hourlyRate * durationHours;
      const chargeableGuests = Math.max(0, sanitizedGuestCount - ratesUsed.guestFeeThreshold);
      guestTotalFee = chargeableGuests * ratesUsed.guestFee;
    }

    const lightHours = lightsRequested ? computeLightHours(timeSlot, durationHours) : 0;
    const lightsFee = lightHours * ratesUsed.lightsRate;
    const ballBoyFee = ballBoy ? ratesUsed.ballBoyRate * durationHours : 0;
    const rentalFee = rentalFeePerHour * durationHours;
    const courtFee = baseCourtFee + lightsFee + ballBoyFee + guestTotalFee + rentalFee;
    const feeRate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.05;
    const feeMode = club.convenienceFeeMode ?? 'per_hour';
    let convenienceFee = 0;
    if (feeMode !== 'monthly_flat') {
      const convenienceFeeBase = feeMode === 'per_transaction' ? hourlyRate : courtFee;
      convenienceFee = parseFloat((convenienceFeeBase * feeRate).toFixed(2));
    }

    const selectedNames = Array.isArray(selectedExtraFeeNames) ? selectedExtraFeeNames : [];
    const appliedExtraFees = isExclusiveEvent ? [] : (club.additionalFees ?? [])
      .filter(f => f.isEnabled && (!f.isOptional || selectedNames.includes(f.name)))
      .map(f => ({
        name: f.name,
        amount: parseFloat((f.type === 'per_person' ? f.amount * sanitizedGuestCount : f.amount).toFixed(2)),
      }));
    const extraFeeTotal = isExclusiveEvent ? 0 : parseFloat(appliedExtraFees.reduce((sum, f) => sum + f.amount, 0).toFixed(2));

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

    const totalAmount = courtFee + convenienceFee + extraFeeTotal + coachingFee;

    const reservation = await Reservation.create({
      clubId: resolvedClubId,
      court: courtNum,
      date: parsedDate,
      timeSlot,
      durationHours,
      bookingType: isExclusiveEvent ? 'exclusive_event' : 'standard',
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
      coachingRequested: wantsCoaching,
      coachingPax: sanitizedCoachingPax,
      rentals: sanitizedRentals,
      courtFee,
      convenienceFee,
      convenienceFeeRate: feeRate,
      ratesUsed,
      status: "pending_payment",
    });

    const charge = await Charge.create({
      clubId: resolvedClubId,
      playerId: null,
      guestName: guestInfo.name.trim(),
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
      approvalStatus: "pending",
      paymentMethod: autoPaymentMethod,
      paymentScreenshot: typeof paymentScreenshot === 'string' && paymentScreenshot.startsWith('https://') ? paymentScreenshot : null,
    });

    Club.findByIdAndUpdate(club._id, { $inc: { totalBookings: 1 } }).catch(() => {});

    const dateLabel = parsedDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    sendPushToClubAdmins(club._id, {
      title: 'New Guest Booking',
      body: `${guestInfo.name} booked Court ${courtNum} on ${dateLabel} at ${timeSlot}${durationHours > 1 ? ` (${durationHours} hrs)` : ''}`,
      url: '/admin/reservations',
      tag: 'new-guest-booking',
    }).catch(() => {});

    res.status(201).json({ reservation, charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/public/:clubId/open-play — upcoming open sessions (no auth required)
router.get("/:clubId/open-play", async (req, res) => {
  try {
    const club = await findClub(req.params.clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    const resolvedClubId = club._id.toString();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const sessions = await OpenPlaySession.find({
      clubId: resolvedClubId,
      status: "open",
      sessionDate: { $gte: today },
    }).sort({ sessionDate: 1, startTime: 1 }).lean();

    const sessionIds = sessions.map(s => s._id);
    const playerCounts = await OpenPlaySessionPlayer.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $group: { _id: "$sessionId", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    for (const p of playerCounts) countMap[p._id.toString()] = p.count;

    res.json(sessions.map(s => ({
      _id: s._id,
      title: s.title,
      sport: s.sport,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      matchType: s.matchType,
      maxPlayers: s.maxPlayers,
      joinedPlayers: countMap[s._id.toString()] ?? 0,
    })));
  } catch (err) {
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

    const club = await findClub(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    const resolvedClubId = club._id.toString();

    const inquiry = await Inquiry.create({
      clubId: resolvedClubId,
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

// Backwards-compat: old docs used message:String + replies:[]. Synthesize messages[] if empty.
function normalizeInquiry(inq) {
  if (inq.messages && inq.messages.length > 0) return inq;
  const msgs = [];
  if (inq.message) {
    msgs.push({ sender: "guest", name: inq.senderName, body: inq.message, createdAt: inq.createdAt });
  }
  if (Array.isArray(inq.replies)) {
    for (const r of inq.replies) {
      msgs.push({ sender: "admin", name: r.adminName || "Admin", body: r.body, createdAt: r.createdAt });
    }
  }
  return { ...inq, messages: msgs };
}

// GET /api/public/:clubId/inquiries/:inquiryId — poll for new messages (no auth)
router.get("/:clubId/inquiries/:inquiryId", async (req, res) => {
  try {
    const { clubId, inquiryId } = req.params;
    const club = await findClub(clubId);
    const resolvedClubId = club ? club._id.toString() : clubId;
    const inquiry = await Inquiry.findOne({ _id: inquiryId, clubId: resolvedClubId }).lean();
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    res.json(normalizeInquiry(inquiry));
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

    const club = await findClub(clubId);
    const resolvedClubId = club ? club._id.toString() : clubId;
    const inquiry = await Inquiry.findOne({ _id: inquiryId, clubId: resolvedClubId });
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
