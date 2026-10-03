const Payment = require('../models/Payment');
const { notifyRole } = require('./notify');
// Creates a pending charge. Price is SNAPSHOT at this moment (Rule 5: later price changes never alter it).
async function createCharge({ hospitalId, patient, visit, service, kind, refId, userId }) {
  const price = service.price;
  const p = await Payment.create({
    hospitalId, patient, visit, service: service._id,
    serviceName: service.name, category: service.category,
    originalPrice: price, finalAmount: price, balance: price,
    status: price <= 0 ? 'paid' : 'pending',
    source: { kind, refId }, createdBy: userId,
  });
  if (p.status === 'pending') await notifyRole(hospitalId, 'cashier', `Payment required: ${service.name}`, '/cashier/pending');
  return p;
}
module.exports = { createCharge };
