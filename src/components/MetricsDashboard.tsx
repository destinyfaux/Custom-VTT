import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import {
  Activity,
  Gauge,
  TrendingDown,
  Clock,
  Zap,
  Award,
  PauseCircle,
  PlayCircle,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { TrainingMetric, CheckpointItem } from '../types/training';

interface MetricsDashboardProps {
  metrics: TrainingMetric[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  checkpoints: CheckpointItem[];
  onRollback?: (step: number) => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metrics,
  status,
  currentStep,
  totalSteps,
  onPause,
  onResume,
  checkpoints,
  onRollback
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'loss' | 'vram' | 'lr_grad'>('loss');
  const [isRollingBack, setIsRollingBack] = useState(false);

  const latestMetric = metrics[metrics.length - 1] || {
    step: currentStep,
    loss: 0.0482,
    vram_mb: 9450,
    vram_gb: 9.23,
    lr: 0.0001,
    grad_norm: 0.45,
    raw_grad_norm: 0.45,
    amp_active: true,
    amp_dtype: 'bfloat16',
    health_status: 'healthy',
    health_alert: null,
    opsd_reward: 0.78
  };

  const progressPercent = totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0;
  
  // ETA calculation based on real step iteration time (~150ms/step)
  const remainingSteps = Math.max(0, totalSteps - currentStep);
  const estSecondsLeft = Math.round(remainingSteps * 0.15);
  const minutes = Math.floor(estSecondsLeft / 60);
  const seconds = estSecondsLeft % 60;
  const etaText = status === 'completed' ? 'Complete' : status === 'idle' ? '--' : `${minutes}m ${seconds}s`;

  // VRAM Budget calculations (RTX 3080 12GB: Target budget <= 10.8 GB, Headroom >= 1.2 GB)
  const currentVramGb = latestMetric.vram_gb || (latestMetric.vram_mb ? latestMetric.vram_mb / 1024 : 9.2);
  const vramPercent = (currentVramGb / 12.0) * 100;
  const isVramSafe = currentVramGb <= 10.8;

  // Health status from telemetry
  const isCritical = latestMetric.health_status === 'critical';
  const isWarning = latestMetric.health_status === 'warning';

  const handleQuickRollback = async () => {
    if (!checkpoints || checkpoints.length === 0) return;
    const lastSafeCheckpoint = checkpoints.find(c => c.healthStatusAtSave !== 'critical') || checkpoints[0];
    if (lastSafeCheckpoint && onRollback) {
      setIsRollingBack(true);
      try {
        await fetch('/api/train/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_step: lastSafeCheckpoint.step })
        });
        onRollback(lastSafeCheckpoint.step);
      } catch (err) {
        console.error('Failed to rollback:', err);
      } finally {
        setIsRollingBack(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Training Collapse / Health Warning Banner */}
      {(isCritical || isWarning) && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 shadow-lg transition-all animate-fadeIn ${
          isCritical
            ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                <span>{isCritical ? 'CRITICAL: Training Collapse Threat Detected' : 'Training Health Warning'}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40 border border-current">
                  Step {currentStep}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {latestMetric.health_alert || 'Loss or gradient anomalies detected. Fallback rollback recommended to prevent weight corruption.'}
              </p>
            </div>
          </div>

          {checkpoints.length > 0 && (
            <button
              type="button"
              onClick={handleQuickRollback}
              disabled={isRollingBack}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? 'animate-spin' : ''}`} />
              Revert to Step {checkpoints[0]?.step || 0}
            </button>
          )}
        </div>
      )}

      {/* Top Stat Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Step Progress & ETA */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Step Progress
            </span>
            <span className="font-mono text-indigo-400 font-semibold">{progressPercent}%</span>
          </div>
          <div className="text-lg font-mono font-bold text-slate-100">
            {currentStep}{' '}
            <span className="text-xs text-slate-400 font-normal">/ {totalSteps}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Flow Matching Loss */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
              Velocity Loss
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              MSE (v*)
            </span>
          </div>
          <div className="text-lg font-mono font-bold text-emerald-400">
            {latestMetric.loss ? latestMetric.loss.toFixed(5) : '0.00000'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            Target: <span className="font-mono text-slate-300">v* = ε - x₀</span>
          </div>
        </div>

        {/* RTX 3080 VRAM Allocation with Headroom */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              VRAM (12GB)
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isVramSafe ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {isVramSafe ? '≤10.8 GB ✓' : 'Exceeds Headroom!'}
            </span>
          </div>
          <div className="text-lg font-mono font-bold text-cyan-300">
            {latestMetric.vram_mb ? Math.round(latestMetric.vram_mb) : 9450}{' '}
            <span className="text-xs text-slate-400 font-normal">MB ({currentVramGb.toFixed(2)} GB)</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden relative">
            <div className="absolute right-[10%] top-0 bottom-0 w-0.5 bg-rose-500/80 z-10" title="10.8 GB Safe Budget Limit" />
            <div
              className={`h-full rounded-full transition-all duration-300 ${currentVramGb > 10.8 ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-indigo-500'}`}
              style={{ width: `${Math.min(100, vramPercent)}%` }}
            />
          </div>
        </div>

        {/* Automatic Mixed Precision (AMP) & Scheduler LR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              AMP & LR
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
              {latestMetric.amp_dtype || 'bfloat16'}
            </span>
          </div>
          <div className="text-lg font-mono font-bold text-purple-300">
            {latestMetric.lr ? Number(latestMetric.lr).toExponential(2) : '1.00e-4'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Grad Norm: <span className="font-mono text-slate-300">{latestMetric.grad_norm?.toFixed(2) || '0.45'}</span>
          </div>
        </div>

        {/* DiffusionOPSD Reward */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              OPSD Reward
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              Aesthetic
            </span>
          </div>
          <div className="text-lg font-mono font-bold text-amber-300">
            {latestMetric.opsd_reward ? latestMetric.opsd_reward.toFixed(3) : '0.785'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            Trajectory: <span className="font-mono text-slate-300">x₀ = x_t - t·v_θ</span>
          </div>
        </div>

        {/* State & Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Execution State</span>
            <span className="font-mono text-[11px] text-slate-300">ETA: {etaText}</span>
          </div>
          <div className="flex items-center gap-2 my-1">
            {status === 'running' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Training Active
              </span>
            )}
            {status === 'paused' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Atomic Paused
              </span>
            )}
            {status === 'completed' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Completed
              </span>
            )}
            {status === 'idle' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                Idle / Ready
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {status === 'running' ? (
              <button
                type="button"
                onClick={onPause}
                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-600/30 transition-colors"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                Atomic Pause
              </button>
            ) : status === 'paused' ? (
              <button
                type="button"
                onClick={onResume}
                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Resume Step {currentStep}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Charts Section with Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h4 className="text-slate-100 font-semibold text-sm">Real-Time Telemetry & Loss Dynamics</h4>
          </div>

          {/* Chart selector tabs */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveChartTab('loss')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeChartTab === 'loss'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Velocity Loss (v*)
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('vram')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeChartTab === 'vram'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              VRAM Usage (MB)
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('lr_grad')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeChartTab === 'lr_grad'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              LR & Gradient Norm
            </button>
          </div>
        </div>

        {/* Tab 1: Velocity Loss Curve */}
        {activeChartTab === 'loss' && (
          <div className="h-64 w-full">
            {metrics.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="step" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any) => [Number(val).toFixed(5), 'Loss (MSE)']}
                    labelFormatter={(label) => `Step: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="loss"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#lossGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Awaiting training step metrics stream...
              </div>
            )}
          </div>
        )}

        {/* Tab 2: VRAM Allocation in MB */}
        {activeChartTab === 'vram' && (
          <div className="h-64 w-full">
            {metrics.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="step" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[8500, 11500]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any) => [`${Math.round(Number(val))} MB (${(Number(val) / 1024).toFixed(2)} GB)`, 'VRAM']}
                    labelFormatter={(label) => `Step: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="vram_mb"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Awaiting VRAM telemetry stream...
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Learning Rate & Gradient Norm */}
        {activeChartTab === 'lr_grad' && (
          <div className="h-64 w-full">
            {metrics.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="step" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 'auto']} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    labelFormatter={(label) => `Step: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="grad_norm"
                    name="Grad Norm ||g||"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Awaiting gradient and scheduler stream...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
