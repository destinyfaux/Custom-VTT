// server/utils/itemEffects.js
// Server-authoritative registry of IMPLEMENTED consumable item effects.
//
// Goal: make items like the Potion of Healing *usable inside the VTT* instead
// of being flavorless catalog entries — "use" rolls the SRD effect, applies it
// to the drinker's HP, and consumes exactly one item from the stack.
//
// Scope note: NOT every item needs (or will ever get) a mechanical use —
// "Soap" is abstract. This registry only maps items whose SRD effect can be
// resolved unambiguously on a token/character. Everything else keeps working
// as pure flavor + description.
//
// Extending it: add an entry keyed by the normalized item name. `effect.type`
// currently supports "heal" (positive roll → HP restored). The client mirrors
// `meta.tierRegex` so its USE buttons stay in sync with this registry.

const { rollDiceFormula } = require('./dice');

// Keyed by normalized name: lowercase, single-spaced.
const ITEM_EFFECTS = {
    'potion of healing': {
        label: 'Potion of Healing',
        category: 'potion',
        rarity: 'common',
        effect: { type: 'heal', formula: '2d4+2' },
        usage: 'Bonus action to drink (or administer to another creature within 5 ft.). The drinker regains 2d4+2 hit points.'
    },
    'potion of greater healing': {
        label: 'Potion of Greater Healing',
        category: 'potion',
        rarity: 'uncommon',
        effect: { type: 'heal', formula: '4d4+4' },
        usage: 'Bonus action to drink. The drinker regains 4d4+4 hit points.'
    },
    'potion of superior healing': {
        label: 'Potion of Superior Healing',
        category: 'potion',
        rarity: 'rare',
        effect: { type: 'heal', formula: '8d4+8' },
        usage: 'Bonus action to drink. The drinker regains 8d4+8 hit points.'
    },
    'potion of supreme healing': {
        label: 'Potion of Supreme Healing',
        category: 'potion',
        rarity: 'very rare',
        effect: { type: 'heal', formula: '10d4+20' },
        usage: 'Bonus action to drink. The drinker regains 10d4+20 hit points.'
    }
};

// Catches SRD/homebrew spellings like "Potion Of  Greater Healing" and maps the
// tier to the correct formula. Tier 1 (no qualifier) = regular healing potion.
const HEALING_TIER_RE = /^potion\s+of\s+(?:(greater|superior|supreme)\s+)?healing$/i;

const TIER_FORMULAS = {
    regular: '2d4+2',
    greater: '4d4+4',
    superior: '8d4+8',
    supreme: '10d4+20'
};

function normalizeItemName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve the implemented effect for an inventory/catalog item.
 * @param {string} name raw item name from inventory
 * @returns {{label:string, category:string, rarity?:string, effect:{type:string, formula:string}, usage:string}|null}
 */
function resolveItemEffect(name) {
    const key = normalizeItemName(name);
    if (!key) return null;

    const direct = ITEM_EFFECTS[key];
    if (direct) return direct;

    const tier = HEALING_TIER_RE.exec(key);
    if (tier) {
        const tierKey = tier[1] ? tier[1].toLowerCase() : 'regular';
        const label = tier[1] ? `Potion of ${tier[1][0].toUpperCase()}${tier[1].slice(1)} Healing` : 'Potion of Healing';
        return {
            label,
            category: 'potion',
            rarity: { regular: 'common', greater: 'uncommon', superior: 'rare', supreme: 'very rare' }[tierKey],
            effect: { type: 'heal', formula: TIER_FORMULAS[tierKey] },
            usage: `Bonus action to drink. The drinker regains ${TIER_FORMULAS[tierKey]} hit points.`
        };
    }

    return null;
}

/**
 * Roll the numeric part of an effect.
 * @returns {{total:number, rolls:number[], formula:string}|null} null on failure
 */
function rollItemEffect(effect, rng = Math.random) {
    if (!effect || typeof effect.formula !== 'string') return null;
    return rollDiceFormula(effect.formula, rng);
}

// Public for the client: exact registry keys + the tier pattern, so the UI's
// USE buttons can never drift from what the server will actually accept.
function getUsableItemInfo() {
    return {
        items: ITEM_EFFECTS,
        tierRegex: HEALING_TIER_RE.source
    };
}

module.exports = { resolveItemEffect, rollItemEffect, getUsableItemInfo, normalizeItemName };
