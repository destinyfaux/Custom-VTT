import React, { useState } from "react";
import { 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Cpu, 
  Database, 
  Layers, 
  Zap, 
  HelpCircle,
  PlusCircle
} from "lucide-react";
import { SystemErrorLog } from "../types/training";

interface SystemErrorTrackerProps {
  errors: SystemErrorLog[];
  onClearErrors: () => void;
  onSimulateError?: (category: "cuda_oom" | "dataset" | "model" | "training") => void;
}

export const SystemErrorTracker: React.FC<SystemErrorTrackerProps> = ({
  errors,
  onClearErrors,
  onSimulateError
}) => {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const filtered = errors.filter(e => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterSeverity !== "all" && e.severity !== filterSeverity) return false;
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "cuda_oom":
        return <Zap className="w-4 h-4 text-rose-400" />;
      case "dataset":
        return <Database className="w-4 h-4 text-emerald-400" />;
      case "model":
        return <Layers className="w-4 h-4 text-amber-400" />;
      case "training":
        return <Cpu className="w-4 h-4 text-indigo-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getSeverityBadge = (severity: "error" | "warning" | "info") => {
    switch (severity) {
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertOctagon className="w-3 h-3" /> Critical Failure
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      case "info":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Info className="w-3 h-3" /> Health Notice
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header & Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${errors.length > 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              {errors.length > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100">System Health & Error Diagnostics</h2>
              <p className="text-xs text-neutral-400">
                Live monitoring for CUDA out-of-memory faults, dataset corruption, gradient spikes, and backend trainer errors.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onSimulateError && (
            <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
              <span className="text-[11px] text-neutral-500 px-1.5">Simulate:</span>
              <button
                onClick={() => onSimulateError("cuda_oom")}
                className="px-2 py-1 hover:bg-neutral-800 text-rose-400 rounded text-[11px] font-mono transition-colors"
                title="Test CUDA OOM capture"
              >
                + CUDA OOM
              </button>
              <button
                onClick={() => onSimulateError("training")}
                className="px-2 py-1 hover:bg-neutral-800 text-indigo-400 rounded text-[11px] font-mono transition-colors"
                title="Test Gradient Spike capture"
              >
                + Grad Spike
              </button>
            </div>
          )}

          <button
            onClick={onClearErrors}
            disabled={errors.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-neutral-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          {["all", "cuda_oom", "training", "dataset", "model"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-md capitalize transition-all ${
                filterCategory === cat
                  ? "bg-neutral-800 text-white font-medium shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {cat === "all" ? "All Categories" : cat === "cuda_oom" ? "CUDA / VRAM" : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-neutral-400">
          <span>Filter Severity:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-2.5 py-1 text-xs text-neutral-300 focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All Severities ({errors.length})</option>
            <option value="error">Critical Errors ({errors.filter(e => e.severity === 'error').length})</option>
            <option value="warning">Warnings ({errors.filter(e => e.severity === 'warning').length})</option>
            <option value="info">Info Notices ({errors.filter(e => e.severity === 'info').length})</option>
          </select>
        </div>
      </div>

      {/* Errors List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-neutral-900/40 border border-neutral-800/60 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mb-3" />
          <h3 className="text-sm font-semibold text-neutral-200">No Active System Errors or Failures</h3>
          <p className="text-xs text-neutral-500 max-w-md mt-1">
            Training pipeline, hardware VRAM budget (10.8GB), and dataset pairings are operating normally within optimal parameters.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((err) => (
            <div
              key={err.id}
              className={`p-4 rounded-xl border transition-all ${
                err.severity === "error"
                  ? "bg-rose-950/20 border-rose-900/50"
                  : err.severity === "warning"
                  ? "bg-amber-950/20 border-amber-900/50"
                  : "bg-neutral-900/50 border-neutral-800"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/60">
                <div className="flex items-center gap-2 flex-wrap">
                  {getCategoryIcon(err.category)}
                  <span className="text-sm font-semibold text-neutral-100">{err.title}</span>
                  {getSeverityBadge(err.severity)}
                  {err.step !== undefined && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      Step {err.step}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-neutral-500">
                  {new Date(err.timestamp).toLocaleTimeString()} ({new Date(err.timestamp).toLocaleDateString()})
                </span>
              </div>

              {/* Details */}
              <div className="mt-2.5 text-xs text-neutral-300 font-mono bg-neutral-950/80 p-3 rounded-lg border border-neutral-800/80 overflow-x-auto leading-relaxed">
                {err.details}
              </div>

              {/* Suggestion / Remediation Action */}
              {err.suggestion && (
                <div className="mt-2.5 flex items-start gap-2 text-xs text-neutral-400 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/40">
                  <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-300">Recommended Resolution: </span>
                    <span>{err.suggestion}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
