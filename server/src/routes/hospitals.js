const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncH, HttpError } = require('../utils/helpers');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, authorize('super_admin'));

const managerSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), phone: z.string().optional() });
const hospitalSchema = z.object({
  name: z.string().min(2), code: z.string().min(2).max(12),
  address: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  settings: z.object({ requirePrepayment: z.boolean().optional(), cashierMaxDiscountPercent: z.number().min(0).max(100).optional(), currency: z.string().optional() }).optional(),
});

async function createManager(hospitalId, m) {
  return User.create({ hospitalId, role: 'manager', name: m.name, email: m.email, phone: m.phone, passwordHash: await bcrypt.hash(m.password, 12) });
}

r.get('/', asyncH(async (req, res) => {
  const hospitals = await Hospital.find().sort({ createdAt: -1 }).lean();
  const counts = await User.aggregate([{ $match: { role: 'manager' } }, { $group: { _id: '$hospitalId', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json(hospitals.map((h) => ({ ...h, managerCount: map[String(h._id)] || 0 })));
}));

r.get('/stats', asyncH(async (req, res) => {
  const [total, active, managers, users, patients, visitsToday] = await Promise.all([
    Hospital.countDocuments(), Hospital.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'manager' }), User.countDocuments({ role: { $ne: 'super_admin' } }),
    Patient.countDocuments(), Visit.countDocuments({ visitDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
  ]);
  res.json({ totalHospitals: total, activeHospitals: active, hospitalManagers: managers, totalUsers: users, totalPatients: patients, visitsToday });
}));

r.post('/', asyncH(async (req, res) => {
  const body = hospitalSchema.extend({ manager: managerSchema.optional() }).parse(req.body);
  const { manager, ...data } = body;
  const hospital = await Hospital.create(data);
  if (manager) await createManager(hospital._id, manager);
  audit(req, 'Created hospital', 'Hospital', hospital._id, { name: hospital.name });
  res.status(201).json(hospital);
}));

r.put('/:id', asyncH(async (req, res) => {
  const data = hospitalSchema.partial().parse(req.body);
  const h = await Hospital.findById(req.params.id);
  if (!h) throw new HttpError(404, 'Hospital not found');
  const { settings, ...rest } = data;
  Object.assign(h, rest);
  if (settings) Object.assign(h.settings, settings);
  await h.save();
  audit(req, 'Updated hospital', 'Hospital', h._id, data);
  res.json(h);
}));

r.patch('/:id/active', asyncH(async (req, res) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const h = await Hospital.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!h) throw new HttpError(404, 'Hospital not found');
  audit(req, isActive ? 'Activated hospital' : 'Deactivated hospital', 'Hospital', h._id, { name: h.name });
  res.json(h);
}));

r.get('/:id/managers', asyncH(async (req, res) => {
  res.json(await User.find({ hospitalId: req.params.id, role: 'manager' }).select('-passwordHash').sort({ createdAt: -1 }));
}));

r.post('/:id/managers', asyncH(async (req, res) => {
  const h = await Hospital.findById(req.params.id);
  if (!h) throw new HttpError(404, 'Hospital not found');
  const u = await createManager(h._id, managerSchema.parse(req.body));
  audit(req, 'Created hospital manager', 'User', u._id, { hospital: h.name, email: u.email });
  res.status(201).json({ id: u._id, name: u.name, email: u.email });
}));

r.patch('/managers/:userId/active', asyncH(async (req, res) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const u = await User.findOneAndUpdate({ _id: req.params.userId, role: 'manager' }, { isActive }, { new: true }).select('-passwordHash');
  if (!u) throw new HttpError(404, 'Manager not found');
  audit(req, isActive ? 'Activated manager' : 'Deactivated manager', 'User', u._id);
  res.json(u);
}));
module.exports = r;
