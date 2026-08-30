import React, { useState } from 'react';
import {
  Sliders,
  Cpu,
  Zap,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  GitFork,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Camera,
  Layers
} from 'lucide-react';
import { TrainingConfigState } from '../types/training';

interface TrainingConfigPanelProps {
  config: TrainingConfigState;
  onChange: (updated: Partial<TrainingConfigState>) => void;
  onMergeDeTurbo: () => Promise<any>;
}

export const TrainingConfigPanel: React.FC<TrainingConfigPanelProps> = ({
  config,
  onChange,
  onMergeDeTurbo
}) => {
  const [isMerging, setIsMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);

  const handleMerge = async () => {
    setIsMerging(true);
    setMergeMessage('Loading Z-Image-Turbo into CPU Host RAM and fusing Ostris adapter...');
    try {
      const res = await onMergeDeTurbo();
      setMergeMessage(`✓ De-Turbo fused into host RAM (0 MB VRAM used). Checkpoint: ${res.fused_model_path || './models/zimage_deturbo_merged'}`);
    } catch (e) {
      setMergeMessage('Failed to fuse de-turbo adapter.');
    } finally {
      setIsMerging(false);
    }
  };

  // Real-time hyperparameter health checks
  const healthWarnings: string[] = [];
  if (config.learning_rate > 3e-4 && config.rank >= 32) {
    healthWarnings.push('High learning rate (>3e-4) paired with high rank (≥32) increases risk of gradient explosion.');
  }
  if (config.sample_every_n_steps > 0 && config.sample_every_n_steps <= 50) {
    healthWarnings.push('Sampling every ≤50 steps causes frequent full-diffusion evaluation passes and stalls training speed.');
  }
  if (config.rank > 64) {
    healthWarnings.push('Rank > 64 may cause VRAM allocation to exceed the 10.8 GB budget ceiling.');
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-slate-100 font-semibold text-sm">
              PEFT & Hyperparameter Orchestration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure fine-grained LoRA / LoKr adaptation, AMP precision, LR schedules, and sample intervals
            </p>
          </div>
        </div>

        {/* De-Distillation Blender */}
        <button
          type="button"
          onClick={handleMerge}
          disabled={isMerging}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {isMerging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5 text-indigo-400" />}
          Fuse De-Turbo LoRA (Host RAM)
        </button>
      </div>

      {mergeMessage && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg text-xs text-indigo-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{mergeMessage}</span>
        </div>
      )}

      {/* Hyperparameter Health Warning Banner */}
      {healthWarnings.length > 0 && (
        <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Hyperparameter Stability Advisory:</span>
          </div>
          <ul className="text-[11px] text-slate-300 list-disc list-inside space-y-0.5 pl-1">
            {healthWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Grid of parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Adapter Type */}
        <div className="space-y-1.5">
          <label className="text-slate-300 font-medium">Adapter Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ adapter_type: 'lora' })}
              className={`py-2 px-3 rounded-lg border font-semibold text-center transition-all ${
                config.adapter_type === 'lora'
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              LoRA (Standard)
            </button>
            <button
              type="button"
              onClick={() => onChange({ adapter_type: 'lokr' })}
              className={`py-2 px-3 rounded-lg border font-semibold text-center transition-all ${
                config.adapter_type === 'lokr'
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              LoKr (Kronecker)
            </button>
          </div>
        </div>

        {/* Rank (r) */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-slate-300 font-medium">Rank (r)</label>
            <span className="font-mono text-indigo-400 font-bold">{config.rank}</span>
          </div>
          <select
            value={config.rank}
            onChange={(e) => onChange({ rank: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value={4}>4 (Ultra Compact / LoKr)</option>
            <option value={8}>8 (Lightweight)</option>
            <option value={16}>16 (Recommended for S3-DiT)</option>
            <option value={32}>32 (High Capacity)</option>
            <option value={64}>64 (Max Expressiveness)</option>
          </select>
        </div>

        {/* Alpha (α) */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-slate-300 font-medium">LoRA Alpha (α)</label>
            <span className="font-mono text-indigo-400 font-bold">{config.alpha}</span>
          </div>
          <input
            type="number"
            value={config.alpha}
            onChange={(e) => onChange({ alpha: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Base Learning Rate */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-slate-300 font-medium">Initial Learning Rate</label>
            <span className="font-mono text-indigo-400 font-bold">{config.learning_rate}</span>
          </div>
          <select
            value={config.learning_rate}
            onChange={(e) => onChange({ learning_rate: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value={0.0005}>5e-4 (Fast LoRA)</option>
            <option value={0.0001}>1e-4 (Standard Default)</option>
            <option value={0.00005}>5e-5 (Fine Aesthetic)</option>
            <option value={0.00002}>2e-5 (Delicate LoKr)</option>
            <option value={0.00001}>1e-5 (Minimal Drift)</option>
          </select>
        </div>

        {/* LR Scheduler */}
        <div className="space-y-1.5">
          <label className="text-slate-300 font-medium">LR Decay Scheduler</label>
          <select
            value={config.lr_scheduler || 'cosine'}
            onChange={(e) => onChange({ lr_scheduler: e.target.value as any })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value="cosine">Cosine Annealing (Smoothest)</option>
            <option value="linear">Linear Decay</option>
            <option value="reduce_on_plateau">Reduce On Plateau (Adaptive)</option>
            <option value="constant">Constant</option>
          </select>
        </div>

        {/* Automatic Mixed Precision (AMP) */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-slate-300 font-medium">AMP Autocast</label>
            <span className="font-mono text-cyan-400 font-semibold">{config.amp_dtype || 'bfloat16'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ amp_enabled: true, amp_dtype: 'bfloat16' })}
              className={`py-2 px-2.5 rounded-lg border font-semibold text-center text-xs transition-all ${
                config.amp_enabled && config.amp_dtype === 'bfloat16'
                  ? 'bg-cyan-600 border-cyan-400 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              bfloat16 (Ampere)
            </button>
            <button
              type="button"
              onClick={() => onChange({ amp_enabled: true, amp_dtype: 'float16' })}
              className={`py-2 px-2.5 rounded-lg border font-semibold text-center text-xs transition-all ${
                config.amp_enabled && config.amp_dtype === 'float16'
                  ? 'bg-cyan-600 border-cyan-400 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              float16 (GradScaler)
            </button>
          </div>
        </div>

        {/* Sample Image Interval */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-slate-300 font-medium flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-indigo-400" />
              Sample Image Every N Steps
            </label>
            <span className="font-mono text-indigo-400 font-bold">
              {config.sample_every_n_steps === 0 ? 'Manual' : `${config.sample_every_n_steps} steps`}
            </span>
          </div>
          <select
            value={config.sample_every_n_steps || 250}
            onChange={(e) => onChange({ sample_every_n_steps: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value={100}>100 steps (Frequent)</option>
            <option value={250}>250 steps (Recommended)</option>
            <option value={500}>500 steps (Fast)</option>
            <option value={1000}>1000 steps (Uninterrupted)</option>
            <option value={0}>Manual Only (Zero Stall)</option>
          </select>
        </div>

        {/* Soft Checkpoint Interval */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-slate-300 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Soft Checkpoint Save
            </label>
            <span className="font-mono text-emerald-400 font-bold">{config.soft_checkpoint_every_n_steps || 50} steps</span>
          </div>
          <select
            value={config.soft_checkpoint_every_n_steps || 50}
            onChange={(e) => onChange({ soft_checkpoint_every_n_steps: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value={25}>Every 25 steps (Max Granularity)</option>
            <option value={50}>Every 50 steps (Standard)</option>
            <option value={100}>Every 100 steps</option>
          </select>
        </div>

        {/* Total Steps */}
        <div className="space-y-1.5">
          <label className="text-slate-300 font-medium">Total Training Steps</label>
          <input
            type="number"
            value={config.total_steps}
            onChange={(e) => onChange({ total_steps: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Gradient Accumulation */}
        <div className="space-y-1.5">
          <label className="text-slate-300 font-medium">Grad Accumulation Steps</label>
          <input
            type="number"
            value={config.gradient_accumulation_steps}
            onChange={(e) => onChange({ gradient_accumulation_steps: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Max Grad Norm Clipping */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-slate-300 font-medium">Max Grad Norm (Clip)</label>
            <span className="font-mono text-purple-400 font-bold">{config.max_grad_norm || 1.0}</span>
          </div>
          <input
            type="number"
            step="0.1"
            value={config.max_grad_norm || 1.0}
            onChange={(e) => onChange({ max_grad_norm: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Optimizer */}
        <div className="space-y-1.5">
          <label className="text-slate-300 font-medium">Quantized Optimizer</label>
          <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-emerald-400 font-semibold flex items-center justify-between">
            <span>AdamW8bit</span>
            <span className="text-[10px] text-slate-500">&lt; 0.5 GB State</span>
          </div>
        </div>
      </div>
    </div>
  );
};
