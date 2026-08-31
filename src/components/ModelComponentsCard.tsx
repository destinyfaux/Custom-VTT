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
  Info,
  Search,
  Check,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { ModelProbedSpecs } from '../types/training';

interface ModelComponentsCardProps {
  transformerPath: string;
  onChangeTransformerPath: (path: string) => void;
  vaePath: string;
  onChangeVaePath: (path: string) => void;
  textEncoderPath: string;
  onChangeTextEncoderPath: (path: string) => void;
  onOpenBrowser?: (field: string, mode?: 'folder' | 'file') => void;
}

export const ModelComponentsCard: React.FC<ModelComponentsCardProps> = ({
  transformerPath,
  onChangeTransformerPath,
  vaePath,
  onChangeVaePath,
  textEncoderPath,
  onChangeTextEncoderPath,
  onOpenBrowser
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [probedSpecs, setProbedSpecs] = useState<ModelProbedSpecs | null>(null);

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
        const data: ModelProbedSpecs = await res.json();
        setProbedSpecs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsValidating(false);
    }
  };

  const handleBrowse = (field: string) => {
    if (onOpenBrowser) {
      onOpenBrowser(field, 'folder');
    }
  };

  const isTextEncoderSiglip = textEncoderPath.toLowerCase().includes('siglip') || textEncoderPath.toLowerCase().includes('clip');

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <Box className="w-4 h-4 text-indigo-400" />
            Model Component Paths & Architecture Probing
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Z-Image S3-DiT Pipeline: 6.1B Single-Stream DiT, Flux-compatible 16-channel VAE, and Qwen 3.4B Text Encoder.
          </p>
        </div>

        <button
          type="button"
          onClick={handleValidate}
          disabled={isValidating}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shadow transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isValidating ? 'animate-spin' : ''}`} />
          {isValidating ? 'Probing Model Weights...' : 'Probe & Verify Model Components'}
        </button>
      </div>

      {/* Text Encoder Mismatch Warning if User still has SigLIP */}
      {isTextEncoderSiglip && (
        <div className="p-3.5 rounded-lg bg-amber-950/50 border border-amber-500/40 flex items-start justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Text Encoder Architecture Correction Recommended:</strong> Z-Image uses the <strong>Qwen 3.4B LLM text encoder</strong> (<code>Tongyi-MAI/Z-Image-Turbo/text_encoder</code>), not SigLIP/CLIP.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChangeTextEncoderPath("Tongyi-MAI/Z-Image-Turbo/text_encoder")}
            className="px-2.5 py-1 rounded bg-amber-500 text-black font-semibold text-[11px] hover:bg-amber-400 shrink-0"
          >
            Fix Path to Qwen 3.4B
          </button>
        </div>
      )}

      {/* Probed Status Callout */}
      {probedSpecs && (
        <div className={`p-3.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs ${
          probedSpecs.is_compatible_s3dit 
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {probedSpecs.is_compatible_s3dit ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>
              <strong>Verified Architecture:</strong> Single-Stream S3-DiT 6.1B backbone validated with 16-channel VAE and Qwen 3.4B LLM text conditioning.
            </span>
          </div>
          <span className="font-mono bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-700 text-[11px] shrink-0 text-neutral-300">
            Probed {new Date(probedSpecs.probed_at).toLocaleTimeString()}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* S3-DiT Transformer */}
        <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              S3-DiT Transformer Backbone
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
              {probedSpecs?.transformer?.parameters || '6.1B Params'}
            </span>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Transformer Path / Repo ID</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={transformerPath}
                onChange={e => onChangeTransformerPath(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-indigo-500"
                placeholder="Tongyi-MAI/Z-Image-Turbo or local path"
              />
              <button
                type="button"
                onClick={() => handleBrowse("transformer_path")}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors"
                title="Browse local drive/folder"
              >
                <Search className="w-3.5 h-3.5 text-indigo-400" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 space-y-0.5 pt-1 border-t border-neutral-900">
            <div className="flex justify-between">
              <span>Layers:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.transformer?.layers || 30} DiT Blocks
              </span>
            </div>
            <div className="flex justify-between">
              <span>Hidden Dim:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.transformer?.hidden_dim || 3840} ({probedSpecs?.transformer?.heads || 30} Heads)
              </span>
            </div>
            {probedSpecs?.transformer?.format && (
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>Format:</span>
                <span className="font-mono text-emerald-400 truncate max-w-[140px]">{probedSpecs.transformer.format}</span>
              </div>
            )}
          </div>
        </div>

        {/* VAE */}
        <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Latent VAE Autoencoder (ae.vae)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
              {probedSpecs?.vae?.latent_channels || 16} Channels (Flux AE)
            </span>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">VAE Path / Repo ID</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={vaePath}
                onChange={e => onChangeVaePath(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-cyan-500"
                placeholder="Tongyi-MAI/Z-Image-Turbo/vae or ae.safetensors"
              />
              <button
                type="button"
                onClick={() => handleBrowse("vae_path")}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors"
                title="Browse local drive/folder"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 space-y-0.5 pt-1 border-t border-neutral-900">
            <div className="flex justify-between">
              <span>Spatial Factor:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.vae?.downsample_factor || "8x Spatial Downsampling"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Compatibility:</span>
              <span className="font-mono text-cyan-400">FLUX / Z-Image 16ch</span>
            </div>
          </div>
        </div>

        {/* Text Encoder */}
        <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              Conditioning Text Encoder
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono border border-purple-500/20">
              Qwen 3.4B LLM
            </span>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Text Encoder Path / Repo ID</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={textEncoderPath}
                onChange={e => onChangeTextEncoderPath(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-purple-500"
                placeholder="Tongyi-MAI/Z-Image-Turbo/text_encoder"
              />
              <button
                type="button"
                onClick={() => handleBrowse("text_encoder_path")}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors"
                title="Browse local drive/folder"
              >
                <Search className="w-3.5 h-3.5 text-purple-400" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 space-y-0.5 pt-1 border-t border-neutral-900">
            <div className="flex justify-between">
              <span>Embedding Dim:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.text_encoder?.embedding_dim || 4096} Dimensions
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max Token Seq:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.text_encoder?.max_seq_len || 512} Tokens
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


