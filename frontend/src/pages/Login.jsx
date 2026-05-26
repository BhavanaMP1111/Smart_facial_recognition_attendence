import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ScanFace, Mail, Lock, User, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

const Login = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(email, password);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.message);
        }
      } else {
        const result = await register(name, email, password, role);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.message);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill demo accounts to help evaluation
  const loadDemo = (type) => {
    if (type === 'admin') {
      setEmail('admin@campus.edu');
      setPassword('admin123');
    } else {
      setEmail('teacher@campus.edu');
      setPassword('teacher123');
    }
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-cyber-dark flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-blue/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-pink/10 rounded-full blur-[100px] pointer-events-none animate-pulse delay-700" />

      {/* Main glass card container */}
      <div className="w-full max-w-md glass-panel rounded-3xl shadow-2xl overflow-hidden p-8 border border-white/20 dark:border-cyber-border/40 relative z-10">
        
        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyber-blue to-cyber-pink flex items-center justify-center shadow-lg dark:shadow-glow/30 mb-4 animate-bounce">
            <ScanFace className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {isLogin ? 'Welcome Back Officer' : 'Enroll Officer Account'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            {isLogin 
              ? 'Provide credentials to verify security clearance' 
              : 'Register credentials for SmartFace ID logs'
            }
          </p>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-cyber-pink/10 border border-cyber-pink/20 text-cyber-pink text-xs font-semibold flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Officer Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="officer@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Security Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Authority Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-cyber-blue dark:focus:border-cyber-blue outline-none text-slate-800 dark:text-white transition-all duration-200 cursor-pointer appearance-none"
              >
                <option value="teacher" className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white">Teacher / Registrar</option>
                <option value="admin" className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white">System Administrator</option>
              </select>
            </div>
          )}

          {/* Submit clearance */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-cyber-blue to-cyan-500 hover:from-cyan-500 hover:to-cyber-blue text-white font-bold tracking-wider uppercase text-xs shadow-lg hover:shadow-glow/30 flex items-center justify-center space-x-2 transition-all duration-300 transform active:scale-95 disabled:opacity-50"
          >
            <span>{loading ? 'VERIFYING...' : isLogin ? 'GRANT ACCESS' : 'ENROLL ACCOUNT'}</span>
            {!loading && <ArrowRight className="w-4 h-4 animate-pulse" />}
          </button>
        </form>

        {/* Account Register/Login Toggles */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-cyber-blue dark:hover:text-cyber-blue transition-colors duration-200"
          >
            {isLogin 
              ? "Don't have an officer profile? Register here" 
              : "Already have clearance? Log in here"
            }
          </button>
        </div>

        {/* Demo Fast Access Credentials */}
        {isLogin && (
          <div className="mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center space-x-1.5 mb-3 justify-center text-slate-400">
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Fast Access (Testing Accounts)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => loadDemo('admin')}
                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold uppercase tracking-wider text-cyber-blue border border-slate-200 dark:border-slate-700/50 transition-all duration-200"
              >
                Admin (CRUD Access)
              </button>
              <button
                onClick={() => loadDemo('teacher')}
                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold uppercase tracking-wider text-emerald-500 border border-slate-200 dark:border-slate-700/50 transition-all duration-200"
              >
                Teacher (Read Access)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
