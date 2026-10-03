const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { authenticate } = require('../middleware/auth');
const { asyncH, HttpError } = require('../utils/helpers');
const audit = require('../utils/audit');
const r = express.Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { message: 'Too many login attempts. Try again later.' } });

r.post('/login', limiter, asyncH(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Incorrect email or password');
  if (!user.isActive) throw new HttpError(403, 'Account is deactivated');
  let hospital = null;
  if (user.hospitalId) {
    hospital = await Hospital.findById(user.hospitalId).select('name code isActive settings');
    if (!hospital || !hospital.isActive) throw new HttpError(403, 'This hospital is deactivated');
  }
  user.lastLoginAt = new Date(); await user.save();
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospitalId }, hospital });
}));

r.get('/me', authenticate, asyncH(async (req, res) => {
  const hospital = req.hospitalId ? await Hospital.findById(req.hospitalId).select('name code settings') : null;
  const u = req.user;
  res.json({ user: { id: u._id, name: u.name, email: u.email, role: u.role, hospitalId: u.hospitalId }, hospital });
}));

r.post('/change-password', authenticate, asyncH(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, 12); await user.save();
  audit(req, 'Changed own password', 'User', user._id);
  res.json({ message: 'Password updated' });
}));
module.exports = r;
