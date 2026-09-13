import React from 'react';
import { useMonsterSRD, MONSTER_TEMPLATE, MONSTER_TYPES, MONSTER_SIZES, MONSTER_ALIGNMENTS,
  DAMAGE_TYPES, CONDITION_TYPES, ABILITY_KEYS, SKILL_NAMES, CR_OPTIONS, SPEED_TYPES,
  SENSE_TYPES, ENVIRONMENTS, CR_XP_TABLE } from './MonsterSRDContext';
import ObjectMapper from './shared/ObjectMapper';
import DynamicArray from './shared/DynamicArray';
import NamedEntryArray from './shared/NamedEntryArray';

/**
 * MonsterEditor - Full stat block editor for a single monster entry.
 *
 * Props:
 *   entryKey: string   - Monster name key
 *   entryData: object  - Monster data object
 *   basePath: array    - Path to the monster within the SRD (e.g., ['monsters'])
 */
export default function MonsterEditor({ entryKey, entryData, basePath }) {
  const { setField } = useMonsterSRD();
  const path = [...basePath, entryKey];

  const update = (field, value) => {
    setField([...path, field], value);
  };

  const updateNested = (field, subfield, value) => {
    setField([...path, field, subfield], value);
  };

  if (!entryData) return <div className="text-gray-500 italic">Select a monster or create a new one.</div>;

  // ── Derived values ──
  const cr = entryData.cr ?? '0';
  const xp = CR_XP_TABLE[cr] ?? 0;
  const speed = entryData.speed ?? { walk: 30 };
  const senses = entryData.senses ?? { passive_perception: 10 };
  const abilityScores = entryData.ability_scores ?? { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
  const saves = entryData.saves ?? {};
  const skills = entryData.skills ?? {};

  // ── Speed helpers ──
  const addSpeedType = (type) => {
    if (speed[type] !== undefined) return;
    update('speed', { ...speed, [type]: 0 });
  };

  const removeSpeedType = (type) => {
    if (type === 'walk') return; // can't remove walk
    const { [type]: _, ...rest } = speed;
    update('speed', rest);
  };

  // ── Sense helpers ──
  const addSenseType = (type) => {
    if (senses[type] !== undefined) return;
    update('senses', { ...senses, [type]: 0 });
  };

  const removeSenseType = (type) => {
    if (type === 'passive_perception') return; // can't remove passive_perception
    const { [type]: _, ...rest } = senses;
    update('senses', rest);
  };

  // ── Stat block preview ──
  const renderStatPreview = () => {
    const mod = (score) => Math.floor((score - 10) / 2);
    const formatMod = (m) => m >= 0 ? `+${m}` : `${m}`;
    return (
      <div className="grid grid-cols-6 gap-2 text-center">
        {ABILITY_KEYS.map((ab) => (
          <div key={ab} className="bg-gray-800 rounded p-2">
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">{ab}</div>
            <div className="text-lg font-bold text-gray-100">{abilityScores[ab] ?? 10}</div>
            <div className="text-xs text-srd-300">({formatMod(mod(abilityScores[ab] ?? 10))})</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-dnd-gold">{entryKey}</h2>
        <span className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded">
          {entryData.type || 'No type'} | CR {cr} ({xp.toLocaleString()} XP)
        </span>
        {entryData.source && (
          <span className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">
            {entryData.source}
          </span>
        )}
      </div>

      {/* ── Stat Block Preview ── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Ability Scores</span>
          <span className="text-xs text-gray-500">Auto-calculated modifiers shown below</span>
        </div>
        {renderStatPreview()}
      </div>

      {/* ── Core Identity ── */}
      <div className="card">
        <div className="card-header">Identity</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="field-group">
            <label className="section-label">Source</label>
            <input
              type="text"
              value={entryData.source ?? ''}
              onChange={(e) => update('source', e.target.value)}
              className="form-input text-sm"
              placeholder="MM, VGtM, MToF, etc."
            />
          </div>
          <div className="field-group">
            <label className="section-label">Type</label>
            <select
              value={entryData.type ?? ''}
              onChange={(e) => update('type', e.target.value)}
              className="form-select text-sm"
            >
              <option value="">Select type...</option>
              {MONSTER_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="section-label">Size</label>
            <select
              value={entryData.size ?? 'Medium'}
              onChange={(e) => update('size', e.target.value)}
              className="form-select text-sm"
            >
              {MONSTER_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="section-label">Alignment</label>
            <select
              value={entryData.alignment ?? ''}
              onChange={(e) => update('alignment', e.target.value)}
              className="form-select text-sm"
            >
              <option value="">Select alignment...</option>
              {MONSTER_ALIGNMENTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="section-label">Challenge Rating</label>
            <select
              value={cr}
              onChange={(e) => update('cr', e.target.value)}
              className="form-select text-sm"
            >
              {CR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  CR {c} ({(CR_XP_TABLE[c] ?? 0).toLocaleString()} XP)
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="section-label">Environment</label>
            <input
              type="text"
              value={Array.isArray(entryData.environment) ? entryData.environment.join(', ') : (entryData.environment ?? '')}
              onChange={(e) => update('environment', e.target.value)}
              className="form-input text-sm"
              placeholder="e.g., forest, mountain"
            />
          </div>
        </div>
      </div>

      {/* ── Combat Stats ── */}
      <div className="card">
        <div className="card-header">Combat Stats</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field-group">
            <label className="section-label">Armor Class</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={entryData.ac ?? 10}
                onChange={(e) => update('ac', Number(e.target.value) || 0)}
                className="form-input text-sm w-20"
                min={0}
              />
              <input
                type="text"
                value={entryData.ac_desc ?? ''}
                onChange={(e) => update('ac_desc', e.target.value)}
                className="form-input text-sm flex-1"
                placeholder="e.g., natural armor"
              />
            </div>
          </div>
          <div className="field-group">
            <label className="section-label">Hit Points</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={entryData.hp ?? 0}
                onChange={(e) => update('hp', Number(e.target.value) || 0)}
                className="form-input text-sm w-24"
                min={0}
                placeholder="HP"
              />
              <input
                type="text"
                value={entryData.hp_formula ?? ''}
                onChange={(e) => update('hp_formula', e.target.value)}
                className="form-input text-sm flex-1"
                placeholder="e.g., 3d10+6"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Speed ── */}
      <div className="card">
        <div className="card-header">Speed</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {Object.entries(speed).map(([type, val]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-sm font-mono text-srd-300 min-w-[80px] capitalize">{type}</span>
              <input
                type="number"
                value={val ?? 0}
                onChange={(e) => updateNested('speed', type, Number(e.target.value) || 0)}
                className="form-input text-sm w-24"
                min={0}
              />
              <span className="text-xs text-gray-500">ft.</span>
              {type !== 'walk' && (
                <button
                  type="button"
                  onClick={() => removeSpeedType(type)}
                  className="text-red-400 hover:text-red-300 text-sm font-bold px-1"
                  title="Remove"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addSpeedType(e.target.value);
            }}
            className="form-select text-sm"
          >
            <option value="">+ Add speed type...</option>
            {SPEED_TYPES.filter((t) => speed[t] === undefined).map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Ability Scores Editor ── */}
      <div className="card">
        <div className="card-header">Ability Scores</div>
        <ObjectMapper
          data={abilityScores}
          onChange={(v) => update('ability_scores', v)}
          keyOptions={ABILITY_KEYS}
          label="Ability Scores"
          valuePlaceholder="Score (1-30)"
        />
      </div>

      {/* ── Saving Throws ── */}
      <div className="card">
        <div className="card-header">Saving Throws</div>
        <ObjectMapper
          data={saves}
          onChange={(v) => update('saves', v)}
          keyOptions={ABILITY_KEYS}
          label="Saving Throw Modifiers"
          valuePlaceholder="+mod"
        />
      </div>

      {/* ── Skills ── */}
      <div className="card">
        <div className="card-header">Skills</div>
        <ObjectMapper
          data={skills}
          onChange={(v) => update('skills', v)}
          keyOptions={SKILL_NAMES}
          label="Skill Modifiers"
          valuePlaceholder="+mod"
        />
      </div>

      {/* ── Damage Resistances ── */}
      <div className="card">
        <div className="card-header">Damage Resistances</div>
        <DynamicArray
          items={entryData.resistances ?? []}
          onChange={(v) => update('resistances', v)}
          label="Resistances"
          placeholder="e.g., fire, bludgeoning from nonmagical weapons"
        />
      </div>

      {/* ── Damage Immunities ── */}
      <div className="card">
        <div className="card-header">Damage Immunities</div>
        <DynamicArray
          items={entryData.immunities ?? []}
          onChange={(v) => update('immunities', v)}
          label="Immunities"
          placeholder="e.g., poison, psychic"
        />
      </div>

      {/* ── Damage Vulnerabilities ── */}
      <div className="card">
        <div className="card-header">Damage Vulnerabilities</div>
        <DynamicArray
          items={entryData.vulnerabilities ?? []}
          onChange={(v) => update('vulnerabilities', v)}
          label="Vulnerabilities"
          placeholder="e.g., fire, slashing"
        />
      </div>

      {/* ── Condition Immunities ── */}
      <div className="card">
        <div className="card-header">Condition Immunities</div>
        <DynamicArray
          items={entryData.condition_immunities ?? []}
          onChange={(v) => update('condition_immunities', v)}
          label="Condition Immunities"
          placeholder="e.g., charmed, frightened"
        />
      </div>

      {/* ── Senses ── */}
      <div className="card">
        <div className="card-header">Senses</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {Object.entries(senses).map(([type, val]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-sm font-mono text-srd-300 min-w-[120px]">
                {type === 'passive_perception' ? 'Passive Perception' : type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
              <input
                type="number"
                value={val ?? 0}
                onChange={(e) => updateNested('senses', type, Number(e.target.value) || 0)}
                className="form-input text-sm w-24"
                min={0}
              />
              <span className="text-xs text-gray-500">
                {type === 'passive_perception' ? '' : 'ft.'}
              </span>
              {type !== 'passive_perception' && (
                <button
                  type="button"
                  onClick={() => removeSenseType(type)}
                  className="text-red-400 hover:text-red-300 text-sm font-bold px-1"
                  title="Remove"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addSenseType(e.target.value);
            }}
            className="form-select text-sm"
          >
            <option value="">+ Add sense type...</option>
            {SENSE_TYPES.filter((t) => senses[t] === undefined).map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={senses.blind_beyond ?? false}
              onChange={(e) => updateNested('senses', 'blind_beyond', e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm">Blind Beyond (blindsight only)</span>
          </label>
        </div>
      </div>

      {/* ── Languages ── */}
      <div className="card">
        <div className="card-header">Languages</div>
        <input
          type="text"
          value={entryData.languages ?? ''}
          onChange={(e) => update('languages', e.target.value)}
          className="form-input text-sm"
          placeholder="e.g., Common, Draconic, telepathy 120 ft."
        />
      </div>

      {/* ── Traits ── */}
      <div className="card">
        <div className="card-header">Traits</div>
        <NamedEntryArray
          items={entryData.traits ?? []}
          onChange={(v) => update('traits', v)}
          label=""
          addLabel="+ Add Trait"
        />
      </div>

      {/* ── Actions ── */}
      <div className="card">
        <div className="card-header">Actions</div>
        <NamedEntryArray
          items={entryData.actions ?? []}
          onChange={(v) => update('actions', v)}
          label=""
          addLabel="+ Add Action"
        />
      </div>

      {/* ── Legendary Actions ── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Legendary Actions</span>
          <span className="text-xs text-gray-500">
            {entryData.legendary_actions?.length ?? 0} legendary actions defined
          </span>
        </div>
        <NamedEntryArray
          items={entryData.legendary_actions ?? []}
          onChange={(v) => update('legendary_actions', v)}
          label=""
          addLabel="+ Add Legendary Action"
          extraFields={[
            { key: 'cost', label: 'Action Cost (1-3)', type: 'number', default: 1 },
          ]}
        />
      </div>

      {/* ── Reactions ── */}
      <div className="card">
        <div className="card-header">Reactions</div>
        <NamedEntryArray
          items={entryData.reactions ?? []}
          onChange={(v) => update('reactions', v)}
          label=""
          addLabel="+ Add Reaction"
        />
      </div>

      {/* ── Lair Actions ── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Lair Actions</span>
          <span className="text-xs text-gray-500">
            {entryData.lair_actions?.length ?? 0} lair actions defined
          </span>
        </div>
        <NamedEntryArray
          items={entryData.lair_actions ?? []}
          onChange={(v) => update('lair_actions', v)}
          label=""
          addLabel="+ Add Lair Action"
        />
      </div>

      {/* ── Description / Notes ── */}
      <div className="card">
        <div className="card-header">Description / Lore Notes</div>
        <textarea
          value={entryData.description ?? ''}
          onChange={(e) => update('description', e.target.value)}
          className="form-input text-sm"
          rows={4}
          placeholder="Optional lore or description for this creature..."
        />
      </div>
    </div>
  );
}
