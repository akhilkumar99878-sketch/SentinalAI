import { useState, useEffect } from 'react';
import { cameraService, locationService } from '../services/services';
import { Camera, Plus, X, Wifi, WifiOff, Loader2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_COLORS = { ONLINE: 'bg-green-500', OFFLINE: 'bg-slate-400', CONNECTING: 'bg-yellow-500', ERROR: 'bg-red-500' };

function CameraModal({ cam, locations, onClose, onSave }) {
  const [form, setForm] = useState(cam || { camera_code: '', name: '', source_type: 'WEBCAM', source_url: '', location_id: '' });
  const [loading, setLoading] = useState(false);
  const f = (k) => (v) => setForm(s => ({ ...s, [k]: typeof v === 'object' ? v.target.value : v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, location_id: form.location_id || undefined };
      if (cam) await cameraService.update(cam.id, payload);
      else await cameraService.create(payload);
      toast.success(cam ? 'Camera updated' : 'Camera added');
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save camera'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{cam ? 'Edit Camera' : 'Add Camera'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Camera Code *</label>
            <input className="input" value={form.camera_code} onChange={f('camera_code')} placeholder="CAM-01" required /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name *</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="Production Floor Camera" required /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Location</label>
            <select className="input" value={form.location_id || ''} onChange={f('location_id')}>
              <option value="">No location</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Source Type</label>
            <select className="input" value={form.source_type} onChange={f('source_type')}>
              {['IMAGE', 'VIDEO', 'WEBCAM', 'RTSP'].map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Source URL</label>
            <input className="input" value={form.source_url || ''} onChange={f('source_url')} placeholder="rtsp:// or 0 for webcam" /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCam, setEditCam] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([cameraService.list(), locationService.list()]);
      setCameras(c.data || []);
      setLocations(l.data || []);
    } catch { toast.error('Failed to load cameras'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteCamera = async (id) => {
    if (!confirm('Delete this camera?')) return;
    try { await cameraService.delete(id); toast.success('Camera deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cameras</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{cameras.length} cameras registered</p>
        </div>
        <button onClick={() => { setEditCam(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Camera
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-slate-200 dark:bg-slate-700" />)}
        </div>
      ) : cameras.length === 0 ? (
        <div className="card p-12 text-center">
          <Camera className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="font-medium text-slate-500 dark:text-slate-400">No cameras registered</p>
          <p className="text-sm text-slate-400 mt-1">Add your first camera to start monitoring</p>
          <button onClick={() => { setEditCam(null); setShowModal(true); }} className="btn-primary mt-4">Add Camera</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map(cam => (
            <div key={cam.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', STATUS_COLORS[cam.status] || 'bg-slate-400')} />
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{cam.name}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 ml-4">{cam.camera_code}</p>
                </div>
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full',
                  cam.status === 'ONLINE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                )}>{cam.status}</span>
              </div>
              <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex justify-between"><span>Type</span><span className="font-medium text-slate-700 dark:text-slate-300">{cam.source_type}</span></div>
                {cam.source_url && <div className="flex justify-between"><span>URL</span><span className="font-mono text-slate-600 dark:text-slate-400 truncate ml-2 max-w-[140px]">{cam.source_url}</span></div>}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => { setEditCam(cam); setShowModal(true); }} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 flex-1 justify-center">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => deleteCamera(cam.id)} className="btn-danger flex items-center gap-1.5 text-xs py-1.5 flex-1 justify-center">
                  <X className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <CameraModal cam={editCam} locations={locations} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}
    </div>
  );
}
