import { useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

export const useFaceApi = () => {
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState(null);

  // Load models from public/models folder
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true;
    setLoading(true);
    try {
      console.log('🤖 Loading face-api.js neural networks...');
      
      // Load SSD MobileNet or Tiny Face Detector, Landmark, and Recognition networks
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      
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

  // Compile student profiles into a FaceMatcher instance
  const initFaceMatcher = useCallback((studentsList, distanceThreshold = 0.55) => {
    if (studentsList.length === 0) {
      setFaceMatcher(null);
      return;
    }

    try {
      console.log('🧠 Building LabeledFaceDescriptors cache from enrolled students...');
      const labeledDescriptors = [];

      studentsList.forEach((student) => {
        if (student.faceDescriptors && student.faceDescriptors.length > 0) {
          // Convert regular numeric arrays back into Float32Array
          const float32Descriptors = student.faceDescriptors.map(
            (desc) => new Float32Array(desc)
          );

          labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(
              student._id || student.id, // Label stores MongoDB ID
              float32Descriptors
            )
          );
        }
      });

      if (labeledDescriptors.length > 0) {
        // Create matcher with adjustable match threshold
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, distanceThreshold);
        setFaceMatcher(matcher);
        console.log('🧠 Local FaceMatcher initialized successfully!');
      } else {
        setFaceMatcher(null);
      }
    } catch (err) {
      console.error('❌ Error compiling face matcher:', err);
    }
  }, []);

  // Detect and recognize faces in a video element
  const detectAndRecognize = useCallback(async (videoElement, canvasElement = null, minConfidence = 90) => {
    if (!modelsLoaded || !videoElement) return [];

    try {
      // Setup detection options (TinyFaceDetector is faster for real-time video)
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160, // 160 for performance, 224 for accuracy
        scoreThreshold: 0.5,
      });

      // Detect all faces in video frame with landmarks and descriptors
      const detections = await faceapi
        .detectAllFaces(videoElement, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      // Match detections to enrolled students
      const results = detections.map((det) => {
        let bestMatch = null;
        let label = 'unknown';
        let distance = 1.0;
        let confidence = 0;

        if (faceMatcher) {
          bestMatch = faceMatcher.findBestMatch(det.descriptor);
          label = bestMatch.label;
          distance = bestMatch.distance;
          
          // Realistic confidence rating mapping:
          // Distance <= 0.50 maps linearly from 100% to 90% (e.g. 0.30 -> 94%).
          // Distance between 0.50 and 0.70 maps from 90% down to 0% (e.g. 0.55 -> 68%).
          if (distance <= 0.50) {
            confidence = Math.round(100 - (distance * 20));
          } else {
            confidence = Math.round(Math.max(0, 90 - (distance - 0.50) * 450));
          }

          // Map UI minConfidence slider (50% to 99%) to actual face distance threshold (0.65 to 0.40)
          const maxDistance = 0.65 - ((minConfidence - 50) / 100) * 0.5;

          // Reject match as unknown if it exceeds allowed distance threshold
          if (distance > maxDistance) {
            label = 'unknown';
          }
        }

        return {
          detection: det.detection,
          descriptor: det.descriptor,
          landmarks: det.landmarks,
          label,
          distance,
          confidence: confidence < 0 ? 0 : confidence,
        };
      });

      // Draw overlay graphics on canvas if provided
      if (canvasElement) {
        const displaySize = {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        };
        
        // Resize canvas to match video stream dimensions
        faceapi.matchDimensions(canvasElement, displaySize);
        const resizedResults = faceapi.resizeResults(results, displaySize);
        
        // Clear canvas
        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Draw custom HUD-style boxes rather than browser defaults for aesthetics
        resizedResults.forEach((res) => {
          const { x, y, width, height } = res.detection.box;
          const isUnknown = res.label === 'unknown';
          const name = isUnknown ? 'UNKNOWN PERSON' : 'STUDENT ENROLLED';
          const color = isUnknown ? '#ff007f' : '#00f0ff'; // Neon pink vs Cyber blue

          // Draw HUD bounding corner brackets
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          
          // Top Left Corner
          ctx.moveTo(x, y + 20);
          ctx.lineTo(x, y);
          ctx.lineTo(x + 20, y);
          
          // Top Right Corner
          ctx.moveTo(x + width - 20, y);
          ctx.lineTo(x + width, y);
          ctx.lineTo(x + width, y + 20);
          
          // Bottom Left Corner
          ctx.moveTo(x, y + height - 20);
          ctx.lineTo(x, y + height);
          ctx.lineTo(x + 20, y + height);
          
          // Bottom Right Corner
          ctx.moveTo(x + width - 20, y + height);
          ctx.lineTo(x + width, y + height);
          ctx.lineTo(x + width, y + height - 20);
          ctx.stroke();

          // Subtle box highlight background
          ctx.fillStyle = isUnknown ? 'rgba(255, 0, 127, 0.05)' : 'rgba(0, 240, 255, 0.05)';
          ctx.fillRect(x, y, width, height);

          // Draw floating identification tag
          ctx.fillStyle = color;
          ctx.font = 'bold 12px Inter, system-ui';
          const labelText = isUnknown 
            ? `⚠️ UNKNOWN` 
            : `Verified: ${res.confidence}%`;
          
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
  }, [modelsLoaded, faceMatcher]);

  return {
    loading,
    modelsLoaded,
    loadModels,
    initFaceMatcher,
    detectAndRecognize,
    faceMatcher,
  };
};
