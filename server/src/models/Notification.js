const mongoose = require('mongoose');
const s = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true }, link: String,
  read: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });
s.index({ user: 1, read: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', s);
