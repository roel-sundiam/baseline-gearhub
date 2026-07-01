require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Club = require('./models/Club');
const User = require('./models/User');

const PLAYERS = [
  { name: 'Marco Reyes',    username: 'pvtc-marco',    gender: 'Male'   },
  { name: 'Sofia Dela Cruz', username: 'pvtc-sofia',   gender: 'Female' },
  { name: 'Luis Santos',    username: 'pvtc-luis',     gender: 'Male'   },
  { name: 'Anna Garcia',    username: 'pvtc-anna',     gender: 'Female' },
  { name: 'Carlos Bautista', username: 'pvtc-carlos',  gender: 'Male'   },
  { name: 'Maria Torres',   username: 'pvtc-maria',    gender: 'Female' },
  { name: 'Jose Ramos',     username: 'pvtc-jose',     gender: 'Male'   },
  { name: 'Elena Villanueva', username: 'pvtc-elena',  gender: 'Female' },
  { name: 'Miguel Flores',  username: 'pvtc-miguel',   gender: 'Male'   },
  { name: 'Isabel Mendoza', username: 'pvtc-isabel',   gender: 'Female' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const club = await Club.findOne({ name: /pvtc/i });
    if (!club) {
      console.error('❌ Club matching "PVTC" not found');
      process.exit(1);
    }
    console.log(`✅ Found club: ${club.name} (${club._id})`);

    const passwordHash = await bcrypt.hash('BaselineGearhub', 12);

    let created = 0;
    let skipped = 0;

    for (const p of PLAYERS) {
      const exists = await User.findOne({ username: p.username });
      if (exists) {
        console.log(`  ⚠️  Skipped (already exists): ${p.username}`);
        skipped++;
        continue;
      }
      await User.create({
        name: p.name,
        username: p.username,
        passwordHash,
        role: 'player',
        status: 'active',
        gender: p.gender,
        clubId: club._id,
        termsAcceptedAt: new Date(),
      });
      console.log(`  ✅ Created: ${p.name} (${p.username})`);
      created++;
    }

    console.log(`\nDone — ${created} created, ${skipped} skipped.`);
    console.log('Password for all: BaselineGearhub');
    mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seed();
