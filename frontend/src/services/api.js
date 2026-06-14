import axios from 'axios';

// API services mapping endpoints to backend
const api = {
  // Auth Operations
  auth: {
    login: (email, password) => axios.post('/api/auth/login', { email, password }),
    register: (name, email, password, role) => axios.post('/api/auth/register', { name, email, password, role }),
    getProfile: () => axios.get('/api/auth/me'),
  },

  // Student Operations
  students: {
    getAll: (params) => axios.get('/api/students', { params }),
    getById: (id) => axios.get(`/api/students/${id}`),
    getFaceCache: () => axios.get('/api/students/face-cache/all'),
    register: (studentData) => axios.post('/api/students', studentData),
    update: (id, studentData) => axios.put(`/api/students/${id}`, studentData),
    delete: (id) => axios.delete(`/api/students/${id}`),
    getStats: () => axios.get('/api/students/stats'),
    promote: () => axios.post('/api/students/promote'),
    bulkImport: (formData, onUploadProgress) => 
      axios.post('/api/students/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress
      }),
  },

  // Attendance Operations
  attendance: {
    mark: (studentId, confidence, markedBy = 'webcam') => 
      axios.post('/api/attendance/mark', { studentId, confidence, markedBy }),
    getLogs: (params) => axios.get('/api/attendance/logs', { params }),
    manualOverride: (studentId, date, status, markedBy = 'manual') => 
      axios.post('/api/attendance/manual', { studentId, date, status, markedBy }),
    getStats: () => axios.get('/api/attendance/dashboard/stats'),
  },

  // Unknown Face Alert Operations
  unknown: {
    getAll: () => axios.get('/api/unknown'),
    log: (imageBase64, confidence, deviceId = 'webcam') => 
      axios.post('/api/unknown', { imageBase64, confidence, deviceId }),
    dismiss: (id) => axios.put(`/api/unknown/${id}/dismiss`),
    delete: (id) => axios.delete(`/api/unknown/${id}`),
  }
};

export default api;
