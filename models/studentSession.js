const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: String,
  studentId: String,
  academicNo: String,
  studentName: String,
  loginTime: Date,
  expiresAt: Date,
  isActive: Boolean
});

module.exports = mongoose.model('StudentSession', sessionSchema);
