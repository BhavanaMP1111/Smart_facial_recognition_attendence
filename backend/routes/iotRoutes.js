const express = require('express');
const router = express.Router();
const multer = require('multer');
const { processIotFrame } = require('../controllers/iotController');

// Multer memory storage configuration for receiving frames in memory buffers
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB image uploads
});

// IoT endpoint for ESP32-CAM or Raspberry Pi (Public, but recommended to secure with headers in prod)
// Accepts key 'image' for multipart/form-data files, or reads 'imageBase64' from JSON bodies
router.post('/attendance', upload.single('image'), processIotFrame);

module.exports = router;
