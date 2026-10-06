import { useState, useEffect } from 'react';
import { incidentService, violationService, userService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { Filter, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Image, X, Trash2, UserCheck } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_OPTIONS = ['', 'OPEN', 'ASSIGNED', 'INVESTIGATING', 'RESOLVED'];
const SEVERITY_OPTIONS = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const statusBadge = { OPEN: 'badge-open', ASSIGNED: 'badge-assigned', INVESTIGATING: 'badge-investigating', RESOLVED: 'badge-resolved' };
const severityBadge = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };

const API = import.meta.env.VITE_API_URL || 'http://localhost:8081';

export default function Incidents() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [selected, setSelected] = useState(null);
  const [violations, setViolations] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [users, setUsers] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, size: 15 };
      if (status) params.status = status;
      if (severity) params.severity = severity;
      const { data } = await incidentService.list(params);
      setIncidents(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch { toast.error('Failed to load incidents'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, status, severity]);

  // When an incident is selected, load its violations for evidence photos
  useEffect(() => {
    if (!selected) { setViolations([]); return; }
    violationService.list({ incident_id: selected.id, size: 5 })
      .then(r => setViolations(r.data?.items || []))
      .catch(() => setViolations([]));
  }, [selected?.id]);

  // Load users list for assign dropdown
  useEffect(() => {
    userService.list().then(r => setUsers(r.data || [])).catch(() => {});
  }, []);

  const updateStatus = async (id, newStatus) => {
    setUpdating(true);
    try {
      await incidentService.update(id, { status: newStatus });
      toast.success(`Incident ${newStatus.toLowerCase()}`);
      load();
      if (selected?.id === id) setSelected(s => ({ ...s, status: newStatus }));
    } catch { toast.error('Update failed'); }
    finally { setUpdating(false); }
  };

  const assignUser = async (incidentId, userId) => {
    setAssigning(true);
    try {
      const updated = await incidentService.assign(incidentId, userId || undefined);
      toast.success(userId ? 'Incident assigned' : 'Assignment removed');
      load();
      if (selected?.id === incidentId) setSelected(s => ({ ...s, assigned_to: userId || null, status: updated.data?.status || s.status }));
    } catch { toast.error('Assign failed'); }
    finally { setAssigning(false); }
  };

  const deleteIncident = async (id) => {
    if (!window.confirm('Delete this incident permanently?')) return;
    setDeleting(true);
    try {
      await incidentService.delete(id);
      toast.success('Incident deleted');
      setSelected(null);
      load();
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Incidents</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{total} total incidents</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Filters:</span>
        </div>
        <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}>
          <option value="">All Severities</option>
          {SEVERITY_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(status || severity) && (
          <button onClick={() => { setStatus(''); setSeverity(''); setPage(1); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2 card overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />)}
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No incidents found</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">No incidents match your current filters</p>
              {(status || severity) && (
                <button onClick={() => { setStatus(''); setSeverity(''); }} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      {['ID', 'Description', 'Severity', 'Status', 'Time', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {incidents.map(inc => (
                      <tr
                        key={inc.id}
                        onClick={() => setSelected(inc)}
                        className={clsx('hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors',
                          selected?.id === inc.id && 'bg-blue-50 dark:bg-blue-900/20')}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{inc.id.slice(0, 8)}…</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">{inc.description || '—'}</td>
                        <td className="px-4 py-3"><span className={severityBadge[inc.severity] || 'badge-medium'}>{inc.severity}</span></td>
                        <td className="px-4 py-3"><span className={statusBadge[inc.status] || 'badge-open'}>{inc.status}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {inc.created_at ? formatDistanceToNow(new Date(inc.created_at), { addSuffix: true }) : '—'}
                        </td>
                        <td className="px-4 py-3"><span className="text-blue-600 dark:text-blue-400 text-xs hover:underline">View</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500">Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-2 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-secondary p-2 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        <div className="card p-5 overflow-y-auto max-h-[72vh]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-center text-slate-400 min-h-40">
              <div>
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Select an incident to view details</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Incident Details</p>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Incident ID</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300 mt-1 break-all">{selected.id}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className={severityBadge[selected.severity] || 'badge-medium'}>{selected.severity}</span>
                <span className={statusBadge[selected.status] || 'badge-open'}>{selected.status}</span>
              </div>

              {selected.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{selected.description}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Created</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {selected.created_at ? format(new Date(selected.created_at), 'MMM d, yyyy HH:mm:ss') : '—'}
                </p>
              </div>

              {selected.resolved_at && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resolved At</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                    {format(new Date(selected.resolved_at), 'MMM d, yyyy HH:mm:ss')}
                  </p>
                </div>
              )}

              {/* Evidence Photos */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Evidence Photos {violations.length > 0 ? `(${violations.length})` : ''}
                </p>
                {violations.length === 0 ? (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3">
                    <Image className="w-4 h-4 flex-shrink-0" />
                    <span>No violation records linked to this incident</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {violations.map((v, i) => (
                      <div key={v.id || i} className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        {v.evidence_path ? (
                          <img
                            src={`${API}${v.evidence_path}`}
                            alt={`Evidence ${i + 1}`}
                            className="w-full object-cover max-h-52"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="h-20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Image className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 space-y-0.5">
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Missing: <span className="text-red-600 dark:text-red-400 font-semibold">
                              {Array.isArray(v.missing_ppe) ? v.missing_ppe.join(', ') : v.missing_ppe || '—'}
                            </span>
                          </p>
                          {v.confidence != null && (
                            <p className="text-xs text-slate-400">Confidence: {(v.confidence * 100).toFixed(0)}%</p>
                          )}
                          {v.detected_at && (
                            <p className="text-xs text-slate-400">{format(new Date(v.detected_at), 'MMM d, yyyy HH:mm')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign to User */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" /> Assign To
                </p>
                <select
                  className="input w-full text-sm"
                  value={selected.assigned_to || ''}
                  onChange={e => assignUser(selected.id, e.target.value)}
                  disabled={assigning}
                >
                  <option value="">— Unassigned —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              {/* Status Actions */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Update Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.filter(Boolean).map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selected.id, s)}
                      disabled={selected.status === s || updating}
                      className={clsx('text-xs py-1.5 px-2 rounded-lg border transition-colors font-medium',
                        selected.status === s
                          ? 'bg-blue-600 text-white border-blue-600 cursor-default'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete (Admin only) */}
              {isAdmin && (
                <button
                  onClick={() => deleteIncident(selected.id)}
                  disabled={deleting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete Incident
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
