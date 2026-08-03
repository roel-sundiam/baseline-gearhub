// User.duprLink.duprPlayerId was indexed with { unique: true, sparse: true }.
// duprPlayerId defaults to null (see models/User.js), so every newly created
// user gets the field present-and-null, not absent — sparse only excludes
// absent fields, so the SECOND new user created after this schema shipped
// (2026-07-27) collides on the shared null slot with an E11000 error on
// registration. Fixed in code to a partial index filtered to actual string
// values (same pattern as AppServicePayment.billingKey), but Mongoose won't
// replace an already-existing conflicting index on a live database on its
// own — this script does that part.
//
// Usage:
//   node scripts/fix-duprlink-index.js          (list indexes only)
//   node scripts/fix-duprlink-index.js --apply  (drop + rebuild the index)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const APPLY = process.argv.includes('--apply');
const INDEX_NAME = 'duprLink.duprPlayerId_1';

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const indexes = await User.collection.getIndexes({ full: true });
  console.log('Current indexes on users collection:');
  for (const idx of indexes) {
    console.log(`  ${idx.name}  key=${JSON.stringify(idx.key)}  unique=${!!idx.unique}  sparse=${!!idx.sparse}  partial=${JSON.stringify(idx.partialFilterExpression) || 'none'}`);
  }

  const stale = indexes.find((idx) => idx.name === INDEX_NAME && idx.sparse && !idx.partialFilterExpression);

  if (!stale) {
    console.log(`\nNo stale sparse "${INDEX_NAME}" index found (already fixed, or never created). Nothing to do.`);
  } else if (!APPLY) {
    console.log(`\nFound stale sparse index "${stale.name}". Re-run with --apply to drop and rebuild it as a partial index.`);
  } else {
    console.log(`\nDropping index "${stale.name}"...`);
    await User.collection.dropIndex(stale.name);
    console.log('Rebuilding from current schema (partial index)...');
    await User.syncIndexes();

    const after = await User.collection.getIndexes({ full: true });
    console.log('\nIndexes after rebuild:');
    for (const idx of after) {
      console.log(`  ${idx.name}  key=${JSON.stringify(idx.key)}  unique=${!!idx.unique}  sparse=${!!idx.sparse}  partial=${JSON.stringify(idx.partialFilterExpression) || 'none'}`);
    }
  }

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
