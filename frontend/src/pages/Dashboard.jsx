import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsService, incidentService, cameraService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import {
  Users2, Camera, ShieldAlert, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw, Activity, ShieldQuestion,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';

function StatCard({ icon: Icon, label, value, sub, color, trend }) {
  const hasValue = value !== null && value !== undefined && value !== '—';

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className={clsx('text-2xl font-bold mt-1', hasValue ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')}>
            {hasValue ? value : '—'}
          </p>
          {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className="mt-3 flex items-center gap-1">
          {trend >= 0
            ? <TrendingUp className="w-3 h-3 text-green-500" />
            : <TrendingDown className="w-3 h-3 text-red-500" />}
          <span className={clsx('text-xs font-medium', trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {Math.abs(trend)}% vs last week
          </span>
        </div>
      )}
    </div>
  );
}

const statusBadge = {
  OPEN: 'badge-open', ASSIGNED: 'badge-assigned',
  INVESTIGATING: 'badge-investigating', RESOLVED: 'badge-resolved',
};
const severityBadge = {
  CRITICAL: 'badge-critical', HIGH: 'badge-high',
  MEDIUM: 'badge-medium', LOW: 'badge-low',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const load = async () => {
    try {
      const [s, t, i, c] = await Promise.all([
        analyticsService.overview(),
        analyticsService.trends(14),
        incidentService.list({ size: 5 }),
        cameraService.list(),
      ]);
      setStats(s.data);
      setTrends(t.data || []);
      setIncidents(i.data.items || []);
      setCameras(c.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      setRefreshing(true);
      load();
    }, 30000);
    return () => clearInterval(interval);
  }, []);


  const refresh = () => { setRefreshing(true); load(); };

  if (loading) return (
    <div className="space-y-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, j) => (
            <div key={j} className="card p-5 animate-pulse h-24 bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      ))}
    </div>
  );

  const hasSafetyScore = stats?.safety_score !== null && stats?.safety_score !== undefined;
  const safetyColor = hasSafetyScore
    ? (stats.safety_score >= 80 ? 'text-green-600 dark:text-green-400'
      : stats.safety_score >= 60 ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400')
    : 'text-slate-400 dark:text-slate-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Here's your real-time safety overview · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Users2}
          label="Workers Monitored"
          value={stats?.total_workers}
          sub={stats?.total_workers !== null && stats?.total_workers !== undefined ? 'Active / monitored' : 'Waiting for detection data'}
          color="bg-blue-600"
        />
        <StatCard
          icon={Camera}
          label="Active Cameras"
          value={stats?.active_cameras}
          sub={stats?.active_cameras !== null && stats?.active_cameras !== undefined ? `of ${cameras.length} configured` : 'No cameras configured'}
          color="bg-indigo-600"
        />
        <StatCard
          icon={ShieldAlert}
          label="Today's Violations"
          value={stats?.today_violations}
          sub={stats?.today_violations !== null && stats?.today_violations !== undefined ? 'PPE violations' : 'No detection data available'}
          color="bg-red-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="PPE Compliance"
          value={stats?.compliance_rate !== null && stats?.compliance_rate !== undefined ? `${stats.compliance_rate}%` : null}
          sub={stats?.compliance_rate !== null && stats?.compliance_rate !== undefined ? 'Calculated from detections' : 'Waiting for PPE analysis'}
          color="bg-green-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Open Incidents"
          value={stats?.open_incidents}
          sub={stats?.open_incidents !== null && stats?.open_incidents !== undefined ? `${stats?.total_incidents ?? 0} total` : 'No incident data available'}
          color="bg-orange-600"
        />
      </div>

      {/* Safety Score */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Overall Safety Score</p>
          </div>
          <span className={clsx('text-2xl font-bold', safetyColor)}>
            {hasSafetyScore ? `${stats.safety_score}/100` : '—'}
          </span>
        </div>
        
        {hasSafetyScore ? (
          <>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
              <div
                className={clsx('h-full rounded-full transition-all duration-500',
                  stats.safety_score >= 80 ? 'bg-green-500' : stats.safety_score >= 60 ? 'bg-yellow-500' : 'bg-red-500')}
                style={{ width: `${stats.safety_score}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{stats.formula}</p>
          </>
        ) : (
          <div className="mt-2 py-1">
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full" />
            <p className="text-xs text-slate-400 mt-2">Waiting for safety detection data · score is calculated dynamically from real compliance and incident rates.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Violation Trend Chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Violation Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last 14 days</p>
            </div>
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          {trends.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm">
              <Activity className="w-8 h-8 mb-2 opacity-30" />
              No violation data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trends} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="violations" stroke="#3b82f6" fill="url(#violGrad)" strokeWidth={2} dot={false} name="Violations" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Camera Status */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Camera Status</h3>
          {cameras.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm">
              <Camera className="w-8 h-8 mb-2 opacity-30" />
              No cameras configured.
            </div>
          ) : (
            <div className="space-y-2">
              {cameras.slice(0, 6).map(cam => (
                <div key={cam.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                      cam.status === 'ONLINE' ? 'bg-green-500' : cam.status === 'ERROR' ? 'bg-red-500' : 'bg-slate-400'
                    )} />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{cam.name}</span>
                  </div>
                  <span className={clsx('text-xs font-medium',
                    cam.status === 'ONLINE' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'
                  )}>{cam.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Recent Incidents</h3>
          <button onClick={() => navigate('/incidents')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View all</button>
        </div>
        {incidents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-40" />
            No incidents recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['ID', 'Description', 'Severity', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {incidents.map(inc => (
                  <tr key={inc.id} onClick={() => navigate('/incidents')} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{inc.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">{inc.description || '—'}</td>
                    <td className="px-5 py-3"><span className={severityBadge[inc.severity] || 'badge-medium'}>{inc.severity}</span></td>
                    <td className="px-5 py-3"><span className={statusBadge[inc.status] || 'badge-open'}>{inc.status}</span></td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {inc.created_at ? formatDistanceToNow(new Date(inc.created_at), { addSuffix: true }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
