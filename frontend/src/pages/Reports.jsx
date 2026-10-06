import { useState, useEffect } from 'react';
import { reportService } from '../services/services';
import { FileText, RefreshCw, Calendar, CheckCircle2, ShieldAlert, Download } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const REPORT_TYPES = [
  { id: 'daily', label: 'Daily Report', icon: '📅', fn: 'daily' },
  { id: 'weekly', label: 'Weekly Report', icon: '📊', fn: 'weekly' },
  { id: 'monthly', label: 'Monthly Report', icon: '📈', fn: 'monthly' },
];

function StatRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className={clsx('text-sm font-semibold', color || 'text-slate-900 dark:text-slate-100')}>{value}</span>
    </div>
  );
}

function downloadCSV(report, period) {
  const rows = [
    ['Field', 'Value'],
    ['Report Period', period.toUpperCase()],
    ['Generated At', report.generated_at ? format(new Date(report.generated_at), 'yyyy-MM-dd HH:mm:ss') : ''],
    ['Since', report.since ? format(new Date(report.since), 'yyyy-MM-dd HH:mm:ss') : ''],
    ['Workers Monitored', report.workers_monitored ?? 0],
    ['Active Cameras', report.active_cameras ?? 0],
    ['Compliance Rate (%)', report.compliance_rate ?? 0],
    ['Total Violations', report.total_violations ?? 0],
    ['Total Incidents', report.total_incidents ?? 0],
    ['Resolved Incidents', report.resolved_incidents ?? 0],
    ['Open Incidents', report.open_incidents ?? 0],
  ];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sentinelai_${period}_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeType, setActiveType] = useState('daily');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await reportService[activeType]();
      setReport(data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeType]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Safety performance reports from real data</p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <button
              onClick={() => downloadCSV(report, activeType)}
              className="btn-secondary flex items-center gap-2"
              title="Download as CSV"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2">
        {REPORT_TYPES.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveType(id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeType === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            )}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-48 animate-pulse bg-slate-200 dark:bg-slate-700" />)}
        </div>
      ) : !report ? (
        <div className="card p-12 text-center"><FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No report data</p></div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {activeType.charAt(0).toUpperCase() + activeType.slice(1)} Safety Report
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Period: {report.since ? format(new Date(report.since), 'MMM d, yyyy') : '—'} — {report.generated_at ? format(new Date(report.generated_at), 'MMM d, yyyy HH:mm') : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-medium">{report.period}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overview */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Overview</h3>
              </div>
              <StatRow label="Workers Monitored" value={report.workers_monitored ?? 0} />
              <StatRow label="Active Cameras" value={report.active_cameras ?? 0} />
              <StatRow
                label="Compliance Rate"
                value={`${report.compliance_rate ?? 0}%`}
                color={report.compliance_rate >= 80 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
              />
            </div>

            {/* Violations */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Violations</h3>
              </div>
              <StatRow
                label="Total Violations"
                value={report.total_violations ?? 0}
                color={(report.total_violations ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
              />
            </div>

            {/* Incidents */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-orange-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Incidents</h3>
              </div>
              <StatRow label="Total Incidents" value={report.total_incidents ?? 0} />
              <StatRow label="Resolved" value={report.resolved_incidents ?? 0} color="text-green-600 dark:text-green-400" />
              <StatRow
                label="Open"
                value={report.open_incidents ?? 0}
                color={(report.open_incidents ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
              />
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Report generated at {report.generated_at ? format(new Date(report.generated_at), 'MMMM d, yyyy HH:mm:ss') : '—'}. All data sourced from PostgreSQL database.
              </p>
            </div>
            <button
              onClick={() => downloadCSV(report, activeType)}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
