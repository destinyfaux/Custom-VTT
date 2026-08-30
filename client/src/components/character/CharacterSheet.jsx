// client/src/components/character/CharacterSheet.jsx
import { useEffect, useState, useMemo, useRef } from 'react';
import srd from '../../data/srd_data.json';
import { useSync } from '../../hooks/useSync';
import { socket } from '../../socket';   
import { getOrGenerateUserId } from '../../auth';
import { SERVER_URL } from '../../config';
import { 
    calculateRawStats,
    calculateLiveStats, 
    getProficiencyBonus, 
    calculateAC, 
    calculateMaxHP 
} from '../../utils/CharacterEngine';

/* ==========================================================================
   MODULAR PANEL CARD IMPORTS
   ========================================================================== */
import StatCard from './StatCard';
import CombatCard from './CombatCard';
import SkillsCard from './SkillsCard';
import FeaturesCard from './FeaturesCard';
import SpellsCard from './SpellsCard';
import JournalCard from './JournalCard';
//import InventoryCard from './InventoryCard'; // Left as imported to maintain filesystem compatibility
//import WeaponCard from './WeaponCard';       // Left as imported to maintain filesystem compatibility
import SensesCard from './SensesCard';
import ActionsCard from './ActionsCard';
import AppearanceCard from './AppearanceCard';
import CollapsibleSection from './CollapsibleSection';
import FeatsCard from './FeatsCard';
import LevelUpModal from './LevelUpModal';
import SavingThrowsCard from './SavingThrowsCard';

// Standard 5e XP Thresholds (Levels 1 - 20)
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

const getLevelFromXP = (xp) => {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
};

// Recalculates HP based on level using standard D&D 5e average rules
function recalcHpMaxFromLevel(characterData, srdData, currentHpMax, rawStats) {
  const className = characterData.charClass;
  const classData = srdData?.classes?.[className];
  if (!classData) return currentHpMax || 10; // safe fallback

  const hitDie = classData.hit_die || 8;
  const conVal = rawStats?.con || 10;
  const conMod = Math.floor((conVal - 10) / 2);
  const level = characterData.lvl || 1;

  // Level 1: Full hit die + CON modifier
  let total = hitDie + conMod;

  // Levels 2+: Standard average (rounded up) + CON modifier per level
  const averagePerLevel = Math.floor(hitDie / 2) + 1;
  for (let i = 2; i <= level; i++) {
    total += averagePerLevel + conMod;
  }

  // Minimum 1 HP per level
  total = Math.max(level, total);
  return total;
}

export default function CharacterSheet({ role, tab, externalData = null, targetUserId = null, onUpdate = null }) {
  const [data, setData] = useState(() => {
    if (externalData) return externalData;
    return JSON.parse(localStorage.getItem('tome_data') || '{}');
  });

  const [levelUpData, setLevelUpData] = useState(null);
  const prevLevelRef = useRef(data.lvl);

  /* ==========================================
     CORE CALCULATIONS & ENGINE STATS
     ========================================== */
  // RAW stats: Direct unadjusted values typed into input boxes
  const rawStats = useMemo(() => calculateRawStats(data), [data.str, data.dex, data.con, data.int, data.wis, data.cha]);
  
  // LIVE stats: Suggested numbers with automated racial additions
  const liveStats = useMemo(() => calculateLiveStats(data), [data.str, data.dex, data.con, data.int, data.wis, data.cha, data.race, data.subrace]);
  
  const profBonus = useMemo(() => getProficiencyBonus(data.lvl || 1), [data.lvl]);
  
  // Max HP and AC calculated authoritatively from RAW stats
  const liveMaxHP = useMemo(() => {
    if (data.hpMax !== undefined && data.hpMax !== null && !isNaN(data.hpMax)) {
      return data.hpMax;
    }
    return calculateMaxHP(data, rawStats, srd);
  }, [data.hpMax, data, rawStats]);

  const liveAC = useMemo(() => calculateAC(data, rawStats, srd), [data, rawStats]);

  const baseSpeed = useMemo(() => {
    if (data.race && srd.races[data.race]) {
      return srd.races[data.race].speed || 30;
    }
    return 30;
  }, [data.race]);

  const initiativeBonus = useMemo(() => {
    const dex = rawStats.dex || 10;
    return Math.floor((dex - 10) / 2);
  }, [rawStats]);

  const hpInitialized = useRef(false);

  /* ==========================================
     LIFECYCLE & SYNC LISTENERS
     ========================================== */
  useEffect(() => {
    if ((data.hpMax === undefined || data.hpMax === null) && liveMaxHP) {
      setData(prev => ({ ...prev, hpMax: liveMaxHP }));
    }
  }, [liveMaxHP]);

  useEffect(() => {
    if (!hpInitialized.current && (data.hpCur === undefined || data.hpCur === null)) {
      hpInitialized.current = true;
      setData(prev => ({ ...prev, hpCur: liveMaxHP }));
    }
  }, [data.hpCur, liveMaxHP]);

  // Listener for custom header-level Pre-made load triggers
  useEffect(() => {
    // Prevent observed sheets or DM templates from overwriting DM values
    if (externalData) return;

    const handleLoadPremade = (e) => {
      const templateData = e.detail;
      setData(templateData);
      localStorage.setItem('tome_data', JSON.stringify(templateData));
      socket.emit('sync_character_data', templateData);
    };

    window.addEventListener('load-premade', handleLoadPremade);
    return () => window.removeEventListener('load-premade', handleLoadPremade);
  }, [externalData]);

  useEffect(() => {
    if (data.lvl && prevLevelRef.current && data.lvl !== prevLevelRef.current) {
      if (data.lvl > prevLevelRef.current) {
        // Level increased – show level-up modal
        setLevelUpData({
          oldLevel: prevLevelRef.current,
          newLevel: data.lvl
        });
      } else {
        // Level decreased – recalculate HP immediately using standard averages
        const recalcHpMax = recalcHpMaxFromLevel(data, srd, data.hpMax, rawStats);
        const recalcHpCur = Math.min(data.hpCur || recalcHpMax, recalcHpMax);
        setData(prev => ({
          ...prev,
          hpMax: recalcHpMax,
          hpCur: recalcHpCur
        }));
      }
    }
    prevLevelRef.current = data.lvl;
  }, [data.lvl, rawStats]);

  // ★ Added: Update internal sheet state when the DM pushes character modifications
  useEffect(() => {
    if (externalData) return; // DM's standalone viewer manages its own updates via onUpdate

    const handleSync = (syncData) => {
      if (syncData && syncData.name) {
        setData(syncData);
      }
    };
    
    socket.on('sync_character_data', handleSync);
    return () => {
      socket.off('sync_character_data', handleSync);
    };
  }, [externalData]);

  const syncPayload = useMemo(() => ({
      ...data,
      ac: liveAC,
      hpMax: liveMaxHP,
      hpCur: data.hpCur ?? 0,   // ★ fallback only if truly missing
      speed: baseSpeed,
      initiativeBonus: initiativeBonus
  }), [data, liveAC, liveMaxHP, baseSpeed, initiativeBonus]);

  // Only sync if we're editing our own character, not an observed copy
  useSync(externalData ? null : syncPayload, role === 'DM');

  /* ==========================================
     INTERACTIVE COMPONENT HANDLERS
     ========================================== */
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);   // ★ dedicated ref for the avatar file input

  const update = (id, val) => {
    let newData;
    if (typeof id === 'object' && id !== null) {
      // Batch update: id is an object { key: value, ... }
      newData = { ...data, ...id };
    } else {
      // Single update
      newData = { ...data, [id]: val };
    }
    setData(newData);
    if (!externalData) {
      localStorage.setItem('tome_data', JSON.stringify(newData));
    }
    if (onUpdate) onUpdate(newData);
  };

  // Add handler to update character after level-up
  const handleLevelUpUpdate = (updatedData) => {
    setData(updatedData);
    if (!externalData) {
      localStorage.setItem('tome_data', JSON.stringify(updatedData));
    }
    if (onUpdate) onUpdate(updatedData);
    socket.emit('sync_character_data', updatedData);
  };

  const handleXpChange = (val) => {
    const newXp = parseInt(val) || 0;
    const newLvl = getLevelFromXP(newXp);
    const newData = { ...data, xp: newXp, lvl: newLvl };
    setData(newData);
    if (!externalData) localStorage.setItem('tome_data', JSON.stringify(newData));
  };

  // Special Handler for Level (Auto-updates XP)
  const handleLevelChange = (val) => {
    const newLvl = Math.max(1, Math.min(20, parseInt(val) || 1));
    const oldLvl = data.lvl || 1;
    
    if (newLvl === oldLvl) return;

    let newData = { ...data, lvl: newLvl };
    
    if (newLvl < oldLvl) {
      // Level decrease – confirm first
      const confirmed = window.confirm(
        `Are you sure you want to decrease level from ${oldLvl} to ${newLvl}?\n` +
        `This will recalculate your maximum HP based on average rolls. Current HP will be capped.`
      );
      if (!confirmed) return;

      const newHpMax = recalcHpMaxFromLevel(newData, srd, data.hpMax, rawStats);
      const newHpCur = Math.min(data.hpCur || newHpMax, newHpMax);
      newData = { ...newData, hpMax: newHpMax, hpCur: newHpCur };
    }

    setData(newData);
    if (!externalData) {
      localStorage.setItem('tome_data', JSON.stringify(newData));
    }
    if (onUpdate) onUpdate(newData);
    socket.emit('sync_character_data', newData);
  };

  // ★ Handle local avatar file upload
  const handleAvatarFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      update('avatarUrl', evt.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Keep the URL prompt as a fallback (clicking the avatar still asks for URL)
  const handleAvatarClick = () => {
    // Trigger the hidden file input instead of the prompt
    avatarInputRef.current?.click();
  };

  // ★ EXPORT: Download current sheet as JSON
  const handleExport = () => {
    const exportData = {
      ...data,
      ac: liveAC,
      hpMax: liveMaxHP,
      speed: baseSpeed,
      initiativeBonus: initiativeBonus,
      _exportVersion: '1.0',
      _exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name || 'character'}_tome.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ★ IMPORT: Validate and load JSON file
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        // Basic validation: must have critical fields
        if (!imported.name || !imported.race || !imported.charClass) {
          alert('Invalid character file: Missing name, race, or class.');
          return;
        }
        // ★ Use functional update to avoid stale closure
        setData(prev => {
          const merged = { ...prev, ...imported };
          localStorage.setItem('tome_data', JSON.stringify(merged));
          return merged;
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert('Character imported successfully!');
      } catch (err) {
        alert('Failed to parse JSON file.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // Automated rest handlers linking hit dice and HP together
  const handleShortRest = () => {
    const currentHp = data.hpCur || 0;
    const maxHp = liveMaxHP;
    const totalHD = data.lvl || 1;
    const spentHD = data.hitDiceSpent || 0;
    const remainingHD = totalHD - spentHD;
    const conVal = rawStats.con || 10;
    const conMod = Math.floor((conVal - 10) / 2);
    const charClass = data.charClass ? srd.classes[data.charClass] : null;
    const hitDie = charClass ? charClass.hit_die : 8;

    if (currentHp >= maxHp) {
      if (window.confirm('Take a Short Rest? (Your HP is already full, so no Hit Dice will be spent)')) {
        socket.emit('take_rest', { tokenId: getOrGenerateUserId(), type: 'short' });
      }
      return;
    }

    if (remainingHD <= 0) {
      if (window.confirm('Take a Short Rest? (You have no Hit Dice remaining to spend for healing)')) {
        socket.emit('take_rest', { tokenId: getOrGenerateUserId(), type: 'short' });
      }
      return;
    }

    const promptMsg = `Spend Hit Dice to heal? Remaining: ${remainingHD}/${totalHD} (d${hitDie}). Enter number of Hit Dice to spend (CON mod per die: ${conMod >= 0 ? '+' : ''}${conMod}):`;
    const input = window.prompt(promptMsg, "1");
    if (input === null) return; // User cancelled

    const countToSpend = Math.min(remainingHD, Math.max(0, parseInt(input) || 0));
    if (countToSpend === 0) {
      socket.emit('take_rest', { tokenId: getOrGenerateUserId(), type: 'short' });
      return;
    }

    // Roll Hit Dice
    let hpGained = 0;
    const rolls = [];
    for (let i = 0; i < countToSpend; i++) {
      const roll = Math.floor(Math.random() * hitDie) + 1;
      const total = Math.max(1, roll + conMod); // At least 1 HP recovered per hit die spent
      rolls.push(total);
      hpGained += total;
    }

    const newHpCur = Math.min(maxHp, currentHp + hpGained);
    const newHitDiceSpent = spentHD + countToSpend;

    const updatedData = {
      ...data,
      hpCur: newHpCur,
      hitDiceSpent: newHitDiceSpent,
      timesDowned: 0
    };

    setData(updatedData);
    localStorage.setItem('tome_data', JSON.stringify(updatedData));
    socket.emit('sync_character_data', updatedData);

    // Apply healing to matching token HP
    socket.emit('update_token_hp', {
      tokenId: getOrGenerateUserId(),
      amount: hpGained,
      isHeal: true,
      senderName: 'Short Rest'
    });

    const entryMsg = `${data.name || 'Player'} takes a Short Rest, expends ${countToSpend} Hit Dice, and rolls ${rolls.join(' + ')} recovering ${hpGained} HP (${currentHp} → ${newHpCur}).`;
    socket.emit('chat_message', `[System] ${entryMsg}`);

    // Notify server to clear statuses
    socket.emit('take_rest', { tokenId: getOrGenerateUserId(), type: 'short' });
  };

  const handleLongRest = () => {
    const spentHD = data.hitDiceSpent || 0;
    const totalHD = data.lvl || 1;

    if (window.confirm('Take a Long Rest? This recovers all HP, resets death saves, and recovers up to half of your maximum Hit Dice.')) {
      const regainAmount = Math.max(1, Math.floor(totalHD / 2));
      const newHitDiceSpent = Math.max(0, spentHD - regainAmount);
      const regainedCount = spentHD - newHitDiceSpent;

      const updatedData = {
        ...data,
        hpCur: liveMaxHP,
        hitDiceSpent: newHitDiceSpent,
        timesDowned: 0,
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        isStable: false,
        isDead: false
      };

      setData(updatedData);
      localStorage.setItem('tome_data', JSON.stringify(updatedData));
      socket.emit('sync_character_data', updatedData);

      const entryMsg = `${data.name || 'Player'} takes a Long Rest, recovering to full HP (${liveMaxHP}) and regaining ${regainedCount} spent Hit Dice.`;
      socket.emit('chat_message', `[System] ${entryMsg}`);

      // Server handles setting the token HP to full, resetting stables/saves/downs
      socket.emit('take_rest', { tokenId: getOrGenerateUserId(), type: 'long' });
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide text-textLight">
      
      {/* ==========================================
         TAB SELECTION: STATS (MAIN DASHBOARD)
         ========================================== */}
      {tab === 'stats' && (
        <div className="grid grid-cols-3 gap-0 h-full">
          
          {/* COLUMN 1: IDENTITY, ATTRIBUTES & SENSES (TIGHTENED TO 5PX GAPS) */}
          <div className="pr-5 border-r border-borderDark/35 flex flex-col gap-[5px] h-full overflow-y-auto scrollbar-hide">
            <h3 className="text-accentGold text-[10px] font-bold uppercase tracking-widest border-b border-borderDark/40 pb-1.5 mb-1">Identity & Senses</h3>
            
            {/* Symmetrical Identity Details Card */}
            <div className="bg-bgPanel p-4 rounded-xl border border-borderDark shadow-sm">
              <div className="grid grid-cols-3 gap-4">
                
                {/* Left Portrait & Control Frame */}
                <div className="col-span-1 flex flex-col gap-3">
                  
                  {/* Portrait Avatar Frame */}
                  <div 
                    className="w-full aspect-[4/5] rounded-lg border border-borderDark bg-bgCard cursor-pointer overflow-hidden hover:border-accentGold transition-colors flex items-center justify-center relative group"
                    onClick={handleAvatarClick}
                    title="Click to upload an image"
                  >
                    {data.avatarUrl ? (
                      <img src={data.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-9 h-9 text-borderDark" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[7.5px] font-bold text-textLight uppercase tracking-widest">Upload</span>
                    </div>
                    <input 
                      type="file"
                      accept="image/*"
                      ref={avatarInputRef}
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                  </div>

                  {/* Vertically Stacked Action Buttons */}
                  <div className="flex flex-col gap-2 mt-1 shrink-0">
                    {/* Import Button */}
                    <label className="w-full border border-borderDark bg-bgCard text-textLight text-center text-[10px] font-bold py-2 rounded-lg hover:border-accentGold hover:text-accentGold transition-all uppercase tracking-widest cursor-pointer leading-none flex items-center justify-center h-9 shadow-sm">
                      Import
                      <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
                    </label>
                    
                    {/* Export Button */}
                    <button 
                      onClick={handleExport} 
                      className="w-full border border-borderDark bg-bgCard text-textLight text-center text-[10px] font-bold py-2 rounded-lg hover:border-accentGold hover:text-accentGold transition-all uppercase tracking-widest leading-none h-9 shadow-sm"
                    >
                      Export
                    </button>
                  </div>
                </div>

                {/* Symmetrical Details Grid */}
                <div className="col-span-2 flex flex-col justify-between">
                  
                  {/* Character Name Header Input */}
                  <div className="border-b border-borderDark pb-1 mb-2">
                    <input 
                      className="bg-transparent w-full text-2xl font-bold text-accentGold outline-none placeholder-accentGold placeholder-opacity-40" 
                      placeholder="Character Name" 
                      value={data.name || ''} 
                      onChange={e => update('name', e.target.value)} 
                    />
                  </div>
                
                  {/* Symmetrical Fields Grid (4 Rows x 2 Columns) */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    
                    {/* ROW 1: Race & Subrace Dropdowns */}
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">Race</label>
                      <select 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none h-9" 
                        value={data.race || ''} 
                        onChange={e => { 
                          const d = { ...data, race: e.target.value, subrace: '' }; 
                          setData(d); 
                          localStorage.setItem('tome_data', JSON.stringify(d)); 
                        }}
                      >
                        <option value="">Select...</option>
                        {Object.keys(srd.races || {}).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">Subrace</label>
                      <select 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none disabled:opacity-50 h-9" 
                        value={data.subrace || ''} 
                        onChange={e => update('subrace', e.target.value)} 
                        disabled={!data.race || !srd.races[data.race]?.subraces}
                      >
                        <option value="">None</option>
                        {data.race && srd.races[data.race]?.subraces && Object.keys(srd.races[data.race].subraces).map(sr => <option key={sr} value={sr}>{sr}</option>)}
                      </select>
                    </div>

                    {/* ROW 2: Class & Background Dropdowns */}
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">Class</label>
                      <select 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none h-9" 
                        value={data.charClass || ''} 
                        onChange={e => { const d = { ...data, charClass: e.target.value, subclass: '' }; setData(d); localStorage.setItem('tome_data', JSON.stringify(d)); }}
                      >
                        <option value="">Select...</option>
                        {Object.keys(srd.classes || {}).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">Background</label>
                      <select 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none h-9" 
                        value={data.bg || ''} 
                        onChange={e => update('bg', e.target.value)}
                      >
                        <option value="">Select...</option>
                        {Object.keys(srd.backgrounds || {}).map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>

                    {/* ROW 3: Subclass & Alignment Dropdowns */}
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">Subclass</label>
                      <select 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none disabled:opacity-50 h-9" 
                        value={data.subclass || ''} 
                        onChange={e => update('subclass', e.target.value)} 
                        disabled={!data.charClass || !srd.classes[data.charClass]?.subclasses}
                      >
                        <option value="">None</option>
                        {data.charClass && srd.classes[data.charClass]?.subclasses && Object.keys(srd.classes[data.charClass].subclasses).map(sc => <option key={sc} value={sc}>{sc}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">Alignment</label>
                      <select 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none h-9" 
                        value={data.alignment || ''} 
                        onChange={e => update('alignment', e.target.value)}
                      >
                        <option value="">Select...</option>
                        {srd.alignments && srd.alignments.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>

                    {/* ROW 4: Level & Experience Point Inputs */}
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">Level</label>
                      <input 
                        type="number" 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none h-9 text-left px-3" 
                        value={data.lvl || 1} 
                        onChange={e => handleLevelChange(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="text-[8px] uppercase text-accentGold mb-1 block font-semibold leading-none">XP</label>
                      <input 
                        type="number" 
                        className="bg-bgCard w-full p-2 rounded text-xs text-textLight border border-borderDark focus:border-accentGold outline-none h-9 text-left px-3" 
                        value={data.xp || 0} 
                        onChange={e => handleXpChange(e.target.value)} 
                      />
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Core Attributes Panel (Passed both rawStats & recommended liveStats) */}
            <CollapsibleSection title="Core Attributes" defaultOpen={true}>
              <StatCard data={data} rawStats={rawStats} liveStats={liveStats} update={update} />
            </CollapsibleSection>

            {/* Saving Throws Panel */}
            <CollapsibleSection title="Saving Throws" defaultOpen={true}>
              <SavingThrowsCard data={data} stats={rawStats} profBonus={profBonus} update={update} />
            </CollapsibleSection>

            {/* Passive Senses Panel (Evaluated from rawStats) */}
            <CollapsibleSection title="Passive Senses" defaultOpen={true}>
              <SensesCard data={data} liveStats={rawStats} profBonus={profBonus} />
            </CollapsibleSection>
          </div>

          {/* COLUMN 2: SKILLS LISTING (TIGHTENED TO 5PX GAPS) */}
          <div className="px-5 border-r border-borderDark/35 flex flex-col gap-[5px] h-full overflow-y-auto scrollbar-hide">
            <SkillsCard data={data} update={update} liveStats={rawStats} profBonus={profBonus} />
          </div>

          {/* COLUMN 3: COMBAT & HEALTH STATS (TIGHTENED TO 5PX GAPS) */}
          <div className="pl-5 flex flex-col gap-[5px] h-full overflow-y-auto scrollbar-hide">
            <h3 className="text-accentGold text-[10px] font-bold uppercase tracking-widest border-b border-borderDark/40 pb-1.5 mb-1">Combat & Vitality</h3>
            
            {/* Vitality details */}
            <CollapsibleSection title="Vitality & Gear" defaultOpen={true}>
              <CombatCard 
                data={data} 
                update={update} 
                liveAC={liveAC} 
                liveMaxHP={liveMaxHP} 
                srd={srd} 
                baseSpeed={baseSpeed} 
                initiativeBonus={initiativeBonus} 
              />
            </CollapsibleSection>

            {/* Wounds & Death Saves Tracker block */}
            <CollapsibleSection title="Wounds & Debuffs" defaultOpen={true}>
              <div className="bg-bgPanel p-4 rounded-xl border border-borderDark flex flex-col gap-2.5 shadow-sm text-xs">
                
                <div className="flex justify-between items-center">
                  <span className="text-textLight font-semibold text-[11px]">Times Downed:</span>
                  <span className="text-accentGold font-bold text-xs bg-bgCard px-1.5 py-0.5 rounded border border-borderDark">
                    {data.timesDowned || 0}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <button onClick={handleShortRest} className="bg-bgCard text-textLight py-1 px-2 rounded border border-borderDark hover:border-accentGold hover:text-accentGold transition-colors uppercase tracking-wider text-[8px] font-bold">Short Rest</button>
                  <button onClick={handleLongRest} className="bg-bgCard text-textLight py-1 px-2 rounded border border-borderDark hover:border-accentGold hover:text-accentGold transition-colors uppercase tracking-wider text-[8px] font-bold">Long Rest</button>
                </div>

                <div className="flex justify-between items-center mt-1.5 border-t border-borderDark pt-2.5">
                  <div className="flex items-center gap-1.5 text-textLight font-bold text-[11px]">
                      ☠️ Death Saves
                  </div>
                  <div className="flex gap-3">
                    <div className="flex gap-1">
                      <span className="text-textMuted text-[8px] uppercase font-bold mr-0.5 flex items-center">S:</span>
                      {[1, 2, 3].map(i => (
                        <div key={'s' + i} className={`w-3 h-3 rounded border transition-all duration-200 ${(data.deathSaveSuccesses || 0) >= i ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-bgPanel border-borderDark'}`} />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <span className="text-textMuted text-[8px] uppercase font-bold mr-0.5 flex items-center">F:</span>
                      {[1, 2, 3].map(i => (
                        <div key={'f' + i} className={`w-3 h-3 rounded border transition-all duration-200 ${(data.deathSaveFailures || 0) >= i ? 'bg-red-600 border-red-500 shadow-[0_0_8px_rgba(220,38,38,0.5)]' : 'bg-bgPanel border-borderDark'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {data.isStable && <div className="text-green-400 font-bold bg-green-950/20 px-1.5 py-0.5 rounded text-center border border-green-500/10 text-[10px]">💖 Character is Stable</div>}
                {data.isDead && <div className="text-red-500 font-bold bg-red-950/20 px-1.5 py-0.5 rounded text-center border border-red-500/10 text-[10px]">💀 Character is Dead</div>}

                <div className="border-t border-borderDark pt-2">
                  <span className="text-accentGold uppercase tracking-wider text-[8px] font-bold mb-1 block">Active Wounds</span>
                  {data.wounds && data.wounds.length > 0 ? (
                    <ul className="space-y-1 max-h-16 overflow-y-auto pr-0.5">
                      {data.wounds.map((w, idx) => (
                        <li key={idx} className="bg-bgCard p-1.5 rounded border border-borderDark text-[9px] text-textMuted flex flex-col leading-tight">
                          <span className="text-textLight font-medium">{w.description}</span>
                          <span className="text-[7px] opacity-60">Applied: {new Date(w.timestamp).toLocaleTimeString()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-textMuted text-[9px] italic">No active wounds or lingering effects.</p>
                  )}
                </div>

                {/* DM Wound Clearing */}
                {role === 'DM' && (
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all wounds and status debuffs for this character?')) {
                        const clearedData = { 
                          ...data, 
                          wounds: [], 
                          debuffs: {}, 
                          timesDowned: 0, 
                          deathSaveSuccesses: 0, 
                          deathSaveFailures: 0, 
                          isStable: false, 
                          isDead: false 
                        };
                        setData(clearedData);
                        if (!externalData) {
                          localStorage.setItem('tome_data', JSON.stringify(clearedData));
                        }
                        if (onUpdate) onUpdate(clearedData);
                        socket.emit('sync_character_data', clearedData);
                      }
                    }}
                    className="mt-0.5 text-red-400 text-[9px] hover:text-red-300 font-semibold self-start hover:underline bg-transparent border-0 cursor-pointer p-0"
                  >
                    Clear All Wounds (DM)
                  </button>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </div>
      )}
      
      {/* ==========================================
         TAB SELECTION: AUXILIARY PANELS (Evaluated from rawStats)
         ========================================== */}
      {tab === 'skills' && <SkillsCard data={data} update={update} liveStats={rawStats} profBonus={profBonus} />}
      {tab === 'senses' && <SensesCard data={data} liveStats={rawStats} profBonus={profBonus} update={update} />}
      {tab === 'actions' && <ActionsCard data={data} update={update} />}

      {/* SECTION: Gear Tab */}
      {tab === 'gear' && (
        /* ★ OVERHAULED: Unified Redirect Bridge Panel launching full-screen Pop-out modal */
        <div className="bg-bgCard p-6 rounded-xl border border-accentGold/40 text-center flex flex-col items-center justify-center py-16 space-y-4">
          <span className="text-5xl animate-bounce">🎒</span>
          <h3 className="text-accentGold font-bold text-sm uppercase tracking-widest">
            Equipment & Companion Hub
          </h3>
          <p className="text-xs text-textMuted max-w-sm">
            Your inventory, gold coins, armor configurations, and beast companion stat sheets have been moved to the direct Pop-out Equipment Hub.
          </p>
          <button
            onClick={() => {
              // Fire global bridge event caught by App.jsx
              window.dispatchEvent(new Event('open-gear-hub'));
            }}
            className="bg-accentGold text-black font-extrabold text-xs px-6 py-2.5 rounded-lg hover:bg-yellow-500 transition-colors"
          >
            Open Inventory Hub
          </button>
        </div>
      )}
      {tab === 'features' && <FeaturesCard data={data} />}
      {tab === 'feats' && <FeatsCard data={data} update={update} />}
      {tab === 'spells' && <SpellsCard data={data} update={update} />}
      {tab === 'appearance' && <AppearanceCard data={data} update={update} />}
      {tab === 'journal' && <JournalCard data={data} update={update} />}

      {levelUpData && (
        <LevelUpModal
          characterData={data}
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          onClose={() => setLevelUpData(null)}
          onUpdate={handleLevelUpUpdate}
        />
      )}
    </div>
  );
}