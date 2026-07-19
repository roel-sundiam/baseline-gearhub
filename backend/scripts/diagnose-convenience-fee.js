/**
 * Read-only diagnostic: why didn't a hosted-play session charge the convenience fee?
 * Makes NO writes. Prints club config + session config + all Charge records tied to the session.
 *
 * Usage:
 *   node backend/scripts/diagnose-convenience-fee.js "<club name>" "<session title>" [YYYY-MM-DD]
 *   node backend/scripts/diagnose-convenience-fee.js "FA Sports" "DUPR Tuesday doubles genderless fixed pairing" 2026-07-21
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production.local') });
const { MongoClient } = require('mongodb');

const clubNameArg = process.argv[2] || 'FA Sports';
const titleArg = process.argv[3] || 'DUPR Tuesday doubles genderless fixed pairing';
const dateArg = process.argv[4]; // optional YYYY-MM-DD

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const dbName = process.env.MONGODB_URI.split('/').pop().split('?')[0];
  const db = client.db(dbName);
  console.log(`Connected — database: ${dbName}\n`);

  const clubs = db.collection('clubs');
  const sessions = db.collection('hostedplays');
  const charges = db.collection('charges');

  // ── 1. Find the club ──
  const club = await clubs.findOne({ name: { $regex: clubNameArg, $options: 'i' } });
  if (!club) {
    console.error(`Club not found matching: "${clubNameArg}"`);
    await client.close();
    process.exit(1);
  }
  console.log('=== CLUB ===');
  console.log(`  name                     : ${club.name}`);
  console.log(`  _id                      : ${club._id}`);
  console.log(`  convenienceFeeRate       : ${JSON.stringify(club.convenienceFeeRate)}`);
  console.log(`  convenienceFeeMode       : ${JSON.stringify(club.convenienceFeeMode)}`);
  console.log(`  convenienceFeeMonthlyAmt : ${JSON.stringify(club.convenienceFeeMonthlyAmount)}`);
  console.log(`  hostedPlayConvFeeMode    : ${JSON.stringify(club.hostedPlayConvenienceFeeMode)}`);
  console.log(`  hostedPlayConvFeeRate    : ${JSON.stringify(club.hostedPlayConvenienceFeeRate)}`);
  console.log(`  hostedPlayConvFeeAmount  : ${JSON.stringify(club.hostedPlayConvenienceFeeAmount)}\n`);

  // ── 2. Find the session ──
  const sessionQuery = {
    clubId: club._id,
    title: { $regex: titleArg, $options: 'i' },
  };
  if (dateArg) {
    const start = new Date(`${dateArg}T00:00:00.000Z`);
    const end = new Date(`${dateArg}T23:59:59.999Z`);
    sessionQuery.date = { $gte: start, $lte: end };
  }
  const matchingSessions = await sessions.find(sessionQuery).toArray();

  if (matchingSessions.length === 0) {
    console.error(`No session found matching title "${titleArg}"${dateArg ? ` on ${dateArg}` : ''} for club "${club.name}".`);
    await client.close();
    process.exit(1);
  }

  console.log(`=== SESSION(S) === (${matchingSessions.length} match(es))\n`);

  for (const session of matchingSessions) {
    console.log(`--- Session ${session._id} ---`);
    console.log(`  title              : ${session.title}`);
    console.log(`  date               : ${session.date}`);
    console.log(`  startTime/endTime  : ${session.startTime} - ${session.endTime}`);
    console.log(`  feePerPlayer       : ${JSON.stringify(session.feePerPlayer)}`);
    console.log(`  guestFeePerPlayer  : ${JSON.stringify(session.guestFeePerPlayer)}`);
    console.log(`  feeSplitMode       : ${JSON.stringify(session.feeSplitMode)}`);
    console.log(`  sessionFee         : ${JSON.stringify(session.sessionFee)}`);

    // ── 3. Find charges tied to this session ──
    const sessionCharges = await charges.find({ hostedPlayId: session._id }).toArray();

    if (sessionCharges.length === 0) {
      console.log(`  \n  ⚠ No Charge records found for this session at all.`);
      console.log(`    (Points at a join path that never hit the paid branch — e.g. resolveGuestFee()`);
      console.log(`     returning 0, a free walk-in path, or players simply haven't been charged yet.)\n`);
      continue;
    }

    console.log(`\n  Charges (${sessionCharges.length}):`);
    for (const c of sessionCharges) {
      console.log(`  ---`);
      console.log(`    _id                        : ${c._id}`);
      console.log(`    player/guest               : ${c.playerId || c.guestName || '(unknown)'}`);
      console.log(`    amount                     : ${c.amount}`);
      console.log(`    breakdown.hostedPlayFee    : ${JSON.stringify(c.breakdown?.hostedPlayFee)}`);
      console.log(`    breakdown.convenienceFee   : ${JSON.stringify(c.breakdown?.convenienceFee)}`);
      console.log(`    breakdown.convenienceFeeMode: ${JSON.stringify(c.breakdown?.convenienceFeeMode)}`);
      console.log(`    paymentMethod              : ${c.paymentMethod}`);
      console.log(`    status / approvalStatus    : ${c.status} / ${c.approvalStatus}`);
      console.log(`    createdAt                  : ${c.createdAt}`);
    }
    console.log('');
  }

  await client.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
