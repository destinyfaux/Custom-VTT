import React from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import DynamicArray from './shared/DynamicArray';

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

export default function SpellEditor({ entryKey, entryData, basePath }) {
  const { setField } = useSRD();
  const spellKey = entryKey;
  const spellData = entryData;
  const path = [...basePath, spellKey];

  const update = (field, value) => {
    setField([...path, field], value);
  };

  if (!spellData) return <div className="text-gray-500 italic">Select a spell or create a new one.</div>;

  const components = spellData.components ?? { verbal: false, somatic: false, material: false, material_cost: null };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-dnd-gold">{spellKey}</h2>
        <span className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded">
          Level {spellData.level ?? 0} {spellData.school || '—'}
        </span>
      </div>

      {/* ── Core Fields ── */}
      <div className="card">
        <div className="card-header">Core Info</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field-group">
            <label className="section-label">Source</label>
            <input
              type="text"
              value={spellData.source ?? ''}
              onChange={(e) => update('source', e.target.value)}
              className="form-input text-sm"
              placeholder="PHB, XGtE, etc."
            />
          </div>
          <div className="field-group">
            <label className="section-label">Level</label>
            <select
              value={spellData.level ?? 0}
              onChange={(e) => update('level', Number(e.target.value))}
              className="form-select text-sm"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                <option key={l} value={l}>{l === 0 ? 'Cantrip (0)' : l}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="section-label">School</label>
            <select
              value={spellData.school ?? ''}
              onChange={(e) => update('school', e.target.value)}
              className="form-select text-sm"
            >
              <option value="">Select...</option>
              {SCHOOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="section-label">Casting Time</label>
            <input
              type="text"
              value={spellData.casting_time ?? ''}
              onChange={(e) => update('casting_time', e.target.value)}
              className="form-input text-sm"
              placeholder="e.g., 1 action"
            />
          </div>
          <div className="field-group">
            <label className="section-label">Range</label>
            <input
              type="text"
              value={spellData.range ?? ''}
              onChange={(e) => update('range', e.target.value)}
              className="form-input text-sm"
              placeholder="e.g., 60 feet"
            />
          </div>
          <div className="field-group">
            <label className="section-label">Duration</label>
            <input
              type="text"
              value={spellData.duration ?? ''}
              onChange={(e) => update('duration', e.target.value)}
              className="form-input text-sm"
              placeholder="e.g., Instantaneous, 1 minute"
            />
          </div>
        </div>

        <div className="flex gap-6 mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={spellData.concentration ?? false}
              onChange={(e) => update('concentration', e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm">Concentration</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={spellData.ritual ?? false}
              onChange={(e) => update('ritual', e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm">Ritual</span>
          </label>
        </div>
      </div>

      {/* ── Components ── */}
      <div className="card">
        <div className="card-header">Components</div>
        <div className="flex gap-6 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={components.verbal ?? false}
              onChange={(e) => setField([...path, 'components', 'verbal'], e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm font-medium">Verbal (V)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={components.somatic ?? false}
              onChange={(e) => setField([...path, 'components', 'somatic'], e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm font-medium">Somatic (S)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={components.material ?? false}
              onChange={(e) => setField([...path, 'components', 'material'], e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm font-medium">Material (M)</span>
          </label>
        </div>
        {components.material && (
          <div className="field-group">
            <label className="section-label">Material Cost</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={components.material_cost ?? ''}
                onChange={(e) => setField([...path, 'components', 'material_cost'], e.target.value || null)}
                className="form-input text-sm flex-1"
                placeholder="e.g., A tiny ball of bat guava and sulfur"
              />
              {components.material_cost !== null && (
                <button
                  type="button"
                  onClick={() => setField([...path, 'components', 'material_cost'], null)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Set null
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Description ── */}
      <div className="card">
        <div className="card-header">Description</div>
        <div className="field-group">
          <label className="section-label">Spell Description</label>
          <textarea
            value={spellData.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            className="form-input text-sm"
            rows={4}
            placeholder="Full spell description..."
          />
        </div>
        <div className="field-group">
          <label className="section-label">At Higher Levels</label>
          <div className="flex items-center gap-2">
            <textarea
              value={spellData.higher_levels ?? ''}
              onChange={(e) => update('higher_levels', e.target.value || null)}
              className="form-input text-sm flex-1"
              rows={2}
              placeholder="Higher levels description (leave empty for null)..."
            />
            {spellData.higher_levels !== null && (
              <button
                type="button"
                onClick={() => update('higher_levels', null)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Set null
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Classes ── */}
      <div className="card">
        <div className="card-header">Available Classes</div>
        <DynamicArray
          items={spellData.classes ?? []}
          onChange={(v) => update('classes', v)}
          label="Classes that can cast this spell"
          placeholder="e.g., Wizard"
        />
      </div>
    </div>
  );
}
