const mongoose = require('mongoose');

const ragDocumentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  subjectName: {
    type: String,
    default: 'Accounting'
  }
});

module.exports = mongoose.model('RagDocument', ragDocumentSchema);
