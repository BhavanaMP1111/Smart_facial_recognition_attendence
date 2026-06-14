const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add student name'],
    trim: true,
  },
  usn: {
    type: String,
    required: [true, 'Please add student USN or Roll Number'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  department: {
    type: String,
    required: [true, 'Please specify department'],
    trim: true,
    enum: {
      values: ['CSE', 'ISE', 'CSE(AIML)', 'AIDS', 'ECE', 'EEE'],
      message: 'Invalid department: must be CSE, ISE, CSE(AIML), AIDS, ECE, or EEE'
    }
  },
  // Supporting both 'department' and 'dept' for seamless compatibility
  dept: {
    type: String,
    trim: true,
    enum: {
      values: ['CSE', 'ISE', 'CSE(AIML)', 'AIDS', 'ECE', 'EEE'],
      message: 'Invalid department: must be CSE, ISE, CSE(AIML), AIDS, ECE, or EEE'
    }
  },
  semester: {
    type: String,
    required: [true, 'Please specify semester'],
    trim: true,
  },
  section: {
    type: String,
    required: [true, 'Please specify section'],
    trim: true,
    uppercase: true,
    default: 'A'
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  // Store multiple face descriptors (each is a 128-dimensional array)
  faceDescriptors: {
    type: [[Number]],
    required: [true, 'At least one face sample descriptor is required'],
    validate: [
      (val) => val.length > 0,
      'Must contain at least one face descriptor array'
    ]
  },
  admissionYear: {
    type: Number,
    default: () => new Date().getFullYear(),
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook to ensure 'dept' and 'department' are synced
StudentSchema.pre('save', function(next) {
  if (this.department && !this.dept) {
    this.dept = this.department;
  } else if (this.dept && !this.department) {
    this.department = this.dept;
  }
  next();
});

module.exports = mongoose.model('Student', StudentSchema);
