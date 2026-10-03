const Notification = require('../models/Notification');
const User = require('../models/User');
async function notifyUser(hospitalId, userId, message, link) {
  await Notification.create({ hospitalId, user: userId, message, link }).catch(() => {});
}
async function notifyRole(hospitalId, role, message, link) {
  const users = await User.find({ hospitalId, role, isActive: true }).select('_id');
  if (!users.length) return;
  await Notification.insertMany(users.map((u) => ({ hospitalId, user: u._id, message, link }))).catch(() => {});
}
module.exports = { notifyUser, notifyRole };
