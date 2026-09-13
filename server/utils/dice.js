// server/utils/dice.js
// Lightweight dice-notation parser & roller for SRD hit-point formulas.
// Supports classic 5e formulas: "18d10+36", "4d6+4", "2d8", "2d6+1d4+2", "3d6 - 2".
// Never throws: malformed formulas return null so callers can fall back to static values.

const MAX_FORMULA_LENGTH = 64;
const MAX_DICE_COUNT = 500;
const MAX_DICE_SIDES = 10000;

/**
 * Parse a dice formula into structured terms.
 * @param {string} formula e.g. "18d10+36"
 * @returns {Array<{sign:number, count?:number, sides?:number, flat?:number}>|null}
 */
function parseDiceFormula(formula) {
    if (typeof formula !== 'string') return null;
    const cleaned = formula.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleaned || cleaned.length > MAX_FORMULA_LENGTH) return null;

    // Split into signed terms: "18d10+36" -> ["18d10", "+36"]
    const terms = cleaned.match(/[+-]?[^+-]+/g);
    if (!terms || terms.length === 0) return null;

    const parsed = [];
    for (const term of terms) {
        const sign = term.startsWith('-') ? -1 : 1;
        const body = term.replace(/^[+-]/, '');
        if (!body) return null;

        const diceMatch = body.match(/^(\d*)d(\d+)$/);
        if (diceMatch) {
            const count = diceMatch[1] === '' ? 1 : parseInt(diceMatch[1], 10);
            const sides = parseInt(diceMatch[2], 10);
            if (!Number.isFinite(count) || !Number.isFinite(sides)) return null;
            if (count < 1 || sides < 1 || count > MAX_DICE_COUNT || sides > MAX_DICE_SIDES) return null;
            parsed.push({ sign, count, sides });
            continue;
        }

        const flat = parseInt(body, 10);
        if (!Number.isFinite(flat) || String(flat) !== body) return null;
        parsed.push({ sign, flat });
    }

    return parsed.length > 0 ? parsed : null;
}

/**
 * Roll previously-parsed terms.
 * @param {Array} parsed output of parseDiceFormula
 * @param {() => number} rng injectable random source for deterministic tests
 * @returns {{total: number, rolls: number[]}}
 */
function rollParsed(parsed, rng = Math.random) {
    let total = 0;
    const rolls = [];
    for (const term of parsed) {
        if (term.flat !== undefined) {
            total += term.sign * term.flat;
            continue;
        }
        for (let i = 0; i < term.count; i++) {
            const roll = 1 + Math.floor(rng() * term.sides);
            rolls.push(roll);
            total += term.sign * roll;
        }
    }
    return { total, rolls };
}

/**
 * Roll a dice formula string.
 * @param {string} formula e.g. "4d6+4"
 * @param {() => number} rng injectable random source
 * @returns {{total: number, rolls: number[], formula: string}|null} null when unparseable
 */
function rollDiceFormula(formula, rng = Math.random) {
    const parsed = parseDiceFormula(formula);
    if (!parsed) return null;
    const { total, rolls } = rollParsed(parsed, rng);
    return { total, rolls, formula: formula.trim() };
}

module.exports = { parseDiceFormula, rollDiceFormula };
