/**
 * Creates or resets the superadmin account.
 * Run: node backend/scripts/create-superadmin.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const username = "RoelSundiam";
  const password = "wowbot";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await User.findOne({ username });

  if (existing) {
    await User.updateOne({ username }, { passwordHash, role: "superadmin", status: "active" });
    console.log(`✅ Updated ${username} — role: superadmin, password reset to 'wowbot'`);
  } else {
    await User.create({
      name: "Roel Sundiam",
      username,
      passwordHash,
      role: "superadmin",
      status: "active",
    });
    console.log(`✅ Created ${username} — role: superadmin`);
  }

  await mongoose.connection.close();
  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
