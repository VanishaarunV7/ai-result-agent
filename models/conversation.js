const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  conversationId: String,
  studentId: String,
  messages: [{
    role: String, // 'user' or 'assistant'
    content: String,
    timestamp: Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', conversationSchema);
