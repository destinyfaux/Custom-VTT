import React, { useState } from 'react';
import { Terminal, CheckCircle2, Play, RefreshCw, X, AlertTriangle, Cpu, ShieldCheck } from 'lucide-react';

interface DryRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DryRunModal: React.FC<DryRunModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);

  const runTest = async () => {
    setIsRunning(true);
    setLogs('Executing: python3 backend/tests/dry_run_training.py ...\n');
    try {
      const res = await fetch('/api/dry-run');
      const data = await res.json();
      setSuccess(data.success);
      const combined = `${data.stdout || ''}\n${data.stderr || ''}`.trim();
      setLogs(`$ python3 backend/tests/dry_run_training.py\n\n${combined}\n\n[STATUS]: ${data.summary}`);
    } catch (e: any) {
      setSuccess(false);
      setLogs(`Execution error: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-slate-100 font-semibold text-sm flex items-center gap-2">
                Offline Dry-Run & Graph Execution Suite
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  No-GPU Headless Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Runs backend/tests/dry_run_training.py to assert PEFT targeting, Flow Matching & DiffusionOPSD formulas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={runTest}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-md disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Execute Dry-Run Test Suite
          </button>

          {success !== null && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {success ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> 0 Errors · All Invariants Passed
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Test Failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Terminal Log Console */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {logs || '// Click "Execute Dry-Run Test Suite" to run headless PyTorch mock test validation.'}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
