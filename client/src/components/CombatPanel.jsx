// client/src/components/CombatPanel.jsx
import { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';

export default function CombatPanel({ onClose }) {
  const [tokens, setTokens] = useState([]);
  const [initiativeEntries, setInitiativeEntries] = useState({});
  const [combatActive, setCombatActive] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [pos, setPos] = useState({ x: window.innerWidth - 700, y: 60 });
  const [size, setSize] = useState({ w: 420, h: 480 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // For manual player roll override
  const [manualRollForPlayer, setManualRollForPlayer] = useState(null);
  const [manualRollValue, setManualRollValue] = useState('');
  
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });

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

  // Filter only placed tokens (on the map)
  const placedTokens = tokens.filter(t => t.isPlaced);

  const handleInitiativeChange = (tokenId, value) => {
    setInitiativeEntries(prev => ({ ...prev, [tokenId]: parseInt(value) || 0 }));
  };

  const submitNPCInitiative = (tokenId) => {
    const initiative = initiativeEntries[tokenId] || 0;
    socket.emit('add_npc_initiative', { tokenId, initiative });
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
        <span className="text-accentGold font-bold text-[10px] uppercase tracking-widest">Initiative Panel</span>
        <button onClick={onClose} className="text-textMuted hover:text-white text-xs px-2">✕</button>
      </header>

      <div className="flex-1 p-4 overflow-y-auto scrollbar-hide bg-[#0b0c10] space-y-3">
        {/* Refresh button */}
        <div className="flex justify-end">
          <button
            onClick={refreshTokens}
            className="bg-borderDark text-white px-2 py-0.5 rounded text-[9px] hover:bg-gray-700 transition-colors"
            title="Refresh token list"
          >
            ↻ Refresh
          </button>
        </div>

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
              <span className="flex-1 text-white truncate">{token.name}</span>
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