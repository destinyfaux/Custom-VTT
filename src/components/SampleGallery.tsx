import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, RefreshCw, ZoomIn, X, Download, Sliders, Layers } from 'lucide-react';
import { TrainingSample } from '../types/training';

interface SampleGalleryProps {
  samples: TrainingSample[];
  onGenerateManual: (prompt: string, seed: number, steps: number) => Promise<void>;
  currentStep: number;
}

export const SampleGallery: React.FC<SampleGalleryProps> = ({
  samples,
  onGenerateManual,
  currentStep
}) => {
  const [selectedSample, setSelectedSample] = useState<TrainingSample | null>(null);
  const [manualPrompt, setManualPrompt] = useState(
    'A hyperrealistic cinematic portrait of a cybernetic warrior in a luminescent neon botanical dome, 8k octane render'
  );
  const [manualSeed, setManualSeed] = useState(42);
  const [manualSteps, setManualSteps] = useState(8);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      await onGenerateManual(manualPrompt, manualSeed, manualSteps);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header & In-Training Validation Prompt Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h3 className="text-slate-100 font-semibold text-sm">
              Live In-Training Validation Gallery
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 font-mono">
              {samples.length} Previews
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fast 8-step Euler validation generation interleaved during training (0 VRAM memory collision)
          </p>
        </div>

        {/* Quick prompt sampler form */}
        <form onSubmit={handleGenerate} className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 max-w-2xl">
          <input
            type="text"
            value={manualPrompt}
            onChange={(e) => setManualPrompt(e.target.value)}
            placeholder="Validation generation prompt..."
            className="flex-1 min-w-[240px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
          <input
            type="number"
            value={manualSeed}
            onChange={(e) => setManualSeed(Number(e.target.value))}
            title="Seed"
            className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap shadow-md disabled:opacity-50"
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Sample Now (8-Step)
          </button>
        </form>
      </div>

      {/* Gallery Grid */}
      {samples.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {samples.map((sample) => (
            <div
              key={sample.id}
              onClick={() => setSelectedSample(sample)}
              className="group relative bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition-all shadow-md hover:shadow-indigo-500/10"
            >
              {/* Aspect-Ratio Box */}
              <div className="aspect-square relative overflow-hidden bg-slate-900">
                <img
                  src={sample.url}
                  alt={sample.prompt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div className="flex items-center justify-between w-full text-xs text-slate-200">
                    <span className="flex items-center gap-1 font-mono text-[11px] text-cyan-300">
                      <ZoomIn className="w-3.5 h-3.5" /> Zoom
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{sample.resolution}</span>
                  </div>
                </div>

                {/* Step Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-900/90 backdrop-blur border border-slate-700/80 text-[11px] font-mono font-bold text-indigo-300">
                  Step {sample.step}
                </div>
              </div>

              {/* Sample Metadata Details */}
              <div className="p-3 space-y-1.5">
                <p className="text-xs text-slate-300 line-clamp-2 font-sans" title={sample.prompt}>
                  {sample.prompt}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-800/60">
                  <span>Seed: {sample.seed}</span>
                  <span>{sample.steps} Steps · cfg 4.0</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/40">
          <ImageIcon className="w-10 h-10 text-slate-600 mb-2" />
          <h4 className="text-slate-300 font-medium text-sm">No In-Training Previews Generated Yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Validation images will automatically render every {50} steps, or click "Sample Now" above to test immediately.
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
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono text-xs text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Validation Preview — Step {selectedSample.step}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSample(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
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
              <div className="text-slate-200 font-medium">{selectedSample.prompt}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                <div>Step: <span className="text-slate-200">{selectedSample.step}</span></div>
                <div>Seed: <span className="text-slate-200">{selectedSample.seed}</span></div>
                <div>Sampler: <span className="text-slate-200">Euler 8-step</span></div>
                <div>Resolution: <span className="text-slate-200">{selectedSample.resolution}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
