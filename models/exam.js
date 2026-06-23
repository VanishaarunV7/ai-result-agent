const mongoose = require('mongoose');
const studentExamAttemptSchema = new mongoose.Schema({
  _id: String,
  examId: String,
  examName: String,
  studentId: String,
  academicNo: String,
  status: String,
  totalMarks: Number,
  marksScored: Number,
  percentage: Number,
  submittedAt: String
});
module.exports = mongoose.models.StudentExamAttempt || mongoose.model('StudentExamAttempt', studentExamAttemptSchema);