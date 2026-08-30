import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useMonsterSRD, MONSTER_TEMPLATE, MONSTER_TYPES, CR_OPTIONS, CR_XP_TABLE } from './MonsterSRDContext';
import MonsterEditor from './MonsterEditor';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

// ─── CR numeric value for sorting ────────────────────────────────────────────
function crToNum(cr) {
  if (cr === undefined || cr === null) return 999;
  const map = {
    '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14, '15': 15,
    '16': 16, '17': 17, '18': 18, '19': 19, '20': 20, '21': 21, '22': 22,
    '23': 23, '24': 24, '25': 25, '26': 26, '27': 27, '28': 28, '29': 29, '30': 30,
  };
  return map[String(cr)] ?? 999;
}

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'cr-asc', label: 'CR (Low-High)' },
  { value: 'cr-desc', label: 'CR (High-Low)' },
  { value: 'type', label: 'Type' },
  { value: 'source', label: 'Source' },
  { value: 'hp-asc', label: 'HP (Low-High)' },
  { value: 'hp-desc', label: 'HP (High-Low)' },
];

export default function MonsterManager() {
  const {
    monsterSRD, loadMonsterSRD, setField, addMonster, deleteMonster,
    renameMonster, hasUnsavedChanges, markSaved,
  } = useMonsterSRD();

  // ─── State ──
  const [selectedKey, setSelectedKey] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCR, setFilterCR] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [saveStatus, setSaveStatus] = useState(null);
  const [loadStatus, setLoadStatus] = useState(null);
  const fileInputRef = useRef(null);

  // ─── Derived: source list from loaded data ──
  const sources = useMemo(() => {
    if (!monsterSRD?.meta?.sources) return [];
    return Object.entries(monsterSRD.meta.sources).map(([code, name]) => ({
      code, name: `${code} - ${name}`,
    }));
  }, [monsterSRD]);

  // ─── Derived: filtered & sorted monster keys ──
  const monsters = monsterSRD?.monsters ?? {};

  const filteredKeys = useMemo(() => {
    let keys = Object.keys(monsters);
    const lower = search.toLowerCase().trim();

    // Search filter
    if (lower) {
      keys = keys.filter((k) => k.toLowerCase().includes(lower));
    }

    // Type filter
    if (filterType) {
      keys = keys.filter((k) => {
        const t = monsters[k]?.type ?? '';
        return t.toLowerCase().includes(filterType.toLowerCase());
      });
    }

    // CR filter
    if (filterCR) {
      keys = keys.filter((k) => monsters[k]?.cr === filterCR);
    }

    // Source filter
    if (filterSource) {
      keys = keys.filter((k) => monsters[k]?.source === filterSource);
    }

    // Sort
    keys.sort((a, b) => {
      const ma = monsters[a] ?? {};
      const mb = monsters[b] ?? {};
      switch (sortBy) {
        case 'name': return a.localeCompare(b);
        case 'name-desc': return b.localeCompare(a);
        case 'cr-asc': return crToNum(ma.cr) - crToNum(mb.cr);
        case 'cr-desc': return crToNum(mb.cr) - crToNum(ma.cr);
        case 'type': return (ma.type ?? '').localeCompare(mb.type ?? '');
        case 'source': return (ma.source ?? '').localeCompare(mb.source ?? '');
        case 'hp-asc': return (ma.hp ?? 0) - (mb.hp ?? 0);
        case 'hp-desc': return (mb.hp ?? 0) - (ma.hp ?? 0);
        default: return a.localeCompare(b);
      }
    });

    return keys;
  }, [monsters, search, filterType, filterCR, filterSource, sortBy]);

  // ─── Load from server ──
  const handleLoadFromServer = useCallback(async () => {
    setLoadStatus('loading');
    try {
      const res = await fetch(`${SERVER_URL}/api/srd-monsters/load`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      loadMonsterSRD(data);
      setLoadStatus('loaded');
      setSelectedKey(null);
      setTimeout(() => setLoadStatus(null), 3000);
    } catch (err) {
      console.error('Failed to load monsters from server:', err);
      setLoadStatus('error');
      setTimeout(() => setLoadStatus(null), 5000);
    }
  }, [loadMonsterSRD]);

  // ─── Load from file ──
  const handleLoadFromFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        loadMonsterSRD(data);
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
  }, [loadMonsterSRD]);

  // ─── Save to server ──
  const handleSaveToServer = useCallback(async () => {
    if (!monsterSRD) return alert('No monster SRD data loaded.');
    setSaveStatus('saving');
    try {
      const res = await fetch(`${SERVER_URL}/api/srd-monsters/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(monsterSRD, null, 2),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }
      markSaved();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Monster save failed:', err);
      alert('Save failed: ' + err.message);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 5000);
    }
  }, [monsterSRD, markSaved]);

  // ─── Export as JSON ──
  const handleExport = useCallback(() => {
    if (!monsterSRD) return;
    const blob = new Blob([JSON.stringify(monsterSRD, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'srd_monsters.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [monsterSRD]);

  // ─── Add new monster ──
  const handleAddNew = useCallback(() => {
    const name = prompt('Enter new monster name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (monsters.hasOwnProperty(trimmed)) {
      alert(`A monster named "${trimmed}" already exists.`);
      return;
    }
    addMonster(trimmed, MONSTER_TEMPLATE());
    setSelectedKey(trimmed);
  }, [monsters, addMonster]);

  // ─── Delete monster ──
  const handleDelete = useCallback((key) => {
    if (!window.confirm(`Delete "${key}"? This cannot be undone.`)) return;
    deleteMonster(key);
    if (selectedKey === key) setSelectedKey(null);
  }, [deleteMonster, selectedKey]);

  // ─── Duplicate monster ──
  const handleDuplicate = useCallback((key) => {
    const newName = prompt(`Duplicate "${key}" as:`, `${key} (Copy)`);
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    if (monsters.hasOwnProperty(trimmed)) {
      alert(`A monster named "${trimmed}" already exists.`);
      return;
    }
    addMonster(trimmed, JSON.parse(JSON.stringify(monsters[key])));
    setSelectedKey(trimmed);
  }, [monsters, addMonster]);

  // ─── Clear all filters ──
  const clearFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterCR('');
    setFilterSource('');
  };

  // ─── Selected monster data ──
  const selectedData = selectedKey ? monsters[selectedKey] : null;

  const unsaved = hasUnsavedChanges();
  const totalMonsters = Object.keys(monsters).length;

  return (
    <div className="flex h-full">
      {/* ── Sidebar: Monster Browser ── */}
      <div className="w-80 bg-gray-850 border-r border-gray-700 flex flex-col flex-shrink-0"
           style={{ backgroundColor: '#1e2030' }}>
        {/* Header */}
        <div className="p-3 border-b border-gray-700">
          <h2 className="text-md font-bold text-dnd-gold flex items-center gap-2">
            <span className="text-lg">👹</span> Monster Browser
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{totalMonsters} monsters loaded</p>
        </div>

        {/* Search + Filters */}
        <div className="p-3 border-b border-gray-700 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search monsters..."
            className="form-input text-sm py-1.5 w-full"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="form-select text-xs py-1.5"
            >
              <option value="">All Types</option>
              {MONSTER_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <select
              value={filterCR}
              onChange={(e) => setFilterCR(e.target.value)}
              className="form-select text-xs py-1.5"
            >
              <option value="">All CRs</option>
              {CR_OPTIONS.map((c) => (
                <option key={c} value={c}>CR {c}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="form-select text-xs py-1.5"
            >
              <option value="">All Sources</option>
              {sources.map((s) => (
                <option key={s.code} value={s.code}>{s.code}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="form-select text-xs py-1.5"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {(search || filterType || filterCR || filterSource) && (
            <button type="button" onClick={clearFilters} className="text-xs text-srd-400 hover:text-srd-300 w-full text-center">
              Clear all filters
            </button>
          )}
        </div>

        {/* Monster List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {!monsterSRD && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">👹</div>
              <p className="text-gray-500 text-sm">Load monster SRD to begin</p>
            </div>
          )}
          {monsterSRD && filteredKeys.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm italic">No monsters match your filters</p>
            </div>
          )}
          {filteredKeys.map((key) => {
            const m = monsters[key];
            const isSelected = selectedKey === key;
            return (
              <div
                key={key}
                className={`group cursor-pointer rounded px-2.5 py-1.5 transition-colors ${
                  isSelected
                    ? 'bg-srd-800 border border-srd-500'
                    : 'bg-gray-800 border border-transparent hover:border-gray-600'
                }`}
                onClick={() => setSelectedKey(key)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate font-medium">{key}</span>
                  <span className="text-[10px] text-gray-500 font-mono">CR {m?.cr ?? '?'}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-srd-400 capitalize">{m?.type ?? '—'}</span>
                  {m?.source && (
                    <span className="text-[10px] text-gray-600 font-mono">{m.source}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(key); }}
                      className="text-gray-400 hover:text-srd-300 text-xs"
                      title="Duplicate"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(key); }}
                      className="text-red-400 hover:text-red-300 text-xs"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add + Actions */}
        <div className="p-3 border-t border-gray-700 space-y-2">
          {monsterSRD && (
            <button type="button" onClick={handleAddNew} className="btn-gold w-full text-sm py-2">
              + Add New Monster
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={handleLoadFromServer} className="btn-secondary text-xs py-1.5">
              🔄 Server
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs py-1.5">
              📂 File
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveToServer}
            disabled={!monsterSRD || saveStatus === 'saving'}
            className={`w-full text-sm py-2 font-bold ${
              unsaved ? 'btn-gold animate-pulse' : 'btn-primary'
            }`}
          >
            {saveStatus === 'saving' ? '⏳ Saving...' : unsaved ? '💾 Save Monsters *' : '💾 Save Monsters'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!monsterSRD}
            className="btn-secondary w-full text-sm py-1.5"
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

        {/* Status */}
        <div className="px-3 py-1.5 border-t border-gray-700 text-[10px] text-gray-500 flex justify-between">
          <span>{filteredKeys.length} of {totalMonsters} shown</span>
          <span>
            {saveStatus === 'saved' && <span className="text-emerald-400">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-red-400">✗ Error</span>}
            {loadStatus === 'loaded' && <span className="text-emerald-400">✓ Loaded</span>}
            {unsaved && !saveStatus && <span className="text-dnd-gold">● Unsaved</span>}
          </span>
        </div>
      </div>

      {/* ── Main Content: Editor ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!monsterSRD ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="text-6xl mb-4">👹</div>
            <h3 className="text-lg font-bold text-gray-300 mb-2">No Monster SRD Loaded</h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Load your srd_monsters.json from the server or from a local file to start editing monsters and creating homebrew creatures.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleLoadFromServer} className="btn-primary">
                Load from Server
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                Load from File
              </button>
            </div>
          </div>
        ) : !selectedKey || !selectedData ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="text-4xl mb-3">⚔️</div>
            <h3 className="text-lg font-bold text-gray-300 mb-1">Select or Create a Monster</h3>
            <p className="text-gray-500">Use the browser on the left to find monsters or add a new one.</p>
          </div>
        ) : (
          <MonsterEditor
            entryKey={selectedKey}
            entryData={selectedData}
            basePath={['monsters']}
          />
        )}
      </div>
    </div>
  );
}
