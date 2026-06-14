import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  RefreshCw, 
  Check, 
  X,
  FileSpreadsheet,
  Edit3
} from 'lucide-react';

const AttendanceRecords = () => {
  const { user, isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('');

  // Manual Correction state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [manualStatus, setManualStatus] = useState('Present');
  const [showManualModal, setShowManualModal] = useState(false);
  const [correctionMsg, setCorrectionMsg] = useState('');

  // Fetch student listings (critical for manual drop-down logs)
  const fetchLogsAndStudents = async () => {
    setLoading(true);
    try {
      // 1. Fetch attendance logs
      const logParams = {
        date,
        department: department || undefined,
        semester: semester || undefined,
        search: search || undefined,
        status: status || undefined
      };
      
      const logRes = await api.attendance.getLogs(logParams);
      if (logRes.data.success) {
        setLogs(logRes.data.data);
      }

      // 2. Fetch all students for manual correction list
      const studRes = await api.students.getAll();
      if (studRes.data.success) {
        setStudents(studRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching logs/students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndStudents();
  }, [date, department, semester, status]); // Trigger automatically on parameter change

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogsAndStudents();
  };

  // Submit manual correction override
  const handleManualOverride = async (e) => {
    e.preventDefault();
    setCorrectionMsg('');
    
    if (!selectedStudent) {
      setCorrectionMsg('❌ Please select a student profile');
      return;
    }

    try {
      const res = await api.attendance.manualOverride(selectedStudent, date, manualStatus, 'manual');
      if (res.data.success) {
        setCorrectionMsg('🎉 Override updated successfully!');
        setSelectedStudent('');
        fetchLogsAndStudents();
        setTimeout(() => setShowManualModal(false), 1500);
      }
    } catch (err) {
      setCorrectionMsg(`❌ Failed: ${err.response?.data?.message || 'Error occurred'}`);
    }
  };

  // Export dataset to CSV
  const exportToCSV = () => {
    if (logs.length === 0) return;

    try {
      const headers = ['Student Name', 'USN/Roll Number', 'Department', 'Semester', 'Date', 'Time Checked', 'Marking Method', 'Status', 'Confidence'];
      const rows = logs.map(log => [
        log.student?.name || 'N/A',
        log.student?.usn || 'N/A',
        log.student?.department || 'N/A',
        log.student?.semester || 'N/A',
        log.date,
        new Date(log.timestamp).toLocaleTimeString(),
        log.markedBy,
        log.status,
        `${log.confidence}%`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `attendance_export_${date || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV compilation failed:', err);
    }
  };

  // Trigger PDF print styles
  const triggerPDFPrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full print:p-0">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-5 print:hidden">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center space-x-3">
            <ClipboardList className="w-8 h-8 text-cyber-blue" />
            <span>Attendance Records Ledger</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Query complete logs database, edit records manually, and export reports.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Manual correction button (restricted to admin) */}
          {isAdmin() && (
            <button
              onClick={() => {
                setCorrectionMsg('');
                setShowManualModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyber-blue to-cyan-500 hover:from-cyan-500 hover:to-cyber-blue text-white font-bold tracking-wider uppercase text-xs shadow-lg hover:shadow-glow/30 flex items-center space-x-2 transition-all duration-200"
            >
              <Edit3 className="w-4 h-4" />
              <span>Manual Check-In</span>
            </button>
          )}

          <button
            onClick={exportToCSV}
            disabled={logs.length === 0}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 tracking-wider uppercase text-xs flex items-center space-x-2 transition-all duration-200 disabled:opacity-40"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={triggerPDFPrint}
            disabled={logs.length === 0}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 font-bold border border-slate-200 dark:border-slate-750 tracking-wider uppercase text-xs flex items-center space-x-2 transition-all duration-200 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Query Search / Filtering parameters */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-6 print:hidden">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4">
          {/* Search text query */}
          <div className="flex-grow relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or USN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue outline-none text-sm text-slate-855 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-750 text-slate-700 dark:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200"
          >
            Find Logs
          </button>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200/30 dark:border-slate-800/30">
          {/* Date Picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
              <Calendar className="w-3 h-3 text-cyber-blue" />
              <span>Select Date</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none"
            />
          </div>

          {/* Department filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
              <Filter className="w-3 h-3 text-cyber-blue" />
              <span>Department</span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none cursor-pointer"
            >
              <option value="">All Departments</option>
              <option value="CSE">Computer Science (CSE)</option>
              <option value="ISE">Information Science (ISE)</option>
              <option value="CSE(AIML)">CSE (AI & ML)</option>
              <option value="AIDS">AI & Data Science (AIDS)</option>
              <option value="ECE">Electronics & Comm (ECE)</option>
              <option value="EEE">Electrical & Electronics (EEE)</option>
            </select>
          </div>

          {/* Semester filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
              <Filter className="w-3 h-3 text-cyber-blue" />
              <span>Semester</span>
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none cursor-pointer"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s.toString()}>Sem {s}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
              <Filter className="w-3 h-3 text-cyber-blue" />
              <span>Check-in status</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main logs ledger Table */}
      <div className="cyber-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6">Student Name</th>
                <th className="py-4 px-6">USN / Roll</th>
                <th className="py-4 px-6">Dept & Sem</th>
                <th className="py-4 px-6">Marking Method</th>
                <th className="py-4 px-6">Time Captured</th>
                <th className="py-4 px-6">Confidence</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-cyber-blue">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <span className="font-semibold uppercase tracking-wider animate-pulse">Filtering logs...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 font-semibold uppercase tracking-widest">
                    No matching attendance logs registered
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-850 dark:text-white">
                      {log.student?.name || 'Deleted student'}
                    </td>
                    <td className="py-4 px-6 uppercase font-medium">{log.student?.usn || 'N/A'}</td>
                    <td className="py-4 px-6">{`${log.student?.department || 'N/A'} - Sem ${log.student?.semester || 'N/A'}`}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[9px] uppercase border ${
                        log.markedBy === 'manual' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700' :
                        log.markedBy.startsWith('iot') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-cyber-blue/10 text-cyber-blue border-cyber-blue/20'
                      }`}>
                        {log.markedBy}
                      </span>
                    </td>
                    <td className="py-4 px-6">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="py-4 px-6 font-semibold">
                      {log.markedBy === 'manual' ? '100%' : `${log.confidence}%`}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${
                        log.status === 'Present' ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' :
                        log.status === 'Late' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        'bg-cyber-pink/10 text-cyber-pink border-cyber-pink/20'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Correction Form Modal (Restricted to Admin) */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-200">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-white/20 dark:border-slate-800 shadow-2xl relative">
            <button 
              onClick={() => setShowManualModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white border border-slate-200 dark:border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 dark:text-white pb-3 border-b border-slate-200/50 dark:border-slate-800/50 mb-4">
              Manual Check-In Correction
            </h3>

            {correctionMsg && (
              <div className="mb-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 text-xs font-semibold text-center text-slate-800 dark:text-white">
                {correctionMsg}
              </div>
            )}

            <form onSubmit={handleManualOverride} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Select Student</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none cursor-pointer"
                >
                  <option value="">-- Choose Profile --</option>
                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {`${student.name} (${student.usn})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Correction Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Log Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Present', 'Absent', 'Late'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setManualStatus(st)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                        manualStatus === st 
                          ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue font-semibold' 
                          : 'bg-white/30 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyber-blue to-cyan-500 hover:from-cyan-500 hover:to-cyber-blue text-white font-bold tracking-wider uppercase text-xs shadow-lg hover:shadow-glow/30 flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <Check className="w-4 h-4" />
                <span>Override Record</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceRecords;
