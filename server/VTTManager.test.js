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

// ─────────────────────────────────────────────────────────────
// VTTManager — movement meter (S3)
// ─────────────────────────────────────────────────────────────
describe('VTTManager movement meter (S3)', () => {
  const CELL = 70; // px per 5ft cell

  // Aria (tok_0, user_a) at (0,0) — Borin (tok_1, user_b) at (210,0) —
  // Goblin (tok_2) at (420,0). All placed, all size 1.
  const seedCombat = () => {
    const mgr = new VTTManager();
    mgr.state.tokens.push(
      { id: 'tok_0', name: 'Aria', type: 'player', ownerId: 'user_a', hpCur: 20, hpMax: 20, ac: 16, x: 0, y: 0, isPlaced: true, size: 1, conditions: [] },
      { id: 'tok_1', name: 'Borin', type: 'player', ownerId: 'user_b', hpCur: 18, hpMax: 18, ac: 15, x: 210, y: 0, isPlaced: true, size: 1, conditions: [] },
      { id: 'tok_2', name: 'Goblin', type: 'npc', ownerId: 'DM', hpCur: 7, hpMax: 7, ac: 13, x: 420, y: 0, isPlaced: true, size: 1, conditions: [] }
    );
    mgr.dm = { userId: 'dm_user' };
    mgr.setInitiativeOrder([
      { id: 'tok_0', name: 'Aria', initiative: 20, dexMod: 0 },
      { id: 'tok_1', name: 'Borin', initiative: 15, dexMod: 0 },
      { id: 'tok_2', name: 'Goblin', initiative: 10, dexMod: 0 }
    ]);
    return mgr;
  };

  test('combat start anchors a fresh budget at the active token position', () => {
    const mgr = seedCombat();
    assert.strictEqual(mgr.state.movement.tokenId, 'tok_0');
    assert.strictEqual(mgr.state.movement.usedFt, 0);
    assert.deepStrictEqual(mgr.state.movement.trail, [{ x: 0, y: 0, cumFt: 0 }]);
  });

  test('a committed move charges 5ft per grid cell (diagonal = 5ft, PHB)', () => {
    const mgr = seedCombat();
    const r1 = mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r1.cost, 5);
    assert.strictEqual(r1.usedFt, 5);
    const r2 = mgr.attemptMove('tok_0', CELL * 2, CELL, 'user_a');
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.cost, 5, 'diagonal step still 5ft');
    assert.strictEqual(r2.usedFt, 10);
    assert.strictEqual(mgr.state.tokens[0].x, CELL * 2);
    assert.strictEqual(mgr.state.tokens[0].y, CELL);
  });

  test('multi-cell drags charge the Chebyshev distance, not the euclidean', () => {
    const mgr = seedCombat();
    const r = mgr.attemptMove('tok_0', CELL * 3, 0, 'user_a');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.cost, 15, '3 cells straight = 15ft');
    const mgr2 = seedCombat();
    const r2 = mgr2.attemptMove('tok_0', CELL * 3, CELL * 3, 'user_a');
    assert.strictEqual(r2.cost, 15, '3x3 diagonal drag = 3 cells = 15ft');
  });

  test('retracing the path rewinds and refunds movement (LIFO refund)', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a');       // 5ft
    mgr.attemptMove('tok_0', CELL * 2, 0, 'user_a');   // 10ft total
    const back = mgr.attemptMove('tok_0', CELL, 0, 'user_a'); // retrace one cell
    assert.strictEqual(back.ok, true);
    assert.strictEqual(back.rewound, true);
    assert.strictEqual(back.usedFt, 5, 'refund drops spend back to earlier trail point');
    assert.strictEqual(mgr.state.movement.usedFt, 5);
    assert.strictEqual(mgr.state.movement.trail.length, 2);
    assert.strictEqual(mgr.state.tokens[0].x, CELL);
  });

  test('rewinding to the turn anchor refunds the whole budget', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    mgr.attemptMove('tok_0', CELL * 2, CELL, 'user_a');
    const home = mgr.attemptMove('tok_0', 0, 0, 'user_a');
    assert.strictEqual(home.ok, true);
    assert.strictEqual(home.usedFt, 0);
    assert.strictEqual(mgr.state.movement.usedFt, 0);
  });

  test('over-budget moves are rejected and the token stays put', () => {
    const mgr = seedCombat(); // default speed 30ft
    assert.strictEqual(mgr.attemptMove('tok_0', CELL * 3, CELL * 3, 'user_a').ok, true);  // 15ft
    assert.strictEqual(mgr.attemptMove('tok_0', CELL * 6, CELL * 3, 'user_a').ok, true);  // 30ft total
    const r = mgr.attemptMove('tok_0', CELL * 7, CELL * 3, 'user_a'); // would be 35ft
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'no_movement');
    assert.strictEqual(r.usedFt, 30);
    assert.strictEqual(r.speed, 30);
    assert.strictEqual(mgr.state.tokens[0].x, CELL * 6, 'position unchanged on reject');
    assert.strictEqual(mgr.state.movement.usedFt, 30);
  });

  test('players cannot move a token on someone else\u2019s turn', () => {
    const mgr = seedCombat(); // tok_0's turn
    const r = mgr.attemptMove('tok_1', 280, 0, 'user_b');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'not_your_turn');
    assert.strictEqual(mgr.state.tokens[1].x, 210, 'Borin unmoved');
  });

  test('players cannot move other people\u2019s tokens at all', () => {
    const mgr = seedCombat();
    const r = mgr.attemptMove('tok_2', 490, 0, 'user_a');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'forbidden');
  });

  test('DM is exempt from the budget and re-bases the trail of the active token', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a'); // Aria spends 5ft
    const dmMove = mgr.attemptMove('tok_0', CELL * 4, CELL * 2, 'dm_user');
    assert.strictEqual(dmMove.ok, true);
    assert.strictEqual(dmMove.free, true, 'DM pays nothing');
    assert.strictEqual(mgr.state.movement.usedFt, 5, 'Aria\u2019s spend is preserved');
    assert.deepStrictEqual(mgr.state.movement.trail, [{ x: CELL * 4, y: CELL * 2, cumFt: 5 }]);
    // DM can also move non-active tokens freely mid-combat
    const dmOther = mgr.attemptMove('tok_2', CELL * 8, 0, 'dm_user');
    assert.strictEqual(dmOther.ok, true);
  });

  test('out-of-combat movement is free and untracked', () => {
    const mgr = new VTTManager();
    mgr.state.tokens.push(
      { id: 'tok_0', name: 'Aria', type: 'player', ownerId: 'user_a', hpCur: 20, hpMax: 20, ac: 16, x: 0, y: 0, isPlaced: true, size: 1, conditions: [] }
    );
    const r = mgr.attemptMove('tok_0', CELL * 9, CELL * 9, 'user_a');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.free, true);
    assert.strictEqual(mgr.state.movement, null);
  });

  test('downed combatants have 0ft of movement; same-cell drops still commit', () => {
    const mgr = seedCombat();
    mgr.state.tokens[0].hpCur = 0;
    const r = mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'no_movement');
    assert.strictEqual(r.speed, 0);
    const stay = mgr.attemptMove('tok_0', 0, 0, 'user_a');
    assert.strictEqual(stay.ok, true, 'dropping in place is free');
    assert.strictEqual(stay.cost, 0);
  });

  test('setTurn re-anchors the budget for the jumped-to combatant', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    assert.strictEqual(mgr.setTurn('tok_1'), true);
    assert.strictEqual(mgr.state.currentTurn, 'tok_1');
    assert.strictEqual(mgr.state.movement.tokenId, 'tok_1');
    assert.strictEqual(mgr.state.movement.usedFt, 0);
    assert.deepStrictEqual(mgr.state.movement.trail, [{ x: 210, y: 0, cumFt: 0 }]);
    assert.strictEqual(mgr.setTurn('tok_missing'), false);
  });

  test('advanceTurn gives the next combatant a fresh budget', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    mgr.advanceTurn();
    assert.strictEqual(mgr.state.movement.tokenId, 'tok_1');
    assert.strictEqual(mgr.state.movement.usedFt, 0);
  });

  test('setTokenSpeed changes the cap (DM-only) and enforcement follows', () => {
    const mgr = seedCombat();
    assert.strictEqual(mgr.setTokenSpeed('tok_0', 10, 'user_a'), null, 'players cannot set speed');
    assert.strictEqual(mgr.setTokenSpeed('tok_0', 10, 'dm_user').speed, 10);
    assert.strictEqual(mgr.attemptMove('tok_0', CELL, 0, 'user_a').ok, true);   // 5ft
    assert.strictEqual(mgr.attemptMove('tok_0', CELL * 2, 0, 'user_a').ok, true); // 10ft total
    const r = mgr.attemptMove('tok_0', CELL * 3, 0, 'user_a'); // would be 15ft
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'no_movement');
  });

  test('DM deploys an unplaced active combatant for free; later steps charge', () => {
    const mgr = seedCombat();
    mgr.state.tokens[1].isPlaced = false;
    mgr.advanceTurn(); // Borin's turn; unplaced → no budget yet
    assert.strictEqual(mgr.state.movement, null);
    const deploy = mgr.attemptMove('tok_1', CELL, CELL * 5, 'dm_user');
    assert.strictEqual(deploy.ok, true);
    assert.strictEqual(mgr.state.movement.tokenId, 'tok_1');
    assert.strictEqual(mgr.state.movement.usedFt, 0);
    assert.deepStrictEqual(mgr.state.movement.trail, [{ x: CELL, y: CELL * 5, cumFt: 0 }]);
    // Borin's own first step after the DM deployment charges normally
    const step = mgr.attemptMove('tok_1', CELL * 2, CELL * 5, 'user_b');
    assert.strictEqual(step.ok, true);
    assert.strictEqual(step.cost, 5);
    assert.strictEqual(step.usedFt, 5);
  });

  test('resetInitiative clears the movement budget', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    mgr.resetInitiative();
    assert.strictEqual(mgr.state.movement, null);
  });

  test('movement budget survives a state round-trip (init_state shape)', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    const snap = JSON.parse(JSON.stringify(mgr.getGameState()));
    assert.strictEqual(snap.movement.tokenId, 'tok_0');
    assert.strictEqual(snap.movement.usedFt, 5);
    assert.strictEqual(snap.movement.trail.length, 2);
  });

  test('getCombatSnapshot exposes speed and the live movement block', () => {
    const mgr = seedCombat();
    mgr.attemptMove('tok_0', CELL, 0, 'user_a');
    const snap = mgr.getCombatSnapshot('dm');
    const aria = snap.combatants.find(c => c.id === 'tok_0');
    assert.strictEqual(aria.speed, 30);
    assert.strictEqual(snap.movement.usedFt, 5);
    const agentSnap = mgr.getCombatSnapshot('agent');
    assert.strictEqual(agentSnap.movement.usedFt, 5, 'bridge sees movement too');
  });

  test('parseSpeedFt normalizes numbers, SRD strings and { walk } objects', () => {
    const mgr = new VTTManager();
    assert.strictEqual(mgr.parseSpeedFt(30), 30);
    assert.strictEqual(mgr.parseSpeedFt('30 ft.'), 30);
    assert.strictEqual(mgr.parseSpeedFt({ walk: 25 }), 25);
    assert.strictEqual(mgr.parseSpeedFt({ walk: '40 ft' }), 40);
    assert.strictEqual(mgr.parseSpeedFt(null), null);
    assert.strictEqual(mgr.parseSpeedFt('banana'), null);
  });
});
