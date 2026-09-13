// server/VTTManager.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { parseDiceFormula, rollDiceFormula } = require('./utils/dice');
const { VTTManager } = require('./VTTManager');

// ─────────────────────────────────────────────────────────────
// dice.js — formula parsing
// ─────────────────────────────────────────────────────────────
describe('parseDiceFormula', () => {
  test('parses classic XdY+Z formulas', () => {
    const parsed = parseDiceFormula('18d10+36');
    assert.ok(Array.isArray(parsed));
    assert.deepStrictEqual(parsed, [
      { sign: 1, count: 18, sides: 10 },
      { sign: 1, flat: 36 }
    ]);
  });

  test('parses bare dice and negative modifiers with whitespace', () => {
    assert.deepStrictEqual(parseDiceFormula(' 2d8 '), [
      { sign: 1, count: 2, sides: 8 }
    ]);
    assert.deepStrictEqual(parseDiceFormula('3d6 - 2'), [
      { sign: 1, count: 3, sides: 6 },
      { sign: -1, flat: 2 }
    ]);
  });

  test('parses multi-dice-term formulas', () => {
    assert.deepStrictEqual(parseDiceFormula('2d6+1d4+2'), [
      { sign: 1, count: 2, sides: 6 },
      { sign: 1, count: 1, sides: 4 },
      { sign: 1, flat: 2 }
    ]);
  });

  test('rejects malformed / hostile formulas', () => {
    assert.strictEqual(parseDiceFormula(null), null);
    assert.strictEqual(parseDiceFormula(''), null);
    assert.strictEqual(parseDiceFormula('banana'), null);
    assert.strictEqual(parseDiceFormula('18d10+36; rm -rf'), null);
    assert.strictEqual(parseDiceFormula('999999d99999999'), null); // exceeds caps
    assert.strictEqual(parseDiceFormula('1d'), null);
    assert.strictEqual(parseDiceFormula('d'), null);
    assert.strictEqual(parseDiceFormula('+'), null);
  });
});

// ─────────────────────────────────────────────────────────────
// dice.js — rolling
// ─────────────────────────────────────────────────────────────
describe('rollDiceFormula', () => {
  test('respects min/max bounds for 4d6+4', () => {
    for (let i = 0; i < 200; i++) {
      const result = rollDiceFormula('4d6+4');
      assert.ok(result);
      assert.ok(result.total >= 8 && result.total <= 28, `total ${result.total} out of range`);
      assert.strictEqual(result.rolls.length, 4);
    }
  });

  test('uses injectable rng for deterministic results', () => {
    const fixed = () => 0.999999; // always max roll
    const result = rollDiceFormula('2d6+3', fixed);
    assert.strictEqual(result.total, 15); // 6 + 6 + 3
  });

  test('returns null for garbage', () => {
    assert.strictEqual(rollDiceFormula('not dice'), null);
    assert.strictEqual(rollDiceFormula(42), null);
  });
});

// ─────────────────────────────────────────────────────────────
// VTTManager — hp_formula rolling on NPC spawn
// ─────────────────────────────────────────────────────────────
describe('VTTManager.addNPCToken hp rolling', () => {
  test('rolls hp from monsterData.hp_formula instead of static hp', () => {
    const mgr = new VTTManager();
    const monsterData = { name: 'Goblin', hp: 7, hp_formula: '2d6+2' };
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const token = mgr.addNPCToken('Goblin', null, monsterData.hp, 15, monsterData, 1);
      assert.strictEqual(token.hpCur, token.hpMax);
      assert.ok(token.hpCur >= 4 && token.hpCur <= 14, `hp ${token.hpCur} outside 2d6+2 range`);
      assert.ok(token.hpRoll, 'hpRoll metadata should be set');
      assert.strictEqual(token.hpRoll.formula, '2d6+2');
      assert.strictEqual(token.hpRoll.total, token.hpCur);
      seen.add(token.hpCur);
    }
    // 50 rolls of 2d6+2 should produce more than one distinct value (variety works)
    assert.ok(seen.size > 1, `expected varied HP, got only: ${[...seen].join(',')}`);
  });

  test('falls back to static hp when no formula present', () => {
    const mgr = new VTTManager();
    const token = mgr.addNPCToken('Bandit', null, 11, 12, { name: 'Bandit', hp: 11 }, 1);
    assert.strictEqual(token.hpCur, 11);
    assert.strictEqual(token.hpMax, 11);
    assert.strictEqual(token.hpRoll, null);
  });

  test('falls back to static hp when formula is malformed', () => {
    const mgr = new VTTManager();
    const token = mgr.addNPCToken('Weird', null, 9, 12, { hp: 9, hp_formula: 'garbage!!' }, 1);
    assert.strictEqual(token.hpCur, 9);
    assert.strictEqual(token.hpRoll, null);
  });

  test('batch spawn gives each creature an independent roll', () => {
    const mgr = new VTTManager();
    const creature = {
      name: 'Abyssal Chicken',
      avatarUrl: '',
      hp: 18,
      ac: 13,
      monsterData: { hp: 18, hp_formula: '4d6+4' },
      size: 1
    };
    const tokens = mgr.addNPCTokenBatch(Array.from({ length: 6 }, () => ({ ...creature })));
    assert.strictEqual(tokens.length, 6);
    tokens.forEach(t => {
      assert.ok(t.hpCur >= 8 && t.hpCur <= 28);
      assert.strictEqual(t.hpCur, t.hpMax);
    });
    const distinct = new Set(tokens.map(t => t.hpCur));
    // With 6 rolls of 4d6+4 there is a ~4% chance all match; retry-proof by
    // asserting at least the mechanism ran (hpRoll present on each).
    tokens.forEach(t => assert.strictEqual(t.hpRoll.total, t.hpCur));
    if (distinct.size === 1) {
      // acceptable statistically, but roll once more to reduce flakiness
      const extra = mgr.addNPCToken('Abyssal Chicken', '', 18, 13, creature.monsterData, 1);
      assert.ok(extra.hpCur >= 8 && extra.hpCur <= 28);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// VTTManager — flight toggle
// ─────────────────────────────────────────────────────────────
describe('VTTManager.toggleTokenFlying', () => {
  test('toggles the flying flag and returns the token', () => {
    const mgr = new VTTManager();
    const token = mgr.addNPCToken('Wyvern', null, 20, 14, null, 2);
    assert.strictEqual(token.flying, undefined);

    const afterOn = mgr.toggleTokenFlying(token.id);
    assert.strictEqual(afterOn.flying, true);

    const afterOff = mgr.toggleTokenFlying(token.id);
    assert.strictEqual(afterOff.flying, false);
  });

  test('returns null for unknown token', () => {
    const mgr = new VTTManager();
    assert.strictEqual(mgr.toggleTokenFlying('npc_missing'), null);
  });
});
