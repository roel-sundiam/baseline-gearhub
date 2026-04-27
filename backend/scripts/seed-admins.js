require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const admins = [
  { name: 'Roel Sundiam', username: 'RoelSundiam', password: 'TenisuTennisClub', role: 'superadmin' },
  { name: 'Tenisu Admin', username: 'TenisuAdmin', password: 'TenisuTennisClub', role: 'admin' },
];

async function seedAdmins() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const admin of admins) {
    const existing = await User.findOne({ username: admin.username });
    if (existing) {
      console.log(`⚠️  ${admin.username} already exists — skipping`);
      continue;
    }
    const passwordHash = await bcrypt.hash(admin.password, 12);
    await User.create({
      name: admin.name,
      username: admin.username,
      passwordHash,
      role: 'superadmin',
      status: 'active',
    });
    console.log(`✅ Created ${admin.username}`);
  }

  await mongoose.connection.close();
  console.log('Done.');
}

seedAdmins().catch(err => { console.error(err); process.exit(1); });
