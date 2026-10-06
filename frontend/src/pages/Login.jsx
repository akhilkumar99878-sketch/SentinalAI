import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@sentinelai.com');
  const [password, setPassword] = useState('Admin@12345');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left — Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 border-r border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">SentinelAI</p>
            <p className="text-slate-400 text-xs">Safety Monitoring Platform</p>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            AI-Powered<br />
            <span className="text-blue-400">Industrial Safety</span><br />
            Monitoring
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-md">
            Real-time PPE compliance detection using YOLOv11 computer vision.
            Automated incident management, safety analytics, and intelligent alerts
            for industrial environments.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: 'PPE Detection', desc: 'YOLOv11 AI Engine' },
              { label: 'Real-Time Alerts', desc: 'WebSocket Streaming' },
              { label: 'Incident Tracking', desc: 'Full Audit Trail' },
              { label: 'Safety Analytics', desc: 'Live Dashboard' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">
          B.Tech CSE Project · AI-Driven Industrial Safety Framework
        </p>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">SentinelAI</p>
              <p className="text-slate-400 text-xs">Safety Monitoring Platform</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Sign in</h1>
          <p className="text-slate-400 text-sm mb-8">Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="admin@sentinelai.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs font-medium mb-2">Demo Credentials</p>
            <p className="text-slate-300 text-xs">Email: <span className="text-blue-400 font-mono">admin@sentinelai.com</span></p>
            <p className="text-slate-300 text-xs mt-1">Password: <span className="text-blue-400 font-mono">Admin@12345</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
