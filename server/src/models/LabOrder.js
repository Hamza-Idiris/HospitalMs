const mongoose = require('mongoose');
const R = (ref, req = true) => ({ type: mongoose.Schema.Types.ObjectId, ref, required: req });
const s = new mongoose.Schema({
  hospitalId: R('Hospital'), visit: R('Visit'), patient: R('Patient'), doctor: R('User'),
  service: R('Service'), testName: { type: String, required: true },
  
  notes: String,
  payment: R('Payment', false),
  status: { type: String, enum: ['requested', 'pending_payment', 'paid', 'in_progress', 'completed', 'cancelled'], default: 'requested' },
  startedBy: R('User', false), startedAt: Date, completedAt: Date,
}, { timestamps: true });
s.index({ hospitalId: 1, status: 1, createdAt: -1 });
s.index({ hospitalId: 1, patient: 1 });
s.index({ hospitalId: 1, doctor: 1 });
module.exports = mongoose.model('LabOrder', s);
