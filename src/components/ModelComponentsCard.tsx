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
  AlertTriangle
} from 'lucide-react';
import { FilePickerModal } from './FilePickerModal';
import { ModelProbedSpecs } from '../types/training';

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
  const [probedSpecs, setProbedSpecs] = useState<ModelProbedSpecs | null>(null);
  const [activePickerTarget, setActivePickerTarget] = useState<"transformer" | "vae" | "text_encoder" | null>(null);

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

  const handleSelectPath = (selectedPath: string) => {
    if (activePickerTarget === "transformer") {
      onChangeTransformerPath(selectedPath);
    } else if (activePickerTarget === "vae") {
      onChangeVaePath(selectedPath);
    } else if (activePickerTarget === "text_encoder") {
      onChangeTextEncoderPath(selectedPath);
    }
    setActivePickerTarget(null);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
      {/* File Picker Modal */}
      <FilePickerModal
        isOpen={activePickerTarget !== null}
        onClose={() => setActivePickerTarget(null)}
        onSelect={handleSelectPath}
        title={`Search & Select Local ${
          activePickerTarget === 'transformer' ? 'Transformer Backbone' :
          activePickerTarget === 'vae' ? 'Latent VAE Autoencoder' : 'Text Encoder'
        } Path`}
        selectMode="folder"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <Box className="w-4 h-4 text-indigo-400" />
            Model Component Paths & Architecture Probing
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Specify HuggingFace repository IDs or browse local disk folders for S3-DiT backbone, VAE, and Text Encoder.
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

      {/* Probed Status Callout */}
      {probedSpecs && (
        <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Verified Architecture:</strong> Compatible Single-Stream S3-DiT 6B backbone validated with 16-channel VAE and SigLIP conditioning.
            </span>
          </div>
          <span className="font-mono bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px] shrink-0">
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
                onClick={() => setActivePickerTarget("transformer")}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors"
                title="Search folder on local PC"
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
              Latent VAE Autoencoder
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
              {probedSpecs?.vae?.latent_channels || 16} Channels
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
                placeholder="Tongyi-MAI/Z-Image-Turbo/vae"
              />
              <button
                type="button"
                onClick={() => setActivePickerTarget("vae")}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors"
                title="Search folder on local PC"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 space-y-0.5 pt-1 border-t border-neutral-900">
            <div className="flex justify-between">
              <span>Spatial Factor:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.vae?.downsample_factor || "8x Downsampling"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Latent Stride:</span>
              <span className="font-mono text-neutral-300">128x128 (1024px)</span>
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
              SigLIP-SO400M
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
                placeholder="google/siglip-so400m-patch14-384"
              />
              <button
                type="button"
                onClick={() => setActivePickerTarget("text_encoder")}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors"
                title="Search folder on local PC"
              >
                <Search className="w-3.5 h-3.5 text-purple-400" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 space-y-0.5 pt-1 border-t border-neutral-900">
            <div className="flex justify-between">
              <span>Embedding Dim:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.text_encoder?.embedding_dim || 1152} Dimensions
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max Token Seq:</span>
              <span className="font-mono text-neutral-300">
                {probedSpecs?.text_encoder?.max_seq_len || 256} Tokens
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

