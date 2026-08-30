import React, { useState } from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import DynamicArray from './shared/DynamicArray';
import ObjectMapper from './shared/ObjectMapper';
import SpellcastingEditor from './SpellcastingEditor';

const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SAVE_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

// ─── Feature array editor (level + name + description) ───────────────────────
function FeatureEditor({ features = [], onChange, label = 'Features' }) {
  const handleAdd = () => {
    onChange([...features, { level: 1, name: '', description: '' }]);
  };

  const handleUpdate = (index, field, value) => {
    const updated = [...features];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleRemove = (index) => {
    const updated = [...features];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <div className="mb-4">
      <label className="section-label">{label}</label>
      <div className="space-y-2">
        {features.map((feat, i) => (
          <div key={i} className="bg-gray-700 border border-gray-600 rounded p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Lvl</span>
                <input
                  type="number"
                  value={feat.level ?? 1}
                  onChange={(e) => handleUpdate(i, 'level', Number(e.target.value) || 1)}
                  className="form-input text-sm py-1 w-16 text-center"
                  min={1}
                  max={20}
                />
              </div>
              <input
                type="text"
                value={feat.name ?? ''}
                onChange={(e) => handleUpdate(i, 'name', e.target.value)}
                className="form-input flex-1 text-sm py-1"
                placeholder="Feature name"
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
              value={feat.description ?? ''}
              onChange={(e) => handleUpdate(i, 'description', e.target.value)}
              className="form-input text-sm w-full"
              rows={2}
              placeholder="Feature description..."
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={handleAdd} className="btn-secondary text-sm py-1.5 px-3 mt-2">
        + Add Feature
      </button>
    </div>
  );
}

// ─── Subclass nested editor ──────────────────────────────────────────────────
function SubclassEditor({ subclass, path, onChange }) {
  const update = (field, value) => onChange([...path, field], value);

  return (
    <div className="bg-gray-750 border border-gray-600 rounded-lg p-3 ml-4">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="field-group">
          <label className="section-label">Source</label>
          <input
            type="text"
            value={subclass.source ?? ''}
            onChange={(e) => update('source', e.target.value)}
            className="form-input text-sm"
            placeholder="PHB, XGtE, etc."
          />
        </div>
      </div>
      <div className="field-group">
        <label className="section-label">Description</label>
        <textarea
          value={subclass.description ?? ''}
          onChange={(e) => update('description', e.target.value)}
          className="form-input text-sm"
          rows={2}
          placeholder="Subclass description..."
        />
      </div>
      <FeatureEditor
        features={subclass.features ?? []}
        onChange={(v) => update('features', v)}
        label="Subclass Features"
      />
    </div>
  );
}

// ─── Main Class Editor ───────────────────────────────────────────────────────
export default function ClassEditor({ entryKey, entryData, basePath }) {
  const { setField, deleteField } = useSRD();
  const [newSubclassName, setNewSubclassName] = useState('');
  const classKey = entryKey;
  const classData = entryData;

  const path = [...basePath, classKey];

  const update = (field, value) => {
    setField([...path, field], value);
  };

  const handleAddSubclass = () => {
    const name = newSubclassName.trim();
    if (!name || classData.subclasses?.[name]) return;
    setField([...path, 'subclasses', name], TEMPLATES.subclass());
    setNewSubclassName('');
  };

  const handleDeleteSubclass = (subName) => {
    if (!window.confirm(`Delete subclass "${subName}"?`)) return;
    deleteField([...path, 'subclasses', subName]);
  };

  const handleToggleSpellcasting = () => {
    if (classData.spellcasting) {
      if (window.confirm('Remove spellcasting block? This will delete all spell data for this class.')) {
        setField([...path, 'spellcasting'], null);
      }
    } else {
      setField([...path, 'spellcasting'], TEMPLATES.spellcasting());
    }
  };

  if (!classData) return <div className="text-gray-500 italic">Select a class or create a new one.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-dnd-gold">{classKey}</h2>
        <span className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded">
          {classData.source || 'No source'}
        </span>
      </div>

      {/* ── Basic Info ── */}
      <div className="card">
        <div className="card-header">Basic Info</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field-group">
            <label className="section-label">Source</label>
            <input
              type="text"
              value={classData.source ?? ''}
              onChange={(e) => update('source', e.target.value)}
              className="form-input text-sm"
            />
          </div>
          <div className="field-group">
            <label className="section-label">Hit Die</label>
            <select
              value={classData.hit_die ?? 8}
              onChange={(e) => update('hit_die', Number(e.target.value))}
              className="form-select text-sm"
            >
              {[6, 8, 10, 12].map((d) => (
                <option key={d} value={d}>d{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Primary Ability & Saves ── */}
      <div className="card">
        <div className="card-header">Abilities & Saves</div>
        <DynamicArray
          items={classData.primary_ability ?? []}
          onChange={(v) => update('primary_ability', v)}
          label="Primary Abilities"
          placeholder="e.g., Strength"
        />
        <DynamicArray
          items={classData.saving_throws ?? []}
          onChange={(v) => update('saving_throws', v)}
          label="Saving Throws"
          placeholder="e.g., STR"
        />
      </div>

      {/* ── Skill Choices ── */}
      <div className="card">
        <div className="card-header">Skill Choices</div>
        <div className="field-group">
          <label className="section-label">Number of Skills to Choose</label>
          <input
            type="number"
            value={classData.skill_choices?.count ?? 2}
            onChange={(e) => setField([...path, 'skill_choices', 'count'], Number(e.target.value) || 0)}
            className="form-input text-sm w-24"
            min={0}
          />
        </div>
        <DynamicArray
          items={classData.skill_choices?.from ?? []}
          onChange={(v) => setField([...path, 'skill_choices', 'from'], v)}
          label="Available Skills"
          placeholder="e.g., Athletics"
        />
      </div>

      {/* ── Proficiencies ── */}
      <div className="card">
        <div className="card-header">Proficiencies</div>
        <DynamicArray
          items={classData.proficiencies?.armor ?? []}
          onChange={(v) => setField([...path, 'proficiencies', 'armor'], v)}
          label="Armor Proficiencies"
          placeholder="e.g., All armor"
        />
        <DynamicArray
          items={classData.proficiencies?.weapons ?? []}
          onChange={(v) => setField([...path, 'proficiencies', 'weapons'], v)}
          label="Weapon Proficiencies"
          placeholder="e.g., Simple weapons"
        />
        <DynamicArray
          items={classData.proficiencies?.tools ?? []}
          onChange={(v) => setField([...path, 'proficiencies', 'tools'], v)}
          label="Tool Proficiencies"
          placeholder="e.g., Thieves' tools"
        />
      </div>

      {/* ── Starting Equipment ── */}
      <div className="card">
        <div className="card-header">Starting Equipment</div>
        <DynamicArray
          items={classData.starting_equipment ?? []}
          onChange={(v) => update('starting_equipment', v)}
          label="Equipment Options"
          placeholder="e.g., Chain mail or leather armor"
        />
      </div>

      {/* ── Features ── */}
      <div className="card">
        <div className="card-header">Class Features</div>
        <FeatureEditor
          features={classData.features ?? []}
          onChange={(v) => update('features', v)}
        />
      </div>

      {/* ── Subclasses ── */}
      <div className="card">
        <div className="card-header">Subclasses</div>
        {Object.entries(classData.subclasses ?? {}).map(([subName, subData]) => (
          <div key={subName} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-bold text-srd-200">{subName}</h4>
              <span className="text-[10px] text-gray-500 font-mono">{subData.source}</span>
              <button
                type="button"
                onClick={() => handleDeleteSubclass(subName)}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Delete
              </button>
            </div>
            <SubclassEditor
              subclass={subData}
              path={[...path, 'subclasses', subName]}
              onChange={setField}
            />
          </div>
        ))}
        <div className="flex gap-2 items-center mt-3">
          <input
            type="text"
            value={newSubclassName}
            onChange={(e) => setNewSubclassName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubclass()}
            placeholder="New subclass name..."
            className="form-input flex-1 text-sm"
          />
          <button type="button" onClick={handleAddSubclass} className="btn-gold text-sm py-1.5 px-3">
            + Add Subclass
          </button>
        </div>
      </div>

      {/* ── Spellcasting (Optional) ── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Spellcasting</span>
          <button
            type="button"
            onClick={handleToggleSpellcasting}
            className={`text-xs py-1 px-2 rounded font-medium ${
              classData.spellcasting
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {classData.spellcasting ? 'Remove Spellcasting' : 'Enable Spellcasting'}
          </button>
        </div>
        {classData.spellcasting ? (
          <SpellcastingEditor
            spellcasting={classData.spellcasting}
            path={[...path, 'spellcasting']}
            onChange={setField}
          />
        ) : (
          <p className="text-gray-500 text-sm italic">
            This class does not have spellcasting. Click "Enable Spellcasting" to add the spell block.
          </p>
        )}
      </div>
    </div>
  );
}
