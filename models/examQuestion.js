const mongoose = require('mongoose');
const examQuestionSchema = new mongoose.Schema({
  _id: String,
  examId: String,
  questionNo: Number,
  topic: { _id: String, name: String },
  outcomes: [{ _id: String, code: String, name: String }],
  maxMarks: Number
});
module.exports = mongoose.model('ExamQuestion', examQuestionSchema);
