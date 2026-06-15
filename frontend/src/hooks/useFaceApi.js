import { useState, useCallback, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';

// Helper for Euclidean distance calculation
const getEuclideanDistance = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

// Helper for Standard Deviation calculation
const stdDev = (arr) => {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
};

export const useFaceApi = () => {
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const enrolledStudentsRef = useRef([]);
  
  // Track active faces across frames to verify liveness and track IDs
  const faceTrackerRef = useRef(new Map());

  // Load models from public/models folder
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true;
    setLoading(true);
    try {
      console.log('🤖 Loading face-api.js neural networks in parallel...');
      
      // Load networks concurrently using Promise.all for fast startup
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      
      setModelsLoaded(true);
      console.log('🤖 Face-api.js networks loaded successfully!');
      setLoading(false);
      return true;
    } catch (error) {
      console.error('❌ Failed to load face-api.js models:', error);
      setLoading(false);
      return false;
    }
  }, [modelsLoaded]);

  // Compile student profiles into a local cache
  const initFaceMatcher = useCallback((studentsList) => {
    if (!studentsList) return;
    enrolledStudentsRef.current = studentsList;
    console.log(`🧠 Local enrolled students cache loaded: ${studentsList.length}`);
  }, []);

  // Detect and recognize faces in a video element
  const detectAndRecognize = useCallback(async (videoElement, canvasElement = null, minConfidence = 90) => {
    if (!modelsLoaded || !videoElement) return [];

    try {
      // Setup detection options (higher inputSize: 320 to reliably find distant/small faces)
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.4,
      });

      // Detect all faces in video frame with landmarks and descriptors
      const detections = await faceapi
        .detectAllFaces(videoElement, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      const activeTracker = faceTrackerRef.current;
      const currentIds = new Set();
      const startTime = Date.now();

      // Match detections to enrolled students
      const results = detections.map((det) => {
        const { x, y, width, height } = det.detection.box;
        const center = { x: x + width / 2, y: y + height / 2 };

        // 1. Track face across frames
        let matchedTrackerId = null;
        let minTrackerDist = 120; // Max distance in pixels to consider it the same face

        for (const [id, track] of activeTracker.entries()) {
          const dist = Math.hypot(center.x - track.center.x, center.y - track.center.y);
          if (dist < minTrackerDist) {
            minTrackerDist = dist;
            matchedTrackerId = id;
          }
        }

        let trackData;
        if (matchedTrackerId !== null) {
          trackData = activeTracker.get(matchedTrackerId);
          trackData.center = center;
          trackData.box = det.detection.box;
          trackData.lastSeen = Date.now();
          trackData.frameCount += 1;
        } else {
          matchedTrackerId = `face_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          trackData = {
            id: matchedTrackerId,
            center,
            box: det.detection.box,
            lastSeen: Date.now(),
            frameCount: 1,
            earHistory: [],
            hrHistory: [],
            vrHistory: [],
            livenessStatus: 'checking',
            studentId: null,
            distance: 1.0,
            secondBestDistance: 1.0,
            secondBestName: 'None',
            confidence: 0,
            matchedStudent: null
          };
          activeTracker.set(matchedTrackerId, trackData);
        }

        currentIds.add(matchedTrackerId);

        // 2. Calculate Liveness metrics
        const landmarks = det.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        // Calculate Eye Aspect Ratio (EAR)
        const calculateEAR = (eye) => {
          const p1 = eye[0], p2 = eye[1], p3 = eye[2], p4 = eye[3], p5 = eye[4], p6 = eye[5];
          const dist1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
          const dist2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
          const dist3 = Math.hypot(p1.x - p4.x, p1.y - p4.y);
          return dist3 === 0 ? 0 : (dist1 + dist2) / (2.0 * dist3);
        };

        const ear = (calculateEAR(leftEye) + calculateEAR(rightEye)) / 2;
        trackData.earHistory.push(ear);
        if (trackData.earHistory.length > 15) trackData.earHistory.shift();

        // Calculate head pose symmetry ratios
        const noseTip = landmarks.positions[30];
        const leftInner = leftEye[3];
        const rightInner = rightEye[0];
        const mouthPoints = landmarks.getMouth();
        const mouthCenter = mouthPoints[14] || mouthPoints[0];

        const leftEyeToNoseDist = Math.hypot(leftInner.x - noseTip.x, leftInner.y - noseTip.y);
        const rightEyeToNoseDist = Math.hypot(rightInner.x - noseTip.x, rightInner.y - noseTip.y);
        const horizontalRatio = leftEyeToNoseDist / (rightEyeToNoseDist || 1.0);
        trackData.hrHistory.push(horizontalRatio);
        if (trackData.hrHistory.length > 15) trackData.hrHistory.shift();

        const eyeToEyeDist = Math.hypot(leftInner.x - rightInner.x, leftInner.y - rightInner.y);
        const noseToMouthDist = Math.hypot(noseTip.x - mouthCenter.x, noseTip.y - mouthCenter.y);
        const verticalRatio = noseToMouthDist / (eyeToEyeDist || 1.0);
        trackData.vrHistory.push(verticalRatio);
        if (trackData.vrHistory.length > 15) trackData.vrHistory.shift();

        // Evaluate Liveness (Anti-Spoofing) after collecting enough frames
        if (trackData.earHistory.length >= 4) {
          const earStd = stdDev(trackData.earHistory);
          const hrStd = stdDev(trackData.hrHistory);
          const vrStd = trackData.vrHistory.length >= 2 ? stdDev(trackData.vrHistory) : 0;

          const minEar = Math.min(...trackData.earHistory);
          const maxEar = Math.max(...trackData.earHistory);
          
          // Blink is a sudden significant reduction of EAR (closed eye) followed by restoration
          const blinkDetected = (minEar <= 0.22 && maxEar >= 0.26 && (maxEar - minEar) >= 0.04);
          
          // Natural human faces present micro-variations even when trying to stay still
          const hasEyeMovement = earStd > 0.003;
          const hasHeadMovement = hrStd > 0.004 || vrStd > 0.004;

          if (blinkDetected || (hasEyeMovement && hasHeadMovement)) {
            trackData.livenessStatus = 'real';
          } else if (trackData.frameCount >= 12 && !hasEyeMovement && !hasHeadMovement) {
            // Rigid body detection (printed photos or static device presentations show zero variance)
            trackData.livenessStatus = 'spoof';
          }
        }

        // 3. Match Face Descriptor (skip/return appropriate label if spoofing or sizing issues)
        let label = 'checking-liveness';
        let matchedStudent = trackData.matchedStudent;
        let distance = trackData.distance;
        let confidence = trackData.confidence;
        let secondBestDistance = trackData.secondBestDistance;
        let secondBestName = trackData.secondBestName;

        if (trackData.livenessStatus === 'spoof') {
          label = 'spoof';
        } else if (width < 60 || height < 60) {
          label = 'move-closer';
        } else {
          // Frame-skip optimization: Reuse previous match results if tracked to reduce CPU load
          // Recompute matching vector only once every 6 frames or if never computed
          if (trackData.studentId && trackData.frameCount % 6 !== 0) {
            label = trackData.studentId;
            matchedStudent = trackData.matchedStudent;
            distance = trackData.distance;
            confidence = trackData.confidence;
            secondBestDistance = trackData.secondBestDistance;
            secondBestName = trackData.secondBestName;
          } else if (enrolledStudentsRef.current && enrolledStudentsRef.current.length > 0) {
            const studentDistances = [];
            
            enrolledStudentsRef.current.forEach((student) => {
              if (student.faceDescriptors && student.faceDescriptors.length > 0) {
                let minDistance = 1.0;
                student.faceDescriptors.forEach((desc) => {
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

            if (studentDistances.length > 0) {
              studentDistances.sort((a, b) => a.distance - b.distance);
              
              const bestMatch = studentDistances[0];
              const secondBestMatch = studentDistances.length > 1 ? studentDistances[1] : null;

              const bestName = bestMatch.student.name;
              const bestDistance = bestMatch.distance;
              const secondBestMatchName = secondBestMatch ? secondBestMatch.student.name : 'None';
              const secondBestDist = secondBestMatch ? secondBestMatch.distance : 1.0;

              distance = bestDistance;
              secondBestDistance = secondBestDist;
              secondBestName = secondBestMatchName;

              const SAFE_DISTANCE_THRESHOLD = 0.48;
              const AMBIGUITY_MARGIN = 0.10;

              if (bestDistance > SAFE_DISTANCE_THRESHOLD) {
                label = 'unknown';
              } else if (secondBestMatch && (secondBestDist - bestDistance) < AMBIGUITY_MARGIN) {
                label = 'ambiguous';
                console.warn(`⚠️ Frontend: Ambiguous match rejected. (Diff: ${(secondBestDist - bestDistance).toFixed(4)})`);
              } else {
                label = bestMatch.student._id || bestMatch.student.id;
                matchedStudent = bestMatch.student;
                confidence = Math.round((1 - bestDistance) * 100);
              }

              // Update track cache variables
              trackData.studentId = label;
              trackData.matchedStudent = matchedStudent;
              trackData.distance = distance;
              trackData.confidence = confidence;
              trackData.secondBestDistance = secondBestDistance;
              trackData.secondBestName = secondBestName;

              // Print debug logs exactly as requested:
              console.log(`\n🔍 [Frontend Matcher Debug]`);
              console.log(`Best Match:`);
              console.log(`${bestName}`);
              console.log(`Distance:`);
              console.log(`${bestDistance.toFixed(4)}`);
              if (secondBestMatch) {
                console.log(`Second Best:`);
                console.log(`${secondBestMatchName}`);
                console.log(`Distance:`);
                console.log(`${secondBestDist.toFixed(4)}`);
              }
              console.log(`Recognition Time:`);
              console.log(`${(Date.now() - startTime)}ms`);
              console.log(`Liveness Result:`);
              console.log(`${trackData.livenessStatus.toUpperCase()}`);
              console.log(`-----------------------------------`);
            }
          }
        }

        return {
          detection: det.detection,
          descriptor: det.descriptor,
          landmarks: det.landmarks,
          label,
          distance,
          confidence,
          secondBestDistance,
          secondBestName,
          student: matchedStudent,
          livenessStatus: trackData.livenessStatus
        };
      });

      // 4. Clean up old tracked faces (not seen in last 3 seconds)
      const now = Date.now();
      for (const [id, track] of activeTracker.entries()) {
        if (now - track.lastSeen > 3000) {
          activeTracker.delete(id);
        }
      }

      // Draw overlay graphics on canvas if provided
      if (canvasElement) {
        const displaySize = {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        };
        
        faceapi.matchDimensions(canvasElement, displaySize);
        const resizedResults = faceapi.resizeResults(results, displaySize);
        
        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
 
        resizedResults.forEach((res) => {
          const { x, y, width, height } = res.detection.box;
          const isUnknown = res.label === 'unknown';
          const isTooFar = res.label === 'move-closer';
          const isAmbiguous = res.label === 'ambiguous';
          const isChecking = res.label === 'checking-liveness';
          const isSpoof = res.label === 'spoof';

          // Color palette: Red for Spoof, Orange for Ambiguous, Yellow for Too Far, Sky Blue for checking, Pink for Unknown, Neon for Verified
          const color = isSpoof ? '#ff0033' 
                      : (isAmbiguous ? '#ff5500' 
                      : (isTooFar ? '#ffb700' 
                      : (isChecking ? '#00aaff' 
                      : (isUnknown ? '#ff007f' : '#00f0ff'))));

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          
          // Corner Brackets
          ctx.moveTo(x, y + 20); ctx.lineTo(x, y); ctx.lineTo(x + 20, y);
          ctx.moveTo(x + width - 20, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + 20);
          ctx.moveTo(x, y + height - 20); ctx.lineTo(x, y + height); ctx.lineTo(x + 20, y + height);
          ctx.moveTo(x + width - 20, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - 20);
          ctx.stroke();

          // Subtle box highlight background
          ctx.fillStyle = isSpoof ? 'rgba(255, 0, 51, 0.03)' 
                        : (isAmbiguous ? 'rgba(255, 85, 0, 0.03)' 
                        : (isTooFar ? 'rgba(255, 183, 0, 0.03)' 
                        : (isChecking ? 'rgba(0, 170, 255, 0.03)' 
                        : (isUnknown ? 'rgba(255, 0, 127, 0.03)' : 'rgba(0, 240, 255, 0.03)'))));
          ctx.fillRect(x, y, width, height);

          // Draw floating identification tag
          ctx.fillStyle = color;
          ctx.font = 'bold 11px Inter, system-ui';
          const labelText = isSpoof ? `❌ SPOOFING DETECTED` 
                          : (isAmbiguous ? `⚠️ AMBIGUOUS MATCH` 
                          : (isTooFar ? `⚠️ MOVE CLOSER` 
                          : (isChecking ? `⚙️ VERIFYING LIVENESS...` 
                          : (isUnknown ? `⚠️ UNKNOWN` : `Verified: ${res.confidence}%`))));
          
          const textWidth = ctx.measureText(labelText).width;
          ctx.fillRect(x, y - 24, textWidth + 16, 20);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(labelText, x + 8, y - 10);
        });
      }

      return results;
    } catch (err) {
      console.error('Error during real-time face detection:', err);
      return [];
    }
  }, [modelsLoaded]);

  return {
    loading,
    modelsLoaded,
    loadModels,
    initFaceMatcher,
    detectAndRecognize,
    faceMatcher: null
  };
};
