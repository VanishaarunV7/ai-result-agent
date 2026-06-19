const mongoose = require('mongoose');
const outcomeSchema = new mongoose.Schema({
  _id: String,
  code: String,
  name: String
});
module.exports = mongoose.model('Outcome', outcomeSchema);
