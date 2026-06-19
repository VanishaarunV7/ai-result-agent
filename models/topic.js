const mongoose = require('mongoose');
const topicSchema = new mongoose.Schema({
  _id: String,
  name: String
});
module.exports = mongoose.model('Topic', topicSchema);
