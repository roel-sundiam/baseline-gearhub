// One-off backfill: give every existing Club its own Hosted Play convenience
// fee config (hostedPlayConvenienceFeeMode/Rate/Amount), decoupled from the
// club-wide convenienceFeeRate/convenienceFeeMode. Defaults every club to
// per_join, carrying over their existing club-wide convenienceFeeRate as the
// starting rate. Only touches clubs that don't already have the field set.
//
// Usage:
//   node scripts/backfill-hosted-play-convenience-fee.js          (dry-run, no writes)
//   node scripts/backfill-hosted-play-convenience-fee.js --apply  (perform the updates)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Club = require('../models/Club');

const APPLY = process.argv.includes('--apply');

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const clubs = await Club.find(
    { hostedPlayConvenienceFeeMode: { $exists: false } },
    '_id name convenienceFeeRate',
  ).lean();

  let updated = 0;
  for (const club of clubs) {
    const rate = typeof club.convenienceFeeRate === 'number' ? club.convenienceFeeRate : 0.05;
    console.log(`${APPLY ? 'Updating' : 'Would update'} "${club.name}" (${club._id}) → hostedPlayConvenienceFeeMode: 'per_join', hostedPlayConvenienceFeeRate: ${rate}`);
    if (APPLY) {
      await Club.updateOne(
        { _id: club._id },
        { $set: { hostedPlayConvenienceFeeMode: 'per_join', hostedPlayConvenienceFeeRate: rate, hostedPlayConvenienceFeeAmount: 0 } },
      );
    }
    updated++;
  }

  console.log(`\n${clubs.length} club(s) missing hostedPlayConvenienceFeeMode.`);
  console.log(APPLY ? `${updated} club(s) updated.` : `${updated} club(s) would be updated (dry-run — pass --apply to write).`);
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
