import { useState, useEffect } from 'react';
import { workerService } from '../services/services';
import { Users2, Plus, X, Pencil, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function WorkerModal({ worker, onClose, onSave }) {
  const [form, setForm] = useState(worker || { worker_code: '', name: '', department: '' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(s => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (worker) await workerService.update(worker.id, form);
      else await workerService.create(form);
      toast.success(worker ? 'Worker updated' : 'Worker added');
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{worker ? 'Edit Worker' : 'Add Worker'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Worker Code *</label>
            <input className="input" value={form.worker_code} onChange={f('worker_code')} placeholder="WRK-001" required /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name *</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="Full name" required /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Department</label>
            <input className="input" value={form.department || ''} onChange={f('department')} placeholder="Production, Warehouse..." /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editWorker, setEditWorker] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await workerService.list(); setWorkers(data || []); }
    catch { toast.error('Failed to load workers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteWorker = async (id) => {
    if (!confirm('Delete this worker?')) return;
    try { await workerService.delete(id); toast.success('Worker deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Workers</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{workers.length} workers registered</p>
        </div>
        <button onClick={() => { setEditWorker(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Worker
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />)}</div>
        ) : workers.length === 0 ? (
          <div className="p-12 text-center">
            <Users2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-500 dark:text-slate-400">No workers registered</p>
            <p className="text-sm text-slate-400 mt-1">Add workers to track their PPE compliance history</p>
            <button onClick={() => { setEditWorker(null); setShowModal(true); }} className="btn-primary mt-4">Add Worker</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>{['Code', 'Name', 'Department', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{w.worker_code}</td>
                  <td className="px-5 py-4 font-medium text-slate-800 dark:text-slate-200">{w.name}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{w.department || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', w.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400')}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditWorker(w); setShowModal(true); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteWorker(w.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <WorkerModal worker={editWorker} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}
    </div>
  );
}
