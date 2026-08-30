// client/src/components/character/SpellItem.jsx
import { useState } from 'react';

export default function SpellItem({ spell, onRemove, onTogglePrepared }) {
  const [expanded, setExpanded] = useState(false);

  // Helper to format components string (V/S/M)
  const getComponents = () => {
    let comps = [];
    if (spell.components?.verbal) comps.push('V');
    if (spell.components?.somatic) comps.push('S');
    if (spell.components?.material) comps.push('M');
    return comps.join(', ');
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    if (onTogglePrepared) onTogglePrepared();
  };

  return (
    <div 
      className={`bg-bgCard border rounded overflow-hidden mb-2 transition-all ${
        spell.prepared ? 'border-accentGold ring-1 ring-accentGold bg-accentGold/5' : 'border-borderDark'
      } ${expanded ? 'ring-1 ring-accentGold' : ''}`}
      onContextMenu={handleRightClick}
    >
      <div className="p-2 flex justify-between items-center cursor-pointer hover:bg-borderDark" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{spell.name}</span>
            {spell.prepared && (
              <span className="text-[9px] bg-accentGold text-black px-1.5 py-0.5 rounded-full font-bold">
                PREPARED
              </span>
            )}
          </div>
            <span className="text-[9px] text-textMuted">{spell.school} • Level {spell.level}</span>
        </div>
        <button 
          className="text-red-900 hover:text-red-500 font-bold px-2" 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          ×
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-2 text-[10px] bg-bgPanel border-t border-borderDark space-y-2">
            <div className="flex justify-between text-textMuted italic">
                <span>{spell.casting_time}</span>
                <span>{spell.range}</span>
            </div>
            <div className="text-white">
                <span className="text-accentGold font-bold">Components:</span> {getComponents()}
            {spell.components?.material_cost && (
              <div className="text-[9px] text-textMuted italic">({spell.components.material_cost})</div>
            )}
            </div>
            <div className="text-white">
                <span className="text-accentGold font-bold">Duration:</span> {spell.duration} {spell.concentration && <span className="text-red-400">(Conc)</span>}
            </div>
            <p className="text-textLight leading-relaxed">{spell.description}</p>
            {spell.higher_levels && (
                <div className="text-red-300 mt-1 italic">
                    <span className="font-bold">At Higher Levels:</span> {spell.higher_levels}
                </div>
            )}
          <div className="text-[9px] text-textMuted italic mt-1">
            Right‑click to toggle prepared status.
          </div>
        </div>
      )}
    </div>
  );
}