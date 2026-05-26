import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, 
  ScanFace, 
  UserPlus, 
  ClipboardList, 
  ShieldAlert, 
  LogOut, 
  Sun, 
  Moon, 
  Activity,
  FileSpreadsheet
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher'] },
    { to: '/attendance-scan', label: 'Scan Terminal', icon: ScanFace, roles: ['admin', 'teacher'] },
    { to: '/register-student', label: 'Register Student', icon: UserPlus, roles: ['admin'] },
    { to: '/bulk-import', label: 'Bulk Import', icon: FileSpreadsheet, roles: ['admin'] },
    { to: '/attendance-records', label: 'Records List', icon: ClipboardList, roles: ['admin', 'teacher'] },
    { to: '/security-alerts', label: 'Security Alerts', icon: ShieldAlert, roles: ['admin', 'teacher'] },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-200/50 dark:border-slate-800/50 min-h-screen flex flex-col justify-between p-4 transition-all duration-300">
      <div className="flex flex-col space-y-8">
        {/* Brand/Logo Area */}
        <div className="flex items-center space-x-3 px-2 py-4 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyber-blue to-cyber-pink flex items-center justify-center shadow-lg dark:shadow-glow/30">
            <ScanFace className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wider text-slate-800 dark:text-white bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              SmartFace
            </h1>
            <div className="flex items-center space-x-1 text-[10px] text-cyber-blue font-bold tracking-widest uppercase">
              <Activity className="w-2.5 h-2.5 animate-pulse" />
              <span>IOT READY</span>
            </div>
          </div>
        </div>

        {/* User Card Profile */}
        {user && (
          <div className="mx-2 p-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/30 dark:border-slate-800/30">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Logged in as</p>
            <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{user.name}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
              user.role === 'admin' 
                ? 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20' 
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            }`}>
              {user.role}
            </span>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex flex-col space-y-1">
          {links.map((link) => {
            // Check if user role matches allowed roles for link
            if (user && !link.roles.includes(user.role)) return null;

            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyber-blue/20 to-cyber-blue/5 text-cyber-blue border-l-4 border-cyber-blue shadow-glow/10 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-white'
                  }`
                }
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Settings Bottom Area */}
      <div className="flex flex-col space-y-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-200"
        >
          <div className="flex items-center space-x-3">
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {theme}
          </span>
        </button>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium text-cyber-pink hover:bg-cyber-pink/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
