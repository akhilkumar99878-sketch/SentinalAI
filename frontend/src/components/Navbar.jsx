import { useState, useEffect, useRef } from 'react';
import { Menu, Bell, Sun, Moon, LogOut, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { notificationService } from '../services/services';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  // Load notifications on mount + every 60 seconds
  useEffect(() => {
    const fetchNotifs = () =>
      notificationService.list().then(r => setNotifications(r.data)).catch(() => {});
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for live alerts
  useEffect(() => {
    const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:8081') + '/ws/alerts';
    let ws;
    let reconnectTimer;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'violation') {
              const missing = Array.isArray(data.missing_ppe)
                ? data.missing_ppe.join(', ')
                : 'PPE';
              toast.error(`⚠️ Violation: Missing ${missing}`, { duration: 6000 });
              setNotifications(prev => [{
                id: data.incident_id || Date.now().toString(),
                title: 'PPE Violation Detected',
                message: data.message || `Missing: ${missing}`,
                type: 'VIOLATION',
                is_read: false,
                incident_id: data.incident_id,
                created_at: data.timestamp || new Date().toISOString(),
              }, ...prev]);
            }
          } catch {}
        };
        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {}
    };
    connect();
    return () => { ws?.close(); clearTimeout(reconnectTimer); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifications.filter(n => !n.is_read).length;

  const handleMarkAll = async () => {
    await notificationService.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-4 flex-shrink-0">
      <button onClick={onMenuClick} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1">
        <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:block">
          Industrial Safety Monitoring Platform
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button onClick={toggle} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(s => !s)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 card z-50 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-sm">Notifications</span>
                {unread > 0 && (
                  <button onClick={handleMarkAll} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">No notifications</div>
                ) : notifications.slice(0, 10).map((n, i) => (
                  <div
                    key={n.id || i}
                    onClick={() => { if (n.incident_id) navigate('/incidents'); setShowNotifs(false); }}
                    className={`px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.is_read ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.message}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{user?.name}</p>
            <p className="text-[11px] text-slate-400">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
