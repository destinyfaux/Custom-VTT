// client/src/utils/CharacterEngine.js
import srd from '../data/srd_data.json';

// --- CORE UTILITIES ---

export const getAbilityModifier = (score) => Math.floor((parseInt(score) - 10) / 2);

export const getProficiencyBonus = (level) => srd.proficiency_bonus[level] || 2;

// Parses strings like "4 lb." or "10 lbs" to numeric 4 or 10
export const parseWeight = (weightStr) => {
    if (typeof weightStr === 'number') return weightStr;
    if (!weightStr) return 0;
    return parseFloat(weightStr.toString().replace(/[^0-9.]/g, '')) || 0;
};

// --- ATTRIBUTE & STAT CALCULATION ---

// Helper: returns 10 only when value is truly missing/NaN
const safeStat = (val) => {
    const n = parseInt(val);
    return isNaN(n) ? 10 : n;
};

// Generates raw user scores straight from the sheet inputs (with no racial bonuses)
export const calculateRawStats = (data) => {
    return {
        str: safeStat(data.str),
        dex: safeStat(data.dex),
        con: safeStat(data.con),
        int: safeStat(data.int),
        wis: safeStat(data.wis),
        cha: safeStat(data.cha)
    };
};

// Calculates recommended/suggested stats with automated racial/subracial bonuses added
export const calculateLiveStats = (data) => {
    let stats = { 
        str: safeStat(data.str), 
        dex: safeStat(data.dex), 
        con: safeStat(data.con), 
        int: safeStat(data.int), 
        wis: safeStat(data.wis), 
        cha: safeStat(data.cha) 
    };
    
    // Apply Race Bonuses
    if (data.race && srd.races[data.race]) {
        const race = srd.races[data.race];
        Object.entries(race.ability_score_increase || {}).forEach(([stat, val]) => {
            stats[stat.toLowerCase()] += val;
        });
    }

    // Apply Subrace Bonuses
    if (data.race && data.subrace && srd.races[data.race].subraces[data.subrace]) {
        const sub = srd.races[data.race].subraces[data.subrace];
        Object.entries(sub.ability_score_increase || {}).forEach(([stat, val]) => {
            stats[stat.toLowerCase()] += val;
        });
    }

    return stats;
};

// --- SKILL & PROFICIENCY LOGIC ---

export const getSkillProficiencyLevel = (data, skillName) => {
    const manualLevel = data[`prof_${skillName}`] || 0;
    let autoLevel = 0;
    
    // Check Race Auto-Proficiencies
    if (data.race && srd.races[data.race]?.traits) {
        srd.races[data.race].traits.forEach(t => {
            if (t.description?.includes(`Proficiency in ${skillName}`)) autoLevel = 1;
        });
    }

    // Check Class Auto-Proficiencies
    if (data.charClass && srd.classes[data.charClass]?.proficiencies) {
        const profs = srd.classes[data.charClass].proficiencies;
        // Only check if proficiencies is actually an array
        if (Array.isArray(profs) && profs.includes(skillName)) autoLevel = 1;
    }

    return Math.max(manualLevel, autoLevel);
};

// Calculates the final number shown on the sheet: (Mod + (Prof * Bonus))
export const calculateSkillTotal = (skillName, data, stats, profBonus) => {
    const profLevel = getSkillProficiencyLevel(data, skillName);
    const ability = srd.skills[skillName]?.ability?.toLowerCase() || '';
    const mod = getAbilityModifier(stats[ability] || 10);
    
    return mod + (profLevel * profBonus);
};

// --- COMBAT & LOGISTICS ENGINE ---

export const calculateMaxHP = (data, stats) => {
    if (!data.charClass || !srd.classes[data.charClass]) return 10;
    
    const conMod = getAbilityModifier(stats.con || 10);
        const hitDie = srd.classes[data.charClass].hit_die || 8;
        const level = parseInt(data.lvl) || 1;
        
        // Lvl 1: HitDie + ConMod. Lvl 2+: (Avg of HitDie + 1) + ConMod per level
        const avgRoll = Math.floor(hitDie / 2) + 1;
    const perLvlHp = Math.max(1, avgRoll + conMod); // ★ FIXED: Gain at least 1 HP per level per standard 5e rules
    
    return Math.max(1, (hitDie + conMod) + ((level - 1) * perLvlHp)); // ★ FIXED: Ensure total Max HP is never less than 1
};

export const calculateAC = (data, stats) => {
    const dexMod = getAbilityModifier(stats.dex || 10);
    let ac = 10 + dexMod; // Base
    
    // Armor Lookup (Search Arrays)
    if (data.equippedArmor && srd.equipment.armor) {
        let armorData = null;
        ['light', 'medium', 'heavy'].forEach(type => {
            const found = srd.equipment.armor[type]?.find(a => a.name === data.equippedArmor);
            if (found) armorData = found;
        });

        if (armorData) {
            ac = armorData.ac;
            // Dexterity Logic
            if (armorData.dex_bonus) {
                ac += (armorData.max_dex_bonus !== undefined) ? Math.min(dexMod, armorData.max_dex_bonus) : dexMod;
                }
        }
    }

    // Shield Lookup (Search Shields Array)
    if (data.equippedShield) {
        const shield = srd.equipment.armor.shields?.find(s => s.name === "Shield");
        if (shield) ac += shield.ac_bonus;
    }

    ac += parseInt(data.acBonus) || 0;
    return ac;
};

// --- INVENTORY & LOGISTICS ENGINE ---

export const calculateEncumbrance = (data, stats) => {
    const items = data.inventory || [];
    const totalWeight = items.reduce((sum, item) => sum + parseWeight(item.weight), 0);
    const capacity = (parseInt(stats.str) || 10) * 15;
    return { totalWeight, capacity, isEncumbered: totalWeight > capacity };
};

// Utility to find any item in the nested SRD structure
export const findItemInSRD = (itemName, srd) => {
    const equip = srd.equipment || {};
    
    // 1. Packs
    if (equip.packs && equip.packs[itemName]) return { ...equip.packs[itemName], type: 'pack' };
    
    // 2. Weapons (Search all weapon categories)
    for (const cat in equip.weapons || {}) {
        const found = equip.weapons[cat].find(w => w.name === itemName);
        if (found) return { ...found, type: 'weapon' };
    }
    
    // 3. Armor (Search all armor categories)
    for (const cat in equip.armor || {}) {
        const found = equip.armor[cat].find(a => a.name === itemName);
        if (found) return { ...found, type: 'armor' };
    }

    // 4. Gear
    const gearFound = equip.adventuring_gear?.find(g => g.name === itemName);
    if (gearFound) return { ...gearFound, type: 'gear' };
        
    return null;
};

// ★★★ NEW HELPER FUNCTIONS ★★★

// Passive skill = 10 + skill total
export const getPassiveSkill = (skillName, data, stats, profBonus) => {
    return 10 + calculateSkillTotal(skillName, data, stats, profBonus);
};

// Push/Drag/Lift calculations
export const getPushDragLift = (strScore) => {
    const carry = (parseInt(strScore) || 10) * 15;
    return {
        carryCapacity: carry,
        pushDragLift: carry * 2
    };
};

// Spellcasting details: ability, save DC, attack bonus
// Accepts calculated live stats to ensure racial/subracial bonuses are included.
export const getSpellcastingDetails = (data, srdData, stats) => {
    if (!data.charClass || !srdData.classes[data.charClass]?.spellcasting) {
        return { ability: null, abilityMod: 0, saveDC: 0, attackBonus: 0 };
    }

    const spellcasting = srdData.classes[data.charClass].spellcasting;
    const ability = spellcasting.ability; // e.g. "Intelligence", "Wisdom", "Charisma" or "INT", "WIS", "CHA"

    // Normalize spelling/abbreviations to 3-letter lowercase key (str, dex, con, int, wis, cha)
    let statKey = String(ability).toLowerCase();
    if (statKey.startsWith('int')) statKey = 'int';
    else if (statKey.startsWith('wis')) statKey = 'wis';
    else if (statKey.startsWith('cha')) statKey = 'cha';
    else if (statKey.startsWith('str')) statKey = 'str';
    else if (statKey.startsWith('dex')) statKey = 'dex';
    else if (statKey.startsWith('con')) statKey = 'con';

    // Use live stats if provided, otherwise compute them on the fly
    const activeStats = stats || calculateLiveStats(data);
    const abilityScore = activeStats[statKey] || 10;
    const mod = getAbilityModifier(abilityScore);
    const profBonus = getProficiencyBonus(data.lvl || 1);
    
    return {
        ability,
        abilityMod: mod,
        saveDC: 8 + profBonus + mod,
        attackBonus: profBonus + mod
    };
};

// Get spell slots for the class at current level
export const getSpellSlots = (data, srdData) => {
    if (!data.charClass || !srdData.classes[data.charClass]?.spellcasting?.spell_slots_by_level) {
        return [];
    }
    
    const slots = srdData.classes[data.charClass].spellcasting.spell_slots_by_level;
    const level = Math.max(1, Math.min(20, parseInt(data.lvl) || 1));
    const slotLevels = Object.keys(slots);
    const result = [];

    slotLevels.forEach(slotLevel => {
        const slotsAtLevel = slots[slotLevel];
        if (slotsAtLevel && slotsAtLevel[level - 1] !== undefined && slotsAtLevel[level - 1] > 0) {
            result.push({
                level: parseInt(slotLevel),
                total: slotsAtLevel[level - 1]
            });
        }
    });

    return result;
};

// Determines saving throw proficiency (manual override takes priority, class defaults as fallback)
export const isSavingThrowProficient = (data, statUpper) => {
    const manualKey = `save_prof_${statUpper.toLowerCase()}`;
    
    // 1. Check for manual user override (player agency)
    if (data[manualKey] !== undefined) {
        return !!data[manualKey];
    }
    
    // 2. Fall back to SRD class defaults
    if (data.charClass && srd.classes[data.charClass]?.saving_throws) {
        const classSaves = srd.classes[data.charClass].saving_throws; // e.g., ["STR", "CON"]
        return classSaves.includes(statUpper.toUpperCase());
    }
    
    return false;
};

// Calculates the final saving throw modifier: (Ability Mod + (Proficient ? Prof Bonus : 0))
export const calculateSavingThrow = (statUpper, data, stats, profBonus) => {
    const isProf = isSavingThrowProficient(data, statUpper);
    const mod = getAbilityModifier(stats[statUpper.toLowerCase()] || 10);
    return mod + (isProf ? profBonus : 0);
};