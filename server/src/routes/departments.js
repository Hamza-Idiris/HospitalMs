const express = require('express');
const { z } = require('zod');
const Department = require('../models/Department');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { asyncH, HttpError } = require('../utils/helpers');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);
const schema = z.object({ name: z.string().min(2), description: z.string().optional(), isActive: z.boolean().optional() });

r.get('/', asyncH(async (req, res) => {
  const q = { hospitalId: req.hospitalId };
  if (req.user.role !== 'manager' || req.query.active === 'true') q.isActive = true;
  res.json(await Department.find(q).sort('name'));
}));
r.post('/', authorize('manager'), asyncH(async (req, res) => {
  const d = await Department.create({ ...schema.parse(req.body), hospitalId: req.hospitalId });
  audit(req, 'Department created', 'Department', d._id, { name: d.name });
  res.status(201).json(d);
}));
r.put('/:id', authorize('manager'), asyncH(async (req, res) => {
  const d = await Department.findOneAndUpdate({ _id: req.params.id, hospitalId: req.hospitalId }, schema.partial().parse(req.body), { new: true });
  if (!d) throw new HttpError(404, 'Department not found');
  audit(req, 'Department updated', 'Department', d._id, req.body);
  res.json(d);
}));
module.exports = r;
