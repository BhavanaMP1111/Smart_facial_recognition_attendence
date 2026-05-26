const fs = require('fs');
const path = require('path');
const UnknownDetection = require('../models/UnknownDetection');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * @desc    Log a new unknown face detection snapshot
 * @route   POST /api/unknown
 * @access  Private
 */
const logUnknownDetection = async (req, res) => {
  try {
    const { imageBase64, deviceId, confidence } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Image payload is required' });
    }

    let snapshotUrl = '';

    try {
      // Clean base64 header if present
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      
      const fileName = `unknown_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}.jpg`;
      const filePath = path.join(uploadsDir, fileName);

      // Save buffer to uploads folder
      fs.writeFileSync(filePath, imageBuffer);
      snapshotUrl = `/uploads/${fileName}`;
      console.log(`📸 Unknown face snapshot saved: ${filePath}`);
    } catch (fsError) {
      console.warn('⚠️ File system write failed, falling back to direct base64 DB storage:', fsError.message);
      // Fallback: Store base64 data directly if file write fails (prevents server crashes)
      snapshotUrl = imageBase64.startsWith('data:image') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`;
    }

    const detection = await UnknownDetection.create({
      snapshotUrl,
      deviceId: deviceId || 'webcam',
      confidence: confidence || 0,
      status: 'unresolved',
    });

    res.status(201).json({
      success: true,
      message: 'Unknown face logged successfully',
      data: detection,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all unresolved unknown detections
 * @route   GET /api/unknown
 * @access  Private
 */
const getUnknownDetections = async (req, res) => {
  try {
    const detections = await UnknownDetection.find({ status: 'unresolved' }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      count: detections.length,
      data: detections,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Dismiss / Clear a security alert
 * @route   PUT /api/unknown/:id/dismiss
 * @access  Private
 */
const dismissDetection = async (req, res) => {
  try {
    const detection = await UnknownDetection.findById(req.params.id);

    if (!detection) {
      return res.status(404).json({ success: false, message: 'Detection record not found' });
    }

    detection.status = 'dismissed';
    await detection.save();

    res.json({
      success: true,
      message: 'Alert dismissed successfully',
      data: detection,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete detection alert and its static file from disk
 * @route   DELETE /api/unknown/:id
 * @access  Private
 */
const deleteDetection = async (req, res) => {
  try {
    const detection = await UnknownDetection.findById(req.params.id);

    if (!detection) {
      return res.status(404).json({ success: false, message: 'Detection record not found' });
    }

    // Try to delete local image file if applicable
    if (detection.snapshotUrl.startsWith('/uploads/')) {
      const fileName = detection.snapshotUrl.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Snapshot file deleted: ${filePath}`);
        } catch (err) {
          console.error(`⚠️ Failed to delete snapshot file: ${err.message}`);
        }
      }
    }

    await detection.deleteOne();

    res.json({
      success: true,
      message: 'Detection record deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  logUnknownDetection,
  getUnknownDetections,
  dismissDetection,
  deleteDetection,
};
