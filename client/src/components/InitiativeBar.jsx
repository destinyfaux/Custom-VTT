// client/src/components/InitiativeBar.jsx
import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import soundSynthesizer from '../utils/SoundSynthesizer';

export default function InitiativeBar({ role }) {
  const [initiative, setInitiative] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [tokens, setTokens] = useState([]);

  useEffect(() => {
    const handleState = (state) => {
      setInitiative(state.initiative || []);
      setCurrentTurn(state.currentTurn || null);
      setTokens(state.tokens || []);
    };

    socket.on('state_update', handleState);
    // Also listen for dedicated initiative events (optional)
    socket.on('combat_started', ({ initiative, current }) => {
      setInitiative(initiative || []);
      setCurrentTurn(current);
    });
    socket.on('turn_update', ({ current }) => {
      setCurrentTurn(current);
    });
    socket.on('combat_reset', () => {
      setInitiative([]);
      setCurrentTurn(null);
    });

    return () => {
      socket.off('state_update', handleState);
      socket.off('combat_started');
      socket.off('turn_update');
      socket.off('combat_reset');
    };
  }, []);

  // Play "Your Turn" chime whenever the active turn changes to a new token
  useEffect(() => {
    if (currentTurn) {
      soundSynthesizer.playYourTurn();
    }
  }, [currentTurn]);

  // Return null if combat isn't active
  if (!initiative || initiative.length === 0) return null;

  // Helper: find token data for a combatant
  const getTokenData = (combatantId) => tokens.find(t => t.id === combatantId);

  // DM advances the turn
  const handleNextTurn = () => {
    socket.emit('next_turn');
  };

  // DM jumps to a specific combatant's turn
  const handleJumpToTurn = (tokenId) => {
    if (role !== 'DM') return; // SECURITY: Only the DM can alter turn order
    const combatant = initiative.find(c => c.id === tokenId);
    if (!combatant) return;
    if (window.confirm(`Jump to ${combatant.name}'s turn?`)) {
      socket.emit('set_turn', tokenId); // ★ Call the newly implemented server channel
    }
  };

  // End combat
  const handleEndCombat = () => {
    if (window.confirm('End combat and clear initiative?')) {
      socket.emit('reset_combat');
    }
  };

  return (
    <div className="h-32 min-h-[8rem] flex-none bg-bgPanel/95 border-b border-borderDark flex items-center px-4 gap-3 overflow-x-auto scrollbar-hide">
      {/* Dynamic Keyframes Injection */}
      <style>{`
        @keyframes activeBreatheAndPulse {
          0% {
            transform: scale(1.05);
            border-color: rgba(200, 170, 110, 0.85);
            box-shadow: 0 0 10px rgba(200, 170, 110, 0.2), inset 0 0 4px rgba(200, 170, 110, 0.1);
          }
          50% {
            transform: scale(1.06);
            border-color: rgba(234, 179, 8, 1);
            box-shadow: 0 0 20px rgba(234, 179, 8, 0.65), inset 0 0 8px rgba(234, 179, 8, 0.3);
          }
          100% {
            transform: scale(1.05);
            border-color: rgba(200, 170, 110, 0.85);
            box-shadow: 0 0 10px rgba(200, 170, 110, 0.2), inset 0 0 4px rgba(200, 170, 110, 0.1);
          }
        }
        .animate-active-turn {
          animation: activeBreatheAndPulse 4s ease-in-out infinite;
          z-index: 20;
          opacity: 100% !important;
        }
      `}</style>

      {/* Combatant cards */}
      {initiative.map((comb) => {
        const token = getTokenData(comb.id);
        const isActive = comb.id === currentTurn;

        // Calculate health metrics
        const hpCur = token ? token.hpCur : 0;
        const hpMax = token ? Math.max(1, token.hpMax) : 1;
        const hpPercent = Math.min(100, Math.max(0, (hpCur / hpMax) * 100));
        const isDead = token ? token.hpCur <= 0 : false;

        // Determine if token represents a Player Character using authoritative type
        const isPlayerToken = token ? token.type === 'player' : false;

        // Visibility Rule: DM sees all; players only see other player tokens' health
        const canSeeHealth = role === 'DM' || isPlayerToken;

        // Dynamically transition health bar colors based on thresholds
        let hpColor = 'bg-green-500';
        if (hpPercent < 25) {
          hpColor = 'bg-red-600';
        } else if (hpPercent < 50) {
          hpColor = 'bg-yellow-500';
        }

        return (
          <div
            key={comb.id}
            onClick={() => handleJumpToTurn(comb.id)}
            className={`w-24 h-28 flex rounded overflow-hidden cursor-pointer select-none transition-all duration-300 relative bg-bgCard border shrink-0 ${
              isActive
                ? 'animate-active-turn border-accentGold'
                : 'border-borderDark opacity-75 hover:opacity-100 hover:border-accentGold/40'
            }`}
          >
            {/* Left Health Strip (Rendered conditionally based on role & token type) */}
            {canSeeHealth && (
              <div className="w-2 h-full bg-black/40 flex flex-col justify-end overflow-hidden shrink-0 border-r border-borderDark/10 z-10">
                <div
                  className={`${hpColor} transition-all duration-300 w-full`}
                  style={{ height: `${hpPercent}%` }}
                />
              </div>
            )}

            {/* Main Portrait Area & Card Text overlays */}
            <div className="flex-1 h-full relative">
              {/* Background Artwork */}
              <div className="absolute inset-0 z-0">
                {token?.avatarUrl ? (
                  <img
                    src={token.avatarUrl}
                    className="w-full h-full object-cover pointer-events-none"
                    alt=""
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-neutral-800 to-neutral-900 flex items-center justify-center">
                    <span className="text-xl font-bold text-white uppercase tracking-wider select-none">
                      {comb.name?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Death State Mask Layer */}
              {isDead && (
                <div className="absolute inset-0 bg-red-950/70 z-10 flex items-center justify-center pointer-events-none transition-all duration-300">
                  <div className="relative w-full h-full">
                    {/* Diagonal Slash 1 */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-1.5 bg-red-600/70 transform -rotate-45 -translate-x-1/2" />
                    {/* Diagonal Slash 2 */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-1.5 bg-red-600/70 transform rotate-45 -translate-x-1/2" />
                    {/* Skull Emblem */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] select-none">
                        💀
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Top-Right Initiative Badge */}
              <div className="absolute top-0 right-0 w-5 h-5 bg-[#1e2328] border-l border-b border-borderDark/50 flex items-center justify-center z-10">
                <span className="text-xs font-bold text-accentGold select-none">
                  {comb.initiative}
                </span>
              </div>

              {/* Bottom Name Banner */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/85 border-t border-borderDark/40 py-1 text-center z-20 px-1">
                <p className="text-[9px] font-extrabold text-white tracking-wider uppercase truncate select-none">
                  {comb.name}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* DM-only Options Card */}
      {role === 'DM' && (
        <div className="w-24 h-28 bg-bgCard border border-borderDark rounded flex flex-col justify-between p-2 shrink-0 select-none">
          <span className="text-[9px] font-bold text-gray-500 text-center tracking-widest border-b border-borderDark/40 pb-1 uppercase">
            OPTIONS
          </span>
          <button
            onClick={handleNextTurn}
            className="bg-accentGold text-black font-extrabold py-1.5 rounded text-[10px] hover:bg-yellow-500 active:scale-95 transition-all uppercase tracking-wider"
          >
            NEXT TURN
          </button>
          <button
            onClick={handleEndCombat}
            className="bg-red-950/40 hover:bg-red-900 border border-red-800/60 text-red-200 font-bold py-1 rounded text-[9px] active:scale-95 transition-all uppercase tracking-wider"
          >
            END COMBAT
          </button>
        </div>
      )}
    </div>
  );
}