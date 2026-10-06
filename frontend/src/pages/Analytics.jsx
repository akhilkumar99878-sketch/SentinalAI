import { useState, useEffect } from 'react';
import { analyticsService, userService } from '../services/services';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, RefreshCw, TrendingUp, ShieldCheck, Users2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e'];
const TABS = ['Overview', 'Workers', 'Hourly'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [ppeBreakdown, setPpeBreakdown] = useState([]);
  const [cameraStats, setCameraStats] = useState([]);
  const [workerStats, setWorkerStats] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [o, t, p, c, w, h] = await Promise.all([
        analyticsService.overview(),
        analyticsService.trends(days),
        analyticsService.ppeBreakdown(days),
        analyticsService.cameraStats(),
        analyticsService.workerStats(days),
        analyticsService.hourlyViolations(days),
      ]);
      setOverview(o.data);
      setTrends(t.data || []);
      setPpeBreakdown(p.data || []);
      setCameraStats(c.data || []);
      setWorkerStats(w.data || []);
      setHourlyData(h.data || []);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [days]);

  const safetyColor = overview?.safety_score >= 80 ? 'text-green-600 dark:text-green-400'
    : overview?.safety_score >= 60 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Safety performance metrics from PostgreSQL</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="input w-auto" value={days} onChange={e => setDays(+e.target.value)}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Compliance Rate', value: overview?.compliance_rate != null ? `${overview.compliance_rate}%` : '—', icon: ShieldCheck, color: 'text-green-600 dark:text-green-400' },
          { label: 'Safety Score', value: overview?.safety_score != null ? `${overview.safety_score}/100` : '—', icon: TrendingUp, color: safetyColor },
          { label: 'Total Incidents', value: overview?.total_incidents ?? '—', icon: BarChart3, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Open Incidents', value: overview?.open_incidents ?? '—', icon: BarChart3, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={clsx('text-2xl font-bold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {tab === 'Workers' && <span className="inline-flex items-center gap-1.5"><Users2 className="w-3.5 h-3.5" />{tab}</span>}
            {tab === 'Hourly' && <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{tab}</span>}
            {tab === 'Overview' && tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Violation Trend */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Violation Trend</h3>
            {trends.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data available for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="violations" name="Violations" stroke="#ef4444" fill="url(#g1)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* PPE Breakdown */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">PPE Violation Breakdown</h3>
            {ppeBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No violations in this period</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie data={ppeBreakdown} dataKey="count" nameKey="ppe_item" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                      {ppeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {ppeBreakdown.map((item, i) => (
                    <div key={item.ppe_item} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-700 dark:text-slate-300 capitalize">{item.ppe_item}</span>
                      <span className="text-slate-400 ml-auto">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Camera Stats */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Camera Performance</h3>
            {cameraStats.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No camera data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cameraStats} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} />
                  <XAxis dataKey="camera_name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="violations" name="Violations" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Workers Tab */}
      {activeTab === 'Workers' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Worker Compliance</h3>
              <p className="text-xs text-slate-400 mt-0.5">Violation count per registered worker in the last {days} days</p>
            </div>
          </div>
          {workerStats.length === 0 ? (
            <div className="p-12 text-center">
              <Users2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No worker records found. Add workers in the Workers page.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      {['Code', 'Name', 'Department', 'Violations', 'Est. Compliance'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {workerStats.map(w => (
                      <tr key={w.worker_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{w.worker_code}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{w.name}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{w.department}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'text-sm font-bold',
                            w.violations === 0 ? 'text-green-600 dark:text-green-400' :
                            w.violations <= 2 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          )}>
                            {w.violations}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-[80px]">
                              <div
                                className={clsx('h-full rounded-full transition-all', w.compliance_rate >= 80 ? 'bg-green-500' : w.compliance_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500')}
                                style={{ width: `${w.compliance_rate}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 w-10">{w.compliance_rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Bar chart summary */}
              <div className="p-5 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Violations by Worker</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={workerStats} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="violations" name="Violations" fill="#f97316" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hourly Tab */}
      {activeTab === 'Hourly' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Violations by Hour of Day</h3>
            <p className="text-xs text-slate-400 mb-4">When violations happen most — last {days} days</p>
            {hourlyData.every(h => h.violations === 0) ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No violation data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hourlyData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="violations" name="Violations" radius={[3, 3, 0, 0]}>
                    {hourlyData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.violations === 0 ? '#334155' :
                          entry.violations >= Math.max(...hourlyData.map(h => h.violations)) * 0.8 ? '#ef4444' :
                          entry.violations >= Math.max(...hourlyData.map(h => h.violations)) * 0.4 ? '#f97316' : '#3b82f6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Peak hours summary */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Peak Violation Hours</h3>
            <div className="grid grid-cols-3 gap-3">
              {[...hourlyData]
                .sort((a, b) => b.violations - a.violations)
                .slice(0, 3)
                .map((h, i) => (
                  <div key={h.hour} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">#{i + 1} Peak</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{h.label}</p>
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">{h.violations} violation{h.violations !== 1 ? 's' : ''}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Formula note */}
      {overview?.formula && activeTab === 'Overview' && (
        <div className="card p-4 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400"><span className="font-medium text-slate-700 dark:text-slate-300">Safety Score Formula: </span>{overview.formula}</p>
        </div>
      )}
    </div>
  );
}
