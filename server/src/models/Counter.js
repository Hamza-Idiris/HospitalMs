const mongoose = require('mongoose');
const s = new mongoose.Schema({ hospitalId: { type: mongoose.Schema.Types.ObjectId, default: null }, key: { type: String, required: true }, seq: { type: Number, default: 0 } });
s.index({ hospitalId: 1, key: 1 }, { unique: true });
module.exports = mongoose.model('Counter', s);
