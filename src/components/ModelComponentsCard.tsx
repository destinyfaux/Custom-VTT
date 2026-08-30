import React, { useState } from 'react';
import {
  Box,
  Layers,
  Cpu,
  CheckCircle2,
  FileCode,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Info
} from 'lucide-react';

interface ModelComponentsCardProps {
  transformerPath: string;
  onChangeTransformerPath: (path: string) => void;
  vaePath: string;
  onChangeVaePath: (path: string) => void;
  textEncoderPath: string;
  onChangeTextEncoderPath: (path: string) => void;
}

export const ModelComponentsCard: React.FC<ModelComponentsCardProps> = ({
  transformerPath,
  onChangeTransformerPath,
  vaePath,
  onChangeVaePath,
  textEncoderPath,
  onChangeTextEncoderPath
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(true);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/models/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transformer_path: transformerPath,
          vae_path: vaePath,
          text_encoder_path: textEncoderPath
        })
      });
      if (res.ok) {
        setValidationSuccess(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Box className="w-4 h-4 text-indigo-400" />
            Model Component Paths & Architecture Specs
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Specify HuggingFace repository IDs or custom local model directory checkpoints for S3-DiT backbone, VAE, and Text Encoder.
          </p>
        </div>

        <button
          type="button"
          onClick={handleValidate}
          disabled={isValidating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isValidating ? 'animate-spin' : ''}`} />
          {isValidating ? 'Validating...' : 'Verify Component Paths'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* S3-DiT Transformer */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              S3-DiT Transformer Backbone
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 font-mono">
              6.1B Params
            </span>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Transformer Path / Repo ID</label>
            <input
              type="text"
              value={transformerPath}
              onChange={e => onChangeTransformerPath(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              placeholder="Tongyi-MAI/Z-Image-Turbo or local path"
            />
          </div>

          <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-900">
            <div className="flex justify-between">
              <span>Layers:</span>
              <span className="font-mono text-slate-300">30 DiT Blocks</span>
            </div>
            <div className="flex justify-between">
              <span>Hidden Dimension:</span>
              <span className="font-mono text-slate-300">3840 (30 Heads)</span>
            </div>
          </div>
        </div>

        {/* VAE */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Latent VAE Autoencoder
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 font-mono">
              16 Channels
            </span>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">VAE Path / Repo ID</label>
            <input
              type="text"
              value={vaePath}
              onChange={e => onChangeVaePath(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              placeholder="Tongyi-MAI/Z-Image-Turbo/vae"
            />
          </div>

          <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-900">
            <div className="flex justify-between">
              <span>Spatial Factor:</span>
              <span className="font-mono text-slate-300">8x Downsampling</span>
            </div>
            <div className="flex justify-between">
              <span>Latent Tile Size:</span>
              <span className="font-mono text-slate-300">128x128 (1024px)</span>
            </div>
          </div>
        </div>

        {/* Text Encoder */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              Conditioning Text Encoder
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 font-mono">
              SigLIP-SO400M
            </span>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Text Encoder Path / Repo ID</label>
            <input
              type="text"
              value={textEncoderPath}
              onChange={e => onChangeTextEncoderPath(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
              placeholder="google/siglip-so400m-patch14-384"
            />
          </div>

          <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-900">
            <div className="flex justify-between">
              <span>Embedding Dim:</span>
              <span className="font-mono text-slate-300">1152 Dimensions</span>
            </div>
            <div className="flex justify-between">
              <span>Max Token Seq:</span>
              <span className="font-mono text-slate-300">256 Tokens</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
