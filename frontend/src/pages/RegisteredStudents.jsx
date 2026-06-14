import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  School, 
  GraduationCap, 
  Search, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  ArrowLeft, 
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const RegisteredStudents = () => {
  const { isAdmin } = useAuth();
  
  // Stats states
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDepartments: 0,
    todayPresentCount: 0,
    todayAttendanceRate: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Student listing states
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [selectedSem, setSelectedSem] = useState('All Semesters');
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pages, setPages] = useState(1);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);

  // Edit Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUsn, setEditUsn] = useState('');
  const [editDept, setEditDept] = useState('CSE');
  const [editSem, setEditSem] = useState('1');
  const [editYear, setEditYear] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // General Notification / Toast state
  const [toast, setToast] = useState({ type: '', message: '' });

  // Load stats cards
  const fetchStats = async () => {
    try {
      const res = await api.students.getStats();
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching student stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load student list
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search: search.trim() || undefined,
        department: selectedDept !== 'All Departments' ? selectedDept : undefined,
        semester: selectedSem !== 'All Semesters' ? selectedSem : undefined
      };
      
      const res = await api.students.getAll(params);
      if (res.data.success) {
        setStudents(res.data.data);
        setPages(res.data.pages);
        setTotalStudentsCount(res.data.total);
      }
    } catch (err) {
      console.error('Error loading students:', err);
      showToast('error', 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedDept, selectedSem]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: '', message: '' }), 4000);
  };

  // Trigger Semester Promotion
  const handlePromoteStudents = async () => {
    if (!window.confirm('Are you sure you want to promote all students? This will advance Sem 1 → 2, 2 → 3, ... and set Sem 8 to Graduated.')) {
      return;
    }

    try {
      const res = await api.students.promote();
      if (res.data.success) {
        showToast('success', `Semester progression automated! ${res.data.data.promotedCount} students promoted.`);
        fetchStats();
        fetchStudents();
      }
    } catch (err) {
      console.error('Promotion error:', err);
      showToast('error', err.response?.data?.message || 'Failed to promote students.');
    }
  };

  // Open Edit Student Modal
  const openEditModal = (student) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditUsn(student.usn);
    setEditDept(student.department || student.dept || 'CSE');
    setEditSem(student.semester);
    setEditYear(student.admissionYear || new Date().getFullYear().toString());
    setEditPhoto(null);
    setEditPhotoPreview(student.imageUrl || '');
    setIsEditModalOpen(true);
  };

  // Handle Edit Student submit
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', editName);
      formData.append('usn', editUsn);
      formData.append('department', editDept);
      formData.append('semester', editSem);
      formData.append('admissionYear', editYear);
      if (editPhoto) {
        formData.append('photo', editPhoto);
      }

      const res = await api.students.update(editingStudent._id, formData);
      if (res.data.success) {
        showToast('success', 'Student updated successfully');
        setIsEditModalOpen(false);
        fetchStats();
        fetchStudents();
      }
    } catch (err) {
      console.error('Update student error:', err);
      showToast('error', err.response?.data?.message || 'Failed to update student profile.');
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Student
  const handleDeleteStudent = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete student "${name}"? This will permanently wipe their bio-profile and attendance logs.`)) {
      return;
    }

    try {
      const res = await api.students.delete(id);
      if (res.data.success) {
        showToast('success', 'Student deleted successfully');
        fetchStats();
        fetchStudents();
      }
    } catch (err) {
      console.error('Delete student error:', err);
      showToast('error', 'Failed to delete student.');
    }
  };

  // Photo Input change preview handler
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full relative">
      
      {/* Toast Alert Banner */}
      {toast.message && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center space-x-3 border transition-all duration-300 transform translate-y-0 ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-cyber-pink/10 border-cyber-pink/20 text-cyber-pink'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-xs font-bold uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-5 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center space-x-3">
            <Users className="w-8 h-8 text-cyber-blue" />
            <span>Registered Students</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse and manage all enrolled student biometric profiles, adjust details, and trigger promotions.
          </p>
        </div>

        {isAdmin() && (
          <button
            onClick={handlePromoteStudents}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyber-blue hover:from-cyber-blue hover:to-cyan-500 text-white font-bold tracking-wider uppercase text-xs shadow-md hover:shadow-glow/30 transition-all duration-300 transform active:scale-95 flex items-center space-x-2 self-start md:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>Promote All Students</span>
          </button>
        )}
      </div>

      {/* Telemetry Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Students */}
        <div className="cyber-card bg-gradient-to-br from-blue-500/10 to-cyber-blue/5 border border-cyber-blue/20 p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Total Registered</p>
              <h3 className="text-3xl font-extrabold mt-1 text-slate-800 dark:text-white">
                {statsLoading ? '...' : stats.totalStudents}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-3">Enrolled in facial identity models</p>
        </div>

        {/* Total Departments */}
        <div className="cyber-card bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-purple-500/20 p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Total Departments</p>
              <h3 className="text-3xl font-extrabold mt-1 text-slate-800 dark:text-white">
                {statsLoading ? '...' : stats.totalDepartments}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <School className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-3">Active college disciplines</p>
        </div>

        {/* Today's Attendance Present */}
        <div className="cyber-card bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Present Today</p>
              <h3 className="text-3xl font-extrabold mt-1 text-slate-850 dark:text-emerald-400">
                {statsLoading ? '...' : stats.todayPresentCount}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-3">Checked-in students today</p>
        </div>

        {/* Today's Attendance Percentage */}
        <div className="cyber-card bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Attendance Rate</p>
              <h3 className="text-3xl font-extrabold mt-1 text-slate-850 dark:text-amber-400">
                {statsLoading ? '...' : `${stats.todayAttendanceRate}%`}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full" 
              style={{ width: `${stats.todayAttendanceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Table Panel */}
      <div className="cyber-card bg-white dark:bg-slate-900/60 p-6 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl space-y-6">
        
        {/* Dynamic Filters Area */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-cyber-blue" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter parameters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 lg:max-w-4xl justify-end">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Name or USN..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset page on filter
                }}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-cyber-blue transition-all duration-200"
              />
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white outline-none cursor-pointer focus:border-cyber-blue"
            >
              <option value="All Departments">All Departments</option>
              <option value="CSE">CSE (Computer Science)</option>
              <option value="ISE">ISE (Information Science)</option>
              <option value="CSE(AIML)">CSE (AIML)</option>
              <option value="AIDS">AIDS (Artificial Intelligence & Data Science)</option>
              <option value="ECE">ECE (Electronics & Comm)</option>
              <option value="EEE">EEE (Electrical & Electronics)</option>
            </select>

            {/* Semester Filter */}
            <select
              value={selectedSem}
              onChange={(e) => {
                setSelectedSem(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white outline-none cursor-pointer focus:border-cyber-blue"
            >
              <option value="All Semesters">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 'Graduated'].map((s) => (
                <option key={s} value={s.toString()}>
                  {s === 'Graduated' ? 'Graduated' : `Semester ${s}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Students Table */}
        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-cyber-blue space-y-4">
              <RefreshCw className="w-10 h-10 animate-spin" />
              <span className="text-xs font-bold tracking-widest uppercase animate-pulse">Querying Database...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-3">
              <Users className="w-12 h-12 opacity-35 text-slate-500" />
              <h4 className="font-bold text-slate-700 dark:text-slate-350">No Enrolled Students Found</h4>
              <p className="text-xs max-w-sm text-slate-500 dark:text-slate-400">
                Adjust your filters or register a new student using the sidebar navigation.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-4">Student Photo</th>
                  <th scope="col" className="px-6 py-4">Name</th>
                  <th scope="col" className="px-6 py-4">USN</th>
                  <th scope="col" className="px-6 py-4">Department</th>
                  <th scope="col" className="px-6 py-4">Semester</th>
                  <th scope="col" className="px-6 py-4">Admission Year</th>
                  <th scope="col" className="px-6 py-4">Reg Date</th>
                  {isAdmin() && <th scope="col" className="px-6 py-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => (
                  <tr 
                    key={student._id} 
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-150"
                  >
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/50 overflow-hidden flex items-center justify-center">
                        {student.imageUrl ? (
                          <img 
                            src={student.imageUrl} 
                            alt={student.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = ''; // Clear source to fallback to initials
                            }}
                          />
                        ) : (
                          <div className="text-xs font-bold text-cyber-blue uppercase tracking-widest">
                            {student.name.substring(0, 2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-white">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-cyber-blue text-xs uppercase">
                      {student.usn}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                      {student.department || student.dept}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${
                        student.semester === 'Graduated'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-700'
                      }`}>
                        {student.semester === 'Graduated' ? 'Graduated' : `Sem ${student.semester}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {student.admissionYear || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">
                      {new Date(student.registeredAt || student.createdAt).toLocaleDateString()}
                    </td>
                    {isAdmin() && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-3">
                          <button
                            onClick={() => openEditModal(student)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all duration-200"
                            title="Edit student details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student._id, student.name)}
                            className="p-1.5 rounded-lg bg-cyber-pink/10 text-cyber-pink hover:bg-cyber-pink/20 border border-cyber-pink/20 transition-all duration-200"
                            title="Delete student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Toolbar */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              Showing page {page} of {pages} ({totalStudentsCount} total records)
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-all duration-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {[...Array(pages).keys()].map((num) => (
                <button
                  key={num + 1}
                  onClick={() => setPage(num + 1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                    page === num + 1
                      ? 'bg-cyber-blue text-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-450'
                  }`}
                >
                  {num + 1}
                </button>
              ))}
              <button
                disabled={page >= pages}
                onClick={() => setPage(prev => Math.min(prev + 1, pages))}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-all duration-200 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Student Modal Overlay */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-white/20 dark:border-slate-800/80 shadow-2xl relative">
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white border-b border-slate-200/50 dark:border-slate-800/50 pb-3 flex items-center space-x-2.5">
              <Edit className="w-5 h-5 text-cyber-blue" />
              <span>Edit Student Profile</span>
            </h3>

            <form onSubmit={handleUpdateStudent} className="space-y-4 mt-5">
              
              {/* Photo Input Picker with Preview Thumbnail */}
              <div className="flex items-center space-x-4 pb-2">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                  {editPhotoPreview ? (
                    <img 
                      src={editPhotoPreview} 
                      alt="edit preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Users className="w-8 h-8 text-slate-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block">
                    Update Face Photo (Optional)
                  </label>
                  <label className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyber-blue bg-white/50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 text-xs font-semibold flex items-center space-x-2 cursor-pointer transition-all duration-200">
                    <Upload className="w-4 h-4" />
                    <span>Upload Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoChange} 
                      className="hidden" 
                    />
                  </label>
                  <span className="text-[9px] text-slate-500 block">
                    Uploading a new photo will automatically update the facial embedding vector.
                  </span>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-455">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white outline-none focus:border-cyber-blue text-sm transition-all duration-200"
                />
              </div>

              {/* USN */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-455">USN / Roll Number</label>
                <input
                  type="text"
                  required
                  value={editUsn}
                  onChange={(e) => setEditUsn(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white outline-none focus:border-cyber-blue text-sm font-mono transition-all duration-200 uppercase"
                />
              </div>

              {/* Department, Semester & Admission Year */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-455">Dept</label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white text-xs outline-none focus:border-cyber-blue cursor-pointer"
                  >
                    <option value="CSE">CSE</option>
                    <option value="ISE">ISE</option>
                    <option value="CSE(AIML)">CSE(AIML)</option>
                    <option value="AIDS">AIDS</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-455">Semester</label>
                  <select
                    value={editSem}
                    onChange={(e) => setEditSem(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white text-xs outline-none focus:border-cyber-blue cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 'Graduated'].map((s) => (
                      <option key={s} value={s.toString()}>
                        {s === 'Graduated' ? 'Graduated' : `Sem ${s}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-455">Year</label>
                  <input
                    type="number"
                    required
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-white text-xs outline-none focus:border-cyber-blue"
                  />
                </div>
              </div>

              {/* Edit submit action buttons */}
              <div className="flex space-x-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-655 dark:text-slate-300 font-bold tracking-wider text-xs uppercase transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyber-blue to-cyan-500 hover:from-cyan-500 hover:to-cyber-blue text-white font-bold tracking-wider text-xs uppercase shadow-md hover:shadow-glow/30 flex items-center justify-center space-x-2 transition-all duration-300 disabled:opacity-50"
                >
                  {editLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>UPDATING EMBEDDING...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisteredStudents;
