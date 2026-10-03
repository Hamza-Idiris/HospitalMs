const AuditLog = require('../models/AuditLog');
// Fire-and-forget audit trail; never breaks the request.
function audit(req, action, entity, entityId, details = {}) {
  AuditLog.create({
    hospitalId: req.user.hospitalId || null,
    user: req.user._id,
    userName: req.user.name,
    role: req.user.role,
    action, entity, entityId, details,
    ip: req.ip,
  }).catch((e) => console.error('audit failed', e.message));
}
module.exports = audit;
