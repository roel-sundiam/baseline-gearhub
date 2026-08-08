const mongoose = require("mongoose");

const LIGHT_SLOTS = new Set(["5am", "6pm", "7pm", "8pm", "9pm"]);

function slotToHour(slot) {
  const m = slot.match(/^(\d+)(am|pm)$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  return m[2] === "am" ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}

function hourToSlot(h) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? "am" : "pm"}`;
}

const reservationSchema = new mongoose.Schema(
  {
    court: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    timeSlot: {
      type: String,
      required: true,
      enum: [
        "12am", "1am", "2am", "3am", "4am", "5am", "6am", "7am", "8am", "9am", "10am", "11am",
        "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm", "10pm", "11pm",
      ],
    },
    durationHours: { type: Number, default: 1, min: 1, max: 12 },
    hasLights: { type: Boolean, required: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lightsRequested: { type: Boolean, default: false },
    isHoliday: { type: Boolean, default: false },
    ballBoy: { type: Boolean, default: false },
    guestCount: { type: Number, default: 0, min: 0 },
    coachingRequested: { type: Boolean, default: false },
    coachingPax: { type: Number, default: 0, min: 0 },
    rentals: {
      balls50: { type: Number, default: 0, min: 0 },
      balls100: { type: Number, default: 0, min: 0 },
      ballMachine: { type: Boolean, default: false },
      rackets: { type: Number, default: 0, min: 0 },
    },
    courtFee: { type: Number, required: true, min: 0, default: 0 },
    convenienceFee: { type: Number, default: 0, min: 0 },
    convenienceFeeRate: { type: Number, default: 0.10, min: 0 },
    ratesUsed: {
      weekdayRate: { type: Number, required: true, default: 0 },
      weekendRate: { type: Number, required: true, default: 0 },
      holidayRate: { type: Number, required: true, default: 0 },
      lightsRate: { type: Number, required: true, default: 0 },
      ballBoyRate: { type: Number, required: true, default: 0 },
      guestFee: { type: Number, required: true, default: 0 },
      guestFeeThreshold: { type: Number, default: 0 },
      rentalBalls50Rate: { type: Number, required: true, default: 0 },
      rentalBalls100Rate: { type: Number, required: true, default: 0 },
      rentalBallMachineRate: { type: Number, required: true, default: 0 },
      rentalRacketRate: { type: Number, required: true, default: 0 },
      coachingRate1Pax: { type: Number, default: 0 },
      coachingRate2Pax: { type: Number, default: 0 },
      coachingRate3to6Pax: { type: Number, default: 0 },
      coachingMinHours: { type: Number, default: 2 },
      coachingMaxPax: { type: Number, default: 6 },
    },
    guestInfo: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    bookingType: { type: String, enum: ["standard", "exclusive_event"], default: "standard" },
    status: { type: String, enum: ["confirmed", "pending_payment", "cancelled"], default: "confirmed" },
    adminNote: { type: String, default: '' },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true },
);

// Supports the revenue/analytics query shape ({clubId, status:"confirmed", date:{$gte,$lte}})
// used by clubRevenue.js, plus the simpler status-agnostic admin list lookups.
reservationSchema.index({ clubId: 1, status: 1, date: 1 });
reservationSchema.index({ clubId: 1, date: 1 });

reservationSchema.pre("validate", function (next) {
  const start = slotToHour(this.timeSlot);
  let lit = false;
  for (let i = 0; i < (this.durationHours ?? 1); i++) {
    if (LIGHT_SLOTS.has(hourToSlot(start + i))) { lit = true; break; }
  }
  this.hasLights = lit;
  next();
});

module.exports = mongoose.model("Reservation", reservationSchema);
