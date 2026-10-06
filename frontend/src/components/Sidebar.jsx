import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Video, AlertTriangle, ShieldAlert,
  Camera, Users2, BarChart3, FileText, Users, Settings,
  Shield, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Live Monitor', path: '/monitor', icon: Video },
  { label: 'Incidents', path: '/incidents', icon: AlertTriangle },
  { label: 'Violations', path: '/violations', icon: ShieldAlert },
  { label: 'Cameras', path: '/cameras', icon: Camera },
  { label: 'Workers', path: '/workers', icon: Users2 },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Reports', path: '/reports', icon: FileText },
];

const adminItems = [
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar({ open, setOpen }) {
  const { user } = useAuth();

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-slate-900 dark:bg-slate-950 border-r border-slate-700/50 transition-all duration-300 flex-shrink-0',
        open ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {open && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-none">SentinelAI</p>
              <p className="text-slate-400 text-xs mt-0.5 truncate">Safety Monitor</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors flex-shrink-0"
        >
          {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
              )
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        {user?.role === 'ADMIN' && (
          <>
            <div className={clsx('mt-4 mb-2', open ? 'px-2' : 'hidden')}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
                  )
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {open && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      {user && (
        <div className="p-3 border-t border-slate-700/50">
          <div className={clsx('flex items-center gap-3', !open && 'justify-center')}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            {open && (
              <div className="overflow-hidden">
                <p className="text-slate-200 text-xs font-medium truncate">{user.name}</p>
                <p className="text-slate-500 text-xs truncate">{user.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
