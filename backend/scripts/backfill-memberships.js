// One-off backfill: create a ClubMembership doc for every player's home club
// so existing accounts are membership-native before multi-club rollout.
// Status is copied from User.status; approvedAt falls back to the account's
// creation date for already-active players.
//
// Usage:
//   node scripts/backfill-memberships.js          (dry-run, no writes)
//   node scripts/backfill-memberships.js --apply  (perform the upserts)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const ClubMembership = require('../models/ClubMembership');

const APPLY = process.argv.includes('--apply');

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const players = await User.find(
    { role: 'player', clubId: { $ne: null } },
    '_id clubId status createdAt',
  ).lean();

  let created = 0;
  let existing = 0;
  for (const user of players) {
    const found = await ClubMembership.findOne({ userId: user._id, clubId: user.clubId }).lean();
    if (found) {
      existing++;
      continue;
    }
    created++;
    if (APPLY) {
      await ClubMembership.create({
        userId: user._id,
        clubId: user.clubId,
        status: user.status,
        joinedAt: user.createdAt,
        approvedAt: user.status === 'active' ? user.createdAt : null,
      });
    }
  }

  console.log(`${players.length} player(s) scanned, ${existing} already had a home membership.`);
  console.log(APPLY ? `${created} membership(s) created.` : `${created} membership(s) would be created (dry-run — pass --apply to write).`);
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
