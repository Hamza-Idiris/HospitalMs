const mongoose = require('mongoose');
const ROLES = ['super_admin', 'manager', 'receptionist', 'cashier', 'doctor', 'lab', 'xray', 'pharmacist'];
const s = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: String,
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, // doctors
  specialty: String,
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date,
}, { timestamps: true });
s.index({ hospitalId: 1, role: 1 });
s.statics.ROLES = ROLES;
module.exports = mongoose.model('User', s);
