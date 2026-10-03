const express = require('express');
const { z } = require('zod');
const Consultation = require('../models/Consultation');
const Patient = require('../models/Patient');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { findVisitFor } = require('../utils/access');
const { asyncH, startOfDay } = require('../utils/helpers');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);

const schema = z.object({
  chiefComplaint: z.string().optional(), symptoms: z.string().optional(),
  vitals: z.object({ bp: z.string().optional(), temperature: z.coerce.number().optional(), pulse: z.coerce.number().optional(), respiratoryRate: z.coerce.number().optional(), spo2: z.coerce.number().optional(), weight: z.coerce.number().optional(), height: z.coerce.number().optional() }).partial().optional(),
  medicalHistory: z.string().optional(), examination: z.string().optional(), diagnosis: z.string().optional(),
  notes: z.string().optional(), treatmentPlan: z.string().optional(),
  followUpDate: z.string().optional().or(z.literal('')), complete: z.boolean().optional(),
});

r.get('/follow-ups/list', authorize('doctor'), asyncH(async (req, res) => {
  res.json(await Consultation.find({ hospitalId: req.hospitalId, doctor: req.user._id, followUpDate: { $gte: startOfDay() } })
    .populate('patient', 'patientId fullName phone').sort('followUpDate'));
}));

r.get('/visit/:visitId', authorize('doctor', 'manager'), asyncH(async (req, res) => {
  const v = await findVisitFor(req, req.params.visitId);
  res.json(await Consultation.findOne({ hospitalId: req.hospitalId, visit: v._id }));
}));

// Create/update the consultation for a visit (only the assigned doctor).
r.put('/visit/:visitId', authorize('doctor'), asyncH(async (req, res) => {
  const d = schema.parse(req.body);
  const visit = await findVisitFor(req, req.params.visitId, { doctorOnly: true });
  const { complete, followUpDate, ...rest } = d;
  const set = { ...rest };
  if (followUpDate) set.followUpDate = new Date(followUpDate); else if (followUpDate === '') set.followUpDate = null;
  if (complete) set.completed = true;
  const existing = await Consultation.findOne({ hospitalId: req.hospitalId, visit: visit._id });
  const c = await Consultation.findOneAndUpdate(
    { hospitalId: req.hospitalId, visit: visit._id },
    { $set: set, $setOnInsert: { patient: visit.patient, doctor: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );
  if (complete) visit.status = c.followUpDate ? 'follow_up' : 'completed';
  else if (visit.status === 'waiting') visit.status = 'in_consultation';
  await visit.save();
  audit(req, existing ? 'Consultation updated' : 'Consultation created', 'Consultation', c._id, { visit: visit._id, completed: !!complete });
  res.json(c);
}));
module.exports = r;
