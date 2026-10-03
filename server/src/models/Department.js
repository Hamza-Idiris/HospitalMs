const mongoose = require('mongoose');
const s = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
s.index({ hospitalId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Department', s);
