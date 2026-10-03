const mongoose = require('mongoose');
const R = (ref) => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true });
const s = new mongoose.Schema({
  hospitalId: R('Hospital'), order: R('XrayOrder'), patient: R('Patient'), technician: R('User'),
  examinationType: String, bodyPart: String,
  findings: String, impression: String, technicalNotes: String,
  attachments: [{ filename: String, originalName: String, mimetype: String, size: Number }],
  reportDate: { type: Date, default: Date.now },
}, { timestamps: true });
s.index({ hospitalId: 1, order: 1 }, { unique: true });
s.index({ hospitalId: 1, patient: 1 });
module.exports = mongoose.model('XrayReport', s);
