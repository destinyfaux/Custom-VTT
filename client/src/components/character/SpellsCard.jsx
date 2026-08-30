// client/src/components/character/SpellsCard.jsx
import { useState, useEffect, useMemo } from 'react';
import srd from '../../data/srd_data.json';
import SpellItem from './SpellItem';

export default function SpellsCard({ data, update }) {
  const [spellSearch, setSpellSearch] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(0); // 0 = all
  const [showOnlyPrepared, setShowOnlyPrepared] = useState(false);
  const [showAllSpells, setShowAllSpells] = useState(false); // NEW: toggle

  const allSpells = Object.entries(srd.spells || {});
  const charClass = data.charClass;

  // Filter spells by class if showAllSpells is false
  const classFilteredSpells = useMemo(() => {
    if (!charClass || showAllSpells) {
      // If no class selected or showAll is true, return all spells (sorted)
      return allSpells
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return allSpells
      .filter(([name, s]) => {
        const classList = s.classes || [];
        return classList.some(c => c.toLowerCase() === charClass.toLowerCase());
      })
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [charClass, allSpells, showAllSpells]);

  // Group by level and sort within each level
  const spellsByLevel = useMemo(() => {
    const map = {};
    for (let i = 0; i <= 9; i++) map[i] = [];
    classFilteredSpells.forEach(spell => {
      const lvl = spell.level;
      if (map[lvl]) map[lvl].push(spell);
      else map[lvl] = [spell];
    });
    // Each level already sorted alphabetically from classFilteredSpells
    return map;
  }, [classFilteredSpells]);

  // Inline search filtering
  const filteredSpells = useMemo(() => {
    if (!spellSearch) return [];
    return classFilteredSpells
      .filter(spell => spell.name.toLowerCase().includes(spellSearch.toLowerCase()))
      .slice(0, 8);
  }, [spellSearch, classFilteredSpells]);

  // Backwards compatibility: ensure every spell has a `prepared` property
  useEffect(() => {
    const spells = data.spells || [];
    let needsUpdate = false;
    const updatedSpells = spells.map(s => {
      if (s.prepared === undefined) {
        needsUpdate = true;
        return { ...s, prepared: false };
      }
      return s;
    });
    if (needsUpdate) {
      update('spells', updatedSpells);
    }
  }, [data.spells, update]);

  const addSpell = (spellName) => {
    const spell = srd.spells[spellName];
    const newSpells = [...(data.spells || []), { 
      name: spellName, 
      ...spell, 
      prepared: false 
    }];
    update('spells', newSpells);
    setSpellSearch('');
    setShowBrowser(false);
  };

  const removeSpell = (idx) => {
    const newSpells = (data.spells || []).filter((_, i) => i !== idx);
    update('spells', newSpells);
  };

  const togglePrepared = (idx) => {
    const newSpells = [...(data.spells || [])];
    newSpells[idx] = {
      ...newSpells[idx],
      prepared: !newSpells[idx].prepared
    };
    update('spells', newSpells);
  };

  const filteredSpellList = useMemo(() => {
    const spells = data.spells || [];
    if (showOnlyPrepared) {
      return spells.filter(s => s.prepared);
    }
    return spells;
  }, [data.spells, showOnlyPrepared]);

  // Helper to format class list for display
  const formatClassList = (classes) => {
    if (!classes || classes.length === 0) return '—';
    return classes.join(', ');
  };

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
      <h3 className="text-accentGold font-bold text-[10px] uppercase mb-3 tracking-widest">Spellbook</h3>

      {/* Class filter hint and toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      {!charClass && (
          <div className="text-[10px] text-yellow-400 bg-yellow-900/20 p-1.5 rounded border border-yellow-800 flex-1">
            ⚠️ Select a class to filter spells.
        </div>
      )}
        <button
          onClick={() => setShowAllSpells(!showAllSpells)}
          className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
            showAllSpells
              ? 'bg-accentGold text-black border-accentGold'
              : 'bg-borderDark text-textMuted border-borderDark hover:bg-gray-700'
          }`}
        >
          {showAllSpells ? 'Showing All Spells' : 'Class Only'}
        </button>
      </div>

      {/* Filter toggle */}
      <div className="flex justify-between items-center mb-2">
        <button
          onClick={() => setShowOnlyPrepared(!showOnlyPrepared)}
          className="text-[9px] bg-borderDark px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          {showOnlyPrepared ? 'Show All Spells' : 'Show Prepared Only'}
        </button>
        {showOnlyPrepared && (
          <span className="text-[9px] text-accentGold">
            {filteredSpellList.length} / {(data.spells || []).length} prepared
          </span>
        )}
      </div>

      {/* Inline search */}
      <div className="relative mb-2">
        <input
          className="w-full bg-bgCard p-2 rounded text-xs text-white border border-borderDark focus:border-accentGold outline-none"
          placeholder="Search spells..."
          value={spellSearch}
          onChange={(e) => setSpellSearch(e.target.value)}
        />
        {filteredSpells.length > 0 && (
          <div className="absolute z-10 w-full bg-bgCard border border-accentGold rounded mt-1 max-h-40 overflow-y-auto">
            {filteredSpells.map(spell => (
              <div key={spell.name} className="p-2 text-xs hover:bg-borderDark cursor-pointer" onClick={() => addSpell(spell.name)}>
                {spell.name} <span className="text-textMuted text-[9px]">(Lvl {spell.level})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="w-full bg-borderDark text-white py-1 rounded text-xs mb-3 hover:bg-gray-700 transition-colors"
        onClick={() => setShowBrowser(true)}
      >
        Browse All Spells
      </button>

      {/* Current Spells */}
      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {filteredSpellList.length === 0 && (
          <p className="text-[10px] text-textMuted italic text-center py-2">
            {showOnlyPrepared ? 'No prepared spells.' : 'No spells known.'}
          </p>
        )}
        {filteredSpellList.map((s, idx) => {
          // Need original index for removal/toggle
          const originalIdx = (data.spells || []).findIndex(orig => orig.name === s.name);
          return (
            <SpellItem
              key={`${s.name}_${originalIdx}`}
              spell={s}
              onRemove={() => removeSpell(originalIdx)}
              onTogglePrepared={() => togglePrepared(originalIdx)}
            />
          );
        })}
      </div>

      {/* Spell Browser Modal */}
      {showBrowser && (
        <div className="fixed inset-0 z-[1200] bg-black bg-opacity-70 flex items-center justify-center p-4">
          <div className="bg-bgPanel border border-accentGold rounded-xl w-[850px] h-[600px] flex shadow-2xl overflow-hidden relative">
            {/* Close button - top-right corner of modal */}
            <button
              className="absolute top-2 right-3 text-textMuted hover:text-white text-xl z-10"
              onClick={() => setShowBrowser(false)}
            >
              ✕
            </button>
            
            {/* Level sidebar */}
            <div className="w-16 bg-bgCard border-r border-borderDark flex flex-col items-center py-2 gap-1 overflow-y-auto">
              <button
                className={`w-10 h-10 rounded text-xs font-bold ${selectedLevel === 0 ? 'bg-accentGold text-black' : 'bg-bgPanel text-white hover:bg-borderDark'}`}
                onClick={() => setSelectedLevel(0)}
              >All</button>
              {[...Array(10)].map((_, i) => (
                <button
                  key={i}
                  className={`w-10 h-10 rounded text-xs font-bold ${selectedLevel === i ? 'bg-accentGold text-black' : 'bg-bgPanel text-white hover:bg-borderDark'}`}
                  onClick={() => setSelectedLevel(i)}
                >{i}</button>
              ))}
            </div>

            {/* Spell list */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-accentGold font-bold text-sm">
                {selectedLevel === 0 ? 'All Spells' : `Level ${selectedLevel} Spells`}
                  {charClass && !showAllSpells && (
                  <span className="text-textMuted text-[10px] font-normal ml-2">
                    ({charClass} only)
                  </span>
                )}
                  {showAllSpells && (
                    <span className="text-textMuted text-[10px] font-normal ml-2">
                      (all classes)
                    </span>
                  )}
                  <span className="text-textMuted text-[10px] font-normal ml-2">
                    ({spellsByLevel[selectedLevel]?.length || 0} spells)
                              </span>
                </h3>
              </div>
              <div className="space-y-1">
                {(spellsByLevel[selectedLevel] || []).map(spell => (
                  <div
                    key={spell.name}
                    className="bg-bgCard p-2 rounded text-xs text-white hover:bg-borderDark cursor-pointer flex justify-between items-center"
                    onClick={() => { addSpell(spell.name); setShowBrowser(false); }}
                  >
                    <span>{spell.name}</span>
                    <span className="text-textMuted text-[9px] flex items-center gap-1">
                      {spell.school && <span>{spell.school}</span>}
                      {showAllSpells && (
                        <span className="text-[8px] bg-borderDark px-1.5 py-0.5 rounded">
                          {formatClassList(spell.classes)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                {selectedLevel === 0 && Object.values(spellsByLevel).flat().length === 0 && (
                  <p className="text-textMuted italic">
                    {charClass && !showAllSpells ? `No spells available for ${charClass}.` : 'No spells found.'}
                  </p>
                )}
                {selectedLevel !== 0 && spellsByLevel[selectedLevel]?.length === 0 && (
                  <p className="text-textMuted italic">No spells at this level.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}