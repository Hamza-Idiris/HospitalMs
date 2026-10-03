const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { HttpError, asyncH } = require('../utils/helpers');

// 1) Authentication + hospital status. Always re-reads the user so deactivation takes effect immediately.
const authenticate = asyncH(async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw new HttpError(401, 'Invalid or expired token'); }
  const user = await User.findById(payload.id).select('-passwordHash');
  if (!user || !user.isActive) throw new HttpError(401, 'Account not found or deactivated');
  if (user.hospitalId) {
    const hosp = await Hospital.findById(user.hospitalId).select('isActive');
    if (!hosp || !hosp.isActive) throw new HttpError(403, 'This hospital is deactivated');
  }
  req.user = user;
  req.hospitalId = user.hospitalId || null;
  next();
});

// 2) Role authorization
const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have permission for this action'));

// 3) Hospital isolation: operational routes require a hospital-bound user.
const requireHospital = (req, res, next) =>
  req.hospitalId ? next() : next(new HttpError(403, 'Hospital account required'));

module.exports = { authenticate, authorize, requireHospital };
