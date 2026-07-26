// One-off backfill: give every existing Club a `sport` value now that the
// field is required. Defaults to 'tennis' (matches the schema default and
// the app's original focus). Only touches clubs that don't already have it.
//
// Usage:
//   node scripts/backfill-club-sport.js          (dry-run, no writes)
//   node scripts/backfill-club-sport.js --apply  (perform the updates)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Club = require('../models/Club');

const APPLY = process.argv.includes('--apply');

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const clubs = await Club.find({ sport: { $exists: false } }, '_id name').lean();

  let updated = 0;
  for (const club of clubs) {
    console.log(`${APPLY ? 'Updating' : 'Would update'} "${club.name}" (${club._id}) → sport: 'tennis'`);
    if (APPLY) {
      await Club.updateOne({ _id: club._id }, { $set: { sport: 'tennis' } });
    }
    updated++;
  }

  console.log(`\n${clubs.length} club(s) missing sport.`);
  console.log(APPLY ? `${updated} club(s) updated.` : `${updated} club(s) would be updated (dry-run — pass --apply to write).`);
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
