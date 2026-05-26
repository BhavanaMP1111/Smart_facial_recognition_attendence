import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Activity, 
  TrendingUp, 
  Award,
  RefreshCw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await api.attendance.getStats();
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-cyber-blue space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin" />
        <span className="text-sm font-semibold tracking-widest animate-pulse">LOADING TELEMETRY ANALYTICS...</span>
      </div>
    );
  }

  const metrics = stats?.metrics || {
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
    unknownCount: 0,
    attendanceRate: 0,
    lateCount: 0
  };

  const cards = [
    { 
      label: 'TOTAL ENROLLED', 
      value: metrics.totalStudents, 
      desc: 'Registered students in system', 
      icon: Users, 
      color: 'from-blue-500/20 to-cyber-blue/10 border-cyber-blue/30 text-cyber-blue shadow-glow/5' 
    },
    { 
      label: 'PRESENT TODAY', 
      value: metrics.presentCount, 
      desc: `${metrics.lateCount} marked check-ins`, 
      icon: UserCheck, 
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400 shadow-glow-green/5' 
    },
    { 
      label: 'ABSENT TODAY', 
      value: metrics.absentCount, 
      desc: 'Unregistered daily logouts', 
      icon: UserX, 
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-500' 
    },
    { 
      label: 'SECURITY ALERTS', 
      value: metrics.unknownCount, 
      desc: 'Unresolved unknown detections', 
      icon: ShieldAlert, 
      color: metrics.unknownCount > 0 
        ? 'from-cyber-pink/20 to-red-500/10 border-cyber-pink/40 text-cyber-pink animate-pulse' 
        : 'from-slate-500/20 to-slate-800/10 border-slate-700/30 text-slate-400' 
    },
  ];

  return (
    <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header Info */}
      <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Admin Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time identity telemetry, attendance ratios, and security alerts.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={refreshing}
          className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center space-x-2 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-xs font-bold uppercase tracking-wider">Sync Stats</span>
        </button>
      </div>

      {/* Grid of Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            className={`cyber-card bg-gradient-to-br ${card.color} border p-6 flex flex-col justify-between`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase opacity-70">{card.label}</p>
                <h3 className="text-3xl font-extrabold mt-2 tracking-tight">{card.value}</h3>
              </div>
              <div className="p-3 rounded-xl bg-slate-500/5 backdrop-blur-md">
                <card.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs mt-4 font-medium opacity-60 truncate">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Overall Attendance Efficiency Banner */}
      <div className="glass-panel border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyber-blue to-cyber-pink flex items-center justify-center shadow-lg dark:shadow-glow/30">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 dark:text-white">Daily Attendance Ratio</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Marked attendance efficiency across all classes</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{metrics.attendanceRate}%</span>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Efficiency Goal (90%)</p>
          </div>
          <div className="w-32 bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${
                metrics.attendanceRate >= 75 ? 'from-cyber-blue to-cyber-neon' : 'from-cyber-pink to-orange-500'
              }`}
              style={{ width: `${metrics.attendanceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (Columns: 2) */}
        <div className="cyber-card p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-cyber-blue" />
                <span>Last 7 Days Check-ins</span>
              </h4>
              <p className="text-xs text-slate-400">Total present count fluctuations</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-md bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 font-semibold uppercase tracking-wider">Historical Trend</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.attendanceTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.15)" />
                <XAxis dataKey="dayName" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(18, 20, 32, 0.95)', 
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif'
                  }}
                />
                <Area type="monotone" dataKey="present" stroke="#00f0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorPresent)" name="Present" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Statistics Chart (Columns: 1) */}
        <div className="cyber-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyber-neon" />
                <span>Departmental Ratio</span>
              </h4>
              <p className="text-xs text-slate-400">Class present rates comparison</p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.departmentStats || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.15)" />
                <XAxis dataKey="department" stroke="#9ca3af" fontSize={10} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(18, 20, 32, 0.95)', 
                    border: '1px solid rgba(57, 255, 20, 0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif'
                  }}
                />
                <Bar dataKey="rate" fill="#39ff14" radius={[4, 4, 0, 0]} name="Present Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
