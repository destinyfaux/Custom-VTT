import { useState } from 'react';
import { calculateEncumbrance, parseWeight, findItemInSRD, getPushDragLift } from '../../utils/CharacterEngine';

export default function InventoryCard({ data, update, srd, liveStats }) {
  const [search, setSearch] = useState('');
  const encumbrance = calculateEncumbrance(data, liveStats);
  const inventory = data.inventory || [];
  const pushDragLift = getPushDragLift(liveStats.str || 10);

  // Helper: Filter all available gear from SRD for the search bar
  const allGear = srd.equipment?.adventuring_gear 
    ? Object.entries(srd.equipment.adventuring_gear).map(([name, details]) => ({ name, ...details })) 
    : [];
  
  const filteredGear = search ? allGear.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : [];

  const addPack = (packName) => {
    if (!packName || packName === "Add Starting Pack...") return;
    
    const pack = srd.equipment.packs[packName];
    if (!pack) return;

    const newItems = pack.contents.map(name => {
        const item = findItemInSRD(name, srd) || { name, weight: 0 };
        return { name, weight: parseWeight(item.weight) }; // Using our parsing engine
    });
    
    update('inventory', [...inventory, ...newItems]);
  };

  const addItem = (item) => {
    update('inventory', [...inventory, { name: item.name, weight: parseWeight(item.weight) }]);
    setSearch('');
  };

  const removeItem = (index) => {
    const newInventory = inventory.filter((_, i) => i !== index);
    update('inventory', newInventory);
  };

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Inventory</h3>
        <button 
            className="text-[9px] text-red-500 hover:text-red-400" 
            onClick={() => update('inventory', [])}
        >
            Clear All
        </button>
      </div>
      
      {/* Starting Packs Selector */}
      <select 
        className="w-full bg-bgCard text-textLight p-2 rounded text-xs mb-2 border border-borderDark focus:border-accentGold outline-none" 
        onChange={(e) => addPack(e.target.value)}
        defaultValue=""
      >
        <option value="" disabled>Add Starting Pack...</option>
        {Object.keys(srd.equipment.packs || {}).map(p => (
            <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Individual Item Search */}
      <div className="relative mb-4">
        <input 
            className="w-full bg-bgCard text-textLight p-2 rounded text-xs border border-borderDark focus:border-accentGold outline-none" 
            placeholder="Search individual items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
        />
        {/* Search Results Dropdown */}
        {search && (
            <div className="absolute z-50 w-full bg-bgPanel border border-accentGold rounded mt-1 max-h-40 overflow-y-auto">
                {filteredGear.length > 0 ? filteredGear.map(item => (
                    <div key={item.name} className="p-2 text-xs hover:bg-borderDark cursor-pointer flex justify-between" onClick={() => addItem(item)}>
                        <span>{item.name}</span>
                        <span className="text-textMuted">{item.weight}</span>
                    </div>
                )) : <div className="p-2 text-xs text-textMuted">No items found</div>}
            </div>
        )}
      </div>

      {/* Inventory List */}
      <div className="space-y-1 mb-4 max-h-[300px] overflow-y-auto pr-1">
        {inventory.length === 0 && (
            <p className="text-[10px] text-textMuted italic text-center py-2">Inventory is empty</p>
        )}
        {inventory.map((item, idx) => (
           <div key={idx} className="flex justify-between items-center text-xs text-textLight bg-bgCard p-2 rounded border border-borderDark group">
             <span>{item.name}</span>
             <div className="flex items-center gap-2">
                <span className="text-textMuted text-[10px]">{item.weight} lbs</span>
                <button 
                    className="text-red-900 group-hover:text-red-500 font-bold" 
                    onClick={() => removeItem(idx)}
                >
                    ×
                </button>
             </div>
           </div>
        ))}
      </div>
      
      {/* Encumbrance Footer */}
      <div className="text-[10px] text-textMuted flex flex-col border-t border-borderDark pt-2 gap-1">
         <div className="flex justify-between">
         <span>Weight: {encumbrance.totalWeight} / {encumbrance.capacity} lbs</span>
         {encumbrance.isEncumbered && <span className="text-red-500 font-bold">ENCUMBERED</span>}
         </div>
         <div className="flex justify-between">
            <span>Push/Drag/Lift</span>
            <span className="text-white">{pushDragLift.pushDragLift} lbs</span>
         </div>
      </div>
    </div>
  );
}