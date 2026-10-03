const mongoose = require('mongoose');
const s = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String, role: String,
  action: { type: String, required: true },
  entity: String, entityId: mongoose.Schema.Types.ObjectId,
  details: mongoose.Schema.Types.Mixed, ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
s.index({ hospitalId: 1, createdAt: -1 });
module.exports = mongoose.model('AuditLog', s);
