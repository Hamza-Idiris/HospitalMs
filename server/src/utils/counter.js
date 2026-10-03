const Counter = require('../models/Counter');
// Atomic per-hospital sequence generator (PT-000001, RC-000001, visit numbers ...)
async function nextSeq(hospitalId, key) {
  const c = await Counter.findOneAndUpdate(
    { hospitalId: hospitalId || null, key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return c.seq;
}
module.exports = { nextSeq };
