import { useState, useEffect } from 'react';
import { detectionService, userService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import {
  Settings as SettingsIcon, Cpu, HardDrive, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await detectionService.status(); setAiStatus(data); }
    catch { setAiStatus(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const statusColor = aiStatus?.model_loaded ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const statusIcon = aiStatus?.model_loaded
    ? <CheckCircle className="w-5 h-5 text-green-500" />
    : <XCircle className="w-5 h-5 text-red-500" />;

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (!pwForm.current || !pwForm.newPw) { toast.error('Fill in all password fields'); return; }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('New passwords do not match'); return; }
    if (pwForm.newPw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    try {
      await userService.update(user.id, { password: pwForm.newPw });
      toast.success('Password changed successfully');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const toggleShow = (field) => setShowPw(s => ({ ...s, [field]: !s[field] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">AI engine status, system configuration and account settings</p>
      </div>

      {/* AI Status Panel */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">AI Engine Status</h3>
              <p className="text-xs text-slate-400">YOLOv11 detection engine</p>
            </div>
          </div>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />)}</div>
        ) : !aiStatus ? (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">Could not reach backend. Is the FastAPI server running?</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-700/50">
            {[
              { label: 'Status', el: <div className="flex items-center gap-2">{statusIcon}<span className={clsx('text-sm font-semibold', statusColor)}>{aiStatus.status}</span></div> },
              { label: 'Model', el: <span className="text-sm font-medium text-slate-700 dark:text-slate-300">YOLOv11 (Ultralytics)</span> },
              { label: 'Model Path', el: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">{aiStatus.model_path}</code> },
              { label: 'Device', el: <span className="text-sm text-slate-700 dark:text-slate-300">{aiStatus.device}</span> },
              { label: 'Confidence Threshold', el: <span className="text-sm text-slate-700 dark:text-slate-300">{(aiStatus.confidence_threshold * 100).toFixed(0)}%</span> },
              {
                label: 'Model Classes', el: aiStatus.classes?.length > 0 ? (
                  <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                    {aiStatus.classes.map(c => <span key={c} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full capitalize">{c}</span>)}
                  </div>
                ) : <span className="text-xs text-slate-400">Not available</span>
              },
            ].map(({ label, el }) => (
              <div key={label} className="flex items-start justify-between py-3 gap-4">
                <span className="text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
                <div className="text-right">{el}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Not Found Warning */}
      {aiStatus && !aiStatus.model_loaded && (
        <div className="card p-5 border-yellow-300 dark:border-yellow-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-400">YOLOv11 Model Not Found</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Place your trained <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">best.pt</code> file at the configured path:
              </p>
              <code className="block mt-2 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded text-slate-700 dark:text-slate-300">
                {aiStatus.model_path}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Change Password</h3>
            <p className="text-xs text-slate-400">Logged in as <span className="font-medium">{user?.email}</span></p>
          </div>
        </div>

        <form onSubmit={handlePwChange} className="space-y-4 max-w-sm">
          {[
            { key: 'current', label: 'Current Password', placeholder: 'Enter current password' },
            { key: 'newPw', label: 'New Password', placeholder: 'At least 6 characters' },
            { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{label}</label>
              <div className="relative">
                <input
                  type={showPw[key] ? 'text' : 'password'}
                  value={pwForm[key]}
                  onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="input pr-10 w-full"
                  required
                />
                <button
                  type="button"
                  onClick={() => toggleShow(key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          <button type="submit" disabled={pwLoading} className="btn-primary w-full flex items-center justify-center gap-2">
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Configuration Reference */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Configuration Reference</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Set these in your <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">.env</code> file:</p>
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-700 dark:text-slate-300 space-y-1">
          {[
            'MODEL_PATH=./model/best.pt',
            'CONFIDENCE_THRESHOLD=0.35',
            'IOU_THRESHOLD=0.45',
            'IMAGE_SIZE=640',
            'DEVICE=auto',
            'FRAME_SKIP=1',
            'VIOLATION_CONFIRMATION_FRAMES=3',
            'INCIDENT_COOLDOWN_SECONDS=30',
            'REQUIRED_PPE=helmet,vest,gloves',
          ].map(line => <p key={line}>{line}</p>)}
        </div>
      </div>
    </div>
  );
}
