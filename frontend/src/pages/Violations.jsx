import { useState, useEffect } from 'react';
import { violationService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ChevronLeft, ChevronRight, RefreshCw, Download, Trash2, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

function downloadCSV(violations) {
  const rows = [
    ['ID', 'Type', 'Missing PPE', 'Confidence', 'Camera ID', 'Detected At'],
    ...violations.map(v => [
      v.id,
      v.violation_type,
      (v.missing_ppe || []).join('; '),
      v.confidence ? (v.confidence * 100).toFixed(1) + '%' : '',
      v.camera_id || '',
      v.detected_at ? format(new Date(v.detected_at), 'yyyy-MM-dd HH:mm:ss') : '',
    ])
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `violations_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Violations() {
  const { user } = useAuth();
  const [violations, setViolations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await violationService.list({ page, size: 15 });
      setViolations(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch { toast.error('Failed to load violations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this violation? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await violationService.delete(id);
      toast.success('Violation deleted');
      if (selected?.id === id) setSelected(null);
      load();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Violations</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{total} PPE violations recorded</p>
        </div>
        <div className="flex items-center gap-2">
          {violations.length > 0 && (
            <button onClick={() => downloadCSV(violations)} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />)}
            </div>
          ) : violations.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldAlert className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No violations recorded</p>
              <p className="text-slate-400 text-sm mt-1">Violations appear after YOLOv11 detects PPE non-compliance</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      {['ID', 'Missing PPE', 'Confidence', 'Detected At', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {violations.map(v => (
                      <tr key={v.id} onClick={() => setSelected(v)}
                        className={clsx('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                          selected?.id === v.id && 'bg-red-50 dark:bg-red-900/10')}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{v.id.slice(0, 8)}…</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(v.missing_ppe || []).map(p => (
                              <span key={p} className="badge-critical text-[11px] capitalize">{p}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {v.confidence ? `${(v.confidence * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {v.detected_at ? formatDistanceToNow(new Date(v.detected_at), { addSuffix: true }) : '—'}
                        </td>
                        <td className="px-4 py-3"><span className="text-blue-600 dark:text-blue-400 text-xs hover:underline">View</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500">Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-2 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-secondary p-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail */}
        <div className="card p-5 overflow-y-auto max-h-[70vh]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-center text-slate-400 min-h-40">
              <div><ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">Select a violation to view details</p></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Violation Details</p>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">ID</p>
                <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-1 break-all">{selected.id}</p></div>

              <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{selected.violation_type}</p></div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Missing PPE</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(selected.missing_ppe || []).map(p => (
                    <span key={p} className="badge-critical capitalize">{p}</span>
                  ))}
                </div>
              </div>

              {selected.confidence && (
                <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Confidence</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{(selected.confidence * 100).toFixed(1)}%</p></div>
              )}

              {selected.camera_id && (
                <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Camera ID</p>
                  <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-1 break-all">{selected.camera_id}</p></div>
              )}

              <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Detected At</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {selected.detected_at ? format(new Date(selected.detected_at), 'MMM d, yyyy HH:mm:ss') : '—'}
                </p></div>

              {selected.evidence_path && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Evidence Photo</p>
                  <img
                    src={`${API_URL}/storage/${selected.evidence_path.split('storage/').pop()}`}
                    alt="Evidence"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              {isAdmin && (
                <button
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete Violation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
