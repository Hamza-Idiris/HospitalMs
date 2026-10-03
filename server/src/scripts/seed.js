require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const Department = require('../models/Department');
const Service = require('../models/Service');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const hash = (p) => bcrypt.hash(p, 12);
  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@hms.local').toLowerCase();
  if (!(await User.findOne({ email: adminEmail }))) {
    await User.create({ name: process.env.SUPER_ADMIN_NAME || 'Platform Admin', email: adminEmail, role: 'super_admin', passwordHash: await hash(process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345') });
    console.log('Super admin created:', adminEmail);
  }
  if (process.argv.includes('--demo')) {
    let h = await Hospital.findOne({ code: 'DEMO' });
    if (!h) {
      h = await Hospital.create({ name: 'Demo General Hospital', code: 'DEMO', address: 'Mogadishu, Somalia', phone: '+252 61 000 0000' });
      const depts = {};
      for (const n of ['General Medicine', 'Orthopedics', 'Pediatrics', 'Gynecology', 'Cardiology', 'Dental']) depts[n] = await Department.create({ hospitalId: h._id, name: n });
      const services = [['Registration', 'registration', 1], ['Consultation', 'consultation', 10], ['CBC', 'laboratory', 8], ['Blood Sugar', 'laboratory', 3], ['Malaria Test', 'laboratory', 4], ['Liver Function Test', 'laboratory', 12], ['Chest X-Ray', 'xray', 15], ['Knee X-Ray', 'xray', 15], ['Spine X-Ray', 'xray', 18], ['Ultrasound', 'xray', 20]];
      for (const [name, category, price] of services) await Service.create({ hospitalId: h._id, name, category, price, priceHistory: [{ price }] });
      const pw = await hash('Password@123');
      const staff = [['Hospital Manager', 'manager@demo.local', 'manager'], ['Hassan Cashier', 'cashier@demo.local', 'cashier'],
        ['Dr. Mohamed Ali', 'doctor@demo.local', 'doctor', depts['Orthopedics']._id], ['Dr. Fadumo Nur', 'doctor2@demo.local', 'doctor', depts['General Medicine']._id],
        ['Lab User', 'lab@demo.local', 'lab'], ['Xray User', 'xray@demo.local', 'xray'], ['Pharmacy User', 'pharmacy@demo.local', 'pharmacist']];
      for (const [name, email, role, departmentId] of staff) await User.create({ hospitalId: h._id, name, email, role, departmentId, passwordHash: pw });
      console.log('Demo hospital created. All demo users use password: Password@123');
      console.log(staff.map((s) => `  ${s[2].padEnd(13)} ${s[1]}`).join('\n'));
    } else console.log('Demo hospital already exists');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
