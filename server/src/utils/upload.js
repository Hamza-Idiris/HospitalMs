const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.dcm'];
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOAD_ROOT, String(req.hospitalId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase());
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter(req, file, cb) {
    const ok = allowed.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});
const toAttachment = (f) => ({ filename: f.filename, originalName: f.originalname, mimetype: f.mimetype, size: f.size });
module.exports = { upload, toAttachment, UPLOAD_ROOT };
