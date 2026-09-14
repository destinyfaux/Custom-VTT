// client/src/components/CombatPanel.jsx
import { useEffect, useState, useRef, useMemo } from 'react';
import { socket } from '../socket';
import { buildMapLabels } from '../utils/tokenNaming';

export default function CombatPanel({ onClose }) {
  const [tokens, setTokens] = useState([]);
  const [initiativeEntries, setInitiativeEntries] = useState({});
  const [combatActive, setCombatActive] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(null);

  // For manual player roll override
  const [manualRollForPlayer, setManualRollForPlayer] = useState(null);
  const [manualRollValue, setManualRollValue] = useState('');
  
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });
  const [rollingAll, setRollingAll] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 700, y: 60 });
  const [size, setSize] = useState({ w: 420, h: 480 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // ── S2 SNAPSHOT — "feed answers, not maps" ──
  // While combat runs this panel is a live answer sheet: initiative order,
  // HP/AC/conditions, grid distance from the active combatant, round.
  // The server is the single source of truth (request_combat_snapshot →
  // combat_snapshot); the panel re-asks on every combat-relevant event,
  // debounced so HP bursts don't spam round-trips.
  const [snapshot, setSnapshot] = useState(null);
  const snapshotTimer = useRef(null);
  const requestSnapshot = () => {
    clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => socket.emit('request_combat_snapshot'), 120);
  };

  // Disambiguated display labels ("Goblin A/B/C") — same render-time labels as the map
  const mapLabels = useMemo(() => buildMapLabels(tokens), [tokens]);

  // Handle token state updates from both full state and lightweight events
  useEffect(() => {
    const handleState = (state) => {
      setTokens(state.tokens || []);
      // Rebuild initiative entries from server's initiative list
      const entries = {};
      (state.initiative || []).forEach(c => {
        entries[c.id] = c.initiative;
      });
      setInitiativeEntries(entries);
      setCombatActive(!!state.currentTurn);
      setCurrentTurn(state.currentTurn);
    };

    const handleTokenAdded = (data) => {
      setTokens(prev => {
        if (prev.some(t => t.id === data.token.id)) return prev;
        return [...prev, data.token];
      });
    };

    const handleTokenFinalPosition = ({ tokenId, x, y, isPlaced }) => {
      if (isPlaced) {
        setTokens(prev => prev.map(t =>
          t.id === tokenId ? { ...t, x, y, isPlaced: true } : t
        ));
      }
    };

    socket.on('init_state', handleState);
    socket.on('state_update', handleState);
    socket.on('token_added', handleTokenAdded);
    socket.on('npc_added', handleTokenAdded);
    socket.on('token_final_position', handleTokenFinalPosition);

    // Request full state immediately to catch any missed updates
    socket.emit('request_full_state');

    return () => {
      socket.off('init_state', handleState);
      socket.off('state_update', handleState);
      socket.off('token_added', handleTokenAdded);
      socket.off('npc_added', handleTokenAdded);
      socket.off('token_final_position', handleTokenFinalPosition);
    };
  }, []);

  // Snapshot lifecycle: answer listener + debounced re-ask on combat events
  useEffect(() => {
    const onSnapshot = (data) => setSnapshot(data || null);
    const onNeedRefresh = () => requestSnapshot();
    const watched = [
      'init_state', 'state_update', 'turn_update', 'turn_started', 'combat_started',
      'combat_reset', 'initiative_update', 'token_hp_changed', 'condition_toggled',
      'conditions_cleared', 'token_removed', 'npc_added', 'token_added'
    ];

    socket.on('combat_snapshot', onSnapshot);
    watched.forEach(ev => socket.on(ev, onNeedRefresh));
    socket.emit('request_combat_snapshot');

    return () => {
      socket.off('combat_snapshot', onSnapshot);
      watched.forEach(ev => socket.off(ev, onNeedRefresh));
      clearTimeout(snapshotTimer.current);
    };
  }, []);

  // Filter only placed tokens (on the map)
  const placedTokens = tokens.filter(t => t.isPlaced);

  const handleInitiativeChange = (tokenId, value) => {
    setInitiativeEntries(prev => ({ ...prev, [tokenId]: parseInt(value) || 0 }));
  };

  const submitNPCInitiative = (tokenId) => {
    const initiative = initiativeEntries[tokenId] || 0;
    socket.emit('add_npc_initiative', { tokenId, initiative });
  };

  // Server rolls 1d20 + DEX mod (from SRD monsterData) for one NPC
  const rollNPCInitiative = (tokenId) => {
    socket.emit('roll_npc_initiative', { tokenId }, (res) => {
      if (res?.success && res.results?.length) {
        setInitiativeEntries(prev => ({ ...prev, [tokenId]: res.results[0].total }));
      }
    });
  };

  // Server rolls every placed, living NPC in one go
  const rollAllNPCInitiative = () => {
    setRollingAll(true);
    socket.emit('roll_npc_initiative', { all: true }, (res) => {
      setRollingAll(false);
      if (res?.success && Array.isArray(res.results)) {
        setInitiativeEntries(prev => {
          const next = { ...prev };
          res.results.forEach(r => { next[r.tokenId] = r.total; });
          return next;
        });
      }
    });
  };

  const requestPlayerInitiative = (tokenId) => {
    socket.emit('request_initiative', [tokenId]);
  };

  // DM manual override for player initiative
  const submitManualPlayerInitiative = (tokenId, roll) => {
    const rollValue = parseInt(roll);
    if (isNaN(rollValue) || rollValue < 1 || rollValue > 20) {
      alert('Please enter a valid d20 roll (1-20).');
      return;
    }
    // Player initiative bonus is computed client-side; we send roll + bonus (0, because DM is overriding raw roll)
    // The server will add the player's initiative bonus automatically from their DEX mod.
    socket.emit('submit_initiative', { tokenId, roll: rollValue, bonus: 0 });
    setManualRollForPlayer(null);
    setManualRollValue('');
  };

  const startCombat = () => {
    if (Object.keys(initiativeEntries).length === 0) {
      alert('Add at least one token to initiative first.');
      return;
    }
    // First, ensure all local entries are submitted (for NPCs the DM can submit on the fly)
    // Actually, the server already has the entries from earlier emits.
    // Just send start_combat.
    socket.emit('start_combat');
  };

  const endCombat = () => {
    socket.emit('reset_combat');
  };

  const nextTurn = () => {
    socket.emit('next_turn');
  };

  const refreshTokens = () => {
    socket.emit('request_full_state');
  };

  // Dragging & resizing (same as before)
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'HEADER' || e.target.parentElement.tagName === 'HEADER') {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  };

  const handleResizeDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { w: size.w, h: size.h, mouseX: e.clientX, mouseY: e.clientY };
  };

  useEffect(() => {
    const move = (e) => {
      if (isDragging) setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      if (isResizing) {
        setSize({
          w: Math.max(380, resizeStart.current.w + (e.clientX - resizeStart.current.mouseX)),
          h: Math.max(400, resizeStart.current.h + (e.clientY - resizeStart.current.mouseY))
        });
      }
    };
    const up = () => { setIsDragging(false); setIsResizing(false); };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isDragging, isResizing]);

  return (
    <div
      className="fixed z-[1000] bg-bgPanel border border-accentGold rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      <header className="bg-bgCard p-3 flex justify-between items-center cursor-move border-b border-borderDark shrink-0">
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">
          {combatActive ? 'Combat Snapshot' : 'Initiative Panel'}
        </span>
        <div className="flex items-center gap-2">
          {combatActive && snapshot?.active && (
            <span className="text-[9px] font-bold text-black bg-accentGold rounded px-1.5 py-0.5 tracking-wide">
              ROUND {snapshot.round}
            </span>
          )}
          <button onClick={onClose} className="text-textMuted hover:text-white text-xs px-2">✕</button>
        </div>
      </header>

      <div className="flex-1 p-4 overflow-y-auto scrollbar-hide bg-[#0b0c10] space-y-3">
        {/* Setup tools are pre-combat only — during combat this panel is the answer sheet */}
        {!combatActive && (
          <div className="flex justify-end gap-1">
            <button
              onClick={rollAllNPCInitiative}
              disabled={rollingAll}
              className="bg-accentGold/20 text-accentGold px-2 py-0.5 rounded text-[9px] font-bold hover:bg-accentGold hover:text-black transition-colors disabled:opacity-50"
              title="Roll 1d20 + DEX mod for every placed, living NPC at once"
            >
              {rollingAll ? 'ROLLING…' : '🎲 AUTO-ROLL ALL NPCs'}
            </button>
            <button
              onClick={refreshTokens}
              className="bg-borderDark text-white px-2 py-0.5 rounded text-[9px] hover:bg-gray-700 transition-colors"
              title="Refresh token list"
            >
              ↻ Refresh
            </button>
          </div>
        )}

        {combatActive ? (
          snapshot?.active ? (
            <div className="space-y-1.5">
              {snapshot.combatants.map((c) => {
                const token = tokens.find(t => t.id === c.id);
                const label = mapLabels[c.id] || c.name;
                const hpPct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCur / c.hpMax) * 100)) : 0;
                const barColor = c.isDown ? 'bg-red-600' : c.isBloodied ? 'bg-amber-500' : 'bg-emerald-500';
                const distText = c.isActive ? 'SELF' : (c.distFromActive !== null && c.distFromActive !== undefined ? `${c.distFromActive} ft` : '—');
                return (
                  <div
                    key={c.id}
                    className={`p-2 rounded border flex flex-col gap-1 text-xs ${
                      c.isActive ? 'bg-accentGold/10 border-accentGold' : 'bg-bgCard border-borderDark opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-right font-bold text-accentGold text-[11px]">{c.initiative}</span>
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-borderDark flex-shrink-0 bg-bgPanel">
                        {token?.avatarUrl
                          ? <img src={token.avatarUrl} className="w-full h-full object-cover" alt="" />
                          : <span className="w-full h-full flex items-center justify-center text-[9px] text-textMuted">{(c.name || '?')[0]}</span>}
                      </div>
                      {c.isActive && <span className="text-accentGold text-[10px] font-bold">▶</span>}
                      <span className={`flex-1 truncate ${c.isActive ? 'text-accentGold font-bold' : 'text-white'}`}>{label}</span>
                      <span className="text-[8px] uppercase tracking-wider text-textMuted border border-borderDark rounded px-1 py-px">
                        {c.type === 'player' ? 'PC' : 'NPC'}
                      </span>
                      <span
                        className={`text-[9px] w-11 text-right ${c.isActive ? 'text-accentGold/80' : 'text-sky-400'}`}
                        title="Grid distance from the active combatant (5ft per cell, diagonals count as 5ft)"
                      >
                        {distText}
                      </span>
                      <span className="text-[9px] text-white bg-borderDark rounded px-1.5 py-px" title="Armor Class">
                        AC {c.ac ?? '?'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-bgPanel rounded overflow-hidden border border-borderDark">
                        <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${hpPct}%` }} />
                      </div>
                      <span className={`text-[9px] w-16 text-right ${c.isDown ? 'text-red-400 font-bold' : 'text-textMuted'}`}>
                        {c.isDown ? (c.isDead ? 'DEAD' : 'DOWN') : `${c.hpCur}/${c.hpMax}`}
                      </span>
                    </div>
                    {c.conditions?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.conditions.map(cond => (
                          <span key={cond} className="text-[8px] uppercase tracking-wide text-purple-300 bg-purple-900/40 border border-purple-700/60 rounded px-1 py-px">
                            {cond}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-textMuted italic text-center py-8">Reading the field…</p>
          )
        ) : (
          <>
            {placedTokens.length === 0 && (
              <p className="text-[10px] text-textMuted italic text-center py-8">
                No tokens placed on the map.
              </p>
            )}

        {placedTokens.map(token => {
          const entryValue = initiativeEntries[token.id] || '';
          const hasEntry = entryValue !== '';
          const isManualOverrideOpen = manualRollForPlayer === token.id;

          return (
            <div key={token.id} className="bg-bgCard p-2 rounded border border-borderDark flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-borderDark flex-shrink-0">
                {token.avatarUrl ? <img src={token.avatarUrl} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-[10px]">{token.name[0]}</span>}
              </div>
              <span className="flex-1 text-white truncate">{mapLabels[token.id] || token.name}</span>
              <span className="text-[9px] text-textMuted">{token.type}</span>
              </div>

              {token.type === 'player' ? (
                <div className="flex items-center justify-between gap-2 mt-1">
                  {!isManualOverrideOpen ? (
                    <>
                <button
                  onClick={() => requestPlayerInitiative(token.id)}
                        className="bg-accentGold/20 text-accentGold px-2 py-0.5 rounded text-[9px] font-bold hover:bg-accentGold hover:text-black transition-colors"
                >
                  REQUEST ROLL
                </button>
                      <button
                        onClick={() => setManualRollForPlayer(token.id)}
                        className="bg-borderDark text-white px-2 py-0.5 rounded text-[9px] hover:bg-gray-700 transition-colors"
                      >
                        MANUAL
                      </button>
                    </>
                  ) : (
                    <div className="flex gap-2 w-full">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={manualRollValue}
                        onChange={e => setManualRollValue(e.target.value)}
                        placeholder="d20 roll"
                        className="w-16 bg-bgPanel text-white text-center border border-borderDark rounded p-0.5 text-[10px] focus:border-accentGold"
                        autoFocus
                      />
                      <button
                        onClick={() => submitManualPlayerInitiative(token.id, manualRollValue)}
                        className="bg-accentGold text-black px-2 py-0.5 rounded text-[9px] font-bold hover:bg-yellow-500"
                      >
                        SUBMIT
                      </button>
                      <button
                        onClick={() => { setManualRollForPlayer(null); setManualRollValue(''); }}
                        className="bg-borderDark text-white px-2 py-0.5 rounded text-[9px] hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={entryValue}
                    onChange={(e) => handleInitiativeChange(token.id, e.target.value)}
                    placeholder="Roll"
                    className="w-12 bg-bgPanel text-white text-center border border-borderDark rounded p-0.5 text-[10px] focus:border-accentGold"
                  />
                  <button
                    onClick={() => rollNPCInitiative(token.id)}
                    className="bg-accentGold/20 text-accentGold px-2 py-0.5 rounded text-[9px] font-bold hover:bg-accentGold hover:text-black transition-colors"
                    title="Roll 1d20 + DEX modifier from the SRD stat block"
                  >
                    🎲 ROLL
                  </button>
                  <button
                    onClick={() => submitNPCInitiative(token.id)}
                    disabled={!hasEntry}
                    className="bg-borderDark text-white px-2 py-0.5 rounded text-[9px] hover:bg-gray-700 disabled:opacity-50"
                  >
                    SET
                  </button>
                </div>
              )}
            </div>
          );
        })}
          </>
        )}

        {/* Combat controls */}
        <div className="border-t border-borderDark pt-3 mt-2 space-y-2">
          {!combatActive ? (
            <button
              onClick={startCombat}
              className="w-full bg-accentGold text-black font-bold py-2 rounded text-sm hover:bg-yellow-500 transition-colors"
            >
              START COMBAT
            </button>
          ) : (
            <>
              <button
                onClick={nextTurn}
                className="w-full bg-accentGold text-black font-bold py-2 rounded text-sm hover:bg-yellow-500 transition-colors"
              >
                NEXT TURN
              </button>
              <button
                onClick={endCombat}
                className="w-full bg-red-900 text-white font-bold py-2 rounded text-sm hover:bg-red-700 transition-colors"
              >
                END COMBAT
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 group"
        onMouseDown={handleResizeDown}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-accentGold opacity-30 group-hover:opacity-100" />
      </div>
    </div>
  );
}