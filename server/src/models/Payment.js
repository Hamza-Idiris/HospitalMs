const mongoose = require('mongoose');
const R = (ref, req = true) => ({ type: mongoose.Schema.Types.ObjectId, ref, required: req });
const tx = new mongoose.Schema({
  receiptNo: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['cash', 'evc_plus', 'edahab', 'card', 'other'], default: 'cash' },
  cashier: R('User'),
  at: { type: Date, default: Date.now },
});
const s = new mongoose.Schema({
  hospitalId: R('Hospital'), patient: R('Patient'), visit: R('Visit'),
  service: R('Service', false),
  serviceName: { type: String, required: true },      // snapshot
  category: String,                                    // snapshot
  originalPrice: { type: Number, required: true },     // snapshot
  discount: { type: Number, default: 0 },
  discountReason: String, discountBy: R('User', false), discountAt: Date,
  finalAmount: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  balance: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'partial', 'paid', 'cancelled', 'refunded'], default: 'pending' },
  source: { kind: { type: String, enum: ['visit', 'lab', 'xray', 'other'], default: 'other' }, refId: mongoose.Schema.Types.ObjectId },
  transactions: [tx],
  createdBy: R('User', false),
}, { timestamps: true });
s.index({ hospitalId: 1, status: 1, createdAt: -1 });
s.index({ hospitalId: 1, patient: 1 });
s.index({ hospitalId: 1, 'transactions.receiptNo': 1 });
module.exports = mongoose.model('Payment', s);
