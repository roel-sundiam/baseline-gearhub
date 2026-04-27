const mongoose = require("mongoose");

const LIGHT_SLOTS = new Set(["5am", "6pm", "7pm", "8pm", "9pm"]);

const reservationSchema = new mongoose.Schema(
  {
    court: { type: Number, required: true, enum: [1, 2] },
    date: { type: Date, required: true },
    timeSlot: {
      type: String,
      required: true,
      enum: [
        "5am", "6am", "7am", "8am", "9am", "10am", "11am",
        "12pm", "1pm", "2pm", "3pm", "4pm", "5pm",
        "6pm", "7pm", "8pm", "9pm", "10pm",
      ],
    },
    hasLights: { type: Boolean, required: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lightsRequested: { type: Boolean, default: false },
    isHoliday: { type: Boolean, default: false },
    ballBoy: { type: Boolean, default: false },
    guestCount: { type: Number, default: 0, min: 0 },
    rentals: {
      balls50: { type: Number, default: 0, min: 0 },
      balls100: { type: Number, default: 0, min: 0 },
      ballMachine: { type: Boolean, default: false },
      rackets: { type: Number, default: 0, min: 0 },
    },
    courtFee: { type: Number, required: true, min: 0, default: 0 },
    ratesUsed: {
      weekdayRate: { type: Number, required: true, default: 0 },
      weekendRate: { type: Number, required: true, default: 0 },
      holidayRate: { type: Number, required: true, default: 0 },
      lightsRate: { type: Number, required: true, default: 0 },
      ballBoyRate: { type: Number, required: true, default: 0 },
      guestFee: { type: Number, required: true, default: 0 },
      rentalBalls50Rate: { type: Number, required: true, default: 0 },
      rentalBalls100Rate: { type: Number, required: true, default: 0 },
      rentalBallMachineRate: { type: Number, required: true, default: 0 },
      rentalRacketRate: { type: Number, required: true, default: 0 },
    },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true },
);

reservationSchema.index({ clubId: 1, court: 1, date: 1, timeSlot: 1 }, { unique: true });

reservationSchema.pre("validate", function (next) {
  this.hasLights = LIGHT_SLOTS.has(this.timeSlot);
  next();
});

module.exports = mongoose.model("Reservation", reservationSchema);
