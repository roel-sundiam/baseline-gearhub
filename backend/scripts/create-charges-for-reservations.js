const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Reservation = require("../models/Reservation");
const Charge = require("../models/Charge");

async function migrateReservationsToCharges() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find all reservations that don't have a charge yet
    const reservations = await Reservation.find({ status: "confirmed" }).lean();
    console.log(`Found ${reservations.length} confirmed reservations`);

    let chargesCreated = 0;
    let skipped = 0;

    for (const reservation of reservations) {
      // Check if charge already exists for this reservation
      const existingCharge = await Charge.findOne({
        reservationId: reservation._id,
      });

      if (existingCharge) {
        console.log(`✓ Charge already exists for reservation ${reservation._id}`);
        skipped++;
        continue;
      }

      // Use courtFee, default to 0 if missing
      const amount = reservation.courtFee || 0;

      // Create charge for this reservation
      const charge = await Charge.create({
        playerId: reservation.player,
        reservationId: reservation._id,
        amount: amount,
        breakdown: {
          withoutLightFee: amount,
          lightFee: 0,
          ballBoyFee: 0,
        },
        chargeType: "reservation",
        status: "unpaid",
      });

      console.log(
        `✓ Created charge for reservation ${reservation._id}: ₱${amount} (charge: ${charge._id})`
      );
      chargesCreated++;
    }

    console.log("\n=== Migration Complete ===");
    console.log(`Charges created: ${chargesCreated}`);
    console.log(`Charges skipped (already exist): ${skipped}`);
    console.log(`Total: ${chargesCreated + skipped}/${reservations.length}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrateReservationsToCharges();
