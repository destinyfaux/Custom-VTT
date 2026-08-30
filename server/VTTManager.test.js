const test = require('node:test');
const assert = require('node:assert/strict');
const { VTTManager } = require('./VTTManager');

test('adjustTokenHP rejects invalid amounts and falls back to a sane max HP', () => {
  const manager = new VTTManager();
  manager.state.tokens = [{
    id: 'token_1',
    ownerId: 'user_1',
    type: 'player',
    name: 'Alice',
    hpCur: 2,
    hpMax: undefined,
    conditions: []
  }];

  assert.equal(manager.adjustTokenHP('token_1', 0, true), null);
  assert.equal(manager.adjustTokenHP('token_1', 10000, false), null);
  assert.equal(manager.adjustTokenHP('token_1', 7, 'true'), null);

  const result = manager.adjustTokenHP('token_1', 3, true);
  assert.ok(result);
  assert.equal(result.newHp, 5);
  assert.equal(result.token.hpMax, 10);
});

test('moveToken ignores non-finite coordinates and unauthorized moves', () => {
  const manager = new VTTManager();
  manager.state.tokens = [{
    id: 'token_2',
    ownerId: 'user_1',
    type: 'player',
    name: 'Bob',
    x: 10,
    y: 20,
    isPlaced: true,
    conditions: []
  }];

  manager.moveToken('token_2', Number.NaN, 40, 'user_1');
  assert.equal(manager.state.tokens[0].x, 10);
  assert.equal(manager.state.tokens[0].y, 20);

  manager.moveToken('token_2', 50, 60, 'user_2');
  assert.equal(manager.state.tokens[0].x, 10);
  assert.equal(manager.state.tokens[0].y, 20);

  manager.moveToken('token_2', 70, 80, 'user_1');
  assert.equal(manager.state.tokens[0].x, 70);
  assert.equal(manager.state.tokens[0].y, 80);
});

test('addNPCTokenBatch creates a single logical batch and preserves each spawned token', () => {
  const manager = new VTTManager();
  manager.state.tokens = [];

  const created = manager.addNPCTokenBatch([
    { name: 'Goblin', avatarUrl: '', hp: 7, ac: 15 },
    { name: 'Goblin', avatarUrl: '', hp: 7, ac: 15 },
    { name: 'Goblin', avatarUrl: '', hp: 7, ac: 15 }
  ]);

  assert.equal(created.length, 3);
  assert.equal(manager.state.tokens.length, 3);
  assert.ok(created.every(token => token.type === 'npc'));
  assert.ok(created.every(token => token.id.startsWith('npc_')));
});

test('deleteTokenBatch removes multiple unplaced NPCs in one pass without touching player tokens', () => {
  const manager = new VTTManager();
  manager.state.tokens = [
    { id: 'npc_1', type: 'npc', name: 'Goblin 1', isPlaced: false },
    { id: 'npc_2', type: 'npc', name: 'Goblin 2', isPlaced: false },
    { id: 'player_1', type: 'player', name: 'Alice', isPlaced: false },
    { id: 'npc_3', type: 'npc', name: 'Goblin 3', isPlaced: true }
  ];

  const removed = manager.deleteTokenBatch(['npc_1', 'npc_2', 'player_1', 'missing']);
  assert.equal(removed, 2);
  assert.equal(manager.state.tokens.length, 2);
  assert.ok(manager.state.tokens.every(token => token.type !== 'npc' || !['npc_1', 'npc_2'].includes(token.id)));
  assert.ok(manager.state.tokens.some(token => token.id === 'npc_3'));
});
