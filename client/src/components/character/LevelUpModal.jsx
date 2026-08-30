// client/src/components/character/LevelUpModal.jsx
import { useState, useEffect } from 'react';
import srd from '../../data/srd_data.json';
import { getProficiencyBonus, getAbilityModifier, calculateLiveStats } from '../../utils/CharacterEngine';
import soundSynthesizer from '../../utils/SoundSynthesizer';

export default function LevelUpModal({ characterData, oldLevel, newLevel, onClose, onUpdate }) {
    const [hpMethod, setHpMethod] = useState('roll'); // 'roll', 'average', 'manual', 'skip'
    const [rolledHp, setRolledHp] = useState(null);
    const [manualHp, setManualHp] = useState('');
    const [isRolling, setIsRolling] = useState(false);

    // Get class data
    const charClass = characterData.charClass ? srd.classes[characterData.charClass] : null;
    const hitDie = charClass ? charClass.hit_die : 8;
    const conMod = getAbilityModifier(calculateLiveStats(characterData).con || 10);
    const averageGain = Math.floor(hitDie / 2) + 1 + conMod;
    
    // Check for Ability Score Increase (levels 4, 8, 12, 16, 19)
    const asiLevels = [4, 8, 12, 16, 19];
    const showASI = asiLevels.includes(newLevel) && !asiLevels.includes(oldLevel);
    
    // Determine new features gained between oldLevel and newLevel
    const newFeatures = [];
    if (charClass) {
        const classFeatures = charClass.features || [];
        classFeatures.forEach(f => {
            if (f.level > oldLevel && f.level <= newLevel) {
                newFeatures.push({ ...f, source: 'Class' });
            }
        });
        // Subclass features
        if (characterData.subclass && charClass.subclasses?.[characterData.subclass]) {
            const subclassFeatures = charClass.subclasses[characterData.subclass].features || [];
            subclassFeatures.forEach(f => {
                if (f.level > oldLevel && f.level <= newLevel) {
                    newFeatures.push({ ...f, source: 'Subclass' });
                }
            });
        }
    }
    
    // New spell slots (if spellcaster)
    let newSpellSlots = [];
    const spellcasting = charClass?.spellcasting;
    if (spellcasting && spellcasting.spell_slots_by_level) {
        const oldSlots = getSlotsAtLevel(oldLevel);
        const newSlots = getSlotsAtLevel(newLevel);
        for (let i = 1; i <= 9; i++) {
            const oldCount = oldSlots[i] || 0;
            const newCount = newSlots[i] || 0;
            if (newCount > oldCount) {
                newSpellSlots.push({ level: i, gained: newCount - oldCount });
            }
        }
    }
    
    // New cantrips known (if class grants them at this level)
    let newCantrips = 0;
    if (spellcasting && spellcasting.cantrips_known) {
        const oldCantrips = spellcasting.cantrips_known[oldLevel - 1] || 0;
        const newCantripsCount = spellcasting.cantrips_known[newLevel - 1] || 0;
        newCantrips = newCantripsCount - oldCantrips;
    }
    
    function getSlotsAtLevel(level) {
        const slotsMap = {};
        const slotsByLevel = spellcasting.spell_slots_by_level;
        for (let lvl = 1; lvl <= 9; lvl++) {
            const arr = slotsByLevel[lvl];
            if (arr && arr[level - 1] !== undefined) {
                slotsMap[lvl] = arr[level - 1];
            } else {
                slotsMap[lvl] = 0;
            }
        }
        return slotsMap;
    }
    
    const handleRollHP = () => {
        setIsRolling(true);
        // Play dice sound
        soundSynthesizer.playDiceRoll();
        // Simulate rolling the hit die
        const roll = Math.floor(Math.random() * hitDie) + 1;
        const totalGain = roll + conMod;
        setRolledHp({ roll, totalGain });
        setIsRolling(false);
    };
    
    const handleConfirm = () => {
        let hpIncrease = 0;
        if (hpMethod === 'roll' && rolledHp) {
            hpIncrease = rolledHp.totalGain;
        } else if (hpMethod === 'average') {
            hpIncrease = averageGain;
        } else if (hpMethod === 'manual') {
            hpIncrease = parseInt(manualHp) || 0;
        } else if (hpMethod === 'skip') {
            hpIncrease = 0;
        }
        // Ensure at least 1 HP gained if not skipping
        if (hpMethod !== 'skip') hpIncrease = Math.max(1, hpIncrease);
        
        // Get current max HP (fallback to computed if missing – safety)
        const currentMax = characterData.hpMax ?? (characterData.hpCur + 0); // fallback, but should exist
        const newHpMax = (currentMax || 0) + hpIncrease;
        const newHpCur = (characterData.hpCur || 0) + hpIncrease;
        
        // Update character data
        const updatedData = {
            ...characterData,
            lvl: newLevel,
            hpMax: newHpMax,
            hpCur: newHpCur
        };
        
        // Play level-up sound
        soundSynthesizer.playLevelUp();
        
        onUpdate(updatedData);
        onClose();
    };
    
    return (
        <div className="fixed inset-0 z-[1300] bg-black bg-opacity-70 flex items-center justify-center p-4">
            <div className="bg-bgPanel border border-accentGold rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in duration-200">
                <div className="bg-bgCard p-4 border-b border-borderDark flex justify-between items-center shrink-0">
                    <h2 className="text-accentGold font-bold text-lg">Level Up! 🎉</h2>
                    <button onClick={onClose} className="text-textMuted hover:text-white text-xl">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
                    {/* Level info */}
                    <div className="text-center">
                        <span className="text-2xl font-bold text-white">{characterData.name}</span>
                        <p className="text-textMuted">Level {oldLevel} → <span className="text-accentGold font-bold">{newLevel}</span></p>
                    </div>
                    
                    {/* HP Gain */}
                    <div className="bg-bgCard p-4 rounded-lg border border-borderDark">
                        <h3 className="text-accentGold font-bold mb-2">❤️ Hit Points</h3>
                        <div className="flex flex-wrap gap-4 mb-3">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="hpMethod" value="roll" checked={hpMethod === 'roll'} onChange={() => setHpMethod('roll')} />
                                <span>Roll (d{hitDie})</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="hpMethod" value="average" checked={hpMethod === 'average'} onChange={() => setHpMethod('average')} />
                                <span>Average ({averageGain})</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="hpMethod" value="manual" checked={hpMethod === 'manual'} onChange={() => setHpMethod('manual')} />
                                <span>Manual Entry</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="hpMethod" value="skip" checked={hpMethod === 'skip'} onChange={() => setHpMethod('skip')} />
                                <span>Skip (No HP Gain)</span>
                            </label>
                        </div>
                        
                        {hpMethod === 'roll' && (
                            <div>
                                {!rolledHp ? (
                                    <button onClick={handleRollHP} disabled={isRolling} className="bg-accentGold text-black px-3 py-1 rounded text-sm font-bold">
                                        {isRolling ? 'Rolling...' : '🎲 Roll Hit Die'}
                                    </button>
                                ) : (
                                    <div className="text-green-400">
                                        Rolled {rolledHp.roll} + {conMod} (CON) = <span className="font-bold text-white">{rolledHp.totalGain}</span> HP gained
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {hpMethod === 'manual' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    value={manualHp}
                                    onChange={e => setManualHp(e.target.value)}
                                    placeholder="HP gained"
                                    className="w-24 bg-bgPanel text-white border border-borderDark rounded p-1 text-center"
                                />
                                <span className="text-textMuted text-xs">(Roll your physical die, enter the result + CON)</span>
                            </div>
                        )}
                        
                        {hpMethod === 'average' && (
                            <div className="text-textLight">You will gain {averageGain} HP.</div>
                        )}
                        
                        {hpMethod === 'skip' && (
                            <div className="text-yellow-400 text-sm">Your maximum HP will not increase.</div>
                        )}
                    </div>
                    
                    {/* Ability Score Increase Reminder */}
                    {showASI && (
                        <div className="bg-bgCard p-4 rounded-lg border border-accentGold/60">
                            <h3 className="text-accentGold font-bold mb-2">📈 Ability Score Increase</h3>
                            <p className="text-textLight text-sm">
                                You can increase one ability score by 2, or two ability scores by 1.
                                Remember to update your character sheet!
                            </p>
                        </div>
                    )}
                    
                    {/* Proficiency Bonus increase */}
                    {getProficiencyBonus(newLevel) > getProficiencyBonus(oldLevel) && (
                        <div className="bg-bgCard p-4 rounded-lg border border-borderDark">
                            <h3 className="text-accentGold font-bold mb-2">📊 Proficiency Bonus</h3>
                            <p>Your proficiency bonus increases to <span className="font-bold text-white">+{getProficiencyBonus(newLevel)}</span>.</p>
                        </div>
                    )}
                    
                    {/* New Features */}
                    {newFeatures.length > 0 && (
                        <div className="bg-bgCard p-4 rounded-lg border border-borderDark">
                            <h3 className="text-accentGold font-bold mb-2">✨ New Features</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {newFeatures.map((f, idx) => (
                                    <div key={idx} className="border-l-2 border-accentGold pl-2">
                                        <div className="font-bold text-white">{f.name}</div>
                                        <div className="text-[10px] text-textMuted">{f.source}</div>
                                        <p className="text-xs text-textLight mt-1">{f.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* New Spell Slots & Cantrips */}
                    {(newSpellSlots.length > 0 || newCantrips > 0) && (
                        <div className="bg-bgCard p-4 rounded-lg border border-borderDark">
                            <h3 className="text-accentGold font-bold mb-2">🔮 Spellcasting</h3>
                            {newSpellSlots.length > 0 && (
                                <div className="mb-2">
                                    <div className="text-textLight text-sm mb-1">New spell slots:</div>
                            <div className="flex flex-wrap gap-2">
                                {newSpellSlots.map(slot => (
                                    <div key={slot.level} className="bg-bgPanel px-3 py-1 rounded-full text-xs">
                                        Level {slot.level}: +{slot.gained} slot{slot.gained > 1 ? 's' : ''}
                                    </div>
                                ))}
                            </div>
                                </div>
                            )}
                            {newCantrips > 0 && (
                                <div className="text-textLight text-sm">
                                    You learn {newCantrips} new cantrip{newCantrips > 1 ? 's' : ''}.
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Generic reminder for other changes */}
                    {newFeatures.length === 0 && !showASI && newSpellSlots.length === 0 && newCantrips === 0 && (
                        <div className="bg-bgCard p-4 rounded-lg border border-borderDark text-center text-textMuted text-sm">
                            No new features or abilities at this level. Continue your adventure!
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-borderDark flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 bg-borderDark text-white rounded text-sm hover:bg-gray-700">Skip</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-accentGold text-black font-bold rounded text-sm hover:bg-yellow-500">
                        Apply Level Up
                    </button>
                </div>
            </div>
        </div>
    );
}