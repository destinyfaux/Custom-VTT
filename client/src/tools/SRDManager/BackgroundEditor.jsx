import React from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import DynamicArray from './shared/DynamicArray';

export default function BackgroundEditor({ entryKey, entryData, basePath }) {
  const { setField } = useSRD();
  const bgKey = entryKey;
  const bgData = entryData;
  const path = [...basePath, bgKey];

  const update = (field, value) => {
    setField([...path, field], value);
  };

  if (!bgData) return <div className="text-gray-500 italic">Select a background or create a new one.</div>;

  const hasVariant = bgData.variant !== null && bgData.variant !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-dnd-gold">{bgKey}</h2>
        <span className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded">
          {bgData.source || 'No source'}
        </span>
      </div>

      {/* ── Source ── */}
      <div className="card">
        <div className="card-header">Basic Info</div>
        <div className="field-group">
          <label className="section-label">Source</label>
          <input
            type="text"
            value={bgData.source ?? ''}
            onChange={(e) => update('source', e.target.value)}
            className="form-input text-sm"
            placeholder="PHB, XGtE, etc."
          />
        </div>
      </div>

      {/* ── Skill & Tool Proficiencies ── */}
      <div className="card">
        <div className="card-header">Proficiencies</div>
        <DynamicArray
          items={bgData.skill_proficiencies ?? []}
          onChange={(v) => update('skill_proficiencies', v)}
          label="Skill Proficiencies"
          placeholder="e.g., Insight"
        />
        <DynamicArray
          items={bgData.tool_proficiencies ?? []}
          onChange={(v) => update('tool_proficiencies', v)}
          label="Tool Proficiencies"
          placeholder="e.g., Thieves' tools"
        />
      </div>

      {/* ── Counts ── */}
      <div className="card">
        <div className="card-header">Counts</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'languages', label: 'Languages' },
            { key: 'personality_traits', label: 'Personality Traits' },
            { key: 'ideals', label: 'Ideals' },
            { key: 'bonds', label: 'Bonds' },
            { key: 'flaws', label: 'Flaws' },
          ].map(({ key, label }) => (
            <div key={key} className="field-group">
              <label className="section-label">{label}</label>
              <input
                type="number"
                value={bgData[key] ?? 0}
                onChange={(e) => update(key, Number(e.target.value) || 0)}
                className="form-input text-sm"
                min={0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Equipment ── */}
      <div className="card">
        <div className="card-header">Equipment</div>
        <DynamicArray
          items={bgData.equipment ?? []}
          onChange={(v) => update('equipment', v)}
          label="Starting Equipment"
          placeholder="e.g., A prayer book"
        />
      </div>

      {/* ── Feature ── */}
      <div className="card">
        <div className="card-header">Feature</div>
        <div className="field-group">
          <label className="section-label">Feature Name</label>
          <input
            type="text"
            value={bgData.feature?.name ?? ''}
            onChange={(e) => setField([...path, 'feature', 'name'], e.target.value)}
            className="form-input text-sm"
            placeholder="Feature name"
          />
        </div>
        <div className="field-group">
          <label className="section-label">Feature Description</label>
          <textarea
            value={bgData.feature?.description ?? ''}
            onChange={(e) => setField([...path, 'feature', 'description'], e.target.value)}
            className="form-input text-sm"
            rows={3}
            placeholder="Feature description..."
          />
        </div>
      </div>

      {/* ── Variant (Optional) ── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Variant</span>
          <button
            type="button"
            onClick={() => {
              if (hasVariant) {
                if (window.confirm('Remove variant?')) update('variant', null);
              } else {
                update('variant', { description: '', feature_name: '' });
              }
            }}
            className={`text-xs py-1 px-2 rounded font-medium ${
              hasVariant
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {hasVariant ? 'Remove Variant' : 'Add Variant'}
          </button>
        </div>
        {hasVariant && (
          <div>
            <div className="field-group">
              <label className="section-label">Variant Description</label>
              <input
                type="text"
                value={bgData.variant?.description ?? ''}
                onChange={(e) => setField([...path, 'variant', 'description'], e.target.value)}
                className="form-input text-sm"
                placeholder="Variant description..."
              />
            </div>
            <div className="field-group">
              <label className="section-label">Variant Feature Name</label>
              <input
                type="text"
                value={bgData.variant?.feature_name ?? ''}
                onChange={(e) => setField([...path, 'variant', 'feature_name'], e.target.value)}
                className="form-input text-sm"
                placeholder="Variant feature name..."
              />
            </div>
          </div>
        )}
        {!hasVariant && (
          <p className="text-gray-500 text-sm italic">No variant. Click "Add Variant" to create one.</p>
        )}
      </div>
    </div>
  );
}
