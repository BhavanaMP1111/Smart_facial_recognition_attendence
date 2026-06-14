const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  registerStudent,
  getStudents,
  getStudentById,
  getStudentFaceCache,
  updateStudent,
  deleteStudent,
  getStudentStats,
  promoteStudents,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Set up Multer file uploads in memory for optional face photo edit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Max 10MB photo
});

// Stats and promote endpoints (placed before /:id)
router.get('/stats', protect, getStudentStats);
router.post('/promote', protect, authorize('admin'), promoteStudents);

// General list, specific student, and Face Matching Cache
router.get('/', protect, getStudents);
router.get('/face-cache/all', protect, getStudentFaceCache);
router.get('/:id', protect, getStudentById);

// Admin-only write actions
router.post('/', protect, authorize('admin'), registerStudent);
router.put('/:id', protect, authorize('admin'), upload.single('photo'), updateStudent);
router.delete('/:id', protect, authorize('admin'), deleteStudent);

module.exports = router;
