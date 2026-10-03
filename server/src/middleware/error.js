const { ZodError } = require('zod');
module.exports = {
  notFound: (req, res) => res.status(404).json({ message: 'Route not found' }),
  errorHandler(err, req, res, next) { // eslint-disable-line
    if (err instanceof ZodError) {
      return res.status(400).json({ message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), issues: err.issues });
    }
    if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join('; ') });
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier' });
    if (err.code === 11000) return res.status(409).json({ message: 'Duplicate value: ' + Object.keys(err.keyPattern || {}).join(', ') });
    if (err.name === 'MulterError' || err.message === 'Unsupported file type') return res.status(400).json({ message: err.message });
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ message: status === 500 ? 'Internal server error' : err.message });
  },
};
