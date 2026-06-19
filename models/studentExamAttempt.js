const mongoose = require('mongoose');
const studentExamAttemptSchema = new mongoose.Schema({
  _id: String,
  studentId: String,
  examId: String,
  totalMarksScored: Number,
  totalMaxMarks: Number,
  percentage: Number,
  status: String
});
module.exports = mongoose.model('StudentExamAttempt', studentExamAttemptSchema);
