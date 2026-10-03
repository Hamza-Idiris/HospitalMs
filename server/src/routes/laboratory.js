const LabOrder = require('../models/LabOrder');
const LabResult = require('../models/LabResult');
const { HttpError } = require('../utils/helpers');
module.exports = require('./orderFactory')({
  Order: LabOrder, Result: LabResult, kind: 'lab', techRole: 'lab', category: 'laboratory', label: 'Laboratory',
  resultFields(body, order) {
    let items = body.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch { throw new HttpError(400, 'Invalid result items'); } }
    if (!Array.isArray(items) || !items.length || items.some((i) => !i.name || i.result === undefined || i.result === '')) throw new HttpError(400, 'Enter at least one result with a name and value');
    return { testName: order.testName, items: items.map((i) => ({ name: i.name, result: String(i.result), unit: i.unit, range: i.range, flag: i.flag || '' })), notes: body.notes };
  },
});
