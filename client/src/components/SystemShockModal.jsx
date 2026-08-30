// client/src/components/SystemShockModal.jsx
import { useState, useEffect } from 'react';
import { socket } from '../socket';
import soundSynthesizer from '../utils/SoundSynthesizer';
import { getAbilityModifier, calculateLiveStats } from '../utils/CharacterEngine';

export default function SystemShockModal({
  tokenId,
  tokenName,
  isMassive,
  isCritical,
  damage,
  maxHp,
  hpCur, // Prop to track current HP after the initial trigger damage
  hasCharacterSheet,
  type, // 'massive', 'critical', 'excessive'
  excessiveDc, // only for excessive
  onClose,
}) {
  const [step, setStep] = useState('con_save'); // 'con_save', 'd10_roll', 'result'
  const [conSaveResult, setConSaveResult] = useState(null);
  const [conSaveBonus, setConSaveBonus] = useState(0);
  const [d10Result, setD10Result] = useState(null);
  const [effectDescription, setEffectDescription] = useState('');
  const [charData, setCharData] = useState(null);
  const [manualRoll, setManualRoll] = useState('');

  // Load character data if player
  useEffect(() => {
    if (hasCharacterSheet) {
      try {
        const data = JSON.parse(localStorage.getItem('tome_data') || '{}');
        setCharData(data);
        const stats = calculateLiveStats(data);
        const conMod = getAbilityModifier(stats.con || 10);
        setConSaveBonus(conMod);
      } catch (e) {
        console.warn('Could not load character data for system shock:', e);
      }
    }
  }, [hasCharacterSheet]);

  const handleConSave = (roll) => {
    const dc = type === 'excessive' ? (excessiveDc || 15) : 15;
    const total = roll + conSaveBonus;
    const success = total >= dc;

    setConSaveResult({ roll, bonus: conSaveBonus, total, success });

    if (type === 'excessive') {
      // Skip d10 roll
      determineExcessiveEffect(success, total);
      setStep('result');
    } else {
      if (success) {
        // Successful save for massive/critical damage - skip d10 and do not apply a wound
        const description = `${tokenName} successfully withstood the system shock! No adverse effects suffered.`;
        setEffectDescription(description);
        
        // Log to chat for everyone
        socket.emit('chat_message', `[System] ${tokenName} successfully withstood the system shock (DC 15 CON save total: ${total})!`);
        
        setStep('result');
      } else {
        // Failed save - must roll the d10 to determine the negative effect
        setStep('d10_roll');
        // Auto roll d10 after a short delay
        setTimeout(() => handleD10Roll(), 800);
      }
    }
  };

  const handleD10Roll = () => {
    const roll = Math.floor(Math.random() * 10) + 1;
    setD10Result(roll);
    determineEffect(roll);
    setStep('result');
  };

  const determineExcessiveEffect = (success, total) => {
    let description = '';
    let woundsToAdd = 0;
    let debuff = {};
    if (success) {
      description = 'The creature withstands the excessive damage! No wound suffered.';
      woundsToAdd = 0;
    } else {
      description = 'The creature suffers a wound from excessive damage!';
      woundsToAdd = 1;
    }
    setEffectDescription(description);

    if (success) {
      socket.emit('chat_message', `[System] ${tokenName} successfully withstood the excessive damage (DC ${excessiveDc || 15} CON save total: ${total})!`);
    } else {
      if (hasCharacterSheet && charData) {
        applyWoundToPlayer(charData, woundsToAdd, debuff, description, false);
      } else {
        applyWoundToNPC(tokenId, woundsToAdd, debuff, description, false);
      }
    }
  };

  const determineEffect = (roll) => {
    let description = '';
    let woundsToAdd = 0;
    let debuff = {};
    let forceDropToZero = false;
    let makeStable = false;

    if (isCritical) {
      // Critical Damage table
      if (roll <= 3) {
        const permEffects = [
          'Large & ugly Facial Scar',
          'Wounded Leg! Permanent -5 to movement',
          'Wounded Arm! Disadvantage on athletic checks',
          'Wounded Torso! -1 to Strength',
          'Wounded Eye! Disadvantage on perception',
          'Wounded Organ! -1 to Constitution',
        ];
        const idx = Math.floor(Math.random() * permEffects.length);
        description = `Permanent damage! ${permEffects[idx]}`;
        woundsToAdd = 1;
        // For permanent stat reduction, we'll log it and let the DM/player adjust manually.
        // We could add a note to the character sheet but for now we just add a wound with description.
      } else if (roll <= 5) {
        description =
          'The creature drops to 0 hit points. Only a single heal of 11 or more HP or Heal Check DC20 (with healer\'s kit) will stabilize them. The first 10 HP healed are truncated.';
        woundsToAdd = 1;
        forceDropToZero = true;
      } else if (roll <= 7) {
        description = 'The creature drops to 0 hit points but is stable.';
        woundsToAdd = 1;
        forceDropToZero = true;
        makeStable = true;
      } else if (roll === 8) {
        description = 'The creature is stunned until the end of its next turn.';
        debuff.stunned = true;
        woundsToAdd = 1;
      } else if (roll === 9) {
        description =
          'The creature can’t take reactions and has disadvantage on attack rolls and ability checks until the end of its next turn.';
        debuff.noReactions = true;
        debuff.disadvantageOnAttacks = true;
        debuff.disadvantageOnSkills = true;
        woundsToAdd = 1;
      } else if (roll === 10) {
        description = 'The creature can’t take reactions until the end of its next turn.';
        debuff.noReactions = true;
        woundsToAdd = 1;
      }
    } else {
      // Massive Damage table
      if (roll === 1) {
        description = 'The creature drops to 0 hit points.';
        woundsToAdd = 1;
        forceDropToZero = true;
      } else if (roll <= 3) {
        description = 'The creature drops to 0 hit points but is stable.';
        woundsToAdd = 1;
        forceDropToZero = true;
        makeStable = true;
      } else if (roll <= 5) {
        description = 'The creature is stunned until the end of its next turn.';
        debuff.stunned = true;
        woundsToAdd = 1;
      } else if (roll <= 7) {
        description =
          'The creature can’t take reactions and has disadvantage on attack rolls and ability checks until the end of its next turn.';
        debuff.noReactions = true;
        debuff.disadvantageOnAttacks = true;
        debuff.disadvantageOnSkills = true;
        woundsToAdd = 1;
      } else if (roll <= 10) {
        description = 'The creature can’t take reactions until the end of its next turn.';
        debuff.noReactions = true;
        woundsToAdd = 1;
      }
    }

    setEffectDescription(description);

    // Apply remaining HP as damage to drop the entity to 0 HP
    if (forceDropToZero) {
      const remainingHp = hpCur !== undefined ? hpCur : (hasCharacterSheet && charData ? (charData.hpCur || 0) : 0);
      if (remainingHp > 0) {
        socket.emit('update_token_hp', {
          tokenId,
          amount: remainingHp,
          isHeal: false,
          senderName: 'System Shock Wound'
        });
      }
    }

    // Apply to player or NPC
    if (hasCharacterSheet && charData) {
      applyWoundToPlayer(charData, woundsToAdd, debuff, description, makeStable);
    } else {
      applyWoundToNPC(tokenId, woundsToAdd, debuff, description, makeStable);
    }
  };

  const applyWoundToPlayer = (data, woundsToAdd, debuff, description, makeStable) => {
    // Update wounds array
    const newWounds = [...(data.wounds || [])];
    for (let i = 0; i < woundsToAdd; i++) {
      newWounds.push({
        type: isCritical ? 'critical' : 'massive',
        timestamp: Date.now(),
        description,
        permanent: false,
      });
    }
    // Update debuffs
    const newDebuffs = { ...(data.debuffs || {}), ...debuff };
    const updatedData = {
      ...data,
      wounds: newWounds,
      debuffs: newDebuffs,
    };

    if (makeStable) {
      updatedData.isStable = true;
      updatedData.deathSaveSuccesses = 0;
      updatedData.deathSaveFailures = 0;
    }

    // Save locally
    localStorage.setItem('tome_data', JSON.stringify(updatedData));
    // Sync to server
    socket.emit('sync_character_data', updatedData);
    
    // Only announce wound suffering if one was actually added
    if (woundsToAdd > 0) {
      socket.emit('chat_message', `[System] ${tokenName} suffers a wound! ${description}`);
    }
  };

  const applyWoundToNPC = (tokenId, woundsToAdd, debuff, description, makeStable) => {
    let msg = `${tokenName} suffers from massive damage! ${description}`;
    if (debuff.stunned) {
      socket.emit('toggle_condition', { tokenId, condition: 'Stunned' });
      msg += ' (Stunned)';
    }
    if (debuff.noReactions) {
      // We can add a custom condition or just note it in chat
      // We'll add a "No Reactions" condition if we extend the system, for now just chat.
      msg += ' (Cannot take reactions)';
    }
    if (makeStable) {
      msg += ' (Stabilized)';
    }
    socket.emit('chat_message', `[System] ${msg}`);
  };

  const handleManualSubmit = () => {
    const val = parseInt(manualRoll);
    if (!isNaN(val) && val >= 1 && val <= 20) {
      soundSynthesizer.playUIClick();
      handleConSave(val);
      setManualRoll('');
    } else {
      alert('Enter a number between 1 and 20.');
    }
  };

  if (step === 'con_save') {
    return (
      <div className="fixed inset-0 z-[2000] bg-black bg-opacity-70 flex items-center justify-center p-4">
        <div className="bg-bgPanel border border-accentGold rounded-xl p-6 max-w-md w-full shadow-2xl">
          <h2 className="text-accentGold font-bold text-lg mb-2">⚠️ System Shock</h2>
          <p className="text-textLight text-sm mb-1">
            {tokenName} took <span className="text-red-400 font-bold">{damage}</span> damage
            {isCritical ? ' (Critical!)' : ' (Massive!)'} from a single source.
          </p>
          <p className="text-textMuted text-xs mb-4">
            {type === 'excessive'
              ? `Excessive Damage (3rd+ down since last rest)! DC ${excessiveDc || 15} Constitution saving throw required.`
              : `Max HP: ${maxHp} | DC 15 Constitution saving throw required.`
            }
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              className="flex-1 bg-accentGold text-black font-bold py-2 rounded text-sm hover:bg-yellow-500 transition-colors"
              onClick={() => {
                soundSynthesizer.playDiceRoll();
                const roll = Math.floor(Math.random() * 20) + 1;
                handleConSave(roll);
              }}
            >
              🎲 Roll d20 + {conSaveBonus >= 0 ? '+' : ''}{conSaveBonus}
            </button>
            <div className="flex-1 flex gap-1">
              <input
                type="number"
                min="1"
                max="20"
                value={manualRoll}
                onChange={(e) => setManualRoll(e.target.value)}
                placeholder="Manual"
                className="w-16 bg-bgCard text-white border border-borderDark rounded p-1 text-center text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualSubmit();
                }}
              />
              <button
                className="bg-borderDark text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                onClick={handleManualSubmit}
              >
                Submit
              </button>
            </div>
          </div>
          <button
            className="mt-4 w-full text-textMuted text-xs underline"
            onClick={onClose}
          >
            Skip (DM discretion)
          </button>
        </div>
      </div>
    );
  }

  if (step === 'd10_roll') {
    return (
      <div className="fixed inset-0 z-[2000] bg-black bg-opacity-70 flex items-center justify-center p-4">
        <div className="bg-bgPanel border border-accentGold rounded-xl p-6 max-w-md w-full shadow-2xl text-center">
          <h2 className="text-accentGold font-bold text-lg mb-2">Rolling System Shock...</h2>
          <p className="text-textLight text-sm">CON Save: {conSaveResult?.total} ({conSaveResult?.success ? '✅ Success' : '❌ Failure'})</p>
          <div className="mt-4 text-4xl font-bold text-accentGold animate-pulse">🎲</div>
          <p className="text-textMuted text-xs mt-4">Rolling d10...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-70 flex items-center justify-center p-4">
      <div className="bg-bgPanel border border-accentGold rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-accentGold font-bold text-lg mb-2">System Shock Result</h2>
        {type !== 'excessive' && d10Result !== null && (
          <p className="text-textLight text-sm mb-1">d10: <span className="font-bold text-accentGold">{d10Result}</span></p>
        )}
        <p className="text-textLight text-sm">{effectDescription}</p>
        <p className="text-textMuted text-xs mt-2">
          {hasCharacterSheet
            ? type === 'excessive'
              ? (conSaveResult?.success ? 'No wound applied.' : 'Wound applied to your character sheet.')
              : (conSaveResult?.success ? 'No wound applied.' : 'Wound applied to your character sheet. Check the Wounds & Debuffs section.')
            : 'Chat notification sent to the DM.'}
        </p>
        <button
          className="mt-4 w-full bg-accentGold text-black font-bold py-2 rounded text-sm hover:bg-yellow-500 transition-colors"
          onClick={onClose}
        >
          Continue
        </button>
      </div>
    </div>
  );
}