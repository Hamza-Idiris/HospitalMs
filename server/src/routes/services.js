const express = require('express');
const { z } = require('zod');
const Service = require('../models/Service');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { asyncH, HttpError, round2 } = require('../utils/helpers');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);
const schema = z.object({
  name: z.string().min(2), category: z.enum(['registration', 'consultation', 'laboratory', 'xray', 'other']),
  price: z.number().min(0), isActive: z.boolean().optional(),
});

r.get('/', asyncH(async (req, res) => {
  const q = { hospitalId: req.hospitalId };
  if (req.user.role !== 'manager') q.isActive = true;
  if (req.query.category) q.category = req.query.category;
  res.json(await Service.find(q).select(req.user.role === 'manager' ? '' : '-priceHistory').sort({ category: 1, name: 1 }));
}));
r.post('/', authorize('manager'), asyncH(async (req, res) => {
  const d = schema.parse(req.body);
  const s = await Service.create({ ...d, price: round2(d.price), hospitalId: req.hospitalId, priceHistory: [{ price: round2(d.price), changedBy: req.user._id }] });
  audit(req, 'Service created', 'Service', s._id, { name: s.name, price: s.price });
  res.status(201).json(s);
}));
r.put('/:id', authorize('manager'), asyncH(async (req, res) => {
  const d = schema.partial().parse(req.body);
  const s = await Service.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!s) throw new HttpError(404, 'Service not found');
  const oldPrice = s.price;
  Object.assign(s, d);
  if (d.price !== undefined && round2(d.price) !== oldPrice) {
    s.price = round2(d.price);
    s.priceHistory.push({ price: s.price, changedBy: req.user._id });
    audit(req, 'Service price changed', 'Service', s._id, { name: s.name, oldPrice, newPrice: s.price });
  } else audit(req, 'Service updated', 'Service', s._id, d);
  await s.save();
  res.json(s);
}));
module.exports = r;
