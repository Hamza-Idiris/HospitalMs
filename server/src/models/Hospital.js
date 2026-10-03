const mongoose = require('mongoose');
const s = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  address: String, phone: String, email: String,
  isActive: { type: Boolean, default: true },
  settings: {
    // Rule 6/7: lab & X-ray work only proceeds after payment when true
    requirePrepayment: { type: Boolean, default: true },
    cashierMaxDiscountPercent: { type: Number, default: 10, min: 0, max: 100 },
    currency: { type: String, default: 'USD' },
  },
}, { timestamps: true });
module.exports = mongoose.model('Hospital', s);
