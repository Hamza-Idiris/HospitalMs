const express = require('express');
const { z } = require('zod');
const Payment = require('../models/Payment');
const Hospital = require('../models/Hospital');
const LabOrder = require('../models/LabOrder');
const XrayOrder = require('../models/XrayOrder');
const Patient = require('../models/Patient');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { asyncH, HttpError, round2, pad, escapeRegex } = require('../utils/helpers');
const { nextSeq } = require('../utils/counter');
const { notifyRole, notifyUser } = require('../utils/notify');
const audit = require('../utils/audit');
const r = express.Router();
r.use(authenticate, requireHospital);

const POP = (q) => q.populate('patient', 'patientId fullName phone').populate('discountBy', 'name');

r.get('/', authorize('cashier', 'manager'), asyncH(async (req, res) => {
  const q = { hospitalId: req.hospitalId };
  if (req.query.status) q.status = { $in: String(req.query.status).split(',') };
  if (req.query.patient) q.patient = req.query.patient;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    const ids = await Patient.find({ hospitalId: req.hospitalId, $or: [{ patientId: rx }, { fullName: rx }, { phone: rx }] }).distinct('_id');
    q.$or = [{ patient: { $in: ids } }, { 'transactions.receiptNo': rx }];
  }
  res.json(await POP(Payment.find(q).sort({ createdAt: -1 }).limit(200)));
}));

r.get('/:id', authorize('cashier', 'manager'), asyncH(async (req, res) => {
  const p = await POP(Payment.findOne({ _id: req.params.id, hospitalId: req.hospitalId }));
  if (!p) throw new HttpError(404, 'Payment not found');
  res.json(p);
}));

async function applyDiscount(req, p, amount, reason) {
  if (p.amountPaid > 0) throw new HttpError(409, 'Discount cannot change after a payment was received');
  if (!['pending', 'partial'].includes(p.status)) throw new HttpError(409, 'This charge is closed');
  amount = round2(amount);
  if (amount < 0 || amount > p.originalPrice) throw new HttpError(400, 'Invalid discount amount');
  if (amount > 0 && !reason) throw new HttpError(400, 'Discount reason is required');
  if (req.user.role === 'cashier') {
    const h = await Hospital.findById(req.hospitalId).select('settings');
    const max = h.settings.cashierMaxDiscountPercent;
    if (amount > (p.originalPrice * max) / 100) throw new HttpError(403, `Cashiers can discount up to ${max}%. Ask a manager to authorize more.`);
  }
  p.discount = amount; p.discountReason = amount ? reason : undefined;
  p.discountBy = amount ? req.user._id : undefined; p.discountAt = amount ? new Date() : undefined;
  p.finalAmount = round2(p.originalPrice - amount); p.balance = p.finalAmount;
  if (p.balance <= 0) p.status = 'paid';
  audit(req, 'Discount applied', 'Payment', p._id, { service: p.serviceName, original: p.originalPrice, discount: amount, reason });
}

async function syncSource(p) {
  const Model = p.source.kind === 'lab' ? LabOrder : p.source.kind === 'xray' ? XrayOrder : null;
  if (!Model) return;
  const order = await Model.findOneAndUpdate({ _id: p.source.refId, hospitalId: p.hospitalId, status: { $in: ['pending_payment', 'requested'] } }, { status: 'paid' }, { new: true });
  if (order) await notifyRole(p.hospitalId, p.source.kind === 'lab' ? 'lab' : 'xray', `New paid request: ${order.testName}`, p.source.kind === 'lab' ? '/laboratory' : '/xray');
}

r.post('/:id/discount', authorize('cashier', 'manager'), asyncH(async (req, res) => {
  const { amount, reason } = z.object({ amount: z.coerce.number().min(0), reason: z.string().optional() }).parse(req.body);
  const p = await Payment.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!p) throw new HttpError(404, 'Payment not found');
  await applyDiscount(req, p, amount, reason);
  await p.save();
  if (p.status === 'paid') await syncSource(p);
  res.json(p);
}));

// Receive payment. Every payment transaction gets its own receipt number (Rule 9).
r.post('/:id/pay', authorize('cashier'), asyncH(async (req, res) => {
  const d = z.object({
    amount: z.coerce.number().positive(), method: z.enum(['cash', 'evc_plus', 'edahab', 'card', 'other']).default('cash'),
    discount: z.coerce.number().min(0).optional(), discountReason: z.string().optional(),
  }).parse(req.body);
  let p = await Payment.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!p) throw new HttpError(404, 'Payment not found');
  if (d.discount !== undefined && d.discount !== p.discount) { await applyDiscount(req, p, d.discount, d.discountReason); await p.save(); }
  if (!['pending', 'partial'].includes(p.status)) throw new HttpError(409, `This charge is ${p.status}`);
  const amount = round2(d.amount);
  if (amount > p.balance + 0.001) throw new HttpError(400, `Amount exceeds balance (${p.balance})`);
  const receiptNo = 'RC-' + pad(await nextSeq(req.hospitalId, 'receipt'));
  // Atomic guard against double-spend / concurrent cashiers
  p = await Payment.findOneAndUpdate(
    { _id: p._id, hospitalId: req.hospitalId, status: { $in: ['pending', 'partial'] }, balance: { $gte: amount - 0.001 } },
    { $inc: { amountPaid: amount, balance: -amount }, $push: { transactions: { receiptNo, amount, method: d.method, cashier: req.user._id } } },
    { new: true }
  );
  if (!p) throw new HttpError(409, 'Payment changed while processing. Reload and try again.');
  p.balance = round2(p.balance); p.amountPaid = round2(p.amountPaid);
  p.status = p.balance <= 0.001 ? 'paid' : 'partial';
  if (p.status === 'paid') p.balance = 0;
  await p.save();
  if (p.status === 'paid') await syncSource(p);
  await notifyRole(req.hospitalId, 'manager', `Payment ${receiptNo}: ${p.serviceName} (${amount})`, '/manager/payments');
  audit(req, 'Payment received', 'Payment', p._id, { receiptNo, amount, method: d.method, service: p.serviceName });
  res.json({ payment: p, receiptNo });
}));

r.post('/:id/cancel', authorize('manager'), asyncH(async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!p) throw new HttpError(404, 'Payment not found');
  if (['cancelled', 'refunded'].includes(p.status)) throw new HttpError(409, 'Already closed');
  p.status = p.amountPaid > 0 ? 'refunded' : 'cancelled';
  await p.save();
  audit(req, p.status === 'refunded' ? 'Payment refunded' : 'Payment cancelled', 'Payment', p._id, { amountPaid: p.amountPaid });
  res.json(p);
}));

r.get('/:id/receipt/:receiptNo', authorize('cashier', 'manager'), asyncH(async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, hospitalId: req.hospitalId }).populate('patient', 'patientId fullName').populate('discountBy', 'name');
  if (!p) throw new HttpError(404, 'Payment not found');
  const tx = p.transactions.find((t) => t.receiptNo === req.params.receiptNo);
  if (!tx) throw new HttpError(404, 'Receipt not found');
  const hospital = await Hospital.findById(req.hospitalId).select('name address phone settings.currency');
  const cashier = await require('../models/User').findById(tx.cashier).select('name');
  res.json({
    receiptNo: tx.receiptNo, hospital, patient: p.patient, service: p.serviceName,
    originalAmount: p.originalPrice, discount: p.discount, finalAmount: p.finalAmount,
    paid: tx.amount, totalPaid: p.amountPaid, balance: p.balance, method: tx.method,
    cashier: cashier ? cashier.name : '', at: tx.at,
  });
}));
module.exports = r;
