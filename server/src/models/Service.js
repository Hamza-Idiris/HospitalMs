const mongoose = require('mongoose');
const s = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['registration', 'consultation', 'laboratory', 'xray', 'other'], required: true },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
  priceHistory: [{ price: Number, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
}, { timestamps: true });
s.index({ hospitalId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Service', s);
