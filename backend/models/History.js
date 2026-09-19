const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  inputText: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
  aiResponse: {
    type: Object, // Will store the parsed JSON response from AI
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('History', historySchema);
