import { useState, useRef, useCallback } from 'react';
import { detectionService, cameraService } from '../services/services';
import { Upload, Video, Camera, Wifi, CheckCircle, XCircle, AlertTriangle, Loader2, Image as ImageIcon, Info, Users2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const TABS = [
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'webcam', label: 'Webcam', icon: Camera },
  { id: 'cctv', label: 'CCTV / RTSP', icon: Wifi },
];

// ── Image Tab ──────────────────────────────────────────────────────────────
function ImageTab() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const dropRef = useRef(null);

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }, []);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await detectionService.analyzeImage(fd);
      if (data.error) {
        if (data.error === 'AI_OFFLINE') {
          toast.error('AI Engine Offline — configure MODEL_PATH');
          setAiStatus(data);
        } else {
          toast.error(data.message || 'Analysis failed');
        }
        return;
      }
      setResult(data);
      if (!data.is_ppe_model) {
        toast.success(`YOLOv11 detected ${data.worker_count} person(s) · ${data.all_detections?.length ?? 0} total objects`);
      } else if (data.violation_count > 0) {
        toast.error(`⚠️ ${data.violation_count} violation${data.violation_count > 1 ? 's' : ''} detected!`);
      } else {
        toast.success('✅ All workers compliant!');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer',
          'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500',
          'bg-slate-50 dark:bg-slate-800/50',
        )}
        onClick={() => document.getElementById('img-input').click()}
      >
        <input id="img-input" type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drag & drop an image here</p>
        <p className="text-xs text-slate-400 mt-1">or click to browse — JPG, PNG, WEBP up to 20 MB</p>
      </div>

      {/* Preview + Analyze */}
      {preview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Original Image</p>
            </div>
            <img src={preview} alt="Preview" className="w-full object-contain max-h-80" />
          </div>

          {result?.annotated_image_url ? (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Annotated Result</p>
              </div>
              <img
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8081'}${result.annotated_image_url}`}
                alt="Annotated"
                className="w-full object-contain max-h-80"
              />
            </div>
          ) : (
            <div className="card flex items-center justify-center min-h-48">
              {loading ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Running YOLOv11 detection...</p>
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Annotated image will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {preview && (
        <button onClick={analyze} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</> : <>Run YOLOv11 Detection</>}
        </button>
      )}

      {/* AI Offline State */}
      {aiStatus && !aiStatus.model_loaded && (
        <div className="card p-5 border-yellow-400 dark:border-yellow-600">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-400">AI Engine Offline</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                YOLOv11 model is not configured. Place your <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">best.pt</code> file at:
              </p>
              <code className="block mt-2 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded text-slate-700 dark:text-slate-300">
                {aiStatus.model_info?.model_path || './model/best.pt'}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Detection Results */}
      {result && !result.error && (
        <div className="space-y-4">

          {/* COCO model mode banner */}
          {!result.is_ppe_model && (
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Standard YOLOv11 (COCO) — Person & Object Detection Active</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{result.model_note}</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  For PPE compliance checking (helmet, vest, etc.), replace <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">model/best.pt</code> with a PPE-trained YOLOv11 model.
                </p>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Persons Detected', value: result.worker_count, color: 'text-blue-600 dark:text-blue-400' },
              { label: result.is_ppe_model ? 'Compliant' : 'Total Objects', value: result.is_ppe_model ? result.compliant_count : (result.all_detections?.length ?? 0), color: 'text-green-600 dark:text-green-400' },
              { label: result.is_ppe_model ? 'Violations' : 'Unique Classes', value: result.is_ppe_model ? result.violation_count : ([...new Set(result.all_detections?.map(d => d.label))].length ?? 0), color: result.is_ppe_model ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400' },
              { label: 'Confidence', value: result.workers?.[0] ? `${(result.workers[0].confidence * 100).toFixed(0)}%` : '—', color: 'text-slate-600 dark:text-slate-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4 text-center">
                <p className={clsx('text-2xl font-bold', color)}>{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* PPE Compliance results (PPE model only) */}
          {result.is_ppe_model && result.workers?.map((w) => (
            <div key={w.worker_index} className={clsx('card p-4 border-l-4', w.is_compliant ? 'border-l-green-500' : 'border-l-red-500')}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Worker #{w.worker_index}</p>
                <span className={clsx('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
                  w.is_compliant
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {w.is_compliant ? <><CheckCircle className="w-3 h-3" />COMPLIANT</> : <><XCircle className="w-3 h-3" />VIOLATION</>}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {w.detected_ppe?.map(ppe => (
                  <div key={ppe} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 capitalize">{ppe}</span>
                  </div>
                ))}
                {w.missing_ppe?.map(ppe => (
                  <div key={ppe} className="flex items-center gap-2 text-xs">
                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-red-600 dark:text-red-400 font-medium capitalize">{ppe} MISSING</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* COCO mode: All detected objects list */}
          {!result.is_ppe_model && result.all_detections?.length > 0 && (
            <div className="card p-5">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">All Detected Objects ({result.all_detections.length})</p>
              <div className="flex flex-wrap gap-2">
                {result.all_detections.map((d, i) => (
                  <span key={i} className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    d.label === 'person'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  )}>
                    {d.label === 'person' && <Users2 className="w-3 h-3" />}
                    <span className="capitalize">{d.label}</span>
                    <span className="opacity-60">{(d.confidence * 100).toFixed(0)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.incident_id && (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Incident created — ID: <code className="font-mono text-xs">{result.incident_id}</code>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Video Tab ──────────────────────────────────────────────────────────────
function VideoTab() {
  const [file, setFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVideoFile = (f) => {
    if (!f || !f.type.startsWith('video/')) {
      toast.error('Please select a valid video file');
      return;
    }
    setFile(f);
    setResult(null);
    setVideoPreview(URL.createObjectURL(f));
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await detectionService.analyzeVideo(fd);
      setResult(data);
      if (data.error) { toast.error(data.message || 'Video analysis failed'); return; }
      toast.success(`Video analyzed — ${data.processed_frames} frames processed`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Video analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/50 transition-colors"
        onClick={() => document.getElementById('vid-input').click()}
      >
        <input id="vid-input" type="file" accept="video/*" className="hidden" onChange={e => handleVideoFile(e.target.files[0])} />
        <Video className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        {file ? (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB · Click to choose another video</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drag & drop a video here</p>
            <p className="text-xs text-slate-400 mt-1">MP4, AVI, MOV up to 500 MB</p>
          </div>
        )}
      </div>

      {videoPreview && (
        <div className="card overflow-hidden p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Video Preview</p>
          <video
            src={videoPreview}
            controls
            playsInline
            className="w-full max-h-96 rounded-lg bg-black object-contain mx-auto"
          />
        </div>
      )}

      {file && (
        <button onClick={analyze} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing video frames with YOLOv11...</> : 'Analyze Video'}
        </button>
      )}

      {loading && (
        <div className="card p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing video with YOLOv11...</p>
          <p className="text-xs text-slate-400 mt-1">Tracking workers, evaluating PPE compliance, and generating incident reports</p>
        </div>
      )}

      {result && !result.error && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Frames', value: result.total_frames },
              { label: 'Frames Analyzed', value: result.processed_frames },
              { label: 'Workers Detected', value: result.total_workers_detected },
              { label: 'Compliant Workers', value: result.compliant_count, color: 'text-green-600 dark:text-green-400' },
              { label: 'Workers With Violations', value: result.violation_count, color: 'text-red-600 dark:text-red-400' },
              { label: 'Compliance Rate', value: `${result.compliance_rate}%`, color: 'text-blue-600 dark:text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4 text-center">
                <p className={clsx('text-2xl font-bold', color || 'text-slate-800 dark:text-slate-100')}>{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {result.violations_saved?.length > 0 && (
            <div className="card p-5">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                Confirmed Violations in Video ({result.violations_saved.length})
              </p>
              <div className="space-y-2">
                {result.violations_saved.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Worker #{v.worker_index}</span>
                      <span className="text-slate-500">at frame {v.frame}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 dark:text-red-400 font-medium capitalize">
                        Missing: {v.missing_ppe?.join(', ')}
                      </span>
                      {v.incident_id && (
                        <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded font-mono text-[10px]">
                          Incident Logged
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Webcam Tab ─────────────────────────────────────────────────────────────
function WebcamTab() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const streamRef = useRef(null);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setStreaming(true);
    } catch {
      toast.error('Could not access webcam. Check browser permissions.');
    }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStreaming(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append('file', blob, 'webcam_capture.jpg');
        const { data } = await detectionService.analyzeImage(fd);
        setResult(data);
        if (data.error) { toast.error(data.message); return; }
        if (data.violation_count > 0) toast.error(`⚠️ ${data.violation_count} violation(s) detected!`);
        else toast.success('✅ All compliant!');
      } catch { toast.error('Analysis failed'); }
      finally { setLoading(false); }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="relative bg-slate-900 aspect-video flex items-center justify-center">
          <video ref={videoRef} autoPlay muted className={clsx('w-full h-full object-cover', !streaming && 'hidden')} />
          <canvas ref={canvasRef} className="hidden" />
          {!streaming && (
            <div className="text-center">
              <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Webcam not started</p>
            </div>
          )}
        </div>
        <div className="p-4 flex gap-3 flex-wrap">
          {!streaming
            ? <button onClick={startWebcam} className="btn-primary">Start Webcam</button>
            : <>
              <button onClick={captureAndAnalyze} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</> : 'Capture & Analyze'}
              </button>
              <button onClick={stopWebcam} className="btn-danger">Stop</button>
            </>
          }
        </div>
      </div>

      {result && !result.error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Workers', value: result.worker_count },
            { label: 'Compliant', value: result.compliant_count, color: 'text-green-600 dark:text-green-400' },
            { label: 'Violations', value: result.violation_count, color: 'text-red-600 dark:text-red-400' },
            { label: 'Status', value: result.overall_compliant ? '✅ Safe' : '⚠️ Unsafe', color: result.overall_compliant ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={clsx('text-xl font-bold', color || 'text-slate-800 dark:text-slate-100')}>{value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CCTV Tab ───────────────────────────────────────────────────────────────
function CCTVTab() {
  return (
    <div className="card p-8 text-center">
      <Wifi className="w-12 h-12 text-slate-400 mx-auto mb-4" />
      <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">CCTV / RTSP Integration</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        RTSP camera streams are supported architecturally. Register your camera in the Cameras section
        with the RTSP URL, then the AI engine will process frames automatically.
      </p>
      <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 text-left max-w-sm mx-auto">
        <p className="text-xs font-mono text-slate-600 dark:text-slate-400">Example RTSP URL:</p>
        <code className="block text-xs text-blue-600 dark:text-blue-400 mt-1 break-all">
          rtsp://username:password@192.168.1.100:554/stream
        </code>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function LiveMonitor() {
  const [activeTab, setActiveTab] = useState('image');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Live Monitor</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Real-time PPE detection using YOLOv11 computer vision</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'image' && <ImageTab />}
      {activeTab === 'video' && <VideoTab />}
      {activeTab === 'webcam' && <WebcamTab />}
      {activeTab === 'cctv' && <CCTVTab />}
    </div>
  );
}
