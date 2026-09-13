// client/src/tools/SRDManager/EquipmentEditor.jsx
import React, { useState } from 'react';
import { useSRD, TEMPLATES } from './SRDContext';
import DynamicArray from './shared/DynamicArray';

const WEAPON_CATEGORIES = ['simple_melee', 'simple_ranged', 'martial_melee', 'martial_ranged', 'firearms', 'explosives'];
const ARMOR_CATEGORIES = ['light', 'medium', 'heavy', 'shields', 'spelljammer'];
const TOOL_CATEGORIES = ['artisan_tools', 'gaming_sets', 'instruments', 'other_tools', 'vehicles'];
const DAMAGE_TYPES = ['bludgeoning', 'piercing', 'slashing', 'acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'];

// ─── Weapon Form ─────────────────────────────────────────────────────────────
function WeaponForm({ weapon, path, onChange }) {
  const update = (field, value) => onChange([...path, field], value);

  return (
    <div className="bg-gray-750 border border-gray-600 rounded p-3 mb-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="field-group">
          <label className="section-label">Name</label>
          <input type="text" value={weapon.name ?? ''} onChange={(e) => update('name', e.target.value)} className="form-input text-sm" />
        </div>
        <div className="field-group">
          <label className="section-label">Cost</label>
          <input type="text" value={weapon.cost ?? ''} onChange={(e) => update('cost', e.target.value)} className="form-input text-sm" placeholder="e.g., 10 gp" />
        </div>
        <div className="field-group">
          <label className="section-label">Damage</label>
          <input type="text" value={weapon.damage ?? ''} onChange={(e) => update('damage', e.target.value)} className="form-input text-sm" placeholder="e.g., 1d8" />
        </div>
        <div className="field-group">
          <label className="section-label">Damage Type</label>
          <select value={weapon.damage_type ?? ''} onChange={(e) => update('damage_type', e.target.value)} className="form-select text-sm">
            <option value="">Select...</option>
            {DAMAGE_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label className="section-label">Weight</label>
          <input type="text" value={weapon.weight ?? ''} onChange={(e) => update('weight', e.target.value)} className="form-input text-sm" placeholder="e.g., 4 lb." />
        </div>
      </div>

      <DynamicArray
        items={weapon.properties ?? []}
        onChange={(v) => update('properties', v)}
        label="Properties"
        placeholder="e.g., Finesse, Light"
      />

      {/* ─── Magic Weapon Fields ─── */}
      <div className="grid grid-cols-2 gap-3 mt-3 border-t border-gray-600 pt-3">
        <div className="field-group">
          <label className="section-label">Rarity (attack/damage bonus)</label>
          <select
            value={weapon.rarity ?? ''}
            onChange={(e) => update('rarity', e.target.value || null)}
            className="form-select text-sm"
          >
            <option value="">None</option>
            <option value="+1">+1</option>
            <option value="+2">+2</option>
            <option value="+3">+3</option>
          </select>
        </div>
        <div className="field-group">
          <label className="section-label">Magic Damage Dice</label>
          <input
            type="text"
            value={weapon.magic_damage ?? ''}
            onChange={(e) => update('magic_damage', e.target.value)}
            className="form-input text-sm"
            placeholder="e.g., 1d4"
          />
        </div>
        <div className="field-group">
          <label className="section-label">Magic Damage Type</label>
          <select
            value={weapon.magic_damage_type ?? ''}
            onChange={(e) => update('magic_damage_type', e.target.value)}
            className="form-select text-sm"
          >
            <option value="">Select...</option>
            {DAMAGE_TYPES.map((dt) => (
              <option key={dt} value={dt}>{dt}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Armor Form ──────────────────────────────────────────────────────────────
function ArmorForm({ armor, path, onChange }) {
  const update = (field, value) => onChange([...path, field], value);

  return (
    <div className="bg-gray-750 border border-gray-600 rounded p-3 mb-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="field-group">
          <label className="section-label">Name</label>
          <input type="text" value={armor.name ?? ''} onChange={(e) => update('name', e.target.value)} className="form-input text-sm" />
        </div>
        <div className="field-group">
          <label className="section-label">Cost</label>
          <input type="text" value={armor.cost ?? ''} onChange={(e) => update('cost', e.target.value)} className="form-input text-sm" placeholder="e.g., 10 gp" />
        </div>
        <div className="field-group">
          <label className="section-label">AC</label>
          <input type="number" value={armor.ac ?? 10} onChange={(e) => update('ac', Number(e.target.value) || 0)} className="form-input text-sm" min={0} />
        </div>
        <div className="field-group">
          <label className="section-label">Weight</label>
          <input type="text" value={armor.weight ?? ''} onChange={(e) => update('weight', e.target.value)} className="form-input text-sm" placeholder="e.g., 20 lb." />
        </div>
        <div className="field-group">
          <label className="section-label">Max DEX Bonus (null = unlimited)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={armor.max_dex_bonus ?? ''}
              onChange={(e) => update('max_dex_bonus', e.target.value === '' ? null : Number(e.target.value))}
              className="form-input text-sm flex-1"
              min={0}
              placeholder="null"
            />
            {armor.max_dex_bonus !== null && armor.max_dex_bonus !== undefined && (
              <button type="button" onClick={() => update('max_dex_bonus', null)} className="text-xs text-red-400">null</button>
            )}
          </div>
        </div>
        <div className="field-group">
          <label className="section-label">STR Requirement (null = none)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={armor.str_req ?? ''}
              onChange={(e) => update('str_req', e.target.value === '' ? null : Number(e.target.value))}
              className="form-input text-sm flex-1"
              min={0}
              placeholder="null"
            />
            {armor.str_req !== null && armor.str_req !== undefined && (
              <button type="button" onClick={() => update('str_req', null)} className="text-xs text-red-400">null</button>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-6 mt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={armor.dex_bonus ?? false} onChange={(e) => update('dex_bonus', e.target.checked)} className="form-checkbox" />
          <span className="text-sm">DEX Bonus</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={armor.stealth_disadvantage ?? false} onChange={(e) => update('stealth_disadvantage', e.target.checked)} className="form-checkbox" />
          <span className="text-sm">Stealth Disadvantage</span>
        </label>
      </div>

      {/* ─── Magic Armor Field ─── */}
      <div className="mt-3 border-t border-gray-600 pt-3">
        <div className="field-group">
          <label className="section-label">Rarity (AC bonus)</label>
          <select
            value={armor.rarity ?? ''}
            onChange={(e) => update('rarity', e.target.value || null)}
            className="form-select text-sm"
          >
            <option value="">None</option>
            <option value="+1">+1</option>
            <option value="+2">+2</option>
            <option value="+3">+3</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Simple Item Form (for tools, adventuring_gear, etc.) ────────────────────
function SimpleItemForm({ item, path, onChange, fields = ['name', 'cost', 'weight'] }) {
  const update = (field, value) => onChange([...path, field], value);

  return (
    <div className="bg-gray-750 border border-gray-600 rounded p-2.5 mb-2">
      <div className="flex flex-wrap gap-3">
        {fields.includes('name') && (
          <div className="field-group flex-1 min-w-[140px]">
            <input type="text" value={item.name ?? ''} onChange={(e) => update('name', e.target.value)} className="form-input text-sm" placeholder="Name" />
          </div>
        )}
        {fields.includes('cost') && (
          <div className="field-group w-28">
            <input type="text" value={item.cost ?? ''} onChange={(e) => update('cost', e.target.value)} className="form-input text-sm" placeholder="Cost" />
          </div>
        )}
        {fields.includes('weight') && (
          <div className="field-group w-28">
            <input type="text" value={item.weight ?? ''} onChange={(e) => update('weight', e.target.value)} className="form-input text-sm" placeholder="Weight" />
          </div>
        )}
        {item.description !== undefined && (
          <div className="field-group flex-1 min-w-[200px]">
            <input type="text" value={item.description ?? ''} onChange={(e) => update('description', e.target.value)} className="form-input text-sm" placeholder="Description" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Equipment Editor ───────────────────────────────────────────────────
export default function EquipmentEditor({ equipment, basePath }) {
  const { setField, pushToArray, deleteField } = useSRD();
  const [activeTab, setActiveTab] = useState('weapons');
  const [weaponSubTab, setWeaponSubTab] = useState('simple_melee');
  const [armorSubTab, setArmorSubTab] = useState('light');
  const [toolSubTab, setToolSubTab] = useState('artisan_tools');

  if (!equipment) return <div className="text-gray-500 italic">No equipment data loaded.</div>;

  const tabs = [
    { key: 'weapons', label: 'Weapons' },
    { key: 'armor', label: 'Armor' },
    { key: 'tools', label: 'Tools' },
    { key: 'adventuring_gear', label: 'Adventuring Gear' },
  ];

  // ── Weapons Tab ──
  const renderWeapons = () => {
    const cat = weaponSubTab;
    const weapons = equipment.weapons?.[cat] ?? [];
    const catPath = [...basePath, 'weapons', cat];

    const handleAddWeapon = () => {
      pushToArray(catPath, TEMPLATES.weapon());
    };

    const handleRemoveWeapon = (index) => {
      deleteField([...catPath, index]);
    };

    return (
      <div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {WEAPON_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setWeaponSubTab(c)}
              className={`text-xs py-1 px-2.5 rounded font-medium transition-colors ${
                weaponSubTab === c ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
        {weapons.map((w, i) => (
          <div key={i} className="relative">
            <WeaponForm weapon={w} path={[...catPath, i]} onChange={setField} />
            <button
              type="button"
              onClick={() => handleRemoveWeapon(i)}
              className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs"
            >
              Delete
            </button>
          </div>
        ))}
        <button type="button" onClick={handleAddWeapon} className="btn-gold text-sm py-1.5 px-3 mt-2">
          + Add Weapon
        </button>
      </div>
    );
  };

  // ── Armor Tab ──
  const renderArmor = () => {
    const cat = armorSubTab;
    const armors = equipment.armor?.[cat] ?? [];
    const catPath = [...basePath, 'armor', cat];

    const handleAddArmor = () => {
      pushToArray(catPath, TEMPLATES.armor());
    };

    const handleRemoveArmor = (index) => {
      deleteField([...catPath, index]);
    };

    return (
      <div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {ARMOR_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setArmorSubTab(c)}
              className={`text-xs py-1 px-2.5 rounded font-medium transition-colors ${
                armorSubTab === c ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
        {armors.map((a, i) => (
          <div key={i} className="relative">
            <ArmorForm armor={a} path={[...catPath, i]} onChange={setField} />
            <button
              type="button"
              onClick={() => handleRemoveArmor(i)}
              className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs"
            >
              Delete
            </button>
          </div>
        ))}
        <button type="button" onClick={handleAddArmor} className="btn-gold text-sm py-1.5 px-3 mt-2">
          + Add Armor
        </button>
      </div>
    );
  };

  // ── Tools Tab ──
  const renderTools = () => {
    const cat = toolSubTab;
    const tools = equipment.tools?.[cat] ?? [];
    const catPath = [...basePath, 'tools', cat];

    const handleAddTool = () => {
      pushToArray(catPath, { name: '', cost: '', weight: '' });
    };

    return (
      <div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {TOOL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setToolSubTab(c)}
              className={`text-xs py-1 px-2.5 rounded font-medium transition-colors ${
                toolSubTab === c ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
        {tools.map((t, i) => (
          <SimpleItemForm key={i} item={t} path={[...catPath, i]} onChange={setField} />
        ))}
        <button type="button" onClick={handleAddTool} className="btn-gold text-sm py-1.5 px-3 mt-2">
          + Add Tool
        </button>
      </div>
    );
  };

  // ── Adventuring Gear Tab ──
  const renderGear = () => {
    const gear = equipment.adventuring_gear ?? [];
    const catPath = [...basePath, 'adventuring_gear'];

    const handleAddGear = () => {
      pushToArray(catPath, { name: '', cost: '', weight: '' });
    };

    return (
      <div>
        {gear.map((g, i) => (
          <SimpleItemForm key={i} item={g} path={[...catPath, i]} onChange={setField} />
        ))}
        <button type="button" onClick={handleAddGear} className="btn-gold text-sm py-1.5 px-3 mt-2">
          + Add Gear Item
        </button>
        <div className="text-xs text-gray-500 mt-2">{gear.length} items total</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-dnd-gold">Equipment</h2>

      {/* Top-level tabs */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`py-2 px-4 rounded-t font-medium text-sm transition-colors ${
              activeTab === tab.key ? 'bg-gray-800 text-dnd-gold border-b-2 border-dnd-gold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card min-h-[400px]">
        {activeTab === 'weapons' && renderWeapons()}
        {activeTab === 'armor' && renderArmor()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'adventuring_gear' && renderGear()}
      </div>
    </div>
  );
}
