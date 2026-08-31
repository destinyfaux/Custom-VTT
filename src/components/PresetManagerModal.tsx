import React, { useState, useEffect } from 'react';
import { 
  Save, 
  FolderOpen, 
  Download, 
  Upload, 
  Trash2, 
  Check, 
  X, 
  Sparkles, 
  Sliders, 
  FileText,
  Copy,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { TrainingConfigState } from '../types/training';

interface PresetItem {
  id: string;
  name: string;
  description: string;
  is_builtin?: boolean;
  date_saved?: string;
  config: Partial<TrainingConfigState>;
}

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: TrainingConfigState;
  onLoadConfig: (config: Partial<TrainingConfigState>) => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onLoadConfig
}) => {
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'load' | 'save' | 'export'>('load');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Fetch presets from backend
  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/config/presets');
      if (res.ok) {
        const data = await res.json();
        setPresets(data.presets || []);
        if (data.presets && data.presets.length > 0 && !selectedPresetId) {
          setSelectedPresetId(data.presets[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch presets:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPresets();
      setSaveSuccess(false);
      setCopiedJson(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    try {
      const res = await fetch('/api/config/presets/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPresetName.trim(),
          description: newPresetDesc.trim() || 'Custom user configuration preset',
          config: currentConfig
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setNewPresetName('');
        setNewPresetDesc('');
        await fetchPresets();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Error saving preset:', e);
    }
  };

  const handleApplyPreset = (preset: PresetItem) => {
    onLoadConfig(preset.config);
    onClose();
  };

  const handleDeletePreset = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete preset "${name}"?`)) return;
    try {
      const res = await fetch(`/api/config/presets/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchPresets();
      }
    } catch (e) {
      console.error('Error deleting preset:', e);
    }
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(currentConfig, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zimage_training_config_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        onLoadConfig(parsed);
        onClose();
      } catch (err) {
        alert('Invalid JSON configuration file');
      }
    };
    reader.readAsText(file);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentConfig, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const selectedPreset = presets.find(p => p.id === selectedPresetId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sliders className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-neutral-100">Training Configuration Presets & Persistence</h2>
              <p className="text-xs text-neutral-400">Save, load, import, and export complete S3-DiT training profiles</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-neutral-800 flex items-center gap-4 bg-neutral-950/40 text-xs">
          <button
            onClick={() => setActiveTab('load')}
            className={`py-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'load'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Load Presets ({presets.length})
          </button>
          <button
            onClick={() => setActiveTab('save')}
            className={`py-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'save'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            Save Current as Preset
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Import / Export JSON
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* LOAD TAB */}
          {activeTab === 'load' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Presets List */}
              <div className="md:col-span-5 space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {presets.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPresetId(p.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all text-xs ${
                      selectedPresetId === p.id
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-neutral-100 shadow-md'
                        : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold truncate">{p.name}</span>
                      {p.is_builtin ? (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Built-in
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Saved
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-2">{p.description}</p>
                  </div>
                ))}
              </div>

              {/* Preset Details & Quick Apply */}
              <div className="md:col-span-7 bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                {selectedPreset ? (
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-2 border-b border-neutral-800/80 pb-3">
                      <div>
                        <h3 className="font-bold text-sm text-neutral-100">{selectedPreset.name}</h3>
                        <p className="text-xs text-neutral-400 mt-0.5">{selectedPreset.description}</p>
                      </div>
                      {!selectedPreset.is_builtin && (
                        <button
                          onClick={() => handleDeletePreset(selectedPreset.id, selectedPreset.name)}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Preset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Key Config Highlights */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">Adapter & Rank</span>
                        <span className="font-mono text-indigo-300 font-semibold uppercase">
                          {selectedPreset.config.adapter_type || 'lora'} (Rank {selectedPreset.config.rank || 16})
                        </span>
                      </div>
                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">Learning Rate</span>
                        <span className="font-mono text-neutral-200">
                          {selectedPreset.config.learning_rate || '1e-4'} ({selectedPreset.config.lr_scheduler || 'cosine'})
                        </span>
                      </div>
                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">Target Blocks</span>
                        <span className="font-mono text-neutral-200">
                          {selectedPreset.config.target_blocks?.length || 10} DiT Blocks
                        </span>
                      </div>
                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">Precision & AMP</span>
                        <span className="font-mono text-emerald-400">
                          {selectedPreset.config.amp_dtype || 'bfloat16'} (AMP Active)
                        </span>
                      </div>
                    </div>

                    <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Total Steps:</span>
                        <span className="font-mono text-neutral-200">{selectedPreset.config.total_steps || 1000}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>DiffusionOPSD Reward:</span>
                        <span className="font-mono text-neutral-200">{selectedPreset.config.use_opsd ? `Active (λ=${selectedPreset.config.opsd_lambda || 0.15})` : 'Disabled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sample Frequency:</span>
                        <span className="font-mono text-neutral-200">Every {selectedPreset.config.sample_every_n_steps || 250} steps</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyPreset(selectedPreset)}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                      <Check className="w-4 h-4" />
                      Apply Preset to Training Studio
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12 text-xs text-neutral-500">
                    Select a preset on the left to view configuration details
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SAVE TAB */}
          {activeTab === 'save' && (
            <form onSubmit={handleSavePreset} className="space-y-4 max-w-lg mx-auto">
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                <h3 className="font-bold text-xs text-neutral-200 flex items-center gap-2">
                  <Save className="w-4 h-4 text-indigo-400" />
                  Save Active Studio Settings to Local Presets
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Saves all hyperparameters, PEFT ranks, target blocks, dataset folder lists, and sampling schedules so you never have to re-enter them.
                </p>

                {saveSuccess && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Preset saved successfully to <code>./presets/</code>!</span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-neutral-300 font-medium block mb-1">Preset Name</label>
                  <input
                    type="text"
                    required
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g. Character-LoRA-Rank32-HighLR"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-neutral-300 font-medium block mb-1">Description (Optional)</label>
                  <textarea
                    rows={3}
                    value={newPresetDesc}
                    onChange={(e) => setNewPresetDesc(e.target.value)}
                    placeholder="Targeting anime characters with 832x1280 resolution and 8-bit AdamW..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Preset
                </button>
              </div>
            </form>
          )}

          {/* EXPORT / IMPORT TAB */}
          {activeTab === 'export' && (
            <div className="space-y-5 max-w-xl mx-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-neutral-200 flex items-center gap-2">
                      <Download className="w-4 h-4 text-cyan-400" />
                      Export Config to JSON
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Download current parameters as a standalone JSON file to share or archive.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleExportJson}
                      className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg border border-neutral-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download .json File
                    </button>
                    <button
                      onClick={handleCopyJson}
                      className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[11px] font-mono rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedJson ? 'Copied to Clipboard!' : 'Copy Raw JSON'}
                    </button>
                  </div>
                </div>

                <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-neutral-200 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-400" />
                      Import Config from JSON
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Load and restore an existing JSON training configuration file.
                    </p>
                  </div>

                  <label className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20">
                    <Upload className="w-3.5 h-3.5" />
                    Choose JSON File
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportJson}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neutral-500" />
            <span>Config automatically syncs and persists across page reloads</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
