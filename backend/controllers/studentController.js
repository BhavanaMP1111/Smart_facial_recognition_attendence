const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

/**
 * @desc    Register a new student with face descriptors
 * @route   POST /api/students
 * @access  Private
 */
const registerStudent = async (req, res) => {
  try {
    const { name, usn, department, semester, faceDescriptors } = req.body;

    if (!name || !usn || !department || !semester || !faceDescriptors) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all details: name, usn, department, semester, and faceDescriptors',
      });
    }

    // Check if student with same USN exists
    const studentExists = await Student.findOne({ usn: usn.toUpperCase() });
    if (studentExists) {
      return res.status(400).json({
        success: false,
        message: `Student with USN/Roll Number '${usn}' already registered`,
      });
    }

    // Create student
    const student = await Student.create({
      name,
      usn: usn.toUpperCase(),
      department,
      semester,
      faceDescriptors,
    });

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: student,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all registered students (with optional filters)
 * @route   GET /api/students
 * @access  Private
 */
const getStudents = async (req, res) => {
  try {
    const { department, semester, search } = req.query;
    let query = {};

    if (department) {
      query.department = department;
    }
    if (semester) {
      query.semester = semester;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { usn: { $regex: search, $options: 'i' } },
      ];
    }

    // Exclude faceDescriptors in general listing to keep payloads light
    const students = await Student.find(query).select('-faceDescriptors').sort({ name: 1 });

    res.json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get a single student details including face descriptors (useful for face-matching sync)
 * @route   GET /api/students/:id
 * @access  Private
 */
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all students with face descriptors (critical for loading browser-side face-matcher cache)
 * @route   GET /api/students/face-cache/all
 * @access  Private
 */
const getStudentFaceCache = async (req, res) => {
  try {
    const students = await Student.find({}).select('name usn department semester faceDescriptors');
    res.json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update student details
 * @route   PUT /api/students/:id
 * @access  Private
 */
const updateStudent = async (req, res) => {
  try {
    const { name, usn, department, semester, faceDescriptors } = req.body;
    let student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check if modifying USN and it collides
    if (usn && usn.toUpperCase() !== student.usn) {
      const usnExists = await Student.findOne({ usn: usn.toUpperCase() });
      if (usnExists) {
        return res.status(400).json({
          success: false,
          message: `USN/Roll Number '${usn}' is already registered to another student`,
        });
      }
      student.usn = usn.toUpperCase();
    }

    if (name) student.name = name;
    if (department) student.department = department;
    if (semester) student.semester = semester;
    if (faceDescriptors) student.faceDescriptors = faceDescriptors;

    await student.save();

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: student,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete student and their attendance records
 * @route   DELETE /api/students/:id
 * @access  Private
 */
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Delete associated attendance records
    await Attendance.deleteMany({ student: student._id });
    
    // Delete student
    await student.deleteOne();

    res.json({
      success: true,
      message: 'Student and associated attendance logs deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerStudent,
  getStudents,
  getStudentById,
  getStudentFaceCache,
  updateStudent,
  deleteStudent,
};
