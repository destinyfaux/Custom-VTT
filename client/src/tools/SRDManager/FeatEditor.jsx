import React from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import ObjectMapper from './shared/ObjectMapper';
import DynamicKeyValues from './shared/DynamicKeyValues';

const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export default function FeatEditor({ entryKey, entryData, basePath }) {
  const { setField } = useSRD();
  const featKey = entryKey;
  const featData = entryData;
  const path = [...basePath, featKey];

  const update = (field, value) => {
    setField([...path, field], value);
  };

  if (!featData) return <div className="text-gray-500 italic">Select a feat or create a new one.</div>;

  const hasASI = featData.ability_score_increase !== null && featData.ability_score_increase !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-dnd-gold">{featKey}</h2>
        <span className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded">
          {featData.source || 'No source'}
        </span>
      </div>

      {/* ── Core Fields ── */}
      <div className="card">
        <div className="card-header">Basic Info</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field-group">
            <label className="section-label">Source</label>
            <input
              type="text"
              value={featData.source ?? ''}
              onChange={(e) => update('source', e.target.value)}
              className="form-input text-sm"
              placeholder="PHB, XGtE, etc."
            />
          </div>
          <div className="field-group">
            <label className="section-label">Prerequisite</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={featData.prerequisite ?? ''}
                onChange={(e) => update('prerequisite', e.target.value || null)}
                className="form-input text-sm flex-1"
                placeholder="e.g., Charisma 13 or higher (leave empty for null)"
              />
              {featData.prerequisite !== null && featData.prerequisite !== undefined && (
                <button
                  type="button"
                  onClick={() => update('prerequisite', null)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Set null
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-6 mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={featData.can_take_multiple ?? false}
              onChange={(e) => update('can_take_multiple', e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm">Can Take Multiple</span>
          </label>
        </div>
      </div>

      {/* ── Description ── */}
      <div className="card">
        <div className="card-header">Description</div>
        <div className="field-group">
          <label className="section-label">Feat Description</label>
          <textarea
            value={featData.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            className="form-input text-sm"
            rows={5}
            placeholder="Full feat description..."
          />
        </div>
      </div>

      {/* ── Ability Score Increase (Optional) ── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Ability Score Increase</span>
          <button
            type="button"
            onClick={() => {
              if (hasASI) {
                if (window.confirm('Remove ability score increase?')) update('ability_score_increase', null);
              } else {
                update('ability_score_increase', {});
              }
            }}
            className={`text-xs py-1 px-2 rounded font-medium ${
              hasASI ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {hasASI ? 'Remove ASI' : 'Add ASI'}
          </button>
        </div>
        {hasASI ? (
          <ObjectMapper
            data={featData.ability_score_increase}
            onChange={(v) => update('ability_score_increase', v)}
            keyOptions={ABILITY_KEYS}
            label="Ability Score Increases"
          />
        ) : (
          <p className="text-gray-500 text-sm italic">No ability score increase. Click "Add ASI" to add one.</p>
        )}
      </div>

      {/* ── Effects (Dynamic Key-Value) ── */}
      <div className="card">
        <div className="card-header">Effects (VTT Automation)</div>
        <p className="text-xs text-gray-500 mb-2">
          Effects are dynamic key-value pairs used by the VTT for automation. Common keys include:
          <code className="text-srd-300 ml-1">proficiencies_add</code>,
          <code className="text-srd-300 ml-1">advantage_on_saves</code>,
          <code className="text-srd-300 ml-1">resistance_add</code>,
          <code className="text-srd-300 ml-1">other_mechanical</code>,
          <code className="text-srd-300 ml-1">ability_score_increase</code>.
        </p>
        <DynamicKeyValues
          data={featData.effects ?? {}}
          onChange={(v) => update('effects', v)}
          label="Feat Effects"
        />
      </div>
    </div>
  );
}
