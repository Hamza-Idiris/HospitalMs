class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pad = (n, l = 6) => String(n).padStart(l, '0');
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const ageFromDob = (dob) => {
  const d = new Date(dob); const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return Math.max(a, 0);
};
module.exports = { HttpError, asyncH, round2, escapeRegex, pad, startOfDay, endOfDay, ageFromDob };
