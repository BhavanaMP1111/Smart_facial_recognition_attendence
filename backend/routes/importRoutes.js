const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importStudents } = require('../controllers/importController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Set up Multer file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // Max 100MB ZIP upload limit
});

// Admin-only bulk student spreadsheet + photos import endpoint
router.post(
  '/',
  protect,
  authorize('admin'),
  upload.fields([
    { name: 'excel', maxCount: 1 },
    { name: 'zip', maxCount: 1 }
  ]),
  importStudents
);

module.exports = router;
