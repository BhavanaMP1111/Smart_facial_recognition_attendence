import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useFaceApi } from '../hooks/useFaceApi';
import WebcamFeed from '../components/WebcamFeed';
import { 
  UserPlus, 
  UserCheck, 
  Camera, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  FolderOpen,
  Hash,
  School,
  GraduationCap
} from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

const RegisterStudent = () => {
  const { modelsLoaded, loadModels } = useFaceApi();
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [semester, setSemester] = useState('6');
  const [admissionYear, setAdmissionYear] = useState(new Date().getFullYear().toString());
  
  const [capturing, setCapturing] = useState(false);
  const [samples, setSamples] = useState([]); // Stores Float32Array descriptors
  const [capturedSnaps, setCapturedSnaps] = useState([]); // Stores preview images (base64)
  const [progress, setProgress] = useState(0);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const videoRef = useRef(null);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(localStorage.getItem('selectedDeviceId') || '');

  // Detect and list camera devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
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

  // Auto load face-api models when page boots
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const triggerReset = () => {
    setSamples([]);
    setCapturedSnaps([]);
    setProgress(0);
    setStatusMsg({ type: '', text: '' });
  };

  // Process video frames to find/store student face embeddings
  const handleFrameCapture = async (videoElement, canvasElement) => {
    // Only capture when explicitly requested by click
    if (!capturing || progress >= 100) return;

    try {
      setCapturing(false); // Stop loop capture
      
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.6 });
      
      // Perform single high-accuracy detection
      const detection = await faceapi
        .detectSingleFace(videoElement, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatusMsg({ 
          type: 'error', 
          text: '❌ Face detection failed! Position yourself inside the camera frame and try again.' 
        });
        return;
      }

      // 1. Save descriptors (embeddings)
      const descriptorArray = Array.from(detection.descriptor);
      setSamples(prev => [...prev, descriptorArray]);

      // 2. Generate a cropped face preview image for display before saving
      try {
        const cropCanvas = document.createElement('canvas');
        const { x, y, width, height } = detection.detection.box;
        cropCanvas.width = 120;
        cropCanvas.height = 120;
        const ctx = cropCanvas.getContext('2d');

        // Draw cropped region from video onto cropCanvas
        // Need to compensate for video horizontal mirroring
        ctx.translate(120, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, x, y, width, height, 0, 0, 120, 120);
        
        const previewUrl = cropCanvas.toDataURL('image/jpeg');
        setCapturedSnaps(prev => [...prev, previewUrl]);
      } catch (err) {
        console.warn('Failed to crop face thumbnail:', err);
      }

      // 3. Update Progress indicators (We require 3 unique captures)
      const nextProgress = Math.min(100, Math.round(((samples.length + 1) / 3) * 100));
      setProgress(nextProgress);
      setStatusMsg({ type: 'success', text: `✨ Captured sample [${samples.length + 1}/3] successfully!` });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: '❌ Capturing error occurred.' });
    }
  };

  const captureSample = () => {
    if (progress >= 100) return;
    setCapturing(true);
    setStatusMsg({ type: 'info', text: '📸 Scanning facial landmarks... Keep steady.' });
  };

  const saveStudentProfile = async (e) => {
    e.preventDefault();
    if (samples.length < 3) {
      setStatusMsg({ type: 'error', text: '⚠️ Capture at least 3 distinct face samples before registering!' });
      return;
    }
    
    setSaving(true);
    setStatusMsg({ type: 'info', text: '💾 Registering credentials to MongoDB...' });

    try {
      const studentData = {
        name,
        usn,
        department,
        semester,
        admissionYear: parseInt(admissionYear) || new Date().getFullYear(),
        faceDescriptors: samples
      };

      const res = await api.students.register(studentData);
      if (res.data.success) {
        setStatusMsg({ 
          type: 'success', 
          text: `🎉 Student '${name}' registered successfully with ${samples.length} face embeddings!` 
        });
        setName('');
        setUsn('');
        setSamples([]);
        setCapturedSnaps([]);
        setProgress(0);
      }
    } catch (error) {
      setStatusMsg({ 
        type: 'error', 
        text: error.response?.data?.message || '❌ Registration failed.' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (!modelsLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-cyber-blue space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin" />
        <span className="text-sm font-semibold tracking-widest animate-pulse">LOADING NEURAL LANDMARKS...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header Info */}
      <div className="border-b border-slate-200/50 dark:border-slate-800/50 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center space-x-3">
          <UserPlus className="w-8 h-8 text-cyber-blue" />
          <span>Student Registration</span>
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Enrolls new students and scans facial vector metrics to feed biometric models.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Hand: Registration Details Form */}
        <div className="cyber-card p-6 flex flex-col justify-between">
          <form onSubmit={saveStudentProfile} className="space-y-5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
              Student Information
            </h3>

            {/* Input Details */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Student Full Name</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bhavana M P"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  <span>USN / Roll Number</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1SG22CS001"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <School className="w-3.5 h-3.5" />
                    <span>Department</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200 cursor-pointer text-xs"
                  >
                    <option value="CSE" className="bg-white dark:bg-cyber-dark">Computer Science (CSE)</option>
                    <option value="ISE" className="bg-white dark:bg-cyber-dark">Information Science (ISE)</option>
                    <option value="CSE(AIML)" className="bg-white dark:bg-cyber-dark">CSE (AI & ML)</option>
                    <option value="AIDS" className="bg-white dark:bg-cyber-dark">AI & Data Science (AIDS)</option>
                    <option value="ECE" className="bg-white dark:bg-cyber-dark">Electronics & Comm (ECE)</option>
                    <option value="EEE" className="bg-white dark:bg-cyber-dark">Electrical & Electronics (EEE)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Semester</span>
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200 cursor-pointer text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s.toString()} className="bg-white dark:bg-cyber-dark">
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    <span>Admission Year</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 2025"
                    value={admissionYear}
                    onChange={(e) => setAdmissionYear(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Status alerts */}
            {statusMsg.text && (
              <div className={`p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 border ${
                statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                statusMsg.type === 'error' ? 'bg-cyber-pink/10 border-cyber-pink/20 text-cyber-pink' :
                'bg-cyber-blue/10 border-cyber-blue/20 text-cyber-blue'
              }`}>
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* Verification progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-400">
                <span>Biometric Profiling Progress</span>
                <span className="text-cyber-blue font-extrabold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-cyber-blue to-cyan-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={triggerReset}
                className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold tracking-wider text-xs border border-slate-200 dark:border-slate-700 transition-all duration-200"
              >
                Reset Scans
              </button>
              <button
                type="submit"
                disabled={saving || progress < 100}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-cyber-blue to-cyan-500 hover:from-cyan-500 hover:to-cyber-blue text-white font-bold tracking-wider uppercase text-xs shadow-lg hover:shadow-glow/30 flex items-center justify-center space-x-2 transition-all duration-300 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{saving ? 'ENROLLING...' : 'SAVE STUDENT'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Hand: Face Capture terminal */}
        <div className="cyber-card p-6 flex flex-col space-y-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
            Biometric Calibration Camera
          </h3>

          {devices.length > 0 && (
            <div className="flex flex-col space-y-1.5 w-full bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select Camera
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  localStorage.setItem('selectedDeviceId', e.target.value);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm focus:border-cyber-blue outline-none cursor-pointer appearance-none shadow-sm"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Webcam view */}
          <div className="relative">
            <WebcamFeed
              onFrameProcessed={handleFrameCapture}
              isActive={progress < 100}
              overlayCanvas={false}
              deviceId={selectedDeviceId}
            />
            
            {progress < 100 && (
              <button
                onClick={captureSample}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full bg-gradient-to-r from-cyber-blue to-cyan-500 text-white font-bold tracking-wider uppercase text-xs shadow-lg shadow-glow/30 hover:shadow-glow/50 flex items-center space-x-2 border border-cyber-blue/20 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Facial sample</span>
              </button>
            )}
          </div>

          {/* Crop preview snapshots panel */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Captured Face Matrices</span>
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((idx) => {
                const sample = capturedSnaps[idx];
                return (
                  <div 
                    key={idx} 
                    className="relative aspect-square bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden flex items-center justify-center"
                  >
                    {sample ? (
                      <img 
                        src={sample} 
                        alt={`crop-${idx}`}
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500/50 text-[10px] font-bold uppercase tracking-widest text-center p-2">
                        <AlertTriangle className="w-4 h-4 mb-1.5 opacity-55" />
                        <span>Empty Slot</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RegisterStudent;
