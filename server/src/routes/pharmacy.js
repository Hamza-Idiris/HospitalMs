const express = require('express');
const { z } = require('zod');
const Prescription = require('../models/Prescription');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { findVisitFor, findPatientFor } = require('../utils/access');
const { asyncH, HttpError } = require('../utils/helpers');
const { notifyRole } = require('../utils/notify');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);
const POP = (q) => q.populate('patient', 'patientId fullName age gender').populate('doctor', 'name');

r.post('/prescriptions', authorize('doctor'), asyncH(async (req, res) => {
  const d = z.object({
    visitId: z.string(),
    items: z.array(z.object({ medicine: z.string().min(1), strength: z.string().optional(), dosage: z.string().optional(), frequency: z.string().optional(), duration: z.string().optional(), quantity: z.coerce.number().int().min(1), instructions: z.string().optional() })).min(1),
  }).parse(req.body);
  const visit = await findVisitFor(req, d.visitId, { doctorOnly: true });
  const rx = await Prescription.create({ hospitalId: req.hospitalId, visit: visit._id, patient: visit.patient, doctor: req.user._id, items: d.items });
  await notifyRole(req.hospitalId, 'pharmacist', `New prescription from Dr. ${req.user.name}`, '/pharmacy');
  audit(req, 'Prescription created', 'Prescription', rx._id, { items: d.items.length });
  res.status(201).json(rx);
}));

r.get('/prescriptions', authorize('doctor', 'pharmacist', 'manager'), asyncH(async (req, res) => {
  const q = { hospitalId: req.hospitalId };
  if (req.user.role === 'doctor') q.doctor = req.user._id;
  if (req.query.status) q.status = { $in: String(req.query.status).split(',') };
  if (req.query.visit) q.visit = req.query.visit;
  if (req.query.patient) q.patient = (await findPatientFor(req, req.query.patient))._id;
  res.json(await POP(Prescription.find(q).sort({ createdAt: -1 }).limit(200)));
}));

r.get('/prescriptions/:id', authorize('doctor', 'pharmacist', 'manager'), asyncH(async (req, res) => {
  const rx = await POP(Prescription.findOne({ _id: req.params.id, hospitalId: req.hospitalId }));
  if (!rx) throw new HttpError(404, 'Prescription not found');
  if (req.user.role === 'doctor' && String(rx.doctor._id) !== String(req.user._id)) throw new HttpError(403, 'Not your prescription');
  res.json(rx);
}));

r.post('/prescriptions/:id/dispense', authorize('pharmacist'), asyncH(async (req, res) => {
  const { lines } = z.object({ lines: z.array(z.object({ itemId: z.string(), qty: z.coerce.number().int().min(1) })).min(1) }).parse(req.body);
  const rx = await Prescription.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!rx) throw new HttpError(404, 'Prescription not found');
  if (['dispensed', 'cancelled'].includes(rx.status)) throw new HttpError(409, `Prescription is ${rx.status}`);
  for (const l of lines) {
    const item = rx.items.id(l.itemId);
    if (!item) throw new HttpError(400, 'Unknown prescription item');
    if (item.dispensedQty + l.qty > item.quantity) throw new HttpError(400, `${item.medicine}: cannot dispense more than prescribed (${item.quantity})`);
    item.dispensedQty += l.qty;
  }
  rx.dispenseLog.push({ pharmacist: req.user._id, lines });
  rx.status = rx.items.every((i) => i.dispensedQty >= i.quantity) ? 'dispensed' : 'partial';
  await rx.save();
  audit(req, 'Medicines dispensed', 'Prescription', rx._id, { status: rx.status, lines });
  res.json(rx);
}));

r.patch('/prescriptions/:id/cancel', authorize('doctor', 'manager'), asyncH(async (req, res) => {
  const rx = await Prescription.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!rx) throw new HttpError(404, 'Prescription not found');
  if (req.user.role === 'doctor' && String(rx.doctor) !== String(req.user._id)) throw new HttpError(403, 'Not your prescription');
  if (rx.status !== 'pending') throw new HttpError(409, 'Only pending prescriptions can be cancelled');
  rx.status = 'cancelled'; await rx.save();
  audit(req, 'Prescription cancelled', 'Prescription', rx._id);
  res.json(rx);
}));
module.exports = r;
