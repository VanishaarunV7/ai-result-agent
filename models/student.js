const mongoose = require('mongoose');
const studentSchema = new mongoose.Schema({
  _id: String,
  academicNo: String,
  name: String,
  program_id: String
});
module.exports = mongoose.model('Student', studentSchema);
