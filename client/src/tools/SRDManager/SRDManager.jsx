import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import { MonsterSRDProvider, useMonsterSRD } from './MonsterSRDContext';
import EntryList from './shared/EntryList';
import RaceEditor from './RaceEditor';
import ClassEditor from './ClassEditor';
import BackgroundEditor from './BackgroundEditor';
import SpellEditor from './SpellEditor';
import EquipmentEditor from './EquipmentEditor';
import FeatEditor from './FeatEditor';
import MonsterManager from './MonsterManager';

const CATEGORIES = [
  { key: 'races', label: 'Races' },
  { key: 'classes', label: 'Classes' },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'spells', label: 'Spells' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'feats', label: 'Feats' },
];

const MODES = [
  { key: 'characters', label: 'Characters', icon: '📖' },
  { key: 'monsters', label: 'Monsters', icon: '👹' },
];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

// Character SRD Mode (original functionality)
function CharacterMode() {
  const { srd, loadSRD, setField, addEntry, deleteEntry } = useSRD();

  // Unsaved changes tracking
  const lastSavedRef = useRef(srd ? JSON.stringify(srd) : null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!srd) return;
    const current = JSON.stringify(srd);
    setHasUnsavedChanges(current !== lastSavedRef.current);
  }, [srd]);

  const markSaved = useCallback(() => {
    if (!srd) return;
    lastSavedRef.current = JSON.stringify(srd);
    setHasUnsavedChanges(false);
  }, [srd]);

  // Rest of the component state
  const [activeCategory, setActiveCategory] = useState('races');
  const [selectedKey, setSelectedKey] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loadStatus, setLoadStatus] = useState(null);
  const fileInputRef = useRef(null);

  // Server / File interactions
  const handleLoadFromServer = useCallback(async () => {
    setLoadStatus('loading');
    try {
      const res = await fetch(`${SERVER_URL}/api/srd/load`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      loadSRD(data);
      // update the saved snapshot so we don't immediately show unsaved
      lastSavedRef.current = JSON.stringify(data);
      setHasUnsavedChanges(false);
      setLoadStatus('loaded');
      setSelectedKey(null);
      setTimeout(() => setLoadStatus(null), 3000);
    } catch (err) {
      console.error('Failed to load from server:', err);
      setLoadStatus('error');
      setTimeout(() => setLoadStatus(null), 5000);
    }
  }, [loadSRD]);

  const handleLoadFromFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        loadSRD(data);
        lastSavedRef.current = JSON.stringify(data);
        setHasUnsavedChanges(false);
        setSelectedKey(null);
        setLoadStatus('loaded');
        setTimeout(() => setLoadStatus(null), 3000);
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
        setLoadStatus('error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadSRD]);

  const handleSaveToServer = useCallback(async () => {
    if (!srd) return alert('No SRD data loaded.');
    setSaveStatus('saving');
    try {
      const res = await fetch(`${SERVER_URL}/api/srd/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(srd, null, 2),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }
      markSaved();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Save failed: ' + err.message);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 5000);
    }
  }, [srd, markSaved]);

  const handleExport = useCallback(() => {
    if (!srd) return;
    const blob = new Blob([JSON.stringify(srd, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'srd_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [srd]);

  const handleAddNew = useCallback(() => {
    const name = prompt(`Enter new ${activeCategory.slice(0, -1)} name:`);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();

    if (activeCategory === 'equipment') {
      alert('Use the Equipment editor to add items within categories.');
      return;
    }

    const templateMap = {
      races: TEMPLATES.race,
      classes: TEMPLATES.class,
      backgrounds: TEMPLATES.background,
      spells: TEMPLATES.spell,
      feats: TEMPLATES.feat,
    };

    const templateFn = templateMap[activeCategory];
    if (!templateFn) return;

  let newEntry = templateFn();
  // For spells, set the name field to match the entry key
  if (activeCategory === 'spells') {
    newEntry.name = trimmed;
  }

  addEntry(activeCategory, trimmed, newEntry);
    setSelectedKey(trimmed);
  }, [activeCategory, addEntry]);

  const handleDeleteEntry = useCallback((key) => {
    deleteEntry(activeCategory, key);
    if (selectedKey === key) setSelectedKey(null);
  }, [activeCategory, deleteEntry, selectedKey]);

  const renderEditor = () => {
    if (!srd) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-20">
          <div className="text-6xl mb-4">📖</div>
          <h3 className="text-lg font-bold text-gray-300 mb-2">No SRD Loaded</h3>
          <p className="text-gray-500 mb-6 max-w-md">
            Load your SRD data from the server or from a local JSON file to start editing.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={handleLoadFromServer} className="btn-primary">
              Load from Server
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
              Load from File
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleLoadFromFile}
            className="hidden"
          />
        </div>
      );
    }

    if (activeCategory === 'equipment') {
      return <EquipmentEditor equipment={srd.equipment} basePath={['equipment']} />;
    }

    const section = srd[activeCategory] ?? {};
    const selectedData = selectedKey ? section[selectedKey] : null;

    const editorMap = {
      races: RaceEditor,
      classes: ClassEditor,
      backgrounds: BackgroundEditor,
      spells: SpellEditor,
      feats: FeatEditor,
    };

    const EditorComponent = editorMap[activeCategory];
    if (!EditorComponent) return <div className="text-gray-500">Editor not implemented yet.</div>;

    if (!selectedKey || !selectedData) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-20">
          <div className="text-4xl mb-3">⚔️</div>
          <h3 className="text-lg font-bold text-gray-300 mb-1">Select or Create a {activeCategory.slice(0, -1)}</h3>
          <p className="text-gray-500">Use the list on the left to browse existing entries or add a new one.</p>
        </div>
      );
    }

    return (
      <EditorComponent
        entryKey={selectedKey}
        entryData={selectedData}
        basePath={[activeCategory]}
      />
    );
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-850 border-r border-gray-700 flex flex-col flex-shrink-0"
           style={{ backgroundColor: '#1e2030' }}>
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold text-dnd-gold flex items-center gap-2">
            <span className="text-xl">📖</span> Character SRD
          </h1>
          <p className="text-xs text-gray-500 mt-1">Races, Classes, Spells & More</p>
        </div>

        <div className="flex flex-wrap gap-1 p-3 border-b border-gray-700">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setActiveCategory(cat.key);
                setSelectedKey(null);
              }}
              className={`text-xs py-1 px-2 rounded font-medium transition-colors ${
                activeCategory === cat.key
                  ? 'bg-srd-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-3 overflow-hidden">
          {srd && activeCategory !== 'equipment' && (
            <EntryList
              entries={srd[activeCategory] ?? {}}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              label={activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}
              onAdd={handleAddNew}
              onDelete={handleDeleteEntry}
            />
          )}
          {srd && activeCategory === 'equipment' && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Equipment is edited directly in the main panel.</p>
              <p className="text-gray-600 text-xs mt-1">Select the Equipment tab above.</p>
            </div>
          )}
          {!srd && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Load SRD data first</p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-700 space-y-2">
          <button
            type="button"
            onClick={handleLoadFromServer}
            className="btn-secondary w-full text-sm py-2"
          >
            🔄 Load from Server
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary w-full text-sm py-2"
          >
            📂 Load from File
          </button>
          <button
            type="button"
            onClick={handleSaveToServer}
            disabled={!srd || saveStatus === 'saving'}
            className={`w-full text-sm py-2 font-bold ${
              hasUnsavedChanges ? 'btn-gold animate-pulse' : 'btn-primary'
            }`}
          >
            {saveStatus === 'saving' ? '⏳ Saving...' : hasUnsavedChanges ? '💾 Save SRD *' : '💾 Save SRD'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!srd}
            className="btn-secondary w-full text-sm py-2"
          >
            📥 Export JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleLoadFromFile}
            className="hidden"
          />
        </div>

        <div className="px-3 py-2 border-t border-gray-700 text-[10px] text-gray-500 flex justify-between">
          <span>
            {srd ? `${Object.keys(srd.races ?? {}).length} races, ${Object.keys(srd.classes ?? {}).length} classes` : 'No data'}
          </span>
          <span>
            {saveStatus === 'saved' && <span className="text-emerald-400">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-red-400">✗ Error</span>}
            {loadStatus === 'loaded' && <span className="text-emerald-400">✓ Loaded</span>}
            {hasUnsavedChanges && !saveStatus && <span className="text-dnd-gold">● Unsaved changes</span>}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderEditor()}
      </div>
    </div>
  );
}

// Main SRD Manager with Mode Switcher
export default function SRDManager() {
  const [activeMode, setActiveMode] = useState('characters');

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* ── Top-level Mode Switcher (thin left rail) ── */}
      <div className="w-14 bg-gray-950 border-r border-gray-800 flex flex-col items-center py-3 gap-2 flex-shrink-0">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => setActiveMode(mode.key)}
            className={`flex flex-col items-center justify-center gap-0.5 w-11 h-14 rounded-lg transition-colors ${
              activeMode === mode.key
                ? 'bg-srd-700 text-white border border-srd-500'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-transparent'
            }`}
            title={mode.label}
          >
            <span className="text-lg">{mode.icon}</span>
            <span className="text-[8px] font-semibold uppercase tracking-wide leading-tight">
              {mode.label.slice(0, 5)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Mode Content ── */}
      <div className="flex-1 overflow-hidden">
        {activeMode === 'characters' && <CharacterMode />}
        {activeMode === 'monsters' && (
          <MonsterSRDProvider>
            <MonsterManager />
          </MonsterSRDProvider>
        )}
      </div>
    </div>
  );
}