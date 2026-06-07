require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');

const ATLAS_URI = process.env.MONGODB_URI;
const LOCAL_URI = 'mongodb://localhost:27017';
const DB_NAME = 'BaselineGearhubReservation';

const COLLECTIONS = [
  'appservicepayments',
  'charges',
  'clubs',
  'clubnews',
  'inquiries',
  'livevisitors',
  'loginhistories',
  'notifications',
  'openplaymatches',
  'openplayratings',
  'openplaysessions',
  'openplaysessionplayers',
  'pagevisits',
  'pushsubscriptions',
  'rates',
  'reservations',
  'sessions',
  'tournaments',
  'users',
];

async function migrate() {
  const atlas = new MongoClient(ATLAS_URI);
  const local = new MongoClient(LOCAL_URI);

  try {
    console.log('Connecting to Atlas...');
    await atlas.connect();
    console.log('Connecting to local MongoDB...');
    await local.connect();

    const srcDb = atlas.db(DB_NAME);
    const dstDb = local.db(DB_NAME);

    // Discover actual collection names from Atlas instead of guessing
    const actualCollections = (await srcDb.listCollections().toArray()).map(c => c.name);
    console.log(`\nFound ${actualCollections.length} collections in Atlas:`, actualCollections.join(', '));

    for (const colName of actualCollections) {
      const src = srcDb.collection(colName);
      const dst = dstDb.collection(colName);

      const docs = await src.find({}).toArray();
      if (docs.length === 0) {
        console.log(`  [${colName}] empty — skipped`);
        continue;
      }

      await dst.deleteMany({});
      await dst.insertMany(docs, { ordered: false });
      console.log(`  [${colName}] copied ${docs.length} documents`);
    }

    console.log('\nMigration complete!');
    console.log(`Next step: update MONGODB_URI in .env to mongodb://localhost:27017/${DB_NAME}`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await atlas.close();
    await local.close();
  }
}

migrate();
