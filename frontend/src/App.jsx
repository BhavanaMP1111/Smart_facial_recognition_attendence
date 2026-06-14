import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RegisterStudent from './pages/RegisterStudent';
import BulkImport from './pages/BulkImport';
import RealTimeAttendance from './pages/RealTimeAttendance';
import AttendanceRecords from './pages/AttendanceRecords';
import UnknownDetections from './pages/UnknownDetections';
import RegisteredStudents from './pages/RegisteredStudents';

// Components
import Sidebar from './components/Sidebar';

// Gate component for protected paths
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { token, user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-cyber-blue font-bold tracking-widest animate-pulse">
        VALIDATING AUTH CREDENTIALS...
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if trying to access admin-only pages without permissions
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Main Layout wrapping sidebar and content panel
const AppLayout = () => {
  return (
    <div className="flex bg-slate-50 dark:bg-cyber-dark min-h-screen transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-y-auto max-h-screen">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/students" element={<RegisteredStudents />} />
          <Route path="/attendance-scan" element={<RealTimeAttendance />} />
          <Route 
            path="/register-student" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <RegisterStudent />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/bulk-import" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <BulkImport />
              </ProtectedRoute>
            } 
          />
          <Route path="/attendance-records" element={<AttendanceRecords />} />
          <Route path="/security-alerts" element={<UnknownDetections />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protect entire layout */}
            <Route 
              path="/*" 
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
