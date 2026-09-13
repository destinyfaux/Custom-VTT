import { useEffect, useMemo, useState } from 'react';
import soundSynthesizer from '../utils/SoundSynthesizer';
import { useDraggableResizable } from '../hooks/useDraggableResizable';

const STORAGE_KEY = 'vtt_sound_designer_presets';
const DEFAULT_LAYERS = [
  { id: 'fire-body', name: 'Flame body', sound: 'fire', volume: 0.35, pan: 0, delay: 0, loop: true, enabled: true },
  { id: 'fire-sizzle', name: 'Sizzle / embers', sound: 'fire', volume: 0.2, pan: 0.15, delay: 0.08, loop: false, enabled: true }
];
const SOUND_OPTIONS = [
  ['fire', 'Fire'],
  ['water', 'Water'],
  ['blood', 'Blood'],
  ['holy', 'Holy'],
  ['dark', 'Dark'],
  ['frost', 'Frost'],
  ['acid', 'Acid'],
  ['smoke', 'Smoke'],
  ['slash', 'Slash'],
  ['impact', 'Impact'],
  ['lightning', 'Lightning'],
  ['force', 'Force']
];

const cloneLayers = (layers) => layers.map((layer) => ({ ...layer }));

export default function SoundDesigner({ onClose }) {
  const { pos, size, handleMouseDown, handleResizeDown } = useDraggableResizable({
    initialPos: { x: Math.max(16, window.innerWidth - 570), y: 80 },
    initialSize: { w: 520, h: 650 },
    minSize: { w: 360, h: 420 }
  });
  const [layers, setLayers] = useState(cloneLayers(DEFAULT_LAYERS));
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [presetName, setPresetName] = useState('My fire stack');
  const [presets, setPresets] = useState({});
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      setPresets(saved);
    } catch (error) {
      console.warn('[SoundDesigner] Could not load presets:', error);
    }
  }, []);

  const updateLayer = (id, changes) => {
    setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...changes } : layer));
  };

  const addLayer = () => {
    setLayers((current) => [...current, {
      id: `layer-${Date.now()}`,
      name: `Layer ${current.length + 1}`,
      sound: 'fire',
      volume: 0.2,
      pan: 0,
      delay: 0,
      loop: false,
      enabled: true
    }]);
  };

  const savePreset = () => {
    const nextPresets = { ...presets, [presetName.trim() || 'Untitled']: { layers: cloneLayers(layers), masterVolume } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPresets));
    setPresets(nextPresets);
    setSavedMessage('Saved');
    window.setTimeout(() => setSavedMessage(''), 1400);
  };

  const loadPreset = (name) => {
    const preset = presets[name];
    if (!preset) return;
    setLayers(cloneLayers(preset.layers || []));
    setMasterVolume(Number(preset.masterVolume) || 0.7);
    setPresetName(name);
  };

  const preview = () => {
    soundSynthesizer.unlock();
    window.setTimeout(() => soundSynthesizer.playSoundStack(layers, { masterVolume }), 0);
  };

  const presetNames = useMemo(() => Object.keys(presets), [presets]);

  return (
    <div
      className="fixed z-[1200] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <div>
          <div className="text-accentGold font-bold text-[11px] uppercase tracking-widest drag-handle">Sound Designer</div>
          <div className="text-[9px] text-textMuted mt-1">Stack procedural SoundSynthesizer layers</div>
        </div>
        <button type="button" onClick={onClose} className="text-textMuted hover:text-white px-2">✕</button>
      </header>

      <div className="flex-1 p-3 overflow-y-auto bg-[#0b0c10] space-y-3">
        <div className="flex gap-2">
          <input value={presetName} onChange={(event) => setPresetName(event.target.value)} className="flex-1 bg-bgCard border border-borderDark rounded px-2 py-1 text-[10px] text-textLight" aria-label="Preset name" />
          <button type="button" onClick={savePreset} className="bg-accentGold text-black rounded px-3 text-[10px] font-bold">{savedMessage || 'SAVE'}</button>
        </div>

        {presetNames.length > 0 && (
          <select value="" onChange={(event) => loadPreset(event.target.value)} className="w-full bg-bgCard border border-borderDark rounded px-2 py-1 text-[10px] text-textLight">
            <option value="">Load saved preset...</option>
            {presetNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        )}

        <div className="bg-bgCard border border-borderDark rounded p-2">
          <div className="flex justify-between text-[10px] text-textMuted uppercase font-bold mb-1">
            <span>Master output</span><span>{Math.round(masterVolume * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} className="w-full accent-accentGold" />
        </div>

        {layers.map((layer, index) => (
          <div key={layer.id} className={`bg-bgCard border rounded p-2 ${layer.enabled ? 'border-borderDark' : 'border-red-900 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={layer.enabled} onChange={(event) => updateLayer(layer.id, { enabled: event.target.checked })} className="accent-accentGold" aria-label={`Enable ${layer.name}`} />
              <input value={layer.name} onChange={(event) => updateLayer(layer.id, { name: event.target.value })} className="flex-1 bg-transparent text-[10px] text-textLight font-bold border-b border-borderDark outline-none" />
              <button type="button" onClick={() => setLayers((current) => current.filter((item) => item.id !== layer.id))} className="text-red-400 text-[10px]" aria-label={`Remove ${layer.name}`}>REMOVE</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[9px] text-textMuted">Sound
                <select value={layer.sound} onChange={(event) => updateLayer(layer.id, { sound: event.target.value })} className="w-full mt-1 bg-bgPanel border border-borderDark rounded px-1 py-1 text-[10px] text-textLight">
                  {SOUND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-[9px] text-textMuted">Delay (sec)
                <input type="number" min="0" max="10" step="0.01" value={layer.delay} onChange={(event) => updateLayer(layer.id, { delay: Math.max(0, Number(event.target.value) || 0) })} className="w-full mt-1 bg-bgPanel border border-borderDark rounded px-1 py-1 text-[10px] text-textLight" />
              </label>
              <label className="text-[9px] text-textMuted">Volume {Math.round(layer.volume * 100)}%
                <input type="range" min="0" max="1" step="0.01" value={layer.volume} onChange={(event) => updateLayer(layer.id, { volume: Number(event.target.value) })} className="w-full accent-accentGold" />
              </label>
              <label className="text-[9px] text-textMuted">Pan {layer.pan.toFixed(2)}
                <input type="range" min="-1" max="1" step="0.01" value={layer.pan} onChange={(event) => updateLayer(layer.id, { pan: Number(event.target.value) })} className="w-full accent-accentGold" />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-1 text-[9px] text-textMuted">
              <input type="checkbox" checked={layer.loop} onChange={(event) => updateLayer(layer.id, { loop: event.target.checked })} className="accent-accentGold" />
              Continuous / loop layer
            </label>
            <div className="text-[8px] text-textMuted mt-1">Layer {index + 1} plays through SoundSynthesizer</div>
          </div>
        ))}

        <button type="button" onClick={addLayer} className="w-full border border-dashed border-accentGold/60 text-accentGold rounded py-2 text-[10px] font-bold">+ ADD SOUND LAYER</button>
        <button type="button" onClick={preview} className="w-full bg-accentGold text-black rounded py-2 text-[11px] font-bold">PREVIEW STACK</button>
        <button type="button" onClick={() => soundSynthesizer.stopSoundStack()} className="w-full border border-red-800 text-red-300 rounded py-2 text-[10px] font-bold">STOP PREVIEW</button>
      </div>
      <div className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1" onMouseDown={handleResizeDown}>
        <div className="w-2 h-2 border-r-2 border-b-2 border-accentGold opacity-50" />
      </div>
    </div>
  );
}
