const express = require('express');
const { z } = require('zod');
const Visit = require('../models/Visit');
const Department = require('../models/Department');
const User = require('../models/User');
const Service = require('../models/Service');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { findPatientFor, findVisitFor } = require('../utils/access');
const { asyncH, HttpError, startOfDay, endOfDay } = require('../utils/helpers');
const { nextSeq } = require('../utils/counter');
const { createCharge } = require('../utils/billing');
const { notifyUser } = require('../utils/notify');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);

const STATUSES = ['waiting', 'in_consultation', 'completed', 'referred', 'follow_up'];
const POP = [['patient', 'patientId fullName age gender phone'], ['department', 'name'], ['doctor', 'name']];
const populate = (q) => POP.reduce((qq, [p, f]) => qq.populate(p, f), q);

// Patient -> Department -> Doctor (spec §17). Creates a visit and the consultation charge.
r.post('/', authorize('cashier', 'manager'), asyncH(async (req, res) => {
  const d = z.object({ patientId: z.string(), departmentId: z.string(), doctorId: z.string(), chargeConsultation: z.boolean().default(true) }).parse(req.body);
  const patient = await findPatientFor(req, d.patientId);
  const dept = await Department.findOne({ _id: d.departmentId, hospitalId: req.hospitalId, isActive: true });
  if (!dept) throw new HttpError(400, 'Department not found or inactive');
  const doctor = await User.findOne({ _id: d.doctorId, hospitalId: req.hospitalId, role: 'doctor', isActive: true });
  if (!doctor) throw new HttpError(400, 'Doctor not found or inactive');
  const visitNo = await nextSeq(req.hospitalId, `visit:${patient._id}`);
  const visit = await Visit.create({ hospitalId: req.hospitalId, patient: patient._id, visitNo, department: dept._id, doctor: doctor._id, createdBy: req.user._id });
  let charge = null;
  if (d.chargeConsultation) {
    const svc = await Service.findOne({ hospitalId: req.hospitalId, category: 'consultation', isActive: true }).sort('createdAt');
    if (svc) charge = await createCharge({ hospitalId: req.hospitalId, patient: patient._id, visit: visit._id, service: svc, kind: 'visit', refId: visit._id, userId: req.user._id });
  }
  await notifyUser(req.hospitalId, doctor._id, `New patient assigned: ${patient.fullName}`, '/doctor');
  audit(req, 'Visit created', 'Visit', visit._id, { patient: patient.patientId, visitNo });
  res.status(201).json({ visit, charge });
}));

r.get('/', authorize('manager', 'cashier', 'doctor'), asyncH(async (req, res) => {
  const q = { hospitalId: req.hospitalId };
  if (req.user.role === 'doctor') q.doctor = req.user._id; // DOCTOR ISOLATION
  else if (req.query.doctorId) q.doctor = req.query.doctorId;
  if (req.query.status) q.status = { $in: String(req.query.status).split(',').filter((s) => STATUSES.includes(s)) };
  if (req.query.patient) q.patient = (await findPatientFor(req, req.query.patient))._id;
  if (req.query.today === 'true') q.visitDate = { $gte: startOfDay(), $lte: endOfDay() };
  res.json(await populate(Visit.find(q).sort({ visitDate: -1 }).limit(200)));
}));

r.get('/:id', authorize('manager', 'cashier', 'doctor'), asyncH(async (req, res) => {
  const v = await findVisitFor(req, req.params.id);
  res.json(await populate(Visit.findById(v._id)));
}));

r.patch('/:id/status', authorize('manager', 'cashier', 'doctor'), asyncH(async (req, res) => {
  const { status } = z.object({ status: z.enum(STATUSES) }).parse(req.body);
  const v = await findVisitFor(req, req.params.id);
  v.status = status; await v.save();
  audit(req, 'Visit status changed', 'Visit', v._id, { status });
  res.json(v);
}));
module.exports = r;
