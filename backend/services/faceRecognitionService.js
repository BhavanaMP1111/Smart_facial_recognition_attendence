const path = require('path');
const fs = require('fs');
const tf = require('@tensorflow/tfjs');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const canvas = require('canvas');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;
const modelsPath = path.join(__dirname, '..', 'models_faceapi');

/**
 * Initializes face-api.js models in the Node backend.
 * This function loads the weights from disk.
 * @returns {Promise<boolean>} True if models loaded successfully, false otherwise.
 */
const initializeFaceRecognition = async () => {
  if (modelsLoaded) return true;

  try {
    console.log('🧠 [Face Service] Initializing face recognition models...');
    
    // Ensure TensorFlow backend is ready before calling any methods
    await tf.ready();
    
    // Validate that model files exist on disk
    const requiredFiles = [
      'ssd_mobilenetv1_model-weights_manifest.json',
      'tiny_face_detector_model-weights_manifest.json',
      'face_landmark_68_model-weights_manifest.json',
      'face_recognition_model-weights_manifest.json'
    ];

    const missing = requiredFiles.filter(file => !fs.existsSync(path.join(modelsPath, file)));
    if (missing.length > 0) {
      console.warn(`⚠️  [Face Service] Missing weights files: ${missing.join(', ')}`);
      console.warn(`⚠️  Please run 'npm run download-models' to fetch weights.`);
      return false;
    }

    // Load networks
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

    modelsLoaded = true;
    console.log('🧠 [Face Service] Neural networks initialized and cached successfully!');
    return true;
  } catch (error) {
    console.error('❌ [Face Service] Failed during initialization:', error);
    return false;
  }
};

// Keep loadModels for backward compatibility
const loadModels = async () => {
  return await initializeFaceRecognition();
};

/**
 * Detects and matches face descriptors against enrolled students.
 * @param {Buffer} imageBuffer - Image payload buffer
 * @param {Array} enrolledStudents - List of enrolled student records from DB
 * @param {number} distanceThreshold - Euclidean distance threshold (stricter <= 0.6)
 * @returns {Promise<Object>} Matches details
 */
const recognizeFacesInImage = async (imageBuffer, enrolledStudents, distanceThreshold = 0.55) => {
  const isReady = await initializeFaceRecognition();
  if (!isReady) {
    throw new Error('Face-API models are not loaded. Download them using npm run download-models.');
  }

  try {
    const img = await canvas.loadImage(imageBuffer);
    const detections = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return { count: 0, matches: [] };
    }

    const labeledDescriptors = [];
    enrolledStudents.forEach(student => {
      if (student.faceDescriptors && student.faceDescriptors.length > 0) {
        const float32Descriptors = student.faceDescriptors.map(desc => new Float32Array(desc));
        labeledDescriptors.push(
          new faceapi.LabeledFaceDescriptors(
            student._id.toString(),
            float32Descriptors
          )
        );
      }
    });

    if (labeledDescriptors.length === 0) {
      return {
        count: detections.length,
        matches: detections.map(det => ({
          label: 'unknown',
          distance: 1.0,
          box: det.detection.box,
          descriptor: Array.from(det.descriptor)
        }))
      };
    }

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, distanceThreshold);
    const matches = detections.map(det => {
      const bestMatch = faceMatcher.findBestMatch(det.descriptor);
      const label = bestMatch.label;
      const distance = bestMatch.distance;
      const confidence = Math.round((1 - distance) * 100);

      let studentDetails = null;
      if (label !== 'unknown') {
        const found = enrolledStudents.find(s => s._id.toString() === label);
        if (found) {
          studentDetails = {
            id: found._id,
            name: found.name,
            usn: found.usn,
            department: found.department,
            semester: found.semester
          };
        }
      }

      return {
        label,
        distance,
        confidence: confidence < 0 ? 0 : confidence,
        box: det.detection.box,
        student: studentDetails,
        descriptor: Array.from(det.descriptor)
      };
    });

    return {
      count: detections.length,
      matches
    };
  } catch (error) {
    console.error('❌ [Face Service] Error recognizing faces:', error);
    throw error;
  }
};

module.exports = {
  initializeFaceRecognition,
  loadModels,
  recognizeFacesInImage
};
