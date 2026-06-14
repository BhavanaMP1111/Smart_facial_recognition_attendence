const path = require('path');
const fs = require('fs');
const tf = require('@tensorflow/tfjs');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const canvas = require('canvas');
const Student = require('../models/Student');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;
const modelsPath = path.join(__dirname, '..', 'models_faceapi');

// Memory cache variables
let cachedEnrolledStudents = null;
let cachedFaceMatcher = null;

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
    console.log('🧠 [Face Service] Neural networks initialized successfully!');
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
 * Preloads all enrolled student descriptors from database into memory.
 */
const loadDescriptorCache = async () => {
  try {
    console.log('🧠 [Face Service] Seeding in-memory face descriptor cache from database...');
    const enrolledStudents = await Student.find({}).select('name usn department semester faceDescriptors');
    cachedEnrolledStudents = enrolledStudents;

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

    if (labeledDescriptors.length > 0) {
      // Create matcher with default Euclidean distance threshold
      cachedFaceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
      console.log(`🧠 [Face Service] Loaded ${labeledDescriptors.length} students into memory cache.`);
    } else {
      cachedFaceMatcher = null;
      console.log('🧠 [Face Service] No students with face descriptors found. Cache is empty.');
    }
  } catch (err) {
    console.error('❌ [Face Service] Error loading descriptor cache:', err);
  }
};

/**
 * Clears memory cache and re-fetches descriptors from database.
 */
const clearDescriptorCache = async () => {
  cachedEnrolledStudents = null;
  cachedFaceMatcher = null;
  await loadDescriptorCache();
};

/**
 * Retrieves the cached face matcher, loading it if empty.
 */
const getFaceMatcher = async () => {
  if (!cachedFaceMatcher) {
    await loadDescriptorCache();
  }
  return cachedFaceMatcher;
};

/**
 * Retrieves the cached students list, loading it if empty.
 */
const getCachedEnrolledStudents = async () => {
  if (!cachedEnrolledStudents) {
    await loadDescriptorCache();
  }
  return cachedEnrolledStudents;
};

/**
 * Validates face quality and extracts a single high-quality descriptor array.
 * @param {Buffer} imageBuffer - Raw photo buffer
 * @returns {Promise<Object>} Object containing { success: boolean, descriptor: Array, reason: string }
 */
const extractEnrollmentDescriptor = async (imageBuffer) => {
  await initializeFaceRecognition();
  const img = await canvas.loadImage(imageBuffer);

  // 1. Try SsdMobilenetv1 first (higher accuracy & better landmarks for passport photos)
  let detection = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  // 2. Fallback to Tiny Face Detector
  if (!detection) {
    detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
  }

  if (!detection) {
    return { success: false, reason: 'No face detected in the photo' };
  }

  // 3. Quality checks
  const score = detection.detection.score;
  const { width, height } = detection.detection.box;

  if (score < 0.75) {
    return {
      success: false,
      reason: `Photo quality too low (Confidence score: ${Math.round(score * 100)}%). Ensure image is sharp and well-lit.`
    };
  }

  if (width < 60 || height < 60) {
    return {
      success: false,
      reason: `Face resolution is too low (${Math.round(width)}x${Math.round(height)}px). Face box must be at least 60x60px.`
    };
  }

  return {
    success: true,
    descriptor: Array.from(detection.descriptor)
  };
};

/**
 * Detects and matches face descriptors against enrolled students using memory cache.
 * @param {Buffer} imageBuffer - Image payload buffer
 * @param {Array} enrolledStudentsPassed - Optional override list of students
 * @param {number} distanceThreshold - Euclidean distance threshold (stricter <= 0.6)
 * @returns {Promise<Object>} Matches details
 */
const recognizeFacesInImage = async (imageBuffer, enrolledStudentsPassed = null, distanceThreshold = 0.55) => {
  const isReady = await initializeFaceRecognition();
  if (!isReady) {
    throw new Error('Face-API models are not loaded. Download them using npm run download-models.');
  }

  try {
    const img = await canvas.loadImage(imageBuffer);
    
    // Detect multiple faces in the frame for multi-student support
    const detections = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return { count: 0, matches: [] };
    }

    let faceMatcher = cachedFaceMatcher;
    let currentEnrolled = cachedEnrolledStudents;

    // Build matcher on the fly only if cache is empty or overridden
    if (!faceMatcher || enrolledStudentsPassed) {
      const activeStudents = enrolledStudentsPassed || await Student.find({}).select('name usn department semester faceDescriptors');
      const labeledDescriptors = [];
      activeStudents.forEach(student => {
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
      
      if (labeledDescriptors.length > 0) {
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, distanceThreshold);
        currentEnrolled = activeStudents;
      }
    }

    if (!faceMatcher) {
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

    const matches = detections.map(det => {
      const bestMatch = faceMatcher.findBestMatch(det.descriptor);
      const label = bestMatch.label;
      const distance = bestMatch.distance;
      
      // Realistic confidence rating mapping (distance <= 0.50 maps 100%-90%, 0.50-0.70 maps 90%-0%)
      let confidence = 0;
      if (distance <= 0.50) {
        confidence = Math.round(100 - (distance * 20));
      } else {
        confidence = Math.round(Math.max(0, 90 - (distance - 0.50) * 450));
      }

      let studentDetails = null;
      if (label !== 'unknown') {
        const found = currentEnrolled.find(s => s._id.toString() === label);
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
  recognizeFacesInImage,
  loadDescriptorCache,
  clearDescriptorCache,
  getFaceMatcher,
  getCachedEnrolledStudents,
  extractEnrollmentDescriptor
};
