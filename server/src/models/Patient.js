const mongoose = require('mongoose');
const s = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  patientId: { type: String, required: true }, // PT-000001 (unique per hospital)
  fullName: { type: String, required: true, trim: true },
  dob: Date,
  age: { type: Number, required: true, min: 0, max: 130 },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'], default: 'Unknown' },
  emergencyContact: { name: { type: String, required: true }, phone: { type: String, required: true }, relation: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
s.index({ hospitalId: 1, patientId: 1 }, { unique: true });
s.index({ hospitalId: 1, phone: 1 });
s.index({ hospitalId: 1, fullName: 1 });
module.exports = mongoose.model('Patient', s);
