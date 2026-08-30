// client/src/components/character/ActionsCard.jsx
import { useState, useMemo } from 'react';
import srd from '../../data/srd_data.json';
import { socket } from '../../socket';
import { 
  getSpellcastingDetails, 
  getSpellSlots, 
  getProficiencyBonus, 
  getAbilityModifier,
  calculateLiveStats 
} from '../../utils/CharacterEngine';

export default function ActionsCard({ data, update }) {
  // Compute live stats (incorporating racial and subracial bonuses)
  const liveStats = useMemo(() => calculateLiveStats(data), [data]);

  // Spellcasting details (now using live stats)
  const spellDetails = getSpellcastingDetails(data, srd, liveStats);
  const spellSlots = getSpellSlots(data, srd);

  // Character stats & proficiency
  const level = data.lvl || 1;
  const profBonus = getProficiencyBonus(level);
  
  // Now using liveStats instead of raw data stats
  const strMod = getAbilityModifier(liveStats.str || 10);
  const dexMod = getAbilityModifier(liveStats.dex || 10);

  // ---- All Equipped Weapons ----
  const equippedWeapons = useMemo(() => {
    const inventory = data.inventory || [];
    return inventory.filter(item => item.type === 'weapon' && item.equipped === true);
  }, [data.inventory]);

  // Dynamic modifier calculator per weapon based on properties
  const getWeaponAbilityMod = (weapon) => {
    const properties = (weapon.properties || []).map(p => p.toLowerCase());
    // Ranged weapons use DEX
    if (weapon.range || properties.includes('ranged') || properties.includes('thrown')) {
      return dexMod;
    }
    // Finesse – use the higher of STR or DEX
    if (properties.includes('finesse')) {
      return Math.max(strMod, dexMod);
    }
    // Default melee uses STR
    return strMod;
  };

  // Hit dice calculations
  const charClass = data.charClass ? srd.classes[data.charClass] : null;
  const hitDie = charClass ? charClass.hit_die : 8;
  const totalHitDice = parseInt(data.lvl) || 1;
  const hitDiceSpent = parseInt(data.hitDiceSpent || 0);
  const hitDiceRemaining = totalHitDice - hitDiceSpent;

  // Manual input states mapped by weapon ID
  const [manualAttackInputs, setManualAttackInputs] = useState({});
  const [manualDamageInputs, setManualDamageInputs] = useState({});

  const setAttackInput = (id, val) => {
    setManualAttackInputs(prev => ({ ...prev, [id]: val }));
  };

  const setDamageInput = (id, val) => {
    setManualDamageInputs(prev => ({ ...prev, [id]: val }));
  };

  // Helper: roll dice string (e.g., "1d8") and add modifier
  const rollDiceWithMod = (diceString, modifier) => {
    if (!diceString) return null;
    const match = diceString.match(/^(\d+)d(\d+)$/i);
    if (!match) return null;
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    let total = 0;
    let rolls = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }
    total += modifier;
    return { total, rolls, modifier, diceString };
  };

  // ---- Standard Virtual Dice Roll to Hit ----
  const handleRollWeaponAttack = (weapon) => {
    const rawRoll = Math.floor(Math.random() * 20) + 1;
    const abilityMod = getWeaponAbilityMod(weapon);
    const rarityBonus = parseInt(weapon.rarity) || 0;
    const attackBonus = abilityMod + profBonus + rarityBonus;
    const total = rawRoll + attackBonus;

    let critDisplay = "";
    if (rawRoll === 20) critDisplay = " — ✨ **CRITICAL HIT!**";
    if (rawRoll === 1) critDisplay = " — ⚠️ **CRITICAL FAIL!**";

    const msg = `${data.name || 'Player'} rolls a d20 to hit with ${weapon.name}: ${rawRoll} + ${attackBonus} = **${total}**${critDisplay}.`;
    socket.emit('chat_message', msg);
  };

  // ---- Manual Roll to Hit Submission ----
  const handleManualWeaponAttack = (weapon) => {
    const rawRoll = parseInt(manualAttackInputs[weapon.id], 10);
    if (!isNaN(rawRoll) && rawRoll >= 1 && rawRoll <= 20) {
      const abilityMod = getWeaponAbilityMod(weapon);
      const rarityBonus = parseInt(weapon.rarity) || 0;
      const attackBonus = abilityMod + profBonus + rarityBonus;
      const total = rawRoll + attackBonus;

      let critDisplay = "";
      if (rawRoll === 20) critDisplay = " — ✨ **CRITICAL HIT!**";
      if (rawRoll === 1) critDisplay = " — ⚠️ **CRITICAL FAIL!**";

      const msg = `${data.name || 'Player'} manually rolls a d20: ${rawRoll} + ${attackBonus} with ${weapon.name} = **${total}** to hit${critDisplay}.`;
      socket.emit('chat_message', msg);
      setAttackInput(weapon.id, '');
    } else {
      alert('Enter a valid d20 roll between 1 and 20.');
    }
  };

  // ---- Standard Virtual Dice Damage Roll ----
  const handleRollWeaponDamage = (weapon) => {
    if (!weapon || !weapon.damage) {
      socket.emit('chat_message', `${data.name || 'Player'} has no damage dice for ${weapon?.name || 'weapon'}.`);
      return;
    }

    const abilityMod = getWeaponAbilityMod(weapon);
    const rarityBonus = parseInt(weapon.rarity) || 0;
    const totalDamageMod = abilityMod + rarityBonus;

    // Roll base standard damage
    const baseResult = rollDiceWithMod(weapon.damage, totalDamageMod);
    if (!baseResult) return;

    let chatMessage = "";
    const rollsDisplay = baseResult.rolls.join(' + ');
    const modDisplay = totalDamageMod !== 0 ? (totalDamageMod > 0 ? ` + ${totalDamageMod}` : ` - ${-totalDamageMod}`) : '';
    const baseType = weapon.damage_type ? ` ${weapon.damage_type}` : '';
    
    let finalTotal = baseResult.total;

    chatMessage = `${data.name || 'Player'} rolls ${baseResult.diceString}${modDisplay} with ${weapon.name}: ${rollsDisplay}${modDisplay} = **${baseResult.total}**${baseType} damage`;

    // Roll automated magic weapon secondary damage (if present)
    if (weapon.magic_damage) {
      const magicResult = rollDiceWithMod(weapon.magic_damage, 0); // Flat magic dice do not get ability mod
      if (magicResult) {
        finalTotal += magicResult.total;
        const magicRolls = magicResult.rolls.join(' + ');
        const magicType = weapon.magic_damage_type ? ` ${weapon.magic_damage_type}` : ' magic';
        chatMessage += ` + rolls ${magicResult.diceString} for **${magicResult.total}** (${magicRolls})${magicType} damage (Total: **${finalTotal}** damage).`;
      }
    } else {
      chatMessage += `.`;
    }

    socket.emit('chat_message', chatMessage);
  };

  // ---- Manual Damage Submission ----
  const handleManualWeaponDamage = (weapon) => {
    const rawRoll = parseInt(manualDamageInputs[weapon.id], 10);
    if (!isNaN(rawRoll) && rawRoll >= 0) {
      const abilityMod = getWeaponAbilityMod(weapon);
      const rarityBonus = parseInt(weapon.rarity) || 0;
      const totalDamageMod = abilityMod + rarityBonus;
      const total = rawRoll + totalDamageMod;

      const modDisplay = totalDamageMod !== 0 ? (totalDamageMod > 0 ? ` + ${totalDamageMod}` : ` - ${-totalDamageMod}`) : '';
      const baseType = weapon.damage_type ? ` ${weapon.damage_type}` : '';
      
      let finalTotal = total;
      let chatMessage = `${data.name || 'Player'} manually rolls ${rawRoll}${modDisplay} with ${weapon.name} = **${total}**${baseType} damage`;

      // Keep magic calculations consistent inside manual damage rolls
      if (weapon.magic_damage) {
        const magicResult = rollDiceWithMod(weapon.magic_damage, 0);
        if (magicResult) {
          finalTotal += magicResult.total;
          const magicType = weapon.magic_damage_type ? ` ${weapon.magic_damage_type}` : ' magic';
          chatMessage += ` + auto-rolls ${magicResult.diceString} for **${magicResult.total}**${magicType} damage (Total: **${finalTotal}** damage).`;
        }
      } else {
        chatMessage += `.`;
      }

      socket.emit('chat_message', chatMessage);
      setDamageInput(weapon.id, '');
    } else {
      alert('Enter a valid non‑negative number for the base die roll.');
    }
  };

  // Hit dice rolls
  const handleRollHitDie = () => {
    if (hitDiceRemaining <= 0) {
      socket.emit('chat_message', `${data.name || 'Player'} has no hit dice left.`);
      return;
    }
    const roll = Math.floor(Math.random() * hitDie) + 1;
    const msg = `${data.name || 'Player'} rolls a hit die (d${hitDie}) and recovers ${roll} HP.`;
    socket.emit('chat_message', msg);
    // Optionally: automatically apply the heal? We'll leave it as chat only to let the player adjust HP manually.
  };

  const [manualHitDieRoll, setManualHitDieRoll] = useState('');
  const handleManualHitDie = () => {
    const val = parseInt(manualHitDieRoll, 10);
    if (!isNaN(val) && val >= 1 && val <= hitDie) {
      const msg = `${data.name || 'Player'} manually rolls a hit die (d${hitDie}) and recovers ${val} HP.`;
      socket.emit('chat_message', msg);
      setManualHitDieRoll('');
    } else {
      alert(`Enter a number between 1 and ${hitDie}.`);
    }
  };

  // ---- Action economy (unchanged) ----
  const actionAvailable = data.actionUsed !== true;
  const bonusActionAvailable = data.bonusActionUsed !== true;
  const reactionAvailable = data.reactionUsed !== true;

  // Helper: update a specific slot used state
  const toggleSlot = (level, index) => {
    const key = `slot_${level}_${index}`;
    update(key, !data[key]);
  };

  // Batch reset for a single spell level
  const resetLevelSlots = (level, total) => {
    const updates = {};
    for (let i = 0; i < total; i++) {
      updates[`slot_${level}_${i}`] = false;
    }
    update(updates); // single call with all keys
  };

  // Batch reset for all spell slots
  const resetAllSlots = () => {
    const updates = {};
    spellSlots.forEach(slot => {
      for (let i = 0; i < slot.total; i++) {
        updates[`slot_${slot.level}_${i}`] = false;
      }
    });
    update(updates); // single call
  };

  // Batch restore for all actions
  const restoreAllActions = () => {
    update({
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
    }); // single call
  };

  const spendHitDie = () => { if (hitDiceSpent < totalHitDice) update('hitDiceSpent', hitDiceSpent + 1); };
  const unspendHitDie = () => { if (hitDiceSpent > 0) update('hitDiceSpent', hitDiceSpent - 1); };
  const resetHitDice = () => update('hitDiceSpent', 0);

  // Determine if the character has spellcasting
  const isSpellcaster = !!spellDetails.ability;

  return (
    <div className="flex flex-col gap-4">
      {/* EQUIPPED WEAPONS LISTING SECTION */}
      <div className="bg-bgPanel p-4 rounded-xl border border-accentGold/40 space-y-3.5">
        <h3 className="text-accentGold font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
          ⚔️ Equipped Weapons
        </h3>
        
        {equippedWeapons.length > 0 ? (
          <div className="flex flex-col gap-3">
            {equippedWeapons.map((weapon) => {
              const abilityMod = getWeaponAbilityMod(weapon);
              const rarityBonus = parseInt(weapon.rarity) || 0;
              const attackBonus = abilityMod + profBonus + rarityBonus;
              const totalMod = abilityMod + rarityBonus;

              return (
                <div key={weapon.id} className="bg-bgCard p-3 rounded-lg border border-borderDark flex flex-col gap-2.5">
                  
                  {/* Top Block: Info (Left) + Roll Buttons Stack (Right) */}
                  <div className="flex justify-between items-stretch gap-3">
                    
                    {/* Left Column: Weapon Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-white font-extrabold text-sm truncate">{weapon.name}</p>
                      
                      <p className="text-[10px] text-textMuted leading-tight flex flex-wrap items-center gap-1.5">
                        <span>Base: <span className="text-accentGold font-bold font-mono">{weapon.damage || '?'}</span>{weapon.damage_type && ` ${weapon.damage_type}`}</span>
                        {totalMod !== 0 && (
                          <span className="text-white font-bold">
                            ({totalMod >= 0 ? `+${totalMod}` : totalMod})
                          </span>
                        )}
                      </p>
                      
                      {weapon.magic_damage && (
                        <span className="block text-green-400 font-bold text-[9px] leading-none mt-0.5">
                          Magic: {weapon.magic_damage} {weapon.magic_damage_type || 'magic'}
                        </span>
                      )}
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-textMuted pt-0.5">
                        <span>Attack Bonus: <span className="text-accentGold font-bold">+{attackBonus}</span></span>
                        {weapon.range && <span>Range: {weapon.range}</span>}
                      </div>
                    </div>

                    {/* Right Column: Stacked Roll Buttons */}
                    <div className="w-24 shrink-0 flex flex-col gap-1 justify-center">
                      <button
                        onClick={() => handleRollWeaponAttack(weapon)}
                        className="bg-bgPanel border border-accentGold/60 hover:bg-borderDark text-accentGold text-[9px] font-bold py-1 px-2 rounded transition-all uppercase tracking-wider text-center leading-tight h-7"
                      >
                        🎲 Attack
                      </button>
                      <button
                        onClick={() => handleRollWeaponDamage(weapon)}
                        className="bg-accentGold hover:bg-yellow-500 text-black text-[9px] font-extrabold py-1 px-2 rounded transition-all uppercase tracking-wider text-center leading-tight h-7"
                      >
                        🎲 Damage
                      </button>
                    </div>

                  </div>

                  {/* Bottom Block: Low-profile Manual Entry inputs */}
                  <div className="grid grid-cols-2 gap-2 border-t border-borderDark/40 pt-2 bg-bgPanel/30 p-1.5 rounded-lg">
                    {/* Manual Attack */}
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={manualAttackInputs[weapon.id] || ''}
                        onChange={e => setAttackInput(weapon.id, e.target.value)}
                        placeholder="d20 roll"
                        className="w-11 h-6 bg-bgPanel text-white text-center text-[9px] border border-borderDark rounded outline-none focus:border-accentGold font-mono"
                      />
                      <button
                        onClick={() => handleManualWeaponAttack(weapon)}
                        className="flex-1 h-6 bg-borderDark hover:bg-gray-700 text-textLight text-[8px] rounded font-bold transition-colors uppercase leading-none"
                      >
                        Attack
                      </button>
                    </div>

                    {/* Manual Damage */}
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        min="0"
                        value={manualDamageInputs[weapon.id] || ''}
                        onChange={e => setDamageInput(weapon.id, e.target.value)}
                        placeholder="Die roll"
                        className="w-14 h-7 bg-bgPanel text-white text-center text-[10px] border border-borderDark rounded outline-none focus:border-accentGold"
                      />
                      <button
                        onClick={() => handleManualWeaponDamage(weapon)}
                        className="flex-1 h-7 bg-borderDark hover:bg-gray-700 text-textLight text-[9px] rounded font-bold transition-colors uppercase leading-none"
                      >
                        Damage
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-textMuted italic p-2 bg-bgCard rounded border border-borderDark">
            No weapons currently equipped. Use the 🎒 Inventory Hub to equip one.
          </p>
        )}
      </div>

      {/* ---- SPELLCASTING ---- */}
      {isSpellcaster && (
        <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
          <h3 className="text-accentGold font-bold text-[10px] uppercase mb-3 tracking-widest">Spellcasting</h3>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="bg-bgCard p-2 rounded border border-borderDark">
              <span className="text-textMuted block">Ability</span>
              <span className="text-white font-bold">{spellDetails.ability}</span>
            </div>
            <div className="bg-bgCard p-2 rounded border border-borderDark">
              <span className="text-textMuted block">Save DC</span>
              <span className="text-white font-bold">{spellDetails.saveDC}</span>
            </div>
            <div className="bg-bgCard p-2 rounded border border-borderDark">
              <span className="text-textMuted block">Attack Bonus</span>
              <span className="text-white font-bold">+{spellDetails.attackBonus}</span>
            </div>
          </div>
        </div>
      )}

      {/* Spell Slots (always show section if spellcaster, even if slots are zero) */}
      {isSpellcaster && (
        <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Spell Slots</h3>
            <button onClick={resetAllSlots} className="text-[9px] bg-borderDark text-textMuted px-2 py-0.5 rounded hover:bg-gray-700">Reset All</button>
          </div>
          {spellSlots.length === 0 && <p className="text-[9px] text-textMuted italic">No spell slots at this level.</p>}
          {spellSlots.map(slot => {
            const checkboxes = [];
            for (let i = 0; i < slot.total; i++) {
              const isUsed = data[`slot_${slot.level}_${i}`] || false;
              checkboxes.push(
                <input key={i} type="checkbox" checked={!isUsed} onChange={() => toggleSlot(slot.level, i)} className="accent-accentGold w-4 h-4 cursor-pointer" />
              );
            }
            return (
              <div key={slot.level} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-textLight font-bold">Level {slot.level}</span>
                  <button onClick={() => resetLevelSlots(slot.level, slot.total)} className="text-[8px] text-textMuted hover:text-accentGold">Reset</button>
                </div>
                <div className="flex gap-2 bg-bgCard p-2 rounded border border-borderDark">{checkboxes}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- HIT DICE (CLARIFIED) ---- */}
      <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
        <h3 className="text-accentGold font-bold text-[10px] uppercase mb-3 tracking-widest flex items-center gap-2">
          ❤️ Hit Dice
          <span className="text-[8px] font-normal text-textMuted">(Spend on Short/Long Rest to heal)</span>
        </h3>
        <div className="bg-bgCard p-3 rounded border border-borderDark">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-white">
              d{hitDie} <span className="text-xs text-textMuted">(Total: {totalHitDice})</span>
            </span>
            <div className="flex items-center gap-2">
              <button onClick={unspendHitDie} disabled={hitDiceSpent <= 0} className="px-2 py-0.5 bg-borderDark text-white rounded text-xs hover:bg-gray-700 disabled:opacity-50">−</button>
              <span className="text-sm text-white font-bold">{hitDiceRemaining}/{totalHitDice}</span>
              <button onClick={spendHitDie} disabled={hitDiceSpent >= totalHitDice} className="px-2 py-0.5 bg-borderDark text-white rounded text-xs hover:bg-gray-700 disabled:opacity-50">+</button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between gap-2 mt-3">
            <button onClick={handleRollHitDie} disabled={hitDiceRemaining === 0} className="flex-1 bg-accentGold text-black text-[9px] font-bold py-1 rounded hover:bg-yellow-500 transition-colors disabled:opacity-50">🎲 Roll One</button>
            <div className="flex gap-1 flex-1">
              <input type="number" min="1" max={hitDie} value={manualHitDieRoll} onChange={e => setManualHitDieRoll(e.target.value)} placeholder={`1-${hitDie}`} className="w-16 bg-bgCard text-white text-center text-[9px] border border-borderDark rounded p-1" />
              <button onClick={handleManualHitDie} className="flex-1 bg-borderDark text-white text-[9px] py-1 rounded hover:bg-gray-700">Manual Roll</button>
            </div>
          </div>
          <button onClick={resetHitDice} className="mt-2 text-[9px] text-textMuted hover:text-accentGold">Reset Hit Dice</button>
        </div>
      </div>

      {/* Action Economy */}
      <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Actions</h3>
          <button onClick={restoreAllActions} className="text-[9px] bg-borderDark text-textMuted px-2 py-0.5 rounded hover:bg-gray-700">Restore All</button>
        </div>
        <div className="space-y-2">
          <label className="flex items-center justify-between bg-bgCard p-2 rounded border border-borderDark cursor-pointer">
            <span className="text-xs text-textLight">Action</span>
            <input type="checkbox" checked={actionAvailable} onChange={(e) => update('actionUsed', !e.target.checked)} className="accent-accentGold w-4 h-4" />
          </label>
          <label className="flex items-center justify-between bg-bgCard p-2 rounded border border-borderDark cursor-pointer">
            <span className="text-xs text-textLight">Bonus Action</span>
            <input type="checkbox" checked={bonusActionAvailable} onChange={(e) => update('bonusActionUsed', !e.target.checked)} className="accent-accentGold w-4 h-4" />
          </label>
          <label className="flex items-center justify-between bg-bgCard p-2 rounded border border-borderDark cursor-pointer">
            <span className="text-xs text-textLight">Reaction</span>
            <input type="checkbox" checked={reactionAvailable} onChange={(e) => update('reactionUsed', !e.target.checked)} className="accent-accentGold w-4 h-4" />
          </label>
        </div>
      </div>
    </div>
  );
}