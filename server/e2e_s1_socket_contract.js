#!/usr/bin/env node
/**
 * S1 Turn-Engine Contract Test — real-socket E2E (end_turn permission matrix + round tracking).
 *
 * Simulates over live sockets: 1 legacy DM + 2 stable guest players + 1 NPC, then walks the full
 * S1 permission matrix and round semantics on the RUNNING server (no mocks).
 *
 * Usage:
 *   1) Start the server with legacy DM enabled:
 *        VTT_ALLOW_LEGACY_DM=true node server/server.js     (Windows: set VTT_ALLOW_LEGACY_DM=true)
 *   2) From repo root:  node server/e2e_s1_socket_contract.js
 *      (optional: VTT_E2E_URL=http://<host>:3001 to test a remote host)
 *
 * ⚠️  Lab tool: writes test tokens/NPC + combat state into the RUNNING server's runtime state
 *     (guests "Aria"/"Borin", NPC "Bandit Captain"). It resets combat at the end, but delete the
 *     tokens in the UI afterwards if you ran this against your live table.
 *
 * NOTE: filename intentionally does NOT match `*.test.js` so `node --test` (npm test) ignores it —
 * the unit suite must stay green without a live server.
 */
let io;
try {
  io = require('socket.io-client');
} catch {
  // server/ does not depend on socket.io-client; reuse the client's copy.
  io = require(require('path').join(__dirname, '..', 'client', 'node_modules', 'socket.io-client'));
}

const URL = process.env.VTT_E2E_URL || 'http://127.0.0.1:3001';
const ROOM = 'S1LAB';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? '  [' + detail + ']' : ''}`); }
  else      { fail++; console.log(`  FAIL  ${name}${detail ? '  [' + detail + ']' : ''}`); }
}

function waitFor(sock, event, predicate = () => true, timeout = 1500) {
  return new Promise(resolve => {
    const h = payload => {
      if (predicate(payload)) { clearTimeout(t); sock.off(event, h); resolve(payload); }
    };
    const t = setTimeout(() => { sock.off(event, h); resolve(null); }, timeout);
    sock.on(event, h);
  });
}

function connect(auth) {
  return new Promise((resolve, reject) => {
    const s = io(URL, { auth: { roomCode: ROOM, ...auth }, transports: ['websocket'], reconnection: false, timeout: 6000 });
    // Connection-time events (socket_identity, first init_state) can arrive
    // before the caller attaches listeners — record first payload of each event.
    s._first = {};
    s.onAny((ev, ...args) => { if (!(ev in s._first)) s._first[ev] = args[0]; });
    s.on('connect', () => resolve(s));
    s.on('connect_error', err => reject(err));
  });
}

(async () => {
  console.log(`== S1 E2E: end_turn permission matrix + round tracking (${URL}) ==\n`);
  let dm, pa, pb;
  try {
    dm = await connect({ role: 'DM',     name: 'LabDM', userId: '11111111-1111-4111-8111-111111111111' });
    pa = await connect({ role: 'Player', name: 'Aria',  userId: '22222222-2222-4222-8222-222222222222' });
    pb = await connect({ role: 'Player', name: 'Borin', userId: '33333333-3333-4333-8333-333333333333' });
  } catch (e) {
    console.log('FATAL: could not connect —', e.message);
    console.log('Is the server running with VTT_ALLOW_LEGACY_DM=true?');
    process.exit(1);
  }

  // T0: server-resolved identity contract (guests included — hotfix ff57b61 dependency)
  const idDM = dm._first.socket_identity || await waitFor(dm, 'socket_identity');
  const idA  = pa._first.socket_identity || await waitFor(pa, 'socket_identity');
  const idB  = pb._first.socket_identity || await waitFor(pb, 'socket_identity');
  check('T0 socket_identity returned for DM', idDM && typeof idDM.userId === 'string', idDM?.userId);
  check('T0 guest identity resolved (DM)', /^guest_[0-9a-fA-F-]{8,64}$/.test(idDM?.userId || ''), idDM?.userId);
  check('T0 guest identity resolved (Aria)', /^guest_/.test(idA?.userId || ''), idA?.userId);
  check('T0 guest identity resolved (Borin)', /^guest_/.test(idB?.userId || ''), idB?.userId);
  const dmId = idDM.userId, ariaId = idA.userId, borinId = idB.userId;

  // Fresh page-load resync contract: request_full_state -> init_state
  dm.emit('request_full_state');
  const st = await waitFor(dm, 'init_state');
  const tokA = st?.tokens?.find(t => t.type === 'player' && t.id === ariaId);
  const tokB = st?.tokens?.find(t => t.type === 'player' && t.id === borinId);
  check('T0 player tokens auto-registered (Aria/Borin)', Boolean(tokA && tokB), `${tokA?.id} / ${tokB?.id}`);
  check('T0 pre-combat round is 0', st?.round === 0, `round=${st?.round}`);

  // NPC + initiative
  dm.emit('add_npc', { name: 'Bandit Captain', hp: 47, ac: 15 });
  const npcEvt = await waitFor(dm, 'npc_added', p => p?.token?.name === 'Bandit Captain');
  const npcId = npcEvt?.token?.id;
  check('T1 NPC spawned via add_npc', Boolean(npcId), npcId);

  pa.emit('submit_initiative', { tokenId: ariaId,  roll: 12, bonus: 2 }); // 14
  pb.emit('submit_initiative', { tokenId: borinId, roll: 5,  bonus: 1 }); // 6
  dm.emit('add_npc_initiative', { tokenId: npcId, initiative: 15 });
  await sleep(300);

  // Start combat -> round 1, NPC first (15 > 14 > 6)
  dm.emit('start_combat');
  const cs = await waitFor(dm, 'combat_started');
  check('T1 combat_started carries round=1', cs?.round === 1, `round=${cs?.round}`);
  check('T1 initiative order sorted desc', JSON.stringify((cs?.initiative || []).map(c => c.id)) === JSON.stringify([npcId, ariaId, borinId]),
        (cs?.initiative || []).map(c => `${c.name}:${c.initiative}`).join(' > '));
  const ts0 = await waitFor(dm, 'turn_started');
  check('T1 turn_started -> NPC first', ts0?.tokenId === npcId, ts0?.tokenId);

  // T11: S2 snapshot contract — DM asks, server answers; players get nothing
  dm.emit('request_combat_snapshot');
  const snap = await waitFor(dm, 'combat_snapshot');
  check('T11 combat_snapshot arrives for DM', Boolean(snap));
  check('T11 snapshot active, round 1', snap?.active === true && snap?.round === 1, `round=${snap?.round}`);
  check('T11 3 combatants, NPC first + flagged active', (snap?.combatants || []).length === 3 &&
        snap.combatants[0].id === npcId && snap.combatants[0].isActive === true,
        (snap?.combatants || []).map(c => c.name).join(' > '));
  check('T11 dm mode carries hp + ac + distFromActive', snap?.combatants?.[0]?.hpCur === 47 &&
        typeof snap?.combatants?.[0]?.ac === 'number' && typeof snap?.combatants?.[1]?.distFromActive === 'number',
        `hp=${snap?.combatants?.[0]?.hpCur}/${snap?.combatants?.[0]?.hpMax} ac=${snap?.combatants?.[0]?.ac}`);
  pa.emit('request_combat_snapshot');
  const rejSnap = await waitFor(pa, 'combat_snapshot', () => true, 800);
  check('T11 snapshot request from player REJECTED', rejSnap === null, 'no combat_snapshot in 800ms');

  // T2: player may NOT end an NPC turn (silent rejection)
  pa.emit('end_turn');
  const rejNpc = await waitFor(dm, 'turn_update', () => true, 800);
  check('T2 player end_turn on NPC turn REJECTED', rejNpc === null, 'no turn_update in 800ms');

  // T3: DM next_turn unaffected (full authority) -> Aria active
  dm.emit('next_turn');
  const tu3 = await waitFor(dm, 'turn_update');
  check('T3 DM next_turn works -> Aria active', tu3?.current === ariaId && tu3?.round === 1, `current=${tu3?.current} round=${tu3?.round}`);

  // T4: player may NOT end another player's turn
  pb.emit('end_turn');
  const rejOther = await waitFor(dm, 'turn_update', () => true, 800);
  check('T4 player end_turn on other player turn REJECTED', rejOther === null, 'no turn_update in 800ms');

  // T5: player ends OWN turn -> advances, round still 1, breadcrumb (round 1)
  pa.emit('end_turn');
  const tu5 = await waitFor(dm, 'turn_update');
  check('T5 Aria end_turn accepted -> Borin active', tu5?.current === borinId, `current=${tu5?.current}`);
  check('T5 round still 1 (no wrap)', tu5?.round === 1, `round=${tu5?.round}`);
  const ts5 = await waitFor(dm, 'turn_started');
  check('T5 turn_started -> Borin', ts5?.tokenId === borinId, ts5?.tokenId);
  const bc5 = await waitFor(dm, 'new_chat', p => typeof p?.message === 'string' && p.message.includes('ended their turn'));
  check('T5 breadcrumb text', /Aria ended their turn — Borin is up\. \(round 1\)/.test(bc5?.message || ''), bc5?.message);
  check('T5 breadcrumb sender is System', bc5?.sender === 'System', bc5?.sender);

  // T6: wrap -> round increments
  pb.emit('end_turn');
  const tu6 = await waitFor(dm, 'turn_update');
  check('T6 wrap to NPC -> round 2', tu6?.current === npcId && tu6?.round === 2, `current=${tu6?.current} round=${tu6?.round}`);
  const bc6 = await waitFor(dm, 'new_chat', p => typeof p?.message === 'string' && p.message.includes('ended their turn'));
  check('T6 breadcrumb carries (round 2)', /\(round 2\)/.test(bc6?.message || ''), bc6?.message);

  // T7: DM authority persists on NPC turn
  dm.emit('next_turn');
  const tu7 = await waitFor(dm, 'turn_update');
  check('T7 DM next_turn on NPC turn -> Aria, round 2 kept', tu7?.current === ariaId && tu7?.round === 2, `current=${tu7?.current} round=${tu7?.round}`);

  // T8: DM set_turn precise jump
  dm.emit('set_turn', borinId);
  const tu8 = await waitFor(dm, 'turn_update');
  check('T8 DM set_turn -> Borin', tu8?.current === borinId, tu8?.current);

  // T9: DM may end_turn directly (from last slot -> wraps)
  dm.emit('end_turn');
  const tu9 = await waitFor(dm, 'turn_update');
  check('T9 DM end_turn wraps -> NPC, round 3', tu9?.current === npcId && tu9?.round === 3, `current=${tu9?.current} round=${tu9?.round}`);

  // ── T12: S3 Movement Meter contract ──
  // Server-enforced per-turn budget: 5ft/grid Chebyshev, LIFO rewind refund,
  // out-of-turn rejection, DM exemption, DM-set speed cap.
  dm.emit('set_turn', ariaId);
  const tu12 = await waitFor(dm, 'turn_update');
  check('T12 setup: set_turn -> Aria active', tu12?.current === ariaId, tu12?.current);
  // Unplaced combatant => no budget yet (guest tokens auto-register in tray)
  const muNull = await waitFor(pa, 'movement_update', () => true, 800);
  check('T12 unplaced active combatant has null budget', muNull === null || muNull === undefined,
        'no movement_update in 800ms');

  // DM deploys Aria onto the map at the origin -> budget anchors there
  dm.emit('move_token_final', { tokenId: ariaId, x: 0, y: 0 });
  const deployEvt = await waitFor(pa, 'movement_update');
  check('T12 DM deploy anchors Aria budget at (0,0)', deployEvt?.tokenId === ariaId && deployEvt?.usedFt === 0,
        `usedFt=${deployEvt?.usedFt}`);

  // In-budget committed move: 2 cells = 10ft
  pa.emit('move_token_final', { tokenId: ariaId, x: 140, y: 0 });
  const mv1 = await waitFor(pa, 'movement_update', p => p?.usedFt > 0);
  check('T12 in-budget move commits (10ft spent)', mv1?.usedFt === 10, `usedFt=${mv1?.usedFt}`);

  // Retrace to the anchor cell -> rewind refunds the whole spend
  pa.emit('move_token_final', { tokenId: ariaId, x: 0, y: 0 });
  const mv2 = await waitFor(pa, 'movement_update', p => p?.usedFt === 0, 800);
  check('T12 retrace to anchor refunds (LIFO rewind)', mv2?.usedFt === 0, `usedFt=${mv2?.usedFt}`);

  // Spend 20ft, then attempt 20 more (40 > 30 default) -> rejected
  pa.emit('move_token_final', { tokenId: ariaId, x: 280, y: 0 });
  await waitFor(pa, 'movement_update', p => p?.usedFt === 20);
  pa.emit('move_token_final', { tokenId: ariaId, x: 560, y: 0 });
  const rejM = await waitFor(pa, 'move_rejected');
  check('T12 over-budget move REJECTED (no_movement)', rejM?.reason === 'no_movement', rejM?.reason);
  check('T12 rejection carries usedFt/speed/message', rejM?.usedFt === 20 && rejM?.speed === 30 &&
        typeof rejM?.message === 'string', `${rejM?.usedFt}/${rejM?.speed}`);
  dm.emit('request_full_state');
  const stM = await waitFor(dm, 'init_state');
  const ariaTokM = stM?.tokens?.find(t => t.id === ariaId);
  check('T12 rejected move left token at committed cell', ariaTokM?.x === 280, `x=${ariaTokM?.x}`);

  // Out-of-turn move by the other player -> rejected
  pb.emit('move_token_final', { tokenId: borinId, x: 350, y: 350 });
  const rejTurn = await waitFor(pb, 'move_rejected');
  check('T12 out-of-turn move REJECTED (not_your_turn)', rejTurn?.reason === 'not_your_turn', rejTurn?.reason);

  // DM is exempt: free move of a non-active token mid-combat
  // (predicate on x: the earlier rejection ALSO broadcast a token_final_position snap-back for Borin)
  dm.emit('move_token_final', { tokenId: borinId, x: 350, y: 350 });
  const dmMove = await waitFor(dm, 'token_final_position', p => p?.tokenId === borinId && p?.x === 350);
  check('T12 DM move of non-active token allowed (exempt)', dmMove?.x === 350, `x=${dmMove?.x}`);

  // Rewind Aria to her anchor so the spend resets before the cap test
  pa.emit('move_token_final', { tokenId: ariaId, x: 0, y: 0 });
  await waitFor(pa, 'movement_update', p => p?.usedFt === 0, 800);

  // DM tightens Aria's cap to 10ft; enforcement follows immediately
  dm.emit('set_token_speed', { tokenId: ariaId, speed: 10 });
  await waitFor(pa, 'movement_update', () => true, 800); // budget-holder push (payload may match)
  pa.emit('move_token_final', { tokenId: ariaId, x: 140, y: 0 }); // 2 cells = 10ft <= 10
  const mv3 = await waitFor(pa, 'movement_update', p => p?.usedFt === 10, 1000);
  check('T12 set_token_speed 10ft: 2-cell move commits at cap', mv3?.usedFt === 10, `usedFt=${mv3?.usedFt}`);
  pa.emit('move_token_final', { tokenId: ariaId, x: 280, y: 0 }); // +10ft > 10 cap
  const rejCap = await waitFor(pa, 'move_rejected');
  check('T12 move beyond DM-set cap rejected', rejCap?.reason === 'no_movement' && rejCap?.speed === 10,
        `speed=${rejCap?.speed}`);

  // T10: reset combat clears round/current
  dm.emit('reset_combat');
  const rs = await waitFor(dm, 'combat_reset');
  check('T10 combat_reset emitted', Boolean(rs));
  dm.emit('request_full_state');
  const st10 = await waitFor(dm, 'init_state');
  check('T10 state cleared (round=0, current=null)', st10?.round === 0 && st10?.currentTurn === null,
        `round=${st10?.round} current=${st10?.currentTurn}`);
  check('T10 movement budget cleared on reset', st10?.movement === null || st10?.movement === undefined,
        `movement=${JSON.stringify(st10?.movement)}`);

  [dm, pa, pb].forEach(s => s.disconnect());
  console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
