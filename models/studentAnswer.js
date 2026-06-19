const mongoose = require('mongoose');
const studentAnswerSchema = new mongoose.Schema({
  _id: String,
  examId: String,
  examName: String,
  attemptId: String,
  studentId: String,
  academicNo: String,
  questionId: String,
  questionNo: Number,
  topic: { _id: String, name: String },
  outcomes: [{ _id: String, code: String, name: String }],
  maxMarks: Number,
  marksScored: Number,
  isCorrect: Boolean
});
module.exports = mongoose.model('StudentAnswer', studentAnswerSchema);
