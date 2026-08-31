import React, { useState } from 'react';
import { 
  Image as ImageIcon, 
  Sparkles, 
  RefreshCw, 
  ZoomIn, 
  X, 
  Download, 
  Sliders, 
  Layers, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Zap,
  ListOrdered
} from 'lucide-react';
import { TrainingSample, SamplePromptItem } from '../types/training';

interface SampleGalleryProps {
  samples: TrainingSample[];
  onGenerateManual: (prompt: string, seed: number, steps: number, guidance_scale: number) => Promise<void>;
  currentStep: number;
  sampleInterval: number;
  onChangeSampleInterval?: (interval: number) => void;
}

export const SampleGallery: React.FC<SampleGalleryProps> = ({
  samples,
  onGenerateManual,
  currentStep,
  sampleInterval,
  onChangeSampleInterval
}) => {
  const [selectedSample, setSelectedSample] = useState<TrainingSample | null>(null);
  const [manualPrompt, setManualPrompt] = useState(
    'A hyperrealistic cinematic portrait of a cybernetic warrior in a luminescent neon botanical dome, 8k octane render'
  );
  const [manualSeed, setManualSeed] = useState(42);
  const [manualSteps, setManualSteps] = useState(8);
  const [manualGuidanceScale, setManualGuidanceScale] = useState(4.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Multi-Prompt Queue State
  const [promptQueue, setPromptQueue] = useState<SamplePromptItem[]>([
    { id: 'p1', prompt: 'A hyperrealistic cinematic portrait of a cybernetic warrior in a luminescent neon botanical dome, 8k octane render', seed: 42, steps: 8, guidance_scale: 4.0, enabled: true },
    { id: 'p2', prompt: 'An intricate macro shot of a crystal rose blooming with swirling aurora borealis light, photorealistic, 8k', seed: 1337, steps: 8, guidance_scale: 4.0, enabled: true },
    { id: 'p3', prompt: 'A masterwork architectural render of a minimalist glass pavilion nestled in a tranquil misty mountain forest at dusk', seed: 888, steps: 28, guidance_scale: 6.5, enabled: false }
  ]);
  const [newQueuePrompt, setNewQueuePrompt] = useState('');
  const [newQueueSeed, setNewQueueSeed] = useState(42);
  const [newQueueSteps, setNewQueueSteps] = useState(8);
  const [newQueueCFG, setNewQueueCFG] = useState(4.0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      await onGenerateManual(manualPrompt, manualSeed, manualSteps, manualGuidanceScale);
    } finally {
      setIsGenerating(false);
    }
  };

  const setTurboPreset = () => {
    setManualSteps(8);
    setManualGuidanceScale(1.5);
  };

  const setBasePreset = () => {
    setManualSteps(28);
    setManualGuidanceScale(4.5);
  };

  const handleAddQueuePrompt = () => {
    if (!newQueuePrompt.trim()) return;
    const newItem: SamplePromptItem = {
      id: `pq_${Date.now()}`,
      prompt: newQueuePrompt.trim(),
      seed: newQueueSeed,
      steps: newQueueSteps,
      guidance_scale: newQueueCFG,
      enabled: true
    };
    setPromptQueue([...promptQueue, newItem]);
    setNewQueuePrompt('');
    setNewQueueSeed(Math.floor(Math.random() * 10000));
  };

  const handleRemoveQueuePrompt = (id: string) => {
    setPromptQueue(promptQueue.filter(p => p.id !== id));
  };

  const handleToggleQueuePrompt = (id: string) => {
    setPromptQueue(promptQueue.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleUpdateQueueItem = (id: string, updates: Partial<SamplePromptItem>) => {
    setPromptQueue(promptQueue.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header & In-Training Validation Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h3 className="text-neutral-100 font-semibold text-sm">
              Live Multi-Prompt In-Training Validation Gallery
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-indigo-300 border border-neutral-700 font-mono">
              {samples.length} Previews
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Active LoRA/LoKr Applied
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Fast 8-step Euler S3-DiT validation generation interleaved during training steps (Step 0 baseline + every {sampleInterval} steps).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQueueOpen(!isQueueOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              isQueueOpen 
                ? 'bg-indigo-600 text-white border-indigo-500' 
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Validation Prompts Queue ({promptQueue.filter(p => p.enabled).length})</span>
          </button>
        </div>
      </div>

      {/* Multi-Prompt Queue Drawer / Card */}
      {isQueueOpen && (
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Scheduled Validation Prompts Queue
            </h4>
            <span className="text-[11px] text-neutral-500">
              Renders all enabled prompts at each validation checkpoint
            </span>
          </div>

          <div className="space-y-2">
            {promptQueue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80 text-xs"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => handleToggleQueuePrompt(item.id)}
                    className="rounded border-neutral-700 bg-neutral-800 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-neutral-300 font-sans truncate" title={item.prompt}>{item.prompt}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                    <span>Seed:</span>
                    <input
                      type="number"
                      value={item.seed}
                      onChange={(e) => handleUpdateQueueItem(item.id, { seed: Number(e.target.value) })}
                      className="w-16 bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 text-center font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                    <span>Steps:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={item.steps || 8}
                      onChange={(e) => handleUpdateQueueItem(item.id, { steps: Number(e.target.value) })}
                      className="w-14 bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 text-center font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                    <span>CFG:</span>
                    <input
                      type="number"
                      step="0.5"
                      min={1.0}
                      max={20.0}
                      value={item.guidance_scale || 4.0}
                      onChange={(e) => handleUpdateQueueItem(item.id, { guidance_scale: Number(e.target.value) })}
                      className="w-14 bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 text-center font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveQueuePrompt(item.id)}
                    className="p-1 text-neutral-500 hover:text-rose-400 transition-colors ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Queue Item Form */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-800/60">
            <input
              type="text"
              placeholder="Add new scheduled validation prompt..."
              value={newQueuePrompt}
              onChange={e => setNewQueuePrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddQueuePrompt()}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={newQueueSeed}
                onChange={e => setNewQueueSeed(Number(e.target.value))}
                placeholder="Seed"
                title="Seed"
                className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-100 font-mono text-center"
              />
              <input
                type="number"
                value={newQueueSteps}
                onChange={e => setNewQueueSteps(Number(e.target.value))}
                placeholder="Steps"
                title="Steps"
                className="w-14 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-100 font-mono text-center"
              />
              <input
                type="number"
                step="0.5"
                value={newQueueCFG}
                onChange={e => setNewQueueCFG(Number(e.target.value))}
                placeholder="CFG"
                title="CFG Scale"
                className="w-14 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-100 font-mono text-center"
              />
            </div>
            <button
              type="button"
              onClick={handleAddQueuePrompt}
              disabled={!newQueuePrompt.trim()}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Add Prompt
            </button>
          </div>
        </div>
      )}

      {/* Manual Immediate Sampler Bar */}
      <form onSubmit={handleGenerate} className="flex flex-wrap items-center gap-2 p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
        <input
          type="text"
          value={manualPrompt}
          onChange={(e) => setManualPrompt(e.target.value)}
          placeholder="Manual test prompt..."
          className="flex-1 min-w-[220px] bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 font-sans"
        />
        
        {/* Preset Quick-Buttons */}
        <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
          <button
            type="button"
            onClick={setTurboPreset}
            title="Set Turbo Parameters: 8 Steps, CFG 1.5"
            className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-colors ${
              manualSteps === 8 && manualGuidanceScale === 1.5 
                ? 'bg-indigo-600 text-white' 
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Turbo (8st/1.5)
          </button>
          <button
            type="button"
            onClick={setBasePreset}
            title="Set Base Model Parameters: 28 Steps, CFG 4.5"
            className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-colors ${
              manualSteps === 28 && manualGuidanceScale === 4.5 
                ? 'bg-indigo-600 text-white' 
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Base (28st/4.5)
          </button>
        </div>

        {/* Sampling Parameters Inputs: Steps, CFG, Seed */}
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs">
          <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-400">
            <span>Steps:</span>
            <input
              type="number"
              min={1}
              max={100}
              value={manualSteps}
              onChange={(e) => setManualSteps(Number(e.target.value))}
              className="w-12 bg-neutral-950 border border-neutral-700 rounded px-1 text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-400">
            <span>CFG:</span>
            <input
              type="number"
              step="0.5"
              min={1.0}
              max={20.0}
              value={manualGuidanceScale}
              onChange={(e) => setManualGuidanceScale(Number(e.target.value))}
              className="w-12 bg-neutral-950 border border-neutral-700 rounded px-1 text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-400">
            <span>Seed:</span>
            <input
              type="number"
              value={manualSeed}
              onChange={(e) => setManualSeed(Number(e.target.value))}
              className="w-16 bg-neutral-950 border border-neutral-700 rounded px-1 text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap shadow-md disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Sample Now
        </button>
      </form>

      {/* Gallery Grid */}
      {samples.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {samples.map((sample) => (
            <div
              key={sample.id}
              onClick={() => setSelectedSample(sample)}
              className="group relative bg-neutral-950 border border-neutral-800 hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition-all shadow-md hover:shadow-indigo-500/10"
            >
              {/* Aspect-Ratio Box */}
              <div className="aspect-square relative overflow-hidden bg-neutral-900">
                <img
                  src={sample.url}
                  alt={sample.prompt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div className="flex items-center justify-between w-full text-xs text-neutral-200">
                    <span className="flex items-center gap-1 font-mono text-[11px] text-cyan-300">
                      <ZoomIn className="w-3.5 h-3.5" /> Inspect
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400">{sample.resolution}</span>
                  </div>
                </div>

                {/* Step Badge */}
                <div className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded backdrop-blur border text-[11px] font-mono font-bold ${
                  sample.step === 0 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                    : 'bg-neutral-900/90 border-neutral-700/80 text-indigo-300'
                }`}>
                  {sample.step === 0 ? 'Step 0 (Baseline)' : `Step ${sample.step}`}
                </div>
              </div>

              {/* Sample Metadata Details */}
              <div className="p-3 space-y-1.5">
                <p className="text-xs text-neutral-300 line-clamp-2 font-sans" title={sample.prompt}>
                  {sample.prompt}
                </p>
                <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono pt-1 border-t border-neutral-800/60">
                  <span>Seed: {sample.seed}</span>
                  <span className="text-indigo-300">{sample.steps} Steps · CFG {sample.guidance_scale?.toFixed(1) || '4.0'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-950/40">
          <ImageIcon className="w-10 h-10 text-neutral-600 mb-2" />
          <h4 className="text-neutral-300 font-medium text-sm">No In-Training Previews Generated Yet</h4>
          <p className="text-xs text-neutral-500 max-w-sm mt-1">
            Validation images will automatically render Step 0 Baseline upon start and every {sampleInterval} steps thereafter.
          </p>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {selectedSample && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedSample(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-mono text-xs text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>
                  {selectedSample.step === 0 ? 'Baseline Validation Preview (Step 0)' : `Validation Preview — Step ${selectedSample.step}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSample(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[60vh]">
              <img
                src={selectedSample.url}
                alt={selectedSample.prompt}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-neutral-200 font-medium">{selectedSample.prompt}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-800 text-[11px] font-mono text-neutral-400">
                <div>Step: <span className="text-neutral-200">{selectedSample.step}</span></div>
                <div>Seed: <span className="text-neutral-200">{selectedSample.seed}</span></div>
                <div>Sampler Steps: <span className="text-indigo-300 font-bold">{selectedSample.steps}</span></div>
                <div>CFG Scale: <span className="text-indigo-300 font-bold">{selectedSample.guidance_scale?.toFixed(1) || '4.0'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

