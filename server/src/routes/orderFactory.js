// Shared workflow for Laboratory and X-Ray:
// Doctor order -> pending payment -> Cashier -> paid -> technician starts -> result/report -> Doctor
const express = require('express');
const { z } = require('zod');
const Service = require('../models/Service');
const Hospital = require('../models/Hospital');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { findVisitFor, findPatientFor } = require('../utils/access');
const { createCharge } = require('../utils/billing');
const { notifyUser } = require('../utils/notify');
const { upload, toAttachment } = require('../utils/upload');
const { asyncH, HttpError } = require('../utils/helpers');
const audit = require('../utils/audit');

module.exports = function makeOrderRouter({ Order, Result, kind, techRole, category, label, resultFields, extraOrderFields = {} }) {
  const r = express.Router();
  r.use(authenticate, requireHospital);
  const resultKey = kind === 'lab' ? 'result' : 'report';
  const popOrder = (q) => q.populate('patient', 'patientId fullName age gender').populate('doctor', 'name').populate('payment', 'status finalAmount balance serviceName');

  const attach = async (orders) => {
    const list = Array.isArray(orders) ? orders : [orders];
    const results = await Result.find({ hospitalId: list[0]?.hospitalId, order: { $in: list.map((o) => o._id) } }).populate('technician', 'name').lean();
    const out = list.map((o) => ({ ...(o.toObject ? o.toObject() : o), [resultKey]: results.find((x) => String(x.order) === String(o._id)) || null }));
    return Array.isArray(orders) ? out : out[0];
  };

  // Doctor creates an order for one of their own visits
  r.post('/orders', authorize('doctor'), asyncH(async (req, res) => {
    const d = z.object({ visitId: z.string(), serviceId: z.string(), notes: z.string().optional(), bodyPart: z.string().optional(), clinicalIndication: z.string().optional() }).parse(req.body);
    const visit = await findVisitFor(req, d.visitId, { doctorOnly: true });
    const service = await Service.findOne({ _id: d.serviceId, hospitalId: req.hospitalId, category, isActive: true });
    if (!service) throw new HttpError(400, `Select an active ${label} service`);
    const hospital = await Hospital.findById(req.hospitalId).select('settings');
    const order = new Order({
      hospitalId: req.hospitalId, visit: visit._id, patient: visit.patient, doctor: req.user._id,
      service: service._id, testName: service.name, notes: d.notes,
      ...(kind === 'xray' ? { bodyPart: d.bodyPart, clinicalIndication: d.clinicalIndication } : {}),
    });
    const pay = await createCharge({ hospitalId: req.hospitalId, patient: visit.patient, visit: visit._id, service, kind, refId: order._id, userId: req.user._id });
    order.payment = pay._id;
    order.status = !hospital.settings.requirePrepayment ? 'requested' : pay.status === 'paid' ? 'paid' : 'pending_payment';
    await order.save();
    if (order.status !== 'pending_payment') await require('../utils/notify').notifyRole(req.hospitalId, techRole, `New ${label} request: ${order.testName}`, kind === 'lab' ? '/laboratory' : '/xray');
    audit(req, `${label} order created`, Order.modelName, order._id, { test: order.testName });
    res.status(201).json(order);
  }));

  r.get('/orders', authorize('doctor', techRole, 'manager'), asyncH(async (req, res) => {
    const q = { hospitalId: req.hospitalId };
    if (req.user.role === 'doctor') q.doctor = req.user._id; // doctor isolation
    if (req.query.status) q.status = { $in: String(req.query.status).split(',') };
    if (req.query.visit) q.visit = req.query.visit;
    if (req.query.patient) q.patient = (await findPatientFor(req, req.query.patient))._id;
    const orders = await popOrder(Order.find(q).sort({ createdAt: -1 }).limit(200));
    res.json(orders.length ? await attach(orders) : []);
  }));

  const loadOrder = async (req) => {
    const o = await Order.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
    if (!o) throw new HttpError(404, 'Order not found');
    return o;
  };

  r.get('/orders/:id', authorize('doctor', techRole, 'manager'), asyncH(async (req, res) => {
    const o = await loadOrder(req);
    if (req.user.role === 'doctor' && String(o.doctor) !== String(req.user._id)) throw new HttpError(403, 'Not your order');
    res.json(await attach(await popOrder(Order.findById(o._id))));
  }));

  r.patch('/orders/:id/start', authorize(techRole), asyncH(async (req, res) => {
    const o = await loadOrder(req);
    const hospital = await Hospital.findById(req.hospitalId).select('settings');
    if (hospital.settings.requirePrepayment && !['paid', 'in_progress'].includes(o.status)) throw new HttpError(402, 'Payment is required before this work can start');
    if (!['paid', 'requested'].includes(o.status)) throw new HttpError(409, `Order is ${o.status}`);
    o.status = 'in_progress'; o.startedBy = req.user._id; o.startedAt = new Date(); await o.save();
    audit(req, `${label} started`, Order.modelName, o._id);
    res.json(o);
  }));

  r.post('/orders/:id/result', authorize(techRole), upload.array('attachments', 5), asyncH(async (req, res) => {
    const o = await loadOrder(req);
    if (o.status !== 'in_progress') throw new HttpError(409, 'Start the work before submitting a result');
    const fields = resultFields(req.body, o);
    const doc = await Result.create({
      hospitalId: req.hospitalId, order: o._id, patient: o.patient, technician: req.user._id, ...fields,
      attachments: (req.files || []).map(toAttachment),
    });
    o.status = 'completed'; o.completedAt = new Date(); await o.save();
    const pat = await require('../models/Patient').findOne({ _id: o.patient, hospitalId: req.hospitalId }).select('fullName');
    await notifyUser(req.hospitalId, o.doctor, `${label} ${kind === 'lab' ? 'result' : 'report'} available for ${pat.fullName}: ${o.testName}`, '/doctor');
    audit(req, `${label} ${kind === 'lab' ? 'result submitted' : 'report uploaded'}`, Order.modelName, o._id, { test: o.testName });
    res.status(201).json(doc);
  }));

  // Doctor (their own) or manager can cancel; a paid order can only be cancelled by the manager (marks payment refunded)
  r.patch('/orders/:id/cancel', authorize('doctor', 'manager'), asyncH(async (req, res) => {
    const o = await loadOrder(req);
    if (req.user.role === 'doctor' && String(o.doctor) !== String(req.user._id)) throw new HttpError(403, 'Not your order');
    if (['completed', 'cancelled', 'in_progress'].includes(o.status)) throw new HttpError(409, `Cannot cancel an order that is ${o.status}`);
    const Payment = require('../models/Payment');
    const pay = await Payment.findOne({ _id: o.payment, hospitalId: req.hospitalId });
    if (pay && pay.amountPaid > 0 && req.user.role !== 'manager') throw new HttpError(403, 'This order is already paid. Ask a manager to cancel and refund.');
    if (pay && !['cancelled', 'refunded'].includes(pay.status)) { pay.status = pay.amountPaid > 0 ? 'refunded' : 'cancelled'; await pay.save(); }
    o.status = 'cancelled'; await o.save();
    audit(req, `${label} order cancelled`, Order.modelName, o._id);
    res.json(o);
  }));
  return r;
};
