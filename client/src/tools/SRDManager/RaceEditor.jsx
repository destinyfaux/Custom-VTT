import React, { useState } from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import DynamicArray from './shared/DynamicArray';
import ObjectMapper from './shared/ObjectMapper';

const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SIZE_OPTIONS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

// ─── Sub-race nested form ────────────────────────────────────────────────────
function SubraceEditor({ subrace, path, onChange }) {
  const update = (field, value) => onChange([...path, field], value);

  return (
    <div className="bg-gray-750 border border-gray-600 rounded-lg p-3 ml-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="field-group">
          <label className="section-label">Source</label>
          <input
            type="text"
            value={subrace.source ?? ''}
            onChange={(e) => update('source', e.target.value)}
            className="form-input text-sm"
            placeholder="PHB, XGtE, etc."
          />
        </div>
      </div>
      <ObjectMapper
        data={subrace.ability_score_increase ?? {}}
        onChange={(v) => update('ability_score_increase', v)}
        label="Ability Score Increase"
        keyOptions={ABILITY_KEYS}
      />
      <TraitEditor
        traits={subrace.traits ?? []}
        onChange={(v) => update('traits', v)}
      />
    </div>
  );
}

// ─── Trait array editor (name + description objects) ─────────────────────────
function TraitEditor({ traits = [], onChange }) {
  const handleAdd = () => {
    onChange([...traits, { name: '', description: '' }]);
  };

  const handleUpdate = (index, field, value) => {
    const updated = [...traits];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleRemove = (index) => {
    const updated = [...traits];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <div className="mb-4">
      <label className="section-label">Traits</label>
      <div className="space-y-2">
        {traits.map((trait, i) => (
          <div key={i} className="bg-gray-700 border border-gray-600 rounded p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <input
                type="text"
                value={trait.name ?? ''}
                onChange={(e) => handleUpdate(i, 'name', e.target.value)}
                className="form-input flex-1 text-sm py-1"
                placeholder="Trait name"
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-red-400 hover:text-red-300 text-sm font-bold px-1"
              >
                ×
              </button>
            </div>
            <textarea
              value={trait.description ?? ''}
              onChange={(e) => handleUpdate(i, 'description', e.target.value)}
              className="form-input text-sm w-full"
              rows={2}
              placeholder="Trait description"
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={handleAdd} className="btn-secondary text-sm py-1.5 px-3 mt-2">
        + Add Trait
      </button>
    </div>
  );
}

// ─── Main Race Editor ────────────────────────────────────────────────────────
export default function RaceEditor({ entryKey, entryData, basePath }) {
  const { setField, deleteField, addEntry } = useSRD();
  const [newSubraceName, setNewSubraceName] = useState('');
  const raceKey = entryKey;
  const race = entryData;

  const path = [...basePath, raceKey];

  const update = (field, value) => {
    setField([...path, field], value);
  };

  const handleAddSubrace = () => {
    const name = newSubraceName.trim();
    if (!name) return;
    if (race.subraces?.[name]) return; // already exists
    setField([...path, 'subraces', name], TEMPLATES.subrace());
    setNewSubraceName('');
  };

  const handleDeleteSubrace = (subraceName) => {
    if (!window.confirm(`Delete subrace "${subraceName}"?`)) return;
    deleteField([...path, 'subraces', subraceName]);
  };

  if (!race) return <div className="text-gray-500 italic">Select a race or create a new one.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-dnd-gold">{raceKey}</h2>
        <span className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded">
          {race.source || 'No source'}
        </span>
      </div>

      {/* ── Top-level strings ── */}
      <div className="card">
        <div className="card-header">Basic Info</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field-group">
            <label className="section-label">Source</label>
            <input
              type="text"
              value={race.source ?? ''}
              onChange={(e) => update('source', e.target.value)}
              className="form-input text-sm"
              placeholder="PHB, XGtE, etc."
            />
          </div>
          <div className="field-group">
            <label className="section-label">Size</label>
            <select
              value={race.size ?? 'Medium'}
              onChange={(e) => update('size', e.target.value)}
              className="form-select text-sm"
            >
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="section-label">Speed</label>
            <input
              type="number"
              value={race.speed ?? 30}
              onChange={(e) => update('speed', Number(e.target.value) || 0)}
              className="form-input text-sm"
              min={0}
            />
          </div>
          <div className="field-group">
            <label className="section-label">Darkvision</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={race.darkvision ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  update('darkvision', val);
                }}
                className="form-input text-sm flex-1"
                placeholder="null = none"
                min={0}
              />
              {race.darkvision !== null && (
                <button
                  type="button"
                  onClick={() => update('darkvision', null)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Set null
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="field-group">
          <label className="section-label">Age</label>
          <textarea
            value={race.age ?? ''}
            onChange={(e) => update('age', e.target.value)}
            className="form-input text-sm"
            rows={2}
            placeholder="Age description..."
          />
        </div>

        <div className="field-group">
          <label className="section-label">Alignment</label>
          <textarea
            value={race.alignment ?? ''}
            onChange={(e) => update('alignment', e.target.value)}
            className="form-input text-sm"
            rows={2}
            placeholder="Alignment tendencies..."
          />
        </div>
      </div>

      {/* ── Ability Score Increase ── */}
      <div className="card">
        <div className="card-header">Ability Score Increase</div>
        <ObjectMapper
          data={race.ability_score_increase ?? {}}
          onChange={(v) => update('ability_score_increase', v)}
          keyOptions={ABILITY_KEYS}
          label="Racial Ability Bonuses"
        />
      </div>

      {/* ── Languages ── */}
      <div className="card">
        <div className="card-header">Languages</div>
        <DynamicArray
          items={race.languages ?? []}
          onChange={(v) => update('languages', v)}
          label="Known Languages"
          placeholder="Add language..."
        />
      </div>

      {/* ── Traits ── */}
      <div className="card">
        <div className="card-header">Racial Traits</div>
        <TraitEditor
          traits={race.traits ?? []}
          onChange={(v) => update('traits', v)}
        />
      </div>

      {/* ── Subraces ── */}
      <div className="card">
        <div className="card-header">Subraces</div>
        {Object.entries(race.subraces ?? {}).map(([subName, subData]) => (
          <div key={subName} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-bold text-srd-200">{subName}</h4>
              <button
                type="button"
                onClick={() => handleDeleteSubrace(subName)}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Delete Subrace
              </button>
            </div>
            <SubraceEditor
              subrace={subData}
              path={[...path, 'subraces', subName]}
              onChange={setField}
            />
          </div>
        ))}
        <div className="flex gap-2 items-center mt-3">
          <input
            type="text"
            value={newSubraceName}
            onChange={(e) => setNewSubraceName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubrace()}
            placeholder="New subrace name..."
            className="form-input flex-1 text-sm"
          />
          <button type="button" onClick={handleAddSubrace} className="btn-gold text-sm py-1.5 px-3">
            + Add Subrace
          </button>
        </div>
      </div>
    </div>
  );
}
