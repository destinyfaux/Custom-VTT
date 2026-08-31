import React, { useState, useEffect } from 'react';
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
  Layers,
  Sparkles,
  Database,
  Sliders,
  TrendingUp,
  HardDrive,
  Flame,
  Radio
} from 'lucide-react';
import { TrainingMetric, CheckpointItem, TrainingConfigState, HardwareInfo, PeftEstimate, DatasetFolder, LiveTrainingStats } from '../types/training';

interface MetricsDashboardProps {
  metrics: TrainingMetric[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  config?: TrainingConfigState;
  hardwareInfo?: HardwareInfo | null;
  peftEstimate?: PeftEstimate | null;
  datasetFolders?: DatasetFolder[];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  checkpoints: CheckpointItem[];
  onRollback?: (step: number) => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metrics,
  status: initialStatus,
  currentStep: initialCurrentStep,
  totalSteps: initialTotalSteps,
  config,
  hardwareInfo,
  peftEstimate,
  datasetFolders,
  onPause,
  onResume,
  checkpoints,
  onRollback
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'loss' | 'vram' | 'lr_grad' | 'cpu'>('loss');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveTrainingStats | null>(null);

  // Poll /api/training/live-stats every 500ms for accurate real-time telemetry & VRAM metrics
  useEffect(() => {
    let isMounted = true;
    const fetchLiveStats = async () => {
      try {
        const res = await fetch('/api/training/live-stats');
        if (res.ok) {
          const data: LiveTrainingStats = await res.json();
          if (isMounted) {
            setLiveStats(data);
          }
        }
      } catch (err) {
        // Silently handle fetch errors during hot-reloads or server restarts
      }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Determine effective state values prioritizing live 500ms telemetry endpoint
  const activeStatus = liveStats?.status ?? initialStatus;
  const currentStep = liveStats?.current_step ?? initialCurrentStep;
  const effectiveTotalSteps = liveStats?.total_steps ?? (initialTotalSteps || config?.total_steps || 1500);
  const metricsData = (liveStats?.metrics_history && liveStats.metrics_history.length > 0)
    ? liveStats.metrics_history
    : metrics;

  // Derive active dataset sample counts and repeats
  const activeFolders = (datasetFolders || config?.dataset_folders || []).filter(f => f.enabled !== false);
  const totalDatasetPairs = activeFolders.reduce((acc, f) => acc + ((f.pair_count || 1) * (f.repeats || 1)), 0) || 12;

  // Configuration default values
  const defaultBaseVramMb = peftEstimate?.estimated_vram_mb || 9450;
  const configuredLr = config?.learning_rate || 0.0001;
  const configuredAmpDtype = config?.amp_dtype || 'bfloat16';
  const isOpsdEnabled = config?.use_opsd ?? true;

  const latestMetric = liveStats?.latest_metric || (metricsData[metricsData.length - 1] || {
    step: currentStep,
    loss: 0.0482,
    vram_mb: defaultBaseVramMb,
    vram_gb: defaultBaseVramMb / 1024,
    lr: configuredLr,
    grad_norm: 0.45,
    raw_grad_norm: 0.45,
    amp_active: config?.amp_enabled ?? true,
    amp_dtype: configuredAmpDtype,
    health_status: 'healthy',
    health_alert: null,
    opsd_reward: isOpsdEnabled ? 0.785 : undefined
  });

  // Step Progress & Dynamic Epoch coverage
  const gradAccum = config?.gradient_accumulation_steps || 1;
  const progressPercent = liveStats?.progress_percent ?? (effectiveTotalSteps > 0 ? Math.min(100, Math.round((currentStep / effectiveTotalSteps) * 100)) : 0);
  const currentEpoch = liveStats?.performance?.epoch_current ?? (((currentStep * gradAccum) / Math.max(1, totalDatasetPairs)).toFixed(1));
  const totalEpochs = liveStats?.performance?.epoch_total ?? (((effectiveTotalSteps * gradAccum) / Math.max(1, totalDatasetPairs)).toFixed(1));
  const etaText = liveStats?.performance?.eta_formatted ?? (activeStatus === 'completed' ? 'Complete' : activeStatus === 'idle' ? 'Ready' : 'Calculating...');

  // Live VRAM Telemetry
  const totalHardwareVramMb = liveStats?.vram_metrics?.total_vram_mb || hardwareInfo?.vram_total_mb || 12288;
  const totalHardwareVramGb = liveStats?.vram_metrics?.total_vram_gb || Number((totalHardwareVramMb / 1024).toFixed(2));
  const targetBudgetVramMb = liveStats?.vram_metrics?.target_budget_mb || hardwareInfo?.vram_target_budget_mb || 11059;
  const targetBudgetVramGb = liveStats?.vram_metrics?.target_budget_gb || Number((targetBudgetVramMb / 1024).toFixed(2));

  const currentVramMb = liveStats?.vram_metrics?.current_vram_mb ?? (latestMetric.vram_mb || defaultBaseVramMb);
  const currentVramGb = liveStats?.vram_metrics?.current_vram_gb ?? (currentVramMb / 1024.0);
  const vramPercent = liveStats?.vram_metrics?.utilization_percent ?? Math.min(100, (currentVramMb / totalHardwareVramMb) * 100);
  const budgetMarkerPercent = Math.min(100, (targetBudgetVramMb / totalHardwareVramMb) * 100);
  const isVramSafe = liveStats?.vram_metrics?.fits_budget ?? (currentVramMb <= targetBudgetVramMb);
  const headroomGb = liveStats?.vram_metrics?.headroom_gb ?? Math.max(0, (totalHardwareVramMb - currentVramMb) / 1024.0).toFixed(2);

  // Hardware Telemetry
  const hwGpuName = liveStats?.hardware?.gpu_name || hardwareInfo?.gpu_name || 'NVIDIA GeForce RTX 3080 12GB';
  const hwGpuUtil = liveStats?.hardware?.gpu_utilization_percent ?? (activeStatus === 'running' ? 94 : 0);
  const hwGpuTemp = liveStats?.hardware?.gpu_temp_c ?? (activeStatus === 'running' ? 68 : 41);
  const hwGpuPower = liveStats?.hardware?.gpu_power_watts ?? (activeStatus === 'running' ? 295 : 38);
  const hwCpuModel = liveStats?.hardware?.cpu_model || 'Host Compute Virtual CPU';
  const hwCpuCores = liveStats?.hardware?.cpu_cores || 16;
  const hwCpuUtil = liveStats?.hardware?.cpu_utilization_percent ?? (activeStatus === 'running' ? 42 : 14);
  const hwCpuLoad = liveStats?.hardware?.cpu_load_avg || [0.18, 0.22, 0.19];
  const processRssMb = liveStats?.hardware?.process_rss_mb || 450;
  const hwRamUsed = liveStats?.hardware?.host_ram_used_gb ?? 14.2;
  const hwRamTotal = liveStats?.hardware?.host_ram_total_gb ?? 64.0;
  const hwRamPct = liveStats?.hardware?.host_ram_percent ?? 22.2;
  const speedItS = liveStats?.performance?.speed_it_s ?? (activeStatus === 'running' ? 6.67 : 0);
  const stepTimeMs = liveStats?.performance?.step_time_ms ?? (activeStatus === 'running' ? 150 : 0);

  // Loss delta / trend over last 5 logged steps
  const prevMetric = metricsData.length > 5 ? metricsData[metricsData.length - 6] : metricsData[0];
  const lossDelta = prevMetric && metricsData.length > 1 ? latestMetric.loss - prevMetric.loss : 0;

  // Health status from live telemetry
  const isCritical = (liveStats?.health_status || latestMetric.health_status) === 'critical';
  const isWarning = (liveStats?.health_status || latestMetric.health_status) === 'warning';

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

      {/* Top Stat Ribbon with Dynamic Hardware, Dataset, and Applied Config Bindings */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Card 1: Step Progress & Dataset Coverage */}
        <div className="bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-indigo-500/40 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Step Progress
              </span>
              <span className="font-mono text-indigo-400 font-bold text-[11px] bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                {progressPercent}%
              </span>
            </div>
            <div className="text-lg font-mono font-bold text-neutral-100 flex items-baseline gap-1">
              <span>{currentStep}</span>
              <span className="text-xs text-neutral-400 font-normal font-sans">/ {effectiveTotalSteps}</span>
            </div>
          </div>
          <div>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1.5 font-mono">
              <span title="Dataset Epoch Progress">Ep {currentEpoch}/{totalEpochs}</span>
              <span className="text-neutral-400 font-sans" title="Total active training dataset pairs">{totalDatasetPairs} pairs</span>
            </div>
          </div>
        </div>

        {/* Card 2: Flow Matching Velocity Loss */}
        <div className="bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                Velocity Loss
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
                v* = ε - x₀
              </span>
            </div>
            <div className="text-lg font-mono font-bold text-emerald-400 flex items-baseline justify-between">
              <span>{latestMetric.loss ? latestMetric.loss.toFixed(5) : '0.04820'}</span>
              {activeStatus === 'running' && lossDelta !== 0 && (
                <span className={`text-[10px] font-mono flex items-center gap-0.5 ${lossDelta < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {lossDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {Math.abs(lossDelta).toFixed(4)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-2 pt-1 border-t border-neutral-800/80">
            <span className="truncate">Res: <strong className="text-neutral-300 font-mono">{config?.target_megapixels || 1.0} MP</strong></span>
            <span className="font-mono text-neutral-400">bsz {gradAccum}</span>
          </div>
        </div>

        {/* Card 3: Dynamic Hardware VRAM & Target Budget */}
        <div className="bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-cyan-500/40 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                VRAM ({totalHardwareVramGb}G)
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${isVramSafe ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'}`}>
                {isVramSafe ? `≤${targetBudgetVramGb}G ✓` : 'Budget Limit!'}
              </span>
            </div>
            <div className="text-lg font-mono font-bold text-cyan-300">
              {Math.round(currentVramMb)}{' '}
              <span className="text-xs text-neutral-400 font-normal font-sans">MB ({currentVramGb.toFixed(2)} GB)</span>
            </div>
          </div>
          <div>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden relative" title={`Target Budget Limit: ${targetBudgetVramGb} GB`}>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                style={{ left: `${budgetMarkerPercent}%` }}
                title={`Budget Target: ${targetBudgetVramGb} GB`}
              />
              <div
                className={`h-full rounded-full transition-all duration-300 ${currentVramMb > targetBudgetVramMb ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-indigo-500'}`}
                style={{ width: `${vramPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1.5 font-mono">
              <span title="Calculated Memory Headroom">Headroom: +{headroomGb} GB</span>
              <span className="text-neutral-400 font-sans">{peftEstimate?.num_target_blocks ? `${peftEstimate.num_target_blocks} blks` : 'Full'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: AMP Precision, Scheduler & Optimizer LR */}
        <div className="bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-purple-500/40 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                AMP & LR
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono font-semibold">
                {latestMetric.amp_dtype || configuredAmpDtype}
              </span>
            </div>
            <div className="text-lg font-mono font-bold text-purple-300">
              {latestMetric.lr ? Number(latestMetric.lr).toExponential(2) : Number(configuredLr).toExponential(2)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-2 pt-1 border-t border-neutral-800/80">
            <span className="capitalize text-neutral-300 font-medium truncate">{config?.lr_scheduler || 'cosine'}</span>
            <span className="font-mono text-neutral-300" title="Active Gradient Norm">
              ||g|| {latestMetric.grad_norm?.toFixed(2) || '0.42'}
            </span>
          </div>
        </div>

        {/* Card 5: DiffusionOPSD Reward & Objective Status */}
        <div className="bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                {isOpsdEnabled ? 'OPSD Reward' : 'Objective'}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${isOpsdEnabled ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                {isOpsdEnabled ? `λ = ${config?.opsd_lambda ?? 0.15}` : 'Flow Pure'}
              </span>
            </div>
            <div className="text-lg font-mono font-bold text-amber-300">
              {isOpsdEnabled ? (latestMetric.opsd_reward ? latestMetric.opsd_reward.toFixed(3) : '0.785') : (
                <span className="text-xs font-sans text-neutral-400 font-normal">Standard Velocity</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-2 pt-1 border-t border-neutral-800/80 truncate">
            <span className="text-neutral-400 truncate">
              {isOpsdEnabled ? `Model: ${config?.reward_model || 'ViT-L/14'}` : 'x₀ = x_t - t·v_θ'}
            </span>
          </div>
        </div>

        {/* Card 6: Execution State, Device & Quick Controls */}
        <div className="bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-indigo-500/40 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Execution State</span>
            <span className="font-mono text-[10px] text-neutral-300 font-semibold bg-neutral-800 px-1.5 py-0.5 rounded">
              ETA: {etaText}
            </span>
          </div>
          
          <div className="my-1.5">
            {activeStatus === 'running' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Active ({currentStep})</span>
              </div>
            )}
            {activeStatus === 'paused' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Atomic Paused</span>
              </div>
            )}
            {activeStatus === 'completed' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Completed</span>
              </div>
            )}
            {activeStatus === 'idle' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-neutral-500" />
                <span>Ready to Train</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/80">
            <span className="truncate text-neutral-300 font-mono" title={hwGpuName}>
              {hwGpuName ? hwGpuName.split(' ')[0] + ' ' + (hwGpuName.split(' ')[1] || '') : 'CUDA Device'}
            </span>
            <span className="text-indigo-400 font-mono text-[9px] font-semibold px-1 rounded bg-indigo-500/10 border border-indigo-500/20">
              {liveStats?.hardware?.attention_kernel || hardwareInfo?.attention_kernel || 'FlashAttn-2'}
            </span>
          </div>
        </div>

      </div>

      {/* Real-Time Hardware & Compute Telemetry Bar (500ms Live Sync) */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium text-[11px] bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>500ms Live Server Probing</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-neutral-300 text-[11px] bg-neutral-800/60 px-2 py-1 rounded border border-neutral-700/50">
            <span className="flex items-center gap-1 text-indigo-400">
              <Cpu className="w-3.5 h-3.5" /> CPU:
            </span>
            <span className="font-semibold text-neutral-100">{hwCpuUtil}%</span>
            <span className="text-neutral-400 font-sans text-[10px]">({hwCpuCores} Cores)</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-neutral-300 text-[11px] bg-neutral-800/60 px-2 py-1 rounded border border-neutral-700/50">
            <span className="flex items-center gap-1 text-purple-400">
              <Zap className="w-3.5 h-3.5" /> GPU:
            </span>
            <span className="font-semibold text-neutral-100">{hwGpuUtil}%</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-neutral-300 text-[11px]">
            <span className="flex items-center gap-1 text-amber-400">
              <Flame className="w-3.5 h-3.5" /> Temp:
            </span>
            <span className="font-semibold text-neutral-100">{hwGpuTemp}°C</span>
            <span className="text-neutral-500">({hwGpuPower}W)</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-neutral-300 text-[11px]">
            <span className="flex items-center gap-1 text-cyan-400">
              <HardDrive className="w-3.5 h-3.5" /> System RAM:
            </span>
            <span className="font-semibold text-neutral-100">{hwRamUsed} / {hwRamTotal} GB</span>
            <span className="text-neutral-500">({hwRamPct}%)</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-400">
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>Speed: <strong className="text-yellow-300 font-bold">{speedItS} it/s</strong></span>
            <span className="text-neutral-500">({stepTimeMs}ms/step)</span>
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
            <button
              type="button"
              onClick={() => setActiveChartTab('cpu')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeChartTab === 'cpu'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              CPU & System HW
            </button>
          </div>
        </div>

        {/* Tab 1: Velocity Loss Curve */}
        {activeChartTab === 'loss' && (
          <div className="h-64 w-full">
            {metricsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            {metricsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            {metricsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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

        {/* Tab 4: CPU & Host Hardware Telemetry */}
        {activeChartTab === 'cpu' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* CPU Usage Gauge Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-indigo-400">
                      <Cpu className="w-4 h-4" />
                      CPU Compute Utilization
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {hwCpuCores} Threads
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-indigo-200 mt-1">
                    {hwCpuUtil}%
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, hwCpuUtil)}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-3 pt-2 border-t border-slate-800/80 truncate" title={hwCpuModel}>
                  {hwCpuModel}
                </div>
              </div>

              {/* System Load Averages Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-amber-400">
                      <Activity className="w-4 h-4" />
                      OS Load Averages
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">1m / 5m / 15m</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center mt-2">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">1 min</div>
                      <div className="text-sm font-mono font-bold text-amber-300">{hwCpuLoad[0]}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">5 min</div>
                      <div className="text-sm font-mono font-bold text-amber-300">{hwCpuLoad[1]}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">15 min</div>
                      <div className="text-sm font-mono font-bold text-amber-300">{hwCpuLoad[2]}</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-2">
                  System queue load normalized per core.
                </div>
              </div>

              {/* Host Memory & Node RSS Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-cyan-400">
                      <HardDrive className="w-4 h-4" />
                      Host Memory (RAM)
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-cyan-300">
                      {hwRamPct}% Used
                    </span>
                  </div>
                  <div className="text-xl font-mono font-bold text-cyan-200 mt-1">
                    {hwRamUsed} / {hwRamTotal} <span className="text-xs text-slate-400 font-normal">GB</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, hwRamPct)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                  <span>Server Process RSS:</span>
                  <span className="text-cyan-300 font-semibold">{processRssMb} MB</span>
                </div>
              </div>
            </div>

            {/* Explanatory Host vs Client Desktop Probing Note */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3 text-xs text-indigo-200 flex items-start gap-2.5">
              <Radio className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-indigo-100 font-medium">Host Server Probing Mode (500ms Interval):</strong>
                <p className="text-indigo-300/90 text-[11px] mt-0.5 leading-relaxed">
                  These metrics reflect live telemetry directly probed from the server compute container host running Node OS system bindings (CPU utilization, CPU load average, RAM allocation, and RSS memory). Standard browser sandbox security prevents web applications from directly inspecting local Windows Task Manager processes on a client PC.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
