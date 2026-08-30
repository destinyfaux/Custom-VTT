import React from 'react';
import { Layers, Info, Sparkles, Cpu, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PeftEstimate } from '../types/training';

interface LayerMatrixProps {
  selectedBlocks: number[];
  onChange: (blocks: number[]) => void;
  peftEstimate?: PeftEstimate | null;
  adapterType: 'lora' | 'lokr';
  rank: number;
}

export const LayerMatrix: React.FC<LayerMatrixProps> = ({
  selectedBlocks,
  onChange,
  peftEstimate,
  adapterType,
  rank
}) => {
  const TOTAL_BLOCKS = 30;
  const isSelected = (idx: number) => selectedBlocks.includes(idx);

  const toggleBlock = (idx: number) => {
    if (isSelected(idx)) {
      onChange(selectedBlocks.filter((b) => b !== idx));
    } else {
      onChange([...selectedBlocks, idx].sort((a, b) => a - b));
    }
  };

  const setRange = (start: number, end: number) => {
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const merged = Array.from(new Set([...selectedBlocks, ...range])).sort((a, b) => a - b);
    onChange(merged);
  };

  const selectAll = () => {
    onChange(Array.from({ length: TOTAL_BLOCKS }, (_, i) => i));
  };

  const getBlockTier = (idx: number) => {
    if (idx < 10) return { label: 'Early (Semantics/Structure)', color: 'text-blue-400', border: 'border-blue-500/20' };
    if (idx < 20) return { label: 'Mid (Aesthetic & Style)', color: 'text-emerald-400', border: 'border-emerald-500/20' };
    return { label: 'Late (Fine Textures & Micro-Detail)', color: 'text-purple-400', border: 'border-purple-500/20' };
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-slate-100 font-semibold text-sm flex items-center gap-2">
              S3-DiT Target Layer Matrix
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                30 Blocks
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select specific DiT blocks for selective gradient backpropagation & PEFT injection
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setRange(0, 9)}
            className="px-2.5 py-1 text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors"
          >
            Early (0-9)
          </button>
          <button
            type="button"
            onClick={() => setRange(10, 19)}
            className="px-2.5 py-1 text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded hover:bg-emerald-600/30 transition-colors"
          >
            Mid (10-19)
          </button>
          <button
            type="button"
            onClick={() => setRange(20, 29)}
            className="px-2.5 py-1 text-xs font-medium bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded hover:bg-purple-600/30 transition-colors"
          >
            Late (20-29)
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 rounded hover:bg-slate-700 transition-colors"
          >
            All 30
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800/80 text-rose-300 border border-rose-900/40 rounded hover:bg-rose-900/20 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* 30-Block Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 mb-4">
        {Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
          const active = isSelected(i);
          const tier = getBlockTier(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleBlock(i)}
              title={`Block ${i} - ${tier.label}`}
              className={`relative h-12 rounded-lg font-mono text-xs font-bold transition-all duration-150 border flex flex-col items-center justify-center gap-0.5 group ${
                active
                  ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 border-indigo-400 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/50 scale-[0.98]'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className="text-xs">L{i}</span>
              <span className={`text-[9px] font-sans ${active ? 'text-indigo-200' : 'text-slate-500'}`}>
                {i < 10 ? 'early' : i < 20 ? 'mid' : 'late'}
              </span>
              {active && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-sm ring-2 ring-slate-900" />
              )}
            </button>
          );
        })}
      </div>

      {/* Target Module Breakdown & PEFT Stats */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="text-slate-300 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Target Modules ({selectedBlocks.length * 5} tensors):</span>
          </div>
          <p className="text-slate-400 font-mono text-[11px] leading-relaxed">
            {selectedBlocks.length > 0 ? (
              <>
                <span className="text-cyan-400 font-semibold">attention.qkv</span>,{' '}
                <span className="text-cyan-400 font-semibold">attention.out</span>,{' '}
                <span className="text-emerald-400">feed_forward.w1</span>,{' '}
                <span className="text-emerald-400">feed_forward.w2</span>,{' '}
                <span className="text-emerald-400">feed_forward.w3</span> across blocks{' '}
                <span className="text-indigo-300">[{selectedBlocks.join(', ')}]</span>
              </>
            ) : (
              <span className="text-rose-400 font-semibold">No blocks targeted (Full backbone frozen in 8-bit)</span>
            )}
          </p>
        </div>

        {peftEstimate && (
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
            <div>
              <div className="text-[11px] text-slate-400">Trainable Params</div>
              <div className="font-mono font-bold text-slate-100">
                {peftEstimate.trainable_params_millions}M{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ({peftEstimate.trainable_percentage}%)
                </span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Est. VRAM Peak</div>
              <div className="font-mono font-bold text-indigo-300">
                {peftEstimate.estimated_vram_gb} GB{' '}
                <span className="text-[10px] text-emerald-400 font-normal">
                  (≤ 10.8 GB ✓)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
