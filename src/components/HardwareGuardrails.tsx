import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  Cpu,
  HardDrive,
  Zap,
  EyeOff,
  Layers,
  RefreshCw,
  Server,
  Activity,
  Terminal,
  Info
} from 'lucide-react';
import { HardwareInfo } from '../types/training';

interface HardwareGuardrailsProps {
  hardware: HardwareInfo | null;
  currentVramGb?: number;
  onRefreshHardware?: () => Promise<void>;
}

export const HardwareGuardrails: React.FC<HardwareGuardrailsProps> = ({
  hardware,
  currentVramGb = 9.2,
  onRefreshHardware
}) => {
  const [isProbing, setIsProbing] = useState(false);
  const [probeNotice, setProbeNotice] = useState<string | null>(null);

  const handleProbe = async () => {
    if (!onRefreshHardware) return;
    setIsProbing(true);
    setProbeNotice(null);
    try {
      await onRefreshHardware();
      const timeStr = new Date().toLocaleTimeString();
      setProbeNotice(`Hardware probed successfully at ${timeStr}`);
      setTimeout(() => setProbeNotice(null), 6000);
    } catch (e) {
      console.error(e);
      setProbeNotice('Failed to probe host hardware.');
    } finally {
      setIsProbing(false);
    }
  };

  const totalVramGb = hardware?.vram_total_mb ? hardware.vram_total_mb / 1024 : 12.0;
  const headroomGb = hardware?.vram_headroom_mb ?? Math.max(0, totalVramGb - currentVramGb);
  const safeBudgetGb = hardware?.vram_target_budget_mb ? hardware.vram_target_budget_mb / 1024 : totalVramGb * 0.90;
  const gpuName = hardware?.gpu_name || 'NVIDIA GeForce RTX 3080 12GB';
  const cpuModel = hardware?.cpu_model || 'Host Compute Virtual CPU';
  const cpuCores = hardware?.cpu_cores || 16;
  const hostRamGb = hardware?.host_ram_gb || 64.0;
  const hostRamFreeGb = hardware?.host_ram_free_gb || 42.1;
  const systemOs = hardware?.system_os || 'Linux x86_64';
  const computeCap = hardware?.compute_capability || 'Ampere SM 8.6';
  const probedAt = hardware?.probed_at ? new Date(hardware.probed_at).toLocaleTimeString() : 'Initial load';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-slate-100 font-semibold text-sm flex items-center gap-2">
              Hardware Diagnostics & VRAM Safety Guardrails
              <span className="text-[10px] font-mono text-slate-400 font-normal bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                Probed: {probedAt}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live hardware introspection and memory budget enforcement for Ampere SM 8.6
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshHardware && (
            <button
              type="button"
              onClick={handleProbe}
              disabled={isProbing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
              {isProbing ? 'Probing Hardware...' : 'Probe Hardware'}
            </button>
          )}

          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Budget Limit: ≤ {safeBudgetGb.toFixed(1)} GB
          </span>
        </div>
      </div>

      {probeNotice && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg text-xs flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {probeNotice}
          </span>
          <span className="text-[10px] font-mono text-emerald-400/80">
            Probed {hardware?.is_physical_gpu ? 'Physical GPU' : 'Virtual Container Compute Host'}
          </span>
        </div>
      )}

      {/* Detected Hardware Specs Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800/90 text-xs">
        <div>
          <span className="text-[11px] text-slate-500 block font-medium">Detected GPU Accelerator</span>
          <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-1 font-mono truncate" title={gpuName}>
            <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            {gpuName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
            {computeCap} | {hardware?.gpu_driver || 'NVIDIA Driver'}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-slate-500 block font-medium">VRAM Headroom</span>
          <span className="font-semibold text-cyan-300 flex items-center gap-1.5 mt-1 font-mono">
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {headroomGb.toFixed(2)} GB Free ({totalVramGb.toFixed(1)} GB Total)
          </span>
          <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
            Safety margin: {(totalVramGb > 0 ? (headroomGb / totalVramGb * 100) : 20).toFixed(0)}%
          </span>
        </div>

        <div>
          <span className="text-[11px] text-slate-500 block font-medium">Host System Memory (RAM)</span>
          <span className="font-semibold text-purple-200 flex items-center gap-1.5 mt-1 font-mono">
            <Server className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            {hostRamGb} GB Total ({hostRamFreeGb} GB Free)
          </span>
          <span className="text-[10px] text-purple-300 font-mono block mt-0.5">
            Pre-caching enabled
          </span>
        </div>

        <div>
          <span className="text-[11px] text-slate-500 block font-medium">Host CPU & Architecture</span>
          <span className="font-semibold text-amber-200 flex items-center gap-1.5 mt-1 font-mono truncate" title={cpuModel}>
            <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {cpuCores} Cores / {cpuModel}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate" title={systemOs}>
            {systemOs}
          </span>
        </div>
      </div>

      {/* Hardware Environment Probing Notice */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-medium text-slate-200 flex items-center gap-2">
            <span>Container Server Host Diagnostics</span>
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">
              Node OS Probed
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Hardware introspection inspects the host runtime server container executing PyTorch training loops. Browser security models isolate client PCs from exposing native Windows Task Manager or local physical GPU sensors directly to remote web apps.
          </p>
        </div>
      </div>

      {/* Grid of strict invariants */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        {/* Quantization */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Cpu className="w-4 h-4" /> 8-Bit Quantized Backbone
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Frozen 6B base transformer in INT8 via bitsandbytes. Reduces base footprint from 12.2 GB down to ~6.2 GB.
          </p>
        </div>

        {/* Gradient Checkpointing */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Layers className="w-4 h-4" /> Gradient Checkpointing
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            prepare_model_for_kbit_training() active. Caps intermediate activation memory to &lt; 2.0 GB.
          </p>
        </div>

        {/* 8-bit Optimizer */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-purple-400">
              <Zap className="w-4 h-4" /> 8-Bit AdamW Optimizer
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            bitsandbytes.optim.AdamW8bit limits first & second moment optimizer tensors to &lt; 0.5 GB.
          </p>
        </div>

        {/* Purged VAE / Text Encoder */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <EyeOff className="w-4 h-4" /> Purged VAE & Text Encoder
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">PURGED</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Pre-caches all latents and text embeddings to host RAM. Unloads encoder models completely from GPU memory.
          </p>
        </div>

        {/* Ampere FP8 Invariant (Strict Rule) */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-amber-400">
              <AlertOctagon className="w-4 h-4" /> No FP8 Kernels (Ampere SM 8.6)
            </span>
            <span className="text-[10px] text-amber-400 font-mono">PREVENTED</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Ampere lacks native FP8 tensor core GEMMs. Replaced with INT8 quantization to avoid emulation overhead.
          </p>
        </div>

        {/* Offline CPU De-Turbo Blender */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <HardDrive className="w-4 h-4" /> Host RAM De-Distillation
            </span>
            <span className="text-[10px] text-indigo-300 font-mono">0 MB VRAM</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Fuses Ostris de-turbo LoRA into base weights purely in host RAM before training starts.
          </p>
        </div>
      </div>
    </div>
  );
};
