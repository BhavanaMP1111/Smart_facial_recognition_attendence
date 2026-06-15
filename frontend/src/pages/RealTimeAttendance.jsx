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
  Info,
  Wifi,
  WifiOff,
  Sliders,
  Cpu,
  Eye
} from 'lucide-react';
import { savePendingAttendance, getPendingAttendance, deletePendingAttendance } from '../utils/indexedDB';

const RealTimeAttendance = () => {
  const { modelsLoaded, loadModels, initFaceMatcher, detectAndRecognize } = useFaceApi();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingLogs, setMarkingLogs] = useState([]); // In-session logs
  const [scanningActive, setScanningActive] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(localStorage.getItem('selectedDeviceId') || '');

  // Offline Mode States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Confidence Threshold State
  const [minConfidence, setMinConfidence] = useState(parseInt(localStorage.getItem('minConfidence')) || 90);

  // Admin Diagnostics Panel State
  const [diagnostics, setDiagnostics] = useState({
    cameraName: 'Default Webcam',
    facesDetected: 0,
    confidence: 'N/A',
    matchScore: 'N/A',
    lastRecognizedStudent: 'None',
    status: 'Awaiting Scan Feeds'
  });

  // Detect and list camera devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Enumerate devices directly to speed up initialization
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceInfos.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        
        if (videoDevices.length > 0) {
          const exists = videoDevices.some(d => d.deviceId === selectedDeviceId);
          if (!selectedDeviceId || !exists) {
            setSelectedDeviceId(videoDevices[0].deviceId);
            localStorage.setItem('selectedDeviceId', videoDevices[0].deviceId);
          }
        }
      } catch (err) {
        console.error('Error listing cameras:', err);
      }
    };
    getDevices();
  }, [selectedDeviceId]);

  // Update camera name in diagnostics
  useEffect(() => {
    const activeCam = devices.find(d => d.deviceId === selectedDeviceId);
    setDiagnostics(prev => ({
      ...prev,
      cameraName: activeCam ? activeCam.label : 'Default Webcam'
    }));
  }, [selectedDeviceId, devices]);

  // Load count of pending sync items
  const updatePendingCount = async () => {
    const records = await getPendingAttendance();
    setPendingSyncCount(records.length);
  };

  useEffect(() => {
    updatePendingCount();
  }, []);

  // Online/Offline status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync function
  const triggerSync = useCallback(async () => {
    if (syncing || !navigator.onLine) return;
    setSyncing(true);
    try {
      const records = await getPendingAttendance();
      if (records.length === 0) {
        setSyncing(false);
        return;
      }
      
      console.log(`🔄 [Sync Engine] Synchronizing ${records.length} pending offline records...`);

      for (const rec of records) {
        try {
          // Verify on backend
          const res = await api.attendance.mark(rec.studentId, rec.confidence, rec.markedBy);
          if (res.data.success || res.data.alreadyMarked) {
            await deletePendingAttendance(rec.id);
          }
        } catch (err) {
          if (err.response?.data?.alreadyMarked) {
            await deletePendingAttendance(rec.id);
          } else {
            console.error('Failed to sync record:', err);
            break;
          }
        }
      }
      await updatePendingCount();
    } catch (err) {
      console.error('Offline sync error:', err);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // Sync automatically when online status returns
  useEffect(() => {
    if (isOnline) {
      triggerSync();
    }
  }, [isOnline, triggerSync]);

  // Prevent spamming requests by mapping student ID to lock cooldown
  const checkinCooldowns = useRef(new Map());
  // Performance Throttling Refs
  const lastScanTime = useRef(0);
  const isScanning = useRef(false);
  // Cooldown interval: 30 seconds before letting browser re-scan (duplicate check is handled on server anyway)
  const COOLDOWN_MS = 30000;

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

    const now = Date.now();
    // Throttle scan triggers to once every 300ms, and skip frames if a scan is already in progress
    if (isScanning.current || now - lastScanTime.current < 300) {
      return;
    }

    isScanning.current = true;
    lastScanTime.current = now;

    try {
      // Run face detection on the current webcam frame (passing minConfidence!)
      const results = await detectAndRecognize(videoElement, canvasElement, minConfidence);
      
      // If we have detections, update diagnostics immediately
      if (results && results.length > 0) {
        const primaryFace = results[0];
        const isUnknown = primaryFace.label === 'unknown';
        const isTooFar = primaryFace.label === 'move-closer';
        const isChecking = primaryFace.label === 'checking-liveness';
        const isSpoof = primaryFace.label === 'spoof';
        const isAmbiguous = primaryFace.label === 'ambiguous';
        let matchedName = 'Unknown';
        
        if (!isUnknown && !isTooFar && !isChecking && !isSpoof && !isAmbiguous && students.length > 0) {
          const stud = students.find(s => s._id === primaryFace.label || s.id === primaryFace.label);
          if (stud) matchedName = stud.name;
        }
        
        setDiagnostics(prev => ({
          ...prev,
          facesDetected: results.length,
          confidence: (isTooFar || isChecking || isSpoof || isAmbiguous) ? 'N/A' : `${primaryFace.confidence}%`,
          matchScore: (isTooFar || isChecking || isSpoof || isAmbiguous) ? 'N/A' : primaryFace.distance.toFixed(4),
          lastRecognizedStudent: (isUnknown || isTooFar || isChecking || isSpoof || isAmbiguous) ? prev.lastRecognizedStudent : matchedName,
          status: isTooFar ? 'Move Closer' : 
                  isChecking ? 'Checking Liveness...' :
                  isSpoof ? 'Spoofing Detected' :
                  isAmbiguous ? 'Ambiguous Match' :
                  isUnknown ? 'Unknown Face Detected' : 'Face Verified'
        }));
      } else {
        setDiagnostics(prev => ({
          ...prev,
          facesDetected: 0,
          confidence: 'N/A',
          matchScore: 'N/A',
          status: 'Awaiting Face...'
        }));
        isScanning.current = false;
        return;
      }

      for (const res of results) {
        const studentId = res.label;
        const confidence = res.confidence;

        if (studentId === 'move-closer') {
          // Face detected but is too far away. Skip processing/alerts, just display state
          continue;
        }

        if (studentId === 'checking-liveness') {
          // Liveness verification in progress. Skip check-in / alerts.
          continue;
        }

        if (studentId === 'spoof') {
          // Spoofing attempt detected! Skip check-in / alerts.
          const lastSpoofTime = checkinCooldowns.current.get('spoof');
          if (!lastSpoofTime || now - lastSpoofTime > 10000) {
            checkinCooldowns.current.set('spoof', now);
            const spoofLog = {
              id: `spoof_${now}`,
              type: 'alert',
              text: '🚨 Spoofing attempt detected! Static photo/screen presentation blocked.',
              timestamp: new Date().toLocaleTimeString()
            };
            setMarkingLogs(prev => [spoofLog, ...prev].slice(0, 15));
          }
          continue;
        }

        if (studentId === 'ambiguous') {
          // Ambiguous match detected. Skip marking attendance/alerts, just display status
          setDiagnostics(prev => ({
            ...prev,
            status: 'Ambiguous Match (Ignored)'
          }));
          continue;
        }

        if (studentId === 'unknown') {
          // Unknown person detected! Take snapshot and alert
          // Debounce unknown notifications so we don't spam the DB
          const lastUnknownTime = checkinCooldowns.current.get('unknown');
          if (!lastUnknownTime || now - lastUnknownTime > 15000) {
            checkinCooldowns.current.set('unknown', now);
            console.warn('🚨 Unknown person alert triggered!');
            
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
          setDiagnostics(prev => ({
            ...prev,
            status: 'Duplicate Ignored (Cooldown)'
          }));
          continue;
        }

        // Offline check-in intercept
        if (!isOnline) {
          checkinCooldowns.current.set(studentId, now);

          try {
            const stud = students.find(s => s._id === studentId || s.id === studentId);
            const studentName = stud ? stud.name : 'Student';
            const studentUsn = stud ? stud.usn : 'N/A';

            const offlineRecord = {
              studentId,
              confidence,
              markedBy: 'webcam_offline',
              date: new Date().toISOString().split('T')[0],
              timestamp: new Date().toISOString()
            };

            await savePendingAttendance(offlineRecord);
            await updatePendingCount();
            playCheckinChime();

            console.log(`👤 Student Matched Offline: ${studentName} | USN: ${studentUsn} | Confidence: ${confidence}%`);

            const log = {
              id: `offline_${studentId}_${now}`,
              type: 'present',
              text: `✅ [OFFLINE] ${studentName} (${studentUsn}) checked-in. Saved locally.`,
              timestamp: new Date().toLocaleTimeString()
            };
            setMarkingLogs(prev => [log, ...prev].slice(0, 15));

            setDiagnostics(prev => ({
              ...prev,
              status: 'Attendance Saved (Offline)',
              lastRecognizedStudent: studentName
            }));
          } catch (offlineErr) {
            console.error('Failed to save offline attendance:', offlineErr);
            checkinCooldowns.current.delete(studentId);
          }
          continue;
        }

        checkinCooldowns.current.set(studentId, now);

        try {
          const response = await api.attendance.mark(studentId, confidence, 'webcam');
          if (response.data.success) {
            console.log(`👤 Student Matched: ${response.data.data.student.name} | USN: ${response.data.data.student.usn} | Confidence: ${confidence}%`);
            
            playCheckinChime();
            const log = {
              id: response.data.data._id,
              type: 'present',
              text: `✅ ${response.data.data.student.name} (${response.data.data.student.usn}) checked-in.`,
              timestamp: new Date().toLocaleTimeString()
            };
            setMarkingLogs(prev => [log, ...prev].slice(0, 15));

            setDiagnostics(prev => ({
              ...prev,
              status: 'Attendance Marked',
              lastRecognizedStudent: response.data.data.student.name
            }));
          }
        } catch (err) {
          if (err.response?.data?.alreadyMarked) {
            const detail = err.response.data.data;
            const log = {
              id: detail._id || Math.random().toString(),
              type: 'warning',
              text: `ℹ️ ${err.response.data.message}`,
              timestamp: new Date().toLocaleTimeString()
            };
            setMarkingLogs(prev => [log, ...prev].slice(0, 15));

            setDiagnostics(prev => ({
              ...prev,
              status: 'Duplicate Checked (Ignored)'
            }));
          } else {
            console.error('Mark attendance API failed:', err);
            checkinCooldowns.current.delete(studentId);
          }
        }
      }
    } catch (scanErr) {
      console.error('Error during camera frame scan loop:', scanErr);
    } finally {
      isScanning.current = false;
    }
  }, [scanningActive, detectAndRecognize, students, isOnline, minConfidence]);

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

      {/* Offline Mode Status Indicators */}
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-5 h-5 text-amber-500 animate-pulse" />
            <span className="text-sm font-semibold">Offline Mode Active. Scanning is saved locally in IndexedDB.</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 px-3 py-1 rounded-full">
            {pendingSyncCount} Pending Syncs
          </div>
        </div>
      )}
      {isOnline && pendingSyncCount > 0 && (
        <div className="bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-cyber-blue" />
            <span className="text-sm font-semibold">
              {syncing ? 'Synchronizing pending offline records with MongoDB...' : 'Online. Pending offline records detected.'}
            </span>
          </div>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="text-xs font-bold uppercase tracking-wider bg-cyber-blue/20 hover:bg-cyber-blue/30 px-3 py-1.5 rounded-xl border border-cyber-blue/30 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : `Sync ${pendingSyncCount} Records`}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Webcam scanner feed (2 columns wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Camera Select */}
            <div className="flex flex-col space-y-1.5 bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 justify-center">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select Camera
              </label>
              {devices.length > 0 ? (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    localStorage.setItem('selectedDeviceId', e.target.value);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm focus:border-cyber-blue outline-none cursor-pointer appearance-none shadow-sm font-semibold"
                >
                  {devices.map((device, idx) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm font-semibold text-slate-400 py-2.5">Default Webcam</div>
              )}
            </div>

            {/* Confidence Threshold Slider */}
            <div className="flex flex-col space-y-1.5 bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 justify-between">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                  <Sliders className="w-3.5 h-3.5 text-cyber-blue" />
                  <span>Confidence Threshold</span>
                </label>
                <span className="text-xs font-extrabold text-cyber-blue">{minConfidence}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={minConfidence}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMinConfidence(val);
                  localStorage.setItem('minConfidence', val.toString());
                }}
                className="w-full h-2 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyber-blue mt-2"
              />
            </div>
          </div>

          <div className="relative">
            <WebcamFeed
              onFrameProcessed={handleCameraFrame}
              isActive={scanningActive}
              overlayCanvas={true}
              deviceId={selectedDeviceId}
            />
          </div>

          {/* Admin Diagnostics Panel */}
          <div className="cyber-card p-5 border border-slate-200/50 dark:border-slate-800/50 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-widest pb-2.5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyber-blue" />
              <span>Admin Diagnostics Panel</span>
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-white/20 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Active Camera</span>
                <span className="text-xs font-extrabold text-slate-700 dark:text-white truncate block mt-0.5" title={diagnostics.cameraName}>
                  {diagnostics.cameraName}
                </span>
              </div>
              
              <div className="p-3 bg-white/20 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Faces in Frame</span>
                <span className="text-xs font-extrabold text-cyber-blue block mt-0.5">
                  {diagnostics.facesDetected} Face(s)
                </span>
              </div>

              <div className="p-3 bg-white/20 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Scan Status</span>
                <span className={`text-xs font-extrabold block mt-0.5 ${
                  diagnostics.status.includes('Verified') || diagnostics.status.includes('Marked') || diagnostics.status.includes('Saved') ? 'text-emerald-400 font-extrabold' :
                  diagnostics.status.includes('Unknown') || diagnostics.status.includes('Duplicate') ? 'text-amber-500 font-extrabold animate-pulse' : 'text-slate-400'
                }`}>
                  {diagnostics.status}
                </span>
              </div>

              <div className="p-3 bg-white/20 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Match Distance</span>
                <span className="text-xs font-extrabold text-slate-700 dark:text-white block mt-0.5">
                  {diagnostics.matchScore}
                </span>
              </div>

              <div className="p-3 bg-white/20 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Confidence</span>
                <span className="text-xs font-extrabold text-slate-700 dark:text-white block mt-0.5">
                  {diagnostics.confidence}
                </span>
              </div>

              <div className="p-3 bg-white/20 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Last Identified</span>
                <span className="text-xs font-extrabold text-slate-700 dark:text-white truncate block mt-0.5" title={diagnostics.lastRecognizedStudent}>
                  {diagnostics.lastRecognizedStudent}
                </span>
              </div>
            </div>
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
