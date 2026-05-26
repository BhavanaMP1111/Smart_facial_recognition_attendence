import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useFaceApi } from '../hooks/useFaceApi';
import WebcamFeed from '../components/WebcamFeed';
import { 
  ScanFace, 
  Activity, 
  Clock, 
  Bell, 
  ShieldAlert, 
  CheckCircle2, 
  UserMinus,
  RefreshCw,
  Info
} from 'lucide-react';

const RealTimeAttendance = () => {
  const { modelsLoaded, loadModels, initFaceMatcher, detectAndRecognize } = useFaceApi();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingLogs, setMarkingLogs] = useState([]); // In-session logs
  const [scanningActive, setScanningActive] = useState(true);

  // Prevent spamming requests by mapping student ID to lock cooldown
  const checkinCooldowns = useRef(new Map());
  // Cooldown interval: 10 seconds before letting browser re-scan (duplicate check is handled on server anyway)
  const COOLDOWN_MS = 10000;

  // Synthesize Audio Chime (Saves downloading external asset files)
  const playCheckinChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Node 1: High frequency chime
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      // Node 2: Harmonizing lower frequency
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(1109, audioCtx.currentTime); // C#6
      gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 0.4);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio check-in chime fail:', e);
    }
  };

  // Fetch all face descriptor records to initialize local matcher
  const initBiometrics = useCallback(async () => {
    try {
      await loadModels();
      const res = await api.students.getFaceCache();
      if (res.data.success) {
        setStudents(res.data.data);
        initFaceMatcher(res.data.data, 0.55); // Threshold 0.55
      }
    } catch (err) {
      console.error('Failed to load student biometrics:', err);
    } finally {
      setLoading(false);
    }
  }, [loadModels, initFaceMatcher]);

  useEffect(() => {
    initBiometrics();
  }, [initBiometrics]);

  // Main callback fed into WebcamFeed components frame-processor loop
  const handleCameraFrame = useCallback(async (videoElement, canvasElement) => {
    if (!scanningActive) return;

    // Run face detection on the current webcam frame
    const results = await detectAndRecognize(videoElement, canvasElement);
    if (!results || results.length === 0) return;

    const now = Date.now();

    for (const res of results) {
      const studentId = res.label;
      const confidence = res.confidence;

      if (studentId === 'unknown') {
        // Unknown person detected! Take snapshot and alert
        // Let's debounce unknown notifications too so we don't spam the DB
        const lastUnknownTime = checkinCooldowns.current.get('unknown');
        if (!lastUnknownTime || now - lastUnknownTime > 15000) {
          checkinCooldowns.current.set('unknown', now);
          console.warn('🚨 Unknown person alert triggered!');
          
          // Capture base64 snapshot from video
          try {
            const snapCanvas = document.createElement('canvas');
            snapCanvas.width = videoElement.videoWidth;
            snapCanvas.height = videoElement.videoHeight;
            const ctx = snapCanvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0);
            const imageBase64 = snapCanvas.toDataURL('image/jpeg');

            api.unknown.log(imageBase64, confidence, 'webcam')
              .then((alertRes) => {
                if (alertRes.data.success) {
                  const alertLog = {
                    id: alertRes.data.data._id,
                    type: 'alert',
                    text: '⚠️ Unknown person detected at Scan terminal!',
                    timestamp: new Date().toLocaleTimeString()
                  };
                  setMarkingLogs(prev => [alertLog, ...prev].slice(0, 15));
                }
              })
              .catch(err => console.error('Failed to log unknown alert:', err));
          } catch (snapErr) {
            console.error('Failed to capture alert frame:', snapErr);
          }
        }
        continue;
      }

      // Check if student check-in is currently on lock cooldown
      const lastCheckTime = checkinCooldowns.current.get(studentId);
      if (lastCheckTime && now - lastCheckTime < COOLDOWN_MS) {
        continue; // Lock active, skip check-in api call
      }

      // Place locks on check-in immediately to prevent dual parallel requests
      checkinCooldowns.current.set(studentId, now);

      // Perform check-in API call
      try {
        const response = await api.attendance.mark(studentId, confidence, 'webcam');
        if (response.data.success) {
          playCheckinChime();
          const log = {
            id: response.data.data._id,
            type: 'present',
            text: `✅ ${response.data.data.student.name} (${response.data.data.student.usn}) checked-in.`,
            timestamp: new Date().toLocaleTimeString()
          };
          setMarkingLogs(prev => [log, ...prev].slice(0, 15));
        }
      } catch (err) {
        // Match already marked today handles nicely
        if (err.response?.data?.alreadyMarked) {
          const detail = err.response.data.data;
          const log = {
            id: detail._id || Math.random().toString(),
            type: 'warning',
            text: `ℹ️ ${err.response.data.message}`,
            timestamp: new Date().toLocaleTimeString()
          };
          setMarkingLogs(prev => [log, ...prev].slice(0, 15));
        } else {
          console.error('Mark attendance API failed:', err);
          // Unlock immediately on general failures to let user try again
          checkinCooldowns.current.delete(studentId);
        }
      }
    }
  }, [scanningActive, detectAndRecognize]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-cyber-blue space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin" />
        <span className="text-sm font-semibold tracking-widest animate-pulse">BOOTING SCAN BIOMETRIC MATRIX...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header Info */}
      <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center space-x-3">
            <ScanFace className="w-8 h-8 text-cyber-blue" />
            <span>Attendance Scan Terminal</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Scans classroom live video. Verifies identities and records check-ins in real-time.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <span className={`w-3 h-3 rounded-full ${scanningActive ? 'bg-cyber-neon animate-ping' : 'bg-rose-500'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {scanningActive ? 'Scan Active' : 'Scan Paused'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Webcam scanner feed (2 columns wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <WebcamFeed
              onFrameProcessed={handleCameraFrame}
              isActive={scanningActive}
              overlayCanvas={true}
            />
          </div>

          <div className="glass-panel rounded-2xl p-4 flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/50">
            <Info className="w-5 h-5 text-cyber-blue flex-shrink-0" />
            <p>
              Students must step clearly in front of the camera. The system detects multiple faces simultaneously, logs check-ins automatically, and prevents duplicate logs. Unknown faces will trigger security flags.
            </p>
          </div>
        </div>

        {/* Live session log feeds (1 column) */}
        <div className="cyber-card p-6 flex flex-col justify-between h-[30rem] lg:h-auto">
          <div className="flex-1 flex flex-col overflow-hidden">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-widest pb-3 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyber-blue animate-pulse" />
              <span>Real-Time Check-In logs</span>
            </h3>

            {/* Logs List scroll container */}
            <div className="flex-grow mt-4 overflow-y-auto pr-2 space-y-3">
              {markingLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                  <Clock className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Awaiting Scan Feeds</span>
                </div>
              ) : (
                markingLogs.map((log, idx) => (
                  <div 
                    key={log.id || idx}
                    className={`p-3 rounded-xl border flex items-start space-x-3 text-xs transition-all duration-200 ${
                      log.type === 'present' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      log.type === 'alert' ? 'bg-cyber-pink/15 border-cyber-pink/20 text-cyber-pink shadow-glow-pink/5 animate-pulse' :
                      'bg-slate-100/50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350'
                    }`}
                  >
                    <div className="mt-0.5">
                      {log.type === 'present' && <CheckCircle2 className="w-4 h-4" />}
                      {log.type === 'alert' && <ShieldAlert className="w-4 h-4" />}
                      {log.type === 'warning' && <Info className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold break-words leading-relaxed">{log.text}</p>
                      <span className="text-[10px] opacity-60 font-bold block mt-1 uppercase">{log.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Toggle controls */}
          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 mt-4">
            <button
              onClick={() => setScanningActive(!scanningActive)}
              className={`w-full py-3 rounded-xl font-bold tracking-wider text-xs uppercase transition-all duration-200 ${
                scanningActive 
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20' 
                  : 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 hover:bg-cyber-blue/20'
              }`}
            >
              {scanningActive ? 'Pause Scan Engine' : 'Resume Scan Engine'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RealTimeAttendance;
