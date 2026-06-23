const mongoose = require('mongoose');

const programSchema = new mongoose.Schema({
  program_id: { type: String, required: true, unique: true },
  program_name: { type: String, required: true },
  courses: [{ type: String }]
}, { collection: 'programs' });

module.exports = mongoose.model('Program', programSchema);
