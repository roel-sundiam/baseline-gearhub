/**
 * Seed script: creates sample clubs in the BaselineGearhubReservation database.
 * Run: node backend/scripts/seed-clubs.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Club = require("../models/Club");

const SAMPLE_CLUBS = [
  { name: "Baseline Tennis Club", location: "Manila, Philippines" },
  { name: "GearHub Racket Club", location: "Quezon City, Philippines" },
  { name: "Ace Sports Center", location: "Makati, Philippines" },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB:", process.env.MONGODB_URI.split("@")[1]);

  for (const data of SAMPLE_CLUBS) {
    const existing = await Club.findOne({ name: data.name });
    if (existing) {
      console.log(`Skipping (already exists): ${data.name}`);
      continue;
    }
    const club = await Club.create(data);
    console.log(`Created club: ${club.name}  [_id: ${club._id}]`);
  }

  console.log("\nDone. Copy a club _id above and use it when assigning users.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
