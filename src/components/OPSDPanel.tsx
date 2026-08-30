import React from 'react';
import { Award, Sparkles, Scale, Sliders, Info, CheckCircle2 } from 'lucide-react';
import { TrainingConfigState } from '../types/training';

interface OPSDPanelProps {
  config: TrainingConfigState;
  onChange: (updated: Partial<TrainingConfigState>) => void;
}

export const OPSDPanel: React.FC<OPSDPanelProps> = ({ config, onChange }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-slate-100 font-semibold text-sm">
              Reward-Guided Preference Tuning (DiffusionOPSD)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              On-policy self-distillation using differentiable aesthetic & preference reward models
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.use_opsd}
            onChange={(e) => onChange({ use_opsd: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          <span className="ml-2 text-xs font-semibold text-slate-300">
            {config.use_opsd ? 'OPSD Active' : 'SFT-Only'}
          </span>
        </label>
      </div>

      {config.use_opsd ? (
        <div className="space-y-4">
          {/* Mathematical Objective Box */}
          <div className="bg-slate-950/80 border border-amber-500/20 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="text-amber-300 font-semibold flex items-center gap-1.5 font-mono">
              <Scale className="w-4 h-4" /> Loss Formulation (DiffusionOPSD):
            </div>
            <div className="font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded border border-slate-800 text-[11px] leading-relaxed">
              <p>1. Estimated Trajectory: <span className="text-cyan-300">x̂₀(v_θ) = x_t - t · v_θ(x_t, τ, c)</span></p>
              <p className="mt-1">2. Objective: <span className="text-amber-300">L_OPSD(θ) = || v_θ - stop_grad(v*_bounded) ||₂² - λ · R(x̂₀(v_θ))</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reward Weight (Lambda) */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Reward Scale (λ)</span>
                <span className="font-mono font-bold text-amber-400">{config.opsd_lambda}</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={0.5}
                step={0.01}
                value={config.opsd_lambda}
                onChange={(e) => onChange({ opsd_lambda: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Balances Flow Matching velocity accuracy vs aesthetic reward gradient pull.
              </p>
            </div>

            {/* Differentiable Reward Model */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Reward Model Architecture</span>
                <span className="text-[10px] text-emerald-400 font-mono">Differentiable</span>
              </div>
              <select
                value={config.reward_model}
                onChange={(e) => onChange({ reward_model: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
              >
                <option value="Aesthetic-Predictor-v2">Aesthetic Predictor v2 (LAION-Aesthetic)</option>
                <option value="ImageReward-v1.1">ImageReward (Human Preference Aligned)</option>
                <option value="PickScore-v1">PickScore (CLIP-ViT Preference)</option>
                <option value="HPS-v2.1">HPS v2.1 (High-Precision Aesthetic)</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Backpropagates reward gradients directly into active PEFT adapters.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-center justify-between">
          <span>Standard Flow Matching Supervised Fine-Tuning (SFT) is active.</span>
          <button
            type="button"
            onClick={() => onChange({ use_opsd: true })}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline"
          >
            Enable DiffusionOPSD
          </button>
        </div>
      )}
    </div>
  );
};
