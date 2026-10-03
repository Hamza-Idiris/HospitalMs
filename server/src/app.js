const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/hospitals', require('./routes/hospitals'));
app.use('/api/users', require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/services', require('./routes/services'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/laboratory', require('./routes/laboratory'));
app.use('/api/xray', require('./routes/xray'));
app.use('/api/pharmacy', require('./routes/pharmacy'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api', require('./routes/misc')); // dashboard, audit-logs, notifications, files

app.use(notFound);
app.use(errorHandler);
module.exports = app;
