const express = require('express');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Payment = require('../models/Payment');
const LabOrder = require('../models/LabOrder');
const XrayOrder = require('../models/XrayOrder');
const Prescription = require('../models/Prescription');
const { authenticate, authorize, requireHospital } = require('../middleware/auth');
const { asyncH, startOfDay, endOfDay } = require('../utils/helpers');
const r = express.Router();
r.use(authenticate, requireHospital, authorize('manager'));

r.get('/summary', asyncH(async (req, res) => {
  const h = req.hospitalId;
  const from = req.query.from ? startOfDay(req.query.from) : startOfDay(new Date(Date.now() - 29 * 864e5));
  const to = req.query.to ? endOfDay(req.query.to) : endOfDay();
  const range = { $gte: from, $lte: to };
  const day = (f) => ({ $dateToString: { format: '%Y-%m-%d', date: f } });
  const txStage = [{ $match: { hospitalId: h } }, { $unwind: '$transactions' }, { $match: { 'transactions.at': range } }];

  const [registrations, visitsByDept, revenueByDay, revenueByCategory, cashiers, discounts, outstanding, firstVisits, labs, xrays, rx, paidByService] = await Promise.all([
    Patient.aggregate([{ $match: { hospitalId: h, createdAt: range } }, { $group: { _id: day('$createdAt'), count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Visit.aggregate([{ $match: { hospitalId: h, visitDate: range } }, { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'd' } }, { $project: { name: { $arrayElemAt: ['$d.name', 0] }, count: 1 } }, { $sort: { count: -1 } }]),
    Payment.aggregate([...txStage, { $group: { _id: day('$transactions.at'), total: { $sum: '$transactions.amount' } } }, { $sort: { _id: 1 } }]),
    Payment.aggregate([...txStage, { $group: { _id: '$category', total: { $sum: '$transactions.amount' } } }, { $sort: { total: -1 } }]),
    Payment.aggregate([...txStage, { $group: { _id: '$transactions.cashier', total: { $sum: '$transactions.amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } }, { $project: { name: { $arrayElemAt: ['$u.name', 0] }, total: 1, count: 1 } }]),
    Payment.aggregate([{ $match: { hospitalId: h, discount: { $gt: 0 }, discountAt: range } }, { $group: { _id: null, total: { $sum: '$discount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { hospitalId: h, status: { $in: ['pending', 'partial'] } } }, { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }]),
    Visit.aggregate([{ $match: { hospitalId: h, visitDate: range } }, { $group: { _id: null, newVisits: { $sum: { $cond: [{ $eq: ['$visitNo', 1] }, 1, 0] } }, returning: { $sum: { $cond: [{ $gt: ['$visitNo', 1] }, 1, 0] } } } }]),
    LabOrder.aggregate([{ $match: { hospitalId: h, createdAt: range } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    XrayOrder.aggregate([{ $match: { hospitalId: h, createdAt: range } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Prescription.aggregate([{ $match: { hospitalId: h, createdAt: range } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([...txStage, { $group: { _id: '$serviceName', total: { $sum: '$transactions.amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 15 }]),
  ]);
  const totalRevenue = revenueByDay.reduce((s, x) => s + x.total, 0);
  res.json({
    range: { from, to }, totalRevenue, registrations, visitsByDept, revenueByDay, revenueByCategory, revenueByService: paidByService, cashiers,
    discounts: discounts[0] || { total: 0, count: 0 }, outstanding: outstanding[0] || { total: 0, count: 0 },
    newVsReturning: firstVisits[0] || { newVisits: 0, returning: 0 }, lab: labs, xray: xrays, pharmacy: rx,
  });
}));
module.exports = r;
