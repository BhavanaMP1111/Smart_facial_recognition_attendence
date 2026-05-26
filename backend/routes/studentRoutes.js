const express = require('express');
const router = express.Router();
const {
  registerStudent,
  getStudents,
  getStudentById,
  getStudentFaceCache,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// General list, specific student, and Face Matching Cache
router.get('/', protect, getStudents);
router.get('/face-cache/all', protect, getStudentFaceCache);
router.get('/:id', protect, getStudentById);

// Admin-only write actions
router.post('/', protect, authorize('admin'), registerStudent);
router.put('/:id', protect, authorize('admin'), updateStudent);
router.delete('/:id', protect, authorize('admin'), deleteStudent);

module.exports = router;
