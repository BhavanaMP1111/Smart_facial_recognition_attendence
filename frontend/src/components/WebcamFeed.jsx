import React, { useRef, useEffect, useState } from 'react';
import { Camera, RefreshCw, AlertCircle } from 'lucide-react';

const WebcamFeed = ({ 
  onFrameProcessed, 
  isActive = true, 
  className = '', 
  overlayCanvas = true,
  deviceId = ''
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  // Stop camera feed
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Start camera feed
  const startCamera = async () => {
    setStarting(true);
    setError(null);
    stopCamera();

    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' })
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(err => {
            console.error("Video play failed:", err);
          });
          setStarting(false);
        };
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setError(
        err.name === 'NotAllowedError' 
          ? 'Camera access denied. Please check site permissions.'
          : 'Failed to access camera. Verify webcam connection.'
      );
      setStarting(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, deviceId]);

  // Feed frame data back to parent for face detection loops
  useEffect(() => {
    if (!isActive || error) return;

    let animFrameId;
    const processFrame = () => {
      if (
        videoRef.current && 
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
        onFrameProcessed
      ) {
        onFrameProcessed(videoRef.current, canvasRef.current);
      }
      animFrameId = requestAnimationFrame(processFrame);
    };

    // Delay start slightly to let metadata load
    const timeoutId = setTimeout(() => {
      animFrameId = requestAnimationFrame(processFrame);
    }, 1000);

    return () => {
      cancelAnimationFrame(animFrameId);
      clearTimeout(timeoutId);
    };
  }, [isActive, onFrameProcessed, error]);

  return (
    <div className={`relative bg-slate-900 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center border border-slate-700/50 shadow-inner ${className}`}>
      {/* Scanline HUD overlay */}
      {isActive && !error && !starting && <div className="scan-line" />}

      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover scale-x-[-1] ${starting || error ? 'hidden' : 'block'}`}
      />

      {/* Graphic Overlay Canvas */}
      {overlayCanvas && !error && !starting && (
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
        />
      )}

      {/* Starting Overlay */}
      {starting && (
        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-cyber-blue space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-cyber-blue" />
          <span className="text-sm font-semibold tracking-wider animate-pulse">BOOTING CAMERA DEVICE...</span>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-cyber-pink" />
          <p className="text-cyber-pink font-semibold">{error}</p>
          <button 
            onClick={startCamera}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-200"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default WebcamFeed;
