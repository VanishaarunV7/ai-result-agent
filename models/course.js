const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  _id: String,
  courseId: String,
  name: String
});

module.exports = mongoose.model('Course', courseSchema);
