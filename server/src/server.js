require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET must be set (16+ characters). See .env.example');
  process.exit(1);
}
connectDB().then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`HMS API listening on :${port}`));
}).catch((e) => { console.error('Failed to start:', e.message); process.exit(1); });
