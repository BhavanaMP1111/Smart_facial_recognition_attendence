const express = require('express');
const router = express.Router();
const {
  logUnknownDetection,
  getUnknownDetections,
  dismissDetection,
  deleteDetection,
} = require('../controllers/unknownController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, logUnknownDetection);
router.get('/', protect, getUnknownDetections);
router.put('/:id/dismiss', protect, authorize('admin', 'teacher'), dismissDetection);
router.delete('/:id', protect, authorize('admin'), deleteDetection);

module.exports = router;
