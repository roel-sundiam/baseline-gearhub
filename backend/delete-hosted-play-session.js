require('dotenv').config({ path: require('path').join(__dirname, '../.env.production.local') });
const mongoose = require('mongoose');
const Club = require('./models/Club');
const HostedPlay = require('./models/HostedPlay');
const HostedPlayParticipant = require('./models/HostedPlayParticipant');
const Charge = require('./models/Charge');

const CLUB_NAME = 'STACKERS PICKLEBALL';
const SESSION_TITLE = 'Stackers Monday @ PickleAve';

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const club = await Club.findOne({ name: new RegExp(`^${CLUB_NAME}$`, 'i') });
    if (!club) {
      console.error(`Club "${CLUB_NAME}" not found.`);
      process.exit(1);
    }
    console.log(`Club found: ${club.name} (${club._id})`);

    const session = await HostedPlay.findOne({ clubId: club._id, title: SESSION_TITLE });
    if (!session) {
      console.error(`Hosted play session "${SESSION_TITLE}" not found for this club.`);
      process.exit(1);
    }
    console.log(`Session found: "${session.title}" on ${session.date} (${session._id})`);

    const participantCount = await HostedPlayParticipant.countDocuments({ hostedPlayId: session._id });
    const charges = await Charge.find({ hostedPlayId: session._id, chargeType: 'hosted_play' }, 'status amount');
    const paidCount = charges.filter((c) => c.status === 'paid').length;
    const unpaidCount = charges.filter((c) => c.status !== 'paid').length;
    const totalAmount = charges.reduce((sum, c) => sum + (c.amount || 0), 0);

    console.log(`\n--- What will be deleted ---`);
    console.log(`  Participants : ${participantCount}`);
    console.log(`  Charges (paid)   : ${paidCount}`);
    console.log(`  Charges (unpaid) : ${unpaidCount}`);
    console.log(`  Total charge amount : ₱${totalAmount.toFixed(2)}`);
    console.log(`  HostedPlay document : 1`);
    console.log(`----------------------------\n`);

    const { deletedCount: deletedParticipants } = await HostedPlayParticipant.deleteMany({ hostedPlayId: session._id });
    console.log(`Deleted ${deletedParticipants} participant(s).`);

    const { deletedCount: deletedCharges } = await Charge.deleteMany({ hostedPlayId: session._id, chargeType: 'hosted_play' });
    console.log(`Deleted ${deletedCharges} charge(s).`);

    await HostedPlay.deleteOne({ _id: session._id });
    console.log(`Deleted hosted play session "${SESSION_TITLE}".`);

    console.log('\nDone. All test data removed from production.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
