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

    // Load networks in parallel for faster startup
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath),
      faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
    ]);

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

const getEuclideanDistance = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
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

  if (score < 0.80) {
    return {
      success: false,
      reason: `Photo quality too low (Confidence score: ${Math.round(score * 100)}%). Ensure image is sharp and well-lit.`
    };
  }

  if (width < 80 || height < 80) {
    return {
      success: false,
      reason: `Face resolution is too low (${Math.round(width)}x${Math.round(height)}px). Face box must be at least 80x80px.`
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
 * @param {number} distanceThreshold - Default Euclidean distance threshold (stricter <= 0.48)
 * @returns {Promise<Object>} Matches details
 */
const recognizeFacesInImage = async (imageBuffer, enrolledStudentsPassed = null, distanceThreshold = 0.48) => {
  const isReady = await initializeFaceRecognition();
  if (!isReady) {
    throw new Error('Face-API models are not loaded. Download them using npm run download-models.');
  }

  try {
    const img = await canvas.loadImage(imageBuffer);
    
    // Detect multiple faces in the frame for multi-student support
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return { count: 0, matches: [] };
    }

    const currentEnrolled = enrolledStudentsPassed || await getCachedEnrolledStudents();

    const matches = detections.map(det => {
      const { width, height } = det.detection.box;

      // 1. Check if the face is too far / small (width/height < 60px)
      if (width < 60 || height < 60) {
        return {
          label: 'move-closer',
          distance: 1.0,
          confidence: 0,
          box: det.detection.box,
          student: null,
          status: 'move-closer'
        };
      }

      if (!currentEnrolled || currentEnrolled.length === 0) {
        return {
          label: 'unknown',
          distance: 1.0,
          confidence: 0,
          box: det.detection.box,
          student: null,
          status: 'unknown'
        };
      }

      // 2. Perform manual Euclidean distance matching
      const studentDistances = [];
      
      currentEnrolled.forEach(student => {
        if (student.faceDescriptors && student.faceDescriptors.length > 0) {
          let minDistance = 1.0;
          student.faceDescriptors.forEach(desc => {
            const dist = getEuclideanDistance(det.descriptor, desc);
            if (dist < minDistance) {
              minDistance = dist;
            }
          });
          studentDistances.push({
            student,
            distance: minDistance
          });
        }
      });

      if (studentDistances.length === 0) {
        return {
          label: 'unknown',
          distance: 1.0,
          confidence: 0,
          box: det.detection.box,
          student: null,
          status: 'unknown'
        };
      }

      // Sort distances ascending
      studentDistances.sort((a, b) => a.distance - b.distance);

      const bestMatch = studentDistances[0];
      const secondBestMatch = studentDistances.length > 1 ? studentDistances[1] : null;

      const bestName = bestMatch.student.name;
      const bestDistance = bestMatch.distance;
      const secondBestName = secondBestMatch ? secondBestMatch.student.name : 'None';
      const secondBestDistance = secondBestMatch ? secondBestMatch.distance : 1.0;

      // Print debug logs exactly as requested:
      console.log(`\n🔍 [Face Matcher Debug]`);
      console.log(`Best Match:`);
      console.log(`${bestName}`);
      console.log(`Distance:`);
      console.log(`${bestDistance.toFixed(4)}`);
      if (secondBestMatch) {
        console.log(`Second Best:`);
        console.log(`${secondBestName}`);
        console.log(`Distance:`);
        console.log(`${secondBestDistance.toFixed(4)}`);
      }
      console.log(`-----------------------------------`);

      // 3. Strict match checking
      const SAFE_DISTANCE_THRESHOLD = distanceThreshold; // Default is 0.48
      const AMBIGUITY_MARGIN = 0.10;

      if (bestDistance > SAFE_DISTANCE_THRESHOLD) {
        return {
          label: 'unknown',
          distance: bestDistance,
          confidence: 0,
          box: det.detection.box,
          student: null,
          status: 'unknown'
        };
      }

      if (secondBestMatch && (secondBestDistance - bestDistance) < AMBIGUITY_MARGIN) {
        console.log(`⚠️ Match rejected due to AMBIGUITY (Difference: ${(secondBestDistance - bestDistance).toFixed(4)} < ${AMBIGUITY_MARGIN})`);
        return {
          label: 'ambiguous',
          distance: bestDistance,
          confidence: 0,
          box: det.detection.box,
          student: null,
          status: 'ambiguous'
        };
      }

      // Clear Match!
      let studentDetails = {
        id: bestMatch.student._id || bestMatch.student.id,
        name: bestMatch.student.name,
        usn: bestMatch.student.usn,
        department: bestMatch.student.department,
        semester: bestMatch.student.semester
      };

      return {
        label: studentDetails.id.toString(),
        distance: bestDistance,
        confidence: Math.round((1 - bestDistance) * 100),
        box: det.detection.box,
        student: studentDetails,
        status: 'matched'
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
