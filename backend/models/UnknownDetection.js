const mongoose = require('mongoose');

const UnknownDetectionSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // URL to static folder snapshot of the face (or base64 encoding if local file writing fails)
  snapshotUrl: {
    type: String,
    required: true,
  },
  deviceId: {
    type: String,
    default: 'webcam',
  },
  confidence: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['unresolved', 'dismissed', 'registered'],
    default: 'unresolved',
  },
});

module.exports = mongoose.model('UnknownDetection', UnknownDetectionSchema);
