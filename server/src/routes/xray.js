const XrayOrder = require('../models/XrayOrder');
const XrayReport = require('../models/XrayReport');
const { HttpError } = require('../utils/helpers');
module.exports = require('./orderFactory')({
  Order: XrayOrder, Result: XrayReport, kind: 'xray', techRole: 'xray', category: 'xray', label: 'X-Ray',
  resultFields(body, order) {
    if (!body.findings) throw new HttpError(400, 'Findings are required');
    return { examinationType: order.testName, bodyPart: body.bodyPart || order.bodyPart, findings: body.findings, impression: body.impression, technicalNotes: body.technicalNotes };
  },
});
