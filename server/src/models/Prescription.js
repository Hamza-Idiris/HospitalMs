const mongoose = require('mongoose');
const R = (ref) => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true });
const item = new mongoose.Schema({
  medicine: { type: String, required: true }, strength: String, dosage: String,
  frequency: String, duration: String,
  quantity: { type: Number, required: true, min: 1 },
  instructions: String,
  dispensedQty: { type: Number, default: 0 },
});
const s = new mongoose.Schema({
  hospitalId: R('Hospital'), visit: R('Visit'), patient: R('Patient'), doctor: R('User'),
  items: { type: [item], validate: (v) => v.length > 0 },
  status: { type: String, enum: ['pending', 'partial', 'dispensed', 'cancelled'], default: 'pending' },
  dispenseLog: [{ pharmacist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, lines: [{ itemId: mongoose.Schema.Types.ObjectId, qty: Number }] }],
}, { timestamps: true });
s.index({ hospitalId: 1, status: 1, createdAt: -1 });
s.index({ hospitalId: 1, patient: 1 });
s.index({ hospitalId: 1, doctor: 1 });
module.exports = mongoose.model('Prescription', s);
