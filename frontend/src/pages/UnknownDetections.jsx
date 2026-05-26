import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  UserPlus, 
  X, 
  Clock, 
  RefreshCw,
  Info
} from 'lucide-react';

const UnknownDetections = () => {
  const { isAdmin } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Conversion registration modal state
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [semester, setSemester] = useState('6');
  const [saving, setSaving] = useState(false);
  const [modalMsg, setModalMsg] = useState('');

  const fetchAlerts = async () => {
    setRefreshing(true);
    try {
      const res = await api.unknown.getAll();
      if (res.data.success) {
        setAlerts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load unknown alerts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleDismiss = async (id) => {
    try {
      const res = await api.unknown.dismiss(id);
      if (res.data.success) {
        setAlerts(prev => prev.filter(alert => alert._id !== id));
      }
    } catch (err) {
      console.error('Dismiss failed:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this snapshot log?')) return;
    try {
      const res = await api.unknown.delete(id);
      if (res.data.success) {
        setAlerts(prev => prev.filter(alert => alert._id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Open conversion form modal
  const openConvertModal = (alert) => {
    setModalMsg('');
    setSelectedAlert(alert);
    setName('');
    setUsn('');
  };

  // Convert unauthorized snapshot into enrolled student profile
  const handleConvertStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalMsg('');

    try {
      // 1. Build descriptor array
      // If the alert contains an embedding, use it; otherwise mock a template
      const descriptor = selectedAlert.descriptor || [];
      if (descriptor.length === 0) {
        setModalMsg('❌ No facial descriptors captured in this alert to enroll.');
        setSaving(false);
        return;
      }

      // 2. Register student with descriptors
      const studentRes = await api.students.register({
        name,
        usn,
        department,
        semester,
        faceDescriptors: [descriptor] // Register alert embedding as first sample
      });

      if (studentRes.data.success) {
        // 3. Mark alert as resolved/dismissed
        await api.unknown.dismiss(selectedAlert._id);
        
        setModalMsg('🎉 Student enrolled successfully! Warning resolved.');
        setAlerts(prev => prev.filter(alert => alert._id !== selectedAlert._id));
        setTimeout(() => setSelectedAlert(null), 1500);
      }
    } catch (err) {
      setModalMsg(`❌ Failed: ${err.response?.data?.message || 'Error occurred'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-cyber-blue space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin" />
        <span className="text-sm font-semibold tracking-widest animate-pulse">SYNCING SECURITY ARCHIVES...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header Info */}
      <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center space-x-3">
            <ShieldAlert className="w-8 h-8 text-cyber-pink glow-text-pink" />
            <span>Security Alerts Panel</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Unauthorized facial captures log and snapshot resolution matrices.
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={refreshing}
          className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 flex items-center space-x-2 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-xs font-bold uppercase tracking-wider">Sync Logs</span>
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="cyber-card p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
          <CheckCircle className="w-16 h-16 text-cyber-neon glow-text-green animate-pulse" />
          <h3 className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">System Secure</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No unrecognized or unauthorized faces logged in the databases.
          </p>
        </div>
      ) : (
        /* Alerts Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {alerts.map((alert) => (
            <div key={alert._id} className="cyber-card flex flex-col overflow-hidden border border-cyber-pink/20 hover:border-cyber-pink/40 hover:shadow-glow-pink/10">
              
              {/* Snapshot image preview frame */}
              <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-slate-800">
                <img 
                  src={alert.snapshotUrl} 
                  alt="Unknown Face"
                  className="w-full h-full object-cover scale-x-[-1]"
                  onError={(e) => {
                    // Fallback to placeholder on image file loading failures
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
                  }}
                />
                
                {/* Float device details info */}
                <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white border border-white/10 uppercase tracking-widest">
                  {alert.deviceId}
                </span>
              </div>

              {/* Card Meta Content details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-white">
                    <span className="text-cyber-pink flex items-center space-x-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Security Breach</span>
                    </span>
                    <span>{alert.confidence}% Match</span>
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  </p>
                </div>

                {/* Operations triggers */}
                <div className="flex gap-2">
                  {/* Register Conversion (Restricted to Admin) */}
                  {isAdmin() && (
                    <button
                      onClick={() => openConvertModal(alert)}
                      className="flex-1 py-2 px-2.5 rounded-lg bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue font-bold border border-cyber-blue/20 text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Resolve Enroll</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDismiss(alert._id)}
                    className="py-2 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-750 text-[10px] uppercase tracking-wider transition-all"
                  >
                    Dismiss
                  </button>

                  {isAdmin() && (
                    <button
                      onClick={() => handleDelete(alert._id)}
                      className="py-2 px-2.5 rounded-lg bg-cyber-pink/10 hover:bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/20 text-[10px] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Resolution conversion modal form */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-200">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-white/20 dark:border-slate-850 shadow-2xl relative">
            <button 
              onClick={() => setSelectedAlert(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white border border-slate-200 dark:border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 dark:text-white pb-3 border-b border-slate-200/50 dark:border-slate-800/50 mb-4">
              Convert Snapshot to Student Profile
            </h3>

            {/* Warning snapshot banner preview */}
            <div className="flex items-center space-x-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 mb-4">
              <div className="w-16 h-16 rounded-lg bg-black overflow-hidden flex-shrink-0">
                <img 
                  src={selectedAlert.snapshotUrl} 
                  alt="Alert Thumb"
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>
              <div className="text-xs">
                <p className="font-bold text-cyber-pink uppercase">Biometric Embedding Available</p>
                <p className="text-slate-400 mt-0.5">We will register the facial vector extracted during the security breach alert.</p>
              </div>
            </div>

            {modalMsg && (
              <div className="mb-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 text-xs font-semibold text-center text-slate-800 dark:text-white">
                {modalMsg}
              </div>
            )}

            <form onSubmit={handleConvertStudent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bhavana M P"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 text-sm text-slate-800 dark:text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">USN / Roll Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1SG22CS001"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 text-sm text-slate-800 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 text-xs text-slate-850 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="CSE">Computer Science</option>
                    <option value="ISE">Information Science</option>
                    <option value="ECE">Electronics & Comm</option>
                    <option value="ME">Mechanical Eng</option>
                    <option value="CV">Civil Eng</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 text-xs text-slate-850 dark:text-white outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s.toString()}>Sem {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyber-blue to-cyan-500 hover:from-cyan-500 hover:to-cyber-blue text-white font-bold tracking-wider uppercase text-xs shadow-lg hover:shadow-glow/30 flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{saving ? 'ENROLLING...' : 'Register Student'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default UnknownDetections;
