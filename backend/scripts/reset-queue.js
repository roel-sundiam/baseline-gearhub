/**
 * Reset queue state for a hosted-play session by title.
 * Safe to run repeatedly — registered players are kept, only queue data is cleared.
 *
 * What it does:
 *   - Resets session  → status: open, queueStatus: not_started
 *   - Deletes walk-in participants (isWalkIn: true)
 *   - Resets all registered participants → not_checked_in, gamesPlayed: 0
 *
 * Usage:
 *   node scripts/reset-queue.js "Test Queue Session"
 *   node scripts/reset-queue.js              ← defaults to "Test Queue Session"
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');

const title = process.argv[2] || 'Test Queue Session';

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const dbName = process.env.MONGODB_URI.split('/').pop().split('?')[0];
  const db = client.db(dbName);
  console.log(`Connected — database: ${dbName}\n`);

  const sessions     = db.collection('hostedplays');
  const participants = db.collection('hostedplayparticipants');

  // ── 1. Find the session ──
  const session = await sessions.findOne({ title });
  if (!session) {
    console.error(`Session not found: "${title}"`);
    await client.close();
    process.exit(1);
  }
  console.log(`Found session : ${session._id}  (${session.title})`);
  console.log(`  status      : ${session.status}`);
  console.log(`  queueStatus : ${session.queueStatus}\n`);

  // ── 2. Reset session queue fields ──
  await sessions.updateOne(
    { _id: session._id },
    {
      $set:   { queueStatus: 'not_started', status: 'open' },
      $unset: { queueStartedAt: '', queueEndedAt: '', summary: '' },
    },
  );
  console.log('✓ Session reset  →  status: open | queueStatus: not_started');

  // ── 3. Delete walk-in participants ──
  const walkInResult = await participants.deleteMany({
    hostedPlayId: session._id,
    isWalkIn: true,
  });
  console.log(`✓ Deleted ${walkInResult.deletedCount} walk-in participant(s)`);

  // ── 4. Reset queue fields on registered participants ──
  const pResult = await participants.updateMany(
    { hostedPlayId: session._id, isWalkIn: { $ne: true } },
    {
      $set: {
        checkedIn:   false,
        queueStatus: 'not_checked_in',
        queueOrder:  null,
        courtNumber: null,
        gamesPlayed: 0,
      },
      $unset: {
        checkedInAt: '', enteredQueueAt: '', lastGameEndedAt: '',
      },
    },
  );
  console.log(`✓ Reset ${pResult.modifiedCount} registered participant(s)  →  not_checked_in`);

  const remaining = await participants.countDocuments({ hostedPlayId: session._id });
  console.log(`\nDone. ${remaining} registered player(s) remain — all queue data cleared.`);

  await client.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
