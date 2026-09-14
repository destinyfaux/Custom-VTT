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
  - **S2** Snapshot Panel — "feed answers, not maps": serialize combat snapshot (positions, HP,
    conditions, round/turn) for DM panel + future AI bridge. NEXT UP.
  - **S3** Movement Meter — start-of-turn position anchor; drag path costs 5ft/grid; LIFO refund so
    retracing is free; DM exempt; server-enforced budget with client preview.
  - **S4** Targeting / Quick Resolve — pick target, server-side d20+mods, AC never leaves the server;
    result feeds chat narrative. Gate for the AI bridge action whitelist.
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
