const mongoose = require('mongoose');
const R = (ref) => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true });
const s = new mongoose.Schema({
  hospitalId: R('Hospital'), order: R('LabOrder'), patient: R('Patient'), technician: R('User'),
  testName: String,
  items: [{ name: String, result: String, unit: String, range: String, flag: { type: String, enum: ['normal', 'low', 'high', 'abnormal', ''], default: '' } }],
  notes: String,
  attachments: [{ filename: String, originalName: String, mimetype: String, size: Number }],
  resultDate: { type: Date, default: Date.now },
}, { timestamps: true });
s.index({ hospitalId: 1, order: 1 }, { unique: true });
s.index({ hospitalId: 1, patient: 1 });
module.exports = mongoose.model('LabResult', s);
