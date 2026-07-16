// One-off migration: copy active+approved users from TennisClubRT2_Test.users
// into BaselineGearhubReservation.users under the "Rich Town 2 Men's Open Play" club.
// Passwords are bcrypt hashes in both systems, so they are copied as-is and
// members keep their existing credentials.
//
// Usage:
//   node scripts/import-rt2-open-play-users.js          (dry-run, no writes)
//   node scripts/import-rt2-open-play-users.js --apply  (perform the insert)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.production.local') });
const { MongoClient } = require('mongodb');

const SOURCE_DB = 'TennisClubRT2_Test';
const TARGET_DB = 'BaselineGearhubReservation';
// Club was created as "Rich Town 2 Men's Open Play", later renamed "Rich Town 2 Club Open Play"
const TARGET_CLUB_NAME = /^rich town 2 .*open play$/i;
const APPLY = process.argv.includes('--apply');

const GENDER_MAP = { male: 'Male', female: 'Female' };

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const srcUsers = client.db(SOURCE_DB).collection('users');
    const dst = client.db(TARGET_DB);

    const matches = await dst.collection('clubs').find({ name: TARGET_CLUB_NAME }).toArray();
    if (matches.length !== 1) {
      throw new Error(`Expected exactly 1 club matching ${TARGET_CLUB_NAME}, found ${matches.length}`);
    }
    const club = matches[0];
    console.log(`Target club: ${club.name} (${club._id})`);

    const totalSource = await srcUsers.countDocuments();
    const candidates = await srcUsers
      .find({ isApproved: true, isActive: true, username: { $ne: 'superadmin' } })
      .toArray();
    console.log(`Source users: ${totalSource} total, ${candidates.length} active+approved (superadmin excluded)`);

    const existing = await dst
      .collection('users')
      .find({}, { projection: { username: 1 } })
      .toArray();
    const existingUsernames = new Set(existing.map((u) => u.username));

    const now = new Date();
    const toInsert = [];
    const skippedCollision = [];
    const skippedBadPassword = [];

    for (const u of candidates) {
      const username = (u.username || '').trim();
      const password = u.password || '';

      if (!/^\$2[aby]\$\d\d\$/.test(password) || password.length !== 60) {
        skippedBadPassword.push(username || String(u._id));
        continue;
      }
      if (existingUsernames.has(username)) {
        skippedCollision.push(username);
        continue;
      }

      const doc = {
        name: (u.fullName || '').trim() || username,
        username,
        passwordHash: password,
        role: 'player',
        status: 'active',
        contactNumber: '',
        skillLevel: 'novice',
        duprRating: null,
        duprId: '',
        profileImage: null,
        clubId: club._id,
        termsAcceptedAt: now,
        termsAcceptedVersion: null,
        createdAt: now,
        updatedAt: now,
      };
      const gender = GENDER_MAP[(u.gender || '').toLowerCase()];
      if (gender) doc.gender = gender;

      existingUsernames.add(username); // guard against duplicates within the source itself
      toInsert.push(doc);
    }

    console.log(`\nTo insert: ${toInsert.length}`);
    console.log(`Skipped (username already exists in target): ${skippedCollision.length}${skippedCollision.length ? ' -> ' + skippedCollision.join(', ') : ''}`);
    console.log(`Skipped (non-bcrypt password): ${skippedBadPassword.length}${skippedBadPassword.length ? ' -> ' + skippedBadPassword.join(', ') : ''}`);
    console.log(`Filtered out (inactive/unapproved/superadmin): ${totalSource - candidates.length}`);

    if (!APPLY) {
      console.log('\nDRY RUN — no writes performed. Re-run with --apply to insert.');
      return;
    }

    if (toInsert.length === 0) {
      console.log('\nNothing to insert.');
      return;
    }

    const result = await dst.collection('users').insertMany(toInsert, { ordered: false });
    console.log(`\nInserted ${result.insertedCount} users into ${TARGET_DB}.users under "${club.name}".`);

    const clubCount = await dst.collection('users').countDocuments({ clubId: club._id });
    console.log(`Users now in club: ${clubCount}`);
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
