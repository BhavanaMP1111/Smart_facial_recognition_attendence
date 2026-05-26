const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getAttendanceLogs,
  manualCorrection,
  getDashboardStats,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/mark', protect, markAttendance);
router.get('/logs', protect, getAttendanceLogs);
router.get('/dashboard/stats', protect, getDashboardStats);

// Manual overrides are restricted to Admin roles only
router.post('/manual', protect, authorize('admin'), manualCorrection);

module.exports = router;
