// The reservations collection was created with a unique compound index
// { clubId, court, date, timeSlot } (see initial commit 2e1837c). That index
// was superseded by application-level, status-aware, duration-overlap
// conflict checking (commit ad7c313) but was never dropped from the live
// database. Because the index doesn't know about `status`, it still blocks
// creating a new reservation for a slot that has a *cancelled* reservation
// occupying the same {clubId, court, date, timeSlot}, causing a MongoDB
// E11000 duplicate-key error -> uncaught -> 500 on POST /reserve.
//
// Usage:
//   node scripts/drop-stale-reservation-index.js          (list indexes only)
//   node scripts/drop-stale-reservation-index.js --apply  (drop the stale index)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');

const APPLY = process.argv.includes('--apply');
const STALE_KEY = { clubId: 1, court: 1, date: 1, timeSlot: 1 };

function sameKey(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k, i) => bKeys[i] === k && a[k] === b[k]);
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const indexes = await Reservation.collection.getIndexes({ full: true });
  console.log('Current indexes on reservations collection:');
  for (const idx of indexes) {
    console.log(`  ${idx.name}  key=${JSON.stringify(idx.key)}  unique=${!!idx.unique}`);
  }

  const stale = indexes.find((idx) => idx.unique && sameKey(idx.key, STALE_KEY));

  if (!stale) {
    console.log('\nNo stale unique index matching {clubId, court, date, timeSlot} found. Nothing to do.');
  } else if (!APPLY) {
    console.log(`\nFound stale unique index "${stale.name}". Re-run with --apply to drop it.`);
  } else {
    console.log(`\nDropping index "${stale.name}"...`);
    await Reservation.collection.dropIndex(stale.name);
    console.log('Dropped.');

    const after = await Reservation.collection.getIndexes({ full: true });
    console.log('\nIndexes after drop:');
    for (const idx of after) {
      console.log(`  ${idx.name}  key=${JSON.stringify(idx.key)}  unique=${!!idx.unique}`);
    }
  }

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
