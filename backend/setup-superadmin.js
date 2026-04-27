require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function setupSuperadmin() {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find RoelSundiam
    const user = await User.findOne({ username: 'RoelSundiam' });

    if (!user) {
      console.log('❌ RoelSundiam not found in database');
      process.exit(1);
    }

    console.log(`Current role for RoelSundiam: ${user.role}`);
    console.log(`Current status: ${user.status}`);

    // Update to superadmin if not already
    if (user.role !== 'superadmin' || user.status !== 'active') {
      user.role = 'superadmin';
      user.status = 'active';
      await user.save();
      console.log('✅ Updated RoelSundiam to superadmin with active status');
    } else {
      console.log('✅ RoelSundiam is already a superadmin with active status');
    }

    // Verify the update
    const updated = await User.findOne({ username: 'RoelSundiam' });
    console.log(`\nVerified - Role: ${updated.role}, Status: ${updated.status}`);

    mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

setupSuperadmin();
