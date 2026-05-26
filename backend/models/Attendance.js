const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  // The calendar date of the attendance (formatted as YYYY-MM-DD or midnight Date)
  date: {
    type: String,
    required: true,
  },
  // The exact time attendance was checked
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Late'],
    default: 'Present',
  },
  markedBy: {
    type: String,
    default: 'webcam', // Can be 'webcam', 'manual', or an IoT device identifier
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 100, // 100 for manual entries
  },
});

// Enforce a unique check-in per student per calendar day
AttendanceSchema.index({ student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
