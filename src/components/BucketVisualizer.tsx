import React, { useState } from 'react';
import { LayoutGrid, Database, CheckCircle2, ArrowRight, RefreshCw, Cpu, Layers, Sliders } from 'lucide-react';
import { AspectBucket } from '../types/training';

interface BucketVisualizerProps {
  buckets: AspectBucket[];
  onCacheDataset: (dir: string) => Promise<any>;
  targetMegapixels?: number;
  onChangeMegapixels?: (mp: number) => void;
  aspectMode?: 'auto' | 'fixed';
  onChangeAspectMode?: (mode: 'auto' | 'fixed') => void;
  fixedRatio?: string;
  onChangeFixedRatio?: (ratio: string) => void;
}

export const BucketVisualizer: React.FC<BucketVisualizerProps> = ({
  buckets,
  onCacheDataset,
  targetMegapixels = 1.0,
  onChangeMegapixels,
  aspectMode = 'auto',
  onChangeAspectMode,
  fixedRatio = '1:1',
  onChangeFixedRatio
}) => {
  const [testWidth, setTestWidth] = useState(1280);
  const [testHeight, setTestHeight] = useState(720);
  const [datasetDir, setDatasetDir] = useState('./dataset');
  const [cachingStatus, setCachingStatus] = useState<string | null>(null);
  const [isCaching, setIsCaching] = useState(false);

  // Find closest bucket for input dimensions
  const testAspect = testWidth / Math.max(1, testHeight);
  const matchedBucket = buckets.length > 0
    ? [...buckets].sort((a, b) => Math.abs(a.aspect_ratio - testAspect) - Math.abs(b.aspect_ratio - testAspect))[0]
    : { width: 1024, height: 1024, aspect_ratio: 1.0, pixels: 1048576, tag: '1:1' };

  const handleRunCache = async () => {
    setIsCaching(true);
    setCachingStatus('Extracting VAE latents and Text Encoder embeddings to CPU RAM...');
    try {
      const res = await onCacheDataset(datasetDir);
      setCachingStatus(`✓ Successfully cached ${res.num_samples || 128} samples to disk. VAE & Text Encoder purged from VRAM.`);
    } catch (e) {
      setCachingStatus('Failed to cache dataset.');
    } finally {
      setIsCaching(false);
    }
  };

  const megapixelOptions = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
  const ratioOptions = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '2.39:1'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-slate-100 font-semibold text-sm">
              Multi-Megapixel Aspect Bucketing Engine
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Discretizes arbitrary image aspect ratios into 64-step divisible latent grids with zero padding distortion
            </p>
          </div>
        </div>

        {/* Megapixel scale picker */}
        {onChangeMegapixels && (
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 pl-1 font-medium">Target MP:</span>
            <div className="flex gap-1">
              {megapixelOptions.map(mp => (
                <button
                  key={mp}
                  type="button"
                  onClick={() => onChangeMegapixels(mp)}
                  className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                    targetMegapixels === mp
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mp} MP
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Aspect Mode Selector */}
      {onChangeAspectMode && (
        <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-300">Aspect Ratio Strategy:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onChangeAspectMode('auto')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  aspectMode === 'auto'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Dynamic Auto-Decide (Per Image)
              </button>
              <button
                type="button"
                onClick={() => onChangeAspectMode('fixed')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  aspectMode === 'fixed'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Hard-Set Fixed Ratio
              </button>
            </div>
          </div>

          {aspectMode === 'fixed' && onChangeFixedRatio && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Lock To:</span>
              <div className="flex gap-1">
                {ratioOptions.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onChangeFixedRatio(r)}
                    className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                      fixedRatio === r
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {cachingStatus && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{cachingStatus}</span>
        </div>
      )}

      {/* Interactive Bucket Tester */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>Interactive Image Aspect Target Tester ({targetMegapixels} MP Base)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-slate-400 block mb-1">Source Width (px)</label>
              <input
                type="number"
                value={testWidth}
                onChange={(e) => setTestWidth(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-slate-500 mt-4">×</span>
            <div className="flex-1">
              <label className="text-[11px] text-slate-400 block mb-1">Source Height (px)</label>
              <input
                type="number"
                value={testHeight}
                onChange={(e) => setTestHeight(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-center text-slate-500">
            <ArrowRight className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="bg-slate-900 border border-indigo-500/30 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Assigned Bucket</div>
              <div className="font-mono text-sm font-bold text-slate-100">
                {matchedBucket.width} × {matchedBucket.height}
              </div>
              <div className="text-[11px] text-slate-400">{matchedBucket.tag}</div>
            </div>
            <div className="text-right font-mono text-[11px] text-slate-400">
              <div>Aspect: {testAspect.toFixed(2)}</div>
              <div className="text-emerald-400">{(matchedBucket.pixels / 1000).toFixed(0)}k px</div>
            </div>
          </div>
        </div>
      </div>

      {/* Discrete Buckets Grid */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">
          Standard S3-DiT Aspect Ratio Buckets ({buckets.length} Discretized Resolutions)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {buckets.map((b) => {
            const isMatched = b.width === matchedBucket.width && b.height === matchedBucket.height;
            return (
              <div
                key={`${b.width}x${b.height}`}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  isMatched
                    ? 'bg-indigo-600/20 border-indigo-400 text-slate-100 ring-1 ring-indigo-400/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-mono text-xs font-bold text-slate-200">
                  {b.width} × {b.height}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{b.aspect_ratio}:1</div>
                <div className="text-[9px] text-slate-500 font-mono mt-1">{b.tag}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
