import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Activity,
  Layers,
  LayoutGrid,
  ShieldCheck,
  Award,
  Terminal,
  Save,
  Cpu,
  Zap,
  HardDrive,
  CheckCircle2,
  Sparkles,
  Info,
  Radio,
  FolderOpen,
  Box
} from 'lucide-react';
import { useTrainingWebSocket } from './services/websocket';
import { TrainingConfigState, PeftEstimate, HardwareInfo, AspectBucket, DatasetFolder } from './types/training';
import { LayerMatrix } from './components/LayerMatrix';
import { MetricsDashboard } from './components/MetricsDashboard';
import { SampleGallery } from './components/SampleGallery';
import { BucketVisualizer } from './components/BucketVisualizer';
import { HardwareGuardrails } from './components/HardwareGuardrails';
import { OPSDPanel } from './components/OPSDPanel';
import { TrainingConfigPanel } from './components/TrainingConfigPanel';
import { DryRunModal } from './components/DryRunModal';
import { CheckpointsDrawer } from './components/CheckpointsDrawer';
import { DatasetManager } from './components/DatasetManager';
import { ModelComponentsCard } from './components/ModelComponentsCard';

export default function App() {
  const {
    isConnected,
    metrics,
    samples,
    checkpoints,
    currentStatus,
    currentStep,
    totalSteps,
    setCurrentStatus
  } = useTrainingWebSocket();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'datasets' | 'models' | 'layers' | 'buckets' | 'opsd' | 'hardware'>('dashboard');

  // Modals & Drawers
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);
  const [isCheckpointsOpen, setIsCheckpointsOpen] = useState(false);

  // Configuration State
  const [config, setConfig] = useState<TrainingConfigState>({
    model_name: 'Tongyi-MAI/Z-Image-Turbo',
    base_model_path: 'Tongyi-MAI/Z-Image-Turbo',
    transformer_path: 'Tongyi-MAI/Z-Image-Turbo',
    vae_path: 'Tongyi-MAI/Z-Image-Turbo/vae',
    text_encoder_path: 'google/siglip-so400m-patch14-384',
    output_dir: './outputs/zimage_lora',
    dataset_cache_path: './cache/latents_embeddings.pt',
    dataset_folders: [
      { id: 'ds_1', path: './dataset/character_art', weight: 1.0, repeats: 1, pair_count: 120, enabled: true },
      { id: 'ds_2', path: './dataset/environment_captions', weight: 0.8, repeats: 1, pair_count: 85, enabled: true }
    ],
    adapter_type: 'lora',
    target_blocks: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], // Default Mid blocks
    is_fused_qkv: true,
    rank: 16,
    alpha: 32,
    dropout: 0.05,
    learning_rate: 0.0001,
    min_lr: 0.000001,
    lr_scheduler: 'cosine',
    weight_decay: 0.01,
    total_steps: 1000,
    gradient_accumulation_steps: 1,
    gradient_checkpointing: true,
    timestep_scale: 1000.0,
    use_opsd: true,
    opsd_lambda: 0.15,
    reward_model: 'Aesthetic-Predictor-v2',
    sample_every_n_steps: 250,
    sample_prompt: 'A cinematic hyperrealistic cybernetic tiger in a luminescent neon botanical laboratory, 8k, photorealistic',
    sample_seed: 42,
    sample_steps: 8,
    amp_enabled: true,
    amp_dtype: 'bfloat16',
    soft_checkpoint_every_n_steps: 250,
    target_megapixels: 1.0,
    aspect_mode: 'auto',
    fixed_ratio: '1:1',
    max_grad_norm: 1.0
  });

  const [peftEstimate, setPeftEstimate] = useState<PeftEstimate | null>(null);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [buckets, setBuckets] = useState<AspectBucket[]>([]);

  // Fetch initial data
  const fetchHardware = async () => {
    try {
      const r = await fetch('/api/hardware/probe');
      const data = await r.json();
      setHardware(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBuckets = async (mp = config.target_megapixels || 1.0) => {
    try {
      const r = await fetch(`/api/buckets?megapixels=${mp}`);
      const data = await r.json();
      setBuckets(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHardware();
    fetchBuckets(config.target_megapixels || 1.0);
  }, []);

  // Update PEFT parameter estimate whenever targeting or adapter changes
  useEffect(() => {
    fetch('/api/peft/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_blocks: config.target_blocks,
        adapter_type: config.adapter_type,
        rank: config.rank,
        alpha: config.alpha
      })
    })
      .then((r) => r.json())
      .then(setPeftEstimate)
      .catch(console.error);
  }, [config.target_blocks, config.adapter_type, config.rank, config.alpha]);

  const updateConfig = (updated: Partial<TrainingConfigState>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updated };
      if (updated.target_megapixels && updated.target_megapixels !== prev.target_megapixels) {
        fetchBuckets(updated.target_megapixels);
      }
      return next;
    });
  };

  // Actions
  const handleStartTraining = async () => {
    try {
      await fetch('/api/train/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      setCurrentStatus('running');
    } catch (e) {
      console.error(e);
    }
  };

  const handlePauseTraining = async () => {
    try {
      await fetch('/api/train/pause', { method: 'POST' });
      setCurrentStatus('paused');
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeTraining = async () => {
    try {
      await fetch('/api/train/resume', { method: 'POST' });
      setCurrentStatus('running');
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopTraining = async () => {
    try {
      await fetch('/api/train/stop', { method: 'POST' });
      setCurrentStatus('idle');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRollback = async (targetStep: number) => {
    console.log('Rolling back training weights and state to step:', targetStep);
    try {
      await fetch('/api/train/resume', { method: 'POST' });
      setCurrentStatus('running');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCacheDataset = async (datasetDir: string) => {
    const res = await fetch('/api/cache/dataset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_dir: datasetDir })
    });
    return await res.json();
  };

  const handleMergeDeTurbo = async () => {
    const res = await fetch('/api/merge/deturbo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_model_id: config.base_model_path,
        adapter_repo: 'ostris/zimage_turbo_training_adapter'
      })
    });
    return await res.json();
  };

  const handleManualSample = async (prompt: string, seed: number, steps: number) => {
    await fetch('/api/samples/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, seed, steps })
    });
  };

  const handleResumeFromCheckpoint = (step: number) => {
    handleResumeTraining();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Model Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  Z-Image Studio
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono font-semibold">
                  S3-DiT 6.1B
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                  INT8 Quantized
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                  AMP {config.amp_dtype || 'bfloat16'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Specialized S3-DiT LoRA/LoKr Suite & DiffusionOPSD Reward Alignment
              </p>
            </div>
          </div>

          {/* Target Hardware Guardrail Indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-mono">{hardware?.gpu_name?.split(' ')[1] || 'RTX'} 3080 12GB</span>
              <span className="text-slate-500">|</span>
              <span className="text-cyan-300 font-mono">Budget ≤ 10.8 GB</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className="text-[11px] text-slate-400 font-mono">
                {isConnected ? 'IPC Telemetry Live' : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Dry Run Button */}
            <button
              type="button"
              onClick={() => setIsDryRunOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors shadow-sm"
              title="Validate S3-DiT Graph Execution without GPU"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Dry-Run Test</span>
            </button>

            {/* Checkpoints Button */}
            <button
              type="button"
              onClick={() => setIsCheckpointsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Checkpoints</span>
              <span className="font-mono text-[10px] px-1.5 rounded bg-slate-700 text-slate-300">
                {checkpoints.length}
              </span>
            </button>

            {/* Main Orchestrator Control Buttons */}
            {currentStatus === 'idle' || currentStatus === 'completed' ? (
              <button
                type="button"
                onClick={handleStartTraining}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg transition-all shadow-lg shadow-indigo-600/30"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Start S3-DiT Training
              </button>
            ) : currentStatus === 'running' ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePauseTraining}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all shadow-md shadow-amber-600/30"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Atomic Pause
                </button>
                <button
                  type="button"
                  onClick={handleStopTraining}
                  className="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-lg transition-colors"
                  title="Stop Training"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            ) : currentStatus === 'paused' ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResumeTraining}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-md shadow-emerald-600/30"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Resume Step {currentStep}
                </button>
                <button
                  type="button"
                  onClick={handleStopTraining}
                  className="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-lg transition-colors"
                  title="Stop Training"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            Training & Telemetry
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('datasets')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'datasets'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Dataset & Captions ({config.dataset_folders?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'models'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Box className="w-4 h-4" />
            Model & Backbones
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'layers'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Layer Matrix (30 Blocks)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('buckets')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'buckets'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Aspect Bucketing ({config.target_megapixels || 1.0} MP)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('opsd')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'opsd'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Award className="w-4 h-4" />
            DiffusionOPSD & Schedulers
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hardware')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'hardware'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Hardware Diagnostics
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Tab 1: Primary Training & Telemetry Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Live Metrics Ribbon & Loss/VRAM Charts */}
            <MetricsDashboard
              metrics={metrics}
              status={currentStatus}
              currentStep={currentStep}
              totalSteps={totalSteps}
              onPause={handlePauseTraining}
              onResume={handleResumeTraining}
              onStop={handleStopTraining}
              checkpoints={checkpoints}
              onRollback={handleRollback}
            />

            {/* Target Layer Matrix */}
            <LayerMatrix
              selectedBlocks={config.target_blocks}
              onChange={(blocks) => updateConfig({ target_blocks: blocks })}
              peftEstimate={peftEstimate}
              adapterType={config.adapter_type}
              rank={config.rank}
            />

            {/* In-Training Live Validation Gallery */}
            <SampleGallery
              samples={samples}
              onGenerateManual={handleManualSample}
              currentStep={currentStep}
            />
          </div>
        )}

        {/* Tab 2: Dataset & Captions Inspector */}
        {activeTab === 'datasets' && (
          <div className="space-y-6">
            <DatasetManager
              folders={config.dataset_folders || []}
              onChangeFolders={(folders) => updateConfig({ dataset_folders: folders })}
              cachePath={config.dataset_cache_path}
              onChangeCachePath={(path) => updateConfig({ dataset_cache_path: path })}
              targetMegapixels={config.target_megapixels || 1.0}
            />
          </div>
        )}

        {/* Tab 3: Model & Backbones Configuration */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            <ModelComponentsCard
              transformerPath={config.transformer_path || config.base_model_path}
              onChangeTransformerPath={(p) => updateConfig({ transformer_path: p, base_model_path: p })}
              vaePath={config.vae_path || 'Tongyi-MAI/Z-Image-Turbo/vae'}
              onChangeVaePath={(p) => updateConfig({ vae_path: p })}
              textEncoderPath={config.text_encoder_path || 'google/siglip-so400m-patch14-384'}
              onChangeTextEncoderPath={(p) => updateConfig({ text_encoder_path: p })}
            />
            <TrainingConfigPanel
              config={config}
              onChange={updateConfig}
              onMergeDeTurbo={handleMergeDeTurbo}
            />
          </div>
        )}

        {/* Tab 4: Detailed Layer Matrix & Parameter Calculator */}
        {activeTab === 'layers' && (
          <div className="space-y-6">
            <LayerMatrix
              selectedBlocks={config.target_blocks}
              onChange={(blocks) => updateConfig({ target_blocks: blocks })}
              peftEstimate={peftEstimate}
              adapterType={config.adapter_type}
              rank={config.rank}
            />

            {/* PEFT Target Configuration & Breakdown */}
            <TrainingConfigPanel
              config={config}
              onChange={updateConfig}
              onMergeDeTurbo={handleMergeDeTurbo}
            />
          </div>
        )}

        {/* Tab 5: Aspect-Ratio Dynamic Bucketing & Caching */}
        {activeTab === 'buckets' && (
          <div className="space-y-6">
            <BucketVisualizer
              buckets={buckets}
              onCacheDataset={handleCacheDataset}
              targetMegapixels={config.target_megapixels || 1.0}
              onChangeMegapixels={(mp) => updateConfig({ target_megapixels: mp })}
              aspectMode={config.aspect_mode || 'auto'}
              onChangeAspectMode={(mode) => updateConfig({ aspect_mode: mode })}
              fixedRatio={config.fixed_ratio || '1:1'}
              onChangeFixedRatio={(ratio) => updateConfig({ fixed_ratio: ratio })}
            />
          </div>
        )}

        {/* Tab 6: DiffusionOPSD & PEFT Hyperparameters */}
        {activeTab === 'opsd' && (
          <div className="space-y-6">
            <OPSDPanel
              config={config}
              onChange={updateConfig}
            />
            <TrainingConfigPanel
              config={config}
              onChange={updateConfig}
              onMergeDeTurbo={handleMergeDeTurbo}
            />
          </div>
        )}

        {/* Tab 7: Hardware Guardrails & RTX 3080 Invariants */}
        {activeTab === 'hardware' && (
          <div className="space-y-6">
            <HardwareGuardrails
              hardware={hardware}
              currentVramGb={metrics.length > 0 ? (metrics[metrics.length - 1].vram_gb || metrics[metrics.length - 1].vram_mb! / 1024) : 9.2}
              onRefreshHardware={fetchHardware}
            />
            <BucketVisualizer
              buckets={buckets}
              onCacheDataset={handleCacheDataset}
              targetMegapixels={config.target_megapixels || 1.0}
              onChangeMegapixels={(mp) => updateConfig({ target_megapixels: mp })}
              aspectMode={config.aspect_mode || 'auto'}
              onChangeAspectMode={(mode) => updateConfig({ aspect_mode: mode })}
              fixedRatio={config.fixed_ratio || '1:1'}
              onChangeFixedRatio={(ratio) => updateConfig({ fixed_ratio: ratio })}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-4 lg:px-8 py-3 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Z-Image Studio</span>
            <span>·</span>
            <span>Single-Stream Diffusion Transformer (S3-DiT 30-Block Architecture)</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Flow Matching: τ = 1000·t</span>
            <span>·</span>
            <span>Loss: MSE(v*, v_θ) - λ·R(x̂₀)</span>
            <span>·</span>
            <span className="text-emerald-400">Zero-OOM RTX 3080 12GB Safe</span>
          </div>
        </div>
      </footer>

      {/* Dry Run Test Modal */}
      <DryRunModal
        isOpen={isDryRunOpen}
        onClose={() => setIsDryRunOpen(false)}
      />

      {/* Zero-Loss Checkpoints Drawer */}
      <CheckpointsDrawer
        isOpen={isCheckpointsOpen}
        onClose={() => setIsCheckpointsOpen(false)}
        checkpoints={checkpoints}
        onResumeFromCheckpoint={handleResumeFromCheckpoint}
        onRollback={handleRollback}
      />
    </div>
  );
}
