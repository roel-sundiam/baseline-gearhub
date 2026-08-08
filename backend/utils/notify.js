const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendPushToUser } = require("./push");

async function notifySuperadmins(title, body, data = {}) {
  try {
    const superadmins = await User.find({ role: "superadmin" }, "_id").lean();
    await Promise.all(superadmins.map(async (sa) => {
      await Notification.create({ userId: sa._id, type: data.type || "info", title, body, data });
      await sendPushToUser(sa._id, { title, body, data });
    }));
  } catch (err) {
    console.error("notifySuperadmins error:", err.message);
  }
}

module.exports = { notifySuperadmins };
