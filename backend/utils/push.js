let webpush;
try { webpush = require('web-push'); } catch { webpush = null; }

if (webpush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@courtgo.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

async function sendPushToUser(userId, payload) {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY) return;
  try {
    const subs = await PushSubscription.find({ userId }).lean();
    await Promise.all(subs.map(({ subscription, _id }) =>
      webpush.sendNotification(subscription, JSON.stringify(payload)).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          PushSubscription.findByIdAndDelete(_id).catch(() => {});
        }
      })
    ));
  } catch (err) {
    console.error('sendPushToUser error:', err.message);
  }
}

async function sendPushToClubAdmins(clubId, payload, { clubName } = {}) {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY) return;
  try {
    const [clubAdmins, superAdmins] = await Promise.all([
      User.find({ clubId, role: 'admin' }, '_id').lean(),
      User.find({ role: 'superadmin' }, '_id').lean(),
    ]);
    const superadminPayload = clubName ? { ...payload, title: `${payload.title} — ${clubName}` } : payload;
    await Promise.all([
      ...clubAdmins.map(a => sendPushToUser(a._id, payload)),
      ...superAdmins.map(a => sendPushToUser(a._id, superadminPayload)),
    ]);
  } catch (err) {
    console.error('sendPushToClubAdmins error:', err.message);
  }
}

async function sendPushToSuperadmins(payload) {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY) return;
  try {
    const superAdmins = await User.find({ role: 'superadmin' }, '_id').lean();
    await Promise.all(superAdmins.map(a => sendPushToUser(a._id, payload)));
  } catch (err) {
    console.error('sendPushToSuperadmins error:', err.message);
  }
}

module.exports = { sendPushToUser, sendPushToClubAdmins, sendPushToSuperadmins };
