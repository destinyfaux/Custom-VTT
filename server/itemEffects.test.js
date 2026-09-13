// server/itemEffects.test.js
// Tests for the implemented consumable-effect registry (server/utils/itemEffects.js)
const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  resolveItemEffect,
  rollItemEffect,
  getUsableItemInfo,
  normalizeItemName
} = require('./utils/itemEffects');

describe('normalizeItemName', () => {
  test('lowercases and collapses whitespace', () => {
    assert.strictEqual(normalizeItemName('  Potion   OF   Healing '), 'potion of healing');
  });

  test('handles non-string input safely', () => {
    assert.strictEqual(normalizeItemName(null), '');
    assert.strictEqual(normalizeItemName(undefined), '');
    assert.strictEqual(normalizeItemName(42), '42');
  });
});

describe('resolveItemEffect', () => {
  test('resolves the four healing potion tiers exactly', () => {
    assert.strictEqual(resolveItemEffect('Potion of Healing').effect.formula, '2d4+2');
    assert.strictEqual(resolveItemEffect('Potion of Greater Healing').effect.formula, '4d4+4');
    assert.strictEqual(resolveItemEffect('Potion of Superior Healing').effect.formula, '8d4+8');
    assert.strictEqual(resolveItemEffect('Potion of Supreme Healing').effect.formula, '10d4+20');
  });

  test('is whitespace/case tolerant (tier regex fallback)', () => {
    assert.strictEqual(resolveItemEffect('potion of  greater HEALING').effect.formula, '4d4+4');
    assert.strictEqual(resolveItemEffect('POTION OF healing').effect.formula, '2d4+2');
  });

  test('rejects non-healing items (no implemented use)', () => {
    assert.strictEqual(resolveItemEffect('Soap'), null);
    assert.strictEqual(resolveItemEffect('Potion of Poison'), null);
    assert.strictEqual(resolveItemEffect('Potion of Greater Healing Fingers'), null);
    assert.strictEqual(resolveItemEffect('Longsword'), null);
  });

  test('rejects empty / invalid input', () => {
    assert.strictEqual(resolveItemEffect(''), null);
    assert.strictEqual(resolveItemEffect(null), null);
    assert.strictEqual(resolveItemEffect(123), null);
  });

  test('every resolved effect exposes usage text and potion category', () => {
    const def = resolveItemEffect('Potion of Healing');
    assert.strictEqual(def.category, 'potion');
    assert.ok(def.usage && def.usage.length > 10);
    assert.strictEqual(def.effect.type, 'heal');
  });
});

describe('rollItemEffect', () => {
  test('rolls 2d4+2 within bounds and returns individual rolls', () => {
    const def = resolveItemEffect('Potion of Healing');
    for (let i = 0; i < 200; i++) {
      const rolled = rollItemEffect(def.effect);
      assert.ok(rolled);
      assert.ok(rolled.total >= 4 && rolled.total <= 10, `total ${rolled.total} out of range`);
      assert.strictEqual(rolled.rolls.length, 2);
    }
  });

  test('supports deterministic rng injection', () => {
    const def = { type: 'heal', formula: '1d20' };
    let calls = 0;
    const rng = () => { calls++; return 0; }; // always rolls a 1
    const rolled = rollItemEffect(def, rng);
    assert.strictEqual(rolled.total, 1);
    assert.strictEqual(calls, 1);
  });

  test('returns null for malformed / missing effects', () => {
    assert.strictEqual(rollItemEffect(null), null);
    assert.strictEqual(rollItemEffect({}), null);
    assert.strictEqual(rollItemEffect({ type: 'heal', formula: 'not dice' }), null);
  });
});

describe('getUsableItemInfo (client contract)', () => {
  test('exposes exact keys + tierRegex so USE buttons match the server', () => {
    const info = getUsableItemInfo();
    assert.ok(info.items['potion of healing']);
    assert.ok(info.tierRegex.includes('greater'));
    // The regex must be client-compilable
    const re = new RegExp(info.tierRegex, 'i');
    assert.ok(re.test('Potion of Greater Healing'));
    assert.ok(!re.test('Soap'));
  });
});
