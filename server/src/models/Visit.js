const mongoose = require('mongoose');
const R = (ref, req = true) => ({ type: mongoose.Schema.Types.ObjectId, ref, required: req });
const s = new mongoose.Schema({
  hospitalId: R('Hospital'), patient: R('Patient'),
  visitNo: { type: Number, required: true },
  department: R('Department'), doctor: R('User'),
  status: { type: String, enum: ['waiting', 'in_consultation', 'completed', 'referred', 'follow_up'], default: 'waiting' },
  visitDate: { type: Date, default: Date.now },
  createdBy: R('User', false),
}, { timestamps: true });
s.index({ hospitalId: 1, doctor: 1, visitDate: -1 });
s.index({ hospitalId: 1, patient: 1, visitNo: 1 }, { unique: true });
module.exports = mongoose.model('Visit', s);
