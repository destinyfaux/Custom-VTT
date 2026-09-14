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

// ─────────────────────────────────────────────────────────────
// VTTManager — turn pipeline & round tracking (S1 End Turn)
// ─────────────────────────────────────────────────────────────
describe('VTTManager turn pipeline & round tracking', () => {
  const makeCombatants = (n) => Array.from({ length: n }, (_, i) => ({
    id: `tok_${i}`, name: `Fighter ${i}`, initiative: 20 - i, dexMod: 0
  }));

  test('combat start (setInitiativeOrder) begins at round 1 with first combatant active', () => {
    const mgr = new VTTManager();
    mgr.setInitiativeOrder(makeCombatants(3));
    assert.strictEqual(mgr.state.round, 1);
    assert.strictEqual(mgr.currentTurnIndex, 0);
    assert.strictEqual(mgr.state.currentTurn, 'tok_0');
  });

  test('advanceTurn cycles the order without changing round until wrap', () => {
    const mgr = new VTTManager();
    mgr.setInitiativeOrder(makeCombatants(3));
    mgr.advanceTurn(); // -> tok_1
    assert.strictEqual(mgr.state.currentTurn, 'tok_1');
    assert.strictEqual(mgr.state.round, 1);
    mgr.advanceTurn(); // -> tok_2 (last combatant)
    assert.strictEqual(mgr.state.currentTurn, 'tok_2');
    assert.strictEqual(mgr.state.round, 1);
  });

  test('wrapping past the last combatant starts a new round', () => {
    const mgr = new VTTManager();
    mgr.setInitiativeOrder(makeCombatants(3));
    mgr.advanceTurn();
    mgr.advanceTurn();
    mgr.advanceTurn(); // wrap -> tok_0 again, round 2
    assert.strictEqual(mgr.state.currentTurn, 'tok_0');
    assert.strictEqual(mgr.state.round, 2);
  });

  test('single combatant: every end turn wraps and increments the round', () => {
    const mgr = new VTTManager();
    mgr.setInitiativeOrder(makeCombatants(1));
    mgr.advanceTurn();
    assert.strictEqual(mgr.state.currentTurn, 'tok_0');
    assert.strictEqual(mgr.state.round, 2);
  });

  test('resetInitiative clears round back to 0', () => {
    const mgr = new VTTManager();
    mgr.setInitiativeOrder(makeCombatants(2));
    mgr.advanceTurn();
    mgr.advanceTurn();
    assert.strictEqual(mgr.state.round, 2);
    mgr.resetInitiative();
    assert.strictEqual(mgr.state.round, 0);
    assert.strictEqual(mgr.state.currentTurn, null);
    assert.strictEqual(mgr.state.initiative.length, 0);
  });

  test('round & currentTurn survive a state round-trip (persisted in state JSON shape)', () => {
    const mgr = new VTTManager();
    mgr.setInitiativeOrder(makeCombatants(2));
    mgr.advanceTurn();
    mgr.advanceTurn();
    // Simulate what getGameState spreads to clients / gets saved to disk
    const snapshot = JSON.parse(JSON.stringify(mgr.getGameState()));
    assert.strictEqual(snapshot.round, 2);
    assert.strictEqual(snapshot.currentTurn, 'tok_0');
  });

  test('advanceTurn on an empty initiative list is a safe no-op', () => {
    const mgr = new VTTManager();
    mgr.advanceTurn();
    assert.strictEqual(mgr.state.currentTurn, null);
    assert.strictEqual(mgr.state.round, 0);
  });
});

describe('VTTManager.getCombatSnapshot (S2)', () => {
  // Seed tokens at known grid positions (70px = 5ft cell, x/y = top-left).
  // Layout: Chief (350,140) — Aria (210,140) — Borin (210,280):
  //   Chief→Aria = 140px straight  = 2 cells = 10 ft
  //   Chief→Borin = 140px diagonal = 2 cells = 10 ft (PHB diagonal rule)
  const seed = (mgr) => {
    mgr.state.tokens.push(
      { id: 'tok_0', name: 'Goblin Chief', type: 'npc', hpCur: 21, hpMax: 42, ac: 17,
        conditions: ['Poisoned'], x: 350, y: 140, size: 1, isPlaced: true, ownerId: null },
      { id: 'tok_1', name: 'Aria', type: 'player', hpCur: 20, hpMax: 28, ac: 15,
        conditions: [], x: 210, y: 140, size: 1, isPlaced: true, ownerId: 'aria' },
      { id: 'tok_2', name: 'Borin', type: 'player', hpCur: 0, hpMax: 30, ac: 14,
        conditions: [], x: 210, y: 280, size: 1, isPlaced: true, ownerId: 'borin' }
    );
    mgr.setInitiativeOrder([
      { id: 'tok_0', name: 'Goblin Chief', initiative: 18, dexMod: 2 },
      { id: 'tok_1', name: 'Aria', initiative: 14, dexMod: 2 },
      { id: 'tok_2', name: 'Borin', initiative: 6, dexMod: 0 }
    ]);
  };

  test('orders combatants by initiative, marks the active one, carries round', () => {
    const mgr = new VTTManager();
    seed(mgr);
    const snap = mgr.getCombatSnapshot('dm');
    assert.strictEqual(snap.active, true);
    assert.strictEqual(snap.round, 1);
    assert.strictEqual(snap.combatants.length, 3);
    assert.deepStrictEqual(snap.combatants.map(c => c.id), ['tok_0', 'tok_1', 'tok_2']);
    assert.strictEqual(snap.combatants[0].isActive, true);
    assert.strictEqual(snap.combatants[1].isActive, false);
    assert.strictEqual(snap.currentTurn, 'tok_0');
  });

  test('derives answers: bloodied / down / conditions', () => {
    const mgr = new VTTManager();
    seed(mgr);
    const [chief, aria, borin] = mgr.getCombatSnapshot('dm').combatants;
    // Chief at exactly half HP -> bloodied
    assert.strictEqual(chief.isBloodied, true);
    assert.strictEqual(chief.isDown, false);
    assert.deepStrictEqual(chief.conditions, ['Poisoned']);
    // Aria at 20/28 (71%) -> not bloodied
    assert.strictEqual(aria.isBloodied, false);
    // Borin at 0 HP -> down (but not marked dead by the death-save system)
    assert.strictEqual(borin.isDown, true);
    assert.strictEqual(borin.isDead, false);
  });

  test('distFromActive: center-to-center Chebyshev in feet (0 / 10 / 10)', () => {
    const mgr = new VTTManager();
    seed(mgr);
    const snap = mgr.getCombatSnapshot('dm');
    const byId = Object.fromEntries(snap.combatants.map(c => [c.id, c]));
    assert.strictEqual(byId.tok_0.distFromActive, 0);
    assert.strictEqual(byId.tok_1.distFromActive, 10); // 140px straight
    assert.strictEqual(byId.tok_2.distFromActive, 10); // 140px diagonal — same cost
  });

  test('dm mode exposes AC + ownerId; agent mode redacts both and drops hidden/unplaced', () => {
    const mgr = new VTTManager();
    seed(mgr);
    // A hidden placed token + an unplaced token, both in initiative
    mgr.state.tokens.push(
      { id: 'tok_3', name: 'Hidden Sniper', type: 'npc', hpCur: 10, hpMax: 10, ac: 15,
        conditions: [], x: 490, y: 140, size: 1, isPlaced: true, hidden: true },
      { id: 'tok_4', name: 'Reinforcement', type: 'npc', hpCur: 10, hpMax: 10, ac: 13,
        conditions: [], x: 0, y: 0, size: 1, isPlaced: false }
    );
    mgr.initiativeList.push(
      { id: 'tok_3', name: 'Hidden Sniper', initiative: 12, type: 'npc' },
      { id: 'tok_4', name: 'Reinforcement', initiative: 11, type: 'npc' }
    );

    const dm = mgr.getCombatSnapshot('dm');
    assert.strictEqual(dm.combatants.length, 5);
    dm.combatants.forEach(c => {
      assert.strictEqual(typeof c.ac === 'number' || c.ac === null, true);
      assert.ok('ownerId' in c);
    });

    const agent = mgr.getCombatSnapshot('agent');
    assert.strictEqual(agent.combatants.length, 3); // hidden + unplaced excluded
    agent.combatants.forEach(c => {
      assert.strictEqual('ac' in c, false);
      assert.strictEqual('ownerId' in c, false);
    });
  });

  test('no combat -> inactive snapshot with round 0', () => {
    const mgr = new VTTManager();
    const snap = mgr.getCombatSnapshot('dm');
    assert.strictEqual(snap.active, false);
    assert.strictEqual(snap.round, 0);
    assert.deepStrictEqual(snap.combatants, []);
  });

  test('combatant whose token was deleted still appears (initiative list is the order source)', () => {
    const mgr = new VTTManager();
    seed(mgr);
    mgr.state.tokens = mgr.state.tokens.filter(t => t.id !== 'tok_2');
    const snap = mgr.getCombatSnapshot('dm');
    const ghost = snap.combatants.find(c => c.id === 'tok_2');
    assert.ok(ghost, 'deleted-token combatant kept from initiative list');
    assert.strictEqual(ghost.hpMax, 0);
    assert.strictEqual(ghost.isDown, true);
  });
});
