import React, { useState } from 'react';
import { Save, Folder, CheckCircle, RefreshCw, X, Download, ShieldCheck, RotateCcw, AlertTriangle } from 'lucide-react';
import { CheckpointItem } from '../types/training';

interface CheckpointsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoints: CheckpointItem[];
  onResumeFromCheckpoint: (step: number) => void;
  onRollback?: (step: number) => void;
}

export const CheckpointsDrawer: React.FC<CheckpointsDrawerProps> = ({
  isOpen,
  onClose,
  checkpoints,
  onResumeFromCheckpoint,
  onRollback
}) => {
  const [rollingBackStep, setRollingBackStep] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRollback = async (step: number) => {
    if (!onRollback) return;
    setRollingBackStep(step);
    try {
      await fetch('/api/train/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_step: step })
      });
      onRollback(step);
      onClose();
    } catch (err) {
      console.error('Failed to rollback:', err);
    } finally {
      setRollingBackStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-md h-full shadow-2xl p-6 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <Save className="w-5 h-5 text-indigo-400" />
            <span>Checkpoint History & Soft Rollbacks ({checkpoints.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Step-level atomic checkpoints containing model adapter weights, 8-bit optimizer state, and step counter.
        </p>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {checkpoints.length > 0 ? (
            checkpoints.map((chk) => {
              const isSoft = chk.isSoftCheckpoint ?? true;
              return (
                <div
                  key={chk.step}
                  className={`bg-slate-950 border rounded-xl p-3.5 space-y-2 text-xs transition-all ${
                    chk.healthStatusAtSave === 'critical'
                      ? 'border-rose-800/80 bg-rose-950/20'
                      : 'border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-100 text-sm flex items-center gap-2">
                      Step {chk.step}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal font-sans ${isSoft ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20' : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'}`}>
                        {isSoft ? 'Soft Checkpoint' : 'Hard Safetensors'}
                      </span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      Loss: {chk.loss.toFixed(5)}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-slate-400 truncate">
                    Path: {chk.path}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 gap-2">
                    <span>{chk.savedAt}</span>
                    <div className="flex items-center gap-1.5">
                      {onRollback && (
                        <button
                          type="button"
                          onClick={() => handleRollback(chk.step)}
                          disabled={rollingBackStep === chk.step}
                          className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3 h-3 ${rollingBackStep === chk.step ? 'animate-spin' : ''}`} />
                          Rollback
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onResumeFromCheckpoint(chk.step);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded font-medium transition-colors"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No checkpoints recorded yet. Checkpoints are automatically generated on Pause or periodically.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
