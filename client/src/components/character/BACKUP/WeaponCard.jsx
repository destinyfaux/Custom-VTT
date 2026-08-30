// client/src/components/character/WeaponCard.jsx
import { useMemo, useState } from 'react';
import { parseWeight } from '../../utils/CharacterEngine';

export default function WeaponCard({ data, update, srd }) {
  const [search, setSearch] = useState('');

  // Build weapon categories from SRD
  const weaponCategories = useMemo(() => {
    if (!srd.equipment?.weapons) return [];
    
    // Structure for <optgroup> in the select dropdown
    return Object.entries(srd.equipment.weapons).map(([category, weapons]) => ({
      name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // e.g. "Simple Melee"
      items: Object.entries(weapons).map(([name, details]) => ({ name, ...details }))
    }));
  }, [srd]);

  // Filter based on search
  const filteredCategories = useMemo(() => {
    if (!search) return weaponCategories;
    return weaponCategories
      .map(cat => ({
        ...cat,
        items: cat.items.filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
      }))
      .filter(cat => cat.items.length > 0);
  }, [weaponCategories, search]);

  const weaponsInInventory = (data.inventory || []).filter(item => item.type === 'weapon');

  const addWeapon = (weaponName) => {
    if (!weaponName) return;
    let weaponToAdd = null;
    for (const category of weaponCategories) {
        const found = category.items.find(w => w.name === weaponName);
        if (found) {
            weaponToAdd = found;
            break;
        }
    }
    if (weaponToAdd) {
      const newItem = {
        id: Date.now() + Math.random(), // Unique ID for reliable deletion
        type: 'weapon',
        name: weaponToAdd.name,
        damage: weaponToAdd.damage,
        properties: weaponToAdd.properties || [],
        weight: parseWeight(weaponToAdd.weight)
      };
      const newInventory = [...(data.inventory || []), newItem];
      update('inventory', newInventory);
    }
  };

  const removeWeapon = (itemId) => {
    const newInventory = (data.inventory || []).filter(item => item.id !== itemId);
    update('inventory', newInventory);
  };

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
       <h3 className="text-accentGold font-bold text-[10px] uppercase mb-3 tracking-widest">Weapons</h3>
       
      {/* Search bar */}
      <input
        type="text"
        placeholder="Search weapons..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-bgCard text-white p-2 rounded text-xs mb-2 border border-borderDark focus:border-accentGold outline-none"
      />

      {/* Dropdown (only when not searching, or always show with filtered options) */}
       <select 
         className="w-full bg-bgCard text-textLight p-2 rounded text-xs mb-4 border border-borderDark focus:border-accentGold outline-none" 
         onChange={(e) => addWeapon(e.target.value)}
         defaultValue=""
       >
         <option value="" disabled>Add Weapon...</option>
        {filteredCategories.map(category => (
           <optgroup key={category.name} label={category.name}>
             {category.items.map(w => (
               <option key={w.name} value={w.name}>{w.name} ({w.damage})</option>
             ))}
           </optgroup>
         ))}
       </select>

        {/* Display weapons from inventory */}
        <div className="space-y-2">
            {weaponsInInventory.length === 0 && (
                <p className="text-[10px] text-textMuted italic text-center py-2">No weapons equipped.</p>
            )}
            {weaponsInInventory.map(w => (
            <div key={w.id} className="flex justify-between items-center bg-bgCard p-2 rounded border border-borderDark text-xs group">
                <div>
                    <div className="font-bold text-white flex items-center gap-2">{w.name} <span className="text-accentGold text-[10px]">({w.damage})</span></div>
                    <div className="text-[9px] text-textMuted mt-1">{w.properties?.join(', ')}</div>
                </div>
                <button 
                    className="text-red-900 group-hover:text-red-500 font-bold px-2 text-lg" 
                    onClick={() => removeWeapon(w.id)}
                    title="Remove Weapon"
                >
                    &times;
                </button>
         </div>
       ))}
    </div>
    </div>
  );
}