const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const UnknownDetection = require('../models/UnknownDetection');
const faceRecognitionService = require('../services/faceRecognitionService');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads');

/**
 * @desc    Process incoming IoT camera image frame for server-side recognition & attendance marking
 * @route   POST /api/iot/attendance
 * @access  Public (Can be protected with a custom device API key header for production security)
 */
const processIotFrame = async (req, res) => {
  try {
    const { deviceId } = req.body;
    let imageBuffer = null;
    let sourceBase64 = null;

    const activeDeviceId = deviceId || req.headers['x-device-id'] || 'esp32_cam_node';

    // 1. Resolve image source: Supports either multipart file upload (req.file) or base64 JSON payload
    if (req.file) {
      imageBuffer = req.file.buffer;
      sourceBase64 = req.file.buffer.toString('base64');
    } else if (req.body.imageBase64) {
      sourceBase64 = req.body.imageBase64;
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    }

    if (!imageBuffer) {
      return res.status(400).json({
        success: false,
        message: 'No image frame provided. Please upload an image file or supply a base64 string.'
      });
    }

    // 2. Fetch all enrolled students from memory cache instead of querying database on every request
    const enrolledStudents = await faceRecognitionService.getCachedEnrolledStudents();
    if (enrolledStudents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No students enrolled in the system database yet. Skipping matching.',
        results: { count: 0, matches: [] }
      });
    }

    // 3. Perform server-side Face Detection and Vector Matching
    // Distance threshold: 0.55 (Euclidean distance. Lower means stricter matching)
    let recognitionResults;
    try {
      recognitionResults = await faceRecognitionService.recognizeFacesInImage(imageBuffer, enrolledStudents, 0.55);
    } catch (modelErr) {
      return res.status(500).json({
        success: false,
        message: `Face Recognition Service Error: ${modelErr.message}. Ensure face-api models are downloaded.`
      });
    }

    const { count, matches } = recognitionResults;

    if (count === 0) {
      return res.json({
        success: true,
        message: 'No faces detected in the camera frame.',
        results: { count: 0, matches: [] }
      });
    }

    const processedMatches = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // 4. Iterate matches to register attendance or raise security warnings
    for (const match of matches) {
      // Print detailed recognition metrics to server logs
      if (match.label !== 'unknown' && match.student) {
        console.log(`🧠 [IoT Recognition Debug] Student Matched: ${match.student.name} (${match.student.usn}) | Similarity Score (Euclidean Distance): ${match.distance.toFixed(4)} | Confidence: ${match.confidence}%`);
      } else {
        console.log(`🧠 [IoT Recognition Debug] Match Failed: Face detected but classified as UNKNOWN | Confidence: ${match.confidence}%`);
      }

      if (match.label !== 'unknown' && match.student && match.distance <= 0.50) {
        // Registered Student Detected
        const studentId = match.student.id;
        
        // Prevent duplicate attendance for the same student on the same day
        const existingAttendance = await Attendance.findOne({
          student: studentId,
          date: todayStr
        });

        let attendanceRecord = null;
        let markStatus = 'already_marked';

        if (!existingAttendance) {
          attendanceRecord = await Attendance.create({
            student: studentId,
            date: todayStr,
            status: 'Present',
            markedBy: `iot_${activeDeviceId}`,
            confidence: match.confidence
          });
          markStatus = 'marked_present';
          console.log(`📡 IoT Check-In: Marked ${match.student.name} (${match.student.usn}) present via ${activeDeviceId}`);
        }

        processedMatches.push({
          status: markStatus,
          name: match.student.name,
          usn: match.student.usn,
          confidence: match.confidence,
          attendance: attendanceRecord
        });
      } else {
        // Unknown Person Detected! Log snapshot as alert warning
        let snapshotUrl = '';
        try {
          const fileName = `iot_unknown_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}.jpg`;
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, imageBuffer);
          snapshotUrl = `/uploads/${fileName}`;
        } catch (fsErr) {
          snapshotUrl = sourceBase64.startsWith('data:image') 
            ? sourceBase64 
            : `data:image/jpeg;base64,${sourceBase64}`;
        }

        const alertRecord = await UnknownDetection.create({
          snapshotUrl,
          deviceId: `iot_${activeDeviceId}`,
          confidence: match.confidence,
          status: 'unresolved'
        });

        console.log(`🚨 IoT Alert: Unknown face logged on device ${activeDeviceId}`);

        processedMatches.push({
          status: 'unknown_alert_raised',
          confidence: match.confidence,
          alertId: alertRecord._id
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${count} face(s) from IoT device successfully`,
      results: {
        totalFaces: count,
        matches: processedMatches
      }
    });
  } catch (error) {
    console.error('❌ IoT controller error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  processIotFrame
};
