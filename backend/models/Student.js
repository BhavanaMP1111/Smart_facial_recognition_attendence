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
  // Supporting both 'department' and 'dept' for seamless compatibility
  department: {
    type: String,
    required: [true, 'Please specify department'],
    trim: true,
  },
  dept: {
    type: String,
    trim: true,
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
