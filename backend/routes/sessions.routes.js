const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Session = require("../models/Session");
const Charge = require("../models/Charge");
const Rates = require("../models/Rates");
const User = require("../models/User");

const router = express.Router();
const allowedPaymentMethods = ["GCash", "Cash", "Bank Transfer"];

function normalizePaymentMethod(method) {
  if (method === "Brank Transfer") return "Bank Transfer";
  return method;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":"))
    return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function getCourtFeeBreakdown(
  startMinutes,
  endMinutes,
  withoutLightRate,
  lightRate,
) {
  const lightsStart = 18 * 60;
  const lightsEnd = 22 * 60;
  const withLightsMinutes = Math.max(
    0,
    Math.min(endMinutes, lightsEnd) - Math.max(startMinutes, lightsStart),
  );
  const totalMinutes = endMinutes - startMinutes;
  const withoutLightsMinutes = totalMinutes - withLightsMinutes;
  const withoutLightFee = (withoutLightsMinutes / 60) * withoutLightRate;
  const lightFee = (withLightsMinutes / 60) * lightRate;

  return {
    withLights: withLightsMinutes > 0,
    withoutLightFee: Number(withoutLightFee.toFixed(2)),
    lightFee: Number(lightFee.toFixed(2)),
    totalFee: Number((withoutLightFee + lightFee).toFixed(2)),
  };
}

// POST /api/sessions — create session + compute billing (admin)
router.post("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.body.clubId || req.user.clubId;
    const {
      date,
      startTime,
      endTime,
      players,
      trainings = [],
      courtSessions = [],
    } = req.body;

    if (
      !date ||
      !startTime ||
      !players ||
      !Array.isArray(players) ||
      players.length === 0
    ) {
      return res.status(400).json({
        error: "date, startTime, and at least one player are required",
      });
    }

    // Always fetch latest rates from DB — never trust frontend values
    const rates = await Rates.findOne({ clubId });
    if (!rates) {
      return res
        .status(400)
        .json({ error: "Court rates not configured. Please set rates first." });
    }

    // Guard against malformed/legacy rate data to avoid NaN charges.
    const withoutLightRate = Number(rates.withoutLightRate);
    const lightRate = Number(rates.lightRate);
    const training2WithoutLightRate = Number(rates.training2WithoutLightRate);
    const training2LightRate = Number(rates.training2LightRate);
    const ballBoyRate = Number(rates.ballBoyRate);

    if (
      !Number.isFinite(withoutLightRate) ||
      !Number.isFinite(lightRate) ||
      !Number.isFinite(training2WithoutLightRate) ||
      !Number.isFinite(training2LightRate) ||
      !Number.isFinite(ballBoyRate)
    ) {
      return res.status(400).json({
        error:
          "Court rates are incomplete or invalid. Please update rates in Admin > Rate Management.",
      });
    }

    if (!Array.isArray(trainings)) {
      return res.status(400).json({ error: "trainings must be an array" });
    }
    if (!Array.isArray(courtSessions) || courtSessions.length !== 2) {
      return res
        .status(400)
        .json({ error: "courtSessions must contain exactly 2 courts" });
    }

    const computedPlayers = [];
    const computedTrainings = [];
    const computedCourtSessions = [];
    let totalAmount = 0;
    let sessionBallBoyUsed = false;
    let earliestCourtStart = null;
    let latestCourtEnd = null;

    for (const p of players) {
      const {
        playerId,
        gamesWithoutLight = 0,
        gamesWithLight = 0,
        ballBoyUsed = false,
        paymentMethod = "",
        paid = false,
      } = p;
      const gamesWithoutLightNum = Number(gamesWithoutLight);
      const gamesWithLightNum = Number(gamesWithLight);
      const rowBallBoyUsed = !!ballBoyUsed;
      const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

      if (!playerId) {
        return res
          .status(400)
          .json({ error: "Each player must have a valid playerId" });
      }
      if (
        !Number.isFinite(gamesWithoutLightNum) ||
        !Number.isFinite(gamesWithLightNum)
      ) {
        return res
          .status(400)
          .json({ error: "Games played must be valid numbers" });
      }
      if (gamesWithoutLightNum < 0 || gamesWithLightNum < 0) {
        return res
          .status(400)
          .json({ error: "Games played cannot be negative" });
      }
      if (gamesWithoutLightNum === 0 && gamesWithLightNum === 0) {
        return res
          .status(400)
          .json({ error: "Each player must have at least 1 game played" });
      }
      if (paid && !allowedPaymentMethods.includes(normalizedPaymentMethod)) {
        return res.status(400).json({
          error: "paymentMethod must be one of: GCash, Cash, Bank Transfer",
        });
      }

      const user = await User.findById(playerId).select("name");
      if (!user) {
        return res.status(400).json({ error: `Player ${playerId} not found` });
      }

      // Billing logic — computed server-side only
      const withoutLightFee = gamesWithoutLightNum * withoutLightRate;
      const lightFee = gamesWithLightNum * lightRate;
      const totalGames = gamesWithoutLightNum + gamesWithLightNum;
      const ballBoyFee = rowBallBoyUsed ? totalGames * ballBoyRate : 0;
      const total = withoutLightFee + lightFee + ballBoyFee;
      const paidAt = paid ? new Date() : undefined;
      const status = paid ? "paid" : "unpaid";
      sessionBallBoyUsed = sessionBallBoyUsed || rowBallBoyUsed;

      computedPlayers.push({
        playerId,
        name: user.name,
        gamesWithoutLight: gamesWithoutLightNum,
        gamesWithLight: gamesWithLightNum,
        ballBoyUsed: rowBallBoyUsed,
        paymentMethod: paid ? normalizedPaymentMethod : undefined,
        paidAt,
        charges: { withoutLightFee, lightFee, ballBoyFee, total },
        status,
      });

      totalAmount += total;
    }

    for (const court of courtSessions) {
      const courtLabel = String(court?.courtLabel || "").trim();
      const courtStartTime = String(court?.startTime || "").trim();
      const courtEndTime = String(court?.endTime || "").trim();

      if (!courtLabel) {
        return res
          .status(400)
          .json({ error: "Each court session must have a courtLabel" });
      }
      if (!courtStartTime || !courtEndTime) {
        return res
          .status(400)
          .json({ error: "Each court session must have start and end time" });
      }

      const startMinutes = parseTimeToMinutes(courtStartTime);
      const endMinutes = parseTimeToMinutes(courtEndTime);
      if (startMinutes == null || endMinutes == null) {
        return res
          .status(400)
          .json({ error: "Court session times must be valid times" });
      }
      if (endMinutes <= startMinutes) {
        return res.status(400).json({
          error: "Court session end time must be later than start time",
        });
      }

      const feeBreakdown = getCourtFeeBreakdown(
        startMinutes,
        endMinutes,
        100,
        200,
      );

      earliestCourtStart =
        earliestCourtStart == null || startMinutes < earliestCourtStart
          ? startMinutes
          : earliestCourtStart;
      latestCourtEnd =
        latestCourtEnd == null || endMinutes > latestCourtEnd
          ? endMinutes
          : latestCourtEnd;

      computedCourtSessions.push({
        courtLabel,
        startTime: courtStartTime,
        endTime: courtEndTime,
        withLights: feeBreakdown.withLights,
        fee: feeBreakdown.totalFee,
      });

      totalAmount += feeBreakdown.totalFee;
    }

    for (const training of trainings) {
      const {
        trainerCoach = "",
        withoutLights = 0,
        withLights = 0,
        startTime: trainingStartTime = "",
        endTime: trainingEndTime = "",
      } = training || {};

      const withoutLightsNum = Number(withoutLights);
      const withLightsNum = Number(withLights);
      const normalizedTrainerCoach = String(trainerCoach).trim();
      const normalizedStartTime = String(trainingStartTime || "").trim();
      const normalizedEndTime = String(trainingEndTime || "").trim();
      const hasAnyValue =
        normalizedTrainerCoach !== "" ||
        normalizedStartTime !== "" ||
        normalizedEndTime !== "" ||
        withoutLightsNum > 0 ||
        withLightsNum > 0;

      if (!hasAnyValue) {
        continue;
      }

      if (
        !Number.isFinite(withoutLightsNum) ||
        !Number.isFinite(withLightsNum)
      ) {
        return res.status(400).json({
          error:
            "Training values for with/without lights must be valid numbers",
        });
      }
      if (withoutLightsNum < 0 || withLightsNum < 0) {
        return res
          .status(400)
          .json({ error: "Training with/without lights cannot be negative" });
      }
      if (withoutLightsNum === 0 && withLightsNum === 0) {
        return res.status(400).json({
          error:
            "Training must have at least one with-lights or without-lights count",
        });
      }
      if (!normalizedTrainerCoach) {
        return res
          .status(400)
          .json({ error: "Trainer/Coach is required for each training entry" });
      }
      if (!normalizedStartTime || !normalizedEndTime) {
        return res.status(400).json({
          error:
            "Training start time and end time are required for each training entry",
        });
      }

      const startMinutes = parseTimeToMinutes(normalizedStartTime);
      const endMinutes = parseTimeToMinutes(normalizedEndTime);
      if (startMinutes == null || endMinutes == null) {
        return res.status(400).json({
          error: "Training start time and end time must be valid times",
        });
      }
      if (endMinutes <= startMinutes) {
        return res
          .status(400)
          .json({ error: "Training end time must be later than start time" });
      }

      const totalFee =
        withoutLightsNum * training2WithoutLightRate +
        withLightsNum * training2LightRate;

      computedTrainings.push({
        trainerCoach: normalizedTrainerCoach,
        withoutLights: withoutLightsNum,
        withLights: withLightsNum,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        totalFee,
      });

      totalAmount += totalFee;
    }

    const session = await Session.create({
      clubId,
      date,
      startTime:
        earliestCourtStart == null
          ? startTime
          : `${String(Math.floor(earliestCourtStart / 60)).padStart(2, "0")}:${String(earliestCourtStart % 60).padStart(2, "0")}`,
      endTime:
        latestCourtEnd == null
          ? endTime
          : `${String(Math.floor(latestCourtEnd / 60)).padStart(2, "0")}:${String(latestCourtEnd % 60).padStart(2, "0")}`,
      ballBoyUsed: sessionBallBoyUsed,
      ratesUsed: {
        withoutLightRate,
        lightRate,
        training2WithoutLightRate,
        training2LightRate,
        ballBoyRate,
      },
      players: computedPlayers,
      trainings: computedTrainings,
      courtSessions: computedCourtSessions,
      totalAmount,
    });

    // Create individual charge records
    await Promise.all(
      computedPlayers.map((p) =>
        Charge.create({
          clubId,
          playerId: p.playerId,
          sessionId: session._id,
          amount: p.charges.total,
          breakdown: {
            withoutLightFee: p.charges.withoutLightFee,
            lightFee: p.charges.lightFee,
            ballBoyFee: p.charges.ballBoyFee,
          },
          status: p.status,
          paymentMethod: p.paymentMethod,
          paidAt: p.paidAt,
        }),
      ),
    );

    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/sessions — list all sessions (admin)
router.get("/", auth, admin, async (req, res) => {
  try {
    const clubId = req.query.clubId || req.user.clubId;
    const sessions = await Session.find(clubId ? { clubId } : {}).sort({ date: -1, createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/sessions/player/my-charges — player's own charges
router.get("/player/my-charges", auth, async (req, res) => {
  try {
    const clubId = req.user.clubId;
    const charges = await Charge.find({ clubId, playerId: req.user.userId })
      .populate("sessionId", "date startTime ballBoyUsed")
      .sort({ createdAt: -1 });
    res.json(charges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/sessions/:id — session detail
router.get("/:id", auth, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (req.user.role !== "admin") {
      const isInSession = session.players.some(
        (p) => p.playerId.toString() === req.user.userId,
      );
      if (!isInSession) return res.status(403).json({ error: "Access denied" });
    }

    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/sessions/:sessionId/players/:playerId/pay — mark a player's charge as paid (admin)
router.put(
  "/:sessionId/players/:playerId/pay",
  auth,
  admin,
  async (req, res) => {
    try {
      const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
      if (!allowedPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          error: "paymentMethod must be one of: GCash, Cash, Bank Transfer",
        });
      }

      const paidAt = new Date();
      const charge = await Charge.findOneAndUpdate(
        { sessionId: req.params.sessionId, playerId: req.params.playerId },
        { status: "paid", paymentMethod, paidAt },
        { new: true },
      );
      if (!charge) return res.status(404).json({ error: "Charge not found" });

      await Session.updateOne(
        { _id: req.params.sessionId, "players.playerId": req.params.playerId },
        {
          $set: {
            "players.$.status": "paid",
            "players.$.paymentMethod": paymentMethod,
            "players.$.paidAt": paidAt,
          },
        },
      );

      res.json(charge);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// PUT /api/sessions/charges/:chargeId/pay (admin)
router.put("/charges/:chargeId/pay", auth, admin, async (req, res) => {
  try {
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: "paymentMethod must be one of: GCash, Cash, Bank Transfer",
      });
    }

    const paidAt = new Date();
    const charge = await Charge.findByIdAndUpdate(
      req.params.chargeId,
      { status: "paid", paymentMethod, paidAt },
      { new: true },
    );
    if (!charge) return res.status(404).json({ error: "Charge not found" });

    await Session.updateOne(
      { _id: charge.sessionId, "players.playerId": charge.playerId },
      {
        $set: {
          "players.$.status": "paid",
          "players.$.paymentMethod": paymentMethod,
          "players.$.paidAt": paidAt,
        },
      },
    );

    res.json(charge);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
