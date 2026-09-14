# AGENT_WORKLOG — Custom-VTT

> **Purpose:** Persistent memory for AI coding agents working on this repo. Lives IN the repo so every
> push carries the latest session history forward — container workstations get wiped, git does not.
> Each session MUST read this file before working and append a new section after finishing.
>
> Format: append-only, each entry starts with `---`, includes Task ID / Agent / Task / Work Log / Stage Summary.

## Project Facts (stable context — read first)

- Self-hosted D&D VTT. Server: Node + Express 5 + Socket.IO, port 3001 (`server/`).
  Client: React 18 + Vite + Tailwind, port 5173 (`client/`).
- Run unit tests from `server/` only: `npm test` (node:test, direct VTTManager testing).
- Client build validates JSX: `npm run build` in `client/`.
- User workflow: agent edits in container → push to GitHub → user pulls via `pull_from_github.bat` on Windows.
- User has authorized container-side self-testing ("You can always test on your end as well") — spin up the
  server locally, simulate sockets/browsers, verify before reporting.
- Git identity: destinyfaux / sullie.bear@gmail.com. Remote origin has embedded PAT.
- E2E harness: `server/e2e_s1_socket_contract.js` — real-socket turn-engine contract test
  (usage documented in its header; needs server running with `VTT_ALLOW_LEGACY_DM=true`).
- Combat protocol v2 agreed; build order locked: **S1 → S2 → S3 → S4**, then Test B (user hosts as DM,
  verify preview proxy websocket passthrough), then Bridge prototype (AI player).
- Test A baseline (manual combat, Cassian vs Bandit Captain, 4 rounds) produced friction list F1–F10 —
  the requirements source for S1–S4.
- Roadmap details:
  - **S1** (SHIPPED): player End Turn + round tracking + Template dropdown fix.
  - **S2** (SHIPPED, `e1305ba`): Combat Snapshot — getCombatSnapshot dm/agent modes + DM live panel.
  - **S3** (SHIPPED): Movement Meter — start-of-turn position anchor; committed drops cost 5ft/grid
    (Chebyshev, PHB diagonal rule); retracing your path rewinds & refunds (LIFO generalized);
    DM exempt; out-of-combat free; downed = 0ft; server-enforced with client drag preview.
  - **S4** Targeting / Quick Resolve — pick target, server-side d20+mods, AC never leaves the server;
    result feeds chat narrative. Gate for the AI bridge action whitelist. NEXT UP.
  - **Bridge prototype** — AI connects as a player socket, reads S2 snapshot, acts via S4 whitelist
    (move / attack / speak / end turn).
- Known bugs parked (round-3 candidates): presence "0 online" after rejoin; chat display names frozen at
  join time (don't follow vault renames); adjacent token labels run together.
- Round-3 QoL backlog (6): Discord hyperlink embeds, music default volume 10%, remove blur, login page
  redesign + changelog, login character selection, player card responsiveness + FX customization.

## Milestone commits

- `07fa982` — round-1 feature set (5 features)
- `d63ab04` — round-2 feature set (4 features)
- `6c1cda1` — user's AI-assisted character creation work
- `d08d8a3` — S1: player End Turn + round tracking + Template dropdown fix
- `ff57b61` — S1 hotfix: guest identity (`socketUserId` state) for End Turn card + InitiativeBar
  consumes `init_state` on rejoin (fixes Test A "tracker only appeared after panel close" friction)
- `e1305ba` — S2: Combat Snapshot (server serialization dm/agent + DM live panel, T11)
- (this commit) — S3: Movement Meter (server budget engine + client meter/trail/snap-back, T12)
- (this commit) — Bugfix round: journal spoiler force-close + group movement (batch protocol,
  per-key rate limits, drop-path ReferenceError, T13)

---
Task ID: 14
Agent: Super Z (main agent)
Task: Container self-test of S1 (user-authorized); report roadmap status.

Work Log:
- Container reset #4 wiped all local files. Re-cloned repo via PAT; re-set git identity.
- Verified new hotfix commit `ff57b61` present on main (guest identity + init_state rejoin fix).
- Installed server + client deps. Unit suite: 31/31 pass on fresh clone.
- Started server (`VTT_ALLOW_LEGACY_DM=true`, port 3001) and wrote a real-socket E2E harness
  (1 legacy DM + 2 stable guest players + 1 NPC). First run exposed a race: connection-time events
  (`socket_identity`, first `init_state`) arrive before listeners attach — fixed via `onAny`
  first-payload capture.
- Result: **25/25 E2E assertions pass**: guest identity resolution; player token auto-registration;
  round=0 pre-combat; `combat_started` round=1 + desc initiative sort; player `end_turn` REJECTED on
  NPC turn and on other player's turn; ACCEPTED on own turn (advance + `turn_started` + System
  breadcrumb "Aria ended their turn — Borin is up. (round 1)"); wrap → round 2; DM
  `next_turn`/`set_turn`/`end_turn` full authority incl. wrap → round 3; `reset_combat` → round 0.
- Client production build passes (pre-existing chunk-size warning only).
- No code changes this task (verification only).

Stage Summary:
- S1 (+ hotfix) verified end-to-end: unit 31/31 + E2E 25/25 + clean build. Ready for user pull & play-test.
- E2E harness now committed at `server/e2e_s1_socket_contract.js` for reuse after S2–S4 (Task 15).

---
Task ID: 15
Agent: Super Z (main agent)
Task: Persistence layer — move agent worklog into the repo; commit E2E harness; document continuity protocol.

Work Log:
- User directive: sessions refresh periodically and local workstation files get wiped — keep the active
  worklog inside the repo so every push snapshots session history.
- Created `AGENT_WORKLOG.md` (this file) at repo root; `/home/z/my-project/worklog.md` kept as an
  external mirror for system tooling.
- Moved the S1 E2E harness into the repo as `server/e2e_s1_socket_contract.js`:
  - portable `require` (tries `socket.io-client`, falls back to `../client/node_modules/`),
  - `VTT_E2E_URL` env override (default `http://127.0.0.1:3001`),
  - named so `node --test` does NOT pick it up (keeps `npm test` green without a live server).
- Appended "8. Agent Session Continuity" to `AGENTS.md.txt` (read worklog first, append after, run E2E
  harness for combat changes).
- Pushed to origin/main.

Stage Summary:
- Agent memory is now git-persistent. Future sessions: read this file → work → append entry → commit+push.
- Next: S2 Snapshot Panel (snapshot serialization + DM panel).

---
Task ID: 16
Agent: Super Z (main agent)
Task: S2 Snapshot Panel — "feed answers, not maps" (server serialization + DM live panel).

Work Log:
- Server: added `VTTManager.getCombatSnapshot(mode)`. mode 'dm' = full data (AC, ownerId);
  mode 'agent' = redacted (no AC/ownerId, hidden/unplaced tokens excluded) — prepared for the
  AI bridge. Derives isBloodied (hp <= 50% max), isDown (hp <= 0 or dead), conditions copy,
  and grid distance from the active combatant (center-to-center Chebyshev; 70px = 5ft cell,
  must match CanvasMap.jsx GRID_SIZE; rounded to nearest 5ft; diagonal costs 5ft — PHB default).
  Returns `{ active, round, currentTurn, combatants[] }`; initiative list is the order source
  (a combatant whose token was deleted still appears).
- Server: new DM-only socket event `request_combat_snapshot` → replies `combat_snapshot`
  (request→reply keeps event traffic lean, per invariant #2).
- Client: CombatPanel.jsx is now dual-mode. Pre-combat: unchanged initiative setup. During
  combat: live "Combat Snapshot" view — ordered combatants with initiative number, avatar,
  PC/NPC tag, grid distance, AC chip, HP bar (emerald / amber bloodied / red DOWN-DEAD),
  condition chips, gold-highlighted active row + ROUND chip in header. Panel re-requests the
  snapshot (debounced 120ms) on every combat-relevant event; listeners unbound in cleanup.
- Unit tests: +6 snapshot tests (order/active/round; bloodied/down/conditions; distance math
  incl. diagonal; dm-vs-agent redaction; inactive state; deleted-token ghost combatant).
  37/37 green. Fixed a test-fixture slip en route: 8/28 HP IS bloodied (<= 50%).
- E2E harness extended with T11 (5 assertions): DM receives snapshot with correct order/round/
  hp/ac/distance; a player's snapshot request is rejected. 30/30 green.
- Client build clean. AGENTS.md.txt: protocol row for request_combat_snapshot + section 8
  count updated to 30/30.

Stage Summary:
- S2 delivered: the DM's answer sheet is live, and the snapshot serialization the AI bridge
  will consume is now a stable server contract (dm/agent modes).
- S1 end_turn semantics untouched — full E2E still green on top of S2.
- Next: S3 Movement Meter (start-of-turn anchor, 5ft path cost, LIFO refund, DM exempt).

---
Task ID: 17
Agent: Super Z (main agent)
Task: S3 Movement Meter — server-enforced per-turn movement budget with client preview.

Work Log:
- Server engine (VTTManager.js):
  • `state.movement` = { tokenId, usedFt, trail: [{x,y,cumFt}] } — lives in state so
    getGameState/init_state carries it to fresh joins and persistence for free.
  • Turn engine hooks: setInitiativeOrder / advanceTurn / new setTurn() all call
    anchorMovement(activeId) — every turn change re-anchors at the combatant's current cell,
    usedFt 0; resetInitiative clears the budget.
  • attemptMove() is now the ONE gate for committed moves (move_token_final): ownership
    checks, mid-combat active-combatant restriction (not_your_turn), Chebyshev cost
    5ft/cell (fractional cells round to nearest cell, min 5ft), rewind refund when dropping
    on any earlier trail cell (LIFO is the single-step case), over-budget → no_movement
    rejection with snap-back coords, DM exempt, out-of-combat free, DM deploy of an unplaced
    active combatant establishes the budget free (moveToken's gate keeps placement DM-only),
    downed/dead = 0ft but same-cell drops still commit.
  • Speed: token.speed field (player tokens from charData.speed via upsert, NPC from
    monsterData.speed via parseSpeedFt which normalizes 30 / "30 ft." / {walk:30}), default 30;
    DM-settable via setTokenSpeed (0-999).
  • getCombatSnapshot now exposes per-combatant speed + a top-level movement block (bridge-ready).
- Server events (server.js): move_token_final → attemptMove; rejections emit move_rejected
  {tokenId, reason, x, y, usedFt, speed, needed, message} to the mover + token_final_position
  snap-back to everyone (kills previewed-drag drift); accepts broadcast movement_update.
  movement_update also fired on start_combat / next_turn / end_turn / set_turn / reset_combat(null)
  and after set_token_speed. New DM-only set_token_speed event.
- Client:
  • utils/movement.js — shared math (stepCostFt / effectiveSpeedFt / projectMovement),
    mirrored from the server engine; utils/canvasOverlayRenderer.js — drawMeterBadge
    (color-tinted badge: green → amber 80% → red).
  • CanvasMap.jsx — movement + moveBlocked state; movement_update/move_rejected listeners;
    init_state carries movement; gold trail breadcrumbs under tokens (outlined = turn anchor);
    drag preview badge above the held token ("25/30 ft", "↺" on rewind, "OUT", or
    "Not your turn" when dragging off-turn — player-only, DM exempt so no lying badge);
    move_rejected snaps the token to the server's committed cell (netInterpolation +
    settleLock cleared + drag cancelled) and shows an auto-hiding red banner (2.8s).
  • InitiativeBar.jsx — End Turn card now doubles as the meter: MOVE used/speed + color bar.
  • TokenContextMenu.jsx — DM-only "🥾 Speed: N ft" row (prompt → set_token_speed).
- Tests: unit +19 → 56/56 (anchors, cost math, diag=5ft, rewind/anchor refund, over-budget,
  not_your_turn, forbidden, DM exempt + re-base, out-of-combat free, downed 0ft, setTurn/
  advanceTurn re-anchor, setTokenSpeed, DM deploy, reset clears, state round-trip, snapshot
  speed/movement, parseSpeedFt). E2E T12 +13 → 43/43 (live-socket: null budget for unplaced,
  DM deploy anchor, commit 10ft, rewind refund, over-budget reject + snap-back position,
  not_your_turn, DM exempt move, set_token_speed cap, budget cleared on reset). Client build
  clean (pre-existing chunk warning only). En route: fixed a test-flow bug (forgot the rewind
  before the cap test) and a waitFor race (rejection also broadcasts token_final_position).
- AGENTS.md.txt: move_token_final row rewritten, set_token_speed row added, §8 count 43/43.

Stage Summary:
- S3 delivered: nobody has to track movement by hand anymore (Test A friction closed).
  The server is the single source of truth; the client previews with identical math and
  snaps back on rejection. `state.movement` + snapshot movement block are the contract the
  AI bridge will read to know what a creature can still reach.
- Next: S4 Targeting / Quick Resolve (server-side dice, AC never leaves the server),
  then Test B (preview-proxy websocket passthrough), then the Bridge prototype.

---
Task ID: 18
Agent: Super Z (main agent)
Task: Playtest bugfixes from live table session — journal spoiler force-close + group token movement.

Work Log:
- User report 1 (journal): when a player creates a Spoiler (collapsible <details>) or other
  dropdown-style formatting in the Character Journal, it force-closes — they can't read or write
  inside what they made.
- Root cause: the WYSIWYG editor's sync effect compared raw innerHTML strings. Toggling a spoiler
  sets the `open` attribute in the DOM but never fires an input event, so the stored HTML never
  contains `open` — every state_update/echo that re-ran the comparison saw a "changed" page and
  rewrote editor.innerHTML, recreating every <details> closed (and dropping the caret). The 100ms
  isInternalTyping guard was far too narrow to cover echo timing.
- JournalCard.jsx fix: (a) open-aware comparison via stripDetailsOpen() on BOTH sides — toggling is
  now a pure view-state change; (b) saves strip `open` so stored HTML is canonical; (c) lastSavedRef
  echo guard — this client's own round-tripped saves never trigger a rewrite no matter how late
  they arrive; (d) genuine remote rewrites snapshot and restore per-<details> open state; (e)
  handleEditorClick takes over <summary> clicks (preventDefault + manual toggle) — Chrome's
  contentEditable summary handling is unreliable on its own; (f) inserting a spoiler auto-opens it
  so players can write immediately; (g) summary/detail CSS polish.
- User report 2 (canvas): "group tokens but drag and drop doesn't work as expected; more steps than
  moving individually."
- Root cause A (hard crash): in handleMouseUp, the group-landing block referenced snappedX/snappedY
  which were block-scoped inside the sibling `if (token)` — EVERY group drop threw a ReferenceError,
  skipped all member commits, and left draggedToken set (drag wedged to cursor until Esc).
- Root cause B (silent starvation): socket.checkRateLimit kept ONE shared counter per socket. A
  group drag emitted move_token per member every 25ms ((N+1)×40/s), pushing the shared count past
  move_token_final's limit of 20 — so the drop's final commits were rate-limit-rejected and tokens
  snapped back on the next sync. Solo drags were intermittently affected too.
- Server fixes: checkRateLimit(limit, windowMs, key) now keeps PER-KEY buckets ('move' 90/s,
  'move_final' 40/s for the single path, batch finals 30/s; other events unchanged on 'global');
  new batched handlers move_tokens (transient → one tokens_moved broadcast) and move_tokens_final
  (each move through the same attemptMove gate; per-token commit/reject events; one trailing
  movement_update; ≤50 moves; tokens the sender doesn't own are skipped exactly like the single
  path).
- Client fixes (CanvasMap.jsx): drop path restructured — snapped landing spot hoisted to shared
  scope (ReferenceError gone); group drags emit ONE move_tokens per 25ms tick and ONE
  move_tokens_final on drop (leader + members, individually snapped, settle locks unchanged); solo
  drags keep the legacy single-token events; new tokens_moved batch listener applies per-token
  guards (version, own-drag, settle lock) in a single setTokens pass.
- Tests: unit suite untouched 56/56. E2E +T13 (7 assertions): batch drop commits all members;
  commit survives an 80-event transient flood (locks the starvation fix); bogus batch entries skip
  without harm; mid-combat batch — non-active self-token rejected (not_your_turn) while the active
  combatant's batched move commits. 50/50 green. En route: fixed two harness sequencing artifacts
  (listener attach AFTER sibling waits missed fast commit events; a player batching another's token
  is ownership-skipped before the turn gate — the not_your_turn case needs the sender's OWN token).
- Client production build clean (pre-existing chunk-size warning only). AGENTS.md.txt: per-key
  rate-limit note + move_tokens/move_tokens_final protocol rows.
- Debug artifact kept at /home/z/my-project/scripts/debug_t134.cjs (outside the repo).

Stage Summary:
- Journal spoilers now stay open while reading, writing, and syncing; toggle works reliably; new
  spoilers open ready to write.
- Group movement works like single movement: grab any member and drag, the whole formation follows
  live for peers and lands on drop; partial rejections snap back only the offending token. The
  crashed/starved drop paths are covered by T13 contract tests.
- Next unchanged: S4 Targeting / Quick Resolve, then Test B, then the Bridge prototype.
