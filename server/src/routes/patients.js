const express = require('express');
const { z } = require('zod');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Consultation = require('../models/Consultation');
const LabOrder = require('../models/LabOrder');
const LabResult = require('../models/LabResult');
const XrayOrder = require('../models/XrayOrder');
const XrayReport = require('../models/XrayReport');
const Prescription = require('../models/Prescription');
const Payment = require('../models/Payment');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { visiblePatientFilter, findPatientFor } = require('../utils/access');
const { asyncH, HttpError, escapeRegex, pad, ageFromDob } = require('../utils/helpers');
const { nextSeq } = require('../utils/counter');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);

const schema = z.object({
  fullName: z.string().min(2), dob: z.string().optional().or(z.literal('')), age: z.coerce.number().int().min(0).max(130).optional(),
  gender: z.enum(['male', 'female', 'other']), phone: z.string().min(5), address: z.string().min(2),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']).default('Unknown'),
  emergencyContact: z.object({ name: z.string().min(2), phone: z.string().min(5), relation: z.string().optional() }),
  force: z.boolean().optional(),
}).refine((d) => d.dob || d.age !== undefined, { message: 'Provide date of birth or age', path: ['age'] });

const normalize = (d) => {
  const out = { ...d }; delete out.force;
  if (d.dob) { out.dob = new Date(d.dob); out.age = ageFromDob(d.dob); } else delete out.dob;
  return out;
};

r.post('/', authorize('receptionist', 'manager'), asyncH(async (req, res) => {
  const d = schema.parse(req.body);
  // Duplicate prevention: same name + phone in the same hospital
  const dup = await Patient.findOne({ hospitalId: req.hospitalId, phone: d.phone, fullName: new RegExp(`^${escapeRegex(d.fullName.trim())}$`, 'i') });
  if (dup && !d.force) return res.status(409).json({ message: 'A patient with the same name and phone already exists', duplicate: { patientId: dup.patientId, fullName: dup.fullName, id: dup._id } });
  const patient = await Patient.create({ ...normalize(d), hospitalId: req.hospitalId, patientId: 'PT-' + pad(await nextSeq(req.hospitalId, 'patient')), createdBy: req.user._id });
  audit(req, 'Patient created', 'Patient', patient._id, { patientId: patient.patientId });
  res.status(201).json(patient);
}));

r.get('/', asyncH(async (req, res) => {
  const filter = await visiblePatientFilter(req);
  const q = (req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ patientId: rx }, { fullName: rx }, { phone: rx }];
  }
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  res.json(await Patient.find(filter).sort({ createdAt: -1 }).limit(limit));
}));

r.get('/:id', asyncH(async (req, res) => res.json(await findPatientFor(req, req.params.id))));

r.put('/:id', authorize('receptionist', 'manager'), asyncH(async (req, res) => {
  const patient = await findPatientFor(req, req.params.id);
  const d = schema.innerType().partial().parse(req.body);
  Object.assign(patient, normalize(d));
  await patient.save();
  audit(req, 'Patient updated', 'Patient', patient._id, { patientId: patient.patientId });
  res.json(patient);
}));

// Role-filtered patient profile (spec §32): each section depends on the caller's role.
const SECTIONS = {
  visits: ['manager', 'receptionist', 'doctor'],
  consultations: ['manager', 'doctor'],
  lab: ['manager', 'doctor', 'lab'],
  xray: ['manager', 'doctor', 'xray'],
  prescriptions: ['manager', 'doctor', 'pharmacist'],
  financial: ['manager', 'cashier'],
};
r.get('/:id/profile', asyncH(async (req, res) => {
  const patient = await findPatientFor(req, req.params.id);
  const role = req.user.role, h = req.hospitalId, p = patient._id;
  const can = (k) => SECTIONS[k].includes(role);
  const out = { patient, sections: Object.keys(SECTIONS).filter(can) };
  const jobs = [];
  if (can('visits')) {
    const vq = { hospitalId: h, patient: p };
    jobs.push(Visit.find(vq).populate('department', 'name').populate('doctor', 'name').sort({ visitNo: -1 }).then((v) => (out.visits = v)));
  }
  if (can('consultations')) jobs.push(Consultation.find({ hospitalId: h, patient: p }).populate('doctor', 'name').populate('visit', 'visitNo visitDate').sort({ createdAt: -1 }).then((v) => (out.consultations = v)));
  if (can('lab')) jobs.push(Promise.all([LabOrder.find({ hospitalId: h, patient: p }).populate('doctor', 'name').sort({ createdAt: -1 }).lean(), LabResult.find({ hospitalId: h, patient: p }).lean()]).then(([o, rs]) => (out.lab = o.map((x) => ({ ...x, result: rs.find((q) => String(q.order) === String(x._id)) || null })))));
  if (can('xray')) jobs.push(Promise.all([XrayOrder.find({ hospitalId: h, patient: p }).populate('doctor', 'name').sort({ createdAt: -1 }).lean(), XrayReport.find({ hospitalId: h, patient: p }).lean()]).then(([o, rs]) => (out.xray = o.map((x) => ({ ...x, report: rs.find((q) => String(q.order) === String(x._id)) || null })))));
  if (can('prescriptions')) jobs.push(Prescription.find({ hospitalId: h, patient: p }).populate('doctor', 'name').sort({ createdAt: -1 }).then((v) => (out.prescriptions = v)));
  if (can('financial')) jobs.push(Payment.find({ hospitalId: h, patient: p }).sort({ createdAt: -1 }).then((v) => {
    out.payments = v;
    out.outstanding = v.filter((x) => ['pending', 'partial'].includes(x.status)).reduce((s, x) => s + x.balance, 0);
  }));
  await Promise.all(jobs);
  res.json(out);
}));
module.exports = r;
