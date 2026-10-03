const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const Department = require('../models/Department');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { asyncH, HttpError } = require('../utils/helpers');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);

const STAFF = ['cashier', 'doctor', 'lab', 'xray', 'pharmacist'];
const base = z.object({
  name: z.string().min(2), email: z.string().email(), phone: z.string().optional(),
  role: z.enum(STAFF), departmentId: z.string().optional().or(z.literal('')), specialty: z.string().optional(),
});

// Doctors list (cashier/reception needs it for visit assignment)
r.get('/doctors', authorize('manager', 'cashier'), asyncH(async (req, res) => {
  const q = { hospitalId: req.hospitalId, role: 'doctor', isActive: true };
  if (req.query.departmentId) q.departmentId = req.query.departmentId;
  res.json(await User.find(q).select('name departmentId specialty').sort('name'));
}));

r.use(authorize('manager'));

r.get('/', asyncH(async (req, res) => {
  const q = { hospitalId: req.hospitalId, role: { $ne: 'manager' } };
  if (req.query.role) q.role = req.query.role;
  res.json(await User.find(q).select('-passwordHash').populate('departmentId', 'name').sort({ role: 1, name: 1 }));
}));

async function checkDept(req, id) {
  if (!id) return undefined;
  const d = await Department.findOne({ _id: id, hospitalId: req.hospitalId });
  if (!d) throw new HttpError(400, 'Department not found in this hospital');
  return d._id;
}

r.post('/', asyncH(async (req, res) => {
  const d = base.extend({ password: z.string().min(8) }).parse(req.body);
  const u = await User.create({
    hospitalId: req.hospitalId, name: d.name, email: d.email, phone: d.phone, role: d.role, specialty: d.specialty,
    departmentId: await checkDept(req, d.departmentId), passwordHash: await bcrypt.hash(d.password, 12),
  });
  audit(req, 'User created', 'User', u._id, { role: u.role, email: u.email });
  res.status(201).json({ id: u._id });
}));

r.put('/:id', asyncH(async (req, res) => {
  const d = base.partial().parse(req.body);
  const u = await User.findOne({ _id: req.params.id, hospitalId: req.hospitalId, role: { $ne: 'manager' } });
  if (!u) throw new HttpError(404, 'User not found');
  if (d.departmentId !== undefined) u.departmentId = await checkDept(req, d.departmentId);
  for (const k of ['name', 'email', 'phone', 'role', 'specialty']) if (d[k] !== undefined) u[k] = d[k];
  await u.save();
  audit(req, 'User updated', 'User', u._id, d);
  res.json({ id: u._id });
}));

r.patch('/:id/active', asyncH(async (req, res) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const u = await User.findOneAndUpdate({ _id: req.params.id, hospitalId: req.hospitalId, role: { $ne: 'manager' } }, { isActive }, { new: true });
  if (!u) throw new HttpError(404, 'User not found');
  audit(req, isActive ? 'User activated' : 'User deactivated', 'User', u._id);
  res.json({ id: u._id, isActive: u.isActive });
}));

r.post('/:id/reset-password', asyncH(async (req, res) => {
  const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
  const u = await User.findOne({ _id: req.params.id, hospitalId: req.hospitalId, role: { $ne: 'manager' } });
  if (!u) throw new HttpError(404, 'User not found');
  u.passwordHash = await bcrypt.hash(password, 12); await u.save();
  audit(req, 'User password reset', 'User', u._id);
  res.json({ message: 'Password reset' });
}));
module.exports = r;
