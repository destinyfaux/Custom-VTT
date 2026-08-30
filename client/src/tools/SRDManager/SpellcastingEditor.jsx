import React from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import DynamicArray from './shared/DynamicArray';

/**
 * SpellcastingEditor - Handles the optional spellcasting block for a class.
 * spell_slots_by_level is a nested object: { "1": [20 ints], "2": [20 ints], ... }
 * cantrips_known and spells_known are arrays of 20 integers (one per level).
 */
export default function SpellcastingEditor({ spellcasting, path, onChange }) {
  if (!spellcasting) return null;

  const update = (field, value) => onChange([...path, field], value);

  // Render a 20-slot number array row
  const renderSlotArray = (label, arr, field) => (
    <div className="mb-4">
      <label className="section-label">{label}</label>
      <div className="grid grid-cols-10 gap-1">
        {(arr ?? new Array(20).fill(0)).map((val, i) => (
          <div key={i} className="text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Lvl {i + 1}</div>
            <input
              type="number"
              value={val}
              onChange={(e) => {
                const copy = [...(arr ?? new Array(20).fill(0))];
                copy[i] = Number(e.target.value) || 0;
                update(field, copy);
              }}
              className="form-input text-center text-xs py-1 px-0.5"
              min={0}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-750 border border-srd-700 rounded-lg p-3 ml-4">
      <div className="card-header text-base">Spellcasting</div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field-group">
          <label className="section-label">Spellcasting Ability</label>
          <select
            value={spellcasting.ability ?? ''}
            onChange={(e) => update('ability', e.target.value)}
            className="form-select text-sm"
          >
            <option value="">Select...</option>
            <option value="Intelligence">Intelligence</option>
            <option value="Wisdom">Wisdom</option>
            <option value="Charisma">Charisma</option>
          </select>
        </div>
        <div className="field-group">
          <label className="section-label">Spellcasting Focus</label>
          <input
            type="text"
            value={spellcasting.spellcasting_focus ?? ''}
            onChange={(e) => update('spellcasting_focus', e.target.value)}
            className="form-input text-sm"
            placeholder="arcane focus, holy symbol..."
          />
        </div>
      </div>

      <div className="flex gap-6 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={spellcasting.ritual_casting ?? false}
            onChange={(e) => update('ritual_casting', e.target.checked)}
            className="form-checkbox"
          />
          <span className="text-sm">Ritual Casting</span>
        </label>
      </div>

      {renderSlotArray('Cantrips Known (by class level)', spellcasting.cantrips_known, 'cantrips_known')}

      {/* spells_known vs spells_prepared — mutually exclusive */}
      <div className="mb-4">
        <label className="section-label">Spell Knowledge Type</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              // Switch to spells_known mode
              const updated = { ...spellcasting };
              delete updated.spells_prepared;
              updated.spells_known = new Array(20).fill(0);
              onChange(path, updated);
            }}
            className={`text-xs py-1 px-3 rounded font-medium ${
              spellcasting.spells_known ? 'bg-srd-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Known (Sorcerer, Warlock, Ranger, Bard)
          </button>
          <button
            type="button"
            onClick={() => {
              // Switch to spells_prepared mode
              const updated = { ...spellcasting };
              delete updated.spells_known;
              updated.spells_prepared = '';
              onChange(path, updated);
            }}
            className={`text-xs py-1 px-3 rounded font-medium ${
              spellcasting.spells_prepared !== undefined ? 'bg-srd-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Prepared (Cleric, Druid, Paladin, Wizard)
          </button>
        </div>
        {spellcasting.spells_known && (
          renderSlotArray('Spells Known (by class level)', spellcasting.spells_known, 'spells_known')
        )}
        {spellcasting.spells_prepared !== undefined && (
          <div className="field-group">
            <label className="section-label">Spells Prepared Formula</label>
            <input
              type="text"
              value={spellcasting.spells_prepared ?? ''}
              onChange={(e) => update('spells_prepared', e.target.value)}
              className="form-input text-sm"
              placeholder="e.g., WIS mod + cleric level"
            />
          </div>
        )}
      </div>

      {/* Spell Slots by Level */}
      <div className="mb-4">
        <label className="section-label">Spell Slots by Spell Level</label>
        <p className="text-xs text-gray-500 mb-2">
          Each row is a spell level (1-9). Each column is class level (1-20). Values are number of slots.
        </p>
        {Object.entries(spellcasting.spell_slots_by_level ?? {}).sort(([a],[b]) => Number(a) - Number(b)).map(([spellLvl, slots]) => (
          <div key={spellLvl} className="mb-2">
            <div className="text-xs text-srd-300 font-semibold mb-1">
              Spell Level {spellLvl}
              <button
                type="button"
                onClick={() => {
                  const updated = { ...spellcasting.spell_slots_by_level };
                  delete updated[spellLvl];
                  update('spell_slots_by_level', updated);
                }}
                className="text-red-400 hover:text-red-300 text-xs ml-2"
              >
                × Remove
              </button>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {(Array.isArray(slots) ? slots : []).map((val, i) => (
                <div key={i} className="text-center">
                  <div className="text-[10px] text-gray-500 mb-0.5">{i + 1}</div>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const copy = [...slots];
                      copy[i] = Number(e.target.value) || 0;
                      const updated = { ...spellcasting.spell_slots_by_level, [spellLvl]: copy };
                      update('spell_slots_by_level', updated);
                    }}
                    className="form-input text-center text-xs py-1 px-0.5"
                    min={0}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const existing = spellcasting.spell_slots_by_level ?? {};
            const nextLevel = String(Object.keys(existing).length + 1);
            if (Number(nextLevel) > 9) return;
            update('spell_slots_by_level', {
              ...existing,
              [nextLevel]: new Array(20).fill(0),
            });
          }}
          className="btn-secondary text-xs py-1 px-2 mt-1"
          disabled={Object.keys(spellcasting.spell_slots_by_level ?? {}).length >= 9}
        >
          + Add Spell Level
        </button>
      </div>
    </div>
  );
}
