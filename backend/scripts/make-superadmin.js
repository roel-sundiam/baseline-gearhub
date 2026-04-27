require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
});
const mongoose = require("mongoose");
const User = require("../models/User");

async function makeSuperAdmin() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/pv-tennis";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const result = await User.updateOne(
      { username: "RoelSundiam" },
      { role: "superadmin" },
    );

    if (result.modifiedCount > 0) {
      console.log("✅ RoelSundiam has been promoted to superadmin");
    } else {
      console.log("❌ RoelSundiam not found or already superadmin");
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

makeSuperAdmin();
