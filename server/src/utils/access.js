const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const Payment = require('../models/Payment');
const LabOrder = require('../models/LabOrder');
const XrayOrder = require('../models/XrayOrder');
const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const { HttpError } = require('./helpers');

// Which patients may each role see? (Hospital isolation is always applied via hospitalId.)
const ALL_PATIENT_ROLES = ['manager', 'receptionist'];
const relevantModel = (role, hospitalId, userId) => ({
  doctor: () => Visit.distinct('patient', { hospitalId, doctor: userId }), // DOCTOR ISOLATION
  cashier: () => Payment.distinct('patient', { hospitalId }),
  lab: () => LabOrder.distinct('patient', { hospitalId }),
  xray: () => XrayOrder.distinct('patient', { hospitalId }),
  pharmacist: () => Prescription.distinct('patient', { hospitalId }),
}[role]);

async function visiblePatientFilter(req) {
  const base = { hospitalId: req.hospitalId };
  if (ALL_PATIENT_ROLES.includes(req.user.role)) return base;
  const fn = relevantModel(req.user.role, req.hospitalId, req.user._id);
  if (!fn) throw new HttpError(403, 'Forbidden');
  return { ...base, _id: { $in: await fn() } };
}

async function canSeePatient(req, patientObjectId) {
  const { role, _id } = req.user;
  const h = req.hospitalId, p = patientObjectId;
  if (ALL_PATIENT_ROLES.includes(role)) return true;
  if (role === 'doctor') return !!(await Visit.exists({ hospitalId: h, patient: p, doctor: _id }));
  if (role === 'cashier') return !!(await Payment.exists({ hospitalId: h, patient: p }));
  if (role === 'lab') return !!(await LabOrder.exists({ hospitalId: h, patient: p }));
  if (role === 'xray') return !!(await XrayOrder.exists({ hospitalId: h, patient: p }));
  if (role === 'pharmacist') return !!(await Prescription.exists({ hospitalId: h, patient: p }));
  return false;
}

// Resolves "PT-000145" or an ObjectId within the caller's hospital and enforces role visibility.
async function findPatientFor(req, idOrCode) {
  const q = { hospitalId: req.hospitalId, ...(mongoose.isValidObjectId(idOrCode) ? { _id: idOrCode } : { patientId: idOrCode }) };
  const patient = await Patient.findOne(q);
  if (!patient) throw new HttpError(404, 'Patient not found');
  if (!(await canSeePatient(req, patient._id))) throw new HttpError(403, 'You are not allowed to access this patient');
  return patient;
}

// Loads a visit in the caller's hospital; doctors only their own visits.
async function findVisitFor(req, visitId, { doctorOnly = false } = {}) {
  if (!mongoose.isValidObjectId(visitId)) throw new HttpError(400, 'Invalid visit id');
  const visit = await Visit.findOne({ _id: visitId, hospitalId: req.hospitalId });
  if (!visit) throw new HttpError(404, 'Visit not found');
  if ((doctorOnly || req.user.role === 'doctor') && String(visit.doctor) !== String(req.user._id)) {
    throw new HttpError(403, 'This visit is assigned to another doctor');
  }
  return visit;
}
module.exports = { visiblePatientFilter, canSeePatient, findPatientFor, findVisitFor };
