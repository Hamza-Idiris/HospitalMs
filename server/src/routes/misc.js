// Dashboards, audit logs, notifications, and authenticated file access
const express = require('express');
const path = require('path');
const fs = require('fs');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Department = require('../models/Department');
const Consultation = require('../models/Consultation');
const LabOrder = require('../models/LabOrder');
const XrayOrder = require('../models/XrayOrder');
const Prescription = require('../models/Prescription');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncH, HttpError, startOfDay, endOfDay } = require('../utils/helpers');
const { UPLOAD_ROOT } = require('../utils/upload');
const r = express.Router();
r.use(authenticate);

const sumTx = async (h, from, to) => {
  const a = await Payment.aggregate([{ $match: { hospitalId: h } }, { $unwind: '$transactions' },
    { $match: { 'transactions.at': { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: '$transactions.amount' }, n: { $sum: 1 } } }]);
  return a[0] || { total: 0, n: 0 };
};

r.get('/dashboard', asyncH(async (req, res) => {
  const { role, _id } = req.user, h = req.hospitalId;
  if (role === 'super_admin') throw new HttpError(400, 'Use /api/hospitals/stats');
  const today = { $gte: startOfDay(), $lte: endOfDay() };
  const c = (M, q) => M.countDocuments({ hospitalId: h, ...q });
  let out = {};
  if (role === 'manager') {
    const t = await sumTx(h, startOfDay(), endOfDay());
    const pend = await Payment.aggregate([{ $match: { hospitalId: h, status: { $in: ['pending', 'partial'] } } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: '$balance' } } }]);
    out = {
      totalPatients: await c(Patient, {}), todaysVisits: await c(Visit, { visitDate: today }),
      doctors: await c(User, { role: 'doctor', isActive: true }), departments: await c(Department, { isActive: true }),
      todaysRevenue: t.total, pendingPayments: pend[0]?.n || 0, outstandingBalance: pend[0]?.total || 0,
      pendingLabTests: await c(LabOrder, { status: { $in: ['requested', 'pending_payment', 'paid', 'in_progress'] } }),
      pendingXrays: await c(XrayOrder, { status: { $in: ['requested', 'pending_payment', 'paid', 'in_progress'] } }),
      pendingPrescriptions: await c(Prescription, { status: { $in: ['pending', 'partial'] } }),
    };
  } else if (role === 'doctor') {
    const mine = { doctor: _id };
    out = {
      todaysPatients: await c(Visit, { ...mine, visitDate: today }),
      waiting: await c(Visit, { ...mine, status: 'waiting' }),
      inConsultation: await c(Visit, { ...mine, status: 'in_consultation' }),
      completedToday: await c(Visit, { ...mine, visitDate: today, status: { $in: ['completed', 'follow_up'] } }),
      pendingLabResults: await c(LabOrder, { ...mine, status: { $in: ['requested', 'pending_payment', 'paid', 'in_progress'] } }),
      pendingXrayReports: await c(XrayOrder, { ...mine, status: { $in: ['requested', 'pending_payment', 'paid', 'in_progress'] } }),
      followUps: await c(Consultation, { ...mine, followUpDate: { $gte: startOfDay() } }),
    };
  } else if (role === 'cashier') {
    const t = await sumTx(h, startOfDay(), endOfDay());
    out = {
      todaysPayments: t.n,
      totalCollectedToday: t.total,
      pendingPayments: await c(Payment, { status: { $in: ['pending', 'partial'] } }),
      registeredToday: await c(Patient, { createdAt: today }),
      visitsToday: await c(Visit, { visitDate: today }),
      waiting: await c(Visit, { status: 'waiting' }),
    };
  } else if (role === 'lab') {
    out = { pendingTests: await c(LabOrder, { status: { $in: ['requested', 'paid'] } }), inProgress: await c(LabOrder, { status: 'in_progress' }), completedToday: await c(LabOrder, { status: 'completed', completedAt: today }) };
  } else if (role === 'xray') {
    out = { pendingRequests: await c(XrayOrder, { status: { $in: ['requested', 'paid'] } }), inProgress: await c(XrayOrder, { status: 'in_progress' }), completedToday: await c(XrayOrder, { status: 'completed', completedAt: today }) };
  } else if (role === 'pharmacist') {
    out = { pendingPrescriptions: await c(Prescription, { status: { $in: ['pending', 'partial'] } }), dispensedToday: await c(Prescription, { status: 'dispensed', updatedAt: today }) };
  }
  res.json(out);
}));

// Audit logs: super admin sees everything, manager sees own hospital only
r.get('/audit-logs', authorize('super_admin', 'manager'), asyncH(async (req, res) => {
  const q = req.user.role === 'manager' ? { hospitalId: req.hospitalId } : {};
  if (req.user.role === 'super_admin' && req.query.hospitalId) q.hospitalId = req.query.hospitalId;
  if (req.query.action) q.action = new RegExp(String(req.query.action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  res.json(await AuditLog.find(q).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 500)));
}));

r.get('/notifications', asyncH(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
  res.json({ items, unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
}));
r.post('/notifications/read-all', asyncH(async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); }));
r.patch('/notifications/:id/read', asyncH(async (req, res) => { await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true }); res.json({ ok: true }); }));

// Files are never public: only same-hospital clinical roles may download
r.get('/files/:hospitalId/:name', authorize('doctor', 'lab', 'xray', 'manager'), asyncH(async (req, res) => {
  if (String(req.hospitalId) !== req.params.hospitalId) throw new HttpError(403, 'Forbidden');
  const file = path.join(UPLOAD_ROOT, String(req.hospitalId), path.basename(req.params.name));
  if (!fs.existsSync(file)) throw new HttpError(404, 'File not found');
  res.sendFile(file);
}));
module.exports = r;
