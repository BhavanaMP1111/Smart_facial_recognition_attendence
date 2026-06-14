const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const canvas = require('canvas');
const faceRecognitionService = require('../services/faceRecognitionService');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const fs = require('fs');
const path = require('path');

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

    const allowedDepts = ['CSE', 'ISE', 'CSE(AIML)', 'AIDS', 'ECE', 'EEE'];
    if (!allowedDepts.includes(department)) {
      return res.status(400).json({
        success: false,
        message: `Invalid department. Allowed departments: ${allowedDepts.join(', ')}`
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
      admissionYear: req.body.admissionYear || new Date().getFullYear(),
    });

    // Invalidate descriptor cache
    await faceRecognitionService.clearDescriptorCache();

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

    if (department && department !== 'All Departments') {
      query.department = department;
    }
    if (semester && semester !== 'All Semesters') {
      query.semester = semester;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { usn: { $regex: search, $options: 'i' } },
      ];
    }

    const count = await Student.countDocuments(query);
    let studentsQuery = Student.find(query).select('-faceDescriptors').sort({ name: 1 });

    let page = 1;
    let limit = 10;
    let pages = 1;

    if (req.query.page) {
      page = parseInt(req.query.page) || 1;
      limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      studentsQuery = studentsQuery.skip(skip).limit(limit);
      pages = Math.ceil(count / limit);
    }

    const students = await studentsQuery;

    res.json({
      success: true,
      count: students.length,
      total: count,
      page,
      pages,
      limit,
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
    const { name, usn, department, semester, faceDescriptors, admissionYear } = req.body;
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
    if (department) {
      const allowedDepts = ['CSE', 'ISE', 'CSE(AIML)', 'AIDS', 'ECE', 'EEE'];
      if (!allowedDepts.includes(department)) {
        return res.status(400).json({
          success: false,
          message: `Invalid department. Allowed departments: ${allowedDepts.join(', ')}`
        });
      }
      student.department = department;
    }
    if (semester) student.semester = semester;
    if (admissionYear) student.admissionYear = parseInt(admissionYear);
    if (faceDescriptors) {
      student.faceDescriptors = typeof faceDescriptors === 'string' ? JSON.parse(faceDescriptors) : faceDescriptors;
    }

    // Handle uploaded photo file
    if (req.file) {
      const descResult = await faceRecognitionService.extractEnrollmentDescriptor(req.file.buffer);
      if (!descResult.success) {
        return res.status(400).json({
          success: false,
          message: `Quality check failed: ${descResult.reason}`
        });
      }

      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const studentsDir = path.join(uploadsDir, 'students');
      if (!fs.existsSync(studentsDir)) {
        fs.mkdirSync(studentsDir, { recursive: true });
      }

      const finalUsn = student.usn;
      const destPhotoName = `${finalUsn}.jpg`;
      const destPhotoPath = path.join(studentsDir, destPhotoName);
      fs.writeFileSync(destPhotoPath, req.file.buffer);

      student.imageUrl = `/uploads/students/${destPhotoName}`;
      student.faceDescriptors = [descResult.descriptor];
    }

    await student.save();

    // Invalidate descriptor cache
    await faceRecognitionService.clearDescriptorCache();

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

    // Invalidate descriptor cache
    await faceRecognitionService.clearDescriptorCache();

    res.json({
      success: true,
      message: 'Student and associated attendance logs deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get student count and stats
 * @route   GET /api/students/stats
 * @access  Private
 */
const getStudentStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    
    // Get unique departments count
    const depts = await Student.distinct('department');
    const totalDepartments = depts.length;

    // Get today's attendance metrics
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = await Attendance.find({ date: todayStr });
    
    const presentCount = todayLogs.filter(log => log.status === 'Present' || log.status === 'Late').length;
    const attendancePercentage = totalStudents > 0
      ? Math.round((presentCount / totalStudents) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalStudents,
        totalDepartments,
        todayPresentCount: presentCount,
        todayAttendanceRate: attendancePercentage
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Bulk promote semesters for all students
 * @route   POST /api/students/promote
 * @access  Private (Admin Only)
 */
const promoteStudents = async (req, res) => {
  try {
    const students = await Student.find({});
    let promotedCount = 0;

    for (const student of students) {
      const currentSem = parseInt(student.semester);
      if (!isNaN(currentSem)) {
        if (currentSem < 8) {
          student.semester = (currentSem + 1).toString();
        } else {
          student.semester = 'Graduated';
        }
        await student.save();
        promotedCount++;
      }
    }

    // Invalidate descriptor cache after all promotions
    if (promotedCount > 0) {
      await faceRecognitionService.clearDescriptorCache();
    }

    res.json({
      success: true,
      message: `Successfully promoted ${promotedCount} students.`,
      data: { promotedCount }
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
  getStudentStats,
  promoteStudents,
};
