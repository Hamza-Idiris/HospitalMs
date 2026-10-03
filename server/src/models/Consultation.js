const mongoose = require('mongoose');
const R = (ref) => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true });
const s = new mongoose.Schema({
  hospitalId: R('Hospital'), visit: R('Visit'), patient: R('Patient'), doctor: R('User'),
  chiefComplaint: String, symptoms: String,
  vitals: { bp: String, temperature: Number, pulse: Number, respiratoryRate: Number, spo2: Number, weight: Number, height: Number },
  medicalHistory: String, examination: String, diagnosis: String, notes: String, treatmentPlan: String,
  followUpDate: Date,
  completed: { type: Boolean, default: false },
}, { timestamps: true });
s.index({ hospitalId: 1, visit: 1 }, { unique: true });
s.index({ hospitalId: 1, patient: 1, createdAt: -1 });
s.index({ hospitalId: 1, doctor: 1, followUpDate: 1 });
module.exports = mongoose.model('Consultation', s);
